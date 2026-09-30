import test from 'node:test';
import assert from 'node:assert/strict';
import { SCORES, specimen, displacement, processStudy } from '../specimens.js';
import { validateDocument, makeField, weave } from '../field.js';

for (const score of SCORES) {
  test(`${score.title} is editable, reproducible and measurably influenced by its absence`, () => {
    const study = specimen(score.id);
    validateDocument(study);
    assert.deepEqual(specimen(score.id), study);
    const d = displacement(study);
    assert.ok(d.mean > 20, `${d.mean.toFixed(1)} units mean displacement`);
    assert.ok(d.max > 60, `${d.max.toFixed(1)} units maximum displacement`);
    assert.ok(d.threads > 500);
    assert.ok(JSON.stringify(study).length < 2_500_000, 'The study fits in ordinary browser storage.');
  });
}
test('reversing and forgetting a memory affect future ink without rewriting a study', () => {
  const doc = specimen('fault'), before = JSON.stringify(doc.strokes);
  const gesture = { points: [{ x: 500, y: 320 }, { x: 500, y: 390 }], width: 6, palette: 'graphite', seed: 9 };
  const remembered = weave(gesture, makeField(doc.ghosts));
  const reversed = weave(gesture, makeField([{ points: [...doc.ghosts[0].points].reverse() }]));
  const forgotten = weave(gesture, makeField([]));
  assert.notDeepEqual(remembered.lines, reversed.lines);
  assert.deepEqual(forgotten.lines, forgotten.plain);
  assert.equal(JSON.stringify(doc.strokes), before);
});

test('the opening process retains three genuine intermediate states', () => {
  const stages = processStudy();
  stages.forEach(s => validateDocument(s.study));
  assert.deepEqual(stages.map(s => s.study.strokes.length), [6, 6, 16]);
  assert.deepEqual(stages.map(s => s.study.ghosts.length), [0, 1, 1]);
  assert.notDeepEqual(stages[0].study.strokes, stages[1].study.strokes);
  assert.deepEqual(stages[1].study.strokes, stages[2].study.strokes.slice(0, 6));
  assert.deepEqual(stages[2].study, specimen('opening'));
});
