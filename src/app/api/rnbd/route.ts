/**
 * /api/rnbd — Consulta al Registro Nacional de Bases de Datos (SIC)
 *
 * ESTADO DEL PORTAL: rnbd.sic.gov.co devuelve HTTP 200 solo en la
 * raíz (página de bienvenida JBoss EAP 6, 1.4 KB) y 404 en todas
 * las rutas de consulta JSF. El scraping no es posible.
 *
 * Estrategia actual:
 * 1. Intentar acceder al portal oficial.
 * 2. Si no responde o da error, generar una evaluación determinística
 *    basada en las reglas de la Ley 1581 y el Decreto 1377 de 2013.
 * 3. Siempre incluir el enlace oficial para que el usuario consulte
 *    manualmente si lo desea.
 */
import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebase/session';
import { getMembership } from '@/lib/firebase/firestore-helpers';

const RNBD_BASE  = 'https://rnbd.sic.gov.co';
const RNBD_LINK  = 'https://www.sic.gov.co/rnbd';          // Portal SIC RNBD oficial
const TIMEOUT_MS = 8000;

export interface RNBDResult {
  encontrado: boolean;
  razonSocial?: string;
  nit?: string;
  numeroBD?: number;
  tienePolitica?: boolean;
  canales?: string[];
  obligadoRegistro?: boolean;
  mensaje: string;
  estado: 'registrado' | 'no_registrado' | 'no_obligado' | 'error' | 'no_aplica' | 'manual';
  url: string;
  urlConsultaManual: string;
  consultadoEn: string;
  portalDisponible: boolean;
}

/**
 * Evaluación determinística de la obligatoriedad de registro en el RNBD
 * basada en el Decreto 1377 de 2013, Art. 2.
 *
 * Están obligadas a registrarse las personas jurídicas y naturales
 * que traten datos personales y sean responsables de bases de datos
 * que superen los 100.000 UVT de activos.
 *
 * En la práctica, empresas grandes y medianas deben registrarse;
 * microempresas y personas naturales generalmente no.
 */
function evaluarObligacion(query: string): Pick<RNBDResult, 'obligadoRegistro' | 'estado' | 'mensaje'> {
  const lower = query.toLowerCase();

  // Heurísticas simples basadas en palabras clave
  const esMicro =
    lower.includes('micro') ||
    lower.includes('persona natural') ||
    lower.includes('independiente');

  const esGrande =
    lower.includes('s.a.') ||
    lower.includes('s.a.s') ||
    lower.includes('ltda') ||
    lower.includes('s.a.s.') ||
    lower.includes('sociedad') ||
    lower.includes('grupo') ||
    lower.includes('holding') ||
    lower.includes('banco') ||
    lower.includes('financiero') ||
    lower.includes('corp') ||
    lower.includes('inc');

  if (esMicro) {
    return {
      obligadoRegistro: false,
      estado: 'no_obligado',
      mensaje:
        `Basado en los criterios del Decreto 1377 de 2013, "${query}" posiblemente NO está obligada ` +
        `a inscribirse en el RNBD (microempresa o persona natural). Sin embargo, SIEMPRE debe cumplir ` +
        `con los demás principios de la Ley 1581: aviso de privacidad, obtención de consentimiento y ` +
        `atención de solicitudes de titulares. Verifique en el portal oficial con el NIT exacto.`,
    };
  }

  if (esGrande) {
    return {
      obligadoRegistro: true,
      estado: 'no_aplica',
      mensaje:
        `"${query}" parece ser una entidad de mayor envergadura. Según el Decreto 1377 de 2013, ` +
        `las personas jurídicas responsables de bases de datos que superen los 100.000 UVT de activos ` +
        `(aprox. $4.740 millones COP en 2024) están obligadas a inscribirse ante la SIC en el RNBD. ` +
        `No fue posible consultar el registro automáticamente. Por favor verifique directamente ` +
        `en el portal oficial de la SIC ingresando el NIT o razón social.`,
    };
  }

  return {
    obligadoRegistro: undefined,
    estado: 'manual',
    mensaje:
      `No fue posible consultar el RNBD de forma automática (el portal de la SIC requiere acceso ` +
      `manual). Consulte directamente con el NIT o razón social exacta de la empresa. ` +
      `Recuerde que la obligatoriedad de inscripción depende del volumen de activos (Decreto 1377/2013, Art. 2).`,
  };
}

async function probarPortal(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(RNBD_BASE, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PrivacyCheckCO/1.0)' },
    });
    clearTimeout(timer);
    // El portal responde 200 pero solo sirve página EAP 6 sin contenido útil
    const text = await res.text();
    return res.ok && text.length > 500 && !text.includes('EAP 6');
  } catch {
    clearTimeout(timer);
    return false;
  }
}

export async function GET(request: Request) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const nit       = searchParams.get('nit')?.trim();
  const razon     = searchParams.get('razon')?.trim();
  const companyId = searchParams.get('companyId')?.trim();
  const query     = nit || razon;

  if (!query) {
    return NextResponse.json({ error: 'Parámetro nit o razon requerido' }, { status: 400 });
  }

  // Verificar que el usuario pertenece a la empresa
  if (companyId) {
    const membership = await getMembership(user.uid, companyId);
    if (!membership) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }

  const consultadoEn    = new Date().toISOString();
  const portalDisponible = await probarPortal();
  const evaluacion       = evaluarObligacion(query);

  const result: RNBDResult = {
    encontrado: false,
    ...evaluacion,
    url:                RNBD_LINK,
    urlConsultaManual:  `${RNBD_LINK}`,
    consultadoEn,
    portalDisponible,
  };

  return NextResponse.json(result);
}
