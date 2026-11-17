/**
 * What a brand-new database starts with. Everything here can be edited later
 * from Teacher mode → Store & Earning / Settings.
 */
import type { Settings, EarnRule, StoreItem } from '../lib/types'

export const DEFAULT_SETTINGS: Settings = {
  pin: '0000',
  className: 'Class Bank',
  currency: 'credits',
  logoutSeconds: 30,
  maxInHall: 1,
  teacherTimeoutMin: 5,
  cheerBoard: true,
  cheerKiosk: true,
  storeOpen: true,
  masterPin: '',
  hallFineOn: false,
  hallFineAfterMin: 10,
  hallFineAmount: 5,
  boardShoutouts: true,
  boardWeek: true,
  boardAllTime: true,
  boardBuyIns: true,
  buyIns: true,
}

type NoId<T> = Omit<T, 'id'>

export const DEFAULT_RULES: Record<string, NoId<EarnRule>> = {
  r_ontime:   { label: 'On time with materials', amount: 1, kind: 'daily', icon: 'clock', order: 1 },
  r_phone:    { label: 'Phone on charger',       amount: 1, kind: 'daily', icon: 'plug-charging', order: 2 },
  r_hw:       { label: 'Homework submitted',     amount: 2, kind: 'daily', icon: 'note-pencil', order: 3 },
  r_part:     { label: 'Participation',          amount: 1, kind: 'daily', icon: 'hand-palm', order: 4 },
  r_behavior: { label: 'Positive behavior',      amount: 2, kind: 'incident', icon: 'star', order: 5 },
  r_class:    { label: 'Whole-class bonus',      amount: 2, kind: 'incident', icon: 'confetti', order: 6, wholeClass: true },
  r_interv:   { label: 'Intervention block',     amount: 3, kind: 'incident', icon: 'books', order: 7 },
}

export const DEFAULT_ITEMS: Record<string, NoId<StoreItem>> = {
  i_hall5:  { label: '5-min hall pass',      price: 3,  tier: 'everyday', icon: 'toilet', limitCount: 2, limitPeriod: 'day', hallMinutes: 5, active: true, order: 1 },
  i_seat:   { label: 'Preferred seat',       price: 8,  tier: 'everyday', icon: 'armchair', limitCount: 1, limitPeriod: 'day', active: true, order: 2 },
  i_music:  { label: 'Listen to music',      price: 8,  tier: 'everyday', icon: 'headphones', limitCount: 1, limitPeriod: 'day', active: true, order: 3 },
  i_deca:   { label: '10-min DECA store pass', price: 10, tier: 'everyday', icon: 'storefront', limitCount: 1, limitPeriod: 'day', hallMinutes: 10, active: true, order: 4 },
  i_halfhw: { label: 'Only half homework',   price: 20, tier: 'everyday', icon: 'scissors', limitCount: 1, limitPeriod: 'week', active: true, order: 5 },
  i_gym:    { label: 'Gym access',           price: 50, tier: 'saver',    icon: 'basketball', active: true, order: 6 },
  i_movie:  { label: 'Movie day',            price: 30, tier: 'saver',    icon: 'popcorn', active: true, order: 7 },
  i_wendys: { label: "Field trip to Wendy's", price: 40, tier: 'saver',   icon: 'hamburger', active: true, order: 8 },
}


/** Practice roster for demo mode only. */
export const DEMO_NAMES = [
  'Ava', 'Ben', 'Carlos', 'Dani', 'Eli', 'Fatima', 'Grace', 'Hunter',
  'Isla', 'Jayden', 'Kai', 'Lena', 'Mason', 'Nora', 'Owen',
]
