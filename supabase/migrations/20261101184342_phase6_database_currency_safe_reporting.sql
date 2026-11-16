
create or replace function public.myzavo_report_summary(
 p_business_id uuid,p_from date,p_to date
) returns jsonb language plpgsql security invoker set search_path='' as $f$
declare v_data jsonb;
begin
 if (select auth.uid()) is null or not exists(
 select 1 from public.business_members bm where bm.business_id=p_business_id and bm.user_id=(select auth.uid())
 ) then raise exception 'Not authorised';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to>p_from+interval '10 years' then
 raise exception 'Invalid date range';end if;
 with currency_set as (
  select i.currency::text as currency from public.invoices i where i.business_id=p_business_id
  union select e.currency from public.expenses e where e.business_id=p_business_id
  union select t.currency from public.financial_transactions t where t.business_id=p_business_id
  union select b.currency from public.supplier_bills b where b.business_id=p_business_id
  union select cn.currency from public.credit_notes cn where cn.business_id=p_business_id
 ), data as (
 select cs.currency,
  (select coalesce(sum(i.total_minor),0) from public.invoices i
   where i.business_id=p_business_id and i.currency=cs.currency and i.issue_date between p_from and p_to
   and i.status<>'draft' and (i.status<>'cancelled' or exists(
    select 1 from public.credit_notes c where c.invoice_id=i.id and c.status='issued'))) as invoiced_minor,
  (select coalesce(sum(cn.amount_minor),0) from public.credit_notes cn
   where cn.business_id=p_business_id and cn.currency=cs.currency and cn.status='issued'
   and cn.issue_date between p_from and p_to) as credits_minor,
  (select coalesce(sum(e.amount_minor),0) from public.expenses e
   where e.business_id=p_business_id and e.currency=cs.currency and e.expense_date between p_from and p_to) as expense_minor,
  (select coalesce(sum(t.amount_minor),0) from public.financial_transactions t
   where t.business_id=p_business_id and t.currency=cs.currency and t.status='posted'
   and t.direction='in' and t.payment_date between p_from and p_to) as cash_in_minor,
  (select coalesce(sum(t.amount_minor),0) from public.financial_transactions t
   where t.business_id=p_business_id and t.currency=cs.currency and t.status='posted'
   and t.direction='out' and t.payment_date between p_from and p_to) as cash_out_minor,
  (select coalesce(sum(i.balance_due_minor),0) from public.invoices i
   where i.business_id=p_business_id and i.currency=cs.currency and i.issue_date<=p_to
   and i.status not in('draft','cancelled','paid')) as receivables_minor,
  (select coalesce(sum(b.balance_due_minor),0) from public.supplier_bills b
   where b.business_id=p_business_id and b.currency=cs.currency and b.issue_date<=p_to
   and b.status<>'paid') as payables_minor
 from currency_set cs
 ) select coalesce(jsonb_agg(jsonb_build_object(
  'currency',currency,'invoiced_minor',invoiced_minor,'credits_minor',credits_minor,
  'net_billed_minor',invoiced_minor-credits_minor,
  'expenses_minor',expense_minor,'cash_received_minor',cash_in_minor,
  'cash_paid_minor',cash_out_minor,'net_cash_flow_minor',cash_in_minor-cash_out_minor,
  'receivables_minor',receivables_minor,'payables_minor',payables_minor
 ) order by currency),'[]'::jsonb) into v_data from data;
 return jsonb_build_object('business_id',p_business_id,'from',p_from,'to',p_to,'by_currency',v_data,
 'note','Amounts are recorded in original currencies; no exchange rates or consolidation have been applied.');
end $f$;
revoke all on function public.myzavo_report_summary(uuid,date,date) from public,anon;
grant execute on function public.myzavo_report_summary(uuid,date,date) to authenticated;
;
