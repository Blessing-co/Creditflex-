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
| `extras.js` | Guided tour, How it works, analytics, settings, credit page, offline queue (built copy, do not edit) |
| `sw.js` | Service worker that lets the app open and save payments with no internet |
| `build/src/` | **The source files you edit**: `index.html`, `app.js`, `extras.js` |
| `build/` | Build tools: `build.js`, Tailwind config (`tailwind.config.js`, `input.css`), `test.js` |
| `supabase/` | The database blueprint (SQL). See `supabase/README.md` |

## Changing the app

1. Edit the files in `build/src/` (colours and fonts are in `build/tailwind.config.js`).
2. Build and test:
   ```
   cd build
   npm install        # first time only
   node build.js      # writes index.html, styles.css, app.js, extras.js to the repo root
   node test.js       # runs the app in a headless browser against a fake database
   ```
3. Commit and push. Vercel publishes it in about a minute.

Any new Material icon used with `ic("name")` must also be added to the `icons` list in `build/build.js`; the build stops and tells you if one is missing.

No `.env` file is needed. The only key in the code is Supabase's public key.
