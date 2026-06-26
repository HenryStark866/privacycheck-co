import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/firebase/session';

export async function POST() {
  const response = NextResponse.json({ status: 'ok' });
  response.cookies.set(SESSION_COOKIE, '', { maxAge: 0, path: '/' });
  return response;
}
