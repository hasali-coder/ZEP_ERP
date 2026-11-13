import {businessLogoBytes} from './BusinessLogo';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import type {Quotation,CreditNote,Contact,Business,Invoice} from '../types';
import {downloadInvoicePdf} from './invoicePdf';

export async function downloadQuotationPdf(q:Quotation,c:Contact|undefined,b:Business){
 const asInvoice:Invoice={id:q.id,businessId:q.businessId,invoiceNumber:q.quoteNumber,customerId:q.customerId,
  customerName:q.customerName,issueDate:q.issueDate,dueDate:q.expiryDate,currency:q.currency,
  items:q.items,subtotalCents:q.subtotalCents,discountCents:q.discountCents,taxCents:q.taxCents,
  totalCents:q.totalCents,amountPaidCents:0,balanceDueCents:0,status:q.status==='draft'?'draft':'sent',
  notes:q.notes,paymentTerms:'Validity until '+q.expiryDate,createdAt:q.createdAt,updatedAt:q.createdAt,
  businessSnapshot:q.businessSnapshot,customerSnapshot:q.customerSnapshot};
 await downloadInvoicePdf(asInvoice,c,b,{kind:'quotation'});
}
const safe=(s:unknown)=>String(s??'').replace(/[\u2013\u2014]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[^\x20-\x7E]/g,' ');
export async function downloadCreditNotePdf(n:CreditNote,c:Contact|undefined,b:Business,inv?:Invoice){
 if(!inv)throw new Error('The original invoice could not be loaded. Open the invoice and retry the credit note PDF export.');
 if(!inv.items?.length)throw new Error('The original invoice has no line items to display.');
 if(inv.currency!==n.currency)throw new Error('The credit note and original invoice use different currencies.');
 // This version issues full credit notes only; never misstate a partial adjustment as a full invoice reversal.
 if(Math.abs(inv.totalCents-n.amountCents)>1)throw new Error('This credit amount differs from the original invoice. Itemised partial credits require a dedicated allocation view.');
 const asInvoice:Invoice={...inv,invoiceNumber:n.creditNumber,issueDate:n.issueDate,
  status:'sent',amountPaidCents:0,balanceDueCents:0,paymentInstructions:undefined,notes:undefined,
  totalCents:n.amountCents};
 await downloadInvoicePdf(asInvoice,c,b,{kind:'credit_note',originalInvoiceNumber:inv.invoiceNumber});
}
