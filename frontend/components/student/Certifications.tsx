"use client";

import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CERTIFICATIONS, PILLAR_LABEL } from "./playbook";
import { ProfileGate } from "./ProfileGate";
import { weakestPillars } from "./weakest";

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
                  <Card key={c.title} className={match ? "ring-1 ring-slate-900" : ""}>
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
                        className="inline-flex items-center gap-1 text-sm font-medium underline underline-offset-2"
                      >
                        Find on {c.provider} <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );
      }}
    </ProfileGate>
  );
}
