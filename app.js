import { WIDTH, HEIGHT, PALETTES, LIMITS, random, resample, makeField, weave, distanceToPath, validateDocument, memoryPaths } from './field.js';
import { SCORES, specimen } from './specimens.js';
import { pairedPrint } from './print.js';
import { liftInk, strokeMemory } from './cut.js';
import { Listener } from './sound.js';
import { replyTo } from './reply.js';

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
const listener = new Listener();
let listening = false, probe = null, probePointer = null;
function stopListening() {
  listening = false; probe = null; listener.stop();
  $('listen').setAttribute('aria-pressed', false);
  $('paper').classList.remove('listening');
  $('unseen-description').textContent = 'Compare the same hand gestures on a canvas that never remembers.';
  $('empty-note').querySelector('span').textContent = 'Begin anywhere.';
  $('empty-note').querySelector('p').textContent = 'Draw a curve, then let it go.';
  if (probePointer !== null && canvas.hasPointerCapture(probePointer)) canvas.releasePointerCapture(probePointer);
  probePointer = null; dirty = true;
}
function listenAt(point) {
  probe = point;
  listener.sample(compare ? { x: 0, y: 0 } : field(point.x, point.y));
  dirty = true;
}

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
function rebuild() { listener.silence(); field = makeField(doc.ghosts); }
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
  $('reply').disabled = !doc.ghosts.length || doc.strokes.length >= LIMITS.strokes;
  $('reply-note').textContent = !doc.ghosts.length ? 'Let a mark go first. Its absence gives the reply somewhere to begin.' : doc.strokes.length >= LIMITS.strokes ? 'The sheet is full. Let some ink go to make room for a reply.' : 'Five gestures at a time. Your pigment and memory pull. Undo takes the whole reply back.';
  $('release').disabled = doc.strokes.length === 0;
  $('reverse').disabled = $('forget').disabled = doc.ghosts.length === 0;
  $('memory-note').textContent = doc.ghosts.length ? 'Change a current. Only the next ink will know.' : 'The paper has no past yet.';
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
    memoryPaths(g).forEach(path => path.forEach((p, i) => i ? target.lineTo(p.x, p.y) : target.moveTo(p.x, p.y)));
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
  if (listening && probe) {
    ctx.save(); ctx.strokeStyle = '#ae5639'; ctx.lineWidth = .9;
    ctx.beginPath(); ctx.arc(probe.x, probe.y, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(probe.x, probe.y, 2, 0, Math.PI * 2); ctx.fillStyle = '#ae5639'; ctx.fill(); ctx.restore();
  }
  dirty = false;
}
function schedule() {
  if (dirty) render();
  requestAnimationFrame(schedule);
}

function chooseTool(next) {
  if (listening || $('listen').disabled) stopListening();
  finish(); tool = next;
  canvas.setAttribute('aria-label', 'Drawing canvas. Drag to draw; press E to let go of a whole mark, or L to lift part of its ink.');
  $('ink').classList.toggle('selected', tool === 'ink');
  $('erase').classList.toggle('selected', tool === 'erase');
  $('ink').setAttribute('aria-pressed', tool === 'ink');
  $('erase').setAttribute('aria-pressed', tool === 'erase');
  $('lift').classList.toggle('selected', tool === 'lift');
  $('lift').setAttribute('aria-pressed', tool === 'lift');
  $('paper').classList.toggle('erasing', tool !== 'ink');
  $('tool-description').textContent = tool === 'ink' ? 'Drag slowly. A little ink goes a long way.' : tool === 'lift' ? 'Lift only the ink beneath your brush. Its missing fragments become a current.' : 'Brush across a mark. The whole gesture becomes a current.';
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
  doc.ghosts = [...doc.ghosts, ...removed.map(strokeMemory)].slice(-LIMITS.ghosts);
  changed({ currents: true });
}
function liftAt(a, b = a) {
  const result = liftInk(doc, a, b);
  if (!result.changed) return;
  if (result.strokes.some(s => s.lines.length > 5000)) { toast('This ink is finely fragmented. Release a whole mark to make room.'); return; }
  if (!eraseSnapshot) { snapshot(); eraseSnapshot = true; }
  doc.strokes = result.strokes;
  active.liftPaths = [...(active.liftPaths || []), ...result.paths];
  changed();
}
canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0 || active) return;
  if (listening) {
    probePointer = e.pointerId; canvas.setPointerCapture(e.pointerId);
    canvas.focus({ preventScroll: true }); listenAt(position(e)); return;
  }
  if (compare) { toast('Switch off “Without memory” to draw again.'); return; }
  // CSS touch-action keeps drawing gestures from panning the page.
  if (tool === 'ink' && doc.strokes.length >= LIMITS.strokes) { toast('This sheet is full. Release some ink, or start a new sheet.'); return; }
  canvas.setPointerCapture(e.pointerId);
  canvas.focus({ preventScroll: true });
  const p = position(e);
  active = { points: [p], seed: Math.floor(Math.random() * 2147483647), width: Number($('width').value), palette,
    strength: Number($('strength').value) / 100, tool, pointer: e.pointerId };
  eraseSnapshot = false;
  if (tool === 'erase') eraseAt(p);
  if (tool === 'lift') liftAt(p);
  $('empty-note').hidden = true; dirty = true;
});
canvas.addEventListener('pointermove', e => {
  if (listening) { listenAt(position(e)); return; }
  const box = canvas.getBoundingClientRect();
  if (tool !== 'ink' && !compare) {
    $('cursor').style.display = 'block';
    $('cursor').style.left = `${e.clientX - box.left}px`;
    $('cursor').style.top = `${e.clientY - box.top}px`;
    $('cursor').style.width = $('cursor').style.height = `${(tool === 'lift' ? 44 : 30) / WIDTH * box.width}px`;
  }
  if (!active || active.pointer !== e.pointerId) return;
  const p = position(e), last = active.points.at(-1);
  if (active.tool === 'erase') { eraseAt(last, p); active.points = [p]; }
  else if (active.tool === 'lift') { liftAt(last, p); active.points = [p]; }
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
  if (active.tool === 'lift' && active.liftPaths?.length) {
    const paths = active.liftPaths;
    const sampled = paths.length > 5000 ? Array.from({ length: 5000 }, (_, i) => paths[Math.floor(i * paths.length / 5000)]) : paths;
    doc.ghosts = [...doc.ghosts, { points: sampled[0], paths: sampled }].slice(-LIMITS.ghosts);
    rebuild();
  }
  const pointer = active.pointer;
  active = null;
  if (canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
  changed();
}
canvas.addEventListener('pointerup', finish);
canvas.addEventListener('pointercancel', finish);
canvas.addEventListener('lostpointercapture', finish);
canvas.addEventListener('pointerleave', () => { $('cursor').style.display = 'none'; if (listening) { listener.silence(); probe = null; dirty = true; } });
canvas.addEventListener('pointerup', e => { if (e.pointerType === 'touch' && listening) listener.silence(); probePointer = null; });
canvas.addEventListener('pointercancel', () => { listener.silence(); probePointer = null; });
window.addEventListener('blur', () => { finish(); listener.silence(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) listener.silence(); });

$('ink').onclick = () => chooseTool('ink');
$('erase').onclick = () => chooseTool('erase');
$('lift').onclick = () => chooseTool('lift');
$('listen').onclick = async () => {
  if (listening) { stopListening(); chooseTool(tool); return; }
  finish(); $('listen').disabled = true;
  try {
    if (!await listener.start()) return;
    listening = true;
    for (const id of ['ink', 'erase', 'lift']) { $(id).classList.remove('selected'); $(id).setAttribute('aria-pressed', false); }
    $('listen').setAttribute('aria-pressed', true);
    $('paper').classList.add('listening'); $('cursor').style.display = 'none';
    $('unseen-description').textContent = 'Move across the paper to hear its currents. Listening leaves no ink.';
    canvas.setAttribute('aria-label', 'Listening canvas. Move across erased marks, or use arrow keys, to hear their currents without drawing.');
    $('empty-note').querySelector('span').textContent = 'Nothing to hear yet.';
    $('empty-note').querySelector('p').textContent = 'Choose Ink, make a mark, then let it go.';
    $('tool-description').textContent = 'Explore with your hand. Choose an ink tool to draw again.';
    toast('Move over a memory. Its direction becomes a tone. Blank paper is silent.');
  } catch { stopListening(); toast('Sound could not start in this browser. You can still reveal the currents.'); }
  finally { $('listen').disabled = false; }
};
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
  listener.silence();
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
  doc.ghosts = [...doc.ghosts, ...doc.strokes.map(strokeMemory)].slice(-LIMITS.ghosts);
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
function openScore(id) {
  finish(); snapshot(); doc = specimen(id); normalView();
  const score = SCORES.find(s => s.id === id);
  document.querySelector(`[data-palette="${score.palette}"]`).click();
  changed({ currents: true }); toast(score.note);
}
$('example').onclick = () => openScore('estuary');
$('reply').onclick = () => {
  finish();
  const strokes = replyTo(doc, { palette, width: Number($('width').value), strength: Number($('strength').value) / 100 });
  if (!strokes.length) return;
  snapshot(); doc.strokes = [...doc.strokes, ...strokes]; normalView(); changed();
  toast('A reply from the paper’s memory. Keep it, undo it, or let it become another current.');
  $('paper').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
};
$('reverse').onclick = () => {
  finish(); if (!doc.ghosts.length) return;
  snapshot();
  const last = doc.ghosts.at(-1);
  doc.ghosts = [...doc.ghosts.slice(0, -1), { ...last, points: [...last.points].reverse(), ...(last.paths ? { paths: last.paths.map(p => [...p].reverse()) } : {}) }];
  changed({ currents: true });
  if (!reveal) $('ghosts').click();
  toast('The last current runs backwards. Your next ink will feel it.');
};
$('forget').onclick = () => {
  finish(); if (!doc.ghosts.length) return;
  snapshot(); doc.ghosts = doc.ghosts.slice(0, -1); changed({ currents: true });
  toast('One current forgotten. The ink already here stays as it was.');
};
document.querySelectorAll('[data-score]').forEach(button => {
  const thumbnail = button.querySelector('canvas'), tc = thumbnail.getContext('2d');
  tc.scale(.5, .5); tc.drawImage(paperLayer, 0, 0);
  specimen(button.dataset.score).strokes.forEach(s => drawStroke(tc, s));
  button.onclick = () => {
    openScore(button.dataset.score);
    $('paper').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
  };
});
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
$('print-pair').onclick = () => {
  finish();
  download(new Blob([pairedPrint(doc)], { type: 'text/html' }), `lacuna-two-realities-${Date.now()}.html`);
  toast('Two lives of the same gestures. Open the print anywhere, even offline.');
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
$('about').onclick = () => { finish(); listener.silence(); $('explanation').showModal(); };
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
  if (key === 'l') chooseTool('lift');
  if (key === 'g') $('ghosts').click();
  if (key === 'c') $('compare').click();
  if (key === 's') $('listen').click();
  if (key === 'r') $('reply').click();
  if (listening && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    e.preventDefault(); const p = probe || { x: WIDTH / 2, y: HEIGHT / 2 };
    listenAt({ x: Math.max(0, Math.min(WIDTH, p.x + (e.key === 'ArrowLeft' ? -20 : e.key === 'ArrowRight' ? 20 : 0))), y: Math.max(0, Math.min(HEIGHT, p.y + (e.key === 'ArrowUp' ? -20 : e.key === 'ArrowDown' ? 20 : 0))) });
  }
});
window.addEventListener('pagehide', () => { finish(); persist(); stopListening(); });
try {
  const saved = localStorage.getItem(STORAGE);
  if (saved) doc = validateDocument(JSON.parse(saved));
} catch { toast('The previous local study could not be opened. Starting with a clean sheet.'); }
changed({ currents: true }); schedule();
