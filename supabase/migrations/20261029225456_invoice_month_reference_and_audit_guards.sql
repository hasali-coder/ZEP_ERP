
create table if not exists app_private.invoice_month_counters(
 business_id uuid not null references public.businesses(id) on delete restrict,
 year_month integer not null check(year_month between 200001 and 999912),
 last_number bigint not null default 0 check(last_number>=0),
 primary key(business_id,year_month));
alter table app_private.invoice_month_counters enable row level security;
revoke all on app_private.invoice_month_counters from public,anon,authenticated;
alter table public.invoices
 add column if not exists created_by uuid references auth.users(id),
 add column if not exists issued_at timestamptz,
 add column if not exists cancelled_at timestamptz,
 add column if not exists cancelled_by uuid references auth.users(id),
 add column if not exists cancellation_reason text,
 add column if not exists business_snapshot jsonb,
 add column if not exists customer_snapshot jsonb;
create or replace function app_private.myzavo_assign_invoice_reference()
returns trigger language plpgsql security definer set search_path='' as $f$
declare n bigint;
begin
 if tg_op='INSERT' then
  if new.invoice_number is not null and new.invoice_number<>'' then
   raise exception 'Invoice reference is assigned automatically'; end if;
  insert into app_private.invoice_month_counters(business_id,year_month,last_number)
  values(new.business_id,to_char(new.issue_date,'YYYYMM')::int,1)
  on conflict(business_id,year_month) do update
  set last_number=app_private.invoice_month_counters.last_number+1
  returning last_number into n;
  new.invoice_number:='INV'||to_char(new.issue_date,'YYMM')||lpad(n::text,greatest(3,length(n::text)),'0');
  new.created_by:=(select auth.uid());
  if new.status='sent' then new.issued_at:=now(); end if;
 else
  if new.invoice_number is distinct from old.invoice_number
   or new.created_by is distinct from old.created_by then
   raise exception 'Invoice reference and creator are immutable'; end if;
  if old.status='cancelled' and new.status<>'cancelled' then
   raise exception 'Cancelled invoice cannot be restored'; end if;
  if new.status='cancelled' and old.status<>'cancelled' then
    new.cancelled_at:=now(); new.cancelled_by:=(select auth.uid()); end if;
  if old.issued_at is not null and new.issued_at is distinct from old.issued_at then
    raise exception 'Issue timestamp immutable'; end if;
 end if;
 return new;
end $f$;
revoke all on function app_private.myzavo_assign_invoice_reference() from public,anon,authenticated;
drop trigger if exists invoice_reference_guard on public.invoices;
create trigger invoice_reference_guard before insert or update on public.invoices
for each row execute function app_private.myzavo_assign_invoice_reference();
revoke insert,update,delete on public.invoices from anon,authenticated;
revoke insert,update,delete on public.invoice_items from anon,authenticated;
revoke insert,update,delete on public.credit_notes from anon,authenticated;
;
