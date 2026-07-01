// ============================================================
// ArLABS Crash & Error Reporting — Service Layer
//
// OFFLINE-FIRST ARCHITECTURE NOTE:
// Crash reports are cached locally on client devices in SQLite.
// They are sent via HTTP POST to the server when the device is
// naturally syncing (checking config, activating licenses, etc.).
// This service provides reading and editing capabilities for the dashboard.
// ============================================================

import { supabase } from '../../../core/supabase';
import type {
  CrashSummaryMetrics,
  IssueGroup,
  CrashReport,
  DeveloperComment,
  IssueStatus,
} from '../types/crash.types';

// ──────────────────────────────────────────────────────────────
// SUMMARY STATISTICS
// ──────────────────────────────────────────────────────────────
export async function fetchCrashSummary(): Promise<CrashSummaryMetrics> {
  try {
    const { count: fatalCount } = await supabase
      .from('crash_reports')
      .select('*', { count: 'exact', head: true })
      .eq('severity', 'FATAL');

    const { count: nonFatalCount } = await supabase
      .from('crash_reports')
      .select('*', { count: 'exact', head: true })
      .not('severity', 'eq', 'FATAL');

    const { count: totalIssues } = await supabase
      .from('crash_issues')
      .select('*', { count: 'exact', head: true });

    const { count: resolvedIssues } = await supabase
      .from('crash_issues')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'RESOLVED');

    const { count: affectedApps } = await supabase
      .from('applications')
      .select('*', { count: 'exact', head: true });

    const total = (fatalCount ?? 0) + (nonFatalCount ?? 0);
    const crashFreeRate = total > 0 ? Math.max(0, 100 - (total / 100)) : 100;

    return {
      totalCrashes: fatalCount ?? 0,
      nonFatalErrors: nonFatalCount ?? 0,
      crashFreeDevicesRate: Math.round(crashFreeRate * 10) / 10,
      crashFreeSessionsRate: Math.round(crashFreeRate * 10) / 10,
      todayCrashes: 0,
      newIssuesCount: (totalIssues ?? 0) - (resolvedIssues ?? 0),
      resolvedIssuesCount: resolvedIssues ?? 0,
      appsAffectedCount: affectedApps ?? 0,
    };
  } catch {
    return {
      totalCrashes: 0,
      nonFatalErrors: 0,
      crashFreeDevicesRate: 100,
      crashFreeSessionsRate: 100,
      todayCrashes: 0,
      newIssuesCount: 0,
      resolvedIssuesCount: 0,
      appsAffectedCount: 0,
    };
  }
}

// ──────────────────────────────────────────────────────────────
// ISSUE LISTINGS (GROUPED ISSUES)
// ──────────────────────────────────────────────────────────────
export async function fetchCrashIssues(filters: {
  status?: string;
  severity?: string;
  packageName?: string;
  searchQuery?: string;
} = {}): Promise<IssueGroup[]> {
  try {
    let query = supabase.from('crash_issues').select('*').order('last_seen', { ascending: false });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.severity) query = query.eq('severity', filters.severity);
    if (filters.packageName) query = query.eq('package_name', filters.packageName);

    const { data, error } = await query;
    if (error) throw error;

    let result = (data ?? []) as IssueGroup[];

    if (filters.searchQuery) {
      const sq = filters.searchQuery.toLowerCase();
      result = result.filter(r =>
        r.title.toLowerCase().includes(sq) ||
        r.exception_type.toLowerCase().includes(sq) ||
        r.exception_message.toLowerCase().includes(sq)
      );
    }

    return result;
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────────────────────────
// DETAILED CRASH REPORTS FOR AN ISSUE
// ──────────────────────────────────────────────────────────────
export async function fetchCrashReportsForIssue(issueId: string): Promise<CrashReport[]> {
  try {
    const { data, error } = await supabase
      .from('crash_reports')
      .select('*')
      .eq('issue_id', issueId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as CrashReport[];
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────────────────────────
// ISSUE CONTROL (UPDATE STATUS & NOTES)
// ──────────────────────────────────────────────────────────────
export async function updateIssueStatus(issueId: string, status: IssueStatus): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('crash_issues')
      .update({ status })
      .eq('id', issueId);
    return !error;
  } catch {
    return false;
  }
}

export async function updateIssueNotes(issueId: string, notes: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('crash_issues')
      .update({ notes })
      .eq('id', issueId);
    return !error;
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────────────────────
// DEVELOPER COMMENTS / COLLABORATION
// ──────────────────────────────────────────────────────────────
export async function fetchIssueComments(issueId: string): Promise<DeveloperComment[]> {
  try {
    const { data, error } = await supabase
      .from('crash_comments')
      .select('*')
      .eq('issue_id', issueId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data ?? []) as DeveloperComment[];
  } catch {
    return [];
  }
}

export async function addIssueComment(issueId: string, author: string, comment: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('crash_comments')
      .insert([{ issue_id: issueId, author, comment }]);
    return !error;
  } catch {
    return false;
  }
}
