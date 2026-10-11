> **SUPERSEDED by `docs/PRD.md` + `docs/BUILD_PLAN.md`.** Only Tasks 2–10 are still used, as reference code for Lane A, with the changes in BUILD_PLAN §5. Ignore this file's web tasks, weights and JSON-only deploy.

# CampusCompass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deployed student-success platform for KPMG Challenge 04. It combines 7 messy campus data sources into one student view, computes an explainable Student Success Score, flags academic and placement risk separately, segments students, and gives faculty and admins an interactive dashboard with a ranked action queue.

**Architecture:**
- An offline, reproducible Python pipeline (`pipeline/`) generates 8 messy raw CSVs. It cleans them, joins them on resolved IDs, then computes pillars, score, ML back-test, risk flags, segments, insights and fairness metrics, and exports a fixed JSON contract.
- A static React app (`web/`) reads that JSON and recomputes scores in the browser when admins move the weight sliders.
- The site deploys to Vercel. There is no backend, so the auto-evaluator can never hit a cold or broken server.

**Tech Stack:**
- Python 3.13, pandas 2.3, numpy 2.3, scikit-learn 1.7, pytest
- Node 22, Vite 5, React 18.3.1, TypeScript 5.5, react-router-dom 6.26.2, Recharts 2.12.7, Tailwind 3.4.13, Vitest 2.1.2

**Spec:** `docs/KPMG_PS.md` (official brief) and `docs/STRATEGY.md` (research and winning strategy). Read both before starting.

## Global Constraints

- Pillars (exact keys): `academic, attendance, lms, placement, skills, engagement, feedback`.
- Weights (exact): academic 0.30, attendance 0.15, lms 0.15, placement 0.15, skills 0.10, engagement 0.10, feedback 0.05 (sum = 1.00).
- Bands: score ≥ 75 "Thriving"; ≥ 60 "On Track"; ≥ 45 "Needs Attention"; else "Critical".
- Missing pillar: excluded, and the remaining weights renormalised. `confidence` = sum of present weights × 100. A missing pillar is **never** scored as 0.
- Score is rounded to 1 decimal. Python and TypeScript must agree within 0.11.
- Risk levels (exact strings): `"High" | "Medium" | "Low" | "Not assessed"`.
- Seed 42 everywhere. `python run_pipeline.py --regenerate` must reproduce byte-identical CSVs.
- Current semester is in progress at **week 8**. The previous semester is complete (16 weeks plus results).
- The deployed app needs no login, no API key and no backend. All data is under `web/public/data/*.json`.
- Wording: risk means "needs a check-in". Never write "will fail" in the UI.
- Never copy code from competitor repos (rulebook §26).

## Review Focus

1. **A student with no placement data (all of year 2):** the score renormalises, `placement_risk.level == "Not assessed"`, and the UI shows "Not yet assessed", not 0 or NaN. *Test: Task 5 and Task 6.*
2. **Raw values like `"NA"`, `"78%"`, `"4/5"`, `"AB"`, 112, or negative minutes:** each is parsed or nulled and logged as an issue, never crashing the pipeline. *Test: Task 3.*
3. **ID mismatches (lower-case or trailing-space roll numbers, upper-case emails):** these resolve to the registry student, not to "unknown". *Test: Task 3.*
4. **Weight sliders all set to 0, or only one non-zero:** no division by zero. The score falls back to the default weights, and the UI says so. *Test: Task 16 (`score.test.ts`).*
5. **Empty filter results in the Action Queue or Segments pages:** an empty-state message is shown, with no blank table and no crash. *Test: Task 13 (manual QA step), plus the empty-array guard in code.*

---

## File Structure

```
HacXalerate/
├── data/raw/                      # 8 generated messy CSVs (committed so judges can inspect)
├── pipeline/
│   ├── requirements.txt
│   ├── run_pipeline.py            # CLI entrypoint: generate? → clean → … → export
│   ├── campus/
│   │   ├── __init__.py
│   │   ├── config.py              # paths, seed, weights, bands, labels
│   │   ├── generate.py            # synthetic messy raw data (8 files)
│   │   ├── clean.py               # per-source cleaning + issue log
│   │   ├── features.py            # ID-joined per-student features + weekly series
│   │   ├── pillars.py             # 7 pillar sub-scores (0–100, NaN = missing)
│   │   ├── score.py               # success score, band, confidence, contributions
│   │   ├── model.py               # back-tested logistic model + per-student explanations
│   │   ├── risk.py                # academic + placement risk drivers
│   │   ├── segments.py            # segments, priority, actions
│   │   ├── insights.py            # cross-source insights + lead-time curves + fairness
│   │   └── export.py              # JSON contract writer
│   └── tests/ (test_generate.py, test_clean.py, test_features.py, test_score.py,
│               test_risk.py, test_model.py, test_segments.py, test_export.py)
├── web/
│   ├── public/data/*.json         # pipeline output (committed)
│   ├── vercel.json
│   └── src/
│       ├── lib/ (types.ts, score.ts, score.test.ts, data.tsx, format.ts, csv.ts)
│       ├── components/ (Layout.tsx, ui.tsx)
│       └── pages/ (Overview, Queue, Student, Segments, DataStudio, Methodology, Demo).tsx
├── docs/ (KPMG_PS.md, STRATEGY.md, SCORE_METHODOLOGY.md, slides.md)
└── README.md
```

---

### Task 1: Repo scaffold and config

**Files:**
- Create: `.gitignore`, `pipeline/requirements.txt`, `pipeline/campus/__init__.py`, `pipeline/campus/config.py`, `pipeline/tests/__init__.py`, `pipeline/conftest.py`

**Interfaces:**
- Produces: `campus.config` constants `ROOT, RAW_DIR, OUT_DIR, SEED, N_STUDENTS, N_MENTORS, CURRENT_WEEK, SEM_WEEKS, SUBJECTS_PER_SEM, PILLARS, WEIGHTS, BANDS, PILLAR_LABELS`, plus `band_for(score: float) -> str`.

- [ ] **Step 1: Init repo and branch**

```bash
cd A:/WebDev/HacXalerate
git init -b main
git checkout -b build
```

- [ ] **Step 2: Write files**

`.gitignore`
```
__pycache__/
.pytest_cache/
.venv/
node_modules/
web/dist/
.vercel
*.pdf
```

`pipeline/requirements.txt`
```
pandas==2.3.3
numpy==2.3.3
scikit-learn==1.7.2
pytest==8.3.3
```

`pipeline/conftest.py`
```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
```

`pipeline/campus/__init__.py` and `pipeline/tests/__init__.py`: empty files.

`pipeline/campus/config.py`
```python
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw"
OUT_DIR = ROOT / "web" / "public" / "data"

SEED = 42
N_STUDENTS = 600
N_MENTORS = 30
CURRENT_WEEK = 8          # current (odd) semester is in progress at week 8
SEM_WEEKS = 16            # previous semester is complete
SUBJECTS_PER_SEM = 5

PILLARS = ["academic", "attendance", "lms", "placement", "skills", "engagement", "feedback"]
WEIGHTS = {
    "academic": 0.30, "attendance": 0.15, "lms": 0.15, "placement": 0.15,
    "skills": 0.10, "engagement": 0.10, "feedback": 0.05,
}
BANDS = [(75.0, "Thriving"), (60.0, "On Track"), (45.0, "Needs Attention"), (0.0, "Critical")]
PILLAR_LABELS = {
    "academic": "Academic", "attendance": "Attendance", "lms": "LMS Learning",
    "placement": "Placement Readiness", "skills": "Skills",
    "engagement": "Co-curricular Engagement", "feedback": "Feedback",
}


def band_for(score: float) -> str:
    for threshold, name in BANDS:
        if score >= threshold:
            return name
    return BANDS[-1][1]
```

- [ ] **Step 3: Install and smoke-test**

Run: `cd pipeline && python -m pip install -r requirements.txt && python -c "from campus.config import band_for; print(band_for(80), band_for(10))"`
Expected: `Thriving Critical`

- [ ] **Step 4: Commit**

```bash
git add .gitignore pipeline docs
git commit -m "chore: scaffold pipeline package and config"
```

---

### Task 2: Messy raw data generator

**Files:**
- Create: `pipeline/campus/generate.py`
- Test: `pipeline/tests/test_generate.py`

**Interfaces:**
- Consumes: `campus.config`
- Produces: `generate_all(out_dir: Path = RAW_DIR) -> dict[str, pd.DataFrame]`. It writes `students.csv, academic.csv, attendance.csv, lms.csv, engagement.csv, placement.csv, skills.csv, feedback.csv`, and the dict keys match those names without `.csv`.

Design notes. These are what make the data realistic, and what make the ML non-circular:
- Hidden per-student traits: `ability`, `diligence`, `career` (correlated 0.3 with ability, so "high academics, low placement" happens), `drop_prev` (12%) and `drop_cur` (12%).
- Exam outcomes come from the hidden traits and noise. The pipeline only sees observable data.
- Disengagement shows up first in LMS (from week 4), then attendance (from week 6), then marks. That ordering is the lead-time story.
- Day scholars attend about 5 percentage points less, but their LMS activity is the same. That feeds the fairness story.

- [ ] **Step 1: Write the failing test**

`pipeline/tests/test_generate.py`
```python
import hashlib

import pandas as pd

from campus.generate import generate_all

FILES = ["students", "academic", "attendance", "lms", "engagement", "placement", "skills", "feedback"]


def test_generates_all_files(tmp_path):
    frames = generate_all(tmp_path)
    assert sorted(frames) == sorted(FILES)
    for name in FILES:
        assert (tmp_path / f"{name}.csv").exists()


def test_registry_and_mess(tmp_path):
    frames = generate_all(tmp_path)
    reg = frames["students"]
    assert reg["roll_no"].nunique() == 600
    assert reg["roll_no"].duplicated().any()                      # duplicate registry rows
    place = pd.read_csv(tmp_path / "placement.csv", dtype=str)
    assert " Roll No" in place.columns                            # messy header
    assert place["Coding Score"].eq("NA").any()
    assert place["Aptitude Score"].str.endswith("%").any()
    acad = pd.read_csv(tmp_path / "academic.csv", dtype=str)
    assert acad["external_marks"].eq("AB").any()
    lms = pd.read_csv(tmp_path / "lms.csv")
    assert (lms["minutes"] < 0).any()
    assert lms["email"].str.contains("[A-Z]", regex=True).any()


def test_placement_only_years_3_and_4(tmp_path):
    frames = generate_all(tmp_path)
    reg = frames["students"].drop_duplicates("roll_no").set_index("roll_no")
    rolls = frames["placement"][" Roll No"].str.strip().str.upper()
    assert set(reg.loc[rolls, "year"]) <= {3, 4}


def test_deterministic(tmp_path):
    a, b = tmp_path / "a", tmp_path / "b"
    a.mkdir(); b.mkdir()
    generate_all(a); generate_all(b)
    for name in FILES:
        h = lambda p: hashlib.md5(p.read_bytes()).hexdigest()
        assert h(a / f"{name}.csv") == h(b / f"{name}.csv")
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd pipeline && python -m pytest tests/test_generate.py -q`
Expected: FAIL, `ModuleNotFoundError: No module named 'campus.generate'`

- [ ] **Step 3: Implement**

`pipeline/campus/generate.py`
```python
"""Generate 8 deliberately messy CSVs that mimic disconnected campus systems."""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from .config import CURRENT_WEEK, N_MENTORS, N_STUDENTS, RAW_DIR, SEED, SEM_WEEKS, SUBJECTS_PER_SEM

DEPTS = ["CSE", "IT", "ECE", "MECH"]
MALE = ["Aarav", "Vivaan", "Aditya", "Sai", "Arjun", "Ishaan", "Rohan", "Karthik", "Rahul", "Vikram"]
FEMALE = ["Ananya", "Diya", "Priya", "Sneha", "Kavya", "Meera", "Pooja", "Riya", "Lakshmi", "Divya"]
LAST = ["Sharma", "Reddy", "Patel", "Iyer", "Nair", "Gupta", "Rao", "Kumar", "Singh", "Das", "Joshi", "Menon"]
TECH = {"CSE": ["DSA", "Web Development"], "IT": ["DSA", "Databases"],
        "ECE": ["Embedded C", "VLSI Basics"], "MECH": ["CAD", "Python"]}
COMMENTS = ["Classes are helpful", "Need more practical sessions", "Too much workload",
            "Mentor is supportive", "Placement training should start earlier", ""]
ACTIVITY_TYPES = ["event", "club", "hackathon", "certification"]


def _clip(x: float, lo: float, hi: float) -> float:
    return float(min(max(x, lo), hi))


def _make_students(rng):
    reg, lat = [], []
    for i in range(N_STUDENTS):
        dept = DEPTS[i % len(DEPTS)]
        year = int(rng.choice([2, 3, 4]))
        roll = f"{26 - year:02d}{dept}{i:03d}"
        gender = "F" if rng.random() < 0.45 else "M"
        first = (FEMALE if gender == "F" else MALE)[int(rng.integers(10))]
        reg.append(dict(
            roll_no=roll, name=f"{first} {LAST[int(rng.integers(len(LAST)))]}",
            email=f"{roll.lower()}@campus.edu", dept=dept, year=year, section="AB"[i % 2],
            gender=gender, residence="Day Scholar" if rng.random() < 0.4 else "Hostel",
            mentor_id=f"M{(i % N_MENTORS) + 1:02d}",
        ))
        ability, diligence = rng.normal(), rng.normal()
        lat.append(dict(roll_no=roll, ability=ability, diligence=diligence,
                        career=0.3 * ability + 0.95 * rng.normal(),
                        drop_prev=rng.random() < 0.12, drop_cur=rng.random() < 0.12))
    return pd.DataFrame(reg), pd.DataFrame(lat).set_index("roll_no")


def _semesters(s, L):
    cur = 2 * s.year - 1
    return ((cur - 1, SEM_WEEKS, L.drop_prev), (cur, CURRENT_WEEK, L.drop_cur))


def _academic(reg, lat, rng):
    rows = []
    for s in reg.itertuples():
        L, cur = lat.loc[s.roll_no], 2 * s.year - 1
        for sem in range(1, cur + 1):
            shift = -18 if (sem == cur - 1 and L.drop_prev) else (-10 if (sem == cur and L.drop_cur) else 0)
            for k in range(1, SUBJECTS_PER_SEM + 1):
                pct = 66 + 14 * L.ability + 6 * L.diligence + shift + rng.normal(0, 9)
                internal = round(_clip(pct + rng.normal(0, 10), 0, 100) * 0.40)
                external = "" if sem == cur else round(_clip(pct + rng.normal(0, 7), 0, 100) * 0.60)
                if sem < cur and rng.random() < 0.01:
                    external = "AB"
                rows.append(dict(roll_no=s.roll_no, semester=sem, subject_code=f"{s.dept}{sem}0{k}",
                                 internal_marks=internal, external_marks=external))
    df = pd.DataFrame(rows)
    return pd.concat([df, df.sample(frac=0.005, random_state=SEED)], ignore_index=True)


def _attendance(reg, lat, rng):
    rows = []
    for s in reg.itertuples():
        L = lat.loc[s.roll_no]
        base = 0.84 + 0.06 * L.diligence - (0.05 if s.residence == "Day Scholar" else 0.0)
        for sem, weeks, dropping in _semesters(s, L):
            for w in range(1, weeks + 1):
                rate = base - (0.07 * (w - 5) if (dropping and w >= 6) else 0.0)
                for k in range(1, SUBJECTS_PER_SEM + 1):
                    att = int(rng.binomial(3, _clip(rate + rng.normal(0, 0.05), 0.02, 1.0)))
                    rows.append((s.roll_no, sem, w, f"{s.dept}{sem}0{k}", 3, att))
    df = pd.DataFrame(rows, columns=["roll_no", "semester", "week", "subject_code", "held", "attended"])
    i = df.sample(frac=0.003, random_state=1).index
    df.loc[i, "attended"] = df.loc[i, "held"] + 1
    i = df.sample(frac=0.005, random_state=2).index
    df.loc[i, "roll_no"] = df.loc[i, "roll_no"].str.lower()
    return pd.concat([df, df.sample(frac=0.003, random_state=3)], ignore_index=True)


def _lms(reg, lat, rng):
    rows = []
    for s in reg.itertuples():
        L = lat.loc[s.roll_no]
        email = s.email.upper() if rng.random() < 0.05 else s.email
        for sem, weeks, dropping in _semesters(s, L):
            for w in range(1, weeks + 1):
                decay = max(0.15, 1 - 0.2 * (w - 3)) if (dropping and w >= 4) else 1.0
                logins = int(rng.poisson(max(0.3, 4 + 1.5 * L.diligence) * decay))
                minutes = round(logins * max(5.0, rng.normal(25, 8)))
                due = 2 if w % 2 == 0 else 1
                sub = int(rng.binomial(due, _clip(0.85 + 0.08 * L.diligence - (1 - decay) * 0.7, 0, 1)))
                rows.append((email, sem, w, logins, minutes, due, sub))
    df = pd.DataFrame(rows, columns=["email", "semester", "week", "logins", "minutes",
                                     "assign_due", "assign_submitted"])
    i = df.sample(frac=0.004, random_state=4).index
    df.loc[i, "minutes"] = -df.loc[i, "minutes"] - 1
    return df.drop(df.sample(frac=0.03, random_state=5).index).reset_index(drop=True)


def _engagement(reg, lat, rng):
    rows = []
    for s in reg.itertuples():
        L = lat.loc[s.roll_no]
        for j in range(int(rng.poisson(max(0.2, 1.8 + 0.9 * L.career + 0.5 * L.diligence)))):
            t = ACTIVITY_TYPES[int(rng.choice(4, p=[0.4, 0.25, 0.15, 0.2]))]
            rows.append(dict(roll_no=s.roll_no, activity_type=t, title=f"{t.title()} #{j + 1}",
                             date=f"2026-{int(rng.integers(1, 10)):02d}-{int(rng.integers(1, 28)):02d}",
                             verified="Y" if rng.random() < 0.85 else "N"))
    df = pd.DataFrame(rows)
    return pd.concat([df, df.sample(frac=0.02, random_state=6)], ignore_index=True)


def _placement(reg, lat, rng):
    rows = []
    for s in reg.itertuples():
        if s.year < 3:
            continue
        L = lat.loc[s.roll_no]
        rows.append({
            " Roll No": (s.roll_no.lower() + " ") if rng.random() < 0.1 else s.roll_no,
            "Aptitude Score": round(_clip(55 + 12 * L.ability + 8 * L.career + rng.normal(0, 10), 0, 100)),
            "Coding Score": round(_clip(50 + 8 * L.ability + 14 * L.career + rng.normal(0, 12), 0, 100)),
            "Mock Interview (1-5)": int(_clip(round(3 + 0.8 * L.career + rng.normal(0, 0.8)), 1, 5)),
            "Resume Score": round(_clip(60 + 10 * L.career + rng.normal(0, 10), 0, 100)),
        })
    df = pd.DataFrame(rows).astype(object)
    i = df.sample(frac=0.03, random_state=7).index
    df.loc[i, "Coding Score"] = "NA"
    i = df.sample(frac=0.02, random_state=8).index
    df.loc[i, "Aptitude Score"] = df.loc[i, "Aptitude Score"].astype(str) + "%"
    i = df.sample(frac=0.01, random_state=9).index
    df.loc[i, "Resume Score"] = 112
    return df


def _skill_row(roll, cat, skill, v100, rng):
    if rng.random() < 0.5:
        return dict(roll_no=roll, category=cat, skill=skill, score=round(v100 / 10, 1), scale=10)
    return dict(roll_no=roll, category=cat, skill=skill, score=round(v100), scale=100)


def _skills(reg, lat, rng):
    rows = []
    for s in reg.itertuples():
        if rng.random() < 0.08:
            continue
        L = lat.loc[s.roll_no]
        for sk in TECH[s.dept]:
            rows.append(_skill_row(s.roll_no, "technical", sk,
                                   _clip(55 + 10 * L.ability + 10 * L.career + rng.normal(0, 10), 0, 100), rng))
        for sk in ("Communication", "Teamwork"):
            rows.append(_skill_row(s.roll_no, "soft", sk,
                                   _clip(62 + 8 * L.diligence + rng.normal(0, 10), 0, 100), rng))
    return pd.DataFrame(rows)


def _feedback(reg, lat, rng):
    rows = []
    for s in reg.itertuples():
        if rng.random() < 0.2:
            continue
        L = lat.loc[s.roll_no]
        sat = int(_clip(round(3.6 + 0.4 * L.diligence - (0.8 if L.drop_cur else 0) + rng.normal(0, 0.8)), 1, 5))
        fac = int(_clip(round(3.4 + 0.5 * L.diligence + 0.3 * L.ability + rng.normal(0, 0.7)), 1, 5))
        rows.append(dict(roll_no=s.roll_no, satisfaction=f"{sat}/5" if rng.random() < 0.1 else sat,
                         faculty_rating=fac, comment=COMMENTS[int(rng.integers(len(COMMENTS)))]))
    return pd.DataFrame(rows)


def generate_all(out_dir: Path = RAW_DIR) -> dict[str, pd.DataFrame]:
    rng = np.random.default_rng(SEED)
    reg, lat = _make_students(rng)
    frames = {
        "academic": _academic(reg, lat, rng),
        "attendance": _attendance(reg, lat, rng),
        "lms": _lms(reg, lat, rng),
        "engagement": _engagement(reg, lat, rng),
        "placement": _placement(reg, lat, rng),
        "skills": _skills(reg, lat, rng),
        "feedback": _feedback(reg, lat, rng),
    }
    frames["students"] = pd.concat([reg, reg.sample(frac=0.01, random_state=10)], ignore_index=True)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, df in frames.items():
        df.to_csv(out_dir / f"{name}.csv", index=False)
    return frames
```

- [ ] **Step 4: Run the tests**

Run: `cd pipeline && python -m pytest tests/test_generate.py -q`
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add pipeline/campus/generate.py pipeline/tests/test_generate.py
git commit -m "feat(pipeline): deterministic messy 8-source data generator"
```

---

### Task 3: Per-source cleaning with an issue log

**Files:**
- Create: `pipeline/campus/clean.py`
- Test: `pipeline/tests/test_clean.py`

**Interfaces:**
- Consumes: raw DataFrames keyed `students, academic, attendance, lms, engagement, placement, skills, feedback`
- Produces: `clean_all(raw: dict[str, pd.DataFrame]) -> tuple[dict[str, pd.DataFrame], list[dict], list[dict]]` returning `(clean, issues, source_stats)`.
  - Issue dict: `{"source": str, "issue": str, "count": int, "action": str}`.
  - Source stats: `{"name": str, "file": str, "raw_rows": int, "clean_rows": int}`.
  - Cleaned frames all have an upper-case `roll_no` column.
  - `placement` columns: `roll_no, aptitude, coding, mock, resume`.
  - `skills` columns: `roll_no, category, skill, score100`.
  - `lms` gets `roll_no` mapped from email.
  - `academic` gets a boolean `absent` column and numeric marks.
- Also produces: `norm_roll(s: pd.Series) -> pd.Series`.

- [ ] **Step 1: Write the failing tests**

`pipeline/tests/test_clean.py`
```python
import pandas as pd

from campus.clean import clean_all, norm_roll


def _raw():
    students = pd.DataFrame({
        "roll_no": ["24CSE001", "24CSE001", "23IT002"], "name": ["A", "A", "B"],
        "email": ["24cse001@campus.edu", "24cse001@campus.edu", "23it002@campus.edu"],
        "dept": ["CSE", "CSE", "IT"], "year": [2, 2, 3], "section": ["A", "A", "B"],
        "gender": ["F", "F", "M"], "residence": ["Hostel", "Hostel", "Day Scholar"], "mentor_id": ["M01"] * 3,
    })
    academic = pd.DataFrame({"roll_no": ["24CSE001", "23it002 "], "semester": [1, 1],
                             "subject_code": ["CSE101", "IT101"], "internal_marks": [30, 20],
                             "external_marks": ["AB", "40"]})
    attendance = pd.DataFrame({"roll_no": ["24cse001", "24CSE001"], "semester": [3, 3], "week": [1, 2],
                               "subject_code": ["CSE301"] * 2, "held": [3, 3], "attended": [4, 2]})
    lms = pd.DataFrame({"email": ["24CSE001@CAMPUS.EDU", "ghost@campus.edu"], "semester": [3, 3],
                        "week": [1, 1], "logins": [3, 1], "minutes": [-5, 20],
                        "assign_due": [1, 1], "assign_submitted": [1, 0]})
    engagement = pd.DataFrame({"roll_no": ["24CSE001"] * 3, "activity_type": ["club", "club", "event"],
                               "title": ["Club #1", "Club #1", "Event #2"], "date": ["2026-01-01"] * 3,
                               "verified": ["Y", "Y", "N"]})
    placement = pd.DataFrame({" Roll No": ["23it002 "], "Aptitude Score": ["78%"], "Coding Score": ["NA"],
                              "Mock Interview (1-5)": ["3"], "Resume Score": ["112"]})
    skills = pd.DataFrame({"roll_no": ["24CSE001", "24CSE001"], "category": ["technical", "soft"],
                           "skill": ["DSA", "Teamwork"], "score": [7.5, 80], "scale": [10, 100]})
    feedback = pd.DataFrame({"roll_no": ["24CSE001"], "satisfaction": ["4/5"], "faculty_rating": [3],
                             "comment": ["ok"]})
    return dict(students=students, academic=academic, attendance=attendance, lms=lms,
                engagement=engagement, placement=placement, skills=skills, feedback=feedback)


def test_norm_roll():
    assert norm_roll(pd.Series([" 23it002 ", "24Cse001"])).tolist() == ["23IT002", "24CSE001"]


def test_clean_all_resolves_ids_and_values():
    clean, issues, stats = clean_all(_raw())
    assert len(clean["students"]) == 2
    a = clean["academic"].set_index("roll_no")
    assert a.loc["24CSE001", "absent"] and a.loc["24CSE001", "external_marks"] == 0
    assert a.loc["23IT002", "external_marks"] == 40
    att = clean["attendance"]
    assert (att["attended"] <= att["held"]).all() and set(att["roll_no"]) == {"24CSE001"}
    lms = clean["lms"]
    assert lms["roll_no"].tolist() == ["24CSE001"] and pd.isna(lms["minutes"].iloc[0])
    eng = clean["engagement"]
    assert len(eng) == 1 and eng["verified"].eq("Y").all()
    p = clean["placement"].set_index("roll_no").loc["23IT002"]
    assert p["aptitude"] == 78 and pd.isna(p["coding"]) and pd.isna(p["resume"]) and p["mock"] == 3
    assert sorted(clean["skills"]["score100"].tolist()) == [75.0, 80.0]
    assert clean["feedback"]["satisfaction"].iloc[0] == 4
    kinds = {(i["source"], i["issue"]) for i in issues}
    assert ("lms", "Email not in registry") in kinds
    assert ("placement", "Non-numeric value") in kinds
    assert ("placement", "Out-of-range value") in kinds
    assert {s["name"] for s in stats} == set(_raw())
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd pipeline && python -m pytest tests/test_clean.py -q`
Expected: FAIL, `ModuleNotFoundError`

- [ ] **Step 3: Implement**

`pipeline/campus/clean.py`
```python
"""Clean each raw source independently and log every issue found."""
from __future__ import annotations

import re

import numpy as np
import pandas as pd


def norm_roll(s: pd.Series) -> pd.Series:
    return s.astype(str).str.strip().str.upper().str.replace(r"\s+", "", regex=True)


def _issue(issues, source, issue, count, action):
    if int(count):
        issues.append({"source": source, "issue": issue, "count": int(count), "action": action})


def _ids(df, col, source, issues):
    normalised = norm_roll(df[col])
    _issue(issues, source, "Non-standard ID format (case/whitespace)",
           (normalised != df[col].astype(str)).sum(), "Normalised to registry format")
    df = df.copy()
    df["roll_no"] = normalised
    return df


def _dedupe(df, source, keys, issues):
    _issue(issues, source, "Duplicate rows", df.duplicated(subset=keys).sum(), "Dropped duplicates")
    return df.drop_duplicates(subset=keys).reset_index(drop=True)


def _known(df, source, roster, issues):
    ok = df["roll_no"].isin(roster)
    _issue(issues, source, "Unknown student ID", (~ok).sum(), "Excluded (not in registry)")
    return df[ok].reset_index(drop=True)


def _numeric(series, source, issues, lo, hi):
    text = series.astype(str).str.strip().str.rstrip("%")
    num = pd.to_numeric(text, errors="coerce")
    _issue(issues, source, "Non-numeric value", (num.isna() & series.notna()).sum(), "Set to missing")
    bad = (num < lo) | (num > hi)
    _issue(issues, source, "Out-of-range value", bad.sum(), f"Outside {lo}-{hi}; set to missing")
    return num.mask(bad)


def clean_registry(raw, issues):
    df = _ids(raw, "roll_no", "students", issues)
    df["email"] = df["email"].astype(str).str.strip().str.lower()
    return _dedupe(df, "students", ["roll_no"], issues)


def clean_academic(raw, roster, issues):
    df = _dedupe(_ids(raw, "roll_no", "academic", issues), "academic",
                 ["roll_no", "semester", "subject_code"], issues)
    ext = df["external_marks"].astype(str).str.strip()
    df["absent"] = ext.str.upper().eq("AB")
    _issue(issues, "academic", "External marked 'AB' (absent)", df["absent"].sum(), "Scored 0; counted as fail")
    df["external_marks"] = pd.to_numeric(ext.where(~df["absent"], "0"), errors="coerce")
    df["internal_marks"] = pd.to_numeric(df["internal_marks"], errors="coerce")
    df["semester"] = df["semester"].astype(int)
    return _known(df, "academic", roster, issues)


def clean_attendance(raw, roster, issues):
    df = _dedupe(_ids(raw, "roll_no", "attendance", issues), "attendance",
                 ["roll_no", "semester", "week", "subject_code"], issues)
    over = df["attended"] > df["held"]
    _issue(issues, "attendance", "Attended > held", over.sum(), "Capped at classes held")
    df["attended"] = df["attended"].where(~over, df["held"])
    return _known(df, "attendance", roster, issues)


def clean_lms(raw, registry, issues):
    df = raw.copy()
    email = df["email"].astype(str).str.strip().str.lower()
    _issue(issues, "lms", "Non-standard email format (case/whitespace)",
           (email != df["email"].astype(str)).sum(), "Lower-cased and trimmed")
    df["email"] = email
    df["roll_no"] = df["email"].map(dict(zip(registry["email"], registry["roll_no"])))
    _issue(issues, "lms", "Email not in registry", df["roll_no"].isna().sum(), "Excluded")
    df = df[df["roll_no"].notna()].copy()
    neg = df["minutes"] < 0
    _issue(issues, "lms", "Negative session minutes", neg.sum(), "Set to missing")
    df["minutes"] = df["minutes"].mask(neg)
    df = _dedupe(df, "lms", ["roll_no", "semester", "week"], issues)
    years = registry.set_index("roll_no")["year"]
    expected = int(sum(16 + 8 for _ in years))
    _issue(issues, "lms", "Missing weekly records (sync gaps)", max(0, expected - len(df)),
           "Treated as unknown, not zero")
    return df.reset_index(drop=True)


def clean_engagement(raw, roster, issues):
    df = _dedupe(_ids(raw, "roll_no", "engagement", issues), "engagement",
                 ["roll_no", "activity_type", "title", "date"], issues)
    unverified = df["verified"].astype(str).str.upper().ne("Y")
    _issue(issues, "engagement", "Unverified activity", unverified.sum(), "Excluded from scoring")
    return _known(df[~unverified].reset_index(drop=True), "engagement", roster, issues)


PLACEMENT_COLS = {"rollno": "roll_no", "aptitudescore": "aptitude", "codingscore": "coding",
                  "mockinterview15": "mock", "resumescore": "resume"}


def clean_placement(raw, roster, issues):
    df = raw.rename(columns=lambda c: PLACEMENT_COLS.get(re.sub(r"[^a-z0-9]", "", c.lower()), c))
    _issue(issues, "placement", "Inconsistent column headers",
           sum(c not in df.columns for c in raw.columns), "Mapped to standard schema")
    df = _ids(df, "roll_no", "placement", issues)
    for col, hi in (("aptitude", 100), ("coding", 100), ("resume", 100), ("mock", 5)):
        df[col] = _numeric(df[col], "placement", issues, 1 if col == "mock" else 0, hi)
    df = _dedupe(df[["roll_no", "aptitude", "coding", "mock", "resume"]], "placement", ["roll_no"], issues)
    return _known(df, "placement", roster, issues)


def clean_skills(raw, roster, issues):
    df = _ids(raw, "roll_no", "skills", issues)
    _issue(issues, "skills", "Mixed score scales (0-10 and 0-100)", (df["scale"] == 10).sum(),
           "Rescaled to 0-100")
    df["score100"] = pd.to_numeric(df["score"], errors="coerce") * 100.0 / df["scale"]
    df = _dedupe(df[["roll_no", "category", "skill", "score100"]], "skills", ["roll_no", "skill"], issues)
    return _known(df, "skills", roster, issues)


def clean_feedback(raw, roster, issues):
    df = _ids(raw, "roll_no", "feedback", issues)
    sat = df["satisfaction"].astype(str).str.split("/").str[0]
    _issue(issues, "feedback", "Rating stored as text ('4/5')",
           df["satisfaction"].astype(str).str.contains("/").sum(), "Parsed numerator")
    df["satisfaction"] = _numeric(sat, "feedback", issues, 1, 5)
    df["faculty_rating"] = _numeric(df["faculty_rating"], "feedback", issues, 1, 5)
    df = _dedupe(df, "feedback", ["roll_no"], issues)
    return _known(df, "feedback", roster, issues)


def clean_all(raw: dict[str, pd.DataFrame]):
    issues: list[dict] = []
    registry = clean_registry(raw["students"], issues)
    roster = set(registry["roll_no"])
    clean = {
        "students": registry,
        "academic": clean_academic(raw["academic"], roster, issues),
        "attendance": clean_attendance(raw["attendance"], roster, issues),
        "lms": clean_lms(raw["lms"], registry, issues),
        "engagement": clean_engagement(raw["engagement"], roster, issues),
        "placement": clean_placement(raw["placement"], roster, issues),
        "skills": clean_skills(raw["skills"], roster, issues),
        "feedback": clean_feedback(raw["feedback"], roster, issues),
    }
    stats = [{"name": k, "file": f"{k}.csv", "raw_rows": int(len(raw[k])), "clean_rows": int(len(clean[k]))}
             for k in raw]
    return clean, issues, stats
```

Note: `expected` in `clean_lms` assumes 16 + 8 weekly rows per student (previous plus current semester).

- [ ] **Step 4: Run the tests**

Run: `cd pipeline && python -m pytest tests/test_clean.py -q`
Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add pipeline/campus/clean.py pipeline/tests/test_clean.py
git commit -m "feat(pipeline): per-source cleaning with ID resolution and issue log"
```

---

### Task 4: Unified features and pillars

**Files:**
- Create: `pipeline/campus/features.py`, `pipeline/campus/pillars.py`
- Test: `pipeline/tests/test_features.py`

**Interfaces:**
- Consumes: `clean` dict from Task 3.
- Produces:
  - `build_features(clean) -> pd.DataFrame` indexed by `roll_no`, with these columns:
    - `cgpa, backlogs, prior_cgpa, prior_backlogs, prev_failed, prev_internal_pct, internal_pct`
    - `attendance_pct, min_subject_attendance, submit_rate, login_consistency, login_trend, engagement_drop, avg_minutes`
    - `prev_attendance_pct, prev_min_subject_attendance, prev_submit_rate, prev_login_consistency, prev_login_trend, prev_engagement_drop, prev_avg_minutes`
    - `aptitude, coding, mock, resume, tech_skill, soft_skill, events, clubs, hackathons, certifications, satisfaction, faculty_rating`
  - `weekly_series(clean) -> dict[str, list[dict]]`, items shaped `{"week", "logins", "attendance", "submit_rate"}` (current semester).
  - `lead_time_curves(clean, prev_failed: pd.Series) -> list[dict]`, items shaped `{"week", "failed_logins", "passed_logins", "failed_attendance", "passed_attendance"}` over 16 weeks of the previous semester.
  - `compute_pillars(f) -> pd.DataFrame` with columns = `PILLARS`, values 0–100 or NaN.

- [ ] **Step 1: Write the failing test** (integration over generated data, plus a pillar unit test)

`pipeline/tests/test_features.py`
```python
import numpy as np
import pandas as pd
import pytest

from campus.clean import clean_all
from campus.features import build_features, lead_time_curves, weekly_series
from campus.generate import generate_all
from campus.pillars import compute_pillars


@pytest.fixture(scope="module")
def clean(tmp_path_factory):
    raw = generate_all(tmp_path_factory.mktemp("raw"))
    return clean_all(raw)[0]


def test_features_one_row_per_student(clean):
    f = build_features(clean)
    assert len(f) == 600 and f.index.is_unique
    assert f["cgpa"].between(0, 10).all()
    assert f["attendance_pct"].between(0, 100).all()
    assert 0.08 < f["prev_failed"].mean() < 0.45
    assert f["engagement_drop"].mean() < 0.25
    year = clean["students"].set_index("roll_no")["year"]
    assert f.loc[year[year == 2].index, "aptitude"].isna().all()


def test_engagement_drop_precedes_failure(clean):
    f = build_features(clean)
    failed = f["prev_failed"].astype(bool)
    assert f.loc[failed, "prev_engagement_drop"].mean() > 2 * f.loc[~failed, "prev_engagement_drop"].mean()
    curves = lead_time_curves(clean, f["prev_failed"])
    assert len(curves) == 16 and curves[0]["week"] == 1


def test_weekly_series(clean):
    w = weekly_series(clean)
    first = next(iter(w.values()))
    assert len(first) == 8 and set(first[0]) == {"week", "logins", "attendance", "submit_rate"}


def test_pillars_missing_is_nan_not_zero():
    f = pd.DataFrame({
        "cgpa": [8.0], "internal_pct": [70.0], "backlogs": [0], "attendance_pct": [90.0],
        "submit_rate": [0.9], "login_consistency": [1.0], "avg_minutes": [100.0],
        "events": [1], "clubs": [1], "hackathons": [0], "certifications": [1],
        "aptitude": [np.nan], "coding": [np.nan], "mock": [np.nan], "resume": [np.nan],
        "tech_skill": [80.0], "soft_skill": [np.nan], "satisfaction": [np.nan], "faculty_rating": [5.0],
    }, index=["X"])
    p = compute_pillars(f).loc["X"]
    assert p["academic"] == pytest.approx(0.6 * 80 + 0.4 * 70)
    assert np.isnan(p["placement"])
    assert p["skills"] == pytest.approx(80.0)
    assert p["feedback"] == pytest.approx(100.0)
    assert p["engagement"] == pytest.approx(40.0)
    assert p["lms"] == pytest.approx(100 * (0.5 * 0.9 + 0.3 + 0.2))
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd pipeline && python -m pytest tests/test_features.py -q`
Expected: FAIL, `ModuleNotFoundError`

- [ ] **Step 3: Implement**

`pipeline/campus/features.py`
```python
"""Join cleaned sources into one row per student (the unified student view)."""
from __future__ import annotations

import numpy as np
import pandas as pd

from .config import CURRENT_WEEK

GRADE_POINTS = [(90, 10), (80, 9), (70, 8), (60, 7), (50, 6), (45, 5), (40, 4)]


def _sem_of(reg: pd.DataFrame, offset: int) -> pd.Series:
    return 2 * reg.set_index("roll_no")["year"] - 1 - offset   # offset 0 = current, 1 = previous


def _academic(acad, reg):
    a = acad.copy()
    a["cur_sem"] = a["roll_no"].map(_sem_of(reg, 0))
    done = a[a["semester"] < a["cur_sem"]].copy()
    done["total"] = done["internal_marks"].fillna(0) + done["external_marks"].fillna(0)
    done["failed"] = done["total"] < 40
    done["gp"] = np.select([done["total"] >= t for t, _ in GRADE_POINTS], [g for _, g in GRADE_POINTS], 0)
    is_prev = done["semester"] == done["cur_sem"] - 1
    prior, prev = done[~is_prev], done[is_prev]
    cur = a[a["semester"] == a["cur_sem"]]
    return pd.DataFrame({
        "cgpa": done.groupby("roll_no")["gp"].mean(),
        "backlogs": done.groupby("roll_no")["failed"].sum(),
        "prior_cgpa": prior.groupby("roll_no")["gp"].mean(),
        "prior_backlogs": prior.groupby("roll_no")["failed"].sum(),
        "prev_failed": prev.groupby("roll_no")["failed"].any().astype(int),
        "prev_internal_pct": prev.groupby("roll_no")["internal_marks"].mean() / 40 * 100,
        "internal_pct": cur.groupby("roll_no")["internal_marks"].mean() / 40 * 100,
    })


def _window(att, lms, reg, offset):
    sem = _sem_of(reg, offset)
    at = att[(att["semester"] == att["roll_no"].map(sem)) & (att["week"] <= CURRENT_WEEK)]
    lm = lms[(lms["semester"] == lms["roll_no"].map(sem)) & (lms["week"] <= CURRENT_WEEK)]
    ga, gl = at.groupby("roll_no"), lm.groupby("roll_no")
    subj = at.groupby(["roll_no", "subject_code"])[["attended", "held"]].sum()
    early = lm[lm["week"] <= 4].groupby("roll_no")["logins"].mean()
    late = lm[lm["week"] >= 6].groupby("roll_no")["logins"].mean()
    return pd.DataFrame({
        "attendance_pct": ga["attended"].sum() / ga["held"].sum() * 100,
        "min_subject_attendance": (subj["attended"] / subj["held"] * 100).groupby("roll_no").min(),
        "submit_rate": gl["assign_submitted"].sum() / gl["assign_due"].sum(),
        "login_consistency": gl["logins"].apply(lambda s: float((s > 0).mean())),
        "login_trend": (late - early) / (early + 1),
        "engagement_drop": ((early >= 2) & (late < 0.6 * early)).astype(int),
        "avg_minutes": gl["minutes"].mean(),
    })


def build_features(clean: dict[str, pd.DataFrame]) -> pd.DataFrame:
    reg = clean["students"]
    eng = clean["engagement"].groupby(["roll_no", "activity_type"]).size().unstack(fill_value=0)
    eng = eng.reindex(columns=["event", "club", "hackathon", "certification"], fill_value=0)
    eng.columns = ["events", "clubs", "hackathons", "certifications"]
    skills = clean["skills"].groupby(["roll_no", "category"])["score100"].mean().unstack()
    skills = skills.reindex(columns=["technical", "soft"]).rename(columns={"technical": "tech_skill",
                                                                           "soft": "soft_skill"})
    parts = [
        _academic(clean["academic"], reg),
        _window(clean["attendance"], clean["lms"], reg, 0),
        _window(clean["attendance"], clean["lms"], reg, 1).add_prefix("prev_"),
        clean["placement"].set_index("roll_no")[["aptitude", "coding", "mock", "resume"]],
        skills,
        eng,
        clean["feedback"].set_index("roll_no")[["satisfaction", "faculty_rating"]],
    ]
    f = pd.concat(parts, axis=1).reindex(reg["roll_no"])
    f[["events", "clubs", "hackathons", "certifications"]] = (
        f[["events", "clubs", "hackathons", "certifications"]].fillna(0).astype(int))
    f.index.name = "roll_no"
    return f


def weekly_series(clean: dict[str, pd.DataFrame]) -> dict[str, list[dict]]:
    reg = clean["students"]
    sem = _sem_of(reg, 0)
    at = clean["attendance"][clean["attendance"]["semester"] == clean["attendance"]["roll_no"].map(sem)]
    lm = clean["lms"][clean["lms"]["semester"] == clean["lms"]["roll_no"].map(sem)]
    a = at.groupby(["roll_no", "week"])[["attended", "held"]].sum()
    a = (a["attended"] / a["held"] * 100).rename("attendance")
    l = lm.set_index(["roll_no", "week"])
    l = pd.DataFrame({"logins": l["logins"], "submit_rate": l["assign_submitted"] / l["assign_due"]})
    merged = pd.concat([a, l], axis=1).reset_index()
    out: dict[str, list[dict]] = {}
    for roll, g in merged.groupby("roll_no"):
        out[roll] = [{"week": int(r.week),
                      "logins": None if pd.isna(r.logins) else int(r.logins),
                      "attendance": None if pd.isna(r.attendance) else round(float(r.attendance), 1),
                      "submit_rate": None if pd.isna(r.submit_rate) else round(float(r.submit_rate), 2)}
                     for r in g.sort_values("week").itertuples()]
    return out


def lead_time_curves(clean: dict[str, pd.DataFrame], prev_failed: pd.Series) -> list[dict]:
    reg = clean["students"]
    sem = _sem_of(reg, 1)
    at = clean["attendance"][clean["attendance"]["semester"] == clean["attendance"]["roll_no"].map(sem)]
    lm = clean["lms"][clean["lms"]["semester"] == clean["lms"]["roll_no"].map(sem)]
    status = prev_failed.astype(bool).map({True: "failed", False: "passed"})
    at = at.assign(group=at["roll_no"].map(status))
    lm = lm.assign(group=lm["roll_no"].map(status))
    a = at.groupby(["week", "group"])[["attended", "held"]].sum()
    a = (a["attended"] / a["held"] * 100).unstack()
    l = lm.groupby(["week", "group"])["logins"].mean().unstack()
    return [{"week": int(w),
             "failed_logins": round(float(l.loc[w, "failed"]), 2),
             "passed_logins": round(float(l.loc[w, "passed"]), 2),
             "failed_attendance": round(float(a.loc[w, "failed"]), 1),
             "passed_attendance": round(float(a.loc[w, "passed"]), 1)} for w in sorted(l.index)]
```

`pipeline/campus/pillars.py`
```python
"""Seven pillar sub-scores on a 0-100 scale. NaN means 'no data', never zero."""
from __future__ import annotations

import pandas as pd

from .config import PILLARS


def _wmean(parts: list[tuple[pd.Series, float]]) -> pd.Series:
    num = sum(s.fillna(0) * w for s, w in parts)
    den = sum(s.notna() * w for s, w in parts)
    return (num / den).where(den > 0)


def compute_pillars(f: pd.DataFrame) -> pd.DataFrame:
    p = pd.DataFrame(index=f.index)
    p["academic"] = _wmean([(f["cgpa"] * 10, 0.6), (f["internal_pct"], 0.4)]) - 5 * f["backlogs"].fillna(0)
    p["attendance"] = f["attendance_pct"]
    p["lms"] = 100 * _wmean([(f["submit_rate"], 0.5), (f["login_consistency"], 0.3),
                             ((f["avg_minutes"] / 100).clip(upper=1), 0.2)])
    p["placement"] = _wmean([(f["aptitude"], 0.30), (f["coding"], 0.35),
                             (f["mock"] / 5 * 100, 0.20), (f["resume"], 0.15)])
    p["skills"] = _wmean([(f["tech_skill"], 0.6), (f["soft_skill"], 0.4)])
    p["engagement"] = 10 * f["events"] + 15 * f["clubs"] + 20 * f["hackathons"] + 15 * f["certifications"]
    p["feedback"] = _wmean([((f["satisfaction"] - 1) / 4 * 100, 0.5), ((f["faculty_rating"] - 1) / 4 * 100, 0.5)])
    return p[PILLARS].clip(0, 100)
```

- [ ] **Step 4: Run the tests**

Run: `cd pipeline && python -m pytest tests/test_features.py -q`
Expected: `4 passed`. If the `prev_failed` rate falls outside 0.08–0.45, adjust the `66` constant in `generate._academic` and rerun all tests.

- [ ] **Step 5: Commit**

```bash
git add pipeline/campus/features.py pipeline/campus/pillars.py pipeline/tests/test_features.py
git commit -m "feat(pipeline): unified student features, weekly series, pillars"
```

---

### Task 5: Success score, confidence, contributions

**Files:**
- Create: `pipeline/campus/score.py`
- Test: `pipeline/tests/test_score.py`

**Interfaces:**
- Consumes: pillars DataFrame (Task 4).
- Produces: `success_score(pillars, weights=WEIGHTS) -> pd.DataFrame` with columns `score (float, 1dp), band (str), confidence (int 0-100), missing (list[str])`, and `contributions(pillars, weights=WEIGHTS) -> pd.DataFrame` with a points column per pillar (NaN where the pillar is missing).

- [ ] **Step 1: Write the failing test**

`pipeline/tests/test_score.py`
```python
import numpy as np
import pandas as pd
import pytest

from campus.config import PILLARS, WEIGHTS
from campus.score import contributions, success_score


def _p(**over):
    base = {p: 80.0 for p in PILLARS}
    base.update(over)
    return pd.DataFrame([base], index=["S1"])


def test_full_data_score():
    s = success_score(_p()).loc["S1"]
    assert s["score"] == 80.0 and s["band"] == "Thriving" and s["confidence"] == 100 and s["missing"] == []


def test_missing_pillar_renormalises_not_zero():
    s = success_score(_p(placement=np.nan, academic=40.0)).loc["S1"]
    expected = (0.30 * 40 + 0.55 * 80) / 0.85   # placement (0.15) missing
    assert s["score"] == pytest.approx(round(expected, 1))
    assert s["confidence"] == 85 and s["missing"] == ["placement"]


def test_bands():
    for val, band in ((75, "Thriving"), (60, "On Track"), (45, "Needs Attention"), (44.9, "Critical")):
        assert success_score(_p(**{p: float(val) for p in PILLARS})).loc["S1", "band"] == band


def test_contributions_sum_to_score_minus_cohort_mean():
    df = pd.concat([_p(), _p(**{p: 60.0 for p in PILLARS}).rename(index={"S1": "S2"})])
    c = contributions(df)
    s = success_score(df)["score"]
    assert c.sum(axis=1).loc["S1"] == pytest.approx(s["S1"] - 70, abs=0.1)
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd pipeline && python -m pytest tests/test_score.py -q`
Expected: FAIL, `ModuleNotFoundError`

- [ ] **Step 3: Implement**

`pipeline/campus/score.py`
```python
"""Student Success Score: weighted mean of available pillars, renormalised."""
from __future__ import annotations

import pandas as pd

from .config import PILLARS, WEIGHTS, band_for


def _present_weights(pillars: pd.DataFrame, weights: dict) -> pd.DataFrame:
    return pillars[PILLARS].notna() * pd.Series(weights)


def success_score(pillars: pd.DataFrame, weights: dict = WEIGHTS) -> pd.DataFrame:
    w = _present_weights(pillars, weights)
    den = w.sum(axis=1)
    score = ((pillars[PILLARS].fillna(0) * w).sum(axis=1) / den).round(1)
    present = pillars[PILLARS].notna()
    return pd.DataFrame({
        "score": score,
        "band": score.map(band_for),
        "confidence": (den * 100).round().astype(int),
        "missing": present.apply(lambda r: [p for p in PILLARS if not r[p]], axis=1),
    })


def contributions(pillars: pd.DataFrame, weights: dict = WEIGHTS) -> pd.DataFrame:
    """Points each pillar adds/removes versus the cohort mean (sums to score - cohort mean score)."""
    w = _present_weights(pillars, weights)
    share = w.div(w.sum(axis=1), axis=0)
    cohort_mean = success_score(pillars, weights)["score"].mean()
    centred = pillars[PILLARS] - pillars[PILLARS].mean()
    contrib = share * centred
    # distribute the renormalisation residual so rows sum exactly to score - cohort mean
    residual = (success_score(pillars, weights)["score"] - cohort_mean) - contrib.sum(axis=1)
    return contrib.add(share.mul(residual, axis=0)).where(pillars[PILLARS].notna()).round(2)
```

- [ ] **Step 4: Run the tests**

Run: `cd pipeline && python -m pytest tests/test_score.py -q`
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add pipeline/campus/score.py pipeline/tests/test_score.py
git commit -m "feat(pipeline): success score with renormalisation and contributions"
```

---

### Task 6: Academic and placement risk drivers

**Files:**
- Create: `pipeline/campus/risk.py`
- Test: `pipeline/tests/test_risk.py`

**Interfaces:**
- Consumes: one feature row (pd.Series from `build_features`), an ML probability (float), and the placement pillar (float or NaN).
- Produces:
  - `academic_risk(row: pd.Series, prob: float) -> dict`
  - `placement_risk(row: pd.Series, placement_pillar: float) -> dict`
  - Both return `{"level": str, "points": int, "drivers": [{"label": str, "value": str, "points": int}]}`, with drivers sorted by points descending.

- [ ] **Step 1: Write the failing test**

`pipeline/tests/test_risk.py`
```python
import numpy as np
import pandas as pd

from campus.risk import academic_risk, placement_risk

OK = dict(attendance_pct=88.0, backlogs=0, cgpa=8.0, internal_pct=75.0, submit_rate=0.95,
          engagement_drop=0, login_trend=0.0, coding=70.0, aptitude=70.0, mock=4.0,
          hackathons=1, certifications=1, tech_skill=75.0)


def row(**over):
    d = dict(OK); d.update(over)
    return pd.Series(d)


def test_healthy_student_low():
    assert academic_risk(row(), 0.05)["level"] == "Low"
    assert placement_risk(row(), 75.0)["level"] == "Low"


def test_detention_line_is_hard_floor():
    r = academic_risk(row(attendance_pct=60.0), 0.05)
    assert r["level"] == "High" and r["drivers"][0]["label"].startswith("Attendance below detention")


def test_points_accumulate_with_drivers():
    r = academic_risk(row(cgpa=5.5, internal_pct=45.0, engagement_drop=1, login_trend=-0.6), 0.4)
    assert r["level"] == "High" and r["points"] == 2 + 2 + 2 + 1
    assert [d["points"] for d in r["drivers"]] == sorted([d["points"] for d in r["drivers"]], reverse=True)


def test_placement_not_assessed_when_missing():
    r = placement_risk(row(coding=np.nan, aptitude=np.nan, mock=np.nan), np.nan)
    assert r == {"level": "Not assessed", "points": 0, "drivers": []}


def test_backlog_blocks_drives():
    r = placement_risk(row(backlogs=1), 72.0)
    assert any("backlog" in d["label"].lower() for d in r["drivers"]) and r["level"] == "Low"
    assert placement_risk(row(backlogs=1, coding=30.0, aptitude=35.0), 45.0)["level"] == "High"
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd pipeline && python -m pytest tests/test_risk.py -q`
Expected: FAIL, `ModuleNotFoundError`

- [ ] **Step 3: Implement**

`pipeline/campus/risk.py`
```python
"""Transparent, point-based risk flags. Every point is a named, human-readable driver."""
from __future__ import annotations

import pandas as pd

ML_HIGH, ML_ELEVATED = 0.5, 0.35


def _d(label: str, value: str, points: int) -> dict:
    return {"label": label, "value": value, "points": points}


def _result(drivers: list[dict], hard: bool, high: int, medium: int) -> dict:
    pts = sum(d["points"] for d in drivers)
    level = "High" if hard or pts >= high else ("Medium" if pts >= medium else "Low")
    return {"level": level, "points": int(pts), "drivers": sorted(drivers, key=lambda d: -d["points"])}


def academic_risk(r: pd.Series, prob: float) -> dict:
    d, hard = [], False
    att = r["attendance_pct"]
    if att < 65:
        d.append(_d("Attendance below detention line (65%)", f"{att:.0f}%", 4)); hard = True
    elif att < 75:
        d.append(_d("Attendance below 75% mandate", f"{att:.0f}%", 2))
    if r["backlogs"] >= 3:
        d.append(_d("3+ backlogs", f"{int(r['backlogs'])}", 4)); hard = True
    elif r["backlogs"] >= 1:
        d.append(_d("Active backlogs", f"{int(r['backlogs'])}", 2))
    if r["cgpa"] < 6:
        d.append(_d("CGPA below 6.0", f"{r['cgpa']:.2f}", 2))
    if r["internal_pct"] < 50:
        d.append(_d("Internal marks below 50%", f"{r['internal_pct']:.0f}%", 2))
    if r["submit_rate"] < 0.6:
        d.append(_d("Assignment submission below 60%", f"{r['submit_rate'] * 100:.0f}%", 1))
    if r["engagement_drop"] == 1:
        d.append(_d("LMS activity dropped sharply (wk 6-8 vs 1-4)", f"{r['login_trend'] * 100:+.0f}%", 2))
    if prob >= ML_HIGH:
        d.append(_d("Model: high probability of failing a subject", f"{prob * 100:.0f}%", 3))
    elif prob >= ML_ELEVATED:
        d.append(_d("Model: elevated probability of failing a subject", f"{prob * 100:.0f}%", 1))
    return _result(d, hard, high=6, medium=3)


def placement_risk(r: pd.Series, placement_pillar: float) -> dict:
    if pd.isna(placement_pillar):
        return {"level": "Not assessed", "points": 0, "drivers": []}
    d = []
    if placement_pillar < 50:
        d.append(_d("Placement readiness below 50", f"{placement_pillar:.0f}", 3))
    if r["coding"] < 40:
        d.append(_d("Coding score below 40", f"{r['coding']:.0f}", 2))
    if r["aptitude"] < 40:
        d.append(_d("Aptitude score below 40", f"{r['aptitude']:.0f}", 2))
    if r["mock"] <= 2:
        d.append(_d("Weak mock interview (≤2/5)", f"{r['mock']:.0f}/5", 1))
    if r["hackathons"] + r["certifications"] == 0:
        d.append(_d("No verified hackathons or certifications", "0", 1))
    if r["tech_skill"] < 50:
        d.append(_d("Technical skills below 50", f"{r['tech_skill']:.0f}", 1))
    if r["backlogs"] >= 1:
        d.append(_d("Active backlog blocks most campus drives", f"{int(r['backlogs'])}", 2))
    return _result(d, False, high=6, medium=3)
```

- [ ] **Step 4: Run the tests**

Run: `cd pipeline && python -m pytest tests/test_risk.py -q`
Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add pipeline/campus/risk.py pipeline/tests/test_risk.py
git commit -m "feat(pipeline): explainable academic and placement risk flags"
```

---

### Task 7: Back-tested early-warning model and explanations

**Files:**
- Create: `pipeline/campus/model.py`
- Test: `pipeline/tests/test_model.py`

**Interfaces:**
- Consumes: features from `build_features`.
- Produces:
  - `FEATURES: list[tuple[str, str]]` (name, label)
  - `FLAG_T = 0.35`
  - `fit_and_evaluate(f) -> dict` with keys `pipe, metrics, test_index, test_prob, test_y`.
  - `predict_with_explanations(pipe, f) -> tuple[pd.Series, pd.DataFrame]`, giving probabilities and per-feature log-odds contributions for the **current** window.
  - `model_card(pipe, metrics) -> dict`.

The model is trained on the **previous semester, weeks 1–8**, to predict "failed ≥1 subject at end of semester". It is applied to the current semester at week 8. The label comes from exam results (`academic.csv`) and never from the input features.

- [ ] **Step 1: Write the failing test**

`pipeline/tests/test_model.py`
```python
import pytest

from campus.clean import clean_all
from campus.features import build_features
from campus.generate import generate_all
from campus.model import FEATURES, fit_and_evaluate, model_card, predict_with_explanations


@pytest.fixture(scope="module")
def feats(tmp_path_factory):
    return build_features(clean_all(generate_all(tmp_path_factory.mktemp("raw")))[0])


def test_model_beats_cgpa_baseline(feats):
    res = fit_and_evaluate(feats)
    m = res["metrics"]
    assert 0.6 < m["auc"] < 0.99
    assert m["auc"] > m["baseline"]["auc"]
    assert m["n_test"] > 100 and 0 < m["base_rate"] < 1


def test_predictions_and_explanations(feats):
    res = fit_and_evaluate(feats)
    prob, contrib = predict_with_explanations(res["pipe"], feats)
    assert len(prob) == len(feats) and prob.between(0, 1).all()
    assert list(contrib.columns) == [n for n, _ in FEATURES]
    card = model_card(res["pipe"], res["metrics"])
    assert {f["name"] for f in card["features"]} == {n for n, _ in FEATURES}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd pipeline && python -m pytest tests/test_model.py -q`
Expected: FAIL, `ModuleNotFoundError`

- [ ] **Step 3: Implement**

`pipeline/campus/model.py`
```python
"""Early-warning model: last semester's week-1..8 signals -> did the student fail a subject?"""
from __future__ import annotations

import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from .config import SEED

FEATURES = [
    ("prior_cgpa", "Prior CGPA"),
    ("prior_backlogs", "Prior backlogs"),
    ("attendance_pct", "Attendance % (wk 1-8)"),
    ("submit_rate", "Assignment submission rate"),
    ("login_consistency", "LMS login consistency"),
    ("login_trend", "LMS activity trend"),
    ("internal_pct", "Internal marks %"),
]
NAMES = [n for n, _ in FEATURES]
FLAG_T = 0.35


def _train_xy(f: pd.DataFrame):
    X = pd.DataFrame({
        "prior_cgpa": f["prior_cgpa"], "prior_backlogs": f["prior_backlogs"],
        "attendance_pct": f["prev_attendance_pct"], "submit_rate": f["prev_submit_rate"],
        "login_consistency": f["prev_login_consistency"], "login_trend": f["prev_login_trend"],
        "internal_pct": f["prev_internal_pct"],
    })
    keep = X.notna().all(axis=1) & f["prev_failed"].notna()
    return X[keep], f.loc[keep, "prev_failed"].astype(int)


def _current_x(f: pd.DataFrame) -> pd.DataFrame:
    return pd.DataFrame({
        "prior_cgpa": f["cgpa"], "prior_backlogs": f["backlogs"], "attendance_pct": f["attendance_pct"],
        "submit_rate": f["submit_rate"], "login_consistency": f["login_consistency"],
        "login_trend": f["login_trend"], "internal_pct": f["internal_pct"],
    })[NAMES]


def _prf(y, pred) -> dict:
    return {"precision": round(float(precision_score(y, pred, zero_division=0)), 3),
            "recall": round(float(recall_score(y, pred, zero_division=0)), 3),
            "f1": round(float(f1_score(y, pred, zero_division=0)), 3)}


def fit_and_evaluate(f: pd.DataFrame) -> dict:
    X, y = _train_xy(f)
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.3, stratify=y, random_state=SEED)
    pipe = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))
    cv_auc = float(cross_val_score(pipe, Xtr, ytr, cv=5, scoring="roc_auc").mean())
    pipe.fit(Xtr, ytr)
    prob = pipe.predict_proba(Xte)[:, 1]
    metrics = {
        "target": "Failed >= 1 subject at end of semester",
        "train_window": "Previous semester, weeks 1-8 (validated on held-out students)",
        "n_train": int(len(Xtr)), "n_test": int(len(Xte)), "base_rate": round(float(y.mean()), 3),
        "threshold": FLAG_T, "auc": round(float(roc_auc_score(yte, prob)), 3), "cv_auc": round(cv_auc, 3),
        **_prf(yte, prob >= FLAG_T),
        "baseline": {"rule": "Prior CGPA < 6.5",
                     "auc": round(float(roc_auc_score(yte, -Xte["prior_cgpa"])), 3),
                     **_prf(yte, Xte["prior_cgpa"] < 6.5)},
    }
    return {"pipe": pipe, "metrics": metrics, "test_index": Xte.index, "test_prob": prob, "test_y": yte}


def predict_with_explanations(pipe, f: pd.DataFrame):
    scaler, lr = pipe[0], pipe[1]
    X = _current_x(f)
    X = X.fillna(pd.Series(scaler.mean_, index=NAMES))         # missing -> training mean -> 0 effect
    z = (X - scaler.mean_) / scaler.scale_
    contrib = z * lr.coef_[0]
    prob = pd.Series(pipe.predict_proba(X)[:, 1], index=f.index)
    return prob, contrib


def model_card(pipe, metrics: dict) -> dict:
    scaler, lr = pipe[0], pipe[1]
    return {
        "features": [{"name": n, "label": lbl, "coef": round(float(c), 4),
                      "mean": round(float(m), 4), "std": round(float(s), 4)}
                     for (n, lbl), c, m, s in zip(FEATURES, lr.coef_[0], scaler.mean_, scaler.scale_)],
        "intercept": round(float(lr.intercept_[0]), 4),
        "metrics": metrics,
    }
```

- [ ] **Step 4: Run the tests**

Run: `cd pipeline && python -m pytest tests/test_model.py -q`
Expected: `2 passed`. If the AUC is ≥ 0.99 (too easy to be believable), raise the internal-marks noise in `generate._academic` from `10` to `14` and rerun the full suite.

- [ ] **Step 5: Commit**

```bash
git add pipeline/campus/model.py pipeline/tests/test_model.py
git commit -m "feat(pipeline): back-tested early-warning model with per-student explanations"
```

---

### Task 8: Segments, priority, and recommended actions

**Files:**
- Create: `pipeline/campus/segments.py`
- Test: `pipeline/tests/test_segments.py`

**Interfaces:**
- Produces:
  - `SEGMENTS: list[dict]`, each `{"name", "rule", "action"}`, in order
  - `assign_segment(acad_level: str, place_level: str, academic_p: float, placement_p: float, drop: int, score: float) -> str`
  - `priority(acad: dict, place: dict, score: float, drop: int) -> float`
  - `actions_for(acad: dict, place: dict) -> list[str]` (at most 4, deduplicated)

- [ ] **Step 1: Write the failing test**

`pipeline/tests/test_segments.py`
```python
import math

from campus.segments import SEGMENTS, actions_for, assign_segment, priority

R = lambda level, pts=0, labels=(): {"level": level, "points": pts,
                                     "drivers": [{"label": l, "value": "", "points": 1} for l in labels]}


def test_segment_order_and_brief_example():
    assert assign_segment("High", "High", 40, 40, 0, 40) == "Critical: multi-factor risk"
    assert assign_segment("Low", "Medium", 82, 48, 0, 70) == "Academic stars, placement gap"
    assert assign_segment("Medium", "Low", 60, 60, 1, 60) == "Silent disengagers"
    assert assign_segment("High", "Low", 40, 70, 0, 50) == "Academic strugglers"
    assert assign_segment("Low", "Low", 85, 80, 0, 80) == "Placement-ready achievers"
    assert assign_segment("Low", "Not assessed", 70, math.nan, 0, 66) == "Steady middle"
    assert len(SEGMENTS) == 6


def test_priority_orders_risk():
    hi = priority(R("High", 8), R("High", 6), 40, 1)
    lo = priority(R("Low", 0), R("Low", 0), 80, 0)
    assert hi > lo and lo == 0


def test_actions_mapping():
    acts = actions_for(R("High", 5, ["Attendance below 75% mandate", "LMS activity dropped sharply"]),
                       R("Medium", 3, ["Coding score below 40"]))
    assert acts[0].startswith("Attendance counselling") and len(acts) == 3
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd pipeline && python -m pytest tests/test_segments.py -q`
Expected: FAIL, `ModuleNotFoundError`

- [ ] **Step 3: Implement**

`pipeline/campus/segments.py`
```python
"""Actionable segments, triage priority and the intervention playbook."""
from __future__ import annotations

import math

SEGMENTS = [
    {"name": "Critical: multi-factor risk", "rule": "Academic AND placement risk both High",
     "action": "Case conference (mentor + HoD + placement officer) within 48 hours"},
    {"name": "Academic stars, placement gap", "rule": "Academic pillar >= 75 but placement readiness < 55",
     "action": "Fast-track coding bootcamp + 2 mock interviews before drive season"},
    {"name": "Silent disengagers", "rule": "LMS activity dropped sharply; not yet High academic risk",
     "action": "Mentor check-in this week; wellbeing referral if needed"},
    {"name": "Academic strugglers", "rule": "Academic risk High",
     "action": "Remedial classes + peer tutoring + attendance contract"},
    {"name": "Placement-ready achievers", "rule": "Success score >= 75 and placement >= 70",
     "action": "Nominate for premium drives; invite as peer mentors"},
    {"name": "Steady middle", "rule": "No major flags",
     "action": "Monthly nudges and elective skill tracks"},
]

PLAYBOOK = [
    ("Attendance", "Attendance counselling + guardian contact"),
    ("backlogs", "Supplementary-exam prep + remedial classes"),
    ("CGPA", "Academic mentoring plan with fortnightly review"),
    ("Internal marks", "Subject-faculty doubt-clearing sessions"),
    ("Assignment submission", "Assignment recovery plan with LMS reminders"),
    ("LMS activity dropped", "Mentor check-in within 48h (early-warning signal)"),
    ("Coding", "Coding practice track (2 problems/day)"),
    ("Aptitude", "Aptitude training batch"),
    ("mock interview", "Schedule 2 mock interviews"),
    ("hackathons", "Join one hackathon or certification this term"),
    ("Technical skills", "Skill-lab enrolment"),
    ("Placement readiness", "Placement-readiness workshop"),
    ("backlog blocks", "Clear backlog before drive season"),
]


def assign_segment(acad_level, place_level, academic_p, placement_p, drop, score) -> str:
    if acad_level == "High" and place_level == "High":
        return SEGMENTS[0]["name"]
    if academic_p >= 75 and not math.isnan(placement_p) and placement_p < 55:
        return SEGMENTS[1]["name"]
    if drop == 1 and acad_level != "High":
        return SEGMENTS[2]["name"]
    if acad_level == "High":
        return SEGMENTS[3]["name"]
    if score >= 75 and not math.isnan(placement_p) and placement_p >= 70:
        return SEGMENTS[4]["name"]
    return SEGMENTS[5]["name"]


def priority(acad: dict, place: dict, score: float, drop: int) -> float:
    return round(acad["points"] + 0.6 * place["points"] + max(0.0, 60 - score) / 10 + 2 * drop, 1)


def actions_for(acad: dict, place: dict) -> list[str]:
    out: list[str] = []
    for d in acad["drivers"] + place["drivers"]:
        for key, action in PLAYBOOK:
            if key.lower() in d["label"].lower() and action not in out:
                out.append(action)
                break
    return out[:4]
```

Note: `"backlog blocks"` must match before `"backlogs"` for placement drivers. The placement label is "Active backlog blocks most campus drives", which contains "backlog blocks" but not "backlogs", so the order above is already correct.

- [ ] **Step 4: Run the tests**

Run: `cd pipeline && python -m pytest tests/test_segments.py -q`
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add pipeline/campus/segments.py pipeline/tests/test_segments.py
git commit -m "feat(pipeline): segments, triage priority and intervention playbook"
```

---

### Task 9: Insights and fairness audit

**Files:**
- Create: `pipeline/campus/insights.py`
- Test: `pipeline/tests/test_insights.py`

**Interfaces:**
- Produces:
  - `fairness_table(registry, test_index, test_y, test_prob, threshold) -> list[dict]`, each `{"group_type", "group", "n", "flag_rate", "recall", "fpr"}`
  - `build_insights(f, pillars, scores, table: pd.DataFrame) -> list[dict]`, each `{"id", "title", "detail", "severity"}`, where `table` has columns `academic_level, placement_level, segment, dept, residence, year`.

- [ ] **Step 1: Write the failing test**

`pipeline/tests/test_insights.py`
```python
import numpy as np
import pandas as pd

from campus.insights import fairness_table


def test_fairness_table_groups():
    reg = pd.DataFrame({"roll_no": list("ABCD"), "gender": ["F", "M", "F", "M"],
                        "residence": ["Hostel", "Hostel", "Day Scholar", "Day Scholar"]})
    rows = fairness_table(reg, pd.Index(list("ABCD")), pd.Series([1, 0, 1, 0], index=list("ABCD")),
                          np.array([0.9, 0.1, 0.2, 0.6]), 0.35)
    by = {(r["group_type"], r["group"]): r for r in rows}
    assert by[("residence", "Hostel")]["recall"] == 1.0
    assert by[("residence", "Day Scholar")]["recall"] == 0.0
    assert by[("residence", "Day Scholar")]["fpr"] == 1.0
    assert len(rows) == 4
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd pipeline && python -m pytest tests/test_insights.py -q`
Expected: FAIL, `ModuleNotFoundError`

- [ ] **Step 3: Implement**

`pipeline/campus/insights.py`
```python
"""Cross-source insights (only possible after integration) and the fairness audit."""
from __future__ import annotations

import numpy as np
import pandas as pd


def _rate(s: pd.Series):
    return None if len(s) == 0 else round(float(s.mean()), 3)


def fairness_table(registry, test_index, test_y, test_prob, threshold) -> list[dict]:
    df = pd.DataFrame({"y": np.asarray(test_y), "pred": np.asarray(test_prob) >= threshold}, index=test_index)
    df = df.join(registry.set_index("roll_no")[["gender", "residence"]])
    rows = []
    for gt in ("residence", "gender"):
        for g, d in df.groupby(gt):
            rows.append({"group_type": gt, "group": str(g), "n": int(len(d)),
                         "flag_rate": _rate(d["pred"]), "recall": _rate(d.loc[d["y"] == 1, "pred"]),
                         "fpr": _rate(d.loc[d["y"] == 0, "pred"])})
    return rows


def build_insights(f, pillars, scores, table) -> list[dict]:
    out = []
    failed = f["prev_failed"].astype(bool)
    r_fail, r_pass = f.loc[failed, "prev_engagement_drop"].mean(), f.loc[~failed, "prev_engagement_drop"].mean()
    out.append({"id": "lead-time", "severity": "critical",
                "title": f"LMS drop is an early warning: {r_fail / max(r_pass, 1e-6):.1f}x more common before failure",
                "detail": f"{r_fail:.0%} of students who failed a subject last semester showed a sharp LMS drop by "
                          f"week 8, versus {r_pass:.0%} of those who passed. The drop shows up weeks before "
                          f"attendance falls and months before results."})
    senior = table["year"] >= 3
    stars = table["segment"].eq("Academic stars, placement gap")
    out.append({"id": "stars-gap", "severity": "warning",
                "title": f"{int(stars.sum())} high-academic students are not placement-ready",
                "detail": f"{stars[senior].mean():.0%} of 3rd/4th-years have academic pillar >= 75 but placement "
                          f"readiness < 55. Marks alone would never flag them."})
    hi = table.assign(h=table["academic_level"].eq("High")).groupby("dept")["h"].mean().sort_values()
    out.append({"id": "dept-risk", "severity": "warning",
                "title": f"{hi.index[-1]} has the highest academic-risk rate ({hi.iloc[-1]:.0%})",
                "detail": f"Lowest is {hi.index[0]} ({hi.iloc[0]:.0%}). Prioritise remedial capacity accordingly."})
    day = table["residence"].eq("Day Scholar")
    att_gap = f.loc[~day.values, "attendance_pct"].mean() - f.loc[day.values, "attendance_pct"].mean()
    sub_gap = f.loc[~day.values, "submit_rate"].mean() - f.loc[day.values, "submit_rate"].mean()
    out.append({"id": "commute", "severity": "info",
                "title": f"Day scholars attend {att_gap:.1f} pp less but submit work at the same rate",
                "detail": f"Submission gap is only {sub_gap * 100:.1f} pp: low attendance here signals commute "
                          f"constraints, not disengagement. Consider timetable or transport support."})
    corr = pillars["lms"].corr(f["internal_pct"])
    out.append({"id": "lms-marks", "severity": "info",
                "title": f"LMS learning tracks internal marks (r = {corr:.2f})",
                "detail": "Weekly LMS consistency is available 6-8 weeks before internal assessments, "
                          "making it the earliest lever for faculty."})
    drop = f["engagement_drop"].astype(bool)
    if f["satisfaction"].notna().any():
        out.append({"id": "wellbeing", "severity": "warning",
                    "title": "Disengaging students also report lower satisfaction",
                    "detail": f"Mean satisfaction {f.loc[drop, 'satisfaction'].mean():.1f}/5 for students with an "
                              f"LMS drop vs {f.loc[~drop, 'satisfaction'].mean():.1f}/5 for others. "
                              f"Pair academic support with a wellbeing check-in."})
    return out
```

- [ ] **Step 4: Run the tests**

Run: `cd pipeline && python -m pytest tests/test_insights.py -q`
Expected: `1 passed`

- [ ] **Step 5: Commit**

```bash
git add pipeline/campus/insights.py pipeline/tests/test_insights.py
git commit -m "feat(pipeline): cross-source insights and fairness audit"
```

---

### Task 10: Export the JSON contract and the pipeline CLI

**Files:**
- Create: `pipeline/campus/export.py`, `pipeline/run_pipeline.py`
- Test: `pipeline/tests/test_export.py`

**Interfaces:**
- Produces: `run(raw_dir: Path, out_dir: Path, regenerate: bool) -> dict` (summary). It writes `students.json, cohort.json, quality.json, model.json, insights.json`. **These shapes are the contract for Task 11 `types.ts`:**

```
students.json: Student[]
  roll_no,name,dept,year,section,gender,residence,mentor_id: str|int
  pillars: {academic..feedback: number|null}
  score: number; band: str; confidence: int; missing: str[]
  contributions: {pillar: str, points: number}[]           (present pillars only, sorted by |points| desc)
  academic_risk, placement_risk: {level, points, drivers:[{label,value,points}]}
  ml: {prob: number, factors: [{feature, label, effect}]}  (top 3 by |effect|)
  segment: str; engagement_drop: boolean; priority: number; actions: str[]
  metrics: {cgpa, backlogs, attendance_pct, min_subject_attendance, internal_pct, submit_rate,
            login_consistency, aptitude, coding, mock, resume, tech_skill, soft_skill,
            events, clubs, hackathons, certifications, satisfaction, faculty_rating: number|null}
  weekly: {week, logins, attendance, submit_rate}[]
cohort.json: {generated_at, current_week, n_students, weights, bands:[{min,name}], pillar_labels,
              pillar_means, dept_pillars:[{dept, ...pillars}], weekly_trend:[{week, dept, logins, attendance}],
              lead_time:[...], segments:[{name, rule, action, count}], mentors:[{mentor_id, caseload, high_risk}]}
quality.json: {sources:[{name,file,raw_rows,clean_rows,students_covered_pct}], issues:[...],
               coverage:[{pillar,label,covered_pct}]}
model.json: {features, intercept, metrics, fairness}
insights.json: Insight[]
```

- [ ] **Step 1: Write the failing test**

`pipeline/tests/test_export.py`
```python
import json

from campus.config import PILLARS
from run_pipeline import run


def test_end_to_end(tmp_path):
    summary = run(tmp_path / "raw", tmp_path / "out", regenerate=True)
    assert summary["n_students"] == 600
    students = json.loads((tmp_path / "out" / "students.json").read_text())
    s = students[0]
    assert set(s["pillars"]) == set(PILLARS)
    assert s["academic_risk"]["level"] in {"High", "Medium", "Low"}
    assert s["placement_risk"]["level"] in {"High", "Medium", "Low", "Not assessed"}
    assert len(s["weekly"]) == 8 and len(s["ml"]["factors"]) == 3
    y2 = [x for x in students if x["year"] == 2]
    assert all(x["pillars"]["placement"] is None and x["placement_risk"]["level"] == "Not assessed" for x in y2)
    text = (tmp_path / "out" / "students.json").read_text()
    assert "NaN" not in text
    for name in ("cohort", "quality", "model", "insights"):
        assert json.loads((tmp_path / "out" / f"{name}.json").read_text())
    assert students == sorted(students, key=lambda x: -x["priority"])
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd pipeline && python -m pytest tests/test_export.py -q`
Expected: FAIL, `ModuleNotFoundError: No module named 'run_pipeline'`

- [ ] **Step 3: Implement**

`pipeline/campus/export.py`
```python
"""Write the JSON contract consumed by the web app."""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np


def clean_json(obj):
    if isinstance(obj, dict):
        return {str(k): clean_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [clean_json(v) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating, float)):
        return None if math.isnan(float(obj)) else round(float(obj), 3)
    if isinstance(obj, np.bool_):
        return bool(obj)
    return obj


def write_json(out_dir: Path, name: str, obj) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / f"{name}.json").write_text(json.dumps(clean_json(obj), ensure_ascii=False, allow_nan=False),
                                          encoding="utf-8")
```

`pipeline/run_pipeline.py`
```python
"""CampusCompass pipeline: raw CSVs -> clean -> unify -> score -> model -> risk -> segments -> JSON."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from campus.clean import clean_all
from campus.config import (BANDS, CURRENT_WEEK, OUT_DIR, PILLAR_LABELS, PILLARS, RAW_DIR, WEIGHTS)
from campus.export import write_json
from campus.features import build_features, lead_time_curves, weekly_series
from campus.generate import generate_all
from campus.insights import build_insights, fairness_table
from campus.model import FEATURES, FLAG_T, fit_and_evaluate, model_card, predict_with_explanations
from campus.pillars import compute_pillars
from campus.risk import academic_risk, placement_risk
from campus.score import contributions, success_score
from campus.segments import SEGMENTS, actions_for, assign_segment, priority

FILES = ["students", "academic", "attendance", "lms", "engagement", "placement", "skills", "feedback"]
METRIC_COLS = ["cgpa", "backlogs", "attendance_pct", "min_subject_attendance", "internal_pct", "submit_rate",
               "login_consistency", "aptitude", "coding", "mock", "resume", "tech_skill", "soft_skill",
               "events", "clubs", "hackathons", "certifications", "satisfaction", "faculty_rating"]
LABEL = dict(FEATURES)


def _load(raw_dir: Path) -> dict[str, pd.DataFrame]:
    # keep literal "NA" strings so the cleaner can log them; only empty cells are missing
    return {n: pd.read_csv(raw_dir / f"{n}.csv", dtype={"external_marks": str},
                           keep_default_na=False, na_values=[""]) for n in FILES}


def run(raw_dir: Path = RAW_DIR, out_dir: Path = OUT_DIR, regenerate: bool = False) -> dict:
    raw_dir, out_dir = Path(raw_dir), Path(out_dir)
    if regenerate or not (raw_dir / "students.csv").exists():
        generate_all(raw_dir)
    raw = _load(raw_dir)
    clean, issues, stats = clean_all(raw)
    reg = clean["students"].set_index("roll_no")
    f = build_features(clean)
    pillars = compute_pillars(f)
    scores = success_score(pillars)
    contrib = contributions(pillars)
    res = fit_and_evaluate(f)
    prob, ml_contrib = predict_with_explanations(res["pipe"], f)
    weekly = weekly_series(clean)

    students, rows = [], []
    for roll in f.index:
        r, p, sc = f.loc[roll], pillars.loc[roll], scores.loc[roll]
        acad = academic_risk(r, float(prob[roll]))
        place = placement_risk(r, p["placement"])
        seg = assign_segment(acad["level"], place["level"], p["academic"], p["placement"],
                             int(r["engagement_drop"]), sc["score"])
        top = ml_contrib.loc[roll].abs().sort_values(ascending=False).index[:3]
        c = contrib.loc[roll].dropna()
        students.append({
            **{k: reg.loc[roll, k] for k in ("name", "dept", "year", "section", "gender", "residence", "mentor_id")},
            "roll_no": roll,
            "pillars": {k: p[k] for k in PILLARS},
            "score": sc["score"], "band": sc["band"], "confidence": int(sc["confidence"]), "missing": sc["missing"],
            "contributions": [{"pillar": k, "points": c[k]} for k in c.abs().sort_values(ascending=False).index],
            "academic_risk": acad, "placement_risk": place,
            "ml": {"prob": float(prob[roll]),
                   "factors": [{"feature": n, "label": LABEL[n], "effect": float(ml_contrib.loc[roll, n])}
                               for n in top]},
            "segment": seg, "engagement_drop": bool(r["engagement_drop"]),
            "priority": priority(acad, place, sc["score"], int(r["engagement_drop"])),
            "actions": actions_for(acad, place),
            "metrics": {k: r[k] for k in METRIC_COLS},
            "weekly": weekly.get(roll, []),
        })
        rows.append({"roll_no": roll, "academic_level": acad["level"], "placement_level": place["level"],
                     "segment": seg, "dept": reg.loc[roll, "dept"], "residence": reg.loc[roll, "residence"],
                     "year": int(reg.loc[roll, "year"]), "mentor_id": reg.loc[roll, "mentor_id"]})
    students.sort(key=lambda s: -s["priority"])
    table = pd.DataFrame(rows).set_index("roll_no").loc[f.index]

    cur_sem = 2 * reg["year"] - 1
    lms_cur = clean["lms"][clean["lms"]["semester"] == clean["lms"]["roll_no"].map(cur_sem)]
    att_cur = clean["attendance"][clean["attendance"]["semester"] == clean["attendance"]["roll_no"].map(cur_sem)]
    lw = lms_cur.assign(dept=lms_cur["roll_no"].map(reg["dept"])).groupby(["dept", "week"])["logins"].mean()
    aw = att_cur.assign(dept=att_cur["roll_no"].map(reg["dept"])).groupby(["dept", "week"])[["attended", "held"]].sum()
    aw = aw["attended"] / aw["held"] * 100
    mentors = table.assign(h=table["academic_level"].eq("High")).groupby("mentor_id").agg(
        caseload=("h", "size"), high_risk=("h", "sum")).reset_index()

    cohort = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "current_week": CURRENT_WEEK, "n_students": int(len(f)), "weights": WEIGHTS,
        "bands": [{"min": m, "name": n} for m, n in BANDS], "pillar_labels": PILLAR_LABELS,
        "pillar_means": pillars.mean().round(1).to_dict(),
        "dept_pillars": [{"dept": d, **g.mean().round(1).to_dict()}
                         for d, g in pillars.groupby(reg.loc[pillars.index, "dept"].values)],
        "weekly_trend": [{"week": int(w), "dept": d, "logins": round(float(lw[(d, w)]), 2),
                          "attendance": round(float(aw[(d, w)]), 1)} for d, w in lw.index],
        "lead_time": lead_time_curves(clean, f["prev_failed"]),
        "segments": [{**s, "count": int((table["segment"] == s["name"]).sum())} for s in SEGMENTS],
        "mentors": mentors.to_dict(orient="records"),
    }
    covered = {k: (clean[k]["roll_no"].nunique() / len(reg) * 100) for k in FILES}
    quality = {
        "sources": [{**s, "students_covered_pct": round(covered[s["name"]], 1)} for s in stats],
        "issues": issues,
        "coverage": [{"pillar": k, "label": PILLAR_LABELS[k], "covered_pct": round(float(pillars[k].notna().mean() * 100), 1)}
                     for k in PILLARS],
    }
    model = {**model_card(res["pipe"], res["metrics"]),
             "fairness": fairness_table(clean["students"], res["test_index"], res["test_y"], res["test_prob"], FLAG_T)}
    insights = build_insights(f, pillars, scores, table)

    for name, obj in (("students", students), ("cohort", cohort), ("quality", quality),
                      ("model", model), ("insights", insights)):
        write_json(out_dir, name, obj)
    return {"n_students": len(students), "issues": len(issues), "auc": res["metrics"]["auc"],
            "baseline_auc": res["metrics"]["baseline"]["auc"]}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--regenerate", action="store_true", help="regenerate raw CSVs from seed")
    print(run(regenerate=ap.parse_args().regenerate))
```

- [ ] **Step 4: Run the full suite and the real pipeline**

Run: `cd pipeline && python -m pytest -q && python run_pipeline.py --regenerate`
Expected: all tests pass. The CLI prints something like `{'n_students': 600, 'issues': ~20, 'auc': 0.8x, 'baseline_auc': 0.7x}`, and `web/public/data/` contains 5 JSON files.

- [ ] **Step 5: Commit**

```bash
git add pipeline data/raw web/public/data
git commit -m "feat(pipeline): end-to-end run and JSON contract export"
```

> **Milestone A:** the data side is complete. The frontend team can work from `web/public/data/*.json` from here on.

---

### Task 11: Web scaffold, types, data provider, layout

**Files:**
- Create: `web/` (Vite react-ts), `web/tailwind.config.js`, `web/postcss.config.js`, `web/src/index.css`, `web/vercel.json`
- Create: `web/src/lib/types.ts`, `web/src/lib/score.ts`, `web/src/lib/data.tsx`, `web/src/lib/format.ts`, `web/src/components/Layout.tsx`, `web/src/components/ui.tsx`, `web/src/App.tsx`, `web/src/main.tsx`

**Interfaces:**
- Consumes: the JSON contract (Task 10).
- Produces:
  - `useData(): { students: ScoredStudent[]; cohort; quality; model; insights; weights; setWeights; resetWeights; weightsAreDefault: boolean }`
  - `ScoredStudent = Student & { liveScore: number; liveBand: string }`
  - UI primitives `Card, Kpi, LevelBadge, BandBadge, Empty`
  - `PILLARS`, `recomputeScore(pillars, weights) -> number | null`, `bandFor(score, bands) -> string`

- [ ] **Step 1: Scaffold and install pinned deps**

```bash
cd A:/WebDev/HacXalerate
npm create vite@5.5.2 web -- --template react-ts
cd web
npm install react@18.3.1 react-dom@18.3.1 react-router-dom@6.26.2 recharts@2.12.7
npm install -D tailwindcss@3.4.13 postcss@8.4.47 autoprefixer@10.4.20 vitest@2.1.2
npx tailwindcss init -p
```

- [ ] **Step 2: Write config and base files**

`web/tailwind.config.js`
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: { colors: { brand: { 50: "#eef4ff", 500: "#1e49e2", 700: "#00338d" } } } },
  plugins: [],
};
```

`web/src/index.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
body { @apply bg-slate-50 text-slate-800 antialiased; }
```

`web/vercel.json`
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

`web/src/lib/types.ts`
```ts
export const PILLARS = ["academic", "attendance", "lms", "placement", "skills", "engagement", "feedback"] as const;
export type Pillar = (typeof PILLARS)[number];
export type Level = "High" | "Medium" | "Low" | "Not assessed";
export type Weights = Record<Pillar, number>;
export interface Driver { label: string; value: string; points: number }
export interface Risk { level: Level; points: number; drivers: Driver[] }
export interface WeekPoint { week: number; logins: number | null; attendance: number | null; submit_rate: number | null }
export interface Student {
  roll_no: string; name: string; dept: string; year: number; section: string; gender: string;
  residence: string; mentor_id: string;
  pillars: Record<Pillar, number | null>;
  score: number; band: string; confidence: number; missing: Pillar[];
  contributions: { pillar: Pillar; points: number }[];
  academic_risk: Risk; placement_risk: Risk;
  ml: { prob: number; factors: { feature: string; label: string; effect: number }[] };
  segment: string; engagement_drop: boolean; priority: number; actions: string[];
  metrics: Record<string, number | null>;
  weekly: WeekPoint[];
}
export interface ScoredStudent extends Student { liveScore: number; liveBand: string }
export interface Cohort {
  generated_at: string; current_week: number; n_students: number; weights: Weights;
  bands: { min: number; name: string }[]; pillar_labels: Record<Pillar, string>;
  pillar_means: Record<Pillar, number>;
  dept_pillars: ({ dept: string } & Record<Pillar, number>)[];
  weekly_trend: { week: number; dept: string; logins: number; attendance: number }[];
  lead_time: { week: number; failed_logins: number; passed_logins: number; failed_attendance: number; passed_attendance: number }[];
  segments: { name: string; rule: string; action: string; count: number }[];
  mentors: { mentor_id: string; caseload: number; high_risk: number }[];
}
export interface Quality {
  sources: { name: string; file: string; raw_rows: number; clean_rows: number; students_covered_pct: number }[];
  issues: { source: string; issue: string; count: number; action: string }[];
  coverage: { pillar: Pillar; label: string; covered_pct: number }[];
}
export interface PRF { precision: number; recall: number; f1: number }
export interface ModelCard {
  features: { name: string; label: string; coef: number; mean: number; std: number }[];
  intercept: number;
  metrics: PRF & { target: string; train_window: string; n_train: number; n_test: number; base_rate: number;
    threshold: number; auc: number; cv_auc: number; baseline: PRF & { rule: string; auc: number } };
  fairness: { group_type: string; group: string; n: number; flag_rate: number | null; recall: number | null; fpr: number | null }[];
}
export interface Insight { id: string; title: string; detail: string; severity: "info" | "warning" | "critical" }
```

`web/src/lib/score.ts`
```ts
import { PILLARS, type Pillar, type Weights } from "./types";

export function normaliseWeights(w: Weights, fallback: Weights): { weights: Weights; usedFallback: boolean } {
  const total = PILLARS.reduce((s, p) => s + Math.max(0, w[p] || 0), 0);
  if (total <= 0) return { weights: fallback, usedFallback: true };
  return { weights: Object.fromEntries(PILLARS.map((p) => [p, Math.max(0, w[p] || 0) / total])) as Weights, usedFallback: false };
}

export function recomputeScore(pillars: Record<Pillar, number | null>, w: Weights): number | null {
  let num = 0, den = 0;
  for (const p of PILLARS) {
    const v = pillars[p];
    if (v === null || v === undefined || !w[p]) continue;
    num += w[p] * v; den += w[p];
  }
  return den === 0 ? null : Math.round((num / den) * 10) / 10;
}

export function bandFor(score: number, bands: { min: number; name: string }[]): string {
  for (const b of bands) if (score >= b.min) return b.name;
  return bands[bands.length - 1].name;
}
```

`web/src/lib/format.ts`
```ts
import type { Level } from "./types";
export const LEVEL_STYLE: Record<Level, string> = {
  High: "bg-red-100 text-red-800 ring-red-200", Medium: "bg-amber-100 text-amber-800 ring-amber-200",
  Low: "bg-emerald-100 text-emerald-800 ring-emerald-200", "Not assessed": "bg-slate-100 text-slate-600 ring-slate-200",
};
export const BAND_COLOR: Record<string, string> = {
  Thriving: "#059669", "On Track": "#2563eb", "Needs Attention": "#d97706", Critical: "#dc2626",
};
export const SEGMENT_COLOR: Record<string, string> = {
  "Critical: multi-factor risk": "#dc2626", "Academic stars, placement gap": "#7c3aed",
  "Silent disengagers": "#d97706", "Academic strugglers": "#ea580c",
  "Placement-ready achievers": "#059669", "Steady middle": "#64748b",
};
export const fmt = (v: number | null | undefined, d = 0, suffix = "") =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : `${v.toFixed(d)}${suffix}`;
export function heat(v: number | null): string {
  if (v === null) return "#f1f5f9";
  const t = Math.max(0, Math.min(1, (v - 30) / 60));
  return `hsl(${Math.round(t * 140)}, 70%, ${92 - t * 22}%)`;
}
```

`web/src/lib/data.tsx`
```tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Cohort, Insight, ModelCard, Quality, ScoredStudent, Student, Weights } from "./types";
import { bandFor, normaliseWeights, recomputeScore } from "./score";

interface Raw { students: Student[]; cohort: Cohort; quality: Quality; model: ModelCard; insights: Insight[] }
interface Ctx extends Omit<Raw, "students"> {
  students: ScoredStudent[]; weights: Weights; setWeights: (w: Weights) => void; resetWeights: () => void;
  weightsAreDefault: boolean; usedFallback: boolean;
}
const DataCtx = createContext<Ctx | null>(null);

async function load<T>(name: string): Promise<T> {
  const r = await fetch(`/data/${name}.json`);
  if (!r.ok) throw new Error(`Failed to load ${name}.json (${r.status})`);
  return r.json();
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw] = useState<Raw | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weights, setWeights] = useState<Weights | null>(null);

  useEffect(() => {
    Promise.all([load<Student[]>("students"), load<Cohort>("cohort"), load<Quality>("quality"),
      load<ModelCard>("model"), load<Insight[]>("insights")])
      .then(([students, cohort, quality, model, insights]) => {
        setRaw({ students, cohort, quality, model, insights });
        setWeights(cohort.weights);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const value = useMemo<Ctx | null>(() => {
    if (!raw || !weights) return null;
    const { weights: w, usedFallback } = normaliseWeights(weights, raw.cohort.weights);
    const isDefault = Object.entries(raw.cohort.weights).every(([k, v]) => Math.abs(w[k as keyof Weights] - v) < 1e-6);
    const students = raw.students.map((s) => {
      const liveScore = isDefault ? s.score : recomputeScore(s.pillars, w) ?? s.score;
      return { ...s, liveScore, liveBand: bandFor(liveScore, raw.cohort.bands) };
    });
    return { ...raw, students, weights, setWeights, resetWeights: () => setWeights(raw.cohort.weights),
      weightsAreDefault: isDefault, usedFallback };
  }, [raw, weights]);

  if (error) return <div className="p-8 text-red-700">Could not load data: {error}</div>;
  if (!value) return <div className="p-8 text-slate-500">Loading campus data…</div>;
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}

export function useData(): Ctx {
  const v = useContext(DataCtx);
  if (!v) throw new Error("useData outside DataProvider");
  return v;
}
```

`web/src/components/ui.tsx`
```tsx
import type { ReactNode } from "react";
import type { Level } from "../lib/types";
import { BAND_COLOR, LEVEL_STYLE } from "../lib/format";

export const Card = ({ title, subtitle, children, className = "" }:
  { title?: string; subtitle?: string; children: ReactNode; className?: string }) => (
  <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
    {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
    {subtitle && <p className="mb-3 text-xs text-slate-500">{subtitle}</p>}
    {children}
  </section>
);
export const Kpi = ({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
    <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
    {hint && <div className="text-xs text-slate-500">{hint}</div>}
  </div>
);
export const LevelBadge = ({ level, prefix }: { level: Level; prefix?: string }) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${LEVEL_STYLE[level]}`}>
    {prefix ? `${prefix}: ` : ""}{level === "Not assessed" ? "Not yet assessed" : level}
  </span>
);
export const BandBadge = ({ band }: { band: string }) => (
  <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ background: BAND_COLOR[band] ?? "#64748b" }}>{band}</span>
);
export const Empty = ({ children }: { children: ReactNode }) => (
  <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{children}</div>
);
```

`web/src/components/Layout.tsx`
```tsx
import { NavLink, Outlet } from "react-router-dom";
import { useData } from "../lib/data";

const NAV = [
  ["/", "Overview"], ["/queue", "Action Queue"], ["/segments", "Segments"],
  ["/data", "Data Studio"], ["/method", "Method & Trust"], ["/demo", "Guided demo"],
] as const;

export default function Layout() {
  const { cohort, weightsAreDefault } = useData();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <div className="font-bold text-brand-700">CampusCompass <span className="font-normal text-slate-500">· Student Success Intelligence</span></div>
          <nav className="flex flex-wrap gap-1 text-sm">
            {NAV.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === "/"}
                className={({ isActive }) => `rounded-md px-3 py-1.5 ${isActive ? "bg-brand-50 text-brand-700 font-medium" : "text-slate-600 hover:bg-slate-100"}`}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto text-xs text-slate-500">
            Semester week {cohort.current_week} · {cohort.n_students} students
            {!weightsAreDefault && <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-amber-800">Custom weights active</span>}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6"><Outlet /></main>
    </div>
  );
}
```

`web/src/App.tsx` (the routes are added here now, and the pages are created in Tasks 12–17. Create each page file as a stub `export default function X(){return <div/>}` now, so the app compiles.)
```tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { DataProvider } from "./lib/data";
import Overview from "./pages/Overview";
import Queue from "./pages/Queue";
import StudentPage from "./pages/Student";
import Segments from "./pages/Segments";
import DataStudio from "./pages/DataStudio";
import Methodology from "./pages/Methodology";
import Demo from "./pages/Demo";

export default function App() {
  return (
    <DataProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Overview />} />
            <Route path="queue" element={<Queue />} />
            <Route path="student/:roll" element={<StudentPage />} />
            <Route path="segments" element={<Segments />} />
            <Route path="data" element={<DataStudio />} />
            <Route path="method" element={<Methodology />} />
            <Route path="demo" element={<Demo />} />
            <Route path="*" element={<Overview />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </DataProvider>
  );
}
```

`web/src/main.tsx`
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
```

Delete `web/src/App.css` and `web/src/assets/`. In `web/index.html`, set `<title>CampusCompass</title>`.

- [ ] **Step 3: Build check**

Run: `cd web && npm run build`
Expected: build succeeds, with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add web
git commit -m "feat(web): scaffold, typed data contract, provider, layout"
```

---

### Task 12: Overview page (admin)

**Files:**
- Modify: `web/src/pages/Overview.tsx`

**Interfaces:** consumes `useData()`.

- [ ] **Step 1: Implement**

`web/src/pages/Overview.tsx`
```tsx
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { Card, Kpi } from "../components/ui";
import { useData } from "../lib/data";
import { BAND_COLOR, SEGMENT_COLOR, heat } from "../lib/format";
import { PILLARS } from "../lib/types";

export default function Overview() {
  const { students, cohort, insights } = useData();
  const nav = useNavigate();
  const [dept, setDept] = useState("All");
  const list = useMemo(() => students.filter((s) => dept === "All" || s.dept === dept), [students, dept]);
  const depts = ["All", ...Array.from(new Set(students.map((s) => s.dept)))];

  const n = list.length || 1;
  const avg = list.reduce((a, s) => a + s.liveScore, 0) / n;
  const acadHigh = list.filter((s) => s.academic_risk.level === "High").length;
  const placeHigh = list.filter((s) => s.placement_risk.level === "High").length;
  const early = list.filter((s) => s.engagement_drop).length;

  const dist = cohort.bands.slice().reverse().map((b, i, arr) => {
    const hi = i + 1 < arr.length ? arr[i + 1].min : 101;
    return { band: b.name, count: list.filter((s) => s.liveScore >= b.min && s.liveScore < hi).length };
  });
  const trend = Array.from(new Set(cohort.weekly_trend.map((t) => t.week))).map((week) => {
    const rows = cohort.weekly_trend.filter((t) => t.week === week && (dept === "All" || t.dept === dept));
    const m = (k: "logins" | "attendance") => rows.reduce((a, r) => a + r[k], 0) / (rows.length || 1);
    return { week, logins: +m("logins").toFixed(2), attendance: +m("attendance").toFixed(1) };
  });
  const scatter = list.filter((s) => s.pillars.placement !== null).map((s) => ({
    x: s.pillars.academic, y: s.pillars.placement, roll: s.roll_no, name: s.name, segment: s.segment }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Campus overview</h1>
          <p className="text-sm text-slate-500">7 integrated data sources · updated weekly · click any student to drill down</p>
        </div>
        <label className="text-sm">Department{" "}
          <select className="ml-1 rounded border-slate-300" value={dept} onChange={(e) => setDept(e.target.value)}>
            {depts.map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Students" value={list.length} />
        <Kpi label="Avg success score" value={avg.toFixed(1)} />
        <Kpi label="High academic risk" value={acadHigh} hint={`${((acadHigh / n) * 100).toFixed(0)}% of cohort`} />
        <Kpi label="High placement risk" value={placeHigh} hint="3rd & 4th years" />
        <Kpi label="Early-warning (LMS drop)" value={early} hint="not visible in marks yet" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {insights.slice(0, 3).map((i) => (
          <Card key={i.id} className={i.severity === "critical" ? "border-red-200" : i.severity === "warning" ? "border-amber-200" : ""}>
            <div className="text-xs font-semibold uppercase text-slate-500">Insight</div>
            <div className="mt-1 font-semibold">{i.title}</div>
            <p className="mt-1 text-sm text-slate-600">{i.detail}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Success score distribution" subtitle="Bands: Thriving ≥75 · On Track ≥60 · Needs Attention ≥45 · Critical">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dist}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="band" /><YAxis allowDecimals={false} /><Tooltip />
              <Bar dataKey="count">{dist.map((d) => <Cell key={d.band} fill={BAND_COLOR[d.band]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Academic vs placement readiness" subtitle="Each dot is a 3rd/4th-year student, coloured by segment. Click a dot to open the profile.">
          <ResponsiveContainer width="100%" height={240}>
            <ScatterChart margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" dataKey="x" name="Academic" domain={[0, 100]} />
              <YAxis type="number" dataKey="y" name="Placement" domain={[0, 100]} /><ZAxis range={[25, 25]} />
              <Tooltip content={({ payload }) => payload?.[0] ? (
                <div className="rounded border bg-white p-2 text-xs shadow">{payload[0].payload.name}<br />{payload[0].payload.segment}</div>) : null} />
              <Scatter data={scatter} onClick={(d: { payload?: { roll: string }; roll?: string }) => nav(`/student/${d.payload?.roll ?? d.roll}`)}>
                {scatter.map((d) => <Cell key={d.roll} fill={SEGMENT_COLOR[d.segment] ?? "#64748b"} cursor="pointer" />)}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Weekly engagement trend (current semester)" subtitle="LMS logins/week and attendance %">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="week" />
              <YAxis yAxisId="l" /><YAxis yAxisId="r" orientation="right" domain={[50, 100]} /><Tooltip /><Legend />
              <Line yAxisId="l" dataKey="logins" stroke="#1e49e2" name="LMS logins" />
              <Line yAxisId="r" dataKey="attendance" stroke="#059669" name="Attendance %" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Department × pillar heatmap" subtitle="Average pillar score (0–100)">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr><th className="p-1 text-left">Dept</th>{PILLARS.map((p) => <th key={p} className="p-1">{cohort.pillar_labels[p].split(" ")[0]}</th>)}</tr></thead>
              <tbody>{cohort.dept_pillars.map((d) => (
                <tr key={d.dept}><td className="p-1 font-medium">{d.dept}</td>
                  {PILLARS.map((p) => <td key={p} className="p-1 text-center" style={{ background: heat(d[p]) }}>{d[p]?.toFixed(0) ?? "—"}</td>)}
                </tr>))}
              </tbody>
            </table>
          </div>
          <Link to="/queue" className="mt-3 inline-block text-sm font-medium text-brand-500">Open the Action Queue →</Link>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `cd web && npm run dev`. Open `http://localhost:5173/`.
Expected: KPIs, 3 insight cards, 4 charts. Changing the department changes the numbers. Clicking a scatter dot opens `/student/<roll>` (a blank stub for now).

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Overview.tsx
git commit -m "feat(web): overview dashboard with filters, distribution, quadrant, trend, heatmap"
```

---

### Task 13: Action Queue (faculty triage)

**Files:**
- Create: `web/src/lib/csv.ts`
- Modify: `web/src/pages/Queue.tsx`

- [ ] **Step 1: Implement**

`web/src/lib/csv.ts`
```ts
export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
  a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}
```

`web/src/pages/Queue.tsx`
```tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BandBadge, Card, Empty, LevelBadge } from "../components/ui";
import { downloadCsv } from "../lib/csv";
import { useData } from "../lib/data";

const KEY = "cc-contacted";
const readContacted = (): Record<string, boolean> => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };

export default function Queue() {
  const { students, cohort } = useData();
  const [f, setF] = useState({ q: "", dept: "All", year: "All", mentor: "All", risk: "Any", segment: "All", hideContacted: false });
  const [contacted, setContacted] = useState<Record<string, boolean>>(readContacted);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(contacted)); } catch { /* storage unavailable */ } }, [contacted]);

  const opts = (k: "dept" | "year" | "mentor_id" | "segment") => ["All", ...Array.from(new Set(students.map((s) => String(s[k])))).sort()];
  const rows = useMemo(() => students.filter((s) =>
    (f.dept === "All" || s.dept === f.dept) && (f.year === "All" || String(s.year) === f.year) &&
    (f.mentor === "All" || s.mentor_id === f.mentor) && (f.segment === "All" || s.segment === f.segment) &&
    (f.risk === "Any" || (f.risk === "Academic High" && s.academic_risk.level === "High") ||
      (f.risk === "Placement High" && s.placement_risk.level === "High") || (f.risk === "Early warning" && s.engagement_drop)) &&
    (!f.hideContacted || !contacted[s.roll_no]) &&
    (f.q === "" || `${s.name} ${s.roll_no}`.toLowerCase().includes(f.q.toLowerCase()))
  ), [students, f, contacted]);

  const sel = (key: keyof typeof f, values: string[], label: string) => (
    <label className="text-xs text-slate-500">{label}
      <select className="mt-1 block w-full rounded border-slate-300 text-sm" value={String(f[key])}
        onChange={(e) => setF({ ...f, [key]: e.target.value })}>{values.map((v) => <option key={v}>{v}</option>)}</select>
    </label>);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Action Queue</h1>
        <p className="text-sm text-slate-500">Students ranked by triage priority: who to contact this week, why, and what to do. Mentor caseload ≈ {Math.round(cohort.n_students / cohort.mentors.length)} students.</p>
      </div>
      <Card>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-7">
          <label className="col-span-2 text-xs text-slate-500">Search
            <input className="mt-1 block w-full rounded border-slate-300 text-sm" placeholder="Name or roll no"
              value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></label>
          {sel("dept", opts("dept"), "Department")}{sel("year", opts("year"), "Year")}{sel("mentor", opts("mentor_id"), "Mentor")}
          {sel("risk", ["Any", "Academic High", "Placement High", "Early warning"], "Risk")}{sel("segment", opts("segment"), "Segment")}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <label><input type="checkbox" checked={f.hideContacted} onChange={(e) => setF({ ...f, hideContacted: e.target.checked })} /> Hide contacted</label>
          <span className="text-slate-500">{rows.length} students</span>
          <button className="ml-auto rounded-md bg-brand-500 px-3 py-1.5 text-white disabled:opacity-40" disabled={rows.length === 0}
            onClick={() => downloadCsv("action-queue.csv", rows.map((s) => ({ roll_no: s.roll_no, name: s.name, dept: s.dept, year: s.year,
              mentor: s.mentor_id, score: s.liveScore, academic_risk: s.academic_risk.level, placement_risk: s.placement_risk.level,
              segment: s.segment, top_reason: s.academic_risk.drivers[0]?.label ?? s.placement_risk.drivers[0]?.label ?? "", actions: s.actions.join("; ") })))}>
            Export CSV</button>
        </div>
      </Card>
      {rows.length === 0 ? <Empty>No students match these filters. Try clearing a filter.</Empty> : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr><th className="p-3">#</th><th className="p-3">Student</th><th className="p-3">Score</th><th className="p-3">Risk</th>
                <th className="p-3">Why</th><th className="p-3">Suggested action</th><th className="p-3">Contacted</th></tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((s, i) => (
                <tr key={s.roll_no} className={`border-t ${contacted[s.roll_no] ? "opacity-50" : ""}`}>
                  <td className="p-3 text-slate-400">{i + 1}</td>
                  <td className="p-3"><Link className="font-medium text-brand-700 hover:underline" to={`/student/${s.roll_no}`}>{s.name}</Link>
                    <div className="text-xs text-slate-500">{s.roll_no} · {s.dept} · Y{s.year} · {s.mentor_id}</div></td>
                  <td className="p-3"><div className="font-semibold">{s.liveScore.toFixed(1)}</div><BandBadge band={s.liveBand} /></td>
                  <td className="space-y-1 p-3"><LevelBadge level={s.academic_risk.level} prefix="Acad" /><br /><LevelBadge level={s.placement_risk.level} prefix="Place" />
                    {s.engagement_drop && <div><span className="rounded bg-amber-50 px-1.5 text-xs text-amber-700">⚠ LMS drop</span></div>}</td>
                  <td className="p-3 text-xs">{[...s.academic_risk.drivers, ...s.placement_risk.drivers].slice(0, 2).map((d) => <div key={d.label}>• {d.label} ({d.value})</div>)}</td>
                  <td className="p-3 text-xs">{s.actions[0] ?? "Routine monthly check-in"}</td>
                  <td className="p-3"><input type="checkbox" checked={!!contacted[s.roll_no]} aria-label={`Mark ${s.name} contacted`}
                    onChange={(e) => setContacted({ ...contacted, [s.roll_no]: e.target.checked })} /></td>
                </tr>))}
            </tbody>
          </table>
          {rows.length > 200 && <p className="p-3 text-xs text-slate-500">Showing top 200 by priority. Narrow the filters or export the CSV for all {rows.length}.</p>}
        </div>)}
    </div>
  );
}
```

- [ ] **Step 2: Verify manually, including the Review Focus #5 empty state**

Run `npm run dev` and open `/queue`.
Expected:
- Students are sorted by priority, with reasons and actions shown.
- Searching `zzzz` shows the empty-state message.
- Export CSV downloads a file.
- Ticking "contacted" persists across a page reload.

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/csv.ts web/src/pages/Queue.tsx
git commit -m "feat(web): action queue with triage filters, reasons, CSV export, contact tracking"
```

---

### Task 14: Student 360 profile

**Files:**
- Modify: `web/src/pages/Student.tsx`

- [ ] **Step 1: Implement**

`web/src/pages/Student.tsx`
```tsx
import { Fragment } from "react";
import { Link, useParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis,
  Radar, RadarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BandBadge, Card, Empty, LevelBadge } from "../components/ui";
import { useData } from "../lib/data";
import { fmt } from "../lib/format";
import { PILLARS, type Risk } from "../lib/types";

const RiskCard = ({ title, risk }: { title: string; risk: Risk }) => (
  <Card title={title}>
    <LevelBadge level={risk.level} />
    {risk.level === "Not assessed" ? <p className="mt-2 text-sm text-slate-500">No placement assessments yet (typical for 2nd-years). The score is re-weighted without this pillar.</p>
      : risk.drivers.length === 0 ? <p className="mt-2 text-sm text-slate-500">No risk drivers triggered.</p>
      : <ul className="mt-2 space-y-1 text-sm">{risk.drivers.map((d) => (
          <li key={d.label} className="flex justify-between gap-2"><span>{d.label} <span className="text-slate-500">({d.value})</span></span>
            <span className="shrink-0 font-mono text-xs text-red-700">+{d.points}</span></li>))}</ul>}
  </Card>
);

export default function StudentPage() {
  const { roll } = useParams();
  const { students, cohort } = useData();
  const s = students.find((x) => x.roll_no === roll);
  if (!s) return <Empty>Student “{roll}” not found. <Link className="text-brand-500" to="/queue">Back to the queue</Link></Empty>;

  const radar = PILLARS.map((p) => ({ pillar: cohort.pillar_labels[p].split(" ")[0], student: s.pillars[p] ?? 0, cohort: cohort.pillar_means[p] }));
  const water = s.contributions.map((c) => ({ name: cohort.pillar_labels[c.pillar], points: c.points }));
  const m = s.metrics;

  return (
    <div className="space-y-4">
      <Link to="/queue" className="text-sm text-brand-500">← Action Queue</Link>
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">{s.name}</h1>
          <p className="text-sm text-slate-500">{s.roll_no} · {s.dept} · Year {s.year} · Section {s.section} · {s.residence} · Mentor {s.mentor_id}</p>
        </div>
        <div className="ml-auto text-right">
          <div className="text-4xl font-bold">{s.liveScore.toFixed(1)}</div>
          <BandBadge band={s.liveBand} />
          <div className="mt-1 text-xs text-slate-500">Data confidence {s.confidence}%{s.missing.length > 0 && ` · missing: ${s.missing.join(", ")}`}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm">Segment: <b>{s.segment}</b></span>
        {s.engagement_drop && <span className="rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-800">⚠ Early warning: LMS activity dropped sharply in weeks 6–8</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Why this score?" subtitle="Points each pillar adds or removes vs the cohort average" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={water} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" /><YAxis type="category" dataKey="name" width={150} />
              <ReferenceLine x={0} stroke="#475569" /><Tooltip formatter={(v) => `${Number(v) > 0 ? "+" : ""}${Number(v).toFixed(1)} pts`} />
              <Bar dataKey="points">{water.map((w) => <Cell key={w.name} fill={w.points >= 0 ? "#059669" : "#dc2626"} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Pillar profile" subtitle="Student vs cohort average">
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radar}><PolarGrid /><PolarAngleAxis dataKey="pillar" tick={{ fontSize: 10 }} /><PolarRadiusAxis domain={[0, 100]} tick={false} />
              <Radar dataKey="cohort" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.2} name="Cohort" />
              <Radar dataKey="student" stroke="#1e49e2" fill="#1e49e2" fillOpacity={0.35} name="Student" /><Legend />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <RiskCard title="Academic risk" risk={s.academic_risk} />
        <RiskCard title="Placement risk" risk={s.placement_risk} />
        <Card title="Recommended actions">
          {s.actions.length === 0 ? <p className="text-sm text-slate-500">Routine monthly check-in.</p>
            : <ol className="list-decimal space-y-1 pl-5 text-sm">{s.actions.map((a) => <li key={a}>{a}</li>)}</ol>}
          <div className="mt-4 border-t pt-3 text-xs text-slate-500">
            Early-warning model: <b>{(s.ml.prob * 100).toFixed(0)}%</b> estimated chance of failing a subject this semester. Main factors:
            <ul className="mt-1">{s.ml.factors.map((f) => <li key={f.feature}>{f.effect > 0 ? "▲ raises" : "▼ lowers"} risk: {f.label}</li>)}</ul>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Weekly timeline (current semester)" subtitle="LMS activity usually drops before attendance, and attendance before marks">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={s.weekly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="week" />
              <YAxis yAxisId="l" /><YAxis yAxisId="r" orientation="right" domain={[0, 100]} /><Tooltip /><Legend />
              <Line yAxisId="l" dataKey="logins" stroke="#1e49e2" name="LMS logins" connectNulls />
              <Line yAxisId="r" dataKey="attendance" stroke="#059669" name="Attendance %" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Unified record: all 7 sources">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {([
              ["Academic", `CGPA ${fmt(m.cgpa, 2)} · backlogs ${fmt(m.backlogs)} · internals ${fmt(m.internal_pct, 0, "%")}`],
              ["Attendance", `${fmt(m.attendance_pct, 1, "%")} overall · lowest subject ${fmt(m.min_subject_attendance, 0, "%")}`],
              ["LMS", `submission ${fmt((m.submit_rate ?? NaN) * 100, 0, "%")} · active weeks ${fmt((m.login_consistency ?? NaN) * 100, 0, "%")}`],
              ["Engagement", `${m.events} events · ${m.clubs} clubs · ${m.hackathons} hackathons · ${m.certifications} certs`],
              ["Placement", m.aptitude === null && m.coding === null ? "Not yet assessed" : `aptitude ${fmt(m.aptitude)} · coding ${fmt(m.coding)} · mock ${fmt(m.mock)}/5 · resume ${fmt(m.resume)}`],
              ["Skills", `technical ${fmt(m.tech_skill)} · soft ${fmt(m.soft_skill)}`],
              ["Feedback", m.satisfaction === null && m.faculty_rating === null ? "No survey response" : `satisfaction ${fmt(m.satisfaction)}/5 · faculty ${fmt(m.faculty_rating)}/5`],
            ] as const).map(([k, v]) => (<Fragment key={k}><dt className="font-medium text-slate-600">{k}</dt><dd className="text-slate-800">{v}</dd></Fragment>))}
          </dl>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify manually**

- Open the top student in the queue: the waterfall, radar, both risk cards, actions, timeline and 7-source record all render.
- Open any year-2 student (filter Year = 2 in the queue): placement shows "Not yet assessed", and confidence is 85%.
- Open `/student/NOPE`: the not-found message appears.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Student.tsx
git commit -m "feat(web): Student 360 with explainable waterfall, risk drivers, timeline, unified record"
```

---

### Task 15: Segments and Data Studio pages

**Files:**
- Modify: `web/src/pages/Segments.tsx`, `web/src/pages/DataStudio.tsx`

- [ ] **Step 1: Implement Segments**

`web/src/pages/Segments.tsx`
```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, Empty, LevelBadge } from "../components/ui";
import { useData } from "../lib/data";
import { SEGMENT_COLOR } from "../lib/format";
import { PILLARS } from "../lib/types";

export default function Segments() {
  const { students, cohort } = useData();
  const [active, setActive] = useState(cohort.segments[1]?.name ?? cohort.segments[0].name);
  const members = students.filter((s) => s.segment === active);
  const avg = (p: (typeof PILLARS)[number]) => {
    const v = members.map((s) => s.pillars[p]).filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Student segments</h1>
      <p className="text-sm text-slate-500">Rule-based, ordered segments, each with a targeted intervention programme. Click a segment.</p>
      <div className="grid gap-3 md:grid-cols-3">
        {cohort.segments.map((g) => (
          <button key={g.name} onClick={() => setActive(g.name)}
            className={`rounded-xl border bg-white p-4 text-left shadow-sm ${active === g.name ? "ring-2 ring-brand-500" : ""}`}>
            <div className="flex items-center justify-between"><span className="font-semibold" style={{ color: SEGMENT_COLOR[g.name] }}>{g.name}</span>
              <span className="text-2xl font-bold">{g.count}</span></div>
            <p className="mt-1 text-xs text-slate-500">{g.rule}</p>
            <p className="mt-2 text-sm"><b>Programme:</b> {g.action}</p>
          </button>))}
      </div>
      <Card title={`${active}: average pillar profile`}>
        <div className="grid grid-cols-7 gap-2 text-center text-xs">
          {PILLARS.map((p) => { const v = avg(p); const c = cohort.pillar_means[p];
            return (<div key={p} className="rounded-lg bg-slate-50 p-2"><div className="text-slate-500">{cohort.pillar_labels[p].split(" ")[0]}</div>
              <div className="text-lg font-bold">{v === null ? "—" : v.toFixed(0)}</div>
              {v !== null && <div className={v >= c ? "text-emerald-600" : "text-red-600"}>{v >= c ? "+" : ""}{(v - c).toFixed(0)} vs avg</div>}</div>); })}
        </div>
      </Card>
      {members.length === 0 ? <Empty>No students in this segment.</Empty> : (
        <Card title={`Members (${members.length})`}>
          <ul className="divide-y text-sm">{members.slice(0, 50).map((s) => (
            <li key={s.roll_no} className="flex flex-wrap items-center gap-3 py-2">
              <Link to={`/student/${s.roll_no}`} className="font-medium text-brand-700 hover:underline">{s.name}</Link>
              <span className="text-xs text-slate-500">{s.dept} · Y{s.year}</span>
              <span className="ml-auto font-semibold">{s.liveScore.toFixed(1)}</span>
              <LevelBadge level={s.academic_risk.level} prefix="Acad" /><LevelBadge level={s.placement_risk.level} prefix="Place" />
            </li>))}</ul>
        </Card>)}
    </div>
  );
}
```

- [ ] **Step 2: Implement Data Studio** (this is the 30% Data Integration criterion, so it must look serious)

`web/src/pages/DataStudio.tsx`
```tsx
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, Kpi } from "../components/ui";
import { useData } from "../lib/data";

const ID_KEY: Record<string, string> = {
  students: "roll_no (master registry)", academic: "roll_no", attendance: "roll_no (mixed case)",
  lms: "email → resolved to roll_no", engagement: "roll_no", placement: "' Roll No' (messy header, spaces)",
  skills: "roll_no", feedback: "roll_no",
};

export default function DataStudio() {
  const { quality, cohort } = useData();
  const totalIssues = quality.issues.reduce((a, i) => a + i.count, 0);
  const rawRows = quality.sources.reduce((a, s) => a + s.raw_rows, 0);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Data Studio: integration & quality</h1>
        <p className="text-sm text-slate-500">8 disconnected exports (ERP, biometric attendance, LMS, clubs, placement cell, skill tests, surveys) are cleaned, ID-resolved and joined into one student view. Pipeline: <code>pipeline/run_pipeline.py</code>.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Source files" value={quality.sources.length} />
        <Kpi label="Raw rows ingested" value={rawRows.toLocaleString()} />
        <Kpi label="Data issues fixed" value={totalIssues.toLocaleString()} hint={`${quality.issues.length} issue types`} />
        <Kpi label="Unified students" value={cohort.n_students} />
      </div>
      <Card title="Sources" subtitle="Each system uses its own identifier. All are resolved to the registry roll number.">
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="p-2">Source</th><th className="p-2">Identifier</th><th className="p-2 text-right">Raw rows</th><th className="p-2 text-right">Clean rows</th><th className="p-2 text-right">Students covered</th></tr></thead>
          <tbody>{quality.sources.map((s) => (
            <tr key={s.name} className="border-t"><td className="p-2 font-medium">{s.file}</td><td className="p-2 text-xs text-slate-600">{ID_KEY[s.name]}</td>
              <td className="p-2 text-right">{s.raw_rows.toLocaleString()}</td><td className="p-2 text-right">{s.clean_rows.toLocaleString()}</td>
              <td className="p-2 text-right">{s.students_covered_pct}%</td></tr>))}</tbody>
        </table></div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Cleaning log" subtitle="Every issue found and the action taken">
          <div className="max-h-96 overflow-y-auto"><table className="w-full text-sm">
            <thead className="sticky top-0 bg-white text-left text-xs uppercase text-slate-500"><tr><th className="p-2">Source</th><th className="p-2">Issue</th><th className="p-2 text-right">Rows</th><th className="p-2">Action</th></tr></thead>
            <tbody>{quality.issues.map((i, k) => (
              <tr key={k} className="border-t"><td className="p-2">{i.source}</td><td className="p-2">{i.issue}</td><td className="p-2 text-right">{i.count.toLocaleString()}</td><td className="p-2 text-xs text-slate-600">{i.action}</td></tr>))}</tbody>
          </table></div>
        </Card>
        <Card title="Pillar coverage" subtitle="Share of students with data for each pillar. Missing pillars are re-weighted, never scored as zero.">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={quality.coverage} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" domain={[0, 100]} unit="%" />
              <YAxis type="category" dataKey="label" width={150} /><Tooltip /><Legend />
              <Bar dataKey="covered_pct" name="Coverage %" fill="#1e49e2" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify manually**

- `/segments`: 6 cards with counts that sum to 600. Clicking a card changes the profile and the member list.
- `/data`: 8 sources, about 20 issue rows, and placement coverage around 66%.

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/Segments.tsx web/src/pages/DataStudio.tsx
git commit -m "feat(web): segments explorer and data integration studio"
```

---

### Task 16: Method & Trust page with live weight sliders and the parity test

**Files:**
- Create: `web/src/lib/score.test.ts`
- Modify: `web/src/pages/Methodology.tsx`, `web/package.json` (add a `"test": "vitest run"` script)

- [ ] **Step 1: Write the failing test** (covers Review Focus #4, plus Python ↔ TS parity)

`web/src/lib/score.test.ts`
```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bandFor, normaliseWeights, recomputeScore } from "./score";
import type { Student, Weights } from "./types";

const students: Student[] = JSON.parse(readFileSync("public/data/students.json", "utf-8"));
const cohort = JSON.parse(readFileSync("public/data/cohort.json", "utf-8"));
const W: Weights = cohort.weights;

describe("score parity with Python pipeline", () => {
  it("recomputes every exported score within 0.11", () => {
    for (const s of students) expect(Math.abs((recomputeScore(s.pillars, W) ?? -1) - s.score)).toBeLessThan(0.11);
  });
  it("ignores missing pillars instead of scoring zero", () => {
    const y2 = students.find((s) => s.year === 2)!;
    expect(y2.pillars.placement).toBeNull();
    expect(recomputeScore(y2.pillars, W)).toBeCloseTo(y2.score, 0);
  });
});

describe("weights edge cases", () => {
  it("falls back to default when all weights are zero", () => {
    const zero = Object.fromEntries(Object.keys(W).map((k) => [k, 0])) as Weights;
    const r = normaliseWeights(zero, W);
    expect(r.usedFallback).toBe(true);
    expect(r.weights).toEqual(W);
  });
  it("single non-zero weight equals that pillar", () => {
    const only = Object.fromEntries(Object.keys(W).map((k) => [k, k === "attendance" ? 5 : 0])) as Weights;
    const s = students[0];
    expect(recomputeScore(s.pillars, normaliseWeights(only, W).weights)).toBeCloseTo(s.pillars.attendance!, 1);
  });
  it("bands", () => {
    expect(bandFor(75, cohort.bands)).toBe("Thriving");
    expect(bandFor(44.9, cohort.bands)).toBe("Critical");
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `cd web && npx vitest run`
Expected: PASS, because `score.ts` already exists from Task 11. If parity fails, fix `score.ts` to match the Python formula. Do not loosen the tolerance.

- [ ] **Step 3: Implement the Methodology page**

`web/src/pages/Methodology.tsx`
```tsx
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, Kpi } from "../components/ui";
import { useData } from "../lib/data";
import { PILLARS } from "../lib/types";

const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(0)}%`);

export default function Methodology() {
  const { cohort, model, weights, setWeights, resetWeights, weightsAreDefault, usedFallback, students } = useData();
  const m = model.metrics;
  const total = PILLARS.reduce((a, p) => a + weights[p], 0);
  const coefs = model.features.map((f) => ({ name: f.label, coef: f.coef })).sort((a, b) => Math.abs(b.coef) - Math.abs(a.coef));
  const moved = students.filter((s) => s.liveBand !== s.band).length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Methodology & Trust</h1>

      <Card title="Student Success Score" subtitle="Weighted mean of 7 pillar scores (0–100). Missing pillars are excluded and the remaining weights re-normalised; 'confidence' shows how much weight had data.">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            {PILLARS.map((p) => (
              <label key={p} className="block text-sm">
                <div className="flex justify-between"><span>{cohort.pillar_labels[p]}</span>
                  <span className="font-mono">{total > 0 ? ((weights[p] / total) * 100).toFixed(0) : 0}%</span></div>
                <input type="range" min={0} max={0.5} step={0.01} value={weights[p]} className="w-full"
                  onChange={(e) => setWeights({ ...weights, [p]: Number(e.target.value) })} aria-label={`${cohort.pillar_labels[p]} weight`} />
              </label>))}
            <div className="flex items-center gap-3">
              <button onClick={resetWeights} disabled={weightsAreDefault} className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40">Reset to default</button>
              {usedFallback && <span className="text-sm text-amber-700">All weights are zero, so the default weights are used.</span>}
              {!weightsAreDefault && !usedFallback && <span className="text-sm text-slate-600">{moved} students changed band. Every page now uses these weights.</span>}
            </div>
          </div>
          <div className="space-y-2 text-sm text-slate-700">
            <p><b>Pillar formulas</b></p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Academic = 0.6 × CGPA×10 + 0.4 × internal % − 5 × backlogs</li>
              <li>Attendance = overall % this semester</li>
              <li>LMS = 0.5 × submission rate + 0.3 × share of active weeks + 0.2 × time-on-platform</li>
              <li>Placement = 0.30 aptitude + 0.35 coding + 0.20 mock interview + 0.15 resume</li>
              <li>Skills = 0.6 technical + 0.4 soft (all rescaled to 0–100)</li>
              <li>Engagement = 10/event + 15/club + 20/hackathon + 15/certification (verified only, cap 100)</li>
              <li>Feedback = mean of student satisfaction and faculty rating (1–5 → 0–100)</li>
            </ul>
            <p className="text-xs text-slate-500">We measure LMS consistency as active weeks, not raw minutes, so students with limited connectivity aren't penalised for short sessions.</p>
          </div>
        </div>
      </Card>

      <Card title="Early-warning model: back-test" subtitle={`${m.target}. Trained on ${m.train_window}. Held-out test set of ${m.n_test} students; base rate ${pct(m.base_rate)}.`}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="AUC (model)" value={m.auc.toFixed(2)} hint={`5-fold CV ${m.cv_auc.toFixed(2)}`} />
          <Kpi label="AUC (CGPA-only baseline)" value={m.baseline.auc.toFixed(2)} hint={m.baseline.rule} />
          <Kpi label="Recall @ flag" value={pct(m.recall)} hint={`baseline ${pct(m.baseline.recall)}`} />
          <Kpi label="Precision @ flag" value={pct(m.precision)} hint={`baseline ${pct(m.baseline.precision)}`} />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div><p className="mb-1 text-sm font-medium">Lead time: last semester, students who failed vs passed</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={cohort.lead_time}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="week" /><YAxis /><Tooltip /><Legend />
                <Line dataKey="failed_logins" stroke="#dc2626" name="Failed: LMS logins" dot={false} />
                <Line dataKey="passed_logins" stroke="#059669" name="Passed: LMS logins" dot={false} />
              </LineChart>
            </ResponsiveContainer></div>
          <div><p className="mb-1 text-sm font-medium">Model weights (standardised log-odds; + raises risk)</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={coefs} layout="vertical" margin={{ left: 60 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" /><YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 11 }} /><Tooltip />
                <Bar dataKey="coef" fill="#1e49e2" /></BarChart>
            </ResponsiveContainer></div>
        </div>
      </Card>

      <Card title="Fairness audit" subtitle="Does the model flag some groups more, or miss more of their struggling students? Computed on the held-out test set.">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="p-2">Group</th><th className="p-2 text-right">n</th><th className="p-2 text-right">Flag rate</th><th className="p-2 text-right">Recall (caught)</th><th className="p-2 text-right">False-positive rate</th></tr></thead>
          <tbody>{model.fairness.map((r) => (
            <tr key={r.group_type + r.group} className="border-t"><td className="p-2">{r.group_type}: <b>{r.group}</b></td><td className="p-2 text-right">{r.n}</td>
              <td className="p-2 text-right">{pct(r.flag_rate)}</td><td className="p-2 text-right">{pct(r.recall)}</td><td className="p-2 text-right">{pct(r.fpr)}</td></tr>))}</tbody>
        </table>
      </Card>

      <Card title="Limitations & responsible use">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>Data is synthetic (seeded, reproducible) and designed to mirror real campus exports. Re-run <code>python pipeline/run_pipeline.py</code> on real exports with the same schemas.</li>
          <li>Risk flags are <b>triage signals for a human conversation</b>, not judgements. The model shows correlation, not causation.</li>
          <li>Students should be able to see their own drivers. Flags must never be used for admissions or disciplinary decisions.</li>
          <li>Re-check the fairness table every semester. If recall gaps exceed 10 pp between groups, adjust thresholds per group or the features.</li>
        </ul>
      </Card>
    </div>
  );
}
```

Add to `web/package.json` scripts: `"test": "vitest run"`. In `web/tsconfig.app.json` add `"exclude": ["src/**/*.test.ts"]`, so that `tsc -b` in `npm run build` does not type-check the Node-only test file.

- [ ] **Step 4: Verify**

- Run `npm test`: all tests pass.
- In the browser, drag the Placement weight to 0. The header shows "Custom weights active", the Overview and Queue scores change, and "N students changed band" appears.
- Set every slider to 0: the fallback message appears.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/score.test.ts web/src/pages/Methodology.tsx web/package.json
git commit -m "feat(web): methodology & trust page with live weights, back-test, fairness; parity tests"
```

---

### Task 17: Guided demo, then deploy and submit v1

**Files:**
- Modify: `web/src/pages/Demo.tsx`

- [ ] **Step 1: Implement the guided demo**

`web/src/pages/Demo.tsx`
```tsx
import { Link } from "react-router-dom";
import { Card } from "../components/ui";
import { useData } from "../lib/data";

export default function Demo() {
  const { students, insights } = useData();
  const early = students.find((s) => s.engagement_drop && s.academic_risk.level !== "High") ?? students[0];
  const star = students.find((s) => s.segment === "Academic stars, placement gap") ?? students[0];
  const steps = [
    { t: "1. The problem", d: "Seven campus systems, seven ID formats, no shared view. See what we integrated and cleaned.", to: "/data", cta: "Open Data Studio" },
    { t: "2. The campus at a glance", d: insights[0]?.title ?? "Overview of risk and success.", to: "/", cta: "Open Overview" },
    { t: "3. Who needs help this week", d: "A ranked queue with reasons and suggested actions for each mentor.", to: "/queue", cta: "Open Action Queue" },
    { t: `4. Early warning: ${early.name}`, d: "Not failing yet, but LMS activity collapsed in weeks 6–8. Marks would only show this at the end of the semester.", to: `/student/${early.roll_no}`, cta: "Open profile" },
    { t: `5. Hidden gap: ${star.name}`, d: "Strong academics, weak placement readiness. A CGPA-only system would miss this student.", to: `/student/${star.roll_no}`, cta: "Open profile" },
    { t: "6. Can you trust it?", d: "Back-tested against a CGPA baseline, with a fairness audit by residence and gender, and adjustable weights.", to: "/method", cta: "Open Method & Trust" },
  ];
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <h1 className="text-2xl font-bold">Guided demo (3 minutes)</h1>
      {steps.map((s) => (
        <Card key={s.t}><div className="flex flex-wrap items-center gap-3"><div className="flex-1"><div className="font-semibold">{s.t}</div>
          <p className="text-sm text-slate-600">{s.d}</p></div>
          <Link to={s.to} className="rounded-md bg-brand-500 px-3 py-1.5 text-sm text-white">{s.cta} →</Link></div></Card>))}
    </div>
  );
}
```

- [ ] **Step 2: Build and test locally**

Run: `cd web && npm test && npm run build && npx vite preview`
Expected: tests pass, and the build succeeds. At `http://localhost:4173`, all 7 nav routes render. A hard refresh on `/student/<roll>` works.

- [ ] **Step 3: Push to GitHub and deploy**

```bash
cd A:/WebDev/HacXalerate
gh repo create campus-compass --public --source . --remote origin --push
```

Then in the Vercel dashboard:
1. New Project → import `campus-compass`.
2. Set **Root Directory** to `web`, with the Vite framework preset (build `npm run build`, output `dist`).
3. Deploy.

- [ ] **Step 4: Verify the deployed URL**

In an incognito window, open the deployed URL plus `/student/<a-real-roll>` and `/data/cohort.json`.
Expected: the pages load in under 3 seconds, the JSON is served, and there are no console errors.

- [ ] **Step 5: SUBMIT v1 on the byteXL platform** (project info, GitHub link and live link). Then commit:

```bash
git add web/src/pages/Demo.tsx
git commit -m "feat(web): guided demo walkthrough"
git push
```

> **Milestone B (target 18:30):** v1 is submitted, with all 4 mandatory features live.

---

### Task 18: Documentation deliverables and final QA

**Files:**
- Create: `README.md`, `docs/SCORE_METHODOLOGY.md`, `docs/slides.md`

- [ ] **Step 1: Write `docs/SCORE_METHODOLOGY.md`** (required deliverable #2). Copy the pillar formulas and weights exactly from `pipeline/campus/pillars.py` and `config.py`. Include:
  - the renormalisation rule with a worked example (a year-2 student with no placement data: confidence 85%)
  - the band thresholds
  - the academic and placement risk point tables (from `risk.py`)
  - the ML model's target, training window and metrics (copy the real numbers from `web/public/data/model.json`)
  - the segment rules (from `segments.py`)

- [ ] **Step 2: Write `README.md`** with these sections, in order:
  1. Live demo link and a 3-line pitch
  2. Screenshots (Overview, Queue, Student 360, Data Studio), saved under `docs/img/`
  3. How it maps to the KPMG brief: a table with core scope item → page → file
  4. Architecture diagram (copy from `docs/STRATEGY.md` §5)
  5. Tech stack
  6. Run locally: `cd pipeline && pip install -r requirements.txt && python run_pipeline.py --regenerate`, then `cd web && npm i && npm run dev`
  7. Tests: `python -m pytest`, `npm test`
  8. Data: synthetic, seeded, with the schemas of all 8 CSVs
  9. Team and roles
  10. Notes for evaluators: no login needed; start at `/demo`

- [ ] **Step 3: Write `docs/slides.md`** (6 slides) and export it to PDF (paste into Google Slides or Canva):
  1. Problem: 7 silos, reactive interventions
  2. Research: Georgia State GPS (48h action), Purdue lesson (honest claims), LMS lead time
  3. Solution: integrate → score → flag → explain → act
  4. Demo screenshots
  5. Evidence: back-test vs baseline, lead-time chart, fairness table
  6. Impact and roadmap: real ERP connectors, mentor mobile alerts, outcome tracking, NAAC/NIRF reports

  Record a 3-minute screen video following `/demo`, and link both the slides and the video in the README.

- [ ] **Step 4: Final QA.** Run the checklist in `docs/STRATEGY.md` §8 on the **deployed** URL, in incognito, at 1366×768 and on a phone. Fix only bugs. No new features after 06:00.

- [ ] **Step 5: Commit, push and SUBMIT the final version (target 08:30)**

```bash
git add README.md docs
git commit -m "docs: README, score methodology note, slides"
git push
```

Then re-submit on the byteXL platform and confirm that the latest submission shows the correct links.

---

## Stretch goals (only after v2 is submitted and QA is green)

1. **CSV re-upload in Data Studio**: client-side parsing of a unified CSV (one row per student, with the 7 pillar columns), scored with `recomputeScore`.
2. **"Ask CampusCompass"**: a Vercel serverless function calling the Claude API (`claude-haiku-5-5`) with the cohort summary JSON as context. It must have a **rule-based fallback** when no key is set, so the deployed demo never breaks.
3. **Intervention outcome tracker**: mark an action as done, and show whether that student's weekly LMS activity recovered afterwards.
