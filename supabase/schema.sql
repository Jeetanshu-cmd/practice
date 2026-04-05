create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  storage_path text not null,
  analysis_status text not null default 'processing',
  summary_json jsonb not null default '{"critical":[],"moderate":[],"elevated":[]}'::jsonb,
  uploaded_at timestamptz not null default now()
);

create table if not exists public.report_metrics (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  metric_name text not null,
  value text,
  unit text,
  severity text not null default 'moderate',
  summary text,
  tip text,
  created_at timestamptz not null default now()
);

create table if not exists public.report_insights (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  category text not null check (category in ('critical', 'moderate', 'elevated')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Dr.AI conversation',
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.report_metrics enable row level security;
alter table public.report_insights enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id);

drop policy if exists "reports_all_own" on public.reports;
create policy "reports_all_own" on public.reports
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "report_metrics_select_own" on public.report_metrics;
create policy "report_metrics_select_own" on public.report_metrics
for select using (
  exists (
    select 1 from public.reports r
    where r.id = report_metrics.report_id and r.user_id = auth.uid()
  )
);

drop policy if exists "report_metrics_modify_own" on public.report_metrics;
create policy "report_metrics_modify_own" on public.report_metrics
for all using (
  exists (
    select 1 from public.reports r
    where r.id = report_metrics.report_id and r.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.reports r
    where r.id = report_metrics.report_id and r.user_id = auth.uid()
  )
);

drop policy if exists "report_insights_all_own" on public.report_insights;
create policy "report_insights_all_own" on public.report_insights
for all using (
  exists (
    select 1 from public.reports r
    where r.id = report_insights.report_id and r.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.reports r
    where r.id = report_insights.report_id and r.user_id = auth.uid()
  )
);

drop policy if exists "chat_sessions_all_own" on public.chat_sessions;
create policy "chat_sessions_all_own" on public.chat_sessions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "chat_messages_all_own" on public.chat_messages;
create policy "chat_messages_all_own" on public.chat_messages
for all using (
  exists (
    select 1 from public.chat_sessions s
    where s.id = chat_messages.session_id and s.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.chat_sessions s
    where s.id = chat_messages.session_id and s.user_id = auth.uid()
  )
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;

drop policy if exists "reports_bucket_select_own" on storage.objects;
create policy "reports_bucket_select_own" on storage.objects
for select using (bucket_id = 'reports' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "reports_bucket_insert_own" on storage.objects;
create policy "reports_bucket_insert_own" on storage.objects
for insert with check (bucket_id = 'reports' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "reports_bucket_update_own" on storage.objects;
create policy "reports_bucket_update_own" on storage.objects
for update using (bucket_id = 'reports' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "reports_bucket_delete_own" on storage.objects;
create policy "reports_bucket_delete_own" on storage.objects
for delete using (bucket_id = 'reports' and auth.uid()::text = (storage.foldername(name))[1]);
