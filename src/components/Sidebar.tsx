'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, MessageSquare, Users, ClipboardCheck, Menu, X } from 'lucide-react';
import LogoutButton from '@/components/LogoutButton';

interface SidebarProps {
  systemRole: string;
  initials: string;
  displayEmail: string;
}

export default function Sidebar({ systemRole, initials, displayEmail }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const NavLink = ({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) => {
    const isActive = pathname === href || pathname.startsWith(href + '/');
    return (
      <Link
        href={href}
        onClick={() => setIsOpen(false)}
        className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-300 border ${
          isActive 
            ? 'bg-brand-50 text-brand-700 border-brand-200' 
            : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700 border-transparent hover:border-brand-200'
        }`}
      >
        <span className={`${isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-brand-500'} transition-all duration-300`}>
          {icon}
        </span>
        <span className="tracking-wide">{children}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200 z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <Image src="/icon-cavaltec.png" alt="Logo" width={32} height={32} className="w-6 h-6 object-contain" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 leading-tight tracking-widest uppercase">PrivacyCheck</p>
            <p className="text-[9px] text-brand-600 font-medium uppercase tracking-[0.2em]">Ley 1581 · 2012</p>
          </div>
        </div>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 -mr-2 text-slate-600 hover:text-brand-600 transition-colors"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[260px] lg:w-[232px] bg-white/95 lg:bg-white/80 backdrop-blur-xl border-r border-slate-200 flex flex-col h-screen shadow-[4px_0_24px_rgba(0,0,0,0.05)] lg:shadow-[4px_0_24px_rgba(0,0,0,0.02)]
        transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo (Desktop only) */}
        <div className="hidden lg:flex items-center gap-3 px-5 py-6 border-b border-slate-100">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <Image src="/icon-cavaltec.png" alt="Logo" width={32} height={32} className="w-6 h-6 object-contain" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 leading-tight tracking-widest uppercase">PrivacyCheck</p>
            <p className="text-[9px] text-brand-600 font-medium uppercase tracking-[0.2em]">Ley 1581 · 2012</p>
          </div>
        </div>
        
        {/* Mobile Spacer */}
        <div className="lg:hidden h-4" />

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-thin">
          <p className="text-[10px] lg:text-[9px] font-bold text-slate-500 uppercase tracking-[0.15em] px-2 pt-2 pb-2">Sistema Central</p>
          <NavLink href="/dashboard" icon={<LayoutDashboard className="w-4.5 h-4.5 lg:w-4 lg:h-4" />}>Panel Principal</NavLink>
          <NavLink href="/companies" icon={<Building2 className="w-4.5 h-4.5 lg:w-4 lg:h-4" />}>Entidades</NavLink>
          <NavLink href="/evaluations" icon={<ClipboardCheck className="w-4.5 h-4.5 lg:w-4 lg:h-4" />}>Diagnósticos</NavLink>
          <NavLink href="/whatsapp" icon={<MessageSquare className="w-4.5 h-4.5 lg:w-4 lg:h-4" />}>Gateway WhatsApp</NavLink>
          {systemRole === 'admin' && (
            <>
              <p className="text-[10px] lg:text-[9px] font-bold text-brand-600 uppercase tracking-[0.15em] px-2 pt-4 pb-2">Administración</p>
              <NavLink href="/admin/users" icon={<Users className="w-4.5 h-4.5 lg:w-4 lg:h-4" />}>Usuarios</NavLink>
            </>
          )}
        </nav>

        {/* Powered by */}
        <div className="px-5 pt-3 pb-2 flex flex-col gap-1.5 opacity-60 lg:opacity-40 hover:opacity-100 transition-opacity duration-300">
          <span className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">Infraestructura</span>
          <Image
            src="/logo-cavaltec.jpeg"
            alt="Sintaxis TI"
            width={60}
            height={60}
            className="h-5 w-auto grayscale mix-blend-multiply opacity-80"
          />
        </div>

        {/* User */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3 mb-3">
            {/* Avatar */}
            <div className="w-9 h-9 lg:w-8 lg:h-8 rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-[12px] lg:text-[11px] font-bold text-brand-600">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] lg:text-[11px] font-medium text-slate-700 truncate leading-tight uppercase tracking-wider">{displayEmail}</p>
              <p className="text-[10px] lg:text-[9px] text-brand-600 leading-tight uppercase tracking-widest mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 lg:w-1 lg:h-1 rounded-full bg-brand-500 animate-pulse" />
                Online
              </p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
