export function normalizeArticleBody(markdown: string, title: string, description: string): string {
  const blocks = markdown
    .trim()
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) return '';

  if (headingRepeatsTitle(blocks[0], title)) {
    blocks.shift();
  }

  while (blocks.length > 0 && isRedundantLeadBlock(blocks[0], description)) {
    blocks.shift();
  }

  while (blocks.length > 0 && isStandaloneSourceBlock(blocks[0])) {
    blocks.shift();
  }

  const seenParagraphs = new Set<string>();
  return blocks
    .filter(block => {
      if (/^#{1,6}\s+/.test(block)) return true;
      const normalized = normalize(block);
      if (normalized.length < 80) return true;
      if (seenParagraphs.has(normalized)) return false;
      seenParagraphs.add(normalized);
      return true;
    })
    .join('\n\n')
    .trim();
}

export function headingRepeatsTitle(block: string, title: string): boolean {
  const match = block.match(/^#{1,6}\s+(.+)$/);
  return Boolean(match && normalize(match[1]) === normalize(title));
}

export function isRedundantLeadBlock(block: string, description: string): boolean {
  if (/^#{1,6}\s+/.test(block)) return false;
  const normalizedBlock = normalize(block);
  const normalizedDescription = normalize(description);
  return normalizedDescription.length >= 30 && (
    normalizedBlock === normalizedDescription ||
    (normalizedBlock.startsWith(normalizedDescription) && /https?:\/\//i.test(block))
  );
}

function isStandaloneSourceBlock(block: string): boolean {
  return /^(?:[*_]>?\s*)?(?:źródło|zrodlo)\s+(?:tematu|depeszy|wydarzenia)\s*:\s*https?:\/\/\S+(?:\s*[*_])?$/iu.test(block.trim());
}

export function normalizeArticleFragment(value: string): string {
  return normalize(value);
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
