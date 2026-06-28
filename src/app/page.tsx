import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/firebase/session';
import Landing from '@/components/Landing';

export default async function HomePage() {
  const user = await verifySession();
  if (user) redirect('/dashboard');
  return <Landing />;
}
