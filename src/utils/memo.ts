export const MEMO_SYMBOLS = [
  { name: 'Globus', path: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18Z' },
  { name: 'Kompas', path: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM16 8l-3 5-5 3 3-5 5-3Z' },
  { name: 'Sygnał', path: 'M4 9a11 11 0 0 1 16 0M7 12a7 7 0 0 1 10 0M10 15a3 3 0 0 1 4 0M12 18h.01' },
  { name: 'Dokument', path: 'M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6M9 16h6' },
  { name: 'Kotwica', path: 'M14 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM12 7v14M8 10h8M3 14v2a9 9 0 0 0 18 0v-2M3 14l3 2M21 14l-3 2' },
  { name: 'Klucz', path: 'M11 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm-1 3 10 10M15 16l3-3M18 19l3-3' },
  { name: 'Góry', path: 'm2 20 7-15 6 15H2Zm10-6 4-9 6 15h-7M6 11l3 2 2-3' },
  { name: 'Błyskawica', path: 'M13 2 4 14h7l-1 8 10-13h-7V2Z' },
] as const;

export class MemoRound {
  readonly deck: number[];
  selected: number[] = [];
  matched = new Set<number>();
  moves = 0;
  startedAt: number | null = null;
  finishedAt: number | null = null;

  constructor(random: () => number = Math.random) {
    this.deck = MEMO_SYMBOLS.flatMap((_, index) => [index, index]);
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  get locked() { return this.selected.length === 2; }
  get won() { return this.matched.size === this.deck.length; }

  select(index: number, now: number): 'ignored' | 'first' | 'match' | 'miss' {
    if (!Number.isInteger(index) || index < 0 || index >= this.deck.length || this.locked || this.won || this.matched.has(index) || this.selected.includes(index)) return 'ignored';
    this.startedAt ??= now;
    this.selected.push(index);
    if (this.selected.length === 1) return 'first';
    this.moves++;
    if (this.deck[this.selected[0]] !== this.deck[index]) return 'miss';
    for (const card of this.selected) this.matched.add(card);
    if (this.won) this.finishedAt = now;
    return 'match';
  }

  resolve() { this.selected = []; }
  elapsed(now: number) { return this.startedAt === null ? 0 : Math.max(0, (this.finishedAt ?? now) - this.startedAt); }
}

export function formatMemoTime(milliseconds: number) {
  const seconds = Math.floor(Math.max(0, Number.isFinite(milliseconds) ? milliseconds : 0) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
