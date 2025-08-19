export interface Outline {
  finalTitle: string;            // <= 100 znaków
  description: string;           // <= 200, bez markdown
  sections: { h2: string; bullets: string[] }[]; // 4 sekcje, 2–3 bulletów
  guardrails: string[];          // lista “avoid” np. zakaz raportów bez źródła
}

export interface Draft { markdown: string; }
export interface Edited { markdown: string; title: string; description: string; }
export interface FinalJson { title: string; description: string; content: string; }

export interface EvidenceItem {
  url: string;
  title: string;
  date?: string;
  quotes: string[];
}

export interface EvidenceDraft {
  evidence: Record<string, EvidenceItem>;
  draft: {
    finalTitle: string;
    description: string;
    sections: { h2: string; paragraphs: { text: string; refs: string[] }[] }[];
  };
  bibliography: Record<string, { url: string; title: string; date?: string }>;
}
