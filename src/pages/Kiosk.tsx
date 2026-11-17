/**
 * The iPad's main screen. Students tap their name → passcode → their account.
 * The small "Teacher" button (PIN) switches to teacher mode on this same page,
 * so there's no other URL to swipe back to.
 */
import { useEffect, useRef, useState } from 'react'
import { useData, leaderboard } from '../lib/data'
import { updateStudent, saveSettings, checkIn } from '../lib/actions'
import { passStatus } from '../lib/dates'
import { DemoBanner, PinPad, Icon, Toast } from '../components/ui'
import StudentAccount from './StudentAccount'
import { Celebrations, cheersToday } from '../components/Celebrate'
import Board from './Board'
import Teacher from './Teacher'
import type { Student } from '../lib/types'

export default function Kiosk() {
  const data = useData()
  const [mode, setMode] = useState<'students' | 'teacher'>('students')
  const [pinFor, setPinFor] = useState<'teacher' | 'open' | 'close' | null>(null)
  const [picked, setPicked] = useState<Student | null>(null)
  const [stage, setStage] = useState<'code' | 'new1' | 'new2' | null>(null)
  const [newCode, setNewCode] = useState('')
  const [loggedIn, setLoggedIn] = useState<string | null>(null)
  const [welcome, setWelcome] = useState<{ name: string; minutes: number; fined: number } | null>(null)
  const storeOpen = data.settings.storeOpen
  // This iPad's own choice while the store is open: the name screen, or the leaderboard.
  // Remembered on this device only; the other iPad isn't affected.
  const [view, setViewState] = useState<'store' | 'board'>(() => {
    try { return localStorage.getItem('classbank_view') === 'board' ? 'board' : 'store' } catch { return 'store' }
  })
  const setView = (v: 'store' | 'board') => {
    setViewState(v)
    try { localStorage.setItem('classbank_view', v) } catch { /* ignore */ }
  }

  // Store closed from the other iPad → sign out whoever is on this one.
  // Store opened (from either iPad) → every iPad goes back to the name screen.
  const wasOpen = useRef(storeOpen)
  useEffect(() => {
    if (!storeOpen) { setLoggedIn(null); setPicked(null); setStage(null); setNewCode('') }
    if (storeOpen && !wasOpen.current) setView('store')
    wasOpen.current = storeOpen
  }, [storeOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!data.ready) return <div className="screen" style={{ alignItems: 'center', justifyContent: 'center' }}><p className="muted">Loading…</p></div>

  if (mode === 'teacher') return <Teacher onLock={() => setMode('students')} />

  // One PIN pad for: entering teacher mode, or opening / closing the store right here.
  const teacherPin = pinFor && (
    <PinPad
      title={pinFor === 'open' ? 'Open the store' : pinFor === 'close' ? 'Close the store' : 'Teacher PIN'}
      subtitle={pinFor === 'teacher' ? undefined : 'Enter your teacher PIN'}
      onCancel={() => setPinFor(null)}
      onComplete={async code => {
        if (code !== data.settings.pin) return false
        const action = pinFor
        setPinFor(null)
        if (action === 'teacher') setMode('teacher')
        else await saveSettings({ storeOpen: action === 'open' })
        return true
      }}
    />
  )

  const tap = (s: Student) => { setPicked(s); setStage(s.passcode ? 'code' : 'new1') }
  const close = () => { setPicked(null); setStage(null); setNewCode('') }

  // Signed in with their passcode. Back from the hall? That's a check-in.
  // Otherwise open their account (only while the store is open).
  const afterAuth = async (id: string) => {
    if (data.hall.some(h => h.studentId === id)) {
      const name = data.students.find(s => s.id === id)?.name || ''
      const res = await checkIn(data, id)
      if (res) setWelcome({ name, ...res })
      return
    }
    if (storeOpen) setLoggedIn(id)
  }

  // Master PIN (Settings): opens any student's account straight away — no hall check-in,
  // and a student who hasn't made a passcode yet still gets to make their own later.
  const isMaster = (code: string) => !!data.settings.masterPin && code === data.settings.masterPin
  const openAsTeacher = (id: string) => { setLoggedIn(id) }

  const studentPins = <>
        {picked && stage === 'code' && (
          <PinPad
            title={`Hi, ${picked.name}!`}
            subtitle="Enter your passcode"
            onCancel={close}
            onComplete={code => {
              const cur = data.students.find(s => s.id === picked.id)
              if (isMaster(code)) { openAsTeacher(picked.id); close(); return true }
              if (code !== cur?.passcode) return false
              afterAuth(picked.id); close(); return true
            }}
          />
        )}
        {picked && stage === 'new1' && (
          <PinPad
            title={`Welcome, ${picked.name}!`}
            subtitle={<>Create a 4-digit passcode.<br />Don't share it with anyone.</>}
            onCancel={close}
            onComplete={code => {
              if (isMaster(code)) { openAsTeacher(picked.id); close(); return true }
              setNewCode(code); setStage('new2'); return true
            }}
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
              afterAuth(picked.id); close(); return true
            }}
          />
        )}
  </>

  const welcomeScreen = welcome && <WelcomeBack {...welcome} onDone={() => setWelcome(null)} />

  // One tap on their name button = checked back in from the hall (no passcode).
  const quickCheckIn = async (id: string) => {
    const name = data.allStudents.find(s => s.id === id)?.name || ''
    const res = await checkIn(data, id)
    if (res) setWelcome({ name, ...res })
  }

  if (!storeOpen || view === 'board') return <>
    <Board onTeacher={() => setPinFor('teacher')} onCheckIn={quickCheckIn}
      onOpenStore={storeOpen ? undefined : () => setPinFor('open')}
      onShowStore={storeOpen ? () => setView('store') : undefined} />
    {teacherPin}
    {studentPins}
    {welcomeScreen}
  </>

  const me = loggedIn ? data.students.find(s => s.id === loggedIn) : null
  if (me) return <StudentAccount student={me} onDone={() => setLoggedIn(null)} />

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
            <div className="row">
              <button className="btn sm ghost" onClick={() => setPinFor('teacher')}><Icon name="lock-simple" size={16} /> Teacher</button>
              <button className="btn sm" onClick={() => setPinFor('close')}><Icon name="storefront" size={16} /> Close store</button>
              <button className="btn sm" onClick={() => setView('board')}><Icon name="trophy" size={16} /> Leaderboard</button>
            </div>
            <span className="muted" style={{ fontSize: 12 }}>{data.students.length} students</span>
          </div>
        </div>
        <SidePanel onCheckIn={quickCheckIn} />
      </div>
      {data.settings.cheerKiosk && !picked && !pinFor && <Celebrations size="kiosk" />}

      {teacherPin}

      {studentPins}
      {welcomeScreen}
    </div>
  )
}

/** Dark right-hand panel: who's in the hall, this week's top 5, today's shout-outs. */
export function SidePanel({ onCheckIn }: { onCheckIn?: (studentId: string) => void } = {}) {
  const data = useData()
  const top = leaderboard(data, 'week').filter(r => r.score > 0).slice(0, 5)
  const cheers = cheersToday(data).slice(0, 8)
  return (
    <aside className="side">
      {data.hall.length > 0 && (
        <div>
          <div className="label" style={{ marginBottom: 8 }}>In the hall</div>
          {data.hall.map(h => {
            const st = passStatus(h, data.now)
            return (
              <button key={h.studentId} className={`checkin-btn side-checkin ${st.over ? 'over' : ''}`} onClick={() => onCheckIn?.(h.studentId)}>
                <Icon name="person-simple-walk" size={20} light />
                <span className="grow" style={{ textAlign: 'left' }}><b>{h.name}</b><br /><small>tap when you're back</small></span>
                <span className="mono">{st.text}</span>
              </button>
            )
          })}
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="label">Shout-outs today</div>
        {cheers.length === 0 && <div style={{ color: '#64748b', fontSize: 14 }}>Points for great work show up here.</div>}
        {cheers.map((c, i) => (
          <div key={c.key} className={`side-cheer ${i === 0 && data.now - c.ts < 10000 ? 'new' : ''}`}>
            <Icon name={c.icon} size={22} light />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="sc-name">{c.whole ? 'Whole class' : c.names.length <= 3 ? c.names.join(', ') : `${c.names.length} students`}</div>
              <div className="sc-label">{c.label}</div>
            </div>
            <span className="mono" style={{ color: '#fde68a', fontWeight: 600 }}>+{c.amount}</span>
          </div>
        ))}
      </div>
    </aside>
  )
}

/** Shown after a student signs back in from the hall. */
function WelcomeBack({ name, minutes, fined, onDone }: { name: string; minutes: number; fined: number; onDone: () => void }) {
  return (
    <div className={`screen done-screen ${fined ? 'late' : ''}`} style={{ position: 'fixed', inset: 0, zIndex: 120 }} onClick={onDone}>
      <Icon name="person-simple-walk" size={90} light />
      <div className="serif" style={{ fontSize: 44, fontWeight: 700 }}>Welcome back, {name}</div>
      <div style={{ fontSize: 26, fontWeight: 600 }}>You were out {minutes} min</div>
      {fined > 0 && <div style={{ fontSize: 22 }}>Late return: −{fined} credits</div>}
      <Toast onDone={onDone} ms={5000}><span>Checked back in</span></Toast>
    </div>
  )
}
