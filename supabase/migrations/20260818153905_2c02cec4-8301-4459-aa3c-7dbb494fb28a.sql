ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS effective_from text,
  ADD COLUMN IF NOT EXISTS effective_to text;