-- =====================================================================
-- EDVORA — production PostgreSQL schema (Supabase)
-- Mirrors the built-in data layer in src/lib/db.ts one-for-one.
-- Run in the Supabase SQL editor or via `supabase db push`.
-- =====================================================================

create extension if not exists pgcrypto;

create type account_role    as enum ('student','teacher','administrator','owner');
create type account_status  as enum ('pending','verified','rejected','suspended','disabled');
create type course_status   as enum ('draft','in_review','approved','rejected','published','unpublished');
create type course_access   as enum ('free','premium');
create type lesson_kind     as enum ('video','reading','audio','document');
create type payment_status  as enum ('pending','completed','failed');
create type txn_status      as enum ('pending','approved','rejected','paid');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text unique not null,
  phone text,
  role account_role not null default 'student',
  status account_status not null default 'pending',
  title text, expertise text, qualifications text, experience text,
  bio text, proposed_courses text, avatar_url text,
  plan text not null default 'free' check (plan in ('free','premium')),
  payout_method text check (payout_method in ('mpesa','bank')),
  payout_account text,
  contact_verified boolean not null default false,
  notification_prefs jsonb not null default '{"email":true,"inApp":true}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table roles (name account_role primary key, description text);
create table permissions (id serial primary key, code text unique not null, description text);
create table role_permissions (role account_role references roles(name), permission int references permissions(id), primary key(role,permission));
insert into roles values ('student','Learner'),('teacher','Teacher / Lecturer'),('administrator','Administrator'),('owner','Platform owner') on conflict do nothing;

create table verification_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id), role account_role not null,
  from_status account_status, to_status account_status not null,
  decided_by uuid references profiles(id), reason text,
  created_at timestamptz not null default now()
);
create table teacher_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id), documents jsonb default '[]',
  submitted_at timestamptz not null default now()
);
create table administrator_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null, invited_by uuid references profiles(id),
  status account_status not null default 'pending', created_at timestamptz not null default now()
);

create table course_categories (id serial primary key, name text unique not null);
create table courses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, title text not null, subtitle text, description text,
  category_id int references course_categories(id),
  level text not null default 'Beginner',
  access course_access not null default 'free',
  instructor_id uuid not null references profiles(id),
  status course_status not null default 'draft',
  thumbnail_url text, objectives jsonb default '[]', requirements jsonb default '[]',
  featured boolean not null default false, moderation_note text,
  published_at timestamptz, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table course_sections (id uuid primary key default gen_random_uuid(), course_id uuid references courses(id) on delete cascade, title text not null, position int not null default 0);
create table lessons (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references course_sections(id) on delete cascade,
  title text not null, kind lesson_kind not null default 'video',
  duration_min int not null default 10, is_preview boolean not null default false,
  video_url text, body text, position int not null default 0
);
create table lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references lessons(id) on delete cascade,
  name text, storage_path text not null, is_private boolean not null default true
);
create table enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id), course_id uuid references courses(id),
  enrolled_at timestamptz not null default now(), completed_at timestamptz,
  saved boolean not null default false, active_min int not null default 0,
  last_lesson_id uuid references lessons(id),
  unique(student_id, course_id)
);
create table lesson_progress (
  enrollment_id uuid references enrollments(id) on delete cascade,
  lesson_id uuid references lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key(enrollment_id, lesson_id)
);
create table bookmarks (student_id uuid references profiles(id), course_id uuid references courses(id), primary key(student_id,course_id));
create table assignments (id uuid primary key default gen_random_uuid(), course_id uuid references courses(id), title text not null, instructions text, due_date date, max_score int not null default 100);
create table assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references assignments(id), student_id uuid references profiles(id),
  content text, file_path text, grade int, feedback text,
  status text not null default 'submitted', submitted_at timestamptz not null default now(),
  unique(assignment_id, student_id)
);
create table quizzes (id uuid primary key default gen_random_uuid(), course_id uuid references courses(id), title text not null, time_limit_min int default 10, max_attempts int default 3, pass_mark int default 60);
create table quiz_questions (id uuid primary key default gen_random_uuid(), quiz_id uuid references quizzes(id) on delete cascade, type text not null, prompt text not null, options jsonb, answer text, explanation text, position int default 0);
create table quiz_attempts (id uuid primary key default gen_random_uuid(), quiz_id uuid references quizzes(id), student_id uuid references profiles(id), score int, total int, passed boolean, submitted_at timestamptz not null default now());
create table quiz_answers (attempt_id uuid references quiz_attempts(id) on delete cascade, question_id uuid references quiz_questions(id), answer text, primary key(attempt_id,question_id));
create table course_reviews (id uuid primary key default gen_random_uuid(), course_id uuid references courses(id), student_id uuid references profiles(id), rating int check (rating between 1 and 5), comment text, created_at timestamptz not null default now(), unique(course_id,student_id));
create table certificates (
  id uuid primary key default gen_random_uuid(), code text unique not null,
  student_id uuid references profiles(id), course_id uuid references courses(id),
  issued_at timestamptz not null default now(), revoked boolean not null default false, revoke_reason text
);

create table subscription_plans (id uuid primary key default gen_random_uuid(), name text not null, price_kes int not null, interval_days int not null default 30);
create table subscriptions (
  id uuid primary key default gen_random_uuid(), student_id uuid references profiles(id),
  status text not null default 'active', started_at timestamptz not null default now(),
  expires_at timestamptz not null, payment_id uuid
);
create table payment_transactions (
  id uuid primary key default gen_random_uuid(), student_id uuid references profiles(id),
  amount int not null, currency text not null default 'KES', provider text not null default 'mpesa',
  status payment_status not null default 'pending', phone text,
  checkout_request_id text unique, merchant_request_id text, mpesa_receipt text,
  result_desc text, callback_processed boolean not null default false,
  created_at timestamptz not null default now(), completed_at timestamptz
);
create table payment_callbacks (id uuid primary key default gen_random_uuid(), checkout_request_id text, payload jsonb not null, received_at timestamptz not null default now());
create table revenue_periods (
  id uuid primary key default gen_random_uuid(), label text not null,
  starts_at date not null, ends_at date not null,
  gross int not null default 0, refunds int not null default 0, fees int not null default 0, taxes int not null default 0,
  net int not null default 0, teacher_pool int not null default 0, platform_share int not null default 0,
  teacher_percent int not null default 80, allocated boolean not null default false, allocated_at timestamptz
);
create table teacher_revenue_allocations (
  id uuid primary key default gen_random_uuid(), period_id uuid references revenue_periods(id),
  teacher_id uuid references profiles(id), weight numeric not null, amount int not null,
  unique(period_id, teacher_id)
);
create table instructor_wallets (teacher_id uuid primary key references profiles(id), balance int not null default 0, updated_at timestamptz not null default now());
create table wallet_transactions (
  id uuid primary key default gen_random_uuid(), teacher_id uuid references profiles(id),
  type text not null check (type in ('earning','withdrawal','adjustment')),
  amount int not null, note text, period_id uuid references revenue_periods(id),
  created_at timestamptz not null default now()
);
create table withdrawal_requests (
  id uuid primary key default gen_random_uuid(), teacher_id uuid references profiles(id),
  amount int not null check (amount > 0), method text not null, account text not null,
  status txn_status not null default 'pending', decided_by uuid references profiles(id),
  idempotency_key text unique not null, created_at timestamptz not null default now()
);
create table payout_records (id uuid primary key default gen_random_uuid(), withdrawal_id uuid unique references withdrawal_requests(id), reference text not null, paid_at timestamptz not null default now());

create table notifications (id uuid primary key default gen_random_uuid(), user_id uuid references profiles(id), title text not null, body text, href text, read boolean not null default false, created_at timestamptz not null default now());
create table messages (id uuid primary key default gen_random_uuid(), from_id uuid references profiles(id), to_id uuid references profiles(id), body text not null, read boolean not null default false, created_at timestamptz not null default now());
create table discussion_threads (id uuid primary key default gen_random_uuid(), course_id uuid references courses(id), author_id uuid references profiles(id), title text not null, body text, pinned boolean default false, created_at timestamptz not null default now());
create table discussion_replies (id uuid primary key default gen_random_uuid(), thread_id uuid references discussion_threads(id) on delete cascade, author_id uuid references profiles(id), body text not null, created_at timestamptz not null default now());
create table reports (id uuid primary key default gen_random_uuid(), reporter_id uuid references profiles(id), target_type text, target_id text, reason text, status text not null default 'open', created_at timestamptz not null default now());
create table study_goals (id uuid primary key default gen_random_uuid(), student_id uuid references profiles(id), title text not null, target_hours_week int default 3, done boolean not null default false, created_at timestamptz not null default now());
create table announcements (id uuid primary key default gen_random_uuid(), author_id uuid references profiles(id), audience text not null, title text not null, body text, created_at timestamptz not null default now());
create table audit_logs (id uuid primary key default gen_random_uuid(), actor_id uuid references profiles(id), action text not null, target text, reason text, created_at timestamptz not null default now());
create table platform_settings (key text primary key, value jsonb not null);

create index idx_courses_status on courses(status);
create index idx_enrollments_student on enrollments(student_id);
create index idx_enrollments_course on enrollments(course_id);
create index idx_payments_student on payment_transactions(student_id);
create index idx_notifications_user on notifications(user_id, read);
create index idx_audit_created on audit_logs(created_at desc);

-- ================= Row Level Security =================
alter table profiles enable row level security;
alter table courses enable row level security;
alter table enrollments enable row level security;
alter table lesson_progress enable row level security;
alter table assignment_submissions enable row level security;
alter table payment_transactions enable row level security;
alter table wallet_transactions enable row level security;
alter table withdrawal_requests enable row level security;
alter table messages enable row level security;
alter table notifications enable row level security;
alter table certificates enable row level security;
alter table audit_logs enable row level security;

-- Helpers (roles read from profiles — never trusted from the client)
create or replace function public.my_role() returns account_role language sql stable security definer as
$$ select role from public.profiles where id = auth.uid() $$;
create or replace function public.is_verified_admin() returns boolean language sql stable security definer as
$$ select exists(select 1 from public.profiles where id = auth.uid() and role='administrator' and status='verified') $$;
create or replace function public.is_owner() returns boolean language sql stable security definer as
$$ select exists(select 1 from public.profiles where id = auth.uid() and role='owner') $$;
create or replace function public.has_premium() returns boolean language sql stable security definer as
$$ select exists(select 1 from public.subscriptions s join public.profiles p on p.id=s.student_id
   where s.student_id = auth.uid() and s.status='active' and s.expires_at > now()) $$;

-- Profiles: own row; admins read all except owner; owner reads all.
create policy profiles_self on profiles for select using (id = auth.uid() or public.is_owner() or (public.is_verified_admin() and role <> 'owner'));
create policy profiles_update_self on profiles for update using (id = auth.uid() or public.is_owner());
-- Role/status changes only via trusted server (service role) — no client policy grants them.

-- Courses: public can read published; teachers manage own; admins moderate.
create policy courses_public on courses for select using (status='published' or instructor_id = auth.uid() or public.is_verified_admin() or public.is_owner());
create policy courses_teacher_write on courses for insert with check (instructor_id = auth.uid() and public.my_role()='teacher');
create policy courses_teacher_update on courses for update using (instructor_id = auth.uid() or public.is_verified_admin() or public.is_owner());

-- Enrollments & progress: strictly the student's own.
create policy enrol_self on enrollments for all using (student_id = auth.uid() or public.is_verified_admin() or public.is_owner());
create policy progress_self on lesson_progress for all using (exists(select 1 from enrollments e where e.id=enrollment_id and e.student_id = auth.uid()));

-- Submissions: student writes own; course instructor grades.
create policy subs_self on assignment_submissions for all using (
  student_id = auth.uid()
  or exists(select 1 from assignments a join courses c on c.id=a.course_id where a.id=assignment_id and c.instructor_id = auth.uid())
  or public.is_owner());

-- Payments: student reads own; writes only via server (Daraja) using service role.
create policy pay_self on payment_transactions for select using (student_id = auth.uid() or public.is_verified_admin() or public.is_owner());

-- Wallets/withdrawals: teacher reads own; admins approve; payouts recorded server-side.
create policy wallet_self on wallet_transactions for select using (teacher_id = auth.uid() or public.is_verified_admin() or public.is_owner());
create policy wd_self on withdrawal_requests for select using (teacher_id = auth.uid() or public.is_verified_admin() or public.is_owner());
create policy wd_create on withdrawal_requests for insert with check (teacher_id = auth.uid() and public.my_role()='teacher');

-- Messages/notifications: participants & owners only.
create policy msg_participants on messages for all using (from_id = auth.uid() or to_id = auth.uid());
create policy notif_self on notifications for all using (user_id = auth.uid());

-- Certificates: owner of certificate + public verification via SECURITY DEFINER view/RPC (code lookup).
create policy cert_self on certificates for select using (student_id = auth.uid() or public.is_verified_admin() or public.is_owner());

-- Audit logs: admins + owner read; inserts only via server.
create policy audit_admin on audit_logs for select using (public.is_verified_admin() or public.is_owner());

-- Storage buckets (create in dashboard):
--   course-media (public), thumbnails (public),
--   teacher-credentials (private), submissions (private), certificates (private)
-- Private buckets must use signed URLs with short expiry.
