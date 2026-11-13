import { useEffect, useRef, useState } from 'react'
import { useData, usedCount } from '../lib/data'
import { db } from '../lib/db'
import { buy, canBuy, donate } from '../lib/actions'
import { timeStr, shortDate, mmss } from '../lib/dates'
import { Amt, Overlay, useIdle, Icon } from '../components/ui'
import type { Student, StoreItem, Goal, Tx } from '../lib/types'

export default function StudentAccount({ student: s, onDone }: { student: Student; onDone: () => void }) {
  const data = useData()
  const [confirm, setConfirm] = useState<StoreItem | null>(null)
  const [give, setGive] = useState<Goal | null>(null)
  const [success, setSuccess] = useState<{ item: StoreItem; at: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const left = useIdle(data.settings.logoutSeconds, onDone, !success)
  const history = useHistory(s.id, 15)

  const everyday = data.items.filter(i => i.active && i.tier === 'everyday')
  const saver = data.items.filter(i => i.active && i.tier === 'saver')
  const goals = data.goals.filter(g => g.active)
  const myPass = data.hall.find(h => h.studentId === s.id)

  const doBuy = async (item: StoreItem) => {
    setBusy(true)
    const ok = await buy(data, s, item)
    setBusy(false); setConfirm(null)
    if (ok) setSuccess({ item, at: Date.now() })
    else setMsg("That didn't go through — check your balance and try again.")
  }

  if (success) return <PurchaseDone item={success.item} at={success.at} name={s.name} onClose={() => { setSuccess(null); onDone() }} />

  const statusFor = (item: StoreItem) => {
    const c = canBuy(data, s, item)
    if (c.ok) {
      if (item.limitCount) {
        const left = item.limitCount - usedCount(data, s.id, item)
        return <span className="pos">{left} left {item.limitPeriod === 'week' ? 'this week' : 'today'}</span>
      }
      return <span className="pos">You can buy this</span>
    }
    return <span className="muted">{c.short}</span>
  }

  return (
    <div className="screen">
      <div className="acct-head">
        <div className="grow">
          <div className="label">Signed in as</div>
          <div className="serif" style={{ fontSize: 30, fontWeight: 700 }}>{s.name}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="label">Balance</div>
          <Amt n={s.balance} className={`acct-balance ${s.balance < 0 ? 'neg' : ''}`} />
        </div>
        <button className="btn dark lg" style={{ marginLeft: 12 }} onClick={onDone}>Done</button>
      </div>
      <div className="timeout-bar"><div style={{ width: `${(left / data.settings.logoutSeconds) * 100}%` }} /></div>

      <div className="scroll" style={{ flex: 1 }}>
        {myPass && (
          <div className="section" style={{ paddingBottom: 0 }}>
            <div className="hall-card" style={{ margin: 0 }}>
              <Icon name="person-simple-walk" size={20} /> <b className="grow">{myPass.label}</b>
              <span className="mono">{mmss(myPass.start + myPass.minutes * 60000 - data.now)} left</span>
            </div>
          </div>
        )}

        <div className="section">
          <h2>Spend</h2>
          <div className="shop-grid">
            {everyday.map(item => {
              const ok = canBuy(data, s, item).ok
              return (
                <button key={item.id} className={`shop-item ${ok ? 'can' : ''}`} disabled={!ok} onClick={() => setConfirm(item)}>
                  <Icon name={item.icon} size={36} />
                  <span className="name">{item.label}</span>
                  <Amt n={item.price} />
                  <span className="status">{statusFor(item)}</span>
                </button>
              )
            })}
          </div>
        </div>

        {saver.length > 0 && (
          <div className="section">
            <h2>Save up for</h2>
            <div className="shop-grid">
              {saver.map(item => {
                const ok = canBuy(data, s, item).ok
                const pct = Math.max(0, Math.min(100, (s.balance / item.price) * 100))
                return (
                  <button key={item.id} className={`shop-item ${ok ? 'can' : ''}`} disabled={!ok} onClick={() => setConfirm(item)}>
                    <Icon name={item.icon} size={36} />
                    <span className="name">{item.label}</span>
                    <Amt n={item.price} />
                    <div className="save-bar"><div style={{ width: `${pct}%` }} /></div>
                    <span className="status">{statusFor(item)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {goals.length > 0 && (
          <div className="section">
            <h2>Class goals</h2>
            <p className="slate" style={{ fontSize: 14, marginBottom: 10 }}>Chip in with your classmates. When the jar is full, the whole class gets it.</p>
            <div className="shop-grid light">
              {goals.map(g => {
                const done = g.saved >= g.target
                return (
                  <button key={g.id} className="shop-item" disabled={done || s.balance <= 0} onClick={() => setGive(g)}>
                    <Icon name={g.icon} size={36} />
                    <span className="name">{g.label}</span>
                    <div className="bar"><div style={{ width: `${Math.min(100, (g.saved / g.target) * 100)}%` }} /></div>
                    <span className="mono slate" style={{ fontSize: 13 }}>{g.saved} / {g.target}</span>
                    <span className="status">{done ? <span className="pos">Goal reached!</span> : <span style={{ color: 'var(--primary)' }}>Tap to chip in</span>}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="section">
          <h2>Recent activity</h2>
          <div className="card" style={{ padding: '4px 16px' }}>
            <HistoryList txs={history} empty={`Nothing yet. Earn ${data.settings.currency} for being on time, homework and participating!`} />
          </div>
        </div>
      </div>

      {confirm && (
        <Overlay onClose={() => setConfirm(null)}>
          <div className="modal">
            <Icon name={confirm.icon} size={64} />
            <h2>{confirm.label}</h2>
            <p className="slate" style={{ fontSize: 17, margin: '8px 0 20px' }}>
              Spend <Amt n={confirm.price} /> {data.settings.currency}? You'll have <b>{s.balance - confirm.price}</b> left.
            </p>
            <div className="row">
              <button className="btn lg grow" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="btn lg green grow" disabled={busy} onClick={() => doBuy(confirm)}>Buy it</button>
            </div>
          </div>
        </Overlay>
      )}

      {give && <GiveModal goal={give} balance={s.balance} currency={data.settings.currency} onClose={() => setGive(null)} onGive={async n => {
        setBusy(true); const ok = await donate(s, give, n); setBusy(false); setGive(null)
        if (!ok) setMsg("That didn't go through — check your balance.")
      }} busy={busy} />}

      {msg && (
        <Overlay onClose={() => setMsg('')}>
          <div className="modal"><p style={{ fontSize: 17, marginBottom: 16 }}>{msg}</p><button className="btn dark block" onClick={() => setMsg('')}>OK</button></div>
        </Overlay>
      )}
    </div>
  )
}

function GiveModal({ goal, balance, currency, onClose, onGive, busy }: { goal: Goal; balance: number; currency: string; onClose: () => void; onGive: (n: number) => void; busy: boolean }) {
  const remaining = goal.target - goal.saved
  const options = [1, 5, 10, 25].filter(n => n <= balance && n <= Math.max(remaining, 1))
  return (
    <Overlay onClose={onClose}>
      <div className="modal">
        <Icon name={goal.icon} size={64} />
        <h2>Chip in to {goal.label}</h2>
        <p className="slate" style={{ margin: '6px 0 20px' }}>{remaining} more needed. How many {currency} do you want to give?</p>
        <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          {options.map(n => <button key={n} className="btn lg" disabled={busy} onClick={() => onGive(n)}><Amt n={n} /></button>)}
          {options.length === 0 && <p className="muted">You don't have enough yet.</p>}
        </div>
        <button className="btn block" onClick={onClose}>Cancel</button>
      </div>
    </Overlay>
  )
}

/** Big "show your teacher" screen after a purchase. */
function PurchaseDone({ item, at, name, onClose }: { item: StoreItem; at: number; name: string; onClose: () => void }) {
  const data = useData()
  const pass = data.hall.find(h => h.name === name && h.start >= at - 5000)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => { const id = setTimeout(() => close.current(), 12000); return () => clearTimeout(id) }, [])
  return (
    <div className="screen" style={{ alignItems: 'center', justifyContent: 'center', background: 'var(--green)', color: '#fff', textAlign: 'center', gap: 14 }} onClick={onClose}>
      <Icon name={item.icon} size={110} light />
      <div className="serif" style={{ fontSize: 44, fontWeight: 700 }}>{name}</div>
      <div style={{ fontSize: 28, fontWeight: 600 }}>{item.label}</div>
      {pass && <div className="mono" style={{ fontSize: 22, opacity: .9 }}>Back by {timeStr(pass.start + pass.minutes * 60000)}</div>}
      <div style={{ fontSize: 16, opacity: .85, marginTop: 20 }}>Purchased at {timeStr(at)} · tap to close</div>
    </div>
  )
}

/** A student's most recent transactions (any date). */
export function useHistory(studentId: string, limit = 30): Tx[] {
  const [list, setList] = useState<Tx[]>([])
  useEffect(() => db.listen('tx', v => {
    const arr = Object.entries(v || {}).map(([id, t]) => ({ ...(t as Tx), id }))
    setList(arr.sort((a, b) => b.ts - a.ts).slice(0, limit))
  }, { child: 'studentId', equalTo: studentId, limitToLast: 200 }), [studentId, limit])
  return list
}

export function HistoryList({ txs, empty, onUndo }: { txs: Tx[]; empty?: string; onUndo?: (t: Tx) => void }) {
  if (!txs.length) return <p className="muted" style={{ padding: '14px 0', fontSize: 14 }}>{empty || 'No activity yet.'}</p>
  let lastDate = ''
  return (
    <div className="history">
      {txs.map(t => {
        const head = t.date !== lastDate ? (lastDate = t.date) : null
        return (
          <div key={t.id}>
            {head && <div className="label" style={{ padding: '10px 0 2px' }}>{shortDate(t.date)}</div>}
            <div className={`hist-row ${t.undone ? 'undone' : ''}`}>
              <span className="muted mono" style={{ width: 62, fontSize: 12 }}>{timeStr(t.ts)}</span>
              <span className="grow">{t.label}</span>
              {t.amount !== 0 && <Amt n={t.amount} sign className={t.amount > 0 ? 'pos' : 'neg'} />}
              {onUndo && (t.undone || t.kind === 'reverse' || t.kind === 'reset'
                ? <span style={{ width: 28 }} />
                : <button className="x-btn" title="Undo" onClick={() => onUndo(t)}><Icon name="arrow-counter-clockwise" size={16} /></button>)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
