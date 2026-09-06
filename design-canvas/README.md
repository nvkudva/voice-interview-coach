# Design canvas

Source for the [Interview Coach UI](https://claude.ai/code/artifact/5aadc3f2-a537-462a-bfbf-edfae807a28e)
design canvas — six artboards covering pre-call, live call, scored, the
waveline state language, and two phone screens.

Every colour, type step, radius and control height is imported from `build.mjs`,
whose token table is lifted verbatim from `../web/styles.css`. Change a token in
the app and change it here, or the mock and the product drift.

## What it shows that the app does not yet

These are specced in `../docs/design-system.md` and `../docs/ux-spec.md` but
unbuilt, so the canvas runs deliberately ahead of `../web/`:

- the **turn ribbon** — every turn as one bar, notched above where a barge-in
  landed, circled below where a backchannel was correctly ignored
- **sparklines** in the latency tiles, against the 800 ms budget line
- **backchannel marks** in the transcript's spine gutter
- **tool calls** typeset as a rule-with-label, not a message bubble
- a real hero and a three-column value row on the pre-call screen

## Regenerating

```bash
node artboards.mjs          # rewrites the six .dc.html artboards
node "<design skill>/seed-canvas.mjs" \
  --template "<design skill>/payload.template.html" \
  --out interview-coach-ui.html --title "Interview Coach UI" \
  --artboard Main.dc.html --artboard PreCall.dc.html --artboard Scored.dc.html \
  --artboard VoiceStates.dc.html --artboard Mobile.dc.html \
  --artboard MobileScored.dc.html --canvas canvas.json
```

The seeded `interview-coach-ui.html` is a ~2.5 MB bundle carrying the canvas
editor, so it is gitignored — rebuild it rather than committing it.

| File | Holds |
|---|---|
| `build.mjs` | tokens and the shared fragments — waveline geometry, pill, message, tile, ribbon |
| `artboards.mjs` | one block per artboard; run it to rewrite them |
| `*.dc.html` | the generated artboards, one per frame |
| `canvas.json` | frame positions, titles, sticky notes, launch view |
