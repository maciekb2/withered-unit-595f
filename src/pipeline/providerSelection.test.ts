import test from 'node:test';
import assert from 'node:assert/strict';
import { modelForProvider } from './providerSelection.js';

test('OpenAI fallback never receives a local Jetson model name', () => {
  assert.equal(modelForProvider({ type: 'openai' }, 'qwen3:30b', 'gpt-5'), 'gpt-5');
});

test('local provider keeps its configured model', () => {
  assert.equal(
    modelForProvider(
      { type: 'jetson', gatewayUrl: 'http://jetson.test', token: 'test', model: 'qwen3:30b' },
      'qwen3:30b',
      'gpt-5',
    ),
    'qwen3:30b',
  );
});
