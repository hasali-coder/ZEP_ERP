
create policy "contacts_insert_editor" on public.contacts
 for insert to authenticated with check (
  exists (
   select 1 from public.business_members bm
    where bm.business_id = contacts.business_id and bm.user_id = (select auth.uid())
    and bm.role in ('owner','admin','accountant')
  )
 );
create policy "contacts_update_editor" on public.contacts
 for update to authenticated using (
  exists (select 1 from public.business_members bm
   where bm.business_id = contacts.business_id and bm.user_id = (select auth.uid())
   and bm.role in ('owner','admin','accountant'))
 ) with check (
  exists (select 1 from public.business_members bm
   where bm.business_id = contacts.business_id and bm.user_id = (select auth.uid())
   and bm.role in ('owner','admin','accountant'))
 );
create policy "contacts_delete_editor" on public.contacts
 for delete to authenticated using (
  exists (select 1 from public.business_members bm
   where bm.business_id = contacts.business_id and bm.user_id = (select auth.uid())
   and bm.role in ('owner','admin','accountant'))
 );
;
