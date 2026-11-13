import {ContactLedger} from '../../myzavo/ContactLedger';
import React, { useEffect, useState } from 'react';
import { ArrowLeft, Edit, FileText, Eye, Download, Mail, Phone, MapPin, ShieldCheck } from 'lucide-react';
import { Contact } from '../../types';
import { supabase } from '../../myzavo/supabase';

type Attachment = {id:string; file_name:string; description:string; storage_path:string; created_at:string};
interface Props { contact: Contact; businessId:string; onBack:()=>void; onEdit:(contact:Contact)=>void; onStatus:(contact:Contact)=>Promise<void>; }
export const ContactProfileView:React.FC<Props> = ({contact,businessId,onBack,onEdit,onStatus}) => {
  const [attachments,setAttachments]=useState<Attachment[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    let current=true;
    setLoading(true);setError('');
    if(!supabase){setError('Supabase is unavailable.');setLoading(false);return;}
    supabase.from('contact_attachments').select('id,file_name,description,storage_path,created_at')
      .eq('business_id',businessId).eq('contact_id',contact.id).order('created_at',{ascending:false})
      .then(({data,error})=>{if(!current)return;if(error)setError(error.message);else setAttachments((data||[]) as Attachment[]);setLoading(false);});
    return ()=>{current=false;};
  },[businessId,contact.id]);
  async function viewDocument(a:Attachment){
    if(!supabase)return;
    const {data,error}=await supabase.storage.from('myzavo-contact-documents').createSignedUrl(a.storage_path,60);
    if(error){setError(error.message);return;}
    window.open(data.signedUrl,'_blank','noopener,noreferrer');
  }
  async function changeStatus(){
    setError('');setBusy(true);
    try{await onStatus(contact);}catch(e){setError(e instanceof Error?e.message:'Status change failed');}finally{setBusy(false);}
  }
  const credit=contact.creditTermsDays===0?'Due on receipt':`Net ${contact.creditTermsDays??0} days`;
  return <div className="space-y-6">
    <button onClick={onBack} className="inline-flex gap-2 items-center text-sm font-medium text-[#244A73] hover:underline"><ArrowLeft size={16}/> Back to contacts</button>
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E2E8F0] pb-5">
        <div><div className="flex flex-wrap gap-2 mb-2">{contact.customerCode&&<span className="rounded bg-[#E9F2FD] px-2 py-1 text-xs font-semibold text-[#244A73]">{contact.customerCode}</span>}{contact.vendorCode&&<span className="rounded bg-[#E9F2FD] px-2 py-1 text-xs font-semibold text-[#244A73]">{contact.vendorCode}</span>}<span className={`rounded px-2 py-1 text-xs font-medium ${contact.isActive===false?'bg-slate-100 text-slate-600':'bg-emerald-50 text-emerald-700'}`}>{contact.isActive===false?'Inactive':'Active'}</span></div>
          <h1 className="text-2xl font-semibold text-[#0D1B33]">{contact.companyName||contact.name}</h1><p className="text-sm text-[#69788B] mt-1">{contact.type==='supplier'?'Vendor':'Customer'}{contact.companyName?` · Contact person: ${contact.name}`:''}</p>
        </div>
        <div className="flex gap-2"><button onClick={()=>onEdit(contact)} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium"><Edit size={15}/> Edit</button><button disabled={busy} onClick={()=>void changeStatus()} className="rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50">{contact.isActive===false?'Activate':'Deactivate'}</button></div>
      </div>
      {error&&<p role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="grid gap-6 md:grid-cols-2 pt-6">
        <section className="space-y-3"><h2 className="font-semibold text-[#0D1B33]">Contact information</h2>
          <p className="flex gap-2 items-center text-sm"><Mail size={15}/>{contact.email||'No email provided'}</p><p className="flex gap-2 items-center text-sm"><Phone size={15}/>{contact.phone||'No phone provided'}</p>
          <p className="flex gap-2 items-start text-sm"><MapPin size={15}/>{[contact.address,contact.city,contact.country].filter(Boolean).join(', ')||'No billing address provided'}</p>
          <p className="text-sm"><span className="text-[#69788B]">Tax ID / PIN: </span>{contact.taxNumber||'Not provided'}</p>
        </section>
        <section className="space-y-3"><h2 className="font-semibold text-[#0D1B33]">Commercial details</h2>
          <p className="text-sm"><span className="text-[#69788B]">Credit terms: </span>{credit}</p>
          <p className="text-sm"><span className="text-[#69788B]">Preferred currency: </span>{contact.currencyPreference||'Business default'}</p>
          <p className="text-sm"><span className="text-[#69788B]">Account status: </span>{contact.isActive===false?'Inactive':'Active'}</p>
        </section>
      </div>
    </div>
    <ContactLedger businessId={businessId} contactId={contact.id} contactType={contact.type}/>
    <section className="bg-white border border-[#E2E8F0] rounded-xl p-5 sm:p-7">
      <h2 className="font-semibold text-[#0D1B33] mb-4">Record details</h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div><p className="text-xs text-[#69788B] mb-1">Created by</p><p className="text-sm font-medium">{contact.createdByLabel || 'Not recorded (historical contact)'}</p></div>
        <div><p className="text-xs text-[#69788B] mb-1">Creation date & time</p><p className="text-sm font-medium">{contact.createdAt ? new Date(contact.createdAt).toLocaleString('en-KE',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Nairobi'}) : 'Not recorded'} <span className="text-xs text-[#69788B]">EAT</span></p></div>
        <div><p className="text-xs text-[#69788B] mb-1">Nature of business</p><p className="text-sm whitespace-pre-wrap">{contact.natureOfBusiness || contact.notes || 'Not provided'}</p></div>
      </div>
    </section>
    <section className="bg-white border border-[#E2E8F0] rounded-xl p-5 sm:p-7"><div className="flex justify-between items-center mb-4"><h2 className="font-semibold text-[#0D1B33]">Attachments</h2><span className="text-xs text-[#69788B]">{attachments.length} files</span></div>
      {loading?<p className="text-sm text-[#69788B]">Loading attachments…</p>:attachments.length===0?<p className="text-sm text-[#69788B]">No documents uploaded for this contact.</p>:<div className="divide-y">{attachments.map(a=><div className="flex justify-between items-start gap-4 py-3" key={a.id}><div className="flex gap-3 min-w-0"><FileText size={18} className="text-[#244A73] shrink-0"/><div className="min-w-0"><p className="text-sm font-medium break-all">{a.file_name}</p><p className="text-xs text-[#69788B] mt-1 whitespace-pre-wrap">{a.description||'No description'}</p></div></div><button className="inline-flex gap-1 items-center text-sm font-medium text-[#244A73] shrink-0 hover:underline" onClick={()=>void viewDocument(a)}><Eye size={15}/> View</button></div>)}</div>}
    </section>
    
  </div>;
};
