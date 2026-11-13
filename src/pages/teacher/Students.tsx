import { useEffect, useRef, useState } from 'react'
import { useData } from '../../lib/data'
import { addStudents, updateStudent, undoTx, award } from '../../lib/actions'
import { Amt, Overlay, Icon, PinPad } from '../../components/ui'
import { useHistory, HistoryList } from '../StudentAccount'
import type { Student } from '../../lib/types'

export default function Students() {
  const data = useData()
  const [adding, setAdding] = useState(data.students.length === 0)
  const [text, setText] = useState('')
  const [viewing, setViewing] = useState<Student | null>(null)
  const [showRemoved, setShowRemoved] = useState(false)

  const removed = data.allStudents.filter(s => s.active === false)
  const total = data.students.reduce((n, s) => n + s.balance, 0)

  return (
    <div className="scroll" style={{ flex: 1 }}>
      <div className="section" style={{ maxWidth: 900 }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <h2 className="grow" style={{ margin: 0 }}>Students ({data.students.length})</h2>
          <span className="slate" style={{ fontSize: 13 }}>In circulation: <Amt n={total} /></span>
          <button className="btn dark" onClick={() => setAdding(a => !a)}>+ Add students</button>
        </div>

        {adding && (
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <div className="field" style={{ marginBottom: 10 }}>
              <span>First names, one per line (or paste a list)</span>
              <textarea className="input" rows={6} value={text} onChange={e => setText(e.target.value)} placeholder={'Ava\nBen\nCarlos'} />
            </div>
            <div className="row">
              <span className="muted grow" style={{ fontSize: 13 }}>Students create their own 4-digit passcode the first time they sign in.</span>
              <button className="btn" onClick={() => { setAdding(false); setText('') }}>Cancel</button>
              <button className="btn green" disabled={!text.trim()} onClick={async () => {
                await addStudents(text.split(/[\n,]/)); setText(''); setAdding(false)
              }}>Add {text.split(/[\n,]/).filter(n => n.trim()).length || ''}</button>
            </div>
          </div>
        )}

        <div className="card">
          <table className="cfg-table">
            <thead><tr><th style={{ paddingLeft: 16 }}>Name</th><th>Balance</th><th>Earned (all time)</th><th>Passcode</th><th /></tr></thead>
            <tbody>
              {data.students.map(s => (
                <tr key={s.id}>
                  <td style={{ paddingLeft: 16 }}><NameEdit s={s} /></td>
                  <td><BalanceAdjust s={s} /></td>
                  <td className="mono slate">{s.earned}</td>
                  <td><PasscodeCell s={s} /></td>
                  <td style={{ textAlign: 'right', paddingRight: 12, whiteSpace: 'nowrap' }}>
                    <button className="btn sm" onClick={() => setViewing(s)}>History</button>{' '}
                    <button className="btn sm ghost" onClick={() => { if (confirm(`Remove ${s.name}? Their history is kept and you can restore them.`)) updateStudent(s.id, { active: false }) }}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {removed.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <button className="btn sm ghost" onClick={() => setShowRemoved(v => !v)}>{showRemoved ? '▾' : '▸'} Removed students ({removed.length})</button>
            {showRemoved && removed.map(s => (
              <div key={s.id} className="row" style={{ padding: '6px 12px' }}>
                <span className="grow">{s.name}</span>
                <button className="btn sm" onClick={() => updateStudent(s.id, { active: true })}>Restore</button>
              </div>
            ))}
          </div>
        )}
      </div>
      {viewing && <HistoryModal s={data.allStudents.find(x => x.id === viewing.id) || viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

function NameEdit({ s }: { s: Student }) {
  const [v, setV] = useState(s.name)
  return (
    <input className="input sm" style={{ maxWidth: 180, fontWeight: 600 }} value={v}
      onChange={e => setV(e.target.value)}
      onBlur={() => { const n = v.trim(); if (n && n !== s.name) updateStudent(s.id, { name: n }); else setV(s.name) }} />
  )
}

function HistoryModal({ s, onClose }: { s: Student; onClose: () => void }) {
  const txs = useHistory(s.id, 200)
  return (
    <Overlay onClose={onClose}>
      <div className="modal wide">
        <div className="row" style={{ marginBottom: 8 }}>
          <h2 className="grow">{s.name}</h2>
          <Amt n={s.balance} className={s.balance < 0 ? 'neg' : ''} />
        </div>
        <p className="slate" style={{ fontSize: 13, marginBottom: 8 }}>Tap the undo arrow on any entry to reverse it — the credits go back automatically.</p>
        <HistoryList txs={txs} onUndo={t => { if (confirm(`Undo "${t.label}" (${t.amount > 0 ? '+' : ''}${t.amount})?`)) undoTx([t]) }} />
        <button className="btn block" style={{ marginTop: 16 }} onClick={onClose}>Close</button>
      </div>
    </Overlay>
  )
}

/**
 * − / + buttons. Taps are added up and saved as ONE history entry about
 * 1.5 seconds after the last tap, so tapping + five times is a single "+5".
 * Counts toward the leaderboard like any other bonus or fine.
 */
function BalanceAdjust({ s }: { s: Student }) {
  const [pending, setPending] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const latest = useRef({ s, pending })
  latest.current = { s, pending }

  const flush = () => {
    const { s, pending } = latest.current
    if (!pending) return
    setPending(0)
    award([s], pending > 0 ? 'Teacher adjustment' : 'Teacher deduction', pending, pending > 0 ? 'bonus' : 'fine')
  }
  const bump = (n: number) => {
    setPending(p => p + n)
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, 1500)
  }
  // Save anything still pending if the tab is closed mid-adjustment.
  useEffect(() => () => { clearTimeout(timer.current); flush() }, [])

  const shown = s.balance + pending
  return (
    <div className="row" style={{ gap: 6 }}>
      <button className="adj-btn" onClick={() => bump(-1)} title="Take 1 away"><Icon name="minus" size={16} /></button>
      <span style={{ minWidth: 54, textAlign: 'center' }}><Amt n={shown} className={shown < 0 ? 'neg' : ''} /></span>
      <button className="adj-btn" onClick={() => bump(1)} title="Add 1"><Icon name="plus" size={16} /></button>
      {pending !== 0 && <span className={`mono ${pending > 0 ? 'pos' : 'neg'}`} style={{ fontSize: 13 }}>{pending > 0 ? '+' : ''}{pending}</span>}
    </div>
  )
}

/** See, change, or clear a student's passcode. */
function PasscodeCell({ s }: { s: Student }) {
  const [show, setShow] = useState(false)
  const [setting, setSetting] = useState(false)
  return (
    <div className="row" style={{ gap: 6 }}>
      {s.passcode
        ? <button className="mono passcode" onClick={() => setShow(v => !v)} title={show ? 'Hide' : 'Tap to show'}>{show ? s.passcode : '••••'}</button>
        : <span className="muted" style={{ fontSize: 13, minWidth: 64 }}>Not set</span>}
      <button className="btn sm" onClick={() => setSetting(true)}>{s.passcode ? 'Change' : 'Set'}</button>
      {s.passcode && (
        <button className="btn sm ghost" title="Student makes a new one at next sign-in"
          onClick={() => { if (confirm(`Clear ${s.name}'s passcode? They'll create a new one the next time they tap their name.`)) updateStudent(s.id, { passcode: undefined }) }}>Clear</button>
      )}
      {setting && (
        <PinPad title={`New passcode for ${s.name}`} subtitle="Tell the student their new code"
          onCancel={() => setSetting(false)}
          onComplete={async code => { await updateStudent(s.id, { passcode: code }); setSetting(false); setShow(true); return true }} />
      )}
    </div>
  )
}
