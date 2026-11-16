import {businessLogoBytes} from './BusinessLogo';
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, degrees } from 'pdf-lib';
import type { Invoice, Contact, Business } from '../types';

const navy=rgb(.055,.105,.20), muted=rgb(.36,.42,.51), border=rgb(.84,.89,.94);
const safe=(s:unknown)=>String(s??'').replace(/[\u2013\u2014]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[^\x20-\x7E]/g,' ');
const money=(minor:number,currency:string)=>`${currency} ${(minor/100).toLocaleString('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const wrap=(text:string,font:PDFFont,size:number,maxWidth:number)=>{
  const result:string[]=[];
  for(const paragraph of safe(text).split('\n')){
    let line='';
    for(const token of paragraph.split(/\s+/)){
      if(!token)continue;
      const candidate=line?line+' '+token:token;
      if(font.widthOfTextAtSize(candidate,size)>maxWidth && line){result.push(line);line=token;}
      else line=candidate;
    }
    result.push(line);
  }
  return result;
};
export async function downloadInvoicePdf(invoice:Invoice, customer:Contact|undefined, business:Business, options?:{kind?:'invoice'|'quotation'|'credit_note';originalInvoiceNumber?:string}){
  const isQuote=options?.kind==='quotation';
  const isCredit=options?.kind==='credit_note';
  const doc=await PDFDocument.create();doc.setCreator('Zep ERP');doc.setProducer('Zep ERP');
  const normal=await doc.embedFont(StandardFonts.Helvetica);
  const bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const pw=595.28, ph=841.89, left=45, right=550;
  const generation=new Date();
  let page!: PDFPage; let y=0; let pageNum=0;
  const makePage=()=>{
    page=doc.addPage([pw,ph]);pageNum++;y=ph-52;
    if(invoice.status==='draft')page.drawText('DRAFT',{
      x:90,y:330,font:bold,size:118,rotate:degrees(35),opacity:.12,color:rgb(.35,.43,.55)
    });
    page.drawText('ZEP ERP  /  FINANCIAL DOCUMENT',{x:left,y:ph-28,font:bold,size:8,color:muted});
    page.drawLine({start:{x:left,y:ph-37},end:{x:right,y:ph-37},color:border,thickness:.6});
  };
  const text=(value:unknown,x:number,yy:number,size=9,weight:PDFFont=normal,color=navy)=>{
    const val=safe(value);
    page.drawText(val,{x,y:yy,size,font:weight,color});
  };
  const colLines=(str:string,x:number,width:number,yy:number,size=9,leading=14,weight:PDFFont=normal)=>{
    for(const line of wrap(str,weight,size,width)) {if(line)text(line,x,yy,size,weight);yy-=leading;}
    return yy;
  };
  const ensure=(height:number)=>{if(y-height<110){makePage();text(`${safe(invoice.invoiceNumber)} · continued`,left,y,10,bold);y-=25;}};
  makePage();
  const documentTitle=isCredit?'CREDIT NOTE':isQuote?(invoice.status==='draft'?'DRAFT QUOTATION':'QUOTATION'):(invoice.status==='draft'?'DRAFT INVOICE':'INVOICE');
  text(documentTitle,pw/2-bold.widthOfTextAtSize(documentTitle,16)/2,y,16,bold);y-=28;
  const snapBusiness=(invoice.businessSnapshot||{}) as Record<string,unknown>;
  const snapCustomer=(invoice.customerSnapshot||{}) as Record<string,unknown>;
  const bc={...business,...Object.fromEntries(Object.entries(snapBusiness).filter(([,v])=>v!==null&&v!==undefined))} as Business & {logo_path?:string; tax_number?:string};
  const cc={...customer,...Object.fromEntries(Object.entries(snapCustomer).filter(([,v])=>v!==null&&v!==undefined))} as Partial<Contact> & {company_name?:string; tax_number?:string};
  const clientName=safe(cc.company_name||cc.companyName||cc.name||invoice.customerName);
  const issuerName=safe(bc.name||business.name);
  const logoUrl=String(bc.logo_path||business.logoUrl||'');
  if (/^(https?:|data:image\/|\/)/i.test(logoUrl)) {
    try {
      const buf=await (await fetch(logoUrl)).arrayBuffer();
      const img=/\.png(\?|$)|data:image\/png/i.test(logoUrl)?await doc.embedPng(buf):await doc.embedJpg(buf);
      const scale=Math.min(70/img.width,32/img.height,1);
      page.drawImage(img,{x:right-img.width*scale,y:ph-110,width:img.width*scale,height:img.height*scale});
    }catch{ /* Keep business details if a configured logo cannot be fetched. */ }
  }
  try{const logo=await businessLogoBytes(invoice.businessId);
    if(logo){const img=logo.kind==='png'?await doc.embedPng(logo.bytes):await doc.embedJpg(logo.bytes);
      const scale=Math.min(85/img.width,40/img.height,1);
      page.drawImage(img,{x:right-img.width*scale,y:ph-112,width:img.width*scale,height:img.height*scale});
    }
  }catch{ /* Continue export if logo cannot be loaded */ }
  text('BILL TO',left,y,8,bold,muted);text('ISSUED BY',340,y,8,bold,muted);y-=18;
  let ly=colLines(clientName,left,235,y,11,16,bold);
  for(const v of [cc.name!==clientName?cc.name:'',cc.address,[cc.city,cc.country].filter(Boolean).join(', '),cc.email,cc.phone,cc.tax_number||cc.taxNumber]){
    if(v)ly=colLines(String(v),left,240,ly,8.5,12);
  }
  let ry=colLines(issuerName,340,205,y,11,16,bold);
  for(const v of [bc.address,[bc.city,bc.country].filter(Boolean).join(', '),bc.email,bc.phone,bc.tax_number||bc.taxNumber]){
    if(v)ry=colLines(String(v),340,206,ry,8.5,12);
  }
  y=Math.min(ly,ry)-16;
  page.drawLine({start:{x:left,y},end:{x:right,y},color:border,thickness:.7});y-=23;
  const facts=[[isCredit?'Credit Note Number':isQuote?'Quotation Number':'Invoice Number',invoice.invoiceNumber],['Issue Date',invoice.issueDate],[isCredit?'Original Invoice':isQuote?'Valid Until':'Due Date',isCredit?(options?.originalInvoiceNumber||'-'):invoice.dueDate],['Currency',invoice.currency],['Terms',isCredit?'Full credit':invoice.paymentTerms||'-']];
  for(let i=0;i<facts.length;i++){
    const x=left+i*102;
    text(facts[i][0],x,y,7.2,bold,muted);
    const factLines=wrap(facts[i][1],normal,8.2,96);
    factLines.slice(0,2).forEach((ln,j)=>text(ln,x,y-13-j*11,8.2));
  }
  y-=50;
  const headings=[['DESCRIPTION',left],['QTY',340],['UNIT PRICE',399],['TAX',483],['TOTAL',520]] as const;
  page.drawRectangle({x:left,y:y-12,width:505,height:28,color:rgb(.94,.96,.985)});
  headings.forEach(([h,x])=>text(h,x,y-2,7,bold,muted));y-=39;
  for(const it of invoice.items){
    const desc=wrap(it.description,normal,8.4,270);
    const h=Math.max(27,desc.length*12+10);
    ensure(h+10);
    desc.forEach((line,i)=>text(line,left,y-9-i*12,8.4));
    text(it.quantity,343,y-9,8.4);
    text(money(it.unitPriceCents,invoice.currency).replace(invoice.currency+' ',''),392,y-9,8.4);
    text(`${it.taxRatePercent}%`,485,y-9,8.4);
    text(money(Math.round(it.quantity*it.unitPriceCents*(1-(it.discountPercent||0)/100)),invoice.currency).replace(invoice.currency+' ',''),511,y-9,8.4);
    y-=h;
    page.drawLine({start:{x:left,y},end:{x:right,y},thickness:.5,color:border});
  }
  y-=20;ensure(105);
  const summary=(isQuote?[['Subtotal',invoice.subtotalCents],['Discount',-invoice.discountCents],['Tax',invoice.taxCents],['Quotation Total',invoice.totalCents]]:isCredit?[['Subtotal',invoice.subtotalCents],['Discount',-invoice.discountCents],['Tax',invoice.taxCents],['Credit Total',invoice.totalCents]]:[['Subtotal',invoice.subtotalCents],['Discount',-invoice.discountCents],['Tax',invoice.taxCents],['Total',invoice.totalCents],['Paid',invoice.amountPaidCents],['Balance due',invoice.balanceDueCents]]) as [string,number][];
  for(const [label,value] of summary){
    const heavy=label==='Total'||label==='Balance due'||label==='Quotation Total'||label==='Credit Total';
    text(label,355,y,heavy?10:8.5,heavy?bold:normal);
    const t=money(value,invoice.currency);
    text(t,right-(heavy?bold:normal).widthOfTextAtSize(t,heavy?10:8.5),y,heavy?10:8.5,heavy?bold:normal);
    y-=heavy?24:18;
  }
  y-=10;ensure(95);
  if(!isQuote&&!isCredit){text('PAYMENT INSTRUCTIONS',left,y,8,bold,muted);y-=15;
  y=colLines(invoice.paymentInstructions||business.paymentInstructions||'Please reference the invoice number when paying.',left,485,y,8.3,12);
  y-=12;}
  if(invoice.notes){text('NOTES',left,y,8,bold,muted);y-=15;y=colLines(invoice.notes,left,485,y,8.3,12);}
  // Dedicated footer on every page, with unique page labels.
  const count=doc.getPageCount();
  doc.getPages().forEach((pg,i)=>{
    pg.drawLine({start:{x:left,y:67},end:{x:right,y:67},thickness:.6,color:border});
    pg.drawText(safe(`Generated at ${generation.toLocaleString('en-GB',{timeZone:'Africa/Nairobi',dateStyle:'medium',timeStyle:'medium'})} EAT`),{x:left,y:52,font:normal,size:7.5,color:muted});
    pg.drawText('This is an electronically generated document. No signature is required.',{x:left,y:39,font:normal,size:7.3,color:muted});
    pg.drawText(`${i+1} / ${count}`,{x:523,y:39,font:normal,size:7.2,color:muted});
  });
  doc.setTitle(`${isCredit?'Credit Note':isQuote?'Quotation':'Invoice'} ${invoice.invoiceNumber}`);
  const bytes=await doc.save();
  const pdfBuffer=new ArrayBuffer(bytes.length);
  new Uint8Array(pdfBuffer).set(bytes);
  const blob=new Blob([pdfBuffer],{type:'application/pdf'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`${invoice.invoiceNumber}.pdf`;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
