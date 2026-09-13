const LEGAL_SUFFIXES = /\b(LTDA|ME|EIRELI|EPP|S\s?A|SA)\b/g;
const COMBINING_DIACRITICS = /[̀-ͯ]/g;

/**
 * Normalizes a bank statement description so small formatting differences
 * (accents, punctuation, transaction dates/codes embedded in the string,
 * casing) don't prevent a classification rule from recognizing the same
 * establishment next month. Deliberately simple substring matching, not a
 * model — every match is inspectable and explainable to the user.
 */
export function normalizeDescription(raw: string): string {
  const withoutDiacritics = raw.normalize('NFD').replace(COMBINING_DIACRITICS, '');
  return withoutDiacritics
    .toUpperCase()
    .replace(/[^A-Z ]/g, ' ') // strip digits and punctuation, keep letters
    .replace(LEGAL_SUFFIXES, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
