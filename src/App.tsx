import React, { useState } from 'react';
import {IntegrationsPreview} from './myzavo/IntegrationsPreview';
import { FinancialProvider, useFinancial } from './context/FinancialContext';
import { Sidebar, NavTab } from './components/common/Sidebar';
import { Header } from './components/common/Header';
import { OverviewView } from './components/overview/OverviewView';
import { InvoiceListView } from './components/invoices/InvoiceListView';
import { InvoiceFormModal } from './components/invoices/InvoiceFormModal';
import { InvoiceViewModal } from './components/invoices/InvoiceViewModal';
import { CreditNotesView } from './components/creditnotes/CreditNotesView';
import { QuotationListView } from './components/quotations/QuotationListView';
import { QuotationFormModal } from './components/quotations/QuotationFormModal';
import { QuotationViewModal } from './components/quotations/QuotationViewModal';
import {LiveExpensesView as ExpenseListView,LiveExpenseModal as ExpenseModal,LiveTransactionsView as TransactionListView,LiveReportsView as ReportsView,LiveSettingsView as SettingsView,LiveReceiptsView,LivePaymentModal as PaymentModal} from './myzavo/LiveFinance';
import { ContactListView } from './components/contacts/ContactListView';
import { ContactModal } from './components/contacts/ContactModal';
import { CreateBusinessModal } from './components/settings/CreateBusinessModal';
import { Invoice, Quotation, Contact, Expense, ContactType } from './types';
import type {ReportType} from './components/reports/ReportsView';

function MainApp() {
  const { invoices, quotations } = useFinancial();

  const [currentTab, setCurrentTab] = useState<NavTab>(() => new URLSearchParams(window.location.search).has('contact') ? 'contacts' : 'overview');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modals
  const [isInvoiceFormOpen, setIsInvoiceFormOpen] = useState(false);
  const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | null>(null);
  const [invoiceInitialCustomerId, setInvoiceInitialCustomerId] = useState<string | undefined>(undefined);

  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null);
  React.useEffect(()=>{
    const handle=(e:Event)=>{
      const detail=(e as CustomEvent<{kind:string;id:string}>).detail;
      if(detail?.kind==='invoice'&&detail.id){setCurrentTab('invoices');setViewInvoiceId(detail.id);}
    };
    window.addEventListener('myzavo:open-financial-document',handle);
    return()=>window.removeEventListener('myzavo:open-financial-document',handle);
  },[]);

  const [isQuotationFormOpen, setIsQuotationFormOpen] = useState(false);
  const [quotationToEdit, setQuotationToEdit] = useState<Quotation | null>(null);
  const [quotationInitialCustomerId, setQuotationInitialCustomerId] = useState<string | undefined>(undefined);

  const [viewQuotationId, setViewQuotationId] = useState<string | null>(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [targetInvoiceIdForPayment, setTargetInvoiceIdForPayment] = useState<string | undefined>(undefined);
  const [targetBillIdForPayment, setTargetBillIdForPayment] = useState<string | undefined>(undefined);

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseMode, setExpenseMode] = useState<'expense' | 'bill'>('expense');
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);

  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);
  const [contactDefaultType, setContactDefaultType] = useState<ContactType>('customer');

  const [isCreateBusinessModalOpen, setIsCreateBusinessModalOpen] = useState(false);

  // Reports state passed when jumping from contact
  const [reportsInitialType, setReportsInitialType] = useState<ReportType>('income');
  const [reportsInitialCustomerId, setReportsInitialCustomerId] = useState<string | undefined>(undefined);

  // Quick Action Handler from Top Header
  const handleQuickAction = (action: 'invoice' | 'quotation' | 'expense' | 'payment' | 'contact') => {
    switch (action) {
      case 'invoice':
        setInvoiceToEdit(null);
        setInvoiceInitialCustomerId(undefined);
        setIsInvoiceFormOpen(true);
        break;
      case 'quotation':
        setQuotationToEdit(null);
        setQuotationInitialCustomerId(undefined);
        setIsQuotationFormOpen(true);
        break;
      case 'expense':
        setExpenseToEdit(null);
        setExpenseMode('expense');
        setIsExpenseModalOpen(true);
        break;
      case 'payment':
        setTargetInvoiceIdForPayment(undefined);
        setTargetBillIdForPayment(undefined);
        setIsPaymentModalOpen(true);
        break;
      case 'contact':
        setContactToEdit(null);
        setContactDefaultType('customer');
        setIsContactModalOpen(true);
        break;
    }
  };

  const activeInvoiceToView = invoices.find((i) => i.id === viewInvoiceId) || null;
  const activeQuotationToView = quotations.find((q) => q.id === viewQuotationId) || null;

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-[#182539] flex">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => { if(tab !== 'contacts') { const u = new URL(window.location.href); u.searchParams.delete('contact'); window.history.replaceState({}, '', u); } setCurrentTab(tab); }}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onOpenCreateBusinessModal={() => setIsCreateBusinessModalOpen(true)}
      />

      {/* Main Viewport Container */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        <Header
          currentTab={currentTab}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onQuickAction={handleQuickAction}
        />

        <main className={`flex-1 p-4 sm:p-6 md:p-8 w-full mx-auto ${currentTab === 'overview' ? 'max-w-7xl' : 'max-w-[1500px] mz-workspace'}`}>
          {currentTab === 'overview' && (
            <OverviewView
              onNavigate={setCurrentTab}
              onOpenInvoiceModal={() => {
                setInvoiceToEdit(null);
                setInvoiceInitialCustomerId(undefined);
                setIsInvoiceFormOpen(true);
              }}
              onOpenPaymentModal={(invId) => {
                setTargetInvoiceIdForPayment(invId);setTargetBillIdForPayment(undefined);setIsPaymentModalOpen(true);
              }}
              onViewInvoice={(invId) => setViewInvoiceId(invId)}
            />
          )}

          {currentTab === 'invoices' && (
            <InvoiceListView
              onOpenCreateModal={() => {
                setInvoiceToEdit(null);
                setInvoiceInitialCustomerId(undefined);
                setIsInvoiceFormOpen(true);
              }}
              onViewInvoice={(invId) => setViewInvoiceId(invId)}
              onRecordPayment={(invId) => {
                setTargetInvoiceIdForPayment(invId);setTargetBillIdForPayment(undefined);setIsPaymentModalOpen(true);
              }}
            />
          )}

          {currentTab === 'credit_notes' && <CreditNotesView onViewInvoice={setViewInvoiceId} />}
          {currentTab === 'receipts' && <LiveReceiptsView />}

          {currentTab === 'quotations' && (
            <QuotationListView
              onOpenCreateModal={() => {
                setQuotationToEdit(null);
                setQuotationInitialCustomerId(undefined);
                setIsQuotationFormOpen(true);
              }}
              onViewQuotation={(qId) => setViewQuotationId(qId)}
              onInvoiceCreated={(newInvId) => {
                setViewInvoiceId(newInvId);
                setCurrentTab('invoices');
              }}
            />
          )}

          {currentTab === 'expenses' && (
            <ExpenseListView
              onOpenCreateExpense={() => {
                setExpenseToEdit(null);
                setExpenseMode('expense');
                setIsExpenseModalOpen(true);
              }}
              onOpenCreateBill={() => {
                setExpenseToEdit(null);
                setExpenseMode('bill');
                setIsExpenseModalOpen(true);
              }}
              onRecordBillPayment={(billId: string) => {
                setTargetInvoiceIdForPayment(undefined);
                setTargetBillIdForPayment(billId);
                setIsPaymentModalOpen(true);
              }}
              onEditExpense={(exp: Expense) => {
                setExpenseToEdit(exp);
                setExpenseMode('expense');
                setIsExpenseModalOpen(true);
              }}
            />
          )}

          {currentTab === 'transactions' && (
            <TransactionListView
              onOpenPaymentModal={() => {
                setTargetInvoiceIdForPayment(undefined);
                setTargetBillIdForPayment(undefined);
                setIsPaymentModalOpen(true);
              }}
            />
          )}

          {currentTab === 'contacts' && (
            <ContactListView
              onOpenCreateModal={(defType) => {
                setContactToEdit(null);
                setContactDefaultType(defType || 'customer');
                setIsContactModalOpen(true);
              }}
              onEditContact={(contact) => {
                setContactToEdit(contact);
                setIsContactModalOpen(true);
              }}
              onCreateInvoiceForCustomer={(customerId) => {
                setInvoiceToEdit(null);
                setInvoiceInitialCustomerId(customerId);
                setIsInvoiceFormOpen(true);
              }}
              onCreateQuotationForCustomer={(customerId) => {
                setQuotationToEdit(null);
                setQuotationInitialCustomerId(customerId);
                setIsQuotationFormOpen(true);
              }}
              onRecordPaymentForCustomer={(customerId) => {
                const customerInv = invoices.find((i) => i.customerId === customerId && i.balanceDueCents > 0);
                setTargetInvoiceIdForPayment(customerInv?.id);
                setTargetBillIdForPayment(undefined);
                setIsPaymentModalOpen(true);
              }}
              onGenerateSOA={(customerId) => {
                setReportsInitialType('statement_of_account');
                setReportsInitialCustomerId(customerId);
                setCurrentTab('reports');
              }}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsView
              initialReportType={reportsInitialType}
              initialCustomerId={reportsInitialCustomerId}
              onViewInvoice={(invId: string) => setViewInvoiceId(invId)}
            />
          )}

          {currentTab === 'integrations' && <IntegrationsPreview />}
          {currentTab === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Modals & Dialogs */}
      <InvoiceFormModal
        isOpen={isInvoiceFormOpen}
        onClose={() => setIsInvoiceFormOpen(false)}
        invoiceToEdit={invoiceToEdit}
        initialCustomerId={invoiceInitialCustomerId}
      />

      <InvoiceViewModal
        isOpen={Boolean(viewInvoiceId)}
        onClose={() => setViewInvoiceId(null)}
        invoice={activeInvoiceToView}
        onCreditNote={() => setCurrentTab('credit_notes')}
        onRecordPayment={(invId) => {
          setViewInvoiceId(null);
          setTargetInvoiceIdForPayment(invId);setTargetBillIdForPayment(undefined);setIsPaymentModalOpen(true);
        }}
        onEditInvoice={(inv) => {
          setViewInvoiceId(null);
          setInvoiceToEdit(inv);
          setIsInvoiceFormOpen(true);
        }}
      />

      <QuotationFormModal
        isOpen={isQuotationFormOpen}
        onClose={() => setIsQuotationFormOpen(false)}
        quotationToEdit={quotationToEdit}
        initialCustomerId={quotationInitialCustomerId}
      />

      <QuotationViewModal
        isOpen={Boolean(viewQuotationId)}
        onClose={() => setViewQuotationId(null)}
        quotation={activeQuotationToView}
        onEditQuotation={(q) => {
          setViewQuotationId(null);
          setQuotationToEdit(q);
          setIsQuotationFormOpen(true);
        }}
        onInvoiceCreated={(newInvId) => {
          setViewInvoiceId(newInvId);
          setCurrentTab('invoices');
        }}
      />

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setTargetInvoiceIdForPayment(undefined);
          setTargetBillIdForPayment(undefined);
        }}
        targetInvoiceId={targetInvoiceIdForPayment}
        targetBillId={targetBillIdForPayment}
      />

      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        defaultMode={expenseMode}
        expenseToEdit={expenseToEdit}
      />

      <ContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        contactToEdit={contactToEdit}
        defaultType={contactDefaultType}
      />

      <CreateBusinessModal
        isOpen={isCreateBusinessModalOpen}
        onClose={() => setIsCreateBusinessModalOpen(false)}
      />
    </div>
  );
}

function PreviewApp() {
  return (
    <FinancialProvider>
      <MainApp />
    </FinancialProvider>
  );
}

export default function App() {
  // Authentication and workspace selection belong to MyZavoGateway.
  return <PreviewApp />;
}
