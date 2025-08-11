export interface Claim {
  text: string;
  type: 'number' | 'date' | 'report' | 'entity';
  hasSource: boolean;
  hasTodo: boolean;
}

export function extractClaims(md: string): Claim[] {
  const sentences = md
    .replace(/\r\n?/g, '\n')
    .split(/(?<=[.!?])\s+/);
  const claims: Claim[] = [];

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    const hasSource = /https?:\/\/\S+/i.test(trimmed);
    const hasTodo = trimmed.includes('[[TODO-CLAIM]]');

    const numberMatches = trimmed.match(/\b\d+(?:[.,]\d+)?%?\b/g) || [];
    for (const _ of numberMatches) {
      claims.push({
        text: trimmed,
        type: 'number',
        hasSource,
        hasTodo,
      });
    }

    const dateMatches = trimmed.match(/\b(19|20)\d{2}\b/g) || [];
    for (const _ of dateMatches) {
      claims.push({
        text: trimmed,
        type: 'date',
        hasSource,
        hasTodo,
      });
    }

    if (/raport/i.test(trimmed)) {
      claims.push({
        text: trimmed,
        type: 'report',
        hasSource,
        hasTodo,
      });
    }

    if (/(według|instytut)/i.test(trimmed)) {
      claims.push({
        text: trimmed,
        type: 'entity',
        hasSource,
        hasTodo,
      });
    }
  }

  return claims;
}

