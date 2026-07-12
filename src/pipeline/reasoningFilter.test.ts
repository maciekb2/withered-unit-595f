import test from 'node:test';
import assert from 'node:assert/strict';
import { stripModelReasoning } from './reasoningFilter.js';

test('stripModelReasoning removes explicit think blocks and fences', () => {
  assert.equal(stripModelReasoning('<think>plan</think>\n```\nGotowy tekst:\nTreść.\n```'), 'Treść.');
});

test('stripModelReasoning keeps the last requested section after planning leakage', () => {
  const raw = 'The style guide says: plan.\n\n## Mechanizm\nplanowanie\n\n## Mechanizm\nWłaściwy akapit po polsku.';
  assert.equal(stripModelReasoning(raw, 'Mechanizm'), '## Mechanizm\nWłaściwy akapit po polsku.');
});

test('stripModelReasoning removes visible English planning paragraphs', () => {
  const raw = '## Wątek\n\nEach paragraph must be anchored in a concrete element.\n\nEuropa finansuje bezpieczeństwo, a koszt przesuwa na sąsiadów.';
  assert.equal(stripModelReasoning(raw), '## Wątek\n\nEuropa finansuje bezpieczeństwo, a koszt przesuwa na sąsiadów.');
});
