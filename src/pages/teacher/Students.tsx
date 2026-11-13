import { useState } from 'react'
import { useData } from '../../lib/data'
import { addStudents, updateStudent, undoTx } from '../../lib/actions'
import { Amt, Overlay } from '../../components/ui'
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
                  <td><Amt n={s.balance} className={s.balance < 0 ? 'neg' : ''} /></td>
                  <td className="mono slate">{s.earned}</td>
                  <td>
                    {s.passcode
                      ? <button className="btn sm" onClick={() => { if (confirm(`Reset ${s.name}'s passcode? They'll create a new one next time they sign in.`)) updateStudent(s.id, { passcode: undefined }) }}>Reset</button>
                      : <span className="muted" style={{ fontSize: 13 }}>Not set yet</span>}
                  </td>
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
