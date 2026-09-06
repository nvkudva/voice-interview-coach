/* Interview Coach — browser client.
 *
 * Three responsibilities, kept separate:
 *   1. VoiceState  — one attribute on <html> that three objects read.
 *   2. Waveline    — the app bar's rule, driven by real audio analysers.
 *   3. Session     — LiveKit wiring, transcript, metrics, score.
 *
 * Design contract in docs/design-system.md §10; behaviour in docs/ux-spec.md.
 */

const LK = window.LivekitClient;
const METRICS_TOPIC = "coach.metrics";
const AGENT_STATE_ATTR = "lk.agent.state";

const CONNECT_TIMEOUT_MS = 8_000;
const AGENT_JOIN_TIMEOUT_MS = 10_000;
const SCORE_POLL_SCHEDULE = [1000, 2000, 3000];
const SCORE_POLL_DEADLINE_MS = 45_000;
const STATUS_DEBOUNCE_MS = 400;

// Overwritten from GET /api/config. The server owns these thresholds; the
// client must never be a second source of truth for them.
let BUDGETS = { latency: 0.8, ceiling: 0.85 };
let ROOM_CFG = { avatar: true, camera: true, avatarModel: null };

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const $ = (id) => document.getElementById(id);

/* ========================================================================== */
/* Voice state                                                                */
/* ========================================================================== */

const STATE_LABEL = {
  idle: "Ready",
  connecting: "Connecting",
  waiting: "Waiting for the coach",
  listening: "Listening",
  hearing: "Hearing you",
  thinking: "Thinking",
  speaking: "Coach speaking",
  interrupted: "Interrupted",
  reconnecting: "Reconnecting",
  ended: "Call ended",
  scoring: "Scoring",
  scored: "Scored",
  error: "Call failed",
};

// Which --voice-current each logical state maps to.
const STATE_VOICE = {
  idle: "idle", connecting: "connecting", waiting: "connecting",
  listening: "listening", hearing: "listening", thinking: "thinking",
  speaking: "speaking", interrupted: "interrupted", reconnecting: "connecting",
  ended: "idle", scoring: "idle", scored: "idle", error: "error",
};

// 12x12 glyphs. Shape is the primary channel — the pill must read in greyscale.
const STATE_GLYPH = {
  idle: '<circle cx="6" cy="6" r="4"/>',
  connecting: '<path d="M6 2a4 4 0 1 1-4 4"/>',
  waiting: '<path d="M6 2a4 4 0 1 1-4 4"/>',
  listening: '<circle cx="6" cy="6" r="3.2" class="solid"/>',
  hearing: '<circle cx="6" cy="6" r="3.2" class="solid"/>',
  thinking: '<circle cx="6" cy="6" r="2" class="solid"/><path d="M6 1.4a4.6 4.6 0 1 1-3.25 1.35"/>',
  speaking: '<circle cx="4" cy="6" r="2" class="solid"/><path d="M7.6 3.6a3.4 3.4 0 0 1 0 4.8M9.6 2.2a5.4 5.4 0 0 1 0 7.6"/>',
  interrupted: '<circle cx="6" cy="6" r="3.2" class="solid"/><path d="M6 1v10"/>',
  reconnecting: '<path d="M6 2a4 4 0 1 1-4 4"/>',
  ended: '<circle cx="6" cy="6" r="4"/><path d="M2 6h8"/>',
  scoring: '<path d="M6 2a4 4 0 1 1-4 4"/>',
  scored: '<circle cx="6" cy="6" r="4"/><path d="M4 6.2 5.4 7.6 8 4.8"/>',
  error: '<path d="M6 1.6 11 10.4H1z"/><path d="M6 4.8v2.4M6 8.9v.1"/>',
};

const voice = {
  state: "idle",
  _pending: null,
  _timer: 0,

  set(next) {
    if (next === this.state) return;
    this.state = next;
    document.documentElement.dataset.voice = STATE_VOICE[next] || "idle";
    $("pill-glyph").innerHTML = STATE_GLYPH[next] || STATE_GLYPH.idle;
    waveline.onState(next);
    // Debounced so a listening→thinking→speaking flurry does not flood a
    // screen reader with three announcements in 300ms.
    const coachState = document.getElementById("coach-state");
    if (coachState && ["listening","hearing","thinking","speaking","waiting"].includes(next)) {
      coachState.textContent =
        next === "speaking" ? "speaking" : next === "thinking" ? "thinking" : "listening";
    }
    this._pending = STATE_LABEL[next] || next;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      $("pill-text").textContent = this._pending;
    }, STATUS_DEBOUNCE_MS);
  },
};

/* ========================================================================== */
/* The waveline — Idea 1                                                      */
/* ========================================================================== */

const waveline = {
  POINTS: 96,
  WIDTH: 1200,
  MID: 24,
  el: null,
  analyser: null,
  data: null,
  raf: 0,
  amp: 0,        // smoothed amplitude, 0..1
  gain: 0,       // px at full scale, per state
  breathStart: 0,

  init() {
    this.el = $("waveline-path");
    this.flat();
  },

  // Raised-cosine envelope: motion concentrates in the middle, and the line
  // always meets the page edges as a hairline. That is what keeps it reading
  // as structure rather than as an animation.
  envelope(i) {
    return 0.5 * (1 - Math.cos((2 * Math.PI * i) / (this.POINTS - 1)));
  },

  write(fn) {
    const pts = new Array(this.POINTS);
    const step = this.WIDTH / (this.POINTS - 1);
    for (let i = 0; i < this.POINTS; i++) {
      const y = this.MID + fn(i) * this.envelope(i);
      pts[i] = `${(i * step).toFixed(1)},${y.toFixed(2)}`;
    }
    this.el.setAttribute("points", pts.join(" "));
  },

  flat() { this.write(() => 0); },

  attach(stream, kind) {
    this.detach();
    if (reduceMotion.matches) return;
    try {
      const ctx = (this.ctx ||= new (window.AudioContext || window.webkitAudioContext)());
      const src = ctx.createMediaStreamSource(stream);
      const node = ctx.createAnalyser();
      node.fftSize = 1024;
      node.smoothingTimeConstant = 0.82;
      src.connect(node);
      this.analyser = node;
      this.source = src;
      this.data = new Uint8Array(node.fftSize);
      this.kind = kind;
      this.loop();
    } catch {
      // No Web Audio: the pill and the transcript still carry every state.
      this.flat();
    }
  },

  detach() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    try { this.source?.disconnect(); } catch { /* already gone */ }
    this.analyser = null;
    this.amp = 0;
  },

  rms() {
    if (!this.analyser) return 0;
    this.analyser.getByteTimeDomainData(this.data);
    let sum = 0;
    for (let i = 0; i < this.data.length; i++) {
      const v = (this.data[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / this.data.length) * 3.2);
  },

  loop() {
    this.raf = requestAnimationFrame(() => this.loop());
    if (this.gain === 0) return;

    const target = this.rms();
    // Attack fast, release slow: follows speech, never twitches on a click.
    const k = target > this.amp ? this.attack : this.release;
    this.amp += (target - this.amp) * k;

    const px = this.amp * this.gain;
    const t = performance.now() / 1000;
    this.write((i) => Math.sin(i * 0.42 + t * 7) * px);
  },

  breathe() {
    // The only ambient loop in the product, and it is one pixel: enough to
    // say "the mic is live", below the threshold at which peripheral vision
    // flags motion as demanding attention.
    cancelAnimationFrame(this.raf);
    if (reduceMotion.matches) { this.flat(); return; }
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      const phase = Math.sin((performance.now() / 4000) * 2 * Math.PI);
      this.write((i) => Math.sin(i * 0.42) * phase);
    };
    tick();
  },

  onState(state) {
    if (reduceMotion.matches) { this.flat(); return; }
    switch (state) {
      case "hearing":
        this.gain = 7; this.attack = 0.35; this.release = 0.10;
        if (!this.raf) this.loop();
        break;
      case "speaking":
        this.gain = 10; this.attack = 0.45; this.release = 0.14;
        if (!this.raf) this.loop();
        break;
      case "listening":
        this.gain = 0; this.breathe();
        break;
      default:
        this.gain = 0;
        cancelAnimationFrame(this.raf);
        this.raf = 0;
        this.flat();
    }
  },

  // A transient cue for a barge-in. The durable record lives in the transcript.
  notch() {
    const marks = $("waveline-marks");
    const x = 300 + Math.random() * 600;
    const el = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    el.setAttribute("x", x); el.setAttribute("y", 15);
    el.setAttribute("width", 2); el.setAttribute("height", 18);
    el.setAttribute("fill", "var(--voice-interrupted)");
    marks.append(el);
    setTimeout(() => el.remove(), 900);
  },

  // The product's central claim as a mark: you said "mhm", it heard you,
  // classified it, and correctly kept talking. Four pixels.
  backchannel() {
    const marks = $("waveline-marks");
    const x = 300 + Math.random() * 600;
    const el = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    el.setAttribute("cx", x); el.setAttribute("cy", 32); el.setAttribute("r", 2);
    el.setAttribute("fill", "none");
    el.setAttribute("stroke", "var(--voice-listening)");
    el.setAttribute("stroke-width", "1");
    el.setAttribute("vector-effect", "non-scaling-stroke");
    marks.append(el);
    setTimeout(() => el.remove(), 2000);
  },
};

/* ========================================================================== */
/* Session                                                                    */
/* ========================================================================== */

const session = {
  room: null,
  id: null,
  startedAt: 0,
  timerId: 0,
  scoreDeadline: 0,
  // Accumulated by turn_index. The data channel only carries the last ten
  // rows, so rendering the payload directly truncates any longer session.
  turns: new Map(),
  summary: {},
  counts: { interruptions: 0, backchannels: 0 },
  transcript: [],
  reviewing: false,
  // -1 until the candidate's first answer. The coach's opening question
  // belongs to no turn, exactly as MetricsSink sees it.
  turnCursor: -1,
  micOn: true,
  camOn: true,
};

/* ========================================================================== */
/* Local media — the lobby preview, and the tracks we carry into the room     */
/* ========================================================================== */

const media = {
  stream: null,
  levelRaf: 0,

  async open({ video }) {
    this.close();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });
    } catch (err) {
      // A camera failure must not cost you the interview — fall back to audio.
      if (video) {
        session.camOn = false;
        setPreviewCamera(false);
        return this.open({ video: false });
      }
      throw err;
    }
    $("preview-video").srcObject = this.stream;
    setPreviewCamera(Boolean(video) && this.stream.getVideoTracks().length > 0);
    this.meter();
    return this.stream;
  },

  // Five bars driven by real RMS. The point is proof the mic works, before
  // you have staked an interview on it.
  meter() {
    cancelAnimationFrame(this.levelRaf);
    if (!this.stream || reduceMotion.matches) return;
    let ctx, analyser;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(this.stream).connect(analyser);
    } catch {
      return;
    }
    const data = new Uint8Array(analyser.fftSize);
    const bars = [...$("level").children];
    const tick = () => {
      this.levelRaf = requestAnimationFrame(tick);
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) sum += ((v - 128) / 128) ** 2;
      const lit = session.micOn
        ? Math.round(Math.min(1, Math.sqrt(sum / data.length) * 4.5) * bars.length)
        : 0;
      bars.forEach((b, i) => b.toggleAttribute("data-lit", i < lit));
    };
    tick();
  },

  close() {
    cancelAnimationFrame(this.levelRaf);
    this.levelRaf = 0;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  },
};

function setPreviewCamera(on) {
  session.camOn = on;
  $("preview").dataset.camera = on ? "on" : "off";
  $("pre-cam").setAttribute("aria-pressed", String(on));
  $("pre-cam").querySelector("use").setAttribute("href", on ? "#i-cam" : "#i-cam-off");
}

/* --- boot ---------------------------------------------------------------- */

init();

async function init() {
  waveline.init();
  voice.set("idle");
  restorePreferences();
  wireControls();

  addEventListener("scroll", () => {
    $("appbar").toggleAttribute("data-scrolled", scrollY > 0);
  }, { passive: true });

  reduceMotion.addEventListener("change", () => waveline.onState(voice.state));

  await Promise.all([loadConfig(), loadQuestions()]);

  // The client library comes from a CDN. If it did not arrive, say so once
  // rather than throwing on the first click.
  if (!LK) {
    $("call").disabled = true;
    notice("critical", "The call client did not load",
      "The LiveKit browser library could not be fetched, so a call cannot start. " +
      "Reload the page, or check whether a network filter is blocking the CDN.",
      [{ label: "Reload", fn: () => location.reload() }]);
  }

  const params = new URLSearchParams(location.search);
  if (params.get("view") === "engineer") setEngineerView(true);
  if (params.get("session")) { loadSession(params.get("session")); return; }

  // Show yourself before anyone else sees you. A denial here is not fatal —
  // it just means the lobby cannot preview; joining asks again.
  try {
    await media.open({ video: ROOM_CFG.camera });
  } catch (err) {
    setPreviewCamera(false);
    $("preview-off-text").textContent =
      err?.name === "NotAllowedError" ? "Camera and microphone blocked" : "No camera found";
  }
}

async function loadConfig() {
  try {
    const cfg = await (await fetch("/api/config")).json();
    BUDGETS = { latency: cfg.latency_budget_seconds, ceiling: cfg.cost_ceiling_usd };
    ROOM_CFG = {
      avatar: cfg.avatar_enabled !== false,
      camera: cfg.camera_enabled !== false,
      avatarModel: cfg.avatar_model,
    };
    $("chip-gap-hint").textContent = `Target under ${Math.round(BUDGETS.latency * 1000)} ms`;
    $("chip-cost-hint").textContent = `Model and transport spend. Target under $${BUDGETS.ceiling.toFixed(2)}`;
  } catch {
    // Defaults stand. A missing config endpoint is not worth an error banner.
  }
}

async function loadQuestions() {
  try {
    const questions = await (await fetch("/api/questions")).json();
    for (const q of questions) {
      const opt = new Option(q.prompt, q.id);
      $("question").append(opt);
    }
  } catch {
    // Random still works; a broken dropdown on a screen nobody is looking at
    // is not worth an error message.
  }
}

function restorePreferences() {
  const theme = safeGet("theme");
  if (theme) document.documentElement.dataset.theme = theme;
  if (safeGet("density") === "comfortable") setDensity(true);
  if (safeGet("engineer") === "1") setEngineerView(true);
}

function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }

function wireControls() {
  $("call").onclick = startCall;
  $("end").onclick = () => endCall();
  $("mute").onclick = toggleMute;
  $("cam").onclick = toggleCamera;
  $("pre-mic").onclick = () => {
    session.micOn = !session.micOn;
    $("pre-mic").setAttribute("aria-pressed", String(session.micOn));
    $("pre-mic").querySelector("use").setAttribute("href", session.micOn ? "#i-mic" : "#i-mic-off");
    media.stream?.getAudioTracks().forEach((t) => (t.enabled = session.micOn));
  };
  $("pre-cam").onclick = async () => {
    const next = !session.camOn;
    await media.open({ video: next });
    setPreviewCamera(next && Boolean(media.stream?.getVideoTracks().length));
  };
  $("panel-toggle").onclick = () => {
    const open = $("side").hidden;
    $("side").hidden = !open;
    $("panel-toggle").setAttribute("aria-pressed", String(open));
  };
  $("erase").onclick = () => $("confirm-delete").showModal();
  $("cancel-delete").onclick = () => $("confirm-delete").close();
  $("confirm-delete-btn").onclick = eraseSession;
  $("load-past").onclick = loadMostRecent;
  $("copy-transcript").onclick = copyTranscript;
  $("copy-csv").onclick = copyCsv;
  $("engineer-view").onchange = (e) => setEngineerView(e.target.checked);
  $("density-toggle").onclick = () =>
    setDensity(document.documentElement.dataset.density !== "comfortable");

  $("theme-toggle").onclick = () => {
    const now = document.documentElement.dataset.theme;
    const systemDark = matchMedia("(prefers-color-scheme: dark)").matches;
    const next = now ? (now === "dark" ? "light" : "dark") : (systemDark ? "light" : "dark");
    document.documentElement.dataset.theme = next;
    safeSet("theme", next);
  };
}

function setEngineerView(on) {
  $("engineer-view").checked = on;
  $("eng").hidden = !on;
  safeSet("engineer", on ? "1" : "0");
}

function setDensity(comfortable) {
  document.documentElement.dataset.density = comfortable ? "comfortable" : "dense";
  $("density-toggle").setAttribute("aria-pressed", String(comfortable));
  safeSet("density", comfortable ? "comfortable" : "dense");
}

/* --- the call ------------------------------------------------------------ */

async function startCall() {
  clearNotices();
  resetSession();
  voice.set("connecting");
  lockControls(true);

  let url, token;
  try {
    const res = await fetch("/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: $("language").value,
        question_id: $("question").value || null,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const body = await res.json();
    ({ url, token } = body);
    session.id = body.room;
    $("session-id").textContent = body.room;
  } catch (err) {
    return failCall(
      "The call could not start",
      "The server did not return a room. Nothing was recorded.",
      err,
    );
  }

  const room = new LK.Room({ adaptiveStream: true, dynacast: true });
  session.room = room;
  wireRoom(room);

  try {
    await withTimeout(room.connect(url, token), CONNECT_TIMEOUT_MS);
  } catch (err) {
    session.room = null;
    try { await room.disconnect(); } catch { /* never connected */ }
    return failCall(
      "The call could not start",
      "The connection did not complete in time. This is usually the network.",
      err,
    );
  }

  try {
    await room.localParticipant.setMicrophoneEnabled(session.micOn);
    if (session.camOn) await room.localParticipant.setCameraEnabled(true);
  } catch (err) {
    await room.disconnect();
    session.room = null;
    return micFailure(err);
  }

  const mic = room.localParticipant.getTrackPublication(LK.Track.Source.Microphone);
  if (mic?.track?.mediaStream) waveline.attach(mic.track.mediaStream, "mic");
  attachSelfVideo();

  goLive();
}

function goLive() {
  voice.set("waiting");
  lockControls(false);
  // The lobby is done; the room takes the screen.
  media.close();
  $("lobby").hidden = true;
  $("room").hidden = false;
  $("transcript-empty").hidden = false;
  $("rail-note").textContent = "Live";
  $("room-note").textContent = ROOM_CFG.avatar
    ? "Your coach is on video. Interrupt whenever you would in a real interview."
    : "Voice only for this session.";
  $("coach-note").textContent = ROOM_CFG.avatar ? "Waiting for the coach" : "Voice only";

  session.startedAt = Date.now();
  session.timerId = setInterval(tickTimer, 1000);
  tickTimer();

  // An "in call" indicator shown before the coach has joined trains people to
  // talk into a void.
  session.agentTimer = setTimeout(() => {
    if (voice.state === "waiting") {
      endCall();
      notice("critical", "The coach did not pick up",
             "The room opened but the coach never joined, so the call was ended. Nothing was recorded.",
             [{ label: "Try again", fn: startCall }]);
    }
  }, AGENT_JOIN_TIMEOUT_MS);
}

function wireRoom(room) {
  room.on(LK.RoomEvent.TrackSubscribed, (track) => {
    if (track.kind === LK.Track.Kind.Audio) {
      track.attach();
      if (track.mediaStream) waveline.attach(track.mediaStream, "agent");
      return;
    }
    // The only remote video in this room is the coach — either the agent
    // itself or the avatar worker publishing on its behalf.
    if (track.kind === LK.Track.Kind.Video) {
      track.attach($("coach-video"));
      $("tile-coach").dataset.video = "on";
      $("coach-state").textContent = "live";
    }
  });

  room.on(LK.RoomEvent.TrackUnsubscribed, (track) => {
    if (track.kind === LK.Track.Kind.Video) {
      track.detach($("coach-video"));
      $("tile-coach").removeAttribute("data-video");
      $("coach-note").textContent = "Coach video ended";
    }
  });

  room.on(LK.RoomEvent.ParticipantAttributesChanged, (changed, participant) => {
    const state = changed[AGENT_STATE_ATTR];
    if (state) onAgentState(state, participant);
  });

  room.on(LK.RoomEvent.ActiveSpeakersChanged, (speakers) => {
    const me = room.localParticipant.identity;
    session.userSpeaking = speakers.some((s) => s.identity === me);
    if (session.agentState === "listening") {
      voice.set(session.userSpeaking ? "hearing" : "listening");
    }
  });

  room.on(LK.RoomEvent.TranscriptionReceived, onTranscription);
  room.on(LK.RoomEvent.DataReceived, onData);
  room.on(LK.RoomEvent.Reconnecting, () => voice.set("reconnecting"));
  room.on(LK.RoomEvent.Reconnected, () => onAgentState(session.agentState || "listening"));
  room.on(LK.RoomEvent.Disconnected, () => { if (session.room) endCall(true); });
}

function onAgentState(state, participant) {
  clearTimeout(session.agentTimer);
  session.agentState = state;
  if (participant) session.agentIdentity = participant.identity;

  if (state === "listening") {
    voice.set(session.userSpeaking ? "hearing" : "listening");
    // Swap the analyser back to the microphone so LISTENING reads local audio.
    const mic = session.room?.localParticipant
      ?.getTrackPublication(LK.Track.Source.Microphone);
    if (mic?.track?.mediaStream && waveline.kind !== "mic") {
      waveline.attach(mic.track.mediaStream, "mic");
    }
    finaliseStreaming();
  } else if (state === "thinking") {
    voice.set("thinking");
    finaliseStreaming();
  } else if (state === "speaking") {
    voice.set("speaking");
  } else if (state === "initializing") {
    voice.set("waiting");
  }
}

async function endCall(remote = false) {
  const room = session.room;
  session.room = null;
  clearInterval(session.timerId);
  clearTimeout(session.agentTimer);
  waveline.detach();
  waveline.flat();

  if (room && !remote) { try { await room.disconnect(); } catch { /* already gone */ } }

  voice.set("ended");
  $("room").hidden = true;
  $("lobby").hidden = false;
  $("side").hidden = false;                    // the score lands here
  $("panel-toggle").setAttribute("aria-pressed", "true");
  $("call-label").textContent = "Start another interview";
  $("room-note").textContent = "";
  $("rail-note").textContent = "Final";
  $("erase").hidden = !session.id;
  $("tile-coach").removeAttribute("data-video");
  $("tile-self").removeAttribute("data-video");
  media.open({ video: session.camOn }).catch(() => setPreviewCamera(false));

  if (session.summary.over_ceiling) {
    notice("warning", "Over the cost target",
      `This session cost $${session.summary.total_cost_usd.toFixed(4)}, over the ` +
      `$${BUDGETS.ceiling.toFixed(2)} target. Calls are never cut off over cost — ` +
      `the target is a benchmark, not a limit.`);
  }
  if (session.id && session.transcript.length) pollForScore();
}

async function toggleMute() {
  const lp = session.room?.localParticipant;
  if (!lp) return;
  const on = lp.isMicrophoneEnabled;          // currently on -> we are muting
  await lp.setMicrophoneEnabled(!on);
  session.micOn = !on;
  $("mute").setAttribute("aria-pressed", String(on));
  $("mute-label").textContent = on ? "Unmute" : "Mute";
  $("mute").querySelector("use").setAttribute("href", on ? "#i-mic-off" : "#i-mic");
  $("self-muted").hidden = !on;
}

async function toggleCamera() {
  const lp = session.room?.localParticipant;
  if (!lp) return;
  const on = lp.isCameraEnabled;
  await lp.setCameraEnabled(!on);
  session.camOn = !on;
  $("cam").setAttribute("aria-pressed", String(on));
  $("cam-label").textContent = on ? "Start video" : "Stop video";
  $("cam").querySelector("use").setAttribute("href", on ? "#i-cam-off" : "#i-cam");
  if (on) {
    $("tile-self").removeAttribute("data-video");
  } else {
    attachSelfVideo();
  }
}

function attachSelfVideo() {
  const pub = session.room?.localParticipant
    ?.getTrackPublication(LK.Track.Source.Camera);
  if (pub?.track) {
    pub.track.attach($("self-video"));
    $("tile-self").dataset.video = "on";
  } else {
    $("tile-self").removeAttribute("data-video");
  }
}

function tickTimer() {
  const s = Math.floor((Date.now() - session.startedAt) / 1000);
  $("timer").textContent =
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function lockControls(locked) {
  $("call").disabled = locked;
  $("language").disabled = locked;
  $("question").disabled = locked;
  $("call-label").textContent = locked ? "Connecting" : "Start call";
}

function resetSession() {
  session.turns.clear();
  session.summary = {};
  session.counts = { interruptions: 0, backchannels: 0 };
  session.transcript = [];
  session.agentState = null;
  session.reviewing = false;
  session.turnCursor = -1;
  $("tile-coach").removeAttribute("data-video");
  $("coach-state").textContent = "joining";
  $("transcript").replaceChildren();
  $("turns-body").replaceChildren(emptyRow());
  $("score-card").hidden = true;
  $("erase").hidden = true;
  renderChips();
  renderTiles();
}

/* --- failures ------------------------------------------------------------ */

function failCall(title, body, err) {
  session.room = null;
  lockControls(false);
  voice.set("error");
  notice("critical", title, body, [{ label: "Try again", fn: startCall }], err);
}

function micFailure(err) {
  lockControls(false);
  voice.set("idle");
  const noDevice = err?.name === "NotFoundError" || err?.name === "OverconstrainedError";
  notice(
    "critical",
    noDevice ? "No microphone found" : "The microphone is blocked",
    noDevice
      ? "The browser cannot see an input device. Connect a microphone or headset and try again."
      : "This browser is not letting the page use your microphone, so the coach cannot hear you. " +
        "Allow microphone access in your browser's address bar, then try again.",
    [{ label: "Try again", fn: startCall },
     { label: "See a completed run", fn: loadMostRecent }],
  );
}

function notice(tone, title, body, actions = [], detail = null) {
  const el = document.createElement("div");
  el.className = "notice";
  el.dataset.tone = tone;
  el.setAttribute("role", tone === "critical" ? "alert" : "status");

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 16 16");
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = '<use href="#i-alert"/>';

  const wrap = document.createElement("div");
  wrap.className = "notice__body";
  const h = document.createElement("p");
  h.className = "notice__title";
  h.textContent = title;
  const p = document.createElement("p");
  p.textContent = body;
  wrap.append(h, p);

  if (actions.length) {
    const row = document.createElement("div");
    row.className = "notice__actions";
    for (const a of actions) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn btn--sm";
      b.textContent = a.label;
      b.onclick = () => { el.remove(); a.fn(); };
      row.append(b);
    }
    wrap.append(row);
  }

  // The raw error goes under a disclosure, never in the headline.
  if (detail) {
    const d = document.createElement("details");
    const s = document.createElement("summary");
    s.textContent = "Details";
    const pre = document.createElement("pre");
    pre.textContent = String(detail?.message || detail);
    d.append(s, pre);
    wrap.append(d);
  }

  el.append(icon, wrap);
  $("notices").append(el);
}

function clearNotices() { $("notices").replaceChildren(); }

/* --- transcript ---------------------------------------------------------- */

function onTranscription(segments, participant) {
  const isCoach = participant?.identity !== session.room?.localParticipant?.identity;
  for (const seg of segments) addSegment(isCoach ? "agent" : "user", seg);
}

function addSegment(role, seg) {
  $("transcript-empty").hidden = true;
  const id = `${role}-${seg.id}`;
  let el = $(id);

  if (!el) {
    if (role === "user") session.turnCursor += 1;
    const turnLabel =
      session.turnCursor < 0 ? "—" : String(session.turnCursor).padStart(2, "0");

    el = document.createElement("li");
    el.id = id;
    el.className = "msg";
    el.dataset.role = role;
    if (session.turnCursor >= 0) el.dataset.turn = turnLabel;

    const meta = document.createElement("p");
    meta.className = "msg__meta";
    const turn = document.createElement("span");
    turn.className = "msg__turn";
    turn.textContent = turnLabel;
    const who = document.createElement("span");
    who.textContent = role === "agent" ? "Coach" : "You";
    meta.append(turn, who);

    const text = document.createElement("p");
    text.className = "msg__text";

    el.append(meta, text);
    if (el.dataset.turn) {
      el.addEventListener("mouseenter", () => linkTurn(el.dataset.turn, true));
      el.addEventListener("mouseleave", () => linkTurn(el.dataset.turn, false));
    }
    $("transcript").append(el);
  }

  el.querySelector(".msg__text").textContent = seg.text;
  el.toggleAttribute("data-streaming", !seg.final);

  if (seg.final) {
    session.transcript.push({ role, text: seg.text });
  }
  const wrap = $("transcript-wrap");
  wrap.scrollTop = wrap.scrollHeight;
}

function finaliseStreaming() {
  for (const el of $("transcript").querySelectorAll("[data-streaming]")) {
    el.removeAttribute("data-streaming");
  }
}

// Idea 2: the turn spine. Hovering either side highlights the other.
function linkTurn(turn, on) {
  if (!turn) return;
  for (const el of document.querySelectorAll(`[data-turn="${turn}"]`)) {
    el.toggleAttribute("data-linked", on);
  }
}

/* --- metrics ------------------------------------------------------------- */

function onData(payload, _p, _kind, topic) {
  if (topic !== METRICS_TOPIC) return;
  let data;
  try {
    data = JSON.parse(new TextDecoder().decode(payload));
  } catch {
    return;
  }
  ingest(data);
}

function ingest({ summary = {}, turns = [] }) {
  // The payload carries only the last ten rows. Accumulate by turn_index or a
  // session longer than ten turns silently shows a truncated table — and the
  // p95 claim becomes unauditable.
  for (const t of turns) session.turns.set(t.turn_index, t);

  const prev = session.counts;
  session.summary = summary;
  session.counts = {
    interruptions: summary.interruptions ?? 0,
    backchannels: summary.backchannels ?? 0,
  };
  if (session.counts.interruptions > prev.interruptions) waveline.notch();
  if (session.counts.backchannels > prev.backchannels) waveline.backchannel();

  renderChips();
  renderTiles();
  renderTable();
}

const ms = (v) => (v ? `${Math.round(v * 1000)} ms` : "—");

function renderChips() {
  const s = session.summary;
  const gap = s.p95_latency;
  setChip("chip-gap", gap ? ms(gap) : "—", gap > BUDGETS.latency);
  if (s.turns) $("chip-gap-hint").textContent =
    `p95 over ${s.turns} turn${s.turns === 1 ? "" : "s"} so far. Target under ${Math.round(BUDGETS.latency * 1000)} ms`;

  const { interruptions: i, backchannels: b } = session.counts;
  setChip("chip-turns", s.turns ? `${i} / ${b}` : "—", false);
  $("chip-turns-hint").textContent = s.turns
    ? `You interrupted ${i} time${i === 1 ? "" : "s"} and the coach stopped. ` +
      `You backchannelled ${b} time${b === 1 ? "" : "s"} and it kept going.`
    : "Interruptions and backchannels";

  const cost = s.total_cost_usd;
  setChip("chip-cost", cost ? `$${cost.toFixed(3)}` : "—", !!s.over_ceiling);
  if (s.avatar_cost_usd) {
    const share = Math.round((s.avatar_cost_usd / s.total_cost_usd) * 100);
    $("chip-cost-hint").textContent =
      `${share}% of it is the coach's video (${s.avatar_model}). Target under $${BUDGETS.ceiling.toFixed(2)}`;
  }
}

function setChip(id, value, over) {
  const el = $(id);
  if (el.textContent !== value && value !== "—") {
    el.classList.remove("value-changed");
    void el.offsetWidth;           // restart the wash
    el.classList.add("value-changed");
  }
  el.textContent = value;
  el.parentElement.dataset.status = value === "—" ? "empty" : over ? "over" : "ok";
}

function renderTiles() {
  const s = session.summary;
  const tile = (id, value, over = false) => {
    $(id).textContent = value;
    $(id).parentElement.dataset.status = value === "—" ? "empty" : over ? "over" : "ok";
  };
  tile("t-p95", ms(s.p95_latency), s.p95_latency > BUDGETS.latency);
  tile("t-p50", ms(s.p50_latency), s.p50_latency > BUDGETS.latency);
  tile("t-ttft", ms(s.mean_llm_ttft));
  tile("t-ttfb", ms(s.mean_tts_ttfb));
  tile("t-eou", ms(s.mean_eou_delay));
  tile("t-turns", s.turns ? String(s.turns) : "—");
}

function renderTable() {
  const body = $("turns-body");
  const rows = [...session.turns.values()].sort((a, b) => a.turn_index - b.turn_index);
  if (!rows.length) { body.replaceChildren(emptyRow()); return; }

  body.replaceChildren(...rows.map((t) => {
    const turn = String(t.turn_index).padStart(2, "0");
    const tr = document.createElement("tr");
    tr.dataset.turn = turn;
    tr.tabIndex = 0;
    tr.addEventListener("mouseenter", () => linkTurn(turn, true));
    tr.addEventListener("mouseleave", () => linkTurn(turn, false));
    tr.addEventListener("focus", () => linkTurn(turn, true));
    tr.addEventListener("blur", () => linkTurn(turn, false));

    const cells = [
      { text: turn, cls: "col-turn" },
      { text: int(t.eou_delay) },
      { text: int(t.transcription_delay) },
      { text: int(t.llm_ttft) },
      { text: int(t.tts_ttfb) },
      { text: int(t.e2e_latency), cls: "budget", budget: t.e2e_latency },
      { text: t.cost_usd ? t.cost_usd.toFixed(4) : "—" },
    ];
    for (const c of cells) {
      const td = document.createElement("td");
      td.textContent = c.text;
      if (c.cls) td.className = c.cls;
      if (c.budget !== undefined) {
        const pct = Math.min(140, (c.budget / BUDGETS.latency) * 100);
        td.style.setProperty("--pct", pct.toFixed(1));
        if (c.budget > BUDGETS.latency) td.setAttribute("data-over", "");
      }
      tr.append(td);
    }
    return tr;
  }));
}

const int = (v) => (v ? String(Math.round(v * 1000)) : "—");

function emptyRow() {
  const tr = document.createElement("tr");
  tr.className = "table-empty";
  const td = document.createElement("td");
  td.colSpan = 7;
  td.textContent = "One row per turn, from the first answer onward.";
  tr.append(td);
  return tr;
}

/* --- score --------------------------------------------------------------- */

async function pollForScore() {
  voice.set("scoring");
  renderScorePlaceholder();
  session.scoreDeadline = Date.now() + SCORE_POLL_DEADLINE_MS;

  for (let i = 0; Date.now() < session.scoreDeadline; i++) {
    await sleep(SCORE_POLL_SCHEDULE[Math.min(i, SCORE_POLL_SCHEDULE.length - 1)]);
    if (!session.id) return;                       // deleted while we waited
    try {
      const res = await fetch(`/api/sessions/${session.id}`);
      if (!res.ok) continue;
      const record = await res.json();
      if (record.turns?.length) {
        for (const t of record.turns) session.turns.set(t.turn_index, t);
        renderTable();
      }
      if (record.score) {
        voice.set("scored");
        renderScore(record);
        return;
      }
    } catch {
      // Keep polling; a single failed fetch is not a failed session.
    }
  }

  voice.set("ended");
  $("score-card").hidden = true;
  notice("warning", "The score is taking longer than expected",
    "Your transcript is saved. Try again in a moment, or come back to this session id later.",
    [{ label: "Check again", fn: pollForScore }]);
}

const DIMENSIONS = [
  ["requirements_clarification", "Requirements clarification"],
  ["high_level_design", "High-level design"],
  ["data_modeling", "Data modeling"],
  ["scaling_and_tradeoffs", "Scaling and tradeoffs"],
  ["communication", "Communication"],
];

function renderScorePlaceholder() {
  const card = $("score-card");
  card.hidden = false;
  card.innerHTML = "";
  card.append(
    el("p", "score__eyebrow", "Your session"),
    el("p", "score__meta", "Scoring your session. This takes a few seconds. Your transcript is above."),
    rubricList(null),
  );
}

function renderScore(record) {
  const score = record.score;
  const card = $("score-card");
  card.hidden = false;
  card.innerHTML = "";

  if (score.status !== "scored") {
    card.append(
      el("p", "score__eyebrow", "Your session"),
      el("h2", "score__band", "Not scored"),
      el("p", "score__meta",
        "The session was recorded and the transcript is intact, but the scoring " +
        `step did not complete. ${score.reason || ""}`),
      rubricList(null),
    );
    return;
  }

  const total = score.total ?? 0;
  const band = total >= 18 ? "excellent" : total >= 14 ? "strong" : total >= 8 ? "solid" : "developing";

  const head = el("div", "score__head");
  const totalEl = el("span", "score__total num", String(total));
  const outOf = el("span", "score__outof num", "/20");
  const bandEl = el("span", "score__band", band.toUpperCase());
  bandEl.dataset.band = band;
  head.append(totalEl, outOf, bandEl);

  const dur = record.duration_seconds
    ? `${Math.floor(record.duration_seconds / 60)}m ${Math.round(record.duration_seconds % 60)}s`
    : "";
  const meta = [record.question_id, `${total} of 20`, dur, record.language]
    .filter(Boolean).join(" · ");

  card.append(el("p", "score__eyebrow", "Your session"), head, el("p", "score__meta", meta));

  if (score.strengths?.length) {
    card.append(section("What worked", list(score.strengths, "score__list")));
  }
  card.append(section("How it scored", rubricList(score.scores)));
  if (score.gaps?.length) {
    card.append(section("Where to go deeper", list(score.gaps, "score__list score__list--gaps")));
  }
  if (score.hand_waving?.length) {
    const box = el("div");
    for (const h of score.hand_waving) {
      const q = el("div", "quote");
      q.append(el("p", "quote__text", `“${h.quote}”`), el("p", "quote__why", h.why));
      const find = el("button", "btn btn--quiet btn--sm quote__find", "Find in transcript");
      find.type = "button";
      find.onclick = () => findInTranscript(h.quote);
      q.append(find);
      box.append(q);
    }
    card.append(section("Moments to tighten", box));
  }
  if (score.next_drill) {
    const drill = el("div", "drill");
    drill.append(el("span", "drill__label", "Next drill"), el("span", "", score.next_drill));
    card.append(drill);
  }
}

function rubricList(scores) {
  const wrap = el("div", "rubric");
  for (const [key, label] of DIMENSIONS) {
    const value = scores ? scores[key] : null;
    const row = el("div", "rubric__row");
    row.setAttribute("role", "meter");
    row.setAttribute("aria-valuemin", "0");
    row.setAttribute("aria-valuemax", "4");
    row.setAttribute("aria-label", label);
    if (value != null) row.setAttribute("aria-valuenow", String(value));

    const meter = el("div", "rubric__meter");
    for (let i = 0; i < 4; i++) {
      const seg = el("span", "rubric__seg");
      if (value != null && i < value) seg.setAttribute("data-filled", "");
      meter.append(seg);
    }
    const val = el("span", "rubric__value num");
    val.append(document.createTextNode(value != null ? String(value) : "—"));
    val.append(el("span", "", "/4"));

    row.append(el("span", "rubric__name", label), meter, val);
    wrap.append(row);
  }
  wrap.append(el("p", "rubric__legend",
    "0 absent · 1 named but not reasoned · 2 reasoned without numbers · " +
    "3 reasoned with numbers · 4 reasoned with numbers and an explicit tradeoff"));
  return wrap;
}

function findInTranscript(quote) {
  const needle = quote.toLowerCase().slice(0, 40);
  for (const msg of $("transcript").querySelectorAll(".msg")) {
    if (msg.textContent.toLowerCase().includes(needle)) {
      msg.scrollIntoView({ block: "center", behavior: reduceMotion.matches ? "auto" : "smooth" });
      msg.setAttribute("data-linked", "");
      setTimeout(() => msg.removeAttribute("data-linked"), 2000);
      return;
    }
  }
}

/* --- reviewing a stored session ------------------------------------------ */

async function loadMostRecent() {
  clearNotices();
  try {
    const sessions = await (await fetch("/api/sessions")).json();
    const done = sessions.filter((s) => s.total != null || s.duration_seconds);
    if (!done.length) {
      notice("info", "No past sessions yet",
        "No past sessions on this server yet. Start a call and one will appear here.");
      return;
    }
    await loadSession(done[done.length - 1].session_id);
  } catch (err) {
    notice("critical", "Could not load past sessions", "The server did not respond.", [], err);
  }
}

async function loadSession(id) {
  resetSession();
  session.id = id;
  session.reviewing = true;
  try {
    const record = await (await fetch(`/api/sessions/${id}`)).json();
    $("session-id").textContent = id;
    $("erase").hidden = false;
    $("side").hidden = false;
    $("panel-toggle").setAttribute("aria-pressed", "true");
    $("rail-note").textContent = "Recorded";
    notice("info", "Recorded session",
      "You are looking at a recorded session, not a live call.");

    for (const item of record.transcript || []) {
      session.transcript.push(item);
      addSegment(item.role === "assistant" ? "agent" : "user",
                 { id: `r${session.transcript.length}`, text: item.text, final: true });
    }
    for (const t of record.turns || []) session.turns.set(t.turn_index, t);
    session.summary = record.summary || {};
    session.counts = {
      interruptions: session.summary.interruptions ?? 0,
      backchannels: session.summary.backchannels ?? 0,
    };
    renderChips(); renderTiles(); renderTable();
    if (record.score) renderScore(record);
    voice.set("scored");
  } catch (err) {
    notice("critical", "Could not load that session", "The record was not readable.", [], err);
  }
}

/* --- erase, copy --------------------------------------------------------- */

async function eraseSession() {
  $("confirm-delete").close();
  const id = session.id;
  if (!id) return;
  await fetch(`/api/sessions/${id}`, { method: "DELETE" });
  session.id = null;
  $("erase").hidden = true;
  $("session-id").textContent = `${id} — deleted`;
  $("score-card").hidden = true;
  notice("info", "Deleted", "Nothing from this session remains on the server.");
}

async function copyTranscript() {
  const text = session.transcript
    .map((t) => `${t.role === "user" ? "CANDIDATE" : "COACH"}: ${t.text}`)
    .join("\n");
  await copy(text, $("copy-transcript"));
}

async function copyCsv() {
  const rows = [...session.turns.values()].sort((a, b) => a.turn_index - b.turn_index);
  const header = "turn,eou_ms,stt_ms,llm_ttft_ms,tts_ttfb_ms,e2e_ms,cost_usd";
  const body = rows.map((t) => [
    t.turn_index, int(t.eou_delay), int(t.transcription_delay),
    int(t.llm_ttft), int(t.tts_ttfb), int(t.e2e_latency), t.cost_usd ?? 0,
  ].join(","));
  await copy([header, ...body].join("\n"), $("copy-csv"));
}

async function copy(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    const label = button.lastChild;
    const original = label.textContent;
    label.textContent = " Copied";
    setTimeout(() => { label.textContent = original; }, 1600);
  } catch {
    notice("warning", "Could not copy",
      "This browser blocked clipboard access. Select the text and copy it manually.");
  }
}

/* --- helpers ------------------------------------------------------------- */

function el(tag, cls = "", text = "") {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

function section(title, content) {
  const s = el("section", "score__section");
  s.append(el("h3", "", title), content);
  return s;
}

function list(items, cls) {
  const ol = el("ul", cls);
  for (const item of items) ol.append(el("li", "", item));
  return ol;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timed out")), ms)),
  ]);
}
