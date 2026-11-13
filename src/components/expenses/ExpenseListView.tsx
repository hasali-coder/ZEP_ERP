import React, { useState, useMemo } from 'react';
import { useFinancial } from '../../context/FinancialContext';
import { Expense, SupplierBill } from '../../types';
import { StatusBadge } from '../common/Badge';
import { formatMoney } from '../../utils/money';
import { formatDate } from '../../utils/dates';
import { exportToCSV } from '../../utils/export';
import {
  Search,
  Plus,
  Download,
  CreditCard,
  Trash2,
  Edit,
} from 'lucide-react';

interface ExpenseListViewProps {
  onOpenCreateExpense: () => void;
  onOpenCreateBill: () => void;
  onRecordBillPayment: (billId: string) => void;
  onEditExpense: (expense: Expense) => void;
}

export const ExpenseListView: React.FC<ExpenseListViewProps> = ({
  onOpenCreateExpense,
  onOpenCreateBill,
  onRecordBillPayment,
  onEditExpense,
}) => {
  const { expenses, bills, activeBusiness, deleteExpense, deleteBill } = useFinancial();
  const [activeTab, setActiveTab] = useState<'expenses' | 'bills'>('expenses');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = e.description.toLowerCase().includes(q);
        const matchSupplier = e.supplierName?.toLowerCase().includes(q) || false;
        const matchRef = e.referenceNumber?.toLowerCase().includes(q) || false;
        if (!matchDesc && !matchSupplier && !matchRef) return false;
      }
      return true;
    });
  }, [expenses, categoryFilter, searchQuery]);

  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      if (categoryFilter !== 'all' && b.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = b.billNumber.toLowerCase().includes(q);
        const matchSupplier = b.supplierName.toLowerCase().includes(q);
        const matchDesc = b.description.toLowerCase().includes(q);
        if (!matchNum && !matchSupplier && !matchDesc) return false;
      }
      return true;
    });
  }, [bills, categoryFilter, searchQuery]);

  const totalDirectExpensesCents = filteredExpenses.reduce((sum, e) => sum + e.amountCents, 0);
  const totalUnpaidBillsCents = filteredBills
    .filter((b) => b.status !== 'paid')
    .reduce((sum, b) => sum + b.balanceDueCents, 0);

  const handleExportCSV = () => {
    if (activeTab === 'expenses') {
      const headers = ['Date', 'Description', 'Category', 'Vendor / Supplier', 'Method', 'Reference', 'Amount', 'Currency'];
      const rows = filteredExpenses.map((e) => [
        e.date,
        e.description,
        e.category,
        e.supplierName || '—',
        e.paymentMethod,
        e.referenceNumber || '—',
        e.amountCents / 100,
        e.currency,
      ]);
      exportToCSV(`Direct_Expenses_${activeBusiness.name.replace(/\s+/g, '_')}`, headers, rows);
    } else {
      const headers = ['Bill Number', 'Supplier', 'Issue Date', 'Due Date', 'Category', 'Total Amount', 'Amount Paid', 'Balance Due', 'Status'];
      const rows = filteredBills.map((b) => [
        b.billNumber,
        b.supplierName,
        b.issueDate,
        b.dueDate,
        b.category,
        b.amountCents / 100,
        b.amountPaidCents / 100,
        b.balanceDueCents / 100,
        b.status,
      ]);
      exportToCSV(`Supplier_Bills_${activeBusiness.name.replace(/\s+/g, '_')}`, headers, rows);
    }
  };

  const categories = [
    'all',
    'Rent & Utilities',
    'Salaries & Wages',
    'Cloud & Software',
    'Marketing & Ads',
    'Office Supplies',
    'Travel & Transport',
    'Professional Services',
    'Equipment & Hardware',
  ];

  return (
    <div className="space-y-4">
      {/* Top summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="mz-panel bg-white p-5 border border-[#E2E8F0]">
          <span className="text-xs font-medium uppercase tracking-wider text-[#69788B]">
            Direct Cash Expenses
          </span>
          <div className="text-[26px] font-semibold tabular-nums text-[#182539] mt-1.5 leading-tight">
            {formatMoney(totalDirectExpensesCents, activeBusiness.currency)}
          </div>
          <span className="text-xs text-[#69788B] mt-1 block">
            {filteredExpenses.length} expense record{filteredExpenses.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="mz-panel bg-white p-5 border border-[#E2E8F0]">
          <span className="text-xs font-medium uppercase tracking-wider text-[#69788B]">
            Unpaid Supplier Bills (Accounts Payable)
          </span>
          <div className="text-[26px] font-semibold tabular-nums text-[#C38754] mt-1.5 leading-tight">
            {formatMoney(totalUnpaidBillsCents, activeBusiness.currency)}
          </div>
          <span className="text-xs text-[#69788B] mt-1 block">
            {filteredBills.filter((b) => b.balanceDueCents > 0).length} outstanding payable{filteredBills.filter((b) => b.balanceDueCents > 0).length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Tabs & Controls */}
      <div className="mz-toolbar flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#E2E8F0]">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Main Segmented Toggle: Direct Expenses vs Supplier Bills */}
          <div className="flex items-center gap-1 bg-[#F6F8FB] p-1 rounded-md border border-[#E2E8F0]">
            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                activeTab === 'expenses'
                  ? 'bg-white text-[#244A73] shadow-xs font-semibold'
                  : 'text-[#69788B] hover:text-[#182539]'
              }`}
            >
              Direct Expenses ({expenses.length})
            </button>
            <button
              onClick={() => setActiveTab('bills')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                activeTab === 'bills'
                  ? 'bg-white text-[#244A73] shadow-xs font-semibold'
                  : 'text-[#69788B] hover:text-[#182539]'
              }`}
            >
              Supplier Bills ({bills.length})
            </button>
          </div>

          <div className="relative min-w-[180px] max-w-xs">
            <Search className="w-4 h-4 text-[#69788B] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search description, vendor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#F6F8FB] border border-[#E2E8F0] rounded text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#F6F8FB] border border-[#E2E8F0] rounded text-xs focus:outline-hidden"
          >
            <option value="all">All Categories</option>
            {categories.filter((c) => c !== 'all').map((c) => (
              <option key={c} value={c}>
                {c}
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

          {activeTab === 'expenses' ? (
            <button
              onClick={onOpenCreateExpense}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#244A73] hover:bg-[#1B3959] text-white font-medium rounded text-xs transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Expense</span>
            </button>
          ) : (
            <button
              onClick={onOpenCreateBill}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#244A73] hover:bg-[#1B3959] text-white font-medium rounded text-xs transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Bill</span>
            </button>
          )}
        </div>
      </div>

      {/* Content Table */}
      <div className="mz-panel bg-white border border-[#E2E8F0] overflow-hidden">
        {activeTab === 'expenses' ? (
          filteredExpenses.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#69788B]">
              <p className="font-semibold text-sm text-[#182539]">No expenses recorded</p>
              <p className="mt-1">Add operational expenses like software subscriptions, rent, or supplies.</p>
              <button
                onClick={onOpenCreateExpense}
                className="mt-3 px-4 py-2 bg-[#244A73] hover:bg-[#1B3959] text-white font-medium rounded text-xs transition-colors"
              >
                Add First Expense
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="mz-table w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F6F8FB] border-b border-[#E2E8F0] text-xs font-semibold text-[#69788B] uppercase tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Payee / Vendor</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-[#F6F8FB] transition-colors">
                      <td className="py-3.5 px-4 text-[#69788B] text-xs">{formatDate(exp.date)}</td>
                      <td className="py-3.5 px-4 font-medium text-[#182539] max-w-[240px] truncate">
                        {exp.description}
                      </td>
                      <td className="py-3.5 px-4 text-[#69788B] text-xs">{exp.category}</td>
                      <td className="py-3.5 px-4 text-[#182539]">{exp.supplierName || '—'}</td>
                      <td className="py-3.5 px-4 text-[#69788B] text-xs">
                        <span>{exp.paymentMethod}</span>
                        {exp.referenceNumber && (
                          <span className="block text-[11px] font-mono text-[#69788B]">
                            {exp.referenceNumber}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-[#182539]">
                        {formatMoney(exp.amountCents, exp.currency)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onEditExpense(exp)}
                            className="p-1 text-[#69788B] hover:text-[#182539] hover:bg-[#E2E8F0]/60 rounded transition-colors"
                            title="Edit Expense"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete expense "${exp.description}"?`)) {
                                deleteExpense(exp.id);
                              }
                            }}
                            className="p-1 text-[#69788B] hover:text-[#BF5963] hover:bg-[#FDF2F3] rounded transition-colors"
                            title="Delete Expense"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          filteredBills.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#69788B]">
              <p className="font-semibold text-sm text-[#182539]">No supplier bills recorded</p>
              <p className="mt-1">Record supplier invoices to track payables before paying them.</p>
              <button
                onClick={onOpenCreateBill}
                className="mt-3 px-4 py-2 bg-[#244A73] hover:bg-[#1B3959] text-white font-medium rounded text-xs transition-colors"
              >
                Record Supplier Bill
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="mz-table w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F6F8FB] border-b border-[#E2E8F0] text-xs font-semibold text-[#69788B] uppercase tracking-wider">
                    <th className="py-3 px-4">Bill #</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Issue Date</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-right">Balance Due</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredBills.map((bill) => (
                    <tr key={bill.id} className="hover:bg-[#F6F8FB] transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-xs text-[#244A73]">
                        {bill.billNumber}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-[#182539] max-w-[200px] truncate">
                        {bill.supplierName}
                      </td>
                      <td className="py-3.5 px-4 text-[#69788B] text-xs">{formatDate(bill.issueDate)}</td>
                      <td className="py-3.5 px-4 text-[#69788B] text-xs">{formatDate(bill.dueDate)}</td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-[#182539]">
                        {formatMoney(bill.amountCents, bill.currency)}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-semibold">
                        {bill.balanceDueCents > 0 ? (
                          <span className={bill.status === 'overdue' ? 'text-[#BF5963]' : 'text-[#C38754]'}>
                            {formatMoney(bill.balanceDueCents, bill.currency)}
                          </span>
                        ) : (
                          <span className="text-[#1F806F]">Settled</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <StatusBadge status={bill.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {bill.balanceDueCents > 0 && (
                            <button
                              onClick={() => onRecordBillPayment(bill.id)}
                              className="px-2.5 py-1 bg-[#244A73] hover:bg-[#1B3959] text-white font-medium rounded text-xs transition-colors flex items-center gap-1"
                              title="Record payment for this bill"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>Pay</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm(`Delete bill ${bill.billNumber}?`)) {
                                deleteBill(bill.id);
                              }
                            }}
                            className="p-1 text-[#69788B] hover:text-[#BF5963] hover:bg-[#FDF2F3] rounded transition-colors"
                            title="Delete Bill"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
};
