const GENERAL =
  'W zależności od źródeł, trend bywa rozbieżny – istotne jest tempo zmian, nie pojedyncza wartość.';

export function scrubTodoClaims(md: string): {
  cleaned: string;
  removedCount: number;
} {
  const regex = /[^.!?]*\[\[TODO-CLAIM\]\][^.!?]*[.!?]/g;
  const matches = md.match(regex);
  const removedCount = matches ? matches.length : 0;
  const cleaned = md.replace(regex, GENERAL);
  return { cleaned, removedCount };
}
