import React, { useState, useMemo, useEffect } from 'react';
import { useFinancial } from '../../context/FinancialContext';
import { Contact, ContactType } from '../../types';
import { formatMoney } from '../../utils/money';
import { exportToCSV } from '../../utils/export';
import { supabase } from '../../myzavo/supabase';
import { ContactProfileView } from './ContactProfileView';
import {
  Search,
  Plus,
  Download,
  Mail,
  Phone,
  MapPin,
  FileText,
  FileCheck2,
  CreditCard,
  FileSpreadsheet,
  Edit,
  Eye,
  Power,
  X,
} from 'lucide-react';

interface ContactListViewProps {
  onOpenCreateModal: (defaultType?: ContactType) => void;
  onEditContact: (contact: Contact) => void;
  onCreateInvoiceForCustomer: (customerId: string) => void;
  onCreateQuotationForCustomer: (customerId: string) => void;
  onRecordPaymentForCustomer: (customerId: string) => void;
  onGenerateSOA: (customerId: string) => void;
}

export const ContactListView: React.FC<ContactListViewProps> = ({
  onOpenCreateModal,
  onEditContact,
  onCreateInvoiceForCustomer,
  onCreateQuotationForCustomer,
  onRecordPaymentForCustomer,
  onGenerateSOA,
}) => {
  const { contacts, contactsLoading, contactsError, invoices, bills, transactions, activeBusiness, deleteContact } = useFinancial();
  const [deleteError, setDeleteError] = useState('');
  const [activeRole, setActiveRole] = useState<'all' | 'customer' | 'supplier'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [actionError, setActionError] = useState('');
  const [profileId, setProfileId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('contact'));
  const businessId = window.location.pathname.match(/^\/app\/([0-9a-f-]{36})\/?$/i)?.[1] || '';
  const { refreshContacts } = useFinancial();

  const openProfile = (id: string) => {
    const u = new URL(window.location.href);
    u.searchParams.set('contact', id);
    window.history.pushState({}, '', u);
    setProfileId(id);
  };
  const closeProfile = () => {
    const u = new URL(window.location.href);
    u.searchParams.delete('contact');
    window.history.pushState({}, '', u);
    setProfileId(null);
  };
  useEffect(() => {
    const onPop = () => setProfileId(new URLSearchParams(window.location.search).get('contact'));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const changeStatus = async (contact: Contact): Promise<void> => {
    if (!supabase || !businessId) throw new Error('No connected business is selected.');
    const { data, error } = await supabase.from('contacts')
      .update({ is_active: contact.isActive === false })
      .eq('business_id', businessId)
      .eq('id', contact.id)
      .select('id');
    if (error) throw new Error(error.message);
    if (!data || data.length !== 1) throw new Error('Contact status was not updated. Please check access permissions.');
    await refreshContacts();
  };

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (statusFilter === "active" && c.isActive === false) return false;
      if (statusFilter === "inactive" && c.isActive !== false) return false;
      if (activeRole !== 'all' && c.type !== activeRole) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mName = c.name.toLowerCase().includes(q);
        const mCompany = c.companyName?.toLowerCase().includes(q) || false;
        const mEmail = c.email.toLowerCase().includes(q);
        const mPhone = c.phone.toLowerCase().includes(q);
        if (!mName && !mCompany && !mEmail && !mPhone) return false;
      }
      return true;
    });
  }, [contacts, activeRole, searchQuery, statusFilter]);

  const selectedContact = contacts.find((c) => c.id === selectedContactId);

  const contactInvoices = selectedContact
    ? invoices.filter((i) => i.customerId === selectedContact.id && i.status !== 'cancelled')
    : [];

  const contactTransactions = selectedContact
    ? transactions.filter((t) => t.contactId === selectedContact.id)
    : [];

  const totalInvoicedCents = contactInvoices.reduce((sum, i) => sum + i.totalCents, 0);
  const totalReceivedCents = contactTransactions
    .filter((t) => t.type === 'payment_received')
    .reduce((sum, t) => sum + t.amountCents, 0);
  const totalOutstandingCents = contactInvoices.reduce((sum, i) => sum + i.balanceDueCents, 0);

  const handleExportCSV = () => {
    const headers = ['Contact ID', 'Name', 'Company', 'Role', 'Preferred Currency', 'Email', 'Phone', 'Address', 'City', 'Country', 'Tax PIN'];
    const rows = filteredContacts.map((c) => [
      c.customerCode || c.vendorCode || '',
      c.name,
      c.companyName || '—',
      c.type,
      c.currencyPreference || activeBusiness.currency,
      c.email,
      c.phone,
      c.address,
      c.city || '—',
      c.country || '—',
      c.taxNumber || '—',
    ]);
    exportToCSV(`Contacts_${activeBusiness.name.replace(/\s+/g, '_')}`, headers, rows);
  };

  if(profileId){
    const profile=contacts.find(c=>c.id===profileId);
    return profile?<ContactProfileView contact={profile} businessId={businessId} onBack={closeProfile} onEdit={onEditContact} onStatus={changeStatus}/>:<div className="bg-white border rounded-xl p-8"><p className="mb-4">Contact not found or not accessible.</p><button className="text-[#244A73] underline" onClick={closeProfile}>Return to contacts</button></div>;
  }
  return (
    <div className="space-y-4">
      {contactsLoading && <p role="status" className="text-sm text-[#69788B]">Loading contacts from Supabase...</p>}
      {(contactsError || deleteError) && <p role="alert" className="rounded bg-red-50 text-red-700 p-3 text-sm">{contactsError || deleteError}</p>}
      {actionError && <p role="alert" className="bg-red-50 text-red-700 border border-red-200 rounded p-3 text-sm">{actionError}</p>}
      {/* Controls */}
      <div className="mz-toolbar flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#E2E8F0]">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="flex items-center gap-1 bg-[#F6F8FB] p-1 rounded-md border border-[#E2E8F0]">
            <button
              onClick={() => setActiveRole('all')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                activeRole === 'all'
                  ? 'bg-white text-[#244A73] shadow-xs font-semibold'
                  : 'text-[#69788B] hover:text-[#182539]'
              }`}
            >
              All Contacts ({contacts.length})
            </button>
            <button
              onClick={() => setActiveRole('customer')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                activeRole === 'customer'
                  ? 'bg-white text-[#244A73] shadow-xs font-semibold'
                  : 'text-[#69788B] hover:text-[#182539]'
              }`}
            >
              Customers
            </button>
            <button
              onClick={() => setActiveRole('supplier')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                activeRole === 'supplier'
                  ? 'bg-white text-[#244A73] shadow-xs font-semibold'
                  : 'text-[#69788B] hover:text-[#182539]'
              }`}
            >
              Suppliers
            </button>
          </div>

          <div className="relative min-w-[180px] max-w-xs">
            <Search className="w-4 h-4 text-[#69788B] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search contact, company, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#F6F8FB] border border-[#E2E8F0] rounded text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value as 'active'|'inactive'|'all')} aria-label="Contact status" className="border rounded px-2 py-1.5 text-xs bg-white">
            <option value="active">Active contacts</option><option value="inactive">Inactive contacts</option><option value="all">All statuses</option>
          </select>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E2E8F0] hover:bg-[#F6F8FB] text-[#182539] font-medium rounded text-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#69788B]" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => onOpenCreateModal(activeRole === 'supplier' ? 'supplier' : 'customer')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#244A73] hover:bg-[#1B3959] text-white font-medium rounded text-xs transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Contact list + Selected Contact Details Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Table List */}
        <div
          className={`mz-panel bg-white border border-[#E2E8F0] overflow-hidden ${
            selectedContact ? 'lg:col-span-7' : 'lg:col-span-12'
          }`}
        >
          {filteredContacts.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#69788B]">
              <p className="font-semibold text-sm text-[#182539]">No contacts found</p>
              <p className="mt-1">Add customers or suppliers to track invoices and statements.</p>
              <button
                onClick={() => onOpenCreateModal(activeRole === 'supplier' ? 'supplier' : 'customer')}
                className="mt-3 px-4 py-2 bg-[#244A73] hover:bg-[#1B3959] text-white font-medium rounded text-xs transition-colors"
              >
                {activeRole === 'supplier' ? 'Add Supplier' : 'Add Customer'}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="mz-table w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F6F8FB] border-b border-[#E2E8F0] text-xs font-semibold text-[#69788B] uppercase tracking-wider">
                    <th className="py-3 px-4">Contact ID</th>
                    <th className="py-3 px-4">Contact / Company</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Currency</th>
                    <th className="py-3 px-4">Email & Phone</th>
                    <th className="py-3 px-4 text-right">Balance Due</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredContacts.map((c) => {
                    const contactInv = invoices.filter((i) => i.customerId === c.id);
                    const bal = contactInv.reduce((sum, i) => sum + i.balanceDueCents, 0);
                    const isSelected = selectedContactId === c.id;

                    return (
                      <tr
                        key={c.id}
                        className={`hover:bg-[#F6F8FB] transition-colors cursor-pointer ${
                          isSelected ? 'bg-[#F0F5FA]' : ''
                        }`}
                        onClick={() => openProfile(c.id)}
                      >
                        <td className="py-3 px-4"><div className="flex flex-col items-start gap-1">{[c.customerCode,c.vendorCode].filter(Boolean).map(code=><button key={code} className="font-semibold text-xs text-[#244A73] hover:underline" onClick={e=>{e.stopPropagation();openProfile(c.id);}}>{code}</button>)}</div></td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-[#182539]">
                            {c.companyName || c.name}
                          </div>
                          {c.companyName && (
                            <div className="text-xs text-[#69788B]">Attn: {c.name}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 capitalize text-[#69788B] text-xs">{c.type==='supplier'?'Vendor':'Customer'}</td>
                        <td className="py-3 px-4 text-[#182539] font-semibold text-xs">{c.currencyPreference || activeBusiness.currency}</td>
                        <td className="py-3 px-4 text-[#69788B] text-xs">
                          <div>{c.email || '—'}</div>
                          <div className="text-[11px]">{c.phone || ''}</div>
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-semibold">
                          {bal > 0 ? (
                            <span className="text-[#C38754]">
                              {formatMoney(bal, activeBusiness.currency)}
                            </span>
                          ) : (
                            <span className="text-[#1F806F]">Settled</span>
                          )}
                        </td>
                        <td
                          className="py-3 px-4 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openProfile(c.id)} className="p-1 text-[#69788B] hover:text-[#244A73] rounded" aria-label={`View ${c.name}`} title="View Contact"><Eye className="w-3.5 h-3.5" /></button>
                            <button
                              onClick={() => onEditContact(c)}
                              className="p-1 text-[#69788B] hover:text-[#182539] hover:bg-[#E2E8F0]/60 rounded transition-colors"
                              title="Edit Contact"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={async () => {setActionError('');try{await changeStatus(c);}catch(e){setActionError(e instanceof Error?e.message:'Unable to update contact status');}}}
                              className="p-1 text-[#69788B] hover:text-[#244A73] hover:bg-[#F6F8FB] rounded transition-colors"
                              title={c.isActive===false?'Activate Contact':'Deactivate Contact'}
                              aria-label={c.isActive===false?'Activate Contact':'Deactivate Contact'}
                            ><Power className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Contact Profile Drawer */}
        {selectedContact && (
          <div className="mz-panel lg:col-span-5 bg-white border border-[#E2E8F0] p-5 space-y-5 text-sm">
            <div className="flex items-start justify-between pb-4 border-b border-[#E2E8F0]">
              <div>
                <span className="text-xs uppercase font-medium tracking-wider text-[#69788B] block mb-0.5">
                  {selectedContact.type} Profile
                </span>
                <h3 className="text-lg font-semibold text-[#182539]">
                  {selectedContact.companyName || selectedContact.name}
                </h3>
                {selectedContact.companyName && (
                  <p className="text-xs text-[#69788B]">Contact Person: {selectedContact.name}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedContactId(null)}
                className="p-1 text-[#69788B] hover:text-[#182539] rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contact Details */}
            <div className="space-y-2 text-xs text-[#69788B]">
              {selectedContact.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-[#244A73] shrink-0" />
                  <a href={`mailto:${selectedContact.email}`} className="text-[#182539] hover:underline">
                    {selectedContact.email}
                  </a>
                </div>
              )}
              {selectedContact.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-[#244A73] shrink-0" />
                  <span className="text-[#182539]">{selectedContact.phone}</span>
                </div>
              )}
              {selectedContact.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-[#244A73] shrink-0 mt-0.5" />
                  <span className="text-[#182539]">
                    {selectedContact.address}
                    {selectedContact.city ? `, ${selectedContact.city}` : ''}
                  </span>
                </div>
              )}
              {selectedContact.taxNumber && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[#69788B]">Tax PIN:</span>
                  <span className="text-[#182539] font-mono font-medium">{selectedContact.taxNumber}</span>
                </div>
              )}
            </div>

            {/* Financial Ledger Summary */}
            <div className="bg-[#F6F8FB] p-3.5 rounded-lg border border-[#E2E8F0] space-y-2 text-xs">
              <span className="text-xs uppercase font-medium tracking-wider text-[#69788B] block">
                Account Balances
              </span>
              <div className="flex justify-between">
                <span className="text-[#69788B]">Total Invoiced:</span>
                <span className="tabular-nums font-semibold text-[#182539]">
                  {formatMoney(totalInvoicedCents, activeBusiness.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#69788B]">Total Payments Received:</span>
                <span className="tabular-nums font-semibold text-[#1F806F]">
                  {formatMoney(totalReceivedCents, activeBusiness.currency)}
                </span>
              </div>
              <div className="pt-2 border-t border-[#E2E8F0] flex justify-between font-semibold">
                <span className="text-[#182539]">Outstanding Balance:</span>
                <span className="tabular-nums text-[#0D1B33]">
                  {formatMoney(totalOutstandingCents, activeBusiness.currency)}
                </span>
              </div>
            </div>

            {/* Quick Financial Actions */}
            <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
              <span className="text-xs uppercase font-medium tracking-wider text-[#69788B] block">
                Quick Financial Actions
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => onCreateInvoiceForCustomer(selectedContact.id)}
                  className="p-2 border border-[#E2E8F0] hover:bg-[#F6F8FB] text-[#182539] font-medium rounded flex items-center gap-1.5 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-[#244A73]" />
                  <span>Create Invoice</span>
                </button>

                <button
                  onClick={() => onCreateQuotationForCustomer(selectedContact.id)}
                  className="p-2 border border-[#E2E8F0] hover:bg-[#F6F8FB] text-[#182539] font-medium rounded flex items-center gap-1.5 transition-colors"
                >
                  <FileCheck2 className="w-3.5 h-3.5 text-[#244A73]" />
                  <span>Create Quotation</span>
                </button>

                <button
                  onClick={() => onRecordPaymentForCustomer(selectedContact.id)}
                  className="p-2 border border-[#E2E8F0] hover:bg-[#F6F8FB] text-[#182539] font-medium rounded flex items-center gap-1.5 transition-colors"
                >
                  <CreditCard className="w-3.5 h-3.5 text-[#1F806F]" />
                  <span>Record Payment</span>
                </button>

                <button
                  onClick={() => onGenerateSOA(selectedContact.id)}
                  className="p-2 bg-[#244A73] hover:bg-[#1B3959] text-white font-medium rounded flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
                  <span>Statement (SOA)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
