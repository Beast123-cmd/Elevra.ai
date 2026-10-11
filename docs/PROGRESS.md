# Elevra.ai: Progress Log

Living record of what has been built, decided and verified. **Append to it; do not rewrite history.** Times are IST on 11 Oct 2026. Newest entries at the bottom of each section.
Never put secrets in this file. Keys live in `.env` and `frontend/.env.local` (git-ignored).

## 1. Status at a glance
| Area | Owner | State |
|---|---|---|
| Schema (`db/migrations/001_init.sql`) | Aayush | Run in Supabase, 18 tables + `student_unified_view` |
| Seed data: 1,500 students, 50 faculty, scores, analytics, data quality | Aayush | Loaded and verified live (re-seeded to 1,500 after the first 200-student load) |
| Demo login accounts (4) | Aayush | Created 13:06 and verified (re-pointed to new students on each re-seed) |
| Hour-0 skeleton (Next.js + FastAPI) | Mahesh | Merged |
| Admin: users, overview | Mahesh | Merged (PR #1) |
| Faculty: action queue, Student 360, interventions | Mahesh | Merged (PR #1) |
| Student home, Data Health, Segments, Improve path, Certifications | Utkarsh | Merged (PR #2, #4) |
| Admin: interventions effectiveness, notifications | Mahesh | Done; verified against the live RLS policies (B6) |
| Admin chat (Ask your data) and faculty mentor briefs | Mahesh | Done, with non-AI fallbacks and offline states (B7) |
| Row-level security | Aayush | Merged (PR #8) and verified: 59/59 checks, anonymous access closed |
| Mock interview (Gemini + ElevenLabs), what-if UI | Utkarsh | Merged; pages load and the what-if API answers (checked 17:00) |
| What-if / re-score API, model, insights | Aayush | Merged and working |
| Admin/faculty closed loop, attendance planner, message drafts, evidence, weekly brief | Mahesh | Merged (#18) / PR #21 open |
| README, score note | Mahesh / Aayush | README written 17:10; score note present |
| Deploy (Vercel + Hostinger VPS) | Utkarsh leads | **Not started. This is now the critical path** |
| Slides, demo video, byteXL submission | All | Not started |

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

### Verification after RLS went live (13:50 to 14:20)
| What | Result |
|---|---|
| `python docs/proposals/run_rls_test.py current` (Aayush's live policies) and `migration` (his file applied in a rolled-back transaction) | 59/59 both ways; database unchanged |
| App queries with each user's own token: admin overview, faculty queue (with and without the mentor filter), Student 360, analytics, interventions | 11/11 |
| Notifications: admin posts to all / department / year / one student; each student sees exactly what is addressed to them; faculty and student cannot post; `created_by` cannot be forged | 14/14, test rows deleted |
| Interventions: faculty logs for mentees only, as themselves; student cannot log or update; admin logs for anyone | 8/8, test rows deleted |
| API: auth, user creation, rollback, mentor change | 18/18 |
| Role guards, all roles, including `/admin/chat` | 43/43 |
| Briefs and chat with live Gemini under RLS: 401/403/404/422, 4 real questions answered, 7 hostile questions (drop, delete, update, emails, `pg_sleep`) all refused, database intact | all pass |
| Gemini offline (invalid key): briefs fall back to the standard summary, chat uses vetted canned queries, unmatched questions get suggestions | all pass |
| Fact check on 20 real students with live Gemini | 20/20 AI briefs passed, median 2.4 s, 0 gendered pronouns |
| Backend unit tests (`python -m unittest discover -s tests -t .` in `backend/`) | 53 pass |
| Frontend unit tests (`npm test`) | 52 pass |
| Chat, brief card and loading/offline states in headless Chrome with real sessions | no console or network errors |

### Session and cache review (16:30), real browser and real Supabase
Reported: sessions and caching felt unmanaged, going to another page seemed to re-render home, and URLs like `/student/interview?_rsc=19m99` appeared.
- **`?_rsc=...`** is Next.js's internal cache-busting parameter on background (RSC) page fetches; it shows in the Network tab and terminal. It reaches the address bar only when such a fetch fails and the browser falls back to a full page load. `SessionGuard` now strips it. Verified.
- **"Renders home again"** could not be reproduced in the production build or in `next dev`: clicks go straight to their page. In dev, the first visit to each route compiles on demand (the very first `/login` took 16 s), which feels like being stuck. Each page also re-ran its own auth round trip and data fetch on every visit, which looked like a re-render.
- **Real bugs found and fixed:** (1) the middleware dropped refreshed session cookies on redirects, so users were signed out on the next request (fixed independently on `main` by Aayush with `redirectWithAuthCookies`; my test confirms it); (2) a vanished or expired session left the user clicking cached pages with no redirect, and signing out in one tab did nothing in another; (3) no `Cache-Control: no-store` on protected pages, so the back button could restore them; (4) no data cache, so returning to the admin overview re-downloaded 1,500 rows (2.2 s).
- **Added:** `SessionGuard` (sends the user to `/login` on sign-out in any tab, an expired or rejected session, or an API 401; strips `_rsc`), a `no-store` header on protected pages and the redirects away from them, a stale-while-revalidate cache for the admin overview, faculty queue and Student 360 (emptied on sign-out or user change; returning to the overview now takes about 90 ms), login and sign-out using a full page load, and a shared `SignOutButton`.
- Verified on the integrated build: 60 frontend unit tests, server-side checks (refreshed cookies on normal pages and redirects, `no-store`, garbage cookie gives a clean redirect), 43/43 role guards, 12/12 real-browser flows (login, cached navigation, sign-out then Back, `_rsc` cleanup, cross-tab sign-out), and all 17 pages with no console or network errors.

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

- Gemini 2.5 returned empty text for short JSON replies because its hidden "thinking" used the whole output budget; thinking is now off (`common/llm.py`).
- Fact check wrongly rejected briefs that quoted a threshold from a driver label ("below 50"); label and action numbers now count as profile facts, and one retry absorbs wording variation.
- Gemini once guessed a gender from a name ("his"); the prompt now forbids gendered pronouns and the fact check enforces it.
- Chat latency: a fresh database connection costs about 4 s and the old per-statement flow cost about 7 round trips. Now one reused connection and one batched statement (about 4.8 s end to end instead of 10 s); the chat page warms the connection on load.
- The API needs `PYTHONPATH` to include `pipeline/` (Aayush's `whatif.py` imports `scoring.engine`); the VPS service file already sets it.

## 7. Open items
1. ~~Row-level security~~ **Resolved.** Aayush's `db/migrations/002_rls.sql` is live; `docs/proposals/002_rls.test.sql` plus `run_rls_test.py` are kept as the regression test (my duplicate proposal migration was removed).
2. **Seed realism:** all 300 seeded interventions show "improved 100%" with round averages; 27% of students are Red for academic risk and 33% for placement, which is too many to triage. Add noise and recalibrate thresholds. Owner: Aayush.
3. `min_subject_attendance` is not populated in `profile.metrics`. Owner: Aayush.
4. Branch protection on `main` (repo admin).
5. Mock interview, what-if panel, `/demo` page. Owner: Utkarsh.
6. **Dependency change needs Aayush's OK** (`backend/requirements.txt` is frozen): `supabase==2.32.0` and `pydantic==2.14.0` (already on `main` via PR #6, required because 2.9.0 rejects `sb_secret_` keys), plus `google-genai==2.29.0` and `psycopg[binary]==3.3.6` for B7. Everyone must run `pip install -r backend/requirements.txt`.
7. Deploy: Vercel + VPS; set env vars there. Utkarsh leads.

## 8. Change log
- 14:20 B7 (briefs, data chat) finished and verified under live RLS; proposals folder reduced to the RLS regression test.
- 13:20 B6 (effectiveness, notifications), supabase fix and full real-data verification on `feat/admin-faculty`.
- 12:05 Hour-0 skeleton on main. 12:21 admin shell, users, overview, queue, Student 360 (PR #1, merged 12:40). 12:38 teammates' PRs #2 and #3 merged. 12:45 keys moved out of `.env.example` into ignored files, live connections verified.

## 9. Admin and faculty features added after the research pass (afternoon, 11 Oct)
Decision record and sources: `docs/FEATURE_RESEARCH.md`. All are tested (`npm test` 109, backend 67) and were run against the live Supabase project in a real browser.
| Feature | Where | Notes |
|---|---|---|
| My week closed loop | `/faculty` | Red mentees contacted in 7 days, "start with these 5", follow-ups with Done, Last contact column. Only live, non-planned interventions count as contact. |
| Response & workload | `/admin/workload` | Coverage KPIs, per-mentor caseload, rebalancing suggestions (same department, untouched students only), bulk check-in tasks behind a confirmation. |
| Attendance recovery planner | `/faculty/attendance` | Editable policy (75% / 10-point condonation / 16 weeks / 15 classes). Class counts are estimated from the average percentage; there are no per-class records. |
| Message drafts | Student 360 | `POST /briefs/{id}/message`; AI text must pass the fact check and message rules, else a standard draft; browser fallback offline. |
| Accreditation evidence | `/admin/evidence` | Slow/advanced cut-offs editable (50/75), CSV formula-safe, seeded rows excluded. |
| Weekly brief | `/admin` card, `GET /admin/weekly-brief` | Figures computed on the server, wording by Gemini only if every number matches; admin only. |
| Auth-outage fix | `middleware.ts` | A network error while verifying the session no longer signs the user out (`authErrors.ts`). Frozen file: reviewed by Aayush through #18. |

## 10. Audit against the brief and the rule book (17:00, real browser, live data)
- All 16 pages (admin, faculty, student, insights, demo, landing, login) load with their key content and no console or network errors.
- Capabilities confirmed live: unified view with 17 documented cleaning issues across all sources, Success Score and both risk flags, segments, explainable drivers, what-if (`overrides` body), Ask your data, briefs, role guards (403 for the wrong role).
- **Gaps that can cost points (in order):** (1) nothing is deployed, and the automated gate runs on the deployed link; (2) the GitHub repository is private, so evaluators cannot open it unless access is granted; (3) no slides and no demo video; (4) nothing submitted yet on byteXL.
- **Data realism (owner: Aayush):** segments are lopsided (Steady middle 900, Silent disengagers 462, Engaged but struggling 5, Skilled but irregular 7), about 24% Red for academic and 36% Red for placement risk, and every seeded intervention shows an improvement. A reviewer will notice; recalibrate if time allows.
- **Security (owner: Aayush):** `/whatif` accepts any student id and `/rescore` returns all students' scores to a faculty login, because the service-role client bypasses RLS. Restrict both to the caller's own scope.

