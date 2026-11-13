export type CurrencyCode = 'KES' | 'USD' | 'EUR' | 'GBP' | 'TZS' | 'UGX' | 'ZAR' | 'CNY' | 'AED' | 'CAD' | 'AUD' | 'INR' | 'CHF' | 'JPY';

export interface Business {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  taxNumber?: string; // e.g. KRA PIN
  currency: CurrencyCode;
  logoUrl?: string;
  paymentInstructions?: string; // Bank details, M-Pesa Till/Paybill, etc.
  notes?: string;
  isDemo?: boolean;
}

export type ContactType = 'customer' | 'supplier' | 'both';

export interface Contact {
  id: string;
  businessId: string;
  type: ContactType;
  name: string;
  companyName?: string;
  email: string;
  phone: string;
  address: string;
  city?: string;
  country?: string;
  taxNumber?: string;
  currencyPreference?: CurrencyCode;
  notes?: string;
  creditTermsDays?: number;
  natureOfBusiness?: string;
  createdByLabel?: string;
  customerCode?: string;
  vendorCode?: string;
  isActive?: boolean;
  createdAt: string;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number; // Stored in minor currency units (cents)
  taxRatePercent: number; // e.g. 16 for 16% VAT
  discountPercent?: number; // Optional item discount
}

export type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';

export interface Invoice {
  id: string;
  businessId: string;
  invoiceNumber: string; // e.g. INV-2026-001
  customerId: string;
  customerName: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  currency: CurrencyCode;
  items: LineItem[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  balanceDueCents: number;
  status: InvoiceStatus;
  paymentTerms?: string;
  notes?: string;
  paymentInstructions?: string;
  createdAt: string;
  updatedAt: string;
  businessSnapshot?: Record<string, unknown>;
  customerSnapshot?: Record<string, unknown>;
}

export interface CreditNote {
  id: string; businessId: string; customerId: string; invoiceId?: string;
  creditNumber: string; issueDate: string; currency: CurrencyCode;
  amountCents: number; reason: string; status: string; createdAt: string;
}

export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'converted';

export interface Quotation {
  id: string;
  businessId: string;
  quoteNumber: string; // e.g. QUO-2026-001
  customerId: string;
  customerName: string;
  issueDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  currency: CurrencyCode;
  items: LineItem[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  status: QuotationStatus;
  notes?: string;
  convertedInvoiceId?: string;
  createdAt: string;
  businessSnapshot?: Record<string,unknown>;
  customerSnapshot?: Record<string,unknown>;
}

export type ExpenseCategory =
  | 'Rent & Utilities'
  | 'Salaries & Wages'
  | 'Cloud & Software'
  | 'Marketing & Ads'
  | 'Office Supplies'
  | 'Travel & Transport'
  | 'Professional Services'
  | 'Taxes & Licenses'
  | 'Equipment & Hardware'
  | 'Other';

export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'M-Pesa' | 'Card' | 'Cheque' | 'Other';

export interface Expense {
  id: string;
  businessId: string;
  description: string;
  amountCents: number;
  currency: CurrencyCode;
  category: ExpenseCategory;
  date: string; // YYYY-MM-DD
  supplierName?: string;
  supplierId?: string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
  createdAt: string;
}

export type BillStatus = 'unpaid' | 'partially_paid' | 'paid' | 'overdue';

export interface SupplierBill {
  id: string;
  businessId: string;
  billNumber: string; // e.g. BILL-2026-001
  supplierId: string;
  supplierName: string;
  issueDate: string;
  dueDate: string;
  currency: CurrencyCode;
  amountCents: number;
  amountPaidCents: number;
  balanceDueCents: number;
  category: ExpenseCategory;
  description: string;
  status: BillStatus;
  notes?: string;
  createdAt: string;
}

export type TransactionType = 'payment_received' | 'payment_made';

export interface FinancialTransaction {
  id: string;
  businessId: string;
  type: TransactionType;
  date: string; // YYYY-MM-DD
  amountCents: number;
  currency: CurrencyCode;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  contactId?: string;
  contactName?: string;
  // Linkages to avoid double counting
  invoiceId?: string; // If received against an invoice
  billId?: string; // If paid against a supplier bill
  expenseId?: string; // If direct expense payment
  description: string;
  notes?: string;
  createdAt: string;
}

export interface StatementEntry {
  date: string;
  type: 'invoice' | 'payment' | 'credit';
  reference: string;
  description: string;
  debitCents: number; // increases balance (e.g. invoice)
  creditCents: number; // decreases balance (e.g. payment)
  runningBalanceCents: number;
}

export interface CustomerStatement {
  customer: Contact;
  business: Business;
  startDate: string;
  endDate: string;
  openingBalanceCents: number;
  totalDebitsCents: number;
  totalCreditsCents: number;
  closingBalanceCents: number;
  entries: StatementEntry[];
}
