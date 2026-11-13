import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Plus,
  FileText,
  FileCheck2,
  Receipt,
  CreditCard,
  UserPlus,
  ChevronDown,
} from 'lucide-react';
import { NavTab } from './Sidebar';
import { useFinancial } from '../../context/FinancialContext';

interface HeaderProps {
  currentTab: NavTab;
  onOpenMobileSidebar: () => void;
  onQuickAction: (action: 'invoice' | 'quotation' | 'expense' | 'payment' | 'contact') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenMobileSidebar,
  onQuickAction,
}) => {
  const { activeBusiness } = useFinancial();
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsActionMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const tabTitles: Record<NavTab, { title: string; subtitle: string }> = {
    overview: { title: 'Financial Overview', subtitle: 'Live cash movements, balances and operational metrics' },
    invoices: { title: 'Invoices', subtitle: 'Issue, track and manage customer billing and balances' },
    credit_notes: { title: 'Credit Notes', subtitle: 'Review customer credits and adjustments' },
    receipts: { title: 'Receipts', subtitle: 'View and download payment acknowledgements' },
    quotations: { title: 'Quotations', subtitle: 'Prepare estimates and convert accepted proposals into invoices' },
    expenses: { title: 'Expenses & Supplier Bills', subtitle: 'Record operational expenditures and manage payables' },
    transactions: { title: 'Transactions Ledger', subtitle: 'Unified ledger of all received and outgoing cash flows' },
    contacts: { title: 'Contacts Directory', subtitle: 'Customer and supplier profiles with financial history' },
    reports: { title: 'Financial Reports', subtitle: 'Income statements, aging, cash flow and Statements of Account' },
    settings: { title: 'Business Settings', subtitle: 'Branding, tax identification, payment instructions and accounts' },
    integrations: { title: 'Integrations', subtitle: 'Preview external service connections (not yet active)' },
  };

  const { title, subtitle } = tabTitles[currentTab];

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-[#E2E8F0] px-4 sm:px-6 flex items-center justify-between no-print">
      {/* Zone 1: Mobile Hamburger + Breadcrumb/Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="p-1.5 -ml-1 text-[#69788B] hover:text-[#182539] hover:bg-[#F6F8FB] rounded-md lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="truncate">
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-semibold text-[#182539] tracking-normal truncate">{title}</h1>
            <span className="hidden sm:inline-block text-xs text-[#69788B] font-normal">
              · {activeBusiness.name}
            </span>
          </div>
          <p className="hidden md:block text-xs text-[#69788B] truncate">{subtitle}</p>
        </div>
      </div>

      {/* Zone 3: Prominent contextual action button with interactive navy */}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => setIsActionMenuOpen(!isActionMenuOpen)}
          className="flex items-center gap-2 px-3.5 py-2 bg-[#244A73] hover:bg-[#1B3959] text-white text-sm font-medium rounded-md shadow-xs transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4 text-white" />
          <span>New Record</span>
          <ChevronDown className="w-3.5 h-3.5 text-white/80" />
        </button>

        {isActionMenuOpen && (
          <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-lg shadow-xl border border-[#E2E8F0] py-1.5 z-50 text-xs">
            <button
              onClick={() => {
                setIsActionMenuOpen(false);
                onQuickAction('invoice');
              }}
              className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-[#182539] hover:bg-[#F6F8FB] transition-colors"
            >
              <FileText className="w-4 h-4 text-[#244A73]" />
              <div>
                <div className="font-medium text-sm">Create Invoice</div>
                <div className="text-xs text-[#69788B]">Bill a client with line items & tax</div>
              </div>
            </button>

            <button
              onClick={() => {
                setIsActionMenuOpen(false);
                onQuickAction('quotation');
              }}
              className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-[#182539] hover:bg-[#F6F8FB] transition-colors"
            >
              <FileCheck2 className="w-4 h-4 text-[#244A73]" />
              <div>
                <div className="font-medium text-sm">Create Quotation</div>
                <div className="text-xs text-[#69788B]">Send an estimate to a client</div>
              </div>
            </button>

            <div className="border-t border-[#E2E8F0] my-1" />

            <button
              onClick={() => {
                setIsActionMenuOpen(false);
                onQuickAction('expense');
              }}
              className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-[#182539] hover:bg-[#F6F8FB] transition-colors"
            >
              <Receipt className="w-4 h-4 text-[#C38754]" />
              <div>
                <div className="font-medium text-sm">Add Expense</div>
                <div className="text-xs text-[#69788B]">Record an operating expenditure</div>
              </div>
            </button>

            <button
              onClick={() => {
                setIsActionMenuOpen(false);
                onQuickAction('payment');
              }}
              className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-[#182539] hover:bg-[#F6F8FB] transition-colors"
            >
              <CreditCard className="w-4 h-4 text-[#1F806F]" />
              <div>
                <div className="font-medium text-sm">Record Payment</div>
                <div className="text-xs text-[#69788B]">Log received or outgoing money</div>
              </div>
            </button>

            <div className="border-t border-[#E2E8F0] my-1" />

            <button
              onClick={() => {
                setIsActionMenuOpen(false);
                onQuickAction('contact');
              }}
              className="w-full text-left px-3.5 py-2 flex items-center gap-2.5 text-[#182539] hover:bg-[#F6F8FB] transition-colors"
            >
              <UserPlus className="w-4 h-4 text-[#69788B]" />
              <div>
                <div className="font-medium text-sm">Add Contact</div>
                <div className="text-xs text-[#69788B]">Add customer or supplier profile</div>
              </div>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
