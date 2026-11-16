-- Team membership and one-time invitations. Owners manage access; no service key in browser.
create table app_private.zep_team_invites(
 id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id),
 email text not null,role text not null check(role in ('admin','accountant','viewer')),token_hash bytea not null unique,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),expires_at timestamptz not null,
 accepted_at timestamptz,accepted_by uuid references auth.users(id),revoked_at timestamptz,
 check(not(accepted_at is not null and revoked_at is not null))
);
create index zep_invite_business_email on app_private.zep_team_invites(business_id,email);
alter table app_private.zep_team_invites enable row level security;
revoke all on app_private.zep_team_invites from public,anon,authenticated;
create function app_private.zep_require_owner(p_business uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.businesses b join public.business_members m on m.business_id=b.id and m.user_id=b.owner_id and m.role='owner' where b.id=p_business and b.owner_id=auth.uid()) then raise exception 'Only the business owner can manage team access';end if;
end $$;
create function public.zep_team_list(p_business_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();r text;members jsonb;invites jsonb;begin
 select m.role into r from public.business_members m where m.business_id=p_business_id and m.user_id=actor;
 if actor is null or r is null then raise exception 'Not authorised';end if;
 -- Ordinary members see only their own role; owner sees roster and invitation status.
 select coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'email',u.email,'role',m.role,'created_at',m.created_at) order by m.created_at),'[]'::jsonb) into members
 from public.business_members m join auth.users u on u.id=m.user_id where m.business_id=p_business_id and (r='owner' or m.user_id=actor);
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'email',i.email,'role',i.role,'expires_at',i.expires_at,'status',case when i.accepted_at is not null then 'accepted' when i.revoked_at is not null then 'revoked' when i.expires_at<=now() then 'expired' else 'pending' end) order by i.created_at desc),'[]'::jsonb) into invites from app_private.zep_team_invites i where i.business_id=p_business_id and r='owner';
 return jsonb_build_object('role',r,'members',members,'invites',invites);
end $$;
create function public.zep_team_invite(p_business_id uuid,p_email text,p_role text) returns text language plpgsql security definer set search_path='' as $$
declare e text:=lower(btrim(p_email)); token text;v uuid;begin
 perform app_private.zep_require_owner(p_business_id);
 if e is null or length(e)>254 or e !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_role is null or p_role not in ('admin','accountant','viewer') then raise exception 'Enter a valid email and team role';end if;
 perform pg_advisory_xact_lock(hashtextextended('zep-team:'||p_business_id::text,0));
 if exists(select 1 from public.business_members m join auth.users u on u.id=m.user_id where m.business_id=p_business_id and lower(u.email)=e) then raise exception 'This email is already a member';end if;
 update app_private.zep_team_invites set revoked_at=now() where business_id=p_business_id and email=e and accepted_at is null and revoked_at is null;
 token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into app_private.zep_team_invites(business_id,email,role,token_hash,created_by,expires_at) values(p_business_id,e,p_role,sha256(convert_to(token,'UTF8')),auth.uid(),now()+interval '7 days') returning id into v;
 insert into public.audit_events(business_id,actor_id,event_type,entity_type,entity_id,event_data) values(p_business_id,auth.uid(),'team.invited','team_invitation',v,jsonb_build_object('email',e,'role',p_role));
 return token;
end $$;
create function public.zep_team_accept(p_token text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();email_confirmed text;inv app_private.zep_team_invites%rowtype;bid uuid;begin
 if actor is null or p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Invalid or expired invitation';end if;
 select lower(u.email) into email_confirmed from auth.users u where u.id=actor and u.email_confirmed_at is not null and not u.is_anonymous;
 if email_confirmed is null then raise exception 'Sign in with a verified email address';end if;
 select business_id into bid from app_private.zep_team_invites where token_hash=sha256(convert_to(p_token,'UTF8'));
 if bid is null then raise exception 'Invalid or expired invitation';end if;
 perform pg_advisory_xact_lock(hashtextextended('zep-team:'||bid::text,0));
 select * into inv from app_private.zep_team_invites where token_hash=sha256(convert_to(p_token,'UTF8')) for update;
 if not found or inv.revoked_at is not null or inv.accepted_at is not null or inv.expires_at<=now() or inv.email<>email_confirmed then raise exception 'Invalid or expired invitation for this email';end if;
 if exists(select 1 from public.business_members where business_id=bid and user_id=actor) then raise exception 'Already a member of this business';end if;
 insert into public.business_members(business_id,user_id,role) values(bid,actor,inv.role);
 update app_private.zep_team_invites set accepted_at=now(),accepted_by=actor where id=inv.id;
 insert into public.audit_events(business_id,actor_id,event_type,entity_type,entity_id,event_data) values(bid,actor,'team.invitation_accepted','team_invitation',inv.id,jsonb_build_object('role',inv.role));return bid;
end $$;
create function public.zep_team_manage(p_business_id uuid,p_action text,p_target uuid,p_role text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare old_role text;begin
 perform app_private.zep_require_owner(p_business_id);
 if p_action is null or p_action not in ('change_role','remove','revoke') or nullif(btrim(p_reason),'') is null or length(p_reason)>500 then raise exception 'Action and reason required';end if;
 perform pg_advisory_xact_lock(hashtextextended('zep-team:'||p_business_id::text,0));
 if p_action='revoke' then
  update app_private.zep_team_invites set revoked_at=now() where business_id=p_business_id and id=p_target and accepted_at is null and revoked_at is null;
  if not found then raise exception 'Invitation unavailable';end if;
 else
  select role into old_role from public.business_members where business_id=p_business_id and user_id=p_target for update;
  if not found or old_role='owner' or p_target=auth.uid() then raise exception 'Owner membership cannot be changed';end if;
  if p_action='change_role' then
   if p_role is null or p_role not in ('admin','accountant','viewer') then raise exception 'Invalid team role';end if;
   update public.business_members set role=p_role where business_id=p_business_id and user_id=p_target;
  else
   delete from public.business_members where business_id=p_business_id and user_id=p_target;
  end if;
 end if;
 insert into public.audit_events(business_id,actor_id,event_type,entity_type,entity_id,event_data) values(p_business_id,auth.uid(),'team.'||p_action,case when p_action='revoke' then 'team_invitation' else 'team_member' end,p_target,jsonb_build_object('previous_role',old_role,'new_role',p_role,'reason',p_reason));
end $$;
revoke all on function app_private.zep_require_owner(uuid),public.zep_team_list(uuid),public.zep_team_invite(uuid,text,text),public.zep_team_accept(text),public.zep_team_manage(uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.zep_team_list(uuid),public.zep_team_invite(uuid,text,text),public.zep_team_accept(text),public.zep_team_manage(uuid,text,uuid,text,text) to authenticated;

-- Team events include email addresses. Only the owner can read them; other financial audit events retain existing access.
alter policy audit_events_read_member on public.audit_events using(exists(select 1 from public.business_members bm where bm.business_id=audit_events.business_id and bm.user_id=(select auth.uid()) and (audit_events.event_type not like 'team.%' or bm.role='owner')));
