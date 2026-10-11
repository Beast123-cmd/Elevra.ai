"use client";

import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CERTIFICATIONS, PILLAR_LABEL } from "./playbook";
import { ProfileGate } from "./ProfileGate";
import { weakestPillars } from "./weakest";
import { StudentReveal } from "./StudentReveal";

export function Certifications() {
  return (
    <ProfileGate>
      {(p) => {
        const weak = weakestPillars(p).map((w) => w.pillar);
        const items = CERTIFICATIONS
          .filter((c) => c.departments.length === 0 || c.departments.includes(p.department))
          .map((c) => ({ c, match: c.skills.find((s) => weak.includes(s)) }))
          .sort((a, b) => Number(!!b.match) - Number(!!a.match));

        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Courses for {p.department} students. Ones that help with your weakest areas come first.
            </p>
            {items.length === 0 ? (
              <p className="text-sm text-slate-500">No suggestions for your department yet.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map(({ c, match }) => (
                  <StudentReveal key={c.title}>
                  <Card className={`h-full rounded-xl border-[#dce7e1] bg-white shadow-sm shadow-slate-900/[0.02] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[#b8cec3] hover:shadow-md ${match ? "ring-1 ring-[#286a62]/35" : ""}`}>
                    <CardHeader className="pb-2">
                      {match && <Badge className="mb-2 w-fit">Matches your weak area: {PILLAR_LABEL[match]}</Badge>}
                      <CardTitle className="text-base leading-snug">{c.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-slate-500">{c.provider} · {c.tag}</p>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-9 items-center gap-1 rounded-md text-sm font-semibold text-[#1d6158] no-underline transition-colors hover:text-[#123f3a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62] focus-visible:ring-offset-2"
                      >
                        Find on {c.provider} <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </CardContent>
                  </Card>
                  </StudentReveal>
                ))}
              </div>
            )}
          </div>
        );
      }}
    </ProfileGate>
  );
}
