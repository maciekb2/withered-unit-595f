import type { HotTopic } from '../utils/hotTopics';
import { logEvent, logError } from '../utils/logger';
import { extractJson } from '../utils/json';
import { chat } from '../pipeline/openai';
import { guardrails } from '../pipeline/guardrails';

export interface SuggestedTopic {
  title: string;
  rationale: string;
}

export async function suggestArticleTopic(
  hotTopics: HotTopic[],
  recentTitles: string[],
  apiKey: string,
): Promise<SuggestedTopic[]> {
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
  try {
    const text = await chat(apiKey, {
      system: guardrails(),
      user: prompt,
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 600,
    });


    const parsed: SuggestedTopic[] = extractJson<SuggestedTopic[]>(text);

    const lowerRecent = recentTitles.map(t => t.toLowerCase());
    const result: SuggestedTopic[] = [];
    for (const s of parsed) {
      const lowerTitle = s.title.toLowerCase();
      if (!lowerRecent.includes(lowerTitle) && !result.some(r => r.title.toLowerCase() === lowerTitle)) {
        result.push(s);
      }
    }

    logEvent({ type: 'suggest-topic-complete', count: result.length });
    return result;
  } catch (err) {
    logError(err, { type: 'suggest-topic-error' });
    throw err;
  }
}

