import React,{useState} from 'react';
import {LiveSettingsView} from './LiveFinance';
import {FinancialPeriods} from './FinancialPeriods';
import {TeamAccess} from './TeamAccess';
export function ZepAdminSettings(){
 const businessId=window.location.pathname.match(/^\/app\/([0-9a-f-]{36})/i)?.[1]||'';
 const [tab,setTab]=useState<'general'|'periods'|'team'>('general');
 return <div className="space-y-4"><div className="rounded-xl border bg-white p-3 flex flex-wrap gap-2">{(['general','periods','team'] as const).map(k=><button key={k} type="button" className={`rounded px-4 py-2 text-sm ${tab===k?'bg-[#244A73] text-white':'bg-[#F1F5FA] text-[#244A73]'}`} onClick={()=>setTab(k)}>{k==='general'?'Business settings':k==='periods'?'Financial periods':'Team & access'}</button>)}</div>{tab==='general'?<LiveSettingsView/>:tab==='periods'?<FinancialPeriods key={businessId} businessId={businessId}/>:<TeamAccess key={businessId} businessId={businessId}/>}</div>;
}
