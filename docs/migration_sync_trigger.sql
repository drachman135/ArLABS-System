-- 1. Create trigger function to sync device association automatically
CREATE OR REPLACE FUNCTION sync_license_device_association()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.licenses
        SET associated_device = NEW.device_id,
            status = 'ACTIVE',
            activated_at = COALESCE(activated_at, NOW())
        WHERE id = NEW.license_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.licenses
        SET associated_device = 'UNBOUND',
            status = 'PENDING',
            activated_at = NULL
        WHERE id = OLD.license_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop trigger if already exists
DROP TRIGGER IF EXISTS trg_sync_license_device ON public.devices;

-- 3. Create the trigger on the devices table
CREATE TRIGGER trg_sync_license_device
AFTER INSERT OR DELETE ON public.devices
FOR EACH ROW
EXECUTE FUNCTION sync_license_device_association();

-- 4. One-time sync for existing records in the database
UPDATE public.licenses l
SET associated_device = d.device_id,
    status = 'ACTIVE',
    activated_at = COALESCE(l.activated_at, d.created_at, NOW())
FROM public.devices d
WHERE l.id = d.license_id;
