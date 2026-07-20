-- ==============================================================================
-- Migration: Mayar.id Backend Integration Schema (Phase 2)
-- Created: 2026-07-20
-- Description: Creates configuration table, webhook logs table, and transactions table
--              for Mayar.id integration with Row Level Security (RLS).
-- ==============================================================================

-- 1. Configuration Table (Singleton Row id=1)
CREATE TABLE IF NOT EXISTS public.mayar_integrations_config (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    api_key TEXT NOT NULL DEFAULT 'mayar_live_550e8400-e29b-41d4-a716-446655440000',
    client_token TEXT NOT NULL DEFAULT 'tok_usr_a1b2c3d4e5f6',
    webhook_url TEXT NOT NULL DEFAULT 'https://api.arlabs-system.com/webhooks/mayar',
    webhook_secret TEXT NOT NULL DEFAULT 'whsec_MayarEndpointSecret2026!',
    telegram_bot_token TEXT NOT NULL DEFAULT '',
    telegram_chat_id TEXT NOT NULL DEFAULT '',
    telegram_enabled BOOLEAN NOT NULL DEFAULT true,
    whatsapp_number TEXT NOT NULL DEFAULT '',
    whatsapp_template TEXT NOT NULL DEFAULT 'Halo {{name}}, tagihan Anda sebesar {{amount}} telah terbit. Silakan bayar melalui link berikut: {{link}}',
    whatsapp_connected BOOLEAN NOT NULL DEFAULT false,
    selected_events JSONB NOT NULL DEFAULT '["payment.success", "payment.failed", "subscription.cancelled"]'::jsonb,
    enabled_plugins JSONB NOT NULL DEFAULT '["lms", "shipping"]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default singleton configuration row if not exists
INSERT INTO public.mayar_integrations_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE public.mayar_integrations_config ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users and service role to read and modify configuration
CREATE POLICY "Allow authenticated read on mayar_integrations_config"
    ON public.mayar_integrations_config FOR SELECT
    TO authenticated, service_role
    USING (true);

CREATE POLICY "Allow authenticated update on mayar_integrations_config"
    ON public.mayar_integrations_config FOR UPDATE
    TO authenticated, service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated insert on mayar_integrations_config"
    ON public.mayar_integrations_config FOR INSERT
    TO authenticated, service_role
    WITH CHECK (true);


-- 2. Webhook Raw Events Log Table
CREATE TABLE IF NOT EXISTS public.mayar_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mayar_webhook_events_type ON public.mayar_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_mayar_webhook_events_created_at ON public.mayar_webhook_events(created_at DESC);

ALTER TABLE public.mayar_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated and service_role full access on mayar_webhook_events"
    ON public.mayar_webhook_events FOR ALL
    TO authenticated, service_role
    USING (true)
    WITH CHECK (true);


-- 3. Transactions Summary Table
CREATE TABLE IF NOT EXISTS public.mayar_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id TEXT UNIQUE NOT NULL,
    reference_id TEXT,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'IDR',
    payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('SUCCESS', 'FAILED', 'PENDING', 'REFUNDED')),
    payment_method TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mayar_transactions_status ON public.mayar_transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_mayar_transactions_created_at ON public.mayar_transactions(created_at DESC);

ALTER TABLE public.mayar_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated and service_role full access on mayar_transactions"
    ON public.mayar_transactions FOR ALL
    TO authenticated, service_role
    USING (true)
    WITH CHECK (true);
