alter table public.contacts
add column if not exists credit_terms_days integer not null default 0
check (credit_terms_days between 0 and 365),
add column if not exists credit_limit_minor bigint check (credit_limit_minor is null or credit_limit_minor>=0);

create table if not exists public.contact_attachments (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id),
 contact_id uuid not null,
 storage_path text not null,
 file_name text not null,
 description text not null default '',
 mime_type text,
 byte_size bigint not null check (byte_size>=0 and byte_size<=10485760),
 uploaded_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 unique (storage_path),
 constraint contact_attachments_contact_scope_fk foreign key (business_id, contact_id) references public.contacts(business_id,id) on delete cascade,
 constraint contact_attachments_description_length check(length(description)<=1000)
);
create index if not exists contact_attachments_business_contact_idx on public.contact_attachments (business_id,contact_id);
alter table public.contact_attachments enable row level security;
create policy "contact_attachments_select" on public.contact_attachments for select to authenticated using (
 exists (select 1 from public.business_members bm where bm.business_id=contact_attachments.business_id and bm.user_id=(select auth.uid()))
);
create policy "contact_attachments_insert" on public.contact_attachments for insert to authenticated with check (
 uploaded_by=(select auth.uid()) and
 exists (select 1 from public.business_members bm where bm.business_id=contact_attachments.business_id and bm.user_id=(select auth.uid()) and bm.role in ('owner','admin','accountant'))
);
create policy "contact_attachments_update" on public.contact_attachments for update to authenticated using (
 exists (select 1 from public.business_members bm where bm.business_id=contact_attachments.business_id and bm.user_id=(select auth.uid()) and bm.role in ('owner','admin','accountant'))
) with check (
 exists (select 1 from public.business_members bm where bm.business_id=contact_attachments.business_id and bm.user_id=(select auth.uid()) and bm.role in ('owner','admin','accountant'))
);
create policy "contact_attachments_delete" on public.contact_attachments for delete to authenticated using (
 exists (select 1 from public.business_members bm where bm.business_id=contact_attachments.business_id and bm.user_id=(select auth.uid()) and bm.role in ('owner','admin','accountant'))
);
grant select,insert,update,delete on public.contact_attachments to authenticated;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('myzavo-contact-documents','myzavo-contact-documents',false,10485760,array['application/pdf','image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;;
