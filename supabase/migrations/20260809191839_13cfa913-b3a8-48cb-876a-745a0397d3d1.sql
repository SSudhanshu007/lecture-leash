ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS is_extra boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS date text;