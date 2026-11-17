import { useEffect, useState } from 'react'
import { useData, usedCount, banked, bankedTotal, onList } from '../lib/data'
import { db } from '../lib/db'
import { buy, canBuy, bankToward, bankRoom } from '../lib/actions'
import { timeStr, shortDate, passStatus } from '../lib/dates'
import { Amt, Overlay, useIdle, Icon } from '../components/ui'
import type { Student, StoreItem, Tx } from '../lib/types'

export default function StudentAccount({ student: s, onDone }: { student: Student; onDone: () => void }) {
  const data = useData()
  const [confirm, setConfirm] = useState<StoreItem | null>(null)
  const [saving, setSaving] = useState<StoreItem | null>(null)
  const [success, setSuccess] = useState<{ item: StoreItem; at: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const left = useIdle(data.settings.logoutSeconds, onDone, !success)
  const history = useHistory(s.id, 15)

  const everyday = data.items.filter(i => i.active && i.tier === 'everyday')
  const saver = data.items.filter(i => i.active && i.tier === 'saver')
  const myBanked = bankedTotal(data, s.id)
  const myPass = data.hall.find(h => h.studentId === s.id)

  const doBuy = async (item: StoreItem) => {
    setBusy(true)
    const ok = await buy(data, s, item)
    setBusy(false); setConfirm(null); setSaving(null)
    if (ok) setSuccess({ item, at: Date.now() })
    else setMsg("That didn't go through — check your balance and try again.")
  }

  if (success) return <PurchaseDone item={success.item} at={success.at} name={s.name} balance={s.balance}
    onKeepShopping={() => setSuccess(null)} onLogOut={() => { setSuccess(null); onDone() }} />

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
        {myBanked > 0 && (
          <div style={{ textAlign: 'right', marginLeft: 18 }}>
            <div className="label">Banked</div>
            <Amt n={myBanked} className="acct-banked" />
          </div>
        )}
        <button className="btn dark lg" style={{ marginLeft: 12 }} onClick={onDone}>Done</button>
      </div>
      <div className="timeout-bar"><div style={{ width: `${(left / data.settings.logoutSeconds) * 100}%` }} /></div>

      <div className="scroll" style={{ flex: 1 }}>
        {myPass && (
          <div className="section" style={{ paddingBottom: 0 }}>
            <div className="hall-card" style={{ margin: 0 }}>
              <Icon name="person-simple-walk" size={20} /> <b className="grow">{myPass.label}</b>
              <span className="mono">{passStatus(myPass, data.now).over ? `${passStatus(myPass, data.now).text} over` : `${passStatus(myPass, data.now).text} left`}</span>
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
            <h2>Buy-ins</h2>
            <p className="slate" style={{ fontSize: 14, marginBottom: 10 }}>
              Bank {data.settings.currency} toward a big item a little at a time. Banked {data.settings.currency} are locked for that item.
              When you have enough, buy it and you're on the list.
            </p>
            <div className="shop-grid">
              {saver.map(item => {
                const mine = banked(data, s.id, item.id)
                const listed = onList(data, s.id, item.id)
                const ready = canBuy(data, s, item).ok
                return (
                  <button key={item.id} className={`shop-item ${listed ? 'listed' : ready ? 'can' : ''}`} onClick={() => setSaving(item)}>
                    <Icon name={item.icon} size={36} />
                    <span className="name">{item.label}</span>
                    <Amt n={item.price} />
                    <div className="save-bar"><div style={{ width: `${listed ? 100 : Math.min(100, (mine / item.price) * 100)}%` }} /></div>
                    <span className="status">
                      {listed ? <span className="pos">You're on the list</span>
                        : ready ? <span className="pos">Ready to buy</span>
                        : <span className="slate">{mine} / {item.price} banked</span>}
                    </span>
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


      {saving && (
        <SaverModal item={saving} s={s} busy={busy} onClose={() => setSaving(null)}
          onBank={async n => {
            setBusy(true); const ok = await bankToward(data, s, saving, n); setBusy(false)
            if (!ok) setMsg("That didn't go through — check your balance.")
          }}
          onBuy={() => doBuy(saving)} />
      )}

      {msg && (
        <Overlay onClose={() => setMsg('')}>
          <div className="modal"><p style={{ fontSize: 17, marginBottom: 16 }}>{msg}</p><button className="btn dark block" onClick={() => setMsg('')}>OK</button></div>
        </Overlay>
      )}
    </div>
  )
}


/**
 * Big "show your teacher" screen after a purchase, then the student chooses:
 * keep shopping or log out. Logs out by itself after 20 seconds untouched.
 */
function PurchaseDone({ item, at, name, balance, onKeepShopping, onLogOut }: {
  item: StoreItem; at: number; name: string; balance: number; onKeepShopping: () => void; onLogOut: () => void
}) {
  const data = useData()
  const pass = data.hall.find(h => h.name === name && h.start >= at - 5000)
  const left = useIdle(20, onLogOut)
  return (
    <div className="screen done-screen">
      <Icon name={item.icon} size={110} light />
      <div className="serif" style={{ fontSize: 44, fontWeight: 700 }}>{name}</div>
      <div style={{ fontSize: 28, fontWeight: 600 }}>{item.label}</div>
      {pass && <div className="mono" style={{ fontSize: 22, opacity: .9 }}>Back by {timeStr(pass.start + pass.minutes * 60000)}</div>}
      {pass && <div style={{ fontSize: 18, opacity: .95 }}>Sign back in on this iPad when you return</div>}
      {item.tier === 'saver' && <div style={{ fontSize: 22, opacity: .95 }}>You're on the list!</div>}
      <div style={{ fontSize: 16, opacity: .85 }}>Purchased at {timeStr(at)} · {balance} {data.settings.currency} left</div>
      <div className="row" style={{ gap: 14, marginTop: 28 }}>
        <button className="btn lg done-btn" onClick={onKeepShopping}>Keep shopping</button>
        <button className="btn lg done-btn primary" onClick={onLogOut}><Icon name="sign-out" size={20} /> Log out</button>
      </div>
      <div style={{ fontSize: 13, opacity: .75, marginTop: 6 }}>Logging out in {Math.max(0, left)}s</div>
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

/** Bank toward a buy-in item, or buy it once there's enough. */
function SaverModal({ item, s, busy, onClose, onBank, onBuy }: {
  item: StoreItem; s: Student; busy: boolean; onClose: () => void; onBank: (n: number) => void; onBuy: () => void
}) {
  const data = useData()
  const mine = banked(data, s.id, item.id)
  const listed = onList(data, s.id, item.id)
  const room = bankRoom(data, s, item)
  const check = canBuy(data, s, item)
  const fromBalance = Math.max(0, item.price - mine)
  const amounts = [...new Set([1, 5, 10, room].filter(n => n > 0 && n <= room))].sort((a, b) => a - b)
  const cur = data.settings.currency
  return (
    <Overlay onClose={onClose}>
      <div className="modal">
        <Icon name={item.icon} size={64} />
        <h2>{item.label}</h2>
        <p className="slate" style={{ marginBottom: 14 }}>Costs <Amt n={item.price} /> {cur}</p>

        {listed ? (
          <p className="pos" style={{ fontSize: 18, fontWeight: 600, margin: '10px 0 20px' }}>You're on the list for this!</p>
        ) : (
          <>
            <div className="save-bar" style={{ height: 14, borderRadius: 8 }}><div style={{ width: `${Math.min(100, (mine / item.price) * 100)}%` }} /></div>
            <p className="mono" style={{ fontSize: 15, margin: '8px 0 18px' }}><b>{mine}</b> / {item.price} banked</p>

            {check.ok ? (
              <button className="btn lg green block" disabled={busy} onClick={onBuy} style={{ marginBottom: 12 }}>
                Buy it{mine > 0 ? ` (${Math.min(mine, item.price)} banked${fromBalance ? ` + ${fromBalance} from balance` : ''})` : ''}
              </button>
            ) : null}

            {mine < item.price && (
              <>
                <div className="label" style={{ marginBottom: 8 }}>Bank toward it</div>
                {amounts.length ? (
                  <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                    {amounts.map(n => (
                      <button key={n} className="btn lg" disabled={busy} onClick={() => onBank(n)}>
                        {n === room && n > 10 ? 'All ' : '+'}{n}<span className="coin" />
                      </button>
                    ))}
                  </div>
                ) : <p className="muted" style={{ marginBottom: 6 }}>You don't have any {cur} to bank right now.</p>}
                <p className="muted" style={{ fontSize: 12, margin: '8px 0 14px' }}>Banked {cur} are locked for {item.label}. Only your teacher can move them back.</p>
              </>
            )}
          </>
        )}
        <button className="btn block" onClick={onClose}>Done</button>
      </div>
    </Overlay>
  )
}
