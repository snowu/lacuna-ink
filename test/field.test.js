import test from 'node:test';
import assert from 'node:assert/strict';
import { makeField, weave, validateDocument, resample, distanceToPath } from '../field.js';

const curve = [{ x: 300, y: 300 }, { x: 500, y: 300 }, { x: 600, y: 400 }];
const stroke = { points: [{ x: 400, y: 250 }, { x: 400, y: 400 }], seed: 219, width: 6, palette: 'estuary' };
test('blank paper has no hidden forces; both realities are identical', () => {
  const f = makeField([]);
  assert.deepEqual(f(400, 300), { x: 0, y: 0 });
  const ink = weave(stroke, f);
  assert.deepEqual(ink.lines, ink.plain);
});
test('an erased path carries its direction and bends new ink', () => {
  const f = makeField([{ points: curve }]);
  assert.ok(f(400, 300).x > 2);
  assert.ok(Math.abs(f(400, 300).y) < .05);
  const ink = weave(stroke, f);
  assert.notDeepEqual(ink.lines, ink.plain);
  assert.ok(ink.lines[0].points.at(-1).x > ink.plain[0].points.at(-1).x + 10);
});
test('reversing the removed gesture reverses its current', () => {
  const forward = makeField([{ points: curve }]);
  const backward = makeField([{ points: [...curve].reverse() }]);
  assert.ok(forward(400, 300).x > 0);
  assert.ok(backward(400, 300).x < 0);
});
test('zero pull isolates the intervention, using exactly the same random threads', () => {
  const ink = weave(stroke, makeField([{ points: curve }]), 0);
  assert.deepEqual(ink.lines, ink.plain);
});
test('new memories soften older ones, without changing ink already made', () => {
  const f = makeField([{ points: curve }]);
  const ink = weave(stroke, f), original = JSON.stringify(ink);
  const next = makeField([{ points: curve }, { points: [{ x: 900, y: 600 }, { x: 990, y: 600 }] }]);
  assert.ok(next(400, 300).x < f(400, 300).x * .8);
  assert.equal(JSON.stringify(ink), original);
});
test('reproducible pigment and geometry survive a portable study round trip', () => {
  const f = makeField([{ points: curve }]);
  const ink = weave(stroke, f);
  assert.deepEqual(weave(stroke, f), ink);
  const doc = { version: 1, strokes: [ink], ghosts: [{ points: curve }] };
  assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(doc))), doc);
});
test('untrusted studies reject nonfinite coordinates and oversized geometry', () => {
  assert.throws(() => validateDocument({ version: 1, strokes: [], ghosts: [{ points: [{ x: NaN, y: 5 }] }] }));
  assert.throws(() => validateDocument({ version: 1, strokes: [], ghosts: Array(41).fill({ points: curve }) }));
  const ink = weave(stroke, makeField([])); ink.lines[0].color = 8;
  assert.throws(() => validateDocument({ version: 1, strokes: [ink], ghosts: [] }));
});
test('resampling keeps spacing across uneven input events; hit testing catches segments', () => {
  assert.deepEqual(resample([{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 30, y: 0 }], 10), [0, 10, 20, 30].map(x => ({ x, y: 0 })));
  assert.equal(distanceToPath(400, 310, curve), 10);
});

test('long zigzag gestures have a bounded thread budget', () => {
  const points = Array.from({ length: 700 }, (_, i) => ({ x: i % 2 ? 999 : 1, y: i }));
  const ink = weave({ ...stroke, points }, makeField([]));
  assert.ok(ink.lines.length <= 1650);
  assert.ok(ink.lines.every(l => l.points.length <= 55));
  validateDocument({ version: 1, strokes: [ink], ghosts: [{ points }] });
});
