import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://dpthhttwmtgtbrsjtfcg.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwdGhodHR3bXRndGJyc2p0ZmNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MTA0NjUsImV4cCI6MjA5ODA4NjQ2NX0.kUHLK0QIVdCu0jAMq3zp8bxDpvg1g-9Mj5FrGoA1tB4';

// Helper to authenticate request
async function authenticateAdmin(req: any, supabase: any) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid Authorization header', status: 401 };
  }

  const token = authHeader.split(' ')[1];
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
    return { user, admin };
  }

  // 2. Fallback: Cross-reference public.users table from Phase 1
  const { data: dbUser, error: dbUserError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (dbUser && !dbUserError && ['admin', 'super_admin', 'staff'].includes(dbUser.role)) {
    return { user, admin: { role: dbUser.role } };
  }

  return { error: 'Forbidden: Admin access required', status: 403 };
}

export default async function handler(req: any, res: any) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ success: false, error: 'Feedback report ID is required.' });
  }

  // Authenticate Admin
  const auth = await authenticateAdmin(req, supabase);
  if (auth.error) {
    return res.status(auth.status || 401).json({ success: false, error: auth.error });
  }

  // ─── GET: GET FEEDBACK REPORT DETAIL ───────────────────────
  if (req.method === 'GET') {
    try {
      const { data: report, error: fetchErr } = await supabase
        .from('feedback_reports')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (fetchErr) {
        return res.status(500).json({
          success: false,
          error: `Database fetch error: ${fetchErr.message}`
        });
      }

      if (!report) {
        return res.status(404).json({
          success: false,
          error: `Feedback report with ID ${id} not found.`
        });
      }

      return res.status(200).json({
        success: true,
        data: report
      });

    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: `Server error: ${err.message}`
      });
    }
  }

  // ─── PATCH: UPDATE STATUS AND DEVELOPER NOTE ───────────────
  if (req.method === 'PATCH') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { status: newStatus, developer_note: newNote } = body;

      // 1. Fetch current record to perform status workflow check
      const { data: report, error: fetchErr } = await supabase
        .from('feedback_reports')
        .select('status, developer_note')
        .eq('id', id)
        .maybeSingle();

      if (fetchErr) {
        return res.status(500).json({
          success: false,
          error: `Database fetch error: ${fetchErr.message}`
        });
      }

      if (!report) {
        return res.status(404).json({
          success: false,
          error: `Feedback report with ID ${id} not found.`
        });
      }

      const currentStatus = report.status;
      const updateData: any = {};

      // 2. Validate status workflow transitions
      // Workflow: NEW ➔ IN_PROGRESS ➔ RESOLVED or REJECTED
      if (newStatus !== undefined && newStatus !== currentStatus) {
        if (!['NEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'].includes(newStatus)) {
          return res.status(400).json({
            success: false,
            error: `Invalid status code: ${newStatus}`
          });
        }

        if (currentStatus === 'NEW' && newStatus !== 'IN_PROGRESS') {
          return res.status(400).json({
            success: false,
            error: `Invalid status workflow. A 'NEW' report can only transition to 'IN_PROGRESS'.`
          });
        }

        if (currentStatus === 'IN_PROGRESS' && newStatus !== 'RESOLVED' && newStatus !== 'REJECTED') {
          return res.status(400).json({
            success: false,
            error: `Invalid status workflow. An 'IN_PROGRESS' report can only transition to 'RESOLVED' or 'REJECTED'.`
          });
        }

        if ((currentStatus === 'RESOLVED' || currentStatus === 'REJECTED') && newStatus !== currentStatus) {
          return res.status(400).json({
            success: false,
            error: `Invalid status workflow. A report that is already 'RESOLVED' or 'REJECTED' cannot transition again.`
          });
        }

        updateData.status = newStatus;
      }

      // 3. developer_note updates (allow notes to be added/edited directly)
      if (newNote !== undefined) {
        updateData.developer_note = newNote;
      }

      // If nothing to update, return success
      if (Object.keys(updateData).length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No changes detected.',
          data: report
        });
      }

      // 4. Perform update in Supabase
      const { data: updated, error: updateErr } = await supabase
        .from('feedback_reports')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateErr) {
        return res.status(500).json({
          success: false,
          error: `Database update error: ${updateErr.message}`
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Feedback report updated successfully.',
        data: updated
      });

    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: `Invalid request payload: ${err.message}`
      });
    }
  }

  // Fallback for unsupported methods
  return res.status(405).json({
    success: false,
    error: `Method ${req.method} not allowed`
  });
}
