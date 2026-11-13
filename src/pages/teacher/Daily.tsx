/**
 * Daily check-off. Everyone starts checked; uncheck whoever missed something,
 * then tap Pay. Coming back later shows what was paid, and changes are
 * applied as differences (newly checked → paid, unchecked → taken back).
 */
import { useEffect, useMemo, useState } from 'react'
import { useData } from '../../lib/data'
import { saveDaily } from '../../lib/actions'
import { shortDate } from '../../lib/dates'
import { Toast, Icon } from '../../components/ui'

type Want = Record<string, Record<string, boolean>>

export default function Daily() {
  const data = useData()
  const rules = data.rules.filter(r => r.kind === 'daily')

  const fromDb = useMemo<Want>(() => {
    const w: Want = {}
    for (const s of data.students) {
      w[s.id] = {}
      // Before the first save today, default everyone to checked.
      for (const r of rules) w[s.id][r.id] = data.dailySaved ? !!data.daily[s.id]?.[r.id] : true
    }
    return w
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.students, data.daily, data.dailySaved, rules.map(r => r.id).join()])

  const [want, setWant] = useState<Want>(fromDb)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  useEffect(() => { if (!dirty) setWant(fromDb) }, [fromDb, dirty])

  const set = (sid: string, rid: string, v: boolean) => {
    setDirty(true)
    setWant(w => ({ ...w, [sid]: { ...w[sid], [rid]: v } }))
  }
  const setRow = (sid: string, v: boolean) => {
    setDirty(true)
    setWant(w => ({ ...w, [sid]: Object.fromEntries(rules.map(r => [r.id, v])) }))
  }
  const setCol = (rid: string) => {
    const allOn = data.students.every(s => want[s.id]?.[rid])
    setDirty(true)
    setWant(w => Object.fromEntries(data.students.map(s => [s.id, { ...w[s.id], [rid]: !allOn }])))
  }

  // What Pay would do right now.
  let toPay = 0, toTake = 0
  for (const s of data.students) for (const r of rules) {
    const has = !!data.daily[s.id]?.[r.id]; const w = !!want[s.id]?.[r.id]
    if (w && !has) toPay += r.amount
    if (!w && has) toTake += r.amount
  }
  const changes = toPay > 0 || toTake > 0

  const save = async () => {
    setBusy(true)
    const res = await saveDaily(data, want)
    setBusy(false); setDirty(false)
    setToast(`Paid ${res.paid} daily credit${res.paid === 1 ? '' : 's'}${res.reversed ? `, took back ${res.reversed}` : ''}`)
  }

  if (!rules.length) return <div className="section slate">No daily items. Add some in <b>Store & earning</b> (set type to "Daily").</div>

  return (
    <div className="screen" style={{ flex: 1, height: 'auto', minHeight: 0 }}>
      <div className="row" style={{ padding: '12px 20px', flexShrink: 0 }}>
        <div className="grow">
          <div className="serif" style={{ fontSize: 20, fontWeight: 700 }}>{shortDate(data.today)}</div>
          <div className="slate" style={{ fontSize: 13 }}>
            {data.dailySaved ? 'Paid today. Change any box and tap Update.' : 'Everyone starts checked — uncheck whoever missed something.'}
          </div>
        </div>
        {dirty && <button className="btn" onClick={() => { setDirty(false); setWant(fromDb) }}>Reset</button>}
        <button className="btn green lg" disabled={busy || (data.dailySaved && !changes)} onClick={save}>
          {data.dailySaved ? (changes ? 'Update' : 'Up to date') : `Pay daily credits`}
          {changes && <span className="mono" style={{ fontSize: 14, opacity: .9 }}>
            {toPay ? ` +${toPay}` : ''}{toTake ? ` −${toTake}` : ''}
          </span>}
        </button>
      </div>
      <div className="scroll" style={{ flex: 1 }}>
        <table className="daily-table">
          <thead>
            <tr>
              <th>Student</th>
              {rules.map(r => (
                <th key={r.id}><button onClick={() => setCol(r.id)} title="Toggle whole column">
                  <Icon name={r.icon} size={24} />{r.label}<div className="muted mono">+{r.amount}</div>
                </button></th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {data.students.map(s => {
              const any = rules.some(r => want[s.id]?.[r.id])
              return (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  {rules.map(r => {
                    const on = !!want[s.id]?.[r.id]
                    const paid = !!data.daily[s.id]?.[r.id]
                    return (
                      <td key={r.id}>
                        <button className={`tick ${on ? 'on' : ''} ${paid ? 'paid' : ''}`} onClick={() => set(s.id, r.id, !on)}>{on && <Icon name="check" size={22} light={!paid} />}</button>
                      </td>
                    )
                  })}
                  <td><button className="btn sm" onClick={() => setRow(s.id, !any)}>{any ? 'Absent' : 'All'}</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="muted" style={{ padding: '12px 20px 24px', fontSize: 12 }}>
          Light green = already paid today. Dashed red = paid, but unchecked (Update will take it back).
        </p>
      </div>
      {toast && <Toast key={toast} onDone={() => setToast('')}><span className="row"><Icon name="check" size={16} light />{toast}</span></Toast>}
    </div>
  )
}
