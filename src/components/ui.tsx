import { useEffect, useRef, useState } from 'react'
import { db, resetDemo } from '../lib/db'

/**
 * Icons are PNGs from Phosphor Icons (MIT license, phosphoricons.com), duotone
 * style, rendered into public/icons/. To add one: render it the same way and
 * add its name to PICKABLE_ICONS (or UI_ICONS).
 */
export const PICKABLE_ICONS = [
  'clock', 'plug-charging', 'note-pencil', 'hand-palm', 'star', 'confetti', 'books', 'exam',
  'book-open', 'pencil', 'calculator', 'student', 'graduation-cap', 'chalkboard-teacher', 'users-three', 'seal-check',
  'thumbs-up', 'heart', 'smiley', 'medal', 'trophy', 'crown', 'lightning', 'sparkle',
  'rocket', 'target', 'flag', 'bell', 'timer', 'toilet', 'person-simple-walk', 'storefront',
  'armchair', 'headphones', 'music-notes', 'scissors', 'game-controller', 'desktop', 'laptop', 'device-mobile',
  'television', 'basketball', 'soccer-ball', 'football', 'sneaker', 'film-slate', 'popcorn', 'hamburger',
  'pizza', 'ice-cream', 'coffee', 'bus', 'ticket', 'gift', 'paint-brush', 'puzzle-piece',
  'backpack', 'coins', 'piggy-bank', 'hand-coins',
]
const UI_ICONS = ['lock-simple', 'shopping-cart-simple', 'backspace', 'check', 'arrow-counter-clockwise', 'x', 'plus', 'minus', 'sign-out', 'warning', 'dots-six-vertical', 'sort-ascending']
const KNOWN = new Set([...PICKABLE_ICONS, ...UI_ICONS])

export function Icon({ name, size = 22, light, style, className = '' }: {
  name: string; size?: number; light?: boolean; style?: React.CSSProperties; className?: string
}) {
  const n = KNOWN.has(name) ? name : 'star'
  return (
    <img src={`${import.meta.env.BASE_URL}icons/${n}.png`} width={size} height={size} alt="" draggable={false}
      className={`ic ${light ? 'light' : ''} ${className}`} style={style} />
  )
}

/** "12 ¢" style amount with a gold coin. */
export function Amt({ n, sign, className = '' }: { n: number; sign?: boolean; className?: string }) {
  const txt = sign && n > 0 ? `+${n}` : String(n)
  return <span className={`amt ${className}`}>{txt}<span className="coin" /></span>
}

export function Overlay({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div className="overlay" onPointerDown={e => { if (e.target === e.currentTarget) onClose?.() }}>
      {children}
    </div>
  )
}

export function DemoBanner() {
  if (!db.demo) return null
  return (
    <div className="demo-banner">
      Demo mode — practice data saved only on this device. Teacher PIN: 0000
      <button onClick={() => { if (confirm('Erase all demo data and start over?')) resetDemo() }}>Reset demo</button>
    </div>
  )
}

/**
 * Big on-screen number pad (no iPad keyboard popping up).
 * onComplete returns true if the code was accepted, false to shake and clear.
 */
export function PinPad({ title, subtitle, onComplete, onCancel, length = 4 }: {
  title: string
  subtitle?: React.ReactNode
  onComplete: (code: string) => boolean | Promise<boolean>
  onCancel: () => void
  length?: number
}) {
  const [code, setCode] = useState('')
  const [err, setErr] = useState(false)
  const busy = useRef(false)

  const press = async (d: string) => {
    if (busy.current) return
    setErr(false)
    const next = (code + d).slice(0, length)
    setCode(next)
    if (next.length === length) {
      busy.current = true
      const ok = await onComplete(next)
      busy.current = false
      if (!ok) { setErr(true); setTimeout(() => setCode(''), 350) }
    }
  }

  return (
    <Overlay onClose={onCancel}>
      <div className="modal" style={{ maxWidth: 360 }}>
        <h2>{title}</h2>
        {subtitle && <div className="slate" style={{ fontSize: 15 }}>{subtitle}</div>}
        <div className={`pin-dots ${err ? 'err shake' : ''}`}>
          {Array.from({ length }, (_, i) => <div key={i} className={`pin-dot ${i < code.length ? 'on' : ''}`} />)}
        </div>
        <div className="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
            <button key={d} className="key" onClick={() => press(d)}>{d}</button>
          ))}
          <button className="key fn" onClick={onCancel}>Cancel</button>
          <button className="key" onClick={() => press('0')}>0</button>
          <button className="key fn" onClick={() => { setCode(c => c.slice(0, -1)); setErr(false) }}><Icon name="backspace" size={30} /></button>
        </div>
      </div>
    </Overlay>
  )
}

/** Calls onIdle after `seconds` with no taps. Returns seconds left. */
export function useIdle(seconds: number, onIdle: () => void, enabled = true) {
  const [left, setLeft] = useState(seconds)
  const last = useRef(Date.now())
  const cb = useRef(onIdle)
  cb.current = onIdle
  useEffect(() => {
    if (!enabled) return
    last.current = Date.now()
    setLeft(seconds)
    const bump = () => { last.current = Date.now(); setLeft(seconds) }
    const evs = ['pointerdown', 'keydown', 'scroll', 'touchstart']
    evs.forEach(e => window.addEventListener(e, bump, { capture: true, passive: true }))
    const id = setInterval(() => {
      const l = seconds - Math.floor((Date.now() - last.current) / 1000)
      setLeft(l)
      if (l <= 0) cb.current()
    }, 500)
    return () => { clearInterval(id); evs.forEach(e => window.removeEventListener(e, bump, { capture: true })) }
  }, [seconds, enabled])
  return left
}

export function Toast({ children, onDone, ms = 6000 }: { children: React.ReactNode; onDone: () => void; ms?: number }) {
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => { const id = setTimeout(() => done.current(), ms); return () => clearTimeout(id) }, [ms])
  return <div className="toast">{children}</div>
}

/**
 * Press-and-drag reordering for table rows (works with touch on the iPad).
 *   const drag = useRowDrag((from, to) => moveRow(...))
 *   <tr {...drag.row(i)}> … <DragGrip onPointerDown={drag.grip(i)} /> … </tr>
 * While dragging, the row follows the finger and the others slide out of the way.
 */
export function useRowDrag(onDrop: (from: number, to: number) => void) {
  const rows = useRef<(HTMLElement | null)[]>([])
  const [drag, setDrag] = useState<{ from: number; to: number; dy: number; h: number } | null>(null)
  const drop = useRef(onDrop)
  drop.current = onDrop

  const grip = (index: number) => (e: React.PointerEvent) => {
    e.preventDefault()
    const el = rows.current[index]
    const box = (el?.closest('.scroll') as HTMLElement | null) || document.documentElement
    const scroll0 = box.scrollTop
    // Row positions in the list's own coordinates, so scrolling mid-drag doesn't throw them off.
    const spans = rows.current.map(r => { const b = r?.getBoundingClientRect(); return b ? { top: b.top + scroll0, h: b.height } : null })
    const h = spans[index]?.h || 0
    const startY = e.clientY + scroll0
    let lastY = e.clientY, to = index, raf = 0
    const update = () => {
      const y = lastY + box.scrollTop
      to = index
      spans.forEach((r, i) => {
        if (!r) return
        const mid = r.top + r.h / 2
        if (i < index && y < mid) to = Math.min(to, i)
        if (i > index && y > mid) to = Math.max(to, i)
      })
      setDrag({ from: index, to, dy: y - startY, h })
    }
    // Scroll the list when the finger is near its top or bottom edge.
    const tick = () => {
      const b = box.getBoundingClientRect()
      const top = Math.max(b.top, 0), bottom = Math.min(b.bottom, window.innerHeight)
      const step = lastY < top + 70 ? -10 : lastY > bottom - 70 ? 10 : 0
      if (step) { box.scrollTop += step; update() }
      raf = requestAnimationFrame(tick)
    }
    const move = (ev: PointerEvent) => { lastY = ev.clientY; update() }
    const up = () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      setDrag(null)
      if (to !== index) drop.current(index, to)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    raf = requestAnimationFrame(tick)
    setDrag({ from: index, to: index, dy: 0, h })
  }

  const row = (i: number) => {
    let style: React.CSSProperties | undefined
    if (drag) {
      if (i === drag.from) style = { transform: `translateY(${drag.dy}px)`, position: 'relative', zIndex: 5, background: 'var(--white)', boxShadow: '0 8px 24px rgba(15,23,42,.18)' }
      else if (drag.from < drag.to && i > drag.from && i <= drag.to) style = { transform: `translateY(${-drag.h}px)`, transition: 'transform .15s' }
      else if (drag.from > drag.to && i >= drag.to && i < drag.from) style = { transform: `translateY(${drag.h}px)`, transition: 'transform .15s' }
      else style = { transition: 'transform .15s' }
    }
    return { ref: (el: HTMLElement | null) => { rows.current[i] = el }, style, className: drag?.from === i ? 'dragging' : undefined }
  }
  return { grip, row, active: !!drag }
}

export function DragGrip({ onPointerDown }: { onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <span className="grip" title="Drag to reorder" onPointerDown={onPointerDown}>
      <Icon name="dots-six-vertical" size={18} />
    </span>
  )
}
