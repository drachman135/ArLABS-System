-- Migration: Implement License Duration System (Backend Support)

-- 1. Add new columns to the licenses table if they do not already exist
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS duration_days INTEGER;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS last_validation TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS renewed_at TIMESTAMP WITH TIME ZONE;

-- 2. Update the transactional activate_license_db_tx RPC function
CREATE OR REPLACE FUNCTION public.activate_license_db_tx(
  p_license_id UUID,
  p_secure_device_id TEXT,
  p_model TEXT DEFAULT NULL,
  p_os_version TEXT DEFAULT NULL,
  p_android_version TEXT DEFAULT NULL,
  p_app_version TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_duration_days INTEGER;
  v_current_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Fetch the license duration details
  SELECT duration_days, expires_at INTO v_duration_days, v_current_expires_at
  FROM public.licenses
  WHERE id = p_license_id;

  -- Insert or update the device record
  INSERT INTO public.devices (
    license_id,
    secure_device_id,
    model,
    os_version,
    android_version,
    app_version,
    last_online
  )
  VALUES (
    p_license_id,
    p_secure_device_id,
    p_model,
    p_os_version,
    p_android_version,
    p_app_version,
    NOW()
  )
  ON CONFLICT (secure_device_id) DO UPDATE SET
    license_id = p_license_id,
    model = COALESCE(EXCLUDED.model, devices.model),
    os_version = COALESCE(EXCLUDED.os_version, devices.os_version),
    android_version = COALESCE(EXCLUDED.android_version, devices.android_version),
    app_version = COALESCE(EXCLUDED.app_version, devices.app_version),
    last_online = NOW();

  -- Update the license record, computing expires_at on first activation
  UPDATE public.licenses
  SET
    status = 'ACTIVE',
    associated_device = p_secure_device_id,
    activated_at = COALESCE(activated_at, NOW()),
    expires_at = COALESCE(expires_at, 
      CASE 
        WHEN v_duration_days IS NOT NULL THEN NOW() + (v_duration_days || ' days')::INTERVAL
        ELSE NULL
      END
    ),
    updated_at = NOW()
  WHERE id = p_license_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
