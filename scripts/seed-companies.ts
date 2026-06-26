/**
 * seed-companies.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Agrega 20 empresas colombianas reales a Firestore como datos de demostración.
 * Empresas públicamente conocidas con cumplimiento parcial o total de Ley 1581.
 *
 * Uso (desde la raíz del proyecto):
 *   npx ts-node --skip-project scripts/seed-companies.ts
 *
 * Requiere las variables FIREBASE_ADMIN_* en .env.local
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Cargar variables de entorno
dotenv.config({ path: resolve(__dirname, '../.env.local') });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

// ─── 20 Empresas colombianas reales para diagnóstico ────────────────────────
// Todas son organizaciones de acceso público o con presencia digital conocida.
// NITs verificables en Registro Único Empresarial (RUES) o SIC.
const SEED_COMPANIES = [
  {
    name: 'Bancolombia S.A.',
    nit: '890903938-8',
    sector: 'Finanzas',
    size: 'grande',
    description: 'Banco comercial líder en Colombia. Registrado en RNBD. Política de privacidad publicada.',
    cumplimiento: 'alto',
  },
  {
    name: 'Grupo Éxito S.A.',
    nit: '860007667-7',
    sector: 'Retail',
    size: 'grande',
    description: 'Cadena de supermercados. Tratamiento de datos de clientes para programas de fidelización.',
    cumplimiento: 'alto',
  },
  {
    name: 'Empresas Públicas de Medellín (EPM)',
    nit: '890904996-1',
    sector: 'Gobierno',
    size: 'grande',
    description: 'Empresa de servicios públicos. Política de privacidad y RNBD activo.',
    cumplimiento: 'alto',
  },
  {
    name: 'Avianca S.A.',
    nit: '890100979-5',
    sector: 'Transporte',
    size: 'grande',
    description: 'Aerolínea colombiana. Maneja datos de pasajeros, reservas y programas de viajero frecuente.',
    cumplimiento: 'alto',
  },
  {
    name: 'Claro Colombia S.A.',
    nit: '830122566-8',
    sector: 'Telecomunicaciones',
    size: 'grande',
    description: 'Operador de telecomunicaciones. Obligado por normativa sectorial y Ley 1581.',
    cumplimiento: 'alto',
  },
  {
    name: 'Rappi Inc. Sucursal Colombia',
    nit: '901082107-5',
    sector: 'Tecnología',
    size: 'grande',
    description: 'Plataforma de delivery. Maneja datos personales de riders, usuarios y restaurantes.',
    cumplimiento: 'medio',
  },
  {
    name: 'Ecopetrol S.A.',
    nit: '899999068-1',
    sector: 'Manufactura',
    size: 'grande',
    description: 'Empresa de petróleo del Estado colombiano. Registrada en RNBD. Política de datos publicada.',
    cumplimiento: 'alto',
  },
  {
    name: 'Colombia Telecomunicaciones S.A. (Movistar)',
    nit: '830112229-8',
    sector: 'Telecomunicaciones',
    size: 'grande',
    description: 'Operador de telecomunicaciones filial de Telefónica. RNBD registrado.',
    cumplimiento: 'alto',
  },
  {
    name: 'Banco Davivienda S.A.',
    nit: '860034313-7',
    sector: 'Finanzas',
    size: 'grande',
    description: 'Banco del Grupo Bolívar. Manejo intensivo de datos financieros de clientes.',
    cumplimiento: 'alto',
  },
  {
    name: 'Universidad Nacional de Colombia',
    nit: '899999063-3',
    sector: 'Educación',
    size: 'grande',
    description: 'Principal universidad pública. Maneja datos de estudiantes, docentes y personal administrativo.',
    cumplimiento: 'medio',
  },
  {
    name: 'Colpensiones',
    nit: '900156264-3',
    sector: 'Gobierno',
    size: 'grande',
    description: 'Administradora colombiana de pensiones. Maneja datos sensibles de afiliados.',
    cumplimiento: 'alto',
  },
  {
    name: 'Suramericana S.A. (SURA)',
    nit: '890900639-2',
    sector: 'Finanzas',
    size: 'grande',
    description: 'Grupo de seguros e inversiones. Política de datos robusta. Registrado en RNBD.',
    cumplimiento: 'alto',
  },
  {
    name: 'Falabella de Colombia S.A.',
    nit: '830097548-5',
    sector: 'Retail',
    size: 'grande',
    description: 'Tienda por departamentos. Maneja datos de clientes para CMR y e-commerce.',
    cumplimiento: 'medio',
  },
  {
    name: 'Compensar Caja de Compensación',
    nit: '860035513-5',
    sector: 'Salud',
    size: 'grande',
    description: 'Caja de compensación familiar. Datos sensibles de salud de afiliados y beneficiarios.',
    cumplimiento: 'alto',
  },
  {
    name: 'Bavaria S.A.',
    nit: '860002517-4',
    sector: 'Manufactura',
    size: 'grande',
    description: 'Cervecería. Maneja datos de distribuidores, empleados y programas de lealtad.',
    cumplimiento: 'medio',
  },
  {
    name: 'Grupo Nutresa S.A.',
    nit: '890920542-2',
    sector: 'Manufactura',
    size: 'grande',
    description: 'Conglomerado de alimentos. Datos de empleados, proveedores y consumidores.',
    cumplimiento: 'medio',
  },
  {
    name: 'Homecenter Sodimac Colombia S.A.',
    nit: '800214750-2',
    sector: 'Retail',
    size: 'grande',
    description: 'Tienda de mejoramiento del hogar. Club Sodimac con datos de clientes.',
    cumplimiento: 'medio',
  },
  {
    name: 'Terpel S.A.',
    nit: '830114436-3',
    sector: 'Manufactura',
    size: 'grande',
    description: 'Red de estaciones de servicio. Club Full con datos de conductores y vehículos.',
    cumplimiento: 'bajo',
  },
  {
    name: 'Coomeva Cooperativa Médica',
    nit: '890300279-5',
    sector: 'Salud',
    size: 'grande',
    description: 'Cooperativa con servicios de salud, financieros y de recreación. Datos sensibles de salud.',
    cumplimiento: 'medio',
  },
  {
    name: 'Alkosto S.A.',
    nit: '800011833-1',
    sector: 'Retail',
    size: 'mediana',
    description: 'Cadena de almacenes de electrónica y hogar. E-commerce con base de datos de clientes.',
    cumplimiento: 'bajo',
  },
];

async function seedCompanies() {
  console.log('🌱 Iniciando seed de empresas en Firestore...\n');

  // Usar un UID de demostración (puede ser el de cualquier usuario real)
  // Cambia esto por tu UID real de Firebase si quieres verlas en tu cuenta
  const DEMO_USER_ID = 'seed-demo-user';

  const batch = db.batch();
  const results: string[] = [];

  for (const company of SEED_COMPANIES) {
    // Crear documento de empresa
    const companyRef = db.collection('companies').doc();
    batch.set(companyRef, {
      name: company.name,
      nit: company.nit,
      sector: company.sector,
      size: company.size,
      description: company.description,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: DEMO_USER_ID,
    });

    // Crear membresía del usuario demo como administrador
    const memberRef = db.collection('memberships').doc(`${DEMO_USER_ID}_${companyRef.id}`);
    batch.set(memberRef, {
      userId: DEMO_USER_ID,
      companyId: companyRef.id,
      role: 'administrador',
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    results.push(`  ✓ ${company.name} (${company.nit}) — Cumplimiento: ${company.cumplimiento}`);
  }

  await batch.commit();

  console.log(`Empresas agregadas (${results.length}):`);
  results.forEach((r) => console.log(r));
  console.log('\n✅ Seed completado exitosamente.');
  console.log('\n📝 Nota: Para que un usuario real vea estas empresas, ejecuta:');
  console.log('   scripts/assign-companies-to-user.ts <UID_REAL>');
  process.exit(0);
}

seedCompanies().catch((err) => {
  console.error('❌ Error en seed:', err);
  process.exit(1);
});
