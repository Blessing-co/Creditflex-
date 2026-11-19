-- Creditflex Agents: tables, indexes and row level security switches.
-- Run files 01 to 05 in order in the Supabase SQL Editor on an EMPTY project.
-- Generated from the live "Trial" project (dsjuwmtojudcaulfqmyp) on 2026-11-17.

create schema if not exists private;

create table if not exists public.staff (
  id uuid not null,
  full_name text not null,
  phone text,
  role text default 'agent'::text not null,
  created_at timestamp with time zone default now() not null,
  status text default 'pending'::text not null,
  email text,
  supervisor_id uuid,
  onboarding_completed_at timestamp with time zone,
  constraint staff_pkey primary key (id),
  constraint staff_not_own_supervisor check ((supervisor_id is null) or (supervisor_id <> id)),
  constraint staff_role_check check (role = any (array['agent'::text, 'supervisor'::text, 'admin'::text])),
  constraint staff_status_check check (status = any (array['pending'::text, 'active'::text, 'disabled'::text])),
  constraint staff_id_fkey foreign key (id) references auth.users(id) on delete cascade,
  constraint staff_supervisor_id_fkey foreign key (supervisor_id) references public.staff(id) on delete set null
);

create table if not exists public.customers (
  id bigint generated always as identity not null,
  full_name text not null,
  phone text,
  location text,
  registered_by uuid,
  created_at timestamp with time zone default now() not null,
  constraint customers_pkey primary key (id),
  constraint customers_registered_by_fkey foreign key (registered_by) references public.staff(id)
);

create table if not exists public.products (
  id bigint generated always as identity not null,
  name text not null,
  price numeric(10,2) not null,
  image_url text,
  in_stock boolean default true not null,
  created_at timestamp with time zone default now() not null,
  constraint products_pkey primary key (id),
  constraint products_price_nonnegative check (price >= 0::numeric)
);

create table if not exists public.payment_plans (
  id bigint generated always as identity not null,
  name text not null,
  frequency text not null,
  installments integer not null,
  created_at timestamp with time zone default now() not null,
  constraint payment_plans_pkey primary key (id),
  constraint payment_plans_frequency_check check (frequency = any (array['daily'::text, 'weekly'::text]))
);

create table if not exists public.purchases (
  id bigint generated always as identity not null,
  customer_id bigint not null,
  product_id bigint not null,
  plan_id bigint not null,
  agent_id uuid not null,
  total_price numeric(10,2) not null,
  installment_amount numeric(10,2) not null,
  start_date date default current_date not null,
  status text default 'active'::text not null,
  created_at timestamp with time zone default now() not null,
  constraint purchases_pkey primary key (id),
  constraint purchases_amounts_positive check ((total_price > 0::numeric) and (installment_amount > 0::numeric)),
  constraint purchases_status_check check (status = any (array['active'::text, 'completed'::text, 'cancelled'::text])),
  constraint purchases_agent_id_fkey foreign key (agent_id) references public.staff(id),
  constraint purchases_customer_id_fkey foreign key (customer_id) references public.customers(id),
  constraint purchases_plan_id_fkey foreign key (plan_id) references public.payment_plans(id),
  constraint purchases_product_id_fkey foreign key (product_id) references public.products(id)
);

create table if not exists public.payments (
  id bigint generated always as identity not null,
  purchase_id bigint not null,
  amount numeric(10,2) not null,
  paid_on date default current_date not null,
  collected_by uuid not null,
  created_at timestamp with time zone default now() not null,
  voided_at timestamp with time zone,
  voided_by uuid,
  void_reason text,
  offline_submission_id uuid,
  constraint payments_pkey primary key (id),
  constraint payments_amount_positive check (amount > 0::numeric),
  constraint payments_collected_by_fkey foreign key (collected_by) references public.staff(id),
  constraint payments_purchase_id_fkey foreign key (purchase_id) references public.purchases(id),
  constraint payments_voided_by_fkey foreign key (voided_by) references public.staff(id)
);

create table if not exists public.payment_audit_log (
  id bigint generated always as identity not null,
  payment_id bigint not null,
  event_type text not null,
  actor_id uuid,
  event_at timestamp with time zone default now() not null,
  old_payment jsonb,
  new_payment jsonb,
  constraint payment_audit_log_pkey primary key (id),
  constraint payment_audit_log_event_type_check check (event_type = any (array['recorded'::text, 'voided'::text, 'baseline'::text])),
  constraint payment_audit_log_actor_id_fkey foreign key (actor_id) references public.staff(id),
  constraint payment_audit_log_payment_id_fkey foreign key (payment_id) references public.payments(id) on delete restrict
);

alter table public.staff enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.payment_plans enable row level security;
alter table public.purchases enable row level security;
alter table public.payments enable row level security;
alter table public.payment_audit_log enable row level security;

create index if not exists customers_registered_by_idx on public.customers using btree (registered_by);
create index if not exists idx_purchases_status on public.purchases using btree (status);
create index if not exists payment_audit_log_actor_id_idx on public.payment_audit_log using btree (actor_id);
create index if not exists payment_audit_log_payment_id_idx on public.payment_audit_log using btree (payment_id);
create index if not exists payments_collected_by_idx on public.payments using btree (collected_by);
create index if not exists payments_collector_created_at_idx on public.payments using btree (collected_by, created_at desc);
-- stops an offline payment being saved twice if the phone syncs twice
create unique index if not exists payments_offline_submission_id_uidx on public.payments using btree (offline_submission_id) where (offline_submission_id is not null);
create index if not exists payments_paid_on_idx on public.payments using btree (paid_on);
create index if not exists payments_purchase_id_idx on public.payments using btree (purchase_id);
create index if not exists payments_voided_by_idx on public.payments using btree (voided_by);
create index if not exists purchases_agent_id_idx on public.purchases using btree (agent_id);
create index if not exists purchases_customer_id_idx on public.purchases using btree (customer_id);
create index if not exists purchases_customer_product_idx on public.purchases using btree (customer_id, product_id, id);
create index if not exists purchases_plan_id_idx on public.purchases using btree (plan_id);
create index if not exists purchases_product_id_idx on public.purchases using btree (product_id);
create index if not exists staff_supervisor_id_idx on public.staff using btree (supervisor_id);

-- Ledger view: one row per purchase with what is paid and what is left.
-- Cancelled (voided) payments are ignored. security_invoker means the
-- row level security of the person asking is applied.
create or replace view public.purchase_ledger with (security_invoker=true) as
 SELECT p.id AS purchase_id,
    p.customer_id,
    c.full_name AS customer_name,
    c.phone AS customer_phone,
    p.product_id,
    pr.name AS product_name,
    p.plan_id,
    pp.name AS plan_name,
    pp.frequency AS payment_frequency,
    pp.installments AS planned_installments,
    p.agent_id,
    s.full_name AS agent_name,
    p.total_price,
    p.installment_amount,
    COALESCE(sum(pay.amount) FILTER (WHERE (pay.voided_at IS NULL)), (0)::numeric) AS amount_paid,
    GREATEST((p.total_price - COALESCE(sum(pay.amount) FILTER (WHERE (pay.voided_at IS NULL)), (0)::numeric)), (0)::numeric) AS balance,
    (count(pay.id) FILTER (WHERE (pay.voided_at IS NULL)))::integer AS payments_made,
    p.start_date,
    p.status,
    p.created_at
   FROM (((((purchases p
     JOIN customers c ON ((c.id = p.customer_id)))
     JOIN products pr ON ((pr.id = p.product_id)))
     JOIN payment_plans pp ON ((pp.id = p.plan_id)))
     JOIN staff s ON ((s.id = p.agent_id)))
     LEFT JOIN payments pay ON ((pay.purchase_id = p.id)))
  GROUP BY p.id, c.id, pr.id, pp.id, s.id;

-- offline registration: lets the app send the same customer twice safely
alter table public.customers add column if not exists client_submission_id uuid;
create unique index if not exists customers_client_submission_id_uidx on public.customers (client_submission_id) where client_submission_id is not null;

-- SMS receipts log (written only by the send-payment-sms edge function)
create table if not exists public.sms_log (
  id bigint generated always as identity primary key,
  payment_id bigint not null references public.payments(id) on delete restrict,
  sent_by uuid not null references public.staff(id),
  phone text, message text,
  status text not null check (status in ('sent','failed')),
  provider_response text,
  created_at timestamptz not null default now()
);
create unique index if not exists sms_log_one_sent_per_payment on public.sms_log (payment_id) where status = 'sent';
