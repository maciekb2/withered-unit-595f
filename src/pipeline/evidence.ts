import { logEvent, logError } from '../utils/logger';
import { retryFetch } from '../utils/retryFetch';
import { parse } from 'node-html-parser';

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  date?: string;
}

export async function searchWeb(query: string, k = 5): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('TAVILY_API_KEY missing');
  const payload = { api_key: apiKey, query, max_results: k };
  const res = await retryFetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Tavily search failed: ${res.status}`);
  }
  const data: any = await res.json();
  return (data.results || []).map((item: any) => ({
    url: item.url,
    title: item.title,
    snippet: (item.content || '').slice(0, 280),
    date: item.published || item.date,
  }));
}

export interface FetchedArticle {
  url: string;
  title: string;
  text: string;
  date?: string;
  source_type: string;
}

export async function fetchUrl(url: string): Promise<FetchedArticle> {
  const res = await retryFetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
  const html = await res.text();
  const root = parse(html);
  const text = root.querySelectorAll('p').map(p => p.text.trim()).join(' ');
  const title = root.querySelector('title')?.text.trim() || url;
  const date = res.headers.get('date') || undefined;
  return { url, title, text, date, source_type: 'website' };
}

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

const SYSTEM_PROMPT =
  'Zwracaj wyłącznie poprawny JSON jako obiekt top-level.\n' +
  'W razie potrzeby korzystaj z narzędzi: search_web, fetch_url.\n' +
  'Reguły:\n- Każda liczba/data/raport w tekście → refs do evidence.\n' +
  '- Gdy brak pewnych danych → [[TODO-CLAIM]] i bez refs.\n' +
  '- Preferuj źródła instytucjonalne (GUS, Eurostat, NATO, OECD, BBC).\n' +
  '- Nie parafrazuj faktów bez odnośnika.\n' +
  'Struktura:\n{ "evidence": {S*: {...}}, "draft": { "finalTitle": "...", "description": "...", "sections": [{ "h2":"...", "paragraphs":[{"text":"...","refs":["S1"]}]}]}, "bibliography": {S*: {"url":"...","title":"...","date":"..."}} }';

export async function buildEvidenceArticle(apiKey: string, baseTopic: string): Promise<EvidenceDraft> {
  const messages: any[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content:
        `Temat bazowy: "${baseTopic}".\n` +
        'Cel: 4 sekcje, każda 1–2 akapity. Wpleć 1–2 analogie z ostatnich 2 lat.\n' +
        'Wykonaj: najpierw wyszukaj 3–5 źródeł (search_web), pobierz tekst 2–3 najlepszych (fetch_url), zbuduj evidence i draft z przypisami.',
    },
  ];

  const tools = [
    {
      type: 'function',
      function: {
        name: 'search_web',
        description: 'Search the web for topical sources',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            k: { type: 'integer', minimum: 1, maximum: 10 },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'fetch_url',
        description: 'Fetch and extract text from a URL',
        parameters: {
          type: 'object',
          properties: { url: { type: 'string', format: 'uri' } },
          required: ['url'],
        },
      },
    },
  ];

  const toolMap: Record<string, (args: any) => Promise<any>> = {
    search_web: ({ query, k }: { query: string; k?: number }) => searchWeb(query, k),
    fetch_url: ({ url }: { url: string }) => fetchUrl(url),
  };

  while (true) {
    try {
      logEvent({ type: 'evidence-openai-request', messages });
      const res = await retryFetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1',
          messages,
          tools,
          max_completion_tokens: 1500,
        }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`OpenAI request failed: ${res.status} ${msg}`);
      }
      const data: any = await res.json();
      const message = data.choices?.[0]?.message;
      if (!message) throw new Error('OpenAI response missing message');
      if (message.tool_calls && message.tool_calls.length) {
        const toolMessages: any[] = [];
        for (const call of message.tool_calls) {
          const name = call.function.name;
          const args = JSON.parse(call.function.arguments || '{}');
          const fn = toolMap[name];
          if (!fn) throw new Error(`Unknown tool: ${name}`);
          const result = await fn(args);
          toolMessages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
        }
        messages.push(message, ...toolMessages);
        continue;
      }
      if (message.content) {
        return JSON.parse(message.content);
      }
      const err: any = new Error('OpenAI response empty');
      err.data = data;
      throw err;
    } catch (err) {
      logError(err, { type: 'evidence-error' });
      throw err;
    }
  }
}
