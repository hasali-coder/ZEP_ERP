import React,{useEffect,useState} from 'react';
import {supabase} from './supabase';
import {ImageUp,Trash2} from 'lucide-react';

const BUCKET='myzavo-business-logos';
export async function businessLogoBytes(businessId:string,explicitPath?:string|null):Promise<{bytes:Uint8Array;kind:'png'|'jpg'}|null>{
  if(!supabase||!businessId)return null;
  let path=explicitPath||'';
  if(!path){const {data,error}=await supabase.from('businesses').select('logo_path').eq('id',businessId).single();if(error)throw error;path=data?.logo_path||'';}
  if(!path)return null;
  let url=path;
  if(!/^https?:\/\//i.test(path)){
    const {data,error}=await supabase.storage.from(BUCKET).createSignedUrl(path,120);
    if(error)throw error;
    url=data.signedUrl;
  }
  const resp=await fetch(url);
  if(!resp.ok)throw new Error('Unable to retrieve business logo');
  const bytes=new Uint8Array(await resp.arrayBuffer());
  const mime=resp.headers.get('content-type')||'';
  const isPng=mime.includes('png')||bytes[0]===137;
  const isJpeg=mime.includes('jpeg')||(bytes[0]===255&&bytes[1]===216);
  if(!isPng&&!isJpeg)throw new Error('Unsupported business logo type. Use PNG or JPEG.');
  return {bytes,kind:isPng?'png':'jpg'};
}

export function BusinessLogoSettings({businessId}:{businessId:string}){
  const [path,setPath]=useState<string>(''),[url,setUrl]=useState(''),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  useEffect(()=>{let alive=true;setPath('');setUrl('');setError('');
    if(!supabase||!businessId)return;
    void supabase.from('businesses').select('logo_path').eq('id',businessId).single().then(({data,error:e})=>{
      if(alive){if(e)setError(e.message);else setPath(data?.logo_path||'');}
    });return()=>{alive=false;};
  },[businessId]);
  useEffect(()=>{let alive=true; if(!path||!supabase){setUrl('');return;}
    if(/^https?:\/\//i.test(path)){setUrl(path);return;}
    void supabase.storage.from(BUCKET).createSignedUrl(path,300).then(({data,error:e})=>{
      if(alive){if(e)setError(e.message);else setUrl(data?.signedUrl||'');}
    });return()=>{alive=false;};
  },[path]);
  const upload=async(file?:File)=>{
    if(!file||!supabase)return;setError('');setNotice('');
    if(!['image/png','image/jpeg'].includes(file.type))return setError('Use a PNG or JPEG logo.');
    if(file.size>2*1024*1024)return setError('Logo must not exceed 2 MB.');
    setBusy(true);
    const ext=file.type==='image/png'?'png':'jpg';
    const key=`${businessId}/logo-${crypto.randomUUID()}.${ext}`;
    try{
      const {error:uploaded}=await supabase.storage.from(BUCKET).upload(key,file,{upsert:false,contentType:file.type,cacheControl:'3600'});
      if(uploaded)throw uploaded;
      const {error:saved}=await supabase.from('businesses').update({logo_path:key}).eq('id',businessId).select('id').single();
      if(saved)throw saved;
      setPath(key);setNotice('Business logo saved. New PDF exports will use it.');
      window.dispatchEvent(new Event('myzavo:finance-updated'));
    }catch(e){setError(e instanceof Error?e.message:'Unable to upload logo');}
    finally{setBusy(false);}
  };
  const remove=async()=>{
    if(!supabase||!window.confirm('Remove the logo from future business documents?'))return;
    setBusy(true);setError('');try{
      const {error:e}=await supabase.from('businesses').update({logo_path:null}).eq('id',businessId).select('id').single();
      if(e)throw e;setPath('');setUrl('');setNotice('Logo removed from business settings.');
    }catch(e){setError(e instanceof Error?e.message:'Unable to remove logo');}finally{setBusy(false);}
  };
  return <section className="rounded-xl border border-[#DFE7F0] bg-white p-5 space-y-3">
    <div><h3 className="text-base font-semibold text-[#0D1B33]">Business logo</h3>
    <p className="text-xs text-[#69788B] mt-1">Used on invoices, quotations, receipts, credit notes and exported statement PDFs. PNG/JPEG, 2 MB maximum.</p></div>
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex h-20 w-36 items-center justify-center rounded-lg border border-dashed border-[#C8D5E3] bg-[#F6F8FB] overflow-hidden">
        {url?<img src={url} alt="Current business logo" className="max-h-full max-w-full object-contain"/>:<span className="text-xs text-[#69788B]">No logo uploaded</span>}
      </div>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#244A73] px-4 py-2 text-sm text-white">
        <ImageUp size={16}/>{busy?'Saving…':'Upload logo'}
        <input className="sr-only" type="file" accept="image/png,image/jpeg" disabled={busy} onChange={e=>{void upload(e.target.files?.[0]);e.currentTarget.value='';}}/>
      </label>
      {path&&<button type="button" disabled={busy} onClick={()=>void remove()} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><Trash2 size={15}/>Remove logo</button>}
    </div>
    {error&&<p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    {notice&&<p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
  </section>;
}

export function BusinessLogoMark({businessId,fallback='B'}:{businessId:string;fallback?:string}){
  const [url,setUrl]=useState('');
  useEffect(()=>{let alive=true;if(!supabase||!businessId)return;
    void supabase.from('businesses').select('logo_path').eq('id',businessId).single().then(async({data})=>{
      const path=data?.logo_path;if(!path||!alive)return;
      if(/^https?:\/\//i.test(path)){setUrl(path);return;}
      const r=await supabase!.storage.from(BUCKET).createSignedUrl(path,300);
      if(alive&&r.data)setUrl(r.data.signedUrl);
    });return()=>{alive=false;};
  },[businessId]);
  return url?<img alt="Business logo" src={url} className="h-9 w-auto max-w-28 object-contain"/>:<span className="flex h-8 w-8 items-center justify-center rounded bg-[#0D1B33] font-bold text-white">{fallback.slice(0,1)}</span>;
}
