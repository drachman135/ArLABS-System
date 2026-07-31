-- ==============================================================================
-- Migration: Developer Notes Schema
-- Created: 2026-07-31
-- Description: Creates dev_notes table for tracking tasks and issues.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.dev_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    target_version TEXT,
    status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
    priority TEXT DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    type TEXT DEFAULT 'TASK' CHECK (type IN ('BUG', 'FEATURE', 'IMPROVEMENT', 'TASK')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dev_notes ENABLE ROW LEVEL SECURITY;

-- Create policies (Allow read/write dev_notes for all for admin panel usage)
DROP POLICY IF EXISTS "Allow read/write dev_notes for all" ON public.dev_notes;
CREATE POLICY "Allow read/write dev_notes for all" ON public.dev_notes FOR ALL USING (true) WITH CHECK (true);
