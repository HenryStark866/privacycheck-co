/**
 * /api/rnbd — Consulta automática al Registro Nacional de Bases de Datos (SIC)
 * Portal: https://rnbd.sic.gov.co
 *
 * El portal usa JSF. Estrategia:
 * 1. GET página principal → extraer ViewState
 * 2. POST búsqueda por NIT o razón social
 * 3. Parsear HTML de resultado
 */
import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebase/session';
import { getMembership } from '@/lib/firebase/firestore-helpers';

const RNBD_BASE = 'https://rnbd.sic.gov.co';
const TIMEOUT_MS = 12000;

export interface RNBDResult {
  encontrado: boolean;
  razonSocial?: string;
  nit?: string;
  numeroBD?: number;          // número de bases de datos registradas
  tienePolitica?: boolean;
  canales?: string[];
  obligadoRegistro?: boolean; // basado en regla 100.000 UVT
  mensaje: string;
  estado: 'registrado' | 'no_registrado' | 'no_obligado' | 'error' | 'no_aplica';
  url: string;
  consultadoEn: string;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/** Extrae el ViewState de la página JSF */
function extractViewState(html: string): string | null {
  const match = html.match(/id="?javax\.faces\.ViewState"?[^>]*value="([^"]+)"/i)
    ?? html.match(/name="javax\.faces\.ViewState"[^>]*value="([^"]+)"/i);
  return match ? match[1] : null;
}

/** Detecta si hay resultados en el HTML de respuesta */
function parseRNBDResponse(html: string, query: string): Omit<RNBDResult, 'url' | 'consultadoEn'> {
  const lower = html.toLowerCase();

  // Indicadores de "no encontrado"
  const noEncontrado =
    lower.includes('no se encontraron resultados') ||
    lower.includes('no existen registros') ||
    lower.includes('no se encontró') ||
    lower.includes('0 registros') ||
    lower.includes('sin resultados');

  if (noEncontrado) {
    return {
      encontrado: false,
      obligadoRegistro: undefined, // no podemos saberlo solo con esto
      estado: 'no_registrado',
      mensaje: `La empresa "${query}" no aparece inscrita en el RNBD. Si tiene activos superiores a 100.000 UVT (≈ $4.740 millones COP en 2024), está obligada a registrarse. Si es una empresa pequeña o mediana, puede no estar obligada al registro pero sí debe cumplir con el resto de la Ley 1581.`,
    };
  }

  // Intentar extraer datos si hay resultados
  const razonSocialMatch = html.match(/razón social[^:]*:\s*<[^>]+>([^<]+)/i)
    ?? html.match(/razonSocial[^>]*>([^<]+)/i);
  const razonSocial = razonSocialMatch?.[1]?.trim();

  const nitMatch = html.match(/nit[^:]*:\s*<[^>]+>([^<]+)/i)
    ?? html.match(/\b\d{9,10}-\d\b/);
  const nitFound = Array.isArray(nitMatch) ? nitMatch[1]?.trim() : nitMatch?.[0];

  const bdMatch = html.match(/(\d+)\s*base[s]?\s*de\s*datos/i)
    ?? html.match(/total[^:]*:\s*(\d+)/i);
  const numeroBD = bdMatch ? parseInt(bdMatch[1]) : undefined;

  const tienePolitica =
    lower.includes('política de tratamiento') ||
    lower.includes('aviso de privacidad') ||
    lower.includes('politica registrada');

  return {
    encontrado: true,
    razonSocial: razonSocial ?? query,
    nit: nitFound,
    numeroBD,
    tienePolitica,
    estado: 'registrado',
    mensaje: `La empresa aparece inscrita en el RNBD de la SIC${numeroBD !== undefined ? ` con ${numeroBD} base(s) de datos declarada(s)` : ''}. ${tienePolitica ? 'Tiene política de tratamiento reportada.' : 'No se detectó política de tratamiento publicada en el RNBD.'} Esto indica cumplimiento con el deber de registro ante la SIC.`,
  };
}

async function consultarRNBD(query: string, tipo: 'nit' | 'razon'): Promise<RNBDResult> {
  const urlConsulta = `${RNBD_BASE}/sic/consulta`;
  const urlBase = `${RNBD_BASE}/`;
  const consultadoEn = new Date().toISOString();

  try {
    // Paso 1: Obtener la página principal para el ViewState
    const pageRes = await fetchWithTimeout(urlBase, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!pageRes.ok) throw new Error(`Portal RNBD no disponible: ${pageRes.status}`);

    const pageHtml = await pageRes.text();
    const viewState = extractViewState(pageHtml);

    // Construir parámetros de búsqueda
    const params = new URLSearchParams();
    if (viewState) params.append('javax.faces.ViewState', viewState);
    params.append('javax.faces.partial.ajax', 'true');
    params.append('javax.faces.partial.execute', '@all');
    params.append('javax.faces.partial.render', '@all');

    if (tipo === 'nit') {
      params.append('formConsulta:nit', query.replace(/\D/g, ''));
      params.append('formConsulta:btnConsultaNit', 'Consultar');
      params.append('formConsulta:btnConsultaNit', 'formConsulta:btnConsultaNit');
    } else {
      params.append('formConsulta:razonSocial', query);
      params.append('formConsulta:btnConsultaRazon', 'Consultar');
      params.append('formConsulta:btnConsultaRazon', 'formConsulta:btnConsultaRazon');
    }

    // Extraer cookie de sesión del paso 1
    const setCookie = pageRes.headers.get('set-cookie') ?? '';
    const jsessionId = setCookie.match(/JSESSIONID=([^;]+)/i)?.[1];

    // Paso 2: Hacer la búsqueda
    const searchRes = await fetchWithTimeout(urlConsulta, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml,*/*',
        Referer: urlBase,
        ...(jsessionId ? { Cookie: `JSESSIONID=${jsessionId}` } : {}),
      },
      body: params.toString(),
    });

    const resultHtml = await searchRes.text();
    const parsed = parseRNBDResponse(resultHtml, query);

    return {
      ...parsed,
      url: `${RNBD_BASE}/sic/consulta`,
      consultadoEn,
    };
  } catch (err: any) {
    // Si el portal no responde, dar información útil igual
    if (err.name === 'AbortError') {
      return {
        encontrado: false,
        estado: 'error',
        mensaje: 'El portal RNBD (rnbd.sic.gov.co) tardó demasiado en responder. Puedes consultarlo directamente en https://rnbd.sic.gov.co ingresando el NIT o razón social de la empresa.',
        url: RNBD_BASE,
        consultadoEn,
      };
    }

    console.error('RNBD fetch error:', err.message);
    return {
      encontrado: false,
      estado: 'error',
      mensaje: `No fue posible conectar con el portal RNBD de la SIC. Consulta directamente en https://rnbd.sic.gov.co. Error: ${err.message}`,
      url: RNBD_BASE,
      consultadoEn,
    };
  }
}

export async function GET(request: Request) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const nit = searchParams.get('nit')?.trim();
  const razon = searchParams.get('razon')?.trim();
  const companyId = searchParams.get('companyId')?.trim();

  if (!nit && !razon) {
    return NextResponse.json({ error: 'Parámetro nit o razon requerido' }, { status: 400 });
  }

  // Verificar que el usuario pertenece a la empresa
  if (companyId) {
    const membership = await getMembership(user.uid, companyId);
    if (!membership) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }

  const result = nit
    ? await consultarRNBD(nit, 'nit')
    : await consultarRNBD(razon!, 'razon');

  return NextResponse.json(result);
}
