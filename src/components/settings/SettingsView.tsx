import React, { useState, useEffect } from 'react';
import { useFinancial } from '../../context/FinancialContext';
import { CurrencyCode } from '../../types';
import {
  Save,
  Check,
  Download,
  RotateCcw,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { activeBusiness, updateBusiness, resetToDefaults } = useFinancial();

  const [name, setName] = useState(activeBusiness.name);
  const [email, setEmail] = useState(activeBusiness.email);
  const [phone, setPhone] = useState(activeBusiness.phone);
  const [address, setAddress] = useState(activeBusiness.address);
  const [city, setCity] = useState(activeBusiness.city);
  const [country, setCountry] = useState(activeBusiness.country);
  const [taxNumber, setTaxNumber] = useState(activeBusiness.taxNumber || '');
  const [currency, setCurrency] = useState<CurrencyCode>(activeBusiness.currency);
  const [paymentInstructions, setPaymentInstructions] = useState(activeBusiness.paymentInstructions || '');
  const [notes, setNotes] = useState(activeBusiness.notes || '');

  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setName(activeBusiness.name);
    setEmail(activeBusiness.email);
    setPhone(activeBusiness.phone);
    setAddress(activeBusiness.address);
    setCity(activeBusiness.city);
    setCountry(activeBusiness.country);
    setTaxNumber(activeBusiness.taxNumber || '');
    setCurrency(activeBusiness.currency);
    setPaymentInstructions(activeBusiness.paymentInstructions || '');
    setNotes(activeBusiness.notes || '');
  }, [activeBusiness]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateBusiness({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
      city: city.trim(),
      country: country.trim(),
      taxNumber: taxNumber.trim() || undefined,
      currency,
      paymentInstructions: paymentInstructions.trim(),
      notes: notes.trim(),
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleExportFullJSON = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      business: activeBusiness,
      localStorageDump: { ...localStorage },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MyZavo_Backup_${activeBusiness.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <form onSubmit={handleSave} className="mz-panel bg-white p-6 border border-[#E2E8F0] space-y-6 text-sm">
        <div className="border-b border-[#E2E8F0] pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-[18px] font-semibold text-[#182539]">Business Profile & Configuration</h2>
            <p className="text-[#69788B] text-xs mt-1">
              These details appear on your printed invoices, quotations, receipts, and Statements of Account
            </p>
          </div>
          {savedSuccess && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-[#EFF8F6] border border-[#CDEAE3] text-[#1F806F] rounded text-xs font-medium">
              <Check className="w-4 h-4" />
              <span>Your changes have been saved</span>
            </div>
          )}
        </div>

        {/* Business Name & Base Currency */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[#182539] mb-1.5">Business Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Savannah Digital Labs Ltd"
              className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-sm text-[#182539] focus:outline-hidden focus:border-[#244A73] focus:ring-1 focus:ring-[#244A73]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#182539] mb-1.5">Base Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-sm text-[#182539] focus:outline-hidden focus:border-[#244A73] focus:ring-1 focus:ring-[#244A73]"
            >
              <option value="KES">KES — Kenyan Shilling</option>
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — British Pound</option>
              <option value="TZS">TZS — Tanzanian Shilling</option>
              <option value="UGX">UGX — Ugandan Shilling</option>
              <option value="ZAR">ZAR — South African Rand</option>
            </select>
          </div>
        </div>

        {/* Contact Email & Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#182539] mb-1.5">Billing & Finance Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="accounts@yourbusiness.com"
              className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-sm text-[#182539] focus:outline-hidden focus:border-[#244A73] focus:ring-1 focus:ring-[#244A73]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#182539] mb-1.5">Business Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+254 700 000 000"
              className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-sm text-[#182539] focus:outline-hidden focus:border-[#244A73] focus:ring-1 focus:ring-[#244A73]"
            />
          </div>
        </div>

        {/* Physical Address, City, Country */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-[#182539] mb-1.5">Street Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Suite / Building / Street"
              className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-sm text-[#182539] focus:outline-hidden focus:border-[#244A73] focus:ring-1 focus:ring-[#244A73]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#182539] mb-1.5">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Nairobi"
              className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-sm text-[#182539] focus:outline-hidden focus:border-[#244A73] focus:ring-1 focus:ring-[#244A73]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#182539] mb-1.5">Country</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. Kenya"
              className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-sm text-[#182539] focus:outline-hidden focus:border-[#244A73] focus:ring-1 focus:ring-[#244A73]"
            />
          </div>
        </div>

        {/* Tax PIN */}
        <div>
          <label className="block text-xs font-medium text-[#182539] mb-1.5">
            Tax Identification / PIN (Optional)
          </label>
          <input
            type="text"
            value={taxNumber}
            onChange={(e) => setTaxNumber(e.target.value)}
            placeholder="e.g. P051283940B"
            className="w-full max-w-sm px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-sm font-mono text-[#182539] focus:outline-hidden focus:border-[#244A73] focus:ring-1 focus:ring-[#244A73]"
          />
        </div>

        {/* Payment instructions */}
        <div>
          <label className="block text-xs font-medium text-[#182539] mb-1.5">
            Default Payment Instructions (Bank & M-Pesa)
          </label>
          <textarea
            rows={3}
            value={paymentInstructions}
            onChange={(e) => setPaymentInstructions(e.target.value)}
            placeholder="Bank: Standard Chartered Bank&#10;Account: 0102030405001&#10;M-Pesa Paybill: 400200 | Account: 0102030405001"
            className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-sm font-mono text-[#182539] focus:outline-hidden focus:border-[#244A73] focus:ring-1 focus:ring-[#244A73]"
          />
          <p className="text-xs text-[#69788B] mt-1.5">
            These instructions are automatically attached to all new customer invoices.
          </p>
        </div>

        {/* Default notes */}
        <div>
          <label className="block text-xs font-medium text-[#182539] mb-1.5">Default Invoice Notes & Terms</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Payment is strictly due within 14 days of invoice issue date."
            className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-sm text-[#182539] focus:outline-hidden focus:border-[#244A73] focus:ring-1 focus:ring-[#244A73]"
          />
        </div>

        <div className="pt-4 border-t border-[#E2E8F0] flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 bg-[#244A73] hover:bg-[#1B3959] text-white font-medium rounded-md shadow-xs transition-colors text-sm"
          >
            <Save className="w-4 h-4 text-white" />
            <span>Save Business Settings</span>
          </button>
        </div>
      </form>

      {/* Data Management Section */}
      <div className="mz-panel bg-white p-6 border border-[#E2E8F0] space-y-4 text-sm">
        <h3 className="text-sm font-semibold text-[#182539]">Data Persistence & Backup</h3>
        <p className="text-[#69788B] text-xs">
          All application state is securely persisted in your browser's persistent storage. You can export a full
          JSON backup or reset demo records to test fresh flows.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            onClick={handleExportFullJSON}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-[#E2E8F0] hover:bg-[#F6F8FB] text-[#182539] font-medium rounded text-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#69788B]" />
            <span>Export Full JSON Backup</span>
          </button>

          <button
            onClick={() => {
              if (confirm('Reset demo data to initial realistic values?')) {
                resetToDefaults();
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-[#E2E8F0] hover:bg-[#FDF2F2] text-[#BF5963] font-medium rounded text-xs transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Records</span>
          </button>
        </div>
      </div>
    </div>
  );
};
