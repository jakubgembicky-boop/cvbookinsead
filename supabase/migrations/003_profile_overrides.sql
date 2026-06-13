-- ============================================================================
-- 003: Per-user profile overrides
-- ============================================================================
-- A single jsonb column holds any field the user edits (name, about, skills,
-- experience, education, contact, etc.). The directory/modal renders the base
-- CV+LinkedIn data with this overlay applied on top, so a user can correct or
-- enrich every element of their own profile without altering the source CV.

alter table public.profiles
  add column if not exists overrides jsonb not null default '{}'::jsonb;
