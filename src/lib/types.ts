export interface Settings {
  pin: string
  className: string
  /** Plural name of the currency, e.g. "credits" or "Groh Bucks". */
  currency: string
  /** Seconds of no taps before a student is logged out of the kiosk. */
  logoutSeconds: number
  /** How many students may be out on a purchased hall pass at once. */
  maxInHall: number
  /** Minutes of no taps before teacher mode locks itself. */
  teacherTimeoutMin: number
}

export interface Student {
  id: string
  name: string
  /** 4 digits; empty until the student creates one on first login. */
  passcode?: string
  balance: number
  /** Lifetime credits earned (minus fines). Spending doesn't lower it — drives the leaderboard. */
  earned: number
  active: boolean
  createdAt: number
}

export interface EarnRule {
  id: string
  label: string
  amount: number
  /** daily = paid from the Daily check-off screen, once per student per day. */
  kind: 'daily' | 'incident'
  /** Shows as a one-tap "everyone" button on the dashboard. */
  wholeClass?: boolean
  icon: string
  order: number
}

export interface StoreItem {
  id: string
  label: string
  price: number
  tier: 'everyday' | 'saver'
  icon: string
  /** e.g. 2 per day; 0/undefined = unlimited. */
  limitCount?: number
  limitPeriod?: 'day' | 'week'
  /** If set, buying this starts a hall pass timer of this many minutes. */
  hallMinutes?: number
  active: boolean
  order: number
}

export interface Goal {
  id: string
  label: string
  target: number
  saved: number
  icon: string
  active: boolean
  order: number
}

export type TxKind =
  | 'daily' | 'earn' | 'bonus' | 'fine'   // teacher gives / takes
  | 'spend' | 'donate'                    // student
  | 'free'                                // free hall pass (0 credits)
  | 'reverse' | 'reset'

export interface Tx {
  id: string
  studentId: string
  studentName: string
  /** Change to the student's balance. */
  amount: number
  /** Change to the student's lifetime "earned" (leaderboard) total. */
  earnDelta: number
  kind: TxKind
  label: string
  /** Rule / item / goal id this came from. */
  refId?: string
  date: string // YYYY-MM-DD, local time
  ts: number
  by: 'teacher' | 'student'
  /** Teacher actions done together (e.g. one tap for 5 students) share a batch id. */
  batch?: string
  undone?: boolean
  /** This purchase started a hall pass (undoing it ends the pass). */
  hall?: boolean
  /** On a 'reverse' tx: the id of the tx it reverses. */
  reverses?: string
}

export interface HallPass {
  studentId: string
  name: string
  label: string
  start: number
  minutes: number
}
