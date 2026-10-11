# Admin and faculty features: research and decisions

Written 11 Oct 2026, 17:40 IST. Goal: build what faculty and administrators would actually use every week, which is also what the KPMG judges score (Problem Understanding 10%, Dashboard 25%, Score and Risk 25%) and what "decision intelligence, not just a dashboard" asks for.

## What the research says
| Finding | Source | Consequence for us |
|---|---|---|
| Early-alert tools work as a **closed loop**: an alert opens a *case*, the case is assigned, follow-up is tracked, and it closes only when the intervention is done. Alerts alone do not help; outreach does. | [EAB Navigate guide to alerts, cases and progress reports](https://www.wisconsin.edu/ss-eab-project/download/EAB-Guide-to-Alerts-Cases-and-Progress-Reports-12-04-18.pdf), [NACADA](https://nacada.ksu.edu/Resources/Academic-Advising-Today/View-Articles/Maximizing-the-Use-of-an-Early-Alert-System-through-Advisor-Outreach) | A faculty "My week" panel and an admin response dashboard built on intervention records: who is flagged, who has been contacted, what is overdue. |
| **Alert volume overwhelms advisors** unless there are triage rules; caseloads of 300+ are normal. | [EAB vs Civitas comparison](https://www.rfp.wiki/education-training/higher-education-analytics-platforms/eab/civitas-learning), [NACADA](https://nacada.ksu.edu/Resources/Academic-Advising-Today/View-Articles/Maximizing-the-Use-of-an-Early-Alert-System-through-Advisor-Outreach) | Cap the daily list ("today's five") instead of showing everything; show workload per mentor and suggest rebalancing. |
| Practice is to contact the student within about **two days** of an alert (seven at the outside); the evidence is correlational, not causal. | [UW System EAB convening](https://www.wisconsin.edu/ss-eab-project/download/UWSA_Convening_Early-Alerts.pdf), [Montana case study](https://www.umt.edu/navigate/for-advisors/default.php) | A visible response target (default 7 days, editable), reported as coverage, never as proof that contact causes better results. |
| Text nudges work best as **plain-language reminders about a specific task whose consequence the student understands**; generic campaigns showed no effect. | [Georgia State chatbot trials](https://www.edworkingpapers.com/sites/default/files/GSU%20persistence%20nudging%20-%20EDW%20update%20-%20%2808-25-2023%29.pdf), [Brookings](https://www.brookings.edu/articles/best-practices-in-nudging-lessons-from-college-success-interventions) | Message drafts that name the exact problem, the exact next step and the deadline, grounded in the student's own numbers. |
| **NAAC 2.2.1** colleges identify slow and advanced learners from internal tests (commonly below 40% / above 75%), allocate mentors in small batches, and keep **counselling logs and remedial records as evidence**. | [Institutional NAAC submissions](https://www.nldalmia.in/wp-content/uploads/2023/04/2.2.1signed.pdf), [Amity](https://www.amity.edu/jaipur/pdf/aur-naac/Slow-performers-and-advance-learners.pdf) | An accreditation evidence pack generated from data we already hold (learner identification, mentor allocation, support log). Thresholds are editable because each institution sets its own. |
| The **75% attendance rule** is set by each university; condonation is typically capped at 10 to 15%, and colleges notify parents. | [Careerindia explainer](https://www.careerindia.com/features/75-percent-attendance-rule-handling-shortfalls-condonation-2026-011-66243.html), [Bombay HC ruling](https://lawtext.in/judgement.php?bid=69251) | An attendance recovery planner with editable policy (threshold, condonation allowance) that says whether a student can still recover and what they must attend. |

## What our own data supports (live database, 1,500 students)
- 22% of students are below 75% attendance and 14% below 65%. After week 8 of 16, a student at 70% must attend 80% of the remaining classes to finish at 75%; at 50% it is impossible without condonation.
- Mentors hold 27 to 33 mentees each, but the number of **Red** students per mentor ranges from 3 to 12, so workload balancing has a real signal.
- All 300 interventions are seeded history (status done, no follow-up dates); there are no live ones. Contact coverage therefore starts at zero and only counts live interventions, so it rises as faculty act.
- Internal marks and CGPA exist for everyone, so slow/advanced learner identification works (only 12 students are below 40%, so the default is editable).

## Decisions: what we build, in order
| # | Feature | For | Why it wins |
|---|---|---|---|
| 1 | **Closed-loop cases:** "My week" panel (today's five, follow-ups due, Red contacted within 7 days) and a Last-contact column | Faculty | Turns the dashboard into a daily workflow; the brief says "move beyond a dashboard" |
| 2 | **Response and workload dashboard:** coverage KPIs, per-mentor caseload, rebalancing suggestions, bulk programme tasks for a segment | Admin | Decision intelligence: who is not being helped and who is overloaded, with one-click action |
| 3 | **Attendance recovery planner:** can each student still recover, and what must they attend; editable policy; printable notices | Both | Concrete, India-specific, uses real numbers |
| 4 | **Message drafts:** student check-in, guardian attendance notice, placement nudge, encouragement; AI with a fact check plus offline template; copy / WhatsApp / email | Faculty | Research-backed wording; turns insight into action in one click |
| 5 | **Accreditation evidence pack:** learner identification, mentor allocation, support log, outcomes; CSV and print | Admin | Real recurring institutional pain (NAAC/NBA); shows problem understanding |
| 6 | **Weekly brief for the dean:** grounded AI narrative with template fallback; printable | Admin | Executive summary of the week in one paragraph |

Out of scope tonight: uploading real CSVs and re-running the pipeline from the UI, SMS/WhatsApp Business sending (needs paid APIs and consent handling), per-subject class views (no faculty-to-subject mapping in the data).

## Principles carried over
- Flags are prompts for a conversation, never verdicts. Coverage is reported as activity, not as proof of effect.
- Every AI feature has a non-AI fallback and an offline state; dashboards keep working if the API is down.
- Everything faculty see is limited to their mentees by row-level security, not just by the UI.
