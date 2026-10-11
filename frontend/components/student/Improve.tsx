"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PILLAR_LABEL, PLAYBOOK } from "./playbook";
import { ProfileGate } from "./ProfileGate";
import { weakestPillars } from "./weakest";

export function Improve() {
  return (
    <ProfileGate>
      {(p) => {
        const weak = weakestPillars(p);
        if (weak.length === 0) {
          return (
            <Card>
              <CardHeader>
                <CardTitle>Nothing to improve yet</CardTitle>
                <CardDescription>We don&apos;t have enough data about you to suggest a path.</CardDescription>
              </CardHeader>
            </Card>
          );
        }
        return (
          <div className="space-y-6">
            <p className="text-sm text-slate-500">
              These are your two lowest areas right now. Small, steady steps here will move your score the most.
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              {weak.map(({ pillar, value }, i) => (
                <Card key={pillar}>
                  <CardHeader>
                    <div className="flex items-baseline justify-between gap-3">
                      <CardTitle className="text-lg">{i + 1}. {PILLAR_LABEL[pillar]}</CardTitle>
                      <span className="text-sm tabular-nums text-slate-500">{value.toFixed(0)} / 100</span>
                    </div>
                    <CardDescription>{PLAYBOOK[pillar].why}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ol className="space-y-3">
                      {PLAYBOOK[pillar].steps.map((s, j) => (
                        <li key={s} className="flex gap-3 text-sm">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-medium text-white">{j + 1}</span>
                          <span className="pt-0.5">{s}</span>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              ))}
            </div>
            <p className="text-sm text-slate-500">
              Looking for courses? See <Link href="/student/certifications" className="font-medium underline underline-offset-2">suggested certifications</Link>.
            </p>
          </div>
        );
      }}
    </ProfileGate>
  );
}
