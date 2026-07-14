-- ============================================================
-- Migration: Push Notification via OneSignal API
-- Triggered by: INSERT on public.notifications table
-- Requires: pg_net extension enabled in Supabase
-- ============================================================
-- 
-- LANGKAH MANUAL SEBELUM MENJALANKAN SCRIPT INI:
-- 1. Buka Supabase Dashboard → Database → Extensions
-- 2. Cari "pg_net" dan klik Enable
-- 3. Baru jalankan script ini di SQL Editor
--
-- ============================================================

-- 1. Pastikan extension pg_net sudah aktif
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Buat function yang mengirim push notification via OneSignal REST API
CREATE OR REPLACE FUNCTION send_onesignal_push_notification()
RETURNS TRIGGER AS $$
DECLARE
    onesignal_app_id TEXT := 'YOUR_ONESIGNAL_APP_ID';
    onesignal_api_key TEXT := 'YOUR_ONESIGNAL_REST_API_KEY';
    push_title TEXT;
    push_body TEXT;
    request_body JSONB;
BEGIN
    -- Ambil title dan body dari record yang baru di-INSERT
    push_title := COALESCE(NEW.title, 'ArLABS Admin Alert');
    push_body := COALESCE(NEW.body, NEW.message, 'Ada notifikasi baru dari sistem ArLABS.');

    -- Susun JSON payload untuk OneSignal API
    request_body := jsonb_build_object(
        'app_id', onesignal_app_id,
        'included_segments', jsonb_build_array('Total Subscriptions'),
        'headings', jsonb_build_object('en', push_title),
        'contents', jsonb_build_object('en', push_body),
        'priority', 10,
        'existing_android_channel_id', 'arlabs_admin_alerts',
        'android_visibility', 1,
        'android_led_color', 'FFFF4444',
        'small_icon', 'ic_stat_onesignal_default',
        'android_accent_color', 'FFFF4444'
    );

    -- Kirim HTTP POST ke OneSignal REST API menggunakan pg_net
    -- Dibungkus dalam BEGIN...EXCEPTION agar jika pg_net gagal,
    -- transaksi INSERT utama (dari client) TIDAK ikut gagal/terblokir.
    BEGIN
        PERFORM net.http_post(
            url := 'https://api.onesignal.com/notifications',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Key ' || onesignal_api_key
            ),
            body := request_body
        );
    EXCEPTION WHEN OTHERS THEN
        -- Log error tapi jangan blokir transaksi utama
        RAISE WARNING 'OneSignal push notification failed: %', SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Drop existing trigger jika ada (untuk idempotency)
DROP TRIGGER IF EXISTS trg_onesignal_push_on_notification ON public.notifications;

-- 4. Buat AFTER INSERT trigger pada tabel notifications
CREATE TRIGGER trg_onesignal_push_on_notification
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION send_onesignal_push_notification();

-- ============================================================
-- CATATAN:
-- Trigger ini akan berjalan setiap kali ada INSERT baru ke 
-- tabel 'notifications'. Karena trigger feedback 
-- (trg_notify_admin_on_new_feedback) sudah INSERT ke tabel
-- 'notifications', maka alurnya menjadi:
--
--   Client kirim feedback 
--     → INSERT ke feedback_reports
--     → Trigger: notify_admin_on_new_feedback()
--     → INSERT ke notifications
--     → Trigger: send_onesignal_push_notification()
--     → HTTP POST ke OneSignal API (via pg_net)
--     → OneSignal kirim push ke semua device admin
--     → Heads-up notification muncul di HP admin
--
-- Ini bekerja BAHKAN SAAT aplikasi admin tertutup total,
-- karena push notification dikirim melalui FCM/OneSignal
-- yang berjalan di level sistem operasi Android.
-- ============================================================
