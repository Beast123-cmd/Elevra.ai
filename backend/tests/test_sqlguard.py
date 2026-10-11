import unittest

from common.sqlguard import ALLOWED_COLUMNS, ROW_CAP, SqlRejected, validate_sql, wrap_with_cap

ACCEPT = [
    "select department, count(*) from student_unified_view group by department",
    "SELECT name, success_score FROM student_unified_view WHERE academic_risk = 'Red' ORDER BY priority DESC LIMIT 10;",
    "select round(avg(success_score), 1) as avg_score from public.student_unified_view where year >= 3",
    "select segment, count(*) as n from student_unified_view group by segment order by n desc",
    "select department, sum(case when academic_risk = 'Red' then 1 else 0 end) as red from student_unified_view group by department",
    "select cast(cgpa as numeric) as c, year::text from student_unified_view where cgpa is not null",
    "select student_id from student_unified_view where name ilike '%kumar%' and year between 2 and 3",
    "select count(*) from student_unified_view where segment = 'x; drop table users'",
    "select success_score * 2 as double from student_unified_view",
    "select department, avg(attendance) from student_unified_view where placement is not null group by department having count(*) > 5",
    "select name from student_unified_view where declining = true and engagement_drop is false",
]

REJECT = {
    "delete": "delete from student_unified_view",
    "update": "update student_unified_view set name = 'x'",
    "insert": "insert into students(student_id) values ('1')",
    "drop": "drop table students",
    "select star": "select * from student_unified_view",
    "star beside columns": "select name, * from student_unified_view",
    "email (PII)": "select email from student_unified_view",
    "other table": "select name from users",
    "other table via join": "select name from student_unified_view join users on true",
    "stacked statements": "select name from student_unified_view; drop table users",
    "two selects": "select 1; select 2",
    "line comment": "select name from student_unified_view -- hide the rest",
    "block comment": "select name from student_unified_view /* x */",
    "union": "select name from student_unified_view union select name from students",
    "subquery": "select name from student_unified_view where year in (select year from student_unified_view)",
    "cte": "with x as (select 1) select * from x",
    "sleep": "select pg_sleep(5) from student_unified_view",
    "settings": "select current_setting('role') from student_unified_view",
    "set_config": "select set_config('a','b',false) from student_unified_view",
    "version": "select version() from student_unified_view",
    "select into": "select name into newtbl from student_unified_view",
    "for update": "select name from student_unified_view for update",
    "quoted identifier": 'select "name" from student_unified_view',
    "dollar quoting": "select $$x$$ from student_unified_view",
    "backslash": "select name from student_unified_view where name = 'a\b'",
    "system catalog": "select name from pg_catalog.pg_tables",
    "information schema": "select table_name from information_schema.tables",
    "limit all": "select name from student_unified_view limit all",
    "function without parens used as column": "select count from student_unified_view",
    "empty": "   ",
    "not select": "explain select name from student_unified_view",
    "alias on table": "select s.name from student_unified_view s",
    "too long": "select name from student_unified_view where name = '" + "a" * 2000 + "'",
}


class SqlGuard(unittest.TestCase):
    def test_accepts_safe_analytics_queries(self):
        for q in ACCEPT:
            with self.subTest(q=q):
                self.assertTrue(validate_sql(q).lower().startswith("select"))

    def test_rejects_everything_else(self):
        for label, q in REJECT.items():
            with self.subTest(label=label):
                with self.assertRaises(SqlRejected):
                    validate_sql(q)

    def test_non_string_is_rejected(self):
        for bad in (None, 5, ["select 1"]):
            with self.assertRaises(SqlRejected):
                validate_sql(bad)  # type: ignore[arg-type]

    def test_trailing_semicolon_is_stripped_and_text_otherwise_preserved(self):
        self.assertEqual(validate_sql("select count(*) from student_unified_view ;"), "select count(*) from student_unified_view")

    def test_semicolon_inside_a_string_literal_is_just_text(self):
        q = "select count(*) from student_unified_view where segment = 'a; b'"
        self.assertEqual(validate_sql(q), q)

    def test_comment_markers_are_rejected_even_inside_a_string(self):
        for q in ("select count(*) from student_unified_view where name = 'a -- b'", "select count(*) from student_unified_view where name = 'a /* b'"):
            with self.assertRaises(SqlRejected):
                validate_sql(q)

    def test_control_characters_are_rejected(self):
        for code in (0, 8, 27):
            with self.assertRaises(SqlRejected):
                validate_sql("select name from student_unified_view where name = 'a" + chr(code) + "b'")

    def test_email_is_not_an_allowed_column(self):
        self.assertNotIn("email", ALLOWED_COLUMNS)
        self.assertIn("success_score", ALLOWED_COLUMNS)

    def test_row_cap_wrapper_always_applies_and_detects_truncation(self):
        wrapped = wrap_with_cap("select name from student_unified_view limit 100000")
        self.assertTrue(wrapped.endswith(f"limit {ROW_CAP + 1}"))
        self.assertEqual(wrapped.count("student_unified_view"), 1)

    def test_a_user_limit_cannot_raise_the_cap(self):
        self.assertIn("limit 100000", validate_sql("select name from student_unified_view limit 100000"))
        self.assertTrue(wrap_with_cap("select name from student_unified_view limit 100000").endswith(f"limit {ROW_CAP + 1}"))


if __name__ == "__main__":
    unittest.main()
