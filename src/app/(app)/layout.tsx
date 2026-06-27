import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/firebase/session';
import { adminDb } from '@/lib/firebase/admin';
import AIChat from '@/components/AIChat';
import CartoonBackground from '@/components/CartoonBackground';
import Sidebar from '@/components/Sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await verifySession();
  if (!user) redirect('/login');

  const userSnap = await adminDb.collection('users').doc(user.uid).get();
  const userData = userSnap.data();

  if (userData?.isApproved === false && userData?.systemRole !== 'admin') {
    redirect('/pending-approval');
  }

  const systemRole = userData?.systemRole || 'user';
  const initials = (user.email ?? '?').slice(0, 2).toUpperCase();
  const displayEmail = user.email ?? '';

  return (
    <div className="min-h-screen flex bg-slate-50 bg-grid-pattern text-slate-800">
      <Sidebar 
        systemRole={systemRole}
        initials={initials}
        displayEmail={displayEmail}
      />

      {/* Main */}
      <main id="contenido-principal" className="flex-1 overflow-auto min-w-0 relative pt-16 lg:pt-0">
        <CartoonBackground />
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-10 relative z-10">
          {children}
        </div>
      </main>

      <AIChat />
    </div>
  );
}