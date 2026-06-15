-- ============================================================================
-- 004: Convert nationality text to nationalities text[] and work_permits text[]
-- ============================================================================

-- 1. Add the new array columns
ALTER TABLE public.profiles ADD COLUMN nationalities text[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN work_permits text[] DEFAULT '{}';

-- 2. Migrate existing data
-- This splits existing unstructured nationality strings by semicolon or comma
-- and inserts them into the new array column, stripping any whitespace.
UPDATE public.profiles
SET nationalities = ARRAY(
  SELECT trim(s)
  FROM unnest(string_to_array(replace(nationality, ',', ';'), ';')) s
  WHERE trim(s) != ''
)
WHERE nationality IS NOT NULL AND nationality != '';

-- 3. Drop the old column
ALTER TABLE public.profiles DROP COLUMN nationality;
