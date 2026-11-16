import React,{useState} from 'react';
import {Modal} from '../common/Modal';
import {useFinancial} from '../../context/FinancialContext';
import type {Quotation} from '../../types';
import {formatMoney} from '../../utils/money';
import {downloadQuotationPdf} from '../../myzavo/documentPdf';
import {supabase} from '../../myzavo/supabase';
import {Download,Loader2} from 'lucide-react';
export const QuotationViewModal:React.FC<{
 isOpen:boolean;onClose:()=>void;quotation:Quotation|null;
 onEditQuotation:(quotation:Quotation)=>void;onInvoiceCreated:(invoiceId:string)=>void;
}>=({isOpen,onClose,quotation,onInvoiceCreated,onEditQuotation})=>{
 const {customers,activeBusiness,setQuotationStatus,refreshInvoices,refreshQuotations,quotations}=useFinancial();
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 if(!quotation)return null;
 const successor=quotations.find(q=>q.revisedFromId===quotation.id);
 const predecessor=quotations.find(q=>q.id===quotation.revisedFromId);
 const customer=customers.find(c=>c.id===quotation.customerId);
 const b=quotation.businessSnapshot||{};const c=quotation.customerSnapshot||{};
 const businessName=String(b.name||activeBusiness.name);
 const customerName=String(c.company_name||customer?.companyName||quotation.customerName);
 async function transition(next:Quotation['status']){
  const selectedQuotation=quotation;
  if(!selectedQuotation)return;
  if(!confirm(`Change ${selectedQuotation.quoteNumber} from ${selectedQuotation.status} to ${next}?`))return;
  setBusy(true);setError('');
  try{
      await setQuotationStatus(selectedQuotation.id,next);
      if(next==='accepted'&&window.confirm('Quotation accepted. Convert it into a draft invoice now?')){
        if(!supabase)throw new Error('Supabase is unavailable');
        const {data,error:e}=await supabase.rpc('myzavo_convert_accepted_quote',{p_quote_id:selectedQuotation.id});
        if(e)throw e;
        const newId=(data as {id:string}[]|null)?.[0]?.id;
        if(!newId)throw new Error('Conversion did not return an invoice');
        await refreshInvoices();onClose();onInvoiceCreated(newId);
      }else onClose();
    }catch(e){setError(e instanceof Error?e.message:'Status update failed');}finally{setBusy(false);}
 }
 return <Modal isOpen={isOpen} onClose={onClose} title={`Quotation ${quotation.quoteNumber}`} maxWidth="4xl">
  <div className="space-y-5">
   <div className="flex justify-between items-center gap-2 flex-wrap border-b pb-4">
    <span className="rounded-md bg-[#EDF4FA] px-3 py-1 text-xs uppercase font-semibold">{successor?'Superseded':quotation.status}</span>
    <div className="flex items-center gap-2 flex-wrap">
     {!successor&&['draft','sent','declined'].includes(quotation.status)&&<button disabled={busy} onClick={()=>onEditQuotation(quotation)} className="border rounded px-3 py-2 text-xs font-semibold">{quotation.status==='draft'?'Edit draft':'Create revision'}</button>}
     {quotation.status==='draft'&&<button disabled={busy} onClick={()=>void transition('sent')} className="bg-[#1F806F] text-white px-3 py-2 rounded text-xs font-semibold">Issue quotation</button>}
     {quotation.status==='sent'&&<><button disabled={busy} onClick={()=>void transition('accepted')} className="bg-[#244A73] text-white px-3 py-2 rounded text-xs font-semibold">Mark accepted</button><button disabled={busy} onClick={()=>void transition('declined')} className="border px-3 py-2 rounded text-xs">Mark declined</button></>}
     {quotation.status==='accepted'&&<button disabled={busy} onClick={async()=>{
       if(!quotation)return;
       if(!confirm(`Convert ${quotation.quoteNumber} to a new draft invoice?`))return;
       if(!supabase){setError('Supabase unavailable');return;}
       setBusy(true);setError('');
       try{const {data,error:e}=await supabase.rpc('myzavo_convert_accepted_quote',{p_quote_id:quotation.id});if(e)throw e;
         await Promise.all([refreshInvoices(),refreshQuotations()]);onClose();onInvoiceCreated((data as any)?.[0]?.id);
       }catch(e){setError(e instanceof Error?e.message:'Conversion failed');}finally{setBusy(false);}
     }} className="bg-[#1F806F] px-3 py-2 rounded text-white text-xs font-semibold">Convert to Invoice</button>}
     <button disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await downloadQuotationPdf(quotation,customer,activeBusiness);}catch(e){setError(e instanceof Error?e.message:'PDF export failed');}finally{setBusy(false);}}} className="border px-3 py-2 rounded text-xs font-semibold"><Download className="inline w-4 h-4 mr-1"/>Download PDF</button>
    </div>
   </div>
   {(successor||predecessor)&&<p className="rounded border bg-[#F1F5FA] p-3 text-sm">{predecessor?`Revision of ${predecessor.quoteNumber}. `:''}{successor?`Superseded by ${successor.quoteNumber}. Open it in Quotations.`:''}</p>}
   {busy&&<span className="text-sm text-[#69788B]"><Loader2 className="inline h-4 w-4 animate-spin"/> Processing...</span>}
   {error&&<p role="alert" className="p-3 bg-red-50 text-red-700 rounded">{error}</p>}
   <article className="border rounded-lg p-6 md:p-9 bg-white space-y-6 text-sm">
    <h1 className="text-center text-xl font-bold tracking-wide">{quotation.status==='draft'?'DRAFT QUOTATION':'QUOTATION'}</h1>
    <div className="grid grid-cols-2 border-b pb-7 gap-6">
      <section><div className="text-xs uppercase font-semibold text-[#69788B] mb-2">Prepared for</div><strong>{customerName}</strong><p>{customer?.name}</p><p>{customer?.address}</p><p>{customer?.email}</p><p>{customer?.phone}</p></section>
      <section className="text-right"><div className="text-xs uppercase font-semibold text-[#69788B] mb-2">Issued by</div><strong>{businessName}</strong><p>{activeBusiness.address}</p><p>{activeBusiness.city}, {activeBusiness.country}</p><p>{activeBusiness.email}</p><p>{activeBusiness.phone}</p></section>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs border-b pb-5"><div><span className="block text-[#69788B]">Quotation</span><strong>{quotation.quoteNumber}</strong></div><div><span className="block text-[#69788B]">Issue date</span>{quotation.issueDate}</div><div><span className="block text-[#69788B]">Valid until</span>{quotation.expiryDate}</div><div><span className="block text-[#69788B]">Currency</span><strong>{quotation.currency}</strong></div></div>
    <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-[#F6F8FB]"><tr><th className="text-left p-2">Description</th><th className="text-right p-2">Qty</th><th className="text-right p-2">Unit price</th><th className="text-right p-2">Tax</th><th className="text-right p-2">Line amount</th></tr></thead>
      <tbody>{quotation.items.map(it=><tr className="border-b" key={it.id}><td className="p-2">{it.description}</td><td className="text-right p-2">{it.quantity}</td><td className="text-right p-2">{formatMoney(it.unitPriceCents,quotation.currency)}</td><td className="text-right p-2">{it.taxRatePercent}%</td><td className="text-right p-2">{formatMoney(Math.round(it.quantity*it.unitPriceCents*(1-(it.discountPercent||0)/100)),quotation.currency)}</td></tr>)}</tbody></table></div>
    <div className="flex justify-end"><div className="w-full max-w-xs space-y-2">{[['Subtotal',quotation.subtotalCents],['Discount',-quotation.discountCents],['Tax',quotation.taxCents],['Total',quotation.totalCents]].map(([k,v])=><div key={String(k)} className="flex justify-between"><span>{k}</span><strong>{formatMoney(Number(v),quotation.currency)}</strong></div>)}</div></div>
    <div className="border-t pt-5 text-xs whitespace-pre-wrap"><strong>Terms &amp; acceptance</strong><p className="mt-2">{quotation.notes||'Valid until the stated date.'}</p></div>
    <footer className="text-[11px] text-[#69788B] border-t pt-3">Generated at {new Date().toLocaleString('en-KE',{timeZone:'Africa/Nairobi'})} EAT. This is an electronically generated document.</footer>
   </article>
  </div>
 </Modal>;
};
