import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TransactionType } from '@/types/database';

export type CategoryOption = {
  id: string;
  name: string;
  kind: TransactionType;
  groupName: string;
};

export async function getCategoryOptions(supabase: SupabaseClient<Database>): Promise<CategoryOption[]> {
  const [{ data: groups }, { data: categories }] = await Promise.all([
    supabase.from('category_groups').select('id, name, sort_order').order('sort_order'),
    supabase.from('categories').select('id, group_id, name, kind, sort_order').order('sort_order'),
  ]);

  const groupNameById = new Map((groups ?? []).map((g) => [g.id, g.name]));

  return (categories ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    groupName: groupNameById.get(c.group_id) ?? '',
  }));
}
