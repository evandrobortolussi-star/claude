import type { ParsedStatement, ParsedStatementRow, StatementParser } from './types';

function detectDelimiter(line: string): string {
  const candidates = [';', ',', '\t'];
  let best = ',';
  let bestCount = -1;
  for (const c of candidates) {
    const count = line.split(c).length;
    if (count > bestCount) {
      best = c;
      bestCount = count;
    }
  }
  return best;
}

function parseDate(raw: string): string | null {
  const trimmed = raw.trim();
  const br = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (br) {
    const [, d, m, y] = br;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.trim().replace(/[R$\s]/g, '');
  if (!cleaned) return null;
  let normalized = cleaned;
  if (cleaned.includes(',') && cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = cleaned.replace(/,/g, '');
  }
  const value = parseFloat(normalized);
  if (Number.isNaN(value)) return null;
  return Math.round(value * 100);
}

/**
 * Accepts a bank statement export with columns: date, description, amount
 * (amount negative = expense, positive = income). Comma, semicolon or tab
 * delimited, with an optional header row.
 */
export const csvParser: StatementParser = {
  format: 'CSV',
  canParse(fileName) {
    return /\.(csv|txt)$/i.test(fileName) || true; // fallback parser
  },
  parse(content): ParsedStatement {
    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const rows: ParsedStatementRow[] = [];
    const errors: string[] = [];

    if (lines.length === 0) return { format: 'CSV', rows, errors: ['Arquivo vazio.'] };

    const delimiter = detectDelimiter(lines[0]);

    for (const [index, line] of lines.entries()) {
      const cols = line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 3) {
        if (index === 0) continue;
        errors.push(`Linha ${index + 1}: colunas insuficientes.`);
        continue;
      }

      const occurredOn = parseDate(cols[0]);
      const amountCents = parseAmount(cols[2]);
      const description = cols[1];

      if (!occurredOn || amountCents === null || !description) {
        if (index === 0) continue; // likely a header row
        errors.push(`Linha ${index + 1}: não foi possível interpretar.`);
        continue;
      }

      rows.push({
        occurredOn,
        description,
        amountCents: Math.abs(amountCents),
        type: amountCents < 0 ? 'EXPENSE' : 'INCOME',
      });
    }

    return { format: 'CSV', rows, errors };
  },
};
