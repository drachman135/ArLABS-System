import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Incoming Crash Report Request: ${req.method} ${req.url}`);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        success: false,
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST requests are allowed for crash reporting.',
      }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({
        success: false,
        code: 'INTERNAL_CONFIGURATION_ERROR',
        message: 'Backend service improperly configured.',
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
      return new Response(
        JSON.stringify({
          success: false,
          code: 'INVALID_JSON_PAYLOAD',
          message: 'The request body must be a valid JSON payload.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      package_name = 'com.arlabs.client',
      app_name = 'ArLABS POS Client',
      app_version = '1.0.0',
      version_code = 1,
      severity = 'FATAL',
      exception_type = 'UnknownException',
      exception_message = 'An unexpected error occurred',
      stack_trace = 'No stacktrace provided',
      device_id = 'unknown_device',
      device_info = {},
      license_key = null
    } = body;

    // Validate severity
    const validSeverities = ['FATAL', 'NON_FATAL', 'ANR', 'CRITICAL'];
    const safeSeverity = validSeverities.includes(severity) ? severity : 'FATAL';

    // 1. Resolve license_id & customer_id if license_key is provided
    let licenseId: string | null = null;
    let customerId: string | null = null;

    if (license_key) {
      const { data: lic } = await supabase
        .from('licenses')
        .select('id, customer_id')
        .eq('license_key', license_key)
        .maybeSingle();

      if (lic) {
        licenseId = lic.id;
        customerId = lic.customer_id;
      }
    }

    // 2. Find or create group in crash_issues
    // We group by package_name + exception_type + exception_message
    const { data: existingIssues } = await supabase
      .from('crash_issues')
      .select('id, occurrences, affected_devices, status')
      .eq('package_name', package_name)
      .eq('exception_type', exception_type)
      .eq('exception_message', exception_message)
      .limit(1);

    let issueId: string;

    if (existingIssues && existingIssues.length > 0) {
      const issue = existingIssues[0];
      issueId = issue.id;

      // If issue was resolved or archived, reopen it if a fatal crash occurs
      const newStatus = (issue.status === 'RESOLVED' || issue.status === 'ARCHIVED') ? 'OPEN' : issue.status;

      await supabase
        .from('crash_issues')
        .update({
          occurrences: (issue.occurrences || 1) + 1,
          affected_devices: (issue.affected_devices || 1) + 1,
          last_seen: new Date().toISOString(),
          status: newStatus
        })
        .eq('id', issueId);
    } else {
      // Create new issue
      const title = `${exception_type}: ${exception_message.substring(0, 100)}`;
      const { data: newIssue, error: createError } = await supabase
        .from('crash_issues')
        .insert([{
          title,
          exception_type,
          exception_message,
          package_name,
          severity: safeSeverity,
          occurrences: 1,
          affected_devices: 1,
          first_seen: new Date().toISOString(),
          last_seen: new Date().toISOString(),
          status: 'OPEN'
        }])
        .select('id')
        .single();

      if (createError || !newIssue) {
        console.error('Failed to create crash issue:', createError);
        throw new Error('Could not create crash issue record.');
      }
      issueId = newIssue.id;
    }

    // 3. Insert individual report into crash_reports
    const { data: reportData, error: reportError } = await supabase
      .from('crash_reports')
      .insert([{
        issue_id: issueId,
        package_name,
        app_name,
        app_version,
        version_code,
        severity: safeSeverity,
        exception_type,
        exception_message,
        stack_trace,
        device_id,
        device_info,
        license_id: licenseId,
        customer_id: customerId,
        created_at: new Date().toISOString(),
        synced_at: new Date().toISOString()
      }])
      .select('id')
      .single();

    if (reportError) {
      console.error('Failed to insert crash report:', reportError);
    }

    // 4. If FATAL or CRITICAL, push real-time notification to Admin Panel
    if (safeSeverity === 'FATAL' || safeSeverity === 'CRITICAL') {
      await supabase
        .from('notifications')
        .insert([{
          type: 'crash',
          title: `⚠️ [${safeSeverity}] ${exception_type} di ${app_name}`,
          body: `${exception_message.substring(0, 120)}... (Device: ${device_id})`,
          is_read: false,
          created_at: new Date().toISOString()
        }]);
    }

    return new Response(
      JSON.stringify({
        success: true,
        code: 'CRASH_REPORTED',
        message: 'Crash report successfully received and grouped.',
        issue_id: issueId,
        report_id: reportData?.id || null
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error(`[${timestamp}] Unhandled error inside report-crash:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        code: 'INTERNAL_SERVER_ERROR',
        message: error?.message || 'An unexpected server error occurred while processing crash report.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
