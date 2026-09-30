import test from 'node:test';
import assert from 'node:assert/strict';
import { replyTo } from '../reply.js';
import { validateDocument, LIMITS } from '../field.js';
import { specimen } from '../specimens.js';

test('a reply adds editable, reproducible ink without changing any existing mark or memory', () => {
  const doc=specimen('room'), before=structuredClone(doc);
  const reply=replyTo(doc);
  assert.equal(reply.length,5);assert.deepEqual(replyTo(doc),reply);assert.deepEqual(doc,before);
  validateDocument({...doc,strokes:[...doc.strokes,...reply]});
  assert.ok(reply.some(s=>JSON.stringify(s.lines)!==JSON.stringify(s.plain)));
});
test('blank paper stays blank, a full sheet stays bounded, and a nearly full sheet gets only one gesture', () => {
  assert.deepEqual(replyTo({version:1,strokes:[],ghosts:[]}),[]);
  const doc=specimen('room'), stroke=doc.strokes[0];
  assert.deepEqual(replyTo({...doc,strokes:Array(LIMITS.strokes).fill(stroke)}),[]);
  assert.equal(replyTo({...doc,strokes:Array(LIMITS.strokes-1).fill(stroke)}).length,1);
});
test('successive replies differ, lifted paths are usable, and pigment/pull settings apply', () => {
  const doc=specimen('opening'),first=replyTo(doc,{palette:'graphite',strength:0});
  first.forEach(s=>{assert.equal(s.palette,'graphite');assert.deepEqual(s.lines,s.plain);});
  const next=replyTo({...doc,strokes:[...doc.strokes,...first]});
  assert.notDeepEqual(next.map(s=>s.points),first.map(s=>s.points));
  validateDocument({...doc,strokes:[...doc.strokes,...next]});
});
test('replies stay on the paper even when memories touch an edge', () => {
  for(const points of [[{x:0,y:0},{x:1000,y:0}],[{x:1000,y:0},{x:1000,y:700}]]) {
    const doc={version:1,strokes:[],ghosts:[{points}]};validateDocument({...doc,strokes:replyTo(doc)});
  }
});
