import React,{useEffect,useMemo,useState} from 'react';
import {Modal} from '../common/Modal';
import {useFinancial} from '../../context/FinancialContext';
import type {CurrencyCode,Quotation} from '../../types';
import {parseMoneyToCents,formatMoney} from '../../utils/money';
import {getTodayDateString} from '../../utils/dates';
import {Plus,Search,Trash2,Loader2} from 'lucide-react';
import {ContactLookup} from '../../myzavo/ContactLookup';
import {supabase} from '../../myzavo/supabase';

type DraftLine={key:string;description:string;quantity:number;unitPriceStr:string;taxRatePercent:number;discountPercent:number};
const newLine=():DraftLine=>({key:crypto.randomUUID(),description:'',quantity:1,unitPriceStr:'',taxRatePercent:16,discountPercent:0});
const currencies:CurrencyCode[]=['KES','USD','EUR','GBP','TZS','UGX','ZAR','CNY','AED','CAD','AUD','INR','CHF','JPY'];
const addDays=(date:string,days:number)=>{const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export const QuotationFormModal:React.FC<{isOpen:boolean;onClose:()=>void;quotationToEdit?:Quotation|null;initialCustomerId?:string}>=({isOpen,onClose,quotationToEdit,initialCustomerId})=>{
 const {customers,activeBusiness,saveQuotation,refreshQuotations}=useFinancial();
 const [customerId,setCustomerId]=useState('');const [search,setSearch]=useState('');
 const [currency,setCurrency]=useState<CurrencyCode>('KES');
 const [issueDate,setIssueDate]=useState(getTodayDateString());const [expiryDate,setExpiryDate]=useState(addDays(getTodayDateString(),30));
 const [notes,setNotes]=useState('');const [discountStr,setDiscountStr]=useState('0');
 const [status,setStatus]=useState<'sent'|'draft'>('sent');const [lines,setLines]=useState<DraftLine[]>([newLine()]);
 const [error,setError]=useState('');const [saving,setSaving]=useState(false);
 const customer=customers.find(c=>c.id===customerId);
 const matches=useMemo(()=>customers.filter(c=>c.isActive!==false&&[c.name,c.companyName,c.customerCode,c.email,c.phone].some(v=>(v||'').toLowerCase().includes(search.trim().toLowerCase()))),[customers,search]);
 useEffect(()=>{if(!isOpen)return;const date=getTodayDateString();if(quotationToEdit){const q=quotationToEdit;const draft=q.status==='draft';setCustomerId(q.customerId);setSearch('');setCurrency(q.currency);setIssueDate(draft?q.issueDate:date);setExpiryDate(!draft&&q.expiryDate<date?addDays(date,30):q.expiryDate);setNotes(q.notes||'');setDiscountStr((q.discountCents/100).toFixed(2));setStatus(draft?'draft':'sent');setLines(q.items.map(it=>({key:it.id||crypto.randomUUID(),description:it.description,quantity:it.quantity,unitPriceStr:(it.unitPriceCents/100).toFixed(2),taxRatePercent:it.taxRatePercent,discountPercent:it.discountPercent||0})));setError('');setSaving(false);return;}setCustomerId(initialCustomerId||'');setSearch('');setCurrency(activeBusiness.currency);setIssueDate(date);setExpiryDate(addDays(date,30));setNotes('');setDiscountStr('0');setStatus('sent');setLines([newLine()]);setError('');setSaving(false);},[isOpen,initialCustomerId,quotationToEdit?.id]);
 useEffect(()=>{if(customer&&!quotationToEdit)setCurrency(customer.currencyPreference||activeBusiness.currency);},[customerId,customer?.currencyPreference]);
 const parsed=lines.map(l=>({id:l.key,description:l.description.trim(),quantity:Number(l.quantity),unitPriceCents:parseMoneyToCents(l.unitPriceStr),taxRatePercent:Number(l.taxRatePercent),discountPercent:Number(l.discountPercent)}));
 const subtotal=parsed.reduce((n,l)=>n+Math.round(Math.round(l.quantity*l.unitPriceCents)*(100-l.discountPercent)/100),0);
 const discount=parseMoneyToCents(discountStr);
 const tax=parsed.reduce((n,l)=>{const base=Math.round(Math.round(l.quantity*l.unitPriceCents)*(100-l.discountPercent)/100);return n+(subtotal>0?Math.round(base*Math.max(0,subtotal-discount)/subtotal*l.taxRatePercent/100):0);},0);
 const total=Math.max(0,subtotal-discount+tax);
 const updateLine=(id:string,k:keyof DraftLine,value:string|number)=>setLines(old=>old.map(l=>l.key===id?{...l,[k]:value}:l));
 async function submit(e:React.FormEvent){e.preventDefault();setError('');
  if(quotationToEdit&&!['draft','sent','declined'].includes(quotationToEdit.status)){setError('Accepted or converted quotations cannot be revised.');return;}
  if(!customer||customer.isActive===false){setError('Select an active customer.');return;}
  if(expiryDate<issueDate){setError('Valid until must be on or after issue date.');return;}
  if(!parsed.length||parsed.some(l=>!l.description||!Number.isFinite(l.quantity)||l.quantity<=0||!Number.isFinite(l.unitPriceCents)||l.unitPriceCents<0)){setError('Complete all quotation line items.');return;}
  if(discount<0||discount>subtotal){setError('Invalid discount.');return;}
  setSaving(true);try{
   if(quotationToEdit){
    if(!supabase)throw Error('Database unavailable');
    if(quotationToEdit.status!=='draft'&&!confirm('Create a new revision and mark the original quotation superseded?'))return;
    const r=await supabase.rpc('zep_edit_or_revise_quote',{p_business_id:activeBusiness.id,p_id:quotationToEdit.id,p_expected:quotationToEdit.updatedAt||null,p_expiry:expiryDate,p_currency:currency,p_items:parsed.map(it=>({description:it.description,quantity:it.quantity,unit_price_minor:it.unitPriceCents,tax_rate_percent:it.taxRatePercent,discount_percent:it.discountPercent})),p_discount:discount,p_notes:notes||null,p_status:status});
    if(r.error)throw Error(r.error.message);await refreshQuotations();window.dispatchEvent(new Event('myzavo:finance-updated'));onClose();return;
   }
   await saveQuotation({customerId,quoteNumber:'',issueDate,expiryDate,currency,items:parsed,discountCents:discount,notes,status});
   onClose();
  }catch(err){setError(err instanceof Error?err.message:'Unable to save quotation');}finally{setSaving(false);}
 }
 const input='w-full rounded-md border border-[#D9E2ED] bg-white px-3 py-2 text-sm outline-none focus:border-[#244A73]';
 return <Modal isOpen={isOpen} onClose={onClose} title={quotationToEdit?(quotationToEdit.status==='draft'?'Edit draft quotation':'Create quotation revision'):'Create Quotation'} description="Customer quotation with Supabase numbering and multi-currency pricing" maxWidth="4xl">
  <form onSubmit={submit} className="space-y-5 text-sm">
   {error&&<div role="alert" className="p-3 border bg-red-50 text-red-700 rounded-lg">{error}</div>}
   {quotationToEdit&&<p className="p-3 border bg-amber-50 rounded-lg">{quotationToEdit.status==='draft'?'Draft keeps its original reference.':'A new reference is generated; the original remains in history and cannot be accepted.'}</p>}
   <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-[#F6F8FB] rounded-xl border">
    <div className="sm:col-span-2"><label className="block text-xs font-semibold mb-1">Customer *</label>
     {quotationToEdit?<input className={input} readOnly value={quotationToEdit.customerName}/>:<ContactLookup businessId={activeBusiness.id} role="customer" value={customerId} onChange={setCustomerId} required className="mt-1"/>}


    </div>
    <div><label className="block text-xs font-semibold mb-1">Quotation number</label><input disabled value={quotationToEdit?.status==='draft'?quotationToEdit.quoteNumber:'QT-[CLIENT]-YYMM-### · assigned on save'} className={input+' bg-[#E9EEF4] text-[#69788B]'}/></div>
    <div><label className="block text-xs font-semibold mb-1">Currency</label><select value={currency} onChange={e=>setCurrency(e.target.value as CurrencyCode)} className={input}>{currencies.map(c=><option key={c}>{c}</option>)}</select></div>
    <div><label className="block text-xs font-semibold mb-1">Issue date</label><input type="date" disabled={!!quotationToEdit} required value={issueDate} onChange={e=>setIssueDate(e.target.value)} className={input}/></div>
    <div><label className="block text-xs font-semibold mb-1">Valid until</label><input type="date" required value={expiryDate} onChange={e=>setExpiryDate(e.target.value)} className={input}/></div>
   </div>
   <div className="border rounded-xl overflow-x-auto"><table className="w-full text-sm min-w-[660px]"><thead className="bg-[#F6F8FB]"><tr><th className="text-left p-2">Description</th><th className="p-2">Quantity</th><th className="p-2">Unit price ({currency})</th><th className="p-2">Tax %</th><th className="p-2">Remove</th></tr></thead>
    <tbody>{lines.map(l=><tr key={l.key} className="border-t"><td className="p-2"><input className={input} value={l.description} onChange={e=>updateLine(l.key,'description',e.target.value)} placeholder="Service or product" required/></td><td className="p-2"><input className={input} type="number" min="0.001" step="any" value={l.quantity} onChange={e=>updateLine(l.key,'quantity',Number(e.target.value))}/></td><td className="p-2"><input className={input} type="number" min="0" step="0.01" value={l.unitPriceStr} onChange={e=>updateLine(l.key,'unitPriceStr',e.target.value)}/></td><td className="p-2"><input className={input} type="number" min="0" max="100" value={l.taxRatePercent} onChange={e=>updateLine(l.key,'taxRatePercent',Number(e.target.value))}/></td><td className="p-2 text-center"><button type="button" disabled={lines.length<2} onClick={()=>setLines(old=>old.filter(it=>it.key!==l.key))} aria-label="Remove line"><Trash2 className="h-4 w-4"/></button></td></tr>)}</tbody></table>
    <button type="button" onClick={()=>setLines(old=>[...old,newLine()])} className="p-3 text-[#244A73] text-xs font-semibold"><Plus className="inline h-4 w-4"/> Add line item</button></div>
   <div className="grid sm:grid-cols-2 gap-4"><div><label className="text-xs font-semibold block mb-1">Notes &amp; acceptance terms</label><textarea rows={4} className={input} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Validity and terms"/></div>
    <div className="p-4 border rounded-lg bg-[#F6F8FB] space-y-2"><div className="flex justify-between"><span>Subtotal</span><strong>{formatMoney(subtotal,currency)}</strong></div><div className="flex justify-between items-center"><label htmlFor="quote-discount">Discount ({currency})</label><input id="quote-discount" className="w-28 border rounded px-2 py-1 text-right" value={discountStr} onChange={e=>setDiscountStr(e.target.value)} type="number" min="0" step="0.01"/></div><div className="flex justify-between"><span>Tax</span><strong>{formatMoney(tax,currency)}</strong></div><div className="flex justify-between font-bold border-t pt-3"><span>Total</span><strong>{formatMoney(total,currency)}</strong></div></div></div>
   <div className="border-t pt-4 flex items-center justify-between"><label className="text-xs">Status <select className="border rounded p-2 ml-2" value={status} onChange={e=>setStatus(e.target.value as 'sent'|'draft')}><option value="sent">Sent (issue now)</option><option value="draft">Draft</option></select></label>
    <button disabled={saving} className="rounded-md bg-[#244A73] text-white font-semibold px-4 py-2 disabled:opacity-50" type="submit">{saving?<Loader2 className="w-4 h-4 animate-spin"/>:'Save quotation'}</button></div>
  </form>
 </Modal>;
};
