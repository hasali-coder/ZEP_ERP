
alter table public.expenses
 add column if not exists supplier_name text,
 add column if not exists created_by uuid references auth.users(id),
 add column if not exists idempotency_key text;
create unique index if not exists expenses_business_idempotency_unique on public.expenses(business_id,idempotency_key) where idempotency_key is not null;
create unique index if not exists posted_expense_cash_movement_unique on public.financial_transactions(business_id,expense_id) where expense_id is not null and status='posted';

create or replace function app_private.prevent_unsafe_base_currency_change()
returns trigger language plpgsql set search_path='' as $f$
begin
 if new.currency is distinct from old.currency and (
 exists(select 1 from public.invoices i where i.business_id=old.id)
 or exists(select 1 from public.quotations q where q.business_id=old.id)
 or exists(select 1 from public.expenses e where e.business_id=old.id)
 or exists(select 1 from public.financial_transactions t where t.business_id=old.id)
 or exists(select 1 from public.supplier_bills s where s.business_id=old.id)
 ) then
  raise exception 'Reporting currency cannot be changed after financial records exist';
 end if;
 return new;
end $f$;
revoke all on function app_private.prevent_unsafe_base_currency_change() from public,anon,authenticated;
drop trigger if exists business_base_currency_guard on public.businesses;
create trigger business_base_currency_guard before update of currency on public.businesses
for each row execute function app_private.prevent_unsafe_base_currency_change();

create or replace function public.myzavo_record_paid_expense(
 p_business_id uuid,p_description text,p_amount_minor bigint,p_currency text,
 p_category text,p_expense_date date,p_payment_method text,
 p_supplier_name text default null,p_reference_number text default null,
 p_notes text default null,p_idempotency_key text default null
) returns table(expense_id uuid,transaction_id uuid)
language plpgsql security definer set search_path='' as $f$
declare v_user uuid:=(select auth.uid()); v_exp uuid; v_tx uuid; v_idem text;
begin
 if v_user is null then raise exception 'Sign in required';end if;
 if not exists(select 1 from public.business_members bm where bm.business_id=p_business_id
  and bm.user_id=v_user and bm.role in ('owner','admin','accountant')) then
  raise exception 'Not authorised for this business';end if;
 if nullif(btrim(p_description),'') is null or length(p_description)>1000 then
  raise exception 'Enter an expense description (max 1000 characters)';end if;
 if p_amount_minor is null or p_amount_minor<=0 or p_amount_minor>1000000000000 then
  raise exception 'Invalid expense amount';end if;
 if p_currency is null or p_currency !~ '^[A-Z]{3}$' then raise exception 'Invalid currency';end if;
 if p_expense_date is null then raise exception 'Expense date required';end if;
 if p_payment_method not in ('cash','bank_transfer','mpesa','card','cheque','other') then
  raise exception 'Invalid payment method';end if;
 if nullif(btrim(p_category),'') is null then raise exception 'Select an expense category';end if;
 v_idem:=nullif(btrim(p_idempotency_key),'');
 if v_idem is not null and length(v_idem)>128 then raise exception 'Idempotency key too long';end if;
 if v_idem is not null then
  select e.id into v_exp from public.expenses e where e.business_id=p_business_id and e.idempotency_key=v_idem;
  if found then
   select t.id into v_tx from public.financial_transactions t where t.business_id=p_business_id and t.expense_id=v_exp and t.status='posted';
   expense_id:=v_exp;transaction_id:=v_tx;return next;return;
  end if;
 end if;
 insert into public.expenses(business_id,description,amount_minor,currency,category,expense_date,
  payment_method,reference_number,notes,supplier_name,created_by,idempotency_key)
 values(p_business_id,btrim(p_description),p_amount_minor,p_currency,p_category,p_expense_date,
  p_payment_method,nullif(btrim(p_reference_number),''),p_notes,nullif(btrim(p_supplier_name),''),v_user,v_idem)
 returning id into v_exp;
 insert into public.financial_transactions(business_id,expense_id,direction,amount_minor,currency,
  payment_method,payment_date,reference_number,idempotency_key,description,notes,status)
 values(p_business_id,v_exp,'out',p_amount_minor,p_currency,p_payment_method,p_expense_date,
  nullif(btrim(p_reference_number),''),v_idem,btrim(p_description),p_notes,'posted')
 returning id into v_tx;
 expense_id:=v_exp;transaction_id:=v_tx;return next;
end $f$;
revoke all on function public.myzavo_record_paid_expense(uuid,text,bigint,text,text,date,text,text,text,text,text) from public,anon;
grant execute on function public.myzavo_record_paid_expense(uuid,text,bigint,text,text,date,text,text,text,text,text) to authenticated;

create or replace function public.myzavo_create_supplier_bill(
 p_business_id uuid,p_supplier_id uuid,p_bill_number text,p_issue_date date,p_due_date date,
 p_currency text,p_amount_minor bigint,p_category text,p_description text,p_notes text default null
) returns uuid language plpgsql security definer set search_path='' as $f$
declare v_actor uuid:=(select auth.uid());v_id uuid;
begin
 if v_actor is null then raise exception 'Sign in required';end if;
 if not exists(select 1 from public.business_members bm where bm.business_id=p_business_id
 and bm.user_id=v_actor and bm.role in ('owner','admin','accountant')) then raise exception 'Not authorised';end if;
 if not exists(select 1 from public.contacts c where c.id=p_supplier_id and c.business_id=p_business_id
  and c.type='supplier' and c.is_active) then raise exception 'Choose an active supplier';end if;
 if p_issue_date is null or p_due_date is null or p_due_date<p_issue_date then raise exception 'Invalid bill dates';end if;
 if nullif(btrim(p_bill_number),'') is null or length(p_bill_number)>100 then raise exception 'Supplier invoice reference required';end if;
 if p_currency is null or p_currency !~ '^[A-Z]{3}$' then raise exception 'Invalid currency';end if;
 if p_amount_minor is null or p_amount_minor<=0 then raise exception 'Amount must be positive';end if;
 if nullif(btrim(p_description),'') is null then raise exception 'Description required';end if;
 insert into public.supplier_bills(business_id,supplier_id,bill_number,issue_date,due_date,currency,
  amount_minor,amount_paid_minor,status,category,description,notes)
 values(p_business_id,p_supplier_id,btrim(p_bill_number),p_issue_date,p_due_date,p_currency,
 p_amount_minor,0,'unpaid',p_category,p_description,p_notes) returning id into v_id;
 return v_id;
end $f$;
revoke all on function public.myzavo_create_supplier_bill(uuid,uuid,text,date,date,text,bigint,text,text,text) from public,anon;
grant execute on function public.myzavo_create_supplier_bill(uuid,uuid,text,date,date,text,bigint,text,text,text) to authenticated;
;
