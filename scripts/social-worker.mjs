#!/usr/bin/env node
import pg from 'pg';
import { jsonrepair } from 'jsonrepair';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { buildYouTubeDraftText } from './social-copy.mjs';
import { ensureSocialOutro } from './social-outro.mjs';
import { buildSocialMotionFilter, buildSocialSceneCopy, buildSocialWhooshFilter, socialBodyDuration } from './social-motion.mjs';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
const mediaRoot = path.resolve(process.env.SOCIAL_MEDIA_DIR || '/data/social');
const musicRoot = path.resolve(process.env.SOCIAL_MUSIC_DIR || '/data/music');
const publicBase = (process.env.PUBLIC_SITE_URL || 'https://pseudointelekt.pl').replace(/\/$/, '');
const intervalMs = Number(process.env.SOCIAL_WORKER_INTERVAL_MS || 900000);
const enabled = process.env.SOCIAL_WORKER_ENABLED !== 'false';
const dryRun = process.env.SOCIAL_BUFFER_DRY_RUN !== 'false';
const maxAttempts = Number(process.env.SOCIAL_MAX_ATTEMPTS || 3);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const clampScore = value => Math.max(0, Math.min(2, Number(value) || 0));
const safeJson = text => JSON.parse(jsonrepair(text.replace(/^```(?:json)?|```$/gmi, '').trim()));

async function jetson(prompt, maxTokens = 1400) {
  const gateway = process.env.JETSON_GATEWAY_URL;
  const token = process.env.JETSON_GATEWAY_TOKEN;
  if (!gateway || !token) throw new Error('Jetson gateway is not configured');
  const response = await fetch(new URL('/api/generate', gateway.replace(/\/+$/, '')), {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'x-openclaw-disable-thinking': 'true' },
    body: JSON.stringify({
      model: process.env.SOCIAL_LLM_MODEL || process.env.JETSON_GATEWAY_MODEL || 'qwen3:30b',
      prompt,
      stream: false,
      think: false,
      max_completion_tokens: maxTokens,
      options: { num_predict: maxTokens },
    }),
    signal: AbortSignal.timeout(Number(process.env.SOCIAL_LLM_TIMEOUT_MS || 90000)),
  });
  if (!response.ok) throw new Error(`Jetson returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const data = await response.json();
  const text = data.response || data.text || data.output || data.content;
  if (!text) throw new Error('Jetson returned an empty response');
  return text;
}

async function scoreSource(source) {
  const raw = await jetson(`Jesteś selekcjonerem social media Pseudointelektu. Nie dodawaj faktów. Oceń materiał w skali 0-2 w pięciu polach. Zwróć wyłącznie JSON bez komentarza: {"topicality":0,"recognizability":0,"ironyPotential":0,"clarity":0,"hookStrength":0}.\nMATERIAŁ:\n${JSON.stringify(source)}`, 350);
  const value = safeJson(raw);
  const score = {
    topicality: clampScore(value.topicality), recognizability: clampScore(value.recognizability),
    ironyPotential: clampScore(value.ironyPotential), clarity: clampScore(value.clarity), hookStrength: clampScore(value.hookStrength),
  };
  score.total = Object.values(score).reduce((sum, item) => sum + item, 0);
  return score;
}

const banned = ['w dzisiejszym świecie','warto zauważyć','przyjrzyjmy się','dynamiczna sytuacja','sytuacja jest złożona','geopolityczna szachownica','czas pokaże'];
function validatePackage(pkg, source) {
  const errors = [];
  const all = [pkg.hook,pkg.instagramCaption,pkg.youtubeTitle,pkg.youtubeDescription,...(pkg.scenes || [])].join(' ').toLowerCase();
  if (banned.some(item => all.includes(item))) errors.push('generic phrasing');
  if (!pkg.hook || pkg.hook.length < 20 || pkg.hook.length > 130) errors.push('hook length');
  if (!Array.isArray(pkg.scenes) || pkg.scenes.length < 5 || pkg.scenes.length > 6 || pkg.scenes.some(s => s.length < 8 || s.length > 115)) errors.push('scene contract');
  if (!Array.isArray(pkg.hashtags) || pkg.hashtags.length > 5) errors.push('hashtag contract');
  if (!pkg.youtubeTitle || pkg.youtubeTitle.length > 100) errors.push('youtube title');
  const sourceText = [source.title,source.lead,...source.summaryPoints].join(' ').toLowerCase();
  for (const number of all.match(/\b\d+(?:[.,]\d+)?%?\b/g) || []) if (!sourceText.includes(number)) errors.push(`new number ${number}`);
  return [...new Set(errors)];
}

async function writePackage(source, score) {
  const prompt = `Jesteś redaktorem social media marki Pseudointelekt. Ton: chłodny, inteligentny, ironiczny i konkretny. Ironia dotyczy instytucji, decyzji i narracji, nigdy cech osobistych. Nie dodawaj żadnych nowych faktów, liczb, nazw ani interpretacji spoza materiału. Krótkie naturalne zdania po polsku, bez korpomowy i bez fraz AI. Zwróć wyłącznie JSON: {"hook":"20-130 znaków","instagramCaption":"do 600 znaków z CTA","youtubeTitle":"do 100 znaków","youtubeDescription":"do 800 znaków z CTA","scenes":["5 lub 6 plansz, każda 8-115 znaków"],"hashtags":["maksymalnie 5 hashtagów"]}. Ostatnia scena zawiera wezwanie do przeczytania tekstu na pseudointelekt.pl.\nMATERIAŁ:\n${JSON.stringify(source)}`;
  let feedback = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const parsed = safeJson(await jetson(`${prompt}${feedback}`));
      const pkg = parsed.socialPackage || parsed.package || parsed;
      pkg.score = score;
      pkg.template = 'situation-room-v1';
      const errors = validatePackage(pkg, source);
      if (!errors.length) return pkg;
      feedback = `\nPOPRZEDNI WYNIK BYŁ BŁĘDNY: ${errors.join(', ')}. Zwróć wszystkie wymagane pola dokładnie raz.`;
    } catch (error) {
      feedback = `\nPOPRZEDNI WYNIK NIE BYŁ POPRAWNYM JSON: ${error instanceof Error ? error.message.slice(0, 180) : 'unknown error'}. Zwróć tylko obiekt JSON.`;
    }
  }
  const hashtags = (source.tags || []).slice(0, 4).map(tag => `#${tag.toLocaleLowerCase('pl').replace(/[^\p{L}\p{N}_]/gu, '')}`).filter(tag => tag.length > 1);
  const pkg = {
    score,
    hook: source.title.slice(0, 130),
    instagramCaption: `${source.lead.slice(0, 470)} Więcej na pseudointelekt.pl.`,
    youtubeTitle: source.title.slice(0, 100),
    youtubeDescription: `${source.lead.slice(0, 650)} Więcej na pseudointelekt.pl.`,
    scenes: [source.title, source.lead, ...source.summaryPoints.slice(0, 3), 'Cała analiza na pseudointelekt.pl.'].map(value => value.slice(0, 115)).slice(0, 6),
    hashtags: hashtags.slice(0, 5),
    template: 'situation-room-v1',
  };
  const errors = validatePackage(pkg, source);
  if (errors.length) throw new Error(`deterministic social fallback rejected: ${errors.join(', ')}`);
  return pkg;
}

async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr = `${stderr}${chunk}`.slice(-4000); });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}: ${stderr}`)));
  });
}

async function download(url, destination) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`asset download returned HTTP ${response.status}`);
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

const ffText = file => file.replaceAll('\\', '/').replaceAll(':', '\\:').replaceAll("'", "\\'");
function wrapText(value, width = 28) {
  const lines = [];
  let line = '';
  for (const word of value.split(/\s+/)) {
    if (line && `${line} ${word}`.length > width) { lines.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines.slice(0, 5).join('\n');
}
async function render(job, pkg) {
  const dir = path.join(mediaRoot, job.id);
  await mkdir(dir, { recursive: true });
  const hero = job.master_image_path;
  if (!hero || !path.resolve(hero).startsWith(mediaRoot + path.sep)) throw new Error('weekly master image is missing or outside media root');
  const sceneFiles = [];
  const renderScenes = buildSocialSceneCopy(pkg);
  for (let i = 0; i < renderScenes.length; i++) {
    const file = path.join(dir, `scene-${i}.txt`);
    await writeFile(file, wrapText(renderScenes[i], 24), 'utf8');
    sceneFiles.push(file);
  }
  const musicFiles = (await readdir(musicRoot)).filter(name => /\.(mp3|m4a|wav|ogg)$/i.test(name)).sort();
  if (!musicFiles.length) throw new Error('approved music library is empty');
  const musicIndex = createHash('sha256').update(job.slug).digest().readUInt32BE(0) % musicFiles.length;
  const music = musicFiles[musicIndex];
  const duration = socialBodyDuration(renderScenes.length);
  const motionFilter = buildSocialMotionFilter(sceneFiles, ffText);
  const audioFilter = buildSocialWhooshFilter(renderScenes.length);
  const reel = path.join(dir, 'short.mp4');
  const body = path.join(dir, 'short-body.mp4');
  await run('ffmpeg', ['-y','-loop','1','-i',hero,'-stream_loop','-1','-i',path.join(musicRoot,music),'-f','lavfi','-i',`anoisesrc=color=pink:amplitude=0.8:sample_rate=48000:d=${duration}`,'-t',String(duration),'-vf',motionFilter,'-filter_complex',audioFilter,'-map','0:v:0','-map','[aout]','-c:v','libx264','-preset','medium','-crf','21','-pix_fmt','yuv420p','-r','30','-video_track_timescale','90000','-c:a','aac','-b:a','128k','-ar','48000','-movflags','+faststart','-shortest',body]);
  const outro = await ensureSocialOutro({ mediaRoot, run });
  const concatFile = path.join(dir, 'concat.txt');
  await writeFile(concatFile, `file '${ffText(body)}'\nfile '${ffText(outro)}'\n`, 'utf8');
  await run('ffmpeg', ['-y','-f','concat','-safe','0','-i',concatFile,'-c','copy','-movflags','+faststart',reel]);
  const post = path.join(dir, 'instagram-post.png');
  const hookFile = path.join(dir, 'hook.txt');
  await writeFile(hookFile, wrapText(pkg.hook, 30), 'utf8');
  await run('ffmpeg', ['-y','-i',hero,'-vf',`scale=960:760:force_original_aspect_ratio=decrease,pad=1080:1350:(ow-iw)/2:120:0x031712,drawbox=x=0:y=820:w=iw:h=530:color=0x031712ee:t=fill,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile='${ffText(hookFile)}':fontcolor=0xf4f0df:fontsize=48:line_spacing=14:x=64:y=900:box=1:boxcolor=0x031712cc:boxborderw=24,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text=PSEUDOINTELEKT:fontcolor=0xdabc42:fontsize=28:x=64:y=54`,'-frames:v','1',post]);
  return { reel, post };
}

async function persistAsset(client, jobId, kind, file) {
  const data = await readFile(file);
  const info = await stat(file);
  const checksum = createHash('sha256').update(data).digest('hex');
  const result = await client.query(`INSERT INTO social_assets(job_id,kind,path,checksum,bytes) VALUES($1,$2,$3,$4,$5) ON CONFLICT(job_id,kind) DO UPDATE SET path=EXCLUDED.path,checksum=EXCLUDED.checksum,bytes=EXCLUDED.bytes,expires_at=now()+interval '60 days' RETURNING public_token`, [jobId,kind,file,checksum,info.size]);
  return `${publicBase}/media/social/${result.rows[0].public_token}/${path.basename(file)}?v=${checksum.slice(0, 12)}`;
}

const gqlString = value => JSON.stringify(value);
function bufferMetadata(channel, youtubeTitle) {
  return channel === 'instagram_reel'
    ? ',metadata:{instagram:{type:reel,shouldShareToFeed:true,isAiGenerated:true}}'
    : channel === 'instagram_post'
      ? ',metadata:{instagram:{type:post,shouldShareToFeed:true,isAiGenerated:true}}'
      : `,metadata:{youtube:{title:${gqlString(youtubeTitle)},categoryId:"25",privacy:public,madeForKids:false,isAiGenerated:true}}`;
}

async function bufferSaveDraft({ existingId, channelId, text, mediaUrl, mediaType, channel, youtubeTitle }) {
  if (dryRun || !process.env.BUFFER_API_KEY || !channelId) return existingId || `dry-run-${Date.now()}`;
  const asset = mediaType === 'video' ? `video: { url: ${gqlString(mediaUrl)} }` : `image: { url: ${gqlString(mediaUrl)} }`;
  const metadata = bufferMetadata(channel, youtubeTitle);
  const action = existingId ? 'editPost' : 'createPost';
  const identity = existingId ? `id:${gqlString(existingId)}` : `channelId:${gqlString(channelId)}`;
  const query = `mutation SaveDraftPost { ${action}(input:{${identity},text:${gqlString(text)},schedulingType:automatic,mode:addToQueue,saveToDraft:true,assets:[{${asset}}]${metadata}}) { ... on PostActionSuccess { post { id } } ... on MutationError { message } } }`;
  const response = await fetch('https://api.buffer.com', { method:'POST', headers:{'content-type':'application/json',authorization:`Bearer ${process.env.BUFFER_API_KEY}`}, body:JSON.stringify({query}), signal:AbortSignal.timeout(30000) });
  const data = await response.json();
  const result = data?.data?.[action];
  if (!response.ok || data.errors?.length || !result?.post?.id) throw new Error(`Buffer draft failed: ${result?.message || data.errors?.[0]?.message || response.status}`);
  return result.post.id;
}

async function createDrafts(client, job, pkg, urls) {
  const utm = channel => `${job.source.articleUrl}?utm_source=${channel}&utm_medium=social&utm_campaign=article_social&utm_content=${job.source.slug}-${job.variant_key || 'weekly'}-situation-room-v2`;
  const specs = [
    ['instagram_reel',process.env.BUFFER_INSTAGRAM_CHANNEL_ID,`${pkg.instagramCaption}\n\n${pkg.hashtags.join(' ')}\n${utm('instagram')}`,urls.reel,'video'],
    ['youtube_short',process.env.BUFFER_YOUTUBE_CHANNEL_ID,buildYouTubeDraftText(pkg,utm('youtube')),urls.reel,'video'],
  ];
  if (pkg.staticPost) specs.push(['instagram_post',process.env.BUFFER_INSTAGRAM_CHANNEL_ID,`${pkg.instagramCaption}\n\n${pkg.hashtags.join(' ')}\n${utm('instagram')}`,urls.post,'image']);
  for (const [channel,channelId,text,url,type] of specs) {
    if (!channelId && !dryRun) continue;
    const existing = await client.query('SELECT buffer_draft_id FROM social_publications WHERE job_id=$1 AND channel=$2', [job.id, channel]);
    const id = await bufferSaveDraft({ existingId: existing.rows[0]?.buffer_draft_id, channelId, text, mediaUrl: url, mediaType: type, channel, youtubeTitle: pkg.youtubeTitle });
    await client.query(`INSERT INTO social_publications(job_id,channel,buffer_draft_id,status,variant_key) VALUES($1,$2,$3,'draft',$4) ON CONFLICT(job_id,channel) DO UPDATE SET buffer_draft_id=EXCLUDED.buffer_draft_id,status='draft',variant_key=EXCLUDED.variant_key,updated_at=now()`, [job.id,channel,id,job.variant_key]);
  }
}

async function notifyRunIfReady(runId) {
  if (!runId || !process.env.SLACK_WEBHOOK_URL) return;
  const result = await pool.query(`SELECT r.week_key,r.status,r.notified_at,
    json_agg(json_build_object('slug',j.slug,'drafts',(
      SELECT json_agg(json_build_object('channel',p.channel,'id',p.buffer_draft_id))
      FROM social_publications p WHERE p.job_id=j.id
    )) ORDER BY j.created_at) items
    FROM social_runs r JOIN social_jobs j ON j.run_id=r.id
    WHERE r.id=$1 GROUP BY r.id`, [runId]);
  const run = result.rows[0];
  if (!run || run.status !== 'review' || run.notified_at) return;
  const lines = [`Pseudointelekt: szkice social ${run.week_key} są gotowe w Bufferze.`];
  for (const item of run.items || []) lines.push(`• ${item.slug}: ${(item.drafts || []).map(draft => draft.channel).join(', ')}`);
  lines.push('Akceptacja i harmonogram: https://publish.buffer.com/calendar');
  const response = await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: lines.join('\n') }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Slack social digest returned HTTP ${response.status}`);
  await pool.query('UPDATE social_runs SET notified_at=now(),updated_at=now() WHERE id=$1 AND notified_at IS NULL', [runId]);
}

async function acquire() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`SELECT * FROM social_jobs
      WHERE (status='ready' OR (status='failed' AND run_id IS NOT NULL)) AND attempts < $1
        AND (locked_at IS NULL OR locked_at < now()-interval '30 minutes')
      ORDER BY CASE status WHEN 'failed' THEN 0 ELSE 1 END, created_at
      LIMIT 1 FOR UPDATE SKIP LOCKED`, [maxAttempts]);
    const job = result.rows[0];
    if (!job) { await client.query('COMMIT'); return null; }
    await client.query(`UPDATE social_jobs SET status='generating',locked_at=now(),attempts=attempts+1,updated_at=now() WHERE id=$1`, [job.id]);
    await client.query('COMMIT');
    return job;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

async function processOne() {
  const job = await acquire();
  if (!job) return false;
  try {
    const pkg = job.package;
    if (!pkg?.score) throw new Error('Codex social package is missing');
    const score = pkg.score;
    const assets = await render(job,pkg);
    const client = await pool.connect();
    try {
      // Asset metadata must be committed before Buffer fetches the public URL
      // through a separate application/database connection.
      await client.query('BEGIN');
      const urls = { reel: await persistAsset(client,job.id,'reel',assets.reel), post: await persistAsset(client,job.id,'instagram_post',assets.post) };
      await client.query('COMMIT');

      // Draft IDs are intentionally persisted one channel at a time. If a
      // later channel fails, retry skips drafts that Buffer already created.
      await createDrafts(client,job,pkg,urls);

      await client.query('BEGIN');
      await client.query(`UPDATE social_jobs SET status='review',score=$2,package=$3::jsonb,locked_at=NULL,last_error=NULL,updated_at=now() WHERE id=$1`,[job.id,score.total,JSON.stringify(pkg)]);
      await client.query(`UPDATE social_runs SET status=CASE WHEN NOT EXISTS(
        SELECT 1 FROM social_jobs WHERE run_id=$1 AND status NOT IN ('review','published','queued')
      ) THEN 'review' ELSE 'processing' END,updated_at=now() WHERE id=$1`, [job.run_id]);
      await client.query('COMMIT');
      await notifyRunIfReady(job.run_id).catch(error => {
        console.error(JSON.stringify({ type: 'social-digest-error', runId: job.run_id, error: error instanceof Error ? error.message : String(error) }));
      });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    console.log(JSON.stringify({type:'social-job-complete',jobId:job.id,slug:job.slug,score:score.total,dryRun}));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.query(`UPDATE social_jobs SET status='failed',locked_at=NULL,last_error=$2,updated_at=now() WHERE id=$1`,[job.id,message.slice(0,1000)]);
    console.error(JSON.stringify({type:'social-job-error',jobId:job.id,error:message}));
  }
  return true;
}

async function main() {
  await mkdir(mediaRoot,{recursive:true});
  console.log(JSON.stringify({type:'social-worker-start',enabled,dryRun,intervalMs}));
  if (!enabled) {
    await new Promise(resolve => {
      const timer = setInterval(() => undefined, 3600000);
      const stop = () => { clearInterval(timer); resolve(); };
      process.once('SIGTERM', stop);
      process.once('SIGINT', stop);
    });
    return;
  }
  do { while (await processOne()) await sleep(1000); if (process.env.SOCIAL_WORKER_RUN_ONCE === 'true') break; await sleep(intervalMs); } while (true);
  await pool.end();
}

main().catch(error => { console.error(error); process.exitCode=1; });
