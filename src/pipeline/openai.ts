import { logEvent, logError } from '../utils/logger';
import { retryFetch } from '../utils/retryFetch';

export interface ChatMessage {
  role: string;
  content: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  max_completion_tokens: number;
  model?: string;
  response_format?: Record<string, unknown>;
  response_style?: 'brief' | 'normal' | 'full';
}

const MAX_LENGTH_RETRIES = 5;
const MAX_TOKEN_CAP = 12000;

export async function chat(
  apiKey: string,
  {
    messages,
    max_completion_tokens,
    model = 'gpt-5',
    response_format,
    response_style,
  }: ChatOptions,
): Promise<string> {
  let finalMessages = messages;
  if (response_style) {
    const styleMsg = { role: 'system', content: `response_style:${response_style}` };
    if (messages.length && messages[0].role === 'system') {
      finalMessages = [messages[0], styleMsg, ...messages.slice(1)];
    } else {
      finalMessages = [styleMsg, ...messages];
    }
  }

  let tokens = Math.min(max_completion_tokens, MAX_TOKEN_CAP);
  for (let attempt = 0; attempt < MAX_LENGTH_RETRIES; attempt++) {
    const userMsg = finalMessages.findLast?.(m => m.role === 'user') || finalMessages[finalMessages.length - 1];
    logEvent({
      type: 'openai-request',
      model,
      messages: finalMessages,
      response_style,
      max_tokens: tokens,
      attempt,
      promptSnippet: userMsg?.content?.slice(0, 100) || '',
    });
    try {
      const body: Record<string, unknown> = {
        model,
        max_completion_tokens: tokens,
        messages: finalMessages,
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
      if (data.usage) {
        logEvent({ type: 'openai-usage', usage: data.usage });
      }
      if (!data.choices || !data.choices[0]) {
        throw new Error('OpenAI response missing choices');
      }

      const choice = data.choices[0];
      const message = choice.message || {};
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
      }

      if (!text && message.parsed) {
        try {
          text = (typeof message.parsed === 'string'
            ? message.parsed
            : JSON.stringify(message.parsed)
          ).trim();
        } catch {}
      }

      logEvent({ type: 'openai-response-text', text });
      if (text) return text;

      const finish = choice.finish_reason;
      logEvent({
        type: 'openai-response-debug',
        message,
        data,
        finish_reason: finish,
      });
      if (finish === 'length' && attempt < MAX_LENGTH_RETRIES - 1) {
        const nextTokens = Math.min(tokens * 2, MAX_TOKEN_CAP);
        if (nextTokens > tokens) {
          tokens = nextTokens;
          logEvent({ type: 'openai-retry-length', next_max_tokens: tokens, attempt });
          continue;
        }
      }

      const err: any = new Error('OpenAI response empty');
      err.debug = { message, data, finish_reason: finish };
      throw err;
    } catch (err) {
      logError(err, { type: 'openai-error' });
      throw err;
    }
  }
  throw new Error('OpenAI response empty after retries');
}
