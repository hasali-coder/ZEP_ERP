create or replace function public.myzavo_ap_ageing_as_of(p_business_id uuid,p_as_of date)
returns table(bill_id uuid,bill_number text,supplier_id uuid,supplier_name text,issue_date date,due_date date,currency text,outstanding_minor bigint,source text)
language plpgsql security invoker set search_path='' as $f$
begin
 if (select auth.uid()) is null or not exists(select 1 from public.business_members bm where bm.business_id=p_business_id and bm.user_id=(select auth.uid())) then raise exception 'Not authorised';end if;
 if p_as_of is null or p_as_of > (current_date+3650) then raise exception 'Invalid as-of date';end if;
 return query
 with bill_rows as(
  select b.id,b.bill_number,b.supplier_id,coalesce(nullif(c.company_name,''),c.name) supplier,
   b.issue_date,b.due_date,b.currency::text,
   greatest(b.amount_minor-coalesce((select sum(a.amount_minor) from public.payment_allocations a
    join public.financial_transactions t on t.id=a.transaction_id and t.business_id=a.business_id
    where a.business_id=b.business_id and a.bill_id=b.id and t.status='posted' and t.payment_date<=p_as_of),0),0)::bigint outstanding,
   'Supplier bill'::text source
  from public.supplier_bills b join public.contacts c on c.id=b.supplier_id and c.business_id=b.business_id
  where b.business_id=p_business_id and b.issue_date<=p_as_of
 ), recurring_rows as(
  select d.id,('REC-'||right(d.schedule_id::text,8)||'-'||to_char(d.due_date,'YYYYMMDD'))::text,
   d.supplier_id,coalesce(nullif(c.company_name,''),c.name),
   d.due_date,d.due_date,d.currency::text,d.amount_minor,
   'Recurring due'::text
  from public.recurring_expense_dues d
  join public.contacts c on c.id=d.supplier_id and c.business_id=d.business_id
  left join public.financial_transactions t on t.business_id=d.business_id and t.id=d.transaction_id
  where d.business_id=p_business_id and d.due_date<=p_as_of
   and (d.status='pending' or (d.status='paid' and coalesce(t.payment_date,d.paid_at::date)>p_as_of))
 )
 select z.id,z.bill_number,z.supplier_id,z.supplier,z.issue_date,z.due_date,z.currency,z.outstanding,z.source
 from (select * from bill_rows union all select * from recurring_rows) z
 where z.outstanding>0 order by z.due_date,z.bill_number;
end $f$;;
