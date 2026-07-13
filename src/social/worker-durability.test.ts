import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('social worker commits public assets before Buffer and checkpoints every draft', async () => {
  const source = await readFile(new URL('../../scripts/social-worker.mjs', import.meta.url), 'utf8');
  const processBody = source.slice(source.indexOf('async function processOne()'), source.indexOf('async function main()'));
  const persist = processBody.indexOf('persistAsset(client');
  const assetCommit = processBody.indexOf("await client.query('COMMIT')", persist);
  const drafts = processBody.indexOf('await createDrafts(client', assetCommit);
  const statusTransaction = processBody.indexOf("await client.query('BEGIN')", drafts);
  assert.ok(persist >= 0 && assetCommit > persist && drafts > assetCommit && statusTransaction > drafts);

  const draftsBody = source.slice(source.indexOf('async function createDrafts('), source.indexOf('async function notifyRunIfReady('));
  assert.ok(draftsBody.indexOf('await bufferSaveDraft(') < draftsBody.indexOf('INSERT INTO social_publications'));
  assert.equal(draftsBody.includes("client.query('BEGIN')"), false);
  assert.match(source, /existingId \? 'editPost' : 'createPost'/u);
  assert.match(source, /\?v=\$\{checksum\.slice\(0, 12\)\}/u);
  assert.match(source, /scheduled_for IS NULL OR scheduled_for <= now\(\)/u);
  assert.match(source, /now\(\)\+interval '15 minutes'/u);
  assert.match(source, /GREATEST\(attempts-1,0\)/u);
});
