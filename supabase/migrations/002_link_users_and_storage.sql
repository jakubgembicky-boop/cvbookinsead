-- ============================================================================
-- 002: Auto-link auth users to migrated profiles + storage policies
-- ============================================================================
-- Run this in the Supabase SQL editor AFTER 001_initial_schema.sql.
-- It makes registration self-healing: when a new auth user is created, their
-- existing migrated profile row (matched by INSEAD email) is linked to them.
-- If no profile exists for that email, a minimal one is created.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Link an existing migrated profile (case-insensitive email match)
  update public.profiles
     set user_id = new.id
   where lower(insead_email) = lower(new.email)
     and user_id is null;

  -- If nothing was linked, create a minimal profile row
  if not found then
    insert into public.profiles (user_id, insead_email, first_name, last_name)
    values (new.id, new.email, '', '')
    on conflict (insead_email)
      do update set user_id = excluded.user_id
      where public.profiles.user_id is null;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Storage: allow authenticated users to upload/replace their own avatar
-- in the public 'profiles' bucket.
-- ============================================================================

-- Public read of avatars
drop policy if exists "Public read profiles bucket" on storage.objects;
create policy "Public read profiles bucket"
  on storage.objects for select
  using (bucket_id = 'profiles');

-- Authenticated users can upload to the profiles bucket
drop policy if exists "Authenticated upload profiles bucket" on storage.objects;
create policy "Authenticated upload profiles bucket"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'profiles');

-- Authenticated users can update (upsert/replace) in the profiles bucket
drop policy if exists "Authenticated update profiles bucket" on storage.objects;
create policy "Authenticated update profiles bucket"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'profiles');
