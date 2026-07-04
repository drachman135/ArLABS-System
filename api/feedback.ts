import { createClient } from '@supabase/supabase-js';

declare const process: any;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://dpthhttwmtgtbrsjtfcg.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwdGhodHR3bXRndGJyc2p0ZmNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MTA0NjUsImV4cCI6MjA5ODA4NjQ2NX0.kUHLK0QIVdCu0jAMq3zp8bxDpvg1g-9Mj5FrGoA1tB4';

// Helper to authenticate request
async function authenticateAdmin(req: any) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid Authorization header', status: 401 };
  }

  const token = authHeader.split(' ')[1];
  
  // Initialize Supabase client with user's JWT so queries respect RLS boundaries
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return { error: 'Invalid or expired session token', status: 401 };
  }

  // 1. Cross-reference admins table to check role
  const { data: admin, error: adminError } = await supabase
    .from('admins')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (admin && !adminError) {
    return { user, admin, supabase };
  }

  // 2. Fallback: Cross-reference public.users table from Phase 1
  const { data: dbUser, error: dbUserError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (dbUser && !dbUserError && ['admin', 'super_admin', 'staff'].includes(dbUser.role)) {
    return { user, admin: { role: dbUser.role }, supabase };
  }

  return { error: 'Forbidden: Admin access required', status: 403 };
}

// Vercel serverless handler
export default async function handler(req: any, res: any) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ─── POST: SUBMIT NEW FEEDBACK (PUBLIC) ─────────────────────
  if (req.method === 'POST') {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      
      // 1. Validation
      const required = ['category', 'title', 'description', 'package_name', 'app_version', 'license_id', 'timestamp'];
      const missing = required.filter(field => !body[field]);

      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Missing required fields: ${missing.join(', ')}`
        });
      }

      const {
        category,
        title,
        description,
        whatsapp,
        license_id,
        application_name,
        package_name,
        app_version,
        database_version,
        android_version,
        sdk_version,
        manufacturer,
        device_brand,
        device_model,
        device_name,
        build_type,
        diagnostic_log,
        screenshot_url,
        timestamp
      } = body;

      // 2. Prevent Duplicate Submission (within 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: existing, error: dupError } = await supabase
        .from('feedback_reports')
        .select('id, created_at')
        .eq('license_id', license_id)
        .eq('category', category)
        .eq('title', title)
        .eq('description', description)
        .gte('created_at', fiveMinutesAgo)
        .limit(1);

      if (dupError) {
        console.error('Duplicate check error:', dupError);
      }

      if (existing && existing.length > 0) {
        return res.status(200).json({
          success: true,
          message: 'Duplicate feedback report received within 5 minutes. Ignored.',
          data: existing[0]
        });
      }

      // 3. Store in Supabase
      const { data: inserted, error: insertError } = await supabase
        .from('feedback_reports')
        .insert([{
          category,
          title,
          description,
          whatsapp: whatsapp || null,
          license_id,
          application_name: application_name || null,
          package_name,
          app_version,
          database_version: database_version || null,
          android_version: android_version || null,
          sdk_version: sdk_version || null,
          manufacturer: manufacturer || null,
          device_brand: device_brand || null,
          device_model: device_model || null,
          device_name: device_name || null,
          build_type: build_type || null,
          diagnostic_log: diagnostic_log || null,
          screenshot_url: screenshot_url || null,
          timestamp: new Date(timestamp).toISOString(),
          status: 'NEW'
        }])
        .select()
        .single();

      if (insertError) {
        return res.status(500).json({
          success: false,
          error: `Database insertion error: ${insertError.message}`
        });
      }

      // 4. Send OneSignal Push Notification to Admin
      const onesignalAppId = process.env.ONESIGNAL_APP_ID || process.env.VITE_ONESIGNAL_APP_ID;
      const onesignalApiKey = process.env.ONESIGNAL_API_KEY;

      if (onesignalAppId && onesignalApiKey) {
        try {
          await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Authorization': `Basic ${onesignalApiKey}`
            },
            body: JSON.stringify({
              app_id: onesignalAppId,
              included_segments: ['Subscribed Users'],
              headings: { en: 'Laporan Masukan Baru! ⚠️', id: 'Laporan Masukan Baru! ⚠️' },
              contents: { 
                en: `Aplikasi: ${application_name || 'Generic App'}\nKategori: ${category}\nJudul: ${title}`,
                id: `Aplikasi: ${application_name || 'Generic App'}\nKategori: ${category}\nJudul: ${title}`
              },
              data: {
                reportId: inserted.id
              }
            })
          });
        } catch (pushError) {
          console.error('OneSignal push notification error:', pushError);
        }
      }

      return res.status(201).json({
        success: true,
        message: 'Feedback submitted successfully.',
        data: inserted
      });

    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: `Invalid request payload: ${err.message}`
      });
    }
  }

  // ─── GET: LIST FEEDBACK REPORTS (ADMIN ONLY) ────────────────
  if (req.method === 'GET') {
    // Authenticate Admin and retrieve token-bound client
    const auth = await authenticateAdmin(req);
    if (auth.error) {
      return res.status(auth.status || 401).json({ success: false, error: auth.error });
    }

    const supabase = auth.supabase!;

    try {
      const {
        search,
        status,
        category,
        application,
        package: pkg,
        license,
        startDate,
        endDate,
        limit = '10',
        offset = '0'
      } = req.query;

      let query = supabase
        .from('feedback_reports')
        .select('*', { count: 'exact' });

      // Apply Filters
      if (status) query = query.eq('status', status);
      if (category) query = query.eq('category', category);
      if (application) query = query.eq('application_name', application);
      if (pkg) query = query.eq('package_name', pkg);
      if (license) query = query.eq('license_id', license);

      // Date Filters (based on created_at or client-reported timestamp)
      if (startDate) query = query.gte('created_at', new Date(startDate).toISOString());
      if (endDate) query = query.lte('created_at', new Date(endDate).toISOString());

      // Search Query (Category, Title, Description, License)
      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,category.ilike.%${search}%,license_id.ilike.%${search}%`);
      }

      // Pagination and Order
      const limitVal = parseInt(limit as string, 10);
      const offsetVal = parseInt(offset as string, 10);
      
      query = query
        .order('created_at', { ascending: false })
        .range(offsetVal, offsetVal + limitVal - 1);

      const { data, count, error: fetchErr } = await query;

      if (fetchErr) {
        return res.status(500).json({
          success: false,
          error: `Error querying feedback reports: ${fetchErr.message}`
        });
      }

      return res.status(200).json({
        success: true,
        data,
        count: count || 0,
        limit: limitVal,
        offset: offsetVal
      });

    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: `Server error: ${err.message}`
      });
    }
  }

  // Fallback for unsupported methods
  return res.status(405).json({
    success: false,
    error: `Method ${req.method} not allowed`
  });
}
