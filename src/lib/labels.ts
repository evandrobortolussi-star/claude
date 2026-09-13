import type { ExpenseScope, TransactionType, AccountType, LoanKind, InvestmentType, InvestmentMovementType } from '@/types/database';

/** Shared vocabulary for scope/type/etc. — kept out of components so the
 * financial domain's wording lives in one place, not copy-pasted per file. */
export const SCOPE_LABEL: Record<ExpenseScope, string> = {
  FAMILY: 'Casal',
  SPOUSE_1: 'Cônjuge 1',
  SPOUSE_2: 'Cônjuge 2',
};

export const TRANSACTION_TYPE_LABEL: Record<TransactionType, string> = {
  INCOME: 'Receita',
  EXPENSE: 'Despesa',
};

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  CHECKING: 'Conta corrente',
  SAVINGS: 'Poupança',
  CASH: 'Dinheiro',
};

export const LOAN_KIND_LABEL: Record<LoanKind, string> = {
  LOAN: 'Empréstimo',
  FINANCING: 'Financiamento',
};

export const INVESTMENT_TYPE_LABEL: Record<InvestmentType, string> = {
  RENDA_FIXA: 'Renda fixa',
  RENDA_VARIAVEL: 'Renda variável',
  FUNDO: 'Fundo',
  PREVIDENCIA: 'Previdência',
  CRIPTO: 'Cripto',
  OUTRO: 'Outro',
};

export const INVESTMENT_MOVEMENT_TYPE_LABEL: Record<InvestmentMovementType, string> = {
  CONTRIBUTION: 'Aporte',
  REDEMPTION: 'Resgate',
};
