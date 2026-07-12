export const SOCIAL_SCENE_SECONDS = 3.6;
export const SOCIAL_TEXT_TRANSITION_SECONDS = 0.28;

const n = value => Number(value.toFixed(2));

export function socialBodyDuration(sceneCount) {
  return n(sceneCount * SOCIAL_SCENE_SECONDS);
}

export function buildSocialMotionFilter(sceneFiles, escapePath = value => value) {
  const duration = socialBodyDuration(sceneFiles.length);
  const scenes = sceneFiles.map((file, index) => {
    const start = n(index * SOCIAL_SCENE_SECONDS);
    const end = n((index + 1) * SOCIAL_SCENE_SECONDS);
    const fadeInEnd = n(start + SOCIAL_TEXT_TRANSITION_SECONDS);
    const fadeOutStart = n(end - SOCIAL_TEXT_TRANSITION_SECONDS);
    const y = index % 2 === 0 ? 1110 : 1190;
    const alpha = `if(lt(t,${fadeInEnd}),max(0,(t-${start})/${SOCIAL_TEXT_TRANSITION_SECONDS}),if(gt(t,${fadeOutStart}),max(0,(${end}-t)/${SOCIAL_TEXT_TRANSITION_SECONDS}),1))`;
    const x = `70+if(lt(t,${fadeInEnd}),(${fadeInEnd}-t)*430,0)`;
    return `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile='${escapePath(file)}':fontcolor=0xf4f0df:fontsize=54:line_spacing=16:x='${x}':y=${y}:alpha='${alpha}':enable='between(t,${start},${end})'`;
  }).join(',');
  return [
    `scale=w='1060+70*t/${duration}':h=-2:eval=frame`,
    `crop=960:640:x='(in_w-out_w)*(0.5+0.35*sin(t*0.52))':y='(in_h-out_h)*(0.5+0.22*cos(t*0.41))'`,
    'pad=1080:1920:(ow-iw)/2:180:0x031712',
    'drawbox=x=0:y=950:w=iw:h=970:color=0x031712ee:t=fill',
    `drawbox=x=70:y=1028:w='940*min(1,t/${duration})':h=5:color=0xdabc42@0.9:t=fill`,
    scenes,
    'drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text=PSEUDOINTELEKT:fontcolor=0xdabc42:fontsize=28:x=70:y=80',
  ].join(',');
}
