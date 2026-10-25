import { NextResponse } from 'next/server';
import { seedCategoryCatalog } from '@/lib/firestore/seedCategories';

// Intentionally unauthenticated: this only ever writes the same fixed,
// public, non-sensitive category catalog (never household data), and is
// idempotent by design (deterministic doc IDs + .set()) — visiting it
// twice is harmless. Meant to be opened once in a browser right after the
// first deploy, so populating the catalog never requires local Node or a
// terminal.
export async function GET() {
  try {
    const { groups, categories } = await seedCategoryCatalog();
    return NextResponse.json({ ok: true, groups, categories });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
