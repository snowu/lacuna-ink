import { WIDTH, HEIGHT, LIMITS, PALETTES, random, memoryPaths, makeField, weave } from './field.js';

// A local drawing partner. It reads the paper's actual erased paths, never
// replaces existing ink, and adds ordinary editable, paired brush gestures.
export function replyTo(doc, { palette = 'estuary', width = 6, strength = .7 } = {}) {
  if (!doc.ghosts.length || doc.strokes.length >= LIMITS.strokes) return [];
  if (!PALETTES[palette] || !Number.isFinite(width) || width < 2 || width > 16 || !Number.isFinite(strength) || strength < 0 || strength > 1.5) throw new Error('Invalid reply settings.');
  const anchors = doc.ghosts.slice(-6).flatMap(g => {
    const all = memoryPaths(g);
    const paths = all.length > 80 ? Array.from({length:80}, (_,i) => all[Math.floor(i * all.length / 80)]) : all;
    return paths.flatMap(path => {
      const n = Math.min(24, path.length, Math.max(2, Math.floor(240 / paths.length)));
      return Array.from({ length: n }, (_, i) => path[Math.floor(i * path.length / n)]);
    });
  });
  let seed = 2166136261;
  for (const c of JSON.stringify(anchors)) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
  seed = (seed ^ Math.imul(doc.strokes.length + 1, 7919)) >>> 0;
  const rand = random(seed), field = makeField(doc.ghosts);
  const clamp = (value, max) => Math.max(12, Math.min(max - 12, value));
  const strokes = [];
  for (let i = 0; i < Math.min(5, LIMITS.strokes - doc.strokes.length); i++) {
    // Find a nearby current rather than filling unrelated blank paper.
    let center, vector, best = -1;
    for (let attempt = 0; attempt < 12; attempt++) {
      const anchor = anchors[Math.floor(rand() * anchors.length)], a = rand() * Math.PI * 2, r = 30 + rand() * 75;
      const p = { x: clamp(anchor.x + Math.cos(a) * r, WIDTH), y: clamp(anchor.y + Math.sin(a) * r, HEIGHT) };
      const f = field(p.x, p.y), score = Math.hypot(f.x, f.y);
      if (score > best) { best = score; center = p; vector = f; }
    }
    // Cross the remembered direction: the threads can answer it in their own
    // way, instead of tracing the missing mark exactly.
    const angle = Math.atan2(vector.y, vector.x) + Math.PI / 2 + (rand() - .5) * .65;
    const length = 90 + rand() * 140, bow = (rand() - .5) * 45;
    const points = Array.from({ length: 32 }, (_, n) => {
      const u = n / 31, along = (u - .5) * length, across = Math.sin(u * Math.PI) * bow;
      return { x: clamp(center.x + Math.cos(angle) * along - Math.sin(angle) * across, WIDTH),
        y: clamp(center.y + Math.sin(angle) * along + Math.cos(angle) * across, HEIGHT) };
    });
    strokes.push(weave({ points, seed: Math.floor(rand() * 2147483647), width, palette }, field, strength));
  }
  return strokes;
}
