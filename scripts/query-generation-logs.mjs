#!/usr/bin/env node
import fs from 'node:fs';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 200;

function usage() {
  console.log(`Usage: npm run logs:audit -- [options]

Query production D1 audit logs without exposing them through a public endpoint.

Options:
  --generation           Show generation-related events only
  --session <id>         Filter by sessionId
  --email <address>      Filter by Cloudflare Access email
  --sub <id>             Filter by Cloudflare Access subject
  --type <event>         Filter by event type
  --topic <text>         Search full JSON payload for a topic string
  --url <text>           Search full JSON payload for a publication/source URL
  --contains <text>      Search full JSON payload for arbitrary text
  --since <iso-time>     Filter by D1 row time, for example 2026-04-30T09:00:00Z
  --limit <number>       Number of rows to return, default ${DEFAULT_LIMIT}, max ${MAX_LIMIT}
  --full                 Print parsed payload for each row
  --json                 Print raw query results as JSON
  --help                 Show this help

Required environment:
  CLOUDFLARE_API_TOKEN or CF_API_TOKEN
  CLOUDFLARE_ACCOUNT_ID or CF_ACCOUNT_ID
`);
}

function parseArgs(argv) {
  const args = {
    limit: DEFAULT_LIMIT,
    generation: false,
    full: false,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const readValue = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${arg} requires a value`);
      }
      index += 1;
      return value;
    };

    switch (arg) {
      case '--generation':
        args.generation = true;
        break;
      case '--session':
        args.session = readValue();
        break;
      case '--email':
        args.email = readValue().toLowerCase();
        break;
      case '--sub':
        args.sub = readValue();
        break;
      case '--type':
        args.type = readValue();
        break;
      case '--topic':
        args.topic = readValue();
        break;
      case '--url':
        args.url = readValue();
        break;
      case '--contains':
        args.contains = readValue();
        break;
      case '--since':
        args.since = readValue();
        break;
      case '--limit':
        args.limit = Number.parseInt(readValue(), 10);
        break;
      case '--full':
        args.full = true;
        break;
      case '--json':
        args.json = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!Number.isFinite(args.limit) || args.limit < 1) {
    throw new Error('--limit must be a positive number');
  }
  args.limit = Math.min(args.limit, MAX_LIMIT);
  return args;
}

function getD1DatabaseId() {
  const config = JSON.parse(fs.readFileSync('wrangler.json', 'utf8'));
  const database = config.d1_databases?.find(
    entry => entry.binding === 'pseudointelekt_logs_db',
  );
  if (!database?.database_id) {
    throw new Error('Cannot find pseudointelekt_logs_db database_id in wrangler.json');
  }
  return database.database_id;
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, match => `\\${match}`);
}

function addJsonFilter(filters, params, jsonPath, value) {
  filters.push(`json_extract(data, '${jsonPath}') = ?`);
  params.push(value);
}

function addPayloadSearch(filters, params, value) {
  filters.push("data LIKE ? ESCAPE '\\'");
  params.push(`%${escapeLike(value)}%`);
}

function buildQuery(args) {
  const filters = [];
  const params = [];

  if (args.generation) {
    filters.push(`(
      json_extract(data, '$.type') LIKE 'generation-%'
      OR json_extract(data, '$.type') IN (
        'access-auth-email-denied',
        'access-auth-invalid-token',
        'access-auth-misconfigured',
        'access-auth-missing-token',
        'access-auth-ok',
        'client-log',
        'generate-stream-start',
        'get-prompt',
        'update-prompt'
      )
    )`);
  }
  if (args.since) {
    filters.push('time >= ?');
    params.push(args.since);
  }
  if (args.session) addJsonFilter(filters, params, '$.sessionId', args.session);
  if (args.email) addJsonFilter(filters, params, '$.accessEmail', args.email);
  if (args.sub) addJsonFilter(filters, params, '$.accessSub', args.sub);
  if (args.type) addJsonFilter(filters, params, '$.type', args.type);
  if (args.topic) addPayloadSearch(filters, params, args.topic);
  if (args.url) addPayloadSearch(filters, params, args.url);
  if (args.contains) addPayloadSearch(filters, params, args.contains);

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const sql = `
    SELECT
      id,
      time,
      worker_id,
      json_extract(data, '$.type') AS event_type,
      json_extract(data, '$.sessionId') AS session_id,
      json_extract(data, '$.accessEmail') AS access_email,
      json_extract(data, '$.topic') AS topic,
      json_extract(data, '$.url') AS url,
      data
    FROM logs
    ${where}
    ORDER BY id DESC
    LIMIT ${args.limit}
  `;

  return { sql, params };
}

async function queryD1({ sql, params }) {
  const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
  if (!token) throw new Error('Set CLOUDFLARE_API_TOKEN or CF_API_TOKEN');
  if (!accountId) throw new Error('Set CLOUDFLARE_ACCOUNT_ID or CF_ACCOUNT_ID');

  const databaseId = getD1DatabaseId();
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    },
  );

  const body = await response.json();
  if (!response.ok || !body.success) {
    throw new Error(JSON.stringify(body.errors || body, null, 2));
  }

  return body.result?.[0]?.results || [];
}

function parsePayload(row) {
  try {
    return JSON.parse(row.data);
  } catch {
    return {};
  }
}

function compact(value, length = 80) {
  if (value == null || value === '') return '-';
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text.length > length ? `${text.slice(0, length - 1)}...` : text;
}

function printRows(rows, args) {
  if (args.json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  if (rows.length === 0) {
    console.log('No matching logs.');
    return;
  }

  for (const row of rows) {
    const payload = parsePayload(row);
    console.log(
      [
        `#${row.id}`,
        row.time,
        row.event_type || payload.method || 'request',
        `session=${compact(row.session_id || payload.sessionId, 36)}`,
        `email=${compact(row.access_email || payload.accessEmail, 48)}`,
        `topic=${compact(row.topic || payload.topic)}`,
        `url=${compact(row.url || payload.url)}`,
      ].join(' | '),
    );
    if (args.full) {
      console.log(JSON.stringify(payload, null, 2));
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  const query = buildQuery(args);
  const rows = await queryD1(query);
  printRows(rows, args);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
