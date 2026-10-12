"""Verify the row-level security policies in db/migrations/002_rls.sql WITHOUT changing the database.

The test (002_rls.test.sql) impersonates anonymous, role-less, admin, faculty and student users inside one
transaction, checks what each can read and write, and always rolls back.

    pip install "psycopg[binary]"
    python db/tests/run_rls_test.py current     # test the database exactly as it is now (policies already applied)
    python db/tests/run_rls_test.py migration   # apply db/migrations/002_rls.sql INSIDE the transaction first, then test

Reads SUPABASE_DB_URL from the repo-root .env. Needs the seeded demo accounts.
Exit code 0 = every check passed.
"""
import re
import sys
from pathlib import Path

import psycopg

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
env = dict(re.findall(r"^([A-Z_]+)=(.*)$", (ROOT / ".env").read_text(encoding="utf-8"), re.M))
migration = (ROOT / "db" / "migrations" / "002_rls.sql").read_text(encoding="utf-8")
test = (HERE / "002_rls.test.sql").read_text(encoding="utf-8")


def snapshot(c):
    return (
        c.execute("select count(*) from pg_policies where schemaname='public'").fetchone()[0],
        c.execute("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')").fetchone()[0],
        c.execute("select reloptions from pg_class where relname='student_unified_view'").fetchone()[0],
    )


def main(mode: str) -> int:
    with psycopg.connect(env["SUPABASE_DB_URL"], connect_timeout=20, autocommit=False) as c:
        before = snapshot(c)
        c.rollback()
        try:
            if mode == "migration":
                c.execute(migration)
            c.execute(test)
            rows = c.execute("select label, got, want, ok from rlstest.res order by n").fetchall()
        finally:
            c.rollback()  # never keep anything
        after = snapshot(c)
        c.rollback()
    failed = [r for r in rows if not r[3]]
    print(f"[{mode}] {len(rows) - len(failed)}/{len(rows)} checks passed")
    for label, got, want, _ in failed:
        print(f"  FAIL {label}: got {got}, want {want}")
    print("database unchanged:", before == after)
    return 1 if failed or before != after else 0


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ("current", "migration"):
        sys.exit(__doc__)
    sys.exit(main(sys.argv[1]))
