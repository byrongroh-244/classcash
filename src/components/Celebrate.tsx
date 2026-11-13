/**
 * Shout-outs: when the teacher gives Dashboard points (a rule button or a
 * custom bonus), screens showing this component burst with confetti and the
 * student's name. Daily check-off, fines, Students-tab corrections and
 * purchases never trigger it.
 */
import { useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { useData, type Data } from '../lib/data'
import { Icon } from './ui'

export interface Cheer {
  key: string
  ts: number
  names: string[]
  whole: boolean
  amount: number
  label: string
  icon: string
}

/** Today's shout-outs, newest first, one per tap (batch). Undone ones drop out. */
export function cheersToday(data: Data): Cheer[] {
  const groups = new Map<string, Cheer>()
  for (const t of data.todayTx) {
    if (!t.cheer || t.undone || t.amount <= 0) continue
    const key = t.batch || t.id
    let g = groups.get(key)
    if (!g) {
      const rule = data.rules.find(r => r.id === t.refId)
      g = { key, ts: t.ts, names: [], whole: false, amount: t.amount, label: t.label, icon: rule?.icon || 'star' }
      groups.set(key, g)
    }
    g.names.push(t.studentName)
  }
  const n = data.students.length
  return [...groups.values()]
    .map(g => ({ ...g, names: g.names.sort(), whole: n > 1 && g.names.length >= n }))
    .sort((a, b) => b.ts - a.ts)
}

const COLORS = ['#eab308', '#fde047', '#10b981', '#34d399', '#667eea', '#a5b4fc', '#f97316', '#ffffff']

function burst(big: boolean) {
  const base = { colors: COLORS, disableForReducedMotion: true, zIndex: 300 }
  confetti({ ...base, particleCount: big ? 160 : 110, spread: 75, startVelocity: 55, origin: { x: 0.1, y: 0.9 }, angle: 60 })
  confetti({ ...base, particleCount: big ? 160 : 110, spread: 75, startVelocity: 55, origin: { x: 0.9, y: 0.9 }, angle: 120 })
  setTimeout(() => confetti({ ...base, particleCount: big ? 220 : 120, spread: 160, startVelocity: 35, origin: { x: 0.5, y: 0.35 }, scalar: 1.1 }), 350)
  if (big) setTimeout(() => {
    confetti({ ...base, particleCount: 120, spread: 100, origin: { x: 0.25, y: 0.5 } })
    confetti({ ...base, particleCount: 120, spread: 100, origin: { x: 0.75, y: 0.5 } })
  }, 900)
}

const SHOW_MS = 4500

/** Full-screen confetti + name banner for each new shout-out, one at a time. */
export function Celebrations({ size = 'board' }: { size?: 'board' | 'kiosk' }) {
  const data = useData()
  const cheers = cheersToday(data)
  const seen = useRef<Set<string> | null>(null)
  const [queue, setQueue] = useState<Cheer[]>([])
  const [current, setCurrent] = useState<Cheer | null>(null)

  // Anything already on screen when this page opened isn't new — don't replay it.
  useEffect(() => {
    if (!data.ready) return
    if (seen.current === null) { seen.current = new Set(cheers.map(c => c.key)); return }
    const fresh = cheers.filter(c => !seen.current!.has(c.key) && data.now - c.ts < 60000).reverse()
    if (!fresh.length) return
    fresh.forEach(c => seen.current!.add(c.key))
    setQueue(q => [...q, ...fresh])
  }, [cheers.map(c => c.key).join(), data.ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // Play the queue, one at a time.
  useEffect(() => {
    if (current || !queue.length) return
    const [next, ...rest] = queue
    setQueue(rest)
    setCurrent(next)
    burst(next.whole || next.names.length > 3)
  }, [queue, current])
  useEffect(() => {
    if (!current) return
    const id = setTimeout(() => setCurrent(null), SHOW_MS)
    return () => clearTimeout(id)
  }, [current])

  // Undone while showing → hide it.
  const live = current && cheers.some(c => c.key === current.key)
  if (!current || !live) return null

  const who = current.whole ? 'Whole class!'
    : current.names.length <= 4 ? current.names.join(current.names.length === 2 ? ' & ' : ', ')
    : `${current.names.slice(0, 3).join(', ')} + ${current.names.length - 3} more`

  return (
    <div className={`cheer ${size}`}>
      <div className="cheer-card">
        <div className="cheer-icon"><Icon name={current.icon} size={size === 'board' ? 96 : 72} light /></div>
        <div className="cheer-name serif">{who}</div>
        <div className="cheer-pts"><span className="mono">+{current.amount}</span><span className="coin" /></div>
        <div className="cheer-label">{current.label}</div>
      </div>
    </div>
  )
}

/** Running list of today's shout-outs (for the board). */
export function CheerFeed({ limit = 8 }: { limit?: number }) {
  const data = useData()
  const list = cheersToday(data).slice(0, limit)
  return (
    <div className="board-panel">
      <h2>Shout-outs today</h2>
      {list.length === 0 && <div style={{ color: '#64748b', fontSize: '2.6vh' }}>Points for great work show up here.</div>}
      {list.map((c, i) => (
        <div key={c.key} className={`feed-cheer ${i === 0 && data.now - c.ts < 10000 ? 'new' : ''}`}>
          <Icon name={c.icon} size={34} light />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="fc-name">{c.whole ? 'Whole class' : c.names.length <= 3 ? c.names.join(', ') : `${c.names.length} students`}</div>
            <div className="fc-label">{c.label}</div>
          </div>
          <span className="mono fc-pts">+{c.amount}</span>
        </div>
      ))}
    </div>
  )
}
