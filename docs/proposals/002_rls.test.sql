-- 002_rls.test.sql: behavioural test for db/migrations/002_rls.sql. Run INSIDE a transaction that you roll back
-- (docs/proposals/run_rls_test.py does this for you):
--   begin;  [\i db/migrations/002_rls.sql]  \i 002_rls.test.sql  select * from rlstest.res order by n;  rollback;
-- It builds its own fixtures (notifications, interventions) and impersonates users by setting the role and JWT claims,
-- exactly as PostgREST does. Needs the seeded demo accounts (admin@, faculty1@, student.red@demo.edu).

create schema rlstest;
grant usage on schema rlstest to public;
create table rlstest.res(n serial, label text, got text, want text, ok boolean);
grant all on rlstest.res to public;
grant usage, select on all sequences in schema rlstest to public;

create function rlstest.expect(lbl text, got text, want text) returns void language sql as
$$ insert into rlstest.res(label, got, want, ok) values (lbl, got, want, got is not distinct from want) $$;
create function rlstest.cnt(q text) returns int language plpgsql as
$$ declare n int; begin execute 'select count(*) from (' || q || ') x' into n; return n;
   exception when others then return -1; end $$;
create function rlstest.try(q text) returns text language plpgsql as
$$ declare n int; begin execute q; get diagnostics n = row_count; return 'ok:' || n;
   exception when insufficient_privilege then return 'denied';
             when others then return 'error:' || sqlstate; end $$;
create function rlstest.act(r text, claims jsonb) returns void language plpgsql as
$$ begin reset role; execute format('set local role %I', r); perform set_config('request.jwt.claims', claims::text, true); end $$;
grant execute on all functions in schema rlstest to public;

do $test$
declare
  admin_uid uuid; fac_uid uuid; stu_uid uuid; fid text; sid text; s_dept text; s_year int;
  mentee text; stranger text; other_fid text; iv_m bigint; iv_s bigint;
  t_students int; t_scores int; t_iv int; t_users int; t_notif int; t_fac int;
  m_cnt int; m_iv int; m_fb int; s_fb int; r text; n int;
  c_admin jsonb; c_fac jsonb; c_stu jsonb; c_none jsonb;
begin
  select id into admin_uid from public.users where role = 'admin' order by email limit 1;
  select id, faculty_id into fac_uid, fid from public.users where role = 'faculty' order by email limit 1;
  select id, student_id into stu_uid, sid from public.users where email = 'student.red@demo.edu';
  if admin_uid is null or fac_uid is null or stu_uid is null then raise exception 'seed the demo accounts first'; end if;
  select department, year into s_dept, s_year from public.students where student_id = sid;
  select student_id into mentee   from public.students where mentor_faculty_id = fid and student_id <> sid order by 1 limit 1;
  select student_id into stranger from public.students where mentor_faculty_id <> fid and student_id <> sid order by 1 limit 1;
  select faculty_id into other_fid from public.faculty where faculty_id <> fid order by 1 limit 1;

  -- fixtures (as the table owner, who bypasses RLS)
  insert into public.notifications(audience, title, body) values
    ('all', 'RLSTEST all', 'x'), ('dept:' || s_dept, 'RLSTEST dept match', 'x'), ('dept:ZZZ', 'RLSTEST dept other', 'x'),
    ('year:' || s_year, 'RLSTEST year match', 'x'), ('year:' || (case when s_year = 4 then 2 else 4 end), 'RLSTEST year other', 'x'),
    ('student:' || sid, 'RLSTEST self', 'x'), ('student:99999', 'RLSTEST other student', 'x');
  insert into public.interventions(student_id, faculty_id, type, status) values (mentee, fid, 'Mentoring call', 'planned') returning id into iv_m;
  insert into public.interventions(student_id, faculty_id, type, status) values (stranger, other_fid, 'Mentoring call', 'planned') returning id into iv_s;

  select count(*) into t_students from public.students;  select count(*) into t_scores from public.scores;
  select count(*) into t_iv from public.interventions;   select count(*) into t_users from public.users;
  select count(*) into t_notif from public.notifications; select count(*) into t_fac from public.faculty;
  select count(*) into m_cnt from public.students where mentor_faculty_id = fid;
  select count(*) into m_iv from public.interventions i join public.students s using (student_id) where s.mentor_faculty_id = fid;
  select count(*) into m_fb from public.feedback f join public.students s using (student_id) where s.mentor_faculty_id = fid;
  select count(*) into s_fb from public.feedback where student_id = sid;

  c_admin := jsonb_build_object('sub', admin_uid, 'role', 'authenticated', 'app_metadata', jsonb_build_object('role', 'admin'));
  c_fac   := jsonb_build_object('sub', fac_uid, 'role', 'authenticated', 'app_metadata', jsonb_build_object('role', 'faculty', 'faculty_id', fid));
  c_stu   := jsonb_build_object('sub', stu_uid, 'role', 'authenticated', 'app_metadata', jsonb_build_object('role', 'student', 'student_id', sid));
  c_none  := jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'app_metadata', '{}'::jsonb);

  -- ===== anonymous (no login) =====
  perform rlstest.act('anon', '{}'::jsonb);
  foreach r in array array['scores','students','users','interventions','feedback','student_unified_view','analytics','notifications'] loop
    perform rlstest.expect('anon reads nothing: ' || r, (rlstest.cnt('select 1 from public.' || r) <= 0)::text, 'true');
  end loop;

  -- ===== logged in but with no role claim =====
  perform rlstest.act('authenticated', c_none);
  foreach r in array array['scores','students','users','interventions','feedback','student_unified_view','notifications'] loop
    perform rlstest.expect('no-role user reads nothing: ' || r, rlstest.cnt('select 1 from public.' || r)::text, '0');
  end loop;

  -- ===== admin =====
  perform rlstest.act('authenticated', c_admin);
  perform rlstest.expect('admin sees all students',      rlstest.cnt('select 1 from public.students')::text, t_students::text);
  perform rlstest.expect('admin sees all scores',        rlstest.cnt('select 1 from public.scores')::text, t_scores::text);
  perform rlstest.expect('admin sees whole unified view', rlstest.cnt('select 1 from public.student_unified_view')::text, t_students::text);
  perform rlstest.expect('admin sees all interventions', rlstest.cnt('select 1 from public.interventions')::text, t_iv::text);
  perform rlstest.expect('admin sees all users',         rlstest.cnt('select 1 from public.users')::text, t_users::text);
  perform rlstest.expect('admin sees all notifications', rlstest.cnt('select 1 from public.notifications')::text, t_notif::text);

  -- ===== faculty (mentor) =====
  perform rlstest.act('authenticated', c_fac);
  perform rlstest.expect('faculty sees only mentees: students', rlstest.cnt('select 1 from public.students')::text, m_cnt::text);
  perform rlstest.expect('faculty sees only mentees: scores',   rlstest.cnt('select 1 from public.scores')::text, m_cnt::text);
  perform rlstest.expect('faculty sees only mentees: unified view', rlstest.cnt('select 1 from public.student_unified_view')::text, m_cnt::text);
  perform rlstest.expect('faculty queue query (scores join students)', rlstest.cnt('select 1 from public.scores s join public.students t using (student_id) where t.mentor_faculty_id = ' || quote_literal(fid))::text, m_cnt::text);
  perform rlstest.expect('faculty sees mentees interventions only', rlstest.cnt('select 1 from public.interventions')::text, m_iv::text);
  perform rlstest.expect('faculty sees mentees feedback only', rlstest.cnt('select 1 from public.feedback')::text, m_fb::text);
  perform rlstest.expect('faculty can open a mentee profile', rlstest.cnt('select 1 from public.scores where student_id = ' || quote_literal(mentee))::text, '1');
  perform rlstest.expect('faculty cannot open a non-mentee profile', rlstest.cnt('select 1 from public.scores where student_id = ' || quote_literal(stranger))::text, '0');
  perform rlstest.expect('faculty cannot see non-mentee interventions', rlstest.cnt('select 1 from public.interventions where student_id = ' || quote_literal(stranger))::text, '0');
  perform rlstest.expect('faculty sees only their own user row', rlstest.cnt('select 1 from public.users')::text, '1');
  perform rlstest.expect('faculty can read the faculty list', rlstest.cnt('select 1 from public.faculty')::text, t_fac::text);
  perform rlstest.expect('faculty reads all notifications', rlstest.cnt('select 1 from public.notifications')::text, t_notif::text);
  perform rlstest.expect('faculty reads aggregate analytics', (rlstest.cnt('select 1 from public.analytics') > 0)::text, 'true');
  perform rlstest.expect('WRITE faculty logs intervention for mentee as self', rlstest.try(format('insert into public.interventions(student_id, faculty_id, type) values (%L, %L, %L)', mentee, fid, 'Remedial classes')), 'ok:1');
  perform rlstest.expect('WRITE faculty cannot log for a non-mentee', rlstest.try(format('insert into public.interventions(student_id, faculty_id, type) values (%L, %L, %L)', stranger, fid, 'Remedial classes')), 'denied');
  perform rlstest.expect('WRITE faculty cannot forge another faculty id', rlstest.try(format('insert into public.interventions(student_id, faculty_id, type) values (%L, %L, %L)', mentee, other_fid, 'Remedial classes')), 'denied');
  perform rlstest.expect('WRITE faculty updates status of a mentee intervention', rlstest.try(format('update public.interventions set status = %L where id = %s', 'done', iv_m)), 'ok:1');
  perform rlstest.expect('WRITE faculty cannot update a non-mentee intervention', rlstest.try(format('update public.interventions set status = %L where id = %s', 'done', iv_s)), 'ok:0');
  perform rlstest.expect('WRITE faculty cannot delete interventions', (rlstest.try(format('delete from public.interventions where id = %s', iv_m)) in ('denied', 'ok:0'))::text, 'true');
  perform rlstest.expect('WRITE faculty cannot post notifications', rlstest.try('insert into public.notifications(audience, title, body) values (''all'', ''RLSTEST bad'', ''x'')'), 'denied');

  -- ===== student =====
  perform rlstest.act('authenticated', c_stu);
  perform rlstest.expect('student sees only own score',   rlstest.cnt('select 1 from public.scores')::text, '1');
  perform rlstest.expect('student sees only own student row', rlstest.cnt('select 1 from public.students')::text, '1');
  perform rlstest.expect('student sees only own row in unified view', rlstest.cnt('select 1 from public.student_unified_view')::text, '1');
  perform rlstest.expect('student cannot read another student', rlstest.cnt('select 1 from public.scores where student_id = ' || quote_literal(stranger))::text, '0');
  perform rlstest.expect('student cannot read a mentee of someone else', rlstest.cnt('select 1 from public.scores where student_id = ' || quote_literal(mentee))::text, case when mentee = sid then '1' else '0' end);
  perform rlstest.expect('student sees own feedback only', rlstest.cnt('select 1 from public.feedback')::text, s_fb::text);
  perform rlstest.expect('student cannot read interventions (mentor notes)', rlstest.cnt('select 1 from public.interventions')::text, '0');
  perform rlstest.expect('student sees only own user row', rlstest.cnt('select 1 from public.users')::text, '1');
  perform rlstest.expect('student reads aggregate analytics', (rlstest.cnt('select 1 from public.analytics') > 0)::text, 'true');
  perform rlstest.expect('student sees only notifications addressed to them (all, dept, year, self)', rlstest.cnt('select 1 from public.notifications where title like ''RLSTEST%''')::text, '4');
  perform rlstest.expect('WRITE student cannot log an intervention', rlstest.try(format('insert into public.interventions(student_id, faculty_id, type) values (%L, %L, %L)', sid, fid, 'Remedial classes')), 'denied');
  perform rlstest.expect('WRITE student cannot update interventions', (rlstest.try(format('update public.interventions set status = %L where id = %s', 'done', iv_m)) in ('denied', 'ok:0'))::text, 'true');
  perform rlstest.expect('WRITE student cannot post notifications', rlstest.try('insert into public.notifications(audience, title, body) values (''all'', ''RLSTEST bad'', ''x'')'), 'denied');
  perform rlstest.expect('WRITE student can add their own feedback', rlstest.try(format('insert into public.feedback(student_id, semester, satisfaction, faculty_rating) values (%L, 99, 4, 4)', sid)), 'ok:1');
  perform rlstest.expect('WRITE student cannot add feedback for someone else', rlstest.try(format('insert into public.feedback(student_id, semester, satisfaction, faculty_rating) values (%L, 99, 4, 4)', stranger)), 'denied');

  -- ===== admin writes =====
  perform rlstest.act('authenticated', c_admin);
  perform rlstest.expect('WRITE admin posts a notification', rlstest.try(format('insert into public.notifications(audience, title, body, created_by) values (''all'', ''RLSTEST admin'', ''x'', %L)', admin_uid)), 'ok:1');
  perform rlstest.expect('WRITE admin cannot forge created_by', rlstest.try(format('insert into public.notifications(audience, title, body, created_by) values (''all'', ''RLSTEST forged'', ''x'', %L)', fac_uid)), 'denied');
  perform rlstest.expect('WRITE admin logs an intervention for any student', rlstest.try(format('insert into public.interventions(student_id, type) values (%L, %L)', stranger, 'Wellbeing referral')), 'ok:1');

  reset role;
end
$test$;
