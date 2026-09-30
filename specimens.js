import { makeField, weave } from './field.js';

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
];

export function specimen(id = 'estuary') {
  const score = SCORES.find(s => s.id === id);
  if (!score) throw new Error('Unknown score.');
  const ghosts = score.ghosts().map(points => ({ points }));
  const field = makeField(ghosts);
  const strokes = score.gestures().map((points, i) => weave({
    points, seed: 103 + i * 79, width: 3.5, palette: score.palette,
  }, field, 1.15));
  return { version: 1, strokes, ghosts };
}

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
