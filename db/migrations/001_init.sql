-- Elevra.ai schema v1. Owner: Aayush (Lane A). Never edit after it has run; add 002_*.sql instead.
-- Run in the Supabase SQL editor (or: psql "$SUPABASE_DB_URL" -f db/migrations/001_init.sql)

-- ---------- Reference tables ----------
create table if not exists faculty (
  faculty_id   text primary key,
  name         text not null,
  department   text not null,
  email        text unique
);

create table if not exists students (
  student_id         text primary key,                 -- canonical 5-digit id, e.g. '42178'
  name               text not null,
  department         text not null check (department in ('Comp','IT','ENTC','AI&DS')),
  year               int  not null check (year between 1 and 4),
  batch              text not null,                    -- e.g. '2023-27'
  section            text,
  gender             text,
  residence          text check (residence in ('Hostel','Day Scholar')),
  mentor_faculty_id  text references faculty(faculty_id),
  email              text unique
);

create table if not exists users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique not null,
  role        text not null check (role in ('admin','faculty','student')),
  student_id  text references students(student_id),
  faculty_id  text references faculty(faculty_id),
  created_at  timestamptz not null default now()
);

-- ---------- Cleaned source tables (written by pipeline/seed.py) ----------
create table if not exists academics (
  student_id     text references students(student_id) on delete cascade,
  semester       int  not null,
  sgpa           numeric(4,2),
  cgpa           numeric(4,2),
  backlogs       int  not null default 0,
  subject_marks  jsonb,                                 -- [{subject, internal, external, total, passed}]
  primary key (student_id, semester)
);

create table if not exists attendance (
  student_id      text references students(student_id) on delete cascade,
  semester        int  not null,
  subject         text not null,
  attendance_pct  numeric(5,2),
  primary key (student_id, semester, subject)
);

create table if not exists lms_activity (
  student_id         text references students(student_id) on delete cascade,
  semester           int not null,
  week               int not null,
  logins             int,
  minutes            int,
  assignments_done   int,
  assignments_total  int,
  on_time            int,
  primary key (student_id, semester, week)
);

create table if not exists engagement (
  id          bigserial primary key,
  student_id  text references students(student_id) on delete cascade,
  type        text not null check (type in ('event','club','hackathon','certification')),
  name        text not null,
  date        date,
  verified    boolean not null default true
);

create table if not exists placement (
  student_id          text primary key references students(student_id) on delete cascade,
  aptitude            numeric(5,1),
  coding              numeric(5,1),
  mock_interview_avg  numeric(3,1),                     -- 1-5; updated by mock interviews
  mock_count          int not null default 0
);

create table if not exists skills (
  student_id  text references students(student_id) on delete cascade,
  skill       text not null,
  category    text not null check (category in ('technical','soft')),
  level       numeric(5,1),                             -- normalised 0-100
  primary key (student_id, skill)
);

create table if not exists feedback (
  student_id      text references students(student_id) on delete cascade,
  semester        int not null,
  satisfaction    numeric(3,1),
  faculty_rating  numeric(3,1),
  comment         text,
  primary key (student_id, semester)
);

-- ---------- Pipeline outputs ----------
create table if not exists scores (
  student_id          text primary key references students(student_id) on delete cascade,
  semester            int not null,
  success_score       numeric(5,1) not null,
  band                text not null,
  confidence          int not null,
  academic            numeric(5,1),
  attendance          numeric(5,1),
  lms                 numeric(5,1),
  placement           numeric(5,1),
  skills              numeric(5,1),
  engagement          numeric(5,1),
  feedback            numeric(5,1),
  academic_risk       text not null check (academic_risk in ('Red','Amber','Green')),
  academic_risk_prob  numeric(4,3),
  placement_risk      text not null check (placement_risk in ('Red','Amber','Green','Not assessed')),
  segment             text not null,
  priority            numeric(5,1) not null default 0,
  declining           boolean not null default false,
  engagement_drop     boolean not null default false,
  drivers             jsonb not null default '{}'::jsonb,   -- {academic:[...], placement:[...], contributions:[...], model:[...]}
  profile             jsonb not null default '{}'::jsonb,   -- full Student 360 payload (see BUILD_PLAN §4)
  updated_at          timestamptz not null default now()
);
create index if not exists scores_priority_idx on scores (priority desc);
create index if not exists scores_segment_idx on scores (segment);

create table if not exists score_history (
  student_id     text references students(student_id) on delete cascade,
  semester       int not null,
  success_score  numeric(5,1) not null,
  primary key (student_id, semester)
);

create table if not exists analytics (                    -- keys: 'cohort', 'model', 'insights'
  key         text primary key,
  payload     jsonb not null,
  updated_at  timestamptz not null default now()
);

create table if not exists data_quality (
  id             bigserial primary key,
  source         text not null,
  issue          text not null,
  rows_affected  int  not null,
  action         text not null
);

create table if not exists source_stats (
  source                text primary key,
  file                  text not null,
  id_format             text not null,
  rows_in               int  not null,
  rows_out              int  not null,
  students_covered_pct  numeric(5,1) not null
);

-- ---------- App tables ----------
create table if not exists interventions (
  id             bigserial primary key,
  student_id     text not null references students(student_id) on delete cascade,
  faculty_id     text references faculty(faculty_id),
  type           text not null check (type in ('Mentoring call','Remedial classes','Coding bootcamp',
                                               'Attendance counselling','Mock interviews','Wellbeing referral')),
  note           text,
  status         text not null default 'planned' check (status in ('planned','in_progress','done')),
  followup_date  date,
  score_before   numeric(5,1),
  score_after    numeric(5,1),
  is_seeded      boolean not null default false,
  created_at     timestamptz not null default now()
);

create table if not exists notifications (
  id          bigserial primary key,
  created_by  uuid references users(id),
  audience    text not null default 'all',          -- 'all' | 'dept:Comp' | 'year:4' | 'student:42178'
  title       text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists mock_interviews (
  id          bigserial primary key,
  student_id  text not null references students(student_id) on delete cascade,
  transcript  jsonb not null default '[]'::jsonb,
  score       numeric(3,1),                          -- 1-5
  feedback    jsonb,
  created_at  timestamptz not null default now()
);

-- ---------- Unified view (one row per student) ----------
create or replace view student_unified_view as
select
  s.*,
  la.cgpa, la.backlogs, la.sgpa as latest_sgpa,
  att.attendance_pct as current_attendance_pct,
  p.aptitude, p.coding, p.mock_interview_avg, p.mock_count,
  sk.technical_avg, sk.soft_avg,
  en.events, en.clubs, en.hackathons, en.certifications,
  fb.satisfaction, fb.faculty_rating,
  sc.success_score, sc.band, sc.confidence, sc.academic_risk, sc.placement_risk,
  sc.segment, sc.priority, sc.declining, sc.engagement_drop,
  sc.academic, sc.attendance, sc.lms, sc.placement, sc.skills, sc.engagement, sc.feedback
from students s
left join lateral (select a.cgpa, a.backlogs, a.sgpa from academics a
                   where a.student_id = s.student_id and a.sgpa is not null
                   order by a.semester desc limit 1) la on true
left join lateral (select avg(t.attendance_pct)::numeric(5,1) as attendance_pct from attendance t
                   where t.student_id = s.student_id and t.semester = 2 * s.year - 1) att on true
left join placement p on p.student_id = s.student_id
left join lateral (select avg(level) filter (where category = 'technical')::numeric(5,1) as technical_avg,
                          avg(level) filter (where category = 'soft')::numeric(5,1) as soft_avg
                   from skills k where k.student_id = s.student_id) sk on true
left join lateral (select count(*) filter (where type = 'event') as events,
                          count(*) filter (where type = 'club') as clubs,
                          count(*) filter (where type = 'hackathon') as hackathons,
                          count(*) filter (where type = 'certification') as certifications
                   from engagement e where e.student_id = s.student_id and e.verified) en on true
left join lateral (select f.satisfaction, f.faculty_rating from feedback f
                   where f.student_id = s.student_id order by f.semester desc limit 1) fb on true
left join scores sc on sc.student_id = s.student_id;

-- ---------- Row-level security (P0: any logged-in user can read; writes via service role or own rows) ----------
do $$
declare t text;
begin
  foreach t in array array['faculty','students','academics','attendance','lms_activity','engagement','placement',
                           'skills','feedback','scores','score_history','analytics','data_quality','source_stats',
                           'interventions','notifications','mock_interviews','users']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists auth_read on %I', t);
    execute format('create policy auth_read on %I for select to authenticated using (true)', t);
  end loop;
end $$;

create policy faculty_write_interventions on interventions for insert to authenticated with check (true);
create policy faculty_update_interventions on interventions for update to authenticated using (true);
create policy admin_write_notifications on notifications for insert to authenticated with check (true);
-- P1 (002_rls.sql): restrict students to their own rows and faculty to their mentees.
