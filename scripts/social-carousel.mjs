export const SOCIAL_CAROUSEL_SLIDES = 6;

export function buildCarouselCopy(pkg) {
  const scenes = Array.isArray(pkg?.scenes) ? pkg.scenes : [];
  const middle = scenes.slice(1, 4);
  while (middle.length < 3) middle.push(scenes[middle.length] || pkg?.instagramCaption || pkg?.hook || '');
  return [pkg?.hook || scenes[0] || '', ...middle, 'Pełna analiza na pseudointelekt.pl.'];
}

export function buildCarouselFilter({ textFile, slideNumber, total = SOCIAL_CAROUSEL_SLIDES, escapePath = value => value }) {
  const base = 'scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350';
  if (slideNumber === 1) return `${base},drawbox=x=0:y=0:w=iw:h=112:color=0x031712bb:t=fill,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text=PSEUDOINTELEKT:fontcolor=0xdabc42:fontsize=28:x=64:y=42`;
  return [
    base,
    'gblur=sigma=12',
    'drawbox=x=0:y=0:w=iw:h=ih:color=0x031712b8:t=fill',
    'drawbox=x=48:y=300:w=920:h=650:color=0x000000d9:t=fill',
    'drawbox=x=80:y=356:w=760:h=5:color=0xdabc42@0.95:t=fill',
    `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile='${escapePath(textFile)}':fontcolor=0xf8f4e6:fontsize=52:line_spacing=16:x=80:y=420`,
    'drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text=PSEUDOINTELEKT:fontcolor=0xdabc42:fontsize=28:x=64:y=54',
    `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='${String(slideNumber).padStart(2, '0')} / ${String(total).padStart(2, '0')}':fontcolor=0xf8f4e6@0.72:fontsize=24:x=880:y=56`,
  ].join(',');
}
