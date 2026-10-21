import { NextResponse, type NextRequest } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];
const SESSION_COOKIE = 'session';

// Firebase session cookies (and ID tokens) are RS256-signed by Google's
// securetoken service — this lets us cryptographically verify the cookie
// right here in Edge middleware (signature + expiry + issuer/audience),
// without pulling in firebase-admin (Node-only) just to gate routes. The
// authoritative, revocation-aware check still happens server-side in
// requireCurrentUser() via the Admin SDK on every protected page.
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!cookie) return false;

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  try {
    await jwtVerify(cookie, JWKS, {
      issuer: `https://session.firebase.google.com/${projectId}`,
      audience: projectId,
    });
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const authenticated = await hasValidSession(request);

  if (!authenticated && !isPublicPath && pathname !== '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (authenticated && isPublicPath) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest).*)'],
};
