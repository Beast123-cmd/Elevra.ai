"""Strict allowlist for the "Ask your data" chat.

The model writes SQL, but nothing it writes is trusted. Every token must be explicitly permitted:
one SELECT over one view, only known columns, a short list of aggregate functions, no comments,
no stacked statements, no subqueries, no joins, no `select *` (which would expose email).
Anything unexpected is rejected, never "cleaned up". The caller also runs the result in a
READ ONLY transaction with a statement timeout and a row cap, as a second line of defence.
"""
from __future__ import annotations

import re

VIEW = "student_unified_view"
ROW_CAP = 200
MAX_CHARS = 1500
MAX_TOKENS = 300

# email is deliberately absent: it is personal data and the chat never needs it.
ALLOWED_COLUMNS = frozenset(
    "student_id name department year batch section gender residence mentor_faculty_id cgpa backlogs latest_sgpa "
    "current_attendance_pct aptitude coding mock_interview_avg mock_count technical_avg soft_avg events clubs "
    "hackathons certifications satisfaction faculty_rating success_score band confidence academic_risk "
    "placement_risk segment priority declining engagement_drop academic attendance lms placement skills "
    "engagement feedback".split()
)
ALLOWED_FUNCTIONS = frozenset("count sum avg min max round coalesce lower upper abs ceil floor nullif length".split())
ALLOWED_KEYWORDS = frozenset(
    "select from where group by order limit and or not in like ilike is null between as desc asc having distinct "
    "case when then else end true false cast filter nulls first last".split()
)
ALLOWED_TYPES = frozenset("numeric int integer float text bigint double precision".split())
CLAUSE_STARTS = frozenset({"where", "group", "order", "limit", "having"})

_TOKEN = re.compile(
    r"""\s*(?:
        (?P<string>'(?:[^']|'')*')
      | (?P<number>\d+(?:\.\d+)?)
      | (?P<ident>[A-Za-z_][A-Za-z0-9_]*)
      | (?P<punct><=|>=|<>|!=|::|[(),*=<>+\-/%.])
    )""",
    re.VERBOSE,
)


class SqlRejected(ValueError):
    """The SQL is not on the allowlist. The message is safe to show the user."""


def _tokenize(sql: str) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    pos = 0
    while pos < len(sql):
        if sql[pos:].strip() == "":
            break
        m = _TOKEN.match(sql, pos)
        if not m:
            raise SqlRejected(f"Unsupported character near: {sql[pos:pos + 12].strip()!r}")
        kind = m.lastgroup or ""
        out.append((kind, m.group(kind)))
        pos = m.end()
        if len(out) > MAX_TOKENS:
            raise SqlRejected("The query is too complex.")
    return out


def validate_sql(sql: object) -> str:
    """Return the SQL (without a trailing semicolon) if it is allowed, otherwise raise SqlRejected."""
    if not isinstance(sql, str) or not sql.strip():
        raise SqlRejected("No SQL was provided.")
    text = sql.strip()
    if len(text) > MAX_CHARS:
        raise SqlRejected("The query is too long.")
    if text.endswith(";"):
        text = text[:-1].rstrip()
    if any(ord(c) < 32 and c not in "\t\n\r" for c in text):
        raise SqlRejected("Control characters are not allowed.")
    # Conservative on purpose: rejected even inside a string literal, which keeps the rule trivial to reason about.
    if "--" in text or "/*" in text or "*/" in text or "\\" in text:
        raise SqlRejected("Comments and escape characters are not allowed.")

    tokens = _tokenize(text)
    if not tokens or tokens[0] != ("ident", tokens[0][1]) or tokens[0][1].lower() != "select":
        raise SqlRejected("Only SELECT queries are allowed.")

    words = [(k, v.lower() if k == "ident" else v) for k, v in tokens]
    if sum(1 for k, v in words if k == "ident" and v == "select") != 1:
        raise SqlRejected("Subqueries are not allowed.")
    if sum(1 for k, v in words if k == "ident" and v == "from") != 1:
        raise SqlRejected("Query exactly one table.")

    aliases: set[str] = set()
    for i, (kind, val) in enumerate(words):
        prev = words[i - 1] if i else ("", "")
        nxt = words[i + 1] if i + 1 < len(words) else ("", "")
        if kind == "ident":
            if prev == ("ident", "as"):
                if val in ALLOWED_TYPES:
                    continue  # cast(x as numeric)
                if val in ALLOWED_KEYWORDS or val in ALLOWED_FUNCTIONS or val == VIEW:
                    raise SqlRejected(f"Invalid alias: {val}")
                aliases.add(val)
                continue
            if prev == ("punct", "::"):
                if val not in ALLOWED_TYPES:
                    raise SqlRejected(f"Type not allowed: {val}")
                continue
            if val in ALLOWED_TYPES and prev[1] in {"double"}:
                continue  # "double precision"
            if val == VIEW:
                if prev not in (("ident", "from"), ("punct", ".")):
                    raise SqlRejected("The table can only appear after FROM.")
                continue
            if val == "public":
                if not (prev == ("ident", "from") and nxt == ("punct", ".")):
                    raise SqlRejected("Unsupported schema reference.")
                continue
            if val in ALLOWED_FUNCTIONS:
                if nxt != ("punct", "("):
                    raise SqlRejected(f"{val} must be called like a function.")
                continue
            if val in ALLOWED_KEYWORDS:
                continue
            if val in ALLOWED_COLUMNS or val in aliases:
                if nxt == ("punct", "("):
                    raise SqlRejected(f"{val} is a column, not a function.")
                continue
            if val == "double" and nxt == ("ident", "precision"):
                continue
            raise SqlRejected(f"Not allowed: {val}")
        if kind == "punct" and val == ".":
            if not (prev == ("ident", "public") and nxt == ("ident", VIEW)):
                raise SqlRejected("Qualified names are not allowed.")
        if kind == "punct" and val == "*":
            star_in_count = prev == ("punct", "(") and nxt == ("punct", ")")
            multiply = _ends_operand(prev) and _starts_operand(nxt)
            if not (star_in_count or multiply):
                raise SqlRejected("`select *` is not allowed; name the columns you need.")

    _check_from_clause(words)
    _check_limit(words)
    _check_parens(words)
    return text


_VALUE_WORDS = frozenset({"true", "false", "null", "end"})


def _ends_operand(tok: tuple[str, str]) -> bool:
    kind, val = tok
    return kind == "number" or tok == ("punct", ")") or (kind == "ident" and (val not in ALLOWED_KEYWORDS or val in _VALUE_WORDS))


def _starts_operand(tok: tuple[str, str]) -> bool:
    kind, val = tok
    return kind == "number" or tok == ("punct", "(") or (kind == "ident" and (val not in ALLOWED_KEYWORDS or val in {"case", "cast"} | _VALUE_WORDS))


def _check_from_clause(words: list[tuple[str, str]]) -> None:
    idx = next(i for i, (k, v) in enumerate(words) if k == "ident" and v == "from")
    j = idx + 1
    if words[j:j + 3] == [("ident", "public"), ("punct", "."), ("ident", VIEW)]:
        j += 3
    elif words[j:j + 1] == [("ident", VIEW)]:
        j += 1
    else:
        raise SqlRejected(f"Only the {VIEW} view can be queried.")
    if j < len(words) and not (words[j][0] == "ident" and words[j][1] in CLAUSE_STARTS):
        raise SqlRejected("Unexpected text after the table name (aliases and joins are not allowed).")


def _check_limit(words: list[tuple[str, str]]) -> None:
    for i, (k, v) in enumerate(words):
        if k == "ident" and v == "limit":
            if i + 1 >= len(words) or words[i + 1][0] != "number" or "." in words[i + 1][1]:
                raise SqlRejected("LIMIT must be followed by a whole number.")


def _check_parens(words: list[tuple[str, str]]) -> None:
    depth = 0
    for k, v in words:
        if k == "punct" and v == "(":
            depth += 1
        elif k == "punct" and v == ")":
            depth -= 1
            if depth < 0:
                break
    if depth != 0:
        raise SqlRejected("Unbalanced parentheses.")


def wrap_with_cap(valid_sql: str) -> str:
    """Whatever LIMIT the model wrote, never return more than ROW_CAP rows (one extra row detects truncation)."""
    return f"select * from ({valid_sql}) as capped limit {ROW_CAP + 1}"
