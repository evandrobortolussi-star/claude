export type ParsedStatementRow = {
  occurredOn: string; // YYYY-MM-DD
  description: string;
  amountCents: number; // always positive; `type` carries the sign
  type: 'INCOME' | 'EXPENSE';
  externalId?: string;
};

export type ParsedStatement = {
  format: 'CSV' | 'OFX';
  rows: ParsedStatementRow[];
  errors: string[];
};

/**
 * A statement parser for one file format. `canParse` gets first refusal by
 * filename/content sniffing so new formats can be added by pushing another
 * entry onto the registry in `index.ts` — nothing else needs to change.
 */
export type StatementParser = {
  format: ParsedStatement['format'];
  canParse(fileName: string, content: string): boolean;
  parse(content: string): ParsedStatement;
};
