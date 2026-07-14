import { supabase } from '../../../core/supabase';
import type { FeedbackReport, FeedbackSummaryStats } from '../types/feedback.types';



// ──────────────────────────────────────────────────────────────
// TELEMETRY SUMMARY STATISTICS
// ──────────────────────────────────────────────────────────────
export async function fetchFeedbackStats(): Promise<FeedbackSummaryStats> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    oneWeekAgo.setHours(0, 0, 0, 0);
    const weekIso = oneWeekAgo.toISOString();

    const [
      { count: newCount },
      { count: inProgressCount },
      { count: resolvedCount },
      { count: rejectedCount },
      { count: todayCount },
      { count: thisWeekCount }
    ] = await Promise.all([
      supabase.from('feedback_reports').select('*', { count: 'exact', head: true }).eq('status', 'NEW'),
      supabase.from('feedback_reports').select('*', { count: 'exact', head: true }).eq('status', 'IN_PROGRESS'),
      supabase.from('feedback_reports').select('*', { count: 'exact', head: true }).eq('status', 'RESOLVED'),
      supabase.from('feedback_reports').select('*', { count: 'exact', head: true }).eq('status', 'REJECTED'),
      supabase.from('feedback_reports').select('*', { count: 'exact', head: true }).gte('created_at', todayIso),
      supabase.from('feedback_reports').select('*', { count: 'exact', head: true }).gte('created_at', weekIso)
    ]);

    return {
      newCount: newCount || 0,
      inProgressCount: inProgressCount || 0,
      resolvedCount: resolvedCount || 0,
      rejectedCount: rejectedCount || 0,
      todayCount: todayCount || 0,
      thisWeekCount: thisWeekCount || 0
    };
  } catch (err) {
    console.error('Failed to fetch feedback summary stats:', err);
    return {
      newCount: 0,
      inProgressCount: 0,
      resolvedCount: 0,
      rejectedCount: 0,
      todayCount: 0,
      thisWeekCount: 0
    };
  }
}

// ──────────────────────────────────────────────────────────────
// LIST FEEDBACK REPORTS DIRECTLY FROM SUPABASE
// ──────────────────────────────────────────────────────────────
export async function fetchFeedbackReports(
  _token: string,
  params: {
    search?: string;
    status?: string;
    category?: string;
    application?: string;
    package?: string;
    license?: string;
    startDate?: string;
    endDate?: string;
    limit: number;
    offset: number;
  }
): Promise<{ data: FeedbackReport[]; count: number }> {
  try {
    let query = supabase
      .from('feedback_reports')
      .select('*', { count: 'exact' });

    // Apply Filters
    if (params.status) query = query.eq('status', params.status);
    if (params.category) query = query.eq('category', params.category);
    if (params.application) query = query.eq('application_name', params.application);
    if (params.package) query = query.eq('package_name', params.package);
    if (params.license) query = query.eq('license_id', params.license);

    // Date Filters
    if (params.startDate) query = query.gte('created_at', new Date(params.startDate).toISOString());
    if (params.endDate) query = query.lte('created_at', new Date(params.endDate).toISOString());

    // Search Query (Category, Title, Description, License)
    if (params.search) {
      query = query.or(`title.ilike.%${params.search}%,description.ilike.%${params.search}%,category.ilike.%${params.search}%,license_id.ilike.%${params.search}%`);
    }

    // Pagination and Order
    query = query
      .order('created_at', { ascending: false })
      .range(params.offset, params.offset + params.limit - 1);

    const { data, count, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return {
      data: (data as FeedbackReport[]) || [],
      count: count || 0
    };
  } catch (err: any) {
    console.error('Failed to fetch feedback reports directly from Supabase:', err);
    throw err;
  }
}

// ──────────────────────────────────────────────────────────────
// DETAILED REPORT DIRECTLY FROM SUPABASE
// ──────────────────────────────────────────────────────────────
export async function fetchFeedbackReportDetail(
  _token: string,
  id: string
): Promise<FeedbackReport> {
  try {
    const { data, error } = await supabase
      .from('feedback_reports')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error(`Feedback report with ID ${id} not found.`);
    }

    return data as FeedbackReport;
  } catch (err: any) {
    console.error('Failed to fetch feedback details directly from Supabase:', err);
    throw err;
  }
}

// ──────────────────────────────────────────────────────────────
// UPDATE REPORT STATUS/NOTES DIRECTLY IN SUPABASE
// ──────────────────────────────────────────────────────────────
export async function updateFeedbackReport(
  _token: string,
  id: string,
  payload: { status?: string; developer_note?: string }
): Promise<FeedbackReport> {
  try {
    const { data, error } = await supabase
      .from('feedback_reports')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as FeedbackReport;
  } catch (err: any) {
    console.error('Failed to update feedback report directly in Supabase:', err);
    throw err;
  }
}

// ──────────────────────────────────────────────────────────────
// FETCH MESSAGES FOR A FEEDBACK REPORT
// ──────────────────────────────────────────────────────────────
export async function fetchFeedbackMessages(
  reportId: string
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('feedback_messages')
      .select('*')
      .eq('feedback_report_id', reportId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return data || [];
  } catch (err: any) {
    console.error('Failed to fetch feedback messages:', err);
    throw err;
  }
}

// ──────────────────────────────────────────────────────────────
// SEND A REPLY MESSAGE FOR A FEEDBACK REPORT
// ──────────────────────────────────────────────────────────────
export async function sendFeedbackMessage(
  reportId: string,
  senderType: 'ADMIN' | 'CLIENT',
  senderName: string,
  message: string
): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('feedback_messages')
      .insert({
        feedback_report_id: reportId,
        sender_type: senderType,
        sender_name: senderName,
        message: message
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  } catch (err: any) {
    console.error('Failed to send feedback message:', err);
    throw err;
  }
}

// ──────────────────────────────────────────────────────────────
// BULK UPDATE FEEDBACK REPORTS STATUS/NOTES
// ──────────────────────────────────────────────────────────────
export async function bulkUpdateFeedbackReports(
  ids: string[],
  payload: { status?: string; developer_note?: string }
): Promise<void> {
  try {
    const { error } = await supabase
      .from('feedback_reports')
      .update(payload)
      .in('id', ids);

    if (error) {
      throw new Error(error.message);
    }
  } catch (err: any) {
    console.error('Failed to bulk update feedback reports:', err);
    throw err;
  }
}

// ──────────────────────────────────────────────────────────────
// BULK DELETE FEEDBACK REPORTS
// ──────────────────────────────────────────────────────────────
export async function bulkDeleteFeedbackReports(
  ids: string[]
): Promise<void> {
  try {
    const { error } = await supabase
      .from('feedback_reports')
      .delete()
      .in('id', ids);

    if (error) {
      throw new Error(error.message);
    }
  } catch (err: any) {
    console.error('Failed to bulk delete feedback reports:', err);
    throw err;
  }
}

