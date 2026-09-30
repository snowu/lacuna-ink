import { mkdir, writeFile } from 'node:fs/promises';
import { SCORES, specimen, displacement, processStudy } from '../specimens.js';
import { studySVG, pairedPrint } from '../print.js';

const destination = new URL('../.local/atlas/', import.meta.url);
await mkdir(destination, { recursive: true });
const stages = processStudy();
await writeFile(new URL('opening-process.html', destination), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Lacuna — how an opening is borrowed</title><style>body{margin:5vw;background:#efeee6;color:#293e35;font:13px Arial,sans-serif}h1{font:normal 48px Georgia,serif;letter-spacing:-2px}em{color:#ae5639}main{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}figure{margin:0}svg{width:100%;box-shadow:0 3px 15px #293e3509}h2{font:normal 23px Georgia,serif;margin:20px 0 10px}p{font-size:11px;line-height:1.8;color:#778074}header{margin-bottom:40px}footer{margin-top:35px;border-top:1px solid #d7d9cd;padding-top:15px}@media(max-width:750px){main{grid-template-columns:1fr}h1{font-size:36px}}</style><header><h1>How an opening<br>is <em>borrowed.</em></h1><p>A local score in three movements. The absent part of one drawing becomes material for the next.</p></header><main>${stages.map((s, i) => `<figure>${studySVG(s.study)}<h2>${i + 1}. ${s.title}</h2><p>${s.description}</p></figure>`).join('')}</main><footer><p>The empty opening remembers direction. Later ink turns toward what used to be there.<br>These are actual intermediate states from the same brush and cutting engines used in the instrument.</p></footer></html>`);
const rows = [];
for (const score of SCORES) {
  const doc = specimen(score.id), d = displacement(doc);
  await writeFile(new URL(`${score.id}.html`, destination), pairedPrint(doc));
  await writeFile(new URL(`${score.id}.svg`, destination), studySVG(doc));
  await writeFile(new URL(`${score.id}-without-memory.svg`, destination), studySVG(doc, { plain: true }));
  await writeFile(new URL(`${score.id}.json`, destination), JSON.stringify(doc));
  rows.push(`<a href="${score.id}.html"><img src="${score.id}.svg" alt="${score.title}"><strong>${score.title}</strong><span>${score.subtitle}</span><small>Mean displacement ${d.mean.toFixed(1)} · ${d.threads} threads</small></a>`);
  console.log(`${score.title}: ${d.threads} threads; mean change ${d.mean.toFixed(1)}; maximum change ${d.max.toFixed(1)}`);
}
await writeFile(new URL('index.html', destination), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Lacuna — a local atlas</title><style>body{margin:6vw;background:#efeee6;color:#293e35;font:13px Arial,sans-serif}h1{font:normal 50px Georgia,serif;letter-spacing:-2px}em{color:#ae5639}p{line-height:1.8;color:#778074}main{display:grid;grid-template-columns:repeat(2,1fr);gap:25px;margin-top:40px}a{color:inherit;text-decoration:none}img{width:100%;box-shadow:0 5px 20px #293e3509}strong{display:block;font:normal 25px Georgia,serif;margin:20px 0 10px}span,small{display:block;font-size:11px;line-height:1.8}small{color:#778074;margin-top:12px}@media(max-width:700px){main{grid-template-columns:1fr}h1{font-size:38px}}</style><h1>Studies in <em>absence.</em></h1><p>A local atlas for Lacuna. Four erased shapes and the ink they changed.<br>Open a study to compare two lives of identical hand gestures. Nothing here needs the internet.</p><p><a href="opening-process.html">Follow the borrowed opening in three movements ↗</a></p><main>${rows.join('')}</main></html>`);
console.log(`Atlas written to ${destination.pathname}index.html`);
