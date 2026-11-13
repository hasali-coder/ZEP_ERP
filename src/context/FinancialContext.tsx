import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  Business,
  Contact,
  Invoice,
  CreditNote,
  Quotation,
  Expense,
  SupplierBill,
  FinancialTransaction,
} from '../types';
import { storage } from '../services/storage';
import { supabase } from '../myzavo/supabase';
import { getTodayDateString } from '../utils/dates';

interface FinancialContextType {
  activeBusiness: Business;
  allBusinesses: Business[];
  contacts: Contact[];
  contactsLoading: boolean;
  contactsError: string | null;
  refreshContacts: () => Promise<void>;
  customers: Contact[];
  suppliers: Contact[];
  invoices: Invoice[];
  invoicesLoading: boolean;
  invoicesError: string | null;
  refreshInvoices: () => Promise<void>;
  creditNotes: CreditNote[];
  refreshCreditNotes: () => Promise<void>;
  issueInvoice: (id: string) => Promise<void>;
  cancelInvoice: (id: string, reason: string) => Promise<void>;
  issueFullCredit: (id: string, reason: string) => Promise<void>;
  quotations: Quotation[];
  quotationsLoading: boolean;
  quotationsError: string | null;
  refreshQuotations: () => Promise<void>;
  setQuotationStatus: (id: string, status: Quotation['status']) => Promise<void>;
  expenses: Expense[];
  bills: SupplierBill[];
  transactions: FinancialTransaction[];
  metrics: ReturnType<typeof storage.getFinancialMetrics>;
  getNextInvoiceNumber: () => string;
  getNextQuotationNumber: () => string;
  setActiveBusiness: (id: string) => void;
  updateBusiness: (data: Partial<Business>) => void;
  createBusiness: (name: string) => Business;
  resetToDefaults: () => void;
  // Mutations
  saveContact: (contact: Parameters<typeof storage.saveContact>[0]) => Promise<Contact>;
  deleteContact: (id: string) => Promise<void>;
  saveInvoice: (invoice: Parameters<typeof storage.saveInvoice>[0] & {currency?: string}) => Promise<Invoice>;
  deleteInvoice: (id: string) => void;
  duplicateInvoice: (id: string) => Invoice | undefined;
  saveQuotation: (quote: Parameters<typeof storage.saveQuotation>[0]) => Promise<Quotation>;
  deleteQuotation: (id: string) => void;
  convertQuotationToInvoice: (id: string) => Invoice | undefined;
  saveExpense: (expense: Parameters<typeof storage.saveExpense>[0]) => Expense;
  deleteExpense: (id: string) => void;
  saveBill: (bill: Parameters<typeof storage.saveBill>[0]) => SupplierBill;
  deleteBill: (id: string) => void;
  recordInvoicePayment: (params: Parameters<typeof storage.recordInvoicePayment>[0]) => FinancialTransaction;
  recordBillPayment: (params: Parameters<typeof storage.recordBillPayment>[0]) => FinancialTransaction;
}

const FinancialContext = createContext<FinancialContextType | undefined>(undefined);

export const FinancialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [, setVersion] = useState(0);
  const businessId = window.location.pathname.match(/^\/app\/([0-9a-f-]{36})\/?$/i)?.[1] || '';
  const [remoteContacts, setRemoteContacts] = useState<Contact[]>([]);
  const [remoteInvoices, setRemoteInvoices] = useState<Invoice[]>([]);
  const [remoteCredits, setRemoteCredits] = useState<CreditNote[]>([]);
  const [remoteQuotations,setRemoteQuotations] = useState<Quotation[]>([]);
  const [remoteTransactions,setRemoteTransactions] = useState<FinancialTransaction[]>([]);
  const [remoteExpenses,setRemoteExpenses] = useState<Expense[]>([]);
  const [remoteBills,setRemoteBills] = useState<SupplierBill[]>([]);
  const [quotationsLoading,setQuotationsLoading] = useState(true);
  const [quotationsError,setQuotationsError] = useState<string|null>(null);
  const [remoteBusiness, setRemoteBusiness] = useState<Business | null>(null);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError] = useState<string | null>(null);

  const mapRow = (r: any): Contact => ({
    id:r.id, businessId:r.business_id, type:r.type, name:r.name,
    companyName:r.company_name || undefined, email:r.email || '', phone:r.phone || '',
    address:r.address || '', city:r.city || undefined, country:r.country || undefined,
    taxNumber:r.tax_number || undefined, currencyPreference:r.currency_preference || undefined,
    notes:r.nature_of_business || r.notes || undefined, natureOfBusiness:r.nature_of_business || undefined, createdByLabel:r.created_by_label || undefined, creditTermsDays:r.credit_terms_days ?? 0,
    customerCode:r.customer_code||undefined,vendorCode:r.vendor_code||undefined,isActive:r.is_active!==false, createdAt:r.created_at || getTodayDateString()
  });
  async function refreshContacts() {
    if (!supabase || !businessId) { setContactsError('No authenticated business selected.');setContactsLoading(false);return; }
    setContactsLoading(true);setContactsError(null);
    const {data,error} = await supabase.from('contacts').select('*').eq('business_id',businessId).order('created_at',{ascending:false});
    if (error) setContactsError(error.message);
    else setRemoteContacts((data||[]).map(mapRow));
    setContactsLoading(false);
  }
  useEffect(() => {void refreshContacts();}, [businessId]);

  useEffect(() => {
    if (!supabase || !businessId) return;
    let live=true;
    const load=async()=>{
      const {data,error}=await supabase!.from('businesses').select('*').eq('id',businessId).single();
      if (live && !error && data) setRemoteBusiness({
        id:data.id,name:data.name,email:data.email||'',phone:data.phone||'',
        address:data.address||'',city:data.city||'',country:data.country||'Kenya',
        taxNumber:data.tax_number||undefined,currency:data.currency||'KES',
        paymentInstructions:data.payment_instructions||undefined,logoUrl:data.logo_path||undefined
      } as Business);
    };
    void load();
    return()=>{live=false;};
  },[businessId]);

  const mapInvoice=(r:any):Invoice=>({
    id:r.id,businessId:r.business_id,invoiceNumber:r.invoice_number,
    customerId:r.customer_id,customerName:remoteContacts.find(c=>c.id===r.customer_id)?.companyName ||
      remoteContacts.find(c=>c.id===r.customer_id)?.name ||r.customer_snapshot?.company_name ||r.customer_snapshot?.name ||'Customer',
    issueDate:r.issue_date,dueDate:r.due_date,currency:r.currency,
    items:(r.invoice_items||[]).sort((a:any,b:any)=>a.position-b.position).map((it:any)=>({
      id:it.id,description:it.description,quantity:Number(it.quantity),unitPriceCents:Number(it.unit_price_minor),
      taxRatePercent:Number(it.tax_rate_percent),discountPercent:Number(it.discount_percent)
    })),
    subtotalCents:Number(r.subtotal_minor),discountCents:Number(r.discount_minor),taxCents:Number(r.tax_minor),
    totalCents:Number(r.total_minor),amountPaidCents:Number(r.amount_paid_minor),
    balanceDueCents:r.status==='cancelled'?0:Number(r.balance_due_minor),
    status:r.status,paymentTerms:r.payment_terms||undefined,notes:r.notes||undefined,
    paymentInstructions:r.payment_instructions||undefined,createdAt:r.created_at,updatedAt:r.updated_at,
    businessSnapshot:r.business_snapshot||undefined,customerSnapshot:r.customer_snapshot||undefined
  });

  async function refreshInvoices(){
    if(!supabase || !businessId){setInvoicesLoading(false);setInvoicesError('No business selected');return;}
    setInvoicesLoading(true);setInvoicesError(null);
    const {data,error}=await supabase.from('invoices').select('*,invoice_items(*)')
      .eq('business_id',businessId).order('created_at',{ascending:false});
    if(error)setInvoicesError(error.message);
    else setRemoteInvoices((data||[]).map(mapInvoice));
    setInvoicesLoading(false);
  }
  async function refreshCreditNotes(){
    if(!supabase || !businessId)return;
    const {data,error}=await supabase.from('credit_notes').select('*').eq('business_id',businessId)
      .order('created_at',{ascending:false});
    if(error){setInvoicesError(error.message);return;}
    setRemoteCredits((data||[]).map((r:any)=>({id:r.id,businessId:r.business_id,
      customerId:r.customer_id,invoiceId:r.invoice_id||undefined,creditNumber:r.credit_number,
      issueDate:r.issue_date,currency:r.currency,amountCents:Number(r.amount_minor),
      reason:r.reason,status:r.status,createdAt:r.created_at})));
  }
  useEffect(()=>{setRemoteInvoices([]);setRemoteCredits([]);void refreshInvoices();void refreshCreditNotes();},[businessId]);
  async function saveRemoteInvoice(inv:Parameters<typeof storage.saveInvoice>[0] & {currency?:string}):Promise<Invoice>{
    if(!supabase||!businessId)throw new Error('Sign in and select a business');
    if(inv.id)throw new Error('Existing invoice editing is unavailable until the audited draft-edit workflow is connected.');
    const currency=inv.currency||remoteContacts.find(c=>c.id===inv.customerId)?.currencyPreference||remoteBusiness?.currency||'KES';
    const {data,error}=await supabase.rpc('myzavo_create_invoice',{
      p_business_id:businessId,p_customer_id:inv.customerId,p_issue_date:inv.issueDate,
      p_due_date:inv.dueDate,p_currency:currency,p_items:inv.items.map(it=>({
        description:it.description,quantity:it.quantity,unit_price_minor:it.unitPriceCents,
        tax_rate_percent:it.taxRatePercent,discount_percent:it.discountPercent||0
      })),p_global_discount_minor:inv.discountCents||0,p_payment_terms:inv.paymentTerms||null,
      p_payment_instructions:inv.paymentInstructions||null,p_notes:inv.notes||null,
      p_status:inv.status==='draft'?'draft':'sent'
    });
    if(error)throw new Error(error.message);
    await refreshInvoices();
    const id=(data as any)?.[0]?.id;
    const {data:row,error:readError}=await supabase.from('invoices').select('*,invoice_items(*)').eq('business_id',businessId).eq('id',id).single();
    if(readError||!row)throw new Error(readError?.message||'Invoice saved; refresh to view it');
    return mapInvoice(row);
  }
  async function issueRemoteInvoice(id:string){
    if(!supabase)throw new Error('Supabase unavailable');
    const {error}=await supabase.rpc('myzavo_issue_invoice',{p_invoice_id:id});
    if(error)throw new Error(error.message);
    await refreshInvoices();
  }
  const mapQuotation=(r:any):Quotation=>({
    id:r.id,businessId:r.business_id,quoteNumber:r.quote_number,customerId:r.customer_id,
    customerName:remoteContacts.find(c=>c.id===r.customer_id)?.companyName||
      remoteContacts.find(c=>c.id===r.customer_id)?.name||r.customer_snapshot?.company_name||r.customer_snapshot?.name||'Customer',
    issueDate:r.issue_date,expiryDate:r.expiry_date,currency:r.currency,
    items:(r.quotation_items||[]).sort((a:any,b:any)=>a.position-b.position).map((it:any)=>({
      id:it.id,description:it.description,quantity:Number(it.quantity),unitPriceCents:Number(it.unit_price_minor),
      taxRatePercent:Number(it.tax_rate_percent),discountPercent:Number(it.discount_percent)})),
    subtotalCents:Number(r.subtotal_minor),discountCents:Number(r.discount_minor),taxCents:Number(r.tax_minor),
    totalCents:Number(r.total_minor),status:r.status,notes:r.notes||undefined,createdAt:r.created_at,
    businessSnapshot:r.business_snapshot||undefined,customerSnapshot:r.customer_snapshot||undefined
  });
  async function refreshQuotations(){
    if(!supabase||!businessId){setQuotationsLoading(false);setQuotationsError('No authenticated business');return;}
    setQuotationsLoading(true);setQuotationsError(null);
    const {data,error}=await supabase.from('quotations').select('*,quotation_items(*)').eq('business_id',businessId).order('created_at',{ascending:false});
    if(error)setQuotationsError(error.message);
    else setRemoteQuotations((data||[]).map(mapQuotation));
    setQuotationsLoading(false);
  }
  useEffect(()=>{setRemoteQuotations([]);void refreshQuotations();},[businessId]);
  async function saveRemoteQuotation(q:Parameters<typeof storage.saveQuotation>[0]):Promise<Quotation>{
    if(!supabase||!businessId)throw new Error('Select an authenticated business first.');
    if(q.id)throw new Error('Editing a saved quotation is not yet supported. Status changes are available from View.');
    const currency=q.currency||remoteContacts.find(c=>c.id===q.customerId)?.currencyPreference||remoteBusiness?.currency||'KES';
    const {data,error}=await supabase.rpc('myzavo_create_quotation',{
      p_business_id:businessId,p_customer_id:q.customerId,p_issue_date:q.issueDate,p_expiry_date:q.expiryDate,
      p_currency:currency,p_items:q.items.map(it=>({description:it.description,quantity:it.quantity,
        unit_price_minor:it.unitPriceCents,tax_rate_percent:it.taxRatePercent,discount_percent:it.discountPercent||0})),
      p_global_discount_minor:q.discountCents||0,p_notes:q.notes||null,p_status:q.status==='draft'?'draft':'sent'
    });
    if(error)throw new Error(error.message);
    const createdId=(data as any)?.[0]?.id;
    await refreshQuotations();
    const {data:row,error:readError}=await supabase.from('quotations').select('*,quotation_items(*)')
      .eq('business_id',businessId).eq('id',createdId).single();
    if(readError||!row)throw new Error(readError?.message||'Quotation saved. Refresh to view it.');
    return mapQuotation(row);
  }
  async function updateRemoteQuoteStatus(id:string,status:Quotation['status']){
    if(!supabase)throw new Error('Supabase unavailable');
    const {error}=await supabase.rpc('myzavo_set_quote_status',{p_quote_id:id,p_status:status});
    if(error)throw new Error(error.message);
    await refreshQuotations();
  }

  async function cancelRemoteInvoice(id:string,reason:string){
    if(!supabase)throw new Error('Supabase unavailable');
    const {error}=await supabase.rpc('myzavo_cancel_invoice',{p_invoice_id:id,p_reason:reason});
    if(error)throw new Error(error.message);
    await refreshInvoices();
  }
  async function issueRemoteCredit(id:string,reason:string){
    if(!supabase)throw new Error('Supabase unavailable');
    const {error}=await supabase.rpc('myzavo_issue_full_credit',{p_invoice_id:id,p_reason:reason});
    if(error)throw new Error(error.message);
    await Promise.all([refreshInvoices(),refreshCreditNotes()]);
  }


  async function saveRemoteContact(c: Parameters<typeof storage.saveContact>[0]): Promise<Contact> {
    if (!supabase || !businessId) throw new Error('Connect to a business first.');
    const payload = {business_id:businessId,type:c.type,name:c.name,company_name:c.companyName || null,
      email:c.email || null,phone:c.phone || null,address:c.address || null,city:c.city || null,
      country:c.country || null,tax_number:c.taxNumber || null,
      currency_preference:c.currencyPreference || null,nature_of_business:c.notes || null,credit_terms_days:c.creditTermsDays ?? 0};
    const query = c.id ? supabase.from('contacts').update(payload).eq('id',c.id).eq('business_id',businessId) : supabase.from('contacts').insert(payload);
    const {data,error} = await query.select('*').single();
    if (error) throw new Error(error.message);
    await refreshContacts();
    return mapRow(data);
  }
  async function deleteRemoteContact(id: string): Promise<void> {
    if (!supabase || !businessId) throw new Error('Connect to a business first.');
    const {error} = await supabase.from('contacts').update({is_active:false}).eq('business_id',businessId).eq('id',id);
    if (error) throw new Error(error.message);
    await refreshContacts();
  }

  useEffect(() => {
    const unsubscribe = storage.subscribe(() => {
      setVersion((v) => v + 1);
    });
    return unsubscribe;
  }, []);

  useEffect(()=>{
    let mounted=true;
    const load=async()=>{if(!supabase||!businessId)return;
      const {data,error}=await supabase.from('financial_transactions').select('*').eq('business_id',businessId).order('created_at',{ascending:false});
      if(!mounted||error)return;
      setRemoteTransactions((data||[]).filter((r:any)=>r.status==='posted').map((r:any)=>({
       id:r.id,businessId:r.business_id,type:r.direction==='in'?'payment_received':'payment_made',date:r.payment_date,
       amountCents:Number(r.amount_minor),currency:r.currency,paymentMethod:({cash:'Cash',mpesa:'M-Pesa',bank_transfer:'Bank Transfer',card:'Card',cheque:'Cheque',other:'Other'} as any)[r.payment_method]||'Other',
       referenceNumber:r.reference_number||undefined,contactId:r.contact_id||undefined,expenseId:r.expense_id||undefined,
       description:r.description||'',notes:r.notes||undefined,createdAt:r.created_at
      } as FinancialTransaction)));
      const [expenseRes,billRes]=await Promise.all([
        supabase.from('expenses').select('*').eq('business_id',businessId),
        supabase.from('supplier_bills').select('*').eq('business_id',businessId)
      ]);
      if(!mounted)return;
      if(!expenseRes.error)setRemoteExpenses((expenseRes.data||[]).map((r:any)=>({
        id:r.id,businessId:r.business_id,description:r.description,amountCents:Number(r.amount_minor),
        currency:r.currency,category:r.category,date:r.expense_date,
        supplierName:r.supplier_name||undefined,supplierId:r.supplier_id||undefined,
        paymentMethod:({cash:'Cash',mpesa:'M-Pesa',bank_transfer:'Bank Transfer',card:'Card',cheque:'Cheque',other:'Other'} as any)[r.payment_method]||'Other',
        referenceNumber:r.reference_number||undefined,notes:r.notes||undefined,createdAt:r.created_at
      } as Expense)));
      if(!billRes.error)setRemoteBills((billRes.data||[]).map((r:any)=>({
        id:r.id,businessId:r.business_id,billNumber:r.bill_number,supplierId:r.supplier_id,
        supplierName:remoteContacts.find(c=>c.id===r.supplier_id)?.companyName||remoteContacts.find(c=>c.id===r.supplier_id)?.name||'Supplier',
        issueDate:r.issue_date,dueDate:r.due_date,currency:r.currency,amountCents:Number(r.amount_minor),
        amountPaidCents:Number(r.amount_paid_minor),balanceDueCents:Number(r.balance_due_minor),
        category:r.category||'Other',description:r.description,status:r.status,
        notes:r.notes||undefined,createdAt:r.created_at
      } as SupplierBill)));
    };
    void load();window.addEventListener('myzavo:finance-updated',load);
    return()=>{mounted=false;window.removeEventListener('myzavo:finance-updated',load);};
  },[businessId]);
  const activeBusiness = remoteBusiness && remoteBusiness.id===businessId ? remoteBusiness : storage.getActiveBusiness();
  const allBusinesses = storage.getAllBusinesses();
  const contacts = remoteContacts;
  const customers = contacts.filter(c=> c.type==='customer');
  const suppliers = contacts.filter(c=> c.type==='supplier');
  const invoices = remoteInvoices.map(inv=>({...inv,customerName:remoteContacts.find(c=>c.id===inv.customerId)?.companyName||remoteContacts.find(c=>c.id===inv.customerId)?.name||inv.customerName}));
  const quotations = remoteQuotations.map(q=>({...q,customerName:remoteContacts.find(c=>c.id===q.customerId)?.companyName||remoteContacts.find(c=>c.id===q.customerId)?.name||q.customerName}));
  const expenses=remoteExpenses;
  const bills=remoteBills;
  const transactions = remoteTransactions;
  // Dashboard totals are derived only from DB data in the reporting currency. No synthetic browser metrics.
  const baseCurrency=activeBusiness.currency;
  const currentMonth=getTodayDateString().slice(0,7);
  const period=remoteTransactions.filter(t=>t.currency===baseCurrency&&t.date.startsWith(currentMonth));
  const cashReceivedCents=period.filter(t=>t.type==='payment_received').reduce((n,t)=>n+t.amountCents,0);
  const cashPaidOutCents=period.filter(t=>t.type==='payment_made').reduce((n,t)=>n+t.amountCents,0);
  const outstanding=invoices.filter(i=>i.currency===baseCurrency&&i.balanceDueCents>0&&!['draft','cancelled','paid'].includes(i.status));
  const overdue=outstanding.filter(i=>i.dueDate<getTodayDateString());
  const metrics={currency:baseCurrency,cashReceivedCents,cashPaidOutCents,netCashFlowCents:cashReceivedCents-cashPaidOutCents,
    totalOutstandingInvoicesCents:outstanding.reduce((n,i)=>n+i.balanceDueCents,0),outstandingInvoiceCount:outstanding.length,
    totalOverdueInvoicesCents:overdue.reduce((n,i)=>n+i.balanceDueCents,0),overdueInvoiceCount:overdue.length,
    totalAccountsPayableCents:bills.filter(b=>b.currency===baseCurrency&&b.status!=='paid').reduce((n,b)=>n+b.balanceDueCents,0),
    unpaidBillCount:bills.filter(b=>b.currency===baseCurrency&&b.status!=='paid').length};

  const value: FinancialContextType = {
    activeBusiness,
    allBusinesses,
    contacts,
    contactsLoading,
    contactsError,
    refreshContacts,
    customers,
    suppliers,
    invoices,
    invoicesLoading,
    invoicesError,
    refreshInvoices,
    creditNotes:remoteCredits,
    refreshCreditNotes,
    issueInvoice:issueRemoteInvoice,
    cancelInvoice:cancelRemoteInvoice,
    issueFullCredit:issueRemoteCredit,
    quotations,
    quotationsLoading, quotationsError, refreshQuotations, setQuotationStatus:updateRemoteQuoteStatus,
    expenses,
    bills,
    transactions,
    metrics,
    getNextInvoiceNumber: () => storage.getNextInvoiceNumber(),
    getNextQuotationNumber: () => storage.getNextQuotationNumber(),
    setActiveBusiness: (id) => storage.setActiveBusiness(id),
    updateBusiness: (data) => storage.updateBusiness(data),
    createBusiness: (name) => storage.createBusiness(name),
    resetToDefaults: () => storage.resetAllDataToDefaults(),
    saveContact: saveRemoteContact,
    deleteContact: deleteRemoteContact,
    saveInvoice: saveRemoteInvoice,
    deleteInvoice: () => {throw new Error("Invoices cannot be deleted. Cancel or issue a credit note.");},
    duplicateInvoice: () => {throw new Error("Use Create Invoice; a new invoice needs a new server-assigned reference.");},
    saveQuotation: saveRemoteQuotation,
    deleteQuotation: () => {throw new Error("Quotations are immutable financial records. Change status instead.");},
    convertQuotationToInvoice: () => { throw new Error("Quotation conversion will be enabled when quotations are database-backed. No local invoice was created."); },
    saveExpense: () => { throw new Error('Use Supabase-backed Expenses to save paid expenses.'); },
    deleteExpense: () => { throw new Error('Posted expenses cannot be deleted.'); },
    saveBill: () => { throw new Error('Use Supabase-backed Supplier Bills to create bills.'); },
    deleteBill: () => { throw new Error('Supplier bills cannot be deleted.'); },
    recordInvoicePayment: () => { throw new Error("Invoice payments are temporarily disabled until Supabase payment allocations are connected."); },
    recordBillPayment: () => { throw new Error('Supplier payment workflow is not yet activated.'); },
  };

  return <FinancialContext.Provider value={value}>{children}</FinancialContext.Provider>;
};

export function useFinancial() {
  const context = useContext(FinancialContext);
  if (!context) {
    throw new Error('useFinancial must be used within a FinancialProvider');
  }
  return context;
}
