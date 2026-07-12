import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSocialMotionFilter, socialBodyDuration, SOCIAL_SCENE_SECONDS } from '../../scripts/social-motion.mjs';

test('social scenes use a faster readable cadence', () => {
  assert.equal(SOCIAL_SCENE_SECONDS, 3.6);
  assert.equal(socialBodyDuration(6), 21.6);
});

test('motion filter animates image, text entry, fades and progress', () => {
  const filter = buildSocialMotionFilter(['/tmp/a.txt', '/tmp/b.txt']);
  assert.match(filter, /scale=w='1060\+70\*t\/7\.2':h=-2:eval=frame/u);
  assert.match(filter, /sin\(t\*0\.52\)/u);
  assert.match(filter, /alpha='if\(lt\(t,0\.28\)/u);
  assert.match(filter, /430/u);
  assert.match(filter, /940\*min\(1,t\/7\.2\)/u);
});
