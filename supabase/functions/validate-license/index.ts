import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Incoming Request to validate-license: ${req.method} ${req.url}`);

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

  // Initialize Supabase Client with Service Role Key to bypass RLS
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
    const rawSecureDeviceId = body.secure_device_id || body.device_id;
    const rawPackageName = body.package_name;

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

    if (!rawPackageName || typeof rawPackageName !== 'string') {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'MISSING_PACKAGE_NAME',
          message: 'package_name is required and must be a string.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const licenseKey = rawLicenseKey.trim().toUpperCase();
    const secureDeviceId = rawSecureDeviceId ? rawSecureDeviceId.trim() : null;
    const packageName = rawPackageName.trim();

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

    if (!packageName) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'INVALID_PACKAGE_NAME_FORMAT',
          message: 'package_name cannot be empty or whitespaces.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Schema check
    const { error: schemaError } = await supabase
      .from('licenses')
      .select('id, license_key, status, associated_device, expiration_date, expired_at, expires_at, duration_days, last_validation')
      .limit(0);

    if (schemaError) {
      console.error(`[${timestamp}] Schema validation failed on licenses table:`, schemaError);
      return new Response(
        JSON.stringify({
          success: false,
          code: 'DATABASE_SCHEMA_ERROR',
          message: 'Licenses table missing duration columns. Verify migrations have been run.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Query License
    console.log(`[${timestamp}] Querying license: ${licenseKey}`);
    const { data: license, error: fetchError } = await supabase
      .from('licenses')
      .select('*, applications(package_name)')
      .eq('license_key', licenseKey)
      .maybeSingle();

    if (fetchError) {
      console.error(`[${timestamp}] Database fetch error:`, fetchError);
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
      console.log(`[${timestamp}] License not found: ${licenseKey}`);
      return new Response(
        JSON.stringify({
          success: false,
          code: 'LICENSE_NOT_FOUND',
          message: 'License key not found.',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Expiration Check
    const now = new Date();
    const isExpired = (license.expires_at && new Date(license.expires_at) < now) ||
                      (license.expiration_date && new Date(license.expiration_date) < now) ||
                      (license.expired_at && new Date(license.expired_at) < now);

    if (isExpired || license.status === 'EXPIRED') {
      console.log(`[${timestamp}] License has expired.`);
      if (license.status !== 'EXPIRED') {
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

    // 4. Status Check
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
      console.log(`[${timestamp}] Invalid status: ${license.status}`);
      return new Response(
        JSON.stringify({
          success: false,
          code: 'INVALID_LICENSE_STATUS',
          message: `License status does not allow validation (Status: ${license.status}).`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Device check
    if (secureDeviceId && license.associated_device && license.associated_device !== 'UNBOUND') {
      if (license.associated_device !== secureDeviceId) {
        console.log(`[${timestamp}] Device conflict. License is bound to ${license.associated_device}, request sent by ${secureDeviceId}`);
        return new Response(
          JSON.stringify({
            success: false,
            code: 'DEVICE_ALREADY_BOUND',
            message: 'License already activated on another device.',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 5.5 Package name check
    if (license.applications && license.applications.package_name) {
      if (license.applications.package_name !== packageName) {
        console.log(`[${timestamp}] Package name conflict. License is for ${license.applications.package_name}, request sent from ${packageName}`);
        return new Response(
          JSON.stringify({
            success: false,
            code: 'LICENSE_APPLICATION_MISMATCH',
            message: 'This license is not valid for this application package.',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      console.log(`[${timestamp}] License has no specific package_name bound. Allowing universal access.`);
    }

    // 6. Update last_validation timestamp
    await supabase
      .from('licenses')
      .update({ last_validation: timestamp })
      .eq('id', license.id);

    // Calculate days remaining
    let daysRemaining = null;
    if (license.expires_at) {
      const diffMs = new Date(license.expires_at).getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    console.log(`[${timestamp}] License validation successful.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'License is active.',
        license_type: license.license_type || license.type || 'LIFETIME',
        duration_days: license.duration_days,
        activated_at: license.activated_at,
        expires_at: license.expires_at,
        days_remaining: daysRemaining,
        expired: false
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error(`[${timestamp}] Unhandled validation error:`, err);
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
