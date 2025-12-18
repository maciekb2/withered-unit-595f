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

  const urls = md.match(/https?:\/\/\S+/gi) || [];
  if (urls.length === 0) {
    errors.push('ERROR: Brak linku do zrodla (w calym tekscie musi byc 1 URL do tematu)');
  } else if (urls.length > 1) {
    errors.push('ERROR: Wykryto wiecej niz 1 URL (w calym tekscie ma byc dokladnie 1 link do tematu)');
  }

  for (const claim of claims) {
    const isKeyStat = claim.type === 'report' || /statystyk/i.test(claim.text);
    if (isKeyStat && !claim.hasSource) {
      errors.push('WARN: Kluczowa statystyka/raport bez zrodla w tym samym zdaniu');
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
