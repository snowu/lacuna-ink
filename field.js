// The erased gesture is the source, never noise or a preset flow field.
export const WIDTH = 1000, HEIGHT = 700;
export const PALETTES = {
  estuary: ['#27645c', '#3f8271', '#af592e', '#bd9655'],
  dusk: ['#655b83', '#887d9c', '#bf725e', '#474f6c'],
  graphite: ['#343e38', '#596459', '#8c8f77', '#ac7958'],
};
export const LIMITS = { strokes: 100, ghosts: 40, points: 700 };

export function random(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function resample(points, spacing = 12) {
  if (!points.length) return [];
  const out = [{ ...points[0] }];
  let remaining = spacing;
  for (let i = 1; i < points.length; i++) {
    let a = { ...points[i - 1] }, b = points[i];
    let length = Math.hypot(b.x - a.x, b.y - a.y);
    while (length >= remaining && length > 0) {
      const t = remaining / length;
      a = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      out.push(a);
      length -= remaining;
      remaining = spacing;
    }
    remaining -= length;
  }
  return out;
}

function boundedSamples(points, spacing, maxSamples) {
  let length = 0;
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return resample(points, Math.max(spacing, length / (maxSamples - 1))).slice(0, maxSamples);
}

// Bilinear lookup of a cached field. Each ghost contributes its local tangent
// plus a gentle pull toward the removed contour. Newer ghosts weigh more.
export function makeField(ghosts, reach = 90) {
  const cols = 84, rows = 60;
  const data = new Float32Array(cols * rows * 2);
  const sources = ghosts.map((g, i) => ({
    points: boundedSamples(g.points, 14, 200), weight: .72 ** (ghosts.length - i - 1),
  }));
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const x = col / (cols - 1) * WIDTH, y = row / (rows - 1) * HEIGHT;
    let vx = 0, vy = 0;
    for (const source of sources) {
      let best = reach * reach * 6, nearest = null;
      for (let i = 1; i < source.points.length; i++) {
        const a = source.points[i - 1], b = source.points[i];
        const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (!d2) continue;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / d2));
        const px = a.x + t * dx, py = a.y + t * dy;
        const dist = (px - x) ** 2 + (py - y) ** 2;
        if (dist < best) { best = dist; nearest = { px, py, dx, dy, len: Math.sqrt(d2) }; }
      }
      if (nearest) {
        const w = Math.exp(-best / (2 * reach * reach)) * source.weight;
        vx += w * (nearest.dx / nearest.len * 2.5 + (nearest.px - x) / reach * .75);
        vy += w * (nearest.dy / nearest.len * 2.5 + (nearest.py - y) / reach * .75);
      }
    }
    const index = (row * cols + col) * 2;
    data[index] = vx; data[index + 1] = vy;
  }
  return (x, y) => {
    const cx = Math.max(0, Math.min(cols - 1.00001, x / WIDTH * (cols - 1)));
    const cy = Math.max(0, Math.min(rows - 1.00001, y / HEIGHT * (rows - 1)));
    const ix = Math.floor(cx), iy = Math.floor(cy), tx = cx - ix, ty = cy - iy;
    const index = (iy * cols + ix) * 2;
    const blend = k => (data[index + k] * (1 - tx) + data[index + 2 + k] * tx) * (1 - ty)
      + (data[index + cols * 2 + k] * (1 - tx) + data[index + cols * 2 + 2 + k] * tx) * ty;
    return { x: blend(0), y: blend(1) };
  };
}

// Both realities share seeds, pigment, positions and initial velocities.
// Only the field term differs. Store the output so later erasures never
// retroactively change an earlier mark.
export function weave(stroke, field, strength = 1) {
  const rand = random(stroke.seed), seeds = boundedSamples(stroke.points, 11, 550);
  const lines = [], plain = [];
  for (let i = 0; i < seeds.length; i++) {
    const p = seeds[i], prev = seeds[Math.max(0, i - 1)], next = seeds[Math.min(seeds.length - 1, i + 1)];
    const angle = seeds.length > 1 ? Math.atan2(next.y - prev.y, next.x - prev.x) : -Math.PI / 2;
    for (let strand = 0; strand < 3; strand++) {
      const spread = (rand() - .5) * stroke.width * 2;
      const a = angle + (rand() - .5) * .35;
      const speed = 1.8 + rand() * .6;
      const length = 30 + Math.floor(rand() * 25);
      const color = Math.floor(rand() * 4), opacity = .13 + rand() * .21;
      const origin = {
        x: Math.max(0, Math.min(WIDTH, p.x - Math.sin(angle) * spread)),
        y: Math.max(0, Math.min(HEIGHT, p.y + Math.cos(angle) * spread)),
      };
      const integrate = memory => {
        let { x, y } = origin, vx = Math.cos(a) * speed, vy = Math.sin(a) * speed;
        const points = [{ x, y }];
        for (let t = 0; t < length; t++) {
          const f = memory ? field(x, y) : { x: 0, y: 0 };
          vx = vx * .955 + Math.cos(a) * speed * .045 + f.x * strength * .23;
          vy = vy * .955 + Math.sin(a) * speed * .045 + f.y * strength * .23;
          const v = Math.hypot(vx, vy), cap = 3.8;
          if (v > cap) { vx *= cap / v; vy *= cap / v; }
          x += vx; y += vy;
          if (x < 0 || x > WIDTH || y < 0 || y > HEIGHT) break;
          points.push({ x, y });
        }
        return { points, color, opacity };
      };
      lines.push(integrate(true)); plain.push(integrate(false));
    }
  }
  return { ...stroke, lines, plain };
}

export function distanceToPath(x, y, points) {
  let best = Infinity;
  if (points.length === 1) return Math.hypot(x - points[0].x, y - points[0].y);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b.x - a.x, dy = b.y - a.y;
    const d2 = dx * dx + dy * dy;
    const t = d2 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / d2)) : 0;
    best = Math.min(best, Math.hypot(x - a.x - dx * t, y - a.y - dy * t));
  }
  return best;
}

export function validateDocument(doc) {
  if (!doc || doc.version !== 1 || !Array.isArray(doc.strokes) || !Array.isArray(doc.ghosts)) throw new Error('This is not a Lacuna study.');
  if (doc.strokes.length > LIMITS.strokes || doc.ghosts.length > LIMITS.ghosts) throw new Error('This study is too large.');
  const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= WIDTH && p.y >= 0 && p.y <= HEIGHT;
  for (const s of [...doc.strokes, ...doc.ghosts]) {
    if (!Array.isArray(s.points) || !s.points.length || s.points.length > LIMITS.points || !s.points.every(point)) throw new Error('Invalid gesture data.');
  }
  for (const s of doc.strokes) {
    if (!Number.isInteger(s.seed) || !Number.isFinite(s.width) || s.width < 1 || s.width > 24 || !PALETTES[s.palette]) throw new Error('Invalid ink data.');
    for (const name of ['lines', 'plain']) {
      if (!Array.isArray(s[name]) || s[name].length > 5000) throw new Error('Invalid threads.');
      for (const l of s[name]) {
        if (!Array.isArray(l.points) || l.points.length > 60 || !l.points.length || !l.points.every(point)
          || !Number.isInteger(l.color) || l.color < 0 || l.color > 3 || !Number.isFinite(l.opacity) || l.opacity < 0 || l.opacity > 1) throw new Error('Invalid thread data.');
      }
    }
  }
  return { version: 1, strokes: doc.strokes, ghosts: doc.ghosts };
}
