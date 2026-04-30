import { logEvent, logError } from '../utils/logger';
import { createOpenAIRequestError } from '../utils/openaiErrors';
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
  provider?: TextGenerationProvider;
}

const MAX_LENGTH_RETRIES = 3;
const MAX_TOKEN_CAP = 12000;

export type TextGenerationProvider =
  | { type: 'openai' }
  | {
      type: 'jetson';
      gatewayUrl: string;
      token: string;
      model?: string;
      timeoutMs?: number;
      disableThinking?: boolean;
      fallback?: 'openai' | 'none';
      fallbackModel?: string;
      accessClientId?: string;
      accessClientSecret?: string;
    };

export function textGenerationProviderFromEnv(env: Env): TextGenerationProvider {
  if ((env.TEXT_GENERATION_PROVIDER || 'openai') !== 'jetson') {
    return { type: 'openai' };
  }

  return {
    type: 'jetson',
    gatewayUrl: env.JETSON_GATEWAY_URL || '',
    token: env.JETSON_GATEWAY_TOKEN || '',
    model: env.JETSON_GATEWAY_MODEL || env.OPENAI_TEXT_MODEL || 'qwen3:4b',
    timeoutMs: Number.parseInt(env.JETSON_GATEWAY_TIMEOUT_MS || '', 10) || 120000,
    disableThinking: env.JETSON_GATEWAY_DISABLE_THINKING !== 'false',
    fallback: env.TEXT_GENERATION_FALLBACK === 'none' ? 'none' : 'openai',
    fallbackModel: env.TEXT_GENERATION_FALLBACK_MODEL || env.OPENAI_TEXT_MODEL || 'gpt-5',
    accessClientId: env.JETSON_ACCESS_CLIENT_ID,
    accessClientSecret: env.JETSON_ACCESS_CLIENT_SECRET,
  };
}

export async function chat(
  apiKey: string,
  {
    messages,
    max_completion_tokens,
    model = 'gpt-5',
    response_format,
    response_style,
    provider = { type: 'openai' },
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

  if (provider.type === 'jetson') {
    try {
      return await chatJetson(provider, {
        messages: finalMessages,
        max_completion_tokens,
        model: provider.model || model,
        response_format,
        response_style,
      });
    } catch (err) {
      logError(err, { type: 'jetson-error', fallback: provider.fallback || 'openai' });
      if (provider.fallback !== 'none') {
        if (provider.fallbackModel) {
          model = provider.fallbackModel;
        }
        logEvent({ type: 'text-provider-fallback', from: 'jetson', to: 'openai', model });
      } else {
        throw err;
      }
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
      const endpoint = 'https://api.openai.com/v1/chat/completions';
      const res = await retryFetch(endpoint, {
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
        throw createOpenAIRequestError(endpoint, res.status, msg);
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
      let usedParsed = false;

      if (message.parsed !== undefined) {
        try {
          text =
            typeof message.parsed === 'string'
              ? message.parsed.trim()
              : JSON.stringify(message.parsed);
          usedParsed = true;
        } catch (err) {
          logError(err, { type: 'openai-parse-serialize-error' });
          text = '';
        }
      }

      if (!text) {
        const content = message.content;
        if (Array.isArray(content)) {
          text = content
            .map((c: any) => {
              if (!c) return '';
              if (typeof c === 'string') return c;
              if (typeof c.text === 'string') return c.text;
              if (Array.isArray(c.output_text)) return c.output_text.join('');
              if (typeof c.output_text === 'string') return c.output_text;
              return '';
            })
            .join('')
            .trim();
        } else if (typeof content === 'string') {
          text = content.trim();
        } else if (content && typeof content.text === 'string') {
          text = content.text.trim();
        }
      }

      if (!text) {
        const outputText = (message as any).output_text;
        if (Array.isArray(outputText)) {
          text = outputText.join('').trim();
        } else if (typeof outputText === 'string') {
          text = outputText.trim();
        }
      }

      if (!text && message.parsed !== undefined) {
        try {
          text = JSON.stringify(message.parsed);
          usedParsed = true;
        } catch {}
      }

      logEvent({ type: 'openai-response-text', text, usedParsed });
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

      if (attempt < MAX_LENGTH_RETRIES - 1) {
        logEvent({
          type: 'openai-retry-empty',
          attempt,
          next_attempt: attempt + 1,
          finish_reason: finish,
        });
        await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
        continue;
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

async function chatJetson(
  provider: Extract<TextGenerationProvider, { type: 'jetson' }>,
  {
    messages,
    max_completion_tokens,
    model,
    response_format,
    response_style,
  }: Omit<ChatOptions, 'provider'>,
): Promise<string> {
  if (!provider.gatewayUrl || !provider.token) {
    throw new Error('Jetson gateway is not configured');
  }

  const url = new URL('/api/generate', provider.gatewayUrl.replace(/\/+$/, ''));
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${provider.token}`,
  };
  if (provider.disableThinking) {
    headers['X-Disable-Thinking'] = 'true';
  }
  if (provider.accessClientId && provider.accessClientSecret) {
    headers['CF-Access-Client-Id'] = provider.accessClientId;
    headers['CF-Access-Client-Secret'] = provider.accessClientSecret;
  }

  const timeoutMs = provider.timeoutMs || 120000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  logEvent({
    type: 'jetson-request',
    model,
    response_style,
    max_tokens: max_completion_tokens,
    gatewayHost: url.host,
  });

  try {
    const res = await retryFetch(url.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        max_completion_tokens,
        response_format,
        response_style,
        stream: false,
      }),
      signal: controller.signal,
      retries: 1,
      retryDelayMs: 1000,
    });
    logEvent({ type: 'jetson-response-status', status: res.status });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Jetson gateway request failed: ${res.status} ${msg}`);
    }

    const contentType = res.headers.get('Content-Type') || '';
    const raw = contentType.includes('application/json')
      ? extractJetsonText(await res.json())
      : (await res.text()).trim();

    if (!raw) {
      throw new Error('Jetson gateway response empty');
    }
    logEvent({ type: 'jetson-response-received' });
    return raw;
  } finally {
    clearTimeout(timeout);
  }
}

function extractJetsonText(data: any): string {
  if (typeof data === 'string') return data.trim();
  if (!data || typeof data !== 'object') return '';

  if (typeof data.response === 'string') return data.response.trim();
  if (typeof data.text === 'string') return data.text.trim();
  if (typeof data.content === 'string') return data.content.trim();
  if (typeof data.output === 'string') return data.output.trim();
  if (typeof data.message?.content === 'string') return data.message.content.trim();
  if (Array.isArray(data.choices) && data.choices[0]) {
    const choice = data.choices[0];
    if (typeof choice.text === 'string') return choice.text.trim();
    if (typeof choice.message?.content === 'string') {
      return choice.message.content.trim();
    }
  }

  return '';
}
