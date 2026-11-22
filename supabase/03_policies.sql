-- Creditflex Agents: row level security policies (who can see and change what).
-- Run after 02_functions.sql.
-- Rules in short: admin sees and edits everything; an agent sees only their own
-- customers, purchases and payments; a supervisor also sees their agents'.

-- customers
create policy customers_delete on public.customers as permissive for delete to authenticated
  using (private.is_admin());
create policy customers_insert on public.customers as permissive for insert to authenticated
  with check (private.is_admin() or ((registered_by = (select auth.uid())) and private.is_active_staff()));
create policy customers_select on public.customers as permissive for select to authenticated
  using (private.can_see_agent(registered_by));
create policy customers_update on public.customers as permissive for update to authenticated
  using (private.is_admin() or ((registered_by = (select auth.uid())) and private.is_active_staff()))
  with check (private.is_admin() or ((registered_by = (select auth.uid())) and private.is_active_staff()));

-- audit log (read-only, admin)
create policy payment_audit_admin_select on public.payment_audit_log as permissive for select to authenticated
  using (private.is_admin());

-- payment plans
create policy plans_delete on public.payment_plans as permissive for delete to authenticated
  using (private.is_admin());
create policy plans_insert on public.payment_plans as permissive for insert to authenticated
  with check (private.is_admin());
create policy plans_select on public.payment_plans as permissive for select to authenticated
  using (private.is_active_staff());
create policy plans_update on public.payment_plans as permissive for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- payments (no delete policy: payments can never be deleted)
create policy payments_insert on public.payments as permissive for insert to authenticated
  with check (private.is_admin() or ((collected_by = (select auth.uid())) and private.is_active_staff()
    and exists (select 1 from public.purchases p where p.id = payments.purchase_id and p.agent_id = payments.collected_by)));
create policy payments_select on public.payments as permissive for select to authenticated
  using (private.can_see_agent(collected_by));
create policy payments_update on public.payments as permissive for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- products
create policy products_delete on public.products as permissive for delete to authenticated
  using (private.is_admin());
create policy products_insert on public.products as permissive for insert to authenticated
  with check (private.is_admin());
create policy products_select on public.products as permissive for select to authenticated
  using (private.is_active_staff());
create policy products_update on public.products as permissive for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- purchases
create policy purchases_delete on public.purchases as permissive for delete to authenticated
  using (private.is_admin());
create policy purchases_insert on public.purchases as permissive for insert to authenticated
  with check (private.is_admin() or ((agent_id = (select auth.uid())) and private.is_active_staff()
    and exists (select 1 from public.customers c where c.id = purchases.customer_id and c.registered_by = purchases.agent_id)));
create policy purchases_select on public.purchases as permissive for select to authenticated
  using (private.can_see_agent(agent_id));
create policy purchases_update on public.purchases as permissive for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- staff
create policy staff_delete on public.staff as permissive for delete to authenticated
  using (private.is_admin());
create policy staff_insert on public.staff as permissive for insert to authenticated
  with check (private.is_admin());
create policy staff_select on public.staff as permissive for select to authenticated
  using ((id = (select auth.uid())) or private.is_admin() or ((supervisor_id = (select auth.uid())) and private.is_active_staff()));
create policy staff_update on public.staff as permissive for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- sms_log: staff read their own sends, admin reads all; only the edge function writes
alter table public.sms_log enable row level security;
revoke all on public.sms_log from anon, authenticated;
grant select on public.sms_log to authenticated;
create policy sms_log_select on public.sms_log for select to authenticated
  using (sent_by = (select auth.uid()) or (select private.is_admin()));

-- announcements: admin writes; agents read those for everyone or for them; reads are per person
alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;
revoke all on public.announcements, public.announcement_reads from anon, authenticated;
grant select, insert, update on public.announcements to authenticated;
grant select, insert on public.announcement_reads to authenticated;
create policy announcements_select on public.announcements for select to authenticated
  using ((select private.is_active_staff()) and ((select private.is_admin()) or audience_agent_id is null or audience_agent_id = (select auth.uid())));
create policy announcements_insert on public.announcements for insert to authenticated
  with check ((select private.is_admin()) and created_by = (select auth.uid()));
create policy announcements_update on public.announcements for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy reads_select on public.announcement_reads for select to authenticated
  using ((select private.is_active_staff()) and (staff_id = (select auth.uid()) or (select private.is_admin())));
create policy reads_insert on public.announcement_reads for insert to authenticated
  with check ((select private.is_active_staff()) and staff_id = (select auth.uid())
    and exists (select 1 from public.announcements a where a.id = announcement_id));

-- problem_reports: staff send and read their own; admin reads all and marks done
alter table public.problem_reports enable row level security;
revoke all on public.problem_reports from anon, authenticated;
grant select, insert, update on public.problem_reports to authenticated;
create policy reports_insert on public.problem_reports for insert to authenticated
  with check ((select private.is_active_staff()) and reporter_id = (select auth.uid()) and status = 'new');
create policy reports_select on public.problem_reports for select to authenticated
  using ((select private.is_active_staff()) and (reporter_id = (select auth.uid()) or (select private.is_admin())));
create policy reports_update on public.problem_reports for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
