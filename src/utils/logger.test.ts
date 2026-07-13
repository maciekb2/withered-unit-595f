import test from 'node:test';
import assert from 'node:assert/strict';
import { logsTableDdl } from './logger.js';

test('self-hosted logger uses PostgreSQL-compatible DDL', () => {
  const ddl = logsTableDdl('node-selfhosted');
  assert.match(ddl, /BIGSERIAL/);
  assert.match(ddl, /JSONB/);
  assert.doesNotMatch(ddl, /AUTOINCREMENT/);
});

test('worker logger keeps the D1 schema', () => {
  assert.match(logsTableDdl(), /AUTOINCREMENT/);
});
