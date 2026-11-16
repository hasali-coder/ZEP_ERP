-- Manual reconciliation. Statement entries are external evidence, not cash postings.
create table public.zep_cash_accounts(
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
 name text not null check(length(trim(name)) between 1 and 100), kind text not null check(kind in ('cash','bank','mpesa','other')),
 currency varchar(3) not null check(currency ~ '^[A-Z]{3}$'), created_at timestamptz not null default now(),
 unique(business_id,id),unique(business_id,name,currency)
);
create table public.zep_statement_lines(
 id uuid primary key default gen_random_uuid(), business_id uuid not null,
 account_id uuid not null, statement_date date not null, direction text not null check(direction in ('in','out')),
 amount_minor bigint not null check(amount_minor>0), reference_number text, description text not null,
 transaction_id uuid, matched_by uuid references auth.users(id), matched_at timestamptz,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 discarded_at timestamptz, discard_reason text, request_key text not null,
 foreign key(business_id,account_id) references public.zep_cash_accounts(business_id,id),
 foreign key(business_id,transaction_id) references public.financial_transactions(business_id,id),
 unique(business_id,request_key),unique(business_id,transaction_id),
 check((transaction_id is null and matched_by is null and matched_at is null) or (transaction_id is not null and matched_by is not null and matched_at is not null)),
 check(discarded_at is null or transaction_id is null)
);
create index zep_statement_account_date on public.zep_statement_lines(business_id,account_id,statement_date);
alter table public.zep_cash_accounts enable row level security;
alter table public.zep_statement_lines enable row level security;
revoke all on public.zep_cash_accounts,public.zep_statement_lines from public,anon,authenticated;
grant select on public.zep_cash_accounts,public.zep_statement_lines to authenticated;
create policy zep_accounts_read on public.zep_cash_accounts for select to authenticated using(exists(select 1 from public.business_members m where m.business_id=zep_cash_accounts.business_id and m.user_id=(select auth.uid())));
create policy zep_statements_read on public.zep_statement_lines for select to authenticated using(exists(select 1 from public.business_members m where m.business_id=zep_statement_lines.business_id and m.user_id=(select auth.uid())));
create function public.zep_create_cash_account(p_business_id uuid,p_name text,p_kind text,p_currency text) returns uuid language plpgsql security definer set search_path='' as $$
declare v uuid;begin
 perform app_private.myzavo_require_finance_role(p_business_id);
 insert into public.zep_cash_accounts(business_id,name,kind,currency) values(p_business_id,btrim(p_name),p_kind,p_currency) returning id into v;
 insert into public.audit_events(business_id,actor_id,event_type,entity_type,entity_id,event_data) values(p_business_id,auth.uid(),'reconciliation.account_created','cash_account',v,jsonb_build_object('name',p_name,'currency',p_currency));return v;
end $$;
create function public.zep_add_statement_line(p_business_id uuid,p_account_id uuid,p_date date,p_direction text,p_amount bigint,p_reference text,p_description text,p_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare v uuid;old public.zep_statement_lines%rowtype;ref text:=nullif(btrim(p_reference),'');descr text:=btrim(p_description);begin
 perform app_private.myzavo_require_finance_role(p_business_id);
 if not exists(select 1 from public.zep_cash_accounts where business_id=p_business_id and id=p_account_id) then raise exception 'Account not found';end if;
 if p_date is null or p_date>(now() at time zone 'Africa/Nairobi')::date or p_amount is null or p_amount not between 1 and 1000000000000 or p_direction is null or p_direction not in ('in','out') or nullif(descr,'') is null or length(descr)>500 or length(ref)>200 or nullif(btrim(p_key),'') is null or length(p_key)>128 then raise exception 'Invalid statement entry';end if;
 perform pg_advisory_xact_lock(hashtextextended('zep-reconcile:'||p_business_id::text,0));
 select * into old from public.zep_statement_lines where business_id=p_business_id and request_key=p_key;
 if found then if old.account_id<>p_account_id or old.statement_date<>p_date or old.direction<>p_direction or old.amount_minor<>p_amount or old.reference_number is distinct from ref or old.description<>descr then raise exception 'Request key already used';end if;return old.id;end if;
 if ref is not null and exists(select 1 from public.zep_statement_lines where business_id=p_business_id and account_id=p_account_id and statement_date=p_date and direction=p_direction and amount_minor=p_amount and reference_number=ref and discarded_at is null) then raise exception 'Duplicate statement entry';end if;
 insert into public.zep_statement_lines(business_id,account_id,statement_date,direction,amount_minor,reference_number,description,created_by,request_key) values(p_business_id,p_account_id,p_date,p_direction,p_amount,ref,descr,auth.uid(),p_key) returning id into v;
 insert into public.audit_events(business_id,actor_id,event_type,entity_type,entity_id,event_data) values(p_business_id,auth.uid(),'reconciliation.statement_entered','statement_line',v,jsonb_build_object('amount_minor',p_amount,'account_id',p_account_id));return v;
end $$;
create function public.zep_reconcile_line(p_business_id uuid,p_line_id uuid,p_action text,p_transaction_id uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare l public.zep_statement_lines%rowtype;a public.zep_cash_accounts%rowtype;t public.financial_transactions%rowtype;begin
 perform app_private.myzavo_require_finance_role(p_business_id);
 if p_action is null or p_action not in ('match','unmatch','discard') or nullif(btrim(p_reason),'') is null or length(p_reason)>500 then raise exception 'Action and reason required';end if;
 perform pg_advisory_xact_lock(hashtextextended('zep-reconcile:'||p_business_id::text,0));
 select * into l from public.zep_statement_lines where business_id=p_business_id and id=p_line_id for update;
 if not found or l.discarded_at is not null then raise exception 'Statement entry unavailable';end if;
 select * into a from public.zep_cash_accounts where business_id=p_business_id and id=l.account_id;
 if p_action='match' then
  if l.transaction_id=p_transaction_id then return;end if;
  if l.transaction_id is not null then raise exception 'Unmatch existing transaction first';end if;
  select * into t from public.financial_transactions where id=p_transaction_id and business_id=p_business_id for update;
  if not found or t.status<>'posted' or t.currency<>a.currency or t.direction<>l.direction or t.amount_minor<>l.amount_minor then raise exception 'Select a posted transaction with matching currency, direction and amount';end if;
  if exists(select 1 from public.zep_statement_lines where business_id=p_business_id and transaction_id=t.id) then raise exception 'Transaction already matched';end if;
  update public.zep_statement_lines set transaction_id=t.id,matched_by=auth.uid(),matched_at=now() where id=l.id;
 elsif p_action='unmatch' then
  if l.transaction_id is null then raise exception 'Entry is not matched';end if;
  update public.zep_statement_lines set transaction_id=null,matched_by=null,matched_at=null where id=l.id;
 else
  if l.transaction_id is not null then raise exception 'Unmatch before discarding';end if;
  update public.zep_statement_lines set discarded_at=now(),discard_reason=btrim(p_reason) where id=l.id;
 end if;
 insert into public.audit_events(business_id,actor_id,event_type,entity_type,entity_id,event_data) values(p_business_id,auth.uid(),'reconciliation.'||p_action,'statement_line',l.id,jsonb_build_object('reason',p_reason,'previous_transaction_id',l.transaction_id,'transaction_id',p_transaction_id));
end $$;
revoke all on function public.zep_create_cash_account(uuid,text,text,text),public.zep_add_statement_line(uuid,uuid,date,text,bigint,text,text,text),public.zep_reconcile_line(uuid,uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.zep_create_cash_account(uuid,text,text,text),public.zep_add_statement_line(uuid,uuid,date,text,bigint,text,text,text),public.zep_reconcile_line(uuid,uuid,text,uuid,text) to authenticated;
-- Live matching candidates by amount, direction, currency; no account is inferred from payment method.
create function public.zep_reconciliation_candidates(p_business_id uuid,p_line_id uuid)
returns table(id uuid,payment_date date,reference_number text,description text,amount_minor bigint) language sql stable security invoker set search_path='' as $$
 select t.id,t.payment_date,t.reference_number,t.description,t.amount_minor from public.zep_statement_lines l join public.zep_cash_accounts a on a.business_id=l.business_id and a.id=l.account_id join public.financial_transactions t on t.business_id=l.business_id and t.currency=a.currency and t.direction=l.direction and t.amount_minor=l.amount_minor
 where l.business_id=p_business_id and l.id=p_line_id and l.discarded_at is null and l.transaction_id is null and t.status='posted' and not exists(select 1 from public.zep_statement_lines z where z.business_id=p_business_id and z.transaction_id=t.id) order by abs(t.payment_date-l.statement_date),t.id limit 200;
$$;
revoke all on function public.zep_reconciliation_candidates(uuid,uuid) from public,anon,authenticated;
grant execute on function public.zep_reconciliation_candidates(uuid,uuid) to authenticated;
-- Prevent changes that would invalidate an established match. Unmatch first.
create function app_private.zep_guard_matched_transaction() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (new.status,new.currency,new.direction,new.amount_minor,new.payment_date) is distinct from (old.status,old.currency,old.direction,old.amount_minor,old.payment_date) and exists(select 1 from public.zep_statement_lines l where l.business_id=old.business_id and l.transaction_id=old.id) then raise exception 'Unmatch the reconciled transaction before changing its financial details';end if;
 return new;
end $$;
revoke all on function app_private.zep_guard_matched_transaction() from public,anon,authenticated;
create trigger zep_guard_matched_transaction before update on public.financial_transactions for each row execute function app_private.zep_guard_matched_transaction();
create function public.zep_unmatched_ledger(p_business_id uuid,p_currency text,p_from date,p_to date)
returns table(id uuid,payment_date date,reference_number text,description text,amount_minor bigint,direction text) language sql stable security invoker set search_path='' as $$
 select t.id,t.payment_date,t.reference_number,t.description,t.amount_minor,t.direction from public.financial_transactions t
 where t.business_id=p_business_id and t.currency=p_currency and t.payment_date between p_from and p_to and t.status='posted' and not exists(select 1 from public.zep_statement_lines l where l.business_id=t.business_id and l.transaction_id=t.id) order by t.payment_date desc,t.id limit 501;
$$;
revoke all on function public.zep_unmatched_ledger(uuid,text,date,date) from public,anon,authenticated;
grant execute on function public.zep_unmatched_ledger(uuid,text,date,date) to authenticated;
