import type { HotTopic } from '../utils/hotTopics';
import { logEvent, logError } from '../utils/logger';
import { extractJson } from '../utils/json';
import { chat, type ChatMessage, type TextGenerationProvider } from '../pipeline/openai';
import { guardrails } from '../pipeline/guardrails';

export interface SuggestedTopic {
  title: string;
  rationale: string;
  sourceUrl?: string;
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
  model?: string,
  provider?: TextGenerationProvider,
): Promise<SuggestedTopicResult> {
  const userPrompt = [
    'Mam listę gorących tematów:',
    ...hotTopics.map((t, i) => {
      const desc = (t as any).description ? `\n   Lead: ${(t as any).description}` : '';
      return `${i + 1}. ${t.title} – ${t.url} (${t.source}, ${t.published})${desc}`;
    }),
    '',
    'Oraz listę ostatnich artykułów:',
    ...recentTitles.map((t, i) => `${i + 1}. ${t}`),
    '',
    'Zaproponuj 3 konkretne, ironiczne tytuły publicystyczne, unikając powtórzeń z listy i generycznych metafor o szachownicy, teatrze, cyrku lub wielkiej grze.',
    'Polska perspektywe dodaj tylko wtedy, gdy goracy temat ma bezposredni polski wymiar.',
    'Dla każdego dodaj krótkie uzasadnienie wyboru tematu.',
    'Dla każdego przepisz sourceUrl jako dokładny URL jednego gorącego tematu, z którego wynika propozycja.',
    'Odpowiedz TYLKO w formacie JSON array { title, rationale, sourceUrl } bez dodatkowego tekstu.',
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
      model,
      provider,
      response_format: { type: 'json_object' },
      response_style: 'brief',
    });

    parsed = extractJson<any>(raw);
    const arrKey = Array.isArray(parsed)
      ? null
      : typeof parsed === 'object' && parsed
        ? Object.keys(parsed).find(k => Array.isArray((parsed as any)[k])) || null
        : null;
    const singleton = isSuggestedTopic(parsed) ? [parsed] : null;
    const arr: SuggestedTopic[] = Array.isArray(parsed)
      ? parsed
      : arrKey
        ? (parsed as any)[arrKey]
        : singleton
          ? singleton
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
        result.push(withSourceUrl(s, hotTopics));
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

function isSuggestedTopic(value: unknown): value is SuggestedTopic {
  if (!value || typeof value !== 'object') return false;
  const topic = value as Partial<SuggestedTopic>;
  return typeof topic.title === 'string' && typeof topic.rationale === 'string';
}

function withSourceUrl(topic: SuggestedTopic, hotTopics: HotTopic[]): SuggestedTopic {
  if (topic.sourceUrl && hotTopics.some(hot => hot.url === topic.sourceUrl)) return topic;
  const inferred = inferSourceTopic(`${topic.title} ${topic.rationale}`, hotTopics);
  return inferred ? { ...topic, sourceUrl: inferred.url } : topic;
}

function inferSourceTopic(value: string, hotTopics: HotTopic[]): HotTopic | undefined {
  const queryTokens = topicTokens(value);
  if (queryTokens.size === 0) return undefined;

  let best: { topic: HotTopic; score: number } | undefined;
  for (const topic of hotTopics) {
    const haystack = topicTokens(`${topic.title} ${topic.description || ''} ${topic.source}`);
    let score = 0;
    for (const token of queryTokens) {
      if (haystack.has(token)) score += 1;
    }
    if (!best || score > best.score) best = { topic, score };
  }
  return best && best.score >= 2 ? best.topic : undefined;
}

function topicTokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[^a-z0-9]+/i)
      .filter(token => token.length >= 4 && !COMMON_TOPIC_TOKENS.has(token)),
  );
}

const COMMON_TOPIC_TOKENS = new Set([
  'przy',
  'jako',
  'oraz',
  'ktory',
  'ktora',
  'temat',
  'article',
  'news',
  'says',
  'said',
  'with',
  'from',
  'that',
  'this',
  'will',
]);
