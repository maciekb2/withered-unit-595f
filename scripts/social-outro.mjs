import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const OUTRO_FPS = 30;
export const OUTRO_DURATION = 4;
export const OUTRO_FRAME_COUNT = OUTRO_FPS * OUTRO_DURATION;
const gold = '#dabc42';

const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

function particle(index, progress) {
  const column = index % 30;
  const row = Math.floor(index / 30);
  const sourceX = 172 + column * 25.5 + Math.sin(index * 2.31) * 7;
  const sourceY = 920 + row * 25 + Math.cos(index * 1.77) * 11;
  const side = index % 2 ? 1 : -1;
  const angle = ((index * 37) % 360) * Math.PI / 180;
  const targetX = 540 + side * 105 + Math.cos(angle) * (82 + (index % 5) * 7);
  const targetY = 955 + Math.sin(angle) * (105 + (index % 4) * 6) + (index % 3 - 1) * 8;
  const drift = Math.sin(progress * Math.PI) * Math.sin(index * 0.83) * 75;
  return {
    x: mix(sourceX, targetX, progress) + drift,
    y: mix(sourceY, targetY, progress) - Math.sin(progress * Math.PI) * 55,
    radius: 1.2 + (index % 4) * 0.55,
  };
}

const brainPaths = `
  <path d="M535 820 C485 770 395 792 385 868 C337 888 330 968 379 997 C350 1065 411 1123 474 1096 C493 1134 535 1121 540 1083"/>
  <path d="M545 820 C595 770 685 792 695 868 C743 888 750 968 701 997 C730 1065 669 1123 606 1096 C587 1134 545 1121 540 1083"/>
  <path d="M540 820 L540 1083 M472 844 C505 865 505 902 482 924 M608 844 C575 865 575 902 598 924 M408 914 C453 911 470 946 460 980 M672 914 C627 911 610 946 620 980 M402 1024 C446 1010 486 1038 480 1080 M678 1024 C634 1010 594 1038 600 1080"/>`;

export function outroFrameSvg(frame) {
  const titleFade = 1 - ease((frame - 24) / 34);
  const assemble = ease((frame - 30) / 58);
  const dustFade = 1 - ease((frame - 88) / 20);
  const brainOpacity = ease((frame - 72) / 30);
  const particles = Array.from({ length: 180 }, (_, index) => {
    const point = particle(index, assemble);
    return `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${point.radius}"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
<rect width="1080" height="1920" fill="#000000"/>
<text x="540" y="985" text-anchor="middle" fill="${gold}" fill-opacity="${titleFade.toFixed(3)}" font-family="DejaVu Sans" font-size="86" font-weight="700" letter-spacing="3">PSEUDOINTELEKT</text>
<g fill="${gold}" fill-opacity="${(clamp((frame - 20) / 12) * dustFade).toFixed(3)}">${particles}</g>
<g fill="none" stroke="${gold}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" opacity="${brainOpacity.toFixed(3)}">${brainPaths}</g>
</svg>`;
}

export async function ensureSocialOutro({ mediaRoot, run }) {
  const shared = path.join(mediaRoot, '_shared');
  const output = path.join(shared, 'pseudointelekt-outro-v1.mp4');
  await mkdir(shared, { recursive: true });
  const existing = await stat(output).catch(() => null);
  if (existing?.size > 50_000) return output;

  const frames = path.join(shared, `.outro-frames-${process.pid}`);
  await mkdir(frames, { recursive: true });
  try {
    for (let frame = 0; frame < OUTRO_FRAME_COUNT; frame++) {
      await writeFile(path.join(frames, `frame-${String(frame).padStart(3, '0')}.svg`), outroFrameSvg(frame), 'utf8');
    }
    await run('ffmpeg', [
      '-y', '-framerate', String(OUTRO_FPS), '-i', path.join(frames, 'frame-%03d.svg'),
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
      '-t', String(OUTRO_DURATION), '-c:v', 'libx264', '-preset', 'medium', '-crf', '21',
      '-pix_fmt', 'yuv420p', '-r', String(OUTRO_FPS), '-video_track_timescale', '90000',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-movflags', '+faststart', '-shortest', output,
    ]);
  } finally {
    await rm(frames, { recursive: true, force: true });
  }
  return output;
}
