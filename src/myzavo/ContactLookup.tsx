import React, {useCallback, useEffect, useId, useMemo, useRef, useState} from 'react';
import {Search, ChevronDown} from 'lucide-react';
import {supabase} from './supabase';

export type ContactRole = 'customer'|'supplier';
type ContactRow={id:string;name:string;company_name:string|null;customer_code:string|null;vendor_code:string|null;email?:string|null;phone?:string|null;currency_preference?:string|null};
export type ContactLookupProps={
 businessId:string;role:ContactRole;value:string;onChange:(id:string)=>void;
 required?:boolean;disabled?:boolean;placeholder?:string;className?:string;
 onSelected?:(record:ContactRow)=>void;
};
/** Customer and vendor selection always resolves to a real contact ID in the current business. */
export function ContactLookup({businessId,role,value,onChange,required=false,disabled=false,placeholder,className='',onSelected}:ContactLookupProps){
 const [all,setAll]=useState<ContactRow[]>([]);const [query,setQuery]=useState('');
 const [expanded,setExpanded]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const [focused,setFocused]=useState(false);const [highlight,setHighlight]=useState(0);
 const inputId=useId();const container=useRef<HTMLDivElement>(null);
 const refresh=useCallback(async()=>{
  if(!businessId||!supabase)return;
  setBusy(true);setError('');
  try {
   const records:ContactRow[]=[];
   for(let page=0;page<20;page++){
    const {data,error:e}=await supabase.from('contacts')
     .select('id,name,company_name,customer_code,vendor_code,email,phone,currency_preference')
     .eq('business_id',businessId).eq('type',role).eq('is_active',true).order('name',{ascending:true})
     .range(page*250,(page+1)*250-1);
    if(e)throw e;
    records.push(...((data||[]) as ContactRow[]));
    if((data||[]).length<250)break;
    if(page===19)setError('Too many contacts to display. Narrow the list or contact support.');
   }
   setAll(records);
  }catch(e){setError(e instanceof Error?e.message:'Unable to load contacts');setAll([]);}finally{setBusy(false);}
 },[businessId,role]);
 useEffect(()=>{void refresh();const onRefresh=()=>void refresh();window.addEventListener('myzavo:contacts-updated',onRefresh);return()=>window.removeEventListener('myzavo:contacts-updated',onRefresh);},[refresh]);
 useEffect(()=>{if(!expanded)return;const handler=(ev:MouseEvent)=>{if(container.current&&!container.current.contains(ev.target as Node)){setExpanded(false);setFocused(false);}};document.addEventListener('mousedown',handler);return()=>document.removeEventListener('mousedown',handler);},[expanded]);
 const selected=all.find(c=>c.id===value);
 const candidates=useMemo(()=>{
  const term=query.toLocaleLowerCase().trim();
  const filtered=all.filter(c=>!term||[c.name,c.company_name,c.customer_code,c.vendor_code,c.email,c.phone].some(v=>String(v||'').toLocaleLowerCase().includes(term)));
  return filtered.slice(0,60);
 },[all,query]);
 const textFor=(c:ContactRow)=>c.company_name||c.name;
 const choose=(c:ContactRow)=>{onChange(c.id);onSelected?.(c);setExpanded(false);setQuery('');setFocused(false);};
 const label=role==='supplier'?'Supplier':'Customer';
 return <div ref={container} className={`relative ${className}`}>
  <label className="sr-only" htmlFor={inputId}>{label}</label>
  <div className="relative">
   <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#69788B]"/>
   <input id={inputId} type="text" autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={`${inputId}-options`}
    aria-required={required} disabled={disabled} placeholder={placeholder||`Search ${label.toLowerCase()} by name, company or code`}
    value={expanded||focused?query:(selected?`${selected.vendor_code||selected.customer_code||''} · ${textFor(selected)}`:'')}
    onFocus={()=>{setFocused(true);setQuery('');setExpanded(true);setHighlight(0);}}
    onChange={e=>{setQuery(e.target.value);setExpanded(true);setHighlight(0);if(value)onChange('');}}
    onKeyDown={e=>{if(e.key==='Escape'){setExpanded(false);setFocused(false);}
      if(e.key==='ArrowDown'){e.preventDefault();setExpanded(true);setHighlight(h=>Math.min(h+1,candidates.length-1));}
      if(e.key==='ArrowUp'){e.preventDefault();setHighlight(h=>Math.max(0,h-1));}
      if(e.key==='Enter'&&expanded&&candidates[highlight]){e.preventDefault();choose(candidates[highlight]);}
    }}
    className="w-full rounded-md border border-[#DCE5EE] bg-white py-2 pl-9 pr-9 text-sm text-[#0D1B33] focus:outline-none focus:ring-2 focus:ring-[#244A73]/30"/>
   <button type="button" title={`Show ${label.toLowerCase()} contacts`} disabled={disabled} onClick={()=>{setExpanded(v=>!v);setQuery('');setFocused(true);}} className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-[#69788B]"><ChevronDown className="w-4 h-4"/></button>
  </div>
  {expanded&&!disabled&&<div id={`${inputId}-options`} role="listbox" className="absolute z-[160] mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[#DCE5EE] bg-white p-1 shadow-xl">
    {busy?<p className="p-3 text-xs text-[#69788B]">Loading contacts…</p>
     :candidates.length===0?<p className="p-3 text-xs text-[#69788B]">No active {label.toLowerCase()} matches. Create it in Contacts first.</p>
     :candidates.map((c,i)=><button key={c.id} role="option" aria-selected={value===c.id} type="button" onMouseDown={e=>e.preventDefault()}
      onClick={()=>choose(c)} className={`block w-full rounded px-3 py-2 text-left text-sm ${i===highlight?'bg-[#EAF0F7] text-[#0D1B33]':'hover:bg-[#F3F7FB]'}`}>
      <span className="block font-medium">{textFor(c)}</span>
      <span className="block text-xs text-[#69788B]">{c.vendor_code||c.customer_code||''}{c.name&&c.company_name&&c.name!==c.company_name?` · ${c.name}`:''}</span>
     </button>)}
  </div>}
  {error&&<p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
 </div>;
}
