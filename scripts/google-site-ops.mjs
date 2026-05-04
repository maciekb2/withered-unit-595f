#!/usr/bin/env node
import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SEARCH_CONSOLE_BASE = 'https://www.googleapis.com/webmasters/v3';
const URL_INSPECTION_BASE = 'https://searchconsole.googleapis.com/v1';
const GA_ADMIN_BASE = 'https://analyticsadmin.googleapis.com/v1beta';
const GA_DATA_BASE = 'https://analyticsdata.googleapis.com/v1beta';

const SCOPES = [
  'https://www.googleapis.com/auth/webmasters',
  'https://www.googleapis.com/auth/analytics.edit',
  'https://www.googleapis.com/auth/analytics.readonly'
];

let tokenCache;

function usage() {
  console.log(`Usage:
  npm run google:site-ops -- searchconsole:list-sites
  npm run google:site-ops -- searchconsole:add-site --site https://example.com/
  npm run google:site-ops -- searchconsole:submit-sitemap --site https://example.com/ --sitemap https://example.com/sitemap-index.xml
  npm run google:site-ops -- searchconsole:inspect --site https://example.com/ --url https://example.com/
  npm run google:site-ops -- searchconsole:query --site https://example.com/ --days 28

  npm run google:site-ops -- ga4:list-accounts
  npm run google:site-ops -- ga4:list-properties --account accounts/123456
  npm run google:site-ops -- ga4:list-streams --property properties/987654321
  npm run google:site-ops -- ga4:create-property --account accounts/123456 --display-name example.com --time-zone Europe/Warsaw --currency PLN
  npm run google:site-ops -- ga4:create-web-stream --property properties/987654321 --display-name example.com --url https://example.com/
  npm run google:site-ops -- ga4:report --property properties/987654321 --days 28

Credentials:
  GOOGLE_SERVICE_ACCOUNT_JSON='{"client_email":...,"private_key":...}'
  or GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json`);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument: ${arg}`);
    }
    const key = arg.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith('--')) {
      options[key] = 'true';
    } else {
      options[key] = next;
      i += 1;
    }
  }

  return { command, options };
}

function requireOption(options, name) {
  const value = options[name];
  if (!value) {
    throw new Error(`Missing required option --${name}`);
  }
  return value;
}

function normalizeResource(prefix, value) {
  if (!value) return value;
  if (value.startsWith(prefix)) return value;
  if (/^\d+$/.test(value)) return `${prefix}${value}`;
  return value;
}

function formatJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

async function loadServiceAccount() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const raw = await readFile(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8');
    return JSON.parse(raw);
  }

  throw new Error('Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.');
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expiresAt - 60 > now) {
    return tokenCache.accessToken;
  }

  const serviceAccount = await loadServiceAccount();
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('Service account JSON must include client_email and private_key.');
  }

  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: SCOPES.join(' '),
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now
  }));
  const unsignedJwt = `${header}.${claim}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsignedJwt);
  signer.end();
  const signature = signer.sign(serviceAccount.private_key, 'base64url');

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsignedJwt}.${signature}`
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Google token request failed (${response.status}): ${JSON.stringify(payload)}`);
  }

  tokenCache = {
    accessToken: payload.access_token,
    expiresAt: now + Number(payload.expires_in || 3600)
  };
  return tokenCache.accessToken;
}

async function googleFetch(url, init = {}) {
  const accessToken = await getAccessToken();
  const headers = {
    authorization: `Bearer ${accessToken}`,
    accept: 'application/json',
    ...init.headers
  };

  const response = await fetch(url, { ...init, headers });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`Google API request failed (${response.status}) ${url}: ${JSON.stringify(payload)}`);
  }

  return payload;
}

function encodePathParam(value) {
  return encodeURIComponent(value);
}

async function listSearchConsoleSites() {
  return googleFetch(`${SEARCH_CONSOLE_BASE}/sites`);
}

async function addSearchConsoleSite(options) {
  const site = requireOption(options, 'site');
  return googleFetch(`${SEARCH_CONSOLE_BASE}/sites/${encodePathParam(site)}`, { method: 'PUT' });
}

async function submitSitemap(options) {
  const site = requireOption(options, 'site');
  const sitemap = requireOption(options, 'sitemap');
  return googleFetch(
    `${SEARCH_CONSOLE_BASE}/sites/${encodePathParam(site)}/sitemaps/${encodePathParam(sitemap)}`,
    { method: 'PUT' }
  );
}

async function inspectUrl(options) {
  const site = requireOption(options, 'site');
  const url = requireOption(options, 'url');
  return googleFetch(`${URL_INSPECTION_BASE}/urlInspection/index:inspect`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      inspectionUrl: url,
      siteUrl: site,
      languageCode: options.language || 'pl-PL'
    })
  });
}

async function querySearchConsole(options) {
  const site = requireOption(options, 'site');
  const days = Number(options.days || 28);
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 2);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);

  return googleFetch(`${SEARCH_CONSOLE_BASE}/sites/${encodePathParam(site)}/searchAnalytics/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      dimensions: ['query', 'page'],
      rowLimit: Number(options.limit || 25)
    })
  });
}

async function listGaAccounts() {
  return googleFetch(`${GA_ADMIN_BASE}/accounts`);
}

async function listGaProperties(options) {
  const account = normalizeResource('accounts/', requireOption(options, 'account'));
  const filter = encodeURIComponent(`parent:${account}`);
  return googleFetch(`${GA_ADMIN_BASE}/properties?filter=${filter}`);
}

async function createGaProperty(options) {
  const account = normalizeResource('accounts/', requireOption(options, 'account'));
  const displayName = requireOption(options, 'display-name');

  return googleFetch(`${GA_ADMIN_BASE}/properties`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      parent: account,
      displayName,
      timeZone: options['time-zone'] || 'Europe/Warsaw',
      currencyCode: options.currency || 'PLN'
    })
  });
}

async function listGaStreams(options) {
  const property = normalizeResource('properties/', requireOption(options, 'property'));
  return googleFetch(`${GA_ADMIN_BASE}/${property}/dataStreams`);
}

async function createGaWebStream(options) {
  const property = normalizeResource('properties/', requireOption(options, 'property'));
  const displayName = requireOption(options, 'display-name');
  const url = requireOption(options, 'url');

  return googleFetch(`${GA_ADMIN_BASE}/${property}/dataStreams`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'WEB_DATA_STREAM',
      displayName,
      webStreamData: {
        defaultUri: url
      }
    })
  });
}

async function runGaReport(options) {
  const property = normalizeResource('properties/', requireOption(options, 'property'));
  const days = `${Number(options.days || 28)}daysAgo`;

  return googleFetch(`${GA_DATA_BASE}/${property}:runReport`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      dateRanges: [{ startDate: days, endDate: 'today' }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
      limit: String(Number(options.limit || 25))
    })
  });
}

const handlers = {
  'searchconsole:list-sites': listSearchConsoleSites,
  'searchconsole:add-site': addSearchConsoleSite,
  'searchconsole:submit-sitemap': submitSitemap,
  'searchconsole:inspect': inspectUrl,
  'searchconsole:query': querySearchConsole,
  'ga4:list-accounts': listGaAccounts,
  'ga4:list-properties': listGaProperties,
  'ga4:create-property': createGaProperty,
  'ga4:list-streams': listGaStreams,
  'ga4:create-web-stream': createGaWebStream,
  'ga4:report': runGaReport
};

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (!command || command === '--help' || command === 'help') {
    usage();
    return;
  }

  const handler = handlers[command];
  if (!handler) {
    usage();
    throw new Error(`Unknown command: ${command}`);
  }

  const result = await handler(options);
  formatJson(result);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
