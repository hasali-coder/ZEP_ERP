import React, { useState, useMemo, useRef } from 'react';
import { useFinancial } from '../../context/FinancialContext';
import { storage } from '../../services/storage';
import { CustomerStatement } from '../../types';
import { formatMoney } from '../../utils/money';
import { formatDate, getDatePresets, getAgingBucket, getTodayDateString } from '../../utils/dates';
import { exportToCSV } from '../../utils/export';
import { StatusBadge } from '../common/Badge';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Calendar,
  TrendingUp,
  TrendingDown,
  Clock,
  Layers,
  FileText,
  UserCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export type ReportType =
  | 'income'
  | 'expenses'
  | 'cash_flow'
  | 'outstanding_invoices'
  | 'ar_aging'
  | 'ap_bills'
  | 'payment_history'
  | 'statement_of_account'
  | 'profit_summary';

interface ReportsViewProps {
  initialReportType?: ReportType;
  initialCustomerId?: string;
  onViewInvoice?: (invoiceId: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  initialReportType = 'income',
  initialCustomerId,
}) => {
  const { customers, invoices, expenses, bills, transactions, activeBusiness } = useFinancial();

  const [activeReport, setActiveReport] = useState<ReportType>(initialReportType);
  const reportTabsRef = useRef<HTMLDivElement>(null);

  const presets = getDatePresets();
  const [selectedPreset, setSelectedPreset] = useState<string>(presets[0].label);
  const [startDate, setStartDate] = useState<string>(presets[0].startDate);
  const [endDate, setEndDate] = useState<string>(presets[0].endDate);

  const [soaCustomerId, setSoaCustomerId] = useState<string>(
    initialCustomerId || customers[0]?.id || ''
  );

  const handlePresetChange = (label: string) => {
    setSelectedPreset(label);
    const p = presets.find((item) => item.label === label);
    if (p) {
      setStartDate(p.startDate);
      setEndDate(p.endDate);
    }
  };

  const statement: CustomerStatement | null = useMemo(() => {
    if (activeReport !== 'statement_of_account' || !soaCustomerId) return null;
    try {
      return storage.generateCustomerStatement(soaCustomerId, startDate, endDate);
    } catch {
      return null;
    }
  }, [activeReport, soaCustomerId, startDate, endDate]);

  const reportTabs = [
    { id: 'income', label: 'Income Report', icon: TrendingUp },
    { id: 'expenses', label: 'Expense Report', icon: TrendingDown },
    { id: 'cash_flow', label: 'Cash Flow', icon: Layers },
    { id: 'outstanding_invoices', label: 'Outstanding Invoices', icon: Clock },
    { id: 'ar_aging', label: 'AR Ageing', icon: Clock },
    { id: 'ap_bills', label: 'Accounts Payable', icon: FileText },
    { id: 'payment_history', label: 'Payment History', icon: UserCheck },
    { id: 'statement_of_account', label: 'Statement of Account (SOA)', icon: FileSpreadsheet },
    { id: 'profit_summary', label: 'Estimated Profit', icon: TrendingUp },
  ] as const;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const bizPrefix = activeBusiness.name.replace(/\s+/g, '_');
    if (activeReport === 'income') {
      const periodInvoices = invoices.filter((i) => i.issueDate >= startDate && i.issueDate <= endDate);
      const headers = ['Invoice #', 'Customer', 'Date', 'Amount Invoiced', 'Amount Paid', 'Balance Due', 'Status'];
      const rows = periodInvoices.map((i) => [
        i.invoiceNumber,
        i.customerName,
        i.issueDate,
        i.totalCents / 100,
        i.amountPaidCents / 100,
        i.balanceDueCents / 100,
        i.status,
      ]);
      exportToCSV(`Income_Report_${bizPrefix}_${startDate}_to_${endDate}`, headers, rows);
    } else if (activeReport === 'expenses') {
      const periodExpenses = expenses.filter((e) => e.date >= startDate && e.date <= endDate);
      const headers = ['Date', 'Description', 'Category', 'Payee / Vendor', 'Method', 'Amount'];
      const rows = periodExpenses.map((e) => [
        e.date,
        e.description,
        e.category,
        e.supplierName || '—',
        e.paymentMethod,
        e.amountCents / 100,
      ]);
      exportToCSV(`Expense_Report_${bizPrefix}_${startDate}_to_${endDate}`, headers, rows);
    } else if (activeReport === 'cash_flow') {
      const periodTx = transactions.filter((t) => t.date >= startDate && t.date <= endDate);
      const headers = ['Date', 'Type', 'Description', 'Contact', 'Method', 'Reference', 'Amount Inflow', 'Amount Outflow'];
      const rows = periodTx.map((t) => [
        t.date,
        t.type,
        t.description,
        t.contactName || '—',
        t.paymentMethod,
        t.referenceNumber || '—',
        t.type === 'payment_received' ? t.amountCents / 100 : 0,
        t.type === 'payment_made' ? t.amountCents / 100 : 0,
      ]);
      exportToCSV(`Cash_Flow_Report_${bizPrefix}_${startDate}_to_${endDate}`, headers, rows);
    } else if (activeReport === 'statement_of_account' && statement) {
      const headers = ['Date', 'Transaction Type', 'Reference', 'Description', 'Debit (Invoice)', 'Credit (Payment)', 'Running Balance'];
      const rows = statement.entries.map((e) => [
        e.date,
        e.type,
        e.reference,
        e.description,
        e.debitCents / 100,
        e.creditCents / 100,
        e.runningBalanceCents / 100,
      ]);
      exportToCSV(`Statement_of_Account_${statement.customer.name.replace(/\s+/g, '_')}_${startDate}_to_${endDate}`, headers, rows);
    }
  };

  return (
    <div className="space-y-6">
      {/* Report navigation: discreet arrows keep every report available without a heavy scrollbar. */}
      <div className="mz-panel bg-white p-1.5 border border-[#E2E8F0] flex items-center gap-1 no-print" aria-label="Financial report types">
        <button
          type="button"
          className="mz-report-arrow"
          aria-label="Scroll report types left"
          onClick={() => reportTabsRef.current?.scrollBy({ left: -300, behavior: 'smooth' })}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div ref={reportTabsRef} className="mz-report-tabs flex-1 min-w-0 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
          {reportTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeReport === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveReport(tab.id as ReportType)}
                aria-pressed={isActive}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-[#244A73] text-white shadow-xs font-semibold'
                    : 'text-[#69788B] hover:text-[#182539] hover:bg-[#F6F8FB]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-[#69788B]'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
          </div>
        </div>
        <button
          type="button"
          className="mz-report-arrow"
          aria-label="Scroll report types right"
          onClick={() => reportTabsRef.current?.scrollBy({ left: 300, behavior: 'smooth' })}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Filter & Export Controls Bar (no-print) */}
      <div className="mz-toolbar bg-white border border-[#E2E8F0] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs no-print">
        <div className="flex flex-wrap items-center gap-3">
          {/* Preset selector */}
          <div className="flex items-center gap-1 bg-[#F6F8FB] p-1 rounded-md border border-[#E2E8F0]">
            <Calendar className="w-3.5 h-3.5 text-[#69788B] ml-1" />
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => handlePresetChange(p.label)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  selectedPreset === p.label
                    ? 'bg-white text-[#244A73] shadow-xs font-semibold'
                    : 'text-[#69788B] hover:text-[#182539]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date range inputs */}
          <div className="flex items-center gap-1.5">
            <span className="text-[#69788B]">From</span>
            <input
              type="date"
              aria-label="Report start date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setSelectedPreset('Custom');
              }}
              className="px-2.5 py-1 bg-white border border-[#E2E8F0] rounded text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
            />
            <span className="text-[#69788B]">To</span>
            <input
              type="date"
              aria-label="Report end date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setSelectedPreset('Custom');
              }}
              className="px-2.5 py-1 bg-white border border-[#E2E8F0] rounded text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
            />
          </div>

          {/* Customer select for Statement of Account */}
          {activeReport === 'statement_of_account' && (
            <div className="flex items-center gap-1.5 pl-2 border-l border-[#E2E8F0]">
              <span className="font-medium text-[#182539]">Customer:</span>
              <select
                aria-label="Customer for statement of account"
                value={soaCustomerId}
                onChange={(e) => setSoaCustomerId(e.target.value)}
                className="px-2.5 py-1 bg-white border border-[#E2E8F0] rounded text-xs focus:outline-hidden focus:ring-1 focus:ring-[#244A73]"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName ? `${c.companyName} (${c.name})` : c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E2E8F0] hover:bg-[#F6F8FB] text-[#182539] font-medium rounded transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#69788B]" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#244A73] hover:bg-[#1B3959] text-white font-medium rounded transition-colors shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-white" />
            <span>Print / PDF Document</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. INCOME REPORT */}
      {/* ========================================================= */}
      {activeReport === 'income' && (() => {
        const periodInvoices = invoices.filter(
          (i) => i.issueDate >= startDate && i.issueDate <= endDate && i.status !== 'cancelled'
        );
        const totalInvoicedCents = periodInvoices.reduce((sum, i) => sum + i.totalCents, 0);
        const totalCollectedOnPeriodInvoices = periodInvoices.reduce((sum, i) => sum + i.amountPaidCents, 0);
        const totalOutstandingOnPeriodInvoices = periodInvoices.reduce((sum, i) => sum + i.balanceDueCents, 0);

        return (
          <div className="bg-white p-6 sm:p-8 rounded-lg border border-[#E2E8F0] shadow-xs print-page space-y-6">
            <div className="border-b border-[#E2E8F0] pb-4 flex flex-col sm:flex-row justify-between items-start gap-2">
              <div>
                <h2 className="text-xl font-semibold text-[#182539]">Income Statement (Revenue & Billing)</h2>
                <p className="text-xs text-[#69788B] mt-0.5">
                  Period: {formatDate(startDate)} to {formatDate(endDate)} · {activeBusiness.name}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-xs uppercase font-medium tracking-wider text-[#69788B]">Total Invoiced</span>
                <div className="text-2xl font-semibold tabular-nums text-[#0D1B33]">
                  {formatMoney(totalInvoicedCents, activeBusiness.currency)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-[#F2F6FC] rounded-lg border border-[#DCE7F4]">
                <span className="text-xs uppercase font-medium text-[#69788B]">Total Invoiced</span>
                <div className="text-xl font-semibold tabular-nums text-[#182539] mt-1">
                  {formatMoney(totalInvoicedCents, activeBusiness.currency)}
                </div>
              </div>
              <div className="p-4 bg-[#EDF8F6] rounded-lg border border-[#D6EDE8]">
                <span className="text-xs uppercase font-medium text-[#69788B]">Cash Collected to Date</span>
                <div className="text-xl font-semibold tabular-nums text-[#1F806F] mt-1">
                  {formatMoney(totalCollectedOnPeriodInvoices, activeBusiness.currency)}
                </div>
              </div>
              <div className="p-4 bg-[#FCF6F1] rounded-lg border border-[#F0E0D3]">
                <span className="text-xs uppercase font-medium text-[#69788B]">Remaining Outstanding</span>
                <div className="text-xl font-semibold tabular-nums text-[#C38754] mt-1">
                  {formatMoney(totalOutstandingOnPeriodInvoices, activeBusiness.currency)}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-[#F6F8FB] border-b border-[#E2E8F0] text-xs font-semibold text-[#69788B] uppercase tracking-wider">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Invoice #</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3 text-right">Invoiced Amount</th>
                    <th className="py-3 px-3 text-right">Paid</th>
                    <th className="py-3 px-3 text-right">Balance Due</th>
                    <th className="py-3 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {periodInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#F6F8FB]">
                      <td className="py-3 px-3 text-[#69788B] text-xs">{formatDate(inv.issueDate)}</td>
                      <td className="py-3 px-3 font-mono font-medium text-xs text-[#244A73]">{inv.invoiceNumber}</td>
                      <td className="py-3 px-3 font-medium text-[#182539]">{inv.customerName}</td>
                      <td className="py-3 px-3 text-right tabular-nums font-semibold text-[#182539]">
                        {formatMoney(inv.totalCents, inv.currency)}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-[#1F806F] font-medium">
                        {formatMoney(inv.amountPaidCents, inv.currency)}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums font-semibold text-[#C38754]">
                        {formatMoney(inv.balanceDueCents, inv.currency)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <StatusBadge status={inv.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ========================================================= */}
      {/* 2. EXPENSE REPORT */}
      {/* ========================================================= */}
      {activeReport === 'expenses' && (() => {
        const periodExpenses = expenses.filter((e) => e.date >= startDate && e.date <= endDate);
        const totalExpensesCents = periodExpenses.reduce((sum, e) => sum + e.amountCents, 0);

        const byCategory = periodExpenses.reduce<Record<string, number>>((acc, e) => {
          acc[e.category] = (acc[e.category] || 0) + e.amountCents;
          return acc;
        }, {});

        return (
          <div className="bg-white p-6 sm:p-8 rounded-lg border border-[#E2E8F0] shadow-xs print-page space-y-6">
            <div className="border-b border-[#E2E8F0] pb-4 flex flex-col sm:flex-row justify-between items-start gap-2">
              <div>
                <h2 className="text-xl font-semibold text-[#182539]">Operating Expense Report</h2>
                <p className="text-xs text-[#69788B] mt-0.5">
                  Period: {formatDate(startDate)} to {formatDate(endDate)} · {activeBusiness.name}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-xs uppercase font-medium tracking-wider text-[#69788B]">Total Expenditures</span>
                <div className="text-2xl font-semibold tabular-nums text-[#BF5963]">
                  {formatMoney(totalExpensesCents, activeBusiness.currency)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(byCategory).map(([cat, cents]) => (
                <div key={cat} className="p-3.5 bg-[#F6F8FB] rounded-lg border border-[#E2E8F0]">
                  <span className="text-xs font-medium text-[#69788B] block truncate">{cat}</span>
                  <div className="text-base font-semibold tabular-nums text-[#182539] mt-1">
                    {formatMoney(cents, activeBusiness.currency)}
                  </div>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-[#F6F8FB] border-b border-[#E2E8F0] text-xs font-semibold text-[#69788B] uppercase tracking-wider">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Description</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Vendor / Payee</th>
                    <th className="py-3 px-3">Method</th>
                    <th className="py-3 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {periodExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-[#F6F8FB]">
                      <td className="py-3 px-3 text-[#69788B] text-xs">{formatDate(exp.date)}</td>
                      <td className="py-3 px-3 font-medium text-[#182539]">{exp.description}</td>
                      <td className="py-3 px-3 text-[#69788B] text-xs">{exp.category}</td>
                      <td className="py-3 px-3 text-[#182539]">{exp.supplierName || '—'}</td>
                      <td className="py-3 px-3 text-[#69788B] text-xs">{exp.paymentMethod}</td>
                      <td className="py-3 px-3 text-right tabular-nums font-semibold text-[#182539]">
                        {formatMoney(exp.amountCents, exp.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ========================================================= */}
      {/* 3. CASH FLOW REPORT */}
      {/* ========================================================= */}
      {activeReport === 'cash_flow' && (() => {
        const periodTx = transactions.filter((t) => t.date >= startDate && t.date <= endDate);
        const cashInflowCents = periodTx
          .filter((t) => t.type === 'payment_received')
          .reduce((sum, t) => sum + t.amountCents, 0);
        const cashOutflowCents = periodTx
          .filter((t) => t.type === 'payment_made')
          .reduce((sum, t) => sum + t.amountCents, 0);
        const netCashFlowCents = cashInflowCents - cashOutflowCents;

        return (
          <div className="bg-white p-6 sm:p-8 rounded-lg border border-[#E2E8F0] shadow-xs print-page space-y-6">
            <div className="border-b border-[#E2E8F0] pb-4 flex flex-col sm:flex-row justify-between items-start gap-2">
              <div>
                <h2 className="text-xl font-semibold text-[#182539]">Statement of Cash Flows</h2>
                <p className="text-xs text-[#69788B] mt-0.5">
                  Actual verified cash inflows and outflows · {formatDate(startDate)} to {formatDate(endDate)}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-xs uppercase font-medium tracking-wider text-[#69788B]">Net Cash Movement</span>
                <div
                  className={`text-2xl font-semibold tabular-nums ${
                    netCashFlowCents >= 0 ? 'text-[#1F806F]' : 'text-[#BF5963]'
                  }`}
                >
                  {formatMoney(netCashFlowCents, activeBusiness.currency)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-[#F6F8FB] rounded-lg border border-[#E2E8F0]">
                <span className="text-xs uppercase font-medium text-[#1F806F]">Total Cash Inflows</span>
                <div className="text-xl font-semibold tabular-nums text-[#1F806F] mt-1">
                  +{formatMoney(cashInflowCents, activeBusiness.currency)}
                </div>
                <span className="text-xs text-[#69788B] mt-1 block">Customer payments received</span>
              </div>

              <div className="p-4 bg-[#F6F8FB] rounded-lg border border-[#E2E8F0]">
                <span className="text-xs uppercase font-medium text-[#69788B]">Total Cash Outflows</span>
                <div className="text-xl font-semibold tabular-nums text-[#69788B] mt-1">
                  -{formatMoney(cashOutflowCents, activeBusiness.currency)}
                </div>
                <span className="text-xs text-[#69788B] mt-1 block">Expenses & bills settled</span>
              </div>

              <div className="p-4 bg-[#F6F8FB] rounded-lg border border-[#E2E8F0]">
                <span className="text-xs uppercase font-medium text-[#182539]">Net Cash Movement</span>
                <div
                  className={`text-xl font-semibold tabular-nums mt-1 ${
                    netCashFlowCents >= 0 ? 'text-[#1F806F]' : 'text-[#BF5963]'
                  }`}
                >
                  {formatMoney(netCashFlowCents, activeBusiness.currency)}
                </div>
                <span className="text-xs text-[#69788B] mt-1 block">Net operational liquidity</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-[#F6F8FB] border-b border-[#E2E8F0] text-xs font-semibold text-[#69788B] uppercase tracking-wider">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Description</th>
                    <th className="py-3 px-3">Contact</th>
                    <th className="py-3 px-3">Method</th>
                    <th className="py-3 px-3 text-right">Inflow</th>
                    <th className="py-3 px-3 text-right">Outflow</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {periodTx.map((tx) => {
                    const isInflow = tx.type === 'payment_received';
                    return (
                      <tr key={tx.id} className="hover:bg-[#F6F8FB]">
                        <td className="py-3 px-3 text-[#69788B] text-xs">{formatDate(tx.date)}</td>
                        <td className="py-3 px-3 font-medium text-xs">{isInflow ? 'Inflow' : 'Outflow'}</td>
                        <td className="py-3 px-3 text-[#182539]">{tx.description}</td>
                        <td className="py-3 px-3 text-[#69788B]">{tx.contactName || '—'}</td>
                        <td className="py-3 px-3 text-[#69788B] text-xs">{tx.paymentMethod}</td>
                        <td className="py-3 px-3 text-right tabular-nums font-semibold text-[#1F806F]">
                          {isInflow ? formatMoney(tx.amountCents, tx.currency) : '—'}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums text-[#69788B]">
                          {!isInflow ? formatMoney(tx.amountCents, tx.currency) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ========================================================= */}
      {/* 4. OUTSTANDING INVOICES REPORT */}
      {/* ========================================================= */}
      {activeReport === 'outstanding_invoices' && (() => {
        const unpaid = invoices.filter((i) => i.balanceDueCents > 0 && i.status !== 'cancelled' && i.status !== 'draft');
        const totalOutstandingCents = unpaid.reduce((sum, i) => sum + i.balanceDueCents, 0);

        return (
          <div className="bg-white p-6 sm:p-8 rounded-lg border border-[#E2E8F0] shadow-xs print-page space-y-6">
            <div className="border-b border-[#E2E8F0] pb-4 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-semibold text-[#182539]">Outstanding Invoices Report</h2>
                <p className="text-xs text-[#69788B] mt-0.5">All customer invoices awaiting full settlement</p>
              </div>
              <div className="text-right">
                <span className="text-xs uppercase font-medium tracking-wider text-[#69788B]">Total Due</span>
                <div className="text-2xl font-semibold tabular-nums text-[#C38754]">
                  {formatMoney(totalOutstandingCents, activeBusiness.currency)}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-[#F6F8FB] border-b border-[#E2E8F0] text-xs font-semibold text-[#69788B] uppercase tracking-wider">
                    <th className="py-3 px-3">Invoice #</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Issue Date</th>
                    <th className="py-3 px-3">Due Date</th>
                    <th className="py-3 px-3 text-right">Invoice Total</th>
                    <th className="py-3 px-3 text-right">Amount Paid</th>
                    <th className="py-3 px-3 text-right">Balance Due</th>
                    <th className="py-3 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {unpaid.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#F6F8FB]">
                      <td className="py-3 px-3 font-mono font-medium text-xs text-[#244A73]">{inv.invoiceNumber}</td>
                      <td className="py-3 px-3 font-medium text-[#182539]">{inv.customerName}</td>
                      <td className="py-3 px-3 text-[#69788B] text-xs">{formatDate(inv.issueDate)}</td>
                      <td className="py-3 px-3 text-[#69788B] text-xs">{formatDate(inv.dueDate)}</td>
                      <td className="py-3 px-3 text-right tabular-nums text-[#69788B]">
                        {formatMoney(inv.totalCents, inv.currency)}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-[#1F806F] font-medium">
                        {formatMoney(inv.amountPaidCents, inv.currency)}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums font-semibold text-[#C38754]">
                        {formatMoney(inv.balanceDueCents, inv.currency)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <StatusBadge status={inv.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ========================================================= */}
      {/* 5. AR AGEING REPORT (RECEIVABLES) */}
      {/* ========================================================= */}
      {activeReport === 'ar_aging' && (() => {
        const unpaid = invoices.filter((i) => i.balanceDueCents > 0 && i.status !== 'cancelled' && i.status !== 'draft');

        const buckets = {
          current: 0,
          '1-30': 0,
          '31-60': 0,
          '61-90': 0,
          '90+': 0,
        };

        unpaid.forEach((inv) => {
          const b = getAgingBucket(inv.dueDate);
          buckets[b] += inv.balanceDueCents;
        });

        const totalAging = Object.values(buckets).reduce((sum, v) => sum + v, 0);

        return (
          <div className="bg-white p-6 sm:p-8 rounded-lg border border-[#E2E8F0] shadow-xs print-page space-y-6">
            <div className="border-b border-[#E2E8F0] pb-4 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-semibold text-[#182539]">Accounts Receivable Ageing Summary</h2>
                <p className="text-xs text-[#69788B] mt-0.5">Outstanding invoice balances grouped by overdue aging days</p>
              </div>
              <div className="text-right">
                <span className="text-xs uppercase font-medium tracking-wider text-[#69788B]">Total Receivables</span>
                <div className="text-2xl font-semibold tabular-nums text-[#0D1B33]">
                  {formatMoney(totalAging, activeBusiness.currency)}
                </div>
              </div>
            </div>

            {/* Aging summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3.5 bg-[#F6F8FB] rounded-lg border border-[#E2E8F0]">
                <span className="text-xs uppercase font-medium text-[#1F806F]">Current (Not Due)</span>
                <div className="text-base font-semibold tabular-nums text-[#182539] mt-1">
                  {formatMoney(buckets.current, activeBusiness.currency)}
                </div>
              </div>

              <div className="p-3.5 bg-[#F6F8FB] rounded-lg border border-[#E2E8F0]">
                <span className="text-xs uppercase font-medium text-[#C38754]">1 – 30 Days Overdue</span>
                <div className="text-base font-semibold tabular-nums text-[#182539] mt-1">
                  {formatMoney(buckets['1-30'], activeBusiness.currency)}
                </div>
              </div>

              <div className="p-3.5 bg-[#F6F8FB] rounded-lg border border-[#E2E8F0]">
                <span className="text-xs uppercase font-medium text-[#C38754]">31 – 60 Days Overdue</span>
                <div className="text-base font-semibold tabular-nums text-[#182539] mt-1">
                  {formatMoney(buckets['31-60'], activeBusiness.currency)}
                </div>
              </div>

              <div className="p-3.5 bg-[#F6F8FB] rounded-lg border border-[#E2E8F0]">
                <span className="text-xs uppercase font-medium text-[#BF5963]">61 – 90 Days Overdue</span>
                <div className="text-base font-semibold tabular-nums text-[#182539] mt-1">
                  {formatMoney(buckets['61-90'], activeBusiness.currency)}
                </div>
              </div>

              <div className="p-3.5 bg-[#F6F8FB] rounded-lg border border-[#E2E8F0]">
                <span className="text-xs uppercase font-medium text-[#BF5963]">90+ Days Overdue</span>
                <div className="text-base font-semibold tabular-nums text-[#182539] mt-1">
                  {formatMoney(buckets['90+'], activeBusiness.currency)}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-[#F6F8FB] border-b border-[#E2E8F0] text-xs font-semibold text-[#69788B] uppercase tracking-wider">
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Invoice #</th>
                    <th className="py-3 px-3">Due Date</th>
                    <th className="py-3 px-3">Aging Category</th>
                    <th className="py-3 px-3 text-right">Outstanding Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {unpaid.map((inv) => {
                    const bucket = getAgingBucket(inv.dueDate);
                    return (
                      <tr key={inv.id} className="hover:bg-[#F6F8FB]">
                        <td className="py-3 px-3 font-medium text-[#182539]">{inv.customerName}</td>
                        <td className="py-3 px-3 font-mono font-medium text-xs text-[#244A73]">{inv.invoiceNumber}</td>
                        <td className="py-3 px-3 text-[#69788B] text-xs">{formatDate(inv.dueDate)}</td>
                        <td className="py-3 px-3 capitalize text-[#69788B] text-xs">{bucket}</td>
                        <td className="py-3 px-3 text-right tabular-nums font-semibold text-[#182539]">
                          {formatMoney(inv.balanceDueCents, inv.currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ========================================================= */}
      {/* 6. ACCOUNTS PAYABLE (BILLS) */}
      {/* ========================================================= */}
      {activeReport === 'ap_bills' && (() => {
        const unpaidBills = bills.filter((b) => b.balanceDueCents > 0);
        const totalApCents = unpaidBills.reduce((sum, b) => sum + b.balanceDueCents, 0);

        return (
          <div className="bg-white p-6 sm:p-8 rounded-lg border border-[#E2E8F0] shadow-xs print-page space-y-6">
            <div className="border-b border-[#E2E8F0] pb-4 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-semibold text-[#182539]">Accounts Payable Report</h2>
                <p className="text-xs text-[#69788B] mt-0.5">Unsettled supplier bills and upcoming vendor obligations</p>
              </div>
              <div className="text-right">
                <span className="text-xs uppercase font-medium tracking-wider text-[#69788B]">Total Payable</span>
                <div className="text-2xl font-semibold tabular-nums text-[#C38754]">
                  {formatMoney(totalApCents, activeBusiness.currency)}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-[#F6F8FB] border-b border-[#E2E8F0] text-xs font-semibold text-[#69788B] uppercase tracking-wider">
                    <th className="py-3 px-3">Bill #</th>
                    <th className="py-3 px-3">Supplier</th>
                    <th className="py-3 px-3">Due Date</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3 text-right">Bill Total</th>
                    <th className="py-3 px-3 text-right">Paid</th>
                    <th className="py-3 px-3 text-right">Balance Due</th>
                    <th className="py-3 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {unpaidBills.map((b) => (
                    <tr key={b.id} className="hover:bg-[#F6F8FB]">
                      <td className="py-3 px-3 font-mono font-medium text-xs text-[#244A73]">{b.billNumber}</td>
                      <td className="py-3 px-3 font-medium text-[#182539]">{b.supplierName}</td>
                      <td className="py-3 px-3 text-[#69788B] text-xs">{formatDate(b.dueDate)}</td>
                      <td className="py-3 px-3 text-[#69788B] text-xs">{b.category}</td>
                      <td className="py-3 px-3 text-right tabular-nums text-[#69788B]">
                        {formatMoney(b.amountCents, b.currency)}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-[#1F806F] font-medium">
                        {formatMoney(b.amountPaidCents, b.currency)}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums font-semibold text-[#C38754]">
                        {formatMoney(b.balanceDueCents, b.currency)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <StatusBadge status={b.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ========================================================= */}
      {/* 7. CUSTOMER PAYMENT HISTORY */}
      {/* ========================================================= */}
      {activeReport === 'payment_history' && (() => {
        const receivedTx = transactions.filter((t) => t.type === 'payment_received');
        const totalReceived = receivedTx.reduce((sum, t) => sum + t.amountCents, 0);

        return (
          <div className="bg-white p-6 sm:p-8 rounded-lg border border-[#E2E8F0] shadow-xs print-page space-y-6">
            <div className="border-b border-[#E2E8F0] pb-4 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-semibold text-[#182539]">Customer Payment History</h2>
                <p className="text-xs text-[#69788B] mt-0.5">Chronological record of all customer settlements received</p>
              </div>
              <div className="text-right">
                <span className="text-xs uppercase font-medium tracking-wider text-[#69788B]">Total Collected</span>
                <div className="text-2xl font-semibold tabular-nums text-[#1F806F]">
                  +{formatMoney(totalReceived, activeBusiness.currency)}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-[#F6F8FB] border-b border-[#E2E8F0] text-xs font-semibold text-[#69788B] uppercase tracking-wider">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Description</th>
                    <th className="py-3 px-3">Payment Method</th>
                    <th className="py-3 px-3">Reference #</th>
                    <th className="py-3 px-3 text-right">Amount Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {receivedTx.map((tx) => (
                    <tr key={tx.id} className="hover:bg-[#F6F8FB]">
                      <td className="py-3 px-3 text-[#69788B] text-xs">{formatDate(tx.date)}</td>
                      <td className="py-3 px-3 font-medium text-[#182539]">{tx.contactName || '—'}</td>
                      <td className="py-3 px-3 text-[#182539]">{tx.description}</td>
                      <td className="py-3 px-3 text-[#69788B] text-xs">{tx.paymentMethod}</td>
                      <td className="py-3 px-3 font-mono text-xs text-[#69788B]">{tx.referenceNumber || '—'}</td>
                      <td className="py-3 px-3 text-right tabular-nums font-semibold text-[#1F806F]">
                        +{formatMoney(tx.amountCents, tx.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ========================================================= */}
      {/* 8. CUSTOMER STATEMENT OF ACCOUNT (SOA) */}
      {/* ========================================================= */}
      {activeReport === 'statement_of_account' && (
        <div className="bg-white p-6 sm:p-8 rounded-lg border border-[#E2E8F0] shadow-xs print-page space-y-6 text-sm">
          {!statement ? (
            <div className="p-12 text-center text-xs text-[#69788B]">
              Select a customer from the dropdown above to generate their Statement of Account.
            </div>
          ) : (
            <>
              {/* SOA Document Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start pb-8 border-b border-[#E2E8F0] gap-4">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded bg-[#0D1B33] flex items-center justify-center text-white font-bold text-sm">
                      {statement.business.name.charAt(0)}
                    </div>
                    <h2 className="text-xl font-semibold text-[#182539] tracking-tight">
                      {statement.business.name}
                    </h2>
                  </div>
                  <p className="text-xs text-[#69788B]">{statement.business.address}</p>
                  <p className="text-xs text-[#69788B]">
                    {statement.business.city}, {statement.business.country}
                  </p>
                  {statement.business.email && (
                    <p className="text-xs text-[#69788B]">Email: {statement.business.email}</p>
                  )}
                  {statement.business.taxNumber && (
                    <p className="text-xs text-[#69788B] font-mono mt-0.5">
                      Tax PIN: {statement.business.taxNumber}
                    </p>
                  )}
                </div>

                <div className="text-left sm:text-right">
                  <h1 className="text-2xl font-bold tracking-tight text-[#0D1B33] uppercase">
                    STATEMENT OF ACCOUNT
                  </h1>
                  <div className="mt-2 space-y-1 text-xs">
                    <div>
                      <span className="text-[#69788B]">Statement Period: </span>
                      <span className="font-semibold text-[#182539]">
                        {formatDate(statement.startDate)} to {formatDate(statement.endDate)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#69788B]">Generated On: </span>
                      <span className="text-[#182539]">{formatDate(getTodayDateString())}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer Account Details */}
              <div className="py-4 border-b border-[#E2E8F0] grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-[#69788B] block mb-1">
                    Account Customer
                  </span>
                  <h3 className="font-semibold text-base text-[#182539]">
                    {statement.customer.companyName || statement.customer.name}
                  </h3>
                  {statement.customer.companyName && (
                    <p className="text-xs text-[#69788B]">Attn: {statement.customer.name}</p>
                  )}
                  {statement.customer.address && (
                    <p className="text-xs text-[#69788B]">{statement.customer.address}</p>
                  )}
                  {statement.customer.email && (
                    <p className="text-xs text-[#69788B]">{statement.customer.email}</p>
                  )}
                  {statement.customer.taxNumber && (
                    <p className="text-xs text-[#69788B] font-mono">Tax PIN: {statement.customer.taxNumber}</p>
                  )}
                </div>

                <div className="bg-[#F6F8FB] p-4 rounded-lg border border-[#E2E8F0] flex flex-col justify-between text-xs">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[#69788B]">
                      <span>Opening Balance:</span>
                      <span className="tabular-nums font-semibold text-[#182539]">
                        {formatMoney(statement.openingBalanceCents, statement.business.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[#69788B]">
                      <span>Invoiced During Period:</span>
                      <span className="tabular-nums font-semibold text-[#182539]">
                        +{formatMoney(statement.totalDebitsCents, statement.business.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[#1F806F]">
                      <span>Payments Received:</span>
                      <span className="tabular-nums font-semibold">
                        -{formatMoney(statement.totalCreditsCents, statement.business.currency)}
                      </span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-[#E2E8F0] flex justify-between font-semibold text-sm">
                    <span className="text-[#182539]">Closing Account Balance:</span>
                    <span className="tabular-nums text-[#0D1B33]">
                      {formatMoney(statement.closingBalanceCents, statement.business.currency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detailed Running Ledger Table */}
              <div className="py-4">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-xs font-semibold text-[#69788B] uppercase tracking-wider">
                      <th className="py-2.5">Date</th>
                      <th className="py-2.5">Ref #</th>
                      <th className="py-2.5">Activity Description</th>
                      <th className="py-2.5 text-right">Debit (Inv)</th>
                      <th className="py-2.5 text-right">Credit (Pmt)</th>
                      <th className="py-2.5 text-right">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {/* Opening Balance Row */}
                    <tr className="bg-[#F6F8FB]/70 font-medium">
                      <td className="py-2.5 text-[#69788B] text-xs">{formatDate(statement.startDate)}</td>
                      <td className="py-2.5 font-mono text-xs text-[#69788B]">—</td>
                      <td className="py-2.5 text-[#182539] italic">Opening Balance Carried Forward</td>
                      <td className="py-2.5 text-right text-[#69788B]">—</td>
                      <td className="py-2.5 text-right text-[#69788B]">—</td>
                      <td className="py-2.5 text-right tabular-nums font-semibold text-[#182539]">
                        {formatMoney(statement.openingBalanceCents, statement.business.currency)}
                      </td>
                    </tr>

                    {statement.entries.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-xs text-[#69788B]">
                          No invoices or payments recorded for this customer during the selected period.
                        </td>
                      </tr>
                    ) : (
                      statement.entries.map((item, idx) => (
                        <tr key={idx} className="hover:bg-[#F6F8FB]">
                          <td className="py-3 text-[#69788B] text-xs">{formatDate(item.date)}</td>
                          <td className="py-3 font-mono font-medium text-xs text-[#244A73]">{item.reference}</td>
                          <td className="py-3 font-medium text-[#182539]">{item.description}</td>
                          <td className="py-3 text-right tabular-nums text-[#182539]">
                            {item.debitCents > 0
                              ? formatMoney(item.debitCents, statement.business.currency, false)
                              : '—'}
                          </td>
                          <td className="py-3 text-right tabular-nums text-[#1F806F] font-medium">
                            {item.creditCents > 0
                              ? formatMoney(item.creditCents, statement.business.currency, false)
                              : '—'}
                          </td>
                          <td className="py-3 text-right tabular-nums font-semibold text-[#0D1B33]">
                            {formatMoney(item.runningBalanceCents, statement.business.currency)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Closing Reconciled Balance */}
              <div className="pt-4 border-t-2 border-[#0D1B33] flex justify-between items-baseline font-semibold text-base">
                <span className="text-[#182539]">Total Amount Payable as of {formatDate(statement.endDate)}:</span>
                <span className="tabular-nums text-xl text-[#0D1B33]">
                  {formatMoney(statement.closingBalanceCents, statement.business.currency)}
                </span>
              </div>

              {/* Remittance Advice */}
              <div className="mt-8 pt-6 border-t border-[#E2E8F0] text-xs text-[#69788B] leading-relaxed">
                <h4 className="font-semibold uppercase tracking-wider text-[#69788B] text-xs mb-1">
                  Remittance Advice
                </h4>
                <p>
                  Please remit all payments directly to the payment account instructions stated on our invoices.
                  Quote your account name when initiating bank transfers or M-Pesa settlements.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 9. ESTIMATED PROFIT SUMMARY */}
      {/* ========================================================= */}
      {activeReport === 'profit_summary' && (() => {
        const periodInvoices = invoices.filter(
          (i) => i.issueDate >= startDate && i.issueDate <= endDate && i.status !== 'cancelled'
        );
        const revenueCents = periodInvoices.reduce((sum, i) => sum + i.totalCents, 0);

        const periodExpenses = expenses.filter((e) => e.date >= startDate && e.date <= endDate);
        const directExpensesCents = periodExpenses.reduce((sum, e) => sum + e.amountCents, 0);

        const estimatedProfitCents = revenueCents - directExpensesCents;
        const profitMargin = revenueCents > 0 ? ((estimatedProfitCents / revenueCents) * 100).toFixed(1) : '0';

        return (
          <div className="bg-white p-6 sm:p-8 rounded-lg border border-[#E2E8F0] shadow-xs print-page space-y-6">
            <div className="border-b border-[#E2E8F0] pb-4 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-semibold text-[#182539]">Estimated Profit Summary</h2>
                <p className="text-xs text-[#69788B] mt-0.5">
                  Operating revenue (accrued invoices) minus recorded business expenses
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs uppercase font-medium tracking-wider text-[#69788B]">Estimated Net Profit</span>
                <div
                  className={`text-2xl font-semibold tabular-nums ${
                    estimatedProfitCents >= 0 ? 'text-[#1F806F]' : 'text-[#BF5963]'
                  }`}
                >
                  {formatMoney(estimatedProfitCents, activeBusiness.currency)}
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-[#FDF7F2] border border-[#F4DEC9] text-[#C38754] rounded-lg text-xs leading-relaxed font-medium">
              Accounting Note: This report provides an operational estimate based on recorded invoices and
              direct expenses. Statutory corporate tax filings and balance-sheet depreciation schedules should be
              reconciled with audited ledger statements.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-[#F6F8FB] rounded-lg border border-[#E2E8F0]">
                <span className="text-xs uppercase font-medium text-[#69788B]">Operating Revenue</span>
                <div className="text-xl font-semibold tabular-nums text-[#182539] mt-1">
                  {formatMoney(revenueCents, activeBusiness.currency)}
                </div>
              </div>

              <div className="p-4 bg-[#F6F8FB] rounded-lg border border-[#E2E8F0]">
                <span className="text-xs uppercase font-medium text-[#69788B]">Operating Expenses</span>
                <div className="text-xl font-semibold tabular-nums text-[#BF5963] mt-1">
                  {formatMoney(directExpensesCents, activeBusiness.currency)}
                </div>
              </div>

              <div className="p-4 bg-[#F6F8FB] rounded-lg border border-[#E2E8F0]">
                <span className="text-xs uppercase font-medium text-[#69788B]">Estimated Profit Margin</span>
                <div className="text-xl font-semibold tabular-nums text-[#0D1B33] mt-1">
                  {profitMargin}%
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
