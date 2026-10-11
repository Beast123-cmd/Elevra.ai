"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------------------------
// Text to speech: ElevenLabs via POST /tts, falling back to the browser's built-in voice.
// ---------------------------------------------------------------------------------------------

let current: HTMLAudioElement | null = null;

export function stopSpeaking() {
  current?.pause();
  current = null;
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}

function browserVoice(text: string, onEnd?: () => void): boolean {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-IN";
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
  return true;
}

/**
 * Reads text aloud: ElevenLabs via POST /tts first, then the browser's built-in voice as the non-AI fallback.
 * Returns which voice was used, or "none" if neither is available. `onEnd` runs when speech finishes.
 */
export async function speak(text: string, useApi = true, onEnd?: () => void): Promise<"elevenlabs" | "browser" | "none"> {
  stopSpeaking();
  if (useApi) {
    try {
      const { data } = await createClient().auth.getSession();
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ text }),
      });
      if (!r.ok) throw new Error(`tts ${r.status}`);
      const url = URL.createObjectURL(await r.blob());
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); if (current === audio) onEnd?.(); };
      current = audio;
      await audio.play();
      return "elevenlabs";
    } catch {
      // fall through to the browser voice
    }
  }
  if (browserVoice(text, onEnd)) return "browser";
  onEnd?.();
  return "none";
}

// Short acknowledgements played the moment a student sends an answer, so the interviewer responds instantly while the
// next question is being written. Fetched once in advance and kept as in-memory audio.
const clips = new Map<string, Promise<string | null>>();

async function fetchClip(text: string): Promise<string | null> {
  try {
    const { data } = await createClient().auth.getSession();
    const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify({ text }),
    });
    return r.ok ? URL.createObjectURL(await r.blob()) : null;
  } catch {
    return null;
  }
}

/** Fetch the given phrases in the interviewer's voice ahead of time. Safe to call more than once. */
export function preloadClips(texts: string[]) {
  texts.forEach((t) => { if (!clips.has(t)) clips.set(t, fetchClip(t)); });
}

/** Play a preloaded phrase right away. Does nothing if it isn't ready, so it never delays anything. */
export async function playClip(text: string) {
  const url = await Promise.race([clips.get(text) ?? Promise.resolve(null), new Promise<null>((r) => setTimeout(() => r(null), 50))]);
  if (!url) return;
  stopSpeaking();
  const audio = new Audio(url);
  current = audio;
  audio.play().catch(() => { /* autoplay blocked: skip silently */ });
}

// ---------------------------------------------------------------------------------------------
// Speech to text: ElevenLabs Scribe v2 Realtime streamed from the browser, falling back to the
// browser's own SpeechRecognition (Chrome/Edge) if ElevenLabs is unavailable.
// ---------------------------------------------------------------------------------------------

const SCRIBE_URL = "wss://api.elevenlabs.io/v1/speech-to-text/realtime";
const TARGET_RATE = 16000;
const CHUNK_SAMPLES = 1600;          // 100 ms at 16 kHz per WebSocket message
const TOKEN_MAX_AGE_MS = 10 * 60e3;  // tokens are single-use and expire after 15 minutes
const FLUSH_WAIT_MS = 1200;          // how long Stop waits for the last words
const ERROR_TYPES = new Set(["error", "auth_error", "quota_exceeded", "commit_throttled", "unaccepted_terms", "rate_limited",
  "queue_overflow", "resource_exhausted", "session_time_limit_exceeded", "input_error", "invalid_request",
  "chunk_size_exceeded", "transcriber_error"]);

// Copies raw microphone samples to the main thread.
const WORKLET = `class Tap extends AudioWorkletProcessor{process(i){const c=i[0]&&i[0][0];if(c)this.port.postMessage(c.slice(0));return true}}registerProcessor("pcm-tap",Tap);`;

/** Averages input samples down to 16 kHz and converts them to 16-bit PCM, carrying leftovers between calls. */
function makeDownsampler(inRate: number) {
  const ratio = inRate / TARGET_RATE;
  let carry = new Float32Array(0);
  return (input: Float32Array): Int16Array => {
    const data = new Float32Array(carry.length + input.length);
    data.set(carry); data.set(input, carry.length);
    const n = Math.floor(data.length / ratio);
    const out = new Int16Array(n);
    for (let i = 0; i < n; i++) {
      const start = Math.floor(i * ratio), end = Math.max(start + 1, Math.floor((i + 1) * ratio));
      let sum = 0;
      for (let j = start; j < end; j++) sum += data[j];
      const s = Math.max(-1, Math.min(1, sum / (end - start)));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    carry = data.slice(Math.floor(n * ratio));
    return out;
  };
}

function toBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...Array.from(bytes.subarray(i, i + 0x8000)));
  return btoa(s);
}

// Minimal typing for the Web Speech API, which TypeScript's DOM library doesn't include.
interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
  start(): void; stop(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Engine = "elevenlabs" | "browser";
interface Mic { ctx: AudioContext; stream: MediaStream; node: AudioWorkletNode }

/**
 * Live speech-to-text for the interview room. `onCommitted` receives each finished phrase; `partial` holds the words
 * currently being spoken. `stop()` resolves once the last words have arrived, so callers can await it before sending.
 */
export function useLiveTranscription(sessionId: number | null, onCommitted: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState("");
  const [engine, setEngine] = useState<Engine | null>(null);
  const [error, setError] = useState<string | null>(null);

  const committed = useRef(onCommitted);
  committed.current = onCommitted;
  const engineRef = useRef<Engine | null>(null);
  const mic = useRef<Mic | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const sending = useRef(false);
  const queue = useRef<Int16Array[]>([]);
  const queued = useRef(0);
  const partialRef = useRef("");
  const flushWaiter = useRef<(() => void) | null>(null);
  const token = useRef<{ at: number; p: Promise<{ token: string; keyterms: string[] }> } | null>(null);
  const rec = useRef<Recognition | null>(null);
  const wantBrowser = useRef(false);

  useEffect(() => {
    setSupported(!!navigator.mediaDevices?.getUserMedia || recognitionCtor() !== null);
  }, []);

  const setPartialBoth = (t: string) => { partialRef.current = t; setPartial(t); };
  const emit = (t: string) => { const s = t.trim(); if (s) committed.current(s); };

  /** Fetch a token ahead of time (e.g. while the interviewer is speaking) so the mic starts instantly. */
  const prefetch = useCallback(() => {
    if (token.current && Date.now() - token.current.at < TOKEN_MAX_AGE_MS) return;
    const p = api<{ token: string; keyterms: string[] }>("/stt-token", { session_id: sessionId });
    p.catch(() => { if (token.current?.p === p) token.current = null; });
    token.current = { at: Date.now(), p };
  }, [sessionId]);

  /** Send everything queued from the mic as one chunk; `commit` asks ElevenLabs for a final transcript now. */
  const drain = useCallback((commit = false) => {
    if (queued.current === 0 && !commit) return;
    const pcm = new Int16Array(Math.max(queued.current, commit ? CHUNK_SAMPLES : 0));
    let o = 0;
    for (const q of queue.current) { pcm.set(q, o); o += q.length; }
    queue.current = []; queued.current = 0;
    if (ws.current?.readyState !== WebSocket.OPEN) return;
    ws.current.send(JSON.stringify({ message_type: "input_audio_chunk", audio_base_64: toBase64(pcm), commit, sample_rate: TARGET_RATE }));
  }, []);

  async function ensureMic(): Promise<Mic> {
    if (mic.current) {
      if (mic.current.ctx.state === "suspended") await mic.current.ctx.resume();
      return mic.current;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    const ctx = new AudioContext();
    const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const node = new AudioWorkletNode(ctx, "pcm-tap");
    const mute = ctx.createGain();
    mute.gain.value = 0; // keeps the graph running without playing the mic back
    ctx.createMediaStreamSource(stream).connect(node).connect(mute).connect(ctx.destination);
    const down = makeDownsampler(ctx.sampleRate);
    node.port.onmessage = (e: MessageEvent<Float32Array>) => {
      if (!sending.current) return;
      const pcm = down(e.data);
      queue.current.push(pcm); queued.current += pcm.length;
      if (queued.current >= CHUNK_SAMPLES) drain();
    };
    if (ctx.state === "suspended") await ctx.resume();
    mic.current = { ctx, stream, node };
    return mic.current;
  }

  async function startElevenLabs() {
    // Request microphone access before the token/network round-trip. This also surfaces browser
    // permission failures in the same turn that the student chooses Speak.
    await ensureMic();
    prefetch();
    const { token: t, keyterms } = await token.current!.p;
    token.current = null; // single use
    const q = new URLSearchParams({ model_id: "scribe_v2_realtime", audio_format: "pcm_16000", commit_strategy: "vad", language_code: "en", token: t });
    keyterms.forEach((k) => q.append("keyterms", k));
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(`${SCRIBE_URL}?${q}`);
      ws.current = socket;
      const timer = setTimeout(() => reject(new Error("timeout")), 6000);
      socket.onmessage = (ev) => {
        const m = JSON.parse(ev.data as string) as { message_type: string; text?: string };
        if (m.message_type === "session_started") { clearTimeout(timer); resolve(); }
        else if (m.message_type === "partial_transcript") setPartialBoth(m.text ?? "");
        else if (m.message_type === "committed_transcript") {
          emit(m.text ?? ""); setPartialBoth("");
          flushWaiter.current?.();
        } else if (ERROR_TYPES.has(m.message_type)) { clearTimeout(timer); reject(new Error(m.message_type)); socket.close(); }
      };
      socket.onerror = () => { clearTimeout(timer); reject(new Error("socket")); };
      socket.onclose = () => {
        if (ws.current === socket) { ws.current = null; sending.current = false; setListening(false); setPartialBoth(""); }
      };
    });
    sending.current = true;
  }

  function startBrowser() {
    const Ctor = recognitionCtor();
    if (!Ctor) throw new Error("no recognition");
    wantBrowser.current = true;
    const run = () => {
      const r = new Ctor();
      r.lang = "en-IN"; r.continuous = true; r.interimResults = true;
      r.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) emit(e.results[i][0].transcript);
          else interim += e.results[i][0].transcript;
        }
        setPartialBoth(interim);
      };
      // Chrome stops by itself after a silence; restart while the student still wants to talk.
      r.onerror = (e) => {
        const messages: Record<string, string> = {
          "not-allowed": "Microphone access is blocked. Allow it for this site in your browser settings, then try Speak again.",
          "service-not-allowed": "Browser speech recognition is unavailable. Try Chrome or Edge, or type your answer.",
          "audio-capture": "No microphone was detected. Connect a microphone or type your answer.",
          network: "Speech recognition couldn't connect. Check your connection, or type your answer.",
          "language-not-supported": "Speech recognition does not support the selected language in this browser.",
        };
        setError(messages[e.error] ?? "Voice input stopped. Try Speak again, or type your answer.");
        if (["not-allowed", "service-not-allowed", "audio-capture", "network", "language-not-supported"].includes(e.error)) {
          wantBrowser.current = false;
          setListening(false);
        }
      };
      r.onend = () => {
        rec.current = null;
        if (wantBrowser.current) setTimeout(() => { if (wantBrowser.current) run(); }, 250);
        else { setListening(false); setPartialBoth(""); }
      };
      rec.current = r;
      r.start();
    };
    run();
  }

  /** Start listening. Tries ElevenLabs first, then the browser's recognition. Rejects if neither works. */
  const start = useCallback(async () => {
    if (listening) return;
    setListening(true); setPartialBoth(""); setError(null);
    try {
      await startElevenLabs();
      engineRef.current = "elevenlabs"; setEngine("elevenlabs");
    } catch (elevenLabsError) {
      ws.current?.close(); ws.current = null; sending.current = false;
      try {
        startBrowser();
        engineRef.current = "browser"; setEngine("browser");
      } catch (e) {
        setListening(false);
        const name = e instanceof Error ? e.name : "";
        const message = name === "NotAllowedError" || name === "PermissionDeniedError"
          ? "Microphone access is blocked. Allow it for this site in your browser settings, then try Speak again."
          : name === "NotFoundError" || name === "DevicesNotFoundError"
            ? "No microphone was detected. Connect a microphone or type your answer."
            : elevenLabsError instanceof Error && elevenLabsError.message === "no recognition"
              ? "Voice input is not supported in this browser. Try Chrome or Edge, or type your answer."
              : "Voice input couldn't start. Check microphone permissions and try again, or type your answer.";
        setError(message);
        throw e;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, prefetch]);

  /** Stop listening and wait (briefly) for the last words, so the full answer is in before sending. */
  const stop = useCallback(async () => {
    if (engineRef.current === "browser") {
      wantBrowser.current = false;
      const r = rec.current;
      if (r) {
        await new Promise<void>((resolve) => {
          const done = () => resolve();
          r.onend = () => { rec.current = null; setListening(false); emit(partialRef.current); setPartialBoth(""); done(); };
          setTimeout(done, FLUSH_WAIT_MS);
          r.stop();
        });
      }
      setListening(false);
      return;
    }
    const socket = ws.current;
    if (!socket) { setListening(false); return; }
    sending.current = false;
    if (socket.readyState === WebSocket.OPEN) {
      const pendingWords = partialRef.current;
      drain(true); // send what's left and ask for a final transcript
      if (pendingWords) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(() => { flushWaiter.current = null; emit(partialRef.current); setPartialBoth(""); resolve(); }, FLUSH_WAIT_MS);
          flushWaiter.current = () => { clearTimeout(timer); flushWaiter.current = null; resolve(); };
        });
      }
    }
    ws.current = null;
    socket.close();
    setListening(false); setPartialBoth("");
  }, [drain]);

  /** Release the microphone completely (end of interview / leaving the page). */
  const dispose = useCallback(() => {
    wantBrowser.current = false;
    rec.current?.stop();
    sending.current = false;
    ws.current?.close(); ws.current = null;
    mic.current?.stream.getTracks().forEach((t) => t.stop());
    void mic.current?.ctx.close();
    mic.current = null;
    setListening(false); setPartialBoth("");
  }, []);

  useEffect(() => dispose, [dispose]);

  return { supported, listening, partial, engine, error, start, stop, prefetch, dispose };
}
