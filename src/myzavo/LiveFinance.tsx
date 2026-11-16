import {BusinessLogoSettings} from './BusinessLogo';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {supabase} from './supabase';
import {FinancialAgeingDetail,ManagementPnL,LiveReportCardDrilldown} from './ReportsExpansion';
import {LiveTransactionsExplorer,LiveReceiptsExplorer} from './LiveFinanceExplore';
import {LiveReportAnalytics} from './LiveReportAnalytics';
import {ManualReconciliation} from './ManualReconciliation';
import {CustomerCredits} from './CustomerCredits';
import {LegacyAgeingLive,LegacyStatementLive} from './LiveLegacyReports';
import {downloadSOAPdf,downloadSOAWord} from './soaExport';
import {useFinancial} from '../context/FinancialContext';
import type {Invoice, CurrencyCode} from '../types';
import {Plus, Save} from 'lucide-react';

const rootId=()=>window.location.pathname.match(/^\/app\/([0-9a-f-]{36})/i)?.[1]||'';
const box='rounded-xl border border-[#DFE7F0] bg-white shadow-sm';
const input='w-full rounded-md border border-[#DCE5EE] bg-white px-3 py-2 text-sm text-[#0D1B33] focus:outline-none focus:ring-2 focus:ring-[#244A73]/30';
const money=(v:number,currency:string)=>`${currency} ${(v/100).toLocaleString('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const dated=(v:string)=>new Date(`${v}T12:00:00`).toLocaleDateString('en-KE',{year:'numeric',month:'short',day:'numeric'});
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Nairobi'});
const methodMap:Record<string,string>={'Cash':'cash','M-Pesa':'mpesa','Bank Transfer':'bank_transfer','Card':'card','Cheque':'cheque','Other':'other'};
const methodLabel:Record<string,string>={cash:'Cash',mpesa:'M-Pesa',bank_transfer:'Bank Transfer',card:'Card',cheque:'Cheque',other:'Other'};
const paymentMethods=['Cash','M-Pesa','Bank Transfer','Card','Cheque','Other'];
const categories=['Rent & Utilities','Salaries & Wages','Cloud & Software','Marketing & Ads','Office Supplies','Travel & Transport','Professional Services','Taxes & Licenses','Equipment & Hardware','Other'];
const CURRENCIES=['KES','USD','EUR','GBP','TZS','UGX','ZAR','CNY','AED','CAD','AUD','INR','CHF','JPY'];
function refreshFinance(){window.dispatchEvent(new Event('myzavo:finance-updated'));}
function useLiveRows(table:'expenses'|'supplier_bills'|'financial_transactions'|'receipts'){
 const [data,setData]=useState<any[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{
  let mounted=true;
  const load=async()=>{
   if(!supabase || !rootId()){setError('No authenticated business is selected.');setLoading(false);return;}
   setLoading(true); const {data:rows,error:e}=await supabase.from(table).select('*').eq('business_id',rootId()).order(table==='receipts'?'issued_at':'created_at',{ascending:false});
   if(!mounted)return;setData(rows||[]);setError(e?.message||'');setLoading(false);
  };
  void load();window.addEventListener('myzavo:finance-updated',load);
  return()=>{mounted=false;window.removeEventListener('myzavo:finance-updated',load);};
 },[table]);
 return {data,loading,error};
}
function StateLine({loading,error}:{loading:boolean;error:string}){
 return <>{loading&&<p className="p-5 text-sm text-[#69788B]">Loading financial records from Supabase…</p>}{error&&<p role="alert" className="m-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}</>;
}

export {VendorExpenseModal as LiveExpenseModal, VendorExpensesView as LiveExpensesView} from './VendorExpenses';

export function LiveTransactionsView({onOpenPaymentModal}:any){
 const [tab,setTab]=useState<'ledger'|'reconciliation'>('ledger');
 return <div className="space-y-4"><div className={`${box} p-3 flex gap-2`}>{(['ledger','reconciliation'] as const).map(k=><button key={k} type="button" className={`rounded px-4 py-2 text-sm ${tab===k?'bg-[#244A73] text-white':'bg-[#F1F5FA] text-[#244A73]'}`} onClick={()=>setTab(k)}>{k==='ledger'?'Transactions':'Reconciliation'}</button>)}</div>{tab==='ledger'?<LiveTransactionsExplorer onOpenPaymentModal={onOpenPaymentModal}/>:<ManualReconciliation key={rootId()} businessId={rootId()}/>}</div>;
}

export function LiveSettingsView(){
 const {activeBusiness}=useFinancial();const [form,setForm]=useState<any>(null),[saving,setSaving]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 useEffect(()=>{let alive=true;const load=async()=>{if(!supabase)return;const {data,error:e}=await supabase.from('businesses').select('*').eq('id',rootId()).single();if(alive){setForm(data);setError(e?.message||'');}};void load();return()=>{alive=false;};},[activeBusiness.id]);
 const set=(k:string,v:string)=>setForm((f:any)=>({...f,[k]:v}));
 const save=async(e:React.FormEvent)=>{e.preventDefault();if(!supabase||!form)return;setSaving(true);setError('');setSuccess('');try{
 const payload={name:form.name,email:form.email||null,phone:form.phone||null,address:form.address||null,city:form.city||null,country:form.country||'Kenya',tax_number:form.tax_number||null,currency:form.currency,payment_instructions:form.payment_instructions||null,notes:form.notes||null};
 const {error:x}=await supabase.from('businesses').update(payload).eq('id',rootId()).select('id').single();if(x)throw x;setSuccess('Saved to Supabase. Refreshing business details…');setTimeout(()=>window.location.reload(),700);
 }catch(e:any){setError(e.message||'Unable to save settings');}finally{setSaving(false);}};
 return <div className="max-w-5xl space-y-4"><div className={`${box} p-6`}><h2 className="text-xl font-semibold">Business settings</h2><p className="text-sm text-[#69788B]">Business identity, billing information and payment instructions saved to Supabase.</p></div><BusinessLogoSettings businessId={rootId()}/><StateLine loading={!form&&!error} error={error}/>{form&&<form onSubmit={save} className={`${box} p-6 space-y-5`}>
 {success&&<p className="p-3 bg-green-50 text-green-800 rounded text-sm">{success}</p>}
 <div className="grid md:grid-cols-2 gap-4">{[['name','Business name'],['email','Billing email'],['phone','Telephone'],['address','Address'],['city','City'],['country','Country'],['tax_number','Tax ID / PIN']].map(([key,label])=><label key={key} className="text-sm text-[#182539]">{label}<input className={input} value={form[key]||''} onChange={e=>set(key,e.target.value)} required={key==='name'}/></label>)}
 <label className="text-sm">Reporting currency<select className={input} value={form.currency} onChange={e=>set('currency',e.target.value)}>{CURRENCIES.map(c=><option key={c}>{c}</option>)}</select><span className="block mt-1 text-xs text-[#69788B]">Locked by the database once financial transactions exist.</span></label></div>
 <label className="block text-sm">Payment instructions<textarea className={input} rows={3} value={form.payment_instructions||''} onChange={e=>set('payment_instructions',e.target.value)}/></label>
 <label className="block text-sm">Default invoice notes<textarea className={input} rows={3} value={form.notes||''} onChange={e=>set('notes',e.target.value)}/></label>
 <div className="flex justify-end"><button disabled={saving} className="bg-[#244A73] text-white rounded px-5 py-2 text-sm disabled:opacity-50"><Save className="w-4 h-4 inline mr-1"/>{saving?'Saving…':'Save settings'}</button></div>
 </form>}</div>;
}

export function LiveReportsView({initialReportType='analytics',initialCustomerId}:any){
 const {activeBusiness,customers,invoices}=useFinancial();const {data:allPayments}=useLiveRows('financial_transactions');const [from,setFrom]=useState(()=>`${today().slice(0,7)}-01`),[to,setTo]=useState(today()),[summary,setSummary]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const receivablesDeepLinkRef=useRef<boolean>((()=>{try{return window.sessionStorage.getItem('myzavo:report-focus')==='receivables';}catch{return false;}})());
 const [report,setReport]=useState<string>(receivablesDeepLinkRef.current?'outstanding_invoices':initialReportType==='income'?'analytics':initialReportType),[customerId,setCustomerId]=useState(initialCustomerId||'');
 const [soa,setSoa]=useState<any[]>([]);
 const [drillCurrency,setDrillCurrency]=useState('');
 const [drillDirection,setDrillDirection]=useState<'in'|'out'|''>('');
 useEffect(()=>{setDrillCurrency('');setDrillDirection('');},[from,to]);
 useEffect(()=>{
  const open=()=>{try{if(window.sessionStorage.getItem('myzavo:report-focus')==='receivables'){
   window.sessionStorage.removeItem('myzavo:report-focus');setReport('outstanding_invoices');setCustomerId('');setDrillCurrency('');
  }}catch{/* Browser storage can be disabled; manual report navigation remains available. */}};
  open();window.addEventListener('myzavo:report-focus',open);
  return()=>window.removeEventListener('myzavo:report-focus',open);
 },[]);
 const [soaReady,setSoaReady]=useState(''),[soaExportBusy,setSoaExportBusy]=useState(false),[soaExportError,setSoaExportError]=useState('');
 useEffect(()=>{setReport(receivablesDeepLinkRef.current?'outstanding_invoices':initialReportType==='income'?'analytics':initialReportType);if(initialCustomerId)setCustomerId(initialCustomerId);},[initialReportType,initialCustomerId]);
 useEffect(()=>{let alive=true;const load=async()=>{if(!supabase){setError('Supabase unavailable');setLoading(false);return;}setLoading(true);setError('');
 const {data,error:e}=await supabase.rpc('myzavo_report_summary',{p_business_id:rootId(),p_from:from,p_to:to});if(!alive)return;setSummary(data);setError(e?.message||'');setLoading(false);
 };void load();window.addEventListener('myzavo:finance-updated',load);return()=>{alive=false;window.removeEventListener('myzavo:finance-updated',load);};},[from,to]);
 useEffect(()=>{setSoaReady('');setSoaExportError('');if(report!=='statement_of_account'||!customerId||!supabase)return;let alive=true;
 const load=async()=>{const [inv,cr,tx]=await Promise.all([
 supabase!.from('invoices').select('id,invoice_number,issue_date,currency,total_minor,status').eq('business_id',rootId()).eq('customer_id',customerId).lte('issue_date',to),
 supabase!.from('credit_notes').select('invoice_id,credit_number,issue_date,currency,amount_minor,status').eq('business_id',rootId()).eq('customer_id',customerId).lte('issue_date',to),
 supabase!.from('financial_transactions').select('id,payment_date,currency,status,reference_number,direction,amount_minor').eq('business_id',rootId()).eq('contact_id',customerId).lte('payment_date',to)
 ]);
 if(!alive)return;const fetchError=[inv.error,cr.error,tx.error].find(Boolean);if(fetchError){setSoaExportError(fetchError.message);return;}const allInvoices=inv.data||[];
 const lines:any[]=[];
 for(const i of allInvoices){const hasCredit=(cr.data||[]).some((c:any)=>c.invoice_id===i.id&&c.status==='issued');if(i.status==='draft'||(i.status==='cancelled'&&!hasCredit))continue;lines.push({date:i.issue_date,ref:i.invoice_number,currency:i.currency,debit:Number(i.total_minor),credit:0,description:'Invoice issued'});}
 for(const c of cr.data||[]){if(c.status==='issued')lines.push({date:c.issue_date,ref:c.credit_number,currency:c.currency,debit:0,credit:Number(c.amount_minor),description:'Credit note issued'});}
 for(const t of tx.data||[]){if(t.status!=='posted')continue;const incoming=t.direction==='in';lines.push({date:t.payment_date,ref:t.reference_number||t.id.slice(0,8),currency:t.currency,debit:incoming?0:Number(t.amount_minor),credit:incoming?Number(t.amount_minor):0,description:incoming?'Payment received':'Customer refund / payment out'});}
 lines.sort((a,b)=>a.date.localeCompare(b.date)||a.ref.localeCompare(b.ref));setSoa(lines);setSoaReady(customerId+'|'+to);
 };void load();return()=>{alive=false;};},[report,customerId,to]);
 const tabs=[['analytics','Analytics'],['income','Income'],['expenses','Expenses'],['cash_flow','Cash flow'],['outstanding_invoices','Outstanding Receivables'],['ar_aging','AR Ageing'],['ap_aging','AP Ageing'],['pnl','Profit & Loss'],['ap_bills','Payables'],['statement_of_account','Customer SOA']];
 const byCurrency:any[] = summary?.by_currency||[];
 const cells:Record<string,[string,string]>= {income:['Net billed','net_billed_minor'],expenses:['Paid expenses','expenses_minor'],cash_flow:['Net cash movement','net_cash_flow_minor'],outstanding_invoices:['Outstanding invoices','receivables_minor'],ap_bills:['Outstanding payables','payables_minor']};
 const [title,key]=cells[report]||['Estimated operating surplus','net_billed_minor'];

 const exportStatement=async(format:'pdf'|'word')=>{
  setSoaExportError('');
  if(!customerId||soaReady!==customerId+'|'+to)return setSoaExportError('Choose a customer and allow its statement to finish loading.');
  const customer=customers.find(c=>c.id===customerId);
  if(!customer)return setSoaExportError('Customer not found.');
  setSoaExportBusy(true);
  try{
   const payload={business:{name:activeBusiness.name,address:activeBusiness.address,city:activeBusiness.city,country:activeBusiness.country,email:activeBusiness.email,taxNumber:activeBusiness.taxNumber},customer:{name:customer.name,companyName:customer.companyName,address:customer.address,email:customer.email,customerCode:customer.customerCode},from,to,lines:soa};
   if(format==='pdf')await downloadSOAPdf(payload);else downloadSOAWord(payload);
  }catch(e){setSoaExportError(e instanceof Error?e.message:'SOA export failed');}finally{setSoaExportBusy(false);}
 };
 return <div className="space-y-4"><div className={`${box} p-4 no-print flex flex-wrap gap-2 items-center`}>{tabs.map(([k,label])=><button key={k} onClick={()=>{setReport(k);setDrillCurrency('');setDrillDirection('');}} className={`rounded px-3 py-2 text-sm ${report===k?'bg-[#244A73] text-white':'bg-[#F1F5FA] text-[#244A73]'}`}>{label}</button>)}</div>
 <div className={`${box} p-4 no-print grid gap-3 md:grid-cols-3`}><label className="text-sm">From<input className={input} type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="text-sm">To<input className={input} type="date" value={to} min={from} onChange={e=>setTo(e.target.value)}/></label><div className="text-xs text-[#69788B] flex items-center">All figures come from saved Supabase records. No FX conversion is inferred.</div></div>
 <StateLine loading={loading} error={error}/>
 {!['statement_of_account','ar_aging','ap_aging','pnl','payment_history','analytics','outstanding_invoices'].includes(report)&&!loading&&!error&&(byCurrency.length===0?<div className={`${box} p-12 text-center text-[#69788B] text-sm`}>No financial records found for this business.</div>:<div className="grid md:grid-cols-3 gap-4">{byCurrency.map((c:any)=><button type="button" onClick={()=>{setDrillCurrency(c.currency);setDrillDirection('');}} className={`${box} p-5 w-full text-left hover:ring-2 hover:ring-[#244A73] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#244A73]`} key={c.currency} title="View supporting financial records"><p className="text-xs uppercase text-[#69788B]">{title} · {c.currency}</p><h3 className="font-semibold text-2xl mt-2">{money(report==='profit_summary'?Number(c.net_billed_minor)-Number(c.expenses_minor):Number(c[key]),c.currency)}</h3><div className="mt-4 text-xs space-y-1 text-[#69788B]"><p>Billed: {money(Number(c.invoiced_minor),c.currency)}</p><p>Credits: {money(Number(c.credits_minor),c.currency)}</p><p>Received: {money(Number(c.cash_received_minor),c.currency)}</p><p>Paid out: {money(Number(c.cash_paid_minor),c.currency)}</p></div><span className="text-[11px] text-[#244A73] mt-3 block">View supporting records →</span></button>)}</div>)}
 {report==='analytics'&&<LiveReportAnalytics businessId={rootId()} from={from} to={to} onNavigate={(next:string,chosen:string,direction?:'in'|'out')=>{setReport(next);setDrillCurrency(chosen);setDrillDirection(direction||'');}}/>}
 {report==='ap_aging'&&<FinancialAgeingDetail businessId={rootId()} asOf={to} kind="ap"/>}
 {report==='pnl'&&<ManagementPnL businessId={rootId()} from={from} to={to}/>}
 {report==='ar_aging'&&<LegacyAgeingLive businessId={rootId()} asOf={to}/>}
 {report==='outstanding_invoices'&&<FinancialAgeingDetail businessId={rootId()} asOf={to} kind="ar"/>}
 {drillCurrency&&['income','expenses','cash_flow','ap_bills'].includes(report)&&<LiveReportCardDrilldown businessId={rootId()} report={report} currency={drillCurrency} from={from} to={to} direction={drillDirection} onClose={()=>{setDrillCurrency('');setDrillDirection('');}}/>}
 
 
 {report==='statement_of_account'&&<LegacyStatementLive business={activeBusiness} businessId={rootId()} customers={customers} customerId={customerId} setCustomerId={setCustomerId} from={from} to={to} lines={soa}/>}
 </div>;
}

export function LiveReceiptsView(){
 const [section,setSection]=useState<'receipts'|'credits'>('receipts');
 return <div className="space-y-4">
  <div className="flex gap-2 rounded-xl border bg-white p-3">
   {(['receipts','credits'] as const).map(k=><button type="button" key={k} onClick={()=>setSection(k)} className={`rounded px-4 py-2 text-sm ${section===k?'bg-[#244A73] text-white':'bg-[#F1F5FA] text-[#244A73]'}`}>{k==='receipts'?'Receipts':'Customer Credits'}</button>)}
  </div>
  {section==='credits'?<CustomerCredits key={rootId()} businessId={rootId()}/>:<LiveReceiptsExplorer/>}
 </div>;
}

export function LivePaymentModal({isOpen,onClose,targetInvoiceId,targetBillId}:any){
 const {invoices,refreshInvoices}=useFinancial();const [invoiceId,setInvoiceId]=useState(''),[full,setFull]=useState(true),[partial,setPartial]=useState(''),[date,setDate]=useState(today()),[method,setMethod]=useState('M-Pesa'),[reference,setReference]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState('');
 const key=useRef('');
 const payable=invoices.filter(i=>i.balanceDueCents>0&&['sent','partially_paid','overdue'].includes(i.status));
 useEffect(()=>{if(isOpen){setInvoiceId(targetInvoiceId||payable[0]?.id||'');setFull(true);setPartial('');setError('');setResult('');key.current=crypto.randomUUID();}},[isOpen,targetInvoiceId]);
 if(!isOpen)return null;
 const active=invoices.find(i=>i.id===invoiceId);const amount=full?active?.balanceDueCents||0:Math.round(Number(partial)*100);
 const submit=async(e:React.FormEvent)=>{e.preventDefault();setError('');if(!supabase||!active)return setError('Select an issued invoice');if(targetBillId)return setError('Supplier bill payments are not yet enabled.');if(!Number.isSafeInteger(amount)||amount<=0)return setError('Enter a valid amount');
 setBusy(true);try{
 const {data,error:x}=await supabase.rpc('myzavo_collect_invoice_payment',{p_invoice_id:invoiceId,p_received_minor:amount,p_currency:active.currency,p_payment_method:methodMap[method],p_payment_date:date,p_reference_number:reference||null,p_idempotency_key:key.current});if(x)throw x;
 const row=(data as any)?.[0];setResult(`Payment recorded. Receipt ${row?.receipt_number||''}. Unapplied credit: ${money(Number(row?.unapplied_minor||0),active.currency)}.`);await refreshInvoices();refreshFinance();
 }catch(e:any){setError(e.message||'Payment failed');}finally{setBusy(false);}};
 return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0D1B33]/60 p-4" role="dialog" aria-modal="true"><form onSubmit={submit} className={`${box} w-full max-w-xl p-6 space-y-4`}><div className="flex items-center justify-between"><h2 className="font-semibold text-xl">Collect customer payment</h2><button type="button" onClick={onClose}>✕</button></div>{targetBillId&&<p className="bg-yellow-50 p-3 rounded text-sm">Supplier bill payments are not yet enabled.</p>}
 {error&&<p role="alert" className="text-sm p-3 bg-red-50 text-red-700 rounded">{error}</p>}{result&&<div className="bg-green-50 p-3 text-sm text-green-800 rounded">{result}<button type="button" onClick={onClose} className="underline ml-3">Close</button></div>}
 <label className="block text-sm">Invoice<select className={input} required value={invoiceId} onChange={e=>setInvoiceId(e.target.value)}><option value="">Select invoice</option>{payable.map(i=><option key={i.id} value={i.id}>{i.invoiceNumber} · {i.customerName} ({money(i.balanceDueCents,i.currency)})</option>)}</select></label>
 {active&&<p className="p-3 bg-[#F6F8FB] text-sm rounded">Outstanding: <strong>{money(active.balanceDueCents,active.currency)}</strong></p>}
 <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={full} onChange={e=>setFull(e.target.checked)}/> Collect full outstanding balance</label>
 {!full&&<label className="block text-sm">Amount received ({active?.currency||'KES'})<input required type="number" min="0.01" step="0.01" className={input} value={partial} onChange={e=>setPartial(e.target.value)}/><span className="text-xs text-[#69788B]">Excess above the invoice balance is retained as unapplied customer credit.</span></label>}
 <div className="grid grid-cols-2 gap-3"><label className="text-sm">Payment method<select className={input} value={method} onChange={e=>setMethod(e.target.value)}>{paymentMethods.map(m=><option key={m}>{m}</option>)}</select></label><label className="text-sm">Payment date<input type="date" className={input} value={date} onChange={e=>setDate(e.target.value)}/></label></div>
 <label className="block text-sm">Payment reference<input className={input} value={reference} onChange={e=>setReference(e.target.value)} required={['M-Pesa','Bank Transfer','Card'].includes(method)}/></label>
 <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="px-4 py-2 border rounded">Close</button><button type="submit" disabled={busy||Boolean(result)||Boolean(targetBillId)||!active} className="bg-[#244A73] text-white px-4 py-2 rounded disabled:opacity-50">{busy?'Recording…':'Record & issue receipt'}</button></div></form></div>;
}
