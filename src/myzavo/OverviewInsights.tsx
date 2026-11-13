import React, {useEffect, useMemo, useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {supabase} from './supabase';

type Flow={direction:'in'|'out';status:string;amount_minor:number;currency:string;payment_method:string;payment_date:string};
type Expense={category:string;currency:string;amount_minor:number;expense_date:string};
const MONEY=(v:number,c:string)=>`${c} ${(v/100).toLocaleString('en-KE',{maximumFractionDigits:2,minimumFractionDigits:2})}`;
const PALETTE=['#244A73','#1F806F','#C38754','#687EAD','#BF5963','#D29D6E','#567E8F','#B29A69','#7F6C98','#9BAEB8'];
const pad=(v:number)=>String(v).padStart(2,'0');
const todayLocal=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Nairobi'});
const sixMonthStart=()=>{const now=todayLocal(),dt=new Date(now.slice(0,7)+'-02T12:00:00Z');dt.setUTCMonth(dt.getUTCMonth()-5);return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth()+1)}-01`;};
const sixKeys=()=>{const date=new Date(sixMonthStart().slice(0,7)+'-02T12:00:00Z');return Array.from({length:6},(_,i)=>{const copy=new Date(date);copy.setUTCMonth(copy.getUTCMonth()+i);return `${copy.getUTCFullYear()}-${pad(copy.getUTCMonth()+1)}`;});};
export function OverviewInsights({businessId,currency}:{businessId:string;currency:string}){
 const [kind,setKind]=useState<'bar'|'line'>('bar'),[pieKind,setPieKind]=useState<'expenses'|'methods'>('expenses');
 const [expenses,setExpenses]=useState<Expense[]>([]),[tx,setTx]=useState<Flow[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState(''),[limited,setLimited]=useState(false),[reload,setReload]=useState(0);
 useEffect(()=>{const change=()=>setReload(v=>v+1);window.addEventListener('myzavo:finance-updated',change);return()=>window.removeEventListener('myzavo:finance-updated',change);},[]);
 useEffect(()=>{if(!businessId||!supabase){setError('Select a business to view analytics.');setBusy(false);return;}let alive=true;
  const load=async()=>{setBusy(true);setError('');try{
   const from=sixMonthStart(),to=todayLocal();
   const [x,e]=await Promise.all([
    supabase!.from('financial_transactions').select('direction,status,amount_minor,currency,payment_method,payment_date').eq('business_id',businessId).eq('currency',currency).gte('payment_date',from).lte('payment_date',to).order('payment_date',{ascending:false}).limit(5001),
    supabase!.from('expenses').select('category,currency,amount_minor,expense_date').eq('business_id',businessId).eq('currency',currency).gte('expense_date',from).lte('expense_date',to).order('expense_date',{ascending:false}).limit(5001)
   ]);
   if(x.error||e.error)throw x.error||e.error;
   if(alive){setLimited((x.data||[]).length>5000||(e.data||[]).length>5000);setTx(((x.data||[]).slice(0,5000)) as Flow[]);setExpenses(((e.data||[]).slice(0,5000)) as Expense[]);}
  }catch(err){if(alive)setError(err instanceof Error?err.message:'Unable to load Overview analytics');}finally{if(alive)setBusy(false);}};
  void load();return()=>{alive=false;};
 },[businessId,currency,reload]);
 const posted=tx.filter(v=>v.status==='posted'),months=useMemo(sixKeys,[]);
 const trend=months.map(key=>({key,received:posted.filter(t=>t.direction==='in'&&t.payment_date.startsWith(key)).reduce((n,t)=>n+Number(t.amount_minor),0),paid:posted.filter(t=>t.direction==='out'&&t.payment_date.startsWith(key)).reduce((n,t)=>n+Number(t.amount_minor),0)}));
 const max=Math.max(1,...trend.flatMap(t=>[t.received,t.paid]));
 const groups=pieKind==='expenses'?expenses.reduce((a,r)=>{const k=r.category||'Other';a[k]=(a[k]||0)+Number(r.amount_minor);return a;},{} as Record<string,number>)
  :posted.filter(t=>t.direction==='in').reduce((a,t)=>{const k=(t.payment_method||'other').replace('_',' ');a[k]=(a[k]||0)+Number(t.amount_minor);return a;},{} as Record<string,number>);
 const entries=Object.entries(groups).sort((a,b)=>b[1]-a[1]);const visible=entries.length>8?[...entries.slice(0,7),['Other',entries.slice(7).reduce((a,x)=>a+x[1],0)] as [string,number]]:entries;
 const total=visible.reduce((n,v)=>n+v[1],0);
 let at=0;const slices=visible.map(([name,value],i)=>{const start=at;at+=total?value/total*100:0;return {name,value,color:PALETTE[i%PALETTE.length],from:start,to:at};});
 const gradient=slices.length?`conic-gradient(${slices.map(v=>`${v.color} ${v.from.toFixed(3)}% ${v.to.toFixed(3)}%`).join(',')})`:'conic-gradient(#E8EEF4 0% 100%)';
 const point=(n:number,i:number)=>`${35+i*96},${198-n/max*165}`;
 return <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
  <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm xl:col-span-2">
   <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-3"><div><h3 className="text-sm font-semibold text-[#182539]">Cash Received vs Paid</h3><p className="text-xs text-[#69788B]">Last six months · {currency} · Posted transactions</p></div><div className="inline-flex rounded-lg border border-[#DCE5EE] p-1 text-xs" role="group" aria-label="Select chart type"><button type="button" aria-pressed={kind==='bar'} onClick={()=>setKind('bar')} className={`rounded-md px-3 py-1.5 ${kind==='bar'?'bg-[#244A73] text-white':'text-[#244A73]'}`}>Bar</button><button type="button" aria-pressed={kind==='line'} onClick={()=>setKind('line')} className={`rounded-md px-3 py-1.5 ${kind==='line'?'bg-[#244A73] text-white':'text-[#244A73]'}`}>Line</button></div></div>
   {kind==='bar'?<div className="h-[220px] overflow-x-auto"><div className="flex h-[215px] min-w-[410px] items-end justify-around gap-3 border-b pb-2">{trend.map(v=><div className="flex h-full min-w-[44px] flex-1 flex-col items-center justify-end" key={v.key} title={`${v.key}: Received ${MONEY(v.received,currency)}, Paid ${MONEY(v.paid,currency)}`}><div className="flex h-[170px] items-end justify-center gap-1"><div className="w-3 rounded-t bg-[#244A73]" style={{height:`${v.received?Math.max(3,160*v.received/max):0}px`}}/><div className="w-3 rounded-t bg-[#C38754]" style={{height:`${v.paid?Math.max(3,160*v.paid/max):0}px`}}/></div><span className="mt-2 text-[10px] text-[#69788B]">{v.key.slice(5)}</span></div>)}</div></div>
   :<div className="w-full overflow-x-auto"><svg viewBox="0 0 580 245" width="100%" role="img" aria-label={`Cash received and paid line chart in ${currency}`}><line x1="35" y1="198" x2="525" y2="198" stroke="#DDE5EC" strokeWidth="1.5"/>{[.25,.5,.75,1].map(t=><line key={t} x1="35" y1={198-165*t} x2="525" y2={198-165*t} stroke="#EDF1F5" strokeDasharray="3 4"/>)}<polyline fill="none" stroke="#244A73" strokeWidth="3" strokeLinejoin="round" points={trend.map((v,i)=>point(v.received,i)).join(' ')}/><polyline fill="none" stroke="#C38754" strokeWidth="3" strokeLinejoin="round" points={trend.map((v,i)=>point(v.paid,i)).join(' ')}/>{trend.map((v,i)=><React.Fragment key={v.key}><circle cx={35+i*96} cy={198-v.received/max*165} r="4" fill="#244A73"><title>{v.key} Received: {MONEY(v.received,currency)}</title></circle><circle cx={35+i*96} cy={198-v.paid/max*165} r="4" fill="#C38754"><title>{v.key} Paid: {MONEY(v.paid,currency)}</title></circle><text x={35+i*96} y="222" textAnchor="middle" fontSize="11" fill="#69788B">{v.key.slice(5)}</text></React.Fragment>)}</svg></div>}
   <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[#69788B]"><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded bg-[#244A73]"/>Cash received</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded bg-[#C38754]"/>Cash paid</span><button type="button" className="ml-auto inline-flex items-center gap-1 text-[#244A73]" onClick={()=>setReload(n=>n+1)}><RefreshCw className="h-3 w-3"/>Refresh</button></div>
  </section>
  <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm"><div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b pb-3"><div><h3 className="text-sm font-semibold text-[#182539]">Distribution Analysis</h3><p className="text-xs text-[#69788B]">By category or payment method</p></div><select aria-label="Pie chart data" className="rounded border px-2 py-1.5 text-xs" value={pieKind} onChange={e=>setPieKind(e.target.value as 'expenses'|'methods')}><option value="expenses">Expenses</option><option value="methods">Payment Methods</option></select></div>
   {total>0?<div className="flex flex-col items-center gap-4"><div role="img" aria-label={`${pieKind==='expenses'?'Expenses by category':'Collections by payment method'} pie chart in ${currency}`} className="relative h-40 w-40 shrink-0 rounded-full" style={{backgroundImage:gradient}}><div className="absolute inset-[26%] flex flex-col items-center justify-center rounded-full bg-white text-center"><span className="text-[10px] text-[#69788B]">Total</span><span className="text-xs font-semibold text-[#182539]">{MONEY(total,currency)}</span></div></div><div className="w-full space-y-2">{slices.map(v=><div key={v.name} className="flex items-center justify-between gap-2 text-xs"><span className="flex min-w-0 items-center gap-2"><i className="h-2.5 w-2.5 shrink-0 rounded" style={{backgroundColor:v.color}}/><span className="truncate">{v.name}</span></span><span className="whitespace-nowrap font-medium">{(v.value/total*100).toFixed(1)}% · {MONEY(v.value,currency)}</span></div>)}</div></div>:<p className="py-12 text-center text-xs text-[#69788B]">No {pieKind==='expenses'?'expenses':'received payments'} recorded in this currency and period.</p>}
  </section>
  {busy&&<p className="text-xs text-[#69788B]">Refreshing live Overview analytics…</p>}{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{limited&&<p role="alert" className="text-xs text-amber-700">More than 5,000 records in the period; use Reports for complete financial breakdowns.</p>}
 </div>;
}
