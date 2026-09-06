# Design System — Voice Interview Coach

**Status:** v1 · **Owner:** design · **Last updated:** 2026-09-06
**Scope:** the browser client in `web/`. Replaces `web/styles.css` wholesale.
**Stack:** vanilla CSS, custom properties, no build step, no framework.

This is the visual spec. The UX spec (flows, copy, states-as-behaviour) is written
separately; where the two disagree, behaviour wins and this document gets amended.

---

## 1. Design rationale

The brief is "modern and distinctive, yet follows familiar corporate looks."
Splitting that difference produces a Tailwind admin template. Instead, the
familiarity and the distinctiveness are assigned to different jobs:

- **Familiar** is carried by the *substrate*: a warm neutral ramp, hairline rules,
  8px radii, a real type scale, restrained colour, dense tables that behave like
  tables. Nothing here will surprise anyone who has used a serious internal tool.
- **Distinctive** is carried by two committed ideas, and nowhere else. Everything
  else stays quiet so those two ideas read clearly.

### Idea 1 — The waveline is the page's structural rule

The application header has no bottom border. In its place sits a single hairline
that spans the full viewport width — and that hairline *is* the voice indicator.
It is flat when idle, breathes at ±1px when the mic is open, carries a travelling
bright segment when the agent is thinking, and becomes a real waveform driven by
the actual output audio when the agent speaks. When you interrupt it, it collapses
and stamps a notch.

Why this suits a voice product specifically:

1. A voice is literally a signal on a time axis. The one form that is honest about
   what this app does is a line over time. Any orb, blob, or pulsing circle is a
   metaphor; a waveform is the thing itself.
2. It costs zero layout. The single most common failure of voice UIs is that the
   state indicator is a large, central, animated object that makes it impossible to
   read anything else while the agent talks. Putting the indicator on a structural
   rule the eye already treats as furniture means it is legible in peripheral vision
   and ignorable in foveal vision. You can hold a conversation while reading the
   transcript.
3. It is drawn from the real analyser node, not a canned loop. A fake waveform is
   the standard tell of a demo; a real one is a claim the product can back up.
4. The same hairline vocabulary recurs everywhere — the tile grid dividers, the
   table rules, the rubric meter baseline, the sparkline. One line weight, one idea,
   repeated. That repetition is what makes it look like a system rather than a page.

### Idea 2 — The turn spine: transcript and metrics are one ledger

The transcript and the engineering dashboard are not two panels that happen to
share a screen. They are two columns of the same ledger, indexed by the same turn
number in the same mono eyebrow. Turn `07` in the transcript and row `07` in the
metrics table are cross-linked: hover or keyboard-focus either one and the other
highlights.

Why this suits this product: the entire thesis of the PRD is that conversational
quality is a measurable engineering property — that *this* pushback landed 640 ms
after you stopped talking, and *that* backchannel correctly did not interrupt.
Physically joining the utterance to its numbers is the argument the product is
making, expressed as layout. It also solves the hard constraint in the brief: dense
data stops being a spreadsheet parked next to a chat, and becomes navigation.

### How density and calm coexist on one page

Four rules, applied without exception:

1. **Two registers, one substrate.** The conversation column is sans, 15/24, 62ch
   measure, generous. The instrument rail is mono, 12px, hairline-ruled, no shadows.
   The eye knows instantly which region it is in, so the density of one never leaks
   into the calm of the other. They are joined by the shared neutral ramp and the
   shared 1px rule weight.
2. **The rail is subordinate by ink, not by size.** Its default text colour is
   `--text-secondary`/`--text-tertiary`. Only the current turn and out-of-budget
   values are rendered in `--text-primary`. At rest the rail is quiet grey; when a
   number matters, it steps forward.
3. **Nothing in the rail moves.** Value changes are marked by a 700 ms background
   wash (fade-out only, no displacement), which registers in peripheral vision
   without pulling the eye.
4. **The state colour touches exactly three objects**: the waveline, the status
   pill, and the 3px edge on the call control. The rest of the page chrome never
   changes colour with state. That restraint is what makes the state readable.

### Explicitly rejected

Purple→blue gradients · glassmorphism · 16px+ radii · SaaS hero · emoji icons ·
a pulsing central orb · a spinner for "thinking" · zebra-striped tables · colour as
the only carrier of any meaning · animated numbers that count up.

---

## 2. Colour

Warm neutral ramp (hue ≈ 40°, chroma near zero) so the page reads as paper, not as
a rendered UI. Six chromatic hues, each with one job:

| Hue | Token family | Job |
|---|---|---|
| Deep teal | `--accent`, `--voice-listening` | brand, interactive, **the user's voice** |
| Clay | `--voice-speaking` | **the agent's voice**, interruption |
| Slate | `--voice-thinking` | system working, no judgement attached |
| Green | `--positive` | within budget, passed |
| Amber | `--warning` | over budget, needs attention |
| Red | `--critical` | destructive action, failure |

The key economy: *listening* reuses the accent and *speaking* has its own hue, so
the two participants in the conversation have two colours and the voice states are
just "whose colour is currently lit". No extra hue is spent on state.

### 2.1 Token set (copy-paste)

```css
/* ============================================================================
   Voice Interview Coach — colour tokens
   Palette lives on bare :root (light). Dark is applied twice:
   once under prefers-color-scheme for OS-following, once under [data-theme]
   for the explicit toggle. Never define a colour only inside a media block.
   ========================================================================= */

:root {
  color-scheme: light dark;

  /* --- surfaces ---------------------------------------------------------- */
  --canvas:            #F7F6F3;  /* page background */
  --surface:           #FFFFFF;  /* panels, cards, table body */
  --surface-sunken:    #F0EEE9;  /* wells, hover rows, disabled fields */
  --surface-inset:     #EAE7E0;  /* code, table header on scroll, pressed */
  --surface-raised:    #FFFFFF;  /* popovers, toasts, modals (+ shadow) */

  /* --- borders ----------------------------------------------------------- */
  --border-subtle:     #E7E4DD;  /* dividers inside a panel, table rows */
  --border:            #D8D3C9;  /* panel and card outer edge */
  --border-control:    #8A8477;  /* interactive control edges — must clear 3:1 */
  --border-strong:     #B5AFA1;  /* sparkline stroke, drag handles */

  /* --- text -------------------------------------------------------------- */
  --text-primary:      #1A1815;
  --text-secondary:    #55504A;
  --text-tertiary:     #6B665E;
  --text-disabled:     #A29B8C;  /* inactive controls only — exempt from 1.4.3 */
  --text-on-accent:    #FFFFFF;
  --text-on-critical:  #FFFFFF;
  --text-on-ink:       #FAF9F7;

  /* --- accent ------------------------------------------------------------ */
  --accent:            #0B5D63;
  --accent-hover:      #094E53;
  --accent-active:     #073F44;
  --accent-soft:       #E1EFEF;  /* tint background */
  --accent-line:       #0B5D63;

  /* --- status ------------------------------------------------------------ */
  --positive:          #1B6B44;  --positive-soft: #E2F0E7;
  --warning:           #7C5300;  --warning-soft:  #F6EBD3;
  --critical:          #A62121;  --critical-soft: #F8E4E2;
  --critical-hover:    #8E1C1C;  --critical-active: #7A1818;

  /* --- voice states ------------------------------------------------------ */
  --voice-idle:        #8A8477;
  --voice-listening:   #0B5D63;  --voice-listening-soft:   #E1EFEF;
  --voice-thinking:    #44586E;  --voice-thinking-soft:    #E6EAEF;
  --voice-speaking:    #A2451C;  --voice-speaking-soft:    #F6E7DE;
  --voice-interrupted: #8A3A16;  --voice-interrupted-soft: #F6E7DE;
  --voice-current:     var(--voice-idle);   /* set by JS on <html data-voice> */

  /* --- data display ------------------------------------------------------ */
  --meter-track:       #DFDBD1;  /* empty rubric segment, meter background */
  --meter-fill:        var(--accent);
  --spark-stroke:      #B5AFA1;
  --wash:              rgba(11, 93, 99, 0.14);  /* value-changed background wash */

  /* --- focus & overlay --------------------------------------------------- */
  --focus-ring:        #0B5D63;
  --focus-halo:        #FFFFFF;  /* 1px gap ring for clipped containers */
  --backdrop:          rgba(26, 24, 21, 0.44);

  /* --- shadows ----------------------------------------------------------- */
  --shadow-1: 0 1px 2px rgba(26,24,21,.06);
  --shadow-2: 0 2px 4px rgba(26,24,21,.06), 0 8px 16px -6px rgba(26,24,21,.10);
  --shadow-3: 0 4px 8px rgba(26,24,21,.08), 0 24px 40px -12px rgba(26,24,21,.18);
}

/* Dark palette, written once and applied twice. Keep these two blocks
   byte-identical; if you edit one, edit the other. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --canvas:            #121110;
    --surface:           #1A1918;
    --surface-sunken:    #0E0D0C;
    --surface-inset:     #232221;
    --surface-raised:    #232221;

    --border-subtle:     #2A2826;
    --border:            #383533;
    --border-control:    #78726C;
    --border-strong:     #524E4A;

    --text-primary:      #F3F1ED;
    --text-secondary:    #B2ABA2;
    --text-tertiary:     #948D83;
    --text-disabled:     #6E6A66;
    --text-on-accent:    #121110;
    --text-on-critical:  #121110;
    --text-on-ink:       #121110;

    --accent:            #45C2B9;
    --accent-hover:      #5CCFC7;
    --accent-active:     #7FE0D8;
    --accent-soft:       #0C2827;
    --accent-line:       #45C2B9;

    --positive:          #57BE85;  --positive-soft: #12291D;
    --warning:           #E0A93E;  --warning-soft:  #2B2110;
    --critical:          #F0736A;  --critical-soft: #301716;
    --critical-hover:    #F58A80;  --critical-active: #F9A29A;

    --voice-idle:        #78726C;
    --voice-listening:   #45C2B9;  --voice-listening-soft:   #0C2827;
    --voice-thinking:    #93ADC8;  --voice-thinking-soft:    #171E26;
    --voice-speaking:    #E08A55;  --voice-speaking-soft:    #2D1B10;
    --voice-interrupted: #F0A07A;  --voice-interrupted-soft: #2D1B10;

    --meter-track:       #333130;
    --spark-stroke:      #524E4A;
    --wash:              rgba(69, 194, 185, 0.16);

    --focus-ring:        #5CCFC7;
    --focus-halo:        #121110;
    --backdrop:          rgba(0, 0, 0, 0.62);

    --shadow-1: 0 1px 2px rgba(0,0,0,.40);
    --shadow-2: 0 2px 6px rgba(0,0,0,.45), 0 10px 22px -8px rgba(0,0,0,.55);
    --shadow-3: 0 8px 28px -6px rgba(0,0,0,.65);
  }
}

:root[data-theme="dark"] {
  color-scheme: dark;
  --canvas:            #121110;
  --surface:           #1A1918;
  --surface-sunken:    #0E0D0C;
  --surface-inset:     #232221;
  --surface-raised:    #232221;

  --border-subtle:     #2A2826;
  --border:            #383533;
  --border-control:    #78726C;
  --border-strong:     #524E4A;

  --text-primary:      #F3F1ED;
  --text-secondary:    #B2ABA2;
  --text-tertiary:     #948D83;
  --text-disabled:     #6E6A66;
  --text-on-accent:    #121110;
  --text-on-critical:  #121110;
  --text-on-ink:       #121110;

  --accent:            #45C2B9;
  --accent-hover:      #5CCFC7;
  --accent-active:     #7FE0D8;
  --accent-soft:       #0C2827;
  --accent-line:       #45C2B9;

  --positive:          #57BE85;  --positive-soft: #12291D;
  --warning:           #E0A93E;  --warning-soft:  #2B2110;
  --critical:          #F0736A;  --critical-soft: #301716;
  --critical-hover:    #F58A80;  --critical-active: #F9A29A;

  --voice-idle:        #78726C;
  --voice-listening:   #45C2B9;  --voice-listening-soft:   #0C2827;
  --voice-thinking:    #93ADC8;  --voice-thinking-soft:    #171E26;
  --voice-speaking:    #E08A55;  --voice-speaking-soft:    #2D1B10;
  --voice-interrupted: #F0A07A;  --voice-interrupted-soft: #2D1B10;

  --meter-track:       #333130;
  --spark-stroke:      #524E4A;
  --wash:              rgba(69, 194, 185, 0.16);

  --focus-ring:        #5CCFC7;
  --focus-halo:        #121110;
  --backdrop:          rgba(0, 0, 0, 0.62);

  --shadow-1: 0 1px 2px rgba(0,0,0,.40);
  --shadow-2: 0 2px 6px rgba(0,0,0,.45), 0 10px 22px -8px rgba(0,0,0,.55);
  --shadow-3: 0 8px 28px -6px rgba(0,0,0,.65);
}

:root[data-theme="light"] { color-scheme: light; }
```

### 2.2 Verified contrast

Ratios computed with the WCAG 2.x relative-luminance formula
(sRGB → linear, `L = 0.2126R + 0.7152G + 0.0722B`, `(L₁+0.05)/(L₂+0.05)`),
rounded down to 2dp. Every pair below was calculated, not estimated.

#### Light — text on surfaces (needs ≥ 4.5:1)

| Text | on `--canvas` #F7F6F3 | on `--surface` #FFFFFF | on `--surface-sunken` #F0EEE9 | on `--surface-inset` #EAE7E0 |
|---|---|---|---|---|
| `--text-primary` #1A1815 | **16.39** | **17.72** | **15.28** | **14.35** |
| `--text-secondary` #55504A | **7.38** | **7.98** | **6.88** | **6.46** |
| `--text-tertiary` #6B665E | **5.27** | **5.70** | **4.91** | **4.61** |
| `--accent` #0B5D63 | **7.04** | **7.61** | **6.56** | **6.16** |
| `--positive` #1B6B44 | **6.01** | **6.50** | **5.60** | **5.26** |
| `--warning` #7C5300 | **6.28** | **6.79** | **5.85** | **5.50** |
| `--critical` #A62121 | **6.79** | **7.34** | **6.33** | **5.94** |
| `--voice-speaking` #A2451C | **5.71** | **6.17** | **5.32** | **5.00** |
| `--voice-thinking` #44586E | **6.78** | **7.33** | **6.32** | **5.93** |
| `--voice-interrupted` #8A3A16 | **7.20** | **7.79** | **6.71** | **6.30** |

All pass 4.5:1 at body size. Lowest value in the table is 4.61:1
(`--text-tertiary` on `--surface-inset`), which is the worst case in the app and
still clears AA for normal text.

#### Dark — text on surfaces (needs ≥ 4.5:1)

| Text | on `--canvas` #121110 | on `--surface` #1A1918 | on `--surface-sunken` #0E0D0C | on `--surface-inset` #232221 |
|---|---|---|---|---|
| `--text-primary` #F3F1ED | **16.72** | **15.56** | **17.21** | **14.08** |
| `--text-secondary` #B2ABA2 | **8.30** | **7.72** | **8.54** | **6.99** |
| `--text-tertiary` #948D83 | **5.75** | **5.35** | **5.91** | **4.84** |
| `--accent` #45C2B9 | **8.69** | **8.08** | — | **7.31** |
| `--positive` #57BE85 | **8.18** | **7.62** | — | **6.89** |
| `--warning` #E0A93E | **8.90** | **8.29** | — | **7.50** |
| `--critical` #F0736A | **6.62** | **6.16** | — | **5.57** |
| `--voice-speaking` #E08A55 | **7.13** | **6.63** | — | **6.00** |
| `--voice-thinking` #93ADC8 | **8.13** | **7.57** | — | **6.85** |
| `--voice-interrupted` #F0A07A | **8.99** | **8.37** | — | **7.57** |

Lowest: 4.84:1 (`--text-tertiary` on `--surface-inset`). Passes.

#### Text on soft tints (pills, banners, bubbles) — needs ≥ 4.5:1

| Pair | Light | Dark |
|---|---|---|
| status hue on its own `-soft` — accent | **6.45** | **7.17** |
| — positive | **5.52** | **6.69** |
| — warning | **5.73** | **7.47** |
| — critical | **6.01** | **5.85** |
| — speaking | **5.11** | **6.22** |
| — thinking | **6.06** | **6.91** |
| `--text-primary` on `--accent-soft` | **15.01** | **13.81** |
| `--text-primary` on `--voice-speaking-soft` | **14.68** | **14.59** |
| `--text-secondary` on `--accent-soft` | **6.76** | **6.85** |
| `--text-secondary` on `--voice-speaking-soft` | **6.61** | **7.24** |
| `--text-tertiary` on `--accent-soft` | **4.83** | **4.74** |
| `--text-tertiary` on `--voice-speaking-soft` | **4.72** | **5.01** |
| `--text-tertiary` on `--warning-soft` | **4.81** | **4.82** |
| `--text-tertiary` on `--critical-soft` | **4.66** | **5.08** |
| `--text-tertiary` on `--thinking-soft` | **4.71** | **5.12** |
| `--text-tertiary` on `--positive-soft` | **4.84** | **4.70** |
| `--voice-interrupted` on `--voice-interrupted-soft` | **6.45** | **7.85** |
| status-pill idle text (`--text-secondary`) on `--surface-sunken` | **6.88** | **8.54** |

Every combination clears 4.5:1, including tertiary-on-tint, which is the tightest
family in the system.

#### Text on filled controls — needs ≥ 4.5:1

| Pair | Light | Dark |
|---|---|---|
| `--text-on-accent` on `--accent` | **7.61** | **8.69** |
| `--text-on-accent` on `--accent-hover` | **9.43** | **10.06** |
| `--text-on-accent` on `--accent-active` | **11.64** | **12.18** |
| `--text-on-critical` on `--critical` | **7.34** | **6.62** |
| `--text-on-critical` on `--critical-hover` | **9.00** | **7.93** |
| `--text-on-critical` on `--critical-active` | **10.65** | **9.58** |
| `--text-primary` on secondary-button rest / hover / press | **17.72 / 15.28 / 14.35** | **14.08 / 12.67 / 11.47** |

#### Non-text UI (WCAG 1.4.11) — needs ≥ 3:1

| Element | Light | Dark |
|---|---|---|
| `--border-control` on `--surface` | **3.72** | **3.70** |
| `--border-control` on `--canvas` | **3.44** | **3.97** |
| `--border-control` on `--surface-inset` | **3.21** | **3.34** |
| `--focus-ring` on `--surface` | **7.61** | **9.37** |
| `--focus-ring` on `--canvas` | **7.04** | **10.06** |
| `--focus-ring` on `--surface-inset` | **6.16** | **8.47** |
| waveline `--voice-idle` on `--canvas` | **3.44** | **3.97** |
| waveline `--voice-listening` on `--canvas` | **7.04** | **8.69** |
| waveline `--voice-thinking` on `--canvas` | **6.78** | **8.13** |
| waveline `--voice-speaking` on `--canvas` | **5.71** | **7.13** |
| waveline `--voice-interrupted` on `--canvas` | **7.20** | **8.99** |
| `--meter-fill` on `--meter-track` | **5.50** | **5.96** |
| status-pill idle border (`--voice-idle`) on `--surface-sunken` | **3.21** | **4.09** |

`--border-subtle` (1.27:1 light) and `--border` (1.49:1 light) are **decorative
dividers only** and are deliberately below 3:1 — they never form the sole boundary
of an interactive control. Any control edge uses `--border-control`.

`--text-disabled` (2.38:1 light, 2.96:1 dark) is exempt under WCAG 1.4.3's
inactive-component exception. Disabled state is *never* signalled by colour alone —
see §5.1.

---

## 3. Typography

### 3.1 Stacks

```css
:root {
  --font-sans: "IBM Plex Sans", "Noto Sans Devanagari", ui-sans-serif, system-ui,
               -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo,
               Consolas, "Liberation Mono", monospace;
}
```

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&family=Noto+Sans+Devanagari:wght@400;500;600&display=swap">
```

**Why IBM Plex.** It is a working engineer's typeface — neutral enough to read as
corporate, with enough character in the terminals and the flat-sided round forms to
not be Inter. Critically, Plex Sans and Plex Mono are designed as one family with
related proportions, so the prose column and the instrument rail belong to the same
system rather than looking like two pasted-together apps. Plex Mono ships a slashed
zero and true tabular figures. `Noto Sans Devanagari` is in the stack because the
product ships Hindi (PRD §11) and the default system Devanagari fallback is
inconsistent across platforms; it is loaded from the same Google Fonts request.

If the webfont fails to load, the fallback stack is a real system stack, not a
single-family guess. `display=swap` means text is never invisible.

### 3.2 Scale

Root is 16px. Sizes are given in px (authoritative) and rem (what you type).

| Token | px / rem | Weight | Line height | Letter spacing | Case | Use |
|---|---|---|---|---|---|---|
| `--type-display` | 30 / 1.875rem | 600 | 34px (1.133) | −0.021em | — | score total, empty-state headline |
| `--type-title` | 22 / 1.375rem | 600 | 26px (1.18) | −0.016em | — | page h1 |
| `--type-heading` | 18 / 1.125rem | 600 | 24px (1.33) | −0.011em | — | card h2, modal title |
| `--type-subhead` | 15 / 0.9375rem | 600 | 22px (1.47) | −0.006em | — | panel h3, score dimension name |
| `--type-body` | 15 / 0.9375rem | 400 | 24px (1.6) | 0 | — | transcript, prose |
| `--type-body-sm` | 13 / 0.8125rem | 400 | 20px (1.54) | 0 | — | secondary prose, banner text |
| `--type-button` | 14 / 0.875rem | 500 | 20px (1.43) | 0.005em | — | all button labels |
| `--type-caption` | 12 / 0.75rem | 500 | 16px (1.33) | 0.005em | — | helper text, timestamps |
| `--type-label` | 11 / 0.6875rem | 600 | 14px (1.27) | 0.09em | UPPER | **mono** — field labels, table headers, tile labels, status pill |
| `--type-eyebrow` | 10 / 0.625rem | 600 | 12px (1.2) | 0.12em | UPPER | **mono** — the turn spine index |

Numeric steps — always `--font-mono`, always `font-variant-numeric: tabular-nums
slashed-zero`:

| Token | px / rem | Weight | Line height | Letter spacing | Use |
|---|---|---|---|---|---|
| `--type-num-hero` | 34 / 2.125rem | 500 | 36px | −0.02em | score total `14` |
| `--type-num-lg` | 22 / 1.375rem | 500 | 26px | −0.01em | stat tile value |
| `--type-num-md` | 14 / 0.875rem | 500 | 20px | 0 | rubric `3/4`, inline metric in prose |
| `--type-num-sm` | 12 / 0.75rem | 400 | 16px | 0 | metrics table cell |
| `--type-num-xs` | 11 / 0.6875rem | 500 | 14px | 0.01em | tile sub-caption, sparkline axis |

```css
:root {
  --type-display:   600 1.875rem/2.125rem var(--font-sans);
  --type-title:     600 1.375rem/1.625rem var(--font-sans);
  --type-heading:   600 1.125rem/1.5rem   var(--font-sans);
  --type-subhead:   600 0.9375rem/1.375rem var(--font-sans);
  --type-body:      400 0.9375rem/1.5rem  var(--font-sans);
  --type-body-sm:   400 0.8125rem/1.25rem var(--font-sans);
  --type-button:    500 0.875rem/1.25rem  var(--font-sans);
  --type-caption:   500 0.75rem/1rem      var(--font-sans);
  --type-label:     600 0.6875rem/0.875rem var(--font-mono);
  --type-eyebrow:   600 0.625rem/0.75rem  var(--font-mono);

  --type-num-hero:  500 2.125rem/2.25rem  var(--font-mono);
  --type-num-lg:    500 1.375rem/1.625rem var(--font-mono);
  --type-num-md:    500 0.875rem/1.25rem  var(--font-mono);
  --type-num-sm:    400 0.75rem/1rem      var(--font-mono);
  --type-num-xs:    500 0.6875rem/0.875rem var(--font-mono);

  --ls-display: -0.021em; --ls-title: -0.016em; --ls-heading: -0.011em;
  --ls-subhead: -0.006em; --ls-label: 0.09em;   --ls-eyebrow: 0.12em;
}

.num, td.num, .tile__value, .metrics-table {
  font-variant-numeric: tabular-nums slashed-zero;
  font-feature-settings: "tnum" 1, "zero" 1;
}
```

**Why numbers get their own treatment.** Every number on this page is a measurement
that will be compared against another measurement — 640 vs 812 ms, $0.1503 vs the
$0.18 ceiling. Proportional figures make columns of numbers ragged and make a
number that changes in place appear to jiggle. Tabular figures give every digit the
same advance width, so a column aligns on the decimal without any alignment code,
and a live-updating value swaps digits without any horizontal movement — which
matters enormously here, because the metrics rail updates during a conversation and
must not attract the eye. The slashed zero removes the `0`/`O` ambiguity in model
names and session IDs. Mono also does semantic work: **anything in mono in this app
is a measured quantity or a machine identifier**, and anything in sans is language.
That rule is never broken, which is why the rail can be dense without being noisy.

### 3.3 Measure and rhythm

- Transcript body measure: `max-width: 62ch` (≈ 520px at 15px). Hard cap.
- Prose in cards: `max-width: 68ch`.
- Vertical rhythm: 4px. All line heights and block spacing are multiples of 4.
- Headings never sit directly on a rule; minimum 12px between a heading baseline
  box and any hairline below it.
- `text-wrap: pretty` on headings and `text-wrap: balance` on the score verdict.
- `hyphens: none`, `overflow-wrap: anywhere` on transcript text (long URLs happen).

---

## 4. Space and layout

### 4.1 Spacing scale

4px base. Two half-steps at the bottom for optical work inside controls.

```css
:root {
  --space-0:  0;
  --space-1:  0.125rem; /*  2px */
  --space-2:  0.25rem;  /*  4px */
  --space-3:  0.375rem; /*  6px */
  --space-4:  0.5rem;   /*  8px */
  --space-5:  0.75rem;  /* 12px */
  --space-6:  1rem;     /* 16px */
  --space-7:  1.25rem;  /* 20px */
  --space-8:  1.5rem;   /* 24px */
  --space-9:  2rem;     /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-11: 3rem;     /* 48px */
  --space-12: 4rem;     /* 64px */
  --space-13: 6rem;     /* 96px */
}
```

### 4.2 Radii, border widths, sizes

```css
:root {
  --radius-xs:   3px;   /* meter segments, chips, sparkline dot halo */
  --radius-sm:   5px;   /* buttons, selects, inputs, stat tiles */
  --radius-md:   8px;   /* panels, cards, toasts */
  --radius-lg:  12px;   /* modal, bottom sheet */
  --radius-pill: 999px; /* status pill ONLY — the single exception */

  --bw-hairline: 1px;
  --bw-emphasis: 2px;   /* semantic left/right rules, over-budget marks */
  --bw-state:    3px;   /* call-control state edge only */
  --bw-focus:    2px;

  --control-h-sm: 28px;
  --control-h:    36px;  /* default: buttons, selects */
  --control-h-lg: 44px;
  --call-h:       48px;  /* the call control */
  --icon-btn:     32px;

  --row-h:        32px;  /* metrics table, dense (default) */
  --row-h-comfy:  40px;  /* [data-density="comfortable"] */
  --appbar-h:     56px;
  --waveline-h:   48px;
}
```

Maximum radius anywhere in the system is 12px, and only the modal uses it.
Everything else lives at 5–8px. This is a deliberate anti-pattern to the
oversized-rounding house style.

### 4.3 Container and grid

```css
:root {
  --container-max: 1360px;
  --gutter: var(--space-7);        /* 20px column gutter, md+ */
  --pad-x: var(--space-6);         /* 16px, < 600 */
}
@media (min-width: 600px)  { :root { --pad-x: var(--space-8); } }  /* 24px */
@media (min-width: 1200px) { :root { --pad-x: var(--space-9); } }  /* 32px */

.container {
  width: 100%;
  max-width: var(--container-max);
  margin-inline: auto;
  padding-inline: var(--pad-x);
}
```

The page is a 12-column grid at ≥900px (`grid-template-columns: repeat(12, minmax(0,1fr))`,
`column-gap: var(--gutter)`). The application shell does not use the 12-column grid
directly — it uses a named two-track layout, and the 12-column grid exists for
content *inside* the conversation column (score card internals, empty states).

### 4.4 Breakpoints and reflow

| Name | Range | Layout |
|---|---|---|
| `xs` | 0–599 | Single column. Call control becomes a fixed bottom bar, 64px tall, `padding-bottom: env(safe-area-inset-bottom)`. Turn spine collapses from a gutter to an inline `07` prefix on the speaker label. Stat tiles 2-up. Metrics table scrolls horizontally with the turn column stuck left. Rail sits below the transcript in a `<details>` open by default. |
| `sm` | 600–899 | Single column, wider. Stat tiles 3-up. Call control returns to the inline control bar. Transcript max-width 62ch, centred in the column. |
| `md` | 900–1199 | Two tracks: `minmax(0,1fr) 340px`, gutter 20px. Rail becomes a sticky right column (`position: sticky; top: calc(var(--appbar-h) + var(--space-6))`, `max-height: calc(100svh - …)`, internal scroll). Turn spine gutter appears at 32px. Stat tiles 2-up inside the rail. |
| `lg` | 1200–1439 | `minmax(0,1fr) 400px`. Turn spine gutter 40px. Stat tiles 2-up. Metrics table shows all 7 columns without horizontal scroll. |
| `xl` | ≥1440 | `minmax(0,1fr) 440px`, container capped at 1360px so the measure never stretches. Stat tiles 3-up. Score card, when present, splits into a 2-column layout (total + verdict left, rubric right). |

```css
:root { --bp-sm: 600px; --bp-md: 900px; --bp-lg: 1200px; --bp-xl: 1440px; }

.app-main { display: grid; gap: var(--space-8); }
@media (min-width: 900px)  { .app-main { grid-template-columns: minmax(0,1fr) 340px; gap: var(--gutter); } }
@media (min-width: 1200px) { .app-main { grid-template-columns: minmax(0,1fr) 400px; } }
@media (min-width: 1440px) { .app-main { grid-template-columns: minmax(0,1fr) 440px; } }
```

**Container queries** are used inside the rail so the tile grid responds to the rail
width rather than the viewport — this keeps the rail correct when it is a sidebar at
340px and when it is full-width at `xs`:

```css
.rail { container-type: inline-size; container-name: rail; }
.tile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; }
@container rail (min-width: 520px) { .tile-grid { grid-template-columns: repeat(3, 1fr); } }
@container rail (max-width: 300px) { .tile-grid { grid-template-columns: 1fr; } }
```

### 4.5 App shell anatomy (top to bottom)

1. **Skip link** — visually hidden until focused, then pinned top-left, `--surface-raised`, `--shadow-2`.
2. **App bar**, 56px, `position: sticky; top: 0; z-index: 30`, background `--canvas`,
   **no `border-bottom`**. Contains: the wordmark (3-bar waveform SVG + "Interview
   Coach" in `--type-subhead`), the status pill, the theme toggle, the density toggle.
   Gains `--shadow-1` only when `[data-scrolled]`.
3. **The waveline**, `position: absolute; left: 0; right: 0; bottom: calc(var(--waveline-h) / -2);`
   height 48px, `z-index: 31`, `pointer-events: none`. Its centre line sits exactly on
   the app bar's boundary, so it *is* the rule.
4. **Control bar**, `padding-block: var(--space-8) var(--space-7)`: language select,
   question select, the call control, session id in `--type-num-xs`.
5. **`.app-main`** — conversation column | rail.
6. **Footer**, 48px, hairline top, session id + delete action + `AS_OF` pricing date.

Z-index scale: `--z-base 0`, `--z-sticky 10` (table header, rail), `--z-appbar 30`,
`--z-waveline 31`, `--z-popover 40`, `--z-toast 50`, `--z-modal 60`.

---

## 5. Components

Shared conventions: all interactive elements are ≥ 32px in their smallest dimension
and have a ≥ 24×24px pointer target (44px at `xs`). Every state below is required;
`:focus-visible` is never overridden away.

### 5.1 Buttons

Base geometry (all variants):

| Property | Value |
|---|---|
| Height | `--control-h` 36px (sm 28px, lg 44px) |
| Padding inline | 14px (sm 10px, lg 18px) |
| Icon gap | `--space-4` 8px |
| Radius | `--radius-sm` 5px |
| Border | 1px solid |
| Font | `--type-button` (14/500, ls 0.005em) |
| Icon size | 20px, stroke 1.5 (16px/1.75 in `sm`) |
| Transition | `background-color`, `border-color`, `color` @ `--dur-fast` `--ease-standard` |

**Primary**

| State | Background | Border | Text |
|---|---|---|---|
| rest | `--accent` | `--accent` | `--text-on-accent` |
| hover | `--accent-hover` | `--accent-hover` | `--text-on-accent` |
| active | `--accent-active` | `--accent-active` | `--text-on-accent`; `transform: translateY(0.5px)` |
| focus-visible | rest + `outline: 2px solid var(--focus-ring); outline-offset: 2px` | | |
| disabled | `--surface-sunken` | `--border` | `--text-disabled`; `cursor: not-allowed`; `aria-disabled="true"` |
| loading | rest colours; label replaced by label + 16px carrier bar (see §6.4); `aria-busy="true"`; pointer-events none, but the element stays focusable |

**Secondary**

| State | Background | Border | Text |
|---|---|---|---|
| rest | `--surface` | `--border-control` | `--text-primary` |
| hover | `--surface-sunken` | `--text-tertiary` | `--text-primary` |
| active | `--surface-inset` | `--text-tertiary` | `--text-primary` |
| focus-visible | as above | | |
| disabled | `--surface-sunken` | `--border` | `--text-disabled` |

**Danger** (delete session)

| State | Background | Border | Text |
|---|---|---|---|
| rest | transparent | `--border-control` | `--critical` |
| hover | `--critical-soft` | `--critical` | `--critical` |
| active | `--critical` | `--critical-active` | `--text-on-critical` |
| focus-visible | `outline: 2px solid var(--critical)` , offset 2px | | |
| disabled | `--surface-sunken` | `--border` | `--text-disabled` |

Danger buttons are *quiet at rest and loud on commit* — a destructive control that
is red before you touch it teaches people to ignore red. Destructive actions always
require a confirm modal (§5.11).

**Ghost / icon button:** 32px square, transparent, radius `--radius-sm`, icon 20px
`--text-secondary`; hover `--surface-sunken` + `--text-primary`; active
`--surface-inset`. Always has `aria-label`.

Disabled state carries three channels: reduced contrast, `cursor: not-allowed`, and
`aria-disabled` (announced). Loading carries the carrier bar + `aria-busy` + the
label changing to a present participle ("Connecting…").

### 5.2 Select

| Property | Value |
|---|---|
| Height | 36px |
| Padding | `0 32px 0 12px` |
| Radius | `--radius-sm` |
| Border | 1px `--border-control` |
| Background | `--surface` |
| Font | `--type-body-sm` (13/400) |
| Chevron | 16px inline SVG, `right: 10px`, `--text-tertiary`, `pointer-events: none` |
| `appearance` | `none` |

States: hover → border `--text-tertiary`; focus-visible → outline 2px
`--focus-ring` offset 2px, border stays; open (`:has(:focus)`) → border `--accent`;
disabled → background `--surface-sunken`, text `--text-disabled`, chevron
`--text-disabled`, `cursor: not-allowed`; invalid → border `--critical` + a 13px
message in `--critical` below with an `alert-triangle` 16px icon.

Field label sits above: `--type-label`, `--text-tertiary`, `margin-bottom: 5px`.
Selects are disabled (not hidden) while a call is live, with helper text
"Locked during a call" — hiding controls mid-call makes the layout jump.

### 5.3 The call control

The single most important control on the page. It is a segmented control that
changes shape with the session, not just colour.

**Idle** — one button, 48px tall, `--radius-sm`, primary colours, padding
`0 var(--space-7)`, icon `phone-start` 20px + label "Start call" in
`--type-button` at 15px/600. `border-left: 3px solid var(--voice-current)` — this is
the 3px `--bw-state` edge, and it is the only place in the system that width appears.

**Connecting** — same footprint, `aria-busy="true"`, label "Connecting…", the 3px
edge shows `--voice-thinking`, a 2px carrier bar runs along the button's bottom edge
(inset, not outset, so nothing outside the button moves).

**Live** — the button splits into a 3-segment group, 48px tall, joined with 1px
`--border-control` dividers, outer radius `--radius-sm`, `overflow: hidden`:

| Segment | Width | Content | Notes |
|---|---|---|---|
| Mic | 48px | `mic` / `mic-off` 20px | toggle; `aria-pressed`; muted state = `mic-off` icon + background `--surface-inset` + a 2px bottom rule in `--warning`; muting is not colour-alone because the glyph changes |
| Timer | flex | `04:12` in `--type-num-md`, `--text-secondary` | tabular, so it does not jitter |
| End | 48px | `phone-end` 20px | danger variant; `aria-label="End call"` |

The whole group carries `border-left: 3px solid var(--voice-current)`, which is the
third and last object that changes colour with voice state.

**Ended** — reverts to the idle single button, label "Start another call".

Keyboard: `Space`/`Enter` activate. A global `M` shortcut toggles mute and `Esc`
(held 500ms, with a visible fill on the End segment) ends the call — a single `Esc`
must never drop a live call.

### 5.4 Status pill

The textual companion to the waveline. 24px tall, `padding: 0 10px 0 8px`, radius
`--radius-pill` (the only pill in the system — deliberately unique so the live-state
read is unmistakable), 1px border in the state hue, background the state's `-soft`
tint, text `--type-label` in the state hue, `gap: 6px`.

Each state has a **distinct 12×12 glyph** so the pill is readable without colour:

| State | Glyph | Text | Border / text | Background |
|---|---|---|---|---|
| idle | hollow ring, 1.25 stroke | `IDLE` | `--voice-idle` / `--text-secondary` | `--surface-sunken` |
| connecting | ring with one gap quadrant | `CONNECTING` | `--voice-thinking` | `--voice-thinking-soft` |
| listening | filled disc | `LISTENING` | `--voice-listening` | `--voice-listening-soft` |
| thinking | filled disc + 270° arc | `THINKING` | `--voice-thinking` | `--voice-thinking-soft` |
| speaking | filled disc + two emitting arcs to the right | `SPEAKING` | `--voice-speaking` | `--voice-speaking-soft` |
| interrupted | filled disc struck by a vertical bar | `INTERRUPTED` | `--voice-interrupted` | `--voice-interrupted-soft` |
| ended | hollow ring with a horizontal bar | `ENDED` | `--voice-idle` / `--text-secondary` | `--surface-sunken` |
| error | triangle with a bar | `ERROR` | `--critical` | `--critical-soft` |

Four redundant channels: glyph shape, text, border colour, background tint. The pill
is `role="status" aria-live="polite" aria-atomic="true"`, so the state is also
announced. State text transitions are a 120ms opacity crossfade with no size change
(the pill has `min-width: 11ch` so it never resizes and never shifts the app bar).

### 5.5 Transcript message

The transcript is a `<ol>`; each message is an `<li>` with `data-turn`, `data-role`,
and optionally `data-interrupted`.

**Shared**

| Property | Value |
|---|---|
| Max width | 62ch |
| Padding | `10px 14px` |
| Radius | 8px on three corners, 2px on the corner facing the spine |
| Font | `--type-body` (15/24) |
| Meta row | `--type-label` speaker + `--type-num-xs` timestamp, `--text-tertiary`, `margin-bottom: 4px`, `gap: 8px` |
| Gap between messages | `--space-5` 12px (same role) / `--space-7` 20px (role change) |
| Entrance | `opacity 0→1` over 120ms `--ease-standard`. **No** translate, **no** scale. |

**Agent (`data-role="agent"`)** — `align-self: start`; background `--surface`;
border 1px `--border-subtle`; `border-left: 2px solid var(--voice-speaking)`;
`border-top-left-radius: 2px`; speaker label `COACH`.

**User (`data-role="user"`)** — `align-self: end`; background `--accent-soft`;
border 1px transparent; `border-right: 2px solid var(--accent)`;
`border-top-right-radius: 2px`; speaker label `YOU`; text `--text-primary`
(15.01:1 on the tint).

**Streaming** (`data-streaming`) — text in `--text-secondary`; a 2px × 1em caret in
`--voice-speaking` at the end, `vertical-align: text-bottom`. The caret fades
1 → 0.35 → 1 over 1.2s `--ease-carrier`; under reduced motion it is static at full
opacity. When the message finalises, the text colour transitions to `--text-primary`
over 200ms. No layout change.

**Interrupted (`data-interrupted`)** — applied to an agent message that was cut off.
This is the *durable* record of an interruption; the waveline cue is transient.

- `border-left-color: var(--voice-interrupted)`; `border-left-style: dashed`;
  `border-left-width: 2px`.
- The text ends with a 2px × 14px solid block in `--voice-interrupted`,
  `margin-left: 4px`, `vertical-align: text-bottom` — a visible cut mark.
- A footer chip below the text: `--type-label`, `--voice-interrupted`, content
  `↯ INTERRUPTED · 0.42 S IN` (the `↯` is the 12px notch glyph as inline SVG, not a
  character), `margin-top: 6px`.
- Text that was never spoken is **not rendered**. We do not show ghost text.
- Screen readers get `<span class="sr-only">interrupted by the candidate</span>`.

Three channels: dashed rule, cut block, labelled chip. Colour is the fourth.

**Backchannel marker** — when the agent was *not* interrupted because the classifier
identified a backchannel, a 4px hollow circle in `--voice-listening` is stamped in
the spine gutter next to that agent message, with `title="backchannel — did not
interrupt"`. This is the visual evidence for goal G2 and it belongs in the
transcript, permanently.

**Tool call** — rendered as a rule-with-label between messages, not a bubble:
a full-width 1px `--border-subtle` line with a centred `--type-label` chip on
`--canvas` reading `TOOL · lookup_concept · 380 MS`, `--text-tertiary`, with a 14px
`tool` icon. It is a system event, so it is typeset as system chrome.

### 5.6 Metric stat tile

Tiles live in a **ledger grid**: the grid container has `background: var(--border-subtle)`
and `gap: 1px`, each tile has `background: var(--surface)`. The dividers are single
shared hairlines rather than four borders per tile — this halves the line count at
the same density and is the main reason the rail reads as an instrument panel rather
than a card soup.

```css
.tile-grid {
  display: grid; gap: 1px;
  background: var(--border-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
}
```

| Property | Value |
|---|---|
| Padding | `12px 14px 10px` |
| Min height | 78px (92px with sparkline) |
| Label | `--type-label`, `--text-tertiary`, `margin-bottom: 6px` |
| Value | `--type-num-lg` (22/500 mono, tabular), `--text-primary` |
| Unit | 12px sans 500, `--text-tertiary`, `margin-left: 3px`, baseline-aligned |
| Caption | `--type-num-xs`, `--text-tertiary`, `margin-top: 2px` — e.g. `budget 800` |
| Sparkline | 100% × 18px SVG, `margin-top: 8px`, stroke 1.25px `--spark-stroke`, `vector-effect: non-scaling-stroke`; last point a 2.5px filled dot in `--voice-current`; a 1px dashed (`2 2`) budget line in `--warning` |
| Empty value | `—` in `--text-tertiary` (an em dash, never `0`) |

**Over budget** — `data-status="over"` adds four channels:
1. Value colour → `--warning`.
2. A 10px `caret-up` inline SVG immediately before the value.
3. Value weight → 600.
4. `box-shadow: inset 0 2px 0 0 var(--warning)` — a 2px top rule on the tile.

Plus `aria-label="p95 812 ms, over the 800 ms budget"`. A screenshot printed in
greyscale still reads correctly.

**Value changed** — a 700ms wash: `background: var(--wash)` → `transparent`,
`transition: background-color var(--dur-wash) var(--ease-standard)`. No movement, no
number animation. Under reduced motion the wash is replaced by a 2px left rule in
`--accent` that persists for 2s.

**Tile set** (mapped to `MetricsSink.summary()` in `agent/metrics_sink.py`):

| Tile | Field | Unit | Budget |
|---|---|---|---|
| P95 E2E | `p95_latency` | ms | 800 (PRD §7) |
| P50 E2E | `p50_latency` | ms | 800 |
| LLM TTFT | `mean_llm_ttft` | ms | 250 |
| TTS TTFB | `mean_tts_ttfb` | ms | 120 |
| EOU DELAY | `mean_eou_delay` | ms | 300 |
| INTERRUPTIONS | `interruptions` | — | — |
| BACKCHANNELS | `backchannels` | — | — (caption: `did not interrupt`) |
| SESSION COST | `total_cost_usd` | USD | 0.18 |
| TURNS | `turns` | — | — |

`INTERRUPTIONS` and `BACKCHANNELS` sit adjacent and share a `--type-label` group
heading `TURN-TAKING`, because their *relationship* is the claim.

### 5.7 Data table row

The per-turn metrics table. Dense by default, one row per turn, mono throughout.

| Property | Default (`dense`) | `[data-density="comfortable"]` |
|---|---|---|
| Row height | 32px | 40px |
| Cell padding | `0 10px` | `0 12px` |
| Font | `--type-num-sm` (12/400 mono) | 13/400 mono |

- **Header**: `--type-label` (11/600 mono caps), `--text-tertiary`, 30px tall,
  `position: sticky; top: 0`, `background: var(--surface)`,
  `border-bottom: 1px solid var(--border)`. Units are declared **once, in the
  header** (`EOU MS`, `TTFT MS`, `E2E MS`, `COST $`) and never repeated in cells.
- **Rows**: separated by `1px solid var(--border-subtle)`. **No zebra fill** — at
  12px mono with 32px rows, zebra doubles the visual noise for no scanning benefit;
  the hairline plus tabular alignment does the work.
- **Turn column**: `position: sticky; left: 0`, width 44px, `background: var(--surface)`,
  `--type-eyebrow`, `--text-tertiary`, left-aligned, zero-padded (`07`). This is the
  turn spine's second appearance.
- **Numeric columns**: `text-align: right`, `font-variant-numeric: tabular-nums`.
- **Hover / focus-within**: `background: var(--surface-sunken)`; the matching
  transcript message simultaneously gets `outline: 2px solid var(--accent);
  outline-offset: 2px`. Rows are focusable (`tabindex="0"`, `role="row"`).
- **Linked (`[data-linked]`)**: background `--accent-soft`, turn cell gains
  `border-left: 2px solid var(--accent)`. Set when the paired transcript message is
  hovered or focused.
- **Current turn**: turn cell text `--text-primary` weight 600, plus a 2px left rule
  in `--voice-current`.

**Over-budget cell** — `data-over="true"` on the `<td>`:
1. Text `--warning`, weight 600.
2. An 8px `caret-up` inline SVG before the number.
3. `box-shadow: inset 0 -2px 0 0 var(--warning)` — a 2px underline on the cell.
4. The **budget bar** overshoots its tick (below).

**The budget bar.** The `e2e` cell's background is a proportional fill, so every row
carries a tiny bar chart without adding a column:

```css
/* The cell's full width represents 140% of budget, so the budget mark always
   sits at 100/140 = 71.43%. A row over budget is visibly past the tick. */
td.budget {
  --pct: 0;                 /* set inline: value / budget * 100, capped at 140 */
  --fill: var(--accent-soft);
  --frac: calc(var(--pct) / 140 * 100%);
  background-image:
    /* 1px tick at the budget position */
    linear-gradient(to right,
      transparent 0 71.43%, var(--border-strong) 71.43%,
      var(--border-strong) calc(71.43% + 1px), transparent calc(71.43% + 1px)),
    /* proportional fill */
    linear-gradient(to right, var(--fill) 0 var(--frac), transparent var(--frac));
  background-repeat: no-repeat;
}
td.budget[data-over] { --fill: var(--warning-soft); }
```

The bar is geometric: a row over budget is visibly longer than the tick mark. That
is a shape signal, independent of the amber. Colour is the redundant channel here,
not the primary one.

**Row states**: rest / hover / focus-visible (`outline: 2px solid var(--focus-ring);
outline-offset: -2px` — negative offset because the table body is an overflow
container and a positive offset would be clipped) / linked / current / over.

**Empty**: a single row spanning all columns, 96px tall, centred, `--type-body-sm`
`--text-tertiary`: "No turns yet. Metrics appear after the first exchange."

**Column set** (from `TurnMetrics.to_dict()`): `turn_index`, `eou_delay`,
`transcription_delay`, `llm_ttft`, `tts_ttfb`, `e2e_latency`, `cost_usd`.
`stt_audio_duration` and the three token counts sit behind a per-row disclosure
(`<details>` in the last cell, chevron-right icon rotating 90° on open) so the
default table stays at 7 columns and fits at `lg` without horizontal scroll.

### 5.8 Score card

Appears in the conversation column when the session ends and the score arrives.

| Property | Value |
|---|---|
| Background | `--surface` |
| Border | 1px `--border`; `border-top: 2px solid var(--accent)` |
| Radius | `--radius-md` 8px (top corners 8px, the 2px rule is inset) |
| Padding | `20px 22px` |
| Shadow | `--shadow-1` |
| Entrance | opacity 0→1 over 200ms; no translate |

**Header row** (`display: grid; grid-template-columns: auto 1fr auto; align-items: baseline; gap: var(--space-6)`):
- Eyebrow `SESSION SCORE` — `--type-label`, `--text-tertiary`.
- Total — `--type-num-hero` (34px mono) `--text-primary`, followed by `/20` in
  `--type-num-lg` `--text-tertiary`.
- Verdict — `--type-label` in a chip; bands: `0–7 DEVELOPING` (`--warning`),
  `8–13 SOLID` (`--voice-thinking`), `14–17 STRONG` (`--positive`),
  `18–20 EXCELLENT` (`--positive`). The band is stated in words, so colour is
  redundant.
- Below the total: the **20-tick total meter** — 20 marks, 3px × 10px, 2px gap
  (98px total), filled `--accent`, empty `--meter-track`, with a 1px full-height
  tick above mark 14 labelled `TARGET` in `--type-eyebrow`.

**Body**, `--type-body`, in a `max-width: 68ch` column:
- `STRENGTHS` / `GAPS` — `--type-label` heading, then a list; markers are 4px squares
  in `--positive` / `--warning`, not bullets, `margin-right: 10px`.
- `HAND-WAVING` — each entry is a block with `border-left: 2px solid var(--voice-speaking)`,
  `padding-left: 12px`; the quote in `--type-body` italic `--text-primary`; the `why`
  in `--type-body-sm` `--text-secondary` below.
- `NEXT DRILL` — a full-width band, `background: var(--accent-soft)`,
  `border-radius: var(--radius-sm)`, `padding: 12px 14px`, text `--text-primary`,
  preceded by a `--type-label` `NEXT DRILL` in `--accent`.

**Unscored** (`status: "unscored"` per PRD §9) — the card renders with the total
replaced by `—`, a `--warning` banner (§5.10) reading "Scoring failed; the
transcript is intact", and the rubric meters shown as all-empty segments with an
explicit `— / 4`. We never show a zero we did not measure.

### 5.9 Rubric score meter (0–4, five dimensions)

One row per dimension, `display: grid; grid-template-columns: 1fr auto auto;
align-items: center; gap: var(--space-5); height: 28px`.

| Part | Spec |
|---|---|
| Name | `--type-subhead` (15/600), `--text-primary`. `requirements_clarification` → "Requirements clarification" |
| Meter | 4 segments, each **26px × 8px** (18px × 8px below 600px), `gap: 3px`, `radius: --radius-xs` |
| Filled segment | `background: var(--meter-fill)` |
| Empty segment | `background: var(--meter-track)`, `box-shadow: inset 0 0 0 1px var(--border)` |
| Target tick | a 1px × 4px mark in `--text-tertiary`, centred **above segment 3**, with `TARGET` explained once in the card's legend |
| Value | `--type-num-md` — `3` in `--text-primary`, `/4` in `--text-tertiary` |

Fill/empty is a **presence-of-fill** distinction, not a hue distinction, so the
meter survives greyscale and every form of colour blindness. The numeral is the
third channel, and each row is `role="meter" aria-valuenow="3" aria-valuemin="0"
aria-valuemax="4" aria-label="Data modeling"`.

Segments do not animate in. They render at their final value.

### 5.10 Banner and toast

**Inline banner** — page-level, non-transient (connection lost, scoring failed,
over-budget summary at session end).

| Property | Value |
|---|---|
| Layout | `display: grid; grid-template-columns: 20px 1fr auto; gap: var(--space-5); align-items: start` |
| Padding | `10px 14px` |
| Radius | `--radius-sm` |
| Border | 1px in the status hue at 1px; `border-left: 3px solid` the status hue |
| Background | the status `-soft` tint |
| Icon | 20px, status hue: `info` / `alert-triangle` / `alert-octagon` / `check` |
| Text | `--type-body-sm`, `--text-primary`; optional 13px action link in the status hue, underlined |
| ARIA | `role="status"` (info/success) or `role="alert"` (warning/critical) |

Four variants: `info` (`--voice-thinking`), `success` (`--positive`), `warning`
(`--warning`), `critical` (`--critical`). Each has a distinct icon, so colour is
never the only signal.

**Toast** — transient confirmations only (session deleted, transcript copied).

| Property | Value |
|---|---|
| Position | fixed, `bottom: var(--space-8); right: var(--space-8)`; below 600px `left/right: var(--space-6)`, bottom above the call bar |
| Width | `min(360px, calc(100vw - 2 * var(--pad-x)))` |
| Background | `--surface-raised`; border 1px `--border`; `border-left: 3px solid` status hue |
| Radius | `--radius-md`; shadow `--shadow-3` |
| Padding | `12px 14px` |
| Stack | max 3, `gap: var(--space-4)`, newest at the bottom; overflow collapses to "+2 more" |
| Dismiss | always an explicit 24px `x` icon button; **errors never auto-dismiss** |
| Auto-dismiss | 6s, shown as a 2px bottom rule shrinking left→right; paused on hover and on focus-within |
| Entrance | opacity 0→1 + `translateY(6px)→0` over 140ms `--ease-standard`; exit 100ms opacity only |
| Reduced motion | no translate, no progress rule; the toast holds for 10s instead |

Toasts never carry information available nowhere else.

### 5.11 Modal and sheet

| Property | ≥600px (modal) | <600px (sheet) |
|---|---|---|
| Element | `<dialog>` + `showModal()` | same |
| Width | `min(520px, calc(100vw - 2 * var(--space-8)))` | 100% |
| Position | centred | bottom-anchored |
| Radius | `--radius-lg` 12px | `12px 12px 0 0` |
| Max height | `min(80svh, 640px)` | `88svh` |
| Padding | 24px | 20px, `padding-bottom: calc(20px + env(safe-area-inset-bottom))` |
| Background | `--surface-raised` | same |
| Border | 1px `--border` | 1px `--border` (no bottom) |
| Shadow | `--shadow-3` | `--shadow-3` |
| Grab handle | — | 36px × 4px, `--border-strong`, `--radius-xs`, centred, `margin-bottom: 16px` |

- Backdrop `::backdrop { background: var(--backdrop); }` — flat, **no blur**.
- Header: `--type-heading` + a 32px `x` icon button, `margin-bottom: var(--space-5)`.
- Footer: actions right-aligned (`flex-end`), `gap: var(--space-4)`,
  `padding-top: var(--space-6)`, `border-top: 1px solid var(--border-subtle)`.
  Destructive action is the primary-position button but uses the **danger** variant.
- Focus is trapped by `<dialog>`; on close, focus returns to the invoking element.
  Initial focus goes to the *least* destructive action.
- Motion: opacity 0→1 + `translateY(8px)→0` (modal) / `translateY(16px)→0` (sheet)
  over 140ms `--ease-standard`. Reduced motion: opacity only, 100ms.
- Uses: confirm session delete, the "how latency is measured" explainer, the
  full-detail metrics view at `xs`.

---

## 6. The voice-state visual language

This is the core of the design. Five states must be readable in half a second of
peripheral attention, while the user is talking and not looking directly at the
screen — and the page must stay calm enough to read while a conversation is running.

### 6.1 The rule: three objects change, nothing else

Only three elements ever respond to voice state:

1. **The waveline** — the hairline under the app bar.
2. **The status pill** — text + glyph + tint.
3. **The call control's 3px left edge.**

The page background, panel surfaces, transcript, table, and tiles are **colour-locked**
against voice state. This is the single most important decision in the section: a UI
where the whole screen changes hue when the agent starts talking is unusable for
reading, and it makes the app feel anxious.

`--voice-current` is a token set once on `<html data-voice="…">`; all three objects
read from it.

```css
:root[data-voice="idle"]        { --voice-current: var(--voice-idle); }
:root[data-voice="connecting"]  { --voice-current: var(--voice-thinking); }
:root[data-voice="listening"]   { --voice-current: var(--voice-listening); }
:root[data-voice="thinking"]    { --voice-current: var(--voice-thinking); }
:root[data-voice="speaking"]    { --voice-current: var(--voice-speaking); }
:root[data-voice="interrupted"] { --voice-current: var(--voice-interrupted); }
:root[data-voice="error"]       { --voice-current: var(--critical); }
```

### 6.2 Waveline geometry

```html
<svg class="waveline" viewBox="0 0 1200 48" preserveAspectRatio="none" aria-hidden="true">
  <polyline class="waveline__path" points="…" fill="none"
            stroke="var(--voice-current)" stroke-width="1.5"
            stroke-linecap="round" stroke-linejoin="round"
            vector-effect="non-scaling-stroke"/>
</svg>
```

- `preserveAspectRatio="none"` lets the line span any viewport width;
  `vector-effect="non-scaling-stroke"` keeps the stroke exactly 1.5px regardless of
  the horizontal scale. Without this the line thickens on wide screens.
- **96 sample points**, rest position `y = 24` (the vertical centre, which is the app
  bar's boundary).
- **30 Hz** update from a Web Audio `AnalyserNode` (`fftSize: 1024`,
  `smoothingTimeConstant: 0.82`). One `points` attribute write per frame. No
  filters, no shadows, no per-frame style recalculation.
- **Raised-cosine envelope**: amplitude is multiplied by
  `0.5 * (1 - cos(2π · i / n))`, so the line tapers to perfectly flat at both screen
  edges. Motion is concentrated in the middle 60% and the line always *meets the page
  edges as a hairline*. This is what keeps it reading as structure rather than as an
  animation.
- Only two properties ever change: the `points` attribute and the `stroke` colour
  (transitioned over `--dur-base` 200ms so state changes crossfade rather than snap).

### 6.3 The states

#### IDLE — before a call, and after it ends

- **Form:** a perfectly straight line. Zero amplitude.
- **Colour:** `--voice-idle` (3.44:1 light, 3.97:1 dark on canvas).
- **Stroke:** 1px.
- **Motion:** none. Absolutely none.
- **Marker:** a 6px hollow circle at the horizontal centre, 1px stroke, marking the
  origin. It is the only thing distinguishing the waveline from an ordinary rule.
- **Pill:** `IDLE` + hollow ring.

#### LISTENING — mic open

- **Form:** amplitude driven by the microphone RMS, mapped to **±0 to 7px**, with
  attack 60ms / release 220ms so it follows speech but never twitches on a click.
- **Colour:** `--voice-listening` (the accent).
- **Stroke:** 1.5px.
- **Silent-but-open:** a **±1px, 4s ease-in-out breath**. This is the only ambient
  loop in the entire product, and it is one pixel: enough to say "the mic is live",
  below the amplitude at which peripheral vision flags motion as demanding attention.
- **Pill:** `LISTENING` + filled disc.
- **Reduced motion:** amplitude is frozen; the line is static, 1.5px, in the
  listening colour, with a 6px filled disc at centre. The pill and the mic segment
  carry the state.

#### THINKING — EOT fired; LLM/TTS in flight, or a tool blocking

The hardest state to get right, because it must not look broken.

- **Form: the line stays flat.** Deliberately. A wiggling line while the agent is
  thinking reads as "recording"; a spinner reads as "stalled". Flat reads as
  "holding".
- **Motion:** a **120px-wide segment of the flat line brightens** to
  `--voice-thinking` and travels left → right, **1.7s**, `--ease-carrier`
  `cubic-bezier(.37,0,.63,1)`, infinite, `animation-fill-mode: none`. Implemented as
  an SVG `<linearGradient>` on the stroke, translated by `transform: translateX()` on
  a `<rect>` inside a `<mask>` — GPU-composited only, no layout, no repaint of the
  path.
- **The rate never changes.** Not with queue depth, not with elapsed time. A carrier
  that speeds up or slows down reads as instability. Constant rate reads as a
  machine that is working.
- **Escalation by information, never by alarm:**
  - **t < 2.5s** — carrier only.
  - **t ≥ 2.5s** — a `--type-label` line appears under the pill:
    `RUNNING · LOOKUP_CONCEPT` (`--text-tertiary`). A wait that is *explained* stops
    being a wait.
  - **t ≥ 6s** — the label gains an elapsed counter in `--type-num-xs`, tabular:
    `6.4 S`. Still no colour change.
  - **t ≥ 12s** — an `info` banner offers "This is taking longer than usual." Nothing
    turns red. Red is reserved for actual failure.
- **Pill:** `THINKING` + disc-and-arc glyph.
- **Reduced motion:** the carrier is removed entirely. The line becomes a **static
  1.5px dashed stroke** (`stroke-dasharray: 6 5`) in `--voice-thinking`. The pill,
  the tool label, and the elapsed counter carry the information — all of which are
  text. Nothing is lost.

#### SPEAKING — agent audio playing

- **Form:** amplitude from the **agent's actual output analyser**, mapped to
  **±0 to 10px**, attack 40ms / release 160ms. Genuinely synchronised to the audio,
  because a canned waveform is the standard tell of a demo.
- **Colour:** `--voice-speaking` (clay).
- **Stroke:** 2px — the only state at 2px, so "the agent has the floor" is legible
  from stroke weight alone.
- **Pill:** `SPEAKING` + emitting glyph. The streaming transcript bubble shows the
  caret.
- **Reduced motion:** static 2px stroke in the speaking colour, plus a static
  three-arc "emitting" mark at the horizontal centre. The transcript, which is
  streaming text, is the real information channel and is unaffected.

#### INTERRUPTED — barge-in accepted, agent audio cut

A **one-shot transition, not a state loop**. Total duration 260ms.

1. **0–160ms:** current amplitude collapses to zero, `--ease-exit`
   `cubic-bezier(.4,0,1,1)`. The line goes flat.
2. **At the collapse point:** a **2px × 18px vertical notch** in
   `--voice-interrupted` is stamped at the x-position where the audio was cut, then
   fades out over 900ms.
3. **160–260ms:** stroke colour crossfades to `--voice-listening`, stroke to 1.5px.
4. The waveline is now LISTENING. Total elapsed: a quarter of a second.

- **Pill:** crossfades to `INTERRUPTED` (struck-disc glyph) for **1.2s** — a single
  fade in, hold, fade out. It does **not** blink. Then `LISTENING`.
- **Durable record:** the agent's transcript bubble gains `data-interrupted` (§5.5)
  and keeps it forever. The `INTERRUPTIONS` tile increments with the 700ms wash.
  Transient cue on the waveline, permanent cue in the ledger.
- **Reduced motion:** no collapse animation, no fade. The line switches to LISTENING
  immediately; the notch appears and is removed after 900ms; the pill text changes;
  the transcript variant is applied. All information preserved.

#### BACKCHANNEL — the mark that is not a state

When `num_backchannels` increments while the agent is SPEAKING, **the waveline does
not change state**. Instead a **4px hollow circle** in `--voice-listening` is stamped
6px *below* the line at the current x and held for 2s.

This is the product's central claim rendered as a mark: you said "mhm", the system
heard you, classified it, and correctly kept talking. The tiny circle below an
uninterrupted waveform is the proof. It is the one piece of visual language here
that no generic voice UI has, and it costs four pixels.

Reduced motion: identical (there is no motion — it is a stamp).

#### ERROR

Line goes to 1px `--critical` with `stroke-dasharray: 3 4` and **no** travel — static,
so it is unmistakably distinct from THINKING's dashed reduced-motion form (6 5, and
a different hue). Pill `ERROR` + triangle glyph. A `critical` banner appears with the
recovery action. This is the only state that turns anything red.

### 6.4 The calm budget

Hard constraints, checkable:

| Rule | Value |
|---|---|
| Total animated screen area | ≤ the 48px waveline band + the 24px pill + a 16px carrier inside a loading button |
| Max displacement of any non-waveline element | 2px |
| Loops in the transcript | 0 |
| Loops in the metrics rail | 0 |
| Fastest repeating cycle | 1.7s (0.59 Hz) — WCAG 2.3.1 flash threshold (3 Hz) satisfied by construction |
| Minimum opacity of anything carrying meaning | 0.35 |
| Colour changes to page chrome on state change | 0 |
| Number values that animate (count up, roll) | 0 |

### 6.5 Motion tokens

```css
:root {
  --dur-instant: 80ms;
  --dur-fast:    140ms;
  --dur-base:    200ms;
  --dur-slow:    320ms;
  --dur-wash:    700ms;
  --dur-carrier: 1700ms;
  --dur-breath:  4000ms;

  --ease-standard: cubic-bezier(.2, 0, 0, 1);
  --ease-exit:     cubic-bezier(.4, 0, 1, 1);
  --ease-carrier:  cubic-bezier(.37, 0, .63, 1);
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --dur-instant: 1ms; --dur-base: 1ms; --dur-slow: 1ms;
    --dur-fast: 100ms;      /* opacity-only crossfades are retained */
    --dur-wash: 1ms;
    --dur-carrier: 0ms; --dur-breath: 0ms;
  }
  *, *::before, *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
  /* Opacity-only transitions are explicitly allowed back in. */
  .pill__text, .toast, .modal, .msg { transition-duration: 100ms !important; }
  .waveline { --wave-amplitude: 0; }
  .waveline--thinking .waveline__carrier { display: none; }
  .waveline--thinking .waveline__path { stroke-dasharray: 6 5; }
}
```

The JS must also check `matchMedia('(prefers-reduced-motion: reduce)')` and stop
writing the `points` attribute entirely — CSS alone cannot stop a rAF loop.

---

## 7. Data display

### 7.1 Keeping density from becoming a spreadsheet

Six mechanisms, all already specced above, listed here as the checklist:

1. **The ledger grid** (§5.6) — shared 1px dividers instead of per-tile borders.
   One line between two tiles, never two.
2. **Units declared once** — in the tile label or the table header, never in cells.
   Repeating "ms" 140 times is what makes a table look like a spreadsheet.
3. **No zebra fill** — hairline row separators + tabular figures. Zebra is a crutch
   for tables whose numbers don't align; ours align.
4. **Ink hierarchy instead of size hierarchy** — the rail's default ink is
   `--text-secondary`/`--text-tertiary`. Only the current turn and out-of-budget
   values are `--text-primary`. The rail is quiet grey at rest; the numbers that
   matter step forward without changing size or position.
5. **The budget bar inside the cell** (§5.7) — the e2e column carries a per-row bar
   chart in its own background, so the table is also a chart, with no extra column.
6. **The turn spine** — the table is navigable, not just readable, because every row
   points at an utterance.

Numbers are formatted, not raw: `0.6412` → `641`, `0.150342` → `$0.1503`. Latency is
always integer milliseconds (no decimals — sub-millisecond precision is noise).
Cost is 4dp. Counts are integers. `—` for absent, never `0`, and never `null`.

### 7.2 Marking a value over budget

Budgets are tokens, so the rule is data:

```css
:root {
  --budget-eou:     300;   /* ms, PRD §7 */
  --budget-stt:     100;
  --budget-ttft:    250;
  --budget-ttfb:    120;
  --budget-e2e:     800;
  --budget-cost:  0.18;    /* USD per session, PRD §10 */
}
```

**Four independent channels, none of which is colour:**

| Channel | Where |
|---|---|
| **Glyph** — a 8–10px `caret-up` inline SVG immediately before the number | tile value, table cell |
| **Weight** — 400 → 600 | table cell; tile value 500 → 600 |
| **Rule** — a 2px `--warning` rule (top on a tile, underline on a cell) | both |
| **Geometry** — the budget bar visibly overshoots its tick mark | table row |
| Colour — `--warning` | both (redundant) |
| Text — `aria-label` states the budget explicitly | both |

A greyscale screenshot, a monochrome printer, and a screen reader all get the
information. Nothing anywhere in this system depends on hue alone — this is checked
by rendering the page with `filter: grayscale(1)` in review.

The rail also carries a one-line legend when any over-budget value is present, using
`:has()` so no JS is involved:

```css
.rail__legend { display: none; }
.rail:has([data-over]) .rail__legend { display: flex; }
```

reading `▲ OVER BUDGET · E2E 800 MS` in `--type-label` `--warning`.

### 7.3 The score rubric

Five dimensions × 0–4 (§5.9), plus a 20-tick total meter (§5.8).

Why segmented rather than a continuous bar: the scale is **ordinal with five discrete
values**, and a continuous bar implies a precision the rubric does not have. Four
discrete segments say "this is 3 out of 4 possible steps" without implying 3.0 is
measured to a decimal. The target tick above segment 3 encodes the PRD's rubric
definition ("3 = reasoned with numbers") directly into the graphic, so the meter
teaches the rubric while it reports the score.

The five dimension labels are rendered in sentence case from the snake_case field
names, in the PRD's order — `requirements_clarification`, `high_level_design`,
`data_modeling`, `scaling_and_tradeoffs`, `communication` — never re-sorted by score.
Consistent order lets someone compare two sessions by eye.

### 7.4 Sparklines

18px tall, full tile width, ≤ 20 points, 1.25px stroke `--spark-stroke` with
`vector-effect: non-scaling-stroke`, no fill, no axis, no gridlines. One 2.5px dot in
`--voice-current` on the last point. One 1px `2 2` dashed budget line in `--warning`.
No animation, no tooltip — the table below is the drill-down. A sparkline that is
also an interactive chart is two components pretending to be one.

---

## 8. Iconography

**Inline SVG only.** No icon font, no sprite fetch, no emoji, no image files. Icons
are authored once as `<symbol>` elements in a hidden `<svg>` at the top of `<body>`
and referenced with `<use href="#i-mic">`, so they inherit `currentColor` and cost
one HTTP request of zero.

```html
<svg class="icon" width="20" height="20" aria-hidden="true" focusable="false">
  <use href="#i-mic"/>
</svg>
```

### 8.1 Drawing rules

| Property | Value |
|---|---|
| viewBox | `0 0 24 24` |
| Live area | 20 × 20, centred (2px optical padding on all sides) |
| Stroke width | **1.5** at 20px and 24px; **1.75** at 16px (optical compensation) |
| Fill | `none` — the only filled elements in the system are the status-pill glyph discs and the sparkline dot |
| Caps / joins | `round` / `round` |
| Stroke colour | `currentColor` |
| Terminal alignment | strokes snap to the half-pixel grid at 20px (`x.5` centres) so nothing blurs |
| Corner radius | 2px on rectangular forms, matching `--radius-xs` |
| Sizes | 16 (inline with body text and table cells), **20 (default: buttons, banners)**, 24 (call control, empty states) |

```css
.icon { width: 20px; height: 20px; stroke-width: 1.5; fill: none;
        stroke: currentColor; stroke-linecap: round; stroke-linejoin: round;
        flex: none; }
.icon--sm { width: 16px; height: 16px; stroke-width: 1.75; }
.icon--lg { width: 24px; height: 24px; }
```

### 8.2 The set

Twenty icons. Nothing is drawn that is not on this list.

| id | Form | Used by |
|---|---|---|
| `i-mark` | three vertical strokes, heights 8 / 16 / 11, 1.5 stroke, 4px apart | the wordmark — a two-bar-plus waveform, tying the logo to the waveline |
| `i-phone-start` | handset, 45° | call control, idle |
| `i-phone-end` | handset rotated 135° | call control, end segment |
| `i-mic` | rounded capsule + stand arc | mic segment, unmuted |
| `i-mic-off` | `i-mic` + a 45° slash | mic segment, muted |
| `i-chevron-down` | 8px chevron | select, disclosure |
| `i-chevron-right` | 8px chevron | row detail disclosure (rotates 90° when open) |
| `i-caret-up` | small solid-feel triangle at 1.5 stroke | over-budget marker |
| `i-check` | tick | success banner, filled rubric legend |
| `i-alert-triangle` | triangle + bar + dot | warning banner, over-budget legend |
| `i-alert-octagon` | octagon + bar + dot | critical banner, error state |
| `i-info` | circle + bar + dot | info banner, "how latency is measured" |
| `i-x` | 45° cross | dismiss, modal close |
| `i-sun` | disc + 8 rays | theme toggle, light |
| `i-moon` | crescent | theme toggle, dark |
| `i-display` | rounded rectangle + stand | theme toggle, system |
| `i-rows` | three horizontal bars, unequal gaps | density toggle |
| `i-trash` | lid + body + 2 tines | delete session |
| `i-copy` | two offset rounded rectangles | copy transcript |
| `i-tool` | wrench at 45° | tool-call rule in the transcript |
| `i-clock` | circle + hands at 10:02 | elapsed / duration labels |
| `i-notch` | a single 2px vertical bar with a 4px foot | interruption chip in the transcript |

Rules: no icon is ever the sole label for a control — every icon-only button has
`aria-label` plus a `title` tooltip. The `$` in cost labels is **typeset text in
`--font-mono`**, not an icon; currency is a numeral, not a symbol to draw.

---

## 9. Elevation, borders, and focus

### 9.1 Elevation

Elevation is expressed by **surface step and border first, by shadow only for things
that genuinely float over content**. This is what keeps the page from looking like a
pile of floating cards.

| Level | Use | Light | Dark |
|---|---|---|---|
| **E0** | page canvas | `--canvas`, no border, no shadow | same |
| **E1** | panels, cards, tiles, the score card | `--surface` + 1px `--border`, **no shadow** | `--surface` + 1px `--border` |
| **E2** | popover, select menu, sticky app bar once scrolled | `--surface-raised` + 1px `--border` + `--shadow-2` | `--surface-raised` (a *lighter* surface, #232221) + 1px `--border` + `--shadow-2` |
| **E3** | modal, sheet, toast | `--surface-raised` + 1px `--border` + `--shadow-3` | `--surface-raised` + 1px `--border` + `--shadow-3` |

In dark mode a shadow is nearly invisible, so E2 and E3 additionally **step the
surface lighter**. Elevation is legible in both themes because it never depends on
the shadow alone.

The app bar has no shadow at `scrollY === 0` and gains `--shadow-1` at
`[data-scrolled]`, transitioned over `--dur-base`.

### 9.2 Border widths and what each means

| Width | Token | Meaning | Colour |
|---|---|---|---|
| 1px | `--bw-hairline` | division inside a panel: table rows, tile grid lines | `--border-subtle` |
| 1px | `--bw-hairline` | the outer edge of a panel or card | `--border` |
| 1px | `--bw-hairline` | the edge of an **interactive control** — must clear 3:1 | `--border-control` |
| 2px | `--bw-emphasis` | semantic attribution: message role rules, banner left rule, card top rule, over-budget marks, focus ring | semantic hue |
| 3px | `--bw-state` | the call control's voice-state edge — **one place only** | `--voice-current` |

No other border width exists. A 4px rule anywhere is a bug.

### 9.3 Focus

Focus is never removed. `outline: none` without an equivalent replacement is a
review-blocking defect.

```css
:where(a, button, select, input, textarea, summary, dialog, [tabindex]):focus-visible {
  outline: var(--bw-focus) solid var(--focus-ring);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* Inside overflow/clipping containers (table body, tile grid, sticky cells)
   a positive offset is clipped, so the ring goes inward. */
.metrics-table tbody tr:focus-visible,
.tile:focus-visible {
  outline: var(--bw-focus) solid var(--focus-ring);
  outline-offset: -2px;
}

/* On a tinted or same-hue background, add a 1px halo so the ring never
   disappears into what it sits on. */
.on-tint:focus-visible {
  outline: none;
  box-shadow: 0 0 0 1px var(--focus-halo), 0 0 0 3px var(--focus-ring);
}

/* Danger controls focus in their own hue so the ring reinforces consequence. */
.btn--danger:focus-visible { outline-color: var(--critical); }
```

Contrast of the ring against every surface it can appear on:

| Ring on… | Light | Dark |
|---|---|---|
| `--canvas` | **7.04** | **10.06** |
| `--surface` | **7.61** | **9.37** |
| `--surface-inset` | **6.16** | **8.47** |

All far above the 3:1 required by WCAG 1.4.11. The 2px offset means the ring is
separated from a filled button by 2px of page background, so the accent-on-accent
case never arises.

Additional rules:
- `:focus-visible` only — mouse users never see a ring, keyboard users always do.
- A **skip link** is the first focusable element: visually hidden, then on focus
  pinned at `top: var(--space-4); left: var(--space-4)`, `--surface-raised`,
  `--shadow-2`, padding `8px 12px`, with the standard focus ring.
- Focus order follows DOM order; the rail comes after the conversation in the DOM at
  every breakpoint, and CSS grid never reorders focusable content.
- `<dialog>` traps focus and restores it on close.
- The transcript is `role="log" aria-live="polite" aria-relevant="additions"`; the
  metrics rail is `aria-live="off"` and is **not** announced on every update — a
  screen reader user must not have 20 turns of latency numbers read at them. A
  "Summarise metrics" button reads the summary on demand.

### 9.4 Theme toggle

A 3-way segmented control in the app bar: `System` / `Light` / `Dark`, 28px tall,
1px `--border-control`, radius `--radius-sm`, 1px dividers, each segment 32px wide
with a 16px icon (`i-display` / `i-sun` / `i-moon`) and an `aria-label`. The selected
segment gets `background: var(--surface-inset)`, `color: var(--text-primary)`, and a
2px bottom rule in `--accent`; unselected are `--text-tertiary`.
`role="radiogroup"`, arrow-key navigation, `aria-checked`.

Behaviour: `System` removes `data-theme` from `<html>`; the others set
`data-theme="light" | "dark"`. Persist in `localStorage` inside a `try/catch` and
apply in a blocking inline `<script>` in `<head>` to avoid a flash of the wrong
theme.

---

## 10. Implementation contract

What the CSS expects from the DOM. Keeping to this means the stylesheet needs no
JavaScript hooks beyond setting attributes.

| Attribute | On | Values |
|---|---|---|
| `data-theme` | `<html>` | absent (system) · `light` · `dark` |
| `data-voice` | `<html>` | `idle` · `connecting` · `listening` · `thinking` · `speaking` · `interrupted` · `error` |
| `data-density` | `<html>` | `dense` (default) · `comfortable` |
| `data-scrolled` | `.appbar` | present when `scrollY > 0` |
| `data-turn` | `.msg`, `tr` | zero-padded turn index — the join key for the turn spine |
| `data-role` | `.msg` | `agent` · `user` |
| `data-streaming` | `.msg` | present while the agent message is incomplete |
| `data-interrupted` | `.msg` | present permanently once cut off |
| `data-linked` | `tr`, `.msg` | present while its pair is hovered or focused |
| `data-over` | `td`, `.tile` | present when the value exceeds its budget |
| `data-status` | `.tile` | `ok` · `over` · `empty` |
| `--pct` | `td.budget` | inline style, `value / budget * 100`, capped at 140 |

Field-to-component map (`agent/metrics_sink.py` → UI):

| Field | Component | Format |
|---|---|---|
| `turn_index` | turn spine, table col 1 | zero-padded 2 |
| `eou_delay` | table `EOU MS` | `× 1000`, integer |
| `transcription_delay` | table `STT MS` | `× 1000`, integer |
| `llm_ttft` | table `TTFT MS`, tile `LLM TTFT` | `× 1000`, integer |
| `tts_ttfb` | table `TTFB MS`, tile `TTS TTFB` | `× 1000`, integer |
| `e2e_latency` | table `E2E MS` + budget bar, tiles `P95`/`P50` | `× 1000`, integer |
| `cost_usd` | table `COST $`, tile `SESSION COST` | 4dp, `$` prefix |
| `interruptions` | tile, transcript `data-interrupted` | integer |
| `backchannels` | tile, transcript backchannel mark | integer |
| `stt_audio_duration`, `llm_*_tokens`, `tts_characters` | row disclosure | integer |
| `SessionScore.scores.*` | rubric meter | `n/4` |
| `SessionScore.total` | score card hero | `n/20` |
| `status: "unscored"` | score card unscored variant | — |

### Review checklist before this ships

- [ ] Render the page with `filter: grayscale(1)` — every state and every over-budget
      value is still identifiable.
- [ ] Tab through the whole page in both themes — the ring is visible on every stop,
      including table rows and sticky cells.
- [ ] Enable "Reduce motion" at the OS level — the rAF loop stops writing `points`,
      the carrier is gone, and no information is lost.
- [ ] Toggle System / Light / Dark at every breakpoint — no flash, no unstyled frame.
- [ ] Run a live call at 375px and at 1920px — the layout does not jump when the
      state changes, when a message streams in, or when the metrics update.
- [ ] Zoom to 200% — no horizontal scroll on the page body; the table scrolls inside
      its own container.
- [ ] Have someone hold a two-minute conversation while looking at the screen. If
      they report the page as distracting, the calm budget (§6.4) has been violated
      somewhere.
