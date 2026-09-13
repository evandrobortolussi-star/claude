export type ExpenseScope = 'FAMILY' | 'SPOUSE_1' | 'SPOUSE_2';
export type HouseholdRole = 'OWNER' | 'MEMBER';

export interface Database {
  public: {
    Tables: {
      households: {
        Row: {
          id: string;
          name: string;
          invite_code: string;
          currency: string;
          created_at: string;
          updated_at: string;
        };
        // Rows are only ever created by the handle_new_user() DB trigger —
        // there is no INSERT grant for `authenticated` on this table. This
        // Insert type exists only to satisfy the client's generic shape.
        Insert: {
          id?: string;
          name: string;
          invite_code: string;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          household_id: string;
          full_name: string;
          avatar_emoji: string;
          spouse_slot: 1 | 2;
          role: HouseholdRole;
          created_at: string;
          updated_at: string;
        };
        // Same note as households.Insert above: no INSERT grant exists for
        // `authenticated`; only the sign-up trigger creates profile rows.
        Insert: {
          id: string;
          household_id: string;
          full_name: string;
          avatar_emoji?: string;
          spouse_slot: 1 | 2;
          role?: HouseholdRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string;
          avatar_emoji?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      expense_scope: ExpenseScope;
    };
    CompositeTypes: Record<string, never>;
  };
}
