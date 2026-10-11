"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

let current: HTMLAudioElement | null = null;

export function stopSpeaking() {
  current?.pause();
  current = null;
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}

function browserVoice(text: string): boolean {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-IN";
  window.speechSynthesis.speak(u);
  return true;
}

/**
 * Reads text aloud: ElevenLabs via POST /tts first, then the browser's built-in voice as the non-AI fallback.
 * Returns which voice was used, or "none" if neither is available.
 */
export async function speak(text: string, useApi = true): Promise<"elevenlabs" | "browser" | "none"> {
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
      const audio = new Audio(URL.createObjectURL(await r.blob()));
      current = audio;
      await audio.play();
      return "elevenlabs";
    } catch {
      // fall through to the browser voice
    }
  }
  return browserVoice(text) ? "browser" : "none";
}

// Minimal typing for the Web Speech API, which TypeScript's DOM library doesn't include.
interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
  start(): void; stop(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Speech-to-text from the browser. `supported` is false in browsers without it, so callers keep typing as the fallback. */
export function useSpeechInput(onFinalText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const callback = useRef(onFinalText);
  callback.current = onFinalText;

  useEffect(() => { setSupported(recognitionCtor() !== null); }, []);

  const stop = useCallback(() => { rec.current?.stop(); }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor || rec.current) return;
    const r = new Ctor();
    r.lang = "en-IN"; r.continuous = true; r.interimResults = false;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) callback.current(e.results[i][0].transcript.trim());
      }
    };
    r.onend = () => { rec.current = null; setListening(false); };
    r.onerror = () => { rec.current = null; setListening(false); };
    rec.current = r;
    r.start();
    setListening(true);
  }, []);

  useEffect(() => () => rec.current?.stop(), []);
  return { supported, listening, start, stop };
}
