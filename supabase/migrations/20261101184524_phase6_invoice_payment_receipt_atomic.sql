
create table if not exists app_private.receipt_month_counters(
 business_id uuid not null references public.businesses(id) on delete restrict,
 year_month integer not null check(year_month between 200001 and 999912),
 last_number bigint not null default 0,
 primary key(business_id,year_month)
);
alter table app_private.receipt_month_counters enable row level security;
revoke all on app_private.receipt_month_counters from public,anon,authenticated;

create table if not exists public.receipts(
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete restrict,
 transaction_id uuid not null unique,
 customer_id uuid not null,
 receipt_number text not null,
 issued_at timestamptz not null default now(),
 currency varchar(3) not null check(currency ~ '^[A-Z]{3}$'),
 received_minor bigint not null check(received_minor>0),
 allocated_minor bigint not null check(allocated_minor>=0),
 unapplied_minor bigint generated always as (received_minor-allocated_minor) stored,
 status text not null default 'issued' check(status in('issued','void')),
 created_by uuid not null references auth.users(id),
 unique(business_id,receipt_number),
 constraint receipts_amount_consistency check(allocated_minor<=received_minor),
 constraint receipts_transaction_tenant_fk foreign key(business_id,transaction_id)
 references public.financial_transactions(business_id,id),
 constraint receipts_customer_tenant_fk foreign key(business_id,customer_id)
 references public.contacts(business_id,id)
);
create index if not exists receipt_business_customer_idx on public.receipts(business_id,customer_id,issued_at desc);
alter table public.receipts enable row level security;
create policy receipts_read_business_members on public.receipts for select to authenticated
using(exists(select 1 from public.business_members bm
where bm.business_id=receipts.business_id and bm.user_id=(select auth.uid())));
grant select on public.receipts to authenticated;

create or replace function public.myzavo_collect_invoice_payment(
 p_invoice_id uuid,p_received_minor bigint,p_currency text,p_payment_method text,
 p_payment_date date,p_reference_number text,p_idempotency_key text
) returns table(transaction_id uuid,receipt_number text,applied_minor bigint,unapplied_minor bigint,new_balance_minor bigint)
language plpgsql security definer set search_path='' as $f$
declare actor uuid:=(select auth.uid());v_invoice public.invoices%rowtype;
v_tx uuid;v_receipt text;v_n bigint;v_date date:=(now() at time zone 'Africa/Nairobi')::date;
v_apply bigint;v_key text:=nullif(btrim(p_idempotency_key),'');
begin
 if actor is null then raise exception 'Sign in required';end if;
 if v_key is null or length(v_key)>128 then raise exception 'Idempotency key required (max 128 characters)';end if;
 if p_received_minor is null or p_received_minor<=0 or p_received_minor>1000000000000 then raise exception 'Invalid payment amount';end if;
 if p_payment_method not in ('cash','bank_transfer','mpesa','card','cheque','other') then raise exception 'Invalid payment method';end if;
 if p_payment_date is null or p_payment_date>v_date+1 then raise exception 'Invalid payment date';end if;
 if p_payment_method in ('mpesa','bank_transfer','card') and nullif(btrim(p_reference_number),'') is null then
 raise exception 'Payment reference required';end if;
 select * into v_invoice from public.invoices i where i.id=p_invoice_id for update;
 if not found then raise exception 'Invoice not found';end if;
 if not exists(select 1 from public.business_members bm
 where bm.business_id=v_invoice.business_id and bm.user_id=actor
 and bm.role in ('owner','admin','accountant')) then raise exception 'Not authorised';end if;
 select t.id into v_tx from public.financial_transactions t
 where t.business_id=v_invoice.business_id and t.idempotency_key=v_key;
 if found then
  select r.receipt_number,r.allocated_minor,r.unapplied_minor
  into v_receipt,v_apply,unapplied_minor
  from public.receipts r where r.transaction_id=v_tx and r.business_id=v_invoice.business_id;
  if v_receipt is null then raise exception 'Existing payment has no receipt; contact support';end if;
  transaction_id:=v_tx;receipt_number:=v_receipt;applied_minor:=v_apply;
  new_balance_minor:=v_invoice.balance_due_minor;
  return next; return;
 end if;
 if v_invoice.status not in ('sent','partially_paid','overdue') or v_invoice.balance_due_minor<=0 then
 raise exception 'Only unpaid issued invoices can collect payment';end if;
 if p_currency is distinct from v_invoice.currency then
 raise exception 'Cross-currency payment requires a recorded FX rate and is not yet enabled';end if;
 if exists(select 1 from public.financial_transactions t
  where t.business_id=v_invoice.business_id and t.payment_method=p_payment_method
  and t.reference_number=p_reference_number and t.status='posted'
  and nullif(p_reference_number,'') is not null) then
  raise exception 'Payment reference has already been recorded';end if;
 v_apply:=least(p_received_minor,v_invoice.balance_due_minor);
 insert into public.financial_transactions(
  business_id,contact_id,direction,amount_minor,currency,payment_method,payment_date,reference_number,
  idempotency_key,description,status)
 values(v_invoice.business_id,v_invoice.customer_id,'in',p_received_minor,p_currency,
  p_payment_method,p_payment_date,nullif(btrim(p_reference_number),''),
  v_key,'Payment for '||v_invoice.invoice_number,'posted')
 returning id into v_tx;
 insert into public.payment_allocations(business_id,transaction_id,invoice_id,amount_minor)
 values(v_invoice.business_id,v_tx,v_invoice.id,v_apply);
 update public.invoices
 set amount_paid_minor=amount_paid_minor+v_apply,
 status=case when amount_paid_minor+v_apply=total_minor then 'paid' else 'partially_paid' end
 where id=v_invoice.id;
 insert into app_private.receipt_month_counters(business_id,year_month,last_number)
 values(v_invoice.business_id,to_char(v_date,'YYYYMM')::int,1)
 on conflict(business_id,year_month) do update
 set last_number=app_private.receipt_month_counters.last_number+1 returning last_number into v_n;
 v_receipt:='RCP'||to_char(v_date,'YYMM')||lpad(v_n::text,greatest(3,length(v_n::text)),'0');
 insert into public.receipts(business_id,transaction_id,customer_id,receipt_number,currency,
  received_minor,allocated_minor,created_by)
 values(v_invoice.business_id,v_tx,v_invoice.customer_id,v_receipt,p_currency,p_received_minor,v_apply,actor);
 transaction_id:=v_tx;receipt_number:=v_receipt;applied_minor:=v_apply;
 unapplied_minor:=p_received_minor-v_apply;
 new_balance_minor:=v_invoice.balance_due_minor-v_apply;
 return next;
end $f$;
revoke all on function public.myzavo_collect_invoice_payment(uuid,bigint,text,text,date,text,text) from public,anon;
grant execute on function public.myzavo_collect_invoice_payment(uuid,bigint,text,text,date,text,text) to authenticated;
;
