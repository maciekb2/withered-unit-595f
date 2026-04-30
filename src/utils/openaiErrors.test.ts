import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyGenerationError, createOpenAIRequestError } from './openaiErrors.js';

test('classifies insufficient quota before generic rate limit', () => {
  const error = createOpenAIRequestError(
    'https://api.openai.com/v1/chat/completions',
    429,
    JSON.stringify({
      error: {
        message: 'You exceeded your current quota, please check your plan and billing details.',
        type: 'insufficient_quota',
        code: 'insufficient_quota',
      },
    }),
  );

  const classified = classifyGenerationError(error);

  assert.equal(classified.code, 'OPENAI_BILLING_QUOTA_EXCEEDED');
  assert.equal(classified.retryable, false);
  assert.equal(classified.status, 429);
  assert.equal(classified.openAIErrorCode, 'insufficient_quota');
  assert.equal(classified.openAIErrorType, 'insufficient_quota');
});

test('classifies normal OpenAI 429 as retryable rate limit', () => {
  const error = createOpenAIRequestError(
    'https://api.openai.com/v1/chat/completions',
    429,
    JSON.stringify({
      error: {
        message: 'Rate limit reached for requests.',
        type: 'rate_limit_exceeded',
        code: 'rate_limit_exceeded',
      },
    }),
  );

  const classified = classifyGenerationError(error);

  assert.equal(classified.code, 'OPENAI_RATE_LIMIT');
  assert.equal(classified.retryable, true);
  assert.equal(classified.status, 429);
});
