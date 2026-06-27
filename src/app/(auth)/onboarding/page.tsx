import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/firebase/session';
import OnboardingContent from './OnboardingContent';

export default async function OnboardingPage() {
  const session = await verifySession();
  if (!session) redirect('/login');
  return <OnboardingContent email={session.email ?? ''} />;
}
