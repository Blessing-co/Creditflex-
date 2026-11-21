-- Creditflex Agents: who may call which function, photo storage, starter data.
-- Run after 03_policies.sql.

-- ===== signed-out visitors (anon) get no direct table access =====
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- ===== function permissions =====
grant usage on schema private to authenticated;
revoke execute on all functions in schema private from public, anon;
revoke execute on all functions in schema public from public, anon;

grant execute on function private.is_active_staff() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.can_see_agent(uuid) to authenticated;

grant execute on function public.admin_update_staff(uuid, text, text, uuid) to authenticated;
grant execute on function public.check_recent_payment_duplicate(bigint, bigint) to authenticated;
grant execute on function public.collection_summary(date, date) to authenticated;
grant execute on function public.complete_agent_onboarding() to authenticated;
grant execute on function public.create_purchase(bigint, bigint, bigint, date) to authenticated;
grant execute on function public.portfolio_summary() to authenticated;
grant execute on function public.register_customer(text, text, text, bigint, bigint, uuid) to authenticated;
grant execute on function public.void_payment(bigint, text) to authenticated;

-- ===== product photos (public read, admin write, 2 MB, images only) =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 2097152, '{image/jpeg,image/png,image/webp}')
on conflict (id) do nothing;

create policy product_images_admin_delete on storage.objects for delete to authenticated
  using ((bucket_id = 'product-images'::text) and private.is_admin());
create policy product_images_admin_insert on storage.objects for insert to authenticated
  with check ((bucket_id = 'product-images'::text) and private.is_admin());
create policy product_images_admin_update on storage.objects for update to authenticated
  using ((bucket_id = 'product-images'::text) and private.is_admin())
  with check ((bucket_id = 'product-images'::text) and private.is_admin());

-- ===== starter payment plans =====
insert into public.payment_plans (name, frequency, installments)
select * from (values ('Daily for 60 days', 'daily', 60), ('Weekly for 12 weeks', 'weekly', 12)) v(name, frequency, installments)
where not exists (select 1 from public.payment_plans);

revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
revoke execute on function public.remove_push_subscription(text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.remove_push_subscription(text) to authenticated;
