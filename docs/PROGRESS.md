# Elevra.ai: Progress Log

Living record of what has been built, decided and verified. **Append to it; do not rewrite history.** Times are IST on 11 Oct 2026. Newest entries at the bottom of each section.
Never put secrets in this file. Keys live in `.env` and `frontend/.env.local` (git-ignored).

## 1. Status at a glance
| Area | Owner | State |
|---|---|---|
| Schema (`db/migrations/001_init.sql`) | Aayush | Run in Supabase, 18 tables + `student_unified_view` |
| Seed data: 200 students, 50 faculty, scores, analytics, data quality | Aayush | Loaded and verified live |
| Demo login accounts (4) | Aayush | Created 13:06 and verified (re-pointed to new students on each re-seed) |
| Hour-0 skeleton (Next.js + FastAPI) | Mahesh | Merged |
| Admin: users, overview | Mahesh | Merged (PR #1) |
| Faculty: action queue, Student 360, interventions | Mahesh | Merged (PR #1) |
| Student home, Data Health, Segments, Improve path, Certifications | Utkarsh | Merged (PR #2, #4) |
| Admin: interventions effectiveness, notifications | Mahesh | Built and verified on real data (B6) |
| Mock interview (Gemini + ElevenLabs), what-if UI | Utkarsh | Not started |
| What-if / re-score API, model, insights | Aayush | Not started / in progress |
| Deploy (Vercel + Hostinger VPS) | Utkarsh leads | Last, after features |

## 2. What exists, by lane

### Lane B: Mahesh (`feat/admin-faculty`, merged via PR #1)
- `frontend/` scaffold: Next.js 14, Tailwind, shadcn/ui, Supabase SSR clients, typed contracts in `lib/types.ts`.
- `frontend/middleware.ts`: role guard. Students are redirected away from `/admin` and `/faculty`; logged-out users go to `/login`.
- `/login`: Student / Faculty / Admin tabs plus four one-click evaluator buttons.
- `backend/`: FastAPI with `/health`, service-role Supabase client, bearer-token role dependency, all routers registered as stubs.
- `backend/routers/admin.py`: `POST /admin/users` (creates the login, returns a one-time temp password, rolls back on failure) and `POST /admin/students/{id}/mentor`.
- `components/shared/`: `StudentProfile` (faculty and student modes), risk and band badges, KPI card, waterfall, radar, weekly timeline, score history.
- `/admin` overview: KPIs, filters (department / year / batch), score bands, academic-vs-placement scatter, risk by department and year, department × pillar heatmap.
- `/admin/users`: create account, assign mentor, filterable account list.
- `/faculty` Action Queue: ranked mentees, filters, reasons, suggested action, CSV export (formula-injection safe), "contacted" ticks.
- `/faculty/student/[id]` Student 360 with the intervention log (validated type, note and follow-up date; status tracking). Faculty can open only their own mentees.

### Lane A: Aayush (`feat/data`)
- Reproducible seed pipeline: generator, cleaning, scoring engine, `seed.py`, pipeline tests.
- Live data verified: 200 students, 50 faculty, 200 scores, 3 analytics payloads, 17 data-quality rows, 8 source stats.

### Lane C: Utkarsh (`feat/student`)
- Student dashboard, Data Health page, Segments page, Improve path, Certifications, student navigation.

## 3. Verification log
| When | What | Result |
|---|---|---|
| 12:21 | Frontend unit tests (`npm test`, Node's built-in runner) | 29 pass |
| 12:21 | `tsc --noEmit` and `next build` | Clean |
| 12:21 | Screenshots of overview and queue with synthetic data, including empty states | Render correctly |
| 12:38 | Rebase onto main (Aayush + Utkarsh code), then tests and build again | 29 pass, build clean, no conflicts |
| 12:45 | Live Supabase: my exact queries against seeded data | Shapes match `lib/types.ts`; 68/68 year-2 students have no placement data and are handled |
| 12:45 | Gemini key | Works |
| 12:45 | ElevenLabs key | Restricted key: text-to-speech works (tested); it cannot list voices |
| 13:06 | Demo accounts: all four log in with the right role and linked record | Pass |
| 13:10 | **API end to end against real Supabase** (18 checks): 401 without or with a bad token, 403 for student/faculty, validation 422/404, user creation, login with the temp password, no orphan row after a failed create, mentor change and restore, cleanup | 18/18 pass |
| 13:15 | **Role guards in the running app with real sessions** (39 checks, 4 roles x all page groups) | 39/39 pass |
| 13:20 | **Every page in headless Chrome with real sessions**: admin overview, users, interventions, notifications, faculty queue, Student 360, student home | No console or network errors; layouts verified from screenshots |
| 13:20 | Queries as faculty1 | 30 mentees (F01), all with the right mentor |
| 13:20 | Admin overview over 1,500 students (paging past the 1000-row cap) | Pass |

## 4. Decisions
- **Absolute pillar scores, not batch percentiles.** Percentiles make every batch average 50, so "% at risk" would mean nothing. Percentiles are display text only.
- **Placement risk is rule-based, with no placement ML model.** There are no real placement outcomes, so any label would be circular. The academic model trains on last semester and predicts end-of-semester results.
- **Bands come from the pipeline.** The UI counts the stored `band` and never recomputes thresholds.
- **One scoring engine** (`pipeline/scoring/engine.py`) is shared by the batch job and the API.
- **No new test dependency.** Frontend logic is plain functions tested with `node --test` (type stripping, Node 22); `tsconfig.json` allows `.ts` import extensions for this.
- **Supabase caps requests at 1000 rows**, so large reads go through `fetchAllRows` (paged).
- **Chart animation is off.** It is faster for large scatter plots and makes screenshots deterministic.
- **Hosting last.** Vercel (frontend) + Hostinger VPS (FastAPI); Utkarsh leads it. Dashboards read Supabase directly, so they keep working if the API is down.
- **Commits:** conventional commits, authored by Mahesh, no AI attribution lines.

## 5. Environment (no secret values here)
- Root `.env`: backend and pipeline. `frontend/.env.local`: browser-safe `NEXT_PUBLIC_*` only. Both git-ignored. `.env.example` stays blank.
- `NEXT_PUBLIC_DEMO_PASSWORD` and `DEMO_PASSWORD` must be identical. The password is visible in the browser bundle by design (evaluator quick access), so it is a throwaway used only for the four synthetic demo accounts.
- `ELEVENLABS_VOICE_ID` is required because the key cannot list voices. Default: `21m00Tcm4TlvDq8ikWAM` (a public built-in voice). To use another voice, add it to "My voices" in the ElevenLabs dashboard and copy its id.
- Demo accounts: `admin@demo.edu`, `faculty1@demo.edu`, `student.red@demo.edu`, `student.star@demo.edu`.

## 6. Git workflow in practice
- Repo: `Beast123-cmd/Elevra.ai`. Branches `feat/data`, `feat/admin-faculty`, `feat/student`; Aayush owns `main`.
- Sync before working and after every merge: `git fetch --all && git rebase origin/main`, then `git push --force-with-lease origin <your-branch>` (own branch only).
- PR #1, #2, #3, #4 merged so far. No file-level conflicts to date, because each lane stays in its own folders.

## 6b. Bugs found by testing, and fixes
- **supabase-py 2.9.0 rejected the new `sb_secret_` keys** ("Invalid API key"), so every authenticated API call returned 401. Fixed by pinning `supabase==2.32.0` (and `pydantic==2.14.0`).
- `tsc` caught an invalid `Set` spread that would have broken the production build; replaced with `Array.from`.
- Band badge wrapped onto two lines in narrow columns; "lowest subject" printed a dash when the field is empty. Both fixed.
- Demo accounts are re-pointed to different students on every re-seed, so docs and demos must not hardcode student names.

## 7. Open items
1. **Row-level security (privacy), CRITICAL.** Found by `docs/proposals/run_rls_test.py` (34 of 59 checks fail on today's database):
   - **Anyone with the public anon key and no login can read all 1,500 students through `student_unified_view`** (views bypass RLS unless `security_invoker` is set). One-line fix: `alter view public.student_unified_view set (security_invoker = true);`
   - Any logged-in student can read all scores, feedback, interventions and users, **and can log interventions and post notifications to everyone**.
   - Proposed fix: `docs/proposals/002_rls.sql` (students: own rows; faculty: their mentees; admin: all; interventions: mentors only). With it, 59/59 checks pass. Tested inside a rolled-back transaction, so the shared database is unchanged. Owner: Aayush to review and apply.
2. **Seed realism:** all 300 seeded interventions show "improved 100%" with round averages; 27% of students are Red for academic risk and 33% for placement, which is too many to triage. Add noise and recalibrate thresholds. Owner: Aayush.
3. `min_subject_attendance` is not populated in `profile.metrics`. Owner: Aayush.
4. Branch protection on `main` (repo admin).
5. Mock interview, what-if panel, `/demo` page. Owner: Utkarsh.
6. B7 (P2): AI student briefs and "Ask your data" chat. Owner: Mahesh.
7. Deploy: Vercel + VPS; set env vars there. Utkarsh leads.

## 8. Change log
- 13:20 B6 (effectiveness, notifications), supabase fix and full real-data verification on `feat/admin-faculty`.
- 12:05 Hour-0 skeleton on main. 12:21 admin shell, users, overview, queue, Student 360 (PR #1, merged 12:40). 12:38 teammates' PRs #2 and #3 merged. 12:45 keys moved out of `.env.example` into ignored files, live connections verified.
