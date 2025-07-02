import { logEvent, logError } from '../utils/logger';

export interface ArticleResult {
  title: string;
  description: string;
  content: string;
}

export interface GenerateArticleOptions {
  apiKey: string;
  prompt: string;
}

export async function generateArticle({ apiKey, prompt }: GenerateArticleOptions): Promise<ArticleResult> {
  logEvent({ type: 'generate-article-start' });
  logEvent({
    type: 'openai-request',
    model: 'gpt-4o',
    promptSnippet: prompt.slice(0, 100),
  });
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    logEvent({ type: 'openai-response-status', status: res.status });

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`OpenAI request failed: ${res.status} ${msg}`);
    }

    const data: any = await res.json();
    logEvent({ type: 'openai-response-received' });
    if (!data.choices || !data.choices[0]) {
      throw new Error('OpenAI response missing choices');
    }

    const text = data.choices[0].message.content.trim();

    try {
      const json: ArticleResult = JSON.parse(text);
      logEvent({ type: 'parse-json-success', title: json.title });
      logEvent({ type: 'generate-article-complete', title: json.title });
      return json;
    } catch (_) {
      const lines = text.split(/\n+/);
      const titleLine = lines.find((l: string) => l.startsWith('#')) || 'Untitled';
      const title = titleLine.replace(/^#+\s*/, '').trim();
      const content = text;
      const result = { title, description: '', content };
      logEvent({ type: 'parse-json-fallback', title });
      logEvent({ type: 'generate-article-complete', title });
      return result;
    }
  } catch (err) {
    logError(err, { type: 'generate-article-error' });
    throw err;
  }
}
