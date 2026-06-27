import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/firebase/session';
import Link from 'next/link';
import Image from 'next/image';
import { Shield, LayoutDashboard, Building2, MessageSquare } from 'lucide-react';
import LogoutButton from '@/components/LogoutButton';
import AIChat from '@/components/AIChat';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await verifySession();
  if (!user) redirect('/login');

  // Extraer iniciales del email
  const initials = (user.email ?? '?').slice(0, 2).toUpperCase();
  const displayEmail = user.email ?? '';

  return (
    <div className="min-h-screen flex bg-navy-900 bg-grid-pattern text-slate-200">
      {/* Sidebar */}
      <aside className="w-[232px] shrink-0 bg-slate-900/40 backdrop-blur-xl border-r border-white/5 flex flex-col sticky top-0 h-screen shadow-[4px_0_24px_rgba(0,0,0,0.5)] z-20">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-6 border-b border-white/5">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-brand-500/20 shadow-[0_0_15px_rgba(45,212,191,0.2)] border border-brand-400/30">
            <Shield className="w-4.5 h-4.5 text-brand-400 drop-shadow-[0_0_8px_rgba(45,212,191,0.8)]" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight tracking-widest uppercase">PrivacyCheck</p>
            <p className="text-[9px] text-brand-400 font-medium uppercase tracking-[0.2em]">Ley 1581 · 2012</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.15em] px-2 pt-2 pb-2">Sistema Central</p>
          <NavLink href="/dashboard" icon={<LayoutDashboard className="w-4 h-4" />}>Panel Principal</NavLink>
          <NavLink href="/companies" icon={<Building2 className="w-4 h-4" />}>Entidades</NavLink>
          <NavLink href="/whatsapp" icon={<MessageSquare className="w-4 h-4" />}>Gateway WhatsApp</NavLink>
        </nav>

        {/* Powered by */}
        <div className="px-5 pt-3 pb-2 flex flex-col gap-1.5 opacity-40 hover:opacity-100 transition-opacity duration-300">
          <span className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">Infraestructura</span>
          <Image
            src="/logocalvaltac.png"
            alt="Sintaxis TI"
            width={60}
            height={60}
            className="h-5 w-auto brightness-200 contrast-150 grayscale-0"
          />
        </div>

        {/* User */}
        <div className="p-4 border-t border-white/5 bg-black/20">
          <div className="flex items-center gap-3 mb-3">
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(45,212,191,0.15)]">
              <span className="text-[11px] font-bold text-brand-300">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-slate-200 truncate leading-tight uppercase tracking-wider">{displayEmail}</p>
              <p className="text-[9px] text-brand-400 leading-tight uppercase tracking-widest mt-0.5 flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-brand-400 animate-pulse" />
                Online
              </p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto min-w-0 relative">
        <div className="absolute top-[-20%] left-[20%] w-[500px] h-[500px] rounded-full opacity-10 blur-[120px] bg-brand-500 pointer-events-none" />
        <div className="max-w-5xl mx-auto px-8 py-10 relative z-10">
          {children}
        </div>
      </main>

      <AIChat />
    </div>
  );
}

function NavLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-slate-400 hover:bg-brand-500/10 hover:text-white transition-all duration-300 border border-transparent hover:border-brand-500/20"
    >
      <span className="text-slate-500 group-hover:text-brand-400 group-hover:drop-shadow-[0_0_8px_rgba(45,212,191,0.8)] transition-all duration-300">
        {icon}
      </span>
      <span className="tracking-wide">{children}</span>
    </Link>
  );
}