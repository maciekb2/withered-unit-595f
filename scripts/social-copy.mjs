const urlPattern = /https?:\/\/\S+/giu;

export function stripEditorialUrls(value = '') {
  return value
    .replace(urlPattern, '')
    .replace(/(?:pełna analiza|czytaj więcej|więcej)\s*:\s*$/giu, '')
    .replace(/[ \t]+\n/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .replace(/[ \t]{2,}/gu, ' ')
    .trim();
}

export function buildChannelHashtags(hashtags = [], channel = 'instagram') {
  const limit = channel === 'youtube' ? 3 : 5;
  const result = ['#Pseudointelekt'];
  const seen = new Set(['#pseudointelekt']);
  for (const raw of hashtags) {
    const tag = String(raw || '').trim();
    if (!/^#[\p{L}\p{N}_]+$/u.test(tag)) continue;
    const key = tag.toLocaleLowerCase('pl');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
    if (result.length === limit) break;
  }
  return result;
}

export function buildYouTubeDraftText(pkg, targetUrl) {
  const description = stripEditorialUrls(pkg.youtubeDescription);
  const hashtags = buildChannelHashtags(pkg.hashtags, 'youtube').join(' ');
  return [pkg.youtubeTitle.trim(), description, hashtags, targetUrl].filter(Boolean).join('\n\n');
}
