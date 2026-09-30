import { WIDTH, HEIGHT, PALETTES, validateDocument, memoryPaths } from './field.js';

const coord = n => Number(n.toFixed(2));
const points = path => path.map(p => `${coord(p.x)},${coord(p.y)}`).join(' ');
export function studySVG(doc, { plain = false, currents = false } = {}) {
  validateDocument(doc);
  const ink = doc.strokes.map(s => (plain ? s.plain : s.lines).map(l =>
    `<polyline points="${points(l.points)}" stroke="${PALETTES[s.palette][l.color]}" opacity="${coord(l.opacity)}"/>`).join('')).join('');
  const ghosts = currents ? doc.ghosts.map((g, i) => memoryPaths(g).map(path =>
    `<polyline points="${points(path)}" opacity="${coord(.5 * .72 ** (doc.ghosts.length - i - 1))}"/>`).join('')).join('') : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${plain ? 'The same gestures without memory' : 'Ink shaped by erased gestures'}"><rect width="${WIDTH}" height="${HEIGHT}" fill="#faf8ef"/><g fill="none" stroke-width=".85" stroke-linecap="round" stroke-linejoin="round">${ink}</g><g class="currents" fill="none" stroke="#ae5639" stroke-width="1.2" stroke-dasharray="3 6">${ghosts}</g></svg>`;
}

// A standalone print, with no scripts, fonts, links, or remote assets.
export function pairedPrint(doc) {
  const withMemory = studySVG(doc, { currents: true });
  const withoutMemory = studySVG(doc, { plain: true });
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Lacuna — two lives of the same gesture</title><style>
body{margin:0;background:#efeee6;color:#293e35;font:13px Arial,sans-serif;padding:5vw}header{display:flex;justify-content:space-between;align-items:start;border-bottom:1px solid #d7d9cd;padding-bottom:25px;margin-bottom:35px}h1{font:normal clamp(30px,4vw,55px)/1.1 Georgia,serif;letter-spacing:-1.5px;margin:0}em{color:#ae5639}header p{font-size:11px;line-height:1.8;margin:0;max-width:280px}main{display:grid;grid-template-columns:1fr 1fr;gap:25px}figure{margin:0}svg{width:100%;display:block;box-shadow:0 4px 20px #293e3509}figcaption{display:flex;justify-content:space-between;margin:17px 0;font-size:10px}figcaption span{color:#778074}footer{border-top:1px solid #d7d9cd;margin-top:35px;padding-top:20px;color:#778074;font-size:10px;line-height:1.8}.currents{display:none}#show:checked~main .currents{display:block}label{display:inline-block;margin-bottom:20px;font-size:11px;cursor:pointer}input{accent-color:#ae5639;margin-right:8px}@media(max-width:650px){main{grid-template-columns:1fr}header{display:block}header p{margin-top:20px}}@media print{body{padding:0;background:white}header{margin-bottom:15px}main{gap:15px}label,input{display:none}footer{margin-top:20px}figure{break-inside:avoid}}
</style><header><h1>Two lives of<br>the <em>same gesture.</em></h1><p>Lacuna / a study in absence<br>${doc.strokes.length} marks · ${doc.ghosts.length} memories<br>Identical gestures, seeds and pigment.<br>Only the influence of the past differs.</p></header><input id="show" type="checkbox"><label for="show">Reveal the absent gestures</label><main><figure>${withMemory}<figcaption>With memory<span>The paper remembers.</span></figcaption></figure><figure>${withoutMemory}<figcaption>Without memory<span>The paper has no past.</span></figcaption></figure></main><footer>Only an absent mark can move another.<br>This print holds the ink and its counterfactual. To keep drawing, open the original saved study in Lacuna.</footer></html>`;
}
