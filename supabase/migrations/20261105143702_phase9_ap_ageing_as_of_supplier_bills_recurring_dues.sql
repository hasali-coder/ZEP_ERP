
create or replace function public.myzavo_ap_ageing_as_of(p_business_id uuid,p_as_of date)
returns table(
  bill_id uuid,bill_number text,supplier_id uuid,supplier_name text,
  issue_date date,due_date date,currency text,outstanding_minor bigint,source text
)
language plpgsql security invoker set search_path='' as $f$
begin
 if (select auth.uid()) is null or not exists (
  select 1 from public.business_members m
  where m.business_id=p_business_id and m.user_id=(select auth.uid())
 ) then raise exception 'Not authorised'; end if;
 if p_as_of is null or p_as_of > (current_date + 3650) then raise exception 'Invalid as-of date';end if;
 return query
 with vendor_bills as (
 select b.id bill_id,b.bill_number,b.supplier_id,coalesce(nullif(c.company_name,''),c.name) supplier_name,
 b.issue_date,b.due_date,b.currency::text,
 greatest(b.amount_minor - coalesce((
   select sum(a.amount_minor) from public.payment_allocations a
   join public.financial_transactions t on t.business_id=a.business_id and t.id=a.transaction_id
   where a.business_id=b.business_id and a.bill_id=b.id and t.status='posted' and t.payment_date<=p_as_of
 ),0),0)::bigint outstanding_minor,
 'Supplier bill'::text source
 from public.supplier_bills b
 join public.contacts c on c.id=b.supplier_id and c.business_id=b.business_id
 where b.business_id=p_business_id and b.issue_date<=p_as_of
 ),due_items as (
 select d.id,d.schedule_id::text||' · '||to_char(d.due_date,'YYYYMMDD') as reference,
 d.supplier_id,coalesce(nullif(c.company_name,''),c.name) supplier_name,
 d.due_date,d.due_date,d.currency::text,d.amount_minor,'Recurring due'::text
 from public.recurring_expense_dues d
 join public.contacts c on c.id=d.supplier_id and c.business_id=d.business_id
 where d.business_id=p_business_id and d.due_date<=p_as_of and d.status='pending'
 )
 select z.bill_id,z.bill_number,z.supplier_id,z.supplier_name,z.issue_date,z.due_date,z.currency,z.outstanding_minor,z.source
 from (select * from vendor_bills union all select * from due_items) z
 where z.outstanding_minor>0
 order by z.due_date,z.bill_number;
end $f$;
revoke all on function public.myzavo_ap_ageing_as_of(uuid,date) from public,anon;
grant execute on function public.myzavo_ap_ageing_as_of(uuid,date) to authenticated;
;
