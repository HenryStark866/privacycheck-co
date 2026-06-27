import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('Faltan variables de entorno FIREBASE_ADMIN_* en .env o .env.local');
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const auth = getAuth();
const db = getFirestore();

const email = 'cdhmaker8@gmail.com';
const password = 'Admin1234';
const displayName = 'Super Admin';

async function createAdmin() {
  console.log(`\n=== Creando Super Admin ===`);
  console.log(`Email: ${email}`);

  let userRecord;
  try {
    // Intentar crear el usuario en Auth
    userRecord = await auth.createUser({
      email,
      password,
      displayName,
    });
    console.log(`✅ Creado en Firebase Auth con UID: ${userRecord.uid}`);
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      console.log('⚠️ El usuario ya existe en Auth. Obteniendo UID...');
      userRecord = await auth.getUserByEmail(email);
      await auth.updateUser(userRecord.uid, { password, displayName });
      console.log(`✅ Contraseña actualizada para UID: ${userRecord.uid}`);
    } else {
      console.error('❌ Error al crear usuario en Auth:', error);
      process.exit(1);
    }
  }

  // Crear o actualizar en Firestore
  try {
    const userRef = db.collection('users').doc(userRecord.uid);
    await userRef.set(
      {
        uid: userRecord.uid,
        email,
        displayName,
        systemRole: 'admin',
        isApproved: true,
        onboardingComplete: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log(`✅ Documento actualizado en Firestore (colección 'users') con rol 'admin'.`);
  } catch (error) {
    console.error('❌ Error al escribir en Firestore:', error);
    process.exit(1);
  }

  console.log('\n¡Súper administrador listo para usarse!');
  process.exit(0);
}

createAdmin();
