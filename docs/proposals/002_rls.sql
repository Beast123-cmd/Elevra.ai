-- 002_rls.sql  (PROPOSAL for Aayush, who owns db/migrations. Move to db/migrations/002_rls.sql after review.)
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
-- and `alter view student_unified_view reset (security_invoker);`.
--
-- Safe to run more than once. Test with docs/proposals/002_rls.test.sql (runs in a transaction and rolls back).

-- ---------- identity helpers (read the caller's JWT) ----------
create or replace function public.jwt_role() returns text
language sql stable as $$ select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') $$;

create or replace function public.jwt_student_id() returns text
language sql stable as $$ select auth.jwt() -> 'app_metadata' ->> 'student_id' $$;

create or replace function public.jwt_faculty_id() returns text
language sql stable as $$ select auth.jwt() -> 'app_metadata' ->> 'faculty_id' $$;

-- May the caller see data about this student? SECURITY DEFINER so the mentor lookup is not itself filtered by RLS.
create or replace function public.can_see_student(sid text) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.jwt_role()
    when 'admin'   then true
    when 'faculty' then exists (select 1 from public.students s
                                 where s.student_id = sid and s.mentor_faculty_id = public.jwt_faculty_id())
    when 'student' then sid = public.jwt_student_id()
    else false
  end
$$;

-- Notification audiences: 'all' | 'dept:<name>' | 'year:<n>' | 'student:<id>' (same format as the web app).
create or replace function public.notification_visible(aud text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.jwt_role() in ('admin', 'faculty') then true
    when public.jwt_role() <> 'student' then false
    when aud = 'all' then true
    else exists (
      select 1 from public.students s
       where s.student_id = public.jwt_student_id()
         and ( (aud like 'dept:%'    and s.department = substr(aud, 6))
            or (aud like 'year:%'    and s.year::text = substr(aud, 6))
            or (aud like 'student:%' and s.student_id = substr(aud, 9)) ))
  end
$$;

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
    execute format('create policy rls_read on %I for select to authenticated using (public.can_see_student(student_id))', t);
  end loop;
end $$;

-- The unified view must respect the caller's RLS, otherwise it would run with the owner's rights and leak everything.
alter view public.student_unified_view set (security_invoker = true);

-- ---------- reference and aggregate data: readable by any logged-in user (no per-student detail) ----------
do $$
declare t text;
begin
  foreach t in array array['faculty','analytics','data_quality','source_stats']
  loop
    execute format('drop policy if exists rls_read on %I', t);
    execute format('create policy rls_read on %I for select to authenticated using (true)', t);
  end loop;
end $$;

-- ---------- users: admin sees all accounts, everyone else only their own ----------
drop policy if exists rls_read on users;
create policy rls_read on users for select to authenticated using (public.jwt_role() = 'admin' or id = auth.uid());

-- ---------- interventions: mentor/admin only; faculty write as themselves for their mentees ----------
drop policy if exists rls_read   on interventions;
drop policy if exists rls_insert on interventions;
drop policy if exists rls_update on interventions;
create policy rls_read on interventions for select to authenticated
  using (public.jwt_role() in ('admin', 'faculty') and public.can_see_student(student_id));
create policy rls_insert on interventions for insert to authenticated
  with check (public.jwt_role() in ('admin', 'faculty') and public.can_see_student(student_id)
              and (public.jwt_role() = 'admin' or faculty_id = public.jwt_faculty_id()));
create policy rls_update on interventions for update to authenticated
  using (public.jwt_role() in ('admin', 'faculty') and public.can_see_student(student_id))
  with check (public.jwt_role() in ('admin', 'faculty') and public.can_see_student(student_id)
              and (public.jwt_role() = 'admin' or faculty_id = public.jwt_faculty_id()));

-- ---------- notifications: admin posts; students see only those addressed to them ----------
drop policy if exists rls_read   on notifications;
drop policy if exists rls_insert on notifications;
create policy rls_read on notifications for select to authenticated using (public.notification_visible(audience));
create policy rls_insert on notifications for insert to authenticated
  with check (public.jwt_role() = 'admin' and (created_by is null or created_by = auth.uid()));

-- ---------- student feedback form: a student may add feedback for themselves only ----------
drop policy if exists rls_insert_own on feedback;
create policy rls_insert_own on feedback for insert to authenticated
  with check (public.jwt_role() = 'student' and student_id = public.jwt_student_id());
