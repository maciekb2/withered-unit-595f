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
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'user', content: prompt },
        ],
      }),
    });

    const data: any = await res.json();
    const text = data.choices[0].message.content.trim();

    try {
      const json: ArticleResult = JSON.parse(text);
      logEvent({ type: 'generate-article-complete', title: json.title });
      return json;
    } catch (_) {
      const lines = text.split(/\n+/);
      const titleLine = lines.find((l: string) => l.startsWith('#')) || 'Untitled';
      const title = titleLine.replace(/^#+\s*/, '').trim();
      const content = text;
      const result = { title, description: '', content };
      logEvent({ type: 'generate-article-complete', title });
      return result;
    }
  } catch (err) {
    logError(err, { type: 'generate-article-error' });
    throw err;
  }
}
