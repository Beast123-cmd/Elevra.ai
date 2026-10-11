"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { fmt } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

interface StartResponse { session_id: number; questions: string[]; ai: boolean }
interface FinishResponse {
  score_5: number; feedback: { strengths: string[]; gaps: string[] }; ai: boolean; mock_interview_avg: number;
  old_success_score: number; new_success_score: number; old_placement: number | null; new_placement: number | null;
}

const MIN_RESUME = 20;
const MAX_RESUME = 8000;
const MAX_ANSWER = 4000;

// Sample responses for previewing with ?mock=1 when the API isn't running.
const MOCK_START: StartResponse = {
  session_id: 0, ai: true,
  questions: ["Explain the difference between a process and a thread.", "How would you detect a cycle in a linked list?",
    "Walk me through a project on your resume.", "Describe a problem you got stuck on and how you solved it.", "Tell me about a time you disagreed with a teammate."],
};
const MOCK_FINISH: FinishResponse = {
  score_5: 4.0, ai: true, mock_interview_avg: 4.0, old_success_score: 56.4, new_success_score: 58.9, old_placement: 41, new_placement: 50,
  feedback: { strengths: ["Clear explanations with examples"], gaps: ["Go deeper on trade-offs"] },
};

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : "";
  if (/failed: (401|403)/.test(msg)) return "Your session has expired. Please sign in again.";
  if (/failed: 422/.test(msg)) return "Your resume text should be between 20 and 8,000 characters.";
  if (/failed: 409/.test(msg)) return "This interview is already finished. Start a new one.";
  if (/failed: 400/.test(msg)) return "Answer at least one question before finishing.";
  return "The interview service is offline right now. Your dashboard still works. Please try again in a few minutes.";
}

type Phase = "intro" | "asking" | "result";

export function Interview() {
  const mock = useSearchParams().get("mock") === "1";
  const [phase, setPhase] = useState<Phase>("intro");
  const [resume, setResume] = useState("");
  const [session, setSession] = useState<StartResponse | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<FinishResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answerWrites = useRef<Promise<void>>(Promise.resolve());
  const answerWriteError = useRef<unknown>(null);

  const call = <T,>(path: string, body: unknown, fake: T): Promise<T> => (mock ? Promise.resolve(fake) : api<T>(path, body));

  async function start() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const s = await call("/interview/start", { resume_text: resume.trim() }, MOCK_START);
      answerWrites.current = Promise.resolve();
      answerWriteError.current = null;
      setSession(s); setAnswers(s.questions.map(() => "")); setIndex(0); setPhase("asking");
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }

  async function next() {
    if (busy || !session) return;
    const text = answers[index].trim();
    setError(null);
    if (text) {
      answerWrites.current = answerWrites.current.then(async () => {
        if (answerWriteError.current) return;
        try {
          await call("/interview/answer", { session_id: session.session_id, index, answer_text: text }, { ok: true });
        } catch (e) {
          answerWriteError.current = e;
          setError(friendlyError(e));
        }
      });
    }
    if (index < session.questions.length - 1) {
      setIndex(index + 1);
      return;
    }

    setBusy(true);
    try {
      await answerWrites.current;
      if (answerWriteError.current) throw answerWriteError.current;
      setResult(await call("/interview/finish", { session_id: session.session_id }, MOCK_FINISH));
      setPhase("result");
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }

  function reset() {
    answerWrites.current = Promise.resolve();
    answerWriteError.current = null;
    setPhase("intro"); setSession(null); setResult(null); setAnswers([]); setIndex(0); setError(null);
  }

  const banner = mock && <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Showing sample responses (?mock=1). Nothing is saved.</p>;
  const errorBox = error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>;

  if (phase === "intro") {
    const len = resume.trim().length;
    return (
      <div className="space-y-4">
        {banner}
        <Card>
          <CardHeader>
            <CardTitle>Paste your resume</CardTitle>
            <CardDescription>
              You&apos;ll get 5 questions based on it: 2 technical, 2 about your projects and 1 HR. Your resume text and answers are
              sent to an AI service to write the questions and mark your answers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={resume} onChange={(e) => setResume(e.target.value)} maxLength={MAX_RESUME} rows={10}
              placeholder="Paste the text of your resume here: education, projects, skills, internships…" aria-label="Resume text"
            />
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{len < MIN_RESUME ? `Add at least ${MIN_RESUME - len} more characters` : `${len.toLocaleString("en-IN")} characters`}</span>
            </div>
            {errorBox}
            <Button onClick={start} disabled={busy || len < MIN_RESUME}>{busy ? "Preparing your questions…" : "Start interview"}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === "asking" && session) {
    const last = index === session.questions.length - 1;
    const anyAnswer = answers.some((a) => a.trim());
    return (
      <div className="space-y-4">
        {banner}
        {!session.ai && (
          <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
            The AI question writer is offline, so these are standard questions for your department.
          </p>
        )}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Question {index + 1} of {session.questions.length}</span>
            </div>
            <Progress value={((index + 1) / session.questions.length) * 100} className="h-2" />
            <CardTitle className="pt-3 text-lg leading-snug">{session.questions[index]}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={answers[index]} maxLength={MAX_ANSWER} rows={8} aria-label={`Your answer to question ${index + 1}`}
              onChange={(e) => setAnswers(answers.map((a, i) => (i === index ? e.target.value : a)))}
              placeholder="Type your answer as you would say it in an interview…"
            />
            {errorBox}
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">You can skip a question by leaving it empty.</p>
              <Button onClick={next} disabled={busy || (last && !anyAnswer)}>
                {busy ? (last ? "Marking your interview…" : "Saving…") : last ? "Finish and get my score" : "Next question"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === "result" && result) {
    const delta = result.new_success_score - result.old_success_score;
    return (
      <div className="space-y-6">
        {banner}
        {!result.ai && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            AI marking was offline, so this score only reflects how complete your answers were. Try again later for full feedback.
          </p>
        )}
        <Card>
          <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-500">Your interview score</p>
              <p className="text-5xl font-bold tabular-nums">{fmt(result.score_5, 1)}<span className="text-2xl text-slate-400"> / 5</span></p>
            </div>
            <div className="sm:text-right">
              <p className="text-sm text-slate-500">Success Score</p>
              <p className="text-3xl font-semibold tabular-nums">
                {fmt(result.old_success_score, 1)} → {fmt(result.new_success_score, 1)}
                <span className={`ml-2 text-lg ${delta >= 0 ? "text-emerald-700" : "text-red-700"}`}>({delta >= 0 ? "+" : ""}{delta.toFixed(1)})</span>
              </p>
              <p className="text-sm text-slate-500">
                Placement readiness: {result.old_placement === null ? "not yet assessed" : fmt(result.old_placement, 0)} → {fmt(result.new_placement, 0)}
              </p>
              <p className="text-xs text-slate-400">Your mock interview average is now {fmt(result.mock_interview_avg, 1)} / 5</p>
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">What went well</CardTitle></CardHeader>
            <CardContent>
              {result.feedback.strengths.length === 0 ? <p className="text-sm text-slate-500">Nothing stood out this time.</p> : (
                <ul className="list-inside list-disc space-y-1 text-sm">{result.feedback.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">What to work on</CardTitle></CardHeader>
            <CardContent>
              {result.feedback.gaps.length === 0 ? <p className="text-sm text-slate-500">No gaps flagged.</p> : (
                <ul className="list-inside list-disc space-y-1 text-sm">{result.feedback.gaps.map((g) => <li key={g}>{g}</li>)}</ul>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild><Link href="/student">Back to my dashboard</Link></Button>
          <Button variant="outline" onClick={reset}>Take another interview</Button>
        </div>
      </div>
    );
  }
  return null;
}
