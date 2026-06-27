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
    <div className="min-h-screen flex bg-slate-50 bg-grid-pattern text-slate-800">
      {/* Sidebar */}
      <aside className="w-[232px] shrink-0 bg-white/80 backdrop-blur-xl border-r border-slate-200 flex flex-col sticky top-0 h-screen shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-6 border-b border-slate-100">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-brand-50 shadow-[0_0_15px_rgba(20,184,166,0.1)] border border-brand-200">
            <Shield className="w-4.5 h-4.5 text-brand-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 leading-tight tracking-widest uppercase">PrivacyCheck</p>
            <p className="text-[9px] text-brand-600 font-medium uppercase tracking-[0.2em]">Ley 1581 · 2012</p>
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
            src="/logo-cavaltec.jpeg"
            alt="Sintaxis TI"
            width={60}
            height={60}
            className="h-5 w-auto grayscale mix-blend-multiply opacity-80"
          />
        </div>

        {/* User */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 mb-3">
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-[11px] font-bold text-brand-600">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-slate-700 truncate leading-tight uppercase tracking-wider">{displayEmail}</p>
              <p className="text-[9px] text-brand-600 leading-tight uppercase tracking-widest mt-0.5 flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-brand-500 animate-pulse" />
                Online
              </p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto min-w-0 relative">
        <div className="absolute top-[-20%] left-[20%] w-[500px] h-[500px] rounded-full opacity-5 blur-[120px] bg-brand-400 pointer-events-none" />
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
      className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700 transition-all duration-300 border border-transparent hover:border-brand-200"
    >
      <span className="text-slate-400 group-hover:text-brand-500 transition-all duration-300">
        {icon}
      </span>
      <span className="tracking-wide">{children}</span>
    </Link>
  );
}