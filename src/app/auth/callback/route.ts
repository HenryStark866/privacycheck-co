// Este callback ya no se usa — Firebase Auth maneja OAuth via signInWithPopup.
// La session cookie se crea en /api/auth/session/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/dashboard`);
}
