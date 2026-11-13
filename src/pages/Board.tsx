/** Front-of-room display (projector / TV). Read-only, updates live. */
import { useEffect, useState } from 'react'
import { useData, leaderboard } from '../lib/data'
import { mmss } from '../lib/dates'
import { Icon } from '../components/ui'
import { Celebrations, CheerFeed } from '../components/Celebrate'

export default function Board() {
  const data = useData()
  const [clock, setClock] = useState('')
  useEffect(() => setClock(new Date(data.now).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })), [data.now])
  if (!data.ready) return <div className="board" />

  const week = leaderboard(data, 'week').filter(r => r.score > 0).slice(0, 5)
  const all = leaderboard(data, 'all').filter(r => r.score > 0).slice(0, 5)
  const goals = data.goals.filter(g => g.active)

  const Panel = ({ title, rows }: { title: string; rows: { id: string; name: string; score: number }[] }) => {
    const max = Math.max(1, ...rows.map(r => r.score))
    return (
      <div className="board-panel">
        <h2>{title}</h2>
        {rows.length === 0 && <div style={{ color: '#64748b', fontSize: '3vh' }}>No credits earned yet</div>}
        {rows.map((r, i) => (
          <div key={r.id} className="board-row">
            <span className={`lb-rank r${i + 1}`}>{i + 1}</span>
            <span style={{ width: '36%', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
            <div className="bar"><div style={{ width: `${(r.score / max) * 100}%`, background: 'linear-gradient(90deg,#eab308,#fde68a)' }} /></div>
            <span className="mono" style={{ color: '#fde68a', minWidth: '5vw', textAlign: 'right' }}>{r.score}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="board">
      <div className="row">
        <h1 className="grow">{data.settings.className}</h1>
        {data.hall.map(h => (
          <span key={h.studentId} className="hall-chip" style={{ fontSize: '2.4vh' }}><Icon name="person-simple-walk" size={22} light /> {h.name} <span className="mono">{mmss(h.start + h.minutes * 60000 - data.now)}</span></span>
        ))}
        <span className="mono" style={{ fontSize: '4vh', color: '#94a3b8', marginLeft: '2vw' }}>{clock}</span>
      </div>
      <div className="board-cols">
        <CheerFeed />
        <Panel title="Top earners this week" rows={week} />
        <Panel title="All-time leaders" rows={all} />
      </div>
      {goals.length > 0 && (
        <div className="board-goals">
          {goals.map(g => {
            const pct = Math.min(100, (g.saved / g.target) * 100)
            return (
              <div key={g.id} className="board-panel" style={{ gap: '1.2vh' }}>
                <div className="row" style={{ fontSize: '3.4vh', fontWeight: 600 }}>
                  <Icon name={g.icon} size={36} light /><span className="grow">{g.label}</span>
                  <span className="mono" style={{ color: '#94a3b8' }}>{g.saved} / {g.target}</span>
                </div>
                <div className="bar" style={{ height: '2.4vh', borderRadius: '1.2vh' }}><div style={{ width: `${pct}%` }} /></div>
                {pct >= 100 && <div style={{ fontSize: '2.6vh', color: '#34d399' }}>Goal reached!</div>}
              </div>
            )
          })}
        </div>
      )}
      {data.settings.cheerBoard && <Celebrations />}
    </div>
  )
}
