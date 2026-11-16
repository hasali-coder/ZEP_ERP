
create or replace function public.myzavo_record_vendor_expense(
 p_business_id uuid,p_supplier_id uuid,p_description text,p_amount_minor bigint,p_currency text,
 p_category text,p_expense_date date,p_payment_method text,p_reference_number text default null,
 p_notes text default null,p_idempotency_key text default null,p_due_id uuid default null
) returns table(expense_id uuid,transaction_id uuid)
language plpgsql security definer set search_path='' as $f$
declare v_supplier public.contacts%rowtype;v_due public.recurring_expense_dues%rowtype;
 v_exp uuid;v_tx uuid;v_key text:=nullif(btrim(p_idempotency_key),'');
begin
 perform app_private.myzavo_require_finance_role(p_business_id);
 select * into v_supplier from public.contacts c where c.business_id=p_business_id and c.id=p_supplier_id and c.type='supplier' and c.is_active;
 if not found then raise exception 'Select an active supplier from Contacts';end if;
 if v_key is null or length(v_key)>128 then raise exception 'Idempotency key required';end if;
 if nullif(btrim(p_description),'') is null or length(p_description)>1000 then raise exception 'Description required (max 1000 characters)';end if;
 if nullif(btrim(p_category),'') is null then raise exception 'Category required';end if;
 if p_amount_minor is null or p_amount_minor<=0 or p_amount_minor>1000000000000 then raise exception 'Invalid amount';end if;
 if p_currency is null or p_currency !~ '^[A-Z]{3}$' then raise exception 'Invalid currency';end if;
 if p_expense_date is null then raise exception 'Expense date required';end if;
 if p_payment_method not in ('cash','bank_transfer','mpesa','card','cheque','other') then raise exception 'Invalid payment method';end if;
 if p_payment_method in ('mpesa','bank_transfer','card') and nullif(btrim(p_reference_number),'') is null then raise exception 'Payment reference required';end if;
 select e.id into v_exp from public.expenses e where e.business_id=p_business_id and e.idempotency_key=v_key;
 if found then
  if not exists(select 1 from public.expenses e where e.id=v_exp and e.supplier_id=p_supplier_id and e.amount_minor=p_amount_minor and e.currency=p_currency and e.description=btrim(p_description)) then
   raise exception 'Idempotency key already used for a different expense';end if;
  select t.id into v_tx from public.financial_transactions t where t.business_id=p_business_id and t.expense_id=v_exp and t.status='posted';
  if not found then raise exception 'Existing expense has no posted transaction';end if;
  expense_id:=v_exp;transaction_id:=v_tx;return next;return;
 end if;
 if p_due_id is not null then
  select * into v_due from public.recurring_expense_dues d where d.business_id=p_business_id and d.id=p_due_id for update;
  if not found then raise exception 'Recurring due entry not found';end if;
  if v_due.status<>'pending' then raise exception 'Recurring payment already posted';end if;
  if v_due.supplier_id<>p_supplier_id or v_due.currency<>p_currency or v_due.amount_minor<>p_amount_minor
   or v_due.description<>btrim(p_description) or v_due.category<>p_category then
   raise exception 'Recurring due details do not match payment';end if;
 end if;
 insert into public.expenses(business_id,supplier_id,description,amount_minor,currency,category,
 expense_date,payment_method,reference_number,notes,supplier_name,created_by,idempotency_key)
 values(p_business_id,p_supplier_id,btrim(p_description),p_amount_minor,p_currency,p_category,
 p_expense_date,p_payment_method,nullif(btrim(p_reference_number),''),p_notes,
 coalesce(nullif(v_supplier.company_name,''),v_supplier.name),(select auth.uid()),v_key)
 returning id into v_exp;
 insert into public.financial_transactions(business_id,contact_id,expense_id,direction,amount_minor,currency,
 payment_method,payment_date,reference_number,idempotency_key,description,notes,status)
 values(p_business_id,p_supplier_id,v_exp,'out',p_amount_minor,p_currency,
 p_payment_method,p_expense_date,nullif(btrim(p_reference_number),''),v_key,btrim(p_description),p_notes,'posted')
 returning id into v_tx;
 if p_due_id is not null then
  update public.recurring_expense_dues set status='paid',expense_id=v_exp,transaction_id=v_tx,paid_at=now() where id=p_due_id;
 end if;
 expense_id:=v_exp;transaction_id:=v_tx;return next;
end $f$;
revoke all on function public.myzavo_record_vendor_expense(uuid,uuid,text,bigint,text,text,date,text,text,text,text,uuid) from public,anon;
grant execute on function public.myzavo_record_vendor_expense(uuid,uuid,text,bigint,text,text,date,text,text,text,text,uuid) to authenticated;
;
