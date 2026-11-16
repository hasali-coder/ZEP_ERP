-- MyZavo Phase 1: secure, multi-business financial foundation.
-- Financial tables are read-only to application users until later phases
-- introduce validated, atomic document and payment operations.

begin;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 160),
  email text,
  phone text,
  address text,
  city text,
  country text not null default 'Kenya',
  tax_number text,
  currency varchar(3) not null default 'KES' check (currency ~ '^[A-Z]{3}$'),
  logo_path text,
  payment_instructions text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index businesses_owner_id_idx on public.businesses (owner_id);

create table public.business_members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete restrict,
  role text not null check (role in ('owner', 'admin', 'accountant', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create index business_members_user_idx on public.business_members (user_id, business_id);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  type text not null default 'customer' check (type in ('customer', 'supplier', 'both')),
  name text not null check (length(trim(name)) > 0),
  company_name text,
  email text,
  phone text,
  address text,
  city text,
  country text,
  tax_number text,
  currency_preference varchar(3) check (currency_preference ~ '^[A-Z]{3}$'),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id)
);

create index contacts_business_type_idx on public.contacts (business_id, type);

create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  kind text not null check (kind in ('product', 'service')),
  name text not null check (length(trim(name)) > 0),
  description text,
  unit_price_minor bigint not null default 0 check (unit_price_minor >= 0),
  currency varchar(3) not null default 'KES' check (currency ~ '^[A-Z]{3}$'),
  tax_rate_percent numeric(6,3) not null default 0 check (tax_rate_percent between 0 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id)
);

create index catalog_items_business_idx on public.catalog_items (business_id, is_active);

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  customer_id uuid not null,
  quote_number text not null,
  issue_date date not null default current_date,
  expiry_date date not null,
  currency varchar(3) not null check (currency ~ '^[A-Z]{3}$'),
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  total_minor bigint not null default 0 check (total_minor >= 0),
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'declined', 'converted')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, quote_number),
  foreign key (business_id, customer_id) references public.contacts (business_id, id)
);

create index quotations_customer_date_idx on public.quotations (business_id, customer_id, issue_date desc);

create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  quotation_id uuid not null,
  position integer not null default 0 check (position >= 0),
  description text not null check (length(trim(description)) > 0),
  quantity numeric(15,3) not null check (quantity > 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  tax_rate_percent numeric(6,3) not null default 0 check (tax_rate_percent between 0 and 100),
  discount_percent numeric(6,3) not null default 0 check (discount_percent between 0 and 100),
  foreign key (business_id, quotation_id) references public.quotations (business_id, id) on delete cascade
);

create index quotation_items_parent_idx on public.quotation_items (business_id, quotation_id, position);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  customer_id uuid not null,
  source_quotation_id uuid,
  invoice_number text not null,
  issue_date date not null default current_date,
  due_date date not null,
  currency varchar(3) not null check (currency ~ '^[A-Z]{3}$'),
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  total_minor bigint not null default 0 check (total_minor >= 0),
  amount_paid_minor bigint not null default 0 check (amount_paid_minor >= 0),
  balance_due_minor bigint generated always as (greatest(total_minor - amount_paid_minor, 0)) stored,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  payment_terms text,
  payment_instructions text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, invoice_number),
  check (amount_paid_minor <= total_minor),
  foreign key (business_id, customer_id) references public.contacts (business_id, id),
  foreign key (business_id, source_quotation_id) references public.quotations (business_id, id)
);

create index invoices_customer_date_idx on public.invoices (business_id, customer_id, issue_date desc);
create index invoices_due_idx on public.invoices (business_id, due_date) where status not in ('paid', 'cancelled', 'draft');

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  invoice_id uuid not null,
  position integer not null default 0 check (position >= 0),
  description text not null check (length(trim(description)) > 0),
  quantity numeric(15,3) not null check (quantity > 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  tax_rate_percent numeric(6,3) not null default 0 check (tax_rate_percent between 0 and 100),
  discount_percent numeric(6,3) not null default 0 check (discount_percent between 0 and 100),
  foreign key (business_id, invoice_id) references public.invoices (business_id, id) on delete cascade
);

create index invoice_items_parent_idx on public.invoice_items (business_id, invoice_id, position);

create table public.supplier_bills (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  supplier_id uuid not null,
  bill_number text not null,
  description text not null default '',
  category text,
  issue_date date not null default current_date,
  due_date date not null,
  currency varchar(3) not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor >= 0),
  amount_paid_minor bigint not null default 0 check (amount_paid_minor >= 0),
  balance_due_minor bigint generated always as (greatest(amount_minor - amount_paid_minor, 0)) stored,
  status text not null default 'unpaid'
    check (status in ('unpaid', 'partially_paid', 'paid', 'overdue')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, bill_number),
  check (amount_paid_minor <= amount_minor),
  foreign key (business_id, supplier_id) references public.contacts (business_id, id)
);

create index supplier_bills_due_idx on public.supplier_bills (business_id, due_date) where status != 'paid';

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  supplier_id uuid,
  description text not null check (length(trim(description)) > 0),
  category text not null default 'Other',
  expense_date date not null default current_date,
  amount_minor bigint not null check (amount_minor > 0),
  currency varchar(3) not null check (currency ~ '^[A-Z]{3}$'),
  payment_method text check (payment_method in ('cash', 'bank_transfer', 'mpesa', 'card', 'cheque', 'other')),
  reference_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, supplier_id) references public.contacts (business_id, id)
);

create index expenses_business_date_idx on public.expenses (business_id, expense_date desc);

create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  contact_id uuid,
  expense_id uuid,
  direction text not null check (direction in ('in', 'out')),
  amount_minor bigint not null check (amount_minor > 0),
  currency varchar(3) not null check (currency ~ '^[A-Z]{3}$'),
  payment_method text not null check (payment_method in ('cash', 'bank_transfer', 'mpesa', 'card', 'cheque', 'other')),
  payment_date date not null default current_date,
  reference_number text,
  idempotency_key text,
  description text not null default '',
  notes text,
  status text not null default 'posted' check (status in ('posted', 'reversed')),
  created_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, idempotency_key),
  foreign key (business_id, contact_id) references public.contacts (business_id, id),
  foreign key (business_id, expense_id) references public.expenses (business_id, id)
);

create index financial_transactions_date_idx on public.financial_transactions (business_id, payment_date desc);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  transaction_id uuid not null,
  invoice_id uuid,
  bill_id uuid,
  amount_minor bigint not null check (amount_minor > 0),
  created_at timestamptz not null default now(),
  check (num_nonnulls(invoice_id, bill_id) = 1),
  foreign key (business_id, transaction_id) references public.financial_transactions (business_id, id),
  foreign key (business_id, invoice_id) references public.invoices (business_id, id),
  foreign key (business_id, bill_id) references public.supplier_bills (business_id, id)
);

create index payment_allocations_tx_idx on public.payment_allocations (business_id, transaction_id);
create index payment_allocations_invoice_idx on public.payment_allocations (business_id, invoice_id) where invoice_id is not null;
create index payment_allocations_bill_idx on public.payment_allocations (business_id, bill_id) where bill_id is not null;

create table public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete restrict,
  customer_id uuid not null,
  invoice_id uuid,
  credit_number text not null,
  issue_date date not null default current_date,
  currency varchar(3) not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor > 0),
  reason text not null default '',
  status text not null default 'draft' check (status in ('draft', 'issued', 'void')),
  created_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, credit_number),
  foreign key (business_id, customer_id) references public.contacts (business_id, id),
  foreign key (business_id, invoice_id) references public.invoices (business_id, id)
);

create table public.document_sequences (
  business_id uuid not null references public.businesses (id) on delete restrict,
  document_type text not null check (document_type in ('invoice', 'quotation', 'bill', 'credit_note')),
  year integer not null check (year between 2000 and 9999),
  next_number integer not null default 1 check (next_number > 0),
  primary key (business_id, document_type, year)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete restrict,
  actor_id uuid references auth.users (id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_business_date_idx on public.audit_events (business_id, created_at desc);

-- Do not allow a document to be moved to another business by updating its tenant key.
create function app_private.prevent_business_reassignment()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if new.business_id is distinct from old.business_id then
    raise exception 'Business ownership is immutable';
  end if;
  return new;
end;
$$;

create function app_private.prevent_business_owner_reassignment()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id then
    raise exception 'Business identity and owner cannot be reassigned';
  end if;
  return new;
end;
$$;

create trigger business_owner_immutable
before update on public.businesses
for each row execute function app_private.prevent_business_owner_reassignment();

do $$
declare rel text;
begin
  foreach rel in array array[
    'contacts', 'catalog_items', 'quotations', 'quotation_items',
    'invoices', 'invoice_items', 'supplier_bills', 'expenses',
    'financial_transactions', 'payment_allocations', 'credit_notes',
    'document_sequences', 'audit_events'
  ]
  loop
    execute format(
      'create trigger tenant_immutable before update on public.%I for each row execute function app_private.prevent_business_reassignment()',
      rel
    );
  end loop;
end;
$$;

create function app_private.touch_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare rel text;
begin
  foreach rel in array array[
    'profiles', 'businesses', 'contacts', 'catalog_items',
    'quotations', 'invoices', 'supplier_bills', 'expenses'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function app_private.touch_updated_at()',
      rel
    );
  end loop;
end;
$$;

-- Business creation is the only public way to gain an owner membership.
-- This trigger runs only on creation of a business whose owner matches auth.uid().
-- SECURITY DEFINER is narrowly scoped, is not in an exposed schema, and cannot
-- be invoked directly by API roles.
create function app_private.add_business_owner()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or new.owner_id is distinct from (select auth.uid()) then
    raise exception 'Cannot create business for another user';
  end if;

  insert into public.business_members (business_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

revoke all on function app_private.add_business_owner() from public, anon, authenticated;

create trigger add_owner_on_business_create
after insert on public.businesses
for each row execute function app_private.add_business_owner();

-- Exposed-schema security: explicitly grant only the operations required now.
-- Financial writes intentionally have no client grants or write policies in Phase 1.
do $$
declare rel text;
begin
  foreach rel in array array[
    'profiles', 'businesses', 'business_members', 'contacts',
    'catalog_items', 'quotations', 'quotation_items', 'invoices',
    'invoice_items', 'supplier_bills', 'expenses', 'financial_transactions',
    'payment_allocations', 'credit_notes', 'document_sequences', 'audit_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', rel);
    execute format('revoke all on table public.%I from anon, authenticated', rel);
    execute format('grant select on table public.%I to authenticated', rel);
  end loop;
end;
$$;

grant insert, update on public.profiles to authenticated;
grant insert, update on public.businesses to authenticated;

create policy profiles_read_self on public.profiles for select to authenticated
using (id = (select auth.uid()));

create policy profiles_insert_self on public.profiles for insert to authenticated
with check (id = (select auth.uid()));

create policy profiles_update_self on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy businesses_read_member on public.businesses for select to authenticated
using (
  owner_id = (select auth.uid())
  or exists (
    select 1 from public.business_members bm
    where bm.business_id = businesses.id and bm.user_id = (select auth.uid())
  )
);

create policy businesses_create_self on public.businesses for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy businesses_update_owner on public.businesses for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

-- A user can see their memberships. Team invitation/management comes later,
-- via a dedicated, audited, role-checked operation rather than direct writes.
create policy business_members_read_self on public.business_members for select to authenticated
using (user_id = (select auth.uid()));

-- All financial and contact data is tenant-scoped. No user can access a business
-- merely by guessing a UUID. Business membership is checked by the database.
do $$
declare rel text;
begin
  foreach rel in array array[
    'contacts', 'catalog_items', 'quotations', 'quotation_items',
    'invoices', 'invoice_items', 'supplier_bills', 'expenses',
    'financial_transactions', 'payment_allocations', 'credit_notes',
    'document_sequences', 'audit_events'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (
        exists (select 1 from public.business_members bm
          where bm.business_id = %I.business_id
          and bm.user_id = (select auth.uid()))
      )',
      rel || '_read_member', rel, rel
    );
  end loop;
end;
$$;

commit;
;
