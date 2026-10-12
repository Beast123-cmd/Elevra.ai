-- 002_rls.sql: role-scoped access for app users; service_role keeps its server-side bypass.
--
-- Problem: 001_init.sql let every logged-in user read every row (policy "auth_read" using (true)), so a student
-- login can read all 1,500 students' scores, feedback and interventions, plus the user list. The only thing stopping
-- them was a UI guard.
--
-- Rules implemented here (identity comes from the JWT's app_metadata, which only the service role can set):
--   admin    : read everything; post notifications.
--   faculty  : read only their mentees (students.mentor_faculty_id = their faculty_id) and write interventions for
--              them, as themselves. Read all notifications and aggregate analytics.
--   student  : read only their own rows; no access to interventions (mentor notes can be sensitive); read
--              notifications addressed to them; insert their own feedback.
--   anon / authenticated without a role claim : nothing.
--   service_role (pipeline, FastAPI) bypasses RLS as before.
--
-- Revert: re-create the P0 policies, i.e. for each table
--   create policy auth_read on <table> for select to authenticated using (true);
-- and `alter view public.student_unified_view reset (security_invoker);`.
--
-- Safe to run more than once. Test with db/tests/002_rls.test.sql (runs in a transaction and rolls back).

-- Keep SECURITY DEFINER helpers outside the exposed API schema. Only authenticated
-- requests can invoke the two policy helpers, and each checks auth.uid() explicitly.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.jwt_role() returns text
language sql stable set search_path = pg_catalog
as $$ select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') $$;

create or replace function private.jwt_student_id() returns text
language sql stable set search_path = pg_catalog
as $$ select auth.jwt() -> 'app_metadata' ->> 'student_id' $$;

create or replace function private.jwt_faculty_id() returns text
language sql stable set search_path = pg_catalog
as $$ select auth.jwt() -> 'app_metadata' ->> 'faculty_id' $$;

-- SECURITY DEFINER is required for the mentor lookup because students RLS would
-- otherwise hide the lookup row. All object references are schema-qualified.
create or replace function private.can_see_student(sid text) returns boolean
language sql stable security definer set search_path = pg_catalog as $$
  select auth.uid() is not null and case private.jwt_role()
    when 'admin'   then true
    when 'faculty' then exists (select 1 from public.students s
                                 where s.student_id = sid and s.mentor_faculty_id = private.jwt_faculty_id())
    when 'student' then sid = private.jwt_student_id()
    else false
  end
$$;

-- Notification audiences: 'all' | 'dept:<name>' | 'year:<n>' | 'student:<id>'.
create or replace function private.notification_visible(aud text) returns boolean
language sql stable security definer set search_path = pg_catalog as $$
  select auth.uid() is not null and case
    when private.jwt_role() in ('admin', 'faculty') then true
    when private.jwt_role() <> 'student' then false
    when aud = 'all' then true
    else exists (
      select 1 from public.students s
       where s.student_id = private.jwt_student_id()
         and ( (aud like 'dept:%'    and s.department = substr(aud, 6))
            or (aud like 'year:%'    and s.year::text = substr(aud, 6))
            or (aud like 'student:%' and s.student_id = substr(aud, 9)) ))
  end
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.jwt_role(), private.jwt_student_id(), private.jwt_faculty_id() to authenticated;
grant execute on function private.can_see_student(text), private.notification_visible(text) to authenticated;

-- ---------- remove the permissive P0 policies ----------
do $$
declare t text;
begin
  foreach t in array array['faculty','students','academics','attendance','lms_activity','engagement','placement',
                           'skills','feedback','scores','score_history','analytics','data_quality','source_stats',
                           'interventions','notifications','mock_interviews','users']
  loop
    execute format('drop policy if exists auth_read on %I', t);
  end loop;
end $$;
drop policy if exists faculty_write_interventions  on interventions;
drop policy if exists faculty_update_interventions on interventions;
drop policy if exists admin_write_notifications    on notifications;

-- ---------- per-student data: admin = all, faculty = their mentees, student = self ----------
do $$
declare t text;
begin
  foreach t in array array['students','academics','attendance','lms_activity','engagement','placement','skills',
                           'feedback','scores','score_history','mock_interviews']
  loop
    execute format('drop policy if exists rls_read on %I', t);
    execute format('create policy rls_read on %I for select to authenticated using (private.can_see_student(student_id))', t);
  end loop;
end $$;

-- The unified view must respect the caller's RLS, otherwise it would run with the owner's rights and leak everything.
alter view public.student_unified_view set (security_invoker = true);

-- ---------- reference and aggregate data: readable only by app roles ----------
do $$
declare t text;
begin
  foreach t in array array['faculty','analytics','data_quality','source_stats']
  loop
    execute format('drop policy if exists rls_read on %I', t);
    execute format('create policy rls_read on %I for select to authenticated using (private.jwt_role() in (''admin'', ''faculty'', ''student''))', t);
  end loop;
end $$;

-- ---------- users: admin sees all accounts, everyone else only their own ----------
drop policy if exists rls_read on users;
create policy rls_read on users for select to authenticated using (private.jwt_role() = 'admin' or id = auth.uid());

-- ---------- interventions: mentor/admin only; faculty write as themselves for their mentees ----------
drop policy if exists rls_read   on interventions;
drop policy if exists rls_insert on interventions;
drop policy if exists rls_update on interventions;
create policy rls_read on interventions for select to authenticated
  using (private.jwt_role() in ('admin', 'faculty') and private.can_see_student(student_id));
create policy rls_insert on interventions for insert to authenticated
  with check (private.jwt_role() in ('admin', 'faculty') and private.can_see_student(student_id)
              and (private.jwt_role() = 'admin' or faculty_id = private.jwt_faculty_id()));
create policy rls_update on interventions for update to authenticated
  using (private.jwt_role() in ('admin', 'faculty') and private.can_see_student(student_id))
  with check (private.jwt_role() in ('admin', 'faculty') and private.can_see_student(student_id)
              and (private.jwt_role() = 'admin' or faculty_id = private.jwt_faculty_id()));

-- ---------- notifications: admin posts; students see only those addressed to them ----------
drop policy if exists rls_read   on notifications;
drop policy if exists rls_insert on notifications;
create policy rls_read on notifications for select to authenticated using (private.notification_visible(audience));
create policy rls_insert on notifications for insert to authenticated
  with check (private.jwt_role() = 'admin' and (created_by is null or created_by = auth.uid()));

-- ---------- student feedback form: a student may add feedback for themselves only ----------
drop policy if exists rls_insert_own on feedback;
create policy rls_insert_own on feedback for insert to authenticated
  with check (private.jwt_role() = 'student' and student_id = private.jwt_student_id());

-- Reset broad default grants as well as row policies. service_role grants are untouched.
revoke all privileges on table public.faculty, public.students, public.academics, public.attendance,
  public.lms_activity, public.engagement, public.placement, public.skills, public.feedback, public.scores,
  public.score_history, public.analytics, public.data_quality, public.source_stats, public.interventions,
  public.notifications, public.mock_interviews, public.users, public.student_unified_view
  from anon, authenticated;

grant select on table public.faculty, public.students, public.academics, public.attendance,
  public.lms_activity, public.engagement, public.placement, public.skills, public.feedback, public.scores,
  public.score_history, public.analytics, public.data_quality, public.source_stats, public.interventions,
  public.notifications, public.mock_interviews, public.users, public.student_unified_view
  to authenticated;
grant insert, update on table public.interventions to authenticated;
grant insert on table public.notifications, public.feedback to authenticated;

do $$
declare seq_name text := pg_get_serial_sequence('public.interventions', 'id');
begin
  if seq_name is not null then
    execute format('grant usage, select on sequence %s to authenticated', seq_name);
  end if;
end $$;

-- Remove legacy exposed helpers if an earlier proposal copy was applied manually.
drop function if exists public.can_see_student(text);
drop function if exists public.notification_visible(text);
drop function if exists public.jwt_student_id();
drop function if exists public.jwt_faculty_id();
drop function if exists public.jwt_role();
