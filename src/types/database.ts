export type ExpenseScope = 'FAMILY' | 'SPOUSE_1' | 'SPOUSE_2';
export type HouseholdRole = 'OWNER' | 'MEMBER';
export type AccountType = 'CHECKING' | 'SAVINGS' | 'CASH';
export type TransactionType = 'INCOME' | 'EXPENSE';
export type InvestmentType = 'RENDA_FIXA' | 'RENDA_VARIAVEL' | 'FUNDO' | 'PREVIDENCIA' | 'CRIPTO' | 'OUTRO';
export type InvestmentMovementType = 'CONTRIBUTION' | 'REDEMPTION';
export type LoanKind = 'LOAN' | 'FINANCING';
export type StagedStatus = 'PENDING' | 'SUGGESTED' | 'CONFIRMED' | 'IGNORED';
export type StatementFormat = 'CSV' | 'OFX';

type Timestamps = {
  created_at: string;
  updated_at: string;
};

type SoftDeletable = {
  deleted_at: string | null;
};

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

      category_groups: {
        Row: { id: string; name: string; kind: TransactionType; sort_order: number };
        Insert: { id?: string; name: string; kind: TransactionType; sort_order?: number };
        Update: { name?: string; sort_order?: number };
        Relationships: [];
      };
      categories: {
        Row: { id: string; group_id: string; name: string; kind: TransactionType; sort_order: number };
        Insert: { id?: string; group_id: string; name: string; kind: TransactionType; sort_order?: number };
        Update: { name?: string; sort_order?: number };
        Relationships: [];
      };

      accounts: {
        Row: SoftDeletable &
          Timestamps & {
            id: string;
            household_id: string;
            name: string;
            type: AccountType;
            institution: string | null;
            opening_balance_cents: number;
            archived: boolean;
          };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          type: AccountType;
          institution?: string | null;
          opening_balance_cents?: number;
          archived?: boolean;
          deleted_at?: string | null;
        };
        Update: {
          name?: string;
          type?: AccountType;
          institution?: string | null;
          opening_balance_cents?: number;
          archived?: boolean;
          deleted_at?: string | null;
        };
        Relationships: [];
      };

      credit_cards: {
        Row: SoftDeletable &
          Timestamps & {
            id: string;
            household_id: string;
            name: string;
            brand: string | null;
            limit_cents: number | null;
            closing_day: number;
            due_day: number;
            archived: boolean;
          };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          brand?: string | null;
          limit_cents?: number | null;
          closing_day: number;
          due_day: number;
          archived?: boolean;
          deleted_at?: string | null;
        };
        Update: {
          name?: string;
          brand?: string | null;
          limit_cents?: number | null;
          closing_day?: number;
          due_day?: number;
          archived?: boolean;
          deleted_at?: string | null;
        };
        Relationships: [];
      };

      investments: {
        Row: SoftDeletable &
          Timestamps & {
            id: string;
            household_id: string;
            name: string;
            type: InvestmentType;
            institution: string | null;
            linked_account_id: string | null;
            archived: boolean;
          };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          type?: InvestmentType;
          institution?: string | null;
          linked_account_id?: string | null;
          archived?: boolean;
          deleted_at?: string | null;
        };
        Update: {
          name?: string;
          type?: InvestmentType;
          institution?: string | null;
          linked_account_id?: string | null;
          archived?: boolean;
          deleted_at?: string | null;
        };
        Relationships: [];
      };

      investment_movements: {
        Row: SoftDeletable &
          Timestamps & {
            id: string;
            household_id: string;
            investment_id: string;
            type: InvestmentMovementType;
            amount_cents: number;
            occurred_on: string;
            account_id: string | null;
            notes: string | null;
            created_by: string;
          };
        Insert: {
          id?: string;
          household_id: string;
          investment_id: string;
          type: InvestmentMovementType;
          amount_cents: number;
          occurred_on: string;
          account_id?: string | null;
          notes?: string | null;
          created_by?: string;
          deleted_at?: string | null;
        };
        Update: {
          notes?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };

      loans: {
        Row: SoftDeletable &
          Timestamps & {
            id: string;
            household_id: string;
            kind: LoanKind;
            name: string;
            institution: string | null;
            contracted_amount_cents: number;
            outstanding_balance_cents: number;
            installment_amount_cents: number;
            installments_total: number;
            installments_paid: number;
            interest_rate_monthly: number | null;
            due_day: number | null;
            contracted_on: string;
            archived: boolean;
          };
        Insert: {
          id?: string;
          household_id: string;
          kind: LoanKind;
          name: string;
          institution?: string | null;
          contracted_amount_cents: number;
          outstanding_balance_cents: number;
          installment_amount_cents: number;
          installments_total: number;
          installments_paid?: number;
          interest_rate_monthly?: number | null;
          due_day?: number | null;
          contracted_on?: string;
          archived?: boolean;
          deleted_at?: string | null;
        };
        Update: {
          kind?: LoanKind;
          name?: string;
          institution?: string | null;
          interest_rate_monthly?: number | null;
          due_day?: number | null;
          archived?: boolean;
          deleted_at?: string | null;
        };
        Relationships: [];
      };

      loan_payments: {
        Row: SoftDeletable &
          Timestamps & {
            id: string;
            household_id: string;
            loan_id: string;
            amount_cents: number;
            occurred_on: string;
            account_id: string | null;
            notes: string | null;
            created_by: string;
          };
        Insert: {
          id?: string;
          household_id: string;
          loan_id: string;
          amount_cents: number;
          occurred_on: string;
          account_id?: string | null;
          notes?: string | null;
          created_by?: string;
          deleted_at?: string | null;
        };
        Update: {
          notes?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };

      recurring_transactions: {
        Row: SoftDeletable &
          Timestamps & {
            id: string;
            household_id: string;
            type: TransactionType;
            amount_cents: number;
            description: string;
            category_id: string | null;
            account_id: string | null;
            card_id: string | null;
            scope: ExpenseScope;
            day_of_month: number;
            start_date: string;
            end_date: string | null;
            last_generated_on: string | null;
            active: boolean;
            notes: string | null;
            created_by: string;
          };
        Insert: {
          id?: string;
          household_id: string;
          type: TransactionType;
          amount_cents: number;
          description: string;
          category_id?: string | null;
          account_id?: string | null;
          card_id?: string | null;
          scope?: ExpenseScope;
          day_of_month: number;
          start_date?: string;
          end_date?: string | null;
          active?: boolean;
          notes?: string | null;
          created_by?: string;
          deleted_at?: string | null;
        };
        Update: {
          amount_cents?: number;
          description?: string;
          category_id?: string | null;
          account_id?: string | null;
          card_id?: string | null;
          scope?: ExpenseScope;
          day_of_month?: number;
          end_date?: string | null;
          active?: boolean;
          notes?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };

      transactions: {
        Row: SoftDeletable &
          Timestamps & {
            id: string;
            household_id: string;
            type: TransactionType;
            amount_cents: number;
            occurred_on: string;
            description: string;
            notes: string | null;
            category_id: string | null;
            account_id: string | null;
            card_id: string | null;
            scope: ExpenseScope;
            recurrence_id: string | null;
            installment_group_id: string | null;
            installment_number: number | null;
            installment_total: number | null;
            import_batch_id: string | null;
            external_id: string | null;
            created_by: string;
          };
        Insert: {
          id?: string;
          household_id: string;
          type: TransactionType;
          amount_cents: number;
          occurred_on: string;
          description: string;
          notes?: string | null;
          category_id?: string | null;
          account_id?: string | null;
          card_id?: string | null;
          scope?: ExpenseScope;
          recurrence_id?: string | null;
          installment_group_id?: string | null;
          installment_number?: number | null;
          installment_total?: number | null;
          import_batch_id?: string | null;
          external_id?: string | null;
          created_by?: string;
          deleted_at?: string | null;
        };
        Update: {
          type?: TransactionType;
          amount_cents?: number;
          occurred_on?: string;
          description?: string;
          notes?: string | null;
          category_id?: string | null;
          account_id?: string | null;
          card_id?: string | null;
          scope?: ExpenseScope;
          deleted_at?: string | null;
        };
        Relationships: [];
      };

      transfers: {
        Row: SoftDeletable &
          Timestamps & {
            id: string;
            household_id: string;
            from_account_id: string;
            to_account_id: string;
            amount_cents: number;
            occurred_on: string;
            notes: string | null;
            created_by: string;
          };
        Insert: {
          id?: string;
          household_id: string;
          from_account_id: string;
          to_account_id: string;
          amount_cents: number;
          occurred_on: string;
          notes?: string | null;
          created_by?: string;
          deleted_at?: string | null;
        };
        Update: {
          notes?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };

      card_payments: {
        Row: SoftDeletable &
          Timestamps & {
            id: string;
            household_id: string;
            card_id: string;
            account_id: string;
            amount_cents: number;
            occurred_on: string;
            invoice_month: string;
            notes: string | null;
            created_by: string;
          };
        Insert: {
          id?: string;
          household_id: string;
          card_id: string;
          account_id: string;
          amount_cents: number;
          occurred_on: string;
          invoice_month: string;
          notes?: string | null;
          created_by?: string;
          deleted_at?: string | null;
        };
        Update: {
          notes?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };

      classification_rules: {
        Row: SoftDeletable &
          Timestamps & {
            id: string;
            household_id: string;
            pattern: string;
            category_id: string;
            scope: ExpenseScope;
            match_count: number;
            active: boolean;
            created_by: string;
          };
        Insert: {
          id?: string;
          household_id: string;
          pattern: string;
          category_id: string;
          scope?: ExpenseScope;
          match_count?: number;
          active?: boolean;
          created_by?: string;
          deleted_at?: string | null;
        };
        Update: {
          pattern?: string;
          category_id?: string;
          scope?: ExpenseScope;
          match_count?: number;
          active?: boolean;
          deleted_at?: string | null;
        };
        Relationships: [];
      };

      import_batches: {
        Row: {
          id: string;
          household_id: string;
          source_format: StatementFormat;
          file_name: string | null;
          account_id: string | null;
          card_id: string | null;
          total_rows: number;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          source_format: StatementFormat;
          file_name?: string | null;
          account_id?: string | null;
          card_id?: string | null;
          total_rows?: number;
          created_by?: string;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };

      import_staged_transactions: {
        Row: Timestamps & {
          id: string;
          household_id: string;
          import_batch_id: string;
          account_id: string | null;
          card_id: string | null;
          occurred_on: string;
          description: string;
          normalized_description: string;
          amount_cents: number;
          type: TransactionType;
          external_id: string | null;
          category_id: string | null;
          scope: ExpenseScope;
          status: StagedStatus;
          suggested_category_id: string | null;
          suggested_scope: ExpenseScope | null;
          matched_rule_id: string | null;
          possible_duplicate: boolean;
          duplicate_of_transaction_id: string | null;
          resulting_transaction_id: string | null;
          created_by: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          import_batch_id: string;
          account_id?: string | null;
          card_id?: string | null;
          occurred_on: string;
          description: string;
          normalized_description: string;
          amount_cents: number;
          type: TransactionType;
          external_id?: string | null;
          category_id?: string | null;
          scope?: ExpenseScope;
          status?: StagedStatus;
          suggested_category_id?: string | null;
          suggested_scope?: ExpenseScope | null;
          matched_rule_id?: string | null;
          possible_duplicate?: boolean;
          duplicate_of_transaction_id?: string | null;
          resulting_transaction_id?: string | null;
          created_by?: string;
        };
        Update: {
          category_id?: string | null;
          scope?: ExpenseScope;
          status?: StagedStatus;
          resulting_transaction_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      generate_due_recurring_transactions: {
        Args: { p_household_id: string };
        Returns: number;
      };
    };
    Enums: {
      expense_scope: ExpenseScope;
      account_type: AccountType;
      transaction_type: TransactionType;
      investment_type: InvestmentType;
      investment_movement_type: InvestmentMovementType;
      loan_kind: LoanKind;
      staged_status: StagedStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
