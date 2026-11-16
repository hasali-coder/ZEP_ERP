
create or replace function public.myzavo_create_invoice(
 p_business_id uuid,p_customer_id uuid,p_issue_date date,p_due_date date,p_currency text,
 p_items jsonb,p_global_discount_minor bigint default 0,p_payment_terms text default null,
 p_payment_instructions text default null,p_notes text default null,p_status text default 'draft'
) returns table(id uuid,invoice_number text,total_minor bigint)
language plpgsql security definer set search_path='' as $f$
declare
 v_actor uuid:=(select auth.uid()); v_b public.businesses%rowtype;
 v_c public.contacts%rowtype; v_inv uuid;v_num text; v_line jsonb;
 v_q numeric; v_price bigint;v_tax numeric;v_discount numeric;v_line_net numeric;
 v_subtotal numeric:=0;v_tax_total numeric:=0;v_disc bigint:=coalesce(p_global_discount_minor,0);
 v_total bigint;v_pos integer:=0;
begin
 if v_actor is null then raise exception 'Sign-in required';end if;
 if not exists(select 1 from public.business_members bm where bm.business_id=p_business_id and bm.user_id=v_actor and bm.role in('owner','admin','accountant')) then
  raise exception 'Not authorised for this business';end if;
 select * into v_b from public.businesses b where b.id=p_business_id;
 if not found then raise exception 'Business not found';end if;
 select * into v_c from public.contacts c where c.id=p_customer_id and c.business_id=p_business_id
  and c.type='customer' and c.is_active=true;
 if not found then raise exception 'Select an active customer';end if;
 if p_issue_date is null or p_due_date is null or p_due_date<p_issue_date then raise exception 'Invalid dates';end if;
 if p_currency is null or p_currency !~ '^[A-Z]{3}$' then raise exception 'Invalid ISO currency';end if;
 if p_status not in('draft','sent') then raise exception 'Invalid initial status';end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100 then
  raise exception 'Invoice requires 1 to 100 items';end if;
 for v_line in select value from jsonb_array_elements(p_items) loop
  v_q:=(v_line->>'quantity')::numeric;
  v_price:=(v_line->>'unit_price_minor')::bigint;
  v_discount:=coalesce((v_line->>'discount_percent')::numeric,0);
  v_tax:=coalesce((v_line->>'tax_rate_percent')::numeric,0);
  if nullif(btrim(v_line->>'description'),'') is null or v_q<=0 or v_q>1000000
   or v_price<0 or v_price>100000000000 or v_discount<0 or v_discount>100 or v_tax<0 or v_tax>100 then
    raise exception 'Invalid invoice item';end if;
  v_subtotal:=v_subtotal+round(round(v_q*v_price,0)*(100-v_discount)/100,0);
 end loop;
 if v_subtotal>1000000000000 or v_disc<0 or v_disc>v_subtotal then raise exception 'Invalid invoice discount or total';end if;
 for v_line in select value from jsonb_array_elements(p_items) loop
  v_q:=(v_line->>'quantity')::numeric;v_price:=(v_line->>'unit_price_minor')::bigint;
  v_discount:=coalesce((v_line->>'discount_percent')::numeric,0);
  v_tax:=coalesce((v_line->>'tax_rate_percent')::numeric,0);
  v_line_net:=round(round(v_q*v_price,0)*(100-v_discount)/100,0);
  if v_subtotal>0 then v_tax_total:=v_tax_total+round(v_line_net*(v_subtotal-v_disc)/v_subtotal*v_tax/100,0);end if;
 end loop;
 v_total:=(v_subtotal-v_disc+v_tax_total)::bigint;
 insert into public.invoices(
  business_id,customer_id,invoice_number,issue_date,due_date,currency,subtotal_minor,
  discount_minor,tax_minor,total_minor,amount_paid_minor,status,payment_terms,
  payment_instructions,notes,business_snapshot,customer_snapshot
 ) values (
 p_business_id,p_customer_id,'',p_issue_date,p_due_date,p_currency,v_subtotal::bigint,
 v_disc,v_tax_total::bigint,v_total,0,p_status,p_payment_terms,p_payment_instructions,p_notes,
 jsonb_build_object('name',v_b.name,'email',v_b.email,'phone',v_b.phone,'address',v_b.address,
  'city',v_b.city,'country',v_b.country,'tax_number',v_b.tax_number,'logo_path',v_b.logo_path),
 jsonb_build_object('name',v_c.name,'company_name',v_c.company_name,'email',v_c.email,
  'phone',v_c.phone,'address',v_c.address,'city',v_c.city,'country',v_c.country,
  'tax_number',v_c.tax_number)
 ) returning invoices.id,invoices.invoice_number into v_inv,v_num;
 for v_line in select value from jsonb_array_elements(p_items) loop
  insert into public.invoice_items(business_id,invoice_id,position,description,quantity,
   unit_price_minor,tax_rate_percent,discount_percent)
   values(p_business_id,v_inv,v_pos,btrim(v_line->>'description'),
   (v_line->>'quantity')::numeric,(v_line->>'unit_price_minor')::bigint,
   coalesce((v_line->>'tax_rate_percent')::numeric,0),
   coalesce((v_line->>'discount_percent')::numeric,0));
  v_pos:=v_pos+1;
 end loop;
 id:=v_inv;invoice_number:=v_num;total_minor:=v_total;return next;
end $f$;
revoke all on function public.myzavo_create_invoice(uuid,uuid,date,date,text,jsonb,bigint,text,text,text,text) from public,anon;
grant execute on function public.myzavo_create_invoice(uuid,uuid,date,date,text,jsonb,bigint,text,text,text,text) to authenticated;

create or replace function public.myzavo_cancel_invoice(p_invoice_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $f$
declare v_actor uuid:=(select auth.uid());v_inv public.invoices%rowtype;
begin
 if v_actor is null then raise exception 'Sign-in required';end if;
 select * into v_inv from public.invoices i where i.id=p_invoice_id for update;
 if not found then raise exception 'Invoice not found';end if;
 if not exists(select 1 from public.business_members bm where bm.business_id=v_inv.business_id and bm.user_id=v_actor and bm.role in('owner','admin','accountant')) then
  raise exception 'Not authorised';end if;
 if v_inv.status='cancelled' then raise exception 'Invoice already cancelled';end if;
 if v_inv.amount_paid_minor>0 or exists(select 1 from public.payment_allocations a where a.invoice_id=p_invoice_id) then
  raise exception 'Invoice with payments requires credit or refund handling';end if;
 if exists(select 1 from public.credit_notes c where c.invoice_id=p_invoice_id and c.status='issued') then
  raise exception 'Invoice already has issued credit notes';end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'Provide a cancellation reason';end if;
 update public.invoices set status='cancelled',cancellation_reason=btrim(p_reason) where invoices.id=p_invoice_id;
end $f$;
revoke all on function public.myzavo_cancel_invoice(uuid,text) from public,anon;
grant execute on function public.myzavo_cancel_invoice(uuid,text) to authenticated;
;
