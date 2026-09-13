import type { ParsedStatement, ParsedStatementRow, StatementParser } from './types';

// OFX 1.x is SGML, not well-formed XML: inner tags like <TRNAMT> are often
// left unclosed. A tolerant regex-based reader is the pragmatic approach
// most tools use, rather than a strict XML parser.
function extractTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}>\\s*([^<\r\n]*)`, 'i'));
  return match ? match[1].trim() : null;
}

function parseOfxDate(raw: string): string | null {
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length < 8) return null;
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  return `${year}-${month}-${day}`;
}

export const ofxParser: StatementParser = {
  format: 'OFX',
  canParse(fileName, content) {
    return /\.(ofx|qfx)$/i.test(fileName) || /<OFX>/i.test(content);
  },
  parse(content): ParsedStatement {
    const rows: ParsedStatementRow[] = [];
    const errors: string[] = [];

    const blocks = content.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
    if (blocks.length === 0) {
      return { format: 'OFX', rows, errors: ['Nenhuma transação encontrada no arquivo OFX.'] };
    }

    for (const [index, block] of blocks.entries()) {
      const amountRaw = extractTag(block, 'TRNAMT');
      const dateRaw = extractTag(block, 'DTPOSTED');
      const name = extractTag(block, 'NAME') ?? extractTag(block, 'MEMO');
      const fitId = extractTag(block, 'FITID') ?? undefined;

      const amount = amountRaw ? parseFloat(amountRaw.replace(',', '.')) : null;
      const occurredOn = dateRaw ? parseOfxDate(dateRaw) : null;

      if (amount === null || Number.isNaN(amount) || !occurredOn || !name) {
        errors.push(`Transação ${index + 1}: não foi possível interpretar.`);
        continue;
      }

      rows.push({
        occurredOn,
        description: name,
        amountCents: Math.round(Math.abs(amount) * 100),
        type: amount < 0 ? 'EXPENSE' : 'INCOME',
        externalId: fitId,
      });
    }

    return { format: 'OFX', rows, errors };
  },
};
