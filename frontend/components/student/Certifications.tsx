"use client";

import { ChevronDown, ExternalLink } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { CERTIFICATIONS, PILLAR_LABEL, type Certification } from "./playbook";
import { ProfileGate } from "./ProfileGate";
import { weakestPillars } from "./weakest";

function CourseRow({ course, match }: { course: Certification; match?: string }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[#e7eeea] py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-5 text-[#172824]">{course.title}</p>
        <p className="mt-1 text-xs text-slate-500">{course.provider}{match ? ` · Builds ${match.toLowerCase()}` : ` · ${course.tag}`}</p>
      </div>
      <a href={course.url} target="_blank" rel="noopener noreferrer"
        className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-sm font-semibold text-[#1d6158] no-underline transition-colors hover:bg-[#eef5f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62]">
        Explore <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </a>
    </li>
  );
}

export function Certifications() {
  return (
    <ProfileGate>
      {(profile) => {
        const weak = weakestPillars(profile).map(({ pillar }) => pillar);
        const items = CERTIFICATIONS
          .filter((course) => course.departments.length === 0 || course.departments.includes(profile.department))
          .map((course) => ({ course, match: course.skills.find((skill) => weak.includes(skill)) }))
          .sort((a, b) => Number(Boolean(b.match)) - Number(Boolean(a.match)));

        const mapped = items.filter((item) => item.match);
        const featured = mapped.slice(0, 3);
        const featuredTitles = new Set(featured.map(({ course }) => course.title));
        const more = items.filter(({ course }) => !featuredTitles.has(course.title));

        return (
          <div className="space-y-4">
            {mapped.length > 0 ? (
              <section aria-labelledby="matched-courses-heading" className="rounded-xl border border-[#dce7e1] bg-white px-4 sm:px-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-[#e7eeea] py-3">
                  <h2 id="matched-courses-heading" className="text-sm font-semibold text-[#172824]">Suggested for your focus areas</h2>
                  <p className="text-xs text-slate-500">{profile.department} · {weak.map((pillar) => PILLAR_LABEL[pillar]).join(", ")}</p>
                </div>
                <ul className="divide-y-0">
                  {featured.map(({ course, match }) => <CourseRow key={course.title} course={course} match={match ? PILLAR_LABEL[match] : undefined} />)}
                </ul>
              </section>
            ) : (
              <Card className="rounded-xl border-[#dce7e1] bg-white">
                <CardHeader>
                  <CardTitle className="text-sm text-[#172824]">No direct course match yet</CardTitle>
                  <p className="text-sm leading-5 text-slate-500">Browse courses selected for {profile.department} below.</p>
                </CardHeader>
              </Card>
            )}

            {more.length > 0 && (
              <details className="group overflow-hidden rounded-xl border border-[#dce7e1] bg-white shadow-sm shadow-slate-900/[0.02]">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm font-semibold text-[#172824] transition-colors hover:bg-[#f7faf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62] focus-visible:ring-inset sm:px-5">
                  <span>Browse {more.length} more courses</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="border-t border-slate-100 bg-[#fbfcfb] px-4 sm:px-5">
                  <ul>{more.map(({ course, match }) => <CourseRow key={course.title} course={course} match={match ? PILLAR_LABEL[match] : undefined} />)}</ul>
                </div>
              </details>
            )}
          </div>
        );
      }}
    </ProfileGate>
  );
}
