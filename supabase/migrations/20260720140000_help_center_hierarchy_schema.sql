-- ==============================================================================
-- Help Center Hierarchy Schema (Aligned with Android Client DTO @SerializedName)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.help_center_hierarchy (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    category TEXT NOT NULL DEFAULT 'QUICK_HELP',
    key TEXT UNIQUE,
    url TEXT,
    parent_id UUID REFERENCES public.help_center_hierarchy(id) ON DELETE CASCADE,
    "order" INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for hierarchy queries and sorting
CREATE INDEX IF NOT EXISTS idx_help_center_parent_id ON public.help_center_hierarchy(parent_id);
CREATE INDEX IF NOT EXISTS idx_help_center_category ON public.help_center_hierarchy(category);
CREATE INDEX IF NOT EXISTS idx_help_center_order ON public.help_center_hierarchy("order");

-- Enable RLS
ALTER TABLE public.help_center_hierarchy ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (for client apps)
DROP POLICY IF EXISTS "Allow public read access to active help center items" ON public.help_center_hierarchy;
CREATE POLICY "Allow public read access to active help center items"
    ON public.help_center_hierarchy FOR SELECT
    USING (true);

-- Create policy for admin all access
DROP POLICY IF EXISTS "Allow admin full access to help center hierarchy" ON public.help_center_hierarchy;
CREATE POLICY "Allow admin full access to help center hierarchy"
    ON public.help_center_hierarchy FOR ALL
    USING (true)
    WITH CHECK (true);

-- Insert initial seed data matching client flavor rental help center display and exact Android categories
INSERT INTO public.help_center_hierarchy (title, subtitle, category, key, url, "order")
VALUES 
    ('Panduan Penggunaan', 'Panduan tertulis memulai sistem kasir', 'QUICK_HELP', 'panduan_penggunaan', null, 1),
    ('FAQ', 'Jawaban atas pertanyaan yang sering diajukan', 'QUICK_HELP', 'faq', null, 2),
    ('Video Tutorial', 'Video petunjuk pengaturan operasional', 'QUICK_HELP', 'video_tutorial', null, 3),
    ('Email Support', 'Kirim surel keluhan operasional', 'COMMUNICATION', 'email_support', 'mailto:support@arlabs.id', 4),
    ('Website Resmi', 'Kunjungi portal informasi web kami', 'COMMUNICATION', 'website_resmi', 'https://arlabs.id', 5)
ON CONFLICT (key) DO NOTHING;
