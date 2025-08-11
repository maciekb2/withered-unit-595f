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
    if (claim.type === 'report' && !claim.hasSource) {
      errors.push('ERROR: Raport bez źródła');
    }
    if (claim.type === 'number') {
      if (!/(około|szacuje się|trend|zwykle)/i.test(claim.text) && !claim.hasTodo) {
        errors.push('WARN: Liczba bez kontekstu');
      }
    }
  }

  if (stats.todo > 0) {
    errors.push('ERROR: Pozostał [[TODO-CLAIM]]');
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
