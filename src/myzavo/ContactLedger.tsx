import React,{useEffect,useMemo,useState} from 'react';
import {supabase} from './supabase';
import {ChevronDown,FileText} from 'lucide-react';

type Entry={id:string;date:string;createdAt:string;type:'in'|'out'|'invoice'|'bill';description:string;currency:string;amount:number;docId?:string;docNo?:string;docType?:'invoice'|'expense'|'bill';status?:string};
const cash=(n:number,c:string)=>`${c} ${(n/100).toLocaleString('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
function fmtDate(s:string){return s?new Date(s.includes('T')?s:`${s}T12:00:00`).toLocaleString('en-KE',{dateStyle:'medium',timeStyle:s.includes('T')?'short':undefined,timeZone:'Africa/Nairobi'}):'—';}
export function ContactLedger({businessId,contactId,contactType}:{businessId:string;contactId:string;contactType?:string}){
 const [rows,setRows]=useState<Entry[]>([]),[expanded,setExpanded]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const [selected,setSelected]=useState<Entry|null>(null);
 useEffect(()=>{let alive=true;if(!expanded||!supabase)return;
  const load=async()=>{setLoading(true);setError('');
    try{
      const db=supabase!;
      const [t,i,e,b,a]=await Promise.all([
        db.from('financial_transactions').select('id,contact_id,expense_id,created_at,payment_date,direction,description,amount_minor,currency,status,reference_number').eq('business_id',businessId).eq('contact_id',contactId).order('created_at',{ascending:false}).limit(400),
        db.from('invoices').select('id,invoice_number,issue_date,created_at,total_minor,balance_due_minor,currency,status').eq('business_id',businessId).eq('customer_id',contactId).limit(400),
        db.from('expenses').select('id,description,category,expense_date,created_at,amount_minor,currency,reference_number').eq('business_id',businessId).eq('supplier_id',contactId).limit(400),
        db.from('supplier_bills').select('id,bill_number,description,issue_date,created_at,amount_minor,currency,status').eq('business_id',businessId).eq('supplier_id',contactId).limit(400),
        db.from('payment_allocations').select('transaction_id,invoice_id').eq('business_id',businessId).limit(1000)
      ]);
      const fail=[t,i,e,b,a].find(r=>r.error)?.error;if(fail)throw fail;
      const invoices=i.data||[], expenses=e.data||[], bills=b.data||[],allocs=a.data||[];
      const invoiceById=new Map(invoices.map((r:any)=>[r.id,r]));
      const expById=new Map(expenses.map((r:any)=>[r.id,r]));
      const invoiceForTx=new Map<string,string>();
      for(const x of allocs){if(invoiceById.has(x.invoice_id)&&!invoiceForTx.has(x.transaction_id))invoiceForTx.set(x.transaction_id,x.invoice_id);}
      const cashRows:Entry[]=(t.data||[]).map((x:any)=>{
        const inv=invoiceById.get(invoiceForTx.get(x.id)||'') as any;
        const exp=expById.get(x.expense_id||'') as any;
        return {id:x.id,date:x.payment_date,createdAt:x.created_at,type:x.direction==='in'?'in':'out',
          description:x.description,amount:Number(x.amount_minor),currency:x.currency,status:x.status,
          docType:inv?'invoice':exp?'expense':undefined,docId:inv?.id||exp?.id,
          docNo:inv?.invoice_number||(exp?`EXP-${exp.id.slice(0,8).toUpperCase()}`:x.reference_number||'—')};
      });
      const invoicesDue:Entry[]=invoices.map((x:any)=>({id:`invoice-${x.id}`,date:x.issue_date,createdAt:x.created_at,type:'invoice',description:`Invoice · ${x.status}`,
        amount:Number(x.total_minor),currency:x.currency,docId:x.id,docNo:x.invoice_number,docType:'invoice',status:x.status}));
      const billsDue:Entry[]=bills.map((x:any)=>({id:`bill-${x.id}`,date:x.issue_date,createdAt:x.created_at,type:'bill',description:x.description,
        amount:Number(x.amount_minor),currency:x.currency,docId:x.id,docNo:x.bill_number,docType:'bill',status:x.status}));
      const expenseDocs:Entry[]=expenses.filter((x:any)=>!cashRows.some(r=>r.docId===x.id)).map((x:any)=>({id:`expense-${x.id}`,date:x.expense_date,createdAt:x.created_at,
        type:'out',description:x.description,amount:Number(x.amount_minor),currency:x.currency,docId:x.id,docNo:`EXP-${x.id.slice(0,8).toUpperCase()}`,docType:'expense',status:'posted'}));
      if(alive)setRows([...cashRows,...invoicesDue,...billsDue,...expenseDocs].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));
    }catch(e){if(alive)setError(e instanceof Error?e.message:'Could not load contact history');}
    finally{if(alive)setLoading(false);}
  };void load();return()=>{alive=false;};
 },[expanded,businessId,contactId]);
 const tx=useMemo(()=>rows.filter(r=>r.type==='in'||r.type==='out'),[rows]);
 const docs=useMemo(()=>rows.filter(r=>r.type==='invoice'||r.type==='bill'),[rows]);
 const currencies=[...new Set(tx.map(x=>x.currency))].sort();
 const openDocument=(r:Entry)=>{
   if(r.docType==='invoice'&&r.docId){window.dispatchEvent(new CustomEvent('myzavo:open-financial-document',{detail:{kind:'invoice',id:r.docId}}));return;}
   setSelected(r);
 };
 return <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 sm:p-7">
   <button type="button" className="flex w-full items-center justify-between text-left" onClick={()=>setExpanded(x=>!x)} aria-expanded={expanded}>
     <div><h2 className="text-base font-semibold text-[#0D1B33]">Transaction & document history</h2><p className="mt-1 text-xs text-[#69788B]">Cash in/out and linked invoices, expenses or supplier bills from Supabase</p></div>
     <ChevronDown size={19} className={`text-[#244A73] transition-transform ${expanded?'rotate-180':''}`}/>
   </button>
   {expanded&&<div className="mt-5 space-y-5">
     {loading&&<p className="text-sm text-[#69788B]">Loading transaction history…</p>}
     {error&&<p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
     {!loading&&!error&&<>
       {currencies.length>0&&<div className="flex flex-wrap gap-2">{currencies.map(c=><div key={c} className="rounded-lg border bg-[#F6F8FB] px-4 py-2 text-xs"><span className="font-semibold">{c}</span><span className="ml-3 text-emerald-700">In: {cash(tx.filter(r=>r.currency===c&&r.type==='in').reduce((n,r)=>n+r.amount,0),c)}</span><span className="ml-3 text-rose-700">Out: {cash(tx.filter(r=>r.currency===c&&r.type==='out').reduce((n,r)=>n+r.amount,0),c)}</span></div>)}</div>}
       {rows.length===0?<p className="text-sm text-[#69788B]">No linked financial activity for this {contactType==='supplier'?'supplier':'customer'}.</p>:
       <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-[#F6F8FB] text-xs uppercase text-[#69788B]"><tr>{['Date / time','Activity','Document number','Money in','Money out','Status'].map(h=><th className="p-3" key={h}>{h}</th>)}</tr></thead>
         <tbody>{rows.map(r=><tr key={r.id} className="border-t"><td className="p-3 text-xs whitespace-nowrap">{fmtDate(r.createdAt||r.date)}</td><td className="p-3">{r.description}</td>
           <td className="p-3">{r.docId?<button type="button" onClick={()=>openDocument(r)} className="inline-flex gap-1 items-center font-semibold text-[#244A73] hover:underline"><FileText size={13}/>{r.docNo||'Open document'}</button>:<span className="text-[#69788B]">{r.docNo||'—'}</span>}</td>
           <td className="p-3 tabular-nums text-emerald-700">{r.type==='in'?cash(r.amount,r.currency):'—'}</td><td className="p-3 tabular-nums text-rose-700">{r.type==='out'?cash(r.amount,r.currency):'—'}</td>
           <td className="p-3 capitalize text-xs">{r.status||'—'}</td></tr>)}</tbody></table></div>}
     </>}
   </div>}
   {selected&&<div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0D1B33]/65 p-4" role="dialog" aria-modal="true">
     <div className="w-full max-w-lg rounded-xl bg-white p-6 space-y-3 shadow-2xl"><div className="flex items-center justify-between"><h3 className="text-lg font-semibold">Financial document</h3><button onClick={()=>setSelected(null)}>✕</button></div>
       <p className="text-sm">Reference: <strong>{selected.docNo||selected.id}</strong></p><p className="text-sm">Description: {selected.description}</p><p className="text-sm">Date: {fmtDate(selected.date)}</p><p className="text-sm">Amount: {cash(selected.amount,selected.currency)}</p>
       <p className="text-xs text-[#69788B]">To view the complete document, open {selected.docType==='bill'?'Expenses & Bills':'Expenses'} from the sidebar.</p>
       <button onClick={()=>setSelected(null)} className="rounded bg-[#244A73] px-4 py-2 text-sm text-white">Close</button>
     </div></div>}
 </section>;
}
