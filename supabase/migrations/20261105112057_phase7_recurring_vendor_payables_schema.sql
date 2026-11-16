
create table if not exists public.recurring_expenses(
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete restrict,
 supplier_id uuid not null,
 description text not null check(length(btrim(description)) between 1 and 1000),
 category text not null default 'Other',
 amount_minor bigint not null check(amount_minor>0 and amount_minor<=1000000000000),
 currency varchar(3) not null check(currency ~ '^[A-Z]{3}$'),
 interval_days int not null check(interval_days between 1 and 365),
 first_due_date date not null,
 next_due_date date not null,
 notes text,
 status text not null default 'active' check(status in('active','paused')),
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint recurring_expenses_supplier_fk foreign key(business_id,supplier_id) references public.contacts(business_id,id),
 unique(business_id,id)
);
create index if not exists recurring_expenses_due_idx on public.recurring_expenses(business_id,status,next_due_date);
alter table public.recurring_expenses enable row level security;
revoke all on public.recurring_expenses from public,anon;
grant select on public.recurring_expenses to authenticated;
drop policy if exists recurring_expenses_member_read on public.recurring_expenses;
create policy recurring_expenses_member_read on public.recurring_expenses for select to authenticated
using(exists(select 1 from public.business_members bm where bm.business_id=recurring_expenses.business_id and bm.user_id=(select auth.uid())));

create table if not exists public.recurring_expense_dues(
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete restrict,
 schedule_id uuid not null,
 supplier_id uuid not null,
 due_date date not null,
 description text not null,
 category text not null,
 amount_minor bigint not null check(amount_minor>0),
 currency varchar(3) not null check(currency ~ '^[A-Z]{3}$'),
 status text not null default 'pending' check(status in('pending','paid')),
 expense_id uuid,
 transaction_id uuid,
 paid_at timestamptz,
 created_at timestamptz not null default now(),
 unique(business_id,schedule_id,due_date),
 unique(business_id,id),
 constraint recurring_due_schedule_fk foreign key(business_id,schedule_id) references public.recurring_expenses(business_id,id),
 constraint recurring_due_supplier_fk foreign key(business_id,supplier_id) references public.contacts(business_id,id),
 constraint recurring_due_expense_fk foreign key(business_id,expense_id) references public.expenses(business_id,id),
 constraint recurring_due_transaction_fk foreign key(business_id,transaction_id) references public.financial_transactions(business_id,id),
 constraint recurring_due_paid_check check((status='pending' and expense_id is null and transaction_id is null and paid_at is null) or (status='paid' and expense_id is not null and transaction_id is not null and paid_at is not null))
);
create index if not exists recurring_dues_due_idx on public.recurring_expense_dues(business_id,status,due_date);
alter table public.recurring_expense_dues enable row level security;
revoke all on public.recurring_expense_dues from public,anon;
grant select on public.recurring_expense_dues to authenticated;
drop policy if exists recurring_dues_member_read on public.recurring_expense_dues;
create policy recurring_dues_member_read on public.recurring_expense_dues for select to authenticated
using(exists(select 1 from public.business_members bm where bm.business_id=recurring_expense_dues.business_id and bm.user_id=(select auth.uid())));

create or replace function app_private.myzavo_require_finance_role(bid uuid)
returns void language plpgsql security definer set search_path='' as $f$
begin
 if (select auth.uid()) is null or not exists(select 1 from public.business_members bm where bm.business_id=bid and bm.user_id=(select auth.uid()) and bm.role in('owner','admin','accountant')) then
 raise exception 'Not authorised for this business';end if;
end $f$;
revoke all on function app_private.myzavo_require_finance_role(uuid) from public,anon,authenticated;

create or replace function public.myzavo_create_recurring_expense(
 p_business_id uuid,p_supplier_id uuid,p_description text,p_amount_minor bigint,p_currency text,
 p_category text,p_interval_days int,p_first_due_date date,p_notes text default null
) returns uuid language plpgsql security definer set search_path='' as $f$
declare oid uuid;
begin
 perform app_private.myzavo_require_finance_role(p_business_id);
 if not exists(select 1 from public.contacts c where c.business_id=p_business_id and c.id=p_supplier_id and c.type='supplier' and c.is_active) then raise exception 'Select an active supplier';end if;
 if nullif(btrim(p_description),'') is null or length(p_description)>1000 then raise exception 'Invalid description';end if;
 if p_amount_minor is null or p_amount_minor<=0 or p_amount_minor>1000000000000 then raise exception 'Invalid amount';end if;
 if p_currency is null or p_currency !~ '^[A-Z]{3}$' then raise exception 'Invalid currency';end if;
 if nullif(btrim(p_category),'') is null then raise exception 'Choose category';end if;
 if p_interval_days is null or p_interval_days not between 1 and 365 then raise exception 'Interval must be 1–365 days';end if;
 if p_first_due_date is null then raise exception 'First due date required';end if;
 insert into public.recurring_expenses(business_id,supplier_id,description,category,amount_minor,currency,interval_days,first_due_date,next_due_date,notes,created_by)
 values(p_business_id,p_supplier_id,btrim(p_description),p_category,p_amount_minor,p_currency,p_interval_days,p_first_due_date,p_first_due_date,p_notes,(select auth.uid()))
 returning id into oid;
 return oid;
end $f$;
revoke all on function public.myzavo_create_recurring_expense(uuid,uuid,text,bigint,text,text,int,date,text) from public,anon;
grant execute on function public.myzavo_create_recurring_expense(uuid,uuid,text,bigint,text,text,int,date,text) to authenticated;

create or replace function public.myzavo_generate_recurring_dues(p_business_id uuid,p_through date)
returns int language plpgsql security definer set search_path='' as $f$
declare s public.recurring_expenses%rowtype; n int:=0; steps int; asof date:=(now() at time zone 'Africa/Nairobi')::date;
begin
 perform app_private.myzavo_require_finance_role(p_business_id);
 if p_through is null or p_through<asof-3650 or p_through>asof+365 then raise exception 'Date out of permitted range';end if;
 for s in select * from public.recurring_expenses where business_id=p_business_id and status='active' and next_due_date<=p_through for update loop
  steps:=0;
  while s.next_due_date<=p_through and steps<366 loop
   insert into public.recurring_expense_dues(business_id,schedule_id,supplier_id,due_date,description,category,amount_minor,currency)
   values(s.business_id,s.id,s.supplier_id,s.next_due_date,s.description,s.category,s.amount_minor,s.currency)
   on conflict(business_id,schedule_id,due_date) do nothing;
   n:=n+1;steps:=steps+1;
   s.next_due_date:=s.next_due_date+s.interval_days;
  end loop;
  update public.recurring_expenses set next_due_date=s.next_due_date,updated_at=now() where id=s.id;
 end loop;
 return n;
end $f$;
revoke all on function public.myzavo_generate_recurring_dues(uuid,date) from public,anon;
grant execute on function public.myzavo_generate_recurring_dues(uuid,date) to authenticated;

create or replace function public.myzavo_set_recurring_expense_status(p_schedule_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $f$
declare bid uuid;
begin
 if p_status not in ('active','paused') then raise exception 'Invalid status';end if;
 select s.business_id into bid from public.recurring_expenses s where s.id=p_schedule_id for update;
 if not found then raise exception 'Schedule not found';end if;
 perform app_private.myzavo_require_finance_role(bid);
 update public.recurring_expenses set status=p_status,updated_at=now() where id=p_schedule_id;
end $f$;
revoke all on function public.myzavo_set_recurring_expense_status(uuid,text) from public,anon;
grant execute on function public.myzavo_set_recurring_expense_status(uuid,text) to authenticated;
;
