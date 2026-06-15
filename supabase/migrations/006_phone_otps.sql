-- ============================================================================
-- 006: Phone OTP table for SMS-based registration
-- ============================================================================
-- Stores short-lived OTP codes for SMS verification during registration.
-- Accessed only via service role in server actions (no RLS needed).

create table if not exists public.phone_otps (
  id uuid primary key default gen_random_uuid(),
  insead_email text not null,
  phone text not null,
  otp_hash text not null,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);

create index phone_otps_email_idx on public.phone_otps (insead_email);

-- Auto-cleanup: expired rows removed on insert
create or replace function public.cleanup_expired_phone_otps()
returns trigger language plpgsql as $$
begin
  delete from public.phone_otps where expires_at < now();
  return new;
end;
$$;

drop trigger if exists cleanup_phone_otps_trigger on public.phone_otps;
create trigger cleanup_phone_otps_trigger
  after insert on public.phone_otps
  execute function public.cleanup_expired_phone_otps();
