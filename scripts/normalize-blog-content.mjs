import fs from 'node:fs/promises';
import path from 'node:path';

const blogDir = path.resolve('src/content/blog');
const checkOnly = process.argv.includes('--check');
const files = (await fs.readdir(blogDir))
  .filter(file => file.endsWith('.md'))
  .sort();

const totals = {
  files: files.length,
  changed: 0,
  removedTitleHeadings: 0,
  removedLeadBlocks: 0,
  removedSourceBlocks: 0,
  removedDuplicateParagraphs: 0,
  addedSourceUrls: 0,
};

for (const file of files) {
  const filePath = path.join(blogDir, file);
  const original = await fs.readFile(filePath, 'utf8');
  const parsed = splitMarkdownFile(original);
  if (!parsed) continue;

  const title = frontmatterValue(parsed.frontmatter, 'title');
  const description = frontmatterValue(parsed.frontmatter, 'description');
  if (!title || !description) continue;

  const normalized = normalizeBody(parsed.body, title, description);
  let frontmatter = parsed.frontmatter;
  if (!frontmatterValue(frontmatter, 'sourceUrl') && normalized.sourceUrl) {
    const sourceLine = `sourceUrl: "${yamlEscape(normalized.sourceUrl)}"`;
    const lines = frontmatter.split('\n');
    const descriptionIndex = lines.findIndex(line => line.startsWith('description:'));
    lines.splice(descriptionIndex >= 0 ? descriptionIndex + 1 : lines.length, 0, sourceLine);
    frontmatter = lines.join('\n');
    totals.addedSourceUrls += 1;
  }

  const next = `---\n${frontmatter}\n---\n\n${normalized.body}\n`;
  if (next !== original) {
    totals.changed += 1;
    totals.removedTitleHeadings += normalized.removedTitleHeadings;
    totals.removedLeadBlocks += normalized.removedLeadBlocks;
    totals.removedSourceBlocks += normalized.removedSourceBlocks;
    totals.removedDuplicateParagraphs += normalized.removedDuplicateParagraphs;
    if (!checkOnly) await fs.writeFile(filePath, next);
  }
}

console.log(JSON.stringify(totals, null, 2));
if (checkOnly && totals.changed > 0) process.exitCode = 1;

function splitMarkdownFile(value) {
  const match = value.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  return match ? { frontmatter: match[1], body: match[2].trim() } : undefined;
}

function frontmatterValue(frontmatter, key) {
  const line = frontmatter.split('\n').find(candidate => candidate.startsWith(`${key}:`));
  if (!line) return undefined;
  const value = line.slice(line.indexOf(':') + 1).trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/g, '"');
  }
  return value.replace(/^['"]|['"]$/g, '');
}

function normalizeBody(markdown, title, description) {
  const blocks = markdown.split(/\n{2,}/).map(block => block.trim()).filter(Boolean);
  let removedTitleHeadings = 0;
  let removedLeadBlocks = 0;
  let removedSourceBlocks = 0;
  let removedDuplicateParagraphs = 0;
  let sourceUrl;

  if (blocks[0] && headingRepeatsTitle(blocks[0], title)) {
    blocks.shift();
    removedTitleHeadings += 1;
  }

  while (blocks[0] && redundantLead(blocks[0], description)) {
    sourceUrl ||= firstUrl(blocks[0]);
    blocks.shift();
    removedLeadBlocks += 1;
  }

  while (blocks[0] && standaloneSource(blocks[0])) {
    sourceUrl ||= firstUrl(blocks[0]);
    blocks.shift();
    removedSourceBlocks += 1;
  }

  const seen = new Set();
  const body = blocks.filter(block => {
    if (/^#{1,6}\s+/.test(block)) return true;
    const value = normalize(block);
    if (value.length < 80) return true;
    if (seen.has(value)) {
      removedDuplicateParagraphs += 1;
      return false;
    }
    seen.add(value);
    return true;
  }).join('\n\n');

  return {
    body,
    sourceUrl,
    removedTitleHeadings,
    removedLeadBlocks,
    removedSourceBlocks,
    removedDuplicateParagraphs,
  };
}

function headingRepeatsTitle(block, title) {
  const match = block.match(/^#{1,6}\s+(.+)$/);
  return Boolean(match && normalize(match[1]) === normalize(title));
}

function redundantLead(block, description) {
  if (/^#{1,6}\s+/.test(block)) return false;
  const body = normalize(block);
  const lead = normalize(description);
  return lead.length >= 30 && (
    body === lead ||
    (body.startsWith(lead) && /https?:\/\//i.test(block))
  );
}

function standaloneSource(block) {
  return /^(?:[*_]>?\s*)?(?:źródło|zrodlo)\s+(?:tematu|depeszy|wydarzenia)\s*:\s*https?:\/\/\S+(?:\s*[*_])?$/iu.test(block);
}

function firstUrl(value) {
  return value.match(/https?:\/\/[^\s)>]+/i)?.[0]?.replace(/[.,;]+$/, '');
}

function normalize(value) {
  return value.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function yamlEscape(value) {
  return value.replace(/"/g, '\\"');
}
