const http = require('http');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://dpthhttwmtgtbrsjtfcg.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwdGhodHR3bXRndGJyc2p0ZmNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MTA0NjUsImV4cCI6MjA5ODA4NjQ2NX0.kUHLK0QIVdCu0jAMq3zp8bxDpvg1g-9Mj5FrGoA1tB4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const server = http.createServer(async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Incoming Request: ${req.method} ${req.url}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end('ok');
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      code: 'METHOD_NOT_ALLOWED',
      message: 'Only POST requests are allowed.',
    }));
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    let body = '';
    await new Promise((resolve) => {
      req.on('data', chunk => { body += chunk; });
      req.on('end', resolve);
    });

    let payload;
    try {
      payload = JSON.parse(body);
    } catch (e) {
      res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        code: 'INVALID_JSON_PAYLOAD',
        message: 'The request body must be a valid JSON payload.',
      }));
      return;
    }

    const rawLicenseKey = payload.license_key;
    const rawSecureDeviceId = payload.secure_device_id || payload.device_id;

    if (!rawLicenseKey || typeof rawLicenseKey !== 'string') {
      res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        code: 'MISSING_LICENSE_KEY',
        message: 'license_key is required and must be a string.',
      }));
      return;
    }

    if (!rawSecureDeviceId || typeof rawSecureDeviceId !== 'string') {
      res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        code: 'MISSING_DEVICE_ID',
        message: 'secure_device_id (or device_id) is required and must be a string.',
      }));
      return;
    }

    const licenseKey = rawLicenseKey.trim().toUpperCase();
    const secureDeviceId = rawSecureDeviceId.trim();

    if (!licenseKey) {
      res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        code: 'INVALID_LICENSE_KEY_FORMAT',
        message: 'license_key cannot be empty or whitespaces.',
      }));
      return;
    }

    if (!secureDeviceId) {
      res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        code: 'INVALID_DEVICE_ID_FORMAT',
        message: 'secure_device_id cannot be empty or whitespaces.',
      }));
      return;
    }

    // 2. Schema check
    console.log(`[${timestamp}] Checking db schema...`);
    const { error: deviceSchemaCheckError } = await supabase
      .from('devices')
      .select('secure_device_id')
      .limit(0);

    if (deviceSchemaCheckError) {
      console.error(`[${timestamp}] Schema check failed on devices:`, deviceSchemaCheckError);
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        code: 'DATABASE_SCHEMA_ERROR',
        message: 'Backend schema mismatch.',
      }));
      return;
    }

    const { error: licenseSchemaCheckError } = await supabase
      .from('licenses')
      .select('id, license_key, status, associated_device, expiration_date, expired_at')
      .limit(0);

    if (licenseSchemaCheckError) {
      console.error(`[${timestamp}] Schema check failed on licenses:`, licenseSchemaCheckError);
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        code: 'DATABASE_SCHEMA_ERROR',
        message: 'Backend schema mismatch.',
      }));
      return;
    }

    // 3. Retrieve License
    console.log(`[${timestamp}] Retrieving license: ${licenseKey}`);
    const { data: license, error: licenseFetchError } = await supabase
      .from('licenses')
      .select('*')
      .eq('license_key', licenseKey)
      .maybeSingle();

    if (licenseFetchError) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        code: 'DATABASE_QUERY_ERROR',
        message: 'Database query failed.',
      }));
      return;
    }

    if (!license) {
      res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        code: 'LICENSE_NOT_FOUND',
        message: 'License key not found.',
      }));
      return;
    }

    // 4. Expiration
    const now = new Date();
    const isExpired = (license.expiration_date && new Date(license.expiration_date) < now) ||
                      (license.expired_at && new Date(license.expired_at) < now);

    if (isExpired || license.status === 'EXPIRED') {
      if (license.status !== 'EXPIRED') {
        await supabase
          .from('licenses')
          .update({ status: 'EXPIRED', updated_at: timestamp })
          .eq('id', license.id);
      }
      res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        code: 'LICENSE_EXPIRED',
        message: 'This license has expired.',
      }));
      return;
    }

    // 5. Status Validation
    if (license.status === 'SUSPENDED') {
      res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        code: 'LICENSE_SUSPENDED',
        message: 'This license has been suspended.',
      }));
      return;
    }

    if (license.status === 'REVOKED') {
      res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        code: 'INVALID_LICENSE_STATUS',
        message: 'This license has been revoked.',
      }));
      return;
    }

    if (license.status !== 'PENDING' && license.status !== 'ACTIVE') {
      res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        code: 'INVALID_LICENSE_STATUS',
        message: `License status does not allow activation (Status: ${license.status}).`,
      }));
      return;
    }

    // 6. Device Validation
    if (license.associated_device && license.associated_device !== 'UNBOUND') {
      if (license.associated_device !== secureDeviceId) {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          code: 'DEVICE_ALREADY_BOUND',
          message: 'License already activated on another device.',
        }));
        return;
      } else {
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: 'License is already active on this device.',
        }));
        return;
      }
    }

    // 7. Execute transaction via RPC
    console.log(`[${timestamp}] Executing transaction RPC...`);
    const { error: txError } = await supabase.rpc('activate_license_db_tx', {
      p_license_id: license.id,
      p_secure_device_id: secureDeviceId,
      p_model: payload.model || null,
      p_os_version: payload.os_version || null,
      p_android_version: payload.android_version || null,
      p_app_version: payload.app_version || null,
    });

    if (txError) {
      console.error(`[${timestamp}] Transaction failed:`, txError);
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        code: 'DATABASE_TRANSACTION_FAILED',
        message: 'An error occurred during database transaction.',
        details: txError.message,
      }));
      return;
    }

    console.log(`[${timestamp}] Transaction successful.`);
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      message: 'License activated successfully.',
    }));

  } catch (err) {
    console.error(`[${timestamp}] Unhandled error:`, err);
    res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message,
    }));
  }
});

const PORT = 54321;
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Local test server listening on http://127.0.0.1:${PORT}`);
});
