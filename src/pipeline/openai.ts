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
const JETSON_REQUEST_TIMEOUT_CAP_MS = 90000;
const DEFAULT_CLOUDFLARE_AI_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';
const DEFAULT_CLOUDFLARE_AI_DAILY_NEURON_LIMIT = 8000;

export type TextGenerationProvider =
  | { type: 'openai' }
  | {
      type: 'cloudflare-ai';
      binding?: Ai;
      logsDb?: D1Database;
      model?: string;
      fallback?: 'openai' | 'none';
      fallbackModel?: string;
      dailyNeuronLimit?: number;
      disabled?: boolean;
      disabledReason?: string;
    }
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
      disabled?: boolean;
      disabledReason?: string;
    };

export function textGenerationProviderFromEnv(env: Env): TextGenerationProvider {
  const provider = env.TEXT_GENERATION_PROVIDER || 'openai';
  if (provider === 'cloudflare-ai') {
    return {
      type: 'cloudflare-ai',
      binding: env.AI,
      logsDb: env.pseudointelekt_logs_db,
      model: env.CLOUDFLARE_AI_TEXT_MODEL || DEFAULT_CLOUDFLARE_AI_MODEL,
      fallback: env.TEXT_GENERATION_FALLBACK === 'none' ? 'none' : 'openai',
      fallbackModel: env.TEXT_GENERATION_FALLBACK_MODEL || env.OPENAI_TEXT_MODEL || 'gpt-5',
      dailyNeuronLimit:
        Number.parseInt(env.CLOUDFLARE_AI_DAILY_NEURON_LIMIT || '', 10) ||
        DEFAULT_CLOUDFLARE_AI_DAILY_NEURON_LIMIT,
    };
  }

  if (provider !== 'jetson') {
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

  if (provider.type === 'cloudflare-ai' && !provider.disabled) {
    try {
      return await chatCloudflareAi(provider, {
        messages: finalMessages,
        max_completion_tokens,
        model: provider.model || model,
        // The native gateway does not understand OpenAI's nested
        // json_schema response_format. The prompt carries the JSON contract;
        // leaving the native `format` field unset avoids empty responses on
        // the current qwen3 gateway.
        response_style,
      });
    } catch (err) {
      const classified = classifyCloudflareAiError(err);
      logError(err, {
        type: 'cloudflare-ai-error',
        code: classified.code,
        fallback: provider.fallback || 'openai',
      });
      logEvent({
        type: classified.eventType,
        code: classified.code,
        retryable: classified.retryable,
        message: classified.message.slice(0, 180),
      });
      if (provider.fallback !== 'none') {
        provider.disabled = true;
        provider.disabledReason = `${classified.code}: ${classified.message}`;
        logEvent({
          type: 'cloudflare-ai-disabled-for-run',
          code: classified.code,
          reason: provider.disabledReason.slice(0, 180),
        });
        if (provider.fallbackModel) {
          model = provider.fallbackModel;
        }
        logEvent({ type: 'text-provider-fallback', from: 'cloudflare-ai', to: 'openai', model });
      } else {
        throw err;
      }
    }
  } else if (provider.type === 'cloudflare-ai' && provider.disabled) {
    if (provider.fallbackModel) {
      model = provider.fallbackModel;
    }
    logEvent({
      type: 'text-provider-skip-disabled-cloudflare-ai',
      to: 'openai',
      model,
      reason: provider.disabledReason?.slice(0, 180) || 'disabled',
    });
  }

  if (provider.type === 'jetson' && !provider.disabled) {
    try {
      return await chatJetson(provider, {
        messages: finalMessages,
        max_completion_tokens,
        model: provider.model || model,
        response_style,
      });
    } catch (err) {
      logError(err, { type: 'jetson-error', fallback: provider.fallback || 'openai' });
      if (provider.fallback !== 'none') {
        provider.disabled = true;
        provider.disabledReason = err instanceof Error ? err.message : String(err);
        logEvent({
          type: 'jetson-disabled-for-run',
          reason: provider.disabledReason.slice(0, 180),
        });
        if (provider.fallbackModel) {
          model = provider.fallbackModel;
        }
        logEvent({ type: 'text-provider-fallback', from: 'jetson', to: 'openai', model });
      } else {
        throw err;
      }
    }
  } else if (provider.type === 'jetson' && provider.disabled) {
    if (provider.fallbackModel) {
      model = provider.fallbackModel;
    }
    logEvent({
      type: 'text-provider-skip-disabled-jetson',
      to: 'openai',
      model,
      reason: provider.disabledReason?.slice(0, 180) || 'disabled',
    });
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

async function chatCloudflareAi(
  provider: Extract<TextGenerationProvider, { type: 'cloudflare-ai' }>,
  {
    messages,
    max_completion_tokens,
    model,
    response_format,
    response_style,
  }: Omit<ChatOptions, 'provider'>,
): Promise<string> {
  if (!provider.binding) {
    throw new Error('Cloudflare Workers AI binding is not configured');
  }

  const estimatedNeurons = estimateCloudflareAiNeurons(
    model || DEFAULT_CLOUDFLARE_AI_MODEL,
    messages,
    max_completion_tokens,
  );
  const dailyUsed = await getCloudflareAiDailyEstimatedNeurons(provider.logsDb);
  const dailyLimit = provider.dailyNeuronLimit || DEFAULT_CLOUDFLARE_AI_DAILY_NEURON_LIMIT;
  logEvent({
    type: 'cloudflare-ai-budget-check',
    model,
    dailyUsed,
    estimatedNeurons,
    dailyLimit,
  });
  if (dailyUsed + estimatedNeurons > dailyLimit) {
    throw new Error(
      `Cloudflare AI estimated daily budget exceeded: ${Math.ceil(dailyUsed + estimatedNeurons)} > ${dailyLimit} neurons`,
    );
  }

  const body: Record<string, unknown> = {
    messages,
    max_tokens: max_completion_tokens,
  };
  if (response_format) body.response_format = response_format;
  if (response_style) body.response_style = response_style;

  logEvent({
    type: 'cloudflare-ai-request',
    model,
    response_style,
    max_tokens: max_completion_tokens,
    estimatedNeurons,
  });
  const started = Date.now();
  const data = await provider.binding.run((model || DEFAULT_CLOUDFLARE_AI_MODEL) as keyof AiModels, body as any);
  logEvent({
    type: 'cloudflare-ai-response-received',
    model,
    durationMs: Date.now() - started,
  });

  const text = extractCloudflareAiText(data);
  logEvent({
    type: 'cloudflare-ai-usage',
    model,
    estimatedNeurons,
    estimatedInputTokens: estimateTokens(messages.map(message => message.content).join('\n')),
    estimatedOutputTokens: max_completion_tokens,
    dailyLimit,
  });
  logEvent({ type: 'cloudflare-ai-response-text', text });
  if (!text) {
    logEvent({ type: 'cloudflare-ai-response-debug', data });
    throw new Error('Cloudflare AI response empty');
  }

  return text;
}

function classifyCloudflareAiError(error: unknown): {
  code: string;
  eventType: string;
  message: string;
  retryable: boolean;
} {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes('daily free allocation') ||
    normalized.includes('10,000 neurons') ||
    normalized.includes('10000 neurons') ||
    normalized.includes('4006')
  ) {
    return {
      code: 'CLOUDFLARE_AI_FREE_QUOTA_EXHAUSTED',
      eventType: 'cloudflare-ai-free-quota-exhausted',
      message,
      retryable: false,
    };
  }

  if (normalized.includes('estimated daily budget exceeded')) {
    return {
      code: 'CLOUDFLARE_AI_LOCAL_BUDGET_EXCEEDED',
      eventType: 'cloudflare-ai-local-budget-exceeded',
      message,
      retryable: false,
    };
  }

  if (normalized.includes('rate') || normalized.includes('429')) {
    return {
      code: 'CLOUDFLARE_AI_RATE_LIMIT',
      eventType: 'cloudflare-ai-rate-limit',
      message,
      retryable: true,
    };
  }

  return {
    code: 'CLOUDFLARE_AI_ERROR',
    eventType: 'cloudflare-ai-error-classified',
    message,
    retryable: true,
  };
}

function extractCloudflareAiText(data: unknown): string {
  if (typeof data === 'string') return data.trim();
  if (!data || typeof data !== 'object') return '';
  const value = data as any;
  if (typeof value.response === 'string') return value.response.trim();
  if (typeof value.result === 'string') return value.result.trim();
  if (typeof value.text === 'string') return value.text.trim();
  if (typeof value.output === 'string') return value.output.trim();
  if (typeof value.content === 'string') return value.content.trim();
  if (typeof value.message?.content === 'string') return value.message.content.trim();
  if (Array.isArray(value.choices) && value.choices[0]) {
    const choice = value.choices[0];
    if (typeof choice.text === 'string') return choice.text.trim();
    if (typeof choice.message?.content === 'string') return choice.message.content.trim();
  }
  return '';
}

async function getCloudflareAiDailyEstimatedNeurons(db?: D1Database): Promise<number> {
  if (!db) return 0;
  try {
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const result = await db
      .prepare(`
        SELECT COALESCE(SUM(CAST(json_extract(data, '$.estimatedNeurons') AS REAL)), 0) AS used
        FROM logs
        WHERE time >= ?1
          AND json_extract(data, '$.type') = 'cloudflare-ai-usage'
      `)
      .bind(dayStart.toISOString())
      .first<{ used: number }>();
    return Number(result?.used || 0);
  } catch (err) {
    logError(err, { type: 'cloudflare-ai-budget-query-error' });
    return 0;
  }
}

function estimateCloudflareAiNeurons(
  model: string,
  messages: ChatMessage[],
  maxCompletionTokens: number,
): number {
  const inputTokens = estimateTokens(messages.map(message => message.content).join('\n'));
  const pricing = cloudflareAiNeuronPricing(model);
  return (inputTokens / 1_000_000) * pricing.input + (maxCompletionTokens / 1_000_000) * pricing.output;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function cloudflareAiNeuronPricing(model: string): { input: number; output: number } {
  if (model.includes('qwen3-30b-a3b-fp8')) return { input: 4625, output: 30475 };
  if (model.includes('gpt-oss-120b')) return { input: 31818, output: 68182 };
  if (model.includes('gpt-oss-20b')) return { input: 18182, output: 27273 };
  if (model.includes('llama-3.3-70b-instruct-fp8-fast')) return { input: 26668, output: 204805 };
  if (model.includes('gemma-4-26b-a4b-it')) return { input: 9091, output: 27273 };
  if (model.includes('llama-3.2-3b-instruct')) return { input: 4625, output: 30475 };
  return { input: 31876, output: 50488 };
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
    headers['x-openclaw-disable-thinking'] = 'true';
  }
  if (provider.accessClientId && provider.accessClientSecret) {
    headers['CF-Access-Client-Id'] = provider.accessClientId;
    headers['CF-Access-Client-Secret'] = provider.accessClientSecret;
  }

  const timeoutMs = Math.min(provider.timeoutMs || 120000, JETSON_REQUEST_TIMEOUT_CAP_MS);
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<Response>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(`Jetson gateway request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  logEvent({
    type: 'jetson-request',
    model,
    response_style,
    max_tokens: max_completion_tokens,
    gatewayHost: url.host,
    timeoutMs,
  });

  try {
    const fetchPromise = retryFetch(url.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        // Helpdesk Model Gateway exposes Ollama's native `/api/generate`
        // contract, which accepts a single prompt rather than Chat Completions
        // messages. Preserve roles explicitly so system guardrails remain in
        // the local-model request.
        prompt: messages.map(message => `[${message.role}]\n${message.content}`).join('\n\n'),
        max_completion_tokens,
        options: {
          num_predict: max_completion_tokens,
        },
        // Ollama's native switch is more reliable than gateway-specific
        // headers for Qwen3; keep the header for older gateways below.
        think: false,
        response_format,
        response_style,
        stream: false,
      }),
      signal: controller.signal,
      retries: 0,
      retryDelayMs: 1000,
    });
    fetchPromise.catch(() => undefined);
    const res = await Promise.race([fetchPromise, timeoutPromise]);
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
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function extractJetsonText(data: any): string {
  if (typeof data === 'string') return stripThinking(data);
  if (!data || typeof data !== 'object') return '';

  if (typeof data.response === 'string') return stripThinking(data.response);
  if (typeof data.text === 'string') return stripThinking(data.text);
  if (typeof data.content === 'string') return stripThinking(data.content);
  if (typeof data.output === 'string') return stripThinking(data.output);
  if (typeof data.message?.content === 'string') return stripThinking(data.message.content);
  if (Array.isArray(data.choices) && data.choices[0]) {
    const choice = data.choices[0];
    if (typeof choice.text === 'string') return stripThinking(choice.text);
    if (typeof choice.message?.content === 'string') {
      return stripThinking(choice.message.content);
    }
  }

  return '';
}

function stripThinking(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();
}
