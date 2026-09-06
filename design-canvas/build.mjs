// Generates the .dc.html artboards. Token values are lifted verbatim from
// ../web/styles.css so the mock and the app cannot drift.
import { writeFileSync } from "node:fs";

const T = {
  light: {
    canvas:"#F7F6F3", surface:"#FFFFFF", sunken:"#F0EEE9", inset:"#EAE7E0",
    borderSubtle:"#E7E4DD", border:"#D8D3C9", borderControl:"#8A8477", borderStrong:"#B5AFA1",
    text:"#1A1815", text2:"#55504A", text3:"#6B665E",
    accent:"#0B5D63", accentSoft:"#E1EFEF", onAccent:"#FFFFFF",
    positive:"#1B6B44", warning:"#7C5300", warningSoft:"#F6EBD3", critical:"#A62121",
    vIdle:"#8A8477", vListen:"#0B5D63", vListenSoft:"#E1EFEF",
    vThink:"#44586E", vThinkSoft:"#E6EAEF",
    vSpeak:"#A2451C", vSpeakSoft:"#F6E7DE", vInt:"#8A3A16",
    meterTrack:"#DFDBD1", shadow:"0 1px 2px rgba(26,24,21,.06)",
    grain:"rgba(26,24,21,.022)",
  },
  dark: {
    canvas:"#121110", surface:"#1A1918", sunken:"#0E0D0C", inset:"#232221",
    borderSubtle:"#2A2826", border:"#383533", borderControl:"#78726C", borderStrong:"#524E4A",
    text:"#F3F1ED", text2:"#B2ABA2", text3:"#948D83",
    accent:"#45C2B9", accentSoft:"#0C2827", onAccent:"#121110",
    positive:"#57BE85", warning:"#E0A93E", warningSoft:"#2B2110", critical:"#F0736A",
    vIdle:"#78726C", vListen:"#45C2B9", vListenSoft:"#0C2827",
    vThink:"#93ADC8", vThinkSoft:"#171E26",
    vSpeak:"#E08A55", vSpeakSoft:"#2D1B10", vInt:"#F0A07A",
    meterTrack:"#333130", shadow:"0 1px 2px rgba(0,0,0,.40)",
    grain:"rgba(255,255,255,.018)",
  },
};

const SANS = `'IBM Plex Sans','Noto Sans Devanagari',ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif`;
const MONO = `'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace`;

/* ---- waveline geometry -------------------------------------------------- */
const env = (i, n) => 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
function points(fn, width, n = 96, mid = 24) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(`${((i * width) / (n - 1)).toFixed(1)},${(mid + fn(i) * env(i, n)).toFixed(2)}`);
  }
  return out.join(" ");
}
const WAVE = {
  flat:   (w) => points(() => 0, w),
  breath: (w) => points((i) => Math.sin(i * 0.42) * 1, w),
  hear:   (w) => points((i) => Math.sin(i * 0.47) * 7 * (0.6 + 0.4 * Math.sin(i * 0.19 + 1)), w),
  speak:  (w) => points((i) => Math.sin(i * 0.55) * 10 * (0.55 + 0.45 * Math.sin(i * 0.13)), w),
};

/* ---- shared fragments --------------------------------------------------- */
const label = (t, c) =>
  `font:600 .6875rem/.875rem ${MONO};letter-spacing:.09em;text-transform:uppercase;color:${c}`;
const eyebrow = (c) =>
  `font:600 .625rem/.75rem ${MONO};letter-spacing:.12em;color:${c}`;

function head(t, extra = "") {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
  <style>
    body { margin:0; font-family:${SANS}; -webkit-font-smoothing:antialiased; }
    a { color:${t.accent}; } a:hover { color:${t.accent}; opacity:.8; }
    * { box-sizing:border-box; }
    .num { font-variant-numeric:tabular-nums slashed-zero; font-feature-settings:"tnum" 1,"zero" 1; }
    ${extra}
  </style>
</helmet>`;
}
const foot = `</x-dc>
</body>
</html>
`;

/* The waveline: the app bar has no border-bottom — this hairline is the rule. */
function waveline(t, state, w) {
  const colour = { idle:t.vIdle, listening:t.vListen, thinking:t.vThink,
                   speaking:t.vSpeak, interrupted:t.vInt }[state];
  const stroke = state === "speaking" ? 2 : state === "idle" ? 1 : 1.5;
  const shape = state === "speaking" ? WAVE.speak(w)
              : state === "listening" ? WAVE.hear(w)
              : WAVE.flat(w);
  const dash = state === "thinking" ? "" : "";
  let extra = "";
  if (state === "idle") {
    extra = `<circle cx="${w/2}" cy="24" r="3" fill="none" stroke="${colour}" stroke-width="1"/>`;
  }
  if (state === "thinking") {
    // A 120px segment of the flat line brightens and travels at a constant
    // rate. Flat reads as "holding"; a wiggle would read as "recording".
    extra = `<defs><linearGradient id="carrier-${state}-${w}" x1="0" x2="1">
      <stop offset="0" stop-color="${colour}" stop-opacity="0"/>
      <stop offset=".5" stop-color="${colour}" stop-opacity="1"/>
      <stop offset="1" stop-color="${colour}" stop-opacity="0"/>
    </linearGradient></defs>
    <rect x="${w*0.42}" y="23" width="120" height="2" fill="url(#carrier-${state}-${w})"/>`;
  }
  if (state === "interrupted") {
    extra = `<rect x="${w*0.55}" y="15" width="2" height="18" fill="${t.vInt}"/>`;
  }
  return `<svg width="${w}" height="48" viewBox="0 0 ${w} 48" style="display:block;margin-top:-24px;position:relative;overflow:visible">
    ${extra}
    <polyline points="${shape}" fill="none" stroke="${colour}" stroke-width="${stroke}"
              stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

const GLYPH = {
  idle:        `<circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.25"/>`,
  listening:   `<circle cx="6" cy="6" r="3.2" fill="currentColor"/>`,
  thinking:    `<circle cx="6" cy="6" r="2" fill="currentColor"/><path d="M6 1.4a4.6 4.6 0 1 1-3.25 1.35" fill="none" stroke="currentColor" stroke-width="1.25"/>`,
  speaking:    `<circle cx="4" cy="6" r="2" fill="currentColor"/><path d="M7.6 3.6a3.4 3.4 0 0 1 0 4.8M9.6 2.2a5.4 5.4 0 0 1 0 7.6" fill="none" stroke="currentColor" stroke-width="1.25"/>`,
  interrupted: `<circle cx="6" cy="6" r="3.2" fill="currentColor"/><path d="M6 1v10" stroke="currentColor" stroke-width="1.25"/>`,
};

function pill(t, state) {
  const map = {
    idle:        [t.vIdle, t.sunken, t.text2, "IDLE"],
    listening:   [t.vListen, t.vListenSoft, t.vListen, "LISTENING"],
    thinking:    [t.vThink, t.vThinkSoft, t.vThink, "THINKING"],
    speaking:    [t.vSpeak, t.vSpeakSoft, t.vSpeak, "SPEAKING"],
    interrupted: [t.vInt, t.vSpeakSoft, t.vInt, "INTERRUPTED"],
  };
  const [bd, bg, fg, txt] = map[state];
  return `<span style="display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px 0 8px;min-width:11ch;border:1px solid ${bd};border-radius:999px;background:${bg};${label("", fg)};color:${fg}">
    <svg width="12" height="12" viewBox="0 0 12 12" style="flex:none">${GLYPH[state]}</svg>
    <span style="font:600 .6875rem/.875rem ${MONO};letter-spacing:.09em">${txt}</span>
  </span>`;
}

function appbar(t, state, w) {
  return `<div style="height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 32px;background:${t.canvas}">
    <div style="display:flex;align-items:center;gap:10px">
      <svg width="18" height="18" viewBox="0 0 16 16" style="color:${{idle:t.vIdle,listening:t.vListen,thinking:t.vThink,speaking:t.vSpeak,interrupted:t.vInt}[state]}">
        <path d="M2 8h1.6M6 3.6v8.8M9.4 5.6v4.8M12.8 8h1.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <span style="font:600 .9375rem/1.375rem ${SANS};letter-spacing:-.006em;color:${t.text}">Interview Coach</span>
    </div>
    <div style="display:flex;align-items:center;gap:8px">
      ${pill(t, state)}
      <span style="width:32px;height:32px;display:grid;place-items:center;color:${t.text3}">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.5 12a6.2 6.2 0 1 1 11 0"/><path d="m8 9 2.6-2.6"/><circle cx="8" cy="9.4" r=".9" fill="currentColor" stroke="none"/></svg>
      </span>
      <span style="width:32px;height:32px;display:grid;place-items:center;color:${t.text3}">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.75 5.75 0 1 0 6.8 6.8Z"/></svg>
      </span>
    </div>
  </div>
  ${waveline(t, state, w)}`;
}

/* A message bubble. The turn index is the spine's first appearance. */
function msg(t, role, turn, text, opts = {}) {
  const agent = role === "agent";
  const border = agent
    ? `border:1px solid ${t.borderSubtle};border-left:2px ${opts.interrupted ? "dashed" : "solid"} ${opts.interrupted ? t.vInt : t.vSpeak};border-top-left-radius:2px`
    : `border:1px solid transparent;border-right:2px solid ${t.accent};border-top-right-radius:2px`;
  const bg = agent ? t.surface : t.accentSoft;
  const cut = opts.interrupted
    ? `<span style="display:inline-block;width:2px;height:14px;margin-left:4px;vertical-align:text-bottom;background:${t.vInt}"></span>`
    : "";
  const caret = opts.streaming
    ? `<span style="display:inline-block;width:2px;height:1em;margin-left:2px;vertical-align:text-bottom;background:${t.vSpeak}"></span>`
    : "";
  const chip = opts.interrupted
    ? `<div style="display:inline-flex;align-items:center;gap:6px;margin-top:6px;${label("", t.vInt)}">
         <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1v10" stroke="${t.vInt}" stroke-width="2"/></svg>
         INTERRUPTED · 0.42 S IN</div>`
    : "";
  // The backchannel mark: it heard you, classified it, and kept talking.
  const bc = opts.backchannel
    ? `<span title="backchannel — did not interrupt" style="position:absolute;left:-22px;top:14px;width:8px;height:8px;border:1px solid ${t.vListen};border-radius:999px"></span>`
    : "";
  return `<li style="position:relative;align-self:${agent ? "start" : "end"};max-width:62ch;padding:10px 14px;border-radius:8px;background:${bg};${border}">
    ${bc}
    <p style="display:flex;align-items:baseline;gap:8px;margin:0 0 4px">
      <span style="${eyebrow(t.text3)}">${turn}</span>
      <span style="${label("", t.text3)}">${agent ? "Coach" : "You"}</span>
    </p>
    <p style="margin:0;font:400 .9375rem/1.5rem ${SANS};color:${opts.streaming ? t.text2 : t.text};overflow-wrap:anywhere">${text}${cut}${caret}</p>
    ${chip}
  </li>`;
}

/* A tool call is a system event, so it is typeset as system chrome. */
function toolRule(t, text) {
  return `<li style="display:flex;align-items:center;gap:10px;margin:2px 0">
    <span style="flex:1;height:1px;background:${t.borderSubtle}"></span>
    <span style="display:inline-flex;align-items:center;gap:6px;${label("", t.text3)}">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="7.2" cy="7.2" r="4.45"/><path d="m10.5 10.5 2.75 2.75"/></svg>
      ${text}</span>
    <span style="flex:1;height:1px;background:${t.borderSubtle}"></span>
  </li>`;
}

function chip(t, name, value, hint, over = false) {
  const vc = over ? t.warning : t.text;
  const mark = over ? `<span style="font-size:.7em">▲ </span>` : "";
  return `<div style="background:${t.surface};padding:12px 16px;display:grid;gap:4px">
    <span style="${label("", t.text3)}">${name}</span>
    <span class="num" style="font:500 1.375rem/1.625rem ${MONO};color:${vc};${over ? `font-weight:600;box-shadow:inset 0 -2px 0 0 ${t.warning}` : ""}">${mark}${value}</span>
    <span style="font:500 .75rem/1rem ${SANS};color:${t.text2};text-wrap:pretty">${hint}</span>
  </div>`;
}

function tile(t, name, value, over = false, spark = null) {
  const vc = over ? t.warning : t.text;
  const mark = over ? `<span style="font-size:.7em">▲ </span>` : "";
  return `<div style="background:${t.surface};padding:12px 16px;display:grid;gap:4px">
    <span style="${label("", t.text3)}">${name}</span>
    <span class="num" style="font:500 1.375rem/1.625rem ${MONO};color:${vc};${over ? `font-weight:600;box-shadow:inset 0 -2px 0 0 ${t.warning}` : ""}">${mark}${value}</span>
    ${spark || ""}
  </div>`;
}

/* Sparkline: shape carries the trend, the budget line carries the verdict. */
function sparkline(t, values, budget, w = 108, h = 22) {
  const max = Math.max(...values, budget) * 1.12;
  const pts = values.map((v, i) =>
    `${((i * w) / (values.length - 1)).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`).join(" ");
  const by = (h - (budget / max) * h).toFixed(1);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="margin-top:2px;overflow:visible">
    <line x1="0" y1="${by}" x2="${w}" y2="${by}" stroke="${t.borderStrong}" stroke-width="1" stroke-dasharray="2 3"/>
    <polyline points="${pts}" fill="none" stroke="${t.borderStrong}" stroke-width="1.25" stroke-linejoin="round"/>
  </svg>`;
}

/* The turn ribbon: every turn as one bar, notched where a barge-in landed.
   Density becomes navigation rather than a spreadsheet. */
function ribbon(t, turns, budget) {
  const bars = turns.map((v) => {
    const over = v.e2e > budget;
    const hgt = Math.max(4, Math.min(30, (v.e2e / (budget * 1.5)) * 30));
    const notch = v.interrupted
      ? `<span style="position:absolute;left:50%;top:-5px;width:2px;height:6px;background:${t.vInt};transform:translateX(-50%)"></span>`
      : "";
    const bcm = v.backchannel
      ? `<span style="position:absolute;left:50%;bottom:-7px;width:4px;height:4px;border:1px solid ${t.vListen};border-radius:999px;transform:translateX(-50%)"></span>`
      : "";
    return `<span style="position:relative;flex:1;display:flex;align-items:flex-end;height:30px">
      ${notch}
      <span style="width:100%;height:${hgt.toFixed(0)}px;background:${over ? t.warning : t.accent};opacity:${over ? 1 : .55};border-radius:1px"></span>
      ${bcm}</span>`;
  }).join("");
  const by = (30 - (budget / (budget * 1.5)) * 30).toFixed(0);
  return `<div style="background:${t.surface};border:1px solid ${t.border};border-radius:8px;padding:14px 16px 18px">
    <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:12px">
      <span style="${label("", t.text3)}">Turn ribbon</span>
      <span style="${eyebrow(t.text3)}">12 TURNS</span>
    </div>
    <div style="position:relative">
      <span style="position:absolute;left:0;right:0;top:${by}px;height:1px;background:${t.borderStrong};opacity:.6"></span>
      <div style="display:flex;gap:3px;align-items:flex-end">${bars}</div>
    </div>
    <p style="margin:14px 0 0;font:500 .75rem/1rem ${SANS};color:${t.text2}">Each bar is one turn. The line is the 800 ms budget; a notch above is an interruption, a circle below a backchannel it correctly ignored.</p>
  </div>`;
}

export { T, SANS, MONO, WAVE, head, foot, waveline, pill, appbar, msg, toolRule,
         chip, tile, sparkline, ribbon, label, eyebrow, GLYPH, writeFileSync };
