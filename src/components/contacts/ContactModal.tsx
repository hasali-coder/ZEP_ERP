import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { useFinancial } from '../../context/FinancialContext';
import { Contact, ContactType, CurrencyCode } from '../../types';
import { supabase } from '../../myzavo/supabase';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactToEdit?: Contact | null;
  defaultType?: ContactType;
}

export const ContactModal: React.FC<ContactModalProps> = ({
  isOpen,
  onClose,
  contactToEdit,
  defaultType = 'customer',
}) => {
  const { saveContact, activeBusiness } = useFinancial();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [type, setType] = useState<ContactType>(defaultType === 'supplier' ? 'supplier' : 'customer');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Nairobi');
  const [country, setCountry] = useState('Kenya');
  const [taxNumber, setTaxNumber] = useState('');
  const [currencyPreference, setCurrencyPreference] = useState<CurrencyCode>(activeBusiness.currency);
  const [notes, setNotes] = useState('');
  const [creditTermsDays, setCreditTermsDays] = useState(0);
  type AttachmentRow = {id:string;file_name:string;description:string;storage_path:string};
  const [existingFiles, setExistingFiles] = useState<AttachmentRow[]>([]);
  const [pendingFiles, setPendingFiles] = useState<{id:string; file:File; description:string}[]>([]);
  const [attachmentError, setAttachmentError] = useState('');
  const activeId = window.location.pathname.match(/^\/app\/([0-9a-f-]{36})/i)?.[1] || '';
  useEffect(() => {
    if (!isOpen || !contactToEdit || !supabase || !activeId) {setExistingFiles([]);return;}
    let live=true;
    supabase.from('contact_attachments').select('id,file_name,description,storage_path')
      .eq('business_id',activeId).eq('contact_id',contactToEdit.id).order('created_at')
      .then(({data,error})=>{if(live){if(error)setAttachmentError(error.message);else setExistingFiles(data||[]);}});
    return ()=>{live=false;};
  },[isOpen,contactToEdit?.id,activeId]);
  const addFiles = (files: FileList|null) => {
    if (!files) return;
    const supported=['application/pdf','image/png','image/jpeg','image/webp'];
    for (const file of Array.from(files)) {
      if(!supported.includes(file.type) || file.size>10*1024*1024) {setAttachmentError('Use PDF, PNG, JPG or WEBP files up to 10 MB each.');continue;}
      setPendingFiles(old=>[...old,{id:crypto.randomUUID(),file,description:''}]);
    }
  };
  const openFile = async (path:string) => {
    if(!supabase)return;
    const {data,error}=await supabase.storage.from('myzavo-contact-documents').createSignedUrl(path,60);
    if(error){setAttachmentError(error.message);return;}
    window.open(data.signedUrl,'_blank','noopener,noreferrer');
  };
  const removeFile = async (file:AttachmentRow) => {
    if(!supabase || !activeId || !contactToEdit)return;
    setAttachmentError('');
    const {error}=await supabase.from('contact_attachments').delete().eq('business_id',activeId).eq('contact_id',contactToEdit.id).eq('id',file.id);
    if(error){setAttachmentError(error.message);return;}
    const removed=await supabase.storage.from('myzavo-contact-documents').remove([file.storage_path]);
    if(removed.error)setAttachmentError('Attachment record removed, but file cleanup failed: '+removed.error.message);
    setExistingFiles(old=>old.filter(x=>x.id!==file.id));
  };

  useEffect(() => {
    if (contactToEdit) {
      setType(contactToEdit.type);
      setName(contactToEdit.name);
      setCompanyName(contactToEdit.companyName || '');
      setEmail(contactToEdit.email);
      setPhone(contactToEdit.phone);
      setAddress(contactToEdit.address);
      setCity(contactToEdit.city || 'Nairobi');
      setCountry(contactToEdit.country || 'Kenya');
      setTaxNumber(contactToEdit.taxNumber || '');
      setCurrencyPreference(contactToEdit.currencyPreference || activeBusiness.currency);
      setNotes(contactToEdit.notes || '');
      setCreditTermsDays(contactToEdit.creditTermsDays ?? 0);
    } else {
      setType(defaultType === 'supplier' ? 'supplier' : 'customer');
      setName('');
      setCompanyName('');
      setEmail('');
      setPhone('');
      setAddress('');
      setCity('Nairobi');
      setCountry('Kenya');
      setTaxNumber('');
      setCurrencyPreference(activeBusiness.currency);
      setNotes('');
      setCreditTermsDays(0);
    }
    setPendingFiles([]);setAttachmentError('');
  }, [isOpen, contactToEdit, defaultType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaveError('');setSaving(true);
    try { const savedContact = await saveContact({
      id: contactToEdit?.id,
      type,
      name: name.trim(),
      companyName: companyName.trim() || undefined,
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
      city: city.trim() || undefined,
      country: country.trim() || undefined,
      taxNumber: taxNumber.trim() || undefined,
      currencyPreference,
      notes: notes.trim() || undefined,
      creditTermsDays,
    });
    if (pendingFiles.length && supabase) {
      if(!activeId)throw new Error('Business ID is missing for document upload.');
      const failures:string[]=[];
      for(const item of pendingFiles){
        const suffix=item.file.name.split('.').pop()?.toLowerCase() || 'bin';
        const path=`${activeId}/${savedContact.id}/${crypto.randomUUID()}.${suffix}`;
        const {error:uploadError}=await supabase.storage.from('myzavo-contact-documents').upload(path,item.file,{contentType:item.file.type,upsert:false});
        if(uploadError){failures.push(`${item.file.name}: ${uploadError.message}`);continue;}
        const {error:metadataError}=await supabase.from('contact_attachments').insert({business_id:activeId,contact_id:savedContact.id,storage_path:path,file_name:item.file.name,description:item.description.trim(),mime_type:item.file.type,byte_size:item.file.size});
        if(metadataError){await supabase.storage.from('myzavo-contact-documents').remove([path]);failures.push(`${item.file.name}: ${metadataError.message}`);}
      }
      if(failures.length){setPendingFiles([]);throw new Error('Contact saved, but some attachments failed: '+failures.join('; '));}
    }
    setPendingFiles([]);onClose();
    } catch (err) {setSaveError(err instanceof Error ? err.message : 'Could not save contact');}
    finally {setSaving(false);}
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={contactToEdit ? 'Edit Contact' : 'Add New Contact'}
      description="Create a client or supplier record to associate with invoices, quotations and bills"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {saveError && <p role="alert" className="text-red-700 bg-red-50 p-3 rounded">{saveError}</p>}
        {/* Contact Type Selector */}
        <div>
          <label className="block font-medium text-[#182539] mb-1">Contact Role</label>
          <div className="grid grid-cols-2 p-1 bg-[#F6F8FB] rounded-md gap-1 border border-[#E2E8F0]">
            <button
              type="button"
              onClick={() => setType('customer')}
              className={`py-1.5 px-2 rounded font-medium transition-colors ${
                type === 'customer'
                  ? 'bg-white text-[#244A73] shadow-xs font-semibold'
                  : 'text-[#69788B] hover:text-[#182539]'
              }`}
            >
              Customer
            </button>
            <button
              type="button"
              onClick={() => setType('supplier')}
              className={`py-1.5 px-2 rounded font-medium transition-colors ${
                type === 'supplier'
                  ? 'bg-white text-[#244A73] shadow-xs font-semibold'
                  : 'text-[#69788B] hover:text-[#182539]'
              }`}
            >
              Supplier
            </button>
          </div>
          {contactToEdit && <p className="mt-2 text-[#69788B]">A contact's role is permanent. Add a separate record if the same person is also a customer or a vendor.</p>}
        </div>

        {/* Primary Contact Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-medium text-[#182539] mb-1">
              Contact Person Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Wanjiku Kamau"
              className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
            />
          </div>

          <div>
            <label className="block font-medium text-[#182539] mb-1">
              Company / Business Name (Optional)
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Kilimani Logistics Ltd"
              className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
            />
          </div>
        </div>

        {/* Email & Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-medium text-[#182539] mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="accounts@example.com"
              className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
            />
          </div>

          <div>
            <label className="block font-medium text-[#182539] mb-1">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+254 700 000 000"
              className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="block font-medium text-[#182539] mb-1">Billing Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street address, building or office suite"
            className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
          />
        </div>

        {/* City, Country, Tax Number */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block font-medium text-[#182539] mb-1">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Nairobi"
              className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
            />
          </div>

          <div>
            <label className="block font-medium text-[#182539] mb-1">Country</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. Kenya"
              className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
            />
          </div>

          <div>
            <label className="block font-medium text-[#182539] mb-1">Tax ID / PIN (Optional)</label>
            <input
              type="text"
              value={taxNumber}
              onChange={(e) => setTaxNumber(e.target.value)}
              placeholder="e.g. P051283940B"
              className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs font-mono focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
            />
          </div>
        </div>

        {/* Primary currency */}
        <div>
          <label htmlFor="contact-primary-currency" className="block font-medium text-[#182539] mb-1">Primary preferred currency *</label>
          <select id="contact-primary-currency" required value={currencyPreference} onChange={e => setCurrencyPreference(e.target.value as CurrencyCode)}
            className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]">
            {Array.from(new Set(['KES','USD','EUR','GBP','TZS','UGX','ZAR','CNY','AED','CAD','AUD','INR','CHF','JPY',activeBusiness.currency,currencyPreference])).map(c =>
              <option key={c} value={c}>{c}</option>)}
          </select>
          <p className="mt-1 text-[#69788B]">Saved on this contact; invoice currency defaults will follow in the invoicing phase.</p>
        </div>
        {/* Credit terms */}
        <div>
          <label className="block font-medium text-[#182539] mb-1">{type==='supplier'?'Supplier credit terms':'Customer credit terms'} (days)</label>
          <select value={creditTermsDays} onChange={e=>setCreditTermsDays(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs">
            {[0,7,14,15,30,45,60,90,120].map(n=><option key={n} value={n}>{n===0?'Due on receipt':`Net ${n} days`}</option>)}
          </select>
        </div>
        {/* Attachments */}
        <section className="space-y-2 border-t border-[#E2E8F0] pt-3">
          <div className="font-semibold text-[#182539]">Attachments</div>
          <p className="text-[#69788B]">Add several files, each with its own description. PDF or images, maximum 10 MB per file.</p>
          {existingFiles.map(f=><div key={f.id} className="flex gap-2 items-center justify-between rounded border p-2">
            <div className="min-w-0"><button type="button" className="text-[#244A73] underline truncate" onClick={()=>void openFile(f.storage_path)}>{f.file_name}</button><p className="text-[#69788B]">{f.description}</p></div>
            <button type="button" className="text-red-700" onClick={()=>void removeFile(f)}>Remove</button>
          </div>)}
          {pendingFiles.map(f=><div key={f.id} className="flex gap-2 items-start rounded border p-2">
            <div className="flex-1 min-w-0"><p className="font-medium truncate">{f.file.name}</p>
              <input className="mt-1 w-full px-2 py-1.5 border rounded" value={f.description}
              onChange={e=>setPendingFiles(old=>old.map(x=>x.id===f.id?{...x,description:e.target.value}:x))}
              placeholder="Description of this attachment" maxLength={1000}/></div>
            <button type="button" className="text-red-700" onClick={()=>setPendingFiles(old=>old.filter(x=>x.id!==f.id))}>Remove</button>
          </div>)}
          <label className="inline-flex cursor-pointer items-center rounded-md border border-[#244A73] px-3 py-2 text-[#244A73] font-medium">
            + Add attachments
            <input className="sr-only" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={e=>{addFiles(e.target.files);e.target.value='';}}/>
          </label>
          {attachmentError&&<p role="alert" className="text-red-700">{attachmentError}</p>}
        </section>
        {/* Nature of business */}
        <div>
          <label className="block font-medium text-[#182539] mb-1">Nature of business (Optional)</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Industry, services or main business activities..."
            className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
          />
        </div>

        {/* Form Actions */}
        <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E2E8F0]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[#E2E8F0] rounded-md text-[#69788B] hover:text-[#182539] hover:bg-[#F6F8FB] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit" disabled={saving}
            className="px-4 py-2 bg-[#244A73] hover:bg-[#1B3959] text-white font-medium rounded-md shadow-xs transition-colors"
          >
            {contactToEdit ? 'Save Changes' : 'Create Contact'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
