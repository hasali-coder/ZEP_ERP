import {
  Business,
  Contact,
  Invoice,
  Quotation,
  Expense,
  SupplierBill,
  FinancialTransaction,
  CustomerStatement,
  StatementEntry,
} from '../types';
import {
  DEMO_BUSINESS_ID,
  LIVE_BUSINESS_ID,
  initialDemoBusiness,
  initialLiveBusiness,
  initialDemoContacts,
  initialDemoInvoices,
  initialDemoQuotations,
  initialDemoExpenses,
  initialDemoBills,
  initialDemoTransactions,
} from './demoData';
import { getTodayDateString, isDateOverdue } from '../utils/dates';

const STORAGE_KEYS = {
  ACTIVE_BUSINESS_ID: 'myzavo_active_business_id',
  BUSINESSES: 'myzavo_businesses_v1',
  CONTACTS: 'myzavo_contacts_v1',
  INVOICES: 'myzavo_invoices_v1',
  QUOTATIONS: 'myzavo_quotations_v1',
  EXPENSES: 'myzavo_expenses_v1',
  BILLS: 'myzavo_bills_v1',
  TRANSACTIONS: 'myzavo_transactions_v1',
};

// Internal in-memory cache initialized from localStorage or demo seed
class StorageManager {
  private businesses: Business[] = [];
  private contacts: Contact[] = [];
  private invoices: Invoice[] = [];
  private quotations: Quotation[] = [];
  private expenses: Expense[] = [];
  private bills: SupplierBill[] = [];
  private transactions: FinancialTransaction[] = [];
  private activeBusinessId: string = DEMO_BUSINESS_ID;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.init();
  }

  private init() {
    try {
      const storedActiveId = localStorage.getItem(STORAGE_KEYS.ACTIVE_BUSINESS_ID);
      const storedBusinesses = localStorage.getItem(STORAGE_KEYS.BUSINESSES);
      const storedContacts = localStorage.getItem(STORAGE_KEYS.CONTACTS);
      const storedInvoices = localStorage.getItem(STORAGE_KEYS.INVOICES);
      const storedQuotations = localStorage.getItem(STORAGE_KEYS.QUOTATIONS);
      const storedExpenses = localStorage.getItem(STORAGE_KEYS.EXPENSES);
      const storedBills = localStorage.getItem(STORAGE_KEYS.BILLS);
      const storedTransactions = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);

      if (storedBusinesses) {
        this.businesses = JSON.parse(storedBusinesses);
        this.contacts = storedContacts ? JSON.parse(storedContacts) : [];
        this.invoices = storedInvoices ? JSON.parse(storedInvoices) : [];
        this.quotations = storedQuotations ? JSON.parse(storedQuotations) : [];
        this.expenses = storedExpenses ? JSON.parse(storedExpenses) : [];
        this.bills = storedBills ? JSON.parse(storedBills) : [];
        this.transactions = storedTransactions ? JSON.parse(storedTransactions) : [];
        this.activeBusinessId = storedActiveId || (this.businesses[0]?.id ?? DEMO_BUSINESS_ID);
      } else {
        // Seed initial data
        this.resetAllDataToDefaults();
      }
    } catch (err) {
      console.error('Failed to initialize storage from localStorage, resetting defaults', err);
      this.resetAllDataToDefaults();
    }
  }

  public resetAllDataToDefaults() {
    this.businesses = [initialDemoBusiness, initialLiveBusiness];
    this.contacts = [...initialDemoContacts];
    this.invoices = [...initialDemoInvoices];
    this.quotations = [...initialDemoQuotations];
    this.expenses = [...initialDemoExpenses];
    this.bills = [...initialDemoBills];
    this.transactions = [...initialDemoTransactions];
    this.activeBusinessId = DEMO_BUSINESS_ID;
    this.persistAll();
    this.notify();
  }

  private persistAll() {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_BUSINESS_ID, this.activeBusinessId);
      localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(this.businesses));
      localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(this.contacts));
      localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(this.invoices));
      localStorage.setItem(STORAGE_KEYS.QUOTATIONS, JSON.stringify(this.quotations));
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(this.expenses));
      localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(this.bills));
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(this.transactions));
    } catch (e) {
      console.error('Storage write error', e);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  // --- Active Workspace & Business Management ---

  public getActiveBusiness(): Business {
    const found = this.businesses.find((b) => b.id === this.activeBusinessId);
    if (!found) {
      return this.businesses[0] || initialDemoBusiness;
    }
    return found;
  }

  public getAllBusinesses(): Business[] {
    return [...this.businesses];
  }

  public setActiveBusiness(id: string) {
    if (this.businesses.some((b) => b.id === id)) {
      this.activeBusinessId = id;
      this.persistAll();
      this.notify();
    }
  }

  public updateBusiness(data: Partial<Business>) {
    this.businesses = this.businesses.map((b) => {
      if (b.id === this.activeBusinessId) {
        return { ...b, ...data };
      }
      return b;
    });
    this.persistAll();
    this.notify();
  }

  public createBusiness(name: string, currency: Business['currency'] = 'KES'): Business {
    const newBiz: Business = {
      id: `biz-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name,
      email: '',
      phone: '',
      address: '',
      city: 'Nairobi',
      country: 'Kenya',
      currency,
      isDemo: false,
    };
    this.businesses.push(newBiz);
    this.activeBusinessId = newBiz.id;
    this.persistAll();
    this.notify();
    return newBiz;
  }

  // --- Contacts ---

  public getContacts(typeFilter?: 'customer' | 'supplier'): Contact[] {
    const list = this.contacts.filter((c) => c.businessId === this.activeBusinessId);
    if (!typeFilter) return list;
    return list.filter((c) => c.type === typeFilter || c.type === 'both');
  }

  public getContactById(id: string): Contact | undefined {
    return this.contacts.find((c) => c.id === id && c.businessId === this.activeBusinessId);
  }

  public saveContact(contactData: Omit<Contact, 'id' | 'businessId' | 'createdAt'> & { id?: string }): Contact {
    if (contactData.id) {
      this.contacts = this.contacts.map((c) => {
        if (c.id === contactData.id && c.businessId === this.activeBusinessId) {
          return { ...c, ...contactData } as Contact;
        }
        return c;
      });
      this.persistAll();
      this.notify();
      return this.getContactById(contactData.id)!;
    }

    const newContact: Contact = {
      ...contactData,
      id: `c-${Date.now()}`,
      businessId: this.activeBusinessId,
      createdAt: getTodayDateString(),
    };
    this.contacts.push(newContact);
    this.persistAll();
    this.notify();
    return newContact;
  }

  public deleteContact(id: string) {
    this.contacts = this.contacts.filter((c) => !(c.id === id && c.businessId === this.activeBusinessId));
    this.persistAll();
    this.notify();
  }

  // --- Invoices ---

  public getInvoices(): Invoice[] {
    // Automatically recheck overdue status on read
    return this.invoices
      .filter((inv) => inv.businessId === this.activeBusinessId)
      .map((inv) => {
        if (inv.status !== 'paid' && inv.status !== 'cancelled' && inv.status !== 'draft') {
          if (isDateOverdue(inv.dueDate) && inv.balanceDueCents > 0) {
            return { ...inv, status: 'overdue' as const };
          }
        }
        return inv;
      })
      .sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  }

  public getInvoiceById(id: string): Invoice | undefined {
    return this.invoices.find((inv) => inv.id === id && inv.businessId === this.activeBusinessId);
  }

  public getNextInvoiceNumber(): string {
    const bizInvoices = this.invoices.filter((i) => i.businessId === this.activeBusinessId);
    const year = new Date().getFullYear();
    const count = bizInvoices.length + 1;
    const padded = String(count).padStart(3, '0');
    let candidate = `INV-${year}-${padded}`;
    // Guarantee uniqueness
    let counter = count;
    while (bizInvoices.some((i) => i.invoiceNumber === candidate)) {
      counter++;
      candidate = `INV-${year}-${String(counter).padStart(3, '0')}`;
    }
    return candidate;
  }

  public saveInvoice(invoiceData: Partial<Invoice> & { customerId: string; items: Invoice['items'] }): Invoice {
    const biz = this.getActiveBusiness();
    const customer = this.getContactById(invoiceData.customerId);
    const customerName = customer ? (customer.companyName || customer.name) : (invoiceData.customerName || 'Unknown Customer');

    // Compute line subtotal
    const subtotalCents = invoiceData.items.reduce((sum, item) => {
      const itemSubtotal = item.quantity * item.unitPriceCents;
      const discount = item.discountPercent ? Math.round((itemSubtotal * item.discountPercent) / 100) : 0;
      return sum + (itemSubtotal - discount);
    }, 0);

    const discountCents = invoiceData.discountCents || 0;
    const taxableAmount = Math.max(0, subtotalCents - discountCents);

    // Compute tax from line items or overall
    const taxCents = invoiceData.items.reduce((sum, item) => {
      if (item.taxRatePercent > 0) {
        const itemNet = item.quantity * item.unitPriceCents;
        return sum + Math.round((itemNet * item.taxRatePercent) / 100);
      }
      return sum;
    }, 0);

    const totalCents = Math.max(0, taxableAmount + taxCents);

    if (invoiceData.id) {
      const existing = this.getInvoiceById(invoiceData.id);
      const amountPaidCents = existing ? existing.amountPaidCents : 0;
      const balanceDueCents = Math.max(0, totalCents - amountPaidCents);

      let status = invoiceData.status || (existing?.status ?? 'sent');
      if (status !== 'cancelled' && status !== 'draft') {
        if (balanceDueCents === 0 && totalCents > 0) {
          status = 'paid';
        } else if (amountPaidCents > 0 && balanceDueCents > 0) {
          status = 'partially_paid';
        } else if (isDateOverdue(invoiceData.dueDate || existing?.dueDate || '') && balanceDueCents > 0) {
          status = 'overdue';
        } else {
          status = 'sent';
        }
      }

      const updated: Invoice = {
        ...(existing || {}),
        ...invoiceData,
        id: invoiceData.id,
        businessId: this.activeBusinessId,
        customerName,
        subtotalCents,
        discountCents,
        taxCents,
        totalCents,
        amountPaidCents,
        balanceDueCents,
        status,
        currency: biz.currency,
        updatedAt: new Date().toISOString(),
      } as Invoice;

      this.invoices = this.invoices.map((i) => (i.id === updated.id ? updated : i));
      this.persistAll();
      this.notify();
      return updated;
    }

    // New invoice
    const invoiceNumber = invoiceData.invoiceNumber || this.getNextInvoiceNumber();
    const balanceDueCents = totalCents;
    const status = invoiceData.status || 'sent';

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      businessId: this.activeBusinessId,
      invoiceNumber,
      customerId: invoiceData.customerId,
      customerName,
      issueDate: invoiceData.issueDate || getTodayDateString(),
      dueDate: invoiceData.dueDate || getTodayDateString(),
      currency: biz.currency,
      items: invoiceData.items,
      subtotalCents,
      discountCents,
      taxCents,
      totalCents,
      amountPaidCents: 0,
      balanceDueCents,
      status,
      paymentTerms: invoiceData.paymentTerms || 'Net 14 Days',
      notes: invoiceData.notes || biz.notes || '',
      paymentInstructions: invoiceData.paymentInstructions || biz.paymentInstructions || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.invoices.push(newInvoice);
    this.persistAll();
    this.notify();
    return newInvoice;
  }

  public deleteInvoice(id: string) {
    this.invoices = this.invoices.filter((i) => !(i.id === id && i.businessId === this.activeBusinessId));
    this.persistAll();
    this.notify();
  }

  public duplicateInvoice(id: string): Invoice | undefined {
    const original = this.getInvoiceById(id);
    if (!original) return undefined;

    const copyData: Partial<Invoice> & { customerId: string; items: Invoice['items'] } = {
      customerId: original.customerId,
      customerName: original.customerName,
      issueDate: getTodayDateString(),
      dueDate: getTodayDateString(),
      items: original.items.map((it) => ({ ...it, id: `li-${Date.now()}-${Math.random().toString(36).substr(2, 4)}` })),
      discountCents: original.discountCents,
      notes: original.notes,
      paymentTerms: original.paymentTerms,
      paymentInstructions: original.paymentInstructions,
      status: 'draft',
    };
    return this.saveInvoice(copyData);
  }

  // --- Quotations ---

  public getQuotations(): Quotation[] {
    return this.quotations
      .filter((q) => q.businessId === this.activeBusinessId)
      .sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  }

  public getQuotationById(id: string): Quotation | undefined {
    return this.quotations.find((q) => q.id === id && q.businessId === this.activeBusinessId);
  }

  public getNextQuotationNumber(): string {
    const bizQuotes = this.quotations.filter((q) => q.businessId === this.activeBusinessId);
    const year = new Date().getFullYear();
    const count = bizQuotes.length + 1;
    let candidate = `QUO-${year}-${String(count).padStart(3, '0')}`;
    let counter = count;
    while (bizQuotes.some((q) => q.quoteNumber === candidate)) {
      counter++;
      candidate = `QUO-${year}-${String(counter).padStart(3, '0')}`;
    }
    return candidate;
  }

  public saveQuotation(quoteData: Partial<Quotation> & { customerId: string; items: Quotation['items'] }): Quotation {
    const biz = this.getActiveBusiness();
    const customer = this.getContactById(quoteData.customerId);
    const customerName = customer ? (customer.companyName || customer.name) : (quoteData.customerName || 'Unknown Customer');

    const subtotalCents = quoteData.items.reduce((sum, item) => {
      const itemSubtotal = item.quantity * item.unitPriceCents;
      const discount = item.discountPercent ? Math.round((itemSubtotal * item.discountPercent) / 100) : 0;
      return sum + (itemSubtotal - discount);
    }, 0);

    const discountCents = quoteData.discountCents || 0;
    const taxableAmount = Math.max(0, subtotalCents - discountCents);

    const taxCents = quoteData.items.reduce((sum, item) => {
      if (item.taxRatePercent > 0) {
        const itemNet = item.quantity * item.unitPriceCents;
        return sum + Math.round((itemNet * item.taxRatePercent) / 100);
      }
      return sum;
    }, 0);

    const totalCents = Math.max(0, taxableAmount + taxCents);

    if (quoteData.id) {
      const existing = this.getQuotationById(quoteData.id);
      const updated: Quotation = {
        ...(existing || {}),
        ...quoteData,
        id: quoteData.id,
        businessId: this.activeBusinessId,
        customerName,
        subtotalCents,
        discountCents,
        taxCents,
        totalCents,
        currency: biz.currency,
      } as Quotation;

      this.quotations = this.quotations.map((q) => (q.id === updated.id ? updated : q));
      this.persistAll();
      this.notify();
      return updated;
    }

    const quoteNumber = quoteData.quoteNumber || this.getNextQuotationNumber();
    const newQuote: Quotation = {
      id: `quo-${Date.now()}`,
      businessId: this.activeBusinessId,
      quoteNumber,
      customerId: quoteData.customerId,
      customerName,
      issueDate: quoteData.issueDate || getTodayDateString(),
      expiryDate: quoteData.expiryDate || getTodayDateString(),
      currency: biz.currency,
      items: quoteData.items,
      subtotalCents,
      discountCents,
      taxCents,
      totalCents,
      status: quoteData.status || 'sent',
      notes: quoteData.notes || '',
      createdAt: new Date().toISOString(),
    };

    this.quotations.push(newQuote);
    this.persistAll();
    this.notify();
    return newQuote;
  }

  public convertQuotationToInvoice(quotationId: string): Invoice | undefined {
    const quote = this.getQuotationById(quotationId);
    if (!quote) return undefined;

    const invoice = this.saveInvoice({
      customerId: quote.customerId,
      customerName: quote.customerName,
      issueDate: getTodayDateString(),
      dueDate: getTodayDateString(),
      items: quote.items.map((it) => ({ ...it, id: `li-${Date.now()}-${Math.random().toString(36).substr(2, 4)}` })),
      discountCents: quote.discountCents,
      notes: `Converted from Quotation ${quote.quoteNumber}. ${quote.notes || ''}`.trim(),
      status: 'sent',
    });

    // Update quotation status
    this.quotations = this.quotations.map((q) => {
      if (q.id === quotationId) {
        return { ...q, status: 'converted', convertedInvoiceId: invoice.id };
      }
      return q;
    });

    this.persistAll();
    this.notify();
    return invoice;
  }

  public deleteQuotation(id: string) {
    this.quotations = this.quotations.filter((q) => !(q.id === id && q.businessId === this.activeBusinessId));
    this.persistAll();
    this.notify();
  }

  // --- Expenses & Supplier Bills ---

  public getExpenses(): Expense[] {
    return this.expenses
      .filter((e) => e.businessId === this.activeBusinessId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  public getBills(): SupplierBill[] {
    return this.bills
      .filter((b) => b.businessId === this.activeBusinessId)
      .map((b) => {
        if (b.status !== 'paid' && isDateOverdue(b.dueDate) && b.balanceDueCents > 0) {
          return { ...b, status: 'overdue' as const };
        }
        return b;
      })
      .sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  }

  public getBillById(id: string): SupplierBill | undefined {
    return this.bills.find((b) => b.id === id && b.businessId === this.activeBusinessId);
  }

  public saveExpense(expenseData: Omit<Expense, 'id' | 'businessId' | 'createdAt'> & { id?: string }): Expense {
    const biz = this.getActiveBusiness();
    if (expenseData.id) {
      this.expenses = this.expenses.map((e) => {
        if (e.id === expenseData.id && e.businessId === this.activeBusinessId) {
          return { ...e, ...expenseData } as Expense;
        }
        return e;
      });
      this.persistAll();
      this.notify();
      return this.expenses.find((e) => e.id === expenseData.id)!;
    }

    const newExpense: Expense = {
      ...expenseData,
      id: `exp-${Date.now()}`,
      businessId: this.activeBusinessId,
      currency: biz.currency,
      createdAt: new Date().toISOString(),
    };
    this.expenses.push(newExpense);

    // Also record payment transaction for cash flow tracking
    const tx: FinancialTransaction = {
      id: `tx-${Date.now()}`,
      businessId: this.activeBusinessId,
      type: 'payment_made',
      date: newExpense.date,
      amountCents: newExpense.amountCents,
      currency: newExpense.currency,
      paymentMethod: newExpense.paymentMethod,
      referenceNumber: newExpense.referenceNumber,
      expenseId: newExpense.id,
      description: `Expense: ${newExpense.description}`,
      notes: newExpense.notes,
      createdAt: new Date().toISOString(),
    };
    this.transactions.push(tx);

    this.persistAll();
    this.notify();
    return newExpense;
  }

  public saveBill(billData: Omit<SupplierBill, 'id' | 'businessId' | 'amountPaidCents' | 'balanceDueCents' | 'status' | 'createdAt'> & { id?: string }): SupplierBill {
    const biz = this.getActiveBusiness();
    const supplier = this.getContactById(billData.supplierId);
    const supplierName = supplier ? (supplier.companyName || supplier.name) : billData.supplierName;

    if (billData.id) {
      const existing = this.getBillById(billData.id);
      const amountPaidCents = existing ? existing.amountPaidCents : 0;
      const balanceDueCents = Math.max(0, billData.amountCents - amountPaidCents);
      const status: SupplierBill['status'] =
        balanceDueCents === 0 ? 'paid' : amountPaidCents > 0 ? 'partially_paid' : isDateOverdue(billData.dueDate) ? 'overdue' : 'unpaid';

      const updated: SupplierBill = {
        ...(existing || {}),
        ...billData,
        id: billData.id,
        businessId: this.activeBusinessId,
        supplierName,
        amountPaidCents,
        balanceDueCents,
        status,
        currency: biz.currency,
      } as SupplierBill;

      this.bills = this.bills.map((b) => (b.id === updated.id ? updated : b));
      this.persistAll();
      this.notify();
      return updated;
    }

    const billNumber = billData.billNumber || `BILL-${new Date().getFullYear()}-${String(this.bills.length + 1).padStart(3, '0')}`;
    const newBill: SupplierBill = {
      ...billData,
      id: `bill-${Date.now()}`,
      businessId: this.activeBusinessId,
      billNumber,
      supplierName,
      currency: biz.currency,
      amountPaidCents: 0,
      balanceDueCents: billData.amountCents,
      status: isDateOverdue(billData.dueDate) ? 'overdue' : 'unpaid',
      createdAt: new Date().toISOString(),
    };
    this.bills.push(newBill);
    this.persistAll();
    this.notify();
    return newBill;
  }

  public deleteExpense(id: string) {
    this.expenses = this.expenses.filter((e) => !(e.id === id && e.businessId === this.activeBusinessId));
    // Also remove linked transaction
    this.transactions = this.transactions.filter((tx) => tx.expenseId !== id);
    this.persistAll();
    this.notify();
  }

  public deleteBill(id: string) {
    this.bills = this.bills.filter((b) => !(b.id === id && b.businessId === this.activeBusinessId));
    this.transactions = this.transactions.filter((tx) => tx.billId !== id);
    this.persistAll();
    this.notify();
  }

  // --- Transactions & Payments ---

  public getTransactions(): FinancialTransaction[] {
    return this.transactions
      .filter((t) => t.businessId === this.activeBusinessId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  public recordInvoicePayment(params: {
    invoiceId: string;
    amountCents: number;
    date: string;
    paymentMethod: FinancialTransaction['paymentMethod'];
    referenceNumber?: string;
    notes?: string;
  }): FinancialTransaction {
    const invoice = this.getInvoiceById(params.invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    if (params.amountCents <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    // Atomic update on invoice
    const newAmountPaid = invoice.amountPaidCents + params.amountCents;
    const newBalanceDue = Math.max(0, invoice.totalCents - newAmountPaid);
    const newStatus: Invoice['status'] = newBalanceDue === 0 ? 'paid' : 'partially_paid';

    this.invoices = this.invoices.map((inv) => {
      if (inv.id === invoice.id) {
        return {
          ...inv,
          amountPaidCents: newAmountPaid,
          balanceDueCents: newBalanceDue,
          status: newStatus,
          updatedAt: new Date().toISOString(),
        };
      }
      return inv;
    });

    // Create payment transaction
    const tx: FinancialTransaction = {
      id: `tx-${Date.now()}`,
      businessId: this.activeBusinessId,
      type: 'payment_received',
      date: params.date || getTodayDateString(),
      amountCents: params.amountCents,
      currency: invoice.currency,
      paymentMethod: params.paymentMethod,
      referenceNumber: params.referenceNumber,
      contactId: invoice.customerId,
      contactName: invoice.customerName,
      invoiceId: invoice.id,
      description: `Payment for Invoice ${invoice.invoiceNumber}`,
      notes: params.notes,
      createdAt: new Date().toISOString(),
    };

    this.transactions.push(tx);
    this.persistAll();
    this.notify();
    return tx;
  }

  public recordBillPayment(params: {
    billId: string;
    amountCents: number;
    date: string;
    paymentMethod: FinancialTransaction['paymentMethod'];
    referenceNumber?: string;
    notes?: string;
  }): FinancialTransaction {
    const bill = this.getBillById(params.billId);
    if (!bill) throw new Error('Bill not found');

    if (params.amountCents <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    const newAmountPaid = bill.amountPaidCents + params.amountCents;
    const newBalanceDue = Math.max(0, bill.amountCents - newAmountPaid);
    const newStatus: SupplierBill['status'] = newBalanceDue === 0 ? 'paid' : 'partially_paid';

    this.bills = this.bills.map((b) => {
      if (b.id === bill.id) {
        return {
          ...b,
          amountPaidCents: newAmountPaid,
          balanceDueCents: newBalanceDue,
          status: newStatus,
        };
      }
      return b;
    });

    const tx: FinancialTransaction = {
      id: `tx-${Date.now()}`,
      businessId: this.activeBusinessId,
      type: 'payment_made',
      date: params.date || getTodayDateString(),
      amountCents: params.amountCents,
      currency: bill.currency,
      paymentMethod: params.paymentMethod,
      referenceNumber: params.referenceNumber,
      contactId: bill.supplierId,
      contactName: bill.supplierName,
      billId: bill.id,
      description: `Payment for Bill ${bill.billNumber}`,
      notes: params.notes,
      createdAt: new Date().toISOString(),
    };

    this.transactions.push(tx);
    this.persistAll();
    this.notify();
    return tx;
  }

  // --- Statement of Account (SOA) Generator ---

  public generateCustomerStatement(customerId: string, startDate: string, endDate: string): CustomerStatement {
    const customer = this.getContactById(customerId);
    if (!customer) throw new Error('Customer not found');
    const biz = this.getActiveBusiness();

    // Invoices for this customer
    const customerInvoices = this.invoices.filter(
      (inv) => inv.businessId === this.activeBusinessId && inv.customerId === customerId && inv.status !== 'cancelled' && inv.status !== 'draft'
    );

    // Payments received from this customer
    const customerPayments = this.transactions.filter(
      (tx) => tx.businessId === this.activeBusinessId && tx.contactId === customerId && tx.type === 'payment_received'
    );

    // Calculate Opening Balance prior to startDate:
    // Opening balance = (sum of all invoices prior to startDate) - (sum of all payments prior to startDate)
    const priorInvoicesTotal = customerInvoices
      .filter((inv) => inv.issueDate < startDate)
      .reduce((sum, inv) => sum + inv.totalCents, 0);

    const priorPaymentsTotal = customerPayments
      .filter((tx) => tx.date < startDate)
      .reduce((sum, tx) => sum + tx.amountCents, 0);

    const openingBalanceCents = priorInvoicesTotal - priorPaymentsTotal;

    // Build entries within [startDate, endDate]
    const periodInvoices = customerInvoices.filter((inv) => inv.issueDate >= startDate && inv.issueDate <= endDate);
    const periodPayments = customerPayments.filter((tx) => tx.date >= startDate && tx.date <= endDate);

    interface RawItem {
      date: string;
      type: 'invoice' | 'payment';
      reference: string;
      description: string;
      debitCents: number;
      creditCents: number;
      sortKey: string;
    }

    const rawItems: RawItem[] = [];

    periodInvoices.forEach((inv) => {
      rawItems.push({
        date: inv.issueDate,
        type: 'invoice',
        reference: inv.invoiceNumber,
        description: `Invoice ${inv.invoiceNumber} - ${inv.items[0]?.description || 'Services/Products'}`,
        debitCents: inv.totalCents,
        creditCents: 0,
        sortKey: `${inv.issueDate}-0-${inv.invoiceNumber}`,
      });
    });

    periodPayments.forEach((pmt) => {
      rawItems.push({
        date: pmt.date,
        type: 'payment',
        reference: pmt.referenceNumber || 'PAYMENT',
        description: `Payment received (${pmt.paymentMethod}) - Ref: ${pmt.referenceNumber || 'N/A'}`,
        debitCents: 0,
        creditCents: pmt.amountCents,
        sortKey: `${pmt.date}-1-${pmt.referenceNumber}`,
      });
    });

    // Sort chronologically
    rawItems.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    let currentBalance = openingBalanceCents;
    let totalDebits = 0;
    let totalCredits = 0;

    const entries: StatementEntry[] = rawItems.map((item) => {
      currentBalance = currentBalance + item.debitCents - item.creditCents;
      totalDebits += item.debitCents;
      totalCredits += item.creditCents;

      return {
        date: item.date,
        type: item.type,
        reference: item.reference,
        description: item.description,
        debitCents: item.debitCents,
        creditCents: item.creditCents,
        runningBalanceCents: currentBalance,
      };
    });

    return {
      customer,
      business: biz,
      startDate,
      endDate,
      openingBalanceCents,
      totalDebitsCents: totalDebits,
      totalCreditsCents: totalCredits,
      closingBalanceCents: currentBalance,
      entries,
    };
  }

  // --- Financial Aggregations & Metrics ---

  public getFinancialMetrics(startDate?: string, endDate?: string) {
    const biz = this.getActiveBusiness();
    const invoices = this.getInvoices();
    const transactions = this.getTransactions();
    const bills = this.getBills();

    // Default to this month if not provided
    const today = getTodayDateString();
    const currentYearMonth = today.substring(0, 7); // YYYY-MM

    // Filter transactions within range
    const periodTransactions = transactions.filter((tx) => {
      if (startDate && tx.date < startDate) return false;
      if (endDate && tx.date > endDate) return false;
      if (!startDate && !endDate) {
        return tx.date.startsWith(currentYearMonth);
      }
      return true;
    });

    // Cash received: ONLY actual payments received!
    const cashReceivedCents = periodTransactions
      .filter((tx) => tx.type === 'payment_received')
      .reduce((sum, tx) => sum + tx.amountCents, 0);

    // Cash paid out: ONLY actual payments made!
    const cashPaidOutCents = periodTransactions
      .filter((tx) => tx.type === 'payment_made')
      .reduce((sum, tx) => sum + tx.amountCents, 0);

    const netCashFlowCents = cashReceivedCents - cashPaidOutCents;

    // Total outstanding unpaid invoices across the active business
    const activeUnpaidInvoices = invoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled' && i.status !== 'draft');
    const totalOutstandingInvoicesCents = activeUnpaidInvoices.reduce((sum, i) => sum + i.balanceDueCents, 0);

    // Overdue invoices
    const overdueInvoices = activeUnpaidInvoices.filter((i) => isDateOverdue(i.dueDate));
    const totalOverdueInvoicesCents = overdueInvoices.reduce((sum, i) => sum + i.balanceDueCents, 0);

    // Total Accounts Payable (unpaid supplier bills)
    const unpaidBills = bills.filter((b) => b.status !== 'paid');
    const totalAccountsPayableCents = unpaidBills.reduce((sum, b) => sum + b.balanceDueCents, 0);

    return {
      currency: biz.currency,
      cashReceivedCents,
      cashPaidOutCents,
      netCashFlowCents,
      totalOutstandingInvoicesCents,
      outstandingInvoiceCount: activeUnpaidInvoices.length,
      totalOverdueInvoicesCents,
      overdueInvoiceCount: overdueInvoices.length,
      totalAccountsPayableCents,
      unpaidBillCount: unpaidBills.length,
    };
  }
}

export const storage = new StorageManager();
