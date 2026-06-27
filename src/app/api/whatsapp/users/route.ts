/**
 * GET /api/whatsapp/users
 * Devuelve la lista de usuarios con WhatsApp vinculado (solo admin).
 */
import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/firebase/session';
import { getRegisteredWhatsAppUsers } from '@/lib/whatsapp';

export async function GET() {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const users = await getRegisteredWhatsAppUsers();
    // Devolver solo campos necesarios para la UI (sin photoURL, provider, etc.)
    return NextResponse.json({
      ok:    true,
      total: users.length,
      users: users.map((u) => ({
        uid:         u.uid,
        email:       u.email,
        displayName: u.displayName,
        whatsapp:    u.whatsapp,
      })),
    });
  } catch (err: any) {
    console.error('[WA Users] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
