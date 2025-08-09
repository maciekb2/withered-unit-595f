export interface Outline {
  finalTitle: string;            // <= 100 znaków
  description: string;           // <= 200, bez markdown
  sections: { h2: string; bullets: string[] }[]; // 4–6 sekcji, 2–5 bulletów
  guardrails: string[];          // lista “avoid” np. zakaz raportów bez źródła
}

export interface Draft { markdown: string; }
export interface Edited { markdown: string; title: string; description: string; }
export interface FinalJson { title: string; description: string; content: string; }
