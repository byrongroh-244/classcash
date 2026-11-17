/**
 * Front-of-room display. Used two ways:
 *  - /board on the projector (read-only), and
 *  - on the front iPad while the store is closed (onTeacher shows a small
 *    lock button so you can still get into teacher mode there).
 */
import { useEffect, useState } from 'react'
import { useData, leaderboard } from '../lib/data'
import { passStatus } from '../lib/dates'
import type { Student } from '../lib/types'
import { Icon } from '../components/ui'
import { Celebrations, CheerFeed } from '../components/Celebrate'

export default function Board({ onTeacher, onOpenStore, onCheckIn }: { onTeacher?: () => void; onOpenStore?: () => void; onCheckIn?: (s: Student) => void } = {}) {
  const data = useData()
  const [clock, setClock] = useState('')
  useEffect(() => setClock(new Date(data.now).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })), [data.now])
  if (!data.ready) return <div className="board" />

  const week = leaderboard(data, 'week').filter(r => r.score > 0).slice(0, 5)
  const all = leaderboard(data, 'all').filter(r => r.score > 0).slice(0, 5)
  const buyIns = data.items.filter(i => i.active && i.tier === 'saver')
  const show = data.settings
  const cols = [show.boardShoutouts, show.boardWeek, show.boardAllTime].filter(Boolean).length
  const total = data.students.length || 1

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
        {data.hall.map(h => {
          const st = passStatus(h, data.now)
          return <span key={h.studentId} className={`hall-chip ${st.over ? 'over' : ''}`} style={{ fontSize: '2.4vh' }}><Icon name="person-simple-walk" size={22} light /> {h.name} <span className="mono">{st.text}</span></span>
        })}
        <span className="mono" style={{ fontSize: '4vh', color: '#94a3b8', marginLeft: '2vw' }}>{clock}</span>
      </div>
      <div className="board-cols" style={{ gridTemplateColumns: `repeat(${Math.max(1, cols)}, 1fr)` }}>
        {show.boardShoutouts && <CheerFeed />}
        {show.boardWeek && <Panel title="Top earners this week" rows={week} />}
        {show.boardAllTime && <Panel title="All-time leaders" rows={all} />}
      </div>
      {show.boardBuyIns && buyIns.length > 0 && (
        <div className="board-goals">
          {buyIns.map(i => {
            const n = (data.lists[i.id] || []).length
            return (
              <div key={i.id} className="board-panel" style={{ gap: '1.2vh' }}>
                <div className="row" style={{ fontSize: '3.2vh', fontWeight: 600 }}>
                  <Icon name={i.icon} size={34} light /><span className="grow">{i.label}</span>
                  <span style={{ color: '#94a3b8', fontWeight: 500 }}>{n} of {data.students.length} in</span>
                </div>
                <div className="bar" style={{ height: '2.2vh', borderRadius: '1.1vh' }}><div style={{ width: `${Math.min(100, (n / total) * 100)}%` }} /></div>
              </div>
            )
          })}
        </div>
      )}
      {onCheckIn && data.hall.length > 0 && (
        <div className="checkin-bar">
          <span>Back from the hall? Tap your name to sign back in:</span>
          {data.hall.map(h => {
            const st = data.students.find(x => x.id === h.studentId)
            return st ? <button key={h.studentId} className="btn lg checkin-btn" onClick={() => onCheckIn(st)}>{h.name}</button> : null
          })}
        </div>
      )}
      {onTeacher && (
        <div className="row" style={{ marginTop: '-1vh' }}>
          <button className="btn sm ghost" style={{ color: '#64748b' }} onClick={onTeacher}><Icon name="lock-simple" size={16} light style={{ opacity: .5 }} /> Teacher</button>
          <span className="grow" />
          {onOpenStore && (
            <button className="btn open-store-btn" onClick={onOpenStore}><Icon name="storefront" size={18} light /> Open store</button>
          )}
        </div>
      )}
      {data.settings.cheerBoard && <Celebrations />}
    </div>
  )
}
