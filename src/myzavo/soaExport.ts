import {businessLogoBytes} from './BusinessLogo';
import {PDFDocument, StandardFonts, rgb} from 'pdf-lib';

export type StatementLine = { date: string; ref: string; currency: string; debit: number; credit: number; description?: string };
export type StatementExport = {
  business: { id?:string; name: string; address?: string; city?: string; country?: string; email?: string; phone?: string; taxNumber?: string };
  customer: { name: string; companyName?: string; address?: string; email?: string; customerCode?: string };
  from: string; to: string; lines: StatementLine[]; openingBalances?: Record<string,number>;
};
const escapeXml=(s:unknown)=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
const fmt=(minor:number)=>((Number(minor)||0)/100).toLocaleString('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2});
const pdfText=(s:unknown)=>String(s??'').replace(/[^\x20-\x7e]/g,' ');
const safeFilename=(s:string)=>s.replace(/[^a-z0-9-_]+/gi,'_').replace(/^_+|_+$/g,'').slice(0,56)||'Customer';
const fileStem=(a:StatementExport)=>`SOA_${safeFilename(a.customer.companyName||a.customer.name)}_${a.from}_to_${a.to}`;
const save=(data:Uint8Array,mime:string,name:string)=>{
  const buf=new ArrayBuffer(data.length);new Uint8Array(buf).set(data);
  const u=URL.createObjectURL(new Blob([buf],{type:mime}));const link=document.createElement('a');
  link.href=u;link.download=name;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(u),60000);
};
function groups(a:StatementExport){
  const currencies=[...new Set([...a.lines.map(l=>l.currency),...Object.keys(a.openingBalances||{})])].filter(Boolean).sort();
  return currencies.map(currency=>{
    const lines=a.lines.filter(l=>l.currency===currency).sort((x,y)=>x.date.localeCompare(y.date)||x.ref.localeCompare(y.ref));
    const opening=(a.openingBalances?.[currency]||0)+lines.filter(l=>l.date<a.from).reduce((n,l)=>n+l.debit-l.credit,0);
    let running=opening;
    const rows=lines.filter(l=>l.date>=a.from&&l.date<=a.to).map(l=>({ ...l, running:(running+=l.debit-l.credit) }));
    return {currency,opening,rows,closing:running,totalDebit:rows.reduce((n,r)=>n+r.debit,0),totalCredit:rows.reduce((n,r)=>n+r.credit,0)};
  });
}
export async function downloadSOAPdf(a:StatementExport):Promise<void>{
  const doc=await PDFDocument.create();const regular=await doc.embedFont(StandardFonts.Helvetica);
  const bold=await doc.embedFont(StandardFonts.HelveticaBold);const navy=rgb(.06,.11,.20),muted=rgb(.40,.46,.54),line=rgb(.79,.84,.89),light=rgb(.95,.97,.99);
  const pageWidth=842,pageHeight=595,left=36,right=806;let pg=doc.addPage([pageWidth,pageHeight]);let y=0;let pageNumber=0;
  const draw=(text:string,x:number,atY:number,size=9,isBold=false,align:'left'|'right'='left')=>{
    const font=isBold?bold:regular;const v=pdfText(text);const width=font.widthOfTextAtSize(v,size);
    pg.drawText(v,{x:align==='right'?x-width:x,y:atY,size,font,color:isBold?navy:muted,maxWidth:align==='right'?Math.max(x-left,1):right-x});
  };
  const horiz=(atY:number)=>pg.drawLine({start:{x:left,y:atY},end:{x:right,y:atY},thickness:.7,color:line});
  const newPage=()=>{if(pageNumber>0)pg=doc.addPage([pageWidth,pageHeight]);pageNumber++;y=pageHeight-42;
    draw('STATEMENT OF ACCOUNT',left,y,17,true);draw(`Page ${pageNumber}`,right,y+2,8,false,'right');y-=23;horiz(y);y-=19;};
  const header=()=>{newPage();
    draw(a.business.name,left,y,12,true);draw(`Period: ${a.from} to ${a.to}`,right,y+2,9,false,'right');y-=17;
    const biz=[a.business.address,a.business.city,a.business.country,a.business.email].filter(Boolean).join(' | ');
    if(biz){draw(biz.slice(0,125),left,y,8);y-=15;}
    draw(`Customer: ${a.customer.companyName||a.customer.name}`,left,y,10,true);y-=16;
    if(a.customer.customerCode){draw(`Account: ${a.customer.customerCode}`,left,y,8);y-=14;}
    y-=8;
  };
  const columns=[left,124,246,437,551,663,right];
  const tableHeader=()=>{pg.drawRectangle({x:left,y:y-25,width:right-left,height:25,color:light});
    ['Date','Reference','Description','Debit','Credit','Balance'].forEach((v,i)=>draw(v,i>2?columns[i+1]-7:columns[i]+7,y-16,8,true,i>2?'right':'left'));
    horiz(y-25);y-=25;};
  const cell=(txt:string,i:number)=>{const x=i>2?columns[i+1]-7:columns[i]+7;let value=txt;
    const maxWidth=columns[i+1]-columns[i]-14;while(value.length>3&&regular.widthOfTextAtSize(pdfText(value),8)>maxWidth)value=value.slice(0,-4)+'...';
    draw(value,x,y-15,8,false,i>2?'right':'left');};
  const row=(values:string[],isSummary=false)=>{if(y<73){newPage();tableHeader();}
    if(isSummary)pg.drawRectangle({x:left,y:y-24,width:right-left,height:24,color:light});
    values.forEach((v,i)=>cell(v,i));y-=24;horiz(y);};
  header();
  try{const logo=await businessLogoBytes(a.business.id||'');if(logo){const image=logo.kind==='png'?await doc.embedPng(logo.bytes):await doc.embedJpg(logo.bytes);const scale=Math.min(80/image.width,38/image.height,1);pg.drawImage(image,{x:right-image.width*scale,y:pageHeight-105,width:image.width*scale,height:image.height*scale});}}catch{}
  const blocks=groups(a);
  if(!blocks.length)draw('No issued invoices, credits or payments found for this customer.',left,y,10);
  for(const g of blocks){if(y<115)newPage();
    draw(`${g.currency}  |  Opening balance: ${fmt(g.opening)}`,left,y,10,true);y-=25;tableHeader();
    if(!g.rows.length)row(['','', 'No activity in selected period','—','—',fmt(g.opening)]);
    for(const r of g.rows)row([r.date,r.ref,r.description||'',r.debit?fmt(r.debit):'—',r.credit?fmt(r.credit):'—',fmt(r.running)]);
    row(['','','Closing balance',fmt(g.totalDebit),fmt(g.totalCredit),fmt(g.closing)],true);y-=22;
  }
  for(let i=0;i<doc.getPageCount();i++){
    const p=doc.getPage(i);p.drawLine({start:{x:left,y:43},end:{x:right,y:43},thickness:.6,color:line});
    p.drawText(`Generated ${new Date().toLocaleString('en-GB',{timeZone:'Africa/Nairobi'})} EAT | Electronic statement | ${i+1}/${doc.getPageCount()}`,{x:left,y:29,size:7,font:regular,color:muted});
  }
  const b=await doc.save();save(new Uint8Array(b), 'application/pdf',fileStem(a)+'.pdf');
}
// Build a genuine, uncompressed DOCX (ZIP/OOXML), with no third-party runtime dependency.
const utf8=(s:string)=>new TextEncoder().encode(s);
const crc32=(arr:Uint8Array)=>{let c=0xffffffff;for(const b of arr){c^=b;for(let i=0;i<8;i++)c=(c&1)?(c>>>1)^0xedb88320:c>>>1;}return (c^0xffffffff)>>>0;};
const concat=(parts:Uint8Array[])=>{const total=parts.reduce((n,v)=>n+v.length,0),out=new Uint8Array(total);let off=0;for(const p of parts){out.set(p,off);off+=p.length;}return out;};
function zipStored(entries:{name:string;content:string|Uint8Array}[]){const locals:Uint8Array[]=[],centrals:Uint8Array[]=[];let offset=0,centralSize=0;
  for(const e of entries){const name=utf8(e.name),data=typeof e.content==='string'?utf8(e.content):e.content,crc=crc32(data);
    const local=new Uint8Array(30+name.length),a=new DataView(local.buffer);
    a.setUint32(0,0x04034b50,true);a.setUint16(4,20,true);a.setUint16(6,0,true);a.setUint16(8,0,true);a.setUint32(14,crc,true);a.setUint32(18,data.length,true);a.setUint32(22,data.length,true);a.setUint16(26,name.length,true);local.set(name,30);
    const cd=new Uint8Array(46+name.length),b=new DataView(cd.buffer);
    b.setUint32(0,0x02014b50,true);b.setUint16(4,20,true);b.setUint16(6,20,true);b.setUint32(16,crc,true);b.setUint32(20,data.length,true);b.setUint32(24,data.length,true);b.setUint16(28,name.length,true);b.setUint32(42,offset,true);cd.set(name,46);
    locals.push(local,data);centrals.push(cd);offset+=local.length+data.length;centralSize+=cd.length;
  }
  const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);
  return concat([...locals,...centrals,end]);
}
const para=(s:string,bold=false,sz=20)=>`<w:p><w:pPr><w:spacing w:after="90"/></w:pPr><w:r>${bold?'<w:rPr><w:b/><w:sz w:val="'+sz+'"/></w:rPr>':''}<w:t xml:space="preserve">${escapeXml(s)}</w:t></w:r></w:p>`;
const wordTable=(rows:string[][])=>{
 const borders='<w:tblBorders>'+['top','left','bottom','right','insideH','insideV'].map(k=>`<w:${k} w:val="single" w:sz="4" w:color="B5C5D5"/>`).join('')+'</w:tblBorders>';
 return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${borders}</w:tblPr>${rows.map((row,i)=>`<w:tr>${row.map(s=>`<w:tc><w:tcPr><w:tcW w:w="1900" w:type="dxa"/></w:tcPr><w:p><w:r>${i===0?'<w:rPr><w:b/></w:rPr>':''}<w:t xml:space="preserve">${escapeXml(s)}</w:t></w:r></w:p></w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`;
};
export async function downloadSOAWord(a:StatementExport):Promise<void>{
 let logo:null|{bytes:Uint8Array;kind:'png'|'jpg'}=null;
 try{logo=await businessLogoBytes(a.business.id||'');}catch{}
 const picture=logo?`<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="1371600" cy="457200"/><wp:docPr id="1" name="Business Logo"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="business-logo"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1371600" cy="457200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`:'';
 const blocks=groups(a);let body=para('STATEMENT OF ACCOUNT',true,30)+picture+para(a.business.name,true,24);
 body+=para([a.business.address,a.business.city,a.business.country].filter(Boolean).join(', '));
 if(a.business.email)body+=para(a.business.email);
 body+=para(`Customer: ${a.customer.companyName||a.customer.name}`,true)+para(`Statement period: ${a.from} to ${a.to}`);
 if(a.customer.customerCode)body+=para(`Customer reference: ${a.customer.customerCode}`);
 for(const g of blocks){body+=para(`${g.currency} | Opening balance: ${fmt(g.opening)}`,true);
  const rows=[['Date','Reference','Description','Debit','Credit','Balance']];
  for(const r of g.rows)rows.push([r.date,r.ref,r.description||'',r.debit?fmt(r.debit):'—',r.credit?fmt(r.credit):'—',fmt(r.running)]);
  rows.push(['','','Closing balance',fmt(g.totalDebit),fmt(g.totalCredit),fmt(g.closing)]);body+=wordTable(rows);
 }
 if(!blocks.length)body+=para('No issued invoices, credits or payments found for this customer.');
 body+=para(`Electronically generated ${new Date().toLocaleString('en-GB',{timeZone:'Africa/Nairobi'})} EAT`);
 const doc=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="850" w:bottom="850" w:left="850" w:right="850"/></w:sectPr></w:body></w:document>`;
 const zip=zipStored([
  {name:'[Content_Types].xml',content:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/></Types>'},
  {name:'_rels/.rels',content:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'},
  {name:'word/document.xml',content:doc},
  ...(logo?[{name:'word/_rels/document.xml.rels',content:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.'+(logo.kind==='png'?'png':'jpg')+'"/></Relationships>'},
    {name:'word/media/logo.'+(logo.kind==='png'?'png':'jpg'),content:logo.bytes}]:[]),
 ]);
 save(zip,'application/vnd.openxmlformats-officedocument.wordprocessingml.document',fileStem(a)+'.docx');
}
