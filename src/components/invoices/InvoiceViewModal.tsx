import React,{useState} from 'react';
import { Modal } from '../common/Modal';
import type { Invoice } from '../../types';
import { useFinancial } from '../../context/FinancialContext';
import { formatMoney } from '../../utils/money';
import { downloadInvoicePdf } from '../../myzavo/invoicePdf';
import { Download, Ban, RotateCcw, Loader2 } from 'lucide-react';

export const InvoiceViewModal: React.FC<{
  isOpen:boolean;onClose:()=>void;invoice:Invoice|null;
  onRecordPayment:(invoiceId:string)=>void;onEditInvoice:(invoice:Invoice)=>void;
  onCreditNote?:()=>void;
}> = ({isOpen,onClose,invoice,onCreditNote,onRecordPayment,onEditInvoice})=>{
  const {activeBusiness,customers,cancelInvoice,issueFullCredit,issueInvoice}=useFinancial();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [action,setAction]=useState<'cancel'|'credit'|null>(null);
  const [reason,setReason]=useState('');
  if(!invoice)return null;
  const customer=customers.find(c=>c.id===invoice.customerId);
  const eligible=invoice.amountPaidCents===0 && invoice.status!=='cancelled';
  const apply=async()=>{
    if(!action||!reason.trim())return;
    setBusy(true);setError('');
    try{
      if(action==='cancel')await cancelInvoice(invoice.id,reason);
      else await issueFullCredit(invoice.id,reason);
      setAction(null);setReason('');onClose();
      if(action==='credit')onCreditNote?.();
    }catch(e){setError(e instanceof Error?e.message:'Action failed');}
    finally{setBusy(false);}
  };
  const snapB=(invoice.businessSnapshot||{}) as Record<string,any>;
  const snapC=(invoice.customerSnapshot||{}) as Record<string,any>;
  const businessName=snapB.name||activeBusiness.name;
  const customerName=snapC.company_name||customer?.companyName||invoice.customerName;
  return <Modal isOpen={isOpen} onClose={onClose} title={`Invoice ${invoice.invoiceNumber}`} maxWidth="4xl">
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between border-b pb-3">
        <span className="rounded bg-[#EDF4FA] px-3 py-1 text-xs font-semibold uppercase">{invoice.status}</span>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={async()=>{setError('');try{await downloadInvoicePdf(invoice,customer,activeBusiness);}catch(e){setError(e instanceof Error?e.message:'PDF failed');}}}
            className="rounded-md bg-[#244A73] px-3 py-2 text-white text-xs font-semibold"><Download className="inline w-4 h-4 mr-1"/>Download PDF</button>
          {invoice.status==='draft'&&<button type="button" disabled={busy} onClick={()=>onEditInvoice(invoice)} className="rounded-md border px-3 py-2 text-xs font-semibold">Edit draft</button>}
          {invoice.status==='draft'&&<button type="button" disabled={busy} onClick={async()=>{
            if(!confirm(`Issue ${invoice.invoiceNumber}? This changes the draft into an issued invoice.`))return;
            setBusy(true);setError('');
            try{await issueInvoice(invoice.id);onClose();}catch(e){setError(e instanceof Error?e.message:'Issue failed');}
            finally{setBusy(false);}
          }} className="rounded-md bg-[#1F806F] px-3 py-2 text-white text-xs font-semibold disabled:opacity-50">Issue invoice</button>}
          {(['sent','partially_paid','overdue'].includes(invoice.status)&&invoice.balanceDueCents>0)&&<button type="button" onClick={()=>onRecordPayment(invoice.id)} className="rounded-md bg-[#1F806F] px-3 py-2 text-white text-xs font-semibold">Collect payment</button>}
          <button type="button" disabled={!eligible} onClick={()=>{setAction('cancel');setReason('');}} className="rounded-md border px-3 py-2 text-xs disabled:opacity-40"><Ban className="inline w-4 h-4 mr-1"/>Cancel invoice</button>
          <button type="button" disabled={!eligible||invoice.status==='draft'} onClick={()=>{setAction('credit');setReason('');}}
            className="rounded-md border px-3 py-2 text-xs disabled:opacity-40"><RotateCcw className="inline w-4 h-4 mr-1"/>Raise full credit</button>
        </div>
      </div>
      {error&&<p role="alert" className="p-3 bg-red-50 text-red-700 text-sm rounded">{error}</p>}
      {action&&<div className="p-4 bg-[#F6F8FB] rounded-lg border space-y-3">
        <p className="font-semibold text-sm">{action==='cancel'?'Cancel this invoice?':'Issue a full credit note?'}</p>
        <p className="text-xs text-[#69788B]">{action==='credit'?'This creates a linked credit note and reverses the full unpaid invoice.':'The document remains permanently recorded. Cancelled invoices cannot be restored.'}</p>
        <textarea rows={2} value={reason} onChange={e=>setReason(e.target.value)} className="w-full border rounded p-2 text-sm" placeholder="Required reason"/>
        <div className="flex gap-2"><button type="button" onClick={()=>setAction(null)} className="border rounded px-3 py-2 text-xs">Back</button>
          <button type="button" disabled={busy||!reason.trim()} onClick={()=>void apply()} className="rounded bg-[#244A73] px-3 py-2 text-white text-xs disabled:opacity-50">
            {busy?<Loader2 className="inline animate-spin w-4 h-4"/>:'Confirm'}</button></div>
      </div>}
      <article className="rounded-lg border bg-white p-6 md:p-9 text-sm" aria-label="Invoice document preview">
        <h1 className="text-center font-bold tracking-wider text-lg text-[#0D1B33]">{invoice.status==='draft'?'DRAFT INVOICE':'INVOICE'}</h1>
        <div className="grid grid-cols-2 gap-6 border-b py-8">
          <section><p className="text-xs uppercase text-[#69788B] font-semibold mb-2">Bill to</p>
            <h2 className="font-semibold">{customerName}</h2>
            {snapC.name!==customerName&&<p className="text-xs">{snapC.name||customer?.name}</p>}
            <p className="text-xs whitespace-pre-wrap">{snapC.address||customer?.address}</p>
            <p className="text-xs">{snapC.email||customer?.email}</p>
            <p className="text-xs">{snapC.phone||customer?.phone}</p>
            <p className="text-xs">PIN: {snapC.tax_number||customer?.taxNumber||'—'}</p>
          </section>
          <section className="text-right"><p className="text-xs uppercase text-[#69788B] font-semibold mb-2">Issued by</p>
            <h2 className="font-semibold">{businessName}</h2>
            <p className="text-xs">{snapB.address||activeBusiness.address}</p><p className="text-xs">{snapB.city||activeBusiness.city}, {snapB.country||activeBusiness.country}</p>
            <p className="text-xs">{snapB.email||activeBusiness.email}</p><p className="text-xs">{snapB.phone||activeBusiness.phone}</p>
            <p className="text-xs">PIN: {snapB.tax_number||activeBusiness.taxNumber||'—'}</p>
          </section>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 border-b py-5">
          {[['Invoice #',invoice.invoiceNumber],['Date',invoice.issueDate],['Due',invoice.dueDate],['Currency',invoice.currency],['Terms',invoice.paymentTerms||'—']].map(([k,v])=><div key={k}>
            <div className="text-[11px] uppercase text-[#69788B]">{k}</div><div className="font-semibold text-xs break-words">{v}</div>
          </div>)}
        </div>
        <div className="overflow-x-auto py-6"><table className="w-full text-xs"><thead><tr className="border-b bg-[#F6F8FB]">
          <th className="p-2 text-left">Description</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Unit</th><th className="p-2 text-right">Tax</th><th className="p-2 text-right">Net</th>
        </tr></thead><tbody>{invoice.items.map(it=><tr key={it.id} className="border-b">
          <td className="p-2">{it.description}</td><td className="p-2 text-right">{it.quantity}</td>
          <td className="p-2 text-right">{formatMoney(it.unitPriceCents,invoice.currency)}</td>
          <td className="p-2 text-right">{it.taxRatePercent}%</td>
          <td className="p-2 text-right">{formatMoney(Math.round(it.quantity*it.unitPriceCents*(1-(it.discountPercent||0)/100)),invoice.currency)}</td>
        </tr>)}</tbody></table></div>
        <div className="flex justify-end"><div className="w-full max-w-xs space-y-2">
          {[['Subtotal',invoice.subtotalCents],['Discount',-invoice.discountCents],['Tax',invoice.taxCents],['Total',invoice.totalCents],['Paid',invoice.amountPaidCents],['Balance due',invoice.balanceDueCents]].map(([k,v])=><div key={String(k)} className="flex justify-between text-sm"><span>{k}</span><span className="font-semibold">{formatMoney(Number(v),invoice.currency)}</span></div>)}
        </div></div>
        <div className="grid md:grid-cols-2 gap-6 border-t mt-6 pt-5 text-xs"><div><strong>Payment instructions</strong><p className="mt-2 whitespace-pre-wrap">{invoice.paymentInstructions||activeBusiness.paymentInstructions||'Please reference your invoice number.'}</p></div>
          <div><strong>Notes</strong><p className="mt-2 whitespace-pre-wrap">{invoice.notes||'Thank you for your business.'}</p></div>
        </div>
        <footer className="mt-7 border-t pt-3 text-[11px] text-[#69788B]">
          <p>Generated at {new Date().toLocaleString('en-KE',{timeZone:'Africa/Nairobi'})} EAT</p>
          <p>This is an electronically generated document. No signature is required.</p>
        </footer>
      </article>
    </div>
  </Modal>;
};
