import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { useFinancial } from '../../context/FinancialContext';
import { ExpenseCategory, PaymentMethod, Expense } from '../../types';
import { parseMoneyToCents, centsToDecimal } from '../../utils/money';
import { getTodayDateString } from '../../utils/dates';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'expense' | 'bill';
  expenseToEdit?: Expense | null;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  defaultMode = 'expense',
  expenseToEdit,
}) => {
  const { suppliers, activeBusiness, saveExpense, saveBill } = useFinancial();

  const [entryMode, setEntryMode] = useState<'expense' | 'bill'>(defaultMode);

  // Common
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Office Supplies');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Expense specific
  const [date, setDate] = useState(getTodayDateString());
  const [supplierName, setSupplierName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('M-Pesa');
  const [referenceNumber, setReferenceNumber] = useState('');

  // Bill specific
  const [supplierId, setSupplierId] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [dueDate, setDueDate] = useState('');

  const categories: ExpenseCategory[] = [
    'Rent & Utilities',
    'Salaries & Wages',
    'Cloud & Software',
    'Marketing & Ads',
    'Office Supplies',
    'Travel & Transport',
    'Professional Services',
    'Taxes & Licenses',
    'Equipment & Hardware',
    'Other',
  ];

  useEffect(() => {
    if (expenseToEdit) {
      setEntryMode('expense');
      setDescription(expenseToEdit.description);
      setAmountStr(centsToDecimal(expenseToEdit.amountCents).toString());
      setCategory(expenseToEdit.category);
      setDate(expenseToEdit.date);
      setSupplierName(expenseToEdit.supplierName || '');
      setPaymentMethod(expenseToEdit.paymentMethod);
      setReferenceNumber(expenseToEdit.referenceNumber || '');
      setNotes(expenseToEdit.notes || '');
    } else {
      setEntryMode(defaultMode);
      setDescription('');
      setAmountStr('');
      setCategory('Office Supplies');
      setDate(getTodayDateString());
      setSupplierName('');
      setPaymentMethod('M-Pesa');
      setReferenceNumber('');
      setNotes('');
      setSupplierId(suppliers[0]?.id || '');
      setBillNumber('');

      const d = new Date();
      d.setDate(d.getDate() + 14);
      setDueDate(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      );
    }
  }, [isOpen, defaultMode, expenseToEdit, suppliers]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const amountCents = parseMoneyToCents(amountStr);
    if (amountCents <= 0) {
      setErrorMsg('Please enter an amount greater than zero');
      return;
    }

    if (!description.trim()) {
      setErrorMsg('Description is required');
      return;
    }

    try {
      if (entryMode === 'expense') {
        saveExpense({
          id: expenseToEdit?.id,
          description: description.trim(),
          amountCents,
          category,
          date,
          supplierName: supplierName.trim() || undefined,
          paymentMethod,
          referenceNumber: referenceNumber.trim() || undefined,
          notes: notes.trim() || undefined,
          currency: activeBusiness.currency,
        });
      } else {
        if (!supplierId) {
          setErrorMsg('Please select a supplier for this bill');
          return;
        }

        saveBill({
          supplierId,
          supplierName: suppliers.find((s) => s.id === supplierId)?.name || 'Supplier',
          billNumber: billNumber.trim() || undefined as any,
          issueDate: date,
          dueDate: dueDate || date,
          currency: activeBusiness.currency,
          amountCents,
          category,
          description: description.trim(),
          notes: notes.trim() || undefined,
        });
      }

      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save record');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        expenseToEdit
          ? 'Edit Expense'
          : entryMode === 'expense'
          ? 'Add Direct Expense'
          : 'Record Supplier Bill'
      }
      description={
        entryMode === 'expense'
          ? 'Log an immediate business expenditure or cash outflow'
          : 'Record an incurred payable invoice from a vendor/supplier'
      }
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Toggle Mode */}
        {!expenseToEdit && (
          <div className="grid grid-cols-2 p-1 bg-[#F6F8FB] rounded-md gap-1 border border-[#E2E8F0]">
            <button
              type="button"
              onClick={() => setEntryMode('expense')}
              className={`py-1.5 px-3 rounded font-medium transition-colors ${
                entryMode === 'expense'
                  ? 'bg-white text-[#244A73] shadow-xs font-semibold'
                  : 'text-[#69788B] hover:text-[#182539]'
              }`}
            >
              Direct Expense (Paid)
            </button>
            <button
              type="button"
              onClick={() => setEntryMode('bill')}
              className={`py-1.5 px-3 rounded font-medium transition-colors ${
                entryMode === 'bill'
                  ? 'bg-white text-[#244A73] shadow-xs font-semibold'
                  : 'text-[#69788B] hover:text-[#182539]'
              }`}
            >
              Supplier Bill (Payable)
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-2.5 rounded bg-[#FDF2F3] border border-[#F7D3D7] text-[#BF5963] text-xs">
            {errorMsg}
          </div>
        )}

        {/* Description */}
        <div>
          <label className="block font-medium text-[#182539] mb-1">Description *</label>
          <input
            type="text"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              entryMode === 'expense'
                ? 'e.g. Office supplies, Cloud hosting, Fuel & Transport'
                : 'e.g. Monthly office lease, Dedicated fiber connectivity'
            }
            className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
          />
        </div>

        {/* Amount & Category */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-medium text-[#182539] mb-1">
              Amount ({activeBusiness.currency}) *
            </label>
            <input
              type="number"
              step="any"
              min="0"
              required
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="e.g. 15000"
              className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs tabular-nums focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
            />
          </div>

          <div>
            <label className="block font-medium text-[#182539] mb-1">Expense Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mode-specific Fields */}
        {entryMode === 'expense' ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-[#182539] mb-1">Expense Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
                />
              </div>

              <div>
                <label className="block font-medium text-[#182539] mb-1">Vendor / Payee</label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="e.g. Safaricom PLC, AWS, Office Mart"
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-[#182539] mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
                >
                  <option value="M-Pesa">M-Pesa</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Card">Card</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-[#182539] mb-1">
                  Receipt / Reference #
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. QJD8274910"
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs font-mono focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-[#182539] mb-1">Supplier *</label>
                <select
                  required
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
                >
                  <option value="">Select supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.companyName ? `${s.companyName} (${s.name})` : s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-[#182539] mb-1">
                  Bill Number (Optional)
                </label>
                <input
                  type="text"
                  value={billNumber}
                  onChange={(e) => setBillNumber(e.target.value)}
                  placeholder="e.g. BILL-2026-003"
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs font-mono focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-[#182539] mb-1">Issue Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
                />
              </div>

              <div>
                <label className="block font-medium text-[#182539] mb-1">Due Date</label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
                />
              </div>
            </div>
          </>
        )}

        {/* Notes */}
        <div>
          <label className="block font-medium text-[#182539] mb-1">Notes (Optional)</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Tax deduction details, receipt breakdown, remarks..."
            className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
          />
        </div>

        {/* Footer */}
        <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E2E8F0]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[#E2E8F0] rounded-md text-[#69788B] hover:text-[#182539] hover:bg-[#F6F8FB] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-[#244A73] hover:bg-[#1B3959] text-white font-medium rounded-md shadow-xs transition-colors"
          >
            {entryMode === 'expense' ? 'Save Expense' : 'Save Supplier Bill'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
