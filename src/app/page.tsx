import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/firebase/session';

export default async function HomePage() {
  const user = await verifySession();
  if (user) redirect('/dashboard');
  redirect('/login');
}
