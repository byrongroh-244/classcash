/**
 * Edit earning amounts and store items (everyday and buy-in). Changes save as soon as
 * you leave a field.
 */
import { useState } from 'react'
import { useData } from '../../lib/data'
import { saveRow, deleteRow, moveRow } from '../../lib/actions'
import type { EarnRule, StoreItem } from '../../lib/types'
import { Icon, Overlay, PICKABLE_ICONS, useRowDrag, DragGrip } from '../../components/ui'

/** Tap the icon to choose a different one from the library. */
function IconPick({ value, onPick }: { value: string; onPick: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="icon-pick" onClick={() => setOpen(true)} title="Change icon"><Icon name={value} size={26} /></button>
      {open && (
        <Overlay onClose={() => setOpen(false)}>
          <div className="modal wide">
            <h2>Choose an icon</h2>
            <div className="icon-grid">
              {PICKABLE_ICONS.map(n => (
                <button key={n} className={`icon-pick ${n === value ? 'on' : ''}`} title={n.replace(/-/g, ' ')}
                  onClick={() => { onPick(n); setOpen(false) }}><Icon name={n} size={30} /></button>
              ))}
            </div>
            <button className="btn block" style={{ marginTop: 16 }} onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </Overlay>
      )}
    </>
  )
}

function Text({ value, onSave, w = 200, num, signed }: { value: string | number | undefined; onSave: (v: string) => void; w?: number; num?: boolean; signed?: boolean }) {
  const [v, setV] = useState(String(value ?? ''))
  return (
    <input className="input sm" style={{ width: w }} value={v} inputMode={num && !signed ? 'numeric' : undefined}
      onChange={e => setV(!num ? e.target.value
        : signed ? e.target.value.replace(/[−–]/g, '-').replace(/[^0-9-]/g, '').replace(/(?!^)-/g, '')
        : e.target.value.replace(/[^0-9]/g, ''))}
      onBlur={() => { if (v !== String(value ?? '')) onSave(v) }} />
  )
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map(([k, l]) => <button key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}
    </div>
  )
}

const del = (coll: 'rules' | 'items', id: string, label: string) => {
  if (confirm(`Delete "${label}"? Past history keeps its record.`)) deleteRow(coll, id)
}
const nextOrder = (list: { order: number }[]) => Math.max(0, ...list.map(x => x.order || 0)) + 1

export default function StoreEditor() {
  const data = useData()
  const ruleDrag = useRowDrag((from, to) => moveRow('rules', data.rules.map(x => x.id), from, to))
  const itemDrag = useRowDrag((from, to) => moveRow('items', data.items.map(x => x.id), from, to))
  return (
    <div className="scroll" style={{ flex: 1 }}>
      <div className="section" style={{ maxWidth: 1180 }}>
        <h2>Ways to earn</h2>
        <div className="card" style={{ marginBottom: 28 }}>
          <table className="cfg-table">
            <thead><tr><th style={{ width: 34 }} /><th>Icon</th><th>Name</th><th>Credits</th><th>Type</th><th>Whole-class button</th><th /></tr></thead>
            <tbody>
              {data.rules.map((r: EarnRule, idx) => (
                <tr key={r.id} {...ruleDrag.row(idx)}>
                  <td style={{ paddingLeft: 6 }}><DragGrip onPointerDown={ruleDrag.grip(idx)} /></td>
                  <td><IconPick value={r.icon} onPick={v => saveRow('rules', r.id, { icon: v })} /></td>
                  <td><Text value={r.label} w={220} onSave={v => saveRow('rules', r.id, { label: v })} /></td>
                  <td><Text value={r.amount} w={60} num signed onSave={v => saveRow('rules', r.id, { amount: Number(v) || 0 })} /></td>
                  <td><Seg value={r.kind} options={[['daily', 'Daily'], ['incident', 'Anytime']]} onChange={v => saveRow('rules', r.id, { kind: v })} /></td>
                  <td>{r.kind === 'incident' && <input type="checkbox" checked={!!r.wholeClass} onChange={e => saveRow('rules', r.id, { wholeClass: e.target.checked })} style={{ width: 20, height: 20 }} />}</td>
                  <td style={{ textAlign: 'right', paddingRight: 10 }}><button className="x-btn" onClick={() => del('rules', r.id, r.label)}><Icon name="x" size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: 10 }}>
            <button className="btn sm" onClick={() => saveRow('rules', null, { label: 'New reason', amount: 1, kind: 'incident', icon: 'star', order: nextOrder(data.rules) })}>+ Add a way to earn</button>
          </div>
        </div>
        <p className="slate" style={{ fontSize: 13, margin: '-18px 0 28px' }}>
          <b>Daily</b> items are paid from the Daily check-off screen (once per student per day). <b>Anytime</b> items are buttons on the Dashboard.
        </p>

        <h2>Store</h2>
        <div className="card" style={{ marginBottom: 28 }}>
          <table className="cfg-table">
            <thead><tr><th style={{ width: 34 }} /><th>Icon</th><th>Name</th><th>Price</th><th>Section</th><th>Limit</th><th>Hall timer</th><th>On</th><th /></tr></thead>
            <tbody>
              {data.items.map((i: StoreItem, idx) => (
                <tr key={i.id} {...itemDrag.row(idx)}>
                  <td style={{ paddingLeft: 6 }}><DragGrip onPointerDown={itemDrag.grip(idx)} /></td>
                  <td><IconPick value={i.icon} onPick={v => saveRow('items', i.id, { icon: v })} /></td>
                  <td><Text value={i.label} w={190} onSave={v => saveRow('items', i.id, { label: v })} /></td>
                  <td><Text value={i.price} w={60} num onSave={v => saveRow('items', i.id, { price: Number(v) || 0 })} /></td>
                  <td><Seg value={i.tier} options={[['everyday', 'Everyday'], ['saver', 'Buy-in'], ['daily', 'Daily check-off']]} onChange={v => saveRow('items', i.id, { tier: v })} /></td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      <Text value={i.limitCount || ''} w={44} num onSave={v => saveRow('items', i.id, { limitCount: Number(v) || null })} />
                      <span className="muted" style={{ fontSize: 12 }}>per</span>
                      <Seg value={i.limitPeriod || 'day'} options={[['day', 'day'], ['week', 'wk']]} onChange={v => saveRow('items', i.id, { limitPeriod: v })} />
                    </div>
                  </td>
                  <td><div className="row" style={{ gap: 4 }}><Text value={i.hallMinutes || ''} w={44} num onSave={v => saveRow('items', i.id, { hallMinutes: Number(v) || null })} /><span className="muted" style={{ fontSize: 12 }}>min</span></div></td>
                  <td><input type="checkbox" checked={i.active} onChange={e => saveRow('items', i.id, { active: e.target.checked })} style={{ width: 20, height: 20 }} /></td>
                  <td style={{ textAlign: 'right', paddingRight: 10 }}><button className="x-btn" onClick={() => del('items', i.id, i.label)}><Icon name="x" size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: 10 }}>
            <button className="btn sm" onClick={() => saveRow('items', null, { label: 'New item', price: 10, tier: 'everyday', icon: 'gift', active: true, order: nextOrder(data.items) })}>+ Add store item</button>
          </div>
        </div>
        <p className="slate" style={{ fontSize: 13, margin: '-18px 0 28px' }}>
          <b>Daily check-off</b> items (like a preferred seat) aren't in the student store — they show up as a red column in your Daily check-off, and you check whoever to charge. <b>Buy-in</b> items are the big ones: students bank toward them (locked), then buy and go on the list (Teacher → Buy-ins). Limit and hall timer don't apply to them. Leave <b>Limit</b> blank for unlimited. A <b>Hall timer</b> makes the item a hall pass: it starts a countdown and counts toward the "max in hall" setting.
        </p>

      </div>
    </div>
  )
}
