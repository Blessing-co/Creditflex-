# Creditflex Agents

Mobile web app for Creditflex field agents: record instalment payments, register customers, see customer statements, browse the product catalogue. Admins see collections, money owed, manage staff, cancel wrong payments and export data.

- Plain HTML, CSS and JavaScript (no framework), Supabase backend
- Hosting: Vercel (project `creditflex-agents`), deploys automatically when `main` is pushed
- Backend: Supabase project "Trial" (login, Postgres with row level security, photo storage)
- The Supabase key in the code is the public (publishable) key. It is safe to publish; the data is protected by the security rules in `supabase/`.

## What is where

| Path | What it is |
| --- | --- |
| `index.html` | The page that loads everything (built file, do not edit) |
| `styles.css` | All the styling (built file, do not edit) |
| `app.js` | Core app: login, menu, collections, payments, customers, catalogue, staff (built copy, do not edit) |
| `vendor/supabase.js` | The Supabase library, served from this repo with an exact pinned version (set in `build/package.json`) instead of a public CDN. `node build.js` copies it here. |
| `sw.js` | Service worker that lets the app open and save payments with no internet |
| `manifest.webmanifest`, `icons/` | Makes the app installable on a phone's home screen (icons are drawn by `build/make-icons.js` from `build/icon.svg`) |
| `build/src/` | **The source files you edit** (see "How the code is organised" below) |
| `build/` | Build tools: `build.js`, Tailwind config (`tailwind.config.js`, `input.css`), `test.js` |
| `supabase/` | The database blueprint (SQL). See `supabase/README.md` |

## Changing the app

1. Edit the files in `build/src/` (colours and fonts are in `build/tailwind.config.js`).
2. Build and test:
   ```
   cd build
   npm install        # first time only
   node build.js      # joins the source files into app.js and writes index.html, styles.css, app.js to the repo root
   node test.js       # runs the app in a headless browser against a fake database
   ```
3. Commit and push. Vercel publishes it in about a minute.

Any new Material icon used with `ic("name")` must also be added to the `icons` list in `build/build.js`; the build stops and tells you if one is missing.

No `.env` file is needed. The only key in the code is Supabase's public key.

## Notes (offline, menu, dates)
- Menu: 7 tabs (agent), 8 with Manage (admin). Help, Manage and Settings hold the rest (see `HUBS`/`PARENT` in app.js).
- Payment dates: agents always record today (database enforces a small window, admins can correct). 
- Offline: shell is cached by `sw.js` (stale-while-revalidate); lists are cached by `cfRead` in models/data.js; payments and new customers queue in IndexedDB and sync when online.
- CSV exports include "Paid so far" and "Balance after this payment" (`cfRunning` in app.js).


## How the code is organised (MVC with a route table)
Everything you edit lives in `build/src/`. `node build.js` joins the files, in the order listed in `build/build.js` (`ORDER`), into the single `app.js` the phone loads.

```
build/src/
  index.html          page shell
  main.js             starts the app
  routes.js           ROUTES: the table of pages (like Flask's URL rules) + go(), goBack(), phone Back-button handling
  core/               config, network layer, Supabase client, shared state, small UI helpers, password rules, PWA plumbing
  models/             data: paging/cache reads (data.js), running balance (ledger.js), phone storage + offline queue (offline.js)
  views/              page frame/menu (shell.js), hub lists (hub.js), sign-in screens (auth.js)
  controllers/        one file per page: collections, pay, customers, catalogue, staff, analytics, settings, account,
                      financial, export, credit, learn, tour, bulk, notices, legal, lock (PIN/fingerprint)
```
- **Add a page:** write `controllers/mypage.js` with a `viewMyPage()` function, add its path to `ORDER` in build.js, and add one line to `ROUTES` in routes.js. The build stops with a clear message if a source file is not listed.
- **Open a page from code:** `go("pay")`. The Back button and the on-screen Back bar follow `ROUTES[...].parent` and the browser history.
- Database queries are still written inside the controllers (the models folder holds the offline and data-reading code). Moving every query into model files is the next tidy-up.
