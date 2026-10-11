# Elevra.ai: Product Requirements (PRD)

**Challenge:** KPMG in India, *Smart Campus Analytics: Predict, Optimize & Improve Student Success* (HacXLerate 2026, Round 1)
**Team:** Aayush (A: Data & ML, owns `main`), Mahesh (B: Admin & Faculty, deploys), Utki (C: Student & Insights)
**Status:** FINAL. Agreed on 11 Oct 2026. Changes go through Aayush (main owner).
**Companion docs:** [`BUILD_PLAN.md`](BUILD_PLAN.md) (how and when), [`KPMG_PS.md`](KPMG_PS.md) (official brief), [`STRATEGY.md`](STRATEGY.md) (research and competitor analysis)

---

## 1. Problem

Colleges collect student data in 7 disconnected systems: ERP marks, biometric attendance, the LMS, club and event records, the placement cell, skill tests and feedback surveys. Nobody sees a struggling student until end-semester results arrive, and by then it's too late to help. Faculty mentors have 20–30 mentees and no way of knowing who to call this week.

## 2. Product vision and pitch

> **Elevra.ai turns 7 disconnected campus systems into one student view, scores every student, flags who needs help 8 weeks before exams, explains why in plain language, tracks whether the intervention worked, and gives every student a personalised path to placement.**

What makes us different from the 7 competitor repos we analysed (see `STRATEGY.md` §3):
1. **Real integration.** 7 messy sources with different ID formats, plus a visible cleaning log. No rival does this properly, and it is worth 30% of the score.
2. **Honest, back-tested early warning.** The model is trained on last semester and shown to beat a CGPA-only baseline. Rivals used fake or circular ML.
3. **We close the loop.** Flag → driver → intervention → measured effect. Students also get a self-improvement path and a mock interview that feeds back into their score.
4. **Trust built in.** A fairness audit (hostel vs day scholar, gender), explainable drivers, and a limitations panel. This matches KPMG's *Trusted AI* positioning.

## 3. Users and personas

| Persona | Goal | Main screens |
|---|---|---|
| **Admin / Dean** | Know institution health; spend support budget where it matters; run accounts | Admin overview, User management, Interventions effectiveness, Data Health, Segments, Method & Trust |
| **Faculty mentor** | Know which mentees to contact this week, why, and what to do; record what was done | Mentee Action Queue, Student 360, Log intervention |
| **Student** | Understand their own score, what's dragging it down, and how to improve, all the way to placement | Student dashboard, What-if, Skill gap path, Certifications, Hackathons, Mock interview, Notifications |

## 4. Goals and success metrics (the judging rubric)

| Criterion | Weight | We win it with | Owner |
|---|---|---|---|
| Data Integration & Analysis | 30% | 7 messy CSVs → cleaning log → `student_unified_view`; Data Health page; cross-source insights | A + C |
| Success Score & Risk | 25% | Pillar score with renormalisation and confidence; two separate risk flags with drivers; back-tested academic model; 5 segments (bonus) | A |
| Dashboard & Visualization | 25% | Admin and faculty dashboards with filters and drill-down; waterfall drivers per student (bonus); weekly timeline; heatmap; quadrant | B |
| Problem Understanding | 10% | Intervention logging and effectiveness; Indian campus rules (75% attendance, backlogs block drives); student improvement path | B + C |
| Presentation & Demo | 10% | Always-on deploy, one-click demo logins, guided demo, score note, slides, video | All |

**Hard gate:** Round 1 auto-evaluation checks the mandatory features on the **deployed URL** before any human sees it. Every P0 below must work on the live link, logged in through a demo button, by hour 6.

## 5. Scope

**P0** must work end to end on the live link. **P1** is built after the lane's P0 works. **P2** only happens if time remains after hour 11.

### 5.1 Data & scoring engine (Lane A: Aayush)

| ID | Feature | Pri | Acceptance criteria |
|---|---|---|---|
| A1 | Synthetic data: about 1,500 students (years 2–4), 4 depts (Comp, IT, ENTC, AI&DS), **7 source CSVs + registry**, fixed seed | P0 | `python pipeline/run.py --regenerate` reproduces identical files. Each source uses a different ID format (`42178`, `SCA-42178`, `sca42178`, email). It contains duplicates, `NA`/`AB` values, `78%` strings, mixed scales and inconsistent department names. |
| A2 | Cleaning and integration into one row per student | P0 | Every raw ID resolves to the registry or is logged as unknown. Every fix is written to `data_quality` (source, issue, rows, action). `student_unified_view` returns 1 row per student. |
| A3 | Student Success Score 0–100 from 7 pillars | P0 | Formula in §6. Missing pillars are dropped and the rest re-weighted, never scored as 0. `confidence` = present weight %. |
| A4 | Academic risk flag (Green / Amber / Red) with drivers | P0 | Point rules plus model probability (§6.3). Every flag lists ≥1 named driver with its value. |
| A5 | Placement risk flag (Green / Amber / Red / Not assessed) with drivers | P0 | Transparent point rules (§6.3). Students with no placement data show "Not assessed". |
| A6 | Write all outputs to Supabase (`scores`, `analytics`, `data_quality`, `source_stats`) and seed demo accounts | P0 | `python pipeline/seed.py` loads everything in under 2 minutes. 4 demo accounts can log in. |
| A7 | Early-warning model, back-tested: last semester weeks 1–8 → failed ≥1 subject | P1 | Held-out AUC, recall and precision reported against a CGPA-only baseline in `analytics.model`. The label comes from exam marks, never from input features. |
| A8 | Top-3 drivers per student: pillar contributions vs cohort average, plus model factors (linear SHAP = coef × z) | P1 | Contributions sum to (score − cohort mean) ± 0.1. |
| A9 | 5 named segments with a recommended action each | P1 | Rule-based and ordered (§6.4). Counts are stored in `analytics.cohort`. |
| A10 | Score history across semesters plus a "declining" marker | P1 | `declining = true` when the score dropped ≥ 10 points across the last 2 semesters. |
| A11 | Weekly engagement-drop early-warning flag plus lead-time curves (failed vs passed students) | P1 | Students who failed show the drop ≥ 2× as often as students who passed. |
| A12 | Cross-source insights plus fairness audit | P1 | ≥ 5 insights in `analytics.insights`. Fairness rows by residence and gender in `analytics.model`. |
| A13 | What-if and re-score endpoints (FastAPI imports `pipeline/scoring`) | P1 | `POST /whatif` and `POST /rescore` (§8) use the same code path as the batch pipeline. |
| A14 | Seeded historical interventions with before/after scores (for the effectiveness chart) | P1 | About 300 rows flagged `is_seeded = true` across 5 intervention types, with planted effects. |
| A15 | Success Score methodology note (1–2 pages) | P0 (deliverable) | `docs/SCORE_METHODOLOGY.md`, with real metrics copied from `analytics.model`. |

### 5.2 Admin & Faculty (Lane B: Mahesh)

| ID | Feature | Pri | Acceptance criteria |
|---|---|---|---|
| B1 | Login page: Student / Faculty / Admin tabs **plus one-click demo buttons** | P0 | One click logs in as a demo user and routes to `/admin`, `/faculty` or `/student`. Each role is blocked from the other two routes. No sign-up. |
| B2 | User management: create student and faculty accounts, assign mentor | P0 | Admin creates a user through `POST /admin/users`. The service key never reaches the browser. The new user can log in. |
| B3 | Admin overview: KPIs (avg score, % academic Red, % placement Red, placement readiness, early-warning count) | P0 | Filters by department, year and batch update every widget. |
| B4 | Risk distribution by department, year and batch, plus score-band distribution, academic × placement quadrant scatter, and dept × pillar heatmap | P0 | Clicking a scatter dot opens Student 360. |
| B5 | Faculty Action Queue: mentees sorted by priority, with filters (risk type, segment, year, search), reason chips, suggested action and CSV export | P0 | Shows only the logged-in faculty member's mentees (admin sees everyone). Empty filters show an empty state. |
| B6 | Student 360 drill-down: unified 7-source record, score, band, confidence, both flags with drivers, waterfall, radar vs cohort, weekly timeline, segment, actions | P0 | Works for a 2nd-year with no placement data (shows "Not yet assessed"). |
| B7 | Log intervention (type, note, follow-up date, status) and see follow-up status | P1 | Saved to `interventions` with `score_before`. Status can be updated. |
| B8 | Key insight cards on the admin overview | P1 | Reads `analytics.insights`. |
| B9 | Intervention effectiveness: average score change by intervention type | P1 | Bar chart from `interventions` (seeded plus live). |
| B10 | Post placement notifications (all / dept / year / student) | P1 | Rows in `notifications`, visible in the student feed. |
| B11 | AI brief per at-risk student (Gemini) | P2 | `POST /briefs/{id}` gets a grounded paragraph using only that student's profile JSON. Falls back to a template on error. |
| B12 | "Ask your data" chatbot (Gemini → read-only SQL on `student_unified_view`) | P2 | SELECT-only, row cap 200, and the generated SQL is shown. Refuses anything else. |

### 5.3 Student side & Insights pages (Lane C: Utki)

| ID | Feature | Pri | Acceptance criteria |
|---|---|---|---|
| C1 | Student dashboard: own score, band, both flags, top drivers, segment, profile (attendance, CGPA, marks, engagement, skills, certificates) | P0 | Reuses B6's shared `StudentProfile` component in student mode. A student sees only their own data. |
| C2 | Data Health page: sources in/out, IDs fixed, duplicates removed, cleaning log, pillar coverage | P0 | Reads `source_stats`, `data_quality` and `analytics.cohort`. This is the 30% criterion, so it must look serious. |
| C3 | Segments page: 5 cards (count, rule, action), segment pillar profile vs average, member list | P1 | Clicking a member opens Student 360. |
| C4 | Method & Trust page: score formula, **admin weight sliders** (calls `/rescore`), model back-test vs baseline, lead-time chart, fairness table, limitations | P1 | Moving a slider updates the scores shown on that page. Reset restores the defaults. |
| C5 | What-if simulator (sliders → `POST /whatif` → new score and flags) | P1 | Shows the delta vs the current score. Debounced to 300 ms. |
| C6 | Skill gap and upgrade path from the weakest pillars | P1 | Bottom 2 pillars → 3 concrete steps each, from a static playbook. |
| C7 | Suggested certifications (static curated list with Coursera / Udemy / NPTEL links), mapped to weak skills | P1 | At least 12 curated items, filtered by department and weakness. |
| C8 | Hackathons across institutes (existing Next.js module) | P1 | Rendered inside `/student/hackathons`. |
| C9 | Mock interview from resume: Gemini questions and evaluation, ElevenLabs voice. **The score updates `placement.mock_interview_avg` and re-scores the student.** | P1 | Text mode works with voice off. **3-hour timebox for voice.** After finishing, the student's placement pillar visibly changes. |
| C10 | Placement notifications feed | P1 | Reads `notifications` filtered to the student's audience. |
| C11 | Guided demo page `/demo` (6 steps with deep links) | P1 | Every link works on the deployed site. |
| C12 | Student feedback form | P2 | Inserts into `feedback`. |

### Out of scope
- Self sign-up
- Faculty uploading mock tests
- Live scraping of hackathon sites
- A mobile app
- Real ERP connectors (roadmap slide only)
- First-year students (no completed semester; roadmap)

## 6. Scoring specification (single source of truth: `pipeline/scoring/`)

### 6.1 Pillars (each 0–100, absolute; NaN = no data)

| Pillar | Weight | Formula |
|---|---|---|
| Academic | **25%** | 0.6 × (CGPA × 10) + 0.4 × current internal % − 5 × active backlogs |
| Attendance | **15%** | Overall % this semester (weeks 1–8). The lowest subject % is shown as a driver. |
| LMS engagement | **10%** | 100 × (0.5 × submission rate + 0.3 × share of active weeks + 0.2 × min(avg minutes/100, 1)) |
| Placement readiness | **20%** | 0.35 aptitude + 0.40 coding + 0.25 × (mock interview avg / 5 × 100) |
| Skills | **15%** | 0.5 technical + 0.3 soft + 0.2 × min(100, 25 × verified certifications) |
| Co-curricular | **5%** | min(100, 10 × events + 15 × clubs + 20 × hackathons), verified only |
| Feedback | **10%** | Mean of (satisfaction − 1)/4 × 100 and (faculty rating − 1)/4 × 100 |

**Success Score** = Σ wₚ·pillarₚ / Σ wₚ over the pillars that have data. It is rounded to 1 decimal. **Confidence** = Σ wₚ (present) × 100.

**Bands:**
- Thriving: 75 and above
- On Track: 60 and above
- Needs Attention: 45 and above
- Critical: below 45

Percentiles ("bottom 20% in coding") are display text only, not part of the score.

### 6.2 Why absolute rather than percentile pillars
Percentile pillars make every batch average 50, so "% at risk" would mean nothing and thresholds could not be explained. Absolute pillars keep the Indian rules meaningful (75% attendance, CGPA 6).

### 6.3 Risk flags (tiers: Red / Amber / Green, shown with the driver list)

**Academic risk: points.**
- Red if points ≥ 6, or if a hard floor is hit. Amber if points ≥ 3.

| Driver | Points |
|---|---|
| Attendance < 65% (detention line) | 4 + **hard floor Red** |
| Attendance 65–75% (below mandate) | 2 |
| ≥ 3 backlogs | 4 + **hard floor Red** |
| 1–2 backlogs | 2 |
| CGPA < 6.0 | 2 |
| Internal marks < 50% | 2 |
| Assignment submission < 60% | 1 |
| LMS activity dropped sharply (weeks 6–8 < 60% of weeks 1–4) | 2 |
| Model probability ≥ 0.60 / 0.35–0.60 | 3 / 1 |

**Placement risk: points** (only for students with placement data, otherwise "Not assessed").
- Red if points ≥ 6. Amber if points ≥ 3.

| Driver | Points |
|---|---|
| Placement readiness < 50 | 3 |
| Coding < 40 | 2 |
| Aptitude < 40 | 2 |
| Mock interview ≤ 2/5 or none taken | 1 |
| No verified hackathons or certifications | 1 |
| Technical skill < 50 | 1 |
| Active backlog (blocks most campus drives) | 2 |

**Early-warning model (academic):**
- Logistic regression with 7 features: prior CGPA, prior backlogs, attendance %, submission rate, LMS consistency, LMS trend, internal %.
- **Trained on the previous semester's weeks 1–8 → "failed ≥ 1 subject at end of semester"**, using exam marks as the label.
- Validated on 30% held-out students and compared against the "prior CGPA < 6.5" baseline.
- Applied to the current semester at week 8.
- **We do not train a placement model**, because there are no real placement outcomes and any label would be circular. It is listed as a roadmap item.

**Priority** (Action Queue order) = academic points + 0.6 × placement points + max(0, 60 − score)/10 + 2 × engagement-drop.

### 6.4 Segments (ordered, first match wins)

| # | Segment | Rule | Recommended action |
|---|---|---|---|
| 1 | Silent disengagers | LMS drop flag, or attendance falling ≥ 10 pp over 4 weeks | Mentor call within 48 h |
| 2 | Academic stars, placement unready | Academic ≥ 75 and placement < 55 | Coding practice + 2 mock interviews |
| 3 | Engaged but struggling | Co-curricular ≥ 60 and academic < 55 | Remedial classes + mentoring |
| 4 | Skilled but irregular | Skills ≥ 70 and attendance < 75 | Attendance counselling |
| 5 | Placement-ready all-rounders | Score ≥ 75 and placement ≥ 70 | Advanced opportunities, peer mentoring |
| — | Steady middle | Everything else | Monthly nudges |

### 6.5 Planted patterns (so the dashboards find real stories)
- Low attendance → more backlogs (attendance < 65% gives a backlog rate about 3× higher).
- High CGPA with low coding scores (the career trait is only weakly correlated with ability), which produces segment 2.
- LMS activity falls from week 4, attendance from week 6, and marks follow at end of semester. That is the lead-time story.
- Day scholars attend about 5 pp less but submit at the same rate. This drives the fairness and commute insight.
- Interventions (seeded): mentoring call +6, remedial classes +5, coding bootcamp +7 on the placement pillar, attendance counselling +4, mock interviews +5 on placement.

## 7. Data model
The full DDL is in `db/migrations/001_init.sql`. The main objects:
- **Source tables:** `students, faculty, academics, attendance, lms_activity, engagement, placement, skills, feedback`
- **Output tables:** `scores` (scalars + `drivers` JSONB + full `profile` JSONB), `analytics` (key → JSONB: `cohort`, `model`, `insights`), `data_quality`, `source_stats`
- **App tables:** `users, interventions, notifications, mock_interviews`
- **`student_unified_view`:** one row per student joining everything. Dashboards read this view plus `scores`.

## 8. API (FastAPI on a Hostinger VPS: `https://api.<our-domain>`)

Every request except `/health` carries `Authorization: Bearer <supabase access token>`, which is verified with `supabase.auth.get_user`.

| Method & path | Body → Response | Who |
|---|---|---|
| `GET /health` | → `{ok: true}` | public |
| `POST /whatif` | `{student_id, overrides: {attendance_pct?, coding?, aptitude?, mock?, internal_pct?, submit_rate?, certifications?}}` → `{score, band, pillars, academic_risk, placement_risk, delta}` | any role (a student only for themselves) |
| `POST /rescore` | `{weights: {academic..feedback}}` → `[{student_id, score, band}]` | admin, faculty |
| `POST /admin/users` | `{email, role, name, student_id?, faculty_id?}` → `{user_id, temp_password}` | admin |
| `POST /admin/users/bulk` (P1) | multipart CSV → `{created, errors[]}` | admin |
| `POST /interview/start` | `{resume_text}` → `{session_id, questions: [5]}` | student |
| `POST /interview/answer` | `{session_id, index, answer_text}` → `{ok}` | student |
| `POST /interview/finish` | `{session_id}` → `{score_5, feedback: {strengths, gaps}, new_success_score}` | student |
| `POST /tts` | `{text}` → `audio/mpeg` (ElevenLabs) | student |
| `POST /briefs/{student_id}` (P2) | → `{brief}` | faculty, admin |
| `POST /chat` (P2) | `{question}` → `{answer, sql, rows}` | admin |

## 9. Non-functional requirements
- **Availability:**
  - The frontend is on Vercel and the API on a Hostinger VPS (systemd + nginx + HTTPS). Both are always on, with no cold starts.
  - Core dashboards read Supabase directly, so they keep working even if the API is down.
  - All AI features fall back gracefully if their call fails.
- **Performance:** first dashboard paint under 3 s on the deployed URL. Pre-computed scores only; no ML runs at page load.
- **Security:**
  - The service-role, Gemini and ElevenLabs keys stay on the server only, and `.env` is never committed.
  - Roles are enforced in Next.js middleware and the API.
  - RLS: P0 allows authenticated read on analytics tables; P1 adds per-role policies.
  - The data is 100% synthetic, with no real names or institutions.
- **Responsible AI:**
  - Risk is described as "needs a check-in", never "will fail".
  - Drivers are always shown.
  - The fairness table and limitations are visible on Method & Trust.
- **Responsive:** works at 1366×768 and on a 390 px wide phone.

## 10. Demo story (3–5 minutes; also the video script)
1. **Problem:** 7 systems, 7 ID formats; nobody sees a struggling student until results come out.
2. **Integration (Data Health):** about 400k raw rows, issues fixed, IDs resolved, one unified view.
3. **Admin:** KPIs, risk by department and year, the quadrant, segments, and the lead-time insight ("LMS drops show up about 2 months before backlogs").
4. **Faculty:** the Action Queue. Open a Red mentee, see the top-3 drivers and the waterfall, and log a mentoring intervention.
5. **Student** (`student.red`): score, drivers, skill-gap path, certifications, hackathons, a 60-second mock interview, and the what-if slider.
6. **Close the loop:** the mock score feeds back and the score rises. Admin sees intervention effectiveness by type.
7. **Trust:** back-test vs baseline, fairness table, adjustable weights.

## 11. Risks and fallbacks

| Risk | Fallback |
|---|---|
| Voice mock interview overruns its 3 h timebox | Ship the text interview (Gemini only); voice becomes a stretch goal |
| Model AUC weak or suspicious | Rule tiers only, with the model shown as roadmap. Rule tiers are already P0. |
| RLS takes too long | Enforce roles in middleware and the API (P0 already does this) |
| Real data not ready at hour 4 | Frontends keep the 50-student mock seed |
| VPS deploy problems | Dashboards don't need the API. The what-if sliders show "Simulator offline". |
| Late-night deploy failure | v1 was submitted at hour 6; keep the recorded demo video |

**Cut list (in this order):**
1. Chatbot
2. AI briefs
3. Bulk CSV import
4. Per-role RLS
5. Feedback form
6. Effectiveness chart (keep logging)
7. Voice (keep text interview)

**Never cut:** unified data, Success Score, both risk flags, admin and faculty dashboards, drivers, Data Health.
