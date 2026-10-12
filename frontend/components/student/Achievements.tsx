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
          await api("/daily-challenges/check-in", {});
          const daily = await api<{ earned_coins: number; login: { streak_days: number } | null; challenge_count: number }>("/daily-challenges");
          dailyPoints = daily.earned_coins;
          loginStreak = daily.login?.streak_days ?? 0;
          const achievements = buildAchievements(activities, interviews, dailyPoints, loginStreak, daily.challenge_count);
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
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {badges.map((badge, index) => {
          const Icon = ICONS[badge.icon];
          const unlocked = badge.progress >= badge.target;
          return <StudentReveal key={badge.name} delayMs={Math.min(index, 4) * 70} className="h-full"><Card className={`h-full rounded-xl border-border shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none ${unlocked ? "bg-primary/5" : "bg-card"}`}>
            <CardContent className="flex min-h-[150px] gap-3 p-4">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${unlocked ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h3 className="font-semibold text-foreground">{badge.name}</h3>{unlocked && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Earned" />}</div>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{badge.description}</p>
                <p className="mt-3 text-xs font-medium text-muted-foreground">{unlocked ? "Earned" : `Progress · ${Math.min(badge.progress, badge.target)} / ${badge.target}`}</p>
                {!unlocked && <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.min(100, badge.progress / badge.target * 100)}%` }} /></div>}
              </div>
            </CardContent>
          </Card></StudentReveal>;
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
    <StudentReveal><header className="mb-6 border-l-2 border-primary pl-4"><p className="text-[11px] font-semibold uppercase tracking-[.12em] text-primary">Your milestones</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Achievements</h1><p className="mt-1 text-sm text-muted-foreground">Celebrate the skills and experiences you build along the way.</p></header></StudentReveal>
    {state.status === "loading" && <Card className="rounded-xl border-border"><CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />Loading your achievements…</CardContent></Card>}
    {state.status === "error" && <Card role="alert" className="rounded-xl border-border"><CardContent className="p-5"><h2 className="font-semibold text-foreground">Couldn&apos;t load achievements</h2><p className="mt-1 text-sm text-muted-foreground">{state.message}</p><button type="button" onClick={retry} className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-muted"><RefreshCw className="h-4 w-4" aria-hidden="true" />Try again</button></CardContent></Card>}
    {state.status === "ready" && <AchievementContent data={state.data} />}
    {state.status === "ready" && state.data.activities.length === 0 && state.data.interviews.length === 0 && <p className="mt-4 text-sm text-muted-foreground">Your first badge is waiting. Complete a mock interview or ask your mentor to verify a campus activity.</p>}
  </main>;
}
