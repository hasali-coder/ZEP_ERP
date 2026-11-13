import React, {useEffect, useMemo, useState} from 'react';
import {Download, FileText, Printer} from 'lucide-react';
import {supabase} from './supabase';
import {ContactLookup} from './ContactLookup';
import {downloadSOAPdf,downloadSOAWord} from './soaExport';
import type {StatementExport} from './soaExport';

const surface='bg-white rounded-lg border border-[#E2E8F0] shadow-sm';
const money=(minor:number,currency:string)=>`${currency} ${(Number(minor||0)/100).toLocaleString('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const amount=(minor:number)=>(Number(minor||0)/100).toLocaleString('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtDate=(d:string)=>d?new Date(d+'T12:00:00').toLocaleDateString('en-KE',{year:'numeric',month:'short',day:'numeric'}):'—';
const diffDays=(d:string,asOf:string)=>Math.round((Date.parse(asOf+'T12:00:00Z')-Date.parse(d+'T12:00:00Z'))/86400000);
const slug=(s:string)=>s.replace(/[^a-z0-9-_]/gi,'_').slice(0,55);
const downloadCsv=(name:string,headers:string[],rows:(string|number)[][])=>{
 const encode=(v:string|number)=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const content='\uFEFF'+[headers,...rows].map(r=>r.map(encode).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download=name+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
};

type AgingRow={invoice_id:string;invoice_number:string;customer_name:string|null;customer_id:string;issue_date:string;due_date:string;currency:string;outstanding_minor:number};
const BUCKETS=[
 {key:'current',label:'Current (Not Due)',color:'text-[#1F806F]'},
 {key:'1-30',label:'1 – 30 Days Overdue',color:'text-[#C38754]'},
 {key:'31-60',label:'31 – 60 Days Overdue',color:'text-[#C38754]'},
 {key:'61-90',label:'61 – 90 Days Overdue',color:'text-[#BF5963]'},
 {key:'90+',label:'90+ Days Overdue',color:'text-[#BF5963]'},
] as const;
const bucket=(n:number)=>n<=0?'current':n<=30?'1-30':n<=60?'31-60':n<=90?'61-90':'90+';
const bucketText:Record<string,string>={current:'Current (Not Due)','1-30':'1–30 Days','31-60':'31–60 Days','61-90':'61–90 Days','90+':'90+ Days'};

export function LegacyAgeingLive({businessId,asOf}:{businessId:string;asOf:string}){
 const [rows,setRows]=useState<AgingRow[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{
  let alive=true;
  const reload=async()=>{
   if(!supabase||!businessId||!asOf){setRows([]);setLoading(false);setError('Select a business and an ageing date.');return;}
   setLoading(true);setError('');
   const {data,error:e}=await supabase.rpc('myzavo_ar_ageing_as_of',{p_business_id:businessId,p_as_of:asOf});
   if(!alive)return;
   if(e){setError(e.message);setRows([]);}else{setRows((data||[]) as AgingRow[]);}setLoading(false);
  };
  void reload();window.addEventListener('myzavo:finance-updated',reload);
  return()=>{alive=false;window.removeEventListener('myzavo:finance-updated',reload);};
 },[businessId,asOf]);
 const sections=useMemo(()=>[...new Set(rows.map(r=>r.currency))].sort().map(currency=>{
  const currencyRows=rows.filter(r=>r.currency===currency),total=currencyRows.reduce((sum,r)=>sum+Number(r.outstanding_minor),0);
  const sums=Object.fromEntries(BUCKETS.map(b=>[b.key,currencyRows.filter(r=>bucket(diffDays(r.due_date,asOf))===b.key).reduce((n,r)=>n+Number(r.outstanding_minor),0)])) as Record<string,number>;
  return {currency,rows:currencyRows,total,sums};
 }),[rows,asOf]);
 const exportCsv=()=>downloadCsv(`AR_Ageing_${asOf}`,
  ['Customer','Invoice #','Issue Date','Due Date','Ageing Category','Currency','Outstanding Balance'],
  rows.map(r=>[r.customer_name||'Customer',r.invoice_number,r.issue_date,r.due_date,bucketText[bucket(diffDays(r.due_date,asOf))],r.currency,Number(r.outstanding_minor)/100]));
 return <div className={`${surface} p-6 sm:p-8 space-y-6 print-page`}>
  <div className="flex flex-wrap justify-between gap-3 border-b border-[#E2E8F0] pb-4">
   <div><h2 className="text-xl font-semibold text-[#182539]">Accounts Receivable Ageing Summary</h2><p className="text-xs text-[#69788B] mt-1">Outstanding invoice balances grouped by overdue ageing days · As of {fmtDate(asOf)}</p></div>
   <div className="flex gap-2 items-start print:hidden"><button type="button" onClick={exportCsv} disabled={loading||!!error} className="inline-flex items-center gap-1.5 border border-[#E2E8F0] px-3 py-2 rounded text-xs font-medium disabled:opacity-40"><Download className="w-4 h-4"/>Export CSV</button><button type="button" onClick={()=>window.print()} className="inline-flex items-center gap-1.5 bg-[#244A73] text-white px-3 py-2 rounded text-xs font-semibold"><Printer className="w-4 h-4"/>Print / PDF</button></div>
  </div>
  {loading&&<p className="text-sm text-[#69788B]">Loading live receivables from Supabase…</p>}
  {error&&<p role="alert" className="p-3 text-sm bg-red-50 text-red-700 rounded">{error}</p>}
  {!loading&&!error&&sections.length===0&&<div className="p-10 text-sm text-[#69788B] text-center">No outstanding issued invoices at this date.</div>}
  {!loading&&!error&&sections.map(section=><div key={section.currency} className="space-y-5">
   <div className="flex flex-wrap items-baseline justify-between gap-3"><div><span className="text-xs uppercase font-semibold tracking-wider text-[#69788B]">Currency</span><h3 className="text-lg font-bold text-[#244A73]">{section.currency}</h3></div><div className="text-right"><span className="text-xs uppercase font-medium tracking-wider text-[#69788B]">Total Receivables</span><div className="text-2xl font-semibold tabular-nums text-[#0D1B33]">{money(section.total,section.currency)}</div></div></div>
   <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">{BUCKETS.map(b=><div key={b.key} className="p-3.5 bg-[#F6F8FB] rounded-lg border border-[#E2E8F0]"><span className={`text-[11px] uppercase font-semibold ${b.color}`}>{b.label}</span><div className="text-base font-semibold tabular-nums text-[#182539] mt-2">{money(section.sums[b.key]||0,section.currency)}</div></div>)}</div>
   <div className="overflow-x-auto"><table className="w-full text-left text-sm border-collapse"><thead><tr className="bg-[#F6F8FB] border-b border-[#E2E8F0] text-xs font-semibold text-[#69788B] uppercase tracking-wider"><th className="py-3 px-3">Customer</th><th className="py-3 px-3">Invoice #</th><th className="py-3 px-3">Due Date</th><th className="py-3 px-3">Ageing Category</th><th className="py-3 px-3 text-right">Outstanding Balance</th></tr></thead><tbody className="divide-y divide-[#E2E8F0]">{section.rows.map(r=><tr key={r.invoice_id} className="hover:bg-[#F6F8FB]"><td className="py-3 px-3 font-medium text-[#182539]">{r.customer_name||'Customer'}</td><td className="py-3 px-3 font-mono font-medium text-xs text-[#244A73]">{r.invoice_number}</td><td className="py-3 px-3 text-[#69788B] text-xs">{fmtDate(r.due_date)}</td><td className="py-3 px-3 text-[#69788B] text-xs">{bucketText[bucket(diffDays(r.due_date,asOf))]}</td><td className="py-3 px-3 text-right tabular-nums font-semibold text-[#182539]">{money(Number(r.outstanding_minor),section.currency)}</td></tr>)}</tbody></table></div>
  </div>)}
  <p className="text-xs text-[#69788B] border-t pt-4">Receivables are calculated as at the selected date from issued invoices, posted payment allocations and issued credit notes. Different currencies are never combined without an exchange rate.</p>
 </div>;
}

export type SOARow={date:string;ref:string;currency:string;debit:number;credit:number;description?:string};
type SOAContact={id:string;name:string;companyName?:string;address?:string;email?:string;customerCode?:string;taxNumber?:string};
type SOABusiness={name:string;address?:string;city?:string;country?:string;email?:string;taxNumber?:string;paymentInstructions?:string};
export function LegacyStatementLive({business,businessId,customers,customerId,setCustomerId,from,to,lines}: {business:SOABusiness;businessId:string;customers:SOAContact[];customerId:string;setCustomerId:(v:string)=>void;from:string;to:string;lines:SOARow[]}){
 const [busy,setBusy]=useState(false),[exportError,setExportError]=useState('');
 const customer=customers.find(c=>c.id===customerId);
 const groups=useMemo(()=>[...new Set(lines.map(l=>l.currency))].sort().map(currency=>{
  const all=lines.filter(l=>l.currency===currency && l.date<=to);
  const opening=all.filter(l=>l.date<from).reduce((n,l)=>n+Number(l.debit)-Number(l.credit),0);
  let running=opening;
  const rows=all.filter(l=>l.date>=from).map(l=>({...l,running:(running+=Number(l.debit)-Number(l.credit))}));
  const debits=rows.reduce((n,l)=>n+Number(l.debit),0),credits=rows.reduce((n,l)=>n+Number(l.credit),0);
  return {currency,opening,rows,debits,credits,closing:running};
 }),[lines,from,to]);
 const exportData:StatementExport|undefined=customer?{
  business:{id:businessId,name:business.name,address:business.address,city:business.city,country:business.country,email:business.email,taxNumber:business.taxNumber},
  customer:{name:customer.name,companyName:customer.companyName,address:customer.address,email:customer.email,customerCode:customer.customerCode},
  from,to,lines
 }:undefined;
 const doExport=async(kind:'pdf'|'word')=>{if(!exportData)return;setBusy(true);setExportError('');try{if(kind==='pdf')await downloadSOAPdf(exportData);else await downloadSOAWord(exportData);}catch(e){setExportError(e instanceof Error?e.message:'Export failed');}finally{setBusy(false);}};
 return <div className="space-y-4">
  <div className={`${surface} p-4 flex flex-wrap items-end justify-between gap-3 print:hidden`}><label className="text-xs font-semibold text-[#182539]">Customer <ContactLookup businessId={businessId} role="customer" value={customerId} onChange={setCustomerId} className="mt-1 w-full min-w-[260px]"/></label>
   <div className="flex flex-wrap gap-2"><button type="button" disabled={!customer||busy} onClick={()=>void doExport('pdf')} className="inline-flex items-center gap-1.5 rounded bg-[#244A73] text-white px-3 py-2 text-xs font-semibold disabled:opacity-40"><Download className="w-4 h-4"/>Export SOA PDF</button><button type="button" disabled={!customer||busy} onClick={()=>void doExport('word')} className="inline-flex items-center gap-1.5 rounded border border-[#E2E8F0] px-3 py-2 text-xs font-medium disabled:opacity-40"><FileText className="w-4 h-4"/>Export SOA Word</button><button type="button" disabled={!customer} onClick={()=>window.print()} className="inline-flex items-center gap-1.5 rounded border border-[#E2E8F0] px-3 py-2 text-xs font-medium"><Printer className="w-4 h-4"/>Print</button></div>
  </div>
  {exportError&&<p role="alert" className="text-sm text-red-700 bg-red-50 p-3 rounded">{exportError}</p>}
  <div className={`${surface} p-6 sm:p-8 print-page space-y-6 text-sm`}>
  {!customer?<p className="p-12 text-center text-xs text-[#69788B]">Select a customer to generate their Statement of Account.</p>:<>
   <div className="flex flex-col sm:flex-row justify-between items-start pb-8 border-b border-[#E2E8F0] gap-4">
    <div><div className="flex items-center gap-2.5 mb-2"><div className="w-8 h-8 rounded bg-[#0D1B33] flex items-center justify-center text-white font-bold text-sm">{business.name.charAt(0)}</div><h2 className="text-xl font-semibold text-[#182539] tracking-tight">{business.name}</h2></div>{business.address&&<p className="text-xs text-[#69788B]">{business.address}</p>}<p className="text-xs text-[#69788B]">{[business.city,business.country].filter(Boolean).join(', ')}</p>{business.email&&<p className="text-xs text-[#69788B]">Email: {business.email}</p>}{business.taxNumber&&<p className="text-xs text-[#69788B] font-mono mt-0.5">Tax PIN: {business.taxNumber}</p>}</div>
    <div className="text-left sm:text-right"><h1 className="text-2xl font-bold tracking-tight text-[#0D1B33] uppercase">STATEMENT OF ACCOUNT</h1><div className="mt-2 space-y-1 text-xs"><p><span className="text-[#69788B]">Statement Period: </span><strong className="text-[#182539]">{fmtDate(from)} to {fmtDate(to)}</strong></p><p><span className="text-[#69788B]">Generated On: </span>{new Date().toLocaleDateString('en-KE',{timeZone:'Africa/Nairobi'})}</p></div></div>
   </div>
   <div className="py-4 border-b border-[#E2E8F0] grid grid-cols-1 sm:grid-cols-2 gap-4"><div><span className="text-xs font-medium uppercase tracking-wider text-[#69788B] block mb-1">Account Customer</span><h3 className="font-semibold text-base text-[#182539]">{customer.companyName||customer.name}</h3>{customer.companyName&&<p className="text-xs text-[#69788B]">Attn: {customer.name}</p>}{customer.address&&<p className="text-xs text-[#69788B]">{customer.address}</p>}{customer.email&&<p className="text-xs text-[#69788B]">{customer.email}</p>}{customer.customerCode&&<p className="text-xs text-[#69788B] font-mono">Account: {customer.customerCode}</p>}{customer.taxNumber&&<p className="text-xs text-[#69788B]">Tax PIN: {customer.taxNumber}</p>}</div>
    <div className="bg-[#F6F8FB] p-4 rounded-lg border border-[#E2E8F0] space-y-4"><span className="text-xs uppercase tracking-wide font-semibold text-[#69788B]">Account Overview</span>{groups.length===0?<p className="text-xs text-[#69788B]">No issued transactions for this customer.</p>:groups.map(g=><div className="text-xs space-y-1.5" key={g.currency}><p className="font-bold text-[#244A73]">{g.currency}</p><div className="flex justify-between"><span>Opening Balance:</span><strong className="tabular-nums">{money(g.opening,g.currency)}</strong></div><div className="flex justify-between"><span>Invoiced During Period:</span><strong className="tabular-nums">+{money(g.debits,g.currency)}</strong></div><div className="flex justify-between text-[#1F806F]"><span>Payments / Credits:</span><strong className="tabular-nums">−{money(g.credits,g.currency)}</strong></div><div className="border-t border-[#E2E8F0] pt-1.5 flex justify-between text-[#0D1B33]"><strong>Closing Account Balance:</strong><strong className="tabular-nums">{money(g.closing,g.currency)}</strong></div></div>)}</div>
   </div>
   {groups.length===0?<div className="py-8 text-center text-sm text-[#69788B]">No issued invoices, payments or credit notes in the selected customer account.</div>:groups.map(g=><div className="py-4 space-y-3" key={g.currency}><div className="flex items-center justify-between"><h3 className="font-semibold text-[#244A73]">Account Ledger · {g.currency}</h3><span className="text-xs text-[#69788B]">Running balances in {g.currency}</span></div><div className="overflow-x-auto"><table className="w-full text-left text-sm border-collapse"><thead><tr className="border-b border-[#E2E8F0] text-xs font-semibold text-[#69788B] uppercase tracking-wider"><th className="py-2.5">Date</th><th className="py-2.5">Ref #</th><th className="py-2.5">Activity Description</th><th className="py-2.5 text-right">Debit (Inv)</th><th className="py-2.5 text-right">Credit (Pmt)</th><th className="py-2.5 text-right">Running Balance</th></tr></thead><tbody className="divide-y divide-[#E2E8F0]"><tr className="bg-[#F6F8FB]/70 font-medium"><td className="py-2.5 text-[#69788B] text-xs">{fmtDate(from)}</td><td className="py-2.5 font-mono text-xs text-[#69788B]">—</td><td className="py-2.5 text-[#182539] italic">Opening Balance Carried Forward</td><td className="py-2.5 text-right">—</td><td className="py-2.5 text-right">—</td><td className="py-2.5 text-right font-semibold">{money(g.opening,g.currency)}</td></tr>{g.rows.length===0?<tr><td colSpan={6} className="py-6 text-center text-xs text-[#69788B]">No activity during the selected period.</td></tr>:g.rows.map((item,i)=><tr key={`${item.ref}-${i}`} className="hover:bg-[#F6F8FB]"><td className="py-3 text-[#69788B] text-xs">{fmtDate(item.date)}</td><td className="py-3 font-mono font-medium text-xs text-[#244A73]">{item.ref}</td><td className="py-3 font-medium text-[#182539]">{item.description|| (item.debit>0?'Invoice issued':'Payment / credit applied')}</td><td className="py-3 text-right tabular-nums">{item.debit>0?amount(item.debit):'—'}</td><td className="py-3 text-right tabular-nums text-[#1F806F] font-medium">{item.credit>0?amount(item.credit):'—'}</td><td className="py-3 text-right tabular-nums font-semibold text-[#0D1B33]">{money(item.running,g.currency)}</td></tr>)}</tbody></table></div><div className="pt-4 border-t-2 border-[#0D1B33] flex justify-between items-baseline font-semibold text-base"><span className="text-[#182539]">Total Amount Payable as of {fmtDate(to)}:</span><span className="tabular-nums text-xl text-[#0D1B33]">{money(g.closing,g.currency)}</span></div></div>)}
   <div className="mt-8 pt-6 border-t border-[#E2E8F0] text-xs text-[#69788B] leading-relaxed"><h4 className="font-semibold uppercase tracking-wider mb-1">Remittance Advice</h4><p>{business.paymentInstructions||'Please use the payment instructions on your invoice and quote your customer account or invoice reference when remitting payment.'}</p></div>
  </>}
  </div>
 </div>;
}
