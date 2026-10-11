"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, FileText, Mic, MicOff, Send, Upload, Volume2 } from "lucide-react";
import { api } from "@/lib/api";
import { fmt } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { speak, stopSpeaking, useLiveTranscription } from "./voice";
import { StudentReveal } from "./StudentReveal";
import { StudentNextStep } from "./StudentNextStep";

type Stage = "intro" | "resume" | "technical" | "behavioural" | "wrapup";
interface Turn { role: "interviewer" | "candidate"; text: string }
interface TurnResponse { session_id?: number; message: string; stage: Stage; question_number: number; done: boolean; elapsed_sec: number; ai: boolean }
interface Feedback {
  criteria: Record<"communication" | "technical_depth" | "problem_solving" | "project_knowledge", number> | null;
  strengths: string[]; gaps: string[]; next_steps: string[]; minutes?: number; questions?: number;
}
interface FinishResponse {
  score_5: number; feedback: Feedback; ai: boolean; mock_interview_avg: number;
  old_success_score: number; new_success_score: number; old_placement: number | null; new_placement: number | null; transcript: Turn[];
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

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : "";
  if (/failed: (401|403)/.test(msg)) return "Your session has expired. Please sign in again.";
  if (/failed: 422/.test(msg)) return "We couldn't use that resume. Upload a PDF of up to 5 MB, or paste between 20 and 8,000 characters of text.";
  if (/failed: 409/.test(msg)) return "This interview has ended. Get your feedback or start a new one.";
  if (/failed: 400/.test(msg)) return "Answer at least one question before finishing.";
  return "The interview service is offline right now. Your answer is still in the box, so try sending it again in a moment.";
}

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

type Phase = "intro" | "room" | "result";

export function Interview() {
  const mock = useSearchParams().get("mock") === "1";
  const [phase, setPhase] = useState<Phase>("intro");
  const [resume, setResume] = useState("");
  const [pdf, setPdf] = useState<{ name: string; base64: string } | null>(null);
  const [voiceOn, setVoiceOn] = useState(false);
  const [autoListen, setAutoListen] = useState(false);

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

  // The answer lives in a ref as well as state: spoken words arrive asynchronously, and Send must read the latest text
  // after waiting for the microphone to flush.
  const draftRef = useRef("");
  const updateDraft = (text: string) => { draftRef.current = text; setDraft(text); };
  const mic = useLiveTranscription(sessionId, (text) => {
    const d = draftRef.current;
    updateDraft(d.trim() ? `${d.trimEnd()} ${text}` : text);
  });
  const startListening = () => {
    stopSpeaking(); setSpeaking(false);
    mic.start().catch(() => setVoiceNote("We couldn't use your microphone. Check the browser's permission, or type your answer."));
  };

  // Timer, transcript auto-scroll, and silence on leaving the page.
  useEffect(() => {
    if (phase !== "room") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phase]);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [turns, busy]);
  useEffect(() => () => { stopSpeaking(); }, []);

  function interviewerSays(r: TurnResponse) {
    setTurns((t) => [...t, { role: "interviewer", text: r.message }]);
    setStage(r.stage); setQuestionNo(r.question_number); setDone(r.done);
    if (!r.ai) setAiOffline(true);
    if (!r.done && !mock) mic.prefetch();
    const listenAfter = () => { setSpeaking(false); if (autoListen && mic.supported && !r.done) startListening(); };
    if (!voiceOn) { listenAfter(); return; }
    setSpeaking(true);
    void speak(r.message, !mock, listenAfter).then((used) =>
      setVoiceNote(used === "browser" ? "Using your browser's voice because the AI voice is unavailable." : used === "none" ? "Your browser can't read text aloud." : null));
  }

  function mockTurn(): TurnResponse {
    const i = Math.min(mockStep.current++, MOCK_SCRIPT.length - 1);
    return { session_id: 0, stage: MOCK_SCRIPT[i][0], message: MOCK_SCRIPT[i][1], question_number: i + 1, done: i === MOCK_SCRIPT.length - 1, elapsed_sec: 0, ai: true };
  }

  async function start() {
    if (busy) return;
    setBusy("starting"); setError(null);
    try {
      const body = pdf ? { resume_pdf_base64: pdf.base64 } : { resume_text: resume.trim() };
      const r = mock ? mockTurn() : await api<TurnResponse>("/interview/start", body);
      setSessionId(r.session_id ?? null); setTurns([]); setStartedAt(Date.now() - r.elapsed_sec * 1000); setNow(Date.now());
      setPhase("room");
      interviewerSays(r);
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(null); }
  }

  async function send() {
    if (busy || done || sessionId === null) return;
    setBusy("thinking"); setError(null);
    stopSpeaking(); setSpeaking(false);
    await mic.stop(); // wait for the last spoken words to land in the answer
    const text = draftRef.current.trim();
    if (!text) { setBusy(null); return; }
    setTurns((t) => [...t, { role: "candidate", text }]); updateDraft("");
    try {
      const r = mock ? mockTurn() : await api<TurnResponse>("/interview/reply", { session_id: sessionId, answer_text: text });
      setStartedAt(Date.now() - r.elapsed_sec * 1000);
      interviewerSays(r);
    } catch (e) {
      setTurns((t) => t.slice(0, -1)); updateDraft(text); setError(friendlyError(e));
    } finally { setBusy(null); }
  }

  async function finish() {
    if (busy || sessionId === null) return;
    stopSpeaking(); setSpeaking(false); mic.dispose();
    setBusy("marking"); setError(null);
    try {
      const r = mock ? { ...MOCK_FINISH, transcript: turns } : await api<FinishResponse>("/interview/finish", { session_id: sessionId });
      setResult(r); setPhase("result");
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(null); }
  }

  async function choosePdf(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) { setError("Please choose a PDF file."); return; }
    if (file.size > MAX_PDF_BYTES) { setError("That PDF is larger than 5 MB. Try a smaller file or paste the text instead."); return; }
    try { setPdf({ name: file.name, base64: await readAsBase64(file) }); } catch { setError("We couldn't read that file. Try again or paste the text instead."); }
  }

  function reset() {
    stopSpeaking(); mic.dispose(); mockStep.current = 0;
    setPhase("intro"); setSessionId(null); setTurns([]); setResult(null); setDone(false); updateDraft(""); setError(null);
    setStage("intro"); setQuestionNo(0); setAiOffline(false); setVoiceNote(null);
  }

  const banner = mock && <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Showing a scripted sample (?mock=1). Nothing is saved.</p>;
  const errorBox = error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>;

  // ---------- 1. Start ----------
  if (phase === "intro") {
    const len = resume.trim().length;
    const ready = pdf !== null || len >= MIN_RESUME;
    return (
      <div className="space-y-4">
        {banner}
        <StudentReveal key="interview-intro">
        <Card className="rounded-xl border-[#dce7e1] bg-white shadow-sm shadow-slate-900/[0.03]">
          <CardHeader>
            <CardTitle>Add your resume</CardTitle>
            <CardDescription>
              A {TARGET} conversation with an AI interviewer: your introduction, your resume and projects, technical questions
              for your department, then behavioural ones. Each question builds on your previous answers. Your resume and answers
              are sent to an AI service; a short summary of your resume is saved with the interview, the file itself is not.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-dashed border-slate-300 p-4">
              {pdf ? (
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-slate-500" /><span className="font-medium">{pdf.name}</span></span>
                  <button type="button" onClick={() => setPdf(null)} className="text-sm text-slate-600 underline underline-offset-2">Remove</button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center gap-2 text-center text-sm text-slate-600">
                  <Upload className="h-5 w-5" />
                  <span><span className="font-medium text-slate-900 underline underline-offset-2">Upload your resume</span> (PDF, up to 5 MB)</span>
                  <input type="file" accept="application/pdf,.pdf" className="sr-only"
                    onChange={(e) => { void choosePdf(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
              )}
            </div>
            <div className={pdf ? "pointer-events-none opacity-50" : ""} aria-disabled={pdf !== null}>
              <p className="mb-2 text-sm text-slate-500">{pdf ? "Using your PDF. Remove it to paste text instead." : "Or paste the text of your resume"}</p>
              <Textarea value={resume} onChange={(e) => setResume(e.target.value)} maxLength={MAX_RESUME} rows={6} disabled={pdf !== null}
                placeholder="Education, projects, skills, internships…" aria-label="Resume text" />
              {!pdf && len > 0 && len < MIN_RESUME && <p className="mt-1 text-xs text-slate-500">Add at least {MIN_RESUME - len} more characters</p>}
            </div>
            <details className="group rounded-lg border border-[#e2ebe6] bg-[#fbfcfb] px-3.5 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62]">
                Optional voice settings
                <span className="text-xs font-normal text-slate-500">Typing is ready by default</span>
              </summary>
              <fieldset className="mt-3 space-y-2 border-t border-[#e2ebe6] pt-3 text-sm">
                <legend className="sr-only">Voice settings</legend>
                <label className="flex items-start gap-2 leading-5">
                  <input type="checkbox" checked={voiceOn} onChange={(e) => setVoiceOn(e.target.checked)} className="mt-0.5 h-4 w-4" />
                  Speak the interviewer&apos;s questions aloud
                </label>
                <label className="flex items-start gap-2 leading-5">
                  <input type="checkbox" checked={autoListen} onChange={(e) => setAutoListen(e.target.checked)} className="mt-0.5 h-4 w-4" />
                  Start listening automatically after each question (Chrome or Edge)
                </label>
              </fieldset>
            </details>
            {errorBox}
            {busy && <p role="status" aria-live="polite" className="flex items-center gap-2 text-xs font-medium text-[#286a62]"><span className="student-loading-dot" aria-hidden="true" /> Reading your resume and preparing the interview…</p>}
            <Button onClick={start} disabled={busy !== null || !ready}>{busy ? "Preparing your interview…" : "Enter the interview room"}</Button>
          </CardContent>
        </Card>
        </StudentReveal>
        <StudentNextStep
          label="AFTER PRACTICE"
          title="Check campus updates"
          description="Review placement drives and announcements shared with you."
          href="/student/notifications"
        />
      </div>
    );
  }

  // ---------- 2. Interview room ----------
  if (phase === "room") {
    const elapsed = Math.max(0, (now - startedAt) / 1000);
    const stageIndex = STAGES.findIndex((s) => s.key === stage);
    const answered = turns.some((t) => t.role === "candidate");
    return (
      <div className="space-y-4">
        {banner}
        {aiOffline && (
          <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
            The AI interviewer is offline, so you&apos;re getting standard questions for your department. Your answers still count.
          </p>
        )}
        <StudentReveal key={`interview-room-${sessionId}`}>
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <Card className="h-fit rounded-xl border-[#dce7e1] bg-white shadow-sm shadow-slate-900/[0.03]">
            <CardContent className="space-y-5 p-5">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className={`flex h-20 w-20 items-center justify-center rounded-full bg-[#15564e] text-2xl font-semibold text-white transition ${speaking ? "ring-4 ring-teal-300 ring-offset-2 animate-pulse" : ""}`} aria-hidden>
                  E
                </div>
                <p className="font-medium">Elevra</p>
                <p className="h-4 text-xs text-slate-500" aria-live="polite">
                  {speaking ? "Speaking…" : busy === "thinking" ? "Thinking…" : mic.listening ? "Listening to you…" : done ? "Interview complete" : "Your turn"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-semibold tabular-nums">{clock(elapsed)}</p>
                <p className="text-xs text-slate-500">Target {TARGET} · Question {questionNo}</p>
              </div>
              <ol className="space-y-1.5 text-sm" aria-label="Interview stages">
                {STAGES.map((s, i) => (
                  <li key={s.key} className={`flex items-center gap-2 ${i === stageIndex ? "font-medium text-slate-900" : i < stageIndex ? "text-slate-500" : "text-slate-400"}`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${i < stageIndex || (done && i === stageIndex) ? "bg-emerald-600 text-white" : i === stageIndex ? "bg-[#15564e] text-white" : "bg-slate-200"}`}>
                      {i < stageIndex || (done && i === stageIndex) ? <Check className="h-3 w-3" /> : i + 1}
                    </span>
                    {s.label}
                  </li>
                ))}
              </ol>
              {voiceNote && <p className="text-xs text-slate-500">{voiceNote}</p>}
              {!done && (
                <Button variant="outline" size="sm" className="w-full" onClick={finish} disabled={busy !== null || !answered}>
                  End interview early
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="flex min-h-[520px] flex-col rounded-xl border-[#dce7e1] bg-white shadow-sm shadow-slate-900/[0.03]">
            <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto p-5" style={{ maxHeight: 460 }} aria-live="polite">
              {turns.map((t, i) => (
                <div key={i} className={`flex ${t.role === "candidate" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${t.role === "candidate" ? "bg-[#15564e] text-white" : "bg-[#f0f4f1] text-slate-900"}`}>
                    {t.role === "interviewer" && (
                      <button type="button" onClick={() => { setSpeaking(true); void speak(t.text, !mock, () => setSpeaking(false)); }}
                        className="float-right ml-2 text-slate-400 hover:text-slate-700" aria-label="Play this question again">
                        <Volume2 className="h-4 w-4" />
                      </button>
                    )}
                    {t.text}
                  </div>
                </div>
              ))}
              {busy === "thinking" && <div className="w-fit rounded-2xl bg-slate-100 px-4 py-2.5 text-sm text-slate-500">Elevra is thinking…</div>}
            </div>

            <div className="space-y-2 border-t p-4">
              {errorBox}
              {done ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-600">The interviewer has wrapped up. Ready to see how you did?</p>
                  <Button onClick={finish} disabled={busy !== null}>{busy === "marking" ? "Marking your interview…" : "Get my feedback"}</Button>
                </div>
              ) : (
                <>
                  {/* While listening, the box shows the answer so far plus the words being spoken right now. */}
                  <Textarea
                    value={mic.listening && mic.partial ? `${draft}${draft.trim() ? " " : ""}${mic.partial}` : draft}
                    onChange={(e) => updateDraft(e.target.value)} readOnly={mic.listening} maxLength={MAX_ANSWER} rows={4}
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void send(); } }}
                    placeholder={mic.listening ? "Listening… start speaking. Your words will appear here as you talk." : "Type your answer, or press Speak."}
                    aria-label="Your answer" disabled={busy !== null} className={mic.listening ? "bg-[#edf5f1]" : ""} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {mic.supported && (
                        <Button type="button" size="sm" variant={mic.listening ? "default" : "outline"} aria-pressed={mic.listening}
                          onClick={() => { if (mic.listening) void mic.stop(); else startListening(); }} disabled={busy !== null}>
                          {mic.listening ? <><MicOff /> Pause</> : <><Mic /> Speak</>}
                        </Button>
                      )}
                      <span className="text-xs text-slate-400">
                        {mic.listening ? (mic.engine === "browser" ? "Live captions (browser)" : "Live captions") : "Ctrl+Enter to send"}
                      </span>
                    </div>
                    <Button size="sm" onClick={send} disabled={busy !== null || (!draft.trim() && !mic.listening)}>
                      <Send /> {busy === "marking" ? "Marking…" : "Send answer"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
        </StudentReveal>
      </div>
    );
  }

  // ---------- 3. Results ----------
  if (phase === "result" && result) {
    const delta = result.new_success_score - result.old_success_score;
    const fb = result.feedback;
    const list = (title: string, items: string[], empty: string) => (
      <Card className="rounded-xl border-[#dce7e1] bg-white shadow-sm shadow-slate-900/[0.03]">
        <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? <p className="text-sm text-slate-500">{empty}</p>
            : <ul className="list-inside list-disc space-y-1.5 text-sm">{items.map((s) => <li key={s}>{s}</li>)}</ul>}
        </CardContent>
      </Card>
    );
    return (
      <div className="space-y-6">
        {banner}
        {!result.ai && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            AI marking was offline, so this score only reflects how complete your answers were. Try again later for full feedback.
          </p>
        )}
        <StudentReveal key="interview-result">
        <Card className="rounded-xl border-[#dce7e1] bg-white shadow-sm shadow-slate-900/[0.03]">
          <CardContent className="grid gap-6 p-6 md:grid-cols-3">
            <div>
              <p className="text-sm text-slate-500">Interview score</p>
              <p className="text-5xl font-bold tabular-nums">{fmt(result.score_5, 1)}<span className="text-2xl text-slate-400"> / 5</span></p>
              <p className="mt-1 text-xs text-slate-500">
                {fb.questions ?? "—"} questions · {fb.minutes !== undefined ? `${fmt(fb.minutes, 0)} min` : "—"}
              </p>
            </div>
            <div className="space-y-2">
              {fb.criteria ? CRITERIA.map((c) => (
                <div key={c.key}>
                  <div className="flex justify-between text-sm"><span>{c.label}</span><span className="tabular-nums text-slate-500">{fmt(fb.criteria![c.key], 1)} / 5</span></div>
                  <Progress value={(fb.criteria![c.key] / 5) * 100} className="h-2" />
                </div>
              )) : <p className="text-sm text-slate-500">Detailed marks are unavailable for this interview.</p>}
            </div>
            <div className="md:text-right">
              <p className="text-sm text-slate-500">Success Score</p>
              <p className="text-3xl font-semibold tabular-nums">
                {fmt(result.old_success_score, 1)} → {fmt(result.new_success_score, 1)}
                <span className={`ml-2 text-lg ${delta >= 0 ? "text-emerald-700" : "text-red-700"}`}>({delta >= 0 ? "+" : ""}{delta.toFixed(1)})</span>
              </p>
              <p className="text-sm text-slate-500">
                Placement readiness: {result.old_placement === null ? "not yet assessed" : fmt(result.old_placement, 0)} → {fmt(result.new_placement, 0)}
              </p>
              <p className="text-xs text-slate-400">Mock interview average now {fmt(result.mock_interview_avg, 1)} / 5</p>
            </div>
          </CardContent>
        </Card>
        </StudentReveal>
        <div className="grid gap-6 md:grid-cols-3">
          {list("What went well", fb.strengths, "Nothing stood out this time.")}
          {list("What to work on", fb.gaps, "No gaps flagged.")}
          {list("Next steps", fb.next_steps, "Keep practising.")}
        </div>
        {result.transcript.length > 0 && (
          <details className="rounded-lg border bg-white p-4 text-sm">
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
        <StudentNextStep
          label="NEXT"
          title="Check campus updates"
          description="Review placement drives and announcements shared with you."
          href="/student/notifications"
        />
      </div>
    );
  }
  return null;
}
