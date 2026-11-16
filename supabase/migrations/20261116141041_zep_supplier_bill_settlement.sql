create function public.zep_pay_supplier_bill(
    p_business_id uuid,
    p_bill_id uuid,
    p_amount_minor bigint,
    p_currency text,
    p_payment_method text,
    p_payment_date date,
    p_reference_number text,
    p_idempotency_key text
)
returns table(
    transaction_id uuid,
    new_balance_minor bigint
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_actor uuid := auth.uid();
    v_bill public.supplier_bills%rowtype;
    v_existing public.financial_transactions%rowtype;
    v_supplier public.contacts%rowtype;
    v_expense uuid;
    v_transaction uuid;
    v_remaining bigint;
    v_reference text := nullif(btrim(p_reference_number),'');
    v_key text := nullif(btrim(p_idempotency_key),'');
    v_today date := (now() at time zone 'Africa/Nairobi')::date;
begin
    perform app_private.myzavo_require_finance_role(p_business_id);

    if v_key is null or length(v_key) > 128 then
        raise exception 'Valid idempotency key required';
    end if;

    if p_amount_minor is null
       or p_amount_minor <= 0
       or p_amount_minor > 1000000000000 then
        raise exception 'Invalid payment amount';
    end if;

    if p_payment_method is null or p_payment_method not in
       ('cash','bank_transfer','mpesa','card','cheque','other') then
        raise exception 'Invalid payment method';
    end if;

    if p_payment_date is null or p_payment_date > v_today then
        raise exception 'Invalid payment date';
    end if;

    if p_payment_method in ('mpesa','bank_transfer','card')
       and v_reference is null then
        raise exception 'Payment reference required';
    end if;

    if length(v_reference) > 200 then
        raise exception 'Payment reference is too long';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
            'zep-supplier-payment:' || p_business_id::text, 0
        )
    );

    select *
    into v_bill
    from public.supplier_bills b
    where b.id = p_bill_id
      and b.business_id = p_business_id
    for update;

    if not found then
        raise exception 'Supplier bill not found';
    end if;

    if p_currency is distinct from v_bill.currency then
        raise exception 'Payment currency must match bill currency';
    end if;

    select *
    into v_existing
    from public.financial_transactions t
    where t.business_id = p_business_id
      and t.idempotency_key = v_key;

    if found then
        if v_existing.direction <> 'out'
           or v_existing.status <> 'posted'
           or v_existing.amount_minor <> p_amount_minor
           or v_existing.currency <> p_currency
           or v_existing.payment_method <> p_payment_method
           or v_existing.payment_date <> p_payment_date
           or v_existing.reference_number is distinct from v_reference
           or not exists (
                select 1
                from public.payment_allocations a
                where a.business_id = p_business_id
                  and a.bill_id = p_bill_id
                  and a.transaction_id = v_existing.id
                  and a.amount_minor = p_amount_minor
           ) then
            raise exception 'Payment key already used';
        end if;

        transaction_id := v_existing.id;
        new_balance_minor := v_bill.balance_due_minor;
        return next;
        return;
    end if;

    if v_bill.status = 'paid'
       or v_bill.balance_due_minor <= 0 then
        raise exception 'Bill already settled';
    end if;

    if p_payment_date < v_bill.issue_date then
        raise exception 'Payment cannot precede bill date';
    end if;

    if p_amount_minor > v_bill.balance_due_minor then
        raise exception 'Payment exceeds outstanding bill balance';
    end if;

    if v_reference is not null and exists (
        select 1
        from public.financial_transactions t
        where t.business_id = p_business_id
          and t.payment_method = p_payment_method
          and t.reference_number = v_reference
          and t.status = 'posted'
    ) then
        raise exception 'Payment reference already recorded';
    end if;

    select *
    into v_supplier
    from public.contacts c
    where c.id = v_bill.supplier_id
      and c.business_id = p_business_id
      and c.type = 'supplier';

    if not found then
        raise exception 'Supplier record not found';
    end if;

    insert into public.expenses(
        business_id,
        supplier_id,
        supplier_name,
        description,
        category,
        expense_date,
        amount_minor,
        currency,
        payment_method,
        reference_number,
        notes,
        created_by,
        idempotency_key
    )
    values(
        p_business_id,
        v_bill.supplier_id,
        coalesce(nullif(v_supplier.company_name,''),v_supplier.name),
        'Settlement of supplier bill ' || v_bill.bill_number,
        coalesce(nullif(v_bill.category,''),'Other'),
        p_payment_date,
        p_amount_minor,
        p_currency,
        p_payment_method,
        v_reference,
        'Supplier bill settlement',
        v_actor,
        v_key
    )
    returning id into v_expense;

    insert into public.financial_transactions(
        business_id,
        contact_id,
        expense_id,
        direction,
        amount_minor,
        currency,
        payment_method,
        payment_date,
        reference_number,
        idempotency_key,
        description,
        status
    )
    values(
        p_business_id,
        v_bill.supplier_id,
        v_expense,
        'out',
        p_amount_minor,
        p_currency,
        p_payment_method,
        p_payment_date,
        v_reference,
        v_key,
        'Supplier bill payment: ' || v_bill.bill_number,
        'posted'
    )
    returning id into v_transaction;

    insert into public.payment_allocations(
        business_id,
        transaction_id,
        bill_id,
        amount_minor
    )
    values(
        p_business_id,
        v_transaction,
        p_bill_id,
        p_amount_minor
    );

    v_remaining := v_bill.balance_due_minor - p_amount_minor;

    update public.supplier_bills
    set amount_paid_minor = amount_paid_minor + p_amount_minor,
        status = case
            when v_remaining = 0 then 'paid'
            else 'partially_paid'
        end
    where id = p_bill_id
      and business_id = p_business_id;

    insert into public.audit_events(
        business_id,
        actor_id,
        event_type,
        entity_type,
        entity_id,
        event_data
    )
    values(
        p_business_id,
        v_actor,
        'supplier_bill.payment_recorded',
        'supplier_bill',
        p_bill_id,
        jsonb_build_object(
            'transaction_id',v_transaction,
            'amount_minor',p_amount_minor,
            'currency',p_currency,
            'previous_balance_minor',v_bill.balance_due_minor,
            'new_balance_minor',v_remaining
        )
    );

    transaction_id := v_transaction;
    new_balance_minor := v_remaining;

    return next;
end;
$function$;

revoke all on function public.zep_pay_supplier_bill(
    uuid,uuid,bigint,text,text,date,text,text
) from public, anon, authenticated;

grant execute on function public.zep_pay_supplier_bill(
    uuid,uuid,bigint,text,text,date,text,text
) to authenticated;