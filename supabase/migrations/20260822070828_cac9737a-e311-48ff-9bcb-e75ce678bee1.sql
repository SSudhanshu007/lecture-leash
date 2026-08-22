ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS manual_attended integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_total integer NOT NULL DEFAULT 0;