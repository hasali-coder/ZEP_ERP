import React from 'react';
import { useFinancial } from '../../context/FinancialContext';
import { StatCard } from '../common/StatCard';
import { FinancialChart } from '../common/FinancialChart';
import {OverviewInsights} from '../../myzavo/OverviewInsights';
import { StatusBadge } from '../common/Badge';
import { formatMoney } from '../../utils/money';
import { formatDate } from '../../utils/dates';
import {
  TrendingUp,
  TrendingDown,
  Scale,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { NavTab } from '../common/Sidebar';

interface OverviewViewProps {
  onNavigate: (tab: NavTab) => void;
  onOpenInvoiceModal: () => void;
  onOpenPaymentModal: (invoiceId?: string) => void;
  onViewInvoice: (invoiceId: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  onNavigate,
  onOpenInvoiceModal,
  onOpenPaymentModal,
  onViewInvoice,
}) => {
  const { metrics, invoices, transactions, activeBusiness } = useFinancial();

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const today = new Date();

  const chartData = [4, 3, 2, 1, 0].map((monthsAgo) => {
    const d = new Date(today.getFullYear(), today.getMonth() - monthsAgo, 1);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const prefix = `${yr}-${mo}`;
    const label = `${monthNames[d.getMonth()]} ${yr === today.getFullYear() ? '' : yr}`.trim();

    const monthTx = transactions.filter((t) => t.date.startsWith(prefix));
    const inflow = monthTx
      .filter((t) => t.type === 'payment_received')
      .reduce((sum, t) => sum + t.amountCents, 0);
    const outflow = monthTx
      .filter((t) => t.type === 'payment_made')
      .reduce((sum, t) => sum + t.amountCents, 0);

    return {
      label,
      inflowCents: inflow,
      outflowCents: outflow,
    };
  });

  const recentInvoices = invoices.slice(0, 5);
  const recentTransactions = transactions.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Top Banner for Demo workspace */}
      {activeBusiness.isDemo && (
        <div className="p-3.5 bg-[#F0F5FA] border border-[#D1E0F0] rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#182539]">
          <div>
            <span className="font-semibold">Demo Workspace Active:</span> Real-time figures for{' '}
            <strong>{activeBusiness.name}</strong>. Calculations derive directly from recorded invoices, payments and expenses.
          </div>
          <button
            onClick={onOpenInvoiceModal}
            className="px-3 py-1.5 bg-[#244A73] hover:bg-[#1B3959] text-white font-medium rounded text-xs shrink-0 transition-colors"
          >
            Create Test Invoice
          </button>
        </div>
      )}

      {/* KPI Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Cash Received (Month)"
          value={formatMoney(metrics.cashReceivedCents, metrics.currency)}
          subtext="Actual customer payments received"
          trend="positive"
          icon={<TrendingUp className="w-4 h-4 text-[#1F806F]" />}
        />

        <StatCard
          label="Cash Paid Out (Month)"
          value={formatMoney(metrics.cashPaidOutCents, metrics.currency)}
          subtext="Expenses and supplier bills settled"
          trend="neutral"
          icon={<TrendingDown className="w-4 h-4 text-[#69788B]" />}
        />

        <StatCard
          label="Net Cash Flow"
          value={formatMoney(metrics.netCashFlowCents, metrics.currency)}
          subtext={metrics.netCashFlowCents >= 0 ? 'Net surplus for the month' : 'Net deficit for the month'}
          trend={metrics.netCashFlowCents >= 0 ? 'positive' : 'negative'}
          icon={<Scale className="w-4 h-4 text-[#244A73]" />}
        />

        <button type="button" onClick={()=>{try{window.sessionStorage.setItem('myzavo:report-focus','receivables');}catch{}onNavigate('reports');window.dispatchEvent(new Event('myzavo:report-focus'));}} className="block w-full rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#244A73]" title="Open outstanding receivables in Customer SOA">
        <StatCard
          label="Outstanding Receivables"
          value={formatMoney(metrics.totalOutstandingInvoicesCents, metrics.currency)}
          subtext={`${metrics.outstandingInvoiceCount} unpaid invoice${metrics.outstandingInvoiceCount === 1 ? '' : 's'}${
            metrics.overdueInvoiceCount > 0 ? ` (${metrics.overdueInvoiceCount} overdue)` : ''
          }`}
          trend={metrics.overdueInvoiceCount > 0 ? 'warning' : 'neutral'}
          icon={<Clock className="w-4 h-4 text-[#C38754]" />}
        />
        <span className="sr-only">Open the Outstanding Receivables report</span>
        </button>
      </div>

      {/* Financial Chart */}
      <OverviewInsights businessId={activeBusiness.id} currency={metrics.currency}/>

      {/* Two Column Grid: Recent Invoices & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices Card */}
        <div className="bg-white p-5 rounded-lg border border-[#E2E8F0] shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <div>
              <h3 className="text-sm font-semibold text-[#182539]">Recent Invoices</h3>
              <p className="text-xs text-[#69788B] mt-0.5">Latest customer billing activity</p>
            </div>
            <button
              onClick={() => onNavigate('invoices')}
              className="text-xs font-medium text-[#244A73] hover:text-[#1B3959] flex items-center gap-1 transition-colors"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-[#E2E8F0] mt-2">
            {recentInvoices.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#69788B]">
                No invoices created yet.
                <button
                  onClick={onOpenInvoiceModal}
                  className="block mx-auto mt-2 text-xs font-medium text-[#244A73] underline"
                >
                  Create your first invoice
                </button>
              </div>
            ) : (
              recentInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="py-3 flex items-center justify-between hover:bg-[#F6F8FB] px-2 rounded -mx-2 transition-colors cursor-pointer"
                  onClick={() => onViewInvoice(inv.id)}
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-[#244A73]">
                        {inv.invoiceNumber}
                      </span>
                      <StatusBadge status={inv.status} />
                    </div>
                    <p className="text-xs text-[#69788B] truncate mt-0.5">{inv.customerName}</p>
                    <p className="text-[11px] text-[#69788B]">Due {formatDate(inv.dueDate)}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="tabular-nums text-sm font-semibold text-[#182539]">
                      {formatMoney(inv.totalCents, inv.currency)}
                    </div>
                    {inv.balanceDueCents > 0 && (
                      <div className="tabular-nums text-xs text-[#C38754] font-medium mt-0.5">
                        Bal: {formatMoney(inv.balanceDueCents, inv.currency)}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Cash Transactions Card */}
        <div className="bg-white p-5 rounded-lg border border-[#E2E8F0] shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <div>
              <h3 className="text-sm font-semibold text-[#182539]">Recent Cash Movements</h3>
              <p className="text-xs text-[#69788B] mt-0.5">Verified inflows and outflows</p>
            </div>
            <button
              onClick={() => onNavigate('transactions')}
              className="text-xs font-medium text-[#244A73] hover:text-[#1B3959] flex items-center gap-1 transition-colors"
            >
              <span>View ledger</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-[#E2E8F0] mt-2">
            {recentTransactions.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#69788B]">
                No cash transactions recorded yet.
              </div>
            ) : (
              recentTransactions.map((tx) => {
                const isReceived = tx.type === 'payment_received';
                return (
                  <div
                    key={tx.id}
                    className="py-3 flex items-center justify-between hover:bg-[#F6F8FB] px-2 rounded -mx-2 transition-colors"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="font-medium text-xs text-[#182539] truncate">
                        {tx.description}
                      </div>
                      <div className="text-[11px] text-[#69788B] mt-0.5 flex items-center gap-1.5">
                        <span>{formatDate(tx.date)}</span>
                        <span>·</span>
                        <span>{tx.paymentMethod}</span>
                        {tx.referenceNumber && (
                          <>
                            <span>·</span>
                            <span className="font-mono text-[11px]">{tx.referenceNumber}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`tabular-nums text-sm font-semibold ${
                          isReceived ? 'text-[#1F806F]' : 'text-[#182539]'
                        }`}
                      >
                        {isReceived ? '+' : '-'}
                        {formatMoney(tx.amountCents, tx.currency)}
                      </div>
                      <span className="text-[10px] text-[#69788B] block uppercase tracking-wider">
                        {isReceived ? 'Received' : 'Paid'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
