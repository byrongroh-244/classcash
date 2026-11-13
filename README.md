# Class Bank

A classroom economy for one class, run from an iPad at the front of the room.
Students earn credits for daily routines and good behavior, then spend them on
privileges (hall passes, music, preferred seat…) or chip in toward class goals
(movie day, field trip).

Built the same way as Hall Pass: React + TypeScript + Vite, deployed to
GitHub Pages by GitHub Actions, backed by a Firebase Realtime Database.

## Pages

| URL | What it's for |
|---|---|
| `/` | **The iPad.** Students tap their name → passcode → their account and the store. The 🔒 Teacher button (PIN) opens teacher mode on the same page. |
| `/board` | **Projector / TV.** Full-screen leaderboard (this week + all time), class goal jars, and who's in the hall. No buttons. |

### Teacher mode tabs

- **Dashboard** — tap students to select (or *Select all*), then tap a reason. Whole-class bonus works with nobody selected. Custom bonus, Fine, and a no-charge bathroom *Free pass*. Right side shows who's in the hall (with a *Back* button) and today's activity — every row has ↶ undo.
- **Daily check-off** — everyone starts checked; uncheck whoever missed something (or tap *Absent*), then *Pay daily credits*. You can come back and change boxes later; *Update* pays or takes back only the difference. Each daily item pays at most once per student per day.
- **Students** — add your roster (paste first names, one per line), rename, see full history with undo, reset a forgotten passcode, remove/restore.
- **Store & earning** — edit every amount, price, limit (per day / per week), hall timer, and class goal. Changes save when you leave a field.
- **Settings** — class title, currency name, auto sign-out timers, max students in the hall, **teacher PIN** (default `0000` — change it), link to `/board`, and new-semester reset.

### How the money works

- Every change is a transaction record **plus** the balance change, written together, so history and balances can't drift apart. Undo writes a reversing transaction (nothing is ever deleted).
- **Balance** = what a student can spend. **Earned** = lifetime credits earned minus fines. Spending does *not* lower Earned, so the leaderboard rewards earning, not hoarding.
- Purchases use a database transaction, so a double tap can't charge twice or overdraw.
- Students create their own 4-digit passcode the first time they tap their name.

## Setup (about 15 minutes)

### 1. Create the Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Create a project** → name it (e.g. `classbank`) → you can turn Google Analytics **off** → Create.
2. Left menu → **Build → Realtime Database** → **Create Database** → pick a location (United States is fine) → choose **Start in test mode** → Enable.
3. Open the **Rules** tab, replace everything with the contents of `database.rules.json` from this repo, and click **Publish**.
   (These rules are open like Hall Pass's — PINs lock the screens, not the database — and add an index the app needs for fast history lookups.)
4. Click the ⚙️ gear next to *Project Overview* → **Project settings** → scroll to **Your apps** → click the **`</>`** (Web) icon → give it a nickname → **Register app**. Don't set up Hosting. You'll see a `firebaseConfig = { … }` block — keep that tab open for step 2.

### 2. Add the secrets to GitHub

In this repo → **Settings → Secrets and variables → Actions → New repository secret**, add one secret per value from `firebaseConfig`:

| Secret name | From firebaseConfig |
|---|---|
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_DATABASE_URL` | `databaseURL` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

> If `databaseURL` isn't in the config block, copy it from the top of the Realtime Database page (it looks like `https://classbank-xxxx-default-rtdb.firebaseio.com`).

### 3. Turn on GitHub Pages

Repo → **Settings → Pages** → *Build and deployment* → Source: **GitHub Actions**.

Then **Actions** tab → *Deploy to GitHub Pages* → **Run workflow** (or just push to `main`). When it's green, the app is at
`https://<your-github-username>.github.io/<repo-name>/`.

### 4. First run

1. Open the site → 🔒 **Teacher** → PIN `0000`.
2. **Settings** → change the PIN and the class title.
3. **Students** → paste your roster.
4. On the iPad: open the site in Safari → Share → **Add to Home Screen**. Open it from the home-screen icon (full screen, no Safari bar). For a locked-down kiosk, turn on **Guided Access** (Settings → Accessibility) and triple-click to start it.

The first time the app connects to an empty database it fills in the starting earn rules, store items and class goals. Edit them any time under **Store & earning**.

## Running it locally

```bash
npm install
npm run dev
```

With no `.env` file it runs in **demo mode**: data is stored only in that browser, with 15 practice students (Ava, Ben, Carlos…). A yellow bar at the top says so, with a *Reset demo* link. To point a local copy at the real database, copy `env.example` to `.env` and fill it in.

## Icons

All icons are PNGs from [Phosphor Icons](https://phosphoricons.com) (MIT license, see `public/icons/LICENSE-phosphor.txt`): duotone style for store items and earn reasons, bold style for buttons. Teachers pick an icon for any item from a grid in **Store & earning**. To add more choices, render another Phosphor icon to `public/icons/<name>.png` (128×128, color `#1e293b`) and add the name to `PICKABLE_ICONS` in `src/components/ui.tsx`.

## Files

```
src/lib/db.ts          Firebase or demo-mode database (one interface for both)
src/lib/data.tsx       Live data shared by every screen; leaderboard math
src/lib/actions.ts     Every write: award, daily, buy, donate, undo, reset
src/data/defaults.ts   Starting rules, store, goals and settings
src/pages/Kiosk.tsx    iPad home: name grid, passcodes, side panel
src/pages/StudentAccount.tsx   Balance, store, goals, history
src/pages/Teacher.tsx  Teacher mode shell + tabs in src/pages/teacher/
src/pages/Board.tsx    Projector leaderboard
```
