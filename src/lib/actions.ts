/**
 * Every change to balances goes through here. Each one writes a transaction
 * record (tx/{id}) AND the balance change in the same atomic update, so the
 * history and the balances can't drift apart.
 */
import { db, INC } from './db'
import { dateStr } from './dates'
import type { Student, EarnRule, StoreItem, Tx, TxKind, Settings } from './types'
import type { Data } from './data'
import { usedCount, banked, onList, dailyColumns } from './data'

type NewTx = Omit<Tx, 'id' | 'date' | 'ts'>

function txUpdates(u: Record<string, unknown>, t: NewTx, ts = Date.now()): string {
  const id = db.newKey()
  const rec: Record<string, unknown> = { ...t, date: dateStr(new Date(ts)), ts }
  for (const k of Object.keys(rec)) if (rec[k] === undefined) delete rec[k]
  u[`tx/${id}`] = rec
  addInc(u, `students/${t.studentId}/balance`, t.amount)
  addInc(u, `students/${t.studentId}/earned`, t.earnDelta)
  return id
}

/** Several changes to one number in one update must be added together, not overwrite each other. */
function addInc(u: Record<string, unknown>, path: string, n: number) {
  if (!n) return
  const prev = u[path] as { __inc?: number } | undefined
  u[path] = INC((prev?.__inc || 0) + n)
}

// ─── Teacher: give / take ────────────────────────────────────────────────────

/** Give (or fine, with a negative amount) a group of students. Returns the batch id for undo. */
export async function award(students: Student[], label: string, amount: number, kind: TxKind, refId?: string, cheer = false) {
  const batch = db.newKey()
  const u: Record<string, unknown> = {}
  for (const s of students) {
    txUpdates(u, { studentId: s.id, studentName: s.name, amount, earnDelta: amount, kind, label, refId, by: 'teacher', batch, cheer: cheer || undefined })
  }
  await db.update(u)
  return batch
}

export const awardRule = (students: Student[], rule: EarnRule) =>
  award(students, rule.label, rule.amount, 'earn', rule.id, true)

/**
 * Daily check-off. `want[studentId][ruleId]` is the desired state; pays what's
 * newly checked and reverses what was paid but is now unchecked.
 */
export async function saveDaily(data: Data, want: Record<string, Record<string, boolean>>) {
  const u: Record<string, unknown> = {}
  const batch = db.newKey()
  const daily = dailyColumns(data)
  let paid = 0, reversed = 0
  for (const s of data.students) {
    for (const r of daily) {
      const has = data.daily[s.id]?.[r.id]
      const should = !!want[s.id]?.[r.id]
      if (should && !has) {
        // A daily charge (negative amount) is like a purchase: it doesn't lower the leaderboard.
        const id = txUpdates(u, { studentId: s.id, studentName: s.name, amount: r.amount, earnDelta: Math.max(0, r.amount), kind: 'daily', label: r.label, refId: r.id, by: 'teacher', batch })
        u[`daily/${data.today}/${s.id}/${r.id}`] = id
        paid++
      } else if (!should && has) {
        const orig = data.todayTx.find(t => t.id === has)
        if (orig && !orig.undone) reverseInto(u, orig, batch)
        u[`daily/${data.today}/${s.id}/${r.id}`] = null
        reversed++
      }
    }
  }
  u[`daily/${data.today}/_saved`] = Date.now()
  await db.update(u)
  return { paid, reversed }
}

// ─── Undo ────────────────────────────────────────────────────────────────────

function reverseInto(u: Record<string, unknown>, t: Tx, batch?: string) {
  txUpdates(u, {
    studentId: t.studentId, studentName: t.studentName,
    amount: -t.amount, earnDelta: -(t.earnDelta || 0),
    kind: 'reverse', label: `Undo: ${t.label}`, reverses: t.id, by: 'teacher', batch,
  })
  u[`tx/${t.id}/undone`] = true
  if (t.kind === 'donate' && t.refId) addInc(u, `goals/${t.refId}/saved`, t.amount) // amount is negative
  if (t.kind === 'daily' && t.refId) u[`daily/${t.date}/${t.studentId}/${t.refId}`] = null
  if (t.hall) u[`hall/${t.studentId}`] = null
  // Undo a bank deposit: credits come out of the locked bank, back to the balance.
  if (t.kind === 'bank' && t.refId) addInc(u, `banks/${t.studentId}/${t.refId}`, t.amount) // amount is negative
  // Undo a buy-in purchase: banked part goes back in the bank, student comes off the list.
  if (t.kind === 'spend' && t.bankUsed && t.refId) addInc(u, `banks/${t.studentId}/${t.refId}`, t.bankUsed)
  if (t.kind === 'spend' && t.refId && t.bankUsed !== undefined) u[`lists/${t.refId}/${t.studentId}`] = null
}

export async function undoTx(txs: Tx[]) {
  const u: Record<string, unknown> = {}
  const batch = txs.length > 1 ? db.newKey() : undefined
  for (const t of txs) if (!t.undone && t.kind !== 'reverse' && t.kind !== 'reset') reverseInto(u, t, batch)
  if (Object.keys(u).length) await db.update(u)
}

export async function undoBatch(data: Data, batch: string) {
  await undoTx(data.weekTx.filter(t => t.batch === batch))
}

/** Most recent teacher batch today that can still be undone. */
export function lastUndoableBatch(data: Data): { batch: string; label: string; count: number } | null {
  const t = data.todayTx.find(t => t.by === 'teacher' && t.batch && !t.undone && t.kind !== 'reverse')
  if (!t?.batch) return null
  return { batch: t.batch, label: t.label, count: data.todayTx.filter(x => x.batch === t.batch).length }
}

// ─── Student: buy / donate ───────────────────────────────────────────────────

export type BuyCheck = { ok: true } | { ok: false; reason: string; short: string }

export function canBuy(data: Data, s: Student, item: StoreItem): BuyCheck {
  if (!data.settings.storeOpen) return { ok: false, reason: 'The store is closed right now.', short: 'Store closed' }
  if (!item.active) return { ok: false, reason: 'This item is not available right now.', short: 'Unavailable' }
  if (item.limitCount) {
    const used = usedCount(data, s.id, item)
    if (used >= item.limitCount) {
      const per = item.limitPeriod === 'week' ? 'this week' : 'today'
      return { ok: false, reason: `You've used this ${item.limitCount === 1 ? '' : item.limitCount + ' times '}${per}.`, short: `Used ${per}` }
    }
  }
  if (item.hallMinutes) {
    if (data.hall.some(h => h.studentId === s.id)) return { ok: false, reason: "You're already on a hall pass.", short: 'On a pass' }
    if (data.hall.length >= data.settings.maxInHall) return { ok: false, reason: 'Someone is already in the hall. Try again when they have checked back in.', short: 'Hall is full' }
  }
  if (item.tier === 'saver') {
    if (onList(data, s.id, item.id)) return { ok: false, reason: "You're already on the list for this.", short: 'On the list' }
    const have = banked(data, s.id, item.id) + Math.max(0, s.balance)
    if (have < item.price) {
      const need = item.price - have
      return { ok: false, reason: `You need ${need} more.`, short: `Need ${need} more` }
    }
    return { ok: true }
  }
  if (s.balance < item.price) {
    const need = item.price - s.balance
    return { ok: false, reason: `You need ${need} more.`, short: `Need ${need} more` }
  }
  return { ok: true }
}

/** Most a student can still bank toward an item (can't bank past the price). */
export function bankRoom(data: Data, s: Student, item: StoreItem) {
  return Math.max(0, Math.min(s.balance, item.price - banked(data, s.id, item.id)))
}

/** Lock credits toward a buy-in item. Only an undo (teacher) can take them back out. */
export async function bankToward(data: Data, s: Student, item: StoreItem, amount: number): Promise<boolean> {
  const n = Math.min(amount, item.price - banked(data, s.id, item.id))
  if (n <= 0 || !data.settings.storeOpen) return false
  const res = await db.transaction(`students/${s.id}/balance`, (cur: number | null) => {
    if (cur === null) return cur
    if (cur < n) return undefined
    return cur - n
  })
  if (!res.committed) return false
  const id = db.newKey()
  await db.update({
    [`tx/${id}`]: {
      studentId: s.id, studentName: s.name, amount: -n, earnDelta: 0,
      kind: 'bank', label: `Banked toward ${item.label}`, refId: item.id, by: 'student', date: dateStr(), ts: Date.now(),
    },
    [`banks/${s.id}/${item.id}`]: INC(n),
  })
  return true
}

/** Buy a buy-in item: banked credits first, the rest from balance; student goes on the list. */
async function buyIn(data: Data, s: Student, item: StoreItem): Promise<boolean> {
  const bankUsed = Math.min(banked(data, s.id, item.id), item.price)
  const fromBalance = item.price - bankUsed
  if (fromBalance > 0) {
    const res = await db.transaction(`students/${s.id}/balance`, (cur: number | null) => {
      if (cur === null) return cur
      if (cur < fromBalance) return undefined
      return cur - fromBalance
    })
    if (!res.committed) return false
  }
  const id = db.newKey()
  const ts = Date.now()
  await db.update({
    [`tx/${id}`]: {
      studentId: s.id, studentName: s.name, amount: -fromBalance, earnDelta: 0, bankUsed,
      kind: 'spend', label: bankUsed ? `${item.label} (${bankUsed} banked${fromBalance ? ` + ${fromBalance}` : ''})` : item.label,
      refId: item.id, by: 'student', date: dateStr(new Date(ts)), ts,
    },
    [`banks/${s.id}/${item.id}`]: bankUsed ? INC(-bankUsed) : null,
    [`lists/${item.id}/${s.id}`]: { name: s.name, ts, txId: id },
  })
  return true
}

/** Teacher: take one student off an item's list (they've used it). No refund. */
export async function removeFromList(itemId: string, studentId: string) {
  await db.update({ [`lists/${itemId}/${studentId}`]: null })
}
/** Teacher: the event happened — clear everyone off the list. No refunds. */
export async function clearList(itemId: string) {
  await db.update({ [`lists/${itemId}`]: null })
}

/** Charge the student; returns false if they couldn't afford it by the time it ran. */
export async function buy(data: Data, s: Student, item: StoreItem): Promise<boolean> {
  const check = canBuy(data, s, item)
  if (!check.ok) return false
  if (item.tier === 'saver') return buyIn(data, s, item)
  // Take the money with a transaction so a double tap can't charge twice or go negative.
  const res = await db.transaction(`students/${s.id}/balance`, (cur: number | null) => {
    if (cur === null) return cur
    if (cur < item.price) return undefined
    return cur - item.price
  })
  if (!res.committed) return false
  const u: Record<string, unknown> = {}
  const id = db.newKey()
  u[`tx/${id}`] = {
    studentId: s.id, studentName: s.name, amount: -item.price, earnDelta: 0,
    kind: 'spend', label: item.label, refId: item.id, by: 'student', date: dateStr(), ts: Date.now(),
    ...(item.hallMinutes ? { hall: true } : {}),
  }
  if (item.hallMinutes) u[`hall/${s.id}`] = { studentId: s.id, name: s.name, label: item.label, start: Date.now(), minutes: item.hallMinutes }
  await db.update(u)
  return true
}


// ─── Hall ────────────────────────────────────────────────────────────────────

/**
 * Student is back from the hall (they signed in, or you tapped Back).
 * Logs how long they were out, and fines them if Settings says to.
 */
export async function checkIn(data: Data, studentId: string): Promise<{ minutes: number; fined: number } | null> {
  const h = data.hall.find(x => x.studentId === studentId)
  if (!h) return null
  const outMs = Date.now() - h.start
  const minutes = Math.max(1, Math.round(outMs / 60000))
  const s = data.allStudents.find(x => x.id === studentId)
  const name = s?.name || h.name
  const u: Record<string, unknown> = { [`hall/${studentId}`]: null }
  txUpdates(u, { studentId, studentName: name, amount: 0, earnDelta: 0, kind: 'return', label: `Back from ${h.label} (${minutes} min)`, by: 'student' })
  const { hallFineOn, hallFineAfterMin, hallFineAmount } = data.settings
  let fined = 0
  if (hallFineOn && hallFineAmount > 0 && outMs > hallFineAfterMin * 60000) {
    fined = hallFineAmount
    txUpdates(u, { studentId, studentName: name, amount: -fined, earnDelta: -fined, kind: 'fine', label: `Late back from hall (${minutes} min)`, by: 'teacher' }, Date.now() + 1)
  }
  await db.update(u)
  return { minutes, fined }
}

/** @deprecated use checkIn */
export async function endHallPass(studentId: string) {
  await db.update({ [`hall/${studentId}`]: null })
}

/** Teacher override: a bathroom pass at no charge (still logged). */
export async function freeHallPass(s: Student, minutes: number) {
  const u: Record<string, unknown> = {}
  txUpdates(u, { studentId: s.id, studentName: s.name, amount: 0, earnDelta: 0, kind: 'free', label: 'Free hall pass', by: 'teacher', hall: true })
  u[`hall/${s.id}`] = { studentId: s.id, name: s.name, label: 'Free hall pass', start: Date.now(), minutes }
  await db.update(u)
}

// ─── Students ────────────────────────────────────────────────────────────────

export async function addStudents(names: string[]) {
  const u: Record<string, unknown> = {}
  const now = Date.now()
  names.map(n => n.trim()).filter(Boolean).forEach((name, i) => {
    u[`students/${db.newKey()}`] = { name, balance: 0, earned: 0, active: true, createdAt: now + i }
  })
  if (Object.keys(u).length) await db.update(u)
}

export async function updateStudent(id: string, fields: Partial<Pick<Student, 'name' | 'passcode' | 'active'>>) {
  const u: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) u[`students/${id}/${k}`] = v ?? null
  await db.update(u)
}

/** Zero every balance and leaderboard total. History is kept. */
export async function resetSemester(data: Data) {
  const u: Record<string, unknown> = {}
  for (const s of data.allStudents) {
    if (s.balance || s.earned) {
      const id = db.newKey()
      u[`tx/${id}`] = {
        studentId: s.id, studentName: s.name, amount: -s.balance, earnDelta: -s.earned,
        kind: 'reset', label: 'Semester reset', by: 'teacher', date: dateStr(), ts: Date.now(),
      }
    }
    u[`students/${s.id}/balance`] = 0
    u[`students/${s.id}/earned`] = 0
  }
  // Locked bank credits are cleared too (buy-in lists are kept — those students paid).
  u['banks'] = null
  await db.update(u)
}

// ─── Config ──────────────────────────────────────────────────────────────────

export async function saveSettings(fields: Partial<Settings>) {
  const u: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) u[`settings/${k}`] = v
  await db.update(u)
}

type Coll = 'rules' | 'items'
export async function saveRow(coll: Coll, id: string | null, fields: Record<string, unknown>) {
  const key = id || db.newKey()
  const u: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) u[`${coll}/${key}/${k}`] = v === undefined ? null : v
  await db.update(u)
  return key
}
export async function deleteRow(coll: Coll, id: string) {
  await db.update({ [`${coll}/${id}`]: null })
}

// ─── Reordering ──────────────────────────────────────────────────────────────

/** Move one row of a list to a new position and renumber the whole list (0, 1, 2…). */
export async function moveRow(coll: 'rules' | 'items' | 'students', ids: string[], from: number, to: number) {
  if (from === to || to < 0 || to >= ids.length) return
  const next = [...ids]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  const u: Record<string, unknown> = {}
  next.forEach((id, i) => { u[`${coll}/${id}/order`] = i })
  await db.update(u)
}

/** Back to alphabetical student order. */
export async function sortStudentsAZ(ids: string[]) {
  const u: Record<string, unknown> = {}
  ids.forEach(id => { u[`students/${id}/order`] = null })
  await db.update(u)
}
