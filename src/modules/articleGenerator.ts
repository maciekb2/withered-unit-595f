import { logEvent, logError } from '../utils/logger';
import { retryFetch } from '../utils/retryFetch';

export interface ArticleResult {
  title: string;
  description: string;
  content: string;
}

export interface GenerateArticleOptions {
  apiKey: string;
  prompt: string;
  maxTokens?: number;
  /**
   * Optional list of recent titles to be substituted into the prompt as
   * `"{recent_titles}"`. This helps avoid generating duplicate topics.
   */
  recentTitles?: string[];
}

export async function generateArticle({ apiKey, prompt, maxTokens, recentTitles }: GenerateArticleOptions): Promise<ArticleResult> {
  const finalPrompt = recentTitles
    ? prompt.replace(
        '{recent_titles}',
        recentTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')
      )
    : prompt;
  logEvent({ type: 'generate-article-start' });
  logEvent({
    type: 'openai-request',
    model: 'gpt-4o',
    promptSnippet: finalPrompt.slice(0, 100),
  });
  try {
    const res = await retryFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: finalPrompt }],
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
    if (!data.choices || !data.choices[0]) {
      throw new Error('OpenAI response missing choices');
    }

    const text = data.choices[0].message.content.trim();
    logEvent({ type: 'openai-response-text', text });

    try {
      let jsonText = text;
      // Strip ```json fences if the model included them
      const match = /^```(?:json)?\n([\s\S]*?)\n```$/.exec(text);
      if (match) {
        jsonText = match[1];
      }
      const json: ArticleResult = JSON.parse(jsonText);
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
