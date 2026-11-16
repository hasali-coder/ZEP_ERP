
create table if not exists app_private.contact_code_counters (
  business_id uuid not null references public.businesses(id) on delete restrict,
  code_prefix text not null check (code_prefix in ('CS','VD')),
  last_number bigint not null default 0 check (last_number >= 0),
  primary key (business_id,code_prefix)
);
alter table app_private.contact_code_counters enable row level security;
revoke all on app_private.contact_code_counters from public, anon, authenticated;

alter table public.contacts
  add column if not exists customer_code text,
  add column if not exists vendor_code text,
  add column if not exists is_active boolean not null default true,
  add column if not exists deactivated_at timestamptz;

create unique index if not exists contacts_business_customer_code_uniq on public.contacts (business_id,customer_code) where customer_code is not null;
create unique index if not exists contacts_business_vendor_code_uniq on public.contacts (business_id,vendor_code) where vendor_code is not null;

create or replace function app_private.contact_identity_and_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $func$
declare n bigint;
begin
  if tg_op='INSERT' then
    if new.customer_code is not null or new.vendor_code is not null then
      raise exception 'Contact references are assigned by MyZavo';
    end if;
  else
    if new.customer_code is distinct from old.customer_code
       or new.vendor_code is distinct from old.vendor_code then
      raise exception 'Contact references cannot be modified';
    end if;
  end if;

  if new.type in ('customer','both') and new.customer_code is null then
    insert into app_private.contact_code_counters (business_id,code_prefix,last_number)
      values (new.business_id,'CS',1)
      on conflict (business_id,code_prefix)
      do update set last_number=app_private.contact_code_counters.last_number+1
      returning last_number into n;
    new.customer_code := 'CS' || lpad(n::text,6,'0');
  end if;
  if new.type in ('supplier','both') and new.vendor_code is null then
    insert into app_private.contact_code_counters (business_id,code_prefix,last_number)
      values (new.business_id,'VD',1)
      on conflict (business_id,code_prefix)
      do update set last_number=app_private.contact_code_counters.last_number+1
      returning last_number into n;
    new.vendor_code := 'VD' || lpad(n::text,6,'0');
  end if;

  if tg_op='INSERT' then
    if new.is_active = false then
      new.deactivated_at := now();
    else
      new.deactivated_at := null;
    end if;
  elsif new.is_active is distinct from old.is_active then
    new.deactivated_at := case when new.is_active then null else now() end;
  end if;
  return new;
end;
$func$;
revoke all on function app_private.contact_identity_and_status() from public, anon, authenticated;
drop trigger if exists contacts_identity_status on public.contacts;
create trigger contacts_identity_status before insert or update on public.contacts
 for each row execute function app_private.contact_identity_and_status();

-- Backfill references for existing contacts without changing their information.
update public.contacts set type=type where (type in ('customer','both') and customer_code is null)
 or (type in ('supplier','both') and vendor_code is null);

drop policy if exists contacts_delete_editor on public.contacts;
revoke delete on public.contacts from anon, authenticated;
;
