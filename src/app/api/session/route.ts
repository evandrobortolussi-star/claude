import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase/admin';

const SESSION_COOKIE = 'session';
// 14 days — same ballpark as a typical refreshed Supabase session.
const EXPIRES_IN_MS = 1000 * 60 * 60 * 24 * 14;

export async function POST(request: Request) {
  const { idToken } = (await request.json().catch(() => ({}))) as { idToken?: string };
  if (!idToken) {
    return NextResponse.json({ error: 'idToken ausente.' }, { status: 400 });
  }

  try {
    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, { expiresIn: EXPIRES_IN_MS });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: EXPIRES_IN_MS / 1000,
      path: '/',
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Não foi possível criar a sessão.' }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}
