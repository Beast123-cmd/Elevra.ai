"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Account = { email: string; label: string; home: string };
const ADMIN: Account = { email: "admin@demo.edu", label: "Admin", home: "/admin" };
const FACULTY: Account = { email: "faculty1@demo.edu", label: "Faculty mentor", home: "/faculty" };
const STUDENT: Account = { email: "student.red@demo.edu", label: "Student", home: "/student" };

interface Step { title: string; say: string; account: Account; links: { href: string; label: string }[]; try: string[] }

// Follows the demo story in docs/PRD.md section 10.
const STEPS: Step[] = [
  {
    title: "One student view from seven messy systems",
    say: "Seven campus systems, seven ID formats. We cleaned and joined them into one record per student, and every fix is logged.",
    account: ADMIN, links: [{ href: "/insights/data-health", label: "Data Health" }],
    try: ["Point at the ID format column: every source uses a different one", "Scroll to the cleaning log"],
  },
  {
    title: "Institution health at a glance",
    say: "Admins see the average Success Score, how many students need a check-in, and where they are.",
    account: ADMIN, links: [{ href: "/admin", label: "Admin overview" }, { href: "/insights/segments", label: "Segments" }],
    try: ["Filter by department or year", "Open Segments: \"Academic stars, placement unready\""],
  },
  {
    title: "Who should a mentor call this week?",
    say: "Each mentor gets their mentees in priority order, with the reasons and a suggested action.",
    account: FACULTY, links: [{ href: "/faculty", label: "Action Queue" }],
    try: ["Open the top Red student to see their full record and drivers", "Log a mentoring intervention"],
  },
  {
    title: "What the student sees",
    say: "Students see their own score, what's pulling it down, and concrete steps to improve, all the way to placement.",
    account: STUDENT,
    links: [{ href: "/student", label: "Dashboard" }, { href: "/student/improve", label: "Improve" }, { href: "/student/certifications", label: "Certifications" }],
    try: ["Scroll to \"What if…?\" and raise attendance above 75%", "Open Improve for the two weakest areas"],
  },
  {
    title: "Close the loop",
    say: "A mock interview from the student's own resume is marked by AI and feeds straight back into their placement score.",
    account: STUDENT, links: [{ href: "/student/interview", label: "Mock interview" }],
    try: ["Paste a short resume and answer a question or two", "Show the score before and after"],
  },
  {
    title: "Can we trust it?",
    say: "We compare the model honestly against a simple rule, check fairness, and list the limitations.",
    account: ADMIN, links: [{ href: "/insights/method", label: "Method & Trust" }, { href: "/admin/interventions", label: "Intervention results" }],
    try: ["Read the model vs baseline verdict", "Move a weight slider and recalculate"],
  },
];

export function DemoGuide() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const password = process.env.NEXT_PUBLIC_DEMO_PASSWORD;

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function openAs(account: Account, href: string) {
    if (busy) return;
    setBusy(href); setError(null);
    const sb = createClient();
    try {
      if (!password) throw new Error("no demo password");
      await sb.auth.signOut();
      const { error: e } = await sb.auth.signInWithPassword({ email: account.email, password });
      if (e) throw e;
      setEmail(account.email);
      router.push(href);
      router.refresh();
    } catch {
      setError(`Couldn't switch to the ${account.label} demo account. Sign out and sign in as the ${account.label} account instead.`);
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Signed in as <span className="font-medium text-foreground">{email ?? "…"}</span>. Each step opens in the right demo account for you.
      </p>
      {error && <p role="alert" className="rounded-md bg-risk-red-bg px-3 py-2 text-sm text-risk-red">{error}</p>}
      <ol className="space-y-4">
        {STEPS.map((s, i) => {
          const here = email === s.account.email;
          return (
            <li key={s.title}>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <CardTitle className="text-lg"><span className="mr-2 text-muted-foreground">{i + 1}.</span>{s.title}</CardTitle>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{s.account.label} · {s.account.email}</span>
                  </div>
                  <CardDescription className="text-base text-foreground">&ldquo;{s.say}&rdquo;</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="list-inside list-disc text-sm text-muted-foreground">{s.try.map((t) => <li key={t}>{t}</li>)}</ul>
                  <div className="flex flex-wrap gap-2">
                    {s.links.map((l) =>
                      here ? (
                        <Button key={l.href} asChild size="sm"><Link href={l.href}>Open {l.label}</Link></Button>
                      ) : (
                        <Button key={l.href} size="sm" variant="outline" disabled={busy !== null} onClick={() => openAs(s.account, l.href)}>
                          {busy === l.href ? "Switching…" : `Open ${l.label} as ${s.account.label}`}
                        </Button>
                      ),
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
