-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- profiles table (linked to auth.users)
create table public.profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade unique,
  insead_email text not null unique,
  first_name text not null,
  last_name text not null,
  display_name text generated always as (first_name || ' ' || last_name) stored,
  phone text,
  personal_email text,
  linkedin_url text,
  photo_url text,
  li_headline text,
  li_location text,
  li_about text,
  languages text[] default '{}',
  nationality text,
  profile_completed_at timestamptz,
  onboarding_step int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- audit log
create table public.profile_audit_log (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references public.profiles(id) on delete cascade,
  field_name text not null,
  old_value text,
  new_value text,
  changed_at timestamptz default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.profile_audit_log enable row level security;

create policy "Users can view all profiles" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = user_id);
create policy "Users can view own audit log" on public.profile_audit_log for select using (
  profile_id in (select id from public.profiles where user_id = auth.uid())
);

-- updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function update_updated_at();

-- Indexes for common queries
create index profiles_insead_email_idx on public.profiles (insead_email);
create index profiles_user_id_idx on public.profiles (user_id);
create index profiles_last_name_idx on public.profiles (last_name);
