import React, { useEffect, useRef, useState, useCallback } from "react";
import { Brain, Volume2, VolumeX, RotateCcw, Radio } from "lucide-react";

const EMOTION_COLORS = {
  Need: "#7C5CFC",
  Urgent: "#FF5C5C",
  Affirm: "#34D399",
  Deny: "#8890A6",
  Warm: "#FF6B4A",
};

const INTENTS = [
  { id: "water", label: "Water", phrase: "I need water", emotion: "Need", freq: 3, followUps: ["Thank you", "More please", "I'm okay now"] },
  { id: "help", label: "Help", phrase: "I need help", emotion: "Urgent", freq: 6.2, followUps: ["Come here", "Call someone", "Thank you"] },
  { id: "yes", label: "Yes", phrase: "Yes", emotion: "Affirm", freq: 2, followUps: ["Thank you", "Continue"] },
  { id: "no", label: "No", phrase: "No", emotion: "Deny", freq: 2.4, followUps: ["Not now", "Try again"] },
  { id: "pain", label: "Pain", phrase: "I am in pain", emotion: "Urgent", freq: 7, followUps: ["Call a nurse", "It hurts here", "Give me a moment"] },
  { id: "thanks", label: "Thank You", phrase: "Thank you", emotion: "Warm", freq: 2.6, followUps: ["You're kind", "I appreciate it"] },
  { id: "bathroom", label: "Bathroom", phrase: "I need the bathroom", emotion: "Need", freq: 4.1, followUps: ["Please hurry", "Thank you"] },
  { id: "love", label: "Love You", phrase: "I love you", emotion: "Warm", freq: 3.6, followUps: ["Thank you", "Me too"] },
];

const STAGES = ["Signal Acquisition", "Signal Processing", "Speech / Text Conversion", "Output"];

function buildCandidates(intent) {
  const others = INTENTS.filter((i) => i.id !== intent.id).sort(() => Math.random() - 0.5).slice(0, 2);
  const top = 78 + Math.floor(Math.random() * 15);
  const remaining = 100 - top;
  const c2 = Math.floor(remaining * 0.6);
  const c3 = remaining - c2;
  return [
    { label: intent.label, confidence: top, correct: true },
    { label: others[0].label, confidence: c2 },
    { label: others[1].label, confidence: c3 },
  ].sort((a, b) => b.confidence - a.confidence);
}

export default function NeuroVoiceDemo() {
  const [phase, setPhase] = useState("idle"); // idle | acquiring | processing | converting | output
  const [selected, setSelected] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [typedText, setTypedText] = useState("");
  const [history, setHistory] = useState([]);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [voices, setVoices] = useState([]);
  const [voiceIdx, setVoiceIdx] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const canvasRef = useRef(null);
  const phaseRef = useRef("idle");
  const freqRef = useRef(2);
  const colorRef = useRef("#7C5CFC");
  const timeouts = useRef([]);
  const typeInterval = useRef(null);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  useEffect(() => {
    function loadVoices() {
      const v = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
      if (v.length) {
        const en = v.filter((x) => x.lang && x.lang.startsWith("en"));
        setVoices(en.length ? en : v);
      }
    }
    loadVoices();
    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (selected) {
      colorRef.current = EMOTION_COLORS[selected.emotion];
      if (phase === "acquiring") freqRef.current = selected.freq;
    }
    if (phase === "idle" || phase === "output") freqRef.current = 2;
  }, [selected, phase]);

  // waveform animation loop — runs once, reads live values via refs
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let raf;
    let t = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = 150 * dpr;
      canvas.style.width = rect.width + "px";
      canvas.style.height = "150px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      t += 0.06;
      const w = canvas.clientWidth,
        h = 150;
      ctx.clearRect(0, 0, w, h);

      const ph = phaseRef.current;
      const f = freqRef.current;
      let amp = 14,
        mainFreq = 0.028,
        secWeight = 0.15,
        noiseAmp = 3;
      if (ph === "acquiring") {
        amp = 44;
        mainFreq = 0.018 + f * 0.0035;
        secWeight = 0.42;
        noiseAmp = 6;
      } else if (ph === "processing") {
        amp = 24;
        mainFreq = 0.03;
        secWeight = 0.25;
        noiseAmp = 3;
      } else if (ph === "converting") {
        amp = 8;
        mainFreq = 0.02;
        secWeight = 0.1;
        noiseAmp = 1.5;
      }
      const secFreq = mainFreq * 2.3;

      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const y =
          h / 2 +
          Math.sin(x * mainFreq + t) * amp +
          Math.sin(x * secFreq + t * 1.4) * amp * secWeight +
          (Math.random() - 0.5) * noiseAmp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = colorRef.current;
      ctx.lineWidth = 2;
      ctx.shadowColor = colorRef.current;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // center reference line
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const clearTimers = () => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
    if (typeInterval.current) clearInterval(typeInterval.current);
  };

  useEffect(() => () => clearTimers(), []);

  const speak = useCallback(
    (text) => {
      if (muted) return;
      try {
        if (!("speechSynthesis" in window)) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = rate;
        u.pitch = pitch;
        if (voices[voiceIdx]) u.voice = voices[voiceIdx];
        u.onstart = () => setSpeaking(true);
        u.onend = () => setSpeaking(false);
        window.speechSynthesis.speak(u);
      } catch (e) {
        // speech synthesis unavailable in this environment — text output still works
      }
    },
    [muted, rate, pitch, voices, voiceIdx]
  );

  function typeText(text, onDone) {
    setTypedText("");
    let i = 0;
    typeInterval.current = setInterval(() => {
      i += 1;
      setTypedText(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(typeInterval.current);
        onDone && onDone();
      }
    }, 28);
  }

  function runPipeline(intent) {
    if (phase !== "idle" && phase !== "output") return;
    clearTimers();
    setSelected(intent);
    setCandidates([]);
    setTypedText("");
    setPhase("acquiring");

    timeouts.current.push(
      setTimeout(() => {
        setPhase("processing");
        setCandidates(buildCandidates(intent));
        timeouts.current.push(
          setTimeout(() => {
            setPhase("converting");
            typeText(intent.phrase, () => {
              setPhase("output");
              speak(intent.phrase);
              setHistory((h) => [{ text: intent.phrase, emotion: intent.emotion, id: Date.now() }, ...h].slice(0, 6));
            });
          }, 900)
        );
      }, 1100)
    );
  }

  function quickReply(text) {
    clearTimers();
    setPhase("output");
    setTypedText(text);
    speak(text);
    setHistory((h) => [{ text, emotion: selected ? selected.emotion : "Warm", id: Date.now() }, ...h].slice(0, 6));
  }

  function reset() {
    clearTimers();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setPhase("idle");
    setSelected(null);
    setCandidates([]);
    setTypedText("");
    setSpeaking(false);
  }

  const activeColor = selected ? EMOTION_COLORS[selected.emotion] : "#7C5CFC";
  const stageIndex = { idle: -1, acquiring: 0, processing: 1, converting: 2, output: 3 }[phase];

  return (
    <div style={styles.page}>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .intentBtn:hover { border-color: rgba(255,255,255,0.35) !important; transform: translateY(-1px); }
        .chip:hover { background: rgba(255,255,255,0.14) !important; }
        ::selection { background: #7C5CFC55; }
      `}</style>

      <header style={styles.header}>
        <div style={styles.brandRow}>
          <div style={styles.brandMark}>
            <Brain size={18} color="#0B0E14" />
          </div>
          <span style={styles.brandName}>NeuroVoice</span>
        </div>
        <h1 style={styles.h1}>From thought to voice, in real time.</h1>
        <p style={styles.sub}>
          A live, simulated walkthrough of the pipeline: neural or muscle signal in, natural speech out. No
          headset required here — this demo classifies synthetic signal patterns to show how the real system responds.
        </p>
      </header>

      {/* pipeline strip */}
      <div style={styles.stageStrip}>
        {STAGES.map((s, i) => (
          <div key={s} style={styles.stageItem}>
            <div
              style={{
                ...styles.stageDot,
                background: i <= stageIndex ? activeColor : "#232838",
                boxShadow: i === stageIndex ? `0 0 12px ${activeColor}` : "none",
              }}
            />
            <span style={{ ...styles.stageLabel, color: i <= stageIndex ? "#EDEFF5" : "#5B6478" }}>{s}</span>
            {i < STAGES.length - 1 && (
              <div style={{ ...styles.stageLine, background: i < stageIndex ? activeColor : "#232838" }} />
            )}
          </div>
        ))}
      </div>

      <div style={styles.grid}>
        {/* LEFT: intent selection */}
        <div style={styles.panel}>
          <div style={styles.panelLabel}>
            <Radio size={13} /> &nbsp;SIMULATED INTENT
          </div>
          <p style={styles.panelHint}>Pick a cue to simulate the signal a user would produce.</p>
          <div style={styles.intentGrid}>
            {INTENTS.map((intent) => (
              <button
                key={intent.id}
                className="intentBtn"
                onClick={() => runPipeline(intent)}
                disabled={phase !== "idle" && phase !== "output"}
                style={{
                  ...styles.intentBtn,
                  borderColor: selected?.id === intent.id ? EMOTION_COLORS[intent.emotion] : "rgba(255,255,255,0.1)",
                  opacity: phase !== "idle" && phase !== "output" ? 0.5 : 1,
                }}
              >
                <span style={{ ...styles.intentDot, background: EMOTION_COLORS[intent.emotion] }} />
                {intent.label}
              </button>
            ))}
          </div>
          <button onClick={reset} style={styles.resetBtn}>
            <RotateCcw size={13} /> &nbsp;Reset session
          </button>
        </div>

        {/* CENTER: waveform + classification */}
        <div style={styles.panel}>
          <div style={styles.panelLabel}>
            {phase === "idle" && "AWAITING SIGNAL"}
            {phase === "acquiring" && "ACQUIRING SIGNAL…"}
            {phase === "processing" && "CLASSIFYING PATTERN…"}
            {(phase === "converting" || phase === "output") && "CONVERTED"}
          </div>
          <div style={styles.canvasWrap}>
            <canvas ref={canvasRef} style={{ display: "block", width: "100%" }} />
          </div>

          <div style={styles.candidates}>
            {candidates.length === 0 && phase !== "processing" && (
              <p style={{ ...styles.panelHint, marginTop: 10 }}>Classification confidence will appear here.</p>
            )}
            {candidates.map((c) => (
              <div key={c.label} style={styles.candRow}>
                <span style={{ ...styles.candLabel, color: c.correct ? "#EDEFF5" : "#8890A6" }}>{c.label}</span>
                <div style={styles.candTrack}>
                  <div
                    style={{
                      ...styles.candFill,
                      width: `${c.confidence}%`,
                      background: c.correct ? activeColor : "#3A4156",
                    }}
                  />
                </div>
                <span style={{ ...styles.candPct, color: c.correct ? activeColor : "#5B6478" }}>{c.confidence}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: output */}
        <div style={styles.panel}>
          <div style={styles.panelLabel}>OUTPUT INTERFACE</div>

          <div style={{ ...styles.outputCard, borderColor: selected ? activeColor + "55" : "rgba(255,255,255,0.1)" }}>
            {selected && (
              <span style={{ ...styles.emotionPill, background: activeColor + "22", color: activeColor }}>
                {selected.emotion}
              </span>
            )}
            <p style={styles.outputText}>
              {typedText || <span style={{ color: "#5B6478" }}>Recognized speech will appear here…</span>}
              {(phase === "converting") && <span style={styles.caret}>|</span>}
            </p>
            <div style={styles.outputRow}>
              <button
                onClick={() => selected && typedText && speak(typedText)}
                disabled={!typedText}
                style={{ ...styles.iconBtn, opacity: typedText ? 1 : 0.4 }}
                aria-label="Replay speech"
              >
                {speaking ? <Volume2 size={16} style={{ animation: "pulse 1s infinite" }} /> : <Volume2 size={16} />}
                &nbsp;Replay
              </button>
              <button onClick={() => setMuted((m) => !m)} style={styles.iconBtn} aria-label="Toggle mute">
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                &nbsp;{muted ? "Unmute" : "Mute"}
              </button>
            </div>
          </div>

          {phase === "output" && selected && (
            <div style={{ animation: "fadeUp .3s ease" }}>
              <p style={{ ...styles.panelHint, marginTop: 14, marginBottom: 8 }}>Predictive follow-ups</p>
              <div style={styles.chipRow}>
                {selected.followUps.map((f) => (
                  <button key={f} className="chip" onClick={() => quickReply(f)} style={styles.chip}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={styles.voiceControls}>
            <div style={styles.sliderRow}>
              <label style={styles.sliderLabel}>Rate</label>
              <input type="range" min="0.6" max="1.6" step="0.05" value={rate} onChange={(e) => setRate(parseFloat(e.target.value))} style={styles.slider} />
            </div>
            <div style={styles.sliderRow}>
              <label style={styles.sliderLabel}>Pitch</label>
              <input type="range" min="0.6" max="1.6" step="0.05" value={pitch} onChange={(e) => setPitch(parseFloat(e.target.value))} style={styles.slider} />
            </div>
            {voices.length > 0 && (
              <select value={voiceIdx} onChange={(e) => setVoiceIdx(parseInt(e.target.value))} style={styles.select}>
                {voices.map((v, i) => (
                  <option key={v.name + i} value={i}>
                    {v.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* history */}
      {history.length > 0 && (
        <div style={styles.historyWrap}>
          <p style={styles.panelLabel}>SESSION LOG</p>
          <div style={styles.historyList}>
            {history.map((h) => (
              <div key={h.id} style={styles.historyItem}>
                <span style={{ width: 6, height: 6, borderRadius: 99, background: EMOTION_COLORS[h.emotion], display: "inline-block" }} />
                {h.text}
              </div>
            ))}
          </div>
        </div>
      )}

      <footer style={styles.footer}>
        Concept demo for NeuroVoice — Real-Time Communication System for People with Hearing and Speech Disabilities.
        Signal patterns above are synthetic; the production system classifies live EEG/EMG input from wearable sensors.
      </footer>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#0B0E14",
    color: "#EDEFF5",
    fontFamily: "'Inter', sans-serif",
    padding: "48px 24px 32px",
  },
  header: { maxWidth: 720, margin: "0 auto 36px" },
  brandRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 22 },
  brandMark: { width: 28, height: 28, borderRadius: 8, background: "#7C5CFC", display: "flex", alignItems: "center", justifyContent: "center" },
  brandName: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, letterSpacing: 1, color: "#8890A6" },
  h1: { fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(28px,4vw,42px)", fontWeight: 600, lineHeight: 1.15, margin: "0 0 14px" },
  sub: { color: "#8890A6", fontSize: 15, lineHeight: 1.6, maxWidth: 560, margin: 0 },

  stageStrip: { maxWidth: 1040, margin: "0 auto 28px", display: "flex", alignItems: "center" },
  stageItem: { display: "flex", alignItems: "center", flex: 1 },
  stageDot: { width: 9, height: 9, borderRadius: 99, flexShrink: 0, transition: "all .3s ease" },
  stageLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, marginLeft: 8, whiteSpace: "nowrap", transition: "color .3s ease" },
  stageLine: { height: 1, flex: 1, marginLeft: 12, marginRight: 4, transition: "background .3s ease" },

  grid: { maxWidth: 1040, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", gap: 16 },
  panel: { background: "#12161F", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20, display: "flex", flexDirection: "column" },
  panelLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1, color: "#8890A6", display: "flex", alignItems: "center", marginBottom: 6 },
  panelHint: { fontSize: 13, color: "#5B6478", margin: 0, lineHeight: 1.5 },

  intentGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 },
  intentBtn: { display: "flex", alignItems: "center", gap: 8, background: "#171C28", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#EDEFF5", fontSize: 13, fontFamily: "'Inter', sans-serif", cursor: "pointer", transition: "all .15s ease" },
  intentDot: { width: 7, height: 7, borderRadius: 99, flexShrink: 0 },
  resetBtn: { marginTop: "auto", paddingTop: 16, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: "#5B6478", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer" },

  canvasWrap: { background: "#0B0E14", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", marginTop: 4, overflow: "hidden" },
  candidates: { marginTop: 16, display: "flex", flexDirection: "column", gap: 10 },
  candRow: { display: "flex", alignItems: "center", gap: 10 },
  candLabel: { fontSize: 12, width: 64, flexShrink: 0 },
  candTrack: { flex: 1, height: 6, background: "#1D2230", borderRadius: 99, overflow: "hidden" },
  candFill: { height: "100%", borderRadius: 99, transition: "width .5s ease" },
  candPct: { fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", width: 32, textAlign: "right" },

  outputCard: { position: "relative", background: "#171C28", border: "1px solid", borderRadius: 12, padding: "18px 16px 14px", minHeight: 110 },
  emotionPill: { fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", padding: "3px 8px", borderRadius: 99, letterSpacing: 0.5 },
  outputText: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 500, margin: "12px 0 14px", lineHeight: 1.35 },
  caret: { animation: "pulse .8s infinite" },
  outputRow: { display: "flex", gap: 8 },
  iconBtn: { display: "flex", alignItems: "center", background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, padding: "6px 10px", color: "#EDEFF5", fontSize: 12, cursor: "pointer" },

  chipRow: { display: "flex", flexWrap: "wrap", gap: 8 },
  chip: { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEFF5", fontSize: 12, borderRadius: 99, padding: "6px 12px", cursor: "pointer", transition: "background .15s ease" },

  voiceControls: { marginTop: "auto", paddingTop: 18, display: "flex", flexDirection: "column", gap: 10 },
  sliderRow: { display: "flex", alignItems: "center", gap: 10 },
  sliderLabel: { fontSize: 11, color: "#5B6478", width: 34, fontFamily: "'IBM Plex Mono', monospace" },
  slider: { flex: 1, accentColor: "#7C5CFC" },
  select: { background: "#171C28", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEFF5", fontSize: 12, borderRadius: 8, padding: "6px 8px" },

  historyWrap: { maxWidth: 1040, margin: "24px auto 0" },
  historyList: { display: "flex", flexDirection: "column", gap: 8, marginTop: 10 },
  historyItem: { display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#B4BBCC", background: "#12161F", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "8px 12px" },

  footer: { maxWidth: 1040, margin: "40px auto 0", fontSize: 11, color: "#3F475C", lineHeight: 1.6, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16 },
};
