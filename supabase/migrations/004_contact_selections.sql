-- ============================================================================
-- 004: Personal contact book selections
-- ============================================================================
-- Each user picks the classmates they want in their own contact book and
-- downloads a personal .vcf. Keyed by the classmate's INSEAD email (the
-- stable anchor from the CV book) rather than a profiles FK, because most
-- classmates have no profiles row until they register.

create table if not exists public.contact_selections (
  user_id uuid not null references auth.users (id) on delete cascade,
  contact_email text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, contact_email)
);

alter table public.contact_selections enable row level security;

create policy "Users manage own selections — select"
  on public.contact_selections for select
  using (auth.uid() = user_id);

create policy "Users manage own selections — insert"
  on public.contact_selections for insert
  with check (auth.uid() = user_id);

create policy "Users manage own selections — delete"
  on public.contact_selections for delete
  using (auth.uid() = user_id);
