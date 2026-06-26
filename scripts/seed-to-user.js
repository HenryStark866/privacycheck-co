/**
 * seed-to-user.js  — CommonJS, sin compilar
 * ─────────────────────────────────────────────────────────────────────────────
 * Agrega 20 empresas colombianas reales a Firestore y las asigna al usuario
 * cuyo UID se pasa como argumento.
 *
 * Uso:
 *   node scripts/seed-to-user.js <TU_UID_DE_FIREBASE>
 *
 * Para obtener tu UID: inicia sesión en la app → panel de Firebase Console →
 * Authentication → copia el User UID.
 * ─────────────────────────────────────────────────────────────────────────────
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

const COMPANIES = [
  { name: 'Bancolombia S.A.',                       nit: '890903938-8', sector: 'Finanzas',           size: 'grande'  },
  { name: 'Grupo Éxito S.A.',                       nit: '860007667-7', sector: 'Retail',             size: 'grande'  },
  { name: 'Empresas Públicas de Medellín (EPM)',    nit: '890904996-1', sector: 'Gobierno',           size: 'grande'  },
  { name: 'Avianca S.A.',                           nit: '890100979-5', sector: 'Transporte',         size: 'grande'  },
  { name: 'Claro Colombia S.A.',                    nit: '830122566-8', sector: 'Telecomunicaciones', size: 'grande'  },
  { name: 'Rappi Inc. Sucursal Colombia',           nit: '901082107-5', sector: 'Tecnología',         size: 'grande'  },
  { name: 'Ecopetrol S.A.',                         nit: '899999068-1', sector: 'Manufactura',        size: 'grande'  },
  { name: 'Colombia Telecomunicaciones (Movistar)', nit: '830112229-8', sector: 'Telecomunicaciones', size: 'grande'  },
  { name: 'Banco Davivienda S.A.',                  nit: '860034313-7', sector: 'Finanzas',           size: 'grande'  },
  { name: 'Universidad Nacional de Colombia',       nit: '899999063-3', sector: 'Educación',          size: 'grande'  },
  { name: 'Colpensiones',                           nit: '900156264-3', sector: 'Gobierno',           size: 'grande'  },
  { name: 'Suramericana S.A. (SURA)',               nit: '890900639-2', sector: 'Finanzas',           size: 'grande'  },
  { name: 'Falabella de Colombia S.A.',             nit: '830097548-5', sector: 'Retail',             size: 'grande'  },
  { name: 'Compensar Caja de Compensación',         nit: '860035513-5', sector: 'Salud',              size: 'grande'  },
  { name: 'Bavaria S.A.',                           nit: '860002517-4', sector: 'Manufactura',        size: 'grande'  },
  { name: 'Grupo Nutresa S.A.',                     nit: '890920542-2', sector: 'Manufactura',        size: 'grande'  },
  { name: 'Homecenter Sodimac Colombia S.A.',       nit: '800214750-2', sector: 'Retail',             size: 'grande'  },
  { name: 'Terpel S.A.',                            nit: '830114436-3', sector: 'Manufactura',        size: 'grande'  },
  { name: 'Coomeva Cooperativa Médica',             nit: '890300279-5', sector: 'Salud',              size: 'grande'  },
  { name: 'Alkosto S.A.',                           nit: '800011833-1', sector: 'Retail',             size: 'mediana' },
];

async function main() {
  const uid = process.argv[2];
  if (!uid) {
    console.error('❌  Uso: node scripts/seed-to-user.js <UID>');
    process.exit(1);
  }

  console.log(`\n🌱  Agregando 20 empresas para el usuario: ${uid}\n`);

  for (const company of COMPANIES) {
    const companyRef = db.collection('companies').doc();
    await companyRef.set({
      ...company,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: uid,
    });

    const memberId = `${uid}_${companyRef.id}`;
    await db.collection('memberships').doc(memberId).set({
      userId:    uid,
      companyId: companyRef.id,
      role:      'administrador',
      joinedAt:  admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`  ✓  ${company.name}  (NIT ${company.nit})`);
  }

  console.log(`\n✅  ${COMPANIES.length} empresas agregadas y asignadas al usuario ${uid}`);
  console.log('   Recarga la app → Dashboard para verlas.\n');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
