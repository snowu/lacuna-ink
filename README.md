# Lacuna

**A drawing instrument where erased gestures become the currents that bend your next ink.**

Make a curve. Let it go. Draw through the absence.

**[Open the instrument →](https://snowu.github.io/lacuna-ink/)**

Lacuna is a small experiment in giving removal a consequence. Visible marks do not influence anything. When you erase a gesture, its path and direction become an invisible vector field. Later ink follows that field. New memories gradually soften older ones.

## Play

```sh
npm run dev
```

Open **http://localhost:8317**. Python 3 is the only server requirement. The browser app itself has no dependencies, network requests, external fonts, or build step. Any static web server works.

- **Ink** / `B`: drag to draw fine pigment threads. A tap makes a short plume.
- **Let go** / `E`: brush across a mark to remove the whole gesture and leave a current.
- **Lift a little ink** / `L`: cut only the threads beneath the brush, leaving the rest in place. When you lift your hand, the removed fragments become one current. The corresponding portions are also removed from the comparison view.
- **Release all ink**: turn all visible gestures into memory at once.
- **Reveal the currents** / `G`: see the erased contours and the field they created.
- **Without memory** / `C`: compare your actual gestures with their unbent counterparts.
- **Reverse last current**: let the newest absence run backwards. This changes your next ink, while existing marks stay fixed.
- **Forget last current**: remove the newest memory. Undo restores it.
- **Undo** / `Z`: restore both ink and memory from the previous action, including a new sheet or imported study. Up to 24 actions are retained for the current visit.
- **Keep this image**: download the current reality as a 2000 × 1400 PNG, without the current overlay.
- **Save study / Open study**: preserve and reopen both visible threads and erased gestures as JSON.
- **Keep both realities**: download a standalone HTML print of remembered ink beside its counterfactual. It opens offline, includes a toggle for the missing gestures, and needs no scripts or external assets.

Start with **Try an example**, then switch **Without memory** on and off. The example uses two absent curves and seven gestures; it goes through the same field and brush engine as your drawing. Undo returns to your previous sheet.

The cabinet below the instrument offers four editable studies: an absent tide, a moon with opposing circular memories, a crooked fault through straight gestures, and a borrowed opening cut in one weave that catches the next. These are small scores played through the ordinary brush and lifting engines. You can change their memories and keep drawing.

Your latest sheet is saved in browser storage when available. The app reports when storage is full or unavailable; Save study still works. The brush is bounded to 550 seeds per gesture, sheets to 100 visible gestures and 40 memories. Imported studies have a 24 MB limit.

## What makes the experiment different?

The interesting operation is **erasure becoming a reusable, directed cause**, rather than a disappearing trace or a visual undo history. The comparison is built into the instrument: both versions use identical input coordinates, random seeds, initial velocities, colors and opacity. Only the erased-gesture force is removed. Earlier ink is stored as geometry, so later erasures never change it retroactively.

I searched for erased-stroke vector fields, drawing tools with force-field erasure, and generative drawing with persistent memory on 29 September 2026. The nearest examples I found were:

- [Ink Current](https://animationpatterns.art/studies/ink-current/): a particle system that separates the lifetime of motion from the lifetime of its fading visual trace. It explicitly does not store strokes. Lacuna stores deliberately erased gestures as persistent sources for subsequent marks.
- [Interart’s animated drawing tool](https://www.interart.ai/animated-drawing-tool): applies motion to drawn strokes. Lacuna’s visible ink stays still; the absent gesture changes the next one.
- [DrawingBotV3 streamlines](https://docs.drawingbotv3.com/en/latest/pfms.html): uses vector fields to generate image-based drawings and erasure to control drawing density. Lacuna’s source is the user’s removed gesture rather than an image or a preset field.

These precedents establish that flow-field art, erasure and visual memory are existing ideas. The searched sources did not reveal this exact interaction. **This is an independently built combination, not a claim of proven worldwide priority.** A search cannot establish that.

## Under the paper

- `field.js`: deterministic sampling, cached vector field, paired brush trajectories, study validation.
- `app.js`: pointer interaction, stroke erasure, reversible actions, persistence, export and import.
- `style.css` / `index.html`: responsive paper, pigment controls and a short introduction.
- `specimens.js`: four editable scores, plus a measurement of how their erased gestures changed their ink.
- `cut.js`: exact cuts through swept circular brushes, paired arc-length clipping, and memories made from the remaining ink.
- `print.js`: validated SVG and standalone paired HTML prints.
- `tools/make-atlas.js`: an offline atlas of SVGs, paired prints and portable studies.
- `test/`: causal checks for absence, direction, zero pull, reproducibility, geometry limits, compact ink, study round trips and offline prints.

Each memory contributes the tangent of its nearest segment, plus a gentle attraction toward the contour, weighted by Gaussian distance. A lifted memory contains disconnected paths, which are never joined into an imaginary contour. Older memories have weight `0.72 ^ age`. The resulting 84 × 60 field is sampled bilinearly. Fine threads integrate that force together with their initial velocity. The plain version integrates the same threads with a zero field. Cuts map to corresponding arc-length intervals in that plain version, keeping the paired comparison consistent.

```sh
npm test
```

Create a local, standalone atlas:

```sh
npm run atlas
```

Open `.local/atlas/index.html`. Its SVGs, JSON studies and paired prints work without the server or internet. Generated artifacts stay outside version control.

The atlas also contains `opening-process.html`: three actual intermediate drawings showing the weave, the cut, and the violet ink shaped by that cut.

Browser checks use Playwright as a development dependency, with system Chromium by default. Start the local server first, then run:

```sh
npm ci
npm run test:browser
```

Set `CHROMIUM_EXECUTABLE` if Chromium lives elsewhere. Playwright is not used by the drawing app.

Browser verification covers drawing a loop, releasing it, drawing through its memory, direct erasure, undo, page reload, paired-view differences, PNG and JSON downloads, valid and invalid imports, the explanation dialog, a 390 px mobile layout, editable specimens, reversal and forgetting, an offline paired print, and real touch input.

Made for the pleasure of finding out.
