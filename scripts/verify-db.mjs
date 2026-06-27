// Muestra el estado actual de Firestore para verificar el setup
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
if (!getApps().length) {
  initializeApp({ credential: cert({ projectId: process.env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey }) });
}
const db = getFirestore();

async function verify() {
  const [users, companies, memberships] = await Promise.all([
    db.collection('users').get(),
    db.collection('companies').get(),
    db.collection('memberships').get(),
  ]);

  console.log('\n📊  Estado actual de Firestore\n');
  console.log(`  users       : ${users.size} documento(s)`);
  users.docs.forEach(d => { const x = d.data(); console.log(`    • ${x.email}  uid=${d.id}  onboarding=${x.onboardingComplete}`); });

  console.log(`\n  companies   : ${companies.size} empresa(s)`);
  companies.docs.forEach(d => { const x = d.data(); console.log(`    • ${x.name} (NIT: ${x.nit})  id=${d.id}`); });

  console.log(`\n  memberships : ${memberships.size} membresía(s)`);
  memberships.docs.forEach(d => { const x = d.data(); console.log(`    • user=${x.userId}  company=${x.companyId}  rol=${x.role}`); });
  console.log('');
}

verify().catch(e => { console.error('Error:', e.message); process.exit(1); });
