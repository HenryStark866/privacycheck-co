/**
 * GET /api/seed
 * Solo disponible en desarrollo. Agrega 20 empresas colombianas reales
 * al Firestore y las asigna al usuario autenticado.
 *
 * Uso: inicia sesión → visita http://localhost:3001/api/seed en el browser.
 */
import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebase/session';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

const COMPANIES = [
  { name: 'Bancolombia S.A.',                        nit: '890903938-8', sector: 'Finanzas',           size: 'grande'  },
  { name: 'Grupo Éxito S.A.',                        nit: '860007667-7', sector: 'Retail',             size: 'grande'  },
  { name: 'Empresas Públicas de Medellín (EPM)',     nit: '890904996-1', sector: 'Gobierno',           size: 'grande'  },
  { name: 'Avianca S.A.',                            nit: '890100979-5', sector: 'Transporte',         size: 'grande'  },
  { name: 'Claro Colombia S.A.',                     nit: '830122566-8', sector: 'Telecomunicaciones', size: 'grande'  },
  { name: 'Rappi Inc. Sucursal Colombia',            nit: '901082107-5', sector: 'Tecnología',         size: 'grande'  },
  { name: 'Ecopetrol S.A.',                          nit: '899999068-1', sector: 'Manufactura',        size: 'grande'  },
  { name: 'Colombia Telecomunicaciones (Movistar)',  nit: '830112229-8', sector: 'Telecomunicaciones', size: 'grande'  },
  { name: 'Banco Davivienda S.A.',                   nit: '860034313-7', sector: 'Finanzas',           size: 'grande'  },
  { name: 'Universidad Nacional de Colombia',        nit: '899999063-3', sector: 'Educación',          size: 'grande'  },
  { name: 'Colpensiones',                            nit: '900156264-3', sector: 'Gobierno',           size: 'grande'  },
  { name: 'Suramericana S.A. (SURA)',                nit: '890900639-2', sector: 'Finanzas',           size: 'grande'  },
  { name: 'Falabella de Colombia S.A.',              nit: '830097548-5', sector: 'Retail',             size: 'grande'  },
  { name: 'Compensar Caja de Compensación',          nit: '860035513-5', sector: 'Salud',              size: 'grande'  },
  { name: 'Bavaria S.A.',                            nit: '860002517-4', sector: 'Manufactura',        size: 'grande'  },
  { name: 'Grupo Nutresa S.A.',                      nit: '890920542-2', sector: 'Manufactura',        size: 'grande'  },
  { name: 'Homecenter Sodimac Colombia S.A.',        nit: '800214750-2', sector: 'Retail',             size: 'grande'  },
  { name: 'Terpel S.A.',                             nit: '830114436-3', sector: 'Manufactura',        size: 'grande'  },
  { name: 'Coomeva Cooperativa Médica',              nit: '890300279-5', sector: 'Salud',              size: 'grande'  },
  { name: 'Alkosto S.A.',                            nit: '800011833-1', sector: 'Retail',             size: 'mediana' },
];

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'No disponible en producción.' }, { status: 403 });
  }

  const user = await verifySession();
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión primero.' }, { status: 401 });
  }

  const db = adminDb;
  const created: string[] = [];
  const skipped: string[] = [];

  for (const company of COMPANIES) {
    // Verificar si ya existe por NIT para no duplicar
    const existing = await db.collection('companies')
      .where('nit', '==', company.nit)
      .limit(1)
      .get();

    if (!existing.empty) {
      const existingId = existing.docs[0].id;
      // Asegurar que el usuario tenga membresía
      const memId = `${user.uid}_${existingId}`;
      const memDoc = await db.collection('memberships').doc(memId).get();
      if (!memDoc.exists) {
        await db.collection('memberships').doc(memId).set({
          userId:    user.uid,
          companyId: existingId,
          role:      'administrador',
          joinedAt:  FieldValue.serverTimestamp(),
        });
      }
      skipped.push(company.name);
      continue;
    }

    const companyRef = db.collection('companies').doc();
    await companyRef.set({
      ...company,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: user.uid,
    });

    await db.collection('memberships').doc(`${user.uid}_${companyRef.id}`).set({
      userId:    user.uid,
      companyId: companyRef.id,
      role:      'administrador',
      joinedAt:  FieldValue.serverTimestamp(),
    });

    created.push(company.name);
  }

  return NextResponse.json({
    ok: true,
    message: `Seed completado. ${created.length} empresas creadas, ${skipped.length} ya existían.`,
    created,
    skipped,
    uid: user.uid,
  });
}
