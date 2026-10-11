# CampusCompass: Winning Strategy for KPMG Challenge 04

> **Challenge:** Smart Campus Analytics: Predict, Optimize & Improve Student Success (KPMG in India)
> **Round 1:** Oct 11 10:00 IST to Oct 12 10:00 IST. Auto-evaluation of mandatory functionality comes first, then human judges.
> **Brief:** [`docs/KPMG_PS.md`](KPMG_PS.md)

---

## 1. One-line pitch

**CampusCompass turns 7 disconnected campus data systems into a weekly early-warning and triage engine.** It flags students who are likely to fail **8 weeks before end-semester exams**, explains *why* in plain language, and hands each mentor a ranked action queue. We prove that it works with a back-test, and we prove that it's fair with a bias audit.

The tagline judges should remember: **"From dashboard to decision: we don't just show risk, we show who to call this week, why, and what to do."**

---

## 2. What the research says (and how each finding becomes a feature)

| Finding | Source | Our feature |
|---|---|---|
| Georgia State's GPS system tracks ~800 risk flags, updates daily, and advisers act **within 48 hours**. They credit about 1,700 extra graduates a year. **>90% of the cost was advisers, not software**: alerts without action do nothing. | NPR 2016; Renick, US Senate HELP testimony | **Action Queue**: a ranked caseload for each mentor, with reasons and a suggested intervention. A mentor capacity view shows that triage respects how many students each mentor can actually handle. |
| EAB Navigate's predictive model is used **"as a triage or prioritization mechanism"** (Low/Moderate/High), not as a verdict. | EAB Navigate glossary (Colorado State) | Risk is shown as **triage tiers with drivers**, never as a label on the student. Wording: "needs a check-in", not "will fail". |
| Purdue's Course Signals traffic light became an industry template, but its **retention claims were debunked** (no causal evidence). | Times Higher Education 2013 | **Honesty as a feature**: a back-test with held-out metrics, compared against a CGPA-only baseline, and a "Limitations" panel. We never claim causation. |
| LMS behaviour is a **leading indicator**. A 28-day window predicted failure about 27 days ahead (AUC 0.71), **timing and consistency beat raw clicks**, and models stabilise by week 5 to 8. | ECEL 2025; JPSS; Sri Lanka LMS study | Features: **login consistency, submission rate, engagement trend (slope)**. An "Engagement drop" early-warning flag. A lead-time chart showing that LMS drops come before attendance drops, which come before marks drops. |
| Fairness risk: "no LMS login for 7 days" can penalise **commuters and students with poor connectivity**. | arXiv 2608.03968 (ethical governance of LA) | **Trust page**: flag rate, recall and false-positive rate split by **residence (hostel vs day scholar)** and gender. Consistency is measured as share of active weeks, not raw minutes. This lines up with **KPMG's own "Trusted AI" framework**, which KPMG judges will recognise. |
| Indian campus rules: **75% attendance mandate** (detention below about 65%), **active backlogs block placement-drive eligibility**, NAAC Criterion 2 and 5 (student progression), NIRF "Graduation Outcomes". | UGC/AICTE norms; NAAC; NIRF | Hard floors in the risk rules (attendance < 65 → High; backlogs ≥ 3 → High; active backlog → placement driver). An admin view framed around NAAC/NIRF-style outcomes. This scores Problem Understanding points. |

---

## 3. Competitive landscape: 7 rival repos read in source

| Rival | Est. score | Their best idea | Their fatal flaw |
|---|---|---|---|
| CampusPulse (sahilAIML) | ~87 | Weight-tuner sliders, waterfall chart vs peers, guided demo | Data generated with modulo arithmetic; ML labels are the same as the features (claims "100% accuracy") |
| EduNex | ~83 | 1k students across 7 streams, model-vs-baseline page, audit trail | Unit/scale bugs put ~100% of students at LMS risk; the model loses to its own baseline on F1; not deployed |
| BIB InsightIQ | ~81 | Clean point-based academic and placement flags with thresholds | No ML, few charts, data only in localStorage, no deployment |
| BYTEXL CampusPulse | ~71 | Hard floors, momentum, "silent struggler" flags, cleaning report | All 7 streams derived from **one** test score; fake ML numbers |
| Student360 | ~69 | Real XGBoost + SHAP + what-if simulator | Off-brief UCI Portugal dataset; 5 of 7 streams missing; backend returning 503 |
| ProtoStar | ~68 | Honest about missing data; consent-aware recruiter view | Only 4 of 7 pillars scored |
| Pratibha | ~66 | Polished UI, personas, intervention sandbox | Live site runs only on hardcoded mock data; both "models" are the same file |

**Everyone's shared weakness is the 30% criterion, Data Integration.** Nobody ships genuinely separate, messy sources with visible cleaning. Most ML is fake or circular. Most deployments are fragile. **That is where we win.**

---

## 4. How we score each rubric line

### Data Integration & Analysis (30)
- **8 raw CSVs**: a registry plus 7 sources, each with its *own* ID format. Roll no `21CSE045`, LMS uses **email**, the placement export uses `Roll No` with odd spacing and case. That makes ID resolution real work.
- **Deliberate, realistic mess**: duplicates, `AB` (absent) marks, attended > held, negative minutes, `NA` and `78%` strings, out-of-range values, skills on mixed 0–10 and 0–100 scales, and 20% survey non-response.
- **A visible cleaning pipeline** feeds a **Data Studio page**: raw → clean row counts, every issue with the action taken, ID-match rate per source, and a pillar coverage matrix.
- **Cross-source insights** that no single system can produce: "X% of students who failed last semester showed an LMS drop before mid-terms", "High-CGPA students with placement gap", "Day scholars attend Y pp less but submit just as much".

### Success Score & Risk (25 + segmentation bonus)
- One documented formula over **all 7 pillars**: Academic 30, Attendance 15, LMS 15, Placement 15, Skills 10, Engagement 10, Feedback 5. Missing pillars are dropped and the remaining weights renormalised, with a **confidence %** shown. It's identical in the Python pipeline, the TypeScript UI and the docs, enforced by a parity test.
- **Two separate risk flags**:
  - **Academic**: points from attendance, backlogs, CGPA, internals, LMS submissions, the engagement-drop flag and ML probability. Hard floors force High.
  - **Placement**: points from aptitude, coding, mock interview, resume, skills, certifications and active backlogs.
  - Every point is a named driver.
- **A real, honest ML model**: logistic regression trained on **last semester's weeks 1–8** to predict an end-semester fail. It's validated on held-out students and compared against a CGPA-only baseline. **The label comes from the simulated exam outcome, not from the features**, so it's not circular.
- **Segmentation (bonus)**: 6 named, ordered, actionable segments, including the brief's example, "Academic stars, placement gap". Each segment comes with its own intervention programme.

### Dashboard & Visualization (25 + explainability bonus)
- **Overview**: KPIs, score distribution, risk quadrant scatter (academic × placement), dept × pillar heatmap, weekly trend lines, insight cards.
- **Action Queue**: ranked list with filters (dept, year, mentor, risk type, segment), reason chips, CSV export, mark-as-contacted.
- **Student 360**: score gauge, pillar radar, **contribution waterfall vs cohort**, two risk cards with drivers, top ML factors, weekly LMS and attendance timeline, recommended actions, data coverage.
- **Segments**: cards plus a scatter view.
- **Methodology & Trust**: live **weight sliders** that recompute every score in the browser, back-test metrics vs baseline, fairness table, limitations.

### Problem Understanding (10)
- Personas: **Dean/Admin** (strategy, NAAC/NIRF outcomes), **Faculty mentor** (who to call this week), **Placement officer** (readiness gaps).
- Indian rules (75% attendance, backlogs block drives) are built into the logic.
- The research findings above go on a slide.

### Presentation & Demo (10)
- The deployed site loads **instantly, with no login and no API key**: a static site on Vercel that can't cold-start or 503.
- A **"Guided demo"** button walks through Overview → an at-risk student → why → action.
- 3-minute demo video and 6 slides.
- Score methodology note: `docs/SCORE_METHODOLOGY.md`.

---

## 5. Architecture (chosen for reliability under auto-evaluation)

```
data/raw/*.csv (8 messy sources)
      │  pipeline/ (Python: pandas + scikit-learn, pytest)
      ▼
clean → unify (ID resolution) → pillars → score → ML model → risk → segments → insights → fairness
      │
      ▼  export JSON contract
web/public/data/{students,cohort,quality,model,insights}.json
      │  web/ (Vite + React + TS + Tailwind + Recharts, Vitest)
      ▼
Static site on Vercel (no backend to fail); weights re-scored client-side
```

**Why static:**
- The auto-evaluator hits a URL that always works.
- No cold starts.
- No keys.
- The pipeline is reproducible with `python run_pipeline.py`, and judges can rerun it.

---

## 6. 22-hour timeline

| Time (IST) | Milestone |
|---|---|
| 12:00–12:30 | Repo, JSON contract frozen (Task 1), roles assigned |
| 12:30–15:30 | Generator + cleaning + pillars + score (Data). Web shell + Overview + Queue against sample JSON (FE). |
| 15:30–17:30 | Risk rules + segments + export (Data). Student 360 page (FE). |
| **17:30–18:30** | **Integrate, deploy to Vercel, and SUBMIT v1** with all 4 mandatory features working. |
| 18:30–23:00 | ML back-test + explanations + fairness + insights (Data). Data Studio + Methodology/weights sliders + Segments (FE). |
| 23:00 | **Submit v2** |
| 23:00–03:00 | Polish: guided demo, empty and edge states, mobile, performance, README |
| 03:00–06:00 | Sleep in shifts (one person always awake) |
| 06:00–08:30 | QA against the checklist (§8), methodology note, slides, demo video |
| **08:30** | **Final submit.** 08:30–10:00 is buffer only. No new features. |

## 7. Roles (team of 3–5)

| Role | Owns | Plan tasks |
|---|---|---|
| **A: Data engineer** | Generator, cleaning, unify, pillars, score | 2–5 |
| **B: ML/analytics** | Risk rules, model, segments, insights, fairness, export | 6–10 |
| **C: Frontend lead** | Shell, routing, Overview, Action Queue, deploy | 11–13, 17 |
| **D: Frontend** | Student 360, Segments, Data Studio, Methodology | 14–16 |
| **E: PM/storyteller** | README, methodology note, slides, demo video, QA checklist, submissions | 18 |

With 3 people: A+B, C+D, and E split across everyone (E's work comes last).

## 8. Pre-submission checklist (auto-evaluation gate)
- [ ] Deployed URL loads in incognito in under 3 s, with no login and no console errors
- [ ] **Unified student view** showing all 7 sources (Student 360 + Data Studio)
- [ ] **Student Success Score** visible on list, profile and overview
- [ ] **Academic risk** and **placement risk** flags visible and filterable
- [ ] **Interactive dashboard**: filters, sorting, drill-down, sliders all work
- [ ] Segments page and explainability (waterfall + drivers) work
- [ ] GitHub repo is public; README has the live link, stack, run steps and screenshots
- [ ] `docs/SCORE_METHODOLOGY.md` present; slides and video linked in the README
- [ ] Every button works (no dead links); works at 1366×768 and on mobile

## Sources
- [NPR: How one university used big data to boost graduation rates](https://www.npr.org/sections/ed/2016/10/30/499200614/how-one-university-used-big-data-to-boost-graduation-rates)
- [Renick testimony, US Senate HELP](https://www.help.senate.gov/download/testimony/renick-testimony)
- [THE: Student retention software comes under microscope](https://www.timeshighereducation.com/node/116901)
- [EAB Navigate glossary (Colorado State)](https://advising.colostate.edu/wp-content/uploads/sites/35/2023/02/Navigate-Glossary.pdf)
- [How Early can we Identify At-Risk Students? (ECEL)](https://papers.academic-conferences.org/index.php/ecel/article/view/3959)
- [Predictive Identification of At-Risk Students using LMS Data (JPSS)](https://journals.flvc.org/jpss/article/download/132082/138293?inline=1)
- [Ethical governance of student data in learning analytics (arXiv)](https://arxiv.org/pdf/2608.03968)
- [KPMG: Impact of NEP 2020](https://home.kpmg/content/dam/kpmg/in/pdf/2020/08/impact-of-national-education-policy-2020-and-opportunities-for-stakeholders.pdf)
