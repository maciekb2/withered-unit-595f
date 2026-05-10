const DESCRIPTION_PREFIX_REPLACEMENTS: Array<[RegExp, string]> = [
  [/^artykuł\s+o\s+/i, ''],
  [/^tekst\s+o\s+tym,\s+jak\s+/i, ''],
  [/^tekst\s+o\s+/i, ''],
  [/^(?:patriotyczna\s+)?satyra\s*[:,-]\s*/i, 'Komentarz: '],
  [/^satyryczny\s+tekst\s+o\s+tym,\s+jak\s+/i, ''],
  [/^satyryczny\s+tekst\s+o\s+/i, ''],
  [/^satyryczny\s+komentarz\s+o\s+/i, 'Komentarz o '],
  [/^satyryczna\s+analiza\s+o\s+/i, 'Analiza o '],
  [/^satyryczny\s+konspekt\s+o\s+/i, ''],
  [/^konspekt\s+satyry\s+o\s+/i, ''],
  [/^patriotyczna\s+satyra\s+o\s+/i, 'Komentarz o '],
  [/^satyra\s+o\s+/i, 'Komentarz o '],
  [/^satyrą\s+o\s+/i, 'Komentarz o '],
  [/^satyryczne\s+spojrzenie\s+na\s+/i, 'Spojrzenie na '],
];

const FORBIDDEN_DESCRIPTION_WORDS = /\b(satyra|satyrą|satyryczny|satyryczna|satyryczne|satyrycznym|satyrycznego|satyrycznie)\b/i;
const POLISH_DIACRITIC_RE = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const COMMON_ENGLISH_WORD_RE =
  /\b(the|and|or|but|with|without|after|before|from|into|over|under|starts?|says?|calls?|evacuat(?:e|es|ing|ed)|virus-hit|cruise|ship|amid|reveals?|systemic|fragility|complacency|government|minister|election|party|talks?|state|security|market|world|right-wing|left-wing)\b/i;
const COMMON_POLISH_WORD_RE =
  /\b(i|oraz|ale|czy|bez|przez|dla|nad|pod|przy|gdy|jak|który|która|które|nie|się|jest|są|ma|mają|po|wobec|między|polska|europa|świat|rząd|państwo|wybory|statek|kryzys|procedura)\b/i;
const OBVIOUS_POLISH_NAME_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bTenerife\b/g, 'Teneryfa'],
];

export function cleanArticleDescription(description: string): string {
  let cleaned = normalizeObviousPolishNames(description || '')
    .replace(/\s+/g, ' ')
    .trim();

  for (const [pattern, replacement] of DESCRIPTION_PREFIX_REPLACEMENTS) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  cleaned = capitalizeFirst(cleaned)
    .replace(/\b(satyryczny|satyryczna|satyryczne|satyrycznym|satyrycznego|satyrycznie)\b\s*/gi, '')
    .replace(/\b(satyra|satyrą)\b\s*[:,-]?\s*/gi, '')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!cleaned) return 'Komentarz o polityce, bezpieczeństwie i rachunkach, które wracają szybciej niż oficjalne deklaracje.';
  return cleaned;
}

export function normalizeObviousPolishNames(value: string): string {
  let normalized = value || '';
  for (const [pattern, replacement] of OBVIOUS_POLISH_NAME_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized;
}

export function assertArticleDescription(description: string): void {
  if (!description || description.length > 200) {
    throw new Error('description must be <=200 chars');
  }
  if (/[#*_`]/.test(description)) {
    throw new Error('Description contains markdown');
  }
  if (FORBIDDEN_DESCRIPTION_WORDS.test(description)) {
    throw new Error('Description mentions satire explicitly');
  }
}

export function assertPolishArticleText(value: string, fieldName: string): void {
  const text = (value || '').trim();
  if (!text) {
    throw new Error(`${fieldName} is empty`);
  }

  const hasPolishSignal = POLISH_DIACRITIC_RE.test(text) || COMMON_POLISH_WORD_RE.test(text);
  if (COMMON_ENGLISH_WORD_RE.test(text) && !hasPolishSignal) {
    throw new Error(`${fieldName} must be in Polish, got likely English text`);
  }
}

function capitalizeFirst(value: string): string {
  return value ? value.charAt(0).toLocaleUpperCase('pl-PL') + value.slice(1) : value;
}
