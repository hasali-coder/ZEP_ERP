import React, { useState, useMemo } from 'react';
import { useFinancial } from '../../context/FinancialContext';
import { StatusBadge } from '../common/Badge';
import { formatMoney } from '../../utils/money';
import { formatDate } from '../../utils/dates';
import { exportToCSV } from '../../utils/export';
import {
  Search,
  Plus,
  Download,
  Eye,
} from 'lucide-react';

interface InvoiceListViewProps {
  onOpenCreateModal: () => void;
  onViewInvoice: (invoiceId: string) => void;
  onRecordPayment: (invoiceId: string) => void;
}

export const InvoiceListView: React.FC<InvoiceListViewProps> = ({
  onOpenCreateModal,
  onViewInvoice,
}) => {
  const { invoices, activeBusiness, invoicesLoading, invoicesError } = useFinancial();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNumber = inv.invoiceNumber.toLowerCase().includes(q);
        const matchesCustomer = inv.customerName.toLowerCase().includes(q);
        if (!matchesNumber && !matchesCustomer) return false;
      }
      return true;
    });
  }, [invoices, statusFilter, searchQuery]);

  const handleExportCSV = () => {
    const headers = [
      'Invoice Number',
      'Customer',
      'Issue Date',
      'Due Date',
      'Currency',
      'Subtotal',
      'Tax',
      'Total',
      'Amount Paid',
      'Balance Due',
      'Status',
    ];
    const rows = filteredInvoices.map((inv) => [
      inv.invoiceNumber,
      inv.customerName,
      inv.issueDate,
      inv.dueDate,
      inv.currency,
      inv.subtotalCents / 100,
      inv.taxCents / 100,
      inv.totalCents / 100,
      inv.amountPaidCents / 100,
      inv.balanceDueCents / 100,
      inv.status,
    ]);
    exportToCSV(`Invoices_${activeBusiness.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  const statusTabs = [
    { id: 'all', label: 'All Invoices' },
    { id: 'sent', label: 'Sent' },
    { id: 'partially_paid', label: 'Partially Paid' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'paid', label: 'Paid' },
    { id: 'draft', label: 'Draft' },
    { id: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="space-y-4">
      {/* Controls: Search, Status tabs, Export, Create */}
      <div className="mz-toolbar flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#E2E8F0]">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-[#69788B] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Search invoices"
              placeholder="Search invoice # or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mz-search-input w-full pl-8 pr-3 py-1.5 border border-[#E2E8F0] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
            />
          </div>

          {/* Segmented status filter buttons */}
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
            title="Export filtered invoices to CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#69788B]" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onOpenCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#244A73] hover:bg-[#1B3959] text-white font-medium rounded text-xs transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Invoice</span>
          </button>
        </div>
      </div>

      {invoicesLoading && <p className="text-sm text-[#69788B]">Loading saved invoices…</p>}
      {invoicesError && <p role="alert" className="p-3 rounded bg-red-50 text-red-700 text-sm">{invoicesError}</p>}
      {/* Invoices Table */}
      <div className="mz-panel bg-white border border-[#E2E8F0] overflow-hidden">
        {filteredInvoices.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#69788B]">
            <p className="font-semibold text-sm text-[#182539]">No invoices found</p>
            <p className="mt-1">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search query or status filter.'
                : 'Create your first invoice to begin billing clients.'}
            </p>
            {statusFilter === 'all' && !searchQuery && (
              <button
                onClick={onOpenCreateModal}
                className="mt-3 px-4 py-2 bg-[#244A73] hover:bg-[#1B3959] text-white font-medium rounded text-xs transition-colors"
              >
                Create Invoice
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="mz-table w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F6F8FB] border-b border-[#E2E8F0] text-xs font-semibold text-[#69788B] uppercase tracking-wider">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Issue Date</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-[#F6F8FB] transition-colors cursor-pointer group"
                    onClick={() => onViewInvoice(inv.id)}
                  >
                    <td className="py-3.5 px-4 font-mono font-medium text-xs text-[#244A73]">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-[#182539] max-w-[200px] truncate">
                      {inv.customerName}
                    </td>
                    <td className="py-3.5 px-4 text-[#69788B] text-xs">{formatDate(inv.issueDate)}</td>
                    <td className="py-3.5 px-4 text-[#69788B] text-xs">{formatDate(inv.dueDate)}</td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-[#182539]">
                      {formatMoney(inv.totalCents, inv.currency)}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-semibold">
                      {inv.status === 'cancelled' ? (
                        <span className="text-[#69788B]">Cancelled</span>
                      ) : inv.balanceDueCents > 0 ? (
                        <span className={inv.status === 'overdue' ? 'text-[#BF5963]' : 'text-[#C38754]'}>
                          {formatMoney(inv.balanceDueCents, inv.currency)}
                        </span>
                      ) : (
                        <span className="text-[#1F806F]">Settled</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td
                      className="py-3.5 px-4 text-right shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onViewInvoice(inv.id)}
                          className="p-1 text-[#69788B] hover:text-[#182539] hover:bg-[#E2E8F0]/60 rounded transition-colors"
                          title="View Invoice"
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
