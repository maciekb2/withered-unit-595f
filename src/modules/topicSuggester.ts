import type { HotTopic } from '../utils/hotTopics';
import { logEvent, logError } from '../utils/logger';
import { retryFetch } from '../utils/retryFetch';

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
  logEvent({ type: 'openai-request', promptSnippet: prompt.slice(0, 100) });

  try {
    const res = await retryFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
      }),
      retries: 2,
      retryDelayMs: 1000,
    });

    logEvent({ type: 'openai-response-status', status: res.status });

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`OpenAI request failed: ${res.status} ${msg}`);
    }

    const data: any = await res.json();
    logEvent({ type: 'openai-response-received' });
    const text: string = data?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error('OpenAI response missing content');
    }
    logEvent({ type: 'openai-response-text', text: text.slice(0, 200) });

    let jsonText = text;
    const match = /^```(?:json)?\n([\s\S]*?)\n```$/.exec(text);
    if (match) {
      jsonText = match[1];
    }

    const parsed: SuggestedTopic[] = JSON.parse(jsonText);

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

