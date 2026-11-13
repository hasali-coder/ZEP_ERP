import React,{useState} from 'react';
import {PlugZap,Landmark,Mail,Smartphone,ExternalLink,LockKeyhole} from 'lucide-react';
const apps=[
 {name:'KRA eTIMS',kind:'Tax compliance',icon:Landmark,desc:'Future integration for compliant electronic invoicing, tax references and filing reconciliation.',fields:['KRA PIN','eTIMS connection profile','Invoice submission mode']},
 {name:'M-Pesa Daraja',kind:'Collections & payments',icon:Smartphone,desc:'Future PayBill/Till collection, STK push requests, payment callbacks and automated invoice matching.',fields:['Business Shortcode','Callback URL','Environment']},
 {name:'Microsoft Outlook',kind:'Email delivery',icon:Mail,desc:'Future Microsoft 365 connection for emailing quotations, invoices, receipts and payment reminders.',fields:['Microsoft tenant','Sender mailbox','Email templates']},
 {name:'CBK Exchange Rates',kind:'Currency rates',icon:Landmark,desc:'Future reference-rate lookup for multi-currency reports, FX audit trails and conversion previews.',fields:['Base reporting currency','Rate date','Rate source']},
];
export function IntegrationsPreview(){
 const [expanded,setExpanded]=useState<string|null>(null);
 return <div className="space-y-5 max-w-6xl">
  <header className="rounded-xl border bg-white p-6"><div className="flex items-center gap-2"><PlugZap className="text-[#244A73]"/><h2 className="text-xl font-semibold text-[#0D1B33]">Integrations</h2></div>
   <p className="mt-2 text-sm text-[#69788B]">Preview the external services that ZEP ERP may support. All integrations are currently disabled; no account credentials are requested or stored.</p></header>
  <div className="grid gap-4 lg:grid-cols-2">{apps.map(app=>{const Icon=app.icon;return <article key={app.name} className="rounded-xl border bg-white p-5 space-y-3">
   <div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="rounded-lg bg-[#EDF4FA] p-2 text-[#244A73]"><Icon size={20}/></span><div><h3 className="font-semibold text-[#0D1B33]">{app.name}</h3><p className="text-xs text-[#69788B]">{app.kind}</p></div></div>
   <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">Coming soon</span></div>
   <p className="min-h-12 text-sm text-[#66788C]">{app.desc}</p>
   <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-[#244A73]" onClick={()=>setExpanded(expanded===app.name?null:app.name)}>Preview configuration <ExternalLink size={13}/></button>
   {expanded===app.name&&<div className="space-y-3 rounded-lg bg-[#F6F8FB] p-4">
     {app.fields.map(f=><label key={f} className="block text-xs font-medium text-[#69788B]">{f}<input disabled placeholder="Available when integration is enabled" className="mt-1 block w-full rounded border bg-slate-100 px-3 py-2 text-xs"/></label>)}
     <button type="button" disabled className="flex items-center gap-2 rounded-md border bg-slate-200 px-3 py-2 text-sm text-slate-500"><LockKeyhole size={15}/>Connect (not enabled)</button>
   </div>}
  </article>})}</div>
  <p className="text-xs text-[#69788B]">No live KRA, M-Pesa, Outlook or CBK service requests are performed from this screen.</p>
 </div>;
}
