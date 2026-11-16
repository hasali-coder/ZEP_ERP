-- Release 04: receipt-funded customer credits. Original receipts remain unchanged.
alter table public.payment_allocations add column credit_applied_on date;
create table public.zep_customer_credit_events (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id),
 receipt_id uuid not null references public.receipts(id),
 invoice_id uuid,
 refund_transaction_id uuid,
 operation text not null check(operation in ('allocate','refund')),
 amount_minor bigint not null check(amount_minor>0),
 currency varchar(3) not null check(currency ~ '^[A-Z]{3}$'),
 operation_date date not null,
 payment_method text,
 reference_number text,
 reason text not null,
 request_key text not null,
 actor_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique(business_id,request_key),
 foreign key(business_id,invoice_id) references public.invoices(business_id,id),
 foreign key(business_id,refund_transaction_id) references public.financial_transactions(business_id,id),
 check((operation='allocate' and invoice_id is not null and refund_transaction_id is null)
    or (operation='refund' and invoice_id is null and refund_transaction_id is not null))
);
create index zep_credit_receipt_events_idx on public.zep_customer_credit_events(business_id,receipt_id);
alter table public.zep_customer_credit_events enable row level security;
revoke all on public.zep_customer_credit_events from public,anon,authenticated;
grant select on public.zep_customer_credit_events to authenticated;
create policy zep_credit_events_read on public.zep_customer_credit_events for select to authenticated
 using (exists(select 1 from public.business_members m where m.business_id=zep_customer_credit_events.business_id and m.user_id=(select auth.uid())));

create function public.zep_list_customer_credits(p_business_id uuid)
returns table(receipt_id uuid,receipt_number text,customer_id uuid,currency text,issued_at timestamptz,initial_minor bigint,available_minor bigint,history jsonb)
language plpgsql security invoker stable set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.business_members m where m.business_id=p_business_id and m.user_id=auth.uid()) then raise exception 'Not authorised'; end if;
 return query select r.id,r.receipt_number,r.customer_id,r.currency::text,r.issued_at,r.unapplied_minor,
  (r.unapplied_minor-coalesce(e.used,0))::bigint,coalesce(e.history,'[]'::jsonb)
 from public.receipts r join public.financial_transactions t on t.business_id=r.business_id and t.id=r.transaction_id
 left join lateral (select sum(x.amount_minor) used,jsonb_agg(jsonb_build_object('id',x.id,'operation',x.operation,'date',x.operation_date,'amount_minor',x.amount_minor,'invoice_id',x.invoice_id,'refund_transaction_id',x.refund_transaction_id,'reason',x.reason,'reference',x.reference_number) order by x.created_at desc) history
 from public.zep_customer_credit_events x where x.business_id=r.business_id and x.receipt_id=r.id) e on true
 where r.business_id=p_business_id and r.status='issued' and r.unapplied_minor>0 and t.status='posted' and t.direction='in' and t.contact_id=r.customer_id and t.currency=r.currency and t.payment_date<=(now() at time zone 'Africa/Nairobi')::date
 order by r.issued_at desc,r.id;
end $$;
revoke all on function public.zep_list_customer_credits(uuid) from public,anon,authenticated;
grant execute on function public.zep_list_customer_credits(uuid) to authenticated;

create function public.zep_use_customer_credit(p_business_id uuid,p_receipt_id uuid,p_operation text,p_invoice_id uuid,p_amount_minor bigint,p_payment_method text,p_reference_number text,p_reason text,p_request_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); r public.receipts%rowtype; i public.invoices%rowtype;
 t public.financial_transactions%rowtype; e public.zep_customer_credit_events%rowtype;
 available bigint; event_id uuid; refund_id uuid; v_day date:=(now() at time zone 'Africa/Nairobi')::date;
 k text:=nullif(btrim(p_request_key),''); reason text:=nullif(btrim(p_reason),''); ref text:=nullif(btrim(p_reference_number),'');
begin
 perform app_private.myzavo_require_finance_role(p_business_id);
 if actor is null then raise exception 'Sign in required'; end if;
 if p_operation is null or p_operation not in ('allocate','refund') then raise exception 'Invalid credit operation'; end if;
 if k is null or length(k)>128 or reason is null or length(reason)>500 then raise exception 'Request key and reason required'; end if;
 if p_amount_minor is null or p_amount_minor<=0 or p_amount_minor>1000000000000 then raise exception 'Invalid amount'; end if;
 if p_operation='allocate' and (p_invoice_id is null or p_payment_method is not null or ref is not null) then raise exception 'Invalid allocation details'; end if;
 if p_operation='refund' and (p_invoice_id is not null or p_payment_method is null or p_payment_method not in ('cash','mpesa','bank_transfer','card','cheque','other') or (p_payment_method in ('mpesa','bank_transfer','card') and ref is null) or length(ref)>200) then raise exception 'Invalid refund details'; end if;
 -- Serialize credit operations for this business and lock the source receipt.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('zep-customer-credit:'||p_business_id::text,0));
 select * into r from public.receipts where id=p_receipt_id and business_id=p_business_id for update;
 if not found then raise exception 'Receipt not found'; end if;
 select * into t from public.financial_transactions where id=r.transaction_id and business_id=p_business_id for update;
 if not found or r.status<>'issued' or t.status<>'posted' or t.direction<>'in' or t.contact_id is distinct from r.customer_id or t.currency<>r.currency or t.payment_date>v_day or t.amount_minor<>r.received_minor then raise exception 'Receipt is not eligible'; end if;
 -- The original payment and receipt are never edited.
 select * into e from public.zep_customer_credit_events where business_id=p_business_id and request_key=k;
 if found then
  if e.receipt_id<>r.id or e.operation<>p_operation or e.invoice_id is distinct from p_invoice_id or e.amount_minor<>p_amount_minor or e.payment_method is distinct from p_payment_method or e.reference_number is distinct from ref or e.reason<>reason then raise exception 'Request key already used'; end if;
  return e.id;
 end if;
 select r.unapplied_minor-coalesce(sum(x.amount_minor),0) into available from public.zep_customer_credit_events x where x.business_id=p_business_id and x.receipt_id=r.id;
 if available<p_amount_minor then raise exception 'Insufficient available credit'; end if;
 if p_operation='allocate' then
  select * into i from public.invoices where id=p_invoice_id and business_id=p_business_id for update;
  if not found or i.customer_id<>r.customer_id or i.currency<>r.currency or i.status not in ('sent','partially_paid','overdue') or i.balance_due_minor<p_amount_minor or i.issue_date>v_day then raise exception 'Invoice is not eligible for this credit'; end if;
  insert into public.payment_allocations(business_id,transaction_id,invoice_id,amount_minor,credit_applied_on) values(p_business_id,r.transaction_id,i.id,p_amount_minor,v_day);
  update public.invoices set amount_paid_minor=amount_paid_minor+p_amount_minor,status=case when amount_paid_minor+p_amount_minor=total_minor then 'paid' else 'partially_paid' end where id=i.id and business_id=p_business_id;
 else
  if ref is not null and exists(select 1 from public.financial_transactions f where f.business_id=p_business_id and f.payment_method=p_payment_method and f.reference_number=ref and f.status='posted') then raise exception 'Payment reference already recorded'; end if;
  insert into public.financial_transactions(business_id,contact_id,direction,amount_minor,currency,payment_method,payment_date,reference_number,idempotency_key,description,notes,status)
  values(p_business_id,r.customer_id,'out',p_amount_minor,r.currency,p_payment_method,v_day,ref,'zep-credit-refund:'||md5(k),'Customer credit refund: '||r.receipt_number,reason,'posted') returning id into refund_id;
 end if;
 insert into public.zep_customer_credit_events(business_id,receipt_id,invoice_id,refund_transaction_id,operation,amount_minor,currency,operation_date,payment_method,reference_number,reason,request_key,actor_id)
 values(p_business_id,r.id,p_invoice_id,refund_id,p_operation,p_amount_minor,r.currency,v_day,p_payment_method,ref,reason,k,actor) returning id into event_id;
 insert into public.audit_events(business_id,actor_id,event_type,entity_type,entity_id,event_data)
 values(p_business_id,actor,'customer_credit.'||p_operation,'receipt',r.id,jsonb_build_object('credit_event_id',event_id,'amount_minor',p_amount_minor,'currency',r.currency,'invoice_id',p_invoice_id,'refund_transaction_id',refund_id,'remaining_minor',available-p_amount_minor));
 return event_id;
end $$;
revoke all on function public.zep_use_customer_credit(uuid,uuid,text,uuid,bigint,text,text,text,text) from public,anon,authenticated;
grant execute on function public.zep_use_customer_credit(uuid,uuid,text,uuid,bigint,text,text,text,text) to authenticated;

-- Historical receivables must use credit application date rather than original cash receipt date.
do $patch$
declare f text; anchor text:='t.status=''posted'' and t.payment_date<=p_as_of';
begin
 select pg_get_functiondef('public.myzavo_ar_ageing_as_of(uuid,date)'::regprocedure) into f;
 if (length(f)-length(replace(f,anchor,'')))/length(anchor)<>1 then raise exception 'Unexpected AR ageing function; review migration'; end if;
 execute replace(f,anchor,'t.status=''posted'' and coalesce(a.credit_applied_on,t.payment_date)<=p_as_of');
end $patch$;