-- Draft amendments and quotation revisions. Existing references remain immutable.
alter table public.quotations add column revised_from_id uuid;
alter table public.quotations add constraint zep_quote_parent_fk foreign key(business_id,revised_from_id) references public.quotations(business_id,id);
create unique index zep_quote_one_successor on public.quotations(revised_from_id) where revised_from_id is not null;
create function app_private.zep_document_totals(p_items jsonb,p_discount bigint)
returns table(subtotal bigint,tax bigint,total bigint) language plpgsql immutable set search_path='' as $$
declare l jsonb; q numeric; p bigint; d numeric; t numeric; n numeric; s numeric:=0; tt numeric:=0;
begin
 if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Line items must be an array'; end if;
 if jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Enter 1 to 100 items';end if;
 for l in select value from jsonb_array_elements(p_items) loop
  q:=(l->>'quantity')::numeric;p:=(l->>'unit_price_minor')::bigint;d:=coalesce((l->>'discount_percent')::numeric,0);t:=coalesce((l->>'tax_rate_percent')::numeric,0);
  if nullif(btrim(l->>'description'),'') is null or length(l->>'description')>2000 or q is null or q not between 0.001 and 1000000 or p is null or p not between 0 and 100000000000 or d not between 0 and 100 or t not between 0 and 100 then raise exception 'Invalid line item';end if;
  s:=s+round(round(q*p,0)*(100-d)/100,0);
 end loop;
 if s>1000000000000 or p_discount is null or p_discount<0 or p_discount>s then raise exception 'Invalid document total or discount';end if;
 for l in select value from jsonb_array_elements(p_items) loop
  n:=round(round((l->>'quantity')::numeric*(l->>'unit_price_minor')::bigint,0)*(100-coalesce((l->>'discount_percent')::numeric,0))/100,0);
  if s>0 then tt:=tt+round(n*(s-p_discount)/s*coalesce((l->>'tax_rate_percent')::numeric,0)/100,0);end if;
 end loop;
 return query select s::bigint,tt::bigint,(s-p_discount+tt)::bigint;
end $$;
revoke all on function app_private.zep_document_totals(jsonb,bigint) from public,anon,authenticated;
create function public.zep_edit_draft_invoice(p_business_id uuid,p_id uuid,p_expected timestamptz,p_due date,p_currency text,p_items jsonb,p_discount bigint,p_terms text,p_instructions text,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare i public.invoices%rowtype; v record; before_items jsonb; actor uuid:=auth.uid();
begin
 perform app_private.myzavo_require_finance_role(p_business_id);
 select * into i from public.invoices where id=p_id and business_id=p_business_id for update;
 if not found or i.status<>'draft' or i.amount_paid_minor<>0 then raise exception 'Only unpaid draft invoices can be edited';end if;
 if p_expected is distinct from i.updated_at then raise exception 'Document changed; reopen it before editing';end if;
 if p_due is null or p_due<i.issue_date or p_currency is null or p_currency !~ '^[A-Z]{3}$' then raise exception 'Invalid due date or currency';end if;
 select * into v from app_private.zep_document_totals(p_items,p_discount);
 select coalesce(jsonb_agg(to_jsonb(x) order by x.position),'[]'::jsonb) into before_items from public.invoice_items x where x.business_id=p_business_id and x.invoice_id=p_id;
 delete from public.invoice_items where business_id=p_business_id and invoice_id=p_id;
 insert into public.invoice_items(business_id,invoice_id,position,description,quantity,unit_price_minor,tax_rate_percent,discount_percent)
 select p_business_id,p_id,(ord-1)::int,btrim(l->>'description'),(l->>'quantity')::numeric,(l->>'unit_price_minor')::bigint,coalesce((l->>'tax_rate_percent')::numeric,0),coalesce((l->>'discount_percent')::numeric,0) from jsonb_array_elements(p_items) with ordinality a(l,ord);
 update public.invoices set due_date=p_due,currency=p_currency,subtotal_minor=v.subtotal,discount_minor=p_discount,tax_minor=v.tax,total_minor=v.total,payment_terms=p_terms,payment_instructions=p_instructions,notes=p_notes where id=p_id;
 insert into public.audit_events(business_id,actor_id,event_type,entity_type,entity_id,event_data) values(p_business_id,actor,'invoice.draft_edited','invoice',p_id,jsonb_build_object('previous',to_jsonb(i),'previous_items',before_items,'new_total_minor',v.total));
 return p_id;
end $$;
create function public.zep_edit_or_revise_quote(p_business_id uuid,p_id uuid,p_expected timestamptz,p_expiry date,p_currency text,p_items jsonb,p_discount bigint,p_notes text,p_status text)
returns uuid language plpgsql security definer set search_path='' as $$
declare q public.quotations%rowtype; v record; new_id uuid; before_items jsonb; actor uuid:=auth.uid(); d date:=(now() at time zone 'Africa/Nairobi')::date;
begin
 perform app_private.myzavo_require_finance_role(p_business_id);
 select * into q from public.quotations where id=p_id and business_id=p_business_id for update;
 if not found or q.status not in ('draft','sent','declined') or exists(select 1 from public.quotations z where z.revised_from_id=p_id) then raise exception 'Quotation cannot be edited or revised';end if;
 if p_expected is distinct from q.updated_at then raise exception 'Document changed; reopen it before editing';end if;
 if p_status is null or p_status not in ('draft','sent') or p_expiry is null or p_expiry < (case when q.status='draft' then q.issue_date else d end) or p_currency is null or p_currency !~ '^[A-Z]{3}$' then raise exception 'Invalid quotation terms';end if;
 select * into v from app_private.zep_document_totals(p_items,p_discount);
 if q.status='draft' then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.position),'[]'::jsonb) into before_items from public.quotation_items x where x.business_id=p_business_id and x.quotation_id=p_id;
  delete from public.quotation_items where business_id=p_business_id and quotation_id=p_id;
  insert into public.quotation_items(business_id,quotation_id,position,description,quantity,unit_price_minor,tax_rate_percent,discount_percent)
  select p_business_id,p_id,(ord-1)::int,btrim(l->>'description'),(l->>'quantity')::numeric,(l->>'unit_price_minor')::bigint,coalesce((l->>'tax_rate_percent')::numeric,0),coalesce((l->>'discount_percent')::numeric,0) from jsonb_array_elements(p_items) with ordinality a(l,ord);
  update public.quotations set expiry_date=p_expiry,currency=p_currency,subtotal_minor=v.subtotal,discount_minor=p_discount,tax_minor=v.tax,total_minor=v.total,notes=p_notes,status=p_status,issued_at=case when p_status='sent' then now() else issued_at end where id=p_id;
  new_id:=p_id;
 else
  select z.id into new_id from public.myzavo_create_quotation(p_business_id,q.customer_id,d,p_expiry,p_currency,p_items,p_discount,p_notes,p_status) z;
  update public.quotations set status='declined' where id=p_id;
  update public.quotations set revised_from_id=p_id where id=new_id;
 end if;
 insert into public.audit_events(business_id,actor_id,event_type,entity_type,entity_id,event_data) values(p_business_id,actor,case when new_id=p_id then 'quotation.draft_edited' else 'quotation.revised' end,'quotation',p_id,jsonb_build_object('previous',to_jsonb(q),'previous_items',before_items,'new_id',new_id,'new_total_minor',v.total));
 return new_id;
end $$;
revoke all on function public.zep_edit_draft_invoice(uuid,uuid,timestamptz,date,text,jsonb,bigint,text,text,text) from public,anon,authenticated;
revoke all on function public.zep_edit_or_revise_quote(uuid,uuid,timestamptz,date,text,jsonb,bigint,text,text) from public,anon,authenticated;
grant execute on function public.zep_edit_draft_invoice(uuid,uuid,timestamptz,date,text,jsonb,bigint,text,text,text) to authenticated;
grant execute on function public.zep_edit_or_revise_quote(uuid,uuid,timestamptz,date,text,jsonb,bigint,text,text) to authenticated;
-- Keep identity immutable, relax only the draft-detail guard, and preserve issued terms.
do $patch$
declare f text; a text:='or new.currency is distinct from old.currency'; b text:='or new.notes is distinct from old.notes then';
begin
 select pg_get_functiondef('app_private.myzavo_quote_reference()'::regprocedure) into f;
 if strpos(f,a)=0 or strpos(f,b)=0 then raise exception 'Unexpected quote guard definition';end if;
 f:=replace(f,a,'or (old.status<>''draft'' and (new.currency is distinct from old.currency');
 f:=replace(f,b,'or new.notes is distinct from old.notes)) then');
 execute f;
end $patch$;
