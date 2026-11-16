create or replace function public.myzavo_ar_ageing_as_of(p_business_id uuid,p_as_of date)
returns table(
 invoice_id uuid,invoice_number text,customer_name text,customer_id uuid,
 issue_date date,due_date date,currency text,outstanding_minor bigint
)
language plpgsql security invoker set search_path='' as $f$
begin
 if (select auth.uid()) is null or not exists(
 select 1 from public.business_members bm where bm.business_id=p_business_id
 and bm.user_id=(select auth.uid())
 ) then raise exception 'Not authorised for this business';end if;
 if p_as_of is null or p_as_of > (current_date + 3650) then
 raise exception 'Invalid ageing date';end if;
 return query
 select i.id,i.invoice_number,c.company_name as customer_name,i.customer_id,
 i.issue_date,i.due_date,i.currency::text,
 greatest(i.total_minor - coalesce(pay.paid,0)-coalesce(cr.credited,0),0)::bigint
 from public.invoices i
 join public.contacts c on c.business_id=i.business_id and c.id=i.customer_id
 left join lateral(
 select coalesce(sum(a.amount_minor),0)::bigint as paid
 from public.payment_allocations a
 join public.financial_transactions t on t.id=a.transaction_id and t.business_id=a.business_id
 where a.business_id=i.business_id and a.invoice_id=i.id and
 t.status='posted' and t.payment_date<=p_as_of
 ) pay on true
 left join lateral(
 select coalesce(sum(cn.amount_minor),0)::bigint as credited
 from public.credit_notes cn
 where cn.business_id=i.business_id and cn.invoice_id=i.id
 and cn.status='issued' and cn.issue_date<=p_as_of
 ) cr on true
 where i.business_id=p_business_id and i.issue_date<=p_as_of
 and i.status<>'draft'
 and (i.status<>'cancelled' or (i.cancelled_at is not null and i.cancelled_at::date>p_as_of))
 and greatest(i.total_minor-coalesce(pay.paid,0)-coalesce(cr.credited,0),0)>0
 order by i.due_date,i.invoice_number;
end $f$;
revoke all on function public.myzavo_ar_ageing_as_of(uuid,date) from public,anon;
grant execute on function public.myzavo_ar_ageing_as_of(uuid,date) to authenticated;;
