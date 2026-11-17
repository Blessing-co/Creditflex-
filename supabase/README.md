# Creditflex database (Supabase)

This folder is the **blueprint of the database**. The live data (customers, payments)
is not in here, only the structure and the rules. Use it to rebuild the database,
or to see exactly how the money rules work.

## Files (run in this order)

| File | What it holds |
| --- | --- |
| `01_tables.sql` | Tables, indexes, and the `purchase_ledger` view |
| `02_functions.sql` | Business rules: no overpaying, no editing or deleting payments, cancel-with-reason, audit trail, duplicate check, new sign-ups become *pending* agents |
| `03_policies.sql` | Row level security: who can see and change what |
| `04_grants_storage_seed.sql` | Who may call which function, the product photo bucket, the 2 starter payment plans |

## Rebuild on a new Supabase project

1. Create a new Supabase project.
2. Open **SQL Editor**, paste each file in order, press **Run**.
3. Under **Authentication → Providers → Email**, turn **Confirm email** off if you
   want agents to log in without confirming (and set the minimum password length to 8).
4. In **Authentication → URL Configuration**, set the Site URL to your Vercel link.
5. In `index.html` / `build/src.html`, replace the Supabase URL and publishable key
   with the new project's.
6. Sign up the first account in the app, then make it admin by running:

```sql
update public.staff set role = 'admin', status = 'active'
where email = 'your-email@example.com';
```

## Important

* A rebuild does **not** bring back customers or payments. For that, use
  **Export data** in the app (admin menu) every week and keep the CSV files.
* Never put the `service_role` key in the app or in this repo.
* After you change the database in Supabase, update these files too so the repo
  stays a true copy.
