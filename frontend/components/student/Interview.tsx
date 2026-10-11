"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronDown, Expand, FileText, Mic, MicOff, Send, ShieldCheck, Upload, Volume2 } from "lucide-react";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { fmt } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { playClip, preloadClips, speak, stopSpeaking, useLiveTranscription } from "./voice";
import { CoachReport } from "./coach/CoachReport";
import type { CoachFeedback, PracticeTask } from "./coach/types";

// Played the moment an answer is sent (voice on), so the interviewer responds instantly while the next question is written.
const ACKS = ["Okay.", "Got it.", "Alright.", "I see.", "Thanks for that."];
import { StudentReveal } from "./StudentReveal";

type Stage = "intro" | "resume" | "technical" | "behavioural" | "wrapup";
interface Turn { role: "interviewer" | "candidate"; text: string }
interface TurnResponse {
  session_id?: number; message: string; stage: Stage; question_number: number; done: boolean; elapsed_sec: number; ai: boolean;
  mode?: "full" | "focus"; focus?: string[];
}
type Feedback = CoachFeedback;
interface FinishResponse {
  score_5: number; feedback: Feedback; ai: boolean; mock_interview_avg: number;
  old_success_score: number; new_success_score: number; old_placement: number | null; new_placement: number | null; transcript: Turn[];
  tasks?: PracticeTask[];
}

const MIN_RESUME = 20;
const MAX_RESUME = 8000;
const MAX_ANSWER = 4000;
const MAX_PDF_BYTES = 5 * 1024 * 1024;
const TARGET = "12–15 min";
const STAGES: { key: Stage; label: string }[] = [
  { key: "intro", label: "Introduction" }, { key: "resume", label: "Your resume" }, { key: "technical", label: "Technical" },
  { key: "behavioural", label: "Behavioural" }, { key: "wrapup", label: "Wrap-up" },
];
const CRITERIA: { key: keyof NonNullable<Feedback["criteria"]>; label: string }[] = [
  { key: "communication", label: "Communication" }, { key: "technical_depth", label: "Technical depth" },
  { key: "problem_solving", label: "Problem solving" }, { key: "project_knowledge", label: "Project knowledge" },
];

// Scripted responses for previewing with ?mock=1 when the API isn't running.
const MOCK_SCRIPT: [Stage, string][] = [
  ["intro", "Hi! I'm Elevra, and I'll be your interviewer today. This is a practice interview of about 12 to 15 minutes. To start, please introduce yourself."],
  ["intro", "Thanks. You mentioned web development. What got you interested in it?"],
  ["resume", "Tell me about the project on your resume you're most proud of. What was your own part in it?"],
  ["technical", "How does a database index speed up a query, and what does it cost?"],
  ["behavioural", "Tell me about a time you disagreed with a teammate. How did you handle it?"],
  ["wrapup", "Thank you, that's all from my side. Press Get my feedback to see how it went."],
];
const MOCK_FINISH: FinishResponse = {
  score_5: 3.8, ai: true, mock_interview_avg: 3.8, old_success_score: 56.4, new_success_score: 58.1, old_placement: 41, new_placement: 47, transcript: [],
  feedback: { criteria: { communication: 4, technical_depth: 3.5, problem_solving: 3.6, project_knowledge: 4.1 },
    strengths: ["Clear, structured introduction"], gaps: ["Go deeper on trade-offs"], next_steps: ["Practise explaining indexes with an example"], minutes: 13, questions: 13 },
};

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function errorDetail(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("detail" in payload)) return null;
  const detail = payload.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((entry) => entry && typeof entry === "object" && "msg" in entry && typeof entry.msg === "string" ? entry.msg : null)
      .filter((message): message is string => Boolean(message));
    return messages.length ? messages.join(" ") : null;
  }
  return null;
}

async function startInterview(body: ({ resume_text: string } | { resume_pdf_base64: string }) & { mode: "full" | "focus" }): Promise<TurnResponse> {
  const { data } = await createClient().auth.getSession();
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/interview/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify(body),
  });
  if (response.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("elevra:unauthorized"));
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const detail = errorDetail(payload);
    throw new Error(`API /interview/start failed: ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return response.json() as Promise<TurnResponse>;
}

function friendlyError(e: unknown, action: "start" | "answer" | "finish" | "early"): string {
  const msg = e instanceof Error ? e.message : "";
  if (/failed: (401|403)/.test(msg)) return "Your session has expired. Please sign in again.";
  if (/failed: 422/.test(msg)) {
    const detail = msg.match(/failed: 422: (.+)$/)?.[1];
    return detail ?? "We couldn't use that resume. Upload a PDF of up to 5 MB, or paste between 20 and 8,000 characters of text.";
  }
  if (/failed: 409/.test(msg)) return "This interview has ended. Get your feedback or start a new one.";
  if (/failed: 400/.test(msg)) return "Answer at least one question before finishing.";
  if (/API \/interview\/.*failed: 5\d\d/.test(msg)) {
    return action === "start"
      ? "The interview service couldn't start your session. Your resume is still selected; please try again shortly."
      : "The interview service encountered an error. Your response is still here; please try again shortly.";
  }
  if (e instanceof TypeError) {
    return action === "start"
      ? "Couldn't connect to the interview service. Your selected resume is still here; please try again once the service is available."
      : "Couldn't connect to the interview service. Your response is still here; please try again once the service is available.";
  }
  if (action === "start") return "We couldn't start the interview. Your selected resume is still here; please try again.";
  if (action === "answer") return "We couldn't send your response. It's still here; please try again.";
  if (action === "early") return "We couldn't submit the interview yet. Your session is still here; please try again.";
  return "We couldn't prepare your feedback. Your interview is saved; please try again.";
}

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

type Phase = "intro" | "room" | "result";

export function Interview() {
  const pathname = usePathname();
  const router = useRouter();
  const onInterviewPage = pathname === "/student/interview";
  const [mock, setMock] = useState(false);
  const [phase, setPhase] = useState<Phase>("intro");
  const [resume, setResume] = useState("");
  const [pdf, setPdf] = useState<{ name: string; base64: string } | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [autoListen, setAutoListen] = useState(true);
  const [focusNotice, setFocusNotice] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mode, setMode] = useState<"full" | "focus">("full");
  const [weakAreas, setWeakAreas] = useState<string[]>([]);       // student's unresolved focus areas, for the interview type choice
  const [practiceFocus, setPracticeFocus] = useState<string[]>([]); // areas being retested in this session

  const [sessionId, setSessionId] = useState<number | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [stage, setStage] = useState<Stage>("intro");
  const [questionNo, setQuestionNo] = useState(0);
  const [done, setDone] = useState(false);
  const [aiOffline, setAiOffline] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<null | "starting" | "thinking" | "marking">(null);
  const [speaking, setSpeaking] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FinishResponse | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const mockStep = useRef(0);
  const autoSendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendRef = useRef<() => Promise<void>>(async () => undefined);
  const pauseRequested = useRef(false);
  const autoListenRef = useRef(autoListen);
  const phaseRef = useRef(phase);
  const openingTurn = useRef<TurnResponse | null>(null);
  const interviewerSaysRef = useRef<(response: TurnResponse) => void>(() => undefined);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setMock(query.get("mock") === "1");
    if (query.get("mode") === "focus") setMode("focus"); // e.g. the "Practise my weak areas" button in Ask Elevra
  }, []);
  // Weak areas from earlier interviews (empty for a first interview, or before the coaching tables exist).
  useEffect(() => {
    if (mock) return;
    createClient().from("interview_focus_areas").select("label,times_seen").neq("status", "resolved")
      .order("times_seen", { ascending: false }).limit(3)
      .then(({ data }) => setWeakAreas((data ?? []).map((f) => f.label as string)));
  }, [mock]);
  useEffect(() => { autoListenRef.current = autoListen; }, [autoListen]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => {
    if (phase !== "room" || sessionId === null || !openingTurn.current) return;
    const firstQuestion = openingTurn.current;
    openingTurn.current = null;
    interviewerSaysRef.current(firstQuestion);
  }, [phase, sessionId]);

  // The answer lives in a ref as well as state: spoken words arrive asynchronously, and Send must read the latest text
  // after waiting for the microphone to flush.
  const draftRef = useRef("");
  const updateDraft = (text: string) => { draftRef.current = text; setDraft(text); };
  const mic = useLiveTranscription(sessionId, (text) => {
    const d = draftRef.current;
    updateDraft(d.trim() ? `${d.trimEnd()} ${text}` : text);
    if (autoSendTimer.current) clearTimeout(autoSendTimer.current);
    if (!pauseRequested.current && autoListenRef.current && phaseRef.current === "room" && document.visibilityState === "visible") {
      autoSendTimer.current = setTimeout(() => { void sendRef.current(); }, 1700);
    }
  });
  const micStart = mic.start;
  const micStop = mic.stop;
  const startListening = useCallback(() => {
    pauseRequested.current = false;
    stopSpeaking(); setSpeaking(false);
    micStart().catch(() => setVoiceNote("Voice input is unavailable. You can type your answer."));
  }, [micStart]);
  const pauseListening = useCallback(async () => {
    pauseRequested.current = true;
    if (autoSendTimer.current) clearTimeout(autoSendTimer.current);
    await micStop();
    // Stopping may flush a final transcript; keep it in the answer box without auto-submitting it.
    if (autoSendTimer.current) clearTimeout(autoSendTimer.current);
  }, [micStop]);

  // Timer, transcript auto-scroll, and silence on leaving the page.
  useEffect(() => {
    if (phase !== "room") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phase]);
  useEffect(() => {
    const handleFullscreen = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      if (phaseRef.current === "room" && !document.fullscreenElement) {
        setFocusNotice("The interview is still active. Return to full screen to continue.");
        void pauseListening();
        stopSpeaking(); setSpeaking(false);
      } else if (document.fullscreenElement) setFocusNotice(null);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && phaseRef.current === "room") {
        setFocusNotice("Interview paused while this tab is in the background. Return to continue.");
        void pauseListening(); stopSpeaking(); setSpeaking(false);
      } else if (document.visibilityState === "visible" && phaseRef.current === "room") {
        if (!document.fullscreenElement) setFocusNotice("The interview is still active. Return to full screen to continue.");
        else {
          setFocusNotice(null);
          if (autoListenRef.current && !done) startListening();
        }
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreen);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreen);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [done, micStart, pauseListening, startListening]);
  useEffect(() => {
    if (phase !== "room" && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }, [phase]);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [turns, busy]);
  useEffect(() => () => { stopSpeaking(); }, []);

  function interviewerSays(r: TurnResponse) {
    setTurns((t) => [...t, { role: "interviewer", text: r.message }]);
    setStage(r.stage); setQuestionNo(r.question_number); setDone(r.done);
    if (!r.ai) setAiOffline(true);
    if (!r.done && !mock) mic.prefetch();
    const listenAfter = () => { setSpeaking(false); if (autoListen && !r.done) startListening(); };
    if (!voiceOn) { listenAfter(); return; }
    setSpeaking(true);
    void speak(r.message, !mock, listenAfter).then((used) =>
      setVoiceNote(used === "browser" ? "Using your browser's voice because the AI voice is unavailable." : used === "none" ? "Your browser can't read text aloud." : null));
  }
  interviewerSaysRef.current = interviewerSays;

  function mockTurn(): TurnResponse {
    const i = Math.min(mockStep.current++, MOCK_SCRIPT.length - 1);
    return { session_id: 0, stage: MOCK_SCRIPT[i][0], message: MOCK_SCRIPT[i][1], question_number: i + 1, done: i === MOCK_SCRIPT.length - 1, elapsed_sec: 0, ai: true };
  }

  async function start() {
    if (busy) return;
    setBusy("starting"); setError(null);
    try {
      if (!document.documentElement.requestFullscreen) {
        setError("Full-screen mode is required for the interview. Please use a supported desktop browser.");
        return;
      }
      try {
        await document.documentElement.requestFullscreen({ navigationUI: "hide" });
        if (!document.fullscreenElement) throw new Error("Fullscreen was not entered");
        setIsFullscreen(true); setFocusNotice(null);
      } catch {
        setError("Full-screen mode is required. Allow full screen in your browser, then start the interview again.");
        return;
      }
      const body = { ...(pdf ? { resume_pdf_base64: pdf.base64 } : { resume_text: resume.trim() }), mode };
      const r = mock ? mockTurn() : await startInterview(body);
      setSessionId(r.session_id ?? null); setTurns([]); setStartedAt(Date.now() - r.elapsed_sec * 1000); setNow(Date.now());
      setPracticeFocus(r.mode === "focus" ? r.focus ?? [] : []);
      openingTurn.current = r;
      setPhase("room");
      if (voiceOn && !mock) preloadClips(ACKS);
    } catch (e) {
      setError(friendlyError(e, "start"));
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    } finally { setBusy(null); }
  }

  async function send() {
    if (busy || done || sessionId === null) return;
    if (autoSendTimer.current) clearTimeout(autoSendTimer.current);
    setBusy("thinking"); setError(null);
    stopSpeaking(); setSpeaking(false);
    await mic.stop(); // wait for the last spoken words to land in the answer
    const text = draftRef.current.trim();
    if (!text) { setBusy(null); return; }
    if (voiceOn && !mock && !done) void playClip(ACKS[Math.floor(Math.random() * ACKS.length)]);
    setTurns((t) => [...t, { role: "candidate", text }]); updateDraft("");
    try {
      const r = mock ? mockTurn() : await api<TurnResponse>("/interview/reply", { session_id: sessionId, answer_text: text });
      setStartedAt(Date.now() - r.elapsed_sec * 1000);
      interviewerSays(r);
    } catch (e) {
      setTurns((t) => t.slice(0, -1)); updateDraft(text); setError(friendlyError(e, "answer"));
    } finally { setBusy(null); }
  }
  sendRef.current = send;

  async function finish() {
    if (busy || sessionId === null) return;
    stopSpeaking(); setSpeaking(false); mic.dispose();
    setBusy("marking"); setError(null);
    try {
      const r = mock ? { ...MOCK_FINISH, transcript: turns } : await api<FinishResponse>("/interview/finish", { session_id: sessionId });
      setResult(r); setPhase("result");
    } catch (e) { setError(friendlyError(e, "finish")); } finally { setBusy(null); }
  }

  async function submitEarly() {
    if (busy || sessionId === null) return;
    if (autoSendTimer.current) clearTimeout(autoSendTimer.current);
    stopSpeaking(); setSpeaking(false); mic.dispose();
    setBusy("marking"); setError(null);
    try {
      if (!mock) await api<{ status: string; feedback_available: false }>("/interview/submit-early", { session_id: sessionId });
      reset();
      setFocusNotice("Interview submitted. No score or analytics were generated.");
      router.replace("/student/interview");
    } catch (e) { setError(friendlyError(e, "early")); }
    finally { setBusy(null); }
  }

  async function reenterFullscreen() {
    try { await document.documentElement.requestFullscreen({ navigationUI: "hide" }); setIsFullscreen(true); setFocusNotice(null); }
    catch { setFocusNotice("Full screen could not be restored. Your interview is still saved here."); }
  }

  async function choosePdf(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) { setError("Please choose a PDF file."); return; }
    if (file.size > MAX_PDF_BYTES) { setError("That PDF is larger than 5 MB. Try a smaller file or paste the text instead."); return; }
    try { setPdf({ name: file.name, base64: await readAsBase64(file) }); } catch { setError("We couldn't read that file. Try again or paste the text instead."); }
  }

  function reset() {
    if (autoSendTimer.current) clearTimeout(autoSendTimer.current);
    stopSpeaking(); mic.dispose(); mockStep.current = 0;
    setPhase("intro"); setSessionId(null); setTurns([]); setResult(null); setDone(false); updateDraft(""); setError(null);
    setStage("intro"); setQuestionNo(0); setAiOffline(false); setVoiceNote(null); setPracticeFocus([]);
  }

  const banner = mock && <p className="mb-4 rounded-md bg-risk-amber-bg px-3 py-2 text-sm text-risk-amber">Showing a scripted sample (?mock=1). Nothing is saved.</p>;
  const errorBox = error && <p role="alert" className="rounded-md bg-risk-red-bg px-3 py-2 text-sm text-risk-red">{error}</p>;

  // ---------- 1. Start ----------
  if (phase === "intro") {
    if (!onInterviewPage) return null;
    const len = resume.trim().length;
    const ready = pdf !== null || len >= MIN_RESUME;
    return (
      <div className="space-y-3">
        {banner}
        {focusNotice && <p role="status" className="rounded-lg bg-risk-green-bg px-4 py-3 text-sm text-emerald-900">{focusNotice}</p>}
        <StudentReveal key="interview-intro">
        <Card className="overflow-hidden rounded-2xl border-border bg-card shadow-sm shadow-slate-900/[0.03]">
          <CardHeader className="space-y-2 border-b border-border bg-muted/60 px-4 py-3.5 sm:px-6 sm:py-4">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-primary">
              <span className="rounded-full border border-border bg-card/80 px-2 py-0.5">{TARGET}</span>
              <span className="rounded-full border border-border bg-card/80 px-2 py-0.5">Resume-based</span>
              <span className="rounded-full border border-border bg-card/80 px-2 py-0.5">Voice · typing available</span>
            </div>
            <div>
              <CardTitle className="text-lg font-bold leading-tight tracking-tight text-foreground">Start a practice interview</CardTitle>
              <CardDescription className="mt-1 text-sm leading-5 text-muted-foreground">Add a resume to get questions about your experience and projects.</CardDescription>
            </div>
            <Link href="/student/interview/progress" className="w-fit text-xs font-semibold text-primary underline underline-offset-2 hover:text-primary">My interviews and progress</Link>
          </CardHeader>
          <CardContent className="space-y-3 px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs leading-4 text-muted-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <p>Your resume is used to create questions. Only a short summary is saved; the uploaded file is not.</p>
            </div>
            <section aria-labelledby="resume-heading" className="grid gap-3 sm:grid-cols-2 sm:items-start">
              <div className="space-y-2">
                <div>
                  <h2 id="resume-heading" className="text-sm font-semibold text-foreground">Your resume</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Upload a PDF (up to 5 MB).</p>
                </div>
                <div>
              {pdf ? (
                <div className="flex min-h-[64px] flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted px-3 py-2">
                  <span className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-card text-primary"><FileText className="h-4 w-4" aria-hidden="true" /></span><span className="min-w-0"><span className="block truncate text-sm font-semibold text-foreground">{pdf.name}</span><span className="text-xs text-muted-foreground">PDF ready to use</span></span></span>
                  <button type="button" onClick={() => setPdf(null)} className="rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground underline underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Remove</button>
                </div>
              ) : (
                <label className="group flex min-h-[64px] cursor-pointer items-center gap-2.5 rounded-xl border border-dashed border-border bg-muted px-3 py-2 transition-colors hover:border-primary hover:bg-muted focus-within:outline-none focus-within:ring-2 focus-within:ring-ring">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-primary transition-colors group-hover:bg-white"><Upload className="h-4 w-4" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-foreground">Choose a PDF resume</span><span className="mt-0.5 block text-xs text-muted-foreground">Up to 5 MB</span></span>
                  <span className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-primary">Browse</span>
                  <input type="file" accept="application/pdf,.pdf" className="sr-only"
                    onChange={(e) => { void choosePdf(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
              )}
                </div>
              </div>
              <div className={pdf ? "pointer-events-none space-y-2 opacity-50" : "space-y-2"} aria-disabled={pdf !== null}>
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="interview-resume-text" className="text-sm font-semibold text-foreground">{pdf ? "PDF selected" : "Or paste resume text"}</label>
                  {!pdf && <span className="text-[11px] tabular-nums text-muted-foreground">{len.toLocaleString()} / {MAX_RESUME.toLocaleString()}</span>}
                </div>
                <Textarea id="interview-resume-text" value={resume} onChange={(e) => setResume(e.target.value)} maxLength={MAX_RESUME} rows={3} disabled={pdf !== null}
                  placeholder="Education, projects, skills, internships…" aria-label="Resume text" className="min-h-24 resize-y border-border bg-card text-sm text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-ring disabled:bg-slate-50" />
                {!pdf && len > 0 && len < MIN_RESUME && <p className="text-xs text-muted-foreground">Add {MIN_RESUME - len} more characters to continue.</p>}
              </div>
            </section>
            {weakAreas.length > 0 && (
              <fieldset className="space-y-2">
                <legend className="mb-1.5 text-sm font-semibold text-foreground">Type of interview</legend>
                {([["full", "Full interview", "Introduction, your resume, technical and behavioural questions."],
                  ["focus", "Practise my weak areas", `Elevra retests what you found hard last time: ${weakAreas.join(", ")}.`]] as const).map(([value, title, desc]) => (
                  <label key={value} className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-4 py-3 text-sm transition-colors ${mode === value ? "border-primary bg-muted" : "border-border bg-card hover:bg-muted"}`}>
                    <input type="radio" name="interview-mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="mt-0.5 h-4 w-4 accent-primary" />
                    <span><span className="font-medium text-foreground">{title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{desc}</span></span>
                  </label>
                ))}
              </fieldset>
            )}
            <details className="group rounded-xl border border-border bg-muted px-3 py-2">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <span><span className="block">Voice settings <span className="font-normal text-muted-foreground">(optional)</span></span><span className="mt-0.5 block text-xs font-normal text-muted-foreground">You can complete the interview by typing.</span></span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <fieldset className="mt-2 space-y-2 border-t border-border pt-2 text-sm">
                <legend className="sr-only">Voice settings</legend>
                <label className="flex items-start gap-2 leading-5">
                  <input type="checkbox" checked={voiceOn} onChange={(e) => setVoiceOn(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
                  Speak the interviewer&apos;s questions aloud
                </label>
                <label className="flex items-start gap-2 leading-5">
                  <input type="checkbox" checked={autoListen} onChange={(e) => setAutoListen(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
                  Start listening automatically after each question (Chrome or Edge)
                </label>
              </fieldset>
            </details>
            {errorBox}
            {busy && <p role="status" aria-live="polite" className="flex items-center gap-2 text-xs font-medium text-primary"><span className="student-loading-dot" aria-hidden="true" /> Reading your resume and preparing the interview…</p>}
            <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-muted-foreground">{ready ? "Your practice session is ready to begin." : "Add a PDF or at least 20 characters of resume text to continue."}</p>
              <Button onClick={start} disabled={busy !== null || !ready} className="min-h-10 w-full gap-2 rounded-lg bg-primary px-5 font-semibold text-primary-foreground shadow-none hover:bg-primary/90 disabled:bg-muted disabled:text-slate-500 sm:w-auto">
                {busy === "starting" ? "Preparing…" : <>Start interview <ArrowRight className="h-4 w-4" aria-hidden="true" /></>}
              </Button>
            </div>
          </CardContent>
        </Card>
        </StudentReveal>
      </div>
    );
  }

  // ---------- 2. Interview room ----------
  if (phase === "room") {
    const elapsed = Math.max(0, (now - startedAt) / 1000);
    const stageIndex = STAGES.findIndex((s) => s.key === stage);
    return (
      <div className="fixed inset-0 z-[100] h-[100dvh] overflow-y-auto bg-muted px-3 py-3 text-foreground sm:px-6 sm:py-5">
        <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-2.5">
          <span className="text-sm font-semibold">Elevra practice interview <span className="ml-2 font-normal text-muted-foreground">{clock(elapsed)} · {STAGES[stageIndex]?.label}</span></span>
          <div className="flex items-center gap-2">
            {!isFullscreen && <Button type="button" size="sm" variant="outline" onClick={reenterFullscreen}><Expand className="mr-1 h-4 w-4" /> Return to full screen</Button>}
            <Button type="button" size="sm" variant="outline" onClick={submitEarly} disabled={busy !== null}>Submit interview</Button>
          </div>
        </div>
        {focusNotice && <p role="status" className="rounded-lg bg-risk-amber-bg px-4 py-2 text-sm text-amber-900">{focusNotice}</p>}
        {banner}
        {practiceFocus.length > 0 && (
          <p className="rounded-md bg-muted/60 px-3 py-2 text-sm text-primary">
            Focused practice: Elevra will come back to {practiceFocus.join(", ")}.
          </p>
        )}
        {aiOffline && (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-foreground">
            The AI interviewer is offline, so you&apos;re getting standard questions for your department. Your answers still count.
          </p>
        )}
        <StudentReveal key={`interview-room-${sessionId}`}>
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <Card className="h-fit rounded-xl border-border bg-card shadow-sm shadow-slate-900/[0.03]">
            <CardContent className="space-y-5 p-5">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className={`flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl font-semibold text-primary-foreground transition ${speaking ? "ring-4 ring-ring ring-offset-2 animate-pulse" : ""}`} aria-hidden>
                  E
                </div>
                <p className="font-medium">Elevra</p>
                <p className="h-4 text-xs text-muted-foreground" aria-live="polite">
                  {speaking ? "Speaking…" : busy === "thinking" ? "Thinking…" : mic.listening ? "Listening to you…" : done ? "Interview complete" : "Your turn"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-semibold tabular-nums">{clock(elapsed)}</p>
                <p className="text-xs text-muted-foreground">Target {TARGET} · Question {questionNo}</p>
              </div>
              <ol className="space-y-1.5 text-sm" aria-label="Interview stages">
                {STAGES.map((s, i) => (
                  <li key={s.key} className={`flex items-center gap-2 ${i === stageIndex ? "font-medium text-foreground" : i < stageIndex ? "text-muted-foreground" : "text-muted-foreground"}`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${i < stageIndex || (done && i === stageIndex) ? "bg-emerald-600 text-primary-foreground" : i === stageIndex ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {i < stageIndex || (done && i === stageIndex) ? <Check className="h-3 w-3" /> : i + 1}
                    </span>
                    {s.label}
                  </li>
                ))}
              </ol>
              {voiceNote && <p className="text-xs text-muted-foreground">{voiceNote}</p>}
            </CardContent>
          </Card>

          <Card className="flex min-h-[520px] flex-col rounded-xl border-border bg-card shadow-sm shadow-slate-900/[0.03]">
            <div ref={scroller} className="min-h-[220px] flex-1 space-y-3 overflow-y-auto p-4 sm:p-5" style={{ maxHeight: "calc(100dvh - 19rem)" }} aria-live="polite">
              {turns.map((t, i) => (
                <div key={i} className={`flex ${t.role === "candidate" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${t.role === "candidate" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                    {t.role === "interviewer" && (
                      <button type="button" onClick={() => { setSpeaking(true); void speak(t.text, !mock, () => setSpeaking(false)); }}
                        className="float-right ml-2 text-muted-foreground hover:text-foreground" aria-label="Play this question again">
                        <Volume2 className="h-4 w-4" />
                      </button>
                    )}
                    {t.text}
                  </div>
                </div>
              ))}
              {busy === "thinking" && <div className="w-fit rounded-2xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">Elevra is thinking…</div>}
            </div>

            <div className="space-y-2 border-t p-4">
              {errorBox}
              {done ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">The interviewer has wrapped up. Ready to see how you did?</p>
                  <Button onClick={finish} disabled={busy !== null}>{busy === "marking" ? "Marking your interview…" : "Get my feedback"}</Button>
                </div>
              ) : (
                <>
                  {/* While listening, the box shows the answer so far plus the words being spoken right now. */}
                  <Textarea
                    value={mic.listening && mic.partial ? `${draft}${draft.trim() ? " " : ""}${mic.partial}` : draft}
                    onChange={(e) => updateDraft(e.target.value)} readOnly={mic.listening} maxLength={MAX_ANSWER} rows={4}
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void send(); } }}
                    placeholder={mic.listening ? "Listening… speak naturally. Your answer sends after a short pause." : "Type an answer, or choose Speak to answer by voice."}
                    aria-label="Your answer" disabled={busy !== null} className={mic.listening ? "bg-muted" : ""} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {mic.supported && (
                        <Button type="button" size="sm" variant={mic.listening ? "default" : "outline"} aria-pressed={mic.listening}
                          onClick={() => { if (mic.listening) void pauseListening(); else startListening(); }} disabled={busy !== null}>
                          {mic.listening ? <><MicOff /> Pause</> : <><Mic /> Speak</>}
                        </Button>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {mic.listening ? "Listening · answer sends after a pause" : autoListen ? "Voice conversation ready" : "Ctrl+Enter to send"}
                      </span>
                    </div>
                    <Button size="sm" onClick={send} disabled={busy !== null || (!draft.trim() && !mic.listening)}>
                      <Send /> Send now
                    </Button>
                  </div>
                  {mic.error && <p role="alert" className="rounded-md bg-risk-red-bg px-3 py-2 text-xs leading-5 text-risk-red">{mic.error}</p>}
                </>
              )}
            </div>
          </Card>
        </div>
        </StudentReveal>
        </div>
        {!isFullscreen && (
          <div className="fixed inset-0 z-[120] grid place-items-center bg-primary p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="fullscreen-required-title">
            <div className="w-full max-w-md rounded-2xl border border-border bg-muted/50 p-6 text-center shadow-xl">
              <h2 id="fullscreen-required-title" className="text-lg font-semibold text-foreground">Full screen is required</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Your interview is still active. Return to full screen to continue.</p>
              <Button type="button" className="mt-5" onClick={reenterFullscreen}><Expand className="mr-2 h-4 w-4" /> Return to interview</Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------- 3. Results ----------
  if (phase === "result" && result) {
    if (!onInterviewPage) return null;
    const delta = result.new_success_score - result.old_success_score;
    const fb = result.feedback;
    const list = (title: string, items: string[], empty: string) => (
      <Card className="rounded-xl border-border bg-card shadow-sm shadow-slate-900/[0.03]">
        <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p>
            : <ul className="list-inside list-disc space-y-1.5 text-sm">{items.map((s) => <li key={s}>{s}</li>)}</ul>}
        </CardContent>
      </Card>
    );
    return (
      <div className="space-y-6">
        {banner}
        {!result.ai && (
          <p className="rounded-md bg-risk-amber-bg px-3 py-2 text-sm text-risk-amber">
            AI marking was offline, so this score only reflects how complete your answers were. Try again later for full feedback.
          </p>
        )}
        <StudentReveal key="interview-result">
        <Card className="rounded-xl border-border bg-card shadow-sm shadow-slate-900/[0.03]">
          <CardContent className="grid gap-6 p-6 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Interview score</p>
              <p className="text-5xl font-bold tabular-nums">{fmt(result.score_5, 1)}<span className="text-2xl text-muted-foreground"> / 5</span></p>
              <p className="mt-1 text-xs text-muted-foreground">
                {fb.questions ?? "—"} questions · {fb.minutes !== undefined ? `${fmt(fb.minutes, 0)} min` : "—"}
              </p>
            </div>
            <div className="space-y-2">
              {fb.criteria ? CRITERIA.map((c) => (
                <div key={c.key}>
                  <div className="flex justify-between text-sm"><span>{c.label}</span><span className="tabular-nums text-muted-foreground">{fmt(fb.criteria![c.key], 1)} / 5</span></div>
                  <Progress value={(fb.criteria![c.key] / 5) * 100} className="h-2" />
                </div>
              )) : <p className="text-sm text-muted-foreground">Detailed marks are unavailable for this interview.</p>}
            </div>
            <div className="md:text-right">
              <p className="text-sm text-muted-foreground">Success Score</p>
              <p className="text-3xl font-semibold tabular-nums">
                {fmt(result.old_success_score, 1)} → {fmt(result.new_success_score, 1)}
                <span className={`ml-2 text-lg ${delta >= 0 ? "text-risk-green" : "text-risk-red"}`}>({delta >= 0 ? "+" : ""}{delta.toFixed(1)})</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Placement readiness: {result.old_placement === null ? "not yet assessed" : fmt(result.old_placement, 0)} → {fmt(result.new_placement, 0)}
              </p>
              <p className="text-xs text-muted-foreground">Mock interview average now {fmt(result.mock_interview_avg, 1)} / 5</p>
            </div>
          </CardContent>
        </Card>
        </StudentReveal>
        <div className="grid gap-6 md:grid-cols-3">
          {list("What went well", fb.strengths, "Nothing stood out this time.")}
          {list("What to work on", fb.gaps, "No gaps flagged.")}
          {list("Next steps", fb.next_steps, "Keep practising.")}
        </div>
        <CoachReport feedback={fb} tasks={result.tasks ?? []} />
        {result.transcript.length > 0 && (
          <details className="rounded-lg border bg-card p-4 text-sm">
            <summary className="cursor-pointer font-medium">Review the full conversation</summary>
            <div className="mt-3 space-y-2">
              {result.transcript.map((t, i) => (
                <p key={i}><span className="font-medium">{t.role === "interviewer" ? "Elevra" : "You"}:</span> {t.text}</p>
              ))}
            </div>
          </details>
        )}
        <div className="flex flex-wrap gap-3">
          <Button asChild><Link href="/student">Back to my dashboard</Link></Button>
          <Button variant="outline" onClick={reset}>Start another interview</Button>
        </div>
      </div>
    );
  }
  return null;
}
