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

export function buildYouTubeDraftText(pkg, targetUrl) {
  const description = stripEditorialUrls(pkg.youtubeDescription);
  return [pkg.youtubeTitle.trim(), description, targetUrl].filter(Boolean).join('\n\n');
}
