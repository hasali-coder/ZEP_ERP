
alter table public.contacts add column if not exists nature_of_business text;
alter table public.contacts add column if not exists created_by uuid references auth.users(id);
alter table public.contacts add column if not exists created_by_label text;
update public.contacts set nature_of_business=notes where nature_of_business is null and notes is not null and btrim(notes)<>'';

create temporary table contact_role_split_backup on commit drop as
select * from public.contacts where customer_code is not null and vendor_code is not null;
alter table public.contacts disable trigger contacts_identity_status;
update public.contacts set
 vendor_code=case when type='supplier' then vendor_code else null end,
 customer_code=case when type='supplier' then null else customer_code end,
 type=case when type='supplier' then 'supplier' else 'customer' end
 where id in (select id from contact_role_split_backup);

insert into public.contacts(
 business_id,type,name,company_name,email,phone,address,city,country,tax_number,currency_preference,
 notes,nature_of_business,credit_terms_days,credit_limit_minor,created_at,updated_at,
 is_active,deactivated_at,customer_code,vendor_code,created_by,created_by_label)
select business_id,
 case when type='supplier' then 'customer' else 'supplier' end,
 name,company_name,email,phone,address,city,country,tax_number,currency_preference,
 notes,nature_of_business,credit_terms_days,credit_limit_minor,created_at,updated_at,
 is_active,deactivated_at,
 case when type='supplier' then customer_code else null end,
 case when type='supplier' then null else vendor_code end,
 created_by,created_by_label
from contact_role_split_backup;
alter table public.contacts enable trigger contacts_identity_status;
alter table public.contacts drop constraint if exists contacts_type_check;
alter table public.contacts add constraint contacts_type_check check (type in ('customer','supplier'));
alter table public.contacts add constraint contacts_role_code_integrity check(
 (type='customer' and customer_code is not null and vendor_code is null) or
 (type='supplier' and vendor_code is not null and customer_code is null));

create or replace function app_private.contact_creator_audit()
returns trigger language plpgsql security definer set search_path = ''
as $f$
declare actor uuid := (select auth.uid());
begin
 if tg_op='INSERT' then
  if actor is not null then
   new.created_by:=actor;
   select coalesce(nullif(btrim(p.full_name),''),u.email,'Account user')
     into new.created_by_label
   from auth.users u left join public.profiles p on p.id=u.id
   where u.id=actor;
  end if;
 else
  if new.created_by is distinct from old.created_by
     or new.created_by_label is distinct from old.created_by_label
     or new.created_at is distinct from old.created_at then
   raise exception 'Contact creation details are immutable';
  end if;
 end if;
 return new;
end;
$f$;
revoke all on function app_private.contact_creator_audit() from public,anon,authenticated;
drop trigger if exists contacts_creator_audit on public.contacts;
create trigger contacts_creator_audit before insert or update on public.contacts
for each row execute function app_private.contact_creator_audit();

create or replace function app_private.contact_identity_and_status()
returns trigger language plpgsql security definer set search_path = ''
as $f$
declare n bigint;
begin
 if tg_op='INSERT' then
  if new.customer_code is not null or new.vendor_code is not null then
   raise exception 'Contact reference assigned by MyZavo';
  end if;
 else
  if new.type is distinct from old.type then
   raise exception 'Contact role cannot change; create a separate customer or vendor record';
  end if;
  if new.customer_code is distinct from old.customer_code or
     new.vendor_code is distinct from old.vendor_code then
   raise exception 'Contact reference cannot be changed';
  end if;
 end if;
 if new.type='customer' and new.customer_code is null then
  insert into app_private.contact_code_counters(business_id,code_prefix,last_number)
  values(new.business_id,'CS',1)
  on conflict (business_id,code_prefix) do update
  set last_number=app_private.contact_code_counters.last_number+1
  returning last_number into n;
  new.customer_code:='CS'||lpad(n::text,6,'0');
 elsif new.type='supplier' and new.vendor_code is null then
  insert into app_private.contact_code_counters(business_id,code_prefix,last_number)
  values(new.business_id,'VD',1)
  on conflict (business_id,code_prefix) do update
  set last_number=app_private.contact_code_counters.last_number+1
  returning last_number into n;
  new.vendor_code:='VD'||lpad(n::text,6,'0');
 end if;
 if tg_op='INSERT' then
  new.deactivated_at:=case when new.is_active then null else now() end;
 elsif new.is_active is distinct from old.is_active then
  new.deactivated_at:=case when new.is_active then null else now() end;
 end if;
 return new;
end;
$f$;
revoke all on function app_private.contact_identity_and_status() from public,anon,authenticated;
;
