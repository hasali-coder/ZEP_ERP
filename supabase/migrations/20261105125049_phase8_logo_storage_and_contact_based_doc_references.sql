
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('myzavo-business-logos','myzavo-business-logos',false,2097152,array['image/png','image/jpeg']::text[])
on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=array['image/png','image/jpeg']::text[];

drop policy if exists myzavo_logo_read on storage.objects;
create policy myzavo_logo_read on storage.objects for select to authenticated
using(bucket_id='myzavo-business-logos' and exists (
 select 1 from public.business_members bm where bm.business_id::text=split_part(name,'/',1) and bm.user_id=(select auth.uid())
));
drop policy if exists myzavo_logo_upload on storage.objects;
create policy myzavo_logo_upload on storage.objects for insert to authenticated
with check(bucket_id='myzavo-business-logos' and exists (
 select 1 from public.businesses b where b.id::text=split_part(name,'/',1) and b.owner_id=(select auth.uid())
));
drop policy if exists myzavo_logo_delete on storage.objects;
create policy myzavo_logo_delete on storage.objects for delete to authenticated
using(bucket_id='myzavo-business-logos' and exists (
 select 1 from public.businesses b where b.id::text=split_part(name,'/',1) and b.owner_id=(select auth.uid())
));

create or replace function app_private.myzavo_contact_abbr(bid uuid,cid uuid)
returns text language plpgsql security definer set search_path='' as $f$
declare nm text; tokens text[]; abbreviation text;
begin
 select coalesce(nullif(btrim(c.company_name),''),c.name) into nm
 from public.contacts c where c.business_id=bid and c.id=cid;
 if nm is null then raise exception 'Document contact not found in business';end if;
 select array_agg(w) into tokens from regexp_split_to_table(regexp_replace(upper(nm),'[^A-Z0-9]+',' ','g'),' +') w where w<>'';
 if cardinality(tokens)=1 then abbreviation:=left(tokens[1],3);
 else
  select string_agg(left(t,1),'') into abbreviation from unnest(tokens[1:least(cardinality(tokens),3)]) t;
 end if;
 return coalesce(nullif(abbreviation,''),'ACC');
end $f$;
revoke all on function app_private.myzavo_contact_abbr(uuid,uuid) from public,anon,authenticated;

do $rename$
declare body text; frag text; dest text;
begin
 body:=pg_get_functiondef('app_private.myzavo_assign_invoice_reference()'::regprocedure);
 frag:='new.invoice_number:=''INV''||to_char(new.issue_date,''YYMM'')||lpad(n::text,greatest(3,length(n::text)),''0'');';
 dest:='new.invoice_number:=''INV-''||app_private.myzavo_contact_abbr(new.business_id,new.customer_id)||''-''||to_char(new.issue_date,''YYMM'')||''-''||lpad(n::text,greatest(3,length(n::text)),''0'');';
 if position(dest in body)=0 then
  if position(frag in body)=0 then raise exception 'Invoice numbering function changed unexpectedly: stopping';end if;
  execute replace(body,frag,dest);
 end if;

 body:=pg_get_functiondef('app_private.myzavo_quote_reference()'::regprocedure);
 frag:='new.quote_number:=''QTN''||to_char(new.issue_date,''YYMM'')||lpad(n::text,greatest(3,length(n::text)),''0'');';
 dest:='new.quote_number:=''QT-''||app_private.myzavo_contact_abbr(new.business_id,new.customer_id)||''-''||to_char(new.issue_date,''YYMM'')||''-''||lpad(n::text,greatest(3,length(n::text)),''0'');';
 if position(dest in body)=0 then
  if position(frag in body)=0 then raise exception 'Quotation numbering function changed unexpectedly: stopping';end if;
  execute replace(body,frag,dest);
 end if;

 body:=pg_get_functiondef('public.myzavo_collect_invoice_payment(uuid,bigint,text,text,date,text,text)'::regprocedure);
 frag:='v_receipt:=''RCP''||to_char(v_date,''YYMM'')||lpad(v_n::text,greatest(3,length(v_n::text)),''0'');';
 dest:='v_receipt:=''RCP-''||app_private.myzavo_contact_abbr(v_invoice.business_id,v_invoice.customer_id)||''-''||to_char(v_date,''YYMM'')||''-''||lpad(v_n::text,greatest(3,length(v_n::text)),''0'');';
 if position(dest in body)=0 then
  if position(frag in body)=0 then raise exception 'Receipt numbering function changed unexpectedly: stopping';end if;
  execute replace(body,frag,dest);
 end if;
end $rename$;
;
