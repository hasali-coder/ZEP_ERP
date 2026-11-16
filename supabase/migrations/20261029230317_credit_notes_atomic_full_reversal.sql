
create table if not exists app_private.credit_month_counters(
 business_id uuid not null references public.businesses(id) on delete restrict,
 year_month integer not null check(year_month between 200001 and 999912),
 last_number bigint not null default 0 check(last_number>=0),
 primary key(business_id,year_month));
alter table app_private.credit_month_counters enable row level security;
revoke all on app_private.credit_month_counters from public,anon,authenticated;
alter table public.credit_notes add column if not exists issued_at timestamptz;
alter table public.credit_notes add column if not exists created_by uuid references auth.users(id);
create or replace function public.myzavo_issue_full_credit(
 p_invoice_id uuid, p_reason text)
returns table(id uuid,credit_number text)
language plpgsql security definer set search_path='' as $f$
declare v_actor uuid:=(select auth.uid()); v_inv public.invoices%rowtype;
 n bigint; v_ref text; v_id uuid; v_date date:=(now() at time zone 'Africa/Nairobi')::date;
begin
 if v_actor is null then raise exception 'Sign-in required';end if;
 if nullif(btrim(p_reason),'') is null or length(p_reason)>2000 then
  raise exception 'Provide a reason (maximum 2000 characters)';end if;
 select * into v_inv from public.invoices i where i.id=p_invoice_id for update;
 if not found then raise exception 'Invoice not found';end if;
 if not exists(select 1 from public.business_members bm
  where bm.business_id=v_inv.business_id and bm.user_id=v_actor
    and bm.role in('owner','admin','accountant')) then raise exception 'Not authorised';end if;
 if v_inv.status not in('sent','overdue') then
  raise exception 'Only unpaid, issued invoices can receive a full credit in this phase';end if;
 if v_inv.amount_paid_minor<>0 or exists(
  select 1 from public.payment_allocations pa where pa.invoice_id=p_invoice_id) then
  raise exception 'This invoice has payments; manual finance review required';end if;
 if exists(select 1 from public.credit_notes c where c.invoice_id=p_invoice_id and c.status<>'void') then
  raise exception 'Invoice already has a credit note';end if;
 if v_inv.total_minor<=0 then raise exception 'Cannot credit a zero-value invoice';end if;
 insert into app_private.credit_month_counters(business_id,year_month,last_number)
 values(v_inv.business_id,to_char(v_date,'YYYYMM')::int,1)
 on conflict(business_id,year_month) do update
 set last_number=app_private.credit_month_counters.last_number+1
 returning last_number into n;
 v_ref:='CRN'||to_char(v_date,'YYMM')||lpad(n::text,greatest(3,length(n::text)),'0');
 insert into public.credit_notes(business_id,customer_id,invoice_id,credit_number,
  issue_date,currency,amount_minor,reason,status,issued_at,created_by)
 values(v_inv.business_id,v_inv.customer_id,v_inv.id,v_ref,v_date,
  v_inv.currency,v_inv.total_minor,btrim(p_reason),'issued',now(),v_actor)
 returning credit_notes.id into v_id;
 update public.invoices
 set status='cancelled',cancellation_reason='Fully credited by '||v_ref||': '||btrim(p_reason)
 where invoices.id=p_invoice_id;
 id:=v_id; credit_number:=v_ref; return next;
end $f$;
revoke all on function public.myzavo_issue_full_credit(uuid,text) from public,anon;
grant execute on function public.myzavo_issue_full_credit(uuid,text) to authenticated;
;
