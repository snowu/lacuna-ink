import test from 'node:test';
import assert from 'node:assert/strict';
import { specimen } from '../specimens.js';
import { studySVG, pairedPrint } from '../print.js';

test('the paired print preserves both geometries without network dependencies', () => {
  const doc = specimen('orbit'), html = pairedPrint(doc);
  assert.match(html, /With memory/);
  assert.match(html, /Without memory/);
  assert.equal((html.match(/<svg /g) || []).length, 2);
  assert.equal((html.match(/<polyline /g) || []).length, doc.strokes.reduce((n, s) => n + s.lines.length + s.plain.length, doc.ghosts.length));
  assert.doesNotMatch(html, /<script|<link|<img|<iframe|@import|url\(/);
  assert.notEqual(studySVG(doc), studySVG(doc, { plain: true }));
});
test('prints validate document geometry before generating markup', () => {
  const doc = specimen('fault'); doc.strokes[0].palette = '<script>';
  assert.throws(() => pairedPrint(doc));
});
