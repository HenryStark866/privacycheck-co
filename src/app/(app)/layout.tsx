import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/firebase/session';
import Link from 'next/link';
import Image from 'next/image';
import { Shield, LayoutDashboard, Building2 } from 'lucide-react';
import LogoutButton from '@/components/LogoutButton';
import AIChat from '@/components/AIChat';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await verifySession();
  if (!user) redirect('/login');

  // Extraer iniciales del email
  const initials = (user.email ?? '?').slice(0, 2).toUpperCase();
  const displayEmail = user.email ?? '';

  return (
    <div className="min-h-screen flex bg-[#f5f5f7]">
      {/* Sidebar */}
      <aside className="w-[232px] shrink-0 bg-white/80 backdrop-blur border-r border-gray-200/80 flex flex-col sticky top-0 h-screen">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-100">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-brand-600 shadow-sm">
            <Shield className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight tracking-tight">PrivacyCheck CO</p>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Ley 1581 · 2012</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2.5 space-y-0.5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2.5 pt-1.5 pb-1">Navegación</p>
          <NavLink href="/dashboard" icon={<LayoutDashboard className="w-4 h-4" />}>Dashboard</NavLink>
          <NavLink href="/companies" icon={<Building2 className="w-4 h-4" />}>Empresas</NavLink>
        </nav>

        {/* Powered by */}
        <div className="px-4 pt-2 pb-1 flex items-center gap-1.5 opacity-30 hover:opacity-60 transition-opacity">
          <span className="text-[9px] text-gray-500 uppercase tracking-widest font-medium whitespace-nowrap">Evento</span>
          <Image
            src="/logocalvaltac.png"
            alt="Sintaxis TI"
            width={60}
            height={60}
            className="h-5 w-auto grayscale"
          />
        </div>

        {/* User */}
        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center gap-2.5 px-2 py-2 mb-1.5">
            {/* Avatar */}
            <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-brand-700">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-800 truncate leading-tight">{displayEmail}</p>
              <p className="text-[10px] text-gray-400 leading-tight">Sesión activa</p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto min-w-0">
        <div className="max-w-5xl mx-auto px-6 py-8">
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
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all duration-150"
    >
      <span className="text-gray-400">{icon}</span>
      {children}
    </Link>
  );
}