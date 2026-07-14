-- Migration: SQL Trigger for Real-Time Feedback Notifications
-- Target: Supabase / PostgreSQL database

-- 1. Create a function that triggers on new inserts in feedback_reports table
CREATE OR REPLACE FUNCTION notify_admin_on_new_feedback()
RETURNS TRIGGER AS $$
DECLARE
    app_name_val TEXT;
BEGIN
    -- Fallback naming if application_name is null
    app_name_val := COALESCE(NEW.application_name, NEW.package_name, 'Aplikasi Klien ArLABS');

    -- Insert a row in the notifications table to trigger real-time admin toast & sound alerts
    INSERT INTO public.notifications (
        title,
        body,
        message,
        target_type,
        target_id,
        status,
        scheduled_at
    ) VALUES (
        '⚠️ Masukan Baru (' || NEW.category || ')',
        'Aplikasi "' || app_name_val || '" mengirim laporan: "' || NEW.title || '"',
        'Aplikasi "' || app_name_val || '" mengirim laporan: "' || NEW.title || '"',
        'ALL',
        NULL,
        'SENT',
        NOW()
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop existing trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS trg_notify_admin_on_new_feedback ON public.feedback_reports;

-- 3. Create the AFTER INSERT trigger
CREATE TRIGGER trg_notify_admin_on_new_feedback
AFTER INSERT ON public.feedback_reports
FOR EACH ROW
EXECUTE FUNCTION notify_admin_on_new_feedback();
