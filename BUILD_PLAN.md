# CampusCompass: Build Plan (15 hours, 3 people)

> **For agentic workers:** read `docs/PRD.md` first, then this file, then `CLAUDE.md`. Start each session by stating who you are ("I am Utki, role C"). Work only in your lane's folders.

**Goal:** ship the PRD's P0 on a live URL by hour 6, and everything in P1 by hour 11. The final submission goes in by hour 15, with a buffer until 10:00 on 12 Oct.

**Architecture:**
- A Python batch pipeline turns 7 messy CSVs into cleaned tables, scores, risks, segments and analytics in **Supabase Postgres**.
- A **Next.js** app on **Vercel** reads Supabase directly for every dashboard.
- **FastAPI** on a **Hostinger VPS** handles only the dynamic parts: what-if, re-score, user creation, the mock interview (Gemini + ElevenLabs), AI briefs and chat.
- Scoring logic lives in a single pure-Python module, `pipeline/scoring/engine.py`. The batch job and the API both import it, so they always agree.

**Tech stack:**
- Next.js 14 (App Router) + TypeScript, Tailwind, shadcn/ui, Recharts, `@supabase/ssr`
- FastAPI, uvicorn, `supabase` (py), `google-genai`, `elevenlabs`
- Python 3.12+: pandas, numpy, scikit-learn, pytest
- Supabase (Postgres + Auth); Vercel; Hostinger VPS (Ubuntu, nginx, systemd, certbot)

**Spec:** `docs/PRD.md`. Brief: `docs/KPMG_PS.md`. Research: `docs/STRATEGY.md`.
**Detailed pipeline code:** `docs/superpowers/plans/2026-10-11-campus-compass.md`, Tasks 2–10. Lane A reuses that code with the changes listed in §5.

## Global Constraints
- Weights (exact): academic 0.25, attendance 0.15, lms 0.10, placement 0.20, skills 0.15, engagement 0.05, feedback 0.10.
- Bands: ≥75 Thriving; ≥60 On Track; ≥45 Needs Attention; otherwise Critical.
- Risk tiers (exact strings): `Red | Amber | Green`, plus `Not assessed` for placement only.
- A missing pillar is never scored as 0. It is excluded, and the remaining weights are renormalised.
- Canonical `student_id` is a 5-digit string such as `"42178"`. The demo password lives in `.env` only.
- Seed is 42. Students are years 2–4, about 1,500 of them, in departments `Comp, IT, ENTC, AI&DS`. The current semester is at week 8.
- Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`) stay on the server only.
- UI wording: risk means "needs a check-in". Never write "will fail".
- No code copied from other teams' repos (rulebook §26). Every AI feature has a non-AI fallback.

## Review Focus (the five failures most likely to hurt us in a demo)
1. **A 2nd-year student with no placement data:** must show "Not yet assessed", a renormalised score and confidence < 100. *Test in Task A2 (`test_engine.py`).*
2. **Messy raw values** (`NA`, `78%`, `AB`, `4/5`, 112, negative minutes, `SCA-42178 `, `E&TC`): must be parsed or nulled and logged, never crash the pipeline. *Test in Task A1.*
3. **A logged-in student opening `/admin` or `/faculty`:** must be redirected to `/student`. *Manual check in Task B1.*
4. **The API is down or slow:** dashboards must still render, and what-if, interview and briefs must show a friendly "offline" state. *Manual check in Task B3 and Task C4: stop the API service and reload.*
5. **Empty filter results or a mentor with 0 mentees:** must show an empty-state message, never a blank table or a crash. *Manual check in Task B4.*

---

## 1. Clock timeline (hour 0 = 12:00, 11 Oct)

| Hour | Clock | Aayush (A) | Mahesh (B) | Utki (C) | Checkpoint |
|---|---|---|---|---|---|
| 0–1 | 12:00–13:00 | Migration + 50-student mock seed | Repo, Next.js + FastAPI skeletons, CLAUDE.md, Supabase, VPS | Hackathons module copied; student route shell | Hour-0 done |
| 1–4 | 13:00–16:00 | A1 generate + clean, A2 engine | B1 login + guard, B2 user mgmt, shared `StudentProfile` | C1 student dashboard (mock), C2 Data Health | **Merge 1 (16:00)** |
| 4–6 | 16:00–18:00 | A3 full pipeline → Supabase, demo accounts | B3 admin overview | C3 certifications + skill path, C5 Segments | **Merge 2 + deploy + SUBMIT v1 (18:00)** |
| 6–9 | 18:00–21:00 | A4 model, drivers, history, insights, fairness, seeded interventions; A5 `/whatif` `/rescore` | B4 faculty queue, B5 Student 360 + interventions | C4 mock interview (text first, then voice; timebox ends 21:00) | **Merge 3 + deploy + SUBMIT v2 (21:00)** |
| 9–11 | 21:00–23:00 | A6 score note + Data Health metrics polish | B6 insights, effectiveness, notifications; B7 briefs/chat (P2) | C6 what-if UI, notifications feed, C7 Method & Trust, C8 `/demo` | **Feature freeze (23:00)** |
| 11–13 | 23:00–01:00 | Everyone: integrate, fix bugs, curate demo students, QA (§9) | | | Deploy + SUBMIT v3 |
| 13–15 | 01:00–03:00 | README + score note final | Final deploy | Slides + 3–5 min video | **SUBMIT final (03:00)** |
| — | 03:00–07:30 | Sleep. One person keeps their phone on. | | | |
| — | 07:30–09:00 | Live-URL QA in incognito. Fix bugs only and resubmit. **Stop at 09:00.** | | | Deadline 10:00 |

Merge order at every checkpoint: **A → B → C**. Mahesh squash-merges, deploys, and posts "merged, rebase now".

---

## 2. Repo structure and ownership

```
HacXalerate/                      (GitHub: campus-compass)
├── CLAUDE.md, AGENTS.md, README.md, .env.example, .gitignore   ← frozen after hour 0 (Mahesh)
├── docs/                          ← PRD/BUILD_PLAN frozen (Mahesh); SCORE_METHODOLOGY.md (Aayush); slides (Utki)
├── db/migrations/                 ← Aayush (001_init.sql ready; never edit after run)
├── data/raw/                      ← Aayush (generated, committed)
├── pipeline/                      ← Aayush
│   ├── requirements.txt
│   ├── run.py                     (CLI: --regenerate --n N --no-db)
│   ├── seed.py                    (writes Supabase + demo accounts + seeded interventions)
│   ├── generate/  clean/  features/
│   ├── scoring/  (engine.py = pure per-student logic; model.py = training; segments.py; insights.py)
│   └── tests/
├── backend/
│   ├── main.py, common/ (db.py, auth.py, settings.py)   ← frozen after hour 0 (Mahesh)
│   ├── requirements.txt                                  ← frozen after hour 0 (Mahesh)
│   ├── routers/whatif.py                                 ← Aayush
│   ├── routers/admin.py, faculty.py, chat.py, briefs.py  ← Mahesh
│   └── routers/student.py, interview.py, tts.py          ← Utki
└── frontend/
    ├── package.json, middleware.ts, app/layout.tsx, app/page.tsx, app/login/,
    │   lib/ (supabase/, api.ts, types.ts, format.ts), components/ui/   ← frozen after hour 0 (Mahesh)
    ├── components/shared/          ← Mahesh (StudentProfile, RiskBadge, BandBadge, Kpi, charts)
    ├── app/admin/, app/faculty/, components/admin/, components/faculty/   ← Mahesh
    ├── app/student/, components/student/ (hackathons/ here)              ← Utki
    └── app/insights/ (data-health, segments, method), app/demo/, components/insights/   ← Utki
```

`app/insights/*` is visible to the **admin and faculty** roles. Utki reads the shared components but does not edit them. To change one, ask Mahesh.

---

## 3. Hour-0 checklist (all three people together, 60 minutes max)

- [ ] **Lock the problem statement** on the platform (Team Lead) **before 12:00**.
- [ ] Mahesh: create the GitHub repo `campus-compass` from this folder and add Aayush and Utki as collaborators.
  ```bash
  cd A:/WebDev/HacXalerate && git init -b main && git add docs db CLAUDE.md AGENTS.md .gitignore .env.example
  git commit -m "chore: PRD, build plan, schema, agent rules" && gh repo create campus-compass --private --source . --push
  ```
  (Switch the repo to **public** before submitting, or add the evaluators if the platform asks you to.)
- [ ] Mahesh: create the Supabase project. Share URL, anon key, service key and DB URL **privately**. Never commit `.env`.
- [ ] Aayush: run `db/migrations/001_init.sql` in the Supabase SQL editor. Expected: 18 tables, 1 view, no errors.
- [ ] Aayush: push the **50-student mock seed** (`python pipeline/run.py --regenerate --n 50 && python pipeline/seed.py`) so B and C are unblocked by about hour 0:45.
- [ ] Mahesh: Next.js skeleton:
  ```bash
  npx create-next-app@14.2.15 frontend --ts --tailwind --app --eslint --src-dir=false --import-alias "@/*"
  cd frontend && npx shadcn@2.1.0 init -d && npx shadcn@2.1.0 add button card badge table tabs input select slider dialog dropdown-menu sonner skeleton progress textarea
  npm i @supabase/ssr@0.5.1 @supabase/supabase-js@2.45.4 recharts@2.12.7 lucide-react@0.447.0
  ```
  It must include: `app/login/page.tsx` with three tabs and **three demo buttons**, `middleware.ts` with the role guard (§4.4), empty `app/admin|faculty|student|insights|demo` pages, `lib/supabase/{client,server}.ts`, `lib/api.ts`, and `lib/types.ts` (copy §4.1 verbatim).
- [ ] Mahesh: FastAPI skeleton: `backend/main.py` registering every router as a stub (`whatif, admin, faculty, chat, briefs, student, interview, tts`), plus `common/settings.py`, `common/db.py` (service-role client), `common/auth.py` (`require_role(*roles)` dependency) and CORS from `ALLOWED_ORIGINS`.
- [ ] Mahesh: VPS ready (§7.2), with `/health` live at `https://api.<domain>/health`.
- [ ] Utki: copy the hackathons module into `frontend/components/student/hackathons/`.
- [ ] Mahesh: push to `main`, then turn on **branch protection** (require a PR). Everyone runs `git checkout -b feat/data | feat/admin-faculty | feat/student`.

`.env.example` (committed; real values are shared privately):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_DEMO_PASSWORD=          # demo accounts only; synthetic data
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=          # backend + pipeline only
SUPABASE_DB_URL=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
ELEVENLABS_MODEL=eleven_flash_v2_5
ALLOWED_ORIGINS=http://localhost:3000,https://<vercel-app>.vercel.app
DEMO_PASSWORD=
```

---

## 4. Contracts (frozen at hour 0; changes go through Mahesh)

### 4.1 `frontend/lib/types.ts` (the shape of `scores.profile` and the `analytics` payloads)
```ts
export const PILLARS = ["academic", "attendance", "lms", "placement", "skills", "engagement", "feedback"] as const;
export type Pillar = (typeof PILLARS)[number];
export type Tier = "Red" | "Amber" | "Green" | "Not assessed";
export interface Driver { label: string; value: string; points: number }
export interface Risk { level: Tier; points: number; drivers: Driver[] }
export interface Profile {
  student_id: string; name: string; department: string; year: number; batch: string; section: string;
  gender: string; residence: string; mentor_faculty_id: string;
  pillars: Record<Pillar, number | null>;
  score: number; band: string; confidence: number; missing: Pillar[];
  contributions: { pillar: Pillar; points: number }[];         // vs cohort mean, sorted by |points|
  academic_risk: Risk; placement_risk: Risk;
  model: { prob: number; factors: { feature: string; label: string; effect: number }[] };
  segment: string; priority: number; actions: string[]; engagement_drop: boolean; declining: boolean;
  metrics: Record<string, number | null>;                        // raw inputs used by engine (see §5 A2)
  percentiles: Record<string, number>;                            // e.g. { coding: 18 } (display only)
  weekly: { week: number; logins: number | null; attendance: number | null; submit_rate: number | null }[];
  history: { semester: number; score: number; sgpa: number | null }[];
}
export interface Cohort {
  generated_at: string; current_week: number; n_students: number;
  weights: Record<Pillar, number>; bands: { min: number; name: string }[]; pillar_labels: Record<Pillar, string>;
  pillar_means: Record<Pillar, number>;
  dept_pillars: ({ dept: string } & Record<Pillar, number>)[];
  weekly_trend: { week: number; dept: string; logins: number; attendance: number }[];
  lead_time: { week: number; failed_logins: number; passed_logins: number; failed_attendance: number; passed_attendance: number }[];
  segments: { name: string; rule: string; action: string; count: number }[];
}
export interface ModelCard {
  features: { name: string; label: string; coef: number; mean: number; std: number }[]; intercept: number;
  metrics: { target: string; train_window: string; n_train: number; n_test: number; base_rate: number; threshold: number;
    auc: number; cv_auc: number; precision: number; recall: number; f1: number;
    baseline: { rule: string; auc: number; precision: number; recall: number; f1: number } };
  fairness: { group_type: string; group: string; n: number; flag_rate: number | null; recall: number | null; fpr: number | null }[];
}
export interface Insight { id: string; title: string; detail: string; severity: "info" | "warning" | "critical" }
export interface WhatIfResponse { score: number; band: string; delta: number; pillars: Record<Pillar, number | null>; academic_risk: Risk; placement_risk: Risk }
```

### 4.2 Queries (use these exact shapes)
| Need | Query |
|---|---|
| Admin cohort table | `supabase.from("student_unified_view").select("*")` (1,500 rows; aggregate in the client) |
| Cohort / model / insights | `supabase.from("analytics").select("key,payload")`, then key into `cohort`, `model`, `insights` |
| Faculty mentees | `supabase.from("scores").select("student_id,success_score,band,academic_risk,placement_risk,segment,priority,engagement_drop,drivers,students!inner(name,department,year,batch,mentor_faculty_id)").eq("students.mentor_faculty_id", facultyId).order("priority",{ascending:false})` |
| Student 360 | `supabase.from("scores").select("profile").eq("student_id", id).single()` |
| Interventions for a student | `supabase.from("interventions").select("*").eq("student_id", id).order("created_at",{ascending:false})` |
| Data Health | `source_stats` (all), `data_quality` (all), `analytics.cohort` |
| Current user role | `session.user.app_metadata.role` (set by the pipeline/API at user creation), plus `app_metadata.student_id` and `app_metadata.faculty_id` |

### 4.3 API: see PRD §8. `lib/api.ts`:
```ts
import { createClient } from "@/lib/supabase/client";
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const { data } = await createClient().auth.getSession();
  const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`API ${path} failed: ${r.status}`);
  return r.json();
}
```

### 4.4 Role guard: `frontend/middleware.ts`
```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const HOME: Record<string, string> = { admin: "/admin", faculty: "/faculty", student: "/student" };
const ALLOWED: Record<string, string[]> = {
  "/admin": ["admin"], "/faculty": ["faculty", "admin"], "/insights": ["admin", "faculty"],
  "/student": ["student"], "/demo": ["admin", "faculty", "student"],
};

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => req.cookies.getAll(),
      setAll: (c) => c.forEach(({ name, value, options }) => res.cookies.set(name, value, options)) },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const path = req.nextUrl.pathname;
  const role = (user?.app_metadata?.role as string | undefined) ?? "";
  if (path === "/" || path.startsWith("/login")) {
    return user && role ? NextResponse.redirect(new URL(HOME[role], req.url)) : res;
  }
  const area = Object.keys(ALLOWED).find((p) => path.startsWith(p));
  if (!area) return res;
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  if (!ALLOWED[area].includes(role)) return NextResponse.redirect(new URL(HOME[role] ?? "/login", req.url));
  return res;
}
export const config = { matcher: ["/((?!_next|favicon.ico|api).*)"] };
```

Demo buttons on `/login` call `supabase.auth.signInWithPassword({ email, password: process.env.NEXT_PUBLIC_DEMO_PASSWORD })` with `admin@demo.edu`, `faculty1@demo.edu`, `student.red@demo.edu` or `student.star@demo.edu`.

---

## 5. Lane A: Aayush (Data & ML)

Reuse the code in `docs/superpowers/plans/2026-10-11-campus-compass.md`, Tasks 2–10, **with the changes below**. Commit after each task with the `data:` prefix.

### A1: Generator and cleaning (hours 1–3). Old plan Tasks 2–3, with these changes:
- `N_STUDENTS` = 1500 by default; `--n` overrides it for the mock seed. Departments: `Comp, IT, ENTC, AI&DS`. 50 faculty (`F01`–`F50`), each mentoring about 30 students in their own department. Also write `faculty.csv`.
- **ID formats per file:**

  | File | ID format |
  |---|---|
  | `students.csv` | `42178` |
  | `academic.csv` | `SCA-42178` |
  | `attendance.csv` | `sca42178`, with 0.5% `SCA42178 ` |
  | `lms.csv` | email `42178@campus.edu`, 5% upper-case |
  | `engagement.csv` | `42178` |
  | `placement.csv` | header `" Student ID"`, values `SCA-42178 ` |
  | `skills.csv` | `42178` |
  | `feedback.csv` | `sca-42178` |

  Generate IDs as `f"{40000 + i:05d}"`.
- **One normaliser for all of them:** `norm_id = lambda s: s.astype(str).str.extract(r"(\d{5})")[0]`. Log an issue whenever the raw value differs from the normalised one.
- **Department names in `academic.csv`** are messy: `Computer`, `COMP`, `Comp Engg`, `E&TC`, `ENTC`, `AIDS`, `AI & DS`. Map them to the canonical four and log the fix.
- **Units:**
  - `attendance.csv` stays held/attended per week. Also write `attendance_summary.csv` per subject, with `attendance` as a **fraction** (0–1) for 30% of rows and a **percentage** for the rest. Detect values ≤ 1 and multiply by 100, and log it.
  - Skills keep the mixed 0–10 and 0–100 scale.
- **Placement:** drop the resume column. Mock interview is 1–5, and 15% of rows are blank (no mock taken yet).
- **Skills:** certifications count as verified `certification` rows from `engagement.csv`.
- **Tests:** update the old `test_generate.py` and `test_clean.py` assertions to the new IDs and headers. Add a test that `" SCA-42178 "`, `"sca42178"` and `"42178@CAMPUS.EDU"` all resolve to `"42178"`.

### A2: The shared engine `pipeline/scoring/engine.py` (hours 3–4). It replaces old Tasks 4 (pillars), 5 (score), 6 (risk) and 8 (segments) for **per-student** logic.

**Files:** create `pipeline/scoring/__init__.py`, `pipeline/scoring/engine.py` and `pipeline/tests/test_engine.py`.

- [ ] **Step 1: Write the failing test**
```python
# pipeline/tests/test_engine.py
import math
from scoring.engine import WEIGHTS, evaluate, pillars_from_metrics, success_score

BASE = dict(cgpa=8.0, internal_pct=75.0, backlogs=0, attendance_pct=88.0, submit_rate=0.9, login_consistency=1.0,
            avg_minutes=100.0, login_trend=0.0, engagement_drop=0, aptitude=70.0, coding=70.0, mock=4.0,
            tech_skill=75.0, soft_skill=70.0, certifications=1, events=2, clubs=1, hackathons=1,
            satisfaction=4.0, faculty_rating=4.0, attendance_drop_pp=0.0)

def m(**o):
    d = dict(BASE); d.update(o); return d

def test_weights_sum_to_one():
    assert math.isclose(sum(WEIGHTS.values()), 1.0)

def test_missing_placement_renormalises_and_not_assessed():
    p = pillars_from_metrics(m(aptitude=None, coding=None, mock=None))
    assert p["placement"] is None
    s = success_score(p)
    assert s["confidence"] == 80 and s["missing"] == ["placement"]
    r = evaluate(m(aptitude=None, coding=None, mock=None))
    assert r["placement_risk"]["level"] == "Not assessed"

def test_detention_hard_floor_red():
    r = evaluate(m(attendance_pct=60.0))
    assert r["academic_risk"]["level"] == "Red"
    assert r["academic_risk"]["drivers"][0]["label"].startswith("Attendance below detention")

def test_healthy_student_green_and_thriving():
    r = evaluate(m())
    assert r["academic_risk"]["level"] == "Green" and r["placement_risk"]["level"] == "Green"
    assert r["band"] in ("Thriving", "On Track")

def test_star_unready_segment():
    r = evaluate(m(cgpa=9.2, internal_pct=90.0, aptitude=40.0, coding=35.0, mock=2.0))
    assert r["segment"] == "Academic stars, placement unready"

def test_silent_disengager_first():
    r = evaluate(m(engagement_drop=1, login_trend=-0.7))
    assert r["segment"] == "Silent disengagers"

def test_whatif_raises_score():
    low = evaluate(m(coding=30.0))["score"]
    high = evaluate(m(coding=80.0))["score"]
    assert high > low
```

- [ ] **Step 2:** run `cd pipeline && python -m pytest tests/test_engine.py -q`. Expected: FAIL (module missing).

- [ ] **Step 3: Implement**
```python
# pipeline/scoring/engine.py
"""Single source of truth for per-student scoring. Imported by the batch pipeline AND the FastAPI what-if."""
from __future__ import annotations

import math

PILLARS = ["academic", "attendance", "lms", "placement", "skills", "engagement", "feedback"]
WEIGHTS = {"academic": 0.25, "attendance": 0.15, "lms": 0.10, "placement": 0.20,
           "skills": 0.15, "engagement": 0.05, "feedback": 0.10}
BANDS = [(75.0, "Thriving"), (60.0, "On Track"), (45.0, "Needs Attention"), (0.0, "Critical")]
MODEL_FEATURES = [("prior_cgpa", "cgpa", "Prior CGPA"), ("prior_backlogs", "backlogs", "Backlogs"),
                  ("attendance_pct", "attendance_pct", "Attendance %"), ("submit_rate", "submit_rate", "Assignment submission"),
                  ("login_consistency", "login_consistency", "LMS consistency"), ("login_trend", "login_trend", "LMS trend"),
                  ("internal_pct", "internal_pct", "Internal marks %")]
SEGMENTS = [
    ("Silent disengagers", "Sharp LMS drop or attendance falling >= 10 pp over 4 weeks", "Mentor call within 48 hours"),
    ("Academic stars, placement unready", "Academic >= 75 and placement < 55", "Coding practice + 2 mock interviews"),
    ("Engaged but struggling", "Co-curricular >= 60 and academic < 55", "Remedial classes + mentoring"),
    ("Skilled but irregular", "Skills >= 70 and attendance < 75", "Attendance counselling"),
    ("Placement-ready all-rounders", "Score >= 75 and placement >= 70", "Advanced opportunities + peer mentoring"),
    ("Steady middle", "No major pattern", "Monthly nudges"),
]
PLAYBOOK = [("Attendance", "Attendance counselling + guardian contact"), ("backlogs", "Supplementary-exam prep + remedial classes"),
            ("CGPA", "Academic mentoring plan, fortnightly review"), ("Internal marks", "Subject-faculty doubt sessions"),
            ("Assignment", "Assignment recovery plan with LMS reminders"), ("LMS activity", "Mentor call within 48h (early warning)"),
            ("Coding", "Coding practice track (2 problems/day)"), ("Aptitude", "Aptitude training batch"),
            ("mock interview", "Take 2 mock interviews (in-app)"), ("hackathons", "Join one hackathon or certification"),
            ("Technical skill", "Skill-lab enrolment"), ("readiness", "Placement-readiness workshop"),
            ("backlog blocks", "Clear backlog before drive season")]


def _n(v):
    if v is None:
        return None
    v = float(v)
    return None if math.isnan(v) else v


def _wmean(parts):
    present = [(v, w) for v, w in parts if v is not None]
    return None if not present else sum(v * w for v, w in present) / sum(w for _, w in present)


def _clip(v):
    return None if v is None else max(0.0, min(100.0, v))


def band_for(score: float) -> str:
    return next(name for t, name in BANDS if score >= t)


def pillars_from_metrics(m: dict) -> dict:
    g = lambda k: _n(m.get(k))
    cgpa, mock, am = g("cgpa"), g("mock"), g("avg_minutes")
    academic = _wmean([(None if cgpa is None else cgpa * 10, 0.6), (g("internal_pct"), 0.4)])
    if academic is not None:
        academic -= 5 * (g("backlogs") or 0)
    lms = _wmean([(g("submit_rate"), 0.5), (g("login_consistency"), 0.3), (None if am is None else min(am / 100, 1.0), 0.2)])
    ts, ss = g("tech_skill"), g("soft_skill")
    skills = None if ts is None and ss is None else _wmean([(ts, 0.5), (ss, 0.3), (min(100.0, 25 * (g("certifications") or 0)), 0.2)])
    sat, fr = g("satisfaction"), g("faculty_rating")
    return {k: _clip(v) for k, v in {
        "academic": academic,
        "attendance": g("attendance_pct"),
        "lms": None if lms is None else lms * 100,
        "placement": _wmean([(g("aptitude"), 0.35), (g("coding"), 0.40), (None if mock is None else mock / 5 * 100, 0.25)]),
        "skills": skills,
        "engagement": min(100.0, 10 * (g("events") or 0) + 15 * (g("clubs") or 0) + 20 * (g("hackathons") or 0)),
        "feedback": _wmean([(None if sat is None else (sat - 1) / 4 * 100, 0.5), (None if fr is None else (fr - 1) / 4 * 100, 0.5)]),
    }.items()}


def success_score(p: dict, weights: dict = WEIGHTS) -> dict:
    present = {k: v for k, v in p.items() if v is not None and weights.get(k, 0) > 0}
    den = sum(weights[k] for k in present)
    if den == 0:
        weights, present = WEIGHTS, {k: v for k, v in p.items() if v is not None}
        den = sum(weights[k] for k in present) or 1.0
    score = round(sum(weights[k] * v for k, v in present.items()) / den, 1)
    return {"score": score, "band": band_for(score), "confidence": round(den / sum(weights.values()) * 100),
            "missing": [k for k in PILLARS if p.get(k) is None]}


def model_prob(m: dict, card: dict | None):
    if not card:
        return 0.0, []
    z, factors = card["intercept"], []
    for f, (name, key, label) in zip(card["features"], MODEL_FEATURES):
        x = _n(m.get(key))
        eff = 0.0 if x is None else f["coef"] * (x - f["mean"]) / f["std"]
        z += eff
        factors.append({"feature": name, "label": label, "effect": round(eff, 3)})
    factors.sort(key=lambda d: -abs(d["effect"]))
    return 1 / (1 + math.exp(-z)), factors[:3]


def _d(label, value, points):
    return {"label": label, "value": value, "points": points}


def _tier(drivers, hard=False):
    pts = sum(d["points"] for d in drivers)
    return {"level": "Red" if hard or pts >= 6 else ("Amber" if pts >= 3 else "Green"), "points": pts,
            "drivers": sorted(drivers, key=lambda d: -d["points"])}


def academic_risk(m: dict, prob: float) -> dict:
    g = lambda k: _n(m.get(k))
    d, hard = [], False
    att, bl, cg, ip, sr = g("attendance_pct"), g("backlogs") or 0, g("cgpa"), g("internal_pct"), g("submit_rate")
    if att is not None and att < 65:
        d.append(_d("Attendance below detention line (65%)", f"{att:.0f}%", 4)); hard = True
    elif att is not None and att < 75:
        d.append(_d("Attendance below 75% mandate", f"{att:.0f}%", 2))
    if bl >= 3:
        d.append(_d("3+ backlogs", f"{bl:.0f}", 4)); hard = True
    elif bl >= 1:
        d.append(_d("Active backlogs", f"{bl:.0f}", 2))
    if cg is not None and cg < 6:
        d.append(_d("CGPA below 6.0", f"{cg:.2f}", 2))
    if ip is not None and ip < 50:
        d.append(_d("Internal marks below 50%", f"{ip:.0f}%", 2))
    if sr is not None and sr < 0.6:
        d.append(_d("Assignment submission below 60%", f"{sr * 100:.0f}%", 1))
    if (g("engagement_drop") or 0) >= 1:
        d.append(_d("LMS activity dropped sharply (wk 6-8 vs 1-4)", f"{(g('login_trend') or 0) * 100:+.0f}%", 2))
    if prob >= 0.6:
        d.append(_d("Early-warning model: high probability of a backlog", f"{prob * 100:.0f}%", 3))
    elif prob >= 0.35:
        d.append(_d("Early-warning model: elevated probability of a backlog", f"{prob * 100:.0f}%", 1))
    return _tier(d, hard)


def placement_risk(m: dict, placement_pillar) -> dict:
    if placement_pillar is None:
        return {"level": "Not assessed", "points": 0, "drivers": []}
    g = lambda k: _n(m.get(k))
    d = []
    if placement_pillar < 50:
        d.append(_d("Placement readiness below 50", f"{placement_pillar:.0f}", 3))
    if (g("coding") or 0) < 40:
        d.append(_d("Coding score below 40", f"{g('coding') or 0:.0f}", 2))
    if (g("aptitude") or 0) < 40:
        d.append(_d("Aptitude score below 40", f"{g('aptitude') or 0:.0f}", 2))
    if g("mock") is None or g("mock") <= 2:
        d.append(_d("Weak or no mock interview", "none" if g("mock") is None else f"{g('mock'):.1f}/5", 1))
    if (g("hackathons") or 0) + (g("certifications") or 0) == 0:
        d.append(_d("No verified hackathons or certifications", "0", 1))
    if g("tech_skill") is not None and g("tech_skill") < 50:
        d.append(_d("Technical skill below 50", f"{g('tech_skill'):.0f}", 1))
    if (g("backlogs") or 0) >= 1:
        d.append(_d("Active backlog blocks most campus drives", f"{g('backlogs'):.0f}", 2))
    return _tier(d)


def segment_for(p: dict, m: dict, score: float) -> str:
    v = lambda k: p.get(k) if p.get(k) is not None else -1
    if (_n(m.get("engagement_drop")) or 0) >= 1 or (_n(m.get("attendance_drop_pp")) or 0) >= 10:
        return SEGMENTS[0][0]
    if v("academic") >= 75 and 0 <= v("placement") < 55:
        return SEGMENTS[1][0]
    if v("engagement") >= 60 and 0 <= v("academic") < 55:
        return SEGMENTS[2][0]
    if v("skills") >= 70 and 0 <= v("attendance") < 75:
        return SEGMENTS[3][0]
    if score >= 75 and v("placement") >= 70:
        return SEGMENTS[4][0]
    return SEGMENTS[5][0]


def actions_for(acad: dict, place: dict) -> list[str]:
    out = []
    for d in acad["drivers"] + place["drivers"]:
        for key, action in PLAYBOOK:
            if key.lower() in d["label"].lower() and action not in out:
                out.append(action); break
    return out[:4]


def evaluate(m: dict, weights: dict = WEIGHTS, card: dict | None = None) -> dict:
    p = pillars_from_metrics(m)
    s = success_score(p, weights)
    prob, factors = model_prob(m, card)
    acad, place = academic_risk(m, prob), placement_risk(m, p["placement"])
    drop = 1 if (_n(m.get("engagement_drop")) or 0) >= 1 else 0
    return {**s, "pillars": p, "academic_risk": acad, "placement_risk": place,
            "model": {"prob": round(prob, 3), "factors": factors},
            "segment": segment_for(p, m, s["score"]), "actions": actions_for(acad, place),
            "priority": round(acad["points"] + 0.6 * place["points"] + max(0.0, 60 - s["score"]) / 10 + 2 * drop, 1)}
```
Note: the `"backlog blocks"` playbook key comes after `"backlogs"`, but "Active backlog blocks…" does not contain "backlogs", so it falls through to the correct action.

- [ ] **Step 4:** run the tests. Expected: `7 passed`. Commit: `data: shared scoring engine`.

### A3: Full pipeline → Supabase plus demo accounts (hours 4–6, P0)
- `pipeline/run.py`: generate (old Task 2) → clean (old Task 3) → features (old Task 4 `build_features`, `weekly_series`, `lead_time_curves`, using `student_id`). Then **for each student**, build `metrics` (the keys in `test_engine.BASE`, with `attendance_drop_pp` = mean attendance in weeks 1–4 minus weeks 5–8) and call `engine.evaluate(metrics, card=model_card)`. On the first run, before A4, pass `card=None`. Assemble `Profile` (§4.1). Write to `pipeline/out/*.json`.
- `pipeline/seed.py` (service role, batches of 500, `upsert`):
  - Writes: `faculty, students, academics` (per-semester SGPA/CGPA/backlogs and `subject_marks` JSONB), `attendance` (per subject per semester %), `lms_activity, engagement, placement, skills, feedback, scores, score_history, analytics(cohort|model|insights), data_quality, source_stats`.
  - **Demo users:** `supabase.auth.admin.create_user({"email", "password": DEMO_PASSWORD, "email_confirm": True, "app_metadata": {"role": ..., "student_id"/"faculty_id": ...}})`, then insert a `users` row.
  - `student.red` = the highest-priority Red student whose mentor is `F01`. `student.star` = an "Academic stars, placement unready" student under `F01`. `faculty1` = `F01`.
  - Also create a login for every faculty member (`f02@demo.edu`… optional).
- **Verify:** log in through each demo button on localhost. `/admin` shows 1,500 students.

### A4: Model, drivers, history, insights, fairness, seeded interventions (hours 6–9, P1)
- Model: old Task 7, unchanged (train on the previous semester's weeks 1–8 → failed ≥1 subject). Store `model_card` in `analytics.model`. Then re-run `evaluate` with `card=model_card`.
- Contributions vs cohort: old Task 5 `contributions()`, applied to the matrix of `pillars`.
- History: for each completed semester s, set `score_s = success_score({**pillars_now, "academic": clip(SGPA_s*10 - 5*backlogs_up_to_s)})`. Set `declining` when `history[-1].score - history[-3].score <= -10`.
- Percentiles: within batch, for coding, aptitude, attendance, CGPA and LMS (display only).
- Insights: old Task 9 `build_insights`, plus "attendance < 65% → backlog rate ×N". Fairness: old Task 9 `fairness_table`.
- Seeded interventions: about 300 rows in the previous semester across 5 types, with `score_after = score_before + effect + noise`. Effects: mentoring +6, remedial +5, coding bootcamp +7, attendance counselling +4, mock interviews +5. `is_seeded = true`.

### A5: `backend/routers/whatif.py` (hours 8–9, P1)
```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from common.auth import require_role, Caller
from common.db import db
from scoring.engine import WEIGHTS, evaluate

router = APIRouter()
ALLOWED = {"attendance_pct", "coding", "aptitude", "mock", "internal_pct", "submit_rate", "certifications", "hackathons"}

class WhatIf(BaseModel):
    student_id: str
    overrides: dict[str, float] = {}

@router.post("/whatif")
def whatif(body: WhatIf, caller: Caller = Depends(require_role("admin", "faculty", "student"))):
    if caller.role == "student" and caller.student_id != body.student_id:
        raise HTTPException(403, "Students can only simulate their own score")
    row = db().table("scores").select("profile").eq("student_id", body.student_id).single().execute().data
    card = db().table("analytics").select("payload").eq("key", "model").single().execute().data["payload"]
    m = {**row["profile"]["metrics"], **{k: v for k, v in body.overrides.items() if k in ALLOWED}}
    r = evaluate(m, card=card)
    return {**r, "delta": round(r["score"] - row["profile"]["score"], 1)}

class Rescore(BaseModel):
    weights: dict[str, float]

@router.post("/rescore")
def rescore(body: Rescore, caller: Caller = Depends(require_role("admin", "faculty"))):
    w = {k: max(0.0, body.weights.get(k, 0.0)) for k in WEIGHTS}
    rows = db().table("scores").select("student_id,profile->metrics").execute().data
    return [{"student_id": r["student_id"], **{k: v for k, v in evaluate(r["metrics"], w).items() if k in ("score", "band")}}
            for r in rows]
```
`backend` runs with `PYTHONPATH=<repo>/pipeline:<repo>/backend`, so `scoring.engine` imports directly.

### A6: `docs/SCORE_METHODOLOGY.md` (hours 9–11, P0 deliverable)
1–2 pages, copied from PRD §6 with the **real** metrics from `analytics.model`. Include a worked example: the `student.star` account.

---

## 6. Lane B: Mahesh (Admin, Faculty, `main`)
Use shared components from `components/shared/`. Every page has loading, empty and error states. Commit prefixes are `admin:` and `faculty:`.

| Task | Files | Builds | Done when |
|---|---|---|---|
| **B1** (h1–2, P0) | `app/login/page.tsx`, `middleware.ts` | Three tabs (email + password) and **four one-click demo buttons**; role routing via §4.4 | Each button lands on the right home page. A student hitting `/admin` is redirected to `/student`. A logged-out user hitting `/faculty` is sent to `/login`. |
| **B2** (h2–4, P0) | `app/admin/users/`, `backend/routers/admin.py` | List users. Create a user (role, name, linked student/faculty id) via `POST /admin/users` (service-role `auth.admin.create_user` with `app_metadata`), and return a temporary password. Assign or change a mentor (update `students.mentor_faculty_id` through the API). | The newly created user can log in. |
| **B2b** (h3–4, P0) | `components/shared/*` | `StudentProfile` (props: `profile: Profile`, `mode: "faculty" \| "student"`), `RiskBadge`, `BandBadge`, `Kpi`, `Waterfall`, `PillarRadar`, `WeeklyTimeline` | Renders the mock seed's `student.red` without errors. |
| **B3** (h4–6, P0) | `app/admin/page.tsx`, `components/admin/*` | KPIs (avg score, % academic Red, % placement Red, placement-ready %, early-warning count); filters (department / year / batch); band distribution; Red/Amber/Green by department and by year (stacked bars); academic × placement quadrant (click → Student 360); department × pillar heatmap | Filters change every widget. It still renders with the API stopped. |
| **B4** (h6–7.5, P0) | `app/faculty/page.tsx` | **Action Queue**: mentees by priority; filters (risk type, segment, year, search); reason chips (top 2 drivers); suggested action; CSV export; "contacted" toggle (localStorage, try/catch). Admin sees everyone, with a mentor filter. | Searching `zzzz` shows the empty state. Export downloads a CSV. |
| **B5** (h7.5–9, P0+P1) | `app/faculty/student/[id]/page.tsx` | `StudentProfile mode="faculty"`; **Log intervention** dialog (type, note, follow-up date) → insert with `score_before`; intervention history with status updates | A 2nd-year shows "Not yet assessed" for placement. A logged intervention appears immediately. |
| **B6** (h9–10.5, P1) | `app/admin/interventions/`, `app/admin/page.tsx` (insight cards), `app/admin/notifications/` | Insight cards from `analytics.insights`; **effectiveness**: average (score_after − score_before) by type, with counts; post notification (audience selector) | The chart shows 5 bars from the seeded data. |
| **B7** (h10.5–11, P2) | `backend/routers/briefs.py`, `chat.py` | Brief: Gemini, given that student's profile JSON only, writes ≤ 120 words, cached in memory. Chat: Gemini → one `SELECT` on `student_unified_view`, validated (regex: must start with `select`, no `;`, `limit ≤ 200`), run with a read-only DB role. | On any error, show the template text or "Couldn't answer that". |
| **Deploy** (h6, h9, h13, h15) | §7 | Vercel + VPS | §9 checklist passes on the live URL. |

---

## 7. Deployment

### 7.1 Frontend → Vercel
1. Import the GitHub repo and set **Root Directory** to `frontend`. Add the `NEXT_PUBLIC_*` env vars.
2. In Supabase → Auth → URL config, add the Vercel URL as the Site URL and a redirect URL.
3. Every merge to `main` auto-deploys. Check the preview before telling the team.

(Alternative if you want everything on Hostinger: run `npm run build && pm2 start "npm start" --name web` on the VPS behind nginx. Vercel is simpler, so use it unless there's a reason not to.)

### 7.2 API → Hostinger VPS (Ubuntu). This must be a **VPS plan**; shared hosting can't run Python services.
```bash
# hPanel → DNS: A record  api.<domain> → <VPS IP>
ssh root@<VPS IP>
apt update && apt install -y python3-venv python3-pip nginx certbot python3-certbot-nginx git
adduser --disabled-password --gecos "" app && su - app
git clone https://github.com/<org>/campus-compass.git repo && cd repo
python3 -m venv .venv && .venv/bin/pip install -r backend/requirements.txt -r pipeline/requirements.txt
nano .env      # paste server-side env vars (never commit)
exit
```
`/etc/systemd/system/campus-api.service`:
```ini
[Unit]
Description=CampusCompass API
After=network.target
[Service]
User=app
WorkingDirectory=/home/app/repo/backend
EnvironmentFile=/home/app/repo/.env
Environment=PYTHONPATH=/home/app/repo/pipeline:/home/app/repo/backend
ExecStart=/home/app/repo/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
[Install]
WantedBy=multi-user.target
```
`/etc/nginx/sites-available/campus-api`:
```nginx
server {
  server_name api.<domain>;
  client_max_body_size 10m;
  location / { proxy_pass http://127.0.0.1:8000; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $remote_addr; proxy_read_timeout 120s; }
}
```
```bash
ln -s /etc/nginx/sites-available/campus-api /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx
systemctl daemon-reload && systemctl enable --now campus-api
certbot --nginx -d api.<domain> --non-interactive --agree-tos -m <email>
curl https://api.<domain>/health        # → {"ok":true}
```
**Redeploy:** `ssh app@<ip> 'cd repo && git pull && .venv/bin/pip install -r backend/requirements.txt -q' && ssh root@<ip> systemctl restart campus-api`.
**Logs:** `journalctl -u campus-api -f`.

---

## 8. Lane C: Utki (Student side, Insights pages, presentation)
Commit prefix `student:`.

| Task | Files | Builds | Done when |
|---|---|---|---|
| **C1** (h1–4, P0) | `app/student/page.tsx`, `components/student/*` | Student home: score + band + confidence, both flags with drivers, segment, profile cards (attendance, CGPA, marks, engagement, skills, certificates). Use the shared `StudentProfile mode="student"` after Merge 1, and your own cards before that. Navigation: Home, Improve, Certifications, Hackathons, Mock interview, Notifications. | `student.red` and `student.star` both render. A student can only see their own data (the id comes from `app_metadata.student_id`). |
| **C2** (h2–4, P0) | `app/insights/data-health/page.tsx` | KPIs (source files, raw rows, issues fixed, unified students); sources table (file, **ID format**, rows in/out, coverage %); cleaning log (issue, rows, action); pillar coverage bars; a "how we join" diagram (7 sources → ID resolution → unified view) | Shows real numbers from Merge 2 onward. |
| **C3** (h4–5.5, P1) | `app/student/improve/`, `app/student/certifications/`, `components/student/playbook.ts` | **Upgrade path**: the 2 weakest pillars → 3 concrete steps each, plus a target score. **Certifications**: a curated static list (≥ 12, with Coursera/Udemy/NPTEL links, department and skill tags) filtered by the student's weak skills. | `student.star` sees coding and interview steps first. |
| **C3b** (h5.5–6, P1) | `app/student/hackathons/` | The existing module wired in | Renders without console errors. |
| **C5** (h5–6, P1) | `app/insights/segments/page.tsx` | 5 segment cards (count, rule, action) + "Steady middle"; pillar profile vs cohort; member list → Student 360 | Counts add up to the cohort size. |
| **C4** (h6–9, P1) **3-hour timebox** | `app/student/interview/`, `backend/routers/interview.py`, `tts.py` | **Text first (h6–7.5):** paste resume text → `POST /interview/start` → Gemini returns 5 questions (2 technical for their department, 2 project, 1 HR) as strict JSON → the student answers each → `POST /interview/finish` → Gemini scores 1–5 against a rubric (clarity, correctness, depth, communication) and returns strengths/gaps JSON → insert into `mock_interviews` → update `placement.mock_interview_avg` (mean of all), `mock_count+1` → re-run `engine.evaluate` and update `scores` → show "Placement readiness +X". **Voice (h7.5–9):** `POST /tts` (ElevenLabs) reads each question aloud; answers come from the browser `webkitSpeechRecognition` with a typing fallback. | Text mode passes end to end. The student's score visibly changes after finishing. Gemini errors give a "try again" message, never a crash. |
| **C6** (h9–10, P1) | `app/student/page.tsx` (what-if panel), `app/student/notifications/` | What-if sliders (attendance, coding, aptitude, mock, internal %, submission) → `POST /whatif` (debounce 300 ms) → new score, band, flags and **delta**. Notifications feed filtered by audience (`all`, `dept:<d>`, `year:<y>`, `student:<id>`). | With the API stopped, the panel shows "Simulator offline". |
| **C7** (h10–11, P1) | `app/insights/method/page.tsx` | Score formula table; **admin weight sliders** → `POST /rescore` → band-movement count and distribution; model back-test vs baseline KPIs; lead-time chart; model coefficients; fairness table; limitations and responsible-use text (PRD §9) | Reset restores the defaults. |
| **C8** (h10.5–11, P1) | `app/demo/page.tsx` | 6-step guided demo with deep links (PRD §10), reachable after any login | Every link works on the live URL. |
| **Deliverables** (h13–15) | `docs/slides.pdf`, video link | 6–8 slides (problem; research: Georgia State 48 h, Purdue honesty, LMS lead time; solution; screenshots; evidence: back-test, lead-time, fairness; impact and roadmap). A 3–5 min video following `/demo`. | Both linked in the README. |

Gemini prompts must request **JSON only** (`response_mime_type="application/json"`), and the output is validated with Pydantic. Pass in only the student's own profile and resume text.

---

## 9. QA and submission checklist (run on the LIVE URL, incognito)
- [ ] Each of the 4 demo buttons logs in and lands on the right home page. Role guards redirect correctly.
- [ ] **Unified view:** Student 360 shows all 7 sources. Data Health shows all sources, issues and coverage.
- [ ] **Success Score** is visible in the admin overview, faculty queue, Student 360 and student home.
- [ ] **Academic and placement risk** flags are visible, filterable, and each has drivers.
- [ ] **Interactive dashboard:** filters, drill-down, sorting and CSV export all work.
- [ ] Segments page and explainable waterfall work (bonus items).
- [ ] With the API stopped (`systemctl stop campus-api`), dashboards still work, and what-if and interview show offline states. **Restart it afterwards.**
- [ ] No console errors. First paint < 3 s. Works at 1366×768 and on a phone.
- [ ] README: live URL, **test credentials for evaluators** (the demo accounts), stack, architecture, how to run, how it maps to the brief, screenshots, slides and video links.
- [ ] `docs/SCORE_METHODOLOGY.md` is present. The repo is accessible to evaluators.
- [ ] **Submit** at h6, h9, h13 and h15 on the byteXL platform. Verify the latest submission shows the right links.

---

## 10. Git workflow (from the team doc, unchanged)
- Branches: `feat/data`, `feat/admin-faculty`, `feat/student`. `main` is protected, and only Mahesh squash-merges, every checkpoint, in the order A → B → C.
- Before each commit: `git status`, then `git add <your folders only>` (never `git add .`).
- After "merged, rebase now": `git fetch origin && git rebase origin/main && git push --force-with-lease origin <your-branch>`.
- Lockfile conflict: `git checkout --theirs package-lock.json && npm install && git add package-lock.json && git rebase --continue`.
- If you're blocked for more than 20 minutes, post in the group chat. If a feature runs 1 hour over, cut it (PRD §11 cut list).
