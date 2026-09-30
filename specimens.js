import { makeField, weave } from './field.js';
import { liftInk } from './cut.js';

// Small scores for the instrument, not images or precomputed brush output.
// Every study can be erased, reversed, extended, or compared like your own ink.
const arc = (cx, cy, rx, ry, start = 0, end = Math.PI * 2, count = 140) =>
  Array.from({ length: count }, (_, i) => {
    const a = start + i / (count - 1) * (end - start);
    return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
  });
const line = (ax, ay, bx, by, count = 55) =>
  Array.from({ length: count }, (_, i) => ({ x: ax + (bx - ax) * i / (count - 1), y: ay + (by - ay) * i / (count - 1) }));

export const SCORES = [
  {
    id: 'estuary', title: 'An absent tide', subtitle: 'Two lost curves. Seven crossings.', palette: 'estuary',
    note: 'A loop and a wave are missing. Try reversing the newest current, then draw across the middle.',
    ghosts: () => [
      arc(505, 350, 170, 173),
      Array.from({ length: 120 }, (_, i) => ({ x: 160 + i * 5.6, y: 395 + Math.sin(i / 119 * Math.PI * 2) * 85 })),
    ],
    gestures: () => Array.from({ length: 7 }, (_, i) => Array.from({ length: 30 }, (_, j) =>
      ({ x: 230 + j * 17, y: 175 + i * 49 + Math.sin(j * .13 + i * .2) * 12 }))),
  },
  {
    id: 'orbit', title: 'The unmade moon', subtitle: 'A circle, remembered in two directions.', palette: 'dusk',
    note: 'The inner circle remembers backwards. Drop a short mark near the rim and see which memory catches it.',
    ghosts: () => [arc(500, 350, 225, 225), arc(500, 350, 115, 115, Math.PI * 2, 0)],
    gestures: () => Array.from({ length: 18 }, (_, i) => {
      const a = i / 18 * Math.PI * 2;
      return line(500 + Math.cos(a) * 280, 350 + Math.sin(a) * 280,
        500 + Math.cos(a) * 95, 350 + Math.sin(a) * 95, 24);
    }),
  },
  {
    id: 'fault', title: 'A fault in the paper', subtitle: 'One missing seam. A quiet disruption.', palette: 'graphite',
    note: 'A crooked seam interrupts straight gestures. Forget it, make a new seam of your own, and cross it.',
    ghosts: () => [[{ x: 520, y: 90 }, { x: 465, y: 260 }, { x: 550, y: 360 }, { x: 450, y: 490 }, { x: 490, y: 630 }]],
    gestures: () => Array.from({ length: 12 }, (_, i) => line(210, 100 + i * 44, 740, 100 + i * 44)),
  },
  {
    id: 'letter', title: 'A letter without an ending', subtitle: 'An unfinished spiral holds the unsaid.', palette: 'graphite',
    note: 'I wanted a letter that opens instead of closing. The spiral is gone; the crossings still hesitate around it. Add your own ending, or ask for a reply.',
    ghosts: () => [Array.from({length:180},(_,i)=>{
      const u=i/179,a=-.5+u*Math.PI*3.8,r=230-u*190;
      return {x:500+Math.cos(a)*r,y:350+Math.sin(a)*r*.8};
    })],
    gestures: () => Array.from({length:14},(_,i)=>line(235,165+i*27,690,185+i*27,40)),
  },
  {
    id: 'orchard', title: 'An orchard of almosts', subtitle: 'Lost branches. A canopy finding its way.', palette: 'estuary',
    note: 'I erased a tree before giving it leaves. Their threads follow the branches that remain only as memory. Change a branch and see what the next growth does.',
    ghosts: () => [
      [{x:480,y:580},{x:490,y:440},{x:450,y:340},{x:340,y:250},{x:260,y:170}],
      [{x:480,y:580},{x:500,y:420},{x:520,y:300},{x:510,y:180},{x:470,y:105}],
      [{x:480,y:580},{x:510,y:440},{x:590,y:330},{x:700,y:240},{x:780,y:160}],
    ],
    gestures: () => [
      ...Array.from({length:18},(_,i)=>line(265+i*28,170+Math.sin(i/17*Math.PI)*60,265+i*28,330+Math.sin(i/17*Math.PI)*95,24)),
      ...Array.from({length:5},(_,i)=>line(420+i*26,430,420+i*26,580,24)),
    ],
  },
  {
    id: 'room', title: 'The room I left open', subtitle: 'Missing walls. A doorway full of light.', palette: 'dusk',
    note: 'I drew a room, then removed its walls. The light keeps their shape. Leave a memory of your own, then let the paper answer.',
    ghosts: () => [
      [{x:265,y:550},{x:265,y:155},{x:740,y:155},{x:740,y:550}],
      [{x:740,y:550},{x:580,y:550},{x:580,y:400},{x:500,y:365},{x:420,y:400},{x:420,y:550},{x:265,y:550}],
    ],
    gestures: () => [
      ...Array.from({length:11},(_,i)=>line(330+i*31,240,330+i*31,500,35)),
      ...Array.from({length:6},(_,i)=>line(310,220+i*51,665,280+i*42,40)),
    ],
  },
  {
    id: 'opening', title: 'A borrowed opening', subtitle: 'A cut in one weave catches the next.', palette: 'dusk', basePalette: 'graphite',
    note: 'The diagonal opening remembers the ink lifted from it. Purple crossings feel those fragments. Try lifting another opening.',
    ghosts: () => [],
    gestures: () => Array.from({ length: 6 }, (_, i) => line(180, 170 + i * 70, 740, 170 + i * 70)),
    cut: [{ x: 350, y: 180 }, { x: 650, y: 520 }],
    after: () => Array.from({ length: 10 }, (_, i) => line(335 + i * 31, 110, 335 + i * 31, 585)),
  },
];

function playScore(id) {
  const score = SCORES.find(s => s.id === id);
  if (!score) throw new Error('Unknown score.');
  let ghosts = score.ghosts().map(points => ({ points }));
  const field = makeField(ghosts);
  let strokes = score.gestures().map((points, i) => weave({
    points, seed: 103 + i * 79, width: 3.5, palette: score.basePalette || score.palette,
  }, field, 1.15));
  const stages = [];
  if (score.cut) {
    stages.push({ title: 'Make a weave', description: 'Six gestures. A sheet with no memory.', study: { version: 1, strokes, ghosts } });
    const lifted = liftInk({ strokes }, ...score.cut, 32);
    strokes = lifted.strokes;
    ghosts = [...ghosts, { points: lifted.paths[0], paths: lifted.paths }];
    stages.push({ title: 'Lift an opening', description: 'The missing graphite becomes a current.', study: { version: 1, strokes, ghosts } });
    const nextField = makeField(ghosts);
    strokes = [...strokes, ...score.after().map((points, i) => weave({ points, seed: 819 + i * 79, width: 4, palette: score.palette }, nextField, 1.35))];
    stages.push({ title: 'Cross the absence', description: 'Ten violet gestures feel the missing threads.', study: { version: 1, strokes, ghosts } });
  }
  return { study: { version: 1, strokes, ghosts }, stages };
}

export const specimen = (id = 'estuary') => playScore(id).study;
export const processStudy = (id = 'opening') => playScore(id).stages;

// A counterfactual measure, used for exploration rather than as an art score.
export function displacement(doc) {
  let total = 0, samples = 0, max = 0;
  for (const stroke of doc.strokes) for (let i = 0; i < stroke.lines.length; i++) {
    const a = stroke.lines[i].points.at(-1), b = stroke.plain[i].points.at(-1);
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    total += d; samples++; max = Math.max(max, d);
  }
  return { mean: samples ? total / samples : 0, max, threads: samples };
}
