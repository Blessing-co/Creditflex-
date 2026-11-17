# Creditflex Agents

Mobile web app for Creditflex field agents: record installment payments, register customers, browse the product catalogue. Admins see collections, money owed and manage staff.

- Single file: `index.html` (vanilla JS, Tailwind CSS inlined, Supabase backend)
- Hosting: Vercel (project `creditflex-agents`)
- Backend: Supabase project "Trial" (auth, Postgres with RLS, storage bucket `product-images`)
- The Supabase key in the file is the public (publishable) key. It is safe to publish; data is protected by RLS.

## How it is built
- `index.html` (repo root) is the finished app that gets hosted. Do not edit it by hand.
- Edit `build/src.html` (the app code), `build/tailwind.config.js` (colours, fonts) and `build/input.css`, then run:
  ```
  cd build && npm install && node build.js
  ```
  This compiles Tailwind and writes the finished `../index.html`.
- `build/test.js` runs the app in a headless browser with a fake Supabase to check the screens.
- No `.env` file is needed. The only key in the code is Supabase's public key.


## Database

The database blueprint (tables, rules, security policies) is in the `supabase/` folder. See `supabase/README.md`.
