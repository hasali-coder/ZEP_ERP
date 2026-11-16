
drop policy if exists myzavo_logo_upload on storage.objects;
create policy myzavo_logo_upload on storage.objects
for insert to authenticated
with check (
 bucket_id='myzavo-business-logos'
 and split_part(objects.name,'/',1) ~ '^[0-9a-fA-F-]{36}$'
 and exists (
  select 1 from public.businesses biz
  where biz.id::text=split_part(objects.name,'/',1)
    and biz.owner_id=(select auth.uid())
 )
);
drop policy if exists myzavo_logo_delete on storage.objects;
create policy myzavo_logo_delete on storage.objects
for delete to authenticated
using (
 bucket_id='myzavo-business-logos'
 and exists(
   select 1 from public.businesses biz
   where biz.id::text=split_part(objects.name,'/',1)
     and biz.owner_id=(select auth.uid())
 )
);
;
