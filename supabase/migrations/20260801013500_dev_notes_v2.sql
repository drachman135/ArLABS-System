-- Tambahkan kolom is_pinned (untuk fitur Sematkan ke Atas)
ALTER TABLE public.dev_notes
ADD COLUMN is_pinned BOOLEAN DEFAULT false;

-- Tambahkan kolom labels (untuk fitur Label Kustom tipe array string)
ALTER TABLE public.dev_notes
ADD COLUMN labels TEXT[] DEFAULT '{}';
