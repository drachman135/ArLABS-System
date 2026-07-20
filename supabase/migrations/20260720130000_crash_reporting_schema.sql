-- ==============================================================================
-- Migration: Crash & Error Reporting Schema
-- Created: 2026-07-20
-- Description: Creates tables for grouped crash issues, detailed crash reports, and developer comments.
-- ==============================================================================

-- 1. Table: crash_issues (Groups unique bugs/exceptions)
CREATE TABLE IF NOT EXISTS public.crash_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    exception_type TEXT NOT NULL,
    exception_message TEXT NOT NULL,
    package_name TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('FATAL', 'NON_FATAL', 'ANR', 'CRITICAL')),
    occurrences INTEGER DEFAULT 1,
    affected_devices INTEGER DEFAULT 1,
    first_seen TIMESTAMPTZ DEFAULT now(),
    last_seen TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'IGNORED', 'ARCHIVED')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Table: crash_reports (Individual crash instances per device)
CREATE TABLE IF NOT EXISTS public.crash_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES public.crash_issues(id) ON DELETE CASCADE,
    package_name TEXT NOT NULL,
    app_name TEXT,
    app_version TEXT,
    version_code INTEGER,
    severity TEXT NOT NULL CHECK (severity IN ('FATAL', 'NON_FATAL', 'ANR', 'CRITICAL')),
    exception_type TEXT NOT NULL,
    exception_message TEXT NOT NULL,
    stack_trace TEXT NOT NULL,
    device_id TEXT,
    device_info JSONB DEFAULT '{}'::jsonb,
    license_id UUID REFERENCES public.licenses(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    synced_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Table: crash_comments (Developer collaboration on issues)
CREATE TABLE IF NOT EXISTS public.crash_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES public.crash_issues(id) ON DELETE CASCADE,
    author TEXT NOT NULL DEFAULT 'Admin / Developer',
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance filtering
CREATE INDEX IF NOT EXISTS idx_crash_issues_package ON public.crash_issues(package_name);
CREATE INDEX IF NOT EXISTS idx_crash_issues_status ON public.crash_issues(status);
CREATE INDEX IF NOT EXISTS idx_crash_issues_last_seen ON public.crash_issues(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_crash_reports_issue_id ON public.crash_reports(issue_id);
CREATE INDEX IF NOT EXISTS idx_crash_reports_created_at ON public.crash_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crash_comments_issue_id ON public.crash_comments(issue_id);

-- Enable RLS
ALTER TABLE public.crash_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crash_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crash_comments ENABLE ROW LEVEL SECURITY;

-- Create policies (Allow service role full access and authenticated/anon reading/inserting for edge sync)
CREATE POLICY "Allow read/write crash_issues for all" ON public.crash_issues FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow read/write crash_reports for all" ON public.crash_reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow read/write crash_comments for all" ON public.crash_comments FOR ALL USING (true) WITH CHECK (true);
