-- Creditflex Agents: helper functions, business rules (RPCs) and triggers.
-- Run after 01_tables.sql.

-- ===== private helpers (used by the row level security policies) =====
CREATE OR REPLACE FUNCTION private.is_active_staff()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.staff
    where id = (select auth.uid()) and status = 'active'
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_admin()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.staff
    where id = (select auth.uid()) and status = 'active' and role = 'admin'
  );
$function$;

CREATE OR REPLACE FUNCTION private.can_see_agent(target uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.staff me
    where me.id = (select auth.uid())
      and me.status = 'active'
      and (
        me.role = 'admin'
        or me.id = target
        or (
          me.role = 'supervisor'
          and exists (
            select 1 from public.staff a
            where a.id = target and a.supervisor_id = me.id
          )
        )
      )
  );
$function$;

-- ===== new sign-ups become pending agents =====
CREATE OR REPLACE FUNCTION private.handle_new_auth_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
begin
  insert into public.staff (id, full_name, email, phone, role, status)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'New staff'),
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    'agent',
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

-- ===== payment safety triggers =====
CREATE OR REPLACE FUNCTION private.guard_payment()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare
  v_total numeric;
  v_status text;
  v_paid numeric;
begin
  select p.total_price, p.status
    into v_total, v_status
  from public.purchases p
  where p.id = new.purchase_id
  for update;

  if not found then raise exception 'Purchase not found.'; end if;
  if v_status <> 'active' then raise exception 'This purchase is % and no longer accepts payments.', v_status; end if;
  if new.amount is null or new.amount <= 0 then raise exception 'Payment amount must be greater than zero.'; end if;
  if new.paid_on is null then raise exception 'Payment date is required.'; end if;
  if new.collected_by is null then raise exception 'The collecting agent is required.'; end if;

  if not private.is_admin() and (new.paid_on < current_date - 3 or new.paid_on > current_date + 1) then
    raise exception 'A payment must be recorded on the day it is collected. Ask the admin to correct the date.';
  end if;

  select coalesce(sum(pay.amount),0) into v_paid
  from public.payments pay
  where pay.purchase_id = new.purchase_id
    and pay.voided_at is null;

  if round(v_paid + new.amount,2) > round(v_total,2) then
    raise exception 'Payment is more than the balance (balance is %).', round(v_total - v_paid,2);
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.complete_purchase_if_paid()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
begin
  update public.purchases p
  set status = 'completed'
  where p.id = new.purchase_id
    and p.status = 'active'
    and (select coalesce(sum(amount), 0) from public.payments where purchase_id = p.id) >= p.total_price;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.audit_payment_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
begin
  if tg_op = 'INSERT' then
    insert into public.payment_audit_log(payment_id,event_type,actor_id,new_payment)
    values (new.id,'recorded',coalesce((select auth.uid()),new.collected_by),to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' and old.voided_at is null and new.voided_at is not null then
    insert into public.payment_audit_log(payment_id,event_type,actor_id,old_payment,new_payment)
    values (new.id,'voided',new.voided_by,to_jsonb(old),to_jsonb(new));
    return new;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.prevent_payment_delete()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $function$
begin
  raise exception 'Payment records cannot be deleted. Use the payment reversal process.';
end;
$function$;

CREATE OR REPLACE FUNCTION private.prevent_unsafe_payment_update()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $function$
begin
  if coalesce(current_setting('app.payment_void_authorized',true),'') <> 'true' then
    raise exception 'Payment records cannot be edited directly. Use the payment reversal process.';
  end if;

  if old.voided_at is not null then
    raise exception 'This payment has already been reversed.';
  end if;

  if new.purchase_id is distinct from old.purchase_id
     or new.amount is distinct from old.amount
     or new.paid_on is distinct from old.paid_on
     or new.collected_by is distinct from old.collected_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Original payment details are immutable. Reverse the payment and record a corrected payment instead.';
  end if;

  if new.voided_at is null or new.voided_by is null or length(trim(coalesce(new.void_reason,''))) < 8 then
    raise exception 'A reversal timestamp, administrator and reason of at least 8 characters are required.';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.recalculate_purchase_after_void()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare
  v_total numeric;
  v_paid numeric;
begin
  select p.total_price into v_total
  from public.purchases p
  where p.id = new.purchase_id
  for update;

  select coalesce(sum(pay.amount),0) into v_paid
  from public.payments pay
  where pay.purchase_id = new.purchase_id
    and pay.voided_at is null;

  update public.purchases
  set status = case
    when status = 'cancelled' then 'cancelled'
    when round(v_paid,2) >= round(v_total,2) then 'completed'
    else 'active'
  end
  where id = new.purchase_id;

  return new;
end;
$function$;

-- ===== functions the app calls =====
CREATE OR REPLACE FUNCTION public.create_purchase(p_customer_id bigint, p_product_id bigint, p_plan_id bigint, p_start_date date DEFAULT CURRENT_DATE)
 RETURNS bigint LANGUAGE plpgsql SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_role text;
  v_customer_owner uuid;
  v_price numeric;
  v_stock boolean;
  v_installments integer;
  v_purchase_id bigint;
begin
  if v_uid is null then
    raise exception 'You must sign in first.';
  end if;

  select s.role into v_role
  from public.staff s
  where s.id = v_uid and s.status = 'active';

  if v_role is null then
    raise exception 'Your staff account is not active.';
  end if;

  select c.registered_by into v_customer_owner
  from public.customers c
  where c.id = p_customer_id;

  if not found then
    raise exception 'Customer not found or not accessible.';
  end if;

  if v_role <> 'admin' and v_customer_owner <> v_uid then
    raise exception 'You can only create purchases for customers assigned to you.';
  end if;

  select pr.price, pr.in_stock into v_price, v_stock
  from public.products pr where pr.id = p_product_id;

  if not found then raise exception 'Product not found.'; end if;
  if not v_stock then raise exception 'This product is out of stock.'; end if;
  if v_price <= 0 then raise exception 'Product price must be greater than zero.'; end if;

  select pp.installments into v_installments
  from public.payment_plans pp where pp.id = p_plan_id;

  if not found then raise exception 'Payment plan not found.'; end if;
  if v_installments is null or v_installments <= 0 then
    raise exception 'Payment plan must have at least one installment.';
  end if;

  insert into public.purchases
    (customer_id, product_id, plan_id, agent_id, total_price, installment_amount, start_date, status)
  values
    (p_customer_id, p_product_id, p_plan_id, v_uid, v_price,
     round(v_price / v_installments, 2), coalesce(p_start_date, current_date), 'active')
  returning id into v_purchase_id;

  return v_purchase_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.register_customer(p_full_name text, p_phone text, p_location text, p_product_id bigint, p_plan_id bigint, p_submission_id uuid default null)
 RETURNS bigint LANGUAGE plpgsql SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_name text := trim(coalesce(p_full_name, ''));
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '[\s\-]', '', 'g'), '');
  v_customer_id bigint;
  v_existing bigint;
begin
  if v_uid is null then raise exception 'You must sign in first.'; end if;
  -- sent before? return the same purchase instead of creating a second customer
  if p_submission_id is not null then
    select pu.id into v_existing from public.purchases pu join public.customers c on c.id = pu.customer_id
    where c.client_submission_id = p_submission_id and c.registered_by = v_uid order by pu.id limit 1;
    if found then return v_existing; end if;
  end if;
  if length(v_name) < 2 then raise exception 'Enter the customer''s full name.'; end if;
  if v_phone is not null and v_phone !~ '^\+?[0-9]{9,15}$' then raise exception 'Phone number must have 9 to 15 digits.'; end if;
  begin
    insert into public.customers (full_name, phone, location, registered_by, client_submission_id)
    values (v_name, v_phone, nullif(trim(coalesce(p_location, '')), ''), v_uid, p_submission_id)
    returning id into v_customer_id;
  exception when unique_violation then
    select pu.id into v_existing from public.purchases pu join public.customers c on c.id = pu.customer_id
    where c.client_submission_id = p_submission_id and c.registered_by = v_uid order by pu.id limit 1;
    if found then return v_existing; end if;
    raise;
  end;
  return public.create_purchase(v_customer_id, p_product_id, p_plan_id, current_date);
end;
$function$;

CREATE OR REPLACE FUNCTION public.check_recent_payment_duplicate(p_customer_id bigint, p_product_id bigint)
 RETURNS boolean LANGUAGE plpgsql STABLE SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'You must sign in first.'; end if;
  if not exists (select 1 from public.staff s where s.id=v_uid and s.status='active') then
    raise exception 'Your staff account is not active.';
  end if;

  return exists (
    select 1
    from public.payments pay
    join public.purchases p on p.id=pay.purchase_id
    where pay.collected_by=v_uid
      and p.customer_id=p_customer_id
      and p.product_id=p_product_id
      and pay.created_at >= date_trunc('day', now())
      and pay.voided_at is null
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.collection_summary(p_from date, p_to date)
 RETURNS TABLE(agent_id uuid, agent_name text, paid_on date, total numeric, payments_count integer)
 LANGUAGE plpgsql STABLE SET search_path TO ''
AS $function$
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Choose a valid date range.';
  end if;
  if p_to-p_from > 92 then
    raise exception 'Date range is too long (maximum 93 days).';
  end if;

  return query
  select pay.collected_by,coalesce(s.full_name,'Other staff'),pay.paid_on,
         sum(pay.amount)::numeric,count(*)::integer
  from public.payments pay
  left join public.staff s on s.id=pay.collected_by
  where pay.paid_on between p_from and p_to
    and pay.voided_at is null
  group by pay.collected_by,s.full_name,pay.paid_on
  order by pay.paid_on desc,2;
end;
$function$;

CREATE OR REPLACE FUNCTION public.portfolio_summary()
 RETURNS TABLE(agent_id uuid, agent_name text, active_purchases integer, outstanding numeric)
 LANGUAGE sql STABLE SET search_path TO ''
AS $function$
  select l.agent_id,
         l.agent_name,
         count(*)::integer,
         coalesce(sum(l.balance), 0)::numeric
  from public.purchase_ledger l
  where l.status = 'active'
  group by l.agent_id, l.agent_name
  order by 4 desc;
$function$;

CREATE OR REPLACE FUNCTION public.complete_agent_onboarding()
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$ begin update public.staff set onboarding_completed_at = now() where id = auth.uid() and role = 'agent' and status = 'active' and onboarding_completed_at is null; return found; end; $function$;

CREATE OR REPLACE FUNCTION public.admin_update_staff(p_staff_id uuid, p_status text, p_role text, p_supervisor_id uuid DEFAULT NULL::uuid)
 RETURNS void LANGUAGE plpgsql SET search_path TO ''
AS $function$
declare
  v_target_role text;
  v_target_status text;
  v_active_admins bigint;
begin
  if not exists (
    select 1 from public.staff s
    where s.id = (select auth.uid()) and s.status = 'active' and s.role = 'admin'
  ) then
    raise exception 'Only an active admin can manage staff.';
  end if;

  if p_status not in ('pending', 'active', 'disabled') then
    raise exception 'Invalid staff status.';
  end if;
  if p_role not in ('agent', 'supervisor', 'admin') then
    raise exception 'Invalid staff role.';
  end if;

  select role, status into v_target_role, v_target_status
  from public.staff where id = p_staff_id;
  if not found then raise exception 'Staff account not found.'; end if;

  if p_staff_id = (select auth.uid()) and (p_status <> 'active' or p_role <> 'admin') then
    raise exception 'You cannot disable or demote your own admin account.';
  end if;

  if v_target_role = 'admin' and v_target_status = 'active'
     and (p_status <> 'active' or p_role <> 'admin') then
    select count(*) into v_active_admins
    from public.staff where role = 'admin' and status = 'active';
    if v_active_admins <= 1 then
      raise exception 'Cannot disable or demote the last active admin.';
    end if;
  end if;

  if p_supervisor_id is not null and not exists (
    select 1 from public.staff s
    where s.id = p_supervisor_id and s.status = 'active' and s.role in ('supervisor', 'admin')
  ) then
    raise exception 'Supervisor must be an active supervisor or admin.';
  end if;

  update public.staff
  set status = p_status, role = p_role, supervisor_id = p_supervisor_id
  where id = p_staff_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.void_payment(p_payment_id bigint, p_reason text)
 RETURNS void LANGUAGE plpgsql SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not exists (
    select 1 from public.staff s
    where s.id = v_uid and s.status = 'active' and s.role = 'admin'
  ) then
    raise exception 'Only an active administrator can reverse a payment.';
  end if;

  if length(trim(coalesce(p_reason,''))) < 8 then
    raise exception 'Enter a reversal reason of at least 8 characters.';
  end if;

  if not exists (select 1 from public.payments where id = p_payment_id and voided_at is null) then
    raise exception 'Payment not found or already reversed.';
  end if;

  perform set_config('app.payment_void_authorized','true',true);

  update public.payments
  set voided_at = now(),
      voided_by = v_uid,
      void_reason = trim(p_reason)
  where id = p_payment_id and voided_at is null;

  if not found then
    raise exception 'Payment could not be reversed.';
  end if;
end;
$function$;

-- ===== triggers =====
drop trigger if exists payments_guard on public.payments;
CREATE TRIGGER payments_guard BEFORE INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION private.guard_payment();
drop trigger if exists payments_immutable_update on public.payments;
CREATE TRIGGER payments_immutable_update BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION private.prevent_unsafe_payment_update();
drop trigger if exists payments_no_delete on public.payments;
CREATE TRIGGER payments_no_delete BEFORE DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION private.prevent_payment_delete();
drop trigger if exists payments_audit on public.payments;
CREATE TRIGGER payments_audit AFTER INSERT OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION private.audit_payment_change();
drop trigger if exists payments_complete on public.payments;
CREATE TRIGGER payments_complete AFTER INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION private.complete_purchase_if_paid();
drop trigger if exists payments_recalculate_after_void on public.payments;
CREATE TRIGGER payments_recalculate_after_void AFTER UPDATE ON public.payments FOR EACH ROW WHEN (((old.voided_at IS NULL) AND (new.voided_at IS NOT NULL))) EXECUTE FUNCTION private.recalculate_purchase_after_void();

drop trigger if exists on_auth_user_created_creditflex on auth.users;
CREATE TRIGGER on_auth_user_created_creditflex AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.handle_new_auth_user();
