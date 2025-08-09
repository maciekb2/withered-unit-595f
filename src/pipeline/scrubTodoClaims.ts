const GENERAL = 'W zależności od źródeł, trend bywa rozbieżny – istotne jest tempo zmian, nie pojedyncza wartość.';

export function scrubTodoClaims(md: string): { cleaned: string; removedCount: number } {
  const sentences = md.split(/(?<=[.!?])\s+|\n+/);
  let removed = 0;
  const cleaned = sentences
    .map(s => {
      if (s.includes('[[TODO-CLAIM]]')) {
        removed++;
        return GENERAL;
      }
      return s;
    })
    .join(' ');
  return { cleaned, removedCount: removed };
}
