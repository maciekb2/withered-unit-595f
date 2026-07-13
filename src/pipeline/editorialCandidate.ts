import type { FinalJson, Outline } from './types';
import { TARGET_ARTICLE_WORDS, validateArticleQuality } from './validators/quality';

export interface EditorialCandidateDecision {
  accepted: boolean;
  reasons: string[];
  previousWords: number;
  candidateWords: number;
}

export function assessEditorialCandidate(
  previous: FinalJson,
  candidate: FinalJson,
  outline: Outline,
): EditorialCandidateDecision {
  const previousQuality = validateArticleQuality(previous, outline);
  const candidateQuality = validateArticleQuality(candidate, outline);
  const minimumPreservedWords = Math.floor(previousQuality.stats.words * 0.8);
  const reasons = [...candidateQuality.errors];
  if (candidateQuality.stats.words < Math.min(TARGET_ARTICLE_WORDS, minimumPreservedWords)) {
    reasons.push(
      `ERROR: Korekta nadmiernie skrocila tekst (${candidateQuality.stats.words}/${previousQuality.stats.words} slow)`,
    );
  }
  return {
    accepted: candidateQuality.ok && reasons.length === 0,
    reasons,
    previousWords: previousQuality.stats.words,
    candidateWords: candidateQuality.stats.words,
  };
}
