import { WIDTH, HEIGHT, PALETTES, LIMITS, random, resample, makeField, weave, distanceToPath, validateDocument } from './field.js';

const $ = id => document.getElementById(id);
const canvas = $('canvas'), ctx = canvas.getContext('2d');
const inkLayer = document.createElement('canvas');
inkLayer.width = WIDTH; inkLayer.height = HEIGHT;
const inkCtx = inkLayer.getContext('2d');
const paperLayer = document.createElement('canvas');
paperLayer.width = WIDTH; paperLayer.height = HEIGHT;
const pc = paperLayer.getContext('2d');
pc.fillStyle = '#faf8ef'; pc.fillRect(0, 0, WIDTH, HEIGHT);
const grain = random(491);
for (let i = 0; i < 36000; i++) {
  pc.fillStyle = `rgba(94,81,51,${grain() * .045})`;
  pc.fillRect(grain() * WIDTH, grain() * HEIGHT, .7, .7);
}

let doc = { version: 1, strokes: [], ghosts: [] };
let history = [], field = makeField([]), tool = 'ink', palette = 'estuary';
let reveal = false, compare = false, active = null, dirty = true, layerDirty = true;
let saveTimer, toastTimer, eraseSnapshot = false, localAvailable = true;
const STORAGE = 'lacuna.study.v1';

function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3200);
}
function snapshot() {
  history.push({ version: 1, strokes: [...doc.strokes], ghosts: [...doc.ghosts] });
  if (history.length > 24) history.shift();
}
function rebuild() { field = makeField(doc.ghosts); }
function persist() {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(doc));
    $('save-status').textContent = 'Saved on this device';
  } catch {
    localAvailable = false;
    $('save-status').textContent = 'Save study to keep your work';
  }
}
function changed({ currents = false } = {}) {
  if (currents) rebuild();
  layerDirty = dirty = true;
  $('undo').disabled = history.length === 0;
  $('release').disabled = doc.strokes.length === 0;
  $('counts').textContent = `${doc.strokes.length} ${doc.strokes.length === 1 ? 'mark' : 'marks'} · ${doc.ghosts.length} ${doc.ghosts.length === 1 ? 'memory' : 'memories'}`;
  $('empty-note').hidden = doc.strokes.length > 0 || doc.ghosts.length > 0 || !!active;
  $('save-status').textContent = localAvailable ? 'Saving…' : 'Save study to keep your work';
  clearTimeout(saveTimer); saveTimer = setTimeout(persist, 400);
}

function drawStroke(target, stroke, plain = false) {
  const colors = PALETTES[stroke.palette];
  target.lineCap = 'round'; target.lineJoin = 'round'; target.lineWidth = .85;
  for (const line of plain ? stroke.plain : stroke.lines) {
    target.globalAlpha = line.opacity;
    target.strokeStyle = colors[line.color];
    target.beginPath();
    line.points.forEach((p, i) => i ? target.lineTo(p.x, p.y) : target.moveTo(p.x, p.y));
    target.stroke();
  }
  target.globalAlpha = 1;
}
function drawGhosts(target) {
  target.save();
  target.strokeStyle = '#a86447'; target.lineWidth = 1; target.setLineDash([3, 6]);
  doc.ghosts.forEach((g, index) => {
    target.globalAlpha = .5 * .72 ** (doc.ghosts.length - index - 1);
    target.beginPath();
    g.points.forEach((p, i) => i ? target.lineTo(p.x, p.y) : target.moveTo(p.x, p.y));
    target.stroke();
  });
  target.setLineDash([]); target.strokeStyle = '#718773'; target.lineWidth = .7;
  target.globalAlpha = .5;
  for (let y = 28; y < HEIGHT; y += 29) for (let x = 28; x < WIDTH; x += 29) {
    const f = field(x, y), len = Math.hypot(f.x, f.y);
    if (len < .12) continue;
    const size = Math.min(13, len * 5), dx = f.x / len * size, dy = f.y / len * size;
    target.beginPath(); target.moveTo(x - dx / 2, y - dy / 2); target.lineTo(x + dx / 2, y + dy / 2);
    const a = Math.atan2(dy, dx);
    target.moveTo(x + dx / 2 - Math.cos(a - .5) * 3, y + dy / 2 - Math.sin(a - .5) * 3);
    target.lineTo(x + dx / 2, y + dy / 2);
    target.lineTo(x + dx / 2 - Math.cos(a + .5) * 3, y + dy / 2 - Math.sin(a + .5) * 3);
    target.stroke();
  }
  target.restore();
}
function render() {
  if (layerDirty) {
    inkCtx.clearRect(0, 0, WIDTH, HEIGHT);
    for (const s of doc.strokes) drawStroke(inkCtx, s, compare);
    layerDirty = false;
  }
  ctx.drawImage(paperLayer, 0, 0);
  ctx.drawImage(inkLayer, 0, 0);
  if (reveal && !compare) drawGhosts(ctx);
  if (active?.tool === 'ink') drawStroke(ctx, weave(active, field, active.strength));
  dirty = false;
}
function schedule() {
  if (dirty) render();
  requestAnimationFrame(schedule);
}

function chooseTool(next) {
  finish(); tool = next;
  $('ink').classList.toggle('selected', tool === 'ink');
  $('erase').classList.toggle('selected', tool === 'erase');
  $('ink').setAttribute('aria-pressed', tool === 'ink');
  $('erase').setAttribute('aria-pressed', tool === 'erase');
  $('paper').classList.toggle('erasing', tool === 'erase');
  $('tool-description').textContent = tool === 'ink' ? 'Drag slowly. A little ink goes a long way.' : 'Brush across a mark. The whole gesture becomes a current.';
  $('cursor').style.display = 'none';
}
function position(e) {
  const box = canvas.getBoundingClientRect();
  return { x: Math.max(0, Math.min(WIDTH, (e.clientX - box.left) / box.width * WIDTH)),
    y: Math.max(0, Math.min(HEIGHT, (e.clientY - box.top) / box.height * HEIGHT)) };
}
function eraseAt(a, b = a) {
  // Resample the eraser sweep as well, so fast movements cannot skip marks.
  const sweep = [...resample([a, b], 12), b];
  const removed = doc.strokes.filter(s => sweep.some(p =>
    distanceToPath(p.x, p.y, s.points) < 24 || s.lines.some(l => distanceToPath(p.x, p.y, l.points) < 15)));
  if (!removed.length) return;
  if (!eraseSnapshot) { snapshot(); eraseSnapshot = true; }
  doc.strokes = doc.strokes.filter(s => !removed.includes(s));
  doc.ghosts = [...doc.ghosts, ...removed.map(s => ({ points: s.points }))].slice(-LIMITS.ghosts);
  changed({ currents: true });
}
canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0 || active) return;
  if (compare) { toast('Switch off “Without memory” to draw again.'); return; }
  e.preventDefault();
  if (tool === 'ink' && doc.strokes.length >= LIMITS.strokes) { toast('This sheet is full. Release some ink, or start a new sheet.'); return; }
  canvas.setPointerCapture(e.pointerId);
  canvas.focus({ preventScroll: true });
  const p = position(e);
  active = { points: [p], seed: Math.floor(Math.random() * 2147483647), width: Number($('width').value), palette,
    strength: Number($('strength').value) / 100, tool, pointer: e.pointerId };
  eraseSnapshot = false;
  if (tool === 'erase') eraseAt(p);
  $('empty-note').hidden = true; dirty = true;
});
canvas.addEventListener('pointermove', e => {
  const box = canvas.getBoundingClientRect();
  if (tool === 'erase' && !compare) {
    $('cursor').style.display = 'block';
    $('cursor').style.left = `${e.clientX - box.left}px`;
    $('cursor').style.top = `${e.clientY - box.top}px`;
    $('cursor').style.width = $('cursor').style.height = `${30 / WIDTH * box.width}px`;
  }
  if (!active || active.pointer !== e.pointerId) return;
  const p = position(e), last = active.points.at(-1);
  if (active.tool === 'erase') { eraseAt(last, p); active.points = [p]; }
  else if (Math.hypot(p.x - last.x, p.y - last.y) >= 3) {
    if (active.points.length >= LIMITS.points) { finish(); toast('A long gesture! Lift your hand, then begin another.'); return; }
    active.points.push(p);
  }
  dirty = true;
});
function finish() {
  if (!active) return;
  if (active.tool === 'ink') {
    snapshot();
    const { tool: ignoredTool, pointer: ignoredPointer, strength, ...stroke } = active;
    doc.strokes = [...doc.strokes, weave(stroke, field, strength)];
  }
  const pointer = active.pointer;
  active = null;
  if (canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
  changed();
}
canvas.addEventListener('pointerup', finish);
canvas.addEventListener('pointercancel', finish);
canvas.addEventListener('lostpointercapture', finish);
canvas.addEventListener('pointerleave', () => $('cursor').style.display = 'none');
window.addEventListener('blur', finish);

$('ink').onclick = () => chooseTool('ink');
$('erase').onclick = () => chooseTool('erase');
$('width').oninput = () => $('width-value').textContent = $('width').value;
$('strength').oninput = () => $('strength-value').textContent = `${$('strength').value}%`;
document.querySelectorAll('[data-palette]').forEach(button => button.onclick = () => {
  palette = button.dataset.palette;
  document.querySelectorAll('[data-palette]').forEach(b => {
    b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', b === button);
  });
});
$('ghosts').onclick = () => {
  finish(); reveal = !reveal; $('ghosts').setAttribute('aria-pressed', reveal); dirty = true;
  if (reveal && !doc.ghosts.length) toast('Let go of a mark first. Its current will appear here.');
};
$('compare').onclick = () => {
  finish(); compare = !compare; $('compare').setAttribute('aria-pressed', compare);
  $('compare-note').hidden = !compare;
  $('view-label').textContent = compare ? 'WITHOUT MEMORY' : 'INK & MEMORY';
  $('paper').classList.toggle('comparing', compare);
  $('cursor').style.display = 'none'; layerDirty = dirty = true;
};
function undo() {
  finish();
  if (!history.length) return;
  doc = history.pop(); changed({ currents: true });
  toast('One step back. Ink and memory restored.');
}
$('undo').onclick = undo;
$('release').onclick = () => {
  finish(); if (!doc.strokes.length) return;
  snapshot();
  doc.ghosts = [...doc.ghosts, ...doc.strokes.map(s => ({ points: s.points }))].slice(-LIMITS.ghosts);
  doc.strokes = []; changed({ currents: true });
  if (compare) $('compare').click();
  chooseTool('ink'); toast('The ink is gone. Its currents remain. Draw through them.');
};
function normalView() {
  if (compare) $('compare').click();
  chooseTool('ink');
}
$('new').onclick = () => {
  finish(); snapshot(); doc = { version: 1, strokes: [], ghosts: [] };
  normalView(); changed({ currents: true }); toast('A sheet with no past. Undo brings the previous one back.');
};
function sampleStudy() {
  const circle = Array.from({ length: 150 }, (_, i) => {
    const a = i / 149 * Math.PI * 2;
    return { x: 505 + Math.cos(a) * 170, y: 350 + Math.sin(a) * 173 };
  });
  const wave = Array.from({ length: 120 }, (_, i) => ({ x: 160 + i * 5.6, y: 395 + Math.sin(i / 119 * Math.PI * 2) * 85 }));
  const ghosts = [{ points: circle }, { points: wave }], f = makeField(ghosts);
  const strokes = [];
  for (let i = 0; i < 7; i++) {
    const points = Array.from({ length: 30 }, (_, j) => ({ x: 230 + j * 17, y: 175 + i * 49 + Math.sin(j * .13 + i * .2) * 12 }));
    strokes.push(weave({ points, seed: 103 + i * 79, width: 3.5, palette: 'estuary' }, f, 1.15));
  }
  return { version: 1, strokes, ghosts };
}
$('example').onclick = () => {
  finish(); snapshot(); doc = sampleStudy(); normalView();
  changed({ currents: true }); toast('Two missing curves bend seven gestures. Compare with “Without memory”.');
};
function download(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
$('export').onclick = () => {
  finish();
  const out = document.createElement('canvas'); out.width = WIDTH * 2; out.height = HEIGHT * 2;
  const target = out.getContext('2d'); target.scale(2, 2); target.drawImage(paperLayer, 0, 0);
  doc.strokes.forEach(s => drawStroke(target, s, compare));
  out.toBlob(blob => {
    if (!blob) { toast('The image could not be saved. Try saving your study instead.'); return; }
    download(blob, `lacuna-${compare ? 'without-memory' : 'study'}-${Date.now()}.png`);
    toast('An image to keep. Save the study too if you want its memories.');
  }, 'image/png');
};
$('save-study').onclick = () => {
  finish(); download(new Blob([JSON.stringify(doc)], { type: 'application/json' }), `lacuna-study-${Date.now()}.json`);
  toast('Ink and memory, kept together.');
};
$('load-study').onclick = () => $('file').click();
$('file').onchange = async e => {
  const file = e.target.files[0]; if (!file) return;
  try {
    if (file.size > 24 * 1024 * 1024) throw new Error('This file is too large (24 MB maximum).');
    const loaded = validateDocument(JSON.parse(await file.text()));
    finish(); snapshot(); doc = loaded; normalView(); changed({ currents: true }); toast('A past life, reopened.');
  } catch (error) { toast(error instanceof SyntaxError ? 'This file is not a readable Lacuna study.' : error.message); }
  e.target.value = '';
};
$('about').onclick = () => { finish(); $('explanation').showModal(); };
$('close').onclick = $('begin').onclick = () => $('explanation').close();
$('explanation').addEventListener('click', e => { if (e.target === $('explanation')) {
  const r = $('explanation').getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) $('explanation').close();
} });
document.addEventListener('keydown', e => {
  if ($('explanation').open || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(e.target.tagName) || e.altKey) return;
  const key = e.key.toLowerCase();
  if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  if (e.ctrlKey || e.metaKey) return;
  if (key === 'b') chooseTool('ink');
  if (key === 'e') chooseTool('erase');
  if (key === 'g') $('ghosts').click();
  if (key === 'c') $('compare').click();
});
window.addEventListener('pagehide', () => { finish(); persist(); });
try {
  const saved = localStorage.getItem(STORAGE);
  if (saved) doc = validateDocument(JSON.parse(saved));
} catch { toast('The previous local study could not be opened. Starting with a clean sheet.'); }
changed({ currents: true }); schedule();
