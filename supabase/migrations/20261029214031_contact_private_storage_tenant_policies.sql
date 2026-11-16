create policy "myzavo_contact_docs_read" on storage.objects for select to authenticated using (
bucket_id='myzavo-contact-documents' and exists (
select 1 from public.business_members bm where bm.business_id::text=split_part(name,'/',1) and bm.user_id=(select auth.uid()))
);
create policy "myzavo_contact_docs_upload" on storage.objects for insert to authenticated with check (
bucket_id='myzavo-contact-documents' and exists (
select 1 from public.business_members bm where bm.business_id::text=split_part(name,'/',1) and bm.user_id=(select auth.uid()) and bm.role in ('owner','admin','accountant'))
);
create policy "myzavo_contact_docs_delete" on storage.objects for delete to authenticated using (
bucket_id='myzavo-contact-documents' and exists (
select 1 from public.business_members bm where bm.business_id::text=split_part(name,'/',1) and bm.user_id=(select auth.uid()) and bm.role in ('owner','admin','accountant'))
);;
