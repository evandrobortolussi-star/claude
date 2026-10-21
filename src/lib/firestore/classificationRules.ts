import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import type { RuleForMatching } from '@/lib/import/matching';
import type { ClassificationRuleDoc, ExpenseScope, WithId } from '@/types/firestore';

function rulesRef(householdId: string) {
  return getAdminDb().collection(`households/${householdId}/classificationRules`);
}

export async function listActiveRules(householdId: string): Promise<WithId<ClassificationRuleDoc>[]> {
  const snapshot = await rulesRef(householdId).where('active', '==', true).where('deletedAt', '==', null).get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as ClassificationRuleDoc) }))
    .sort((a, b) => b.matchCount - a.matchCount);
}

export async function getRulesForMatching(householdId: string): Promise<RuleForMatching[]> {
  const rules = await listActiveRules(householdId);
  return rules.map((r) => ({ id: r.id, pattern: r.pattern, categoryId: r.categoryId, scope: r.scope }));
}

export async function updateRule(
  householdId: string,
  id: string,
  input: { pattern: string; categoryId: string; scope: ExpenseScope },
): Promise<void> {
  await rulesRef(householdId)
    .doc(id)
    .update({
      pattern: input.pattern,
      categoryId: input.categoryId,
      scope: input.scope,
      updatedAt: FieldValue.serverTimestamp(),
    });
}

// Mirrors the original action: deactivating a rule both flips `active` off
// and soft-deletes it in one step — it stops suggesting, but nothing it
// already suggested or any confirmed transaction is touched.
export async function deactivateRule(householdId: string, id: string): Promise<void> {
  await rulesRef(householdId)
    .doc(id)
    .update({ active: false, deletedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
}

/**
 * Learns from a confirmed classification: reuses an active rule with the
 * same pattern (bumping its match count) or creates a new one. Never
 * touches any transaction already confirmed — only affects future
 * suggestions.
 */
export async function upsertClassificationRule(
  householdId: string,
  createdBy: string,
  pattern: string,
  categoryId: string,
  scope: ExpenseScope,
): Promise<void> {
  if (!pattern) return;

  const existingSnapshot = await rulesRef(householdId)
    .where('pattern', '==', pattern)
    .where('deletedAt', '==', null)
    .limit(1)
    .get();

  if (!existingSnapshot.empty) {
    const existing = existingSnapshot.docs[0];
    const data = existing.data() as ClassificationRuleDoc;
    await existing.ref.update({
      categoryId,
      scope,
      matchCount: data.matchCount + 1,
      active: true,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  await rulesRef(householdId)
    .doc()
    .set({
      householdId,
      pattern,
      categoryId,
      scope,
      matchCount: 0,
      active: true,
      createdBy,
      deletedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
}

export async function incrementMatchCounts(householdId: string, counts: Map<string, number>): Promise<void> {
  if (counts.size === 0) return;
  const batch = getAdminDb().batch();
  for (const [ruleId, count] of counts) {
    batch.update(rulesRef(householdId).doc(ruleId), { matchCount: FieldValue.increment(count) });
  }
  await batch.commit();
}
