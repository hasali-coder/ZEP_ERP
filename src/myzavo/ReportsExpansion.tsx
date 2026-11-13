import {useEffect, useMemo, useState, type ChangeEvent} from 'react';
import {supabase} from './supabase';

const panel='bg-white rounded-xl border border-[#E2E8F0] shadow-sm';
const cash=(v:number,c:string)=>`${c} ${(Number(v||0)/100).toLocaleString('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const short=(s:string)=>s?new Date(`${s}T12:00:00Z`).toLocaleDateString('en-KE',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}):'—';
const days=(due:string,asOf:string)=>Math.floor((Date.parse(`${asOf}T12:00:00Z`)-Date.parse(`${due}T12:00:00Z`))/86400000);
const zone=(d:number)=>d<=0?0:d<=30?1:d<=60?2:d<=90?3:4;
const buckets=['Current (Not Due)','1–30 Days Overdue','31–60 Days Overdue','61–90 Days Overdue','90+ Days Overdue'];
const bucketColors=['#167A69','#C38754','#B8773F','#BA5767','#8F3446'];
const exportCsv=(filename:string,cols:string[],rows:(string|number)[][])=>{
 const safe=(x:string|number)=>'"'+String(x??'').replace(/"/g,'""')+'"';
 const csv='\uFEFF'+[cols,...rows].map(r=>r.map(safe).join(',')).join('\r\n');
 const uri=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=uri;a.download=filename+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(uri),60000);
};
const openInvoice=(id:string)=>window.dispatchEvent(new CustomEvent('myzavo:open-financial-document',{detail:{kind:'invoice',id}}));

type AgingRow={bill_id?:string;invoice_id?:string;bill_number?:string;invoice_number?:string;customer_name?:string;supplier_name?:string;customer_id?:string;supplier_id?:string;due_date:string;issue_date:string;currency:string;outstanding_minor:number;source?:string};
type AgingKind='ar'|'ap';
export function FinancialAgeingDetail({businessId,asOf,kind}:{businessId:string;asOf:string;kind:AgingKind}){
 const [rows,setRows]=useState<AgingRow[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const [search,setSearch]=useState(''),[currency,setCurrency]=useState(''),[selectedBucket,setSelectedBucket]=useState(-1);
 useEffect(()=>{let alive=true;async function run(){setBusy(true);setError('');setRows([]);if(!supabase||!businessId){setError('Supabase unavailable.');setBusy(false);return;}
  try{const rpc=kind==='ar'?'myzavo_ar_ageing_as_of':'myzavo_ap_ageing_as_of';const {data,error:e}=await supabase.rpc(rpc,{p_business_id:businessId,p_as_of:asOf});if(e)throw e;if(alive)setRows((data||[]) as AgingRow[]);}
  catch(e){if(alive)setError(e instanceof Error?e.message:'Unable to load ageing report');}
  finally{if(alive)setBusy(false);}}
  void run();const refresh=()=>void run();window.addEventListener('myzavo:finance-updated',refresh);
  return()=>{alive=false;window.removeEventListener('myzavo:finance-updated',refresh);};},[businessId,asOf,kind]);
 const currencies=useMemo(()=>[...new Set(rows.map(r=>r.currency))].sort(),[rows]);
 const searched=useMemo(()=>rows.filter(r=>(!currency||r.currency===currency)&&[r.customer_name,r.supplier_name,r.invoice_number,r.bill_number,r.source].join(' ').toLowerCase().includes(search.toLowerCase())),[rows,currency,search]);
 const filtered=useMemo(()=>searched.filter(r=>selectedBucket<0||zone(days(r.due_date,asOf))===selectedBucket),[searched,selectedBucket,asOf]);
 const title=kind==='ar'?'Outstanding Receivables — All Customers':'Accounts Payable Ageing — All Suppliers';
 const name=(r:AgingRow)=>kind==='ar'?(r.customer_name||'Customer'):(r.supplier_name||'Supplier');
 const ref=(r:AgingRow)=>kind==='ar'?(r.invoice_number||'—'):(r.bill_number||'—');
 const totals=useMemo(()=>[...new Set(searched.map(x=>x.currency))].sort().map(cc=>({currency:cc,sum:searched.filter(x=>x.currency===cc).reduce((n,x)=>n+Number(x.outstanding_minor),0),rows:searched.filter(x=>x.currency===cc)})),[searched]);
 const totalsAll=useMemo(()=>[...new Set(rows.map(x=>x.currency))].sort().map(cc=>({currency:cc,sum:rows.filter(x=>x.currency===cc).reduce((n,x)=>n+Number(x.outstanding_minor),0)})),[rows]);
 const csv=()=>exportCsv(`${kind.toUpperCase()}_Ageing_${asOf}`,[kind==='ar'?'Customer':'Supplier','Document #','Issue Date','Due Date','Source','Days Overdue','Currency','Balance'],filtered.map(x=>[name(x),ref(x),x.issue_date,x.due_date,x.source||'Invoice',Math.max(0,days(x.due_date,asOf)),x.currency,Number(x.outstanding_minor)/100]));
 return <section className={`${panel} p-5 sm:p-7 space-y-5 print-page`}>
 <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4"><div><h2 className="font-semibold text-xl text-[#15283E]">{title}</h2><p className="text-xs text-[#69788B] mt-1">As at {short(asOf)} · Posted payments and credit notes considered as of this date</p></div>
 <div className="flex gap-2 no-print"><button type="button" onClick={csv} disabled={busy||!!error} className="border rounded px-3 py-2 text-xs text-[#244A73]">Export CSV</button><button type="button" onClick={()=>window.print()} className="bg-[#244A73] text-white rounded px-3 py-2 text-xs">Print / PDF</button></div></div>
 <div className="flex flex-wrap gap-3 no-print"><input className="border border-[#CBD5E1] rounded px-3 py-2 text-sm flex-1 min-w-[220px]" placeholder={`Search ${kind==='ar'?'customer or invoice':'supplier or bill'}`} value={search} onChange={(e:ChangeEvent<HTMLInputElement>)=>setSearch(e.target.value)}/>
 <select className="border rounded px-3 py-2 text-sm" value={currency} onChange={(e:ChangeEvent<HTMLSelectElement>)=>setCurrency(e.target.value)}><option value="">All currencies (separate totals)</option>{currencies.map(c=><option key={c}>{c}</option>)}</select>
 {selectedBucket>=0&&<button className="border rounded px-3 py-2 text-sm" onClick={()=>setSelectedBucket(-1)}>Clear ageing filter</button>}</div>
 {busy&&<p className="text-sm text-[#69788B] p-5">Loading live records…</p>}{error&&<p role="alert" className="bg-red-50 text-red-800 rounded p-3">{error}</p>}
 {!busy&&!error&&<>
 {totalsAll.length===0?<p className="text-sm text-[#69788B] py-10 text-center">No outstanding balances as at this date.</p>:<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{totalsAll.map(t=><button type="button" key={t.currency} onClick={()=>{setCurrency(currency===t.currency?'':t.currency);setSelectedBucket(-1);}} className={`bg-[#F6F8FB] border rounded p-4 text-left hover:ring-2 hover:ring-[#244A73] ${currency===t.currency?'ring-2 ring-[#244A73]':''}`} title="Filter to this currency"><p className="text-xs uppercase text-[#69788B]">Total outstanding · {t.currency}</p><p className="font-bold text-xl tabular-nums mt-2">{cash(t.sum,t.currency)}</p></button>)}</div>}
 {totals.map(group=><div key={group.currency} className="space-y-4"><div className="flex justify-between items-center"><h3 className="font-semibold text-[#244A73]">{group.currency}</h3><strong className="text-lg tabular-nums">{cash(group.sum,group.currency)}</strong></div>
 <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">{buckets.map((label,i)=><button key={label} type="button" onClick={()=>setSelectedBucket(selectedBucket===i?-1:i)} className={`text-left rounded-lg border p-3 ${selectedBucket===i?'ring-2 ring-[#244A73]':'bg-[#F6F8FB]'}`}><div className="uppercase font-semibold text-[10px] leading-4" style={{color:bucketColors[i]}}>{label}</div><div className="text-sm font-semibold mt-2 tabular-nums">{cash(group.rows.filter(x=>zone(days(x.due_date,asOf))===i).reduce((n,x)=>n+Number(x.outstanding_minor),0),group.currency)}</div></button>)}</div></div>)}
 <div className="overflow-x-auto"><table className="w-full text-sm border-collapse"><thead className="bg-[#F6F8FB] text-[#69788B] uppercase text-[11px]"><tr>{[kind==='ar'?'Customer':'Supplier','Document No.','Due Date','Ageing','Source','Outstanding'].map(h=><th key={h} className="p-3 text-left border-b">{h}</th>)}</tr></thead><tbody>{filtered.map(r=><tr key={`${r.bill_id||r.invoice_id}-${r.due_date}`} className="border-b hover:bg-[#F8FAFC]"><td className="p-3 font-medium">{name(r)}</td><td className="p-3 text-[#244A73] font-mono text-xs">{kind==='ar'?<button onClick={()=>openInvoice(r.invoice_id||'')} className="underline underline-offset-2">{ref(r)}</button>:ref(r)}</td><td className="p-3">{short(r.due_date)}</td><td className="p-3">{buckets[zone(days(r.due_date,asOf))]}</td><td className="p-3 text-xs">{r.source||'Invoice'}</td><td className="p-3 text-right font-semibold tabular-nums">{cash(Number(r.outstanding_minor),r.currency)}</td></tr>)}</tbody></table>{filtered.length===0&&<p className="text-center text-sm py-7 text-[#69788B]">No entries match the selected filters.</p>}</div>
 <p className="text-xs text-[#69788B]">Currency totals are not combined. Supplier dues include unpaid recurring obligations; they are not treated as cash payments until posted.</p>
 </>}
 </section>;
}

async function fetchPaged(table:string,businessId:string,dateField:string,from:string,to:string,columns='*'){
 if(!supabase)throw Error('Supabase is not configured');
 const rows:any[]=[];
 for(let page=0;page<20;page++){
  const {data,error}=await supabase.from(table).select(columns).eq('business_id',businessId).gte(dateField,from).lte(dateField,to).order(dateField,{ascending:true}).range(page*500,(page+1)*500-1);
  if(error)throw error;
  rows.push(...(data||[]));
  if((data||[]).length<500)return rows;
 }
 throw Error(`Too many ${table} records for this period. Select a shorter date range.`);
}

type RawLine={date:string;type:'Invoice'|'Credit note'|'Expense';reference:string;customer_id?:string;category:string;currency:string;amount:number;description:string;id?:string};
export function ManagementPnL({businessId,from,to}:{businessId:string;from:string;to:string}){
 const [lines,setLines]=useState<RawLine[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[version,setVersion]=useState(0);
 const [currency,setCurrency]=useState(''),[customer,setCustomer]=useState(''),[category,setCategory]=useState(''),[chartMode,setChartMode]=useState<'bar'|'line'>('bar'),[detail,setDetail]=useState<'income'|'credits'|'expenses'|'result'|''>('');
 const [contacts,setContacts]=useState<{id:string;name:string;company_name:string|null}[]>([]);
 useEffect(()=>{const update=()=>setVersion(v=>v+1);window.addEventListener('myzavo:finance-updated',update);return()=>window.removeEventListener('myzavo:finance-updated',update);},[]);
 useEffect(()=>{let active=true;async function load(){setLoading(true);setError('');if(!supabase){setError('Supabase unavailable');setLoading(false);return;}
 try{const [inv,cr,ex,co]=await Promise.all([
  fetchPaged('invoices',businessId,'issue_date',from,to,'id,customer_id,invoice_number,issue_date,currency,total_minor,status,cancelled_at'),
  fetchPaged('credit_notes',businessId,'issue_date',from,to,'id,invoice_id,customer_id,credit_number,issue_date,currency,amount_minor,status'),
  fetchPaged('expenses',businessId,'expense_date',from,to,'id,description,category,expense_date,currency,amount_minor,supplier_id'),
  supabase.from('contacts').select('id,name,company_name').eq('business_id',businessId)
 ]);
  if(co.error)throw co.error;
  const creditedInvoiceIds=new Set(cr.filter(x=>x.status==='issued').map(x=>x.invoice_id));
  // Cancelled invoices are excluded unless their cancellation was a credit adjustment;
  // credit notes remain negative revenue in the period they were issued.
  const produced:RawLine[]=[
  ...inv.filter(x=>x.status!=='draft'&&(x.status!=='cancelled'||creditedInvoiceIds.has(x.id)||(x.cancelled_at&&x.cancelled_at.slice(0,10)>to))).map(x=>({date:x.issue_date,type:'Invoice' as const,reference:x.invoice_number,customer_id:x.customer_id,category:'Sales',currency:x.currency,amount:Number(x.total_minor),description:'Invoice issued',id:x.id})),
  ...cr.filter(x=>x.status==='issued').map(x=>({date:x.issue_date,type:'Credit note' as const,reference:x.credit_number,customer_id:x.customer_id,category:'Credits',currency:x.currency,amount:-Number(x.amount_minor),description:'Customer credit adjustment'})),
  ...ex.map(x=>({date:x.expense_date,type:'Expense' as const,reference:x.id,category:x.category||'Other',currency:x.currency,amount:-Number(x.amount_minor),description:x.description,customer_id:undefined}))];
  if(active){setLines(produced);setContacts((co.data||[]) as {id:string;name:string;company_name:string|null}[]);}
 }catch(e){if(active){setError(e instanceof Error?e.message:'P&L data could not be loaded');setLines([]);}}finally{if(active)setLoading(false);}}
 void load();return()=>{active=false;};},[businessId,from,to,version]);
 const currencies=[...new Set(lines.map(x=>x.currency))].sort();const currentCurrency=currencies.includes(currency)?currency:currencies[0]||'KES';
 const categories=[...new Set(lines.filter(x=>x.type==='Expense').map(x=>x.category))].sort();
 const current=lines.filter(x=>x.currency===currentCurrency&&(!customer||x.type==='Expense'||x.customer_id===customer)&&(!category||x.type!=='Expense'||x.category===category));
 const invoiceTotal=current.filter(x=>x.type==='Invoice').reduce((a,x)=>a+x.amount,0),credits=current.filter(x=>x.type==='Credit note').reduce((a,x)=>a-x.amount,0);
 const expenses=-current.filter(x=>x.type==='Expense').reduce((a,x)=>a+x.amount,0),net=invoiceTotal-credits,operating=net-expenses;
 const amountByCategory=Object.entries(current.filter(x=>x.type==='Expense').reduce((acc,x)=>{acc[x.category]=(acc[x.category]||0)-x.amount;return acc;},{} as Record<string,number>)).sort((a,b)=>b[1]-a[1]);
 const totalMonths=useMemo(()=>{const months:string[]=[];const d=new Date(from.slice(0,7)+'-01T12:00:00Z');for(let n=0;n<36&&d.toISOString().slice(0,7)<=to.slice(0,7);n++){months.push(d.toISOString().slice(0,7));d.setUTCMonth(d.getUTCMonth()+1);}return months;},[from,to]);
 const trend=totalMonths.map(m=>({month:m,revenue:current.filter(x=>x.date.slice(0,7)===m&&x.type!=='Expense').reduce((n,x)=>n+x.amount,0),cost:-current.filter(x=>x.date.slice(0,7)===m&&x.type==='Expense').reduce((n,x)=>n+x.amount,0)}));
 const max=Math.max(1,...trend.flatMap(x=>[Math.max(x.revenue,0),x.cost]));
 const chosen=current.filter(x=>detail===''||detail==='result'||(detail==='income'&&x.type==='Invoice')||(detail==='credits'&&x.type==='Credit note')||(detail==='expenses'&&x.type==='Expense'));
 const label=['Income','Credits','Expenses','Provisional operating result'];
 return <div className="space-y-4 print-page">
 <div className={`${panel} p-5 flex flex-wrap justify-between items-center gap-3`}><div><h2 className="text-xl font-semibold text-[#15283E]">Management Profit & Loss</h2><p className="text-xs text-[#69788B] mt-1">{short(from)} – {short(to)} · Invoice billing basis with recorded expenses</p></div><div className="flex gap-2 no-print"><button onClick={()=>exportCsv(`Management_PnL_${from}_${to}`,['Date','Type','Reference','Category','Description','Currency','Amount'],chosen.map(x=>[x.date,x.type,x.reference,x.category,x.description,x.currency,x.amount/100]))} className="border text-[#244A73] rounded px-3 py-2 text-xs">Export CSV</button><button onClick={()=>window.print()} className="bg-[#244A73] text-white rounded px-3 py-2 text-xs">Print / PDF</button></div></div>
 <div className={`${panel} p-4 flex flex-wrap items-center gap-3 no-print`}><label className="text-xs text-[#69788B]">Currency <select value={currentCurrency} onChange={(e:ChangeEvent<HTMLSelectElement>)=>{setCurrency(e.target.value);setDetail('');}} className="ml-2 border rounded p-2 text-sm">{currencies.length?currencies.map(c=><option key={c}>{c}</option>):<option>KES</option>}</select></label><label className="text-xs text-[#69788B]">Customer (revenue only) <select value={customer} onChange={(e:ChangeEvent<HTMLSelectElement>)=>setCustomer(e.target.value)} className="ml-2 border rounded p-2 text-sm"><option value="">All customers</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.company_name||c.name}</option>)}</select></label><label className="text-xs text-[#69788B]">Expense category <select value={category} onChange={(e:ChangeEvent<HTMLSelectElement>)=>setCategory(e.target.value)} className="ml-2 border rounded p-2 text-sm"><option value="">All categories</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label></div>
 {loading&&<p className={`${panel} p-6 text-sm`}>Loading Supabase financial records…</p>}{error&&<p role="alert" className="bg-red-50 text-red-800 rounded p-4">{error}</p>}
 {!loading&&!error&&<>
 <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">{[invoiceTotal,credits,expenses,operating].map((v,i)=><button key={label[i]} onClick={()=>setDetail(i===0?'income':i===1?'credits':i===2?'expenses':'result')} className={`${panel} p-4 text-left hover:ring-2 hover:ring-[#244A73] ${detail===(i===0?'income':i===1?'credits':i===2?'expenses':'result')?'ring-2 ring-[#244A73]':''}`}><p className="text-xs text-[#69788B] uppercase">{label[i]}</p><p className={`text-xl font-bold mt-3 tabular-nums ${i===3&&v<0?'text-[#BF5963]':'text-[#182539]'}`}>{cash(v,currentCurrency)}</p><p className="text-xs mt-2 text-[#69788B]">View supporting entries</p></button>)}</div>
 <div className="grid lg:grid-cols-3 gap-3"><div className={`${panel} p-5 lg:col-span-2`}><div className="flex flex-wrap justify-between"><h3 className="font-semibold">Monthly income and expenses</h3><div className="flex gap-1 no-print"><button className={`rounded px-2 py-1 text-xs ${chartMode==='bar'?'bg-[#244A73] text-white':'bg-[#F1F5FA]'}`} onClick={()=>setChartMode('bar')}>Bar</button><button className={`rounded px-2 py-1 text-xs ${chartMode==='line'?'bg-[#244A73] text-white':'bg-[#F1F5FA]'}`} onClick={()=>setChartMode('line')}>Line</button></div></div>
 {trend.length?<div className="overflow-x-auto mt-6">{chartMode==='line'?<svg viewBox="0 0 660 225" className="w-full min-w-[420px] h-[215px]" role="img" aria-label="Monthly income and expense trend as a line chart">
  <line x1="38" y1="12" x2="38" y2="193" stroke="#CBD5E1"/><line x1="38" y1="193" x2="630" y2="193" stroke="#CBD5E1"/>
  <polyline fill="none" stroke="#244A73" strokeWidth="3" strokeLinejoin="round" points={trend.map((t,i)=>`${55+i*560/Math.max(trend.length-1,1)},${193-Math.max(0,t.revenue)/max*170}`).join(' ')}/>
  <polyline fill="none" stroke="#C38754" strokeWidth="3" strokeLinejoin="round" points={trend.map((t,i)=>`${55+i*560/Math.max(trend.length-1,1)},${193-t.cost/max*170}`).join(' ')}/>
  {trend.map((t,i)=><g key={t.month}><circle cx={55+i*560/Math.max(trend.length-1,1)} cy={193-Math.max(0,t.revenue)/max*170} r="4" fill="#244A73"/><circle cx={55+i*560/Math.max(trend.length-1,1)} cy={193-t.cost/max*170} r="4" fill="#C38754"/><text x={55+i*560/Math.max(trend.length-1,1)} y="211" fontSize="11" textAnchor="middle" fill="#64748B">{t.month.slice(5)}</text></g>)}
  </svg>:<div className="flex gap-3 items-end h-[206px] min-w-[350px] border-b">{trend.map(t=><div key={t.month} className="flex-1 h-full min-w-[26px] flex flex-col justify-end items-center" title={`${t.month} · Revenue ${cash(t.revenue,currentCurrency)} · Costs ${cash(t.cost,currentCurrency)}`}><div className="h-[172px] w-full flex justify-center gap-1 items-end">{[t.revenue,t.cost].map((v,i)=><div key={i} className="w-[34%] rounded-t" style={{height:`${Math.max(2,Math.max(0,v)/max*165)}px`,background:i===0?'#244A73':'#C38754'}}/>)}</div><span className="text-[10px] text-[#69788B] mt-2 whitespace-nowrap">{t.month.slice(5)}</span></div>)}</div>}</div>:<p className="p-7 text-sm text-[#69788B]">No activity in the selected period.</p>}
 <p className="text-[11px] mt-4 text-[#69788B]">Navy: net billed · Sand: recorded expenses. All values in {currentCurrency}.</p></div>
 <div className={`${panel} p-5`}><h3 className="font-semibold">Expense categories</h3><div className="mt-4 space-y-3">{amountByCategory.map(([k,v])=><div key={k}><div className="flex justify-between text-xs mb-1"><span>{k}</span><strong>{cash(v,currentCurrency)}</strong></div><div className="h-2 bg-[#EEF2F6] rounded"><div className="h-2 rounded bg-[#C38754]" style={{width:`${expenses>0?v/expenses*100:0}%`}}/></div></div>)}{amountByCategory.length===0&&<p className="text-sm text-[#69788B]">No expenses recorded.</p>}</div></div></div>
 <div className={`${panel} overflow-x-auto`}><div className="p-4 border-b flex items-center justify-between"><h3 className="font-semibold">{detail===''?'Supporting financial records':`Drill-down: ${detail==='result'?'All entries':detail}`}</h3>{detail&&<button onClick={()=>setDetail('')} className="text-xs underline text-[#244A73] no-print">Show all</button>}</div><table className="w-full text-sm"><thead className="bg-[#F6F8FB] text-[#69788B] uppercase text-[11px]"><tr>{['Date','Document','Type','Category','Description','Amount'].map(x=><th key={x} className="text-left p-3 border-b">{x}</th>)}</tr></thead><tbody>{chosen.map((x,i)=><tr className="border-b hover:bg-[#F8FAFC]" key={`${x.reference}-${i}`}><td className="p-3 whitespace-nowrap">{short(x.date)}</td><td className="p-3 text-xs font-mono">{x.type==='Invoice'?<button onClick={()=>openInvoice(x.id||'')} className="text-[#244A73] underline">{x.reference}</button>:x.reference}</td><td className="p-3">{x.type}</td><td className="p-3">{x.category}</td><td className="p-3">{x.description}</td><td className="p-3 font-semibold tabular-nums whitespace-nowrap">{cash(x.amount,x.currency)}</td></tr>)}</tbody></table>{chosen.length===0&&<p className="py-8 text-center text-sm text-[#69788B]">No records match these filters.</p>}</div>
 {customer&&<p className="rounded bg-amber-50 text-amber-800 p-3 text-sm">Customer selection filters billed revenue only. Expenses remain business-wide; this is not customer-level profitability.</p>}
 <p className={`${panel} p-4 text-xs text-[#69788B]`}>Management estimate: net billed invoices less issued credit notes and recorded expenses within the chosen dates. Not an audited or accrual-complete P&L. Unpaid bills, unrecorded costs, depreciation, payroll adjustments, inventory/COGS and FX remeasurement are not automatically recognized here. Do not treat this as statutory profit.</p>
 </>}
 </div>;
}

export function LiveReportCardDrilldown({businessId,report,currency,from,to,direction='',onClose}:{businessId:string;report:string;currency:string;from:string;to:string;direction?:'in'|'out'|'';onClose:()=>void}){
 const [records,setRecords]=useState<any[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let alive=true;async function go(){setLoading(true);setError('');setRecords([]);
 try{let rows:any[]=[];
  if(report==='outstanding_invoices'||report==='ap_bills'){
   if(!supabase)throw Error('Supabase unavailable');
   const name=report==='outstanding_invoices'?'myzavo_ar_ageing_as_of':'myzavo_ap_ageing_as_of';
   const {data,error:e}=await supabase.rpc(name,{p_business_id:businessId,p_as_of:to});if(e)throw e;rows=data||[];
  }else if(report==='income'){
   const [invoices,credits]=await Promise.all([
    fetchPaged('invoices',businessId,'issue_date',from,to,'id,invoice_number,issue_date,currency,total_minor,status,customer_id'),
    fetchPaged('credit_notes',businessId,'issue_date',from,to,'id,credit_number,issue_date,currency,amount_minor,status,customer_id')]);
   rows=[...invoices,...credits.filter(x=>x.status==='issued').map(x=>({id:x.id,invoice_number:x.credit_number,issue_date:x.issue_date,currency:x.currency,total_minor:-Number(x.amount_minor),status:'credit',customer_id:x.customer_id}))];
  }else if(report==='expenses'){
   rows=await fetchPaged('expenses',businessId,'expense_date',from,to,'id,description,expense_date,currency,amount_minor,category,supplier_id');
  }else if(report==='cash_flow'||report==='payment_history'){
   rows=await fetchPaged('financial_transactions',businessId,'payment_date',from,to,'id,payment_date,description,reference_number,currency,amount_minor,direction,status,contact_id');
  }
  if(alive)setRecords(rows.filter((x:any)=>x.currency===currency));
 }catch(e){if(alive)setError(e instanceof Error?e.message:'Could not load report details');}finally{if(alive)setLoading(false);}}
 void go();return()=>{alive=false;};},[businessId,report,currency,from,to]);
 const fields=report==='income'?['issue_date','invoice_number','status','total_minor']:report==='expenses'?['expense_date','description','category','amount_minor']:report==='cash_flow'?['payment_date','description','direction','amount_minor']:report==='outstanding_invoices'?['customer_name','invoice_number','due_date','outstanding_minor']:report==='ap_bills'?['supplier_name','bill_number','due_date','outstanding_minor']:['payment_date','reference_number','description','amount_minor'];
 const label=(key:string)=>key.replace(/_/g,' ').replace(/\b\w/g,s=>s.toUpperCase());
 const cell=(x:any,key:string)=>key.endsWith('_minor')?cash(Number(x[key]||0),x.currency):key.includes('date')?short(x[key]):String(x[key]??'—');
 const visible=records.filter(x=>report!=='income'||(x.status!=='draft'&&x.status!=='cancelled')).filter(x=>!['cash_flow','payment_history'].includes(report)||(x.status==='posted'&&(!direction||x.direction===direction)));
 return <section className={`${panel} p-4 sm:p-5 space-y-3 print-page`}><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold text-[#15283E]">{label(report)} · {currency} · Supporting records</h3><p className="text-xs text-[#69788B]">{short(from)} – {short(to)}</p></div><div className="flex gap-2 no-print"><button className="border rounded px-3 py-1.5 text-xs" onClick={()=>exportCsv(`${report}_${currency}_${from}_${to}`,fields.map(label),visible.map(x=>fields.map(f=>f.endsWith('_minor')?Number(x[f])/100:String(x[f]??''))))}>CSV</button><button className="border rounded px-3 py-1.5 text-xs" onClick={()=>window.print()}>Print / PDF</button><button className="text-xs underline px-2" onClick={onClose}>Close</button></div></div>
 {loading&&<p className="text-sm p-3">Loading records…</p>}{error&&<p role="alert" className="text-sm text-red-700 p-3">{error}</p>}
 {!loading&&!error&&<div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-[#F6F8FB] text-[#69788B] text-[11px] uppercase"><tr>{fields.map(k=><th key={k} className="p-3 text-left border-b">{label(k)}</th>)}</tr></thead><tbody>{visible.map((x,i)=><tr className="border-b" key={x.id||x.invoice_id||x.bill_id||i}>{fields.map(k=><td key={k} className="p-3">{k==='invoice_number'&&x.status!=='credit'&&Boolean(x.invoice_id||(x.id&&report==='income'))?<button className="text-[#244A73] underline" onClick={()=>openInvoice(x.invoice_id||x.id)}>{cell(x,k)}</button>:cell(x,k)}</td>)}</tr>)}</tbody></table>{visible.length===0&&<p className="text-sm text-[#69788B] p-6 text-center">No supporting records in this currency and period.</p>}</div>}
 </section>;
}
