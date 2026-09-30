// Lift part of a thread without re-running the brush. The paired control loses
// the corresponding arc-length interval, keeping the comparison honest.
const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const length = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
function circleInterval(p, q, center, radius) {
  const dx = q.x - p.x, dy = q.y - p.y, x = p.x - center.x, y = p.y - center.y;
  const a = dx * dx + dy * dy, b = 2 * (x * dx + y * dy), c = x * x + y * y - radius * radius;
  if (!a) return c <= 0 ? [0, 1] : null;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const lo = Math.max(0, (-b - Math.sqrt(disc)) / (2 * a)), hi = Math.min(1, (-b + Math.sqrt(disc)) / (2 * a));
  return hi > lo ? [lo, hi] : null;
}
function stripInterval(start, delta, lo, hi) {
  if (Math.abs(delta) < 1e-10) return start >= lo && start <= hi ? [0, 1] : null;
  const a = (lo - start) / delta, b = (hi - start) / delta;
  const min = Math.max(0, Math.min(a, b)), max = Math.min(1, Math.max(a, b));
  return max > min ? [min, max] : null;
}
function capsuleIntervals(p, q, a, b, radius) {
  const intervals = [circleInterval(p, q, a, radius), circleInterval(p, q, b, radius)].filter(Boolean);
  const len = length(a, b);
  if (len > 1e-8) {
    const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
    const dx = q.x - p.x, dy = q.y - p.y;
    const along = stripInterval((p.x - a.x) * ux + (p.y - a.y) * uy, dx * ux + dy * uy, 0, len);
    const across = stripInterval((p.x - a.x) * -uy + (p.y - a.y) * ux, dx * -uy + dy * ux, -radius, radius);
    if (along && across) {
      const lo = Math.max(along[0], across[0]), hi = Math.min(along[1], across[1]);
      if (hi > lo) intervals.push([lo, hi]);
    }
  }
  intervals.sort((a, b) => a[0] - b[0]);
  return intervals.reduce((out, range) => {
    if (out.length && out.at(-1)[1] >= range[0]) out.at(-1)[1] = Math.max(out.at(-1)[1], range[1]);
    else out.push([...range]);
    return out;
  }, []);
}
export function cutPath(points, a, b, radius = 22) {
  const total = points.slice(1).reduce((n, p, i) => n + length(points[i], p), 0);
  if (!total) return { kept: [], removed: [], changed: false };
  const kept = [], removed = [];
  let traveled = 0;
  const append = (collection, p, q, from, to) => {
    if (to - from < 1e-9) return;
    const start = { ...p, t: from }, end = { ...q, t: to };
    const last = collection.at(-1);
    if (last && Math.abs(last.at(-1).t - from) < 1e-8) last.push(end);
    else collection.push([start, end]);
  };
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1], q = points[i], len = length(p, q);
    if (!len) continue;
    const cuts = capsuleIntervals(p, q, a, b, radius);
    let cursor = 0;
    for (const [lo, hi] of cuts) {
      append(kept, mix(p, q, cursor), mix(p, q, lo), (traveled + cursor * len) / total, (traveled + lo * len) / total);
      append(removed, mix(p, q, lo), mix(p, q, hi), (traveled + lo * len) / total, (traveled + hi * len) / total);
      cursor = hi;
    }
    append(kept, mix(p, q, cursor), q, (traveled + cursor * len) / total, (traveled + len) / total);
    traveled += len;
  }
  return { kept, removed, changed: removed.length > 0 };
}
function atFraction(points, fraction) {
  const distances = points.slice(1).map((p, i) => length(points[i], p));
  const target = distances.reduce((a, b) => a + b, 0) * fraction;
  let traveled = 0;
  for (let i = 0; i < distances.length; i++) {
    if (traveled + distances[i] >= target && distances[i]) return mix(points[i], points[i + 1], (target - traveled) / distances[i]);
    traveled += distances[i];
  }
  return { ...points.at(-1) };
}
export function liftInk(doc, a, b, radius = 22) {
  const paths = [], strokes = []; let changed = false;
  for (const stroke of doc.strokes) {
    const lines = [], plain = [];
    for (let i = 0; i < stroke.lines.length; i++) {
      const thread = stroke.lines[i], control = stroke.plain[i], cut = cutPath(thread.points, a, b, radius);
      if (!cut.changed) { lines.push(thread); plain.push(control); continue; }
      changed = true;
      paths.push(...cut.removed.map(path => path.map(({ x, y }) => ({ x, y }))));
      for (const piece of cut.kept) {
        lines.push({ ...thread, points: piece.map(({ x, y }) => ({ x, y })) });
        plain.push({ ...control, points: piece.map(p => atFraction(control.points, p.t)) });
      }
    }
    if (lines.length) strokes.push(lines.length === stroke.lines.length && lines.every((l, i) => l === stroke.lines[i]) ? stroke : { ...stroke, lines, plain, lifted: true });
  }
  return { changed, strokes, paths };
}

export function strokeMemory(stroke) {
  if (!stroke.lifted) return { points: stroke.points };
  const paths = stroke.lines.map(l => l.points).filter(p => p.length > 1);
  return paths.length ? { points: paths[0], paths } : { points: stroke.points };
}
