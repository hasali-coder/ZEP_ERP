import {businessLogoBytes} from './BusinessLogo';
import React, {useEffect, useMemo, useState} from 'react';
import {Download, Printer, X, RefreshCw} from 'lucide-react';
import {PDFDocument, StandardFonts, rgb} from 'pdf-lib';
import {supabase} from './supabase';
import {useFinancial} from '../context/FinancialContext';

const panel='rounded-xl border border-[#E2E8F0] bg-white shadow-sm';
const field='w-full rounded-md border border-[#DCE5EE] bg-white px-3 py-2 text-sm text-[#0D1B33]';
const bid=()=>window.location.pathname.match(/^\/app\/([0-9a-f-]{36})/i)?.[1]||'';
const mon=(n:number,c:string)=>`${c} ${(Number(n||0)/100).toLocaleString('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const safeName=(s:string)=>s.replace(/[^a-z0-9 _.-]/gi,'').trim().replace(/\s+/g,'_').slice(0,70)||'Business';
const east=(v:string)=>new Date(v).toLocaleString('en-KE',{timeZone:'Africa/Nairobi',year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
const eastInput=(v:string)=>new Date(v).toLocaleString('sv-SE',{timeZone:'Africa/Nairobi',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).replace(' ','T').slice(0,16);
const localDate=(v:string)=>new Date(v+'T12:00:00').toLocaleDateString('en-KE',{year:'numeric',month:'short',day:'numeric'});
const method=(s:string)=>({mpesa:'M-Pesa',bank_transfer:'Bank transfer',cash:'Cash',card:'Card',cheque:'Cheque',other:'Other'} as Record<string,string>)[s]||s||'—';
const csvCell=(v:unknown)=>'"'+String(v??'').replace(/"/g,'""')+'"';
function csvDownload(name:string,columns:string[],data:(string|number)[][]){
 const content='\uFEFF'+[columns,...data].map(row=>row.map(csvCell).join(',')).join('\r\n');
 const u=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download=name+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);
}
function browserDownload(data:Uint8Array,name:string){
 const copy=new Uint8Array(data.length);copy.set(data);
 const u=URL.createObjectURL(new Blob([copy.buffer],{type:'application/pdf'}));const a=document.createElement('a');a.href=u;a.download=name+'.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);
}
function pdfText(s:unknown){return String(s??'').normalize('NFKD').replace(/[^\x20-\x7e]/g,' ').slice(0,180)}
const ink=rgb(.075,.15,.26),muted=rgb(.38,.45,.53),rule=rgb(.84,.88,.92);
type BusinessInfo={name:string;address?:string;city?:string;country?:string;email?:string;phone?:string;taxNumber?:string};
type Transaction={id:string;business_id:string;contact_id:string|null;expense_id:string|null;direction:'in'|'out';amount_minor:number;currency:string;payment_method:string;payment_date:string;created_at:string;reference_number:string|null;description:string;notes:string|null;status:string};
type Receipt={id:string;business_id:string;transaction_id:string;customer_id:string;receipt_number:string;issued_at:string;currency:string;received_minor:number;allocated_minor:number;unapplied_minor:number;status:string};
type Allocation={invoice_id:string|null;amount_minor:number};
type LinkedInvoice={id:string;invoice_number:string};
async function fetchAll(table:'financial_transactions'|'receipts',businessId:string):Promise<{rows:any[];limited:boolean}>{
 if(!supabase)throw Error('Supabase is unavailable');
 const out:any[]=[];let page=0;const pageSize=500;
 while(page<20){const {data,error}=await supabase.from(table).select('*').eq('business_id',businessId).order(table==='receipts'?'issued_at':'created_at',{ascending:false}).range(page*pageSize,(page+1)*pageSize-1);
  if(error)throw error;out.push(...(data||[]));if((data||[]).length<pageSize)return {rows:out,limited:false};page++;}
 return {rows:out,limited:true};
}
function useFinanceDocuments(){
 const [transactions,setTransactions]=useState<Transaction[]>([]),[receipts,setReceipts]=useState<Receipt[]>([]);
 const [busy,setBusy]=useState(true),[error,setError]=useState(''),[limited,setLimited]=useState(false);
 const id=bid();const [reloadKey,setReloadKey]=useState(0);
 useEffect(()=>{
 const reload=()=>setReloadKey(k=>k+1);
 window.addEventListener('myzavo:finance-updated',reload);
 return()=>{window.removeEventListener('myzavo:finance-updated',reload);};
 },[]);
 useEffect(()=>{let active=true;async function run(){setBusy(true);setError('');if(!id){setError('Select a business first');setBusy(false);return;}
 try{const [t,r]=await Promise.all([fetchAll('financial_transactions',id),fetchAll('receipts',id)]);
 if(active){setTransactions(t.rows as Transaction[]);setReceipts(r.rows as Receipt[]);setLimited(t.limited||r.limited);}}
 catch(e){if(active)setError(e instanceof Error?e.message:'Unable to retrieve financial records');}
 finally{if(active)setBusy(false);}}
 void run();return()=>{active=false;};},[id,reloadKey]);
 return {transactions,receipts,busy,error,limited,reload:()=>setReloadKey(k=>k+1)};
}
async function receiptAllocations(tId:string,businessId:string):Promise<{allocations:Allocation[];invoices:LinkedInvoice[]}>{
 if(!supabase)throw Error('Supabase unavailable');
 const {data,error}=await supabase.from('payment_allocations').select('invoice_id,amount_minor').eq('business_id',businessId).eq('transaction_id',tId).is('credit_applied_on',null);
 if(error)throw error;const allocations=(data||[]) as Allocation[];
 const ids=[...new Set(allocations.map(a=>a.invoice_id).filter((x):x is string=>!!x))];
 if(!ids.length)return {allocations,invoices:[]};
 const resp=await supabase.from('invoices').select('id,invoice_number').eq('business_id',businessId).in('id',ids);
 if(resp.error)throw resp.error;return {allocations,invoices:(resp.data||[]) as LinkedInvoice[]};
}
async function makeDocument(business:BusinessInfo,tx:Transaction,receipt:Receipt|null,customer:string,links:{allocations:Allocation[];invoices:LinkedInvoice[]}){
 const doc=await PDFDocument.create();doc.setCreator('Zep ERP');doc.setProducer('Zep ERP');const normal=await doc.embedFont(StandardFonts.Helvetica);const bold=await doc.embedFont(StandardFonts.HelveticaBold);
 let pg=doc.addPage([595,842]);let y=790;
 const draw=(value:unknown,x:number,size=10,strong=false,color=ink)=>{pg.drawText(pdfText(value),{x,y,size,font:strong?bold:normal,color,maxWidth:500-x+48});};
 const line=()=>pg.drawLine({start:{x:46,y},end:{x:549,y},thickness:.7,color:rule});
 try{const logo=await businessLogoBytes(tx.business_id);if(logo){const img=logo.kind==='png'?await doc.embedPng(logo.bytes):await doc.embedJpg(logo.bytes);
   const scale=Math.min(110/img.width,42/img.height,1);pg.drawImage(img,{x:540-img.width*scale,y:756,width:img.width*scale,height:img.height*scale});}}catch{}
 draw(business.name,46,20,true);y-=24;
 for(const value of [[business.address,business.city,business.country].filter(Boolean).join(', '),business.email,business.phone,business.taxNumber?`Tax PIN: ${business.taxNumber}`:''].filter(Boolean)){draw(value,46,9,false,muted);y-=14;}
 y-=14;line();y-=36;
 draw(receipt?'PAYMENT RECEIPT':'TRANSACTION PAYMENT RECORD',46,17,true);y-=26;
 draw(receipt?`Receipt number: ${receipt.receipt_number}`:`Transaction ID: ${tx.id}`,46,10,true);y-=18;
 draw(receipt?`Issued: ${east(receipt.issued_at)} EAT`:`Recorded: ${east(tx.created_at)} EAT`,46);y-=18;
 draw(`Customer / Payee: ${customer}`,46);y-=18;
 draw(`Status: ${receipt?receipt.status:tx.status}`,46);y-=26;line();y-=29;
 draw(`Amount ${receipt?'received':'recorded'}: ${mon(receipt?Number(receipt.received_minor):Number(tx.amount_minor),tx.currency)}`,46,15,true);y-=28;
 draw(`Direction: ${tx.direction==='in'?'Money received':'Money paid'}`,46);y-=18;
 draw(`Payment method: ${method(tx.payment_method)}`,46);y-=18;
 draw(`Payment date: ${localDate(tx.payment_date)}`,46);y-=18;
 draw(`Reference: ${tx.reference_number||'Not provided'}`,46);y-=18;
 draw(`Description: ${tx.description}`,46);y-=25;
 if(receipt){draw(`Allocated: ${mon(Number(receipt.allocated_minor),receipt.currency)}`,46);y-=18;
 draw(`Unapplied credit at issue: ${mon(Number(receipt.unapplied_minor),receipt.currency)}`,46);y-=22;}
 if(links.allocations.length){line();y-=24;draw('INVOICE ALLOCATIONS',46,11,true);y-=23;
 for(const a of links.allocations.slice(0,15)){
 const label=links.invoices.find(i=>i.id===a.invoice_id)?.invoice_number||a.invoice_id||'Invoice';
 draw(label,46,10);draw(mon(Number(a.amount_minor),tx.currency),365,10,true);y-=19;
 if(y<105){pg=doc.addPage([595,842]);y=780;}
 }
 if(links.allocations.length>15){draw(`Plus ${links.allocations.length-15} additional allocations (see ZEP ERP).`,46,9,false,muted);y-=18;}}
 y=Math.min(y-40,88);if(y<80)y=80;line();y-=17;
 draw(receipt?'This is an electronically issued receipt. No signature is required.':'This transaction record is not a customer payment receipt.',46,8,false,muted);
 return doc.save();
}
async function makeLedgerPdf(business:BusinessInfo,rows:Transaction[],contactName:(r:Transaction)=>string){
 const doc=await PDFDocument.create();doc.setCreator('Zep ERP');doc.setProducer('Zep ERP');const normal=await doc.embedFont(StandardFonts.Helvetica);const bold=await doc.embedFont(StandardFonts.HelveticaBold);
 let page=doc.addPage([595,842]),y=798;
 const start=()=>{page.drawText(pdfText(business.name),{x:40,y,size:17,font:bold,color:ink});y-=21;
 page.drawText('Financial transactions | filtered export', {x:40,y,size:11,font:bold,color:ink});y-=22;
 page.drawText('Date             Direction   Contact / Description                      Amount', {x:40,y,size:8,font:bold,color:muted});y-=19;};
 start();for(const t of rows){if(y<60){page=doc.addPage([595,842]);y=798;start();}
 const name=contactName(t).slice(0,21);const desc=(t.description||'').slice(0,21);
 page.drawText(pdfText(t.payment_date),{x:40,y,size:8,font:normal,color:ink});
 page.drawText(t.direction==='in'?'IN':'OUT',{x:112,y,size:8,font:normal,color:ink});
 page.drawText(pdfText(`${name} ${desc}`.slice(0,49)),{x:150,y,size:8,font:normal,color:ink});
 page.drawText(pdfText(mon(Number(t.amount_minor),t.currency)),{x:440,y,size:8,font:bold,color:ink,maxWidth:120});y-=16;}
 return doc.save();
}
const nameOf=(contacts:any[],id:string|null)=>{const c=contacts.find(x=>x.id===id);return c?.companyName||c?.name||'—';};
function FinanceModal({heading,onClose,children}:{heading:string;onClose:()=>void;children:React.ReactNode}){
 return <div role="dialog" aria-modal="true" aria-label={heading} className="fixed inset-0 z-[160] flex items-center justify-center bg-[#0D1B33]/65 p-4" onMouseDown={(e:any)=>{if(e.target===e.currentTarget)onClose();}}>
 <div className={`${panel} w-full max-w-2xl max-h-[92vh] overflow-y-auto`}><div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between"><h2 className="font-semibold text-[#0D1B33] text-lg">{heading}</h2><button type="button" onClick={onClose} aria-label="Close modal"><X className="w-5 h-5"/></button></div><div className="p-6">{children}</div></div></div>;
}
const detail=(label:string,v:string)=> <div className="flex gap-3 justify-between border-b border-[#EEF1F5] py-2 text-sm"><span className="text-[#69788B]">{label}</span><strong className="text-right text-[#182539] font-medium">{v}</strong></div>;

export function LiveReceiptsExplorer(){
 const {activeBusiness,contacts}=useFinancial();const {transactions,receipts,busy,error,limited,reload}=useFinanceDocuments();
 const [search,setSearch]=useState(''),[customer,setCustomer]=useState(''),[start,setStart]=useState(''),[end,setEnd]=useState('');
 const [chosen,setChosen]=useState<Receipt|null>(null),[links,setLinks]=useState<{allocations:Allocation[];invoices:LinkedInvoice[]}>({allocations:[],invoices:[]});const [detailError,setDetailError]=useState('');const [exportError,setExportError]=useState('');
 const business:BusinessInfo=activeBusiness;
 const rows=useMemo(()=>receipts.filter(r=>{
 const t=eastInput(r.issued_at),name=nameOf(contacts,r.customer_id).toLowerCase();
 return (!customer||r.customer_id===customer)&&(!start||t>=start)&&(!end||t<=end)&&(!search||[r.receipt_number,name,transactions.find(t=>t.id===r.transaction_id)?.reference_number||''].join(' ').toLowerCase().includes(search.toLowerCase()));
 }),[receipts,contacts,transactions,customer,start,end,search]);
 useEffect(()=>{if(!chosen)return;let active=true;setDetailError('');setLinks({allocations:[],invoices:[]});
 void receiptAllocations(chosen.transaction_id,chosen.business_id).then(v=>{if(active)setLinks(v);}).catch(e=>{if(active)setDetailError(e instanceof Error?e.message:'Unable to retrieve receipt allocations');});return()=>{active=false;};},[chosen?.id]);
 const getPdf=async(r:Receipt,print=false)=>{setExportError('');const t=transactions.find(t=>t.id===r.transaction_id);if(!t){setExportError('The linked transaction could not be found. Receipt export is unavailable.');return;}
 const viewer=print?window.open('','_blank'):null;
 try{const link=chosen?.id===r.id&&!detailError?links:await receiptAllocations(r.transaction_id,r.business_id);
 const pdf=await makeDocument(business,t,r,nameOf(contacts,r.customer_id),link);
 if(print){const copy=new Uint8Array(pdf.length);copy.set(pdf);const u=URL.createObjectURL(new Blob([copy.buffer],{type:'application/pdf'}));if(viewer){viewer.location.href=u;}else{browserDownload(pdf,`${safeName(business.name)}_${r.receipt_number}`);}setTimeout(()=>URL.revokeObjectURL(u),180000);}
 else browserDownload(pdf,`${safeName(business.name)}_${r.receipt_number}`);
 }catch(e){viewer?.close();setExportError(e instanceof Error?e.message:'PDF export failed');}};
 const txOf=(r:Receipt)=>transactions.find(t=>t.id===r.transaction_id);
 return <div className="space-y-4">
 <div className={`${panel} p-5 flex flex-wrap justify-between items-center gap-3`}><div><h2 className="font-semibold text-xl">Customer Receipts</h2><p className="text-sm text-[#69788B]">Official receipts issued for customer payments in this business</p></div><div className="flex items-center gap-2"><span className="text-xs text-[#69788B]">{rows.length} receipts</span><button type="button" className="rounded border p-2" title="Refresh" onClick={reload}><RefreshCw className="w-4 h-4"/></button></div></div>
 <div className={`${panel} p-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4`}><label className="text-xs font-medium">Receipt / customer / reference<input className={field} value={search} onChange={(e:any)=>setSearch(e.target.value)} placeholder="Search"/></label>
 <label className="text-xs font-medium">Customer<select className={field} value={customer} onChange={(e:any)=>setCustomer(e.target.value)}><option value="">All customers</option>{contacts.filter(c=>c.type==='customer').map(c=><option key={c.id} value={c.id}>{c.companyName||c.name}</option>)}</select></label>
 <label className="text-xs font-medium">Issued from (EAT)<input className={field} type="datetime-local" value={start} onChange={(e:any)=>setStart(e.target.value)}/></label><label className="text-xs font-medium">Issued to (EAT)<input className={field} type="datetime-local" value={end} min={start||undefined} onChange={(e:any)=>setEnd(e.target.value)}/></label></div>
 {exportError&&<p role="alert" className="text-sm p-3 rounded bg-red-50 text-red-800">{exportError}</p>}
 {limited&&<p role="alert" className="text-sm p-3 rounded bg-amber-50 text-amber-800">Showing the latest 10,000 records. Narrow the period or ask for paginated reporting before relying on an exhaustive export.</p>}
 <div className={`${panel} overflow-x-auto`}>{busy?<p className="p-6 text-sm">Loading receipts from Supabase…</p>:error?<p role="alert" className="p-5 text-red-700">{error}</p>:rows.length===0?<p className="p-12 text-center text-sm text-[#69788B]">No receipts match the selected filters.</p>:<table className="w-full text-sm text-left"><thead className="bg-[#F6F8FB] text-xs uppercase text-[#69788B]"><tr>{['Receipt ID','Issued (EAT)','Customer','Received','Method','Reference','Actions'].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.id} className="border-t hover:bg-[#F7FAFD]"><td className="p-3"><button className="text-[#244A73] font-semibold underline underline-offset-2" onClick={()=>setChosen(r)}>{r.receipt_number}</button></td><td className="p-3 whitespace-nowrap">{east(r.issued_at)}</td><td className="p-3">{nameOf(contacts,r.customer_id)}</td><td className="p-3 font-medium whitespace-nowrap">{mon(Number(r.received_minor),r.currency)}</td><td className="p-3">{method(txOf(r)?.payment_method||'')}</td><td className="p-3">{txOf(r)?.reference_number||'—'}</td><td className="p-3 whitespace-nowrap"><button className="text-[#244A73] underline mr-3" onClick={()=>setChosen(r)}>View</button><button className="text-[#244A73] underline mr-3" onClick={()=>void getPdf(r)}>PDF</button><button className="text-[#244A73] underline" onClick={()=>void getPdf(r,true)}>Print</button></td></tr>)}</tbody></table>}</div>
 {chosen&&<FinanceModal heading={`Receipt ${chosen.receipt_number}`} onClose={()=>setChosen(null)}><div className="mb-4"><h3 className="text-xl font-semibold">{business.name}</h3><p className="text-xs text-[#69788B]">{[business.address,business.city,business.country].filter(Boolean).join(', ')}</p></div>
 {detail('Receipt number',chosen.receipt_number)}{detail('Issued (EAT)',east(chosen.issued_at))}{detail('Customer',nameOf(contacts,chosen.customer_id))}{detail('Amount received',mon(Number(chosen.received_minor),chosen.currency))}{detail('Applied',mon(Number(chosen.allocated_minor),chosen.currency))}{detail('Unapplied credit at issue',mon(Number(chosen.unapplied_minor),chosen.currency))}{detail('Payment method',method(txOf(chosen)?.payment_method||''))}{detail('Transaction reference',txOf(chosen)?.reference_number||'—')}{detail('Status',chosen.status)}
 <div className="mt-5"><h4 className="font-semibold text-sm mb-2">Invoice allocations</h4>{detailError?<p role="alert" className="text-red-700 text-sm">{detailError}</p>:links.allocations.length===0?<p className="text-xs text-[#69788B]">No invoice allocations found.</p>:<div className="space-y-2">{links.allocations.map((a,i)=><div className="flex justify-between text-sm border-b py-2" key={i}><span>{links.invoices.find(v=>v.id===a.invoice_id)?.invoice_number||'Invoice'}</span><strong>{mon(Number(a.amount_minor),chosen.currency)}</strong></div>)}</div>}</div>
 <div className="mt-6 flex flex-wrap gap-2 justify-end"><button type="button" className="border rounded px-4 py-2 text-sm" onClick={()=>void getPdf(chosen,true)}><Printer className="w-4 h-4 inline mr-1"/>Print receipt</button><button type="button" className="bg-[#244A73] text-white rounded px-4 py-2 text-sm" onClick={()=>void getPdf(chosen)}><Download className="w-4 h-4 inline mr-1"/>Export PDF</button></div></FinanceModal>}
 </div>;
}

export function LiveTransactionsExplorer({onOpenPaymentModal}:{onOpenPaymentModal?:()=>void}){
 const {activeBusiness,contacts}=useFinancial();const {transactions,receipts,busy,error,limited,reload}=useFinanceDocuments();
 const [customer,setCustomer]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState(''),[search,setSearch]=useState(''),[direction,setDirection]=useState('all');
 const [selected,setSelected]=useState<Transaction|null>(null),[links,setLinks]=useState<{allocations:Allocation[];invoices:LinkedInvoice[]}>({allocations:[],invoices:[]});const [detailError,setDetailError]=useState(''),[exportError,setExportError]=useState('');
 const business:BusinessInfo=activeBusiness;
 const rows=useMemo(()=>transactions.filter(t=>(!customer||t.contact_id===customer)&&(!from||t.payment_date>=from)&&(!to||t.payment_date<=to)&&(direction==='all'||t.direction===direction)&&(!search||[t.description,t.reference_number,nameOf(contacts,t.contact_id),t.id].join(' ').toLowerCase().includes(search.toLowerCase()))),[transactions,contacts,customer,from,to,direction,search]);
 const receiptOf=(tx:Transaction)=>receipts.find(r=>r.transaction_id===tx.id)||null;
 useEffect(()=>{if(!selected)return;let active=true;setLinks({allocations:[],invoices:[]});setDetailError('');void receiptAllocations(selected.id,selected.business_id).then(v=>{if(active)setLinks(v);}).catch(e=>{if(active)setDetailError(e instanceof Error?e.message:'Unable to retrieve allocations');});return()=>{active=false;};},[selected?.id]);
 const documentFor=async(tx:Transaction,print=false)=>{setExportError('');const popup=print?window.open('','_blank'):null;
 try{const linked=selected?.id===tx.id&&!detailError?links:await receiptAllocations(tx.id,tx.business_id);
 const r=receiptOf(tx);const output=await makeDocument(business,tx,r,nameOf(contacts,tx.contact_id),linked);
 const name=safeName(business.name)+'_'+(r?.receipt_number||'Transaction_'+tx.id.slice(0,8));
 if(print){const arr=new Uint8Array(output.length);arr.set(output);const u=URL.createObjectURL(new Blob([arr.buffer],{type:'application/pdf'}));if(popup)popup.location.href=u;else browserDownload(output,name);setTimeout(()=>URL.revokeObjectURL(u),180000);}else browserDownload(output,name);
 }catch(e){popup?.close();setExportError(e instanceof Error?e.message:'Document export failed');}};
 const summary=[...new Set(rows.map(t=>t.currency))].sort().map(currency=>({currency,in:rows.filter(t=>t.currency===currency&&t.direction==='in'&&t.status==='posted').reduce((n,t)=>n+Number(t.amount_minor),0),out:rows.filter(t=>t.currency===currency&&t.direction==='out'&&t.status==='posted').reduce((n,t)=>n+Number(t.amount_minor),0)}));
 const exportPdf=async()=>{setExportError('');try{const b=await makeLedgerPdf(business,rows,t=>nameOf(contacts,t.contact_id));browserDownload(b,`${safeName(business.name)}_Transactions_${from||'all'}_${to||'all'}`);}catch(e){setExportError(e instanceof Error?e.message:'Transaction PDF export failed');}};
 const exportCsv=()=>csvDownload(`${safeName(business.name)}_Transactions_${from||'all'}_${to||'all'}`,['Date','Transaction ID','Direction','Customer/Contact','Description','Reference','Payment method','Currency','Amount','Status'],rows.map(t=>[t.payment_date,t.id,t.direction,nameOf(contacts,t.contact_id),t.description,t.reference_number||'',method(t.payment_method),t.currency,(Number(t.amount_minor)/100).toFixed(2),t.status]));
 return <div className="space-y-4">
 <div className={`${panel} p-5 flex flex-wrap gap-3 justify-between items-center`}><div><h2 className="text-xl font-semibold">Financial Transactions</h2><p className="text-sm text-[#69788B]">Search, inspect and export recorded cash movements</p></div><div className="flex flex-wrap gap-2"><button className="rounded border px-3 py-2 text-sm" onClick={reload}><RefreshCw className="w-4 h-4 inline mr-1"/>Refresh</button><button className="rounded border px-3 py-2 text-sm" disabled={!rows.length||busy} onClick={exportCsv}>Export CSV</button><button className="rounded border px-3 py-2 text-sm" disabled={!rows.length||busy} onClick={()=>void exportPdf()}>Export PDF</button>{onOpenPaymentModal&&<button className="bg-[#244A73] text-white rounded px-3 py-2 text-sm" onClick={onOpenPaymentModal}>Collect payment</button>}</div></div>
 <div className={`${panel} p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5`}><label className="text-xs font-medium">Search transaction<input value={search} onChange={(e:any)=>setSearch(e.target.value)} placeholder="Reference, ID or description" className={field}/></label><label className="text-xs font-medium">Customer / contact<select className={field} value={customer} onChange={(e:any)=>setCustomer(e.target.value)}><option value="">All contacts</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.companyName||c.name}</option>)}</select></label><label className="text-xs font-medium">From date<input className={field} type="date" value={from} onChange={(e:any)=>setFrom(e.target.value)}/></label><label className="text-xs font-medium">To date<input className={field} type="date" value={to} min={from||undefined} onChange={(e:any)=>setTo(e.target.value)}/></label><label className="text-xs font-medium">Direction<select className={field} value={direction} onChange={(e:any)=>setDirection(e.target.value)}><option value="all">All movements</option><option value="in">Money received</option><option value="out">Money paid</option></select></label></div>
 {summary.length>0&&<div className="grid gap-3 md:grid-cols-3">{summary.map(s=><div key={s.currency} className={`${panel} p-4`}><span className="text-xs uppercase font-semibold text-[#244A73]">{s.currency}</span><div className="text-xs text-[#69788B] mt-2">Received <strong className="text-green-700">{mon(s.in,s.currency)}</strong></div><div className="text-xs text-[#69788B] mt-1">Paid out <strong className="text-amber-700">{mon(s.out,s.currency)}</strong></div><div className="text-sm font-semibold mt-3">Net: {mon(s.in-s.out,s.currency)}</div></div>)}</div>}
 {exportError&&<p role="alert" className="p-3 text-sm bg-red-50 text-red-800 rounded">{exportError}</p>}
 {limited&&<p className="p-3 text-sm bg-amber-50 text-amber-800">Latest 10,000 records shown. Exports may not cover earlier transactions. Use a dedicated server-side export for larger ledgers.</p>}
 <div className={`${panel} overflow-x-auto`}>{busy?<p className="p-6 text-sm">Loading transactions…</p>:error?<p role="alert" className="p-6 text-red-700">{error}</p>:rows.length===0?<p className="p-12 text-center text-sm text-[#69788B]">No transactions match the filters.</p>:<table className="w-full text-sm text-left"><thead className="bg-[#F6F8FB] text-xs uppercase text-[#69788B]"><tr>{['Date','Reference / Record','Contact','Description','Method','Amount','Status','Actions'].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{rows.map(tx=><tr key={tx.id} className="border-t hover:bg-[#F7FAFD]"><td className="p-3 whitespace-nowrap">{localDate(tx.payment_date)}</td><td className="p-3"><button className="text-[#244A73] font-medium underline" onClick={()=>setSelected(tx)}>{tx.reference_number||tx.id.slice(0,8)}</button></td><td className="p-3">{nameOf(contacts,tx.contact_id)}</td><td className="p-3">{tx.description}</td><td className="p-3">{method(tx.payment_method)}</td><td className="p-3 font-semibold whitespace-nowrap">{tx.direction==='in'?'+':'−'}{mon(Number(tx.amount_minor),tx.currency)}</td><td className="p-3 capitalize">{tx.status}</td><td className="p-3 whitespace-nowrap"><button className="text-[#244A73] underline mr-3" onClick={()=>setSelected(tx)}>View</button><button className="text-[#244A73] underline" onClick={()=>void documentFor(tx)}>{receiptOf(tx)?'Receipt PDF':'Payment record PDF'}</button></td></tr>)}</tbody></table>}</div>
 {selected&&<FinanceModal heading={`Transaction ${selected.reference_number||selected.id.slice(0,8)}`} onClose={()=>setSelected(null)}>
 <div className="mb-3 text-sm text-[#69788B]">{business.name} · Transaction details</div>
 {detail('Transaction ID',selected.id)}{detail('Payment date',localDate(selected.payment_date))}{detail('Recorded (EAT)',east(selected.created_at))}{detail('Customer / contact',nameOf(contacts,selected.contact_id))}{detail('Amount',`${selected.direction==='in'?'+':'−'}${mon(Number(selected.amount_minor),selected.currency)}`)}{detail('Description',selected.description)}{detail('Payment method',method(selected.payment_method))}{detail('Reference',selected.reference_number||'—')}{detail('Status',selected.status)}
 {receiptOf(selected)&&detail('Linked receipt',receiptOf(selected)!.receipt_number)}
 <h4 className="text-sm font-semibold mt-5 mb-2">Invoice allocations</h4>{detailError?<p className="text-red-700 text-sm">{detailError}</p>:links.allocations.length?<div>{links.allocations.map((a,i)=><div key={i} className="flex justify-between py-2 border-b text-sm"><span>{links.invoices.find(k=>k.id===a.invoice_id)?.invoice_number||'Invoice'}</span><strong>{mon(Number(a.amount_minor),selected.currency)}</strong></div>)}</div>:<p className="text-xs text-[#69788B]">No invoice allocations linked to this transaction.</p>}
 <div className="mt-6 flex justify-end gap-2"><button onClick={()=>void documentFor(selected,true)} className="rounded border px-4 py-2 text-sm"><Printer className="w-4 h-4 mr-1 inline"/>Open to print</button><button onClick={()=>void documentFor(selected)} className="rounded bg-[#244A73] text-white px-4 py-2 text-sm"><Download className="w-4 h-4 mr-1 inline"/>{receiptOf(selected)?'Download receipt':'Download payment record'}</button></div>
 </FinanceModal>}
 </div>;
}
