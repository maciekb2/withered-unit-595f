import { logEvent, logError } from '../utils/logger';
import { retryFetch } from '../utils/retryFetch';

export interface ChatOptions {
  system?: string;
  user: string;
  max_completion_tokens: number;
  model?: string;
  response_format?: Record<string, unknown>;
}

export async function chat(apiKey: string, {
  system,
  user,
  max_completion_tokens,
  model = 'gpt-5',
  response_format,
}: ChatOptions): Promise<string> {
  const messages: any[] = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: user });

  logEvent({ type: 'openai-request', model, promptSnippet: user.slice(0, 100) });
  try {
    const body: Record<string, unknown> = {
      model,
      max_completion_tokens,
      messages,
    };
    if (response_format) body.response_format = response_format;
    const res = await retryFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
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

    const message = data.choices[0].message || {};
    if (message.refusal) {
      logEvent({ type: 'openai-response-refusal', refusal: message.refusal });
      throw new Error(`OpenAI refusal: ${message.refusal}`);
    }

    let text = '';
    const content = message.content;
    if (Array.isArray(content)) {
      text = content.map((c: any) => c.text || '').join('').trim();
    } else if (typeof content === 'string') {
      text = content.trim();
    } else if (content && typeof content.text === 'string') {
      text = content.text.trim();
    } else if (message.parsed) {
      try {
        text = JSON.stringify(message.parsed).trim();
      } catch {}
    }

    logEvent({ type: 'openai-response-text', text });
    if (!text) {
      logEvent({ type: 'openai-response-debug', message });
      throw new Error('OpenAI response empty');
    }
    return text;
  } catch (err) {
    logError(err, { type: 'openai-error' });
    throw err;
  }
}
