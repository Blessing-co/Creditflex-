# Creditflex Agents

Mobile web app for Creditflex field agents: record installment payments, register customers, browse the product catalogue. Admins see collections, money owed and manage staff.

- Single file: `index.html` (vanilla JS, Tailwind CSS inlined, Supabase backend)
- Hosting: Vercel (project `creditflex-agents`)
- Backend: Supabase project "Trial" (auth, Postgres with RLS, storage bucket `product-images`)
- The Supabase key in the file is the public (publishable) key. It is safe to publish; data is protected by RLS.
