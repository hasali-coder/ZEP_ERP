import React, { useState, useMemo } from 'react';
import { useFinancial } from '../../context/FinancialContext';
import { formatMoney } from '../../utils/money';
import { formatDate } from '../../utils/dates';
import { exportToCSV } from '../../utils/export';
import {
  Search,
  Plus,
  Download,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';

interface TransactionListViewProps {
  onOpenPaymentModal: () => void;
}

export const TransactionListView: React.FC<TransactionListViewProps> = ({ onOpenPaymentModal }) => {
  const { transactions, activeBusiness } = useFinancial();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'payment_received' | 'payment_made'>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (methodFilter !== 'all' && t.paymentMethod !== methodFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mDesc = t.description.toLowerCase().includes(q);
        const mRef = t.referenceNumber?.toLowerCase().includes(q) || false;
        const mContact = t.contactName?.toLowerCase().includes(q) || false;
        if (!mDesc && !mRef && !mContact) return false;
      }
      return true;
    });
  }, [transactions, typeFilter, methodFilter, searchQuery]);

  const totalInflowsCents = filteredTransactions
    .filter((t) => t.type === 'payment_received')
    .reduce((sum, t) => sum + t.amountCents, 0);

  const totalOutflowsCents = filteredTransactions
    .filter((t) => t.type === 'payment_made')
    .reduce((sum, t) => sum + t.amountCents, 0);

  const netCashFlowCents = totalInflowsCents - totalOutflowsCents;

  const handleExportCSV = () => {
    const headers = [
      'Transaction ID',
      'Date',
      'Type',
      'Description',
      'Contact',
      'Payment Method',
      'Reference Number',
      'Amount',
      'Currency',
    ];
    const rows = filteredTransactions.map((t) => [
      t.id,
      t.date,
      t.type === 'payment_received' ? 'Inflow (Received)' : 'Outflow (Paid)',
      t.description,
      t.contactName || '—',
      t.paymentMethod,
      t.referenceNumber || '—',
      (t.type === 'payment_received' ? t.amountCents : -t.amountCents) / 100,
      t.currency,
    ]);
    exportToCSV(`Transactions_Ledger_${activeBusiness.name.replace(/\s+/g, '_')}`, headers, rows);
  };

  const methods = ['all', 'Bank Transfer', 'M-Pesa', 'Card', 'Cash', 'Cheque', 'Other'];

  return (
    <div className="space-y-4">
      {/* 3 Summary strip cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="mz-panel bg-white p-5 border border-[#E2E8F0]">
          <span className="text-xs font-medium uppercase tracking-wider text-[#69788B] flex items-center gap-1.5">
            <ArrowDownLeft className="w-3.5 h-3.5 text-[#1F806F]" />
            <span>Total Inflows (Cash Received)</span>
          </span>
          <div className="text-[26px] font-semibold tabular-nums text-[#1F806F] mt-1.5 leading-tight">
            +{formatMoney(totalInflowsCents, activeBusiness.currency)}
          </div>
        </div>

        <div className="mz-panel bg-white p-5 border border-[#E2E8F0]">
          <span className="text-xs font-medium uppercase tracking-wider text-[#69788B] flex items-center gap-1.5">
            <ArrowUpRight className="w-3.5 h-3.5 text-[#C38754]" />
            <span>Total Outflows (Cash Paid)</span>
          </span>
          <div className="text-[26px] font-semibold tabular-nums text-[#69788B] mt-1.5 leading-tight">
            -{formatMoney(totalOutflowsCents, activeBusiness.currency)}
          </div>
        </div>

        <div className="mz-panel bg-white p-5 border border-[#E2E8F0]">
          <span className="text-xs font-medium uppercase tracking-wider text-[#69788B]">
            Net Cash Flow (Period)
          </span>
          <div
            className={`text-[26px] font-semibold tabular-nums mt-1.5 leading-tight ${
              netCashFlowCents >= 0 ? 'text-[#1F806F]' : 'text-[#BF5963]'
            }`}
          >
            {formatMoney(netCashFlowCents, activeBusiness.currency)}
          </div>
        </div>
      </div>

      {/* Filter and Action bar */}
      <div className="mz-toolbar flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#E2E8F0]">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Segmented type buttons */}
          <div className="flex items-center gap-1 bg-[#F6F8FB] p-1 rounded-md border border-[#E2E8F0]">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                typeFilter === 'all'
                  ? 'bg-white text-[#244A73] shadow-xs font-semibold'
                  : 'text-[#69788B] hover:text-[#182539]'
              }`}
            >
              All ({transactions.length})
            </button>
            <button
              onClick={() => setTypeFilter('payment_received')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                typeFilter === 'payment_received'
                  ? 'bg-white text-[#244A73] shadow-xs font-semibold'
                  : 'text-[#69788B] hover:text-[#182539]'
              }`}
            >
              Inflows
            </button>
            <button
              onClick={() => setTypeFilter('payment_made')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                typeFilter === 'payment_made'
                  ? 'bg-white text-[#244A73] shadow-xs font-semibold'
                  : 'text-[#69788B] hover:text-[#182539]'
              }`}
            >
              Outflows
            </button>
          </div>

          <div className="relative min-w-[180px] max-w-xs">
            <Search className="w-4 h-4 text-[#69788B] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search memo, reference, contact..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#F6F8FB] border border-[#E2E8F0] rounded text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
            />
          </div>

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#F6F8FB] border border-[#E2E8F0] rounded text-xs focus:outline-hidden"
          >
            <option value="all">All Methods</option>
            {methods.filter((m) => m !== 'all').map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E2E8F0] hover:bg-[#F6F8FB] text-[#182539] font-medium rounded text-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#69788B]" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onOpenPaymentModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#244A73] hover:bg-[#1B3959] text-white font-medium rounded text-xs transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="mz-panel bg-white border border-[#E2E8F0] overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#69788B]">
            <p className="font-semibold text-sm text-[#182539]">No transactions found</p>
            <p className="mt-1">Payments recorded for invoices or expenses will appear in this unified ledger.</p>
            <button
              onClick={onOpenPaymentModal}
              className="mt-3 px-4 py-2 bg-[#244A73] hover:bg-[#1B3959] text-white font-medium rounded text-xs transition-colors"
            >
              Record First Payment
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="mz-table w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F6F8FB] border-b border-[#E2E8F0] text-xs font-semibold text-[#69788B] uppercase tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Description / Memo</th>
                  <th className="py-3 px-4">Associated Contact</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Reference #</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredTransactions.map((tx) => {
                  const isInflow = tx.type === 'payment_received';
                  return (
                    <tr key={tx.id} className="hover:bg-[#F6F8FB] transition-colors">
                      <td className="py-3.5 px-4 text-[#69788B] text-xs whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${
                            isInflow
                              ? 'bg-[#EFF8F6] text-[#1F806F] border-[#CDEAE3]'
                              : 'bg-[#F8FAFC] text-[#69788B] border-[#E2E8F0]'
                          }`}
                        >
                          {isInflow ? (
                            <>
                              <ArrowDownLeft className="w-3 h-3 text-[#1F806F]" />
                              <span>Inflow</span>
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-3 h-3 text-[#C38754]" />
                              <span>Outflow</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-[#182539] max-w-[240px] truncate">
                        {tx.description}
                      </td>
                      <td className="py-3.5 px-4 text-[#69788B] max-w-[180px] truncate">
                        {tx.contactName || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-[#69788B] text-xs">{tx.paymentMethod}</td>
                      <td className="py-3.5 px-4 font-mono text-xs text-[#69788B]">
                        {tx.referenceNumber || '—'}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right tabular-nums font-semibold whitespace-nowrap ${
                          isInflow ? 'text-[#1F806F]' : 'text-[#182539]'
                        }`}
                      >
                        {isInflow ? '+' : '-'}
                        {formatMoney(tx.amountCents, tx.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
