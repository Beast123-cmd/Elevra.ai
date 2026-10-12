"""Timed daily and weekly student assessments with server-side scoring."""
from __future__ import annotations

import random
from datetime import datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from common.auth import Caller, require_role
from common.db import db

router = APIRouter()
IST = ZoneInfo("Asia/Kolkata")
COINS_PER_CORRECT = {"easy": 1, "medium": 2, "hard": 3}
DURATIONS = {"daily": 15 * 60, "weekly": 60 * 60}
LENGTHS = {"daily": 10, "weekly": 50}


def _choice(index: int, prompt: str, correct: str, explanation: str, distractors: list[str]) -> dict:
    options = list(dict.fromkeys([correct, *distractors]))
    while len(options) < 4:
        options.append(f"{correct} (other value {len(options)})")
    options = options[:4]
    random.Random(index * 97 + len(prompt)).shuffle(options)
    return {
        "question_id": str(index), "prompt": prompt,
        "options": [{"id": chr(65 + i), "label": value} for i, value in enumerate(options)],
        "answer": chr(65 + options.index(correct)), "explanation": explanation,
    }


def _aptitude(index: int, difficulty: str) -> dict:
    scale = {"easy": 1, "medium": 2, "hard": 3}[difficulty]
    variant, kind = index // 10, index % 10
    n = variant + scale
    if kind == 0:
        base, percent = 120 + 40*n, 10 + 5*((variant + scale) % 5)
        answer = base * percent // 100
        return _choice(index, f"What is {percent}% of {base}?", str(answer), f"{base} × {percent}/100 = {answer}.", [str(answer + percent), str(answer - percent), str(base - percent)])
    if kind == 1:
        a, b, unit = 2+n, 3+n, 5+n
        total = (a+b)*unit
        answer = a*unit
        return _choice(index, f"A group has people in the ratio {a}:{b}. If there are {total} people, how many are in the first group?", str(answer), f"There are {a+b} parts, each worth {unit}; the first group has {answer}.", [str(answer+unit), str(total-answer), str(answer-unit)])
    if kind == 2:
        start = 12 + 4*n
        vals = [start, start+4, start+8, start+12]
        answer = str(sum(vals)//len(vals))
        return _choice(index, f"Find the average of {', '.join(map(str, vals))}.", answer, f"Their sum is {sum(vals)}; divide by 4 to get {answer}.", [str(int(answer)+2), str(int(answer)-2), str(int(answer)+4)])
    if kind == 3:
        hours = 2 + (n % 4)
        speed = 35 + 5*n
        distance = hours*speed
        return _choice(index, f"A vehicle travels {distance} km in {hours} hours. What is its average speed?", str(speed), f"Average speed = distance ÷ time = {distance} ÷ {hours} = {speed} km/h.", [str(speed+5), str(speed-5), str(distance)])
    if kind == 4:
        principal, rate, years = 500*(n+2), 4+n, 2+(n%3)
        answer = str(principal*rate*years//100)
        return _choice(index, f"Find the simple interest on ₹{principal} at {rate}% per year for {years} years.", answer, f"SI = P × R × T ÷ 100 = ₹{answer}.", [str(int(answer)+principal//10), str(int(answer)-principal//10), str(principal*rate//100)])
    if kind == 5:
        cost, profit = 100*(n+2), 10 + 5*(n%5)
        answer = str(cost + cost*profit//100)
        return _choice(index, f"An item costs ₹{cost}. What is its selling price after a {profit}% profit?", answer, f"Selling price = {cost} × (1 + {profit}/100) = ₹{answer}.", [str(cost+profit), str(cost-cost*profit//100), str(int(answer)+cost//10)])
    if kind == 6:
        a, b = 4+n, 8+n
        answer = f"{a*b/(a+b):.1f}"
        return _choice(index, f"A can finish a task in {a} days and B in {b} days. About how many days do they need together?", answer, f"Combined rate is 1/{a} + 1/{b}; time = {a}×{b}/({a}+{b}) ≈ {answer} days.", [f"{a+b:.1f}", f"{min(a,b):.1f}", f"{a*b/(a-b):.1f}"])
    if kind == 7:
        first, step = 2+n, 3+scale
        answer = str(first+4*step)
        return _choice(index, f"What comes next in the sequence {first}, {first+step}, {first+2*step}, {first+3*step}, …?", answer, f"The sequence increases by {step}; the next value is {answer}.", [str(int(answer)+step), str(int(answer)-step), str(int(answer)+2)])
    if kind == 8:
        red, blue = 2+n, 3+scale
        answer = f"{red}/{red+blue}"
        return _choice(index, f"A bag has {red} red and {blue} blue counters. What is the probability of picking red?", answer, f"Red counters ÷ total counters = {red}/{red+blue}.", [f"{blue}/{red+blue}", f"1/{red+blue}", f"{red}/{blue}"])
    side = 3+n
    answer = str(4*side)
    return _choice(index, f"A square has side length {side} cm. What is its perimeter?", answer, f"Perimeter = 4 × {side} = {answer} cm.", [str(side*side), str(2*side), str(4*side+4)])


CPP_QUESTIONS = [
    ("What is the output of `int x = {n}; cout << x + {k};`?", lambda n,k: str(n+k), "The expression adds the two integer values."),
    ("What is the value of `({n} + {k}) / 2` using integer division?", lambda n,k: str((n+k)//2), "Integer division discards the fractional part."),
    ("How many times does `for (int i=0; i<{n}; ++i)` run?", lambda n,k: str(n), "The loop visits i = 0 through n−1."),
    ("What is printed by `int a[]={{{n}, {k}, {n+k}}}; cout << a[1];`?", lambda n,k: str(k), "Array indexing starts at zero; a[1] is the second element."),
    ("What is `({n} % {k})`?", lambda n,k: str(n%k), "The modulo operator returns the remainder."),
    ("What is `++x` when x starts at {n}?", lambda n,k: str(n+1), "Prefix increment adds one to x."),
    ("What is the size of `vector<int> v({n}, {k})`?", lambda n,k: str(n), "The vector constructor creates n copies of the value."),
    ("What does `bool ok = ({n} < {k});` store?", lambda n,k: "true" if n<k else "false", "The comparison evaluates to a boolean."),
    ("What is printed by `cout << {n} * {k};`?", lambda n,k: str(n*k), "The multiplication expression evaluates to n × k."),
    ("Which access specifier makes class members private by default?", lambda n,k: "class", "Members of a C++ class are private by default."),
]


def _question(category: str, difficulty: str, index: int) -> dict:
    if category == "aptitude":
        return _aptitude(index, difficulty)
    if category == "sql":
        variant, kind = index // 10, index % 10
        table = f"students_{variant+1}"
        score = 50 + variant * 10
        if kind == 0:
            correct = f"SELECT * FROM {table};"
            return _choice(index, f"Which query fetches all columns from `{table}`?", correct, "SELECT * retrieves all columns from the named table.", [f"GET * FROM {table};", f"SELECT {table};", f"INSERT INTO {table} *;"])
        if kind == 1:
            correct = f"SELECT * FROM {table} WHERE score >= {score};"
            return _choice(index, f"Which query finds rows in `{table}` with a score of at least {score}?", correct, "WHERE filters rows before they are returned.", [f"SELECT * FROM {table} HAVING score >= {score};", f"SELECT * FROM {table} ORDER BY score >= {score};", f"FILTER {table} score >= {score};"])
        if kind == 2:
            column, direction = ("score", "DESC") if variant % 2 == 0 else ("name", "ASC")
            correct = f"SELECT * FROM {table} ORDER BY {column} {direction};"
            return _choice(index, f"Which query sorts `{table}` by `{column}` in {direction.lower()}ending order?", correct, "ORDER BY sorts rows; DESC is descending and ASC is ascending.", [f"SELECT * FROM {table} SORT {column} {direction};", f"SELECT * FROM {table} GROUP BY {column} {direction};", f"SELECT * FROM {table} ORDER {direction} BY {column};"])
        if kind == 3:
            correct = f"SELECT COUNT(*) FROM {table};"
            return _choice(index, f"Which query counts all rows in `{table}`?", correct, "COUNT(*) counts all rows.", [f"SELECT SUM(*) FROM {table};", f"SELECT ROWS(*) FROM {table};", f"COUNT {table};"])
        if kind == 4:
            correct = f"SELECT department, AVG(score) FROM {table} GROUP BY department;"
            return _choice(index, f"Which query gets the average score for each department in `{table}`?", correct, "The non-aggregated department column is grouped while AVG calculates each group average.", [f"SELECT department, AVG(score) FROM {table};", f"SELECT department FROM {table} ORDER BY AVG(score);", f"SELECT AVG(score) FROM {table} WHERE department;"])
        if kind == 5:
            correct = f"SELECT * FROM {table} s LEFT JOIN departments d ON s.department_id = d.id;"
            return _choice(index, f"Which query keeps every student in `{table}` while adding matching department data?", correct, "LEFT JOIN retains every row from its left table.", [f"SELECT * FROM {table} s INNER JOIN departments d ON s.department_id = d.id;", f"SELECT * FROM {table} s RIGHT JOIN departments d ON s.department_id = d.id;", f"SELECT * FROM {table} s LEFT JOIN departments d USING (score);"])
        if kind == 6:
            correct = f"SELECT * FROM {table} WHERE phone IS NULL;"
            return _choice(index, f"Which query finds rows in `{table}` with no phone value?", correct, "NULL values are checked with IS NULL.", [f"SELECT * FROM {table} WHERE phone = NULL;", f"SELECT * FROM {table} WHERE phone == NULL;", f"SELECT * FROM {table} WHERE phone EMPTY;"])
        if kind == 7:
            sid = 100 + variant
            correct = f"INSERT INTO {table} (student_id, score) VALUES ({sid}, {score});"
            return _choice(index, f"Which statement adds student {sid} with score {score} to `{table}`?", correct, "INSERT INTO names the target columns, then VALUES supplies their values.", [f"UPDATE {table} SET student_id={sid}, score={score};", f"ADD INTO {table} ({sid}, {score});", f"INSERT {table} VALUES ({score}, {sid});"])
        if kind == 8:
            sid = 100 + variant
            correct = f"UPDATE {table} SET score = {score} WHERE student_id = {sid};"
            return _choice(index, f"Which statement changes only student {sid}'s score to {score} in `{table}`?", correct, "UPDATE changes rows and WHERE limits the change to the requested student.", [f"UPDATE {table} SET score={score};", f"ALTER {table} SET score={score} WHERE student_id={sid};", f"UPDATE {table} WHERE student_id={sid} SET score={score};"])
        correct = f"SELECT * FROM {table} ORDER BY score DESC LIMIT 3;"
        return _choice(index, f"Which query returns the three highest scores from `{table}`?", correct, "Sort scores descending, then limit the result to three rows.", [f"SELECT * FROM {table} ORDER BY score ASC LIMIT 3;", f"SELECT TOP 3 * FROM {table} ORDER BY score;", f"SELECT * FROM {table} LIMIT 3 ORDER BY score DESC;"])
    if category == "cpp":
        variant, kind = index // len(CPP_QUESTIONS), index % len(CPP_QUESTIONS)
        n, k = 2 + variant, 5 + variant
        if kind == 9:
            fundamentals = [
                ("Which keyword defines a type whose members are private by default?", "class", "Members of a C++ class are private by default.", ["struct", "enum", "namespace"]),
                ("Which keyword defines a type whose members are public by default?", "struct", "Members of a C++ struct are public by default.", ["class", "enum", "namespace"]),
                ("Which header provides `std::cout`?", "<iostream>", "The iostream header declares the standard input and output streams.", ["<vector>", "<string>", "<algorithm>"]),
                ("What is the conventional return type of the C++ program entry point?", "int", "A standard C++ main function returns int.", ["void", "bool", "char"]),
                ("Which standard container stores a dynamic sequence of elements?", "std::vector", "std::vector is a resizable sequence container.", ["std::pair", "std::stackframe", "std::tuple"]),
            ]
            prompt, answer, explanation, distractors = fundamentals[variant]
            return _choice(index, prompt, answer, explanation, distractors)
        template, answer_fn, explanation = CPP_QUESTIONS[kind]
        prompt = template.format(n=n, k=k)
        answer = answer_fn(n, k)
        return _choice(index, prompt, answer, explanation, [str(answer)+"1", str(n), str(k)])
    if category == "coding":
        n = index + 2
        correct = str(n * (n + 1) // 2)
        return _choice(index, f"What does this Python code print? `n = {n}; print(sum(range(1, n + 1)))`", correct, f"The sum from 1 through {n} is {correct}.", [str(n*n), str(n*(n-1)//2), str(correct+1)])
    # General CS MCQ pool; values vary by index so a 50-question test has no repeats.
    variant, kind = index // 10, index % 10
    a, b = 3 + variant, 8 + variant
    if kind == 0:
        return _choice(index, f"A stack receives {a}, then {b}; one item is popped. What is now on top?", str(a), "A stack is last-in, first-out, so popping removes the most recently pushed item.", [str(b), str(a+b), str(a*b)])
    if kind == 1:
        return _choice(index, f"A queue receives {a}, then {b}; one item is dequeued. What is at the front now?", str(b), "A queue is first-in, first-out, so the first item leaves first.", [str(a), str(a+b), str(a*b)])
    if kind == 2:
        values = [a, a+2, a+4, a+6]
        position = variant % 4
        return _choice(index, f"In Python, what does `values[{position}]` return for `values = {values}`?", str(values[position]), "Python lists use zero-based indexes.", [str(values[(position+1)%4]), str(values[(position+2)%4]), str(values[(position+3)%4])])
    if kind == 3:
        size = 2 ** (variant + 4)
        return _choice(index, f"Binary search halves a sorted list of {size} items each step. How many halving steps reduce it to one item?", str(variant+4), "Each step halves the remaining range; log₂(2ᵏ) = k steps.", [str(variant+3), str(size), str(2*(variant+4))])
    if kind == 4:
        status, meaning = [(200,"request succeeded"),(201,"resource created"),(301,"resource moved"),(401,"authentication required"),(404,"resource not found")][variant]
        others = ["request succeeded", "resource created", "authentication required", "resource not found"]
        return _choice(index, f"What does HTTP status {status} indicate?", meaning, f"HTTP {status} means the {meaning}.", others)
    if kind == 5:
        branch = f"feature-{variant+1}"
        correct = f"git switch -c {branch}"
        return _choice(index, f"Which command creates and switches to the Git branch `{branch}`?", correct, "`git switch -c` creates a branch and checks it out.", [f"git merge {branch}", f"git stash {branch}", f"git fetch {branch}"])
    if kind == 6:
        low, high = 10 + variant*5, 70 + variant*5
        return _choice(index, f"Which SQL condition selects scores from {low} through {high}, inclusive?", f"BETWEEN {low} AND {high}", "BETWEEN includes both boundary values.", [f"> {low} AND < {high}", f"IN ({low}, {high})", f"RANGE {low} TO {high}"])
    if kind == 7:
        hours, rate = 2 + variant, 40 + variant*10
        answer = str(hours*rate)
        return _choice(index, f"A system processes {rate} requests per second for {hours} seconds. How many requests does it process?", answer, f"Multiply the rate by elapsed time: {rate} × {hours} = {answer}.", [str(rate+hours), str(rate*(hours-1)), str(answer+rate)])
    if kind == 8:
        tag, role = [("<header>","introductory content"),("<nav>","navigation links"),("<main>","the page's primary content"),("<footer>","page-ending content"),("<article>","a self-contained composition")][variant]
        return _choice(index, f"Which semantic HTML element best describes {role}?", tag, f"{tag} is the semantic element for {role}.", ["<div>", "<span>", "<meta>"])
    key = f"course{variant+1}"
    return _choice(index, f"In Python, what does `record['{key}']` access in a dictionary?", "The value stored under that key", "Dictionary keys are used to look up their associated values.", ["The key's position", "The dictionary length", "The next key alphabetically"])


def _public_question(question: dict) -> dict:
    return {key: question[key] for key in ("question_id", "prompt", "options")}


def _period(mode: str, now: datetime) -> str:
    if mode == "daily":
        return now.date().isoformat()
    iso = now.isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


class StartRequest(BaseModel):
    mode: Literal["daily", "weekly"]
    category: Literal["aptitude", "sql", "cpp", "mcq", "coding"]
    difficulty: Literal["easy", "medium", "hard"]


class SubmitRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=64)
    answers: dict[str, str] = Field(default_factory=dict)


def _serialize_session(row: dict, questions: list[dict]) -> dict:
    result = {"session_id": row["id"], "mode": row["mode"], "category": row["category"],
              "difficulty": row["difficulty"], "duration_seconds": row["duration_seconds"],
              "expires_at": row["expires_at"], "questions": [_public_question(q) for q in questions]}
    if row["status"] == "completed":
        result["result"] = {"correct_count": row["correct_count"], "total_questions": row["total_questions"],
                            "score_percent": row["score_percent"], "coins": row["coins"], "already_completed": True}
    return result


@router.post("/assessments/start")
def start_assessment(body: StartRequest, caller: Caller = Depends(require_role("student"))):
    if not caller.student_id:
        raise HTTPException(403, "This account is not linked to a student record")
    now = datetime.now(IST)
    period = _period(body.mode, now)
    table = db().table("student_assessment_sessions")
    existing = table.select("*").eq("student_id", caller.student_id).eq("mode", body.mode).eq("category", body.category).eq("difficulty", body.difficulty).eq("period_key", period).limit(1).execute().data
    if existing:
        row = existing[0]
        if row["status"] == "in_progress" and datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00")) <= datetime.now(IST):
            raise HTTPException(409, "This test timed out. You can start the next one when its period resets.")
        questions = [_question(body.category, body.difficulty, int(index)) for index in row["question_ids"]]
        return _serialize_session(row, questions)

    count = LENGTHS[body.mode]
    indices = random.SystemRandom().sample(range(50), count)
    duration = DURATIONS[body.mode]
    expires = now + timedelta(seconds=duration)
    values = {"student_id": caller.student_id, "mode": body.mode, "category": body.category,
              "difficulty": body.difficulty, "period_key": period, "question_ids": indices,
              "started_at": now.isoformat(), "expires_at": expires.isoformat(),
              "duration_seconds": duration, "total_questions": count, "status": "in_progress"}
    try:
        row = table.insert(values).execute().data[0]
    except Exception:
        existing = table.select("*").eq("student_id", caller.student_id).eq("mode", body.mode).eq("category", body.category).eq("difficulty", body.difficulty).eq("period_key", period).limit(1).execute().data
        if not existing:
            raise HTTPException(503, "Could not start your test. Please try again.")
        row = existing[0]
    questions = [_question(body.category, body.difficulty, index) for index in indices]
    return _serialize_session(row, questions)


@router.post("/assessments/submit")
def submit_assessment(body: SubmitRequest, caller: Caller = Depends(require_role("student"))):
    if not caller.student_id:
        raise HTTPException(403, "This account is not linked to a student record")
    table = db().table("student_assessment_sessions")
    rows = table.select("*").eq("id", body.session_id).eq("student_id", caller.student_id).limit(1).execute().data
    if not rows:
        raise HTTPException(404, "Test session not found")
    row = rows[0]
    if row["status"] == "completed":
        return {"correct_count": row["correct_count"], "total_questions": row["total_questions"],
                "score_percent": row["score_percent"], "coins": row["coins"], "already_completed": True}
    now = datetime.now(IST)
    if datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00")) < now:
        # Accept the answers saved by the browser at timeout, but never extend the server timer.
        pass
    question_ids = [int(index) for index in row["question_ids"]]
    if len(body.answers) > len(question_ids) or any(key not in {str(i) for i in question_ids} for key in body.answers):
        raise HTTPException(422, "Answers do not match this test")
    correct = 0
    for index in question_ids:
        question = _question(row["category"], row["difficulty"], index)
        submitted = body.answers.get(str(index))
        if submitted not in (None, "", "A", "B", "C", "D"):
            raise HTTPException(422, "Invalid answer choice")
        if submitted == question["answer"]:
            correct += 1
    total = len(question_ids)
    coins = correct * COINS_PER_CORRECT[row["difficulty"]]
    score = round(correct * 100 / total) if total else 0
    saved = table.update({"status": "completed", "completed_at": now.isoformat(), "answers": body.answers,
                          "correct_count": correct, "score_percent": score, "coins": coins}) \
        .eq("id", body.session_id).eq("student_id", caller.student_id).eq("status", "in_progress").execute().data
    if not saved:
        final = table.select("correct_count,total_questions,score_percent,coins").eq("id", body.session_id).eq("student_id", caller.student_id).limit(1).execute().data
        if not final:
            raise HTTPException(503, "Could not save your test result")
        row = final[0]
        return {"correct_count": row["correct_count"], "total_questions": row["total_questions"],
                "score_percent": row["score_percent"], "coins": row["coins"], "already_completed": True}
    return {"correct_count": correct, "total_questions": total, "score_percent": score, "coins": coins,
            "already_completed": False}
