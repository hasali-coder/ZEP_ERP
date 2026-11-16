import React, {useEffect, useRef, useState} from 'react';
import {Plus, RefreshCw, CalendarClock, CheckCircle2, PauseCircle, PlayCircle} from 'lucide-react';
import {supabase} from './supabase';
import {ContactLookup} from './ContactLookup';
import {useFinancial} from '../context/FinancialContext';
import type {Expense} from '../types';

const rootId=()=>window.location.pathname.match(/^\/app\/([0-9a-f-]{36})/i)?.[1]||'';
const card='rounded-xl border border-[#DFE7F0] bg-white shadow-sm';
const input='w-full rounded-md border border-[#DCE5EE] bg-white px-3 py-2 text-sm text-[#0D1B33] focus:outline-none focus:ring-2 focus:ring-[#244A73]/30';
const categories=['Rent & Utilities','Salaries & Wages','Cloud & Software','Marketing & Ads','Office Supplies','Travel & Transport','Professional Services','Taxes & Licenses','Equipment & Hardware','Other'];
const CURRENCIES=['KES','USD','EUR','GBP','TZS','UGX','ZAR','CNY','AED','CAD','AUD','INR','CHF','JPY'];
const paymentMethods=[['M-Pesa','mpesa'],['Cash','cash'],['Bank Transfer','bank_transfer'],['Card','card'],['Cheque','cheque'],['Other','other']];
const nowDate=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Nairobi'});
const money=(v:number|string,c:string)=>`${c} ${(Number(v)/100).toLocaleString('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const changed=()=>window.dispatchEvent(new Event('myzavo:finance-updated'));
const cents=(v:string)=>Math.round(Number(v)*100);
const idempotency=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
type Mode='direct'|'recurring'|'bill';
type Due={id:string;business_id:string;schedule_id:string;supplier_id:string;due_date:string;description:string;category:string;amount_minor:number;currency:string;status:string};
type Schedule={id:string;business_id:string;supplier_id:string;description:string;category:string;amount_minor:number;currency:string;interval_days:number;first_due_date:string;next_due_date:string;status:string};
type ExpenseRow={id:string;description:string;supplier_id:string|null;supplier_name:string|null;expense_date:string;category:string;amount_minor:number;currency:string;payment_method:string};
type BillRow={id:string;supplier_id:string;bill_number:string;due_date:string;issue_date:string;amount_minor:number;balance_due_minor:number;currency:string;status:string};

type FormProps={isOpen:boolean;onClose:()=>void;defaultMode?:'expense'|'bill';expenseToEdit?:unknown};
export function VendorExpenseModal({isOpen,onClose,defaultMode='expense',expenseToEdit}:FormProps){
 const {activeBusiness}=useFinancial();
 const [mode,setMode]=useState<Mode>(defaultMode==='bill'?'bill':'direct');
 const [vendor,setVendor]=useState(''),[desc,setDesc]=useState(''),[amount,setAmount]=useState('');
 const [category,setCategory]=useState('Rent & Utilities'),[currency,setCurrency]=useState<string>(activeBusiness.currency||'KES');
 const [date,setDate]=useState(nowDate()),[interval,setInterval]=useState('30'),[firstDue,setFirstDue]=useState(nowDate());
 const [method,setMethod]=useState('mpesa'),[reference,setReference]=useState(''),[notes,setNotes]=useState(''),[billNumber,setBillNumber]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const nonce=useRef(idempotency());
 useEffect(()=>{if(isOpen){setMode(defaultMode==='bill'?'bill':'direct');setCurrency(activeBusiness.currency||'KES');setVendor('');setDesc('');setAmount('');setError('');setDate(nowDate());setFirstDue(nowDate());setInterval('30');setBillNumber('');setReference('');nonce.current=idempotency();}},[isOpen,defaultMode,activeBusiness.currency]);
 if(!isOpen)return null;
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();setError('');if(!supabase) return setError('Database connection unavailable.');
  if(expenseToEdit)return setError('Editing posted expenses is not supported; create an audited correction.');
  if(!vendor)return setError('Select a supplier from Contacts.');
  const minor=cents(amount);if(!Number.isSafeInteger(minor)||minor<=0)return setError('Enter a positive amount.');
  if(mode==='recurring'&&(!Number.isInteger(Number(interval))||Number(interval)<1||Number(interval)>365))return setError('Repeat interval must be between 1 and 365 days.');
  setBusy(true);
  try{
   let e:unknown;
   if(mode==='direct'){
    const result=await supabase.rpc('myzavo_record_vendor_expense',{
      p_business_id:rootId(),p_supplier_id:vendor,p_description:desc,p_amount_minor:minor,p_currency:currency,p_category:category,
      p_expense_date:date,p_payment_method:method,p_reference_number:reference||null,p_notes:notes||null,
      p_idempotency_key:nonce.current,p_due_id:null
    });e=result.error;
   }else if(mode==='recurring'){
    const result=await supabase.rpc('myzavo_create_recurring_expense',{
      p_business_id:rootId(),p_supplier_id:vendor,p_description:desc,p_amount_minor:minor,p_currency:currency,
      p_category:category,p_interval_days:Number(interval),p_first_due_date:firstDue,p_notes:notes||null
    });e=result.error;
   }else{
    const result=await supabase.rpc('myzavo_create_supplier_bill',{
      p_business_id:rootId(),p_supplier_id:vendor,p_bill_number:billNumber,p_issue_date:date,p_due_date:firstDue,
      p_currency:currency,p_amount_minor:minor,p_category:category,p_description:desc,p_notes:notes||null
    });e=result.error;
   }
   if(e)throw e;
   changed();onClose();
  }catch(ex){setError(ex instanceof Error?ex.message:'Unable to save this expense');}finally{setBusy(false);}
 };
 return <div role="dialog" aria-modal="true" aria-label="Create expense" className="fixed inset-0 z-[130] flex items-center justify-center overflow-y-auto bg-[#0D1B33]/60 p-4">
  <form onSubmit={submit} className={`${card} my-auto w-full max-w-2xl space-y-4 p-5 sm:p-6`}>
   <div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold text-[#0D1B33]">New Expense</h2><p className="text-xs text-[#69788B]">Supplier-linked and saved securely to Supabase</p></div><button type="button" onClick={onClose} className="p-2" aria-label="Close">✕</button></div>
   <div className="flex gap-2 flex-wrap text-sm" role="group" aria-label="Expense type">
    {([['direct','Direct Expense'],['recurring','Recurring Expense'],['bill','Supplier Bill']] as const).map(([id,label])=><button type="button" key={id} onClick={()=>setMode(id)} className={`rounded-md px-3 py-2 ${mode===id?'bg-[#244A73] text-white':'bg-[#F1F5FA] text-[#244A73]'}`}>{label}</button>)}
   </div>
   {mode==='recurring'&&<p className="rounded bg-[#EFF6FB] p-3 text-xs text-[#244A73]">Recurring schedules create payable due entries. Money is not recorded as spent until a payment is posted.</p>}
   {error&&<p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
   <label className="block text-sm">Supplier *<ContactLookup className="mt-1" businessId={rootId()} role="supplier" value={vendor} onChange={setVendor} required/></label>
   <label className="block text-sm">Description *<input className={input} required maxLength={1000} value={desc} onChange={e=>setDesc(e.target.value)}/></label>
   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="text-sm">Amount *<input className={input} type="number" required min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label className="text-sm">Currency<select className={input} value={currency} onChange={e=>setCurrency(e.target.value)}>{CURRENCIES.map(c=><option key={c}>{c}</option>)}</select></label></div>
   <label className="block text-sm">Category<select className={input} value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
   {mode==='recurring'?<div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="text-sm">Repeat every (days) *<input className={input} required type="number" min="1" max="365" value={interval} onChange={e=>setInterval(e.target.value)}/></label><label className="text-sm">First payment due *<input className={input} required type="date" value={firstDue} onChange={e=>setFirstDue(e.target.value)}/></label></div>
   :<div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="text-sm">{mode==='bill'?'Bill date':'Payment date'}<input className={input} required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>{mode==='bill'&&<label className="text-sm">Due date *<input className={input} type="date" min={date} required value={firstDue} onChange={e=>setFirstDue(e.target.value)}/></label>}</div>}
   {mode==='bill'&&<label className="block text-sm">Supplier invoice reference *<input className={input} required value={billNumber} onChange={e=>setBillNumber(e.target.value)}/></label>}
   {mode==='direct'&&<><label className="block text-sm">Payment method<select className={input} value={method} onChange={e=>setMethod(e.target.value)}>{paymentMethods.map(([label,val])=><option key={val} value={val}>{label}</option>)}</select></label><label className="block text-sm">Payment reference {['mpesa','bank_transfer','card'].includes(method)?'*':''}<input className={input} required={['mpesa','bank_transfer','card'].includes(method)} value={reference} onChange={e=>setReference(e.target.value)}/></label></>}
   <label className="block text-sm">Notes<textarea className={input} rows={2} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
   <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded border px-4 py-2 text-sm">Cancel</button><button disabled={busy||!vendor} className="rounded bg-[#244A73] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy?'Saving…':mode==='recurring'?'Save Recurring Schedule':mode==='bill'?'Save Supplier Bill':'Record Paid Expense'}</button></div>
  </form>
 </div>;
}

function PayDue({due,onClose,onPaid}:{due:Due;onClose:()=>void;onPaid:()=>void}){
 const [method,setMethod]=useState('mpesa'),[reference,setReference]=useState(''),[date,setDate]=useState(nowDate());
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const key=useRef(idempotency());
 const pay=async(e:React.FormEvent)=>{e.preventDefault();if(!supabase)return;setBusy(true);setError('');try{
  const {error:err}=await supabase.rpc('myzavo_record_vendor_expense',{
   p_business_id:due.business_id,p_supplier_id:due.supplier_id,p_description:due.description,p_amount_minor:Number(due.amount_minor),p_currency:due.currency,p_category:due.category,
   p_expense_date:date,p_payment_method:method,p_reference_number:reference||null,p_notes:`Recurring expense due ${due.due_date}`,
   p_idempotency_key:key.current,p_due_id:due.id
  });if(err)throw err;changed();onPaid();onClose();
 }catch(ex){setError(ex instanceof Error?ex.message:'Unable to post payment');}finally{setBusy(false);}};
 return <div className="fixed inset-0 z-[135] flex items-center justify-center bg-[#0D1B33]/60 p-4" role="dialog" aria-modal="true" aria-label="Pay recurring expense"><form onSubmit={pay} className={`${card} w-full max-w-lg space-y-3 p-6`}>
 <div className="flex justify-between"><h2 className="text-lg font-semibold">Pay Scheduled Expense</h2><button type="button" onClick={onClose} aria-label="Close">✕</button></div>
 <p className="text-sm">{due.description} · <strong>{money(due.amount_minor,due.currency)}</strong> · Due {due.due_date}</p>
 {error&&<p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
 <label className="block text-sm">Payment date<input type="date" required className={input} value={date} onChange={e=>setDate(e.target.value)}/></label>
 <label className="block text-sm">Payment method<select className={input} value={method} onChange={e=>setMethod(e.target.value)}>{paymentMethods.map(([label,v])=><option key={v} value={v}>{label}</option>)}</select></label>
 <label className="block text-sm">Reference {['mpesa','bank_transfer','card'].includes(method)?'*':''}<input className={input} value={reference} onChange={e=>setReference(e.target.value)} required={['mpesa','bank_transfer','card'].includes(method)}/></label>
 <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded border px-4 py-2 text-sm">Cancel</button><button disabled={busy} className="rounded bg-[#244A73] px-4 py-2 text-sm text-white disabled:opacity-50">{busy?'Posting…':'Confirm Payment'}</button></div>
 </form></div>;
}

type ListProps={onOpenCreateExpense:()=>void;onOpenCreateBill:()=>void;onRecordBillPayment?:(billId:string)=>void;onEditExpense?:(expense:Expense)=>void};
export function VendorExpensesView({onOpenCreateExpense,onOpenCreateBill}:ListProps){
 const {suppliers}=useFinancial();const [active,setActive]=useState<'direct'|'recurring'|'bill'>('direct');
 const [settlementBill,setSettlementBill]=useState<BillRow|null>(null);
 const [expenses,setExpenses]=useState<ExpenseRow[]>([]),[bills,setBills]=useState<BillRow[]>([]);
 const [schedules,setSchedules]=useState<Schedule[]>([]),[dues,setDues]=useState<Due[]>([]);
 const [search,setSearch]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [payDue,setPayDue]=useState<Due|null>(null),[version,setVersion]=useState(0),[workingId,setWorkingId]=useState('');
 useEffect(()=>{const update=()=>setVersion(n=>n+1);window.addEventListener('myzavo:finance-updated',update);return()=>window.removeEventListener('myzavo:finance-updated',update);},[]);
 useEffect(()=>{let mounted=true;const load=async()=>{if(!supabase||!rootId())return;setLoading(true);setError('');
  try{
   // Bring payable occurrences due as of today into the ledger; no cash is booked by this action.
   const generate=await supabase.rpc('myzavo_generate_recurring_dues',{p_business_id:rootId(),p_through:nowDate()});if(generate.error&&!/not authorised|not authorized/i.test(generate.error.message))throw generate.error;
   const [a,b,c,d]=await Promise.all([
    supabase.from('expenses').select('*').eq('business_id',rootId()).order('expense_date',{ascending:false}).limit(2000),
    supabase.from('supplier_bills').select('*').eq('business_id',rootId()).order('issue_date',{ascending:false}).limit(2000),
    supabase.from('recurring_expenses').select('*').eq('business_id',rootId()).order('created_at',{ascending:false}).limit(2000),
    supabase.from('recurring_expense_dues').select('*').eq('business_id',rootId()).order('due_date',{ascending:false}).limit(2000)
   ]);
   if(a.error||b.error||c.error||d.error)throw a.error||b.error||c.error||d.error;
   if(mounted){setExpenses((a.data||[]) as ExpenseRow[]);setBills((b.data||[]) as BillRow[]);setSchedules((c.data||[]) as Schedule[]);setDues((d.data||[]) as Due[]);}
  }catch(ex){if(mounted)setError(ex instanceof Error?ex.message:'Failed loading Expenses');}finally{if(mounted)setLoading(false);}
 };void load();return()=>{mounted=false;};},[version]);
 const supplierName=(id:string|null)=>{const s=suppliers.find(s=>s.id===id);return s?.companyName||s?.name||'Supplier';};
 const matches=(...pieces:(string|number|null|undefined)[])=>pieces.join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
 const changeStatus=async(s:Schedule)=>{if(!supabase)return;setWorkingId(s.id);try{const {error:e}=await supabase.rpc('myzavo_set_recurring_expense_status',{p_schedule_id:s.id,p_status:s.status==='active'?'paused':'active'});if(e)throw e;changed();}catch(ex){setError(ex instanceof Error?ex.message:'Unable to update schedule');}finally{setWorkingId('');}};
 const renderRows=active==='direct'?expenses.filter(x=>matches(x.description,x.category,supplierName(x.supplier_id),x.supplier_name))
  :active==='bill'?bills.filter(x=>matches(x.bill_number,supplierName(x.supplier_id))):[];
 return <div className="space-y-4">
 <div className={`${card} flex flex-wrap items-center justify-between gap-3 p-4`}>
  <div className="flex gap-2 flex-wrap text-sm">{([['direct','Direct Expenses'],['recurring','Recurring'],['bill','Supplier Bills']] as const).map(([k,v])=><button type="button" key={k} onClick={()=>setActive(k)} className={`rounded px-3 py-2 ${active===k?'bg-[#244A73] text-white':'bg-[#EFF3F8] text-[#244A73]'}`}>{v}</button>)}</div>
  <div className="flex gap-2"><input className={input} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search vendor, description, reference"/><button type="button" onClick={()=>setVersion(n=>n+1)} title="Refresh" className="rounded border px-2"><RefreshCw className="h-4 w-4"/></button><button onClick={active==='bill'?onOpenCreateBill:onOpenCreateExpense} className="whitespace-nowrap rounded bg-[#244A73] px-4 py-2 text-sm text-white"><Plus className="inline h-4 w-4"/> {active==='bill'?'New Bill':'New Expense'}</button></div>
 </div>
 {loading&&<p className={`${card} p-4 text-sm text-[#69788B]`}>Loading expenses and payable schedules…</p>}
 {error&&<p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
 {!loading&&active==='recurring'&&<>
  <div className={`${card} overflow-x-auto`}><div className="border-b p-4"><h3 className="font-semibold text-[#182539]">Recurring Vendor Expenses</h3><p className="text-xs text-[#69788B]">Scheduled payables; no automatic cash posting</p></div>
   <table className="w-full text-left text-sm"><thead className="bg-[#F5F8FB] text-xs uppercase text-[#69788B]"><tr>{['Vendor','Description','Amount','Frequency','Next Due','Status','Action'].map(v=><th key={v} className="p-3">{v}</th>)}</tr></thead><tbody>{schedules.filter(s=>matches(s.description,supplierName(s.supplier_id))).map(s=><tr key={s.id} className="border-t"><td className="p-3">{supplierName(s.supplier_id)}</td><td className="p-3">{s.description}</td><td className="p-3 font-semibold">{money(s.amount_minor,s.currency)}</td><td className="p-3">Every {s.interval_days} days</td><td className="p-3">{s.next_due_date}</td><td className="p-3 capitalize">{s.status}</td><td className="p-3"><button type="button" onClick={()=>void changeStatus(s)} disabled={workingId===s.id} className="text-[#244A73] inline-flex items-center gap-1">{s.status==='active'?<PauseCircle className="w-4 h-4"/>:<PlayCircle className="w-4 h-4"/>}{s.status==='active'?'Pause':'Resume'}</button></td></tr>)}{schedules.length===0&&<tr><td colSpan={7} className="p-8 text-center text-[#69788B]">No recurring schedules. Use New Expense → Recurring Expense.</td></tr>}</tbody></table>
  </div>
  <div className={`${card} overflow-x-auto`}><div className="border-b p-4"><h3 className="font-semibold text-[#182539]">Due Payment Obligations</h3><p className="text-xs text-[#69788B]">Payables generated when each scheduled due date arrives</p></div>
   <table className="w-full text-left text-sm"><thead className="bg-[#F5F8FB] text-xs uppercase text-[#69788B]"><tr>{['Due Date','Vendor','Description','Amount','Status','Action'].map(v=><th key={v} className="p-3">{v}</th>)}</tr></thead><tbody>{dues.filter(d=>matches(d.description,supplierName(d.supplier_id))).map(d=><tr key={d.id} className="border-t"><td className="p-3">{d.due_date}</td><td className="p-3">{supplierName(d.supplier_id)}</td><td className="p-3">{d.description}</td><td className="p-3 font-semibold">{money(d.amount_minor,d.currency)}</td><td className="p-3">{d.status==='paid'?<span className="inline-flex text-green-700 items-center gap-1"><CheckCircle2 className="w-4 h-4"/>Paid</span>:<span className="text-[#C38754]">Awaiting payment</span>}</td><td className="p-3">{d.status==='pending'&&<button type="button" onClick={()=>setPayDue(d)} className="rounded bg-[#244A73] px-3 py-2 text-xs text-white">Record Payment</button>}</td></tr>)}{dues.length===0&&<tr><td colSpan={6} className="p-8 text-center text-[#69788B]">No scheduled payments due yet.</td></tr>}</tbody></table>
  </div>
 </>}
 {!loading&&active!=='recurring'&&<div className={`${card} overflow-x-auto`}><table className="w-full text-left text-sm"><thead className="bg-[#F5F8FB] text-xs uppercase text-[#69788B]"><tr>{(active==='direct'?['Date','Vendor','Description','Category','Amount','Method']:['Date','Supplier','Invoice #','Due Date','Balance','Status','Action']).map(v=><th className="p-3" key={v}>{v}</th>)}</tr></thead><tbody>{(renderRows as (ExpenseRow|BillRow)[]).map(r=><tr key={r.id} className="border-t">{'expense_date' in r?<><td className="p-3">{r.expense_date}</td><td className="p-3">{r.supplier_id?supplierName(r.supplier_id):r.supplier_name||'Unlinked legacy record'}</td><td className="p-3">{r.description}</td><td className="p-3">{r.category}</td><td className="p-3 font-semibold">{money(r.amount_minor,r.currency)}</td><td className="p-3">{r.payment_method||'—'}</td></>:<><td className="p-3">{r.issue_date}</td><td className="p-3">{supplierName(r.supplier_id)}</td><td className="p-3">{r.bill_number}</td><td className="p-3">{r.due_date}</td><td className="p-3">{money(r.balance_due_minor,r.currency)}</td><td className="p-3 capitalize">{r.status.replace(/_/g,' ')}</td><td className="p-3"><button type="button" onClick={()=>setSettlementBill(r)} className="rounded bg-[#244A73] px-3 py-2 text-xs text-white">{Number(r.balance_due_minor)>0?'Record Payment':'View Payments'}</button></td></>}</tr>)}{renderRows.length===0&&<tr><td colSpan={active==='bill'?7:6} className="p-10 text-center text-[#69788B]">No matching records.</td></tr>}</tbody></table></div>}
 {payDue&&<PayDue due={payDue} onClose={()=>setPayDue(null)} onPaid={()=>setVersion(n=>n+1)}/>}
 {settlementBill&&<SupplierBillSettlement key={settlementBill.id} bill={settlementBill} supplierName={supplierName(settlementBill.supplier_id)} onClose={()=>setSettlementBill(null)}/>}
 <p className="text-xs text-[#69788B]">Historical expense records with no supplier link remain visible; new records always require a supplier. No backdated supplier identity is inferred.</p>
 </div>;
}


function SupplierBillSettlement({
 bill,
 supplierName,
 onClose
}:{
 bill:BillRow;
 supplierName:string;
 onClose:()=>void;
}){

 const [full,setFull]=useState(true);
 const [amount,setAmount]=useState('');
 const [date,setDate]=useState(nowDate());
 const [method,setMethod]=useState('mpesa');
 const [reference,setReference]=useState('');
 const [balance,setBalance]=useState(Number(bill.balance_due_minor));
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [result,setResult]=useState('');
 const [history,setHistory]=useState<any[]>([]);
 const [historyError,setHistoryError]=useState('');
 const [historyLoading,setHistoryLoading]=useState(true);

 const nonce=useRef(idempotency());
 const posting=useRef(false);
 const businessId=useRef(rootId()).current;

 const loadHistory=async()=>{
  if(!supabase)return;
  setHistoryLoading(true);
  setHistoryError('');
  try{
   const a=await supabase
    .from('payment_allocations')
    .select('transaction_id,amount_minor')
    .eq('business_id',businessId)
    .eq('bill_id',bill.id)
    .limit(1000);

   if(a.error)throw a.error;

   const ids=[...new Set((a.data||[]).map(x=>x.transaction_id))];

   if(!ids.length){
    setHistory([]);
    return;
   }

   const t=await supabase
    .from('financial_transactions')
    .select('id,payment_date,payment_method,reference_number,amount_minor,status')
    .eq('business_id',businessId)
    .in('id',ids)
    .order('payment_date',{ascending:false});

   if(t.error)throw t.error;

   setHistory(t.data||[]);

   if(ids.length>=1000)
    setHistoryError('History limited to 1,000 payment records.');
  }catch(e:any){
   setHistoryError(e.message||'Unable to load payment history');
  }finally{
   setHistoryLoading(false);
  }
 };

 useEffect(()=>{
  void loadHistory();
 },[bill.id]);

 const paymentAmount=full?balance:cents(amount);

 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();

  if(posting.current||result)return;

  setError('');

  if(!supabase){
   setError('Database connection unavailable');
   return;
  }

  if(!Number.isSafeInteger(paymentAmount)||
     paymentAmount<=0||
     paymentAmount>balance){
   setError('Enter a valid amount within the outstanding balance');
   return;
  }

  posting.current=true;
  setBusy(true);

  try{

   const response=await supabase.rpc('zep_pay_supplier_bill',{
    p_business_id:businessId,
    p_bill_id:bill.id,
    p_amount_minor:paymentAmount,
    p_currency:bill.currency,
    p_payment_method:method,
    p_payment_date:date,
    p_reference_number:reference.trim()||null,
    p_idempotency_key:nonce.current
   });

   if(response.error)throw response.error;

   const row=response.data?.[0];

   if(!row)throw Error('No settlement response returned');

   setBalance(Number(row.new_balance_minor));
   setResult(
    'Payment recorded successfully. Transaction: '+row.transaction_id
   );

   changed();
   void loadHistory();

  }catch(ex:any){
   setError(ex.message||'Unable to record payment');
  }finally{
   posting.current=false;
   setBusy(false);
  }
 };

 return <div
  className="fixed inset-0 z-[125] flex items-center justify-center bg-[#0D1B33]/60 p-4"
  role="dialog"
  aria-modal="true"
  aria-label="Supplier bill settlement">

  <div className={`${card} w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5`}>

   <div className="flex items-start justify-between">
    <div>
     <h2 className="text-xl font-semibold text-[#0D1B33]">
      Supplier Bill Settlement
     </h2>
     <p className="text-sm text-[#69788B]">
      {supplierName} - {bill.bill_number}
     </p>
    </div>
    <button type="button" disabled={busy} onClick={onClose}>
     Close
    </button>
   </div>

   <div className="grid grid-cols-3 gap-3">
    <div className="rounded border p-3">
     <p className="text-xs text-[#69788B]">Bill Amount</p>
     <strong className="text-sm">
      {money(bill.amount_minor,bill.currency)}
     </strong>
    </div>
    <div className="rounded border p-3">
     <p className="text-xs text-[#69788B]">Paid</p>
     <strong className="text-sm text-green-700">
      {money(Number(bill.amount_minor)-balance,bill.currency)}
     </strong>
    </div>
    <div className="rounded border p-3">
     <p className="text-xs text-[#69788B]">Outstanding</p>
     <strong className="text-sm">
      {money(balance,bill.currency)}
     </strong>
    </div>
   </div>

   {error&&<p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">
    {error}
   </p>}

   {result&&<p role="status" className="rounded bg-green-50 p-3 text-sm text-green-800">
    {result}
   </p>}

   {balance>0&&!result&&<form
     onSubmit={submit}
     className="space-y-4">

    <label className="flex items-center gap-2 text-sm">
     <input type="checkbox"
      checked={full}
      disabled={busy}
      onChange={e=>setFull(e.target.checked)}/>
     Settle full outstanding balance
    </label>

    {!full&&<label className="block text-sm">
     Partial payment ({bill.currency})
     <input
      className={input}
      required
      type="number"
      min="0.01"
      max={balance/100}
      step="0.01"
      disabled={busy}
      value={amount}
      onChange={e=>setAmount(e.target.value)}/>
    </label>}

    <div className="grid grid-cols-2 gap-3">
     <label className="text-sm">
      Payment method
      <select className={input}
       disabled={busy}
       value={method}
       onChange={e=>setMethod(e.target.value)}>
       {paymentMethods.map(([label,value])=>
        <option key={value} value={value}>{label}</option>
       )}
      </select>
     </label>

     <label className="text-sm">
      Payment date
      <input className={input}
       type="date"
       required
       disabled={busy}
       min={bill.issue_date}
       max={nowDate()}
       value={date}
       onChange={e=>setDate(e.target.value)}/>
     </label>
    </div>

    <label className="block text-sm">
     Payment reference
     <input className={input}
      disabled={busy}
      maxLength={200}
      required={['mpesa','bank_transfer','card'].includes(method)}
      value={reference}
      onChange={e=>setReference(e.target.value)}/>
    </label>

    <div className="rounded bg-[#F1F5FA] p-3 text-sm">
     Amount to record:
     <strong className="ml-2">
      {money(paymentAmount||0,bill.currency)}
     </strong>
     <p className="mt-1 text-xs text-[#69788B]">
      Records a completed payment. Does not transfer money.
     </p>
    </div>

    <div className="flex justify-end gap-2">
     <button type="button"
      disabled={busy}
      onClick={onClose}
      className="rounded border px-4 py-2 text-sm">
      Cancel
     </button>
     <button type="submit"
      disabled={busy}
      className="rounded bg-[#244A73] px-4 py-2 text-sm text-white disabled:opacity-50">
      {busy?'Recording...':'Confirm Payment'}
     </button>
    </div>
   </form>}

   {balance===0&&<p className="rounded bg-green-50 p-3 text-sm text-green-800">
    Fully settled
   </p>}

   <div className="border-t pt-4">
    <h3 className="mb-3 font-semibold">Payment History</h3>

    {historyLoading&&<p className="text-sm">Loading payments...</p>}

    {historyError&&<p role="alert" className="text-sm text-red-700">
     {historyError}
    </p>}

    {!historyLoading&&!history.length&&
     <p className="text-sm text-[#69788B]">
      No recorded payments.
     </p>
    }

    <div className="space-y-2">
     {history.map(t=>
      <div key={t.id}
       className="flex justify-between gap-3 rounded border p-3 text-sm">
       <div>
        <strong>
         {paymentMethods.find(x=>x[1]===t.payment_method)?.[0]||t.payment_method}
        </strong>
        <p className="text-xs text-[#69788B]">
         {t.payment_date} - {t.reference_number||'No reference'}
        </p>
        <p className="text-xs text-[#69788B]">
         {t.status}
        </p>
       </div>
       <strong>{money(t.amount_minor,bill.currency)}</strong>
      </div>
     )}
    </div>

   </div>
  </div>
 </div>;
}
