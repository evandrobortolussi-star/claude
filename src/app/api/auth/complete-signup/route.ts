import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';

type CompleteSignupBody = {
  idToken: string;
  mode: 'create' | 'join';
  fullName: string;
  avatarEmoji?: string;
  householdName?: string;
  inviteCode?: string;
};

const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomInviteCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)];
  }
  return code;
}

/**
 * Equivalent of the old handle_new_user() Postgres trigger: creates a new
 * household (mode "create") or joins an existing one by invite code (mode
 * "join"), assigning the next free spouse slot. Runs server-side, right
 * after the client creates the Firebase Auth user — authorization never
 * depends on anything the client asserts beyond the verified idToken's uid.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CompleteSignupBody | null;
  if (!body?.idToken) {
    return NextResponse.json({ error: 'idToken ausente.' }, { status: 400 });
  }

  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(body.idToken);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
  }

  const db = getAdminDb();
  const fullName = body.fullName?.trim() || 'Usuário';
  const avatarEmoji = body.avatarEmoji?.trim() || '🙂';

  // Idempotent: a retry after a dropped connection must never create a
  // second household/profile for the same uid.
  const existingProfile = await db.doc(`profiles/${uid}`).get();
  if (existingProfile.exists) {
    return NextResponse.json({ ok: true });
  }

  try {
    if (body.mode === 'join') {
      const inviteCode = (body.inviteCode ?? '').trim().toUpperCase();
      const householdQuery = await db.collection('households').where('inviteCode', '==', inviteCode).limit(1).get();
      if (householdQuery.empty) {
        return NextResponse.json({ error: 'Código de convite inválido.' }, { status: 400 });
      }
      const householdRef = householdQuery.docs[0].ref;

      await db.runTransaction(async (tx) => {
        const profilesSnapshot = await tx.get(db.collection('profiles').where('householdId', '==', householdRef.id));
        const takenSlots = new Set(profilesSnapshot.docs.map((doc) => doc.data().spouseSlot as number));
        if (takenSlots.has(1) && takenSlots.has(2)) {
          throw new Error('Esta família já possui dois membros.');
        }
        const nextSlot: 1 | 2 = takenSlots.has(1) ? 2 : 1;

        tx.set(db.doc(`profiles/${uid}`), {
          householdId: householdRef.id,
          fullName,
          avatarEmoji,
          spouseSlot: nextSlot,
          role: 'MEMBER',
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
    } else {
      const householdName = body.householdName?.trim() || 'Minha família';
      const householdRef = db.collection('households').doc();

      await db.runTransaction(async (tx) => {
        let inviteCode = randomInviteCode();
        for (let attempt = 0; attempt < 10; attempt++) {
          const collision = await tx.get(db.collection('households').where('inviteCode', '==', inviteCode).limit(1));
          if (collision.empty) break;
          inviteCode = randomInviteCode();
        }

        tx.set(householdRef, {
          name: householdName,
          inviteCode,
          currency: 'BRL',
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        tx.set(db.doc(`profiles/${uid}`), {
          householdId: householdRef.id,
          fullName,
          avatarEmoji,
          spouseSlot: 1,
          role: 'OWNER',
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível concluir o cadastro.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
