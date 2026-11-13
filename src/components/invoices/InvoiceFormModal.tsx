import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../common/Modal';
import { useFinancial } from '../../context/FinancialContext';
import { CurrencyCode, Invoice } from '../../types';
import { formatMoney, parseMoneyToCents } from '../../utils/money';
import { getTodayDateString } from '../../utils/dates';
import { Plus, Trash2, Search, Loader2 } from 'lucide-react';
import {ContactLookup} from '../../myzavo/ContactLookup';

type ItemDraft = { key: string; description: string; quantity: number; unitPriceStr: string; taxRatePercent: number; discountPercent: number };
const newLine = (): ItemDraft => ({ key: crypto.randomUUID(), description: '', quantity: 1, unitPriceStr: '', taxRatePercent: 16, discountPercent: 0 });
const currencies: CurrencyCode[] = ['KES','USD','EUR','GBP','TZS','UGX','ZAR','CNY','AED','CAD','AUD','INR','CHF'];
const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

export const InvoiceFormModal: React.FC<{
  isOpen: boolean; onClose: () => void; invoiceToEdit?: Invoice | null; initialCustomerId?: string;
}> = ({isOpen,onClose,invoiceToEdit,initialCustomerId}) => {
  const {customers,activeBusiness,saveInvoice,issueInvoice} = useFinancial();
  const [customerId,setCustomerId]=useState('');
  const [customerSearch,setCustomerSearch]=useState('');
  const [currency,setCurrency]=useState<CurrencyCode>('KES');
  const [issueDate,setIssueDate]=useState(getTodayDateString());
  const [dueDate,setDueDate]=useState(addDays(getTodayDateString(),14));
  const [paymentTerms,setPaymentTerms]=useState('Net 14 days');
  const [paymentInstructions,setPaymentInstructions]=useState('');
  const [notes,setNotes]=useState('');
  const [discountStr,setDiscountStr]=useState('0');
  const [status,setStatus]=useState<'draft'|'sent'>('draft');
  const [items,setItems]=useState<ItemDraft[]>([newLine()]);
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);
  const selected=customers.find(c=>c.id===customerId);
  const activeCustomers=customers.filter(c=>c.isActive!==false);
  const matches=useMemo(()=>activeCustomers.filter(c=>[c.name,c.companyName,c.customerCode,c.phone,c.email]
    .some(v=>(v||'').toLowerCase().includes(customerSearch.toLowerCase().trim()))),[customers,customerSearch]);

  useEffect(()=>{
    if(!isOpen)return;
    const today=getTodayDateString();
    setCustomerId(initialCustomerId||'');setCustomerSearch('');setCurrency(activeBusiness.currency);
    setIssueDate(today);setDueDate(addDays(today,14));setPaymentTerms('Net 14 days');
    setPaymentInstructions(activeBusiness.paymentInstructions||'');setNotes('');setDiscountStr('0');
    setItems([newLine()]);setStatus('draft');setError('');setSaving(false);
  },[isOpen,initialCustomerId]);
  useEffect(()=>{
    if(!isOpen||!selected)return;
    const days=selected.creditTermsDays??14;
    setDueDate(addDays(issueDate,days));
    setPaymentTerms(days===0?'Due on receipt':`Net ${days} days`);
    setCurrency(selected.currencyPreference||activeBusiness.currency);
  },[customerId,selected?.creditTermsDays,selected?.currencyPreference,issueDate,isOpen]);

  const parsed=items.map(it=>({description:it.description.trim(),quantity:Number(it.quantity),unitPriceCents:parseMoneyToCents(it.unitPriceStr),taxRatePercent:Number(it.taxRatePercent),discountPercent:Number(it.discountPercent)}));
  const subtotal=parsed.reduce((sum,it)=>sum+Math.round(Math.round(it.quantity*it.unitPriceCents)*(100-it.discountPercent)/100),0);
  const discount=parseMoneyToCents(discountStr);
  const tax=parsed.reduce((sum,it)=>{
    const base=Math.round(Math.round(it.quantity*it.unitPriceCents)*(100-it.discountPercent)/100);
    return sum+(subtotal>0?Math.round(base*Math.max(0,subtotal-discount)/subtotal*it.taxRatePercent/100):0);
  },0);
  const total=Math.max(0,subtotal-discount+tax);

  const save=async (e:React.FormEvent)=>{
    e.preventDefault();setError('');
    if(invoiceToEdit){setError('Existing invoices cannot be edited in this release.');return;}
    if(!selected||selected.isActive===false){setError('Select an active customer.');return;}
    if(dueDate<issueDate){setError('Due date cannot precede issue date.');return;}
    if(items.length<1||items.some((it,i)=>!parsed[i].description||!(parsed[i].quantity>0)||!Number.isFinite(parsed[i].unitPriceCents)||parsed[i].unitPriceCents<0)){
      setError('Each item requires a description, positive quantity and valid unit price.');return;
    }
    if(discount<0||discount>subtotal){setError('Invoice discount exceeds the subtotal.');return;}
    setSaving(true);
    try{
      const created=await saveInvoice({customerId,invoiceNumber:'',issueDate,dueDate,
        currency,items:parsed.map((it,i)=>({...it,id:items[i].key})),discountCents:discount,
        paymentTerms,notes,paymentInstructions,status:'draft'});
      if(window.confirm(`Invoice ${created.invoiceNumber} was saved as Draft. Issue it now?`)){
        await issueInvoice(created.id);
      }
      onClose();
    }catch(err){setError(err instanceof Error?err.message:'Could not save invoice');}
    finally{setSaving(false);}
  };
  const input='w-full rounded-md border border-[#D9E2ED] bg-white px-3 py-2 text-sm outline-none focus:border-[#244A73]';
  return <Modal isOpen={isOpen} onClose={onClose} title={invoiceToEdit?'Invoice editing':'Create Invoice'}
    description="Customer billing with server-generated references and secure financial records" maxWidth="4xl">
    <form onSubmit={save} className="space-y-5 text-sm">
      {error&&<p role="alert" className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-700">{error}</p>}
      {invoiceToEdit&&<p className="rounded-lg bg-amber-50 border p-3">Edit support will be enabled after the audited draft-amendment workflow is complete.</p>}
      <div className="grid gap-3 md:grid-cols-3 bg-[#F6F8FB] border border-[#E2E8F0] rounded-xl p-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold mb-1">Customer *</label>
          <ContactLookup businessId={activeBusiness.id} role="customer" value={customerId} onChange={setCustomerId} required className="mt-1"/>


          {activeCustomers.length===0&&<p className="mt-2 text-amber-700 text-xs">Add an active customer in Contacts first.</p>}
        </div>
        <div><label className="block text-xs font-semibold mb-1">Invoice number</label>
          <input disabled readOnly value={invoiceToEdit?.invoiceNumber||`INV-[CLIENT]-${issueDate.slice(2,4)}${issueDate.slice(5,7)}-### · assigned on save`}
            className={input+' bg-[#E8EDF4] text-[#64748B] cursor-not-allowed font-medium'}/>
          <p className="mt-1 text-[11px] text-[#69788B]">Unique reference issued by Supabase</p>
        </div>
        <div><label className="block text-xs font-semibold mb-1">Issue date</label><input type="date" value={issueDate} required onChange={e=>setIssueDate(e.target.value)} className={input}/></div>
        <div><label className="block text-xs font-semibold mb-1">Due date</label><input type="date" value={dueDate} required onChange={e=>setDueDate(e.target.value)} className={input}/></div>
        <div><label className="block text-xs font-semibold mb-1">Invoice currency</label>
          <select value={currency} onChange={e=>setCurrency(e.target.value as CurrencyCode)} className={input}>
            {currencies.map(c=><option value={c} key={c}>{c}</option>)}
          </select>
          <p className="text-[11px] text-[#69788B] mt-1">Defaults to the customer's preferred currency</p>
        </div>
      </div>
      <div className="rounded-xl border border-[#E2E8F0] overflow-hidden">
        <div className="bg-[#F0F4F8] px-3 py-2 text-xs font-semibold text-[#69788B]">Invoice line items · {currency}</div>
        {items.map((it,i)=><div key={it.key} className="grid grid-cols-12 items-end gap-2 p-3 border-t border-[#E2E8F0]">
          <div className="col-span-12 md:col-span-5"><label className="text-xs block mb-1">Description</label>
            <input required value={it.description} onChange={e=>setItems(x=>x.map(row=>row.key===it.key?{...row,description:e.target.value}:row))} className={input} placeholder="Service or product"/></div>
          <div className="col-span-3 md:col-span-2"><label className="text-xs block mb-1">Qty</label><input required type="number" min="0.001" step="any" value={it.quantity} className={input}
            onChange={e=>setItems(x=>x.map(row=>row.key===it.key?{...row,quantity:Number(e.target.value)}:row))}/></div>
          <div className="col-span-4 md:col-span-2"><label className="text-xs block mb-1">Unit price</label><input type="number" step="0.01" min="0" required value={it.unitPriceStr} className={input}
            onChange={e=>setItems(x=>x.map(row=>row.key===it.key?{...row,unitPriceStr:e.target.value}:row))}/></div>
          <div className="col-span-3 md:col-span-2"><label className="text-xs block mb-1">Tax %</label>
            <select className={input} value={it.taxRatePercent} onChange={e=>setItems(x=>x.map(row=>row.key===it.key?{...row,taxRatePercent:Number(e.target.value)}:row))}>
              <option value="0">0%</option><option value="16">16%</option></select></div>
          <button type="button" disabled={items.length===1} aria-label="Remove item" className="col-span-2 md:col-span-1 text-[#BF5963] disabled:opacity-30 flex justify-end pb-2"
            onClick={()=>setItems(x=>x.filter(row=>row.key!==it.key))}><Trash2 className="w-4 h-4"/></button>
        </div>)}
        <button type="button" className="bg-[#F6F8FB] w-full text-left px-3 py-3 text-[#244A73] text-xs font-semibold border-t" onClick={()=>setItems(x=>[...x,newLine()])}>
          <Plus className="inline-block w-4 h-4 mr-1"/>Add line item</button>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-3"><label className="block text-xs font-semibold">Payment instructions<textarea className={input+' mt-1'} rows={3} value={paymentInstructions} onChange={e=>setPaymentInstructions(e.target.value)}/></label>
          <label className="block text-xs font-semibold">Notes & terms<textarea className={input+' mt-1'} rows={3} value={notes} onChange={e=>setNotes(e.target.value)}/></label></div>
        <div className="rounded-lg border bg-[#F6F8FB] p-4 space-y-3">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(subtotal,currency)}</span></div>
          <div className="flex items-center justify-between gap-3"><span>Discount ({currency})</span><input type="number" step="0.01" min="0" className={input+' max-w-[140px] text-right'} value={discountStr} onChange={e=>setDiscountStr(e.target.value)}/></div>
          <div className="flex justify-between"><span>Tax</span><span>{formatMoney(tax,currency)}</span></div>
          <div className="flex justify-between pt-3 border-t font-bold text-lg"><span>Total</span><span>{formatMoney(total,currency)}</span></div>
        </div>
      </div>
      <div className="flex justify-between items-center border-t pt-4 gap-3">
        <div className="text-sm text-[#244A73]"><span className="inline-block rounded bg-[#EDF4FA] px-3 py-2 font-semibold">Draft</span><span className="ml-2 text-xs text-[#69788B]">Review and issue after saving</span></div>
        <div className="flex gap-2"><button type="button" onClick={onClose} className="px-4 py-2 rounded border">Close</button>
          <button type="submit" disabled={saving||Boolean(invoiceToEdit)} className="rounded-md px-4 py-2 bg-[#244A73] text-white font-semibold disabled:opacity-60">
            {saving?<><Loader2 className="inline-block w-4 h-4 mr-1 animate-spin"/> Saving…</>:'Create invoice'}</button></div>
      </div>
    </form>
  </Modal>;
};
