import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useFinancial } from '../../context/FinancialContext';
import { CurrencyCode } from '../../types';

interface CreateBusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateBusinessModal: React.FC<CreateBusinessModalProps> = ({ isOpen, onClose }) => {
  const { createBusiness } = useFinancial();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('KES');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Business name is required');
      return;
    }

    createBusiness(name.trim());
    setName('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Business Workspace"
      description="Start a clean, isolated financial ledger for your company or freelancing practice"
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        {errorMsg && (
          <div className="p-2.5 rounded bg-[#FDF2F2] border border-[#FACDCD] text-[#BF5963] text-xs">
            {errorMsg}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-[#182539] mb-1.5">Business Name *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acacia Design Studio Ltd"
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
          <p className="text-xs text-[#69788B] mt-1.5">
            All invoices, quotes, and reports in this workspace will be denominated in this currency.
          </p>
        </div>

        <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#E2E8F0]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[#E2E8F0] rounded-md text-[#69788B] hover:text-[#182539] hover:bg-[#F6F8FB] text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-[#244A73] hover:bg-[#1B3959] text-white text-xs font-medium rounded-md shadow-xs transition-colors"
          >
            Create Workspace
          </button>
        </div>
      </form>
    </Modal>
  );
};
