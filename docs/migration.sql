-- Database Migration: Create feedback_reports table
-- Target: Supabase / PostgreSQL database

CREATE TABLE IF NOT EXISTS public.feedback_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  whatsapp TEXT,
  license_id TEXT NOT NULL,
  application_name TEXT,
  package_name TEXT NOT NULL,
  app_version TEXT NOT NULL,
  database_version TEXT,
  android_version TEXT,
  sdk_version TEXT,
  manufacturer TEXT,
  device_brand TEXT,
  device_model TEXT,
  device_name TEXT,
  build_type TEXT,
  diagnostic_log TEXT,
  screenshot_url TEXT,
  developer_note TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.feedback_reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotence)
DROP POLICY IF EXISTS "Allow public insert" ON public.feedback_reports;
DROP POLICY IF EXISTS "Allow admin read" ON public.feedback_reports;
DROP POLICY IF EXISTS "Allow admin update" ON public.feedback_reports;

-- RLS Policies:
-- 1. Allow anyone to submit feedback (public INSERT)
CREATE POLICY "Allow public insert" ON public.feedback_reports FOR INSERT TO public WITH CHECK (true);

-- 2. Allow authenticated admin users to read feedback reports
CREATE POLICY "Allow admin read" ON public.feedback_reports FOR SELECT TO authenticated USING (true);

-- 3. Allow authenticated admin users to update feedback reports (status, developer_note)
CREATE POLICY "Allow admin update" ON public.feedback_reports FOR UPDATE TO authenticated USING (true);

-- Trigger to automatically update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_feedback_reports_updated_at ON public.feedback_reports;

CREATE TRIGGER update_feedback_reports_updated_at
    BEFORE UPDATE ON public.feedback_reports
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
