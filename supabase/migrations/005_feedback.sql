-- ============================================================================
-- 005: Beta-test feedback
-- ============================================================================
-- A floating "Feedback" widget lets testers leave a comment and/or a feature
-- request from any page. We capture the page they were on and how long they'd
-- been in the session, to give context to each note.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  page text,
  session_seconds integer,
  comment text,
  feature_request text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Authenticated testers may submit feedback attributed to themselves.
create policy "Insert own feedback"
  on public.feedback for insert
  with check (auth.uid() = user_id);

-- Testers may read back their own submissions (admin reads via service role).
create policy "Read own feedback"
  on public.feedback for select
  using (auth.uid() = user_id);
