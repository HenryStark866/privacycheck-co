import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/auth'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rutas públicas pasan directo
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Rutas de API (excepto /api/auth) las protege cada route handler con verifySession()
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Para rutas de app: verificar que existe la session cookie
  const sessionCookie = request.cookies.get('__session')?.value;
  if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Excluye assets de Next y archivos estáticos (imágenes, íconos) para que el
  // middleware NO los redirija a /login — eso rompía la carga de /icon-cavaltec.png
  // y /logo-cavaltec.jpeg (devolvían el HTML del login en vez de la imagen).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)'],
};
