-- Migration: Create feedback_messages table & triggers
-- Target: Supabase / PostgreSQL database

CREATE TABLE IF NOT EXISTS public.feedback_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_report_id UUID NOT NULL REFERENCES public.feedback_reports(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('ADMIN', 'CLIENT')),
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.feedback_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotence)
DROP POLICY IF EXISTS "Allow public insert messages" ON public.feedback_messages;
DROP POLICY IF EXISTS "Allow public read messages" ON public.feedback_messages;

-- RLS Policies:
-- 1. Allow anyone (including offline clients) to insert messages
CREATE POLICY "Allow public insert messages" ON public.feedback_messages FOR INSERT TO public WITH CHECK (true);

-- 2. Allow anyone to read messages in a conversation
CREATE POLICY "Allow public read messages" ON public.feedback_messages FOR SELECT TO public USING (true);


-- Trigger Function: Auto-notify client device when an admin replies
CREATE OR REPLACE FUNCTION notify_client_on_admin_reply()
RETURNS TRIGGER AS $$
DECLARE
    report_title TEXT;
    license_val TEXT;
    app_name_val TEXT;
BEGIN
    -- Retrieve metadata about the original report
    SELECT r.title, r.license_id, COALESCE(r.application_name, r.package_name)
    INTO report_title, license_val, app_name_val
    FROM public.feedback_reports r 
    WHERE r.id = NEW.feedback_report_id;

    -- Insert into notifications table to queue/trigger FCM push notification
    INSERT INTO public.notifications (
        title,
        body,
        message,
        target_type,
        target_id,
        status,
        scheduled_at
    ) VALUES (
        '✉️ Tanggapan Laporan: ' || COALESCE(report_title, 'Masukan Kasir'),
        'Admin (' || NEW.sender_name || '): ' || NEW.message,
        'Admin (' || NEW.sender_name || '): ' || NEW.message,
        'CUSTOMER',
        license_val, -- Identify target by customer's license key
        'QUEUED',
        NOW()
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if already exists
DROP TRIGGER IF EXISTS trg_notify_client_on_admin_reply ON public.feedback_messages;

-- Create AFTER INSERT trigger only for ADMIN replies
CREATE TRIGGER trg_notify_client_on_admin_reply
AFTER INSERT ON public.feedback_messages
FOR EACH ROW
WHEN (NEW.sender_type = 'ADMIN')
EXECUTE FUNCTION notify_client_on_admin_reply();
