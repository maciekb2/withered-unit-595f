import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSocialMotionFilter, buildSocialSceneCopy, buildSocialWhooshFilter, socialBodyDuration, SOCIAL_SCENE_SECONDS } from '../../scripts/social-motion.mjs';

test('social scenes use a brisk 3.1 second cadence', () => {
  assert.equal(SOCIAL_SCENE_SECONDS, 3.1);
  assert.equal(socialBodyDuration(6), 18.6);
});

test('motion filter animates image, text entry, fades and progress', () => {
  const filter = buildSocialMotionFilter(['/tmp/a.txt', '/tmp/b.txt']);
  assert.match(filter, /scale=w='1300\+42\*t\/6\.2':h=-2:eval=frame/u);
  assert.match(filter, /sin\(t\*0\.18\)/u);
  assert.match(filter, /alpha='if\(lt\(t,0\.18\)/u);
  assert.match(filter, /620/u);
  assert.match(filter, /790\*min\(1,t\/6\.2\)/u);
  assert.match(filter, /drawbox=x=40:y=990:w=860:h=500:color=0x000000d9/u);
});

test('the social hook always replaces the first generic scene', () => {
  assert.deepEqual(buildSocialSceneCopy({ hook: 'Mocny hook', scenes: ['Wstęp', 'Fakt', 'Puenta'] }), ['Mocny hook', 'Fakt', 'Puenta']);
});

test('synthetic whooshes are mixed at scene boundaries without licensed assets', () => {
  const filter = buildSocialWhooshFilter(6);
  assert.match(filter, /\[2:a\]/u);
  assert.match(filter, /mod\(t,3\.1\)/u);
  assert.match(filter, /amix=inputs=2/u);
});
