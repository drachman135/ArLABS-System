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
// LIST FEEDBACK REPORTS VIA SERVERLESS API
// ──────────────────────────────────────────────────────────────
export async function fetchFeedbackReports(
  token: string,
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
  const url = new URL('/api/feedback', window.location.origin);
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== '') {
      url.searchParams.set(key, String(val));
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to fetch feedback reports');
  }

  const result = await response.json();
  return {
    data: result.data || [],
    count: result.count || 0
  };
}

// ──────────────────────────────────────────────────────────────
// DETAILED REPORT VIA SERVERLESS API
// ──────────────────────────────────────────────────────────────
export async function fetchFeedbackReportDetail(
  token: string,
  id: string
): Promise<FeedbackReport> {
  const response = await fetch(`/api/feedback/${id}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to fetch feedback details');
  }

  const result = await response.json();
  return result.data;
}

// ──────────────────────────────────────────────────────────────
// UPDATE REPORT STATUS/NOTES VIA SERVERLESS API
// ──────────────────────────────────────────────────────────────
export async function updateFeedbackReport(
  token: string,
  id: string,
  payload: { status?: string; developer_note?: string }
): Promise<FeedbackReport> {
  const response = await fetch(`/api/feedback/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to update feedback report');
  }

  const result = await response.json();
  return result.data;
}
