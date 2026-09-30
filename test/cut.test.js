import test from 'node:test';
import assert from 'node:assert/strict';
import { cutPath, liftInk, strokeMemory } from '../cut.js';
import { makeField, validateDocument, weave } from '../field.js';

test('a circular lift preserves both outside ends and removes precisely its diameter', () => {
  const result = cutPath([{ x: 0, y: 50 }, { x: 100, y: 50 }], { x: 50, y: 50 }, { x: 50, y: 50 }, 10);
  assert.equal(result.kept.length, 2);
  assert.deepEqual(result.kept.map(p => p.map(q => q.x)), [[0, 40], [60, 100]]);
  assert.deepEqual(result.removed.map(p => p.map(q => q.x)), [[40, 60]]);
});
test('a fast sweep cuts the whole capsule without holes between pointer events', () => {
  const result = cutPath([{ x: 0, y: 50 }, { x: 100, y: 50 }], { x: 25, y: 50 }, { x: 75, y: 50 }, 10);
  assert.deepEqual(result.kept.map(p => p.map(q => q.x)), [[0, 15], [85, 100]]);
});
test('cuts map to the same fractional length in the unbent counterpart', () => {
  const thread = { color: 0, opacity: .3, points: [{ x: 0, y: 50 }, { x: 100, y: 50 }] };
  const control = { ...thread, points: [{ x: 0, y: 80 }, { x: 200, y: 80 }] };
  const doc = { strokes: [{ lines: [thread], plain: [control] }] };
  const before = JSON.stringify(doc);
  const result = liftInk(doc, { x: 50, y: 50 }, { x: 50, y: 50 }, 10);
  assert.deepEqual(result.strokes[0].plain.map(l => l.points.map(p => p.x)), [[0, 80], [120, 200]]);
  assert.equal(JSON.stringify(doc), before);
});
test('a near miss leaves ink unchanged; a full lift removes its stroke', () => {
  const l = { color: 0, opacity: .3, points: [{ x: 40, y: 50 }, { x: 60, y: 50 }] };
  const doc = { strokes: [{ lines: [l], plain: [l] }] };
  assert.equal(liftInk(doc, { x: 50, y: 90 }, { x: 50, y: 90 }, 10).changed, false);
  const result = liftInk(doc, { x: 50, y: 50 }, { x: 50, y: 50 }, 20);
  assert.equal(result.strokes.length, 0);
  assert.equal(result.paths.length, 1);
});

test('separate lifted fragments have no imaginary bridge between them', () => {
  const paths = [[{ x: 100, y: 100 }, { x: 200, y: 100 }], [{ x: 800, y: 600 }, { x: 900, y: 600 }]];
  const f = makeField([{ points: paths[0], paths }]);
  assert.ok(f(150, 100).x > 2);
  assert.ok(Math.hypot(f(500, 350).x, f(500, 350).y) < .05);
});
test('lifted studies round-trip without losing their paired fragments or forces', () => {
  const stroke = weave({points:[{x:100,y:300},{x:800,y:300}],seed:12,width:6,palette:'estuary'},makeField([]));
  const cut = liftInk({strokes:[stroke]}, {x:400,y:200},{x:400,y:400},22);
  const doc = {version:1,strokes:cut.strokes,ghosts:[{points:cut.paths[0],paths:cut.paths}]};
  assert.ok(cut.changed);
  assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(doc))),doc);
});

test('releasing partly lifted ink remembers only the remaining threads', () => {
  const stroke = weave({points:[{x:100,y:300},{x:800,y:300}],seed:12,width:6,palette:'estuary'},makeField([]));
  const cut = liftInk({strokes:[stroke]}, {x:400,y:200},{x:400,y:400},22);
  const memory = strokeMemory(cut.strokes[0]);
  assert.deepEqual(memory.paths,cut.strokes[0].lines.map(l=>l.points));
  assert.notDeepEqual(memory.points,stroke.points);
});
test('even a tiny lifted fragment carries a directed current', () => {
  const f = makeField([{points:[{x:500,y:350},{x:503,y:350}]}]);
  assert.ok(f(501,350).x>2);
});
