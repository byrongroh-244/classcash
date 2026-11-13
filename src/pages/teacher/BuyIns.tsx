/**
 * Big items: who's on each list (paid), who's saving toward it, and clearing
 * the list after the event. Refunds are done with undo in a student's History.
 */
import { useData, banked } from '../../lib/data'
import { removeFromList, clearList } from '../../lib/actions'
import { shortDate, dateStr } from '../../lib/dates'
import { Amt, Icon } from '../../components/ui'

export default function BuyIns() {
  const data = useData()
  const items = data.items.filter(i => i.tier === 'saver')

  if (!items.length) return (
    <div className="section slate">No buy-in items yet. In <b>Store & earning</b>, set an item's section to <b>Buy-in</b>.</div>
  )

  return (
    <div className="scroll" style={{ flex: 1 }}>
      <div className="section" style={{ maxWidth: 1100 }}>
        <p className="slate" style={{ fontSize: 14, marginBottom: 16 }}>
          Students bank credits toward these (locked), then buy in and land on the list. Take students off a list once they've used it,
          or clear the whole list after the event. To refund someone, undo the entry in their History on the Students tab.
        </p>
        <div className="buyin-grid">
          {items.map(item => {
            const list = data.lists[item.id] || []
            const listed = new Set(list.map(e => e.studentId))
            const savers = data.students
              .map(s => ({ s, n: banked(data, s.id, item.id) }))
              .filter(x => x.n > 0 && !listed.has(x.s.id))
              .sort((a, b) => b.n - a.n)
            return (
              <div key={item.id} className="card buyin-card" style={{ opacity: item.active ? 1 : .6 }}>
                <div className="row" style={{ marginBottom: 12 }}>
                  <Icon name={item.icon} size={34} />
                  <div className="grow">
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{item.label}</div>
                    <div className="slate" style={{ fontSize: 13 }}><Amt n={item.price} /> each{!item.active && ' · hidden from students'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="mono" style={{ fontSize: 22, fontWeight: 600 }}>{list.length}<span className="muted" style={{ fontSize: 14 }}> / {data.students.length}</span></div>
                    <div className="label">on the list</div>
                  </div>
                </div>

                <div className="label" style={{ marginBottom: 4 }}>On the list</div>
                {list.length === 0 && <p className="muted" style={{ fontSize: 13, padding: '4px 0 8px' }}>Nobody yet.</p>}
                {list.map(e => (
                  <div key={e.studentId} className="row list-row">
                    <Icon name="seal-check" size={18} />
                    <b className="grow">{e.name}</b>
                    <span className="muted" style={{ fontSize: 12 }}>{dateStr(new Date(e.ts)) === data.today ? 'today' : shortDate(dateStr(new Date(e.ts)))}</span>
                    <button className="btn sm ghost" title="They've used it — take them off the list (no refund)"
                      onClick={() => { if (confirm(`Take ${e.name} off the ${item.label} list? (No refund — use this once they've used it.)`)) removeFromList(item.id, e.studentId) }}>Used</button>
                  </div>
                ))}
                {list.length > 0 && (
                  <button className="btn sm" style={{ marginTop: 8 }}
                    onClick={() => { if (confirm(`Clear everyone off the ${item.label} list? Do this after the event. No refunds.`)) clearList(item.id) }}>
                    Event done — clear list
                  </button>
                )}

                <div className="label" style={{ margin: '16px 0 4px' }}>Saving toward it</div>
                {savers.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Nobody has banked toward this yet.</p>}
                {savers.map(({ s, n }) => (
                  <div key={s.id} className="row list-row">
                    <span style={{ width: 90, fontWeight: 600 }}>{s.name}</span>
                    <div className="save-bar grow"><div style={{ width: `${Math.min(100, (n / item.price) * 100)}%` }} /></div>
                    <span className="mono slate" style={{ fontSize: 13, width: 64, textAlign: 'right' }}>{n} / {item.price}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
