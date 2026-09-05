/* Browser client: joins a LiveKit room, renders the transcript, and draws the
   per-turn metrics the agent publishes on the coach.metrics data topic. */

const LK = window.LivekitClient;
const METRICS_TOPIC = "coach.metrics";
const LATENCY_BUDGET = 0.8; // seconds, per prd.md §7

const el = (id) => document.getElementById(id);
const ui = {
  call: el("call"), state: el("state"), language: el("language"),
  question: el("question"), transcript: el("transcript"),
  turns: el("turns").querySelector("tbody"), sessionId: el("session-id"),
  erase: el("erase"),
};

let room = null;
let currentSession = null;

init();

async function init() {
  try {
    const questions = await (await fetch("/api/questions")).json();
    for (const q of questions) {
      const opt = document.createElement("option");
      opt.value = q.id;
      opt.textContent = q.prompt;
      ui.question.append(opt);
    }
  } catch {
    /* the API may not be up yet; Random still works */
  }
  ui.call.onclick = () => (room ? hangUp() : call());
  ui.erase.onclick = erase;
}

function setState(text, cls = "idle") {
  ui.state.textContent = text;
  ui.state.className = `state ${cls}`;
}

async function call() {
  setState("connecting", "idle");
  ui.call.disabled = true;
  try {
    const res = await fetch("/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: ui.language.value,
        question_id: ui.question.value || null,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const { url, token, room: roomName } = await res.json();

    currentSession = roomName;
    ui.sessionId.textContent = roomName;
    ui.erase.hidden = true;
    ui.transcript.replaceChildren();
    ui.turns.replaceChildren();

    room = new LK.Room({ adaptiveStream: true, dynacast: true });
    room.on(LK.RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === LK.Track.Kind.Audio) track.attach();
    });
    room.on(LK.RoomEvent.DataReceived, onData);
    room.on(LK.RoomEvent.TranscriptionReceived, onTranscription);
    room.on(LK.RoomEvent.Disconnected, () => hangUp(true));

    await room.connect(url, token);
    await room.localParticipant.setMicrophoneEnabled(true);

    setState("live", "live");
    ui.call.textContent = "Hang up";
  } catch (err) {
    setState(String(err.message || err).slice(0, 80), "error");
    room = null;
    ui.call.textContent = "Start call";
  } finally {
    ui.call.disabled = false;
  }
}

async function hangUp(alreadyClosed = false) {
  if (room && !alreadyClosed) await room.disconnect();
  room = null;
  ui.call.textContent = "Start call";
  setState("ended", "idle");
  ui.erase.hidden = !currentSession;
}

function onTranscription(segments, participant) {
  const isCoach = participant?.identity !== room?.localParticipant?.identity;
  for (const seg of segments) {
    if (!seg.final) continue;
    addLine(isCoach ? "coach" : "you", seg.text);
  }
}

function addLine(who, text) {
  const div = document.createElement("div");
  div.className = `line ${who}`;
  div.innerHTML = `<b>${who === "coach" ? "Coach" : "You"}</b>`;
  div.append(document.createTextNode(text));
  ui.transcript.append(div);
  ui.transcript.scrollTop = ui.transcript.scrollHeight;
}

function onData(payload, _participant, _kind, topic) {
  if (topic !== METRICS_TOPIC) return;
  let data;
  try {
    data = JSON.parse(new TextDecoder().decode(payload));
  } catch {
    return;
  }
  renderMetrics(data);
}

function renderMetrics({ summary = {}, turns = [] }) {
  const ms = (v) => (v ? `${Math.round(v * 1000)}ms` : "—");
  setTile("m-p95", ms(summary.p95_latency), summary.p95_latency > LATENCY_BUDGET);
  setTile("m-p50", ms(summary.p50_latency), summary.p50_latency > LATENCY_BUDGET);
  setTile("m-ttft", ms(summary.mean_llm_ttft));
  setTile("m-ttfb", ms(summary.mean_tts_ttfb));
  setTile("m-int", summary.interruptions ?? "—");
  setTile("m-bc", summary.backchannels ?? "—");
  setTile("m-cost", summary.total_cost_usd ? `$${summary.total_cost_usd.toFixed(4)}` : "—");

  ui.turns.replaceChildren();
  for (const t of turns) {
    const tr = document.createElement("tr");
    if (t.e2e_latency > LATENCY_BUDGET) tr.className = "over";
    for (const cell of [
      t.turn_index,
      ms(t.eou_delay),
      ms(t.transcription_delay),
      ms(t.llm_ttft),
      ms(t.tts_ttfb),
      ms(t.e2e_latency),
      t.cost_usd ? t.cost_usd.toFixed(4) : "—",
    ]) {
      const td = document.createElement("td");
      td.textContent = cell;
      tr.append(td);
    }
    ui.turns.append(tr);
  }
}

function setTile(id, value, over = false) {
  const node = el(id);
  node.textContent = value;
  node.parentElement.classList.toggle("over", over);
}

async function erase() {
  if (!currentSession) return;
  await fetch(`/api/sessions/${currentSession}`, { method: "DELETE" });
  ui.erase.hidden = true;
  ui.sessionId.textContent = `${currentSession} — deleted`;
  currentSession = null;
}
