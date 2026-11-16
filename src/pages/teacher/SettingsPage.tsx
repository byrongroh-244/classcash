import { useState } from 'react'
import { useData } from '../../lib/data'
import { saveSettings, resetSemester } from '../../lib/actions'
import { PinPad, Toast, Icon } from '../../components/ui'
import type { Settings } from '../../lib/types'

export default function SettingsPage() {
  const data = useData()
  const s = data.settings
  const [changingPin, setChangingPin] = useState<'new' | 'confirm' | null>(null)
  const [newPin, setNewPin] = useState('')
  const [resetting, setResetting] = useState(false)
  const [msg, setMsg] = useState('')
  const boardUrl = `${location.origin}${import.meta.env.BASE_URL}board`

  return (
    <div className="scroll" style={{ flex: 1 }}>
      <div className="section" style={{ maxWidth: 640 }}>
        <h2>Class</h2>
        <div className="card" style={{ padding: 18, marginBottom: 24 }}>
          <Field s={s} k="className" label="Title shown on the iPad" />
          <Field s={s} k="currency" label="Currency name" help="Shown in a few places, e.g. “credits” or “Groh Bucks”." />
          <Field s={s} k="logoutSeconds" label="Student auto sign-out (seconds)" num />
          <Field s={s} k="teacherTimeoutMin" label="Teacher mode auto-lock (minutes)" num />
          <Field s={s} k="maxInHall" label="Max students in the hall at once" num help="Applies to store items with a hall timer. Your free passes ignore it." />
        </div>

        <h2>Shout-outs</h2>
        <div className="card" style={{ padding: 18, marginBottom: 24 }}>
          <p className="slate" style={{ fontSize: 14, marginBottom: 12 }}>
            When you give points from the Dashboard (a reason button or a custom bonus), the screen bursts with confetti and shows the student's name.
            Daily check-off, fines, Students-tab corrections and purchases never trigger it.
          </p>
          <Toggle on={s.cheerBoard} label="Celebrate on the projector board" onChange={v => saveSettings({ cheerBoard: v })} />
          <Toggle on={s.cheerKiosk} label="Celebrate on the iPad name screen" onChange={v => saveSettings({ cheerKiosk: v })} />
        </div>

        <h2>Leaderboard screen</h2>
        <div className="card" style={{ padding: 18, marginBottom: 24 }}>
          <p className="slate" style={{ fontSize: 14, marginBottom: 12 }}>
            What the leaderboard shows, on the projector and on the class iPad while the store is closed. The confetti pop-ups are set under Shout-outs above.
          </p>
          <Toggle on={s.boardShoutouts} label="Shout-outs today (live feed)" onChange={v => saveSettings({ boardShoutouts: v })} />
          <Toggle on={s.boardWeek} label="Top earners this week" onChange={v => saveSettings({ boardWeek: v })} />
          <Toggle on={s.boardAllTime} label="All-time leaders" onChange={v => saveSettings({ boardAllTime: v })} />
          <Toggle on={s.boardBuyIns} label="Buy-in counts (how many students are in)" onChange={v => saveSettings({ boardBuyIns: v })} />
        </div>

        <h2>Teacher PIN</h2>
        <div className="card row" style={{ padding: 18, marginBottom: 24 }}>
          <span className="grow slate">Used to open teacher mode. {s.pin === '0000' && <b className="neg">Still the default (0000) — change it!</b>}</span>
          <button className="btn dark" onClick={() => setChangingPin('new')}>Change PIN</button>
        </div>

        <h2>Front-of-room board</h2>
        <div className="card" style={{ padding: 18, marginBottom: 24 }}>
          <p className="slate" style={{ fontSize: 14, marginBottom: 10 }}>
            Open this link on the projector computer or a TV for a full-screen leaderboard, shout-outs and buy-in counts. It updates live and has no buttons.
          </p>
          <div className="row">
            <code className="input mono grow" style={{ fontSize: 13 }}>{boardUrl}</code>
            <a className="btn" href={boardUrl} target="_blank" rel="noreferrer">Open</a>
          </div>
        </div>

        <h2>New semester</h2>
        <div className="card row" style={{ padding: 18, marginBottom: 40 }}>
          <span className="grow slate" style={{ fontSize: 14 }}>Sets every balance and leaderboard total to 0. Transaction history is kept.</span>
          <button className="btn red" onClick={() => setResetting(true)}>Reset balances…</button>
        </div>
      </div>

      {changingPin === 'new' && <PinPad title="New teacher PIN" onCancel={() => setChangingPin(null)}
        onComplete={c => { setNewPin(c); setChangingPin('confirm'); return true }} />}
      {changingPin === 'confirm' && <PinPad key="c" title="Type it again" onCancel={() => setChangingPin(null)}
        onComplete={async c => {
          if (c !== newPin) return false
          await saveSettings({ pin: c }); setChangingPin(null); setMsg('PIN changed'); return true
        }} />}
      {resetting && <PinPad title="Enter PIN to reset" subtitle="This zeroes all balances and banked credits. Buy-in lists are kept." onCancel={() => setResetting(false)}
        onComplete={async c => {
          if (c !== s.pin) return false
          await resetSemester(data); setResetting(false); setMsg('All balances reset to 0'); return true
        }} />}
      {msg && <Toast key={msg} onDone={() => setMsg('')}><span className="row"><Icon name="check" size={16} light />{msg}</span></Toast>}
    </div>
  )
}

function Field({ s, k, label, num, help }: { s: Settings; k: keyof Settings; label: string; num?: boolean; help?: string }) {
  const [v, setV] = useState(String(s[k]))
  return (
    <label className="field" style={{ marginBottom: 14 }}>
      <span>{label}</span>
      <input className="input" style={{ maxWidth: num ? 120 : 320 }} value={v} inputMode={num ? 'numeric' : undefined}
        onChange={e => setV(num ? e.target.value.replace(/[^0-9]/g, '') : e.target.value)}
        onBlur={() => { const val = num ? Math.max(1, Number(v) || 1) : v.trim(); if (String(val) !== String(s[k])) saveSettings({ [k]: val }); setV(String(val)) }} />
      {help && <small className="muted">{help}</small>}
    </label>
  )
}

function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button className="toggle-row" onClick={() => onChange(!on)}>
      <span className={`switch ${on ? 'on' : ''}`}><span /></span>
      <span>{label}</span>
    </button>
  )
}
