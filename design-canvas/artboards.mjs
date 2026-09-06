import * as B from "./build.mjs";
import { writeFileSync } from "node:fs";
const { T, SANS, MONO, head, foot, appbar, msg, toolRule, chip, tile,
        sparkline, ribbon, label, eyebrow, pill, waveline } = B;

const LAT = [0.714,0.690,0.682,0.799,0.831,0.729,0.746,1.253,0.791,0.832,0.788,0.766];
const RIB = LAT.map((e,i)=>({e2e:e, interrupted:[3,7,9].includes(i), backchannel:[1,2,4,5,8,10].includes(i)}));

const panel = (t, title, right, body, pad = "0") =>
  `<section style="background:${t.surface};border:1px solid ${t.border};border-radius:8px;min-width:0">
     <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid ${t.borderSubtle}">
       <h2 style="margin:0;${label("", t.text3)}">${title}</h2>${right || ""}
     </div>
     <div style="padding:${pad}">${body}</div>
   </section>`;

const btn = (t, text, kind = "default") => {
  const s = {
    default: `background:${t.surface};color:${t.text};border:1px solid ${t.borderControl}`,
    quiet:   `background:transparent;color:${t.text2};border:1px solid transparent`,
    danger:  `background:${t.surface};color:${t.critical};border:1px solid ${t.borderControl}`,
  }[kind];
  return `<span style="display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 16px;border-radius:5px;font:500 .875rem/1.25rem ${SANS};${s}">${text}</span>`;
};

const call = (t, live) =>
  `<span style="display:inline-flex;align-items:center;gap:12px;height:48px;padding:0 24px;border-radius:5px;border-left:3px solid ${live ? t.vSpeak : t.vIdle};background:${live ? t.critical : t.accent};color:${live ? "#FFFFFF" : t.onAccent};font:500 .875rem/1.25rem ${SANS}">
     <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
       ${live ? `<path d="M2.6 9.2a11 11 0 0 1 10.8 0"/><path d="M4.9 8.2 4 10.6a1 1 0 0 1-1.3.6l-1-.4a1 1 0 0 1-.5-1.3l.4-.8M11.1 8.2l.9 2.4a1 1 0 0 0 1.3.6l1-.4a1 1 0 0 0 .5-1.3l-.4-.8"/>`
             : `<path d="M8 1.75a2 2 0 0 1 2 2v4.5a2 2 0 1 1-4 0v-4.5a2 2 0 0 1 2-2Z"/><path d="M3.25 7.5a4.75 4.75 0 0 0 9.5 0M8 12.25v2"/>`}
     </svg>${live ? "End call" : "Start call"}</span>`;

const select = (t, lbl, val, w) =>
  `<div style="display:flex;flex-direction:column;gap:6px;${w ? `width:${w}px` : "flex:1"}">
     <span style="${label("", t.text3)}">${lbl}</span>
     <span style="display:flex;align-items:center;justify-content:space-between;height:36px;padding:0 12px;border:1px solid ${t.borderControl};border-radius:5px;background:${t.surface};font:500 .875rem/1.25rem ${SANS};color:${t.text}">
       ${val}<svg width="9" height="6" viewBox="0 0 9 6"><path d="M1 1l3.5 3.5L8 1" fill="none" stroke="${t.text2}" stroke-width="1.4" stroke-linecap="round"/></svg>
     </span></div>`;

const ledger = (t, cols, cells) =>
  `<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:1px;background:${t.borderSubtle};border:1px solid ${t.border};border-radius:8px;overflow:hidden">${cells}</div>`;

function table(t, rows) {
  const th = ["#","EOU MS","STT MS","TTFT MS","TTFB MS","E2E MS","COST $"];
  const head_ = th.map((h,i)=>`<th style="height:30px;padding:0 10px;text-align:${i?"right":"left"};${label("", t.text3)};background:${t.surface};border-bottom:1px solid ${t.border};white-space:nowrap">${h}</th>`).join("");
  const body = rows.map((r) => {
    const over = r.e2e > 800;
    const pct = Math.min(140, (r.e2e/800)*100);
    const frac = (pct/140*100).toFixed(1);
    const fill = over ? t.warningSoft : t.accentSoft;
    const budget = `background-image:linear-gradient(to right,transparent 0 71.43%,${t.borderStrong} 71.43%,${t.borderStrong} calc(71.43% + 1px),transparent calc(71.43% + 1px)),linear-gradient(to right,${fill} 0 ${frac}%,transparent ${frac}%);background-repeat:no-repeat`;
    const td = (v, extra="") => `<td style="height:32px;padding:0 10px;text-align:right;border-bottom:1px solid ${t.borderSubtle};font:400 .75rem/1rem ${MONO};color:${t.text};${extra}">${v}</td>`;
    return `<tr>
      <td style="height:32px;padding:0 10px;border-bottom:1px solid ${t.borderSubtle};${eyebrow(t.text3)};background:${t.surface}">${String(r.i).padStart(2,"0")}</td>
      ${td(r.eou)}${td(r.stt)}${td(r.ttft)}${td(r.ttfb)}
      ${td(`${over?'<span style="font-size:.8em">▲ </span>':""}${r.e2e}`, `${budget};${over?`color:${t.warning};font-weight:600;box-shadow:inset 0 -2px 0 0 ${t.warning}`:""}`)}
      ${td(r.cost)}
    </tr>`;
  }).join("");
  return `<div style="overflow:hidden;border:1px solid ${t.border};border-radius:8px;background:${t.surface}">
    <table style="width:100%;border-collapse:separate;border-spacing:0" class="num"><thead><tr>${head_}</tr></thead><tbody>${body}</tbody></table></div>`;
}
const ROWS = [
  {i:0,eou:259,stt:68,ttft:294,ttfb:94,e2e:714,cost:"0.0040"},
  {i:1,eou:264,stt:63,ttft:271,ttfb:92,e2e:690,cost:"0.0046"},
  {i:2,eou:228,stt:65,ttft:258,ttfb:131,e2e:682,cost:"0.0052"},
  {i:3,eou:247,stt:91,ttft:342,ttfb:119,e2e:799,cost:"0.0058"},
  {i:4,eou:337,stt:62,ttft:327,ttfb:105,e2e:831,cost:"0.0064"},
  {i:5,eou:234,stt:75,ttft:321,ttfb:99,e2e:729,cost:"0.0070"},
  {i:6,eou:297,stt:79,ttft:278,ttfb:93,e2e:746,cost:"0.0076"},
  {i:7,eou:245,stt:94,ttft:808,ttfb:106,e2e:1253,cost:"0.0082"},
];

/* ============================ Main — live call, dark ===================== */
{
  const t = T.dark, W = 1440;
  const rail = `
    ${ledger(t,1, chip(t,"Reply gap","832 ms","p95 over 12 turns so far. Target under 800 ms",true)
      + chip(t,"Turn-taking","3 / 9","You interrupted 3 times and the coach stopped. You backchannelled 9 times and it kept going.")
      + chip(t,"Cost","$0.1032","Model and transport spend. Target under $0.18"))}
    ${ribbon(t, RIB, 0.8)}
    ${ledger(t,2, tile(t,"p95 e2e","832 ms",true, sparkline(t,LAT,0.8))
      + tile(t,"p50 e2e","766 ms",false, sparkline(t,LAT,0.8))
      + tile(t,"LLM TTFT","261 ms") + tile(t,"TTS TTFB","113 ms"))}`;

  const transcript = `<ol style="display:flex;flex-direction:column;gap:12px;margin:0;padding:0;list-style:none">
    ${msg(t,"user","01","LRU, and at a hundred to one skew I would expect ninety-five percent on a working set of the top million codes.",{backchannel:false})}
    ${msg(t,"agent","01","Better. Now size the database for a year of writes — and tell me what breaks when the cache is cold.")}
    ${msg(t,"user","02","A hundred writes a second is about three billion a year. At forty bytes a row that's a hundred and twenty gigabytes.")}
    ${toolRule(t,"TOOL · lookup_concept · 380 MS")}
    ${msg(t,"agent","02","That's the number I wanted. One more: consistent hashing buys you",{interrupted:true})}
    ${msg(t,"user","03","Wait — before that, does the write path go through the same cache?")}
    ${msg(t,"agent","03","Good interruption. No, and that asymmetry is exactly where",{streaming:true, backchannel:true})}
  </ol>`;

  writeFileSync("Main.dc.html", head(t) + `
<div style="width:${W}px;min-height:900px;background:${t.canvas};color:${t.text};display:flex;flex-direction:column">
  ${appbar(t,"speaking",W)}
  <div style="padding:32px 32px 40px;display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:20px;align-items:start;margin-top:24px">
    <div style="display:grid;gap:16px;min-width:0">
      <div style="display:flex;align-items:center;gap:16px">
        ${call(t,true)}
        ${btn(t,`<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M10 3.75a2 2 0 0 0-4 0v1M6 7v1.25a2 2 0 0 0 3.4 1.43"/><path d="M3.25 7.5a4.75 4.75 0 0 0 7.06 4.15M8 12.25v2"/><path d="M2 2l12 12"/></svg> Mute`,"quiet")}
        <span class="num" style="font:500 .875rem/1.25rem ${MONO};color:${t.text2}">04:12</span>
      </div>
      ${panel(t,"Transcript",`<span style="${label("", t.text3)}">Q · URL SHORTENER</span>`, transcript, "20px 20px 20px 44px")}
    </div>
    <aside style="display:grid;gap:16px;min-width:0">
      <div style="display:flex;align-items:baseline;justify-content:space-between">
        <h2 style="margin:0;${label("", t.text3)}">Session</h2>
        <span style="${label("", t.text3)}">Live</span>
      </div>
      ${rail}
    </aside>
  </div>
</div>` + foot);
}

/* ============================ PreCall — light ============================ */
{
  const t = T.light, W = 1440;
  writeFileSync("PreCall.dc.html", head(t) + `
<div style="width:${W}px;min-height:820px;background:${t.canvas};color:${t.text};display:flex;flex-direction:column">
  ${appbar(t,"idle",W)}
  <div style="padding:56px 32px 40px;margin-top:24px;max-width:1120px">
    <h1 style="margin:0;max-width:20ch;font:600 2.75rem/3rem ${SANS};letter-spacing:-.028em;text-wrap:pretty">System-design practice with a voice that pushes back.</h1>
    <p style="margin:20px 0 0;max-width:58ch;font:400 1.0625rem/1.75rem ${SANS};color:${t.text2};text-wrap:pretty">
      A senior engineer asks you one system-design question, then listens. Talk for as long as you need.
      Interrupt it — it can tell the difference between “mhm” and a real interjection.
      At the end you get a scored breakdown and the transcript.</p>

    <div style="display:flex;align-items:flex-end;gap:12px;margin-top:40px;max-width:920px">
      ${select(t,"Language","English",160)}
      ${select(t,"Question","Random question")}
      ${call(t,false)}
    </div>
    <p style="margin:10px 0 0;font:500 .75rem/1rem ${SANS};color:${t.text3}">Your microphone turns on when the call starts.</p>

    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:28px;padding-bottom:24px;border-bottom:1px solid ${t.borderSubtle};max-width:920px">
      ${btn(t,`<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.9 8a5.1 5.1 0 1 0 1.6-3.7L2.6 6.1"/><path d="M2.5 3v3.2h3.2M8 5.3V8l2 1.4"/></svg> See a completed run`,"quiet")}
      <span style="display:inline-flex;align-items:center;gap:10px">
        <span style="width:34px;height:20px;border-radius:999px;background:${t.sunken};border:1px solid ${t.borderControl};display:flex;align-items:center;padding:2px">
          <span style="width:14px;height:14px;border-radius:999px;background:${t.text2}"></span></span>
        <span style="font:500 .875rem/1.25rem ${SANS};color:${t.text2}">Engineer view</span></span>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:32px;margin-top:36px;max-width:920px">
      ${[["Turn-taking that survives a real conversation","Semantic end-of-turn detection, not a silence timer. Thinking mid-sentence does not hand over the floor."],
         ["Interruption that knows the difference","“Mhm” does not stop it. “Wait, that's wrong” does. Both counted separately, both shown."],
         ["Numbers you can audit","Every latency is read from framework metrics, per turn, against an 800 ms budget."]]
        .map(([h,p])=>`<div>
          <div style="width:24px;height:2px;background:${t.accent};margin-bottom:14px"></div>
          <h3 style="margin:0 0 6px;font:600 .9375rem/1.375rem ${SANS};color:${t.text}">${h}</h3>
          <p style="margin:0;font:400 .8125rem/1.25rem ${SANS};color:${t.text2};text-wrap:pretty">${p}</p></div>`).join("")}
    </div>
  </div>
</div>` + foot);
}

/* ============================ Scored — light ============================= */
{
  const t = T.light, W = 1440;
  const dims = [["Requirements clarification",4],["High-level design",3],["Data modeling",2],
                ["Scaling and tradeoffs",3],["Communication",2]];
  const rubric = dims.map(([n,v])=>`
    <div style="display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:12px;min-height:28px">
      <span style="font:600 .9375rem/1.375rem ${SANS}">${n}</span>
      <span style="display:flex;gap:3px">${[0,1,2,3].map(i=>
        `<span style="width:26px;height:8px;border-radius:3px;background:${i<v?t.accent:t.meterTrack};${i<v?"":`box-shadow:inset 0 0 0 1px ${t.border}`}"></span>`).join("")}</span>
      <span class="num" style="font:500 .875rem/1.25rem ${MONO};min-width:34px;text-align:right">${v}<span style="color:${t.text3}">/4</span></span>
    </div>`).join("");
  const totalMeter = Array.from({length:20},(_,i)=>
    `<span style="width:3px;height:10px;background:${i<14?t.accent:t.meterTrack};border-radius:1px"></span>`).join("");

  writeFileSync("Scored.dc.html", head(t) + `
<div style="width:${W}px;min-height:1000px;background:${t.canvas};color:${t.text};display:flex;flex-direction:column">
  ${appbar(t,"idle",W)}
  <div style="padding:32px;margin-top:24px;display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:20px;align-items:start">
    <section style="background:${t.surface};border:1px solid ${t.border};border-top:2px solid ${t.accent};border-radius:8px;padding:24px 26px;box-shadow:${t.shadow}">
      <p style="margin:0;${label("", t.text3)}">Your session</p>
      <div style="display:flex;align-items:baseline;gap:16px;flex-wrap:wrap;margin-top:12px">
        <span class="num" style="font:500 2.75rem/2.875rem ${MONO};letter-spacing:-.02em">14</span>
        <span class="num" style="font:500 1.375rem/1.625rem ${MONO};color:${t.text3}">/20</span>
        <span style="${label("", t.positive)};padding:4px 12px;border-radius:3px;border:1px solid ${t.positive}">STRONG</span>
      </div>
      <div style="display:flex;gap:2px;align-items:flex-end;margin-top:14px;position:relative;width:98px">
        ${totalMeter}
        <span style="position:absolute;left:70px;top:-11px;width:1px;height:24px;background:${t.text3}"></span>
        <span style="position:absolute;left:74px;top:-14px;${eyebrow(t.text3)}">TARGET</span>
      </div>
      <p style="margin:22px 0 0;font:500 .75rem/1rem ${SANS};color:${t.text2}">url_shortener · 14 of 20 · 5m 12s · en</p>

      <section style="margin-top:28px;max-width:68ch">
        <h3 style="margin:0 0 12px;${label("", t.text3)}">What worked</h3>
        ${["Asked for the read/write ratio before designing anything.","Sized the database from first principles once pushed."]
          .map(s=>`<div style="display:flex;gap:10px;margin-bottom:8px"><span style="width:4px;height:4px;margin-top:10px;flex:none;background:${t.positive}"></span><span style="font:400 .9375rem/1.5rem ${SANS}">${s}</span></div>`).join("")}
      </section>

      <section style="margin-top:28px;max-width:68ch">
        <h3 style="margin:0 0 12px;${label("", t.text3)}">How it scored</h3>
        <div style="display:grid;gap:8px">${rubric}</div>
        <p style="margin:14px 0 0;font:500 .75rem/1rem ${SANS};color:${t.text3};text-wrap:pretty">0 absent · 1 named but not reasoned · 2 reasoned without numbers · 3 reasoned with numbers · 4 reasoned with numbers and an explicit tradeoff</p>
      </section>

      <section style="margin-top:28px;max-width:68ch">
        <h3 style="margin:0 0 12px;${label("", t.text3)}">Where to go deeper</h3>
        ${["Never named a failure mode for the cache tier.","No discussion of key generation or collisions."]
          .map(s=>`<div style="display:flex;gap:10px;margin-bottom:8px"><span style="width:4px;height:4px;margin-top:10px;flex:none;background:${t.warning}"></span><span style="font:400 .9375rem/1.5rem ${SANS}">${s}</span></div>`).join("")}
      </section>

      <section style="margin-top:28px;max-width:68ch">
        <h3 style="margin:0 0 12px;${label("", t.text3)}">Moments to tighten</h3>
        <div style="border-left:2px solid ${t.vSpeak};padding-left:14px">
          <p style="margin:0;font:italic 400 .9375rem/1.5rem ${SANS}">“We'd just cache it and reads get fast.”</p>
          <p style="margin:4px 0 0;font:400 .8125rem/1.25rem ${SANS};color:${t.text2}">No eviction policy and no hit rate until pushed twice.</p>
          <span style="display:inline-flex;align-items:center;gap:6px;margin-top:8px;font:500 .875rem/1.25rem ${SANS};color:${t.accent}">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="7.2" cy="7.2" r="4.45"/><path d="m10.5 10.5 2.75 2.75"/></svg>
            Find in transcript</span>
        </div>
      </section>

      <div style="margin-top:24px;background:${t.accentSoft};border-radius:5px;padding:14px 16px">
        <span style="display:block;${label("", t.accent)};margin-bottom:6px">Next drill</span>
        <span style="font:400 .9375rem/1.5rem ${SANS}">Capacity estimation for a 10k RPS read path, including what happens when the cache is cold.</span>
      </div>
    </section>

    <aside style="display:grid;gap:16px;min-width:0">
      <div style="display:flex;align-items:baseline;justify-content:space-between">
        <h2 style="margin:0;${label("", t.text3)}">Session</h2><span style="${label("", t.text3)}">Final</span>
      </div>
      ${ledger(t,2, tile(t,"p95 e2e","832 ms",true,sparkline(t,LAT,0.8)) + tile(t,"p50 e2e","766 ms",false,sparkline(t,LAT,0.8))
        + tile(t,"LLM TTFT","261 ms") + tile(t,"TTS TTFB","113 ms")
        + tile(t,"Interruptions","3") + tile(t,"Backchannels","9"))}
      ${ribbon(t, RIB, 0.8)}
      <div>
        <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px">
          <h3 style="margin:0;${label("", t.text3)}">Per turn</h3>
          <span style="font:500 .75rem/1rem ${SANS};color:${t.text2}">Copy as CSV</span>
        </div>
        ${table(t, ROWS)}
      </div>
    </aside>
  </div>
</div>` + foot);
}

/* ============================ VoiceStates sheet ========================== */
{
  const t = T.light, W = 1240;
  const states = [
    ["idle","Before a call, and after it ends. A perfectly straight line, zero amplitude, one hollow origin mark. No motion at all — this is the resting rule of the page."],
    ["listening","The mic is open. Amplitude follows your voice up to ±7px; when you go quiet it settles to a ±1px, four-second breath — the only ambient loop in the product."],
    ["thinking","The line stays flat and a bright segment travels it at a constant rate. A wiggle would read as “recording”, a spinner as “stalled”. Flat reads as holding."],
    ["speaking","The coach has the floor. Amplitude from its real output analyser, and the only state drawn at 2px — so who is talking is legible from stroke weight alone."],
    ["interrupted","A one-shot, 260ms: amplitude collapses, a notch is stamped where the audio was cut, then it becomes listening. The transcript keeps the durable record."],
  ];
  writeFileSync("VoiceStates.dc.html", head(t) + `
<div style="width:${W}px;min-height:880px;background:${t.canvas};color:${t.text};padding:40px 44px">
  <p style="margin:0;${label("", t.text3)}">The waveline</p>
  <h1 style="margin:8px 0 0;font:600 1.75rem/2.125rem ${SANS};letter-spacing:-.02em">Five states, read at a glance, while you are talking</h1>
  <p style="margin:12px 0 0;max-width:76ch;font:400 .9375rem/1.5rem ${SANS};color:${t.text2};text-wrap:pretty">
    The app bar has no bottom border. This hairline sits in its place and <em>is</em> the voice indicator.
    Only three things on the page ever react to voice state — this line, the status pill, and the call button's
    left edge. Every surface, panel and number is colour-locked, so the page stays readable while it changes.</p>

  <div style="display:grid;gap:1px;background:${t.borderSubtle};border:1px solid ${t.border};border-radius:8px;overflow:hidden;margin-top:32px">
    ${states.map(([s,desc])=>`
      <div style="background:${t.surface};display:grid;grid-template-columns:150px minmax(0,1fr) 300px;gap:28px;align-items:center;padding:22px 24px">
        ${pill(t,s)}
        <div style="height:48px;display:flex;align-items:center;overflow:hidden">${waveline(t,s,620)}</div>
        <p style="margin:0;font:400 .8125rem/1.25rem ${SANS};color:${t.text2};text-wrap:pretty">${desc}</p>
      </div>`).join("")}
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:28px">
    <div style="background:${t.surface};border:1px solid ${t.border};border-radius:8px;padding:20px 22px">
      <p style="margin:0 0 10px;${label("", t.text3)}">The backchannel mark</p>
      <div style="display:flex;align-items:center;gap:16px;margin:16px 0">
        <div style="flex:1;position:relative;height:40px;display:flex;align-items:center">${waveline(t,"speaking",280)}
          <span style="position:absolute;left:150px;top:28px;width:8px;height:8px;border:1px solid ${t.vListen};border-radius:999px"></span></div>
      </div>
      <p style="margin:0;font:400 .8125rem/1.25rem ${SANS};color:${t.text2};text-wrap:pretty">
        You said “mhm”. It heard you, classified it as a backchannel, and correctly kept talking.
        The waveform is unbroken and a four-pixel circle sits below it. This is the product's
        central claim rendered as a mark — and it costs four pixels.</p>
    </div>
    <div style="background:${t.surface};border:1px solid ${t.border};border-radius:8px;padding:20px 22px">
      <p style="margin:0 0 10px;${label("", t.text3)}">The interruption record</p>
      <ol style="list-style:none;margin:16px 0 0;padding:0">
        ${msg(t,"agent","02","That's the number I wanted. One more: consistent hashing buys you",{interrupted:true})}
      </ol>
      <p style="margin:14px 0 0;font:400 .8125rem/1.25rem ${SANS};color:${t.text2};text-wrap:pretty">
        The waveline cue is transient; this is permanent. Four channels carry it — a dashed rule,
        a cut mark where the audio stopped, a labelled chip, and colour last. Text that was never
        spoken is not rendered; there are no ghost words.</p>
    </div>
  </div>
</div>` + foot);
}

/* ============================ Mobile — live, light ====================== */
{
  const t = T.light, W = 390;
  writeFileSync("Mobile.dc.html", head(t) + `
<div style="width:${W}px;height:844px;background:${t.canvas};color:${t.text};display:flex;flex-direction:column;overflow:hidden">
  <div style="height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:${t.canvas}">
    <div style="display:flex;align-items:center;gap:8px">
      <svg width="16" height="16" viewBox="0 0 16 16" style="color:${t.vListen}"><path d="M2 8h1.6M6 3.6v8.8M9.4 5.6v4.8M12.8 8h1.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      <span style="font:600 .9375rem/1.375rem ${SANS}">Interview Coach</span>
    </div>
    ${pill(t,"listening")}
  </div>
  ${waveline(t,"listening",W)}
  <div style="padding:28px 16px 0;margin-top:20px;flex:1;display:flex;flex-direction:column;gap:14px;min-height:0">
    <div style="display:flex;align-items:baseline;justify-content:space-between">
      <span style="${label("", t.text3)}">Transcript</span>
      <span class="num" style="font:500 .875rem/1.25rem ${MONO};color:${t.text2}">04:12</span>
    </div>
    <ol style="display:flex;flex-direction:column;gap:12px;margin:0;padding:0;list-style:none;flex:1;min-height:0;overflow:hidden">
      ${msg(t,"agent","01","Better. Now size the database for a year of writes.")}
      ${msg(t,"user","02","A hundred writes a second is about three billion a year. At forty bytes a row that's a hundred and twenty gigabytes.")}
      ${msg(t,"agent","02","That's the number I wanted. What happens when the cache is cold?")}
    </ol>
    ${ledger(t,1, chip(t,"Reply gap","832 ms","Target under 800 ms",true))}
  </div>
  <div style="height:76px;display:flex;align-items:center;gap:12px;padding:0 16px;background:${t.canvas};border-top:1px solid ${t.border}">
    <span style="flex:1">${call(t,true)}</span>
    <span style="width:48px;height:48px;display:grid;place-items:center;border:1px solid ${t.borderControl};border-radius:5px;color:${t.text2}">
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M10 3.75a2 2 0 0 0-4 0v1M6 7v1.25a2 2 0 0 0 3.4 1.43"/><path d="M3.25 7.5a4.75 4.75 0 0 0 7.06 4.15M8 12.25v2"/><path d="M2 2l12 12"/></svg></span>
  </div>
</div>` + foot);
}

/* ============================ Mobile scored — dark ====================== */
{
  const t = T.dark, W = 390;
  const dims = [["Requirements clarification",4],["High-level design",3],["Data modeling",2],
                ["Scaling and tradeoffs",3],["Communication",2]];
  writeFileSync("MobileScored.dc.html", head(t) + `
<div style="width:${W}px;height:844px;background:${t.canvas};color:${t.text};display:flex;flex-direction:column;overflow:hidden">
  <div style="height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 16px">
    <div style="display:flex;align-items:center;gap:8px">
      <svg width="16" height="16" viewBox="0 0 16 16" style="color:${t.vIdle}"><path d="M2 8h1.6M6 3.6v8.8M9.4 5.6v4.8M12.8 8h1.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      <span style="font:600 .9375rem/1.375rem ${SANS}">Interview Coach</span></div>
    ${pill(t,"idle")}
  </div>
  ${waveline(t,"idle",W)}
  <div style="padding:24px 16px;margin-top:20px;display:flex;flex-direction:column;gap:16px;overflow:hidden">
    <section style="background:${t.surface};border:1px solid ${t.border};border-top:2px solid ${t.accent};border-radius:8px;padding:20px">
      <p style="margin:0;${label("", t.text3)}">Your session</p>
      <div style="display:flex;align-items:baseline;gap:12px;margin-top:10px">
        <span class="num" style="font:500 2.125rem/2.25rem ${MONO}">14</span>
        <span class="num" style="font:500 1.125rem/1.5rem ${MONO};color:${t.text3}">/20</span>
        <span style="${label("", t.positive)};padding:3px 10px;border-radius:3px;border:1px solid ${t.positive}">STRONG</span>
      </div>
      <p style="margin:14px 0 0;font:500 .75rem/1rem ${SANS};color:${t.text2}">url_shortener · 5m 12s · en</p>
      <div style="display:grid;gap:8px;margin-top:20px">
        ${dims.map(([n,v])=>`<div style="display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:10px">
          <span style="font:600 .8125rem/1.25rem ${SANS}">${n}</span>
          <span style="display:flex;gap:3px">${[0,1,2,3].map(i=>`<span style="width:18px;height:8px;border-radius:3px;background:${i<v?t.accent:t.meterTrack};${i<v?"":`box-shadow:inset 0 0 0 1px ${t.border}`}"></span>`).join("")}</span>
          <span class="num" style="font:500 .875rem/1.25rem ${MONO};min-width:32px;text-align:right">${v}<span style="color:${t.text3}">/4</span></span></div>`).join("")}
      </div>
      <div style="margin-top:20px;background:${t.accentSoft};border-radius:5px;padding:12px 14px">
        <span style="display:block;${label("", t.accent)};margin-bottom:6px">Next drill</span>
        <span style="font:400 .875rem/1.375rem ${SANS}">Capacity estimation for a 10k RPS read path.</span>
      </div>
    </section>
    ${ledger(t,2, tile(t,"p95 e2e","832 ms",true) + tile(t,"Cost","$0.10"))}
  </div>
</div>` + foot);
}

console.log("wrote 6 artboards");
