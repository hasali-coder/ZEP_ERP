import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { useFinancial } from '../../context/FinancialContext';
import { PaymentMethod, FinancialTransaction } from '../../types';
import { formatMoney, parseMoneyToCents, centsToDecimal } from '../../utils/money';
import { getTodayDateString } from '../../utils/dates';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetInvoiceId?: string;
  targetBillId?: string;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  targetInvoiceId,
  targetBillId,
}) => {
  const { invoices, bills, activeBusiness, recordInvoicePayment, recordBillPayment } = useFinancial();

  const [paymentType, setPaymentType] = useState<'received' | 'made'>('received');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [selectedBillId, setSelectedBillId] = useState<string>('');
  const [amountStr, setAmountStr] = useState<string>('');
  const [date, setDate] = useState<string>(getTodayDateString());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Bank Transfer');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const payableInvoices = invoices.filter((i) => i.balanceDueCents > 0);
  const payableBills = bills.filter((b) => b.balanceDueCents > 0);

  useEffect(() => {
    if (targetInvoiceId) {
      setPaymentType('received');
      setSelectedInvoiceId(targetInvoiceId);
      const inv = invoices.find((i) => i.id === targetInvoiceId);
      if (inv) {
        setAmountStr(centsToDecimal(inv.balanceDueCents).toString());
      }
    } else if (targetBillId) {
      setPaymentType('made');
      setSelectedBillId(targetBillId);
      const bill = bills.find((b) => b.id === targetBillId);
      if (bill) {
        setAmountStr(centsToDecimal(bill.balanceDueCents).toString());
      }
    } else {
      setSelectedInvoiceId(payableInvoices[0]?.id || '');
      setSelectedBillId(payableBills[0]?.id || '');
      if (payableInvoices[0]) {
        setAmountStr(centsToDecimal(payableInvoices[0].balanceDueCents).toString());
      }
    }
  }, [isOpen, targetInvoiceId, targetBillId]);

  const handleInvoiceSelect = (invId: string) => {
    setSelectedInvoiceId(invId);
    const inv = invoices.find((i) => i.id === invId);
    if (inv) {
      setAmountStr(centsToDecimal(inv.balanceDueCents).toString());
    }
  };

  const handleBillSelect = (bId: string) => {
    setSelectedBillId(bId);
    const bill = bills.find((b) => b.id === bId);
    if (bill) {
      setAmountStr(centsToDecimal(bill.balanceDueCents).toString());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const amountCents = parseMoneyToCents(amountStr);
    if (amountCents <= 0) {
      setErrorMsg('Please enter a valid payment amount greater than zero');
      return;
    }

    try {
      if (paymentType === 'received') {
        if (!selectedInvoiceId) {
          setErrorMsg('Please select an invoice to allocate this payment to');
          return;
        }
        const inv = invoices.find((i) => i.id === selectedInvoiceId);
        if (!inv) throw new Error('Invoice not found');

        if (amountCents > inv.balanceDueCents) {
          setErrorMsg(
            `Payment amount (${formatMoney(amountCents, activeBusiness.currency)}) cannot exceed remaining balance (${formatMoney(inv.balanceDueCents, activeBusiness.currency)})`
          );
          return;
        }

        recordInvoicePayment({
          invoiceId: selectedInvoiceId,
          amountCents,
          date,
          paymentMethod,
          referenceNumber: referenceNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else {
        if (!selectedBillId) {
          setErrorMsg('Please select a supplier bill to allocate this payment to');
          return;
        }
        const bill = bills.find((b) => b.id === selectedBillId);
        if (!bill) throw new Error('Bill not found');

        if (amountCents > bill.balanceDueCents) {
          setErrorMsg(
            `Payment amount (${formatMoney(amountCents, activeBusiness.currency)}) cannot exceed remaining balance (${formatMoney(bill.balanceDueCents, activeBusiness.currency)})`
          );
          return;
        }

        recordBillPayment({
          billId: selectedBillId,
          amountCents,
          date,
          paymentMethod,
          referenceNumber: referenceNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      }

      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record payment');
    }
  };

  const activeInvoice = invoices.find((i) => i.id === selectedInvoiceId);
  const activeBill = bills.find((b) => b.id === selectedBillId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Payment"
      description="Record a cash inflow from a customer or cash outflow to a supplier"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Toggle Payment Received vs Payment Made */}
        {!targetInvoiceId && !targetBillId && (
          <div className="grid grid-cols-2 p-1 bg-[#F6F8FB] rounded-md gap-1 border border-[#E2E8F0]">
            <button
              type="button"
              onClick={() => {
                setPaymentType('received');
                setErrorMsg('');
              }}
              className={`py-1.5 px-3 rounded font-medium transition-colors ${
                paymentType === 'received'
                  ? 'bg-white text-[#244A73] shadow-xs font-semibold'
                  : 'text-[#69788B] hover:text-[#182539]'
              }`}
            >
              Payment Received (Customer)
            </button>
            <button
              type="button"
              onClick={() => {
                setPaymentType('made');
                setErrorMsg('');
              }}
              className={`py-1.5 px-3 rounded font-medium transition-colors ${
                paymentType === 'made'
                  ? 'bg-white text-[#244A73] shadow-xs font-semibold'
                  : 'text-[#69788B] hover:text-[#182539]'
              }`}
            >
              Payment Made (Supplier)
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-2.5 rounded bg-[#FDF2F3] border border-[#F7D3D7] text-[#BF5963] text-xs">
            {errorMsg}
          </div>
        )}

        {/* Invoice or Bill Selector */}
        {paymentType === 'received' ? (
          <div>
            <label className="block font-medium text-[#182539] mb-1">Select Invoice</label>
            {payableInvoices.length === 0 ? (
              <div className="p-3 bg-[#F6F8FB] rounded border border-[#E2E8F0] text-[#69788B]">
                No outstanding customer invoices require payment.
              </div>
            ) : (
              <select
                value={selectedInvoiceId}
                onChange={(e) => handleInvoiceSelect(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
              >
                {payableInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNumber} — {inv.customerName} (Bal: {formatMoney(inv.balanceDueCents, inv.currency)})
                  </option>
                ))}
              </select>
            )}

            {activeInvoice && (
              <div className="mt-1.5 text-xs text-[#69788B] flex justify-between px-1">
                <span>Total: {formatMoney(activeInvoice.totalCents, activeInvoice.currency)}</span>
                <span>Paid to date: {formatMoney(activeInvoice.amountPaidCents, activeInvoice.currency)}</span>
                <span className="font-semibold text-[#182539]">
                  Remaining: {formatMoney(activeInvoice.balanceDueCents, activeInvoice.currency)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div>
            <label className="block font-medium text-[#182539] mb-1">Select Supplier Bill</label>
            {payableBills.length === 0 ? (
              <div className="p-3 bg-[#F6F8FB] rounded border border-[#E2E8F0] text-[#69788B]">
                No outstanding supplier bills require payment.
              </div>
            ) : (
              <select
                value={selectedBillId}
                onChange={(e) => handleBillSelect(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
              >
                {payableBills.map((bill) => (
                  <option key={bill.id} value={bill.id}>
                    {bill.billNumber} — {bill.supplierName} (Bal: {formatMoney(bill.balanceDueCents, bill.currency)})
                  </option>
                ))}
              </select>
            )}

            {activeBill && (
              <div className="mt-1.5 text-xs text-[#69788B] flex justify-between px-1">
                <span>Total: {formatMoney(activeBill.amountCents, activeBill.currency)}</span>
                <span className="font-semibold text-[#182539]">
                  Remaining: {formatMoney(activeBill.balanceDueCents, activeBill.currency)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Amount & Date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-medium text-[#182539] mb-1">
              Amount ({activeBusiness.currency})
            </label>
            <input
              type="number"
              step="any"
              min="0"
              required
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="e.g. 20000"
              className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs tabular-nums focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
            />
          </div>

          <div>
            <label className="block font-medium text-[#182539] mb-1">Payment Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
            />
          </div>
        </div>

        {/* Payment Method & Reference */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-medium text-[#182539] mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
            >
              <option value="Bank Transfer">Bank Transfer (EFT/RTGS)</option>
              <option value="M-Pesa">M-Pesa</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Cheque">Cheque</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-[#182539] mb-1">
              Reference Number (Optional)
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="e.g. QKD9948271 or Ref #123"
              className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs font-mono focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block font-medium text-[#182539] mb-1">Notes (Optional)</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Deposit payment, receipt memo, or account remarks..."
            className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
          />
        </div>

        {/* Action Buttons */}
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
            Record Payment
          </button>
        </div>
      </form>
    </Modal>
  );
};
