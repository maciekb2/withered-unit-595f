import type { SocialPackage, SocialSource } from './types';

const banned = [
  'w dzisiejszym świecie', 'warto zauważyć', 'przyjrzyjmy się',
  'dynamiczna sytuacja', 'sytuacja jest złożona', 'geopolityczna szachownica',
  'czas pokaże', 'tylko czas pokaże',
];

const norm = (value: string) => value.toLocaleLowerCase('pl').replace(/\s+/g, ' ').trim();
const withoutUrls = (value: string) => value.replace(/https?:\/\/\S+/giu, ' ');

export function validateSocialPackage(pkg: SocialPackage, source: SocialSource): string[] {
  const errors: string[] = [];
  const all = norm([pkg.hook, pkg.instagramCaption, pkg.youtubeTitle, pkg.youtubeDescription, ...pkg.scenes].join(' '));
  if (banned.some(phrase => all.includes(phrase))) errors.push('contains banned generic phrasing');
  if (pkg.hook.length < 20 || pkg.hook.length > 130) errors.push('invalid hook length');
  if (pkg.scenes.length < 5 || pkg.scenes.length > 6) errors.push('scenes must contain 5-6 items');
  if (pkg.scenes.some(scene => scene.length < 8 || scene.length > 115)) errors.push('invalid scene length');
  if (pkg.hashtags.length > 5 || pkg.hashtags.some(tag => !/^#[\p{L}\p{N}_]+$/u.test(tag))) errors.push('invalid hashtags');
  if (pkg.youtubeTitle.length > 100) errors.push('youtube title too long');
  if (!pkg.imagePrompt || pkg.imagePrompt.length < 80 || pkg.imagePrompt.length > 1800) errors.push('invalid image prompt');
  if (!['current', 'evergreen'].includes(pkg.contentKind)) errors.push('invalid content kind');
  if (!pkg.experiment || pkg.experiment.length > 120) errors.push('invalid experiment');
  if (pkg.template !== 'situation-room-v2') errors.push('invalid template');
  // Canonical article URLs commonly contain publication dates and numeric slugs.
  // They are trusted navigation metadata, not editorial claims.
  const numbers = withoutUrls(all).match(/\b\d+(?:[.,]\d+)?%?\b/g) || [];
  const sourceText = norm([source.title, source.lead, ...source.summaryPoints].join(' '));
  if (numbers.some(number => !sourceText.includes(number))) errors.push('contains a number absent from source');
  return errors;
}
