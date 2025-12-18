import { extractClaims } from '../claims';
import type { Outline } from '../types';

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function validateAntiHallucination(
  md: string,
  outline: Outline,
): { ok: boolean; errors: string[]; stats: { claims: number; withSource: number; todo: number } } {
  const claims = extractClaims(md);
  const errors: string[] = [];

  const stats = {
    claims: claims.length,
    withSource: claims.filter(c => c.hasSource).length,
    todo: claims.filter(c => c.hasTodo).length,
  };

  for (const claim of claims) {
    const isKeyStat = claim.type === 'report' || /statystyk/i.test(claim.text);
    if (isKeyStat && !claim.hasSource) {
      errors.push('ERROR: Kluczowa statystyka/raport bez zrodla');
    }
  }

  if (stats.todo > 0) {
    errors.push('ERROR: Pozostal [[TODO-CLAIM]]');
  }

  for (const section of outline.sections) {
    const h2Re = new RegExp(`^##\\s+${escapeRegExp(section.h2)}$`, 'm');
    if (!h2Re.test(md)) {
      errors.push(`ERROR: Brak sekcji: ${section.h2}`);
    }
  }

  const ok = !errors.some(e => e.startsWith('ERROR'));
  return { ok, errors, stats };
}
