/**
 * One shared set of live database listeners for the whole app.
 * Every screen reads from useData() instead of opening its own listeners.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { db } from './db'
import { dateStr, weekStartStr } from './dates'
import { DEFAULT_SETTINGS, DEFAULT_RULES, DEFAULT_ITEMS, DEMO_NAMES } from '../data/defaults'
import type { Settings, Student, EarnRule, StoreItem, Tx, HallPass, ListEntry } from './types'

export interface Data {
  ready: boolean
  settings: Settings
  students: Student[]          // active only, A→Z
  allStudents: Student[]       // including removed
  rules: EarnRule[]
  items: StoreItem[]
  /** banks[studentId][itemId] = credits locked toward that buy-in item */
  banks: Record<string, Record<string, number>>
  /** lists[itemId] = students who bought it and are on its list */
  lists: Record<string, ListEntry[]>
  hall: HallPass[]             // passes still running
  weekTx: Tx[]                 // since Monday, newest first
  todayTx: Tx[]                // newest first
  /** daily[studentId][ruleId] = txId for today's paid daily credits */
  daily: Record<string, Record<string, string>>
  dailySaved: boolean
  today: string
  weekStart: string
  now: number
}

const Ctx = createContext<Data | null>(null)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toList<T>(obj: any): T[] {
  if (!obj || typeof obj !== 'object') return []
  return Object.entries(obj).map(([id, v]) => ({ ...(v as object), id }) as T)
}

function useLive<T>(path: string, deps: unknown[] = [], q?: Parameters<typeof db.listen>[2]) {
  const [v, setV] = useState<T | null | undefined>(undefined)
  useEffect(() => db.listen(path, setV, q), deps.length ? deps : [path])
  return v
}

/** First run on a new database: write the starting rules, store and settings. */
async function seedIfEmpty() {
  const s = await db.get('settings')
  if (s) return
  const updates: Record<string, unknown> = {
    settings: DEFAULT_SETTINGS,
    rules: DEFAULT_RULES,
    items: DEFAULT_ITEMS,
  }
  if (db.demo) {
    const now = Date.now()
    DEMO_NAMES.forEach((name, i) => {
      updates[`students/s_demo${i}`] = { name, balance: 0, earned: 0, active: true, createdAt: now + i }
    })
  }
  await db.update(updates)
}

/**
 * One-time switch for databases made before buy-ins existed: turn off the old
 * shared class jars, add Movie day / Wendy's as individual buy-ins, and set
 * gym access to 50. Every price can be changed in Store & earning.
 */
async function migrateBuyIns() {
  const s = await db.get('settings')
  if (!s || s.buyIns) return
  const items = (await db.get('items')) || {}
  const goals = (await db.get('goals')) || {}
  const u: Record<string, unknown> = { 'settings/buyIns': true }
  for (const id of Object.keys(goals)) u[`goals/${id}/active`] = false
  const has = (label: string) => Object.values(items).some((i: any) => (i.label || '').toLowerCase().includes(label)) // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!has('movie')) u['items/i_movie'] = DEFAULT_ITEMS.i_movie
  if (!has('wendy')) u['items/i_wendys'] = DEFAULT_ITEMS.i_wendys
  if (items.i_gym && items.i_gym.price === 80) u['items/i_gym/price'] = 50
  await db.update(u)
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => { seedIfEmpty().then(migrateBuyIns) }, [])

  const today = dateStr(new Date(now))
  const weekStart = weekStartStr(new Date(now))

  const settingsRaw = useLive<Settings>('settings')
  const studentsRaw = useLive('students')
  const rulesRaw = useLive('rules')
  const itemsRaw = useLive('items')
  const banksRaw = useLive<Record<string, Record<string, number>>>('banks')
  const listsRaw = useLive<Record<string, Record<string, Omit<ListEntry, 'studentId'>>>>('lists')
  const hallRaw = useLive('hall')
  const weekRaw = useLive('tx', [weekStart], { child: 'date', startAt: weekStart })
  const dailyRaw = useLive<Record<string, Record<string, string>> & { _saved?: number }>(`daily/${today}`, [today])

  const base = useMemo(() => {
    const allStudents = toList<Student>(studentsRaw)
      .map(s => ({ ...s, balance: s.balance || 0, earned: s.earned || 0 }))
      // Teacher's custom order first; anyone without one (e.g. just added) goes after, A→Z.
      .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.name.localeCompare(b.name))
    const weekTx = toList<Tx>(weekRaw).sort((a, b) => b.ts - a.ts)
    const { _saved, ...daily } = dailyRaw || {}
    return {
      ready: settingsRaw !== undefined && studentsRaw !== undefined && !!settingsRaw,
      settings: { ...DEFAULT_SETTINGS, ...(settingsRaw || {}) },
      students: allStudents.filter(s => s.active !== false),
      allStudents,
      rules: toList<EarnRule>(rulesRaw).sort((a, b) => a.order - b.order),
      items: toList<StoreItem>(itemsRaw).sort((a, b) => a.order - b.order),
      banks: banksRaw || {},
      lists: Object.fromEntries(Object.entries(listsRaw || {}).map(([itemId, m]) => [
        itemId, Object.entries(m || {}).map(([studentId, e]) => ({ ...e, studentId })).sort((a, b) => a.ts - b.ts),
      ])),
      allHall: toList<HallPass & { id: string }>(hallRaw),
      weekTx,
      todayTx: weekTx.filter(t => t.date === today),
      daily: daily as Record<string, Record<string, string>>,
      dailySaved: !!_saved,
      today, weekStart,
    }
  }, [settingsRaw, studentsRaw, rulesRaw, itemsRaw, banksRaw, listsRaw, hallRaw, weekRaw, dailyRaw, today, weekStart])

  // Only the hall list and clock change every second; everything else keeps
  // the same object identity until the database actually changes.
  const value = useMemo<Data>(() => {
    const { allHall, ...rest } = base
    return { ...rest, hall: allHall.filter(h => h.start + h.minutes * 60000 > now), now }
  }, [base, now])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useData(): Data {
  const v = useContext(Ctx)
  if (!v) throw new Error('useData outside DataProvider')
  return v
}

/** Leaderboard rows: earned this week (from tx) or all time (from student totals). */
export function leaderboard(data: Data, range: 'week' | 'all') {
  const rows = data.students.map(s => ({
    id: s.id,
    name: s.name,
    score: range === 'all'
      ? s.earned
      : data.weekTx.filter(t => t.studentId === s.id).reduce((sum, t) => sum + (t.earnDelta || 0), 0),
  }))
  return rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
}

/** How many of this item the student has bought in its limit period (day/week). */
export function usedCount(data: Data, studentId: string, item: StoreItem): number {
  const pool = item.limitPeriod === 'week' ? data.weekTx : data.todayTx
  return pool.filter(t => t.studentId === studentId && t.kind === 'spend' && t.refId === item.id && !t.undone).length
}

export const banked = (data: Data, studentId: string, itemId: string) => data.banks[studentId]?.[itemId] || 0
export const bankedTotal = (data: Data, studentId: string) =>
  Object.values(data.banks[studentId] || {}).reduce((n, v) => n + (v || 0), 0)
export const onList = (data: Data, studentId: string, itemId: string) =>
  (data.lists[itemId] || []).some(e => e.studentId === studentId)

/**
 * Columns of the Daily check-off: daily earning items, then store items set to
 * "Daily check-off" (as charges, i.e. negative amounts).
 */
export function dailyColumns(data: Data): EarnRule[] {
  const charges: EarnRule[] = data.items
    .filter(i => i.active && i.tier === 'daily' && i.price > 0)
    .map(i => ({ id: i.id, label: i.label, amount: -i.price, kind: 'daily', icon: i.icon, order: 1000 + (i.order || 0) }))
  return [...data.rules.filter(r => r.kind === 'daily'), ...charges]
}
