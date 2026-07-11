-- Migration: Unify device identifier to secure_device_id and configure activation RPC

-- 1. Ensure secure_device_id is NOT NULL and has a UNIQUE constraint
ALTER TABLE public.devices ALTER COLUMN secure_device_id SET NOT NULL;

-- Drop constraint if exists before recreating
ALTER TABLE public.devices DROP CONSTRAINT IF EXISTS devices_secure_device_id_key;
ALTER TABLE public.devices ADD CONSTRAINT devices_secure_device_id_key UNIQUE (secure_device_id);

-- 2. Drop the obsolete database trigger and its function
DROP TRIGGER IF EXISTS trg_sync_license_device ON public.devices;
DROP FUNCTION IF EXISTS sync_license_device_association();

-- 3. Create transaction RPC function for atomic activation
CREATE OR REPLACE FUNCTION public.activate_license_db_tx(
  p_license_id UUID,
  p_secure_device_id TEXT,
  p_model TEXT DEFAULT NULL,
  p_os_version TEXT DEFAULT NULL,
  p_android_version TEXT DEFAULT NULL,
  p_app_version TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
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

  -- Update the license record
  UPDATE public.licenses
  SET
    status = 'ACTIVE',
    associated_device = p_secure_device_id,
    activated_at = COALESCE(activated_at, NOW()),
    updated_at = NOW()
  WHERE id = p_license_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.test_reset_license(p_key TEXT, p_status TEXT DEFAULT 'PENDING')
RETURNS VOID AS $$
BEGIN
  UPDATE public.licenses
  SET status = p_status, 
      associated_device = CASE WHEN p_status = 'PENDING' THEN 'UNBOUND' ELSE associated_device END, 
      activated_at = CASE WHEN p_status = 'PENDING' THEN NULL ELSE activated_at END, 
      expires_at = CASE WHEN p_status = 'PENDING' THEN NULL ELSE expires_at END, 
      updated_at = NOW()
  WHERE license_key = p_key;
  
  IF p_status = 'PENDING' THEN
    DELETE FROM public.devices WHERE license_id = (SELECT id FROM public.licenses WHERE license_key = p_key);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
