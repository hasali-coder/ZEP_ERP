import React, { useState, useMemo } from 'react';
import { useFinancial } from '../../context/FinancialContext';
import { Quotation } from '../../types';
import { StatusBadge } from '../common/Badge';
import { formatMoney } from '../../utils/money';
import { formatDate } from '../../utils/dates';
import { exportToCSV } from '../../utils/export';
import {
  Search,
  Plus,
  Download,
  Eye,
  ArrowRight,
} from 'lucide-react';

interface QuotationListViewProps {
  onOpenCreateModal: () => void;
  onViewQuotation: (quotationId: string) => void;
  onInvoiceCreated: (invoiceId: string) => void;
}

export const QuotationListView: React.FC<QuotationListViewProps> = ({
  onOpenCreateModal,
  onViewQuotation,
  onInvoiceCreated,
}) => {
  const { quotations, activeBusiness, convertQuotationToInvoice } = useFinancial();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredQuotes = useMemo(() => {
    return quotations.filter((q) => {
      if (statusFilter !== 'all' && q.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesNumber = q.quoteNumber.toLowerCase().includes(query);
        const matchesCustomer = q.customerName.toLowerCase().includes(query);
        if (!matchesNumber && !matchesCustomer) return false;
      }
      return true;
    });
  }, [quotations, statusFilter, searchQuery]);

  const handleExportCSV = () => {
    const headers = [
      'Quotation Number',
      'Customer',
      'Issue Date',
      'Valid Until',
      'Currency',
      'Subtotal',
      'Tax',
      'Total',
      'Status',
    ];
    const rows = filteredQuotes.map((q) => [
      q.quoteNumber,
      q.customerName,
      q.issueDate,
      q.expiryDate,
      q.currency,
      q.subtotalCents / 100,
      q.taxCents / 100,
      q.totalCents / 100,
      q.status,
    ]);
    exportToCSV(`Quotations_${activeBusiness.name.replace(/\s+/g, '_')}`, headers, rows);
  };

  const handleQuickConvert = (q: Quotation, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Convert quotation ${q.quoteNumber} into a new invoice?`)) {
      const inv = convertQuotationToInvoice(q.id);
      if (inv) {
        onInvoiceCreated(inv.id);
      }
    }
  };

  const statusTabs = [
    { id: 'all', label: 'All Quotations' },
    { id: 'sent', label: 'Sent' },
    { id: 'accepted', label: 'Accepted' },
    { id: 'converted', label: 'Converted' },
    { id: 'draft', label: 'Draft' },
  ];

  return (
    <div className="space-y-4">
      <div className="mz-toolbar flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#E2E8F0]">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-[#69788B] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Search quotations"
              placeholder="Search quotation # or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mz-search-input w-full pl-8 pr-3 py-1.5 border border-[#E2E8F0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
            />
          </div>

          <div className="mz-segmented-control flex items-center gap-1 bg-[#F6F8FB] border border-[#E2E8F0] overflow-x-auto">
            {statusTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-white text-[#244A73] shadow-xs font-semibold'
                    : 'text-[#69788B] hover:text-[#182539]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
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
            onClick={onOpenCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#244A73] hover:bg-[#1B3959] text-white font-medium rounded text-xs transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Quotation</span>
          </button>
        </div>
      </div>

      <div className="mz-panel bg-white border border-[#E2E8F0] overflow-hidden">
        {filteredQuotes.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#69788B]">
            <p className="font-semibold text-sm text-[#182539]">No quotations found</p>
            <p className="mt-1">Create an estimate to send proposals to prospective clients.</p>
            {statusFilter === 'all' && !searchQuery && (
              <button
                onClick={onOpenCreateModal}
                className="mt-3 px-4 py-2 bg-[#244A73] hover:bg-[#1B3959] text-white font-medium rounded text-xs transition-colors"
              >
                Create Quotation
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="mz-table w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F6F8FB] border-b border-[#E2E8F0] text-xs font-semibold text-[#69788B] uppercase tracking-wider">
                  <th className="py-3 px-4">Quote #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Issue Date</th>
                  <th className="py-3 px-4">Valid Until</th>
                  <th className="py-3 px-4 text-right">Estimated Total</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredQuotes.map((q) => (
                  <tr
                    key={q.id}
                    className="hover:bg-[#F6F8FB] transition-colors cursor-pointer group"
                    onClick={() => onViewQuotation(q.id)}
                  >
                    <td className="py-3.5 px-4 font-mono font-medium text-xs text-[#244A73]">
                      {q.quoteNumber}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-[#182539] max-w-[200px] truncate">
                      {q.customerName}
                    </td>
                    <td className="py-3.5 px-4 text-[#69788B] text-xs">{formatDate(q.issueDate)}</td>
                    <td className="py-3.5 px-4 text-[#69788B] text-xs">{formatDate(q.expiryDate)}</td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-[#182539]">
                      {formatMoney(q.totalCents, q.currency)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <StatusBadge status={q.status} />
                    </td>
                    <td
                      className="py-3.5 px-4 text-right shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        {false && q.status !== 'converted' && (
                          <button
                            onClick={(e) => handleQuickConvert(q, e)}
                            className="px-2.5 py-1 bg-[#244A73] hover:bg-[#1B3959] text-white font-medium rounded text-xs transition-colors flex items-center gap-1"
                            title="Convert to invoice"
                          >
                            <span>Convert</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={() => onViewQuotation(q.id)}
                          className="p-1 text-[#69788B] hover:text-[#182539] hover:bg-[#E2E8F0]/60 rounded transition-colors"
                          title="View Quotation"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
