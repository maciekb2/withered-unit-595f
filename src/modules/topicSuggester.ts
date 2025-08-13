import type { HotTopic } from '../utils/hotTopics';
import { logEvent, logError } from '../utils/logger';
import { extractJson } from '../utils/json';
import { chat, type ChatMessage } from '../pipeline/openai';
import { guardrails } from '../pipeline/guardrails';

export interface SuggestedTopic {
  title: string;
  rationale: string;
}

export interface SuggestedTopicResult {
  suggestions: SuggestedTopic[];
  messages: ChatMessage[];
  raw: string;
}

export async function suggestArticleTopic(
  hotTopics: HotTopic[],
  recentTitles: string[],
  apiKey: string,
): Promise<SuggestedTopicResult> {
  const userPrompt = [
    'Mam listę gorących tematów:',
    ...hotTopics.map((t, i) => `${i + 1}. ${t.title} – ${t.url}`),
    '',
    'Oraz listę ostatnich artykułów:',
    ...recentTitles.map((t, i) => `${i + 1}. ${t}`),
    '',
    'Zaproponuj 3 tytuły artykułów satyrycznych, ironicznych, w tonie centro-prawicowym (PL-patriotycznym), unikając powtórzeń z listy.',
    'Dla każdego dodaj krótkie uzasadnienie wyboru tematu.',
    'Odpowiedz TYLKO w formacie JSON array { title, rationale } bez dodatkowego tekstu.',
  ].join('\n');

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set');
  }

  logEvent({ type: 'suggest-topic-start' });
  const messages: ChatMessage[] = [
    { role: 'system', content: guardrails() },
    { role: 'user', content: userPrompt },
  ];
  let raw = '';
  let parsed: any;
  try {
    raw = await chat(apiKey, {
      messages,
      max_completion_tokens: 2000,
      response_format: { type: 'json_object' },
      response_style: 'brief',
    });

    parsed = extractJson<any>(raw);
    const arrKey = Array.isArray(parsed)
      ? null
      : typeof parsed === 'object' && parsed
        ? Object.keys(parsed).find(k => Array.isArray((parsed as any)[k])) || null
        : null;
    const arr: SuggestedTopic[] = Array.isArray(parsed)
      ? parsed
      : arrKey
        ? (parsed as any)[arrKey]
        : (() => {
            const keys = parsed && typeof parsed === 'object' ? Object.keys(parsed).join(', ') : String(parsed);
            throw new Error(`Parsed response is not an array (keys: ${keys})`);
          })();
    logEvent({ type: 'suggest-topic-parsed', parsed, arrayKey: arrKey });

    const lowerRecent = recentTitles.map(t => t.toLowerCase());
    const result: SuggestedTopic[] = [];
    for (const s of arr) {
      const lowerTitle = s.title.toLowerCase();
      if (!lowerRecent.includes(lowerTitle) && !result.some(r => r.title.toLowerCase() === lowerTitle)) {
        result.push(s);
      }
    }

    logEvent({ type: 'suggest-topic-complete', count: result.length });
    return { suggestions: result, messages, raw };
  } catch (err) {
    (err as any).prompt = userPrompt;
    (err as any).messages = messages;
    (err as any).raw = raw;
    if (parsed) (err as any).parsed = parsed;
    logError(err, { type: 'suggest-topic-error' });
    throw err;
  }
}

