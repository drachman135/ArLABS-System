-- Migration: Add CTA fields to announcements table
-- This allows announcements to have an optional actionable button for clients to click.

ALTER TABLE public.announcements
ADD COLUMN IF NOT EXISTS cta_text TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cta_url TEXT DEFAULT NULL;

COMMENT ON COLUMN public.announcements.cta_text IS 'Text label for the call-to-action button, e.g., "Buka Promo". If null, no button is shown.';
COMMENT ON COLUMN public.announcements.cta_url IS 'Action URL or Deep Link to open when the CTA button is clicked.';
