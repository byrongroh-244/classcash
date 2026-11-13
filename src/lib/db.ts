/**
 * Tiny database layer.
 *
 * Everything in the app reads and writes through this one object, so the app
 * runs against either:
 *   - Firebase Realtime Database (when VITE_FIREBASE_DATABASE_URL is set), or
 *   - a demo database kept in this browser's localStorage (when it isn't).
 *
 * Demo mode is what you get running locally with no .env file — handy for
 * trying things out without touching the real class data.
 */
import { initializeApp } from 'firebase/app'
import {
  getDatabase, ref, onValue, update as fbUpdate, get as fbGet, push,
  runTransaction, increment, query as fbQuery, orderByChild, equalTo as fbEqualTo,
  startAt as fbStartAt, limitToLast as fbLimitToLast, type Query as FbQuery,
} from 'firebase/database'

/** Use inside update() to add to a number instead of overwriting it. */
export interface Inc { __inc: number }
export const INC = (n: number): Inc => ({ __inc: n })
const isInc = (v: unknown): v is Inc => typeof v === 'object' && v !== null && '__inc' in v

export interface Query {
  child: string
  equalTo?: string
  startAt?: string
  limitToLast?: number
}

export interface DB {
  demo: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listen(path: string, cb: (value: any) => void, q?: Query): () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(path: string): Promise<any>
  /** Multi-path update, all-or-nothing. Set a path to null to delete it. */
  update(updates: Record<string, unknown>): Promise<void>
  /** Return undefined from fn to abort. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transaction(path: string, fn: (current: any) => any): Promise<{ committed: boolean; value: any }>
  newKey(): string
}

// ─── Firebase ────────────────────────────────────────────────────────────────

function firebaseDB(): DB {
  const app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  })
  const db = getDatabase(app)

  return {
    demo: false,
    listen(path, cb, q) {
      let target: FbQuery = ref(db, path)
      if (q) {
        const parts = [orderByChild(q.child)]
        if (q.equalTo !== undefined) parts.push(fbEqualTo(q.equalTo))
        if (q.startAt !== undefined) parts.push(fbStartAt(q.startAt))
        if (q.limitToLast !== undefined) parts.push(fbLimitToLast(q.limitToLast))
        target = fbQuery(ref(db, path), ...parts)
      }
      return onValue(target, snap => cb(snap.val()))
    },
    async get(path) {
      return (await fbGet(ref(db, path))).val()
    },
    async update(updates) {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(updates)) out[k] = isInc(v) ? increment(v.__inc) : v
      await fbUpdate(ref(db), out)
    },
    async transaction(path, fn) {
      const res = await runTransaction(ref(db, path), fn)
      return { committed: res.committed, value: res.snapshot.val() }
    },
    newKey() {
      return push(ref(db, 'tx')).key as string
    },
  }
}

// ─── Demo (localStorage) ─────────────────────────────────────────────────────

const LS_KEY = 'classbank_demo_v1'

function demoDB(): DB {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let root: any = {}
  try { root = JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { root = {} }
  const listeners = new Set<() => void>()

  const split = (p: string) => p.split('/').filter(Boolean)
  const read = (p: string) => {
    let node = root
    for (const k of split(p)) { if (node == null) return null; node = node[k] }
    return node === undefined ? null : node
  }
  const write = (p: string, v: unknown) => {
    const keys = split(p)
    let node = root
    for (let i = 0; i < keys.length - 1; i++) {
      if (typeof node[keys[i]] !== 'object' || node[keys[i]] === null) node[keys[i]] = {}
      node = node[keys[i]]
    }
    const last = keys[keys.length - 1]
    if (v === null || v === undefined) delete node[last]
    else node[last] = v
  }
  const clone = <T,>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)))
  const changed = () => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(root)) } catch { /* full */ }
    // Notify asynchronously, like Firebase does.
    setTimeout(() => listeners.forEach(l => l()), 0)
  }
  // Another tab (e.g. the /board page) changed the data.
  window.addEventListener('storage', e => {
    if (e.key !== LS_KEY) return
    try { root = JSON.parse(e.newValue || '{}') } catch { return }
    listeners.forEach(l => l())
  })

  const runQuery = (path: string, q?: Query) => {
    const v = read(path)
    if (!q || v == null || typeof v !== 'object') return clone(v)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let entries = Object.entries(v as Record<string, any>)
    if (q.equalTo !== undefined) entries = entries.filter(([, e]) => e?.[q.child] === q.equalTo)
    if (q.startAt !== undefined) entries = entries.filter(([, e]) => (e?.[q.child] ?? '') >= q.startAt!)
    entries.sort(([ka, a], [kb, b]) => String(a?.[q.child]).localeCompare(String(b?.[q.child])) || ka.localeCompare(kb))
    if (q.limitToLast !== undefined) entries = entries.slice(-q.limitToLast)
    return entries.length ? clone(Object.fromEntries(entries)) : null
  }

  let counter = 0
  return {
    demo: true,
    listen(path, cb, q) {
      const fire = () => cb(runQuery(path, q))
      listeners.add(fire)
      setTimeout(fire, 0)
      return () => { listeners.delete(fire) }
    },
    async get(path) { return clone(read(path)) },
    async update(updates) {
      for (const [k, v] of Object.entries(updates)) {
        if (isInc(v)) write(k, (Number(read(k)) || 0) + v.__inc)
        else write(k, clone(v))
      }
      changed()
    },
    async transaction(path, fn) {
      const next = fn(clone(read(path)))
      if (next === undefined) return { committed: false, value: read(path) }
      write(path, clone(next))
      changed()
      return { committed: true, value: clone(next) }
    },
    newKey() {
      counter = (counter + 1) % 1000
      return Date.now().toString(36) + counter.toString(36).padStart(2, '0') + Math.random().toString(36).slice(2, 6)
    },
  }
}

export const db: DB = import.meta.env.VITE_FIREBASE_DATABASE_URL ? firebaseDB() : demoDB()

/** Wipe the demo database (demo mode only). */
export function resetDemo() {
  try { localStorage.removeItem(LS_KEY) } catch { /* ignore */ }
  location.reload()
}
