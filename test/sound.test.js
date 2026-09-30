import test from 'node:test';
import assert from 'node:assert/strict';
import { toneForCurrent } from '../sound.js';
import { makeField } from '../field.js';

test('blank paper and distant traces are silent', () => {
  assert.equal(toneForCurrent(makeField([])(500, 350)).gain, 0);
  assert.equal(toneForCurrent({x:.1,y:0}).gain,0);
});
test('the direction of a real erased gesture changes its pitch when reversed', () => {
  const points=[{x:300,y:350},{x:700,y:350}];
  const forward=toneForCurrent(makeField([{points}])(500,350));
  const reversed=toneForCurrent(makeField([{points:[...points].reverse()}])(500,350));
  assert.ok(forward.gain>0);
  assert.notEqual(forward.frequency,reversed.frequency);
  assert.equal(forward.gain,reversed.gain);
});
test('sound remains quiet and finite even for strong or invalid fields', () => {
  for (const x of [-100,-3,0,3,100]) for(const y of [-100,-3,0,3,100]) {
    const tone=toneForCurrent({x,y});
    assert.ok(tone.gain>=0 && tone.gain<=.04);
    assert.ok(tone.frequency>100 && tone.frequency<400);
  }
  assert.equal(toneForCurrent({x:NaN,y:Infinity}).gain,0);
});
