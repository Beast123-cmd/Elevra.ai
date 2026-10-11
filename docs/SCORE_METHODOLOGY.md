# Elevra.ai score and early-warning methodology

## Student Success Score

The Student Success Score is a 0–100 summary across seven pillars. Each pillar is
calculated from the inputs listed below, then the available pillars are combined
with the fixed weights. Missing pillars are omitted and the remaining weights
are renormalised; missing data is never treated as a zero score.

| Pillar | Weight | Main inputs |
|---|---:|---|
| Academic | 25% | CGPA, internal marks, active backlogs |
| Attendance | 15% | Attendance in the current eight-week window |
| LMS engagement | 10% | Assignment submissions, active-week consistency, session time |
| Placement readiness | 20% | Aptitude, coding, mock interview |
| Skills | 15% | Technical and soft-skill assessments, certifications |
| Co-curricular engagement | 5% | Verified events, clubs, hackathons and certifications |
| Feedback | 10% | Student satisfaction and faculty ratings |

For student *i*, let *Pᵢ* be the pillars with valid data and *wₚ* their fixed
weights. The score is `round(Σ(wₚ × pillarₚ) / Σ(wₚ), 1)`. Confidence is the
percentage of total weight represented by available pillars. Scores map to
bands as follows: **Critical** below 45, **Needs Attention** from 45, **On
Track** from 60, and **Thriving** from 75. A profile with no available pillars
has score 0, Critical band, and 0% confidence.

The score is descriptive and supports prioritisation; it is not a measure of a
student's potential. Academic and placement risk are reported separately from
the score. Academic risk combines transparent rule-based drivers with the
historical model probability. Attendance below 65% and three or more backlogs
are hard Red triggers. Placement is shown as **Not assessed** when placement
inputs are unavailable. The interface should describe a Red flag as a need for
a check-in, not a prediction that a student will fail.

## Early-warning model comparison

The pipeline builds one labelled example per student from weeks 1–8 of a
completed semester and that semester's final exam outcome. The positive label
means at least one subject has an external mark below 40, or the student was
recorded absent for an exam. Features are prior CGPA and backlogs, eight-week
attendance, internal marks, assignment submission rate, LMS active-week
consistency and login trend. Final exam marks and the label are not model
features.

The current implementation compares three candidates: logistic regression, a
pruned Gini decision tree (maximum depth 3), and a 25-tree random forest
(maximum depth 4). A deterministic stratified 70/30 student split is used for
the holdout report. Candidate selection uses mean ROC AUC across five
stratified folds within the training portion; ties prefer the simpler model.
The holdout is reserved for reporting. All candidates and their configuration
and metrics are stored in `analytics` under `key = 'model'`.

Current benchmark (1,500 synthetic students; 1,050 training and 450 holdout):

| Candidate | 5-fold CV ROC AUC | Holdout ROC AUC | Holdout PR AUC | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|
| Logistic regression | 0.746 | 0.751 | 0.605 | 0.621 | 0.397 | 0.484 |
| Decision tree | **0.760** | 0.749 | 0.525 | 0.618 | 0.559 | **0.587** |
| Random forest | 0.759 | **0.763** | 0.593 | **0.635** | 0.485 | 0.550 |
| Prior CGPA < 6.5 baseline | — | 0.743 | 0.573 | 0.538 | **0.632** | 0.581 |

The decision tree is selected because it has the highest mean cross-validation
ROC AUC. Its lead over the random forest is only 0.0001 AUC, while the forest
scores higher on the single holdout AUC and precision. The baseline has higher
recall than all three candidates. These results do not establish that the tree
is the best model for a real college, nor that the model beats the baseline on
every operational objective. Selection and deployment decisions should account
for the cost of missed check-ins and unnecessary check-ins, calibration,
stability across semesters, and institution-specific validation.

The benchmark uses a probability threshold of 0.5. The selected tree's holdout
confusion counts are 76 true positives, 47 false positives, 267 true negatives
and 60 false negatives. The synthetic holdout positive rate is 30.2%. These
rates and counts describe only this generated cohort and split.

## Data quality, fairness and limits

Data Health reads per-source input/output row counts and student coverage from
`source_stats`, plus issue categories, affected-row counts and cleaning actions
from `data_quality`. Issue counts are issue occurrences and can overlap when a
row has more than one problem; they are not a count of unique students or unique
rows. Source coverage is based on canonical student IDs represented in each
cleaned source. These metrics describe the pipeline's synthetic source extracts.

The pipeline reports holdout flag rate, recall and false-positive rate by
residence and gender in `analytics.model.fairness`. These are descriptive
checks, not proof of fairness: subgroup estimates may be noisy, and the
generated demographics and outcomes do not represent a validated institution.
The current run reports similar flag rates for day scholars and hostel
residents, and for the two generated gender groups, but this should not be
interpreted as a fairness certification.

All current student, assessment, attendance, engagement, placement, skills and
feedback records are synthetic. The model benchmark is useful for checking the
pipeline and demonstrating analytics, not for making decisions about real
students. Before any institutional use, replace the generated cohort with an
approved, appropriately protected dataset; validate on later, institution-held
cohorts; review subgroup performance with institutional stakeholders; and
keep a human responsible for support decisions.
