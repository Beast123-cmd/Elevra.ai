"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Award, ArrowRight, BadgeCheck, BookOpenCheck, Flame, LoaderCircle, Mic2, RefreshCw, Sparkles, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { api } from "@/lib/api";
import { buildAchievements, getBadges, type StudentAchievements } from "./achievement-data";
import { Card, CardContent } from "@/components/ui/card";
import { StudentReveal } from "./StudentReveal";
import { toast } from "sonner";
import { showCoinReward } from "./CoinRewardCelebration";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: StudentAchievements };

function useAchievements() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const sb = createClient();
        const { data: { session }, error: sessionError } = await sb.auth.getSession();
        if (sessionError) throw sessionError;
        const studentId = session?.user.app_metadata?.student_id as string | undefined;
        if (!studentId) throw new Error("This account isn't linked to a student record.");
        const [activityResult, interviewResult] = await Promise.all([
          sb.from("engagement").select("type,name,date").eq("student_id", studentId).eq("verified", true).order("date", { ascending: false }),
          sb.from("mock_interviews").select("score,created_at").eq("student_id", studentId).not("score", "is", null).order("created_at", { ascending: false }),
        ]);
        if (activityResult.error) throw activityResult.error;
        if (interviewResult.error) throw interviewResult.error;
        const activities = (activityResult.data ?? []).map((item) => ({
          type: item.type as "event" | "club" | "hackathon" | "certification",
          name: item.name,
          date: item.date,
        }));
        const interviews = (interviewResult.data ?? []).map((item) => ({ score: Number(item.score), created_at: item.created_at }));
        let dailyPoints = 0, loginStreak = 0;
        try {
          const loginReward = await api<{ awarded: boolean; coins: number }>("/daily-challenges/check-in", {});
          if (loginReward.awarded) showCoinReward(loginReward.coins);
          const daily = await api<{ earned_coins: number; best_login_streak: number; login_days: number; completed_test_count: number; challenge_count: number }>("/daily-challenges");
          dailyPoints = daily.earned_coins;
          loginStreak = daily.best_login_streak ?? 0;
          const achievements = buildAchievements(activities, interviews, dailyPoints, loginStreak, daily.challenge_count, daily.login_days, daily.completed_test_count);
          if (active) {
            celebrateNewMilestones(achievements, studentId);
            setState({ status: "ready", data: achievements });
          }
          return;
        } catch { /* Keep badges available during a temporary daily-challenge API outage. */ }
        if (active) {
          const achievements = buildAchievements(activities, interviews, dailyPoints, loginStreak);
          celebrateNewMilestones(achievements, studentId);
          setState({ status: "ready", data: achievements });
        }
      } catch (error) {
        if (active) setState({ status: "error", message: error instanceof Error ? error.message : "Could not load achievements." });
      }
    }
    void load();
    return () => { active = false; };
  }, [attempt]);
  const retry = useCallback(() => { setState({ status: "loading" }); setAttempt((value) => value + 1); }, []);
  return { state, retry };
}

const ICONS = { trophy: Trophy, certificate: BookOpenCheck, interview: Mic2, sparkles: Sparkles, streak: Flame };
const MEDALS = {
  trophy: { rim: "#e8ad35", face: "#fff0b3", ink: "#815313" },
  certificate: { rim: "#38a889", face: "#c9f2df", ink: "#145d48" },
  interview: { rim: "#8970d2", face: "#e8ddff", ink: "#503d92" },
  sparkles: { rim: "#2999ba", face: "#c9eff5", ink: "#155f76" },
  streak: { rim: "#e8785f", face: "#ffe0c9", ink: "#943e2a" },
};

function BadgeMedallion({ icon, unlocked }: { icon: keyof typeof MEDALS; unlocked: boolean }) {
  const Icon = ICONS[icon];
  const colors = MEDALS[icon];
  return <span className={`group relative grid h-[100px] w-[92px] shrink-0 place-items-center transition-transform duration-300 group-hover:-translate-y-1 motion-reduce:transition-none ${unlocked ? "" : "grayscale opacity-65"}`}>
    <svg viewBox="0 0 100 112" className="absolute inset-0 h-full w-full drop-shadow-sm" aria-hidden="true">
      <polygon points="50,2 96,28 96,82 50,109 4,82 4,28" fill={unlocked ? colors.rim : "hsl(var(--border))"} />
      <polygon points="50,9 89,31 89,77 50,100 11,77 11,31" fill={unlocked ? colors.face : "hsl(var(--background))"} stroke={unlocked ? "#fff7df" : "hsl(var(--border))"} strokeWidth="3" />
      <polygon points="50,16 82,34 82,73 50,92 18,73 18,34" fill={unlocked ? colors.rim : "hsl(var(--muted))"} opacity={unlocked ? 0.16 : 0.5} />
    </svg>
    <Icon className="relative h-10 w-10 drop-shadow-sm" strokeWidth={2.3} style={{ color: unlocked ? colors.ink : undefined }} aria-hidden="true" />
    {unlocked && <span className="absolute -right-0.5 top-2 grid h-6 w-6 place-items-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm"><BadgeCheck className="h-4 w-4" aria-hidden="true" /></span>}
  </span>;
}

function celebrateNewMilestones(data: StudentAchievements, studentId: string) {
  const key = `elevra-achievement-snapshot:${studentId}`;
  const earned = getBadges(data).filter((badge) => badge.progress >= badge.target).map((badge) => badge.name);
  try {
    const previous = localStorage.getItem(key);
    localStorage.setItem(key, JSON.stringify({ earned, title: data.title }));
    if (!previous) return;
    const snapshot = JSON.parse(previous) as { earned?: string[]; title?: string };
    const newlyEarned = earned.filter((name) => !snapshot.earned?.includes(name));
    const titleChanged = snapshot.title && snapshot.title !== data.title;
    if (newlyEarned.length) {
      toast.success(newlyEarned.length === 1 ? `${newlyEarned[0]} unlocked!` : `${newlyEarned.length} achievements unlocked!`, {
        description: newlyEarned.join(" · "), duration: 6000,
      });
    } else if (titleChanged) {
      toast.success(`New title unlocked: ${data.title}`, { description: "Your progress earned you a new Elevra title." });
    }
  } catch { /* Achievements remain available if browser storage is disabled. */ }
}

function AchievementContent({ data }: { data: StudentAchievements }) {
  const badges = getBadges(data);
  const earned = badges.filter((badge) => badge.progress >= badge.target).length;
  return (
    <>
      <StudentReveal><Card className="overflow-hidden rounded-xl border-border bg-card shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><Award className="h-6 w-6" aria-hidden="true" /></span>
              <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your current title</p><h2 className="mt-1 text-xl font-semibold text-foreground">{data.title}</h2></div>
            </div>
            <div className="rounded-lg bg-muted px-3 py-2 text-sm font-semibold text-foreground"><Sparkles className="mr-1.5 inline h-4 w-4 text-primary" aria-hidden="true" />{data.xp} XP</div>
          </div>
          {data.nextTitle ? <p className="mt-4 text-sm text-muted-foreground">{data.xpToNext} XP to <span className="font-medium text-foreground">{data.nextTitle}</span></p> : <p className="mt-4 text-sm text-muted-foreground">Top title reached. Keep collecting achievements.</p>}
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Progress to next title" aria-valuemin={0} aria-valuemax={100} aria-valuenow={data.titleProgress}>
            <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${data.titleProgress}%` }} />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Awards unlock from verified campus records and completed mock interviews.</p>
        </CardContent>
      </Card></StudentReveal>
      <StudentReveal delayMs={70}><div className="mt-6 flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-lg font-semibold text-foreground">Your badge collection</h2><p className="mt-1 text-sm text-muted-foreground">{earned} of {badges.length} earned · keep going to unlock the rest.</p></div></div></StudentReveal>
      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5">
        {badges.map((badge, index) => {
          const unlocked = badge.progress >= badge.target;
          const progress = Number.isFinite(badge.progress) ? Math.max(0, Math.min(badge.progress, badge.target)) : 0;
          return <StudentReveal key={badge.name} delayMs={Math.min(index, 4) * 70} className="h-full"><article className="group flex h-full flex-col items-center px-2 text-center">
            <BadgeMedallion icon={badge.icon} unlocked={unlocked} />
            <h3 className="mt-2 text-sm font-semibold leading-5 text-foreground">{badge.name}</h3>
            <p className="mt-1 min-h-[54px] text-xs leading-[18px] text-muted-foreground">{badge.description}</p>
            <p className="mt-2 text-[11px] font-medium text-muted-foreground">{unlocked ? "Earned" : `${progress} / ${badge.target}`}</p>
            {!unlocked && <div className="mt-1.5 h-1 w-full max-w-28 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.min(100, progress / badge.target * 100)}%` }} /></div>}
          </article></StudentReveal>;
        })}
      </div>
      <StudentReveal delayMs={140}><Card className="mt-5 rounded-xl border-border bg-muted shadow-none"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium text-foreground">Turn your next step into a milestone</p><p className="mt-1 text-sm text-muted-foreground">Practice an interview, join an event, or complete a course.</p></div><Link href="/student/interview" className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground no-underline hover:bg-primary/90">Keep building <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></CardContent></Card></StudentReveal>
    </>
  );
}

export function Achievements({ compact = false }: { compact?: boolean }) {
  const { state, retry } = useAchievements();
  if (compact) {
    return <Card className="mt-6 rounded-xl border-border bg-card shadow-sm"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Award className="h-5 w-5" aria-hidden="true" /></span><div><h2 className="text-sm font-semibold text-foreground">Achievements</h2><p className="text-xs text-muted-foreground">{state.status === "ready" ? `${state.data.title} · ${state.data.xp} XP` : state.status === "error" ? "Achievements unavailable" : "Loading your title…"}</p></div></div>
      <Link href="/student/achievements" className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-primary no-underline hover:underline">View badges <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
    </CardContent></Card>;
  }
  return <main className="mx-auto w-full max-w-[1120px] px-4 py-7 sm:px-6 sm:py-9 lg:px-10">
    <StudentReveal><header className="mb-6 border-l-2 border-primary pl-4"><p className="text-[11px] font-semibold uppercase tracking-[.12em] text-primary">Your long game</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Achievements</h1><p className="mt-1 text-sm text-muted-foreground">Build a record over months and years through consistent practice and verified campus experience.</p></header></StudentReveal>
    {state.status === "loading" && <Card className="rounded-xl border-border"><CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />Loading your achievements…</CardContent></Card>}
    {state.status === "error" && <Card role="alert" className="rounded-xl border-border"><CardContent className="p-5"><h2 className="font-semibold text-foreground">Couldn&apos;t load achievements</h2><p className="mt-1 text-sm text-muted-foreground">{state.message}</p><button type="button" onClick={retry} className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-muted"><RefreshCw className="h-4 w-4" aria-hidden="true" />Try again</button></CardContent></Card>}
    {state.status === "ready" && <AchievementContent data={state.data} />}
    {state.status === "ready" && state.data.activities.length === 0 && state.data.interviews.length === 0 && <p className="mt-4 text-sm text-muted-foreground">Keep showing up, finishing timed tests, and building verified campus experience to make progress toward your first badge.</p>}
  </main>;
}
