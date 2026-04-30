export type GenerationErrorCode =
  | 'OPENAI_BILLING_QUOTA_EXCEEDED'
  | 'OPENAI_AUTH_ERROR'
  | 'OPENAI_RATE_LIMIT'
  | 'OPENAI_ERROR'
  | 'GENERATION_ERROR';

export interface ClassifiedGenerationError {
  code: GenerationErrorCode;
  title: string;
  message: string;
  status?: number;
  provider?: string;
  retryable: boolean;
  openAIErrorCode?: string;
  openAIErrorType?: string;
}

export class OpenAIRequestError extends Error {
  readonly provider = 'openai';
  readonly status: number;
  readonly endpoint: string;
  readonly openAIErrorCode?: string;
  readonly openAIErrorType?: string;
  readonly rawBody: string;

  constructor({
    endpoint,
    status,
    rawBody,
    message,
    openAIErrorCode,
    openAIErrorType,
  }: {
    endpoint: string;
    status: number;
    rawBody: string;
    message?: string;
    openAIErrorCode?: string;
    openAIErrorType?: string;
  }) {
    super(message || `OpenAI request failed: ${status} ${rawBody}`);
    this.name = 'OpenAIRequestError';
    this.endpoint = endpoint;
    this.status = status;
    this.rawBody = rawBody;
    this.openAIErrorCode = openAIErrorCode;
    this.openAIErrorType = openAIErrorType;
  }
}

export function createOpenAIRequestError(endpoint: string, status: number, rawBody: string): OpenAIRequestError {
  const parsed = parseOpenAIErrorBody(rawBody);
  const message = parsed.message
    ? `OpenAI request failed: ${status} ${parsed.message}`
    : `OpenAI request failed: ${status} ${rawBody}`;

  return new OpenAIRequestError({
    endpoint,
    status,
    rawBody,
    message,
    openAIErrorCode: parsed.code,
    openAIErrorType: parsed.type,
  });
}

export function classifyGenerationError(error: unknown): ClassifiedGenerationError {
  if (isOpenAIBillingQuotaError(error)) {
    return {
      code: 'OPENAI_BILLING_QUOTA_EXCEEDED',
      title: 'Brak środków lub limitu w OpenAI API',
      message:
        'OpenAI odrzuciło żądanie z powodu limitu rozliczeniowego, braku kredytów albo wyczerpanej kwoty. Doładuj konto lub zmień billing, a potem uruchom generowanie ponownie.',
      status: getStatus(error),
      provider: 'openai',
      retryable: false,
      openAIErrorCode: getStringProp(error, 'openAIErrorCode'),
      openAIErrorType: getStringProp(error, 'openAIErrorType'),
    };
  }

  if (isOpenAIAuthError(error)) {
    return {
      code: 'OPENAI_AUTH_ERROR',
      title: 'Błąd autoryzacji OpenAI API',
      message: 'OpenAI odrzuciło klucz API lub uprawnienia. Sprawdź sekret OPENAI_API_KEY.',
      status: getStatus(error),
      provider: 'openai',
      retryable: false,
      openAIErrorCode: getStringProp(error, 'openAIErrorCode'),
      openAIErrorType: getStringProp(error, 'openAIErrorType'),
    };
  }

  if (isOpenAIRateLimitError(error)) {
    return {
      code: 'OPENAI_RATE_LIMIT',
      title: 'Limit tempa OpenAI API',
      message: 'OpenAI zwróciło rate limit. To zwykle błąd przejściowy, spróbuj ponownie później.',
      status: getStatus(error),
      provider: 'openai',
      retryable: true,
      openAIErrorCode: getStringProp(error, 'openAIErrorCode'),
      openAIErrorType: getStringProp(error, 'openAIErrorType'),
    };
  }

  if (isOpenAIError(error)) {
    return {
      code: 'OPENAI_ERROR',
      title: 'Błąd OpenAI API',
      message: getErrorMessage(error) || 'OpenAI API zwróciło błąd podczas generowania.',
      status: getStatus(error),
      provider: 'openai',
      retryable: true,
      openAIErrorCode: getStringProp(error, 'openAIErrorCode'),
      openAIErrorType: getStringProp(error, 'openAIErrorType'),
    };
  }

  return {
    code: 'GENERATION_ERROR',
    title: 'Błąd generowania artykułu',
    message: getErrorMessage(error) || 'Nie udało się wygenerować artykułu.',
    retryable: true,
  };
}

function parseOpenAIErrorBody(rawBody: string): { message?: string; code?: string; type?: string } {
  try {
    const body = JSON.parse(rawBody);
    const err = body?.error || body;
    return {
      message: typeof err?.message === 'string' ? err.message : undefined,
      code: typeof err?.code === 'string' ? err.code : undefined,
      type: typeof err?.type === 'string' ? err.type : undefined,
    };
  } catch {
    return {};
  }
}

function isOpenAIBillingQuotaError(error: unknown): boolean {
  const haystack = normalizedErrorText(error);
  return [
    'insufficient_quota',
    'billing_hard_limit',
    'billing_not_active',
    'payment_required',
    'exceeded your current quota',
    'check your plan and billing',
    'credit balance',
    'credits have been exhausted',
    'no credits',
    'out of credits',
    'quota exceeded',
  ].some(pattern => haystack.includes(pattern));
}

function isOpenAIAuthError(error: unknown): boolean {
  const status = getStatus(error);
  const haystack = normalizedErrorText(error);
  return status === 401 || status === 403 || haystack.includes('invalid api key');
}

function isOpenAIRateLimitError(error: unknown): boolean {
  const status = getStatus(error);
  const haystack = normalizedErrorText(error);
  return status === 429 || haystack.includes('rate limit');
}

function isOpenAIError(error: unknown): boolean {
  return error instanceof OpenAIRequestError || normalizedErrorText(error).includes('openai');
}

function normalizedErrorText(error: unknown): string {
  return [
    getErrorMessage(error),
    getStringProp(error, 'openAIErrorCode'),
    getStringProp(error, 'openAIErrorType'),
    getStringProp(error, 'rawBody'),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || '');
}

function getStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && typeof (error as { status?: unknown }).status === 'number') {
    return (error as { status: number }).status;
  }
  return undefined;
}

function getStringProp(error: unknown, prop: string): string | undefined {
  if (error && typeof error === 'object') {
    const value = (error as Record<string, unknown>)[prop];
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
}
