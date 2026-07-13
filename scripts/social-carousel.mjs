export const SOCIAL_CAROUSEL_MIN_SLIDES = 6;
export const SOCIAL_CAROUSEL_MAX_SLIDES = 10;

const clean = value => String(value || '').replace(/\s+/g, ' ').trim();

export function buildCarouselCopy(pkg, source = {}) {
  const scenes = Array.isArray(pkg?.scenes) ? pkg.scenes : [];
  const authored = Array.isArray(pkg?.carouselSlides) ? pkg.carouselSlides : [];
  const candidates = authored.length
    ? authored
    : [pkg?.hook, source?.lead, ...(source?.summaryPoints || []), source?.punchline, ...scenes.slice(1)];
  const unique = [];
  const seen = new Set();
  for (const value of candidates) {
    const text = clean(value);
    const key = text.toLocaleLowerCase('pl');
    if (!text || seen.has(key)) continue;
    seen.add(key);
    unique.push(text);
    if (unique.length === SOCIAL_CAROUSEL_MAX_SLIDES - 2) break;
  }
  for (const fallback of scenes) {
    if (unique.length >= SOCIAL_CAROUSEL_MIN_SLIDES - 2) break;
    const text = clean(fallback);
    const key = text.toLocaleLowerCase('pl');
    if (text && !seen.has(key)) { seen.add(key); unique.push(text); }
  }
  return [...unique, 'Pełna analiza na pseudointelekt.pl.'];
}

export function buildCarouselFilter({ textFile, textLength = 0, slideNumber, total, escapePath = value => value }) {
  const base = 'scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350';
  if (slideNumber === 1) return `${base},drawbox=x=0:y=0:w=iw:h=112:color=0x031712bb:t=fill,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text=PSEUDOINTELEKT:fontcolor=0xdabc42:fontsize=28:x=64:y=42`;
  const fontSize = textLength > 280 ? 34 : textLength > 220 ? 38 : textLength > 150 ? 42 : textLength > 90 ? 46 : 52;
  return [
    base,
    'gblur=sigma=12',
    'drawbox=x=0:y=0:w=iw:h=ih:color=0x031712b8:t=fill',
    'drawbox=x=48:y=250:w=920:h=800:color=0x000000d9:t=fill',
    'drawbox=x=80:y=312:w=760:h=5:color=0xdabc42@0.95:t=fill',
    `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile='${escapePath(textFile)}':fontcolor=0xf8f4e6:fontsize=${fontSize}:line_spacing=15:x=80:y=370`,
    'drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text=PSEUDOINTELEKT:fontcolor=0xdabc42:fontsize=28:x=64:y=54',
    `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='${String(slideNumber).padStart(2, '0')} / ${String(total).padStart(2, '0')}':fontcolor=0xf8f4e6@0.72:fontsize=24:x=880:y=56`,
  ].join(',');
}
