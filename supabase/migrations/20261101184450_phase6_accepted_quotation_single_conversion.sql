
create unique index if not exists invoice_one_per_source_quote
on public.invoices(business_id,source_quotation_id) where source_quotation_id is not null;

create or replace function public.myzavo_convert_accepted_quote(p_quote_id uuid)
returns table(id uuid,invoice_number text)
language plpgsql security definer set search_path='' as $f$
declare actor uuid:=(select auth.uid());q public.quotations%rowtype;customer_terms integer;v_inv uuid;v_num text;
v_date date:=(now() at time zone 'Africa/Nairobi')::date;
begin
 if actor is null then raise exception 'Sign in required';end if;
 select * into q from public.quotations x where x.id=p_quote_id for update;
 if not found then raise exception 'Quotation not found';end if;
 if not exists(select 1 from public.business_members bm where bm.business_id=q.business_id and bm.user_id=actor and bm.role in ('owner','admin','accountant'))
 then raise exception 'Not authorised';end if;
 if q.status='converted' then raise exception 'Quotation was already converted';end if;
 if q.status<>'accepted' then raise exception 'Only accepted quotations can be converted';end if;
 if exists(select 1 from public.invoices i where i.business_id=q.business_id and i.source_quotation_id=q.id) then raise exception 'Invoice already exists for this quotation';end if;
 select coalesce(c.credit_terms_days,0) into customer_terms from public.contacts c
 where c.id=q.customer_id and c.business_id=q.business_id and c.type='customer' and c.is_active=true;
 if not found then raise exception 'Customer inactive or not found';end if;
 insert into public.invoices(
 business_id,customer_id,source_quotation_id,invoice_number,
 issue_date,due_date,currency,subtotal_minor,discount_minor,tax_minor,total_minor,
 amount_paid_minor,status,payment_terms,payment_instructions,notes,business_snapshot,customer_snapshot)
 values(q.business_id,q.customer_id,q.id,'',v_date,v_date+customer_terms,
 q.currency,q.subtotal_minor,q.discount_minor,q.tax_minor,q.total_minor,
 0,'draft',case when customer_terms=0 then 'Due on receipt' else 'Net '||customer_terms||' days' end,
 null,q.notes,q.business_snapshot,q.customer_snapshot)
 returning invoices.id,invoices.invoice_number into v_inv,v_num;
 insert into public.invoice_items(
  business_id,invoice_id,position,description,quantity,unit_price_minor,tax_rate_percent,discount_percent)
 select li.business_id,v_inv,li.position,li.description,li.quantity,li.unit_price_minor,
 li.tax_rate_percent,li.discount_percent from public.quotation_items li where li.quotation_id=q.id and li.business_id=q.business_id;
 update public.quotations set status='converted' where quotations.id=q.id;
 id:=v_inv;invoice_number:=v_num;return next;
end $f$;
revoke all on function public.myzavo_convert_accepted_quote(uuid) from public,anon;
grant execute on function public.myzavo_convert_accepted_quote(uuid) to authenticated;
;
