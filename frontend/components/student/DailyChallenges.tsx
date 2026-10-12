"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock3, Coins, Flame, LoaderCircle, RefreshCw, Trophy } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { StudentReveal } from "./StudentReveal";
import { showCoinReward } from "./CoinRewardCelebration";

type Mode = "daily" | "weekly" | "practice";
type Category = "aptitude" | "sql" | "cpp" | "mcq" | "coding";
type Difficulty = "easy" | "medium" | "hard";
interface DailyState { activity_date: string; login: { streak_days: number; coins: number } | null; attempts: { category: string; difficulty: string; correct: boolean; coins: number }[]; coin_balance: number }
interface TestQuestion { question_id: string; prompt: string; options: { id: string; label: string }[] }
interface TestResult { correct_count: number; total_questions: number; score_percent: number; coins: number; already_completed?: boolean }
interface TestSession { session_id: string; mode: Mode; category: Category; difficulty: Difficulty; duration_seconds: number; expires_at: string; questions: TestQuestion[]; answer_key?: Record<string, string>; result?: TestResult }
type PageState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; daily: DailyState };

const TOPICS: { id: Category; label: string; detail: string }[] = [
  { id: "aptitude", label: "Aptitude", detail: "Quantitative & reasoning" },
  { id: "sql", label: "SQL MCQ", detail: "Queries & databases" },
  { id: "cpp", label: "C++ MCQ", detail: "Language & output" },
  { id: "mcq", label: "General MCQ", detail: "Computer science basics" },
  { id: "coding", label: "Coding", detail: "Read code & find output" },
];
const LEVELS: { id: Difficulty; label: string; coins: number }[] = [
  { id: "easy", label: "Easy", coins: 1 }, { id: "medium", label: "Medium", coins: 2 }, { id: "hard", label: "Hard", coins: 3 },
];

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export function DailyChallenges() {
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [retry, setRetry] = useState(0);
  const [mode, setMode] = useState<Mode>("daily");
  const [category, setCategory] = useState<Category>("aptitude");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [session, setSession] = useState<TestSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<TestResult | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const submitLock = useRef(false);
  const answerRef = useRef(answers);
  answerRef.current = answers;

  const refresh = useCallback(() => { setState({ status: "loading" }); setRetry((value) => value + 1); }, []);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const reward = await api<{ awarded: boolean; coins: number }>("/daily-challenges/check-in", {});
        if (reward.awarded) showCoinReward(reward.coins);
        const daily = await api<DailyState>("/daily-challenges");
        if (active) setState({ status: "ready", daily });
      } catch (cause) {
        if (active) setState({ status: "error", message: cause instanceof Error ? cause.message : "Could not load your test dashboard." });
      }
    }
    void load();
    return () => { active = false; };
  }, [retry]);

  const submitTest = useCallback(async () => {
    if (!session || result || submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    setError("");
    try {
      if (session.mode === "practice") {
        const correct_count = session.questions.reduce((total, question) => total + (answerRef.current[question.question_id] === session.answer_key?.[question.question_id] ? 1 : 0), 0);
        setResult({ correct_count, total_questions: session.questions.length, score_percent: Math.round(correct_count * 100 / session.questions.length), coins: 0 });
        return;
      }
      const saved = await api<TestResult>("/assessments/submit", { session_id: session.session_id, answers: answerRef.current });
      setResult(saved);
      if (saved.coins > 0) showCoinReward(saved.coins);
      const daily = await api<DailyState>("/daily-challenges");
      setState({ status: "ready", daily });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit your test. Please try again.");
      submitLock.current = false;
    } finally { setSubmitting(false); }
  }, [result, session]);

  useEffect(() => {
    if (!session || result) return;
    const update = () => setRemaining(Math.max(0, Math.ceil((Date.parse(session.expires_at) - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 500);
    return () => window.clearInterval(timer);
  }, [session, result]);

  useEffect(() => {
    if (remaining === 0 && session && !result && !submitting && !submitLock.current) void submitTest();
  }, [remaining, result, session, submitting, submitTest]);

  async function startTest() {
    if (starting) return;
    setStarting(true); setError("");
    try {
      const started = await api<TestSession>(mode === "practice" ? "/assessments/practice" : "/assessments/start", { mode: mode === "weekly" ? "weekly" : "daily", category, difficulty });
      setSession(started);
      setAnswers({}); answerRef.current = {}; setResult(started.result ?? null); setRemaining(Math.max(0, Math.ceil((Date.parse(started.expires_at) - Date.now()) / 1000)));
      submitLock.current = false;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start this test. Please try again.");
    } finally { setStarting(false); }
  }

  function leaveTest() {
    setSession(null); setAnswers({}); answerRef.current = {}; setResult(null); setError(""); submitLock.current = false;
  }

  const topic = TOPICS.find((item) => item.id === category)!;
  const level = LEVELS.find((item) => item.id === difficulty)!;

  return <main className="mx-auto w-full max-w-[1120px] px-4 py-7 sm:px-6 sm:py-9 lg:px-10">
    <StudentReveal><header className="mb-6 border-l-2 border-primary pl-4"><p className="text-[11px] font-semibold uppercase tracking-[.12em] text-primary">Build your streak</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Daily & weekly tests</h1><p className="mt-1 text-sm text-muted-foreground">Choose a topic and difficulty, take a timed test, and earn coins for each correct answer.</p></header></StudentReveal>

    {state.status === "loading" && <Card className="rounded-xl border-border"><CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />Loading your test dashboard…</CardContent></Card>}
    {state.status === "error" && <Card role="alert" className="rounded-xl border-border"><CardContent className="p-5"><h2 className="font-semibold text-foreground">Tests are unavailable</h2><p className="mt-1 text-sm text-muted-foreground">{state.message}</p><button onClick={refresh} className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-muted"><RefreshCw className="h-4 w-4" aria-hidden="true" />Try again</button></CardContent></Card>}

    {state.status === "ready" && <>
      <StudentReveal delayMs={70} className="grid gap-3 sm:grid-cols-3">
        <Card className="rounded-xl border-border bg-card"><CardContent className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Flame className="h-5 w-5" aria-hidden="true" /></span><div><p className="text-xs text-muted-foreground">Daily login reward</p><p className="font-semibold text-foreground">+{state.daily.login?.coins ?? 5} coins · {state.daily.login?.streak_days ?? 1} day streak</p></div></CardContent></Card>
        <Card className="rounded-xl border-border bg-card"><CardContent className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Clock3 className="h-5 w-5" aria-hidden="true" /></span><div><p className="text-xs text-muted-foreground">Test formats</p><p className="font-semibold text-foreground">Daily 10 · Weekly 50</p></div></CardContent></Card>
        <Card className="rounded-xl border-border bg-card"><CardContent className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Trophy className="h-5 w-5" aria-hidden="true" /></span><div><p className="text-xs text-muted-foreground">Your coin wallet</p><p className="font-semibold text-foreground">{state.daily.coin_balance} coins</p></div></CardContent></Card>
      </StudentReveal>

      {!session && <StudentReveal delayMs={140}><Card className="mt-5 rounded-xl border-border bg-card shadow-sm"><CardContent className="p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-foreground">Set up your test</h2><p className="mt-1 text-sm text-muted-foreground">Daily tests: 10 questions, 15 minutes. Weekly tests: 50 questions, 60 minutes. Practice is repeatable and gives no coins.</p></div><span className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">One rewarded attempt per topic and difficulty</span></div>
        <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Test length</p>
        <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Test type">
          {([{ id: "daily", title: "Daily test", detail: "10 questions · 15 minutes · earn coins" }, { id: "weekly", title: "Weekly test", detail: "50 questions · 60 minutes · earn coins" }, { id: "practice", title: "Practice test", detail: "10 questions · 15 minutes · repeat anytime · no coins" }] as const).map((item) => <button key={item.id} type="button" onClick={() => setMode(item.id)} aria-pressed={mode === item.id} className={`rounded-xl border px-4 py-3 text-left transition-colors ${mode === item.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}><span className="block text-sm font-semibold text-foreground">{item.title}</span><span className="mt-1 block text-xs text-muted-foreground">{item.detail}</span></button>)}
        </div>
        <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Choose a topic</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="group" aria-label="Test topic">
          {TOPICS.map((item) => <button key={item.id} type="button" onClick={() => setCategory(item.id)} aria-pressed={category === item.id} className={`rounded-xl border px-4 py-3 text-left transition-colors ${category === item.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}><span className="block text-sm font-semibold text-foreground">{item.label}</span><span className="mt-1 block text-xs text-muted-foreground">{item.detail}</span></button>)}
        </div>
        <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{mode === "practice" ? "Choose difficulty" : "Difficulty and coins per correct answer"}</p>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Test difficulty">
          {LEVELS.map((item) => <button key={item.id} type="button" onClick={() => setDifficulty(item.id)} aria-pressed={difficulty === item.id} className={`rounded-lg border px-3 py-2 text-left transition-colors ${difficulty === item.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}><span className="block text-sm font-semibold text-foreground">{item.label}</span><span className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">{mode === "practice" ? "Practice" : <><Coins className="h-3.5 w-3.5" aria-hidden="true" />{item.coins} per correct</>}</span></button>)}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><p className="text-sm text-muted-foreground">{mode === "practice" ? "Practice as often as you like. No coins are awarded." : `Perfect score: up to ${LEVELS.find((item) => item.id === difficulty)!.coins * (mode === "weekly" ? 50 : 10)} coins`}</p><button type="button" onClick={startTest} disabled={starting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60">{starting ? <><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />Preparing test…</> : <>Start {mode} test <ArrowRight className="h-4 w-4" aria-hidden="true" /></>}</button></div>
      </CardContent></Card></StudentReveal>}

      {session && !result && <StudentReveal delayMs={100}>
        <div className="mb-3 mt-5 flex flex-wrap items-center justify-between gap-3"><div><button type="button" onClick={leaveTest} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />Test setup</button><h2 className="text-lg font-semibold text-foreground">{topic.label} · {difficulty[0].toUpperCase() + difficulty.slice(1)}</h2><p className="text-sm text-muted-foreground">{session.questions.length} questions · {mode === "practice" ? "Practice" : mode === "daily" ? "Daily" : "Weekly"} test{mode === "practice" ? " · no rewards" : ""}</p></div><div role="timer" aria-live="off" className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 ${remaining < 60 ? "border-destructive/50 bg-destructive/10 text-destructive" : "border-border bg-card text-foreground"}`}><Clock3 className="h-5 w-5" aria-hidden="true" /><span className="font-mono text-xl font-bold tabular-nums">{formatTime(remaining)}</span></div></div>
        {error && <p role="alert" className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
        <div className="space-y-3">{session.questions.map((question, index) => <Card key={question.question_id} className="rounded-xl border-border bg-card"><CardContent className="p-4 sm:p-5"><div className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{index + 1}</span><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold leading-6 text-foreground">{question.prompt}</h3><fieldset disabled={remaining === 0 || submitting} className="mt-3 grid gap-2 sm:grid-cols-2"><legend className="sr-only">Answer question {index + 1}</legend>{question.options.map((option) => <label key={option.id} className={`flex min-h-10 cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${answers[question.question_id] === option.id ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted"}`}><input type="radio" name={`answer-${question.question_id}`} checked={answers[question.question_id] === option.id} onChange={() => setAnswers((current) => { const updated = { ...current, [question.question_id]: option.id }; answerRef.current = updated; return updated; })} className="mt-0.5 accent-primary" /><span className="font-semibold">{option.id}.</span><span>{option.label}</span></label>)}</fieldset></div></div></CardContent></Card>)}</div>
        <div className="sticky bottom-3 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur"><span className="text-sm text-muted-foreground">{Object.keys(answers).length} of {session.questions.length} answered</span><button type="button" onClick={() => void submitTest()} disabled={submitting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60">{submitting ? <><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />Submitting…</> : <>Submit test <ArrowRight className="h-4 w-4" aria-hidden="true" /></>}</button></div>
      </StudentReveal>}

      {session && result && <StudentReveal delayMs={100}><Card className="mt-5 overflow-hidden rounded-2xl border-border bg-card"><CardContent className="p-6 text-center sm:p-10"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary"><Trophy className="h-8 w-8" aria-hidden="true" /></span><p className="mt-4 text-xs font-semibold uppercase tracking-[.12em] text-primary">{mode === "practice" ? "Practice complete" : "Test complete"}</p><h2 className="mt-1 text-3xl font-bold tracking-tight text-foreground">{result.score_percent}%</h2><p className="mt-2 text-base text-muted-foreground">You got <strong className="text-foreground">{result.correct_count} of {result.total_questions}</strong> questions correct.</p>{mode === "practice" ? <p className="mt-4 text-sm text-muted-foreground">Practice tests do not award coins.</p> : <p className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-4 py-2 text-lg font-bold text-amber-700 dark:text-amber-300"><Coins className="h-5 w-5" aria-hidden="true" />+{result.coins} coins</p>}{result.already_completed && <p className="mt-2 text-xs text-muted-foreground">This is your saved result for this test period.</p>}<div className="mt-6"><button type="button" onClick={leaveTest} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted">Back to tests</button></div></CardContent></Card></StudentReveal>}
    </>}
    <div className="mt-5 text-center"><Link href="/student/achievements" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary no-underline hover:underline">See your badges and titles <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></div>
  </main>;
}
