import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Incoming Request: ${req.method} ${req.url}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        success: false,
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST requests are allowed.',
      }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Initialize Supabase Client with Service Role Key to bypass RLS for administrative activation tasks
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error(`[${timestamp}] Internal Configuration Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.`);
    return new Response(
      JSON.stringify({
        success: false,
        code: 'INTERNAL_CONFIGURATION_ERROR',
        message: 'Backend service is improperly configured.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Parse and Validate Request Payload
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error(`[${timestamp}] Failed to parse JSON body:`, e);
      return new Response(
        JSON.stringify({
          success: false,
          code: 'INVALID_JSON_PAYLOAD',
          message: 'The request body must be a valid JSON payload.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${timestamp}] Payload:`, JSON.stringify(body));

    const rawLicenseKey = body.license_key;
    const rawSecureDeviceId = body.secure_device_id || body.device_id; // Support both just in case

    if (!rawLicenseKey || typeof rawLicenseKey !== 'string') {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'MISSING_LICENSE_KEY',
          message: 'license_key is required and must be a string.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rawSecureDeviceId || typeof rawSecureDeviceId !== 'string') {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'MISSING_DEVICE_ID',
          message: 'secure_device_id (or device_id) is required and must be a string.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const licenseKey = rawLicenseKey.trim().toUpperCase();
    const secureDeviceId = rawSecureDeviceId.trim();

    if (!licenseKey) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'INVALID_LICENSE_KEY_FORMAT',
          message: 'license_key cannot be empty or whitespaces.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!secureDeviceId) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'INVALID_DEVICE_ID_FORMAT',
          message: 'secure_device_id cannot be empty or whitespaces.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Database Schema Validation
    console.log(`[${timestamp}] Validating database schema integrity...`);
    const { error: deviceSchemaCheckError } = await supabase
      .from('devices')
      .select('secure_device_id')
      .limit(0);

    if (deviceSchemaCheckError) {
      console.error(`[${timestamp}] Schema check failed on devices:`, deviceSchemaCheckError);
      return new Response(
        JSON.stringify({
          success: false,
          code: 'DATABASE_SCHEMA_ERROR',
          message: 'Backend schema mismatch. Table "devices" does not contain expected "secure_device_id" column.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: licenseSchemaCheckError } = await supabase
      .from('licenses')
      .select('id, license_key, status, associated_device, expiration_date, expired_at')
      .limit(0);

    if (licenseSchemaCheckError) {
      console.error(`[${timestamp}] Schema check failed on licenses:`, licenseSchemaCheckError);
      return new Response(
        JSON.stringify({
          success: false,
          code: 'DATABASE_SCHEMA_ERROR',
          message: 'Backend schema mismatch in "licenses" table.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${timestamp}] Schema validation successful.`);

    // 3. Retrieve License Record
    console.log(`[${timestamp}] Searching for license key: ${licenseKey}`);
    const { data: license, error: licenseFetchError } = await supabase
      .from('licenses')
      .select('*')
      .eq('license_key', licenseKey)
      .maybeSingle();

    if (licenseFetchError) {
      console.error(`[${timestamp}] Database error while fetching license:`, licenseFetchError);
      return new Response(
        JSON.stringify({
          success: false,
          code: 'DATABASE_QUERY_ERROR',
          message: 'Database query failed.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!license) {
      console.log(`[${timestamp}] License key not found: ${licenseKey}`);
      return new Response(
        JSON.stringify({
          success: false,
          code: 'LICENSE_NOT_FOUND',
          message: 'License key not found.',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${timestamp}] License found. Status: ${license.status}, Associated Device: ${license.associated_device}`);

    // 4. Validate Expiration
    const now = new Date();
    const isExpired = (license.expiration_date && new Date(license.expiration_date) < now) ||
                      (license.expired_at && new Date(license.expired_at) < now);

    if (isExpired || license.status === 'EXPIRED') {
      console.log(`[${timestamp}] License has expired.`);
      if (license.status !== 'EXPIRED') {
        // Automatically sync database status
        await supabase
          .from('licenses')
          .update({ status: 'EXPIRED', updated_at: timestamp })
          .eq('id', license.id);
      }
      return new Response(
        JSON.stringify({
          success: false,
          code: 'LICENSE_EXPIRED',
          message: 'This license has expired.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Validate Status
    if (license.status === 'SUSPENDED') {
      console.log(`[${timestamp}] License is suspended.`);
      return new Response(
        JSON.stringify({
          success: false,
          code: 'LICENSE_SUSPENDED',
          message: 'This license has been suspended.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (license.status === 'REVOKED') {
      console.log(`[${timestamp}] License is revoked.`);
      return new Response(
        JSON.stringify({
          success: false,
          code: 'INVALID_LICENSE_STATUS',
          message: 'This license has been revoked.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (license.status !== 'PENDING' && license.status !== 'ACTIVE') {
      console.log(`[${timestamp}] Invalid license status: ${license.status}`);
      return new Response(
        JSON.stringify({
          success: false,
          code: 'INVALID_LICENSE_STATUS',
          message: `License status does not allow activation (Status: ${license.status}).`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Validate Device Binding (Idempotency vs Conflict)
    if (license.associated_device && license.associated_device !== 'UNBOUND') {
      if (license.associated_device !== secureDeviceId) {
        console.log(`[${timestamp}] Device conflict. License is bound to device: ${license.associated_device}, requested device: ${secureDeviceId}`);
        return new Response(
          JSON.stringify({
            success: false,
            code: 'DEVICE_ALREADY_BOUND',
            message: 'License already activated on another device.',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        console.log(`[${timestamp}] Idempotent activation request. Device is already bound.`);
        return new Response(
          JSON.stringify({
            success: true,
            message: 'License is already active on this device.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 7. Execute Atomic Activation Transaction via PostgreSQL RPC Function
    console.log(`[${timestamp}] Triggering atomic activation database transaction for license_id: ${license.id}`);
    
    const { error: txError } = await supabase.rpc('activate_license_db_tx', {
      p_license_id: license.id,
      p_secure_device_id: secureDeviceId,
      p_model: body.model || null,
      p_os_version: body.os_version || null,
      p_android_version: body.android_version || null,
      p_app_version: body.app_version || null,
    });

    if (txError) {
      console.error(`[${timestamp}] Transaction failed. Rolling back implicitly:`, txError);
      return new Response(
        JSON.stringify({
          success: false,
          code: 'DATABASE_TRANSACTION_FAILED',
          message: 'An error occurred during database transaction. Process was rolled back.',
          details: txError.message,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${timestamp}] Transaction committed successfully. License activated on device: ${secureDeviceId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'License activated successfully.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error(`[${timestamp}] Unhandled error caught:`, err);
    return new Response(
      JSON.stringify({
        success: false,
        code: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'An unexpected error occurred.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
