import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { DataProvider } from './lib/data'
import Kiosk from './pages/Kiosk'
import Board from './pages/Board'

export default function App() {
  return (
    <DataProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Routes>
          {/* iPad: student kiosk + teacher mode (PIN) on one page */}
          <Route path="/" element={<Kiosk />} />
          {/* Projector / TV: read-only leaderboard */}
          <Route path="/board" element={<Board />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </DataProvider>
  )
}
