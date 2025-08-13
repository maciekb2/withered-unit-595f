import type { HotTopic } from '../utils/hotTopics';
import { logEvent, logError } from '../utils/logger';
import { extractJson } from '../utils/json';
import { chat } from '../pipeline/openai';
import { guardrails } from '../pipeline/guardrails';

export interface SuggestedTopic {
  title: string;
  rationale: string;
}

export interface SuggestedTopicResult {
  suggestions: SuggestedTopic[];
  prompt: string;
  raw: string;
}

export async function suggestArticleTopic(
  hotTopics: HotTopic[],
  recentTitles: string[],
  apiKey: string,
): Promise<SuggestedTopicResult> {
  const prompt = [
    'Mam listę gorących tematów:',
    ...hotTopics.map((t, i) => `${i + 1}. ${t.title} – ${t.url}`),
    '',
    'Oraz listę ostatnich artykułów:',
    ...recentTitles.map((t, i) => `${i + 1}. ${t}`),
    '',
    'Zaproponuj 3 tytuły artykułów satyrycznych, ironicznych, w tonie centro-prawicowym (PL-patriotycznym), unikając powtórzeń z listy.',
    'Dla każdego dodaj krótkie uzasadnienie wyboru tematu.',
    'Wynik parsuj jako JSON array { title, rationale }.',
  ].join('\n');

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set');
  }

  logEvent({ type: 'suggest-topic-start' });
  let raw = '';
  try {
    raw = await chat(apiKey, {
      system: guardrails(),
      user: prompt,
      max_completion_tokens: 600,
    });

    const parsed: SuggestedTopic[] = extractJson<SuggestedTopic[]>(raw);

    const lowerRecent = recentTitles.map(t => t.toLowerCase());
    const result: SuggestedTopic[] = [];
    for (const s of parsed) {
      const lowerTitle = s.title.toLowerCase();
      if (!lowerRecent.includes(lowerTitle) && !result.some(r => r.title.toLowerCase() === lowerTitle)) {
        result.push(s);
      }
    }

    logEvent({ type: 'suggest-topic-complete', count: result.length });
    return { suggestions: result, prompt, raw };
  } catch (err) {
    (err as any).prompt = prompt;
    (err as any).raw = raw;
    logError(err, { type: 'suggest-topic-error' });
    throw err;
  }
}

