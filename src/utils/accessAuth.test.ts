import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import type { JSONWebKeySet } from 'jose';
import {
  isGenerationPath,
  generationCorsHeaders,
  requireCloudflareAccess,
  setCloudflareAccessJwksForTesting,
} from './accessAuth.js';

function env(overrides: Partial<Env> = {}): Env {
  return {
    CF_ACCESS_TEAM_DOMAIN: 'https://team.example.test',
    CF_ACCESS_AUD: 'audience-one',
    CF_ACCESS_ALLOWED_EMAILS: '',
    ...overrides,
  } as Env;
}

test('isGenerationPath matches only protected generation routes', () => {
  assert.equal(isGenerationPath('/generuj'), true);
  assert.equal(isGenerationPath('/generuj.html'), true);
  assert.equal(isGenerationPath('/api/generate-stream'), true);
  assert.equal(isGenerationPath('/api/get-prompt'), true);
  assert.equal(isGenerationPath('/api/contact'), false);
  assert.equal(isGenerationPath('/blog'), false);
});

test('generation CORS headers allow only the same origin with credentials', () => {
  const sameOrigin = generationCorsHeaders(new Request('https://pseudointelekt.pl/api/client-log', {
    headers: { Origin: 'https://pseudointelekt.pl' },
  }));
  assert.equal(sameOrigin.get('Access-Control-Allow-Origin'), 'https://pseudointelekt.pl');
  assert.equal(sameOrigin.get('Access-Control-Allow-Credentials'), 'true');
  assert.equal(sameOrigin.get('Access-Control-Allow-Methods'), 'GET, POST, OPTIONS');

  const foreignOrigin = generationCorsHeaders(new Request('https://pseudointelekt.pl/api/client-log', {
    headers: { Origin: 'https://attacker.example' },
  }));
  assert.equal(foreignOrigin.get('Access-Control-Allow-Origin'), null);
});

test('requireCloudflareAccess allows local development without Access config', async () => {
  const result = await requireCloudflareAccess(
    new Request('http://localhost:4321/api/generate-stream'),
    env({ CF_ACCESS_TEAM_DOMAIN: '', CF_ACCESS_AUD: '' }),
  );

  assert.equal(result.response, undefined);
  assert.deepEqual(result.identity, {
    email: 'local-dev',
    sub: 'local-dev',
    method: 'local-dev',
  });
});

test('requireCloudflareAccess rejects missing Access configuration', async () => {
  const result = await requireCloudflareAccess(
    new Request('https://pseudointelekt.pl/api/generate-stream'),
    env({ CF_ACCESS_TEAM_DOMAIN: '', CF_ACCESS_AUD: '' }),
  );

  assert.equal(result.response?.status, 403);
  assert.equal(
    await result.response?.text(),
    'Cloudflare Access is not configured for this endpoint',
  );
});

test('requireCloudflareAccess rejects missing token', async () => {
  const result = await requireCloudflareAccess(
    new Request('https://pseudointelekt.pl/api/generate-stream'),
    env(),
  );

  assert.equal(result.response?.status, 403);
  assert.equal(await result.response?.text(), 'Missing Cloudflare Access token');
});

test('requireCloudflareAccess accepts a valid Access JWT and normalizes identity', async () => {
  const issuer = 'https://access-valid.example.test';
  const audience = 'audience-valid';
  const { token, jwks } = await signedAccessToken({
    issuer,
    audience,
    email: 'Operator@Example.COM',
    sub: 'user-123',
  });

  await withLocalJwks(issuer, jwks, async () => {
    const result = await requireCloudflareAccess(
      new Request('https://pseudointelekt.pl/api/generate-stream', {
        headers: { 'cf-access-jwt-assertion': token },
      }),
      env({
        CF_ACCESS_TEAM_DOMAIN: issuer,
        CF_ACCESS_AUD: audience,
        CF_ACCESS_ALLOWED_EMAILS: 'operator@example.com',
      }),
    );

    assert.equal(result.response, undefined);
    assert.deepEqual(result.identity, {
      email: 'operator@example.com',
      sub: 'user-123',
      aud: audience,
      method: 'user',
      serviceTokenClientIdSuffix: undefined,
    });
  });
});

test('requireCloudflareAccess marks service-token authentication in audit identity', async () => {
  const issuer = 'https://access-service-token.example.test';
  const audience = 'audience-service-token';
  const { token, jwks } = await signedAccessToken({
    issuer,
    audience,
    sub: 'service-token-subject',
  });

  await withLocalJwks(issuer, jwks, async () => {
    const result = await requireCloudflareAccess(
      new Request('https://pseudointelekt.pl/api/generate-stream', {
        headers: {
          'cf-access-jwt-assertion': token,
          'cf-access-client-id': '1234567890abcdef.access',
        },
      }),
      env({
        CF_ACCESS_TEAM_DOMAIN: issuer,
        CF_ACCESS_AUD: audience,
        CF_ACCESS_ALLOWED_EMAILS: 'operator@example.com',
      }),
    );

    assert.equal(result.response, undefined);
    assert.deepEqual(result.identity, {
      email: 'unknown',
      sub: 'service-token-subject',
      aud: audience,
      method: 'service-token',
      serviceTokenClientIdSuffix: 'bcdef.access',
    });
  });
});

test('requireCloudflareAccess rejects valid JWTs from disallowed emails', async () => {
  const issuer = 'https://access-denied.example.test';
  const audience = 'audience-denied';
  const { token, jwks } = await signedAccessToken({
    issuer,
    audience,
    email: 'other@example.com',
    sub: 'user-456',
  });

  await withLocalJwks(issuer, jwks, async () => {
    const result = await requireCloudflareAccess(
      new Request('https://pseudointelekt.pl/api/generate-stream', {
        headers: { 'cf-access-jwt-assertion': token },
      }),
      env({
        CF_ACCESS_TEAM_DOMAIN: issuer,
        CF_ACCESS_AUD: audience,
        CF_ACCESS_ALLOWED_EMAILS: 'operator@example.com',
      }),
    );

    assert.equal(result.response?.status, 403);
    assert.equal(await result.response?.text(), 'Forbidden');
  });
});

async function signedAccessToken({
  issuer,
  audience,
  email,
  sub,
}: {
  issuer: string;
  audience: string;
  email?: string;
  sub: string;
}) {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = 'test-key';
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';

  const token = await new SignJWT(email ? { email } : {})
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);

  return { token, jwks: { keys: [publicJwk] } };
}

async function withLocalJwks(
  issuer: string,
  jwks: JSONWebKeySet,
  run: () => Promise<void>,
) {
  setCloudflareAccessJwksForTesting(createLocalJWKSet(jwks), issuer);
  try {
    await run();
  } finally {
    setCloudflareAccessJwksForTesting(undefined);
  }
}
