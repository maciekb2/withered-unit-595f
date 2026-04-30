import type { FinalJson, Outline } from '../types';

export interface QualityValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    characters: number;
    words: number;
    h2Count: number;
    paragraphs: number;
  };
}

const GENERIC_PHRASES = [
  'wielkie narracje',
  'zdrowy dystans',
  'geopolityczna układanka',
  'świat pod lupą',
  'czas pokaże',
  'nie sposób nie zauważyć',
];

export function validateArticleQuality(
  article: FinalJson,
  outline: Outline,
): QualityValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const content = article.content || '';
  const h2Headings = [...content.matchAll(/^##\s+(.+)$/gm)].map(match => match[1].trim());
  const paragraphs = content
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(part => part && !/^#{1,6}\s+/.test(part));
  const words = (content.match(/\p{L}[\p{L}\p{M}-]*/gu) || []).length;

  if (words < 850) {
    errors.push(`ERROR: Artykul jest za krotki (${words} slow); minimum to 850 slow`);
  }

  if (h2Headings.length < outline.sections.length) {
    errors.push(
      `ERROR: Brakuje sekcji H2 (${h2Headings.length}/${outline.sections.length})`,
    );
  }

  if (h2Headings.some(heading => headingTooCloseToTitle(article.title, heading))) {
    errors.push('ERROR: Naglowek sekcji powtarza tytul lub jego duzy fragment');
  }

  const duplicateParagraphs = repeatedParagraphCount(paragraphs);
  if (duplicateParagraphs > 0) {
    errors.push(`ERROR: Wykryto powtorzone akapity (${duplicateParagraphs})`);
  }

  const genericHits = GENERIC_PHRASES.filter(phrase =>
    content.toLowerCase().includes(phrase),
  );
  if (genericHits.length > 0) {
    warnings.push(`WARN: Generyczne frazy do recznego przegladu: ${genericHits.join(', ')}`);
  }

  if (paragraphs.length < outline.sections.length * 2) {
    warnings.push(`WARN: Malo akapitow wzgledem liczby sekcji (${paragraphs.length})`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      characters: content.length,
      words,
      h2Count: h2Headings.length,
      paragraphs: paragraphs.length,
    },
  };
}

function headingTooCloseToTitle(title: string, heading: string): boolean {
  const normalizedTitle = normalize(title);
  const normalizedHeading = normalize(heading);
  if (!normalizedTitle || !normalizedHeading) return false;
  if (normalizedTitle === normalizedHeading) return true;
  if (normalizedTitle.includes(normalizedHeading) && normalizedHeading.length >= 14) return true;
  if (normalizedHeading.includes(normalizedTitle) && normalizedTitle.length >= 14) return true;

  const titleTokens = meaningfulTokens(title);
  const headingTokens = meaningfulTokens(heading);
  if (headingTokens.length < 2) return false;
  const common = headingTokens.filter(token => titleTokens.includes(token)).length;
  return common >= 2 && common / headingTokens.length >= 0.75;
}

function repeatedParagraphCount(paragraphs: string[]): number {
  const seen = new Set<string>();
  let repeated = 0;
  for (const paragraph of paragraphs) {
    const normalized = normalize(paragraph).slice(0, 260);
    if (normalized.length < 80) continue;
    if (seen.has(normalized)) repeated += 1;
    seen.add(normalized);
  }
  return repeated;
}

function meaningfulTokens(value: string): string[] {
  return normalize(value)
    .split(/\s+/)
    .filter(token => token.length >= 4 && !STOPWORDS.has(token));
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const STOPWORDS = new Set([
  'oraz',
  'przy',
  'jest',
  'jako',
  'czyli',
  'ktory',
  'ktora',
  'ktore',
  'przed',
  'wobec',
  'swoje',
  'swoja',
  'wlasny',
  'wlasna',
]);
