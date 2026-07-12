export const SOCIAL_SCENE_SECONDS = 3.1;
export const SOCIAL_TEXT_TRANSITION_SECONDS = 0.18;

const n = value => Number(value.toFixed(2));

export function socialBodyDuration(sceneCount) {
  return n(sceneCount * SOCIAL_SCENE_SECONDS);
}

export function buildSocialSceneCopy(pkg) {
  const scenes = Array.isArray(pkg?.scenes) ? pkg.scenes : [];
  if (!pkg?.hook) return scenes;
  if (!scenes.length) return [pkg.hook];
  return [pkg.hook, ...scenes.slice(1)];
}

export function buildSocialWhooshFilter(sceneCount) {
  const duration = socialBodyDuration(sceneCount);
  const phase = `mod(t,${SOCIAL_SCENE_SECONDS})`;
  const gain = `if(lt(${phase},0.16),0.2*(1-${phase}/0.16),if(gt(${phase},${n(SOCIAL_SCENE_SECONDS - 0.12)}),0.11*(${phase}-${n(SOCIAL_SCENE_SECONDS - 0.12)})/0.12,0))`;
  return `[1:a]afade=t=in:st=0:d=0.35,afade=t=out:st=${n(duration - 0.8)}:d=0.8,loudnorm=I=-19:TP=-3:LRA=7[music];[2:a]highpass=f=900,lowpass=f=6500,volume='${gain}':eval=frame[swoosh];[music][swoosh]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.9[aout]`;
}

export function buildSocialMotionFilter(sceneFiles, escapePath = value => value) {
  const duration = socialBodyDuration(sceneFiles.length);
  const scenes = sceneFiles.map((file, index) => {
    const start = n(index * SOCIAL_SCENE_SECONDS);
    const end = n((index + 1) * SOCIAL_SCENE_SECONDS);
    const fadeInEnd = n(start + SOCIAL_TEXT_TRANSITION_SECONDS);
    const fadeOutStart = n(end - SOCIAL_TEXT_TRANSITION_SECONDS);
    const y = index % 2 === 0 ? 1080 : 1160;
    const alpha = `if(lt(t,${fadeInEnd}),max(0,(t-${start})/${SOCIAL_TEXT_TRANSITION_SECONDS}),if(gt(t,${fadeOutStart}),max(0,(${end}-t)/${SOCIAL_TEXT_TRANSITION_SECONDS}),1))`;
    const x = `72+if(lt(t,${fadeInEnd}),(${fadeInEnd}-t)*620,0)`;
    return `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile='${escapePath(file)}':fontcolor=0xf8f4e6:fontsize=50:line_spacing=14:x='${x}':y=${y}:alpha='${alpha}':enable='between(t,${start},${end})'`;
  }).join(',');
  return [
    `scale=w='1300+42*t/${duration}':h=-2:eval=frame`,
    `crop=1080:780:x='(in_w-out_w)*(0.5+0.42*sin(t*0.18))':y='(in_h-out_h)*(0.5+0.28*cos(t*0.14))'`,
    'pad=1080:1920:0:120:0x031712',
    'drawbox=x=40:y=990:w=860:h=500:color=0x000000d9:t=fill',
    `drawbox=x=72:y=1032:w='790*min(1,t/${duration})':h=5:color=0xdabc42@0.95:t=fill`,
    scenes,
    'drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text=PSEUDOINTELEKT:fontcolor=0xdabc42:fontsize=28:x=70:y=80',
  ].join(',');
}
