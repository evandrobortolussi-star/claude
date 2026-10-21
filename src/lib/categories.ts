import { getAdminDb } from '@/lib/firebase/admin';
import type { CategoryDoc, CategoryGroupDoc, TransactionType } from '@/types/firestore';

export type CategoryOption = {
  id: string;
  name: string;
  kind: TransactionType;
  groupName: string;
};

export async function getCategoryOptions(): Promise<CategoryOption[]> {
  const db = getAdminDb();
  const [groupsSnapshot, categoriesSnapshot] = await Promise.all([
    db.collection('categoryGroups').get(),
    db.collection('categories').get(),
  ]);

  const groupNameById = new Map(
    groupsSnapshot.docs.map((doc) => [doc.id, (doc.data() as CategoryGroupDoc).name]),
  );

  return categoriesSnapshot.docs
    .map((doc) => {
      const data = doc.data() as CategoryDoc;
      return {
        id: doc.id,
        name: data.name,
        kind: data.kind,
        sortOrder: data.sortOrder,
        groupName: groupNameById.get(data.groupId) ?? '',
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ id, name, kind, groupName }) => ({ id, name, kind, groupName }));
}
