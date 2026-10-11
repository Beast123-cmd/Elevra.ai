"use client";

import { ChevronDown, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CERTIFICATIONS, PILLAR_LABEL, type Certification } from "./playbook";
import { ProfileGate } from "./ProfileGate";
import { weakestPillars } from "./weakest";
import { StudentReveal } from "./StudentReveal";
import { StudentNextStep } from "./StudentNextStep";

function CourseCard({ course, match, featured = false }: { course: Certification; match?: string; featured?: boolean }) {
  return (
    <StudentReveal>
      <Card className={`flex h-full flex-col rounded-xl border-[#dce7e1] shadow-sm shadow-slate-900/[0.02] ${featured ? "bg-[#f3f7f4]" : "bg-white"}`}>
        <CardHeader className="pb-2">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {match && <Badge className="w-fit">Matches {match.toLowerCase()}</Badge>}
            <Badge variant="outline">{course.tag}</Badge>
          </div>
          <CardTitle className="text-base leading-snug text-[#172824]">{course.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex h-full flex-col gap-3">
          <p className="text-xs text-slate-500">{course.provider}</p>
          <a href={course.url} target="_blank" rel="noopener noreferrer"
            className="mt-auto inline-flex min-h-10 w-fit items-center gap-1 rounded-md px-1 text-sm font-semibold text-[#1d6158] no-underline transition-colors hover:text-[#123f3a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62] focus-visible:ring-offset-2">
            Explore course <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </CardContent>
      </Card>
    </StudentReveal>
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
          <div className="space-y-5 sm:space-y-6">
            <section className="rounded-lg border border-[#e2ebe6] bg-[#f4f7f5] px-4 py-3 sm:px-5">
              <p className="text-sm leading-6 text-slate-600">
                Options are filtered for {profile.department}. Courses linked to your lowest assessed areas appear first; choose one to explore with its provider.
              </p>
            </section>

            {mapped.length > 0 ? (
              <section aria-labelledby="matched-courses-heading" className="space-y-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[.13em] text-[#286a62]">Recommended for you</p>
                  <h2 id="matched-courses-heading" className="mt-1 text-base font-semibold text-[#172824]">A few relevant places to start</h2>
                  <p className="mt-1 text-sm text-slate-500">Matched to your assessed focus areas: {weak.map((pillar) => PILLAR_LABEL[pillar]).join(" and ")}.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {featured.map(({ course, match }) => <CourseCard key={course.title} course={course} match={match ? PILLAR_LABEL[match] : undefined} featured />)}
                </div>
              </section>
            ) : (
              <Card className="rounded-xl border-[#dce7e1] bg-white">
                <CardHeader>
                  <CardTitle className="text-base text-[#172824]">No direct course match yet</CardTitle>
                  <p className="text-sm leading-5 text-slate-500">There are no courses mapped to your currently assessed focus areas. You can still browse the department-filtered list below.</p>
                </CardHeader>
              </Card>
            )}

            {more.length > 0 && (
              <details className="group overflow-hidden rounded-xl border border-[#dce7e1] bg-white shadow-sm shadow-slate-900/[0.02]">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 text-sm font-semibold text-[#172824] transition-colors hover:bg-[#f7faf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62] focus-visible:ring-inset sm:px-5">
                  <span className="min-w-0"><span className="block">Browse more courses</span><span className="mt-0.5 block text-xs font-normal text-slate-500">{more.length} more option{more.length === 1 ? "" : "s"} for {profile.department}</span></span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="grid gap-4 border-t border-slate-100 bg-[#fbfcfb] p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
                  {more.map(({ course, match }) => <CourseCard key={course.title} course={course} match={match ? PILLAR_LABEL[match] : undefined} />)}
                </div>
              </details>
            )}

            <StudentNextStep
              label="NEXT"
              title="Practise explaining what you know"
              description="Use a mock interview to practise with questions shaped by your resume."
              href="/student/interview"
            />
          </div>
        );
      }}
    </ProfileGate>
  );
}
