import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// Opened from the iPad home screen? Then the status bar sits over the page — styles.css makes room for it.
const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  || window.matchMedia('(display-mode: standalone)').matches
if (standalone) document.documentElement.classList.add('standalone')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
