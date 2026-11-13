import React, {useEffect, useMemo, useState} from 'react';
import {TrendingUp, TrendingDown, Wallet, Clock, Printer, RefreshCw} from 'lucide-react';
import {supabase} from './supabase';
import {useFinancial} from '../context/FinancialContext';

const card='rounded-xl border border-[#E2E8F0] bg-white shadow-sm';
const cash=(v:number,c:string)=>`${c} ${(Number(v||0)/100).toLocaleString('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const month=(d:string)=>d.slice(0,7);
const monthName=(d:string)=>new Date(d+'-02T12:00:00Z').toLocaleDateString('en-GB',{month:'short',year:'2-digit',timeZone:'UTC'});
const age=(due:string,asOf:string)=>Math.round((Date.parse(asOf+'T12:00:00Z')-Date.parse(due+'T12:00:00Z'))/86400000);
type Row={currency:string;[key:string]:any};
type Tx={id:string;currency:string;payment_date:string;amount_minor:number;direction:'in'|'out';status:string;payment_method:string};
type Expense={currency:string;expense_date:string;amount_minor:number;category:string};
type Aging={currency:string;due_date:string;outstanding_minor:number};
async function collectAll(table:'financial_transactions'|'expenses',businessId:string,from:string,to:string){
 const rows:any[]=[];let page=0;const dateColumn=table==='expenses'?'expense_date':'payment_date';
 if(!supabase)throw Error('Supabase is unavailable');
 while(page<20){let q=supabase.from(table).select('*').eq('business_id',businessId).gte(dateColumn,from).lte(dateColumn,to).order(dateColumn,{ascending:false}).range(page*500,(page+1)*500-1);
  const {data,error}=await q;if(error)throw error;rows.push(...(data||[]));if((data||[]).length<500)return {rows,limited:false};page++;}
 return {rows,limited:true};
}
const ages=[{key:'current',name:'Current',color:'#1F806F'},{key:'1-30',name:'1–30 days',color:'#C38754'},{key:'31-60',name:'31–60 days',color:'#D29D6E'},{key:'61-90',name:'61–90 days',color:'#BF5963'},{key:'90+',name:'90+ days',color:'#99414C'}];
const bucket=(n:number)=>n<=0?'current':n<=30?'1-30':n<=60?'31-60':n<=90?'61-90':'90+';
function Bar({n,max,color}:{n:number;max:number;color:string}){return <div className="h-2.5 bg-[#EEF2F6] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{width:`${max>0?Math.max(0,Math.min(100,n/max*100)):0}%`,backgroundColor:color}}/></div>}

export function LiveReportAnalytics({businessId,from,to,onNavigate}:{businessId:string;from:string;to:string;onNavigate?:(report:string,currency:string,direction?:'in'|'out')=>void}){
 const {activeBusiness}=useFinancial();
 const [summary,setSummary]=useState<Row[]>([]),[transactions,setTransactions]=useState<Tx[]>([]),[expenses,setExpenses]=useState<Expense[]>([]),[aging,setAging]=useState<Aging[]>([]);
 const [currency,setCurrency]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[limited,setLimited]=useState(false),[version,setVersion]=useState(0);
 useEffect(()=>{const fn=()=>setVersion(n=>n+1);window.addEventListener('myzavo:finance-updated',fn);return()=>window.removeEventListener('myzavo:finance-updated',fn);},[]);
 useEffect(()=>{let active=true;async function run(){if(!businessId||!supabase){setError('Select a business');setLoading(false);return;}setLoading(true);setError('');
 try{const [s,t,e,a]=await Promise.all([
  supabase.rpc('myzavo_report_summary',{p_business_id:businessId,p_from:from,p_to:to}),
  collectAll('financial_transactions',businessId,from,to),collectAll('expenses',businessId,from,to),
  supabase.rpc('myzavo_ar_ageing_as_of',{p_business_id:businessId,p_as_of:to})
 ]);
 if(s.error)throw s.error;if(a.error)throw a.error;
 if(active){setSummary((s.data?.by_currency||[]) as Row[]);setTransactions(t.rows as Tx[]);setExpenses(e.rows as Expense[]);setAging((a.data||[]) as Aging[]);setLimited(t.limited||e.limited);}}
 catch(err){if(active)setError(err instanceof Error?err.message:'Unable to load analytics');}finally{if(active)setLoading(false);}}
 void run();return()=>{active=false;};},[businessId,from,to,version]);
 const currencies=useMemo(()=>[...new Set([...summary.map(s=>s.currency),...transactions.map(t=>t.currency),...expenses.map(e=>e.currency),...aging.map(a=>a.currency)])].sort(),[summary,transactions,expenses,aging]);
 const choice=currencies.includes(currency)?currency:(currencies.includes(activeBusiness.currency)?activeBusiness.currency:currencies[0]||activeBusiness.currency||'KES');
 const s=summary.find(v=>v.currency===choice)||{} as Row;
 const tx=transactions.filter(t=>t.currency===choice&&t.status==='posted');
 const spent=expenses.filter(e=>e.currency===choice);
 const aged=aging.filter(a=>a.currency===choice);
 const ms=useMemo(()=>{const months:string[]=[];if(from>to)return months;let d=new Date(from.slice(0,7)+'-01T12:00:00Z');const end=to.slice(0,7);
 for(let i=0;i<120;i++){const k=d.toISOString().slice(0,7);months.push(k);if(k>=end)break;d.setUTCMonth(d.getUTCMonth()+1);}return months.slice(-12);},[from,to]);
 const trend=ms.map(k=>({key:k,in:tx.filter(t=>month(t.payment_date)===k&&t.direction==='in').reduce((n,t)=>n+Number(t.amount_minor),0),out:tx.filter(t=>month(t.payment_date)===k&&t.direction==='out').reduce((n,t)=>n+Number(t.amount_minor),0)}));
 const trendMax=Math.max(1,...trend.flatMap(t=>[t.in,t.out]));
 const cat=Object.entries(spent.reduce((a,e)=>{const k=e.category||'Other';a[k]=(a[k]||0)+Number(e.amount_minor);return a;},{} as Record<string,number>)).sort((a,b)=>b[1]-a[1]).slice(0,8);
 const catMax=Math.max(1,...cat.map(c=>c[1]));
 const methods=Object.entries(tx.filter(t=>t.direction==='in').reduce((a,t)=>{const k=t.payment_method||'other';a[k]=(a[k]||0)+Number(t.amount_minor);return a;},{} as Record<string,number>)).sort((a,b)=>b[1]-a[1]);
 const methodMax=Math.max(1,...methods.map(v=>v[1]));
 const ageSums=ages.map(v=>({...v,total:aged.filter(a=>bucket(age(a.due_date,to))===v.key).reduce((n,a)=>n+Number(a.outstanding_minor),0)}));
 const ageMax=Math.max(1,...ageSums.map(v=>v.total));
 const invoiced=Number(s.net_billed_minor||0),received=Number(s.cash_received_minor||0),paid=Number(s.cash_paid_minor||0),due=Number(s.receivables_minor||0);
 const kpis=[{title:'Net Billed',value:invoiced,icon:TrendingUp,help:'Issued invoices minus credit notes',color:'#244A73'},
 {title:'Cash Received',value:received,icon:Wallet,help:'Posted incoming payments',color:'#1F806F'},
 {title:'Cash Paid Out',value:paid,icon:TrendingDown,help:'Posted cash outflows',color:'#BF5963'},
 {title:'Receivables',value:due,icon:Clock,help:'Outstanding issued invoices',color:'#C38754'}];
 return <div className="space-y-5 print-page">
 <div className={`${card} p-5 flex flex-wrap justify-between items-center gap-3 no-print`}><div><h2 className="text-xl font-semibold text-[#0D1B33]">Financial Analytics</h2><p className="text-xs text-[#69788B]">Live performance dashboard · {from} to {to}</p></div><div className="flex items-center flex-wrap gap-2"><label className="text-xs">Currency<select className="ml-2 border rounded px-3 py-2 text-sm bg-white" value={choice} onChange={(e:any)=>setCurrency(e.target.value)}>{currencies.length?currencies.map(c=><option key={c}>{c}</option>):<option>{choice}</option>}</select></label><button className="rounded border px-3 py-2 text-xs" onClick={()=>setVersion(v=>v+1)}><RefreshCw className="inline w-4 h-4 mr-1"/>Refresh</button><button className="rounded bg-[#244A73] px-3 py-2 text-xs text-white" onClick={()=>window.print()}><Printer className="inline w-4 h-4 mr-1"/>Print / PDF</button></div></div>
 {loading&&<div className={`${card} p-8 text-sm text-[#69788B]`}>Loading analytics from Supabase…</div>}
 {error&&<div role="alert" className="rounded p-4 text-sm text-red-700 bg-red-50">{error}</div>}
 {!loading&&!error&&<>
 <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">{kpis.map(k=><button type="button" onClick={()=>{const name=k.title==='Net Billed'?'income':k.title==='Receivables'?'outstanding_invoices':'cash_flow';const direction=k.title==='Cash Received'?'in':k.title==='Cash Paid Out'?'out':undefined;onNavigate?.(name,choice,direction);}} className={`${card} p-5 text-left hover:ring-2 hover:ring-[#244A73]`} key={k.title} title="View supporting report"><div className="flex items-center justify-between"><p className="text-xs uppercase tracking-wide text-[#69788B]">{k.title}</p><k.icon className="w-5 h-5" style={{color:k.color}}/></div><h3 className="text-xl lg:text-2xl font-semibold mt-3 text-[#0D1B33] tabular-nums">{cash(k.value,choice)}</h3><p className="text-xs text-[#69788B] mt-2">{k.help}</p><span className="text-[11px] text-[#244A73] mt-2 inline-block">View report →</span></button>)}</div>
 <div className="grid grid-cols-1 xl:grid-cols-3 gap-4"><div className={`${card} p-5 xl:col-span-2`}><div className="flex flex-wrap justify-between gap-2 border-b pb-3"><div><h3 className="font-semibold text-[#182539]">Cash Inflow vs Outflow</h3><p className="text-xs text-[#69788B]">Actual recorded cash movements by month</p></div><div className="flex gap-3 text-xs"><span><i className="inline-block mr-1 h-2.5 w-2.5 bg-[#244A73] rounded"/>Inflow</span><span><i className="inline-block mr-1 h-2.5 w-2.5 bg-[#C38754] rounded"/>Outflow</span></div></div>
 {trend.length?<div className="overflow-x-auto"><div className="flex items-end gap-3 min-w-[380px] h-[230px] pt-6 border-b pb-2">{trend.map(t=><div key={t.key} className="flex-1 flex flex-col justify-end h-full text-center min-w-[30px]" title={`${monthName(t.key)}: In ${cash(t.in,choice)}, Out ${cash(t.out,choice)}`}><div className="flex items-end justify-center gap-1 h-[185px]"><div className="w-1/3 rounded-t bg-[#244A73]" style={{height:`${Math.max(2,t.in/trendMax*178)}px`}}/><div className="w-1/3 rounded-t bg-[#C38754]" style={{height:`${Math.max(2,t.out/trendMax*178)}px`}}/></div><span className="text-[10px] mt-2 text-[#69788B]">{monthName(t.key)}</span></div>)}</div></div>:<p className="p-8 text-center text-sm text-[#69788B]">No activity in this period.</p>}
 <div className="mt-4 flex flex-wrap gap-4 text-xs text-[#69788B]"><span>Cash in: <strong className="text-[#1F806F]">{cash(received,choice)}</strong></span><span>Cash out: <strong className="text-[#BF5963]">{cash(paid,choice)}</strong></span><span>Net movement: <strong>{cash(received-paid,choice)}</strong></span></div></div>
 <div className={`${card} p-5`}><h3 className="font-semibold text-[#182539]">Cash Collection Methods</h3><p className="text-xs text-[#69788B] border-b pb-3 mb-4">Distribution of recorded incoming payments</p>{methods.length?methods.map(([k,v])=><div key={k} className="mb-4"><div className="flex justify-between text-xs mb-1"><span className="capitalize">{k.replace('_',' ')}</span><strong>{cash(v,choice)}</strong></div><Bar n={v} max={methodMax} color="#244A73"/></div>):<p className="py-10 text-center text-sm text-[#69788B]">No payments recorded.</p>}</div></div>
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><div className={`${card} p-5`}><h3 className="font-semibold text-[#182539]">Expense Category Breakdown</h3><p className="text-xs text-[#69788B] border-b pb-3 mb-4">Based on saved expenses in {choice}</p>{cat.length?cat.map(([k,v])=><div className="mb-4" key={k}><div className="flex justify-between text-xs mb-1"><span>{k}</span><strong>{cash(v,choice)}</strong></div><Bar n={v} max={catMax} color="#C38754"/></div>):<p className="py-10 text-center text-sm text-[#69788B]">No recorded expenses during this period.</p>}</div>
 <div className={`${card} p-5`}><h3 className="font-semibold text-[#182539]">Receivables Ageing</h3><p className="text-xs text-[#69788B] border-b pb-3 mb-4">Outstanding balances as at {to}</p>{ageSums.map(v=><div className="mb-4" key={v.key}><div className="flex justify-between text-xs mb-1"><span>{v.name}</span><strong>{cash(v.total,choice)}</strong></div><Bar n={v.total} max={ageMax} color={v.color}/></div>)}<p className="pt-2 border-t text-xs text-[#69788B]">Ageing is based on issued invoices less posted allocations and credits as of the selected date.</p></div></div>
 <div className={`${card} p-4 text-xs text-[#69788B]`}>These are cashflow and billing indicators, not an audited profit-and-loss statement. Multiple currencies are displayed separately; FX conversion is not assumed. All metrics are derived from live Supabase records, not demo figures.</div>
 {limited&&<p role="alert" className="rounded bg-amber-50 text-amber-800 text-sm p-3">Transaction/expense trend limited to 10,000 records. Narrow the report period for an accurate detailed trend.</p>}
 </>}
 </div>;
}
