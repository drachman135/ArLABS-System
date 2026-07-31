-- Migration: Add app_id to dev_notes
-- Adds a relation so that each note is tied to a specific client application.

ALTER TABLE public.dev_notes
ADD COLUMN IF NOT EXISTS app_id UUID REFERENCES public.applications(id) ON DELETE CASCADE;

-- Create an index to optimize filtering by app_id
CREATE INDEX IF NOT EXISTS idx_dev_notes_app_id ON public.dev_notes(app_id);
