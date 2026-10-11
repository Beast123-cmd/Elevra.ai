"""Run docs/proposals/002_rls.test.sql against the Supabase database WITHOUT changing it (everything is rolled back).

    pip install "psycopg[binary]"
    python docs/proposals/run_rls_test.py with      # apply 002_rls.sql inside the transaction, then test  -> expect all pass
    python docs/proposals/run_rls_test.py without   # test the database as it is today                     -> shows current leaks

Reads SUPABASE_DB_URL from the repo-root .env. Needs the seeded demo accounts.
"""
import re
import sys
from pathlib import Path

import psycopg

HERE = Path(__file__).resolve().parent
env = dict(re.findall(r"^([A-Z_]+)=(.*)$", (HERE.parents[1] / ".env").read_text(encoding="utf-8"), re.M))
migration = (HERE / "002_rls.sql").read_text(encoding="utf-8")
test = (HERE / "002_rls.test.sql").read_text(encoding="utf-8")


def snapshot(c):
    return (
        c.execute("select count(*) from pg_policies where schemaname='public'").fetchone()[0],
        c.execute("select count(*) from pg_proc where proname='can_see_student'").fetchone()[0],
        c.execute("select reloptions from pg_class where relname='student_unified_view'").fetchone()[0],
    )


def main(mode: str) -> int:
    with psycopg.connect(env["SUPABASE_DB_URL"], connect_timeout=20, autocommit=False) as c:
        before = snapshot(c)
        c.rollback()
        try:
            if mode == "with":
                c.execute(migration)
            c.execute(test)
            rows = c.execute("select label, got, want, ok from rlstest.res order by n").fetchall()
        finally:
            c.rollback()  # never keep anything
        after = snapshot(c)
        c.rollback()
    failed = [r for r in rows if not r[3]]
    print(f"[{mode} 002_rls.sql] {len(rows) - len(failed)}/{len(rows)} checks passed")
    for label, got, want, _ in failed:
        print(f"  FAIL {label}: got {got}, want {want}")
    print("database unchanged:", before == after)
    return 1 if failed else 0


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ("with", "without"):
        sys.exit(__doc__)
    sys.exit(main(sys.argv[1]))
