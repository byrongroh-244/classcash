import { useState } from 'react'
import { useData } from '../lib/data'
import { DemoBanner, useIdle, Icon } from '../components/ui'
import Dashboard from './teacher/Dashboard'
import Daily from './teacher/Daily'
import Students from './teacher/Students'
import StoreEditor from './teacher/StoreEditor'
import SettingsPage from './teacher/SettingsPage'

const TABS = [
  ['dash', 'Dashboard'],
  ['daily', 'Daily check-off'],
  ['students', 'Students'],
  ['store', 'Store & earning'],
  ['settings', 'Settings'],
] as const
type Tab = typeof TABS[number][0]

export default function Teacher({ onLock }: { onLock: () => void }) {
  const data = useData()
  const [tab, setTab] = useState<Tab>('dash')
  // Locks itself if the iPad is left in teacher mode.
  useIdle(data.settings.teacherTimeoutMin * 60, onLock)

  return (
    <div className="screen">
      <DemoBanner />
      <div className="topbar" style={{ gap: 16 }}>
        <h1 style={{ fontSize: 20 }}>Teacher</h1>
        <div className="tabs scroll" style={{ overflowX: 'auto' }}>
          {TABS.map(([k, label]) => (
            <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>
        <div className="grow" />
        <button className="btn dark" style={{ whiteSpace: 'nowrap' }} onClick={onLock}><Icon name="lock-simple" size={18} light /> Lock</button>
      </div>
      {tab === 'dash' && <Dashboard />}
      {tab === 'daily' && <Daily />}
      {tab === 'students' && <Students />}
      {tab === 'store' && <StoreEditor />}
      {tab === 'settings' && <SettingsPage />}
    </div>
  )
}
