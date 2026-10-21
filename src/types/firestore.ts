import type { Timestamp } from 'firebase-admin/firestore';

export type ExpenseScope = 'FAMILY' | 'SPOUSE_1' | 'SPOUSE_2';
export type HouseholdRole = 'OWNER' | 'MEMBER';
export type AccountType = 'CHECKING' | 'SAVINGS' | 'CASH';
export type TransactionType = 'INCOME' | 'EXPENSE';
export type InvestmentType = 'RENDA_FIXA' | 'RENDA_VARIAVEL' | 'FUNDO' | 'PREVIDENCIA' | 'CRIPTO' | 'OUTRO';
export type InvestmentMovementType = 'CONTRIBUTION' | 'REDEMPTION';
export type LoanKind = 'LOAN' | 'FINANCING';
export type StagedStatus = 'PENDING' | 'SUGGESTED' | 'CONFIRMED' | 'IGNORED';
export type StatementFormat = 'CSV' | 'OFX';

// Dates that are meaningful as calendar days (occurred_on, due dates, etc.) are
// kept as plain 'YYYY-MM-DD' strings, never Firestore Timestamps — this avoids
// timezone drift and keeps every existing date util in src/lib/format.ts and
// src/lib/month.ts working unchanged against Firestore data.
export type DateString = string;

type Timestamps = {
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type SoftDeletable = {
  deletedAt: Timestamp | null;
};

// profiles/{uid} — top-level, keyed by Firebase Auth uid, so a user's
// householdId/role can be found from just their uid (no household context
// needed yet). Mirrors public.profiles.
export interface ProfileDoc {
  householdId: string;
  fullName: string;
  avatarEmoji: string;
  spouseSlot: 1 | 2;
  role: HouseholdRole;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// households/{householdId}
export interface HouseholdDoc {
  name: string;
  inviteCode: string;
  currency: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// categoryGroups/{id} — global catalog, read-only, seeded once.
export interface CategoryGroupDoc {
  name: string;
  kind: TransactionType;
  sortOrder: number;
}

// categories/{id} — global catalog, read-only, seeded once.
export interface CategoryDoc {
  groupId: string;
  name: string;
  kind: TransactionType;
  sortOrder: number;
}

// households/{householdId}/accounts/{id}
export interface AccountDoc extends SoftDeletable, Timestamps {
  householdId: string;
  name: string;
  type: AccountType;
  institution: string | null;
  openingBalanceCents: number;
  archived: boolean;
}

// households/{householdId}/creditCards/{id}
export interface CreditCardDoc extends SoftDeletable, Timestamps {
  householdId: string;
  name: string;
  brand: string | null;
  limitCents: number | null;
  closingDay: number;
  dueDay: number;
  archived: boolean;
}

// households/{householdId}/investments/{id}
export interface InvestmentDoc extends SoftDeletable, Timestamps {
  householdId: string;
  name: string;
  type: InvestmentType;
  institution: string | null;
  linkedAccountId: string | null;
  archived: boolean;
}

// households/{householdId}/investmentMovements/{id}
export interface InvestmentMovementDoc extends SoftDeletable, Timestamps {
  householdId: string;
  investmentId: string;
  type: InvestmentMovementType;
  amountCents: number;
  occurredOn: DateString;
  accountId: string | null;
  notes: string | null;
  createdBy: string;
}

// households/{householdId}/loans/{id}
export interface LoanDoc extends SoftDeletable, Timestamps {
  householdId: string;
  kind: LoanKind;
  name: string;
  institution: string | null;
  contractedAmountCents: number;
  outstandingBalanceCents: number;
  installmentAmountCents: number;
  installmentsTotal: number;
  installmentsPaid: number;
  interestRateMonthly: number | null;
  dueDay: number | null;
  contractedOn: DateString;
  archived: boolean;
}

// households/{householdId}/loanPayments/{id}
export interface LoanPaymentDoc extends SoftDeletable, Timestamps {
  householdId: string;
  loanId: string;
  amountCents: number;
  occurredOn: DateString;
  accountId: string | null;
  notes: string | null;
  createdBy: string;
}

// households/{householdId}/recurringTransactions/{id}
export interface RecurringTransactionDoc extends SoftDeletable, Timestamps {
  householdId: string;
  type: TransactionType;
  amountCents: number;
  description: string;
  categoryId: string | null;
  accountId: string | null;
  cardId: string | null;
  scope: ExpenseScope;
  dayOfMonth: number;
  startDate: DateString;
  endDate: DateString | null;
  lastGeneratedOn: DateString | null;
  active: boolean;
  notes: string | null;
  createdBy: string;
}

// households/{householdId}/transactions/{id}
export interface TransactionDoc extends SoftDeletable, Timestamps {
  householdId: string;
  type: TransactionType;
  amountCents: number;
  occurredOn: DateString;
  description: string;
  notes: string | null;
  categoryId: string | null;
  accountId: string | null;
  cardId: string | null;
  scope: ExpenseScope;
  recurrenceId: string | null;
  installmentGroupId: string | null;
  installmentNumber: number | null;
  installmentTotal: number | null;
  importBatchId: string | null;
  externalId: string | null;
  createdBy: string;
}

// households/{householdId}/transfers/{id}
export interface TransferDoc extends SoftDeletable, Timestamps {
  householdId: string;
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  occurredOn: DateString;
  notes: string | null;
  createdBy: string;
}

// households/{householdId}/cardPayments/{id}
export interface CardPaymentDoc extends SoftDeletable, Timestamps {
  householdId: string;
  cardId: string;
  accountId: string;
  amountCents: number;
  occurredOn: DateString;
  invoiceMonth: DateString;
  notes: string | null;
  createdBy: string;
}

// households/{householdId}/classificationRules/{id}
export interface ClassificationRuleDoc extends SoftDeletable, Timestamps {
  householdId: string;
  pattern: string;
  categoryId: string;
  scope: ExpenseScope;
  matchCount: number;
  active: boolean;
  createdBy: string;
}

// households/{householdId}/importBatches/{id}
export interface ImportBatchDoc {
  householdId: string;
  sourceFormat: StatementFormat;
  fileName: string | null;
  accountId: string | null;
  cardId: string | null;
  totalRows: number;
  createdBy: string;
  createdAt: Timestamp;
}

// households/{householdId}/importStagedTransactions/{id}
export interface ImportStagedTransactionDoc extends Timestamps {
  householdId: string;
  importBatchId: string;
  accountId: string | null;
  cardId: string | null;
  occurredOn: DateString;
  description: string;
  normalizedDescription: string;
  amountCents: number;
  type: TransactionType;
  externalId: string | null;
  categoryId: string | null;
  scope: ExpenseScope;
  status: StagedStatus;
  suggestedCategoryId: string | null;
  suggestedScope: ExpenseScope | null;
  matchedRuleId: string | null;
  possibleDuplicate: boolean;
  duplicateOfTransactionId: string | null;
  resultingTransactionId: string | null;
  createdBy: string;
}

export type WithId<T> = T & { id: string };
