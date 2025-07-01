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
    return json;
  } catch (_) {
    // Fallback if response is plain markdown with title in first heading
    const lines = text.split(/\n+/);
    const titleLine = lines.find((l: string) => l.startsWith('#')) || 'Untitled';
    const title = titleLine.replace(/^#+\s*/, '').trim();
    const content = text;
    return { title, description: '', content };
  }
}
