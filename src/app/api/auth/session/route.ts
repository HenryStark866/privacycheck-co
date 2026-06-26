import { NextResponse } from 'next/server';
import { createSessionCookie, SESSION_COOKIE, SESSION_DURATION } from '@/lib/firebase/session';

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();
    if (!idToken) return NextResponse.json({ error: 'idToken requerido' }, { status: 400 });

    const sessionCookie = await createSessionCookie(idToken);

    const response = NextResponse.json({ status: 'ok' });
    response.cookies.set(SESSION_COOKIE, sessionCookie, {
      maxAge: SESSION_DURATION / 1000, // en segundos
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('Session error:', err);
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
  }
}
