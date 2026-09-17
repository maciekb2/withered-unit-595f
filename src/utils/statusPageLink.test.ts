import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { STATUS_PAGE_URL } from '../consts';

test('status page destination is disabled or a public HTTPS URL without credentials', () => {
  if (!STATUS_PAGE_URL) return;
  const url = new URL(STATUS_PAGE_URL);
  assert.equal(url.protocol, 'https:');
  assert.equal(url.username, '');
  assert.equal(url.password, '');
  assert.equal(url.search, '');
  assert.equal(url.hash, '');
});

test('shared footer only shows Status when its destination is configured', () => {
  const footer = readFileSync(new URL('../components/Footer.astro', import.meta.url), 'utf8');
  assert.match(footer, /\{STATUS_PAGE_URL && <a href=\{STATUS_PAGE_URL\}>Status<\/a>\}/);
});
