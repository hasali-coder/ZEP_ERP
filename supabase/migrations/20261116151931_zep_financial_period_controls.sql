-- Monthly financial periods. Database guards protect the existing posting RPCs.
create table public.zep_financial_periods(
 business_id uuid not null references public.businesses(id), month_start date not null,
 status text not null check(status in ('open','closed')), reason text not null,
 changed_by uuid not null references auth.users(id),changed_at timestamptz not null default now(),
 primary key(business_id,month_start),check(extract(day from month_start)=1)
);
alter table public.zep_financial_periods enable row level security;
revoke all on public.zep_financial_periods from public,anon,authenticated;
grant select on public.zep_financial_periods to authenticated;
create policy zep_period_read on public.zep_financial_periods for select to authenticated using(exists(select 1 from public.business_members m where m.business_id=zep_financial_periods.business_id and m.user_id=(select auth.uid())));
create function app_private.zep_assert_open(p_business uuid,p_date date) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_date is null then return;end if;
 perform pg_advisory_xact_lock(hashtextextended('zep-financial-period:'||p_business::text,0));
 if exists(select 1 from public.zep_financial_periods where business_id=p_business and month_start=date_trunc('month',p_date::timestamp)::date and status='closed') then raise exception 'Financial period % is closed',to_char(p_date,'YYYY-MM') using errcode='P0001';end if;
end $$;
create function public.zep_set_financial_period(p_business_id uuid,p_month date,p_status text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();r text;old_status text;begin
 select role into r from public.business_members where business_id=p_business_id and user_id=actor;
 if actor is null or r is null or r not in ('owner','admin') or (p_status='open' and r<>'owner') then raise exception 'Not authorised to change financial period';end if;
 if p_month is null or extract(day from p_month)<>1 or p_month>=date_trunc('month',(now() at time zone 'Africa/Nairobi'))::date or p_status is null or p_status not in ('open','closed') or nullif(btrim(p_reason),'') is null or length(p_reason)>1000 then raise exception 'Choose a completed month and provide a reason';end if;
 perform pg_advisory_xact_lock(hashtextextended('zep-financial-period:'||p_business_id::text,0));
 select status into old_status from public.zep_financial_periods where business_id=p_business_id and month_start=p_month;
 if coalesce(old_status,'open')=p_status then raise exception 'Period is already %',p_status;end if;
 if p_status='closed' and exists(select 1 from public.recurring_expenses x where x.business_id=p_business_id and x.status='active' and x.next_due_date<(p_month+interval '1 month')::date) then raise exception 'Generate outstanding recurring dues before closing this month';end if;
 insert into public.zep_financial_periods(business_id,month_start,status,reason,changed_by,changed_at) values(p_business_id,p_month,p_status,btrim(p_reason),actor,now()) on conflict(business_id,month_start) do update set status=excluded.status,reason=excluded.reason,changed_by=excluded.changed_by,changed_at=excluded.changed_at;
 insert into public.audit_events(business_id,actor_id,event_type,entity_type,event_data) values(p_business_id,actor,'financial_period.'||p_status,'financial_period',jsonb_build_object('month',p_month,'reason',p_reason,'previous',coalesce(old_status,'open')));
end $$;
revoke all on function app_private.zep_assert_open(uuid,date),public.zep_set_financial_period(uuid,date,text,text) from public,anon,authenticated;
grant execute on function public.zep_set_financial_period(uuid,date,text,text) to authenticated;
-- A record's effective posting date; allocation date differs from original receipt date for later credits.
create function app_private.zep_guard_financial_row() returns trigger language plpgsql security definer set search_path='' as $$
declare j jsonb; oldj jsonb;newj jsonb; b uuid;d date; source_date date; parent_status text; k int;
begin
 if tg_op<>'INSERT' then oldj:=to_jsonb(old);end if;
 if tg_op<>'DELETE' then newj:=to_jsonb(new);end if;
 -- Payments against older invoices/bills are allowed in an open payment period.
 -- Their cash and allocation rows have independent posting-date guards.
 if tg_op='UPDATE' and tg_table_name in ('invoices','supplier_bills') then
  if oldj->>'status' in ('sent','partially_paid','paid','overdue','unpaid') and newj->>'status' in ('sent','partially_paid','paid','overdue','unpaid') and
     (oldj - array['amount_paid_minor','balance_due_minor','status','updated_at'])=(newj - array['amount_paid_minor','balance_due_minor','status','updated_at']) then return new;end if;
 end if;
 for k in 1..2 loop
  j:=case when k=1 then oldj else newj end;
  if j is null then continue;end if;
  b:=(j->>'business_id')::uuid;d:=null;source_date:=null;parent_status:=null;
  case tg_table_name
   when 'invoices' then
    if j->>'status'<>'draft' then d:=(j->>'issue_date')::date;end if;
    if j->>'status'='cancelled' then perform app_private.zep_assert_open(b,coalesce(((j->>'cancelled_at')::timestamptz at time zone 'Africa/Nairobi')::date,(now() at time zone 'Africa/Nairobi')::date));end if;
   when 'invoice_items' then
    select i.issue_date,i.status into d,parent_status from public.invoices i where i.business_id=b and i.id=(j->>'invoice_id')::uuid;
    if parent_status='draft' then d:=null;end if;
   when 'supplier_bills' then d:=(j->>'issue_date')::date;
   when 'expenses' then d:=(j->>'expense_date')::date;
   when 'financial_transactions' then d:=(j->>'payment_date')::date;
   when 'credit_notes' then d:=(j->>'issue_date')::date;
   when 'payment_allocations' then
    select t.payment_date into source_date from public.financial_transactions t where t.business_id=b and t.id=(j->>'transaction_id')::uuid;
    d:=coalesce((j->>'credit_applied_on')::date,source_date);
   when 'receipts' then
    select t.payment_date into d from public.financial_transactions t where t.business_id=b and t.id=(j->>'transaction_id')::uuid;
   when 'zep_customer_credit_events' then d:=(j->>'operation_date')::date;
   when 'zep_statement_lines' then
    d:=(j->>'statement_date')::date;
    if j->>'transaction_id' is not null then
     select t.payment_date into source_date from public.financial_transactions t where t.business_id=b and t.id=(j->>'transaction_id')::uuid;
     perform app_private.zep_assert_open(b,source_date);
    end if;
   when 'recurring_expense_dues' then
    -- New scheduled obligations in past closed months are not silently added.
    -- Settlement keeps the due date fixed; the posted expense and cash dates are guarded.
    if tg_op='UPDATE' and oldj->>'status'='pending' and newj->>'status'='paid' and oldj->>'due_date'=newj->>'due_date' then d:=null;else d:=(j->>'due_date')::date;end if;
   else raise exception 'Unhandled financial period guard: %',tg_table_name;
  end case;
  perform app_private.zep_assert_open(b,d);
 end loop;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function app_private.zep_guard_financial_row() from public,anon,authenticated;
do $triggers$
declare t text;begin
 foreach t in array array['invoices','invoice_items','supplier_bills','expenses','financial_transactions','credit_notes','payment_allocations','receipts','zep_customer_credit_events','zep_statement_lines','recurring_expense_dues'] loop
  execute format('create trigger zep_financial_period_guard before insert or update or delete on public.%I for each row execute function app_private.zep_guard_financial_row()',t);
 end loop;
end $triggers$;

-- Block creation or resumption of schedules that would generate new dues in closed months.
create function app_private.zep_guard_recurring_schedule() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='active' and (tg_op='INSERT' or old.status is distinct from new.status) then
  perform pg_advisory_xact_lock(hashtextextended('zep-financial-period:'||new.business_id::text,0));
  if exists(select 1 from public.zep_financial_periods p where p.business_id=new.business_id and p.status='closed' and p.month_start<=date_trunc('month',(now() at time zone 'Africa/Nairobi'))::date and (p.month_start+interval '1 month')::date>new.next_due_date) then raise exception 'Reopen affected periods before generating backdated recurring obligations';end if;
 end if;
 return new;
end $$;
revoke all on function app_private.zep_guard_recurring_schedule() from public,anon,authenticated;
create trigger zep_recurring_schedule_period_guard before insert or update on public.recurring_expenses for each row execute function app_private.zep_guard_recurring_schedule();
-- Historical receivable and payable snapshots use posting dates, not today's balances.
do $patch$
declare
    f text;
    a text;
    b text;
    c text;
begin

    select pg_get_functiondef(
        'public.myzavo_report_summary(uuid,date,date)'::regprocedure
    ) into f;

    a := $rx$[(]select[[:space:]]+coalesce[(]sum[(]i[.]balance_due_minor[)],0[)][[:space:]]+from[[:space:]]+public[.]invoices[[:space:]]+i[[:space:]]+where[[:space:]]+i[.]business_id=p_business_id[[:space:]]+and[[:space:]]+i[.]currency=cs[.]currency[[:space:]]+and[[:space:]]+i[.]issue_date<=p_to[[:space:]]+and[[:space:]]+i[.]status[[:space:]]+not[[:space:]]+in[(]'draft','cancelled','paid'[)][)][[:space:]]+as[[:space:]]+receivables_minor$rx$;

    b := $rx$[(]select[[:space:]]+coalesce[(]sum[(]b[.]balance_due_minor[)],0[)][[:space:]]+from[[:space:]]+public[.]supplier_bills[[:space:]]+b[[:space:]]+where[[:space:]]+b[.]business_id=p_business_id[[:space:]]+and[[:space:]]+b[.]currency=cs[.]currency[[:space:]]+and[[:space:]]+b[.]issue_date<=p_to[[:space:]]+and[[:space:]]+b[.]status<>'paid'[)][[:space:]]+as[[:space:]]+payables_minor$rx$;

    c := $rx$union[[:space:]]+select[[:space:]]+cn[.]currency[[:space:]]+from[[:space:]]+public[.]credit_notes[[:space:]]+cn[[:space:]]+where[[:space:]]+cn[.]business_id=p_business_id$rx$;

    if (select count(*) from regexp_matches(f,a,'g')) <> 1 then
        raise exception 'Receivables report anchor mismatch';
    end if;

    if (select count(*) from regexp_matches(f,b,'g')) <> 1 then
        raise exception 'Payables report anchor mismatch';
    end if;

    if (select count(*) from regexp_matches(f,c,'g')) <> 1 then
        raise exception 'Report currency anchor mismatch';
    end if;

    f := regexp_replace(
        f,
        a,
        '(select coalesce(sum(x.outstanding_minor),0)
        from public.myzavo_ar_ageing_as_of(p_business_id,p_to) x
        where x.currency=cs.currency) as receivables_minor'
    );

    f := regexp_replace(
        f,
        b,
        '(select coalesce(sum(x.outstanding_minor),0)
        from public.myzavo_ap_ageing_as_of(p_business_id,p_to) x
        where x.currency=cs.currency) as payables_minor'
    );

    f := regexp_replace(
        f,
        c,
        'union select cn.currency from public.credit_notes cn
        where cn.business_id=p_business_id
        union select d.currency from public.recurring_expense_dues d
        where d.business_id=p_business_id'
    );

    execute f;

    raise notice 'PASS: Historical report functions updated';

end $patch$;
