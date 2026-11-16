
create or replace function public.myzavo_issue_invoice(p_invoice_id uuid)
returns void language plpgsql security definer set search_path='' as $f$
declare v_actor uuid:=(select auth.uid()); v_invoice public.invoices%rowtype;
begin
 if v_actor is null then raise exception 'Sign-in required'; end if;
 select * into v_invoice from public.invoices i where i.id=p_invoice_id for update;
 if not found then raise exception 'Invoice not found';end if;
 if not exists (select 1 from public.business_members bm where bm.business_id=v_invoice.business_id and bm.user_id=v_actor and bm.role in ('owner','admin','accountant')) then
  raise exception 'Not authorised';end if;
 if v_invoice.status<>'draft' then raise exception 'Only draft invoices can be issued';end if;
 if not exists (select 1 from public.invoice_items li where li.invoice_id=p_invoice_id and li.business_id=v_invoice.business_id) then
  raise exception 'Draft has no line items';end if;
 update public.invoices set status='sent',issued_at=now() where id=p_invoice_id;
end $f$;
revoke all on function public.myzavo_issue_invoice(uuid) from public,anon;
grant execute on function public.myzavo_issue_invoice(uuid) to authenticated;

create table if not exists app_private.quotation_month_counters(
  business_id uuid not null references public.businesses(id) on delete restrict,
  year_month integer not null check(year_month between 200001 and 999912),
  last_number bigint not null default 0 check(last_number>=0),
  primary key(business_id,year_month)
);
alter table app_private.quotation_month_counters enable row level security;
revoke all on app_private.quotation_month_counters from public,anon,authenticated;
alter table public.quotations
 add column if not exists issued_at timestamptz,
 add column if not exists created_by uuid references auth.users(id),
 add column if not exists business_snapshot jsonb,
 add column if not exists customer_snapshot jsonb;
create or replace function app_private.myzavo_quote_reference()
returns trigger language plpgsql security definer set search_path='' as $f$
declare n bigint;
begin
 if tg_op='INSERT' then
  if new.quote_number is not null and new.quote_number<>'' then
    raise exception 'Quote reference assigned automatically';end if;
  insert into app_private.quotation_month_counters(business_id,year_month,last_number)
  values(new.business_id,to_char(new.issue_date,'YYYYMM')::integer,1)
  on conflict(business_id,year_month) do update set last_number=app_private.quotation_month_counters.last_number+1
  returning last_number into n;
  new.quote_number:='QTN'||to_char(new.issue_date,'YYMM')||lpad(n::text,greatest(3,length(n::text)),'0');
  new.created_by:=(select auth.uid());
  if new.status='sent' then new.issued_at:=now();end if;
 else
  if new.quote_number is distinct from old.quote_number
   or new.created_by is distinct from old.created_by
   or new.business_id is distinct from old.business_id
   or new.customer_id is distinct from old.customer_id
   or new.issue_date is distinct from old.issue_date
   or new.currency is distinct from old.currency
   or new.total_minor is distinct from old.total_minor
   or new.subtotal_minor is distinct from old.subtotal_minor
   or new.discount_minor is distinct from old.discount_minor
   or new.tax_minor is distinct from old.tax_minor
   or new.business_snapshot is distinct from old.business_snapshot
   or new.customer_snapshot is distinct from old.customer_snapshot
   or new.expiry_date is distinct from old.expiry_date
   or new.notes is distinct from old.notes then
    raise exception 'Issued quote details are immutable in this release';end if;
 end if;
 return new;
end $f$;
revoke all on function app_private.myzavo_quote_reference() from public,anon,authenticated;
drop trigger if exists myzavo_quote_reference_trigger on public.quotations;
create trigger myzavo_quote_reference_trigger before insert or update on public.quotations
for each row execute function app_private.myzavo_quote_reference();

revoke insert,update,delete on public.quotations from anon,authenticated;
revoke insert,update,delete on public.quotation_items from anon,authenticated;

create or replace function public.myzavo_create_quotation(
 p_business_id uuid,p_customer_id uuid,p_issue_date date,p_expiry_date date,p_currency text,p_items jsonb,
 p_global_discount_minor bigint default 0,p_notes text default null,p_status text default 'sent'
) returns table(id uuid,quote_number text,total_minor bigint)
language plpgsql security definer set search_path='' as $f$
declare actor uuid:=(select auth.uid()); b public.businesses%rowtype; c public.contacts%rowtype;
 line jsonb; q numeric; price bigint; discount numeric; tax numeric; net numeric;
 sub numeric:=0;tax_sum numeric:=0; v_discount bigint:=coalesce(p_global_discount_minor,0);
 v_total bigint; v_id uuid; v_num text; pos integer:=0;
begin
 if actor is null then raise exception 'Sign-in required';end if;
 if not exists (select 1 from public.business_members bm where bm.business_id=p_business_id and bm.user_id=actor and bm.role in ('owner','admin','accountant')) then
  raise exception 'Not authorised';end if;
 select * into b from public.businesses x where x.id=p_business_id;
 if not found then raise exception 'Business not found';end if;
 select * into c from public.contacts x where x.id=p_customer_id and x.business_id=p_business_id and x.type='customer' and x.is_active=true;
 if not found then raise exception 'Select an active customer';end if;
 if p_issue_date is null or p_expiry_date is null or p_expiry_date<p_issue_date then raise exception 'Invalid quote dates';end if;
 if p_currency is null or p_currency !~ '^[A-Z]{3}$' then raise exception 'Invalid currency';end if;
 if p_status not in ('sent','draft') then raise exception 'Invalid initial status';end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100 then
  raise exception 'Quotation requires 1 to 100 items';end if;
 for line in select value from jsonb_array_elements(p_items) loop
  q:=(line->>'quantity')::numeric;price:=(line->>'unit_price_minor')::bigint;
  discount:=coalesce((line->>'discount_percent')::numeric,0);
  tax:=coalesce((line->>'tax_rate_percent')::numeric,0);
  if nullif(btrim(line->>'description'),'') is null or q<=0 or q>1000000 or price<0 or price>100000000000 or
   discount<0 or discount>100 or tax<0 or tax>100 then raise exception 'Invalid quotation line';end if;
  sub:=sub+round(round(q*price,0)*(100-discount)/100,0);
 end loop;
 if sub>1000000000000 or v_discount<0 or v_discount>sub then raise exception 'Invalid discount';end if;
 for line in select value from jsonb_array_elements(p_items) loop
  q:=(line->>'quantity')::numeric;price:=(line->>'unit_price_minor')::bigint;
  discount:=coalesce((line->>'discount_percent')::numeric,0); tax:=coalesce((line->>'tax_rate_percent')::numeric,0);
  net:=round(round(q*price,0)*(100-discount)/100,0);
  if sub>0 then tax_sum:=tax_sum+round(net*(sub-v_discount)/sub*tax/100,0);end if;
 end loop;
 v_total:=(sub-v_discount+tax_sum)::bigint;
 insert into public.quotations(
 business_id,customer_id,quote_number,issue_date,expiry_date,currency,subtotal_minor,
 discount_minor,tax_minor,total_minor,status,notes,business_snapshot,customer_snapshot)
 values(p_business_id,p_customer_id,'',p_issue_date,p_expiry_date,p_currency,
 sub::bigint,v_discount,tax_sum::bigint,v_total,p_status,p_notes,
 jsonb_build_object('name',b.name,'email',b.email,'phone',b.phone,'address',b.address,
 'city',b.city,'country',b.country,'tax_number',b.tax_number,'logo_path',b.logo_path),
 jsonb_build_object('name',c.name,'company_name',c.company_name,'email',c.email,'phone',c.phone,
 'address',c.address,'city',c.city,'country',c.country,'tax_number',c.tax_number))
 returning quotations.id,quotations.quote_number into v_id,v_num;
 for line in select value from jsonb_array_elements(p_items) loop
 insert into public.quotation_items(business_id,quotation_id,position,description,quantity,unit_price_minor,tax_rate_percent,discount_percent)
 values(p_business_id,v_id,pos,btrim(line->>'description'),(line->>'quantity')::numeric,
 (line->>'unit_price_minor')::bigint,coalesce((line->>'tax_rate_percent')::numeric,0),
 coalesce((line->>'discount_percent')::numeric,0));
 pos:=pos+1;
 end loop;
 id:=v_id;quote_number:=v_num;total_minor:=v_total;return next;
end $f$;
revoke all on function public.myzavo_create_quotation(uuid,uuid,date,date,text,jsonb,bigint,text,text) from public,anon;
grant execute on function public.myzavo_create_quotation(uuid,uuid,date,date,text,jsonb,bigint,text,text) to authenticated;

create or replace function public.myzavo_set_quote_status(p_quote_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $f$
declare actor uuid:=(select auth.uid());q public.quotations%rowtype;
begin
 if actor is null then raise exception 'Sign-in required';end if;
 select * into q from public.quotations x where x.id=p_quote_id for update;
 if not found then raise exception 'Quotation not found';end if;
 if not exists(select 1 from public.business_members bm where bm.business_id=q.business_id and bm.user_id=actor and bm.role in ('owner','admin','accountant')) then
  raise exception 'Not authorised';end if;
 if not ((q.status='draft' and p_status='sent') or
         (q.status='sent' and p_status in ('accepted','declined'))) then
  raise exception 'Unsupported status transition';end if;
 if q.status='draft' and not exists(select 1 from public.quotation_items li where li.quotation_id=q.id and li.business_id=q.business_id) then
  raise exception 'Quotation has no line items';end if;
 update public.quotations set status=p_status,issued_at=case when p_status='sent' then now() else issued_at end where id=q.id;
end $f$;
revoke all on function public.myzavo_set_quote_status(uuid,text) from public,anon;
grant execute on function public.myzavo_set_quote_status(uuid,text) to authenticated;
;
