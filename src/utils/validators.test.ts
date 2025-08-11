import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFinalJson, yamlEscape } from './validators.js';

const baseArticle = {
  title: 'Tytul',
  description: 'Opis bez markdownu',
  content: 'a'.repeat(800)
};

test('validateFinalJson passes for valid article', () => {
  const res = validateFinalJson(baseArticle);
  assert.equal(res.ok, true);
  assert.equal(res.errs.length, 0);
});

test('validateFinalJson fails for markdown in description', () => {
  const res = validateFinalJson({ ...baseArticle, description: 'Hello #world' });
  assert.equal(res.ok, false);
  assert.ok(res.errs.some(e => e.includes('markdown')));
});

test('validateFinalJson fails for short content', () => {
  const res = validateFinalJson({ ...baseArticle, content: 'short' });
  assert.equal(res.ok, false);
  assert.ok(res.errs.some(e => e.includes('800')));
});

test('yamlEscape escapes quotes', () => {
  assert.equal(yamlEscape('A "quote"'), 'A \\"quote\\"');
});
