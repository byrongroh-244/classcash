const pad = (n: number) => String(n).padStart(2, '0')

/** Local-time YYYY-MM-DD (the iPad's clock, not UTC). */
export function dateStr(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** YYYY-MM-DD of the Monday of the week containing d. */
export function weekStartStr(d = new Date()): string {
  const m = new Date(d)
  const day = (m.getDay() + 6) % 7 // Mon = 0
  m.setDate(m.getDate() - day)
  return dateStr(m)
}

export function timeStr(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function shortDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

export function mmss(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${pad(s % 60)}`
}
