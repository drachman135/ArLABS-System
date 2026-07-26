-- ==============================================================================
-- Help Center Hierarchy Schema (Aligned with Android Client DTO @SerializedName)
-- ==============================================================================

-- 1. Create table if not exists (minimal base so subsequent ADD COLUMN IF NOT EXISTS guarantees all columns exist)
CREATE TABLE IF NOT EXISTS public.help_center_hierarchy (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY
);

-- 2. Safely add every column in case the table existed from a previous attempt with a different schema
ALTER TABLE public.help_center_hierarchy ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.help_center_hierarchy ADD COLUMN IF NOT EXISTS subtitle TEXT;
ALTER TABLE public.help_center_hierarchy ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'QUICK_HELP';
ALTER TABLE public.help_center_hierarchy ADD COLUMN IF NOT EXISTS key TEXT;
ALTER TABLE public.help_center_hierarchy ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE public.help_center_hierarchy ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.help_center_hierarchy(id) ON DELETE CASCADE;
ALTER TABLE public.help_center_hierarchy ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0;
ALTER TABLE public.help_center_hierarchy ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.help_center_hierarchy ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.help_center_hierarchy ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Safely ensure 'key' column has unique index/constraint for ON CONFLICT (key) DO NOTHING
CREATE UNIQUE INDEX IF NOT EXISTS help_center_hierarchy_key_unique_idx ON public.help_center_hierarchy(key);

DO $$ 
BEGIN 
    ALTER TABLE public.help_center_hierarchy ADD CONSTRAINT help_center_hierarchy_key_key UNIQUE (key);
EXCEPTION 
    WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- 4. Indexes for hierarchy queries and sorting
CREATE INDEX IF NOT EXISTS idx_help_center_parent_id ON public.help_center_hierarchy(parent_id);
CREATE INDEX IF NOT EXISTS idx_help_center_category ON public.help_center_hierarchy(category);
CREATE INDEX IF NOT EXISTS idx_help_center_order ON public.help_center_hierarchy("order");

-- 5. Enable RLS
ALTER TABLE public.help_center_hierarchy ENABLE ROW LEVEL SECURITY;

-- 6. Create policy for public read access (for client apps)
DROP POLICY IF EXISTS "Allow public read access to active help center items" ON public.help_center_hierarchy;
CREATE POLICY "Allow public read access to active help center items"
    ON public.help_center_hierarchy FOR SELECT
    USING (true);

-- 7. Create policy for admin all access
DROP POLICY IF EXISTS "Allow admin full access to help center hierarchy" ON public.help_center_hierarchy;
CREATE POLICY "Allow admin full access to help center hierarchy"
    ON public.help_center_hierarchy FOR ALL
    USING (true)
    WITH CHECK (true);

-- 8. Insert initial seed data matching client flavor rental help center display and exact Android categories
INSERT INTO public.help_center_hierarchy (title, subtitle, category, key, url, "order")
VALUES 
    ('Panduan Penggunaan', 'Panduan tertulis memulai sistem kasir', 'QUICK_HELP', 'panduan_penggunaan', null, 1),
    ('FAQ', 'Jawaban atas pertanyaan yang sering diajukan', 'QUICK_HELP', 'faq', null, 2),
    ('Video Tutorial', 'Video petunjuk pengaturan operasional', 'QUICK_HELP', 'video_tutorial', null, 3),
    ('Email Support', 'Kirim surel keluhan operasional', 'COMMUNICATION', 'email_support', 'mailto:support@arlabs.id', 4),
    ('Website Resmi', 'Kunjungi portal informasi web kami', 'COMMUNICATION', 'website_resmi', 'https://arlabs.id', 5)
ON CONFLICT (key) DO NOTHING;

-- 9. Notify PostgREST to reload schema cache immediately so new/updated columns are recognized by Supabase API
NOTIFY pgrst, 'reload schema';
