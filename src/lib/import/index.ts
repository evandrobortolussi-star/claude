import type { ParsedStatement, StatementParser } from './types';
import { ofxParser } from './ofx';
import { csvParser } from './csv';

// Order matters: more specific formats are checked first, CSV is the
// catch-all fallback. Add a new format by pushing another parser here.
export const PARSERS: StatementParser[] = [ofxParser, csvParser];

export function parseStatement(fileName: string, content: string): ParsedStatement {
  const parser = PARSERS.find((p) => p.canParse(fileName, content));
  if (!parser) {
    throw new Error('Formato de arquivo não suportado.');
  }
  return parser.parse(content);
}

export type { ParsedStatement, ParsedStatementRow, StatementParser } from './types';
