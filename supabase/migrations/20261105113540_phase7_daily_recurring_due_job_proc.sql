
create or replace function app_private.myzavo_generate_all_recurring_dues()
returns integer language plpgsql security definer set search_path='' as $fn$
declare s public.recurring_expenses%rowtype; asof date:=(now() at time zone 'Africa/Nairobi')::date;
 n integer:=0;steps integer;
begin
 for s in select * from public.recurring_expenses where status='active' and next_due_date<=asof for update skip locked loop
  steps:=0;
  while s.next_due_date<=asof and steps<366 loop
   insert into public.recurring_expense_dues(business_id,schedule_id,supplier_id,due_date,description,category,amount_minor,currency)
   values(s.business_id,s.id,s.supplier_id,s.next_due_date,s.description,s.category,s.amount_minor,s.currency)
   on conflict(business_id,schedule_id,due_date) do nothing;
   s.next_due_date:=s.next_due_date+s.interval_days;
   n:=n+1;steps:=steps+1;
  end loop;
  update public.recurring_expenses set next_due_date=s.next_due_date,updated_at=now() where id=s.id;
 end loop;
 return n;
end $fn$;
revoke all on function app_private.myzavo_generate_all_recurring_dues() from public,anon,authenticated;
;
