/**
 * Quick adds: tap students to select them, then tap a reason.
 * Right side: who's in the hall and everything that's happened today.
 */
import { useState } from 'react'
import { useData } from '../../lib/data'
import { award, awardRule, undoBatch, undoTx, lastUndoableBatch, endHallPass, freeHallPass } from '../../lib/actions'
import { timeStr, mmss } from '../../lib/dates'
import { Amt, Overlay, Toast, Icon } from '../../components/ui'
import type { EarnRule, Student, Tx } from '../../lib/types'

export default function Dashboard() {
  const data = useData()
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ text: string; batch: string; key: number } | null>(null)
  const [custom, setCustom] = useState<'bonus' | 'fine' | null>(null)

  const selected = data.students.filter(s => sel.has(s.id))
  const toggle = (id: string) => setSel(prev => {
    const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n
  })
  const names = (list: Student[]) =>
    list.length === data.students.length ? 'whole class' : list.length <= 3 ? list.map(s => s.name).join(', ') : `${list.length} students`

  const give = async (rule: EarnRule) => {
    const who = rule.wholeClass && selected.length === 0 ? data.students : selected
    if (!who.length) return
    const batch = await awardRule(who, rule)
    setToast({ text: `${rule.amount < 0 ? '−' + -rule.amount : '+' + rule.amount} ${rule.label} for ${names(who)}`, batch, key: Date.now() })
    setSel(new Set())
  }

  const incident = data.rules.filter(r => r.kind === 'incident')
  const last = lastUndoableBatch(data)

  return (
    <div className="dash">
      <div className="dash-main">
        <div className="row" style={{ padding: '12px 20px 0' }}>
          <span className="slate grow" style={{ fontSize: 14 }}>
            {selected.length ? <><b>{selected.length}</b> selected</> : 'Tap students to select them, then tap a reason below.'}
          </span>
          <button className="btn sm" onClick={() => setSel(new Set(data.students.map(s => s.id)))}>Select all</button>
          <button className="btn sm" disabled={!selected.length} onClick={() => setSel(new Set())}>Clear</button>
        </div>
        <div className="scroll" style={{ flex: 1 }}>
          <div className="stu-grid">
            {data.students.map(s => {
              const on = sel.has(s.id)
              return (
                <button key={s.id} className={`stu-tile ${on ? 'sel' : ''}`} onClick={() => toggle(s.id)}>
                  {on && <span className="check"><Icon name="check" size={13} light /></span>}
                  {data.hall.some(h => h.studentId === s.id) && <span className="hall"><Icon name="person-simple-walk" size={16} /></span>}
                  <div className="n">{s.name}</div>
                  <Amt n={s.balance} className={s.balance < 0 ? 'neg' : 'slate'} />
                </button>
              )
            })}
          </div>
        </div>
        <div className="action-bar">
          {incident.map(r => {
            const isClass = r.wholeClass && selected.length === 0
            return (
              <button key={r.id} className={`earn-btn ${r.amount < 0 ? 'fine' : r.wholeClass ? 'class' : ''}`}
                disabled={!selected.length && !r.wholeClass} onClick={() => give(r)}>
                <Icon name={r.icon} size={22} />{r.label}{isClass && ' (all)'}<span className="plus">{r.amount < 0 ? `−${-r.amount}` : `+${r.amount}`}</span>
              </button>
            )
          })}
          <button className="earn-btn" disabled={!selected.length} onClick={() => setCustom('bonus')}><Icon name="plus" size={18} /> Custom</button>
          <button className="earn-btn fine" disabled={!selected.length} onClick={() => setCustom('fine')}><Icon name="minus" size={18} /> Fine</button>
          <button className="btn" disabled={selected.length !== 1} title="No-charge bathroom pass"
            onClick={async () => { await freeHallPass(selected[0], 5); setSel(new Set()) }}><Icon name="toilet" size={18} /> Free pass</button>
        </div>
      </div>

      <aside className="dash-side">
        <div className="row" style={{ padding: '14px 16px 6px' }}>
          <span className="label grow">In the hall</span>
          <span className="muted" style={{ fontSize: 12 }}>max {data.settings.maxInHall}</span>
        </div>
        {data.hall.length === 0 && <p className="muted" style={{ padding: '0 16px', fontSize: 13 }}>Nobody</p>}
        {data.hall.map(h => {
          const left = h.start + h.minutes * 60000 - data.now
          return (
            <div key={h.studentId} className={`hall-card ${left < 30000 ? 'over' : ''}`}>
              <div className="grow"><b>{h.name}</b><div style={{ fontSize: 12, opacity: .8 }}>{h.label}</div></div>
              <span className="mono">{mmss(left)}</span>
              <button className="btn sm" onClick={() => endHallPass(h.studentId)}>Back</button>
            </div>
          )
        })}

        <div className="row" style={{ padding: '18px 16px 6px' }}>
          <span className="label grow">Today</span>
          {last && <button className="btn sm" onClick={() => undoBatch(data, last.batch)}><Icon name="arrow-counter-clockwise" size={14} /> Undo last</button>}
        </div>
        <div className="scroll" style={{ flex: 1 }}>
          {data.todayTx.length === 0 && <p className="muted" style={{ padding: '0 16px', fontSize: 13 }}>Nothing yet today.</p>}
          {feed(data.todayTx).map(f => (
            <div key={f.key} className={`feed-row ${f.undone ? 'undone' : ''}`}>
              <span className="muted mono" style={{ fontSize: 11, width: 54 }}>{timeStr(f.ts)}</span>
              <span className="grow"><b>{f.who}</b> <span className="slate">{f.student && <Icon name="shopping-cart-simple" size={14} style={{ marginRight: 3, verticalAlign: -2 }} />}{f.label}</span></span>
              {f.amount !== 0 && <Amt n={f.amount} sign className={f.amount > 0 ? 'pos' : 'neg'} />}
              {f.canUndo
                ? <button className="x-btn" title="Undo" onClick={() => f.batch ? undoBatch(data, f.batch) : undoTx(f.txs)}><Icon name="arrow-counter-clockwise" size={16} /></button>
                : <span style={{ width: 28 }} />}
            </div>
          ))}
        </div>
      </aside>

      {custom && (
        <CustomModal kind={custom} who={names(selected)} onClose={() => setCustom(null)} onApply={async (amount, reason) => {
          const signed = custom === 'fine' ? -amount : amount
          const batch = await award(selected, reason, signed, custom === 'fine' ? 'fine' : 'bonus', undefined, custom !== 'fine')
          setToast({ text: `${signed > 0 ? '+' : ''}${signed} ${reason} for ${names(selected)}`, batch, key: Date.now() })
          setCustom(null); setSel(new Set())
        }} />
      )}

      {toast && (
        <Toast key={toast.key} onDone={() => setToast(null)}>
          <span className="row"><Icon name="check" size={16} light />{toast.text}</span>
          <button onClick={() => { undoBatch(data, toast.batch); setToast(null) }}>Undo</button>
        </Toast>
      )}
    </div>
  )
}

function CustomModal({ kind, who, onClose, onApply }: { kind: 'bonus' | 'fine'; who: string; onClose: () => void; onApply: (amount: number, reason: string) => void }) {
  const [amount, setAmount] = useState(kind === 'fine' ? 2 : 5)
  const [reason, setReason] = useState('')
  const presets = kind === 'fine' ? ['Phone out', 'Disruption', 'Late', 'Unprepared'] : ['Helping a classmate', 'Great work', 'Extra effort']
  return (
    <Overlay onClose={onClose}>
      <div className="modal">
        <h2>{kind === 'fine' ? 'Fine' : 'Custom bonus'}</h2>
        <p className="slate" style={{ marginBottom: 18 }}>{who}</p>
        <div className="row" style={{ justifyContent: 'center', gap: 16, marginBottom: 18 }}>
          <button className="key" style={{ width: 64, height: 64 }} onClick={() => setAmount(a => Math.max(1, a - 1))}>−</button>
          <span className={`mono ${kind === 'fine' ? 'neg' : 'pos'}`} style={{ fontSize: 44, minWidth: 90 }}>{kind === 'fine' ? '−' : '+'}{amount}</span>
          <button className="key" style={{ width: 64, height: 64 }} onClick={() => setAmount(a => a + 1)}>+</button>
        </div>
        <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'center', marginBottom: 10 }}>
          {presets.map(p => <button key={p} className={`btn sm ${reason === p ? 'dark' : ''}`} onClick={() => setReason(p)}>{p}</button>)}
        </div>
        <input className="input" placeholder="Reason (optional)" value={reason} onChange={e => setReason(e.target.value)} style={{ marginBottom: 18 }} />
        <div className="row">
          <button className="btn lg grow" onClick={onClose}>Cancel</button>
          <button className={`btn lg grow ${kind === 'fine' ? 'red' : 'green'}`}
            onClick={() => onApply(amount, reason.trim() || (kind === 'fine' ? 'Fine' : 'Bonus'))}>
            {kind === 'fine' ? 'Fine' : 'Give'}
          </button>
        </div>
      </div>
    </Overlay>
  )
}

/** Collapse each multi-student tap (same batch) into one feed row. */
function feed(txs: Tx[]) {
  const out: { key: string; ts: number; who: string; label: string; amount: number; undone: boolean; canUndo: boolean; student: boolean; batch?: string; txs: Tx[] }[] = []
  const seen = new Set<string>()
  for (const t of txs) {
    const group = t.batch ? txs.filter(x => x.batch === t.batch) : [t]
    if (t.batch) { if (seen.has(t.batch)) continue; seen.add(t.batch) }
    const live = group.filter(x => !x.undone && x.kind !== 'reverse' && x.kind !== 'reset')
    const people = new Set(group.map(x => x.studentId)).size
    const daily = group.some(x => x.kind === 'daily')
    const single = group.length === 1
    out.push({
      key: t.batch || t.id,
      ts: t.ts,
      who: single ? t.studentName : `${people} student${people === 1 ? '' : 's'}`,
      label: single ? t.label : daily ? 'Daily check-off' : t.label,
      amount: group.reduce((n, x) => n + (x.undone && live.length ? 0 : x.amount), 0),
      undone: live.length === 0 && !group.some(x => x.kind === 'reverse'),
      canUndo: live.length > 0,
      student: t.by === 'student',
      batch: single ? undefined : t.batch,
      txs: group,
    })
  }
  return out
}
