/**
 * The iPad's main screen. Students tap their name → passcode → their account.
 * The small "Teacher" button (PIN) switches to teacher mode on this same page,
 * so there's no other URL to swipe back to.
 */
import { useState } from 'react'
import { useData, leaderboard } from '../lib/data'
import { updateStudent } from '../lib/actions'
import { mmss } from '../lib/dates'
import { DemoBanner, PinPad, Icon } from '../components/ui'
import StudentAccount from './StudentAccount'
import Teacher from './Teacher'
import type { Student } from '../lib/types'

export default function Kiosk() {
  const data = useData()
  const [mode, setMode] = useState<'students' | 'teacher'>('students')
  const [pinFor, setPinFor] = useState<'teacher' | null>(null)
  const [picked, setPicked] = useState<Student | null>(null)
  const [stage, setStage] = useState<'code' | 'new1' | 'new2' | null>(null)
  const [newCode, setNewCode] = useState('')
  const [loggedIn, setLoggedIn] = useState<string | null>(null)

  if (!data.ready) return <div className="screen" style={{ alignItems: 'center', justifyContent: 'center' }}><p className="muted">Loading…</p></div>

  if (mode === 'teacher') return <Teacher onLock={() => setMode('students')} />

  const me = loggedIn ? data.students.find(s => s.id === loggedIn) : null
  if (me) return <StudentAccount student={me} onDone={() => setLoggedIn(null)} />

  const tap = (s: Student) => { setPicked(s); setStage(s.passcode ? 'code' : 'new1') }
  const close = () => { setPicked(null); setStage(null); setNewCode('') }

  return (
    <div className="screen">
      <DemoBanner />
      <div className="topbar">
        <h1 className="grow">{data.settings.className}</h1>
        <span className="slate" style={{ fontSize: 15 }}>Tap your name to open your account</span>
      </div>
      <div className="kiosk">
        <div className="kiosk-main">
          <div className="scroll" style={{ flex: 1 }}>
            {data.students.length === 0 ? (
              <div className="section slate" style={{ textAlign: 'center', paddingTop: 80 }}>
                No students yet. Tap <b>Teacher</b> below, then go to <b>Students</b> to add your class.
              </div>
            ) : (
              <div className="name-grid">
                {data.students.map(s => (
                  <button key={s.id} className="name-tile" onClick={() => tap(s)}>
                    {s.name}
                    {data.hall.some(h => h.studentId === s.id) && <span className="badge"><Icon name="person-simple-walk" size={18} /></span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="kiosk-foot">
            <button className="btn sm ghost" onClick={() => setPinFor('teacher')}><Icon name="lock-simple" size={16} /> Teacher</button>
            <span className="muted" style={{ fontSize: 12 }}>{data.students.length} students</span>
          </div>
        </div>
        <SidePanel />
      </div>

      {pinFor === 'teacher' && (
        <PinPad
          title="Teacher PIN"
          onCancel={() => setPinFor(null)}
          onComplete={code => {
            if (code !== data.settings.pin) return false
            setPinFor(null); setMode('teacher'); return true
          }}
        />
      )}

      {picked && stage === 'code' && (
        <PinPad
          title={`Hi, ${picked.name}!`}
          subtitle="Enter your passcode"
          onCancel={close}
          onComplete={code => {
            const cur = data.students.find(s => s.id === picked.id)
            if (code !== cur?.passcode) return false
            setLoggedIn(picked.id); close(); return true
          }}
        />
      )}
      {picked && stage === 'new1' && (
        <PinPad
          title={`Welcome, ${picked.name}!`}
          subtitle={<>Create a 4-digit passcode.<br />Don't share it with anyone.</>}
          onCancel={close}
          onComplete={code => { setNewCode(code); setStage('new2'); return true }}
        />
      )}
      {picked && stage === 'new2' && (
        <PinPad
          key="confirm"
          title="Type it again"
          subtitle="To make sure you remember it"
          onCancel={close}
          onComplete={async code => {
            if (code !== newCode) { setStage('new1'); setNewCode(''); return false }
            await updateStudent(picked.id, { passcode: code })
            setLoggedIn(picked.id); close(); return true
          }}
        />
      )}
    </div>
  )
}

/** Dark right-hand panel: who's in the hall, this week's top 5, class goals. */
export function SidePanel() {
  const data = useData()
  const top = leaderboard(data, 'week').filter(r => r.score > 0).slice(0, 5)
  const goals = data.goals.filter(g => g.active)
  return (
    <aside className="side">
      {data.hall.length > 0 && (
        <div>
          <div className="label" style={{ marginBottom: 8 }}>In the hall</div>
          {data.hall.map(h => (
            <div key={h.studentId} className="hall-chip">
              <Icon name="person-simple-walk" size={18} light /><span className="grow">{h.name}</span>
              <span className="mono">{mmss(h.start + h.minutes * 60000 - data.now)}</span>
            </div>
          ))}
        </div>
      )}
      <div>
        <div className="label" style={{ marginBottom: 6 }}>Top earners this week</div>
        {top.length === 0 && <div style={{ color: '#64748b', fontSize: 14 }}>No one yet — be first!</div>}
        {top.map((r, i) => (
          <div key={r.id} className="lb-row">
            <span className={`lb-rank r${i + 1}`}>{i + 1}</span>
            <span className="grow">{r.name}</span>
            <span className="mono" style={{ color: '#fde68a' }}>{r.score}</span>
          </div>
        ))}
      </div>
      {goals.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="label">Class goals</div>
          {goals.map(g => (
            <div key={g.id} className="jar">
              <div className="row" style={{ marginBottom: 8, fontSize: 15 }}>
                <Icon name={g.icon} size={20} light /><span className="grow" style={{ fontWeight: 600 }}>{g.label}</span>
                {g.saved >= g.target && <Icon name="confetti" size={18} light />}
              </div>
              <div className="bar"><div style={{ width: `${Math.min(100, (g.saved / g.target) * 100)}%` }} /></div>
              <div className="mono" style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>{g.saved} / {g.target}</div>
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}
