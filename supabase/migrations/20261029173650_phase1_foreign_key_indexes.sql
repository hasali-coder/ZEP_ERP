-- Cover foreign-key paths used for tenant-aware joins and deletions.
create index audit_events_actor_idx on public.audit_events (actor_id);
create index credit_notes_customer_idx on public.credit_notes (business_id, customer_id);
create index credit_notes_invoice_idx on public.credit_notes (business_id, invoice_id);
create index expenses_supplier_idx on public.expenses (business_id, supplier_id);
create index financial_transactions_contact_idx on public.financial_transactions (business_id, contact_id);
create index financial_transactions_expense_idx on public.financial_transactions (business_id, expense_id);
create index invoices_quotation_idx on public.invoices (business_id, source_quotation_id);
create index supplier_bills_supplier_idx on public.supplier_bills (business_id, supplier_id);
