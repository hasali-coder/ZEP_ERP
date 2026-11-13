import React from 'react';
import {LayoutDashboard,FileText,FileCheck2,FileMinus2,Receipt,ArrowLeftRight,Users2,BarChart3,Settings,Building2,ArrowRight,X,Wallet} from 'lucide-react';
import {useFinancial} from '../../context/FinancialContext';
export type NavTab='overview'|'invoices'|'credit_notes'|'quotations'|'receipts'|'expenses'|'transactions'|'contacts'|'reports'|'settings' | 'integrations';
interface SidebarProps {currentTab:NavTab;onSelectTab:(tab:NavTab)=>void;isOpenMobile:boolean;onCloseMobile:()=>void;onOpenCreateBusinessModal:()=>void;}
const groups:{title:string;links:{id:NavTab;label:string;icon:any}[]}[]=[
 {title:'WORKSPACE',links:[{id:'overview',label:'Overview',icon:LayoutDashboard}]},
 {title:'SALES & RECEIVABLES',links:[{id:'quotations',label:'Quotations',icon:FileCheck2},{id:'invoices',label:'Invoices',icon:FileText},{id:'credit_notes',label:'Credit Notes',icon:FileMinus2},{id:'receipts',label:'Receipts',icon:Receipt}]},
 {title:'PAYMENTS & EXPENSES',links:[{id:'transactions',label:'Transactions',icon:ArrowLeftRight},{id:'expenses',label:'Expenses & Bills',icon:Wallet}]},
 {title:'DIRECTORY & REPORTS',links:[{id:'contacts',label:'Customers & Vendors',icon:Users2},{id:'reports',label:'Financial Reports & SOA',icon:BarChart3}]},
 {title:'ADMINISTRATION',links:[{id:'settings',label:'Settings',icon:Settings}]}
];
export const Sidebar:React.FC<SidebarProps>=({currentTab,onSelectTab,isOpenMobile,onCloseMobile})=>{
 const {activeBusiness}=useFinancial();
 return <>
 {isOpenMobile&&<div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden" onClick={onCloseMobile}/>}
 <aside className={`fixed left-0 top-0 bottom-0 z-50 flex w-64 flex-col overflow-y-auto bg-[#0D1B33] text-white no-print border-r border-[#1B2A45] transition-transform lg:translate-x-0 ${isOpenMobile?'translate-x-0':'-translate-x-full'}`}>
  <div className="flex items-center justify-between px-4 h-16 shrink-0 border-b border-[#1B2A45]"><a href="/workspaces" className="flex items-center gap-2.5"><img src="/zep-erp-lockup-on-dark.png" alt="ZEP ERP" className="h-9 w-auto max-w-[185px] object-contain" /><div></div></a><button className="lg:hidden text-[#ACC0D8]" onClick={onCloseMobile}><X className="w-5 h-5"/></button></div>
  <div className="p-3 border-b border-[#1B2A45]"><a href="/workspaces" className="flex items-center justify-between bg-[#162744] border border-white/5 rounded-md p-2"><span className="flex min-w-0 items-center gap-2"><Building2 className="h-4 w-4 shrink-0 text-[#8DA0B8]"/><span className="min-w-0"><strong className="block truncate text-xs">{activeBusiness.name}</strong><small className="text-[10px] text-[#8DA0B8]">{activeBusiness.currency} · Switch business</small></span></span><ArrowRight className="w-4 h-4 shrink-0 text-[#8DA0B8]"/></a></div>
  <nav aria-label="Financial navigation" className="flex-1 px-3 py-2">{groups.map(g=><section key={g.title} className="mb-3"><h2 className="px-3 pt-3 pb-1.5 text-[10px] tracking-[.11em] font-semibold text-[#7E94B3]">{g.title}</h2>{g.links.map(item=>{const Icon=item.icon;const active=currentTab===item.id;return <button key={item.id} type="button" onClick={()=>{onSelectTab(item.id);onCloseMobile();}} aria-current={active?'page':undefined} className={`flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-[13px] font-medium transition-colors ${active?'bg-[#244A73] text-white':'text-[#AFC0D4] hover:bg-[#162744] hover:text-white'}`}><Icon className="w-4 h-4 shrink-0"/><span>{item.label}</span></button>;})}</section>)}
        <button type="button" onClick={() => { onSelectTab('integrations'); onCloseMobile(); }} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-left transition-colors ${currentTab==='integrations'?'bg-[#244A73] text-white':'text-[#A0AEC0] hover:bg-[#162744] hover:text-white'}`}>
          <span aria-hidden="true" className="w-4 text-center">↔</span><span>Integrations</span>
        </button>
</nav>
  <div className="shrink-0 border-t border-[#1B2A45] p-3 flex justify-between text-xs text-[#8DA0B8]"><span>ZEP ERP</span><a href="/workspaces" className="hover:text-white">All businesses</a></div>
 </aside></>;
};
