import test from 'node:test';
import assert from 'node:assert/strict';
import { publishArticleToGitHub } from './githubPublisher.js';

const article = {
  title: 'Polska flaga na kablu: cyberpożar po awariach',
  description: 'Państwo sprawdza odporność cyfrowych usług.',
  content: 'Treść redakcyjna bez powtórzeń. '.repeat(40),
  sourceUrl: 'https://example.com/source',
  tags: ['technologia-i-cyber'],
};

function env(): Env {
  return {
    GITHUB_TOKEN: 'test-token',
    GITHUB_REPO: 'owner/repo',
  } as unknown as Env;
}

test('publishArticleToGitHub creates a branch, two files and a pull request', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; method: string; body?: any }> = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const method = init.method || 'GET';
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    requests.push({ url, method, body });
    if (url.endsWith('/repos/owner/repo')) return Response.json({ default_branch: 'main' });
    if (url.endsWith('/git/ref/heads/main')) return Response.json({ object: { sha: 'base-sha' } });
    if (url.endsWith('/pulls')) return Response.json({ html_url: 'https://github.test/pr/123' });
    return Response.json({}, { status: 201 });
  };

  try {
    const result = await publishArticleToGitHub({
      env: env(),
      article,
      heroImage: Buffer.from('hero'),
      date: '2026-07-13',
    });
    assert.equal(result, 'https://github.test/pr/123');
    assert.equal(requests.length, 6);
    const branchRequest = requests.find(request => request.url.endsWith('/git/refs'))!;
    assert.match(branchRequest.body.ref, /^refs\/heads\/auto-20260713-polska-flaga-na-kabl-[a-f0-9]{8}$/);
    assert.equal(branchRequest.body.sha, 'base-sha');
    const postRequest = requests.find(request => request.url.includes('src%2Fcontent%2Fblog'))!;
    const markdown = Buffer.from(postRequest.body.content, 'base64').toString('utf8');
    assert.match(markdown, /sourceUrl: "https:\/\/example\.com\/source"/);
    assert.match(markdown, /tags: \["technologia-i-cyber"\]/);
    const prRequest = requests.find(request => request.url.endsWith('/pulls'))!;
    assert.equal(prRequest.body.base, 'main');
    assert.equal(prRequest.body.head, branchRequest.body.ref.replace('refs/heads/', ''));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('publishArticleToGitHub removes its branch after a partial upload failure', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; method: string }> = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const method = init.method || 'GET';
    requests.push({ url, method });
    if (url.endsWith('/repos/owner/repo')) return Response.json({ default_branch: 'main' });
    if (url.endsWith('/git/ref/heads/main')) return Response.json({ object: { sha: 'base-sha' } });
    if (url.includes('public%2Fblog-images')) return new Response('invalid image', { status: 422 });
    return Response.json({}, { status: 201 });
  };

  try {
    await assert.rejects(
      publishArticleToGitHub({ env: env(), article, heroImage: Buffer.from('hero'), date: '2026-07-13' }),
      /GitHub image upload failed: 422/,
    );
    const cleanup = requests.at(-1)!;
    assert.equal(cleanup.method, 'DELETE');
    assert.match(cleanup.url, /\/git\/refs\/heads\/auto-20260713-/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('publishArticleToGitHub validates required credentials before network access', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response();
  };

  try {
    await assert.rejects(
      publishArticleToGitHub({ env: {} as Env, article, heroImage: Buffer.from('hero') }),
      /GITHUB_TOKEN is not set/,
    );
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
