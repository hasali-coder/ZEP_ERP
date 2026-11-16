
create table if not exists app_private.contact_role_audit (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null,
 contact_id uuid not null,
 previous_type text not null,
 new_type text not null,
 previous_code text,
 new_code text,
 changed_by uuid,
 changed_at timestamptz not null default now()
);
alter table app_private.contact_role_audit enable row level security;
revoke all on app_private.contact_role_audit from public,anon,authenticated;

create or replace function app_private.contact_identity_and_status()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare n bigint; old_code text; new_code text; role_changed boolean:=false;
begin
 if tg_op='INSERT' then
   if new.customer_code is not null or new.vendor_code is not null then
     raise exception 'Contact reference assigned by MyZavo';
   end if;
 else
   role_changed:=new.type is distinct from old.type;
   if new.customer_code is distinct from old.customer_code
      or new.vendor_code is distinct from old.vendor_code then
      raise exception 'Contact reference cannot be changed manually';
   end if;
   if role_changed then
     if new.type not in ('customer','supplier') then raise exception 'Invalid contact role';end if;
     if exists(select 1 from public.invoices where business_id=old.business_id and customer_id=old.id)
      or exists(select 1 from public.quotations where business_id=old.business_id and customer_id=old.id)
      or exists(select 1 from public.credit_notes where business_id=old.business_id and customer_id=old.id)
      or exists(select 1 from public.receipts where business_id=old.business_id and customer_id=old.id)
      or exists(select 1 from public.supplier_bills where business_id=old.business_id and supplier_id=old.id)
      or exists(select 1 from public.expenses where business_id=old.business_id and supplier_id=old.id)
      or exists(select 1 from public.financial_transactions where business_id=old.business_id and contact_id=old.id)
     then
       raise exception 'Contact role cannot change because financial records reference it. Create a separate supplier/customer record.';
     end if;
     old_code:=case when old.type='customer' then old.customer_code else old.vendor_code end;
     new.customer_code:=null;
     new.vendor_code:=null;
   end if;
 end if;
 if new.type='customer' and new.customer_code is null then
   insert into app_private.contact_code_counters(business_id,code_prefix,last_number)
   values(new.business_id,'CS',1)
   on conflict (business_id,code_prefix) do update set last_number=app_private.contact_code_counters.last_number+1
   returning last_number into n;
   new.customer_code:='CS'||lpad(n::text,6,'0');
 elsif new.type='supplier' and new.vendor_code is null then
   insert into app_private.contact_code_counters(business_id,code_prefix,last_number)
   values(new.business_id,'VD',1)
   on conflict (business_id,code_prefix) do update set last_number=app_private.contact_code_counters.last_number+1
   returning last_number into n;
   new.vendor_code:='VD'||lpad(n::text,6,'0');
 end if;
 if tg_op='INSERT' then
   new.deactivated_at:=case when new.is_active then null else now() end;
 elsif new.is_active is distinct from old.is_active then
   new.deactivated_at:=case when new.is_active then null else now() end;
 end if;
 if tg_op='UPDATE' and role_changed then
   new_code:=case when new.type='customer' then new.customer_code else new.vendor_code end;
   insert into app_private.contact_role_audit(business_id,contact_id,previous_type,new_type,previous_code,new_code,changed_by)
   values(old.business_id,old.id,old.type,new.type,old_code,new_code,(select auth.uid()));
 end if;
 return new;
end $fn$;
;
