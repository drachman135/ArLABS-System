// ============================================================
// ArLABS Analytics Dashboard — Analytics Service Layer
// All Supabase aggregate queries are isolated here.
// Each function is independent and can be swapped with a REST API later.
// ============================================================

import { supabase } from '../../../core/supabase';
import type {
  SummaryMetrics,
  LicenseStats,
  AnnouncementStats,
  NotificationStats,
  CustomerStats,
  OtaRelease,
  AppCard,
} from '../types/analytics.types';

// ──────────────────────────────────────────────────────────────
// SUMMARY METRICS — Top KPI strip (8 cards)
// ──────────────────────────────────────────────────────────────
export async function fetchSummaryMetrics(): Promise<SummaryMetrics> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();

  const [
    appsRes,
    devicesRes,
    activeLicRes,
    expiredLicRes,
    customersRes,
    announcementsRes,
    notifRes,
    updatesRes,
  ] = await Promise.allSettled([
    supabase.from('applications').select('*', { count: 'exact', head: true }),
    supabase.from('devices').select('*', { count: 'exact', head: true }),
    supabase.from('licenses').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
    supabase.from('licenses').select('*', { count: 'exact', head: true }).in('status', ['EXPIRED', 'SUSPENDED']),
    supabase.from('customers').select('*', { count: 'exact', head: true }),
    supabase.from('announcements').select('*', { count: 'exact', head: true }).gte('created_at', todayIso),
    supabase.from('notification_logs').select('*', { count: 'exact', head: true }).gte('created_at', todayIso).eq('status', 'SENT'),
    supabase.from('app_updates').select('*', { count: 'exact', head: true }),
  ]);

  const get = (res: PromiseSettledResult<any>, field = 'count') =>
    res.status === 'fulfilled' ? (res.value[field] ?? 0) : 0;

  return {
    totalApps: get(appsRes),
    totalDevices: get(devicesRes),
    activeLicenses: get(activeLicRes),
    expiredLicenses: get(expiredLicRes),
    totalCustomers: get(customersRes),
    todayAnnouncements: get(announcementsRes),
    notificationsSentToday: get(notifRes),
    pendingUpdates: get(updatesRes),
  };
}

// ──────────────────────────────────────────────────────────────
// APPLICATIONS — Active app registry cards
// ──────────────────────────────────────────────────────────────
export async function fetchApps(): Promise<AppCard[]> {
  const { data, error } = await supabase
    .from('applications')
    .select('id, app_name, package_name, current_version, status, force_update_required, download_url, updated_at')
    .order('app_name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as AppCard[];
}

// ──────────────────────────────────────────────────────────────
// LICENSE ANALYTICS
// ──────────────────────────────────────────────────────────────
export async function fetchLicenseStats(): Promise<LicenseStats> {
  const { data, error } = await supabase
    .from('licenses')
    .select('status');

  if (error) throw error;

  const rows = data ?? [];
  return {
    total: rows.length,
    active: rows.filter(r => r.status === 'ACTIVE').length,
    expired: rows.filter(r => r.status === 'EXPIRED').length,
    suspended: rows.filter(r => r.status === 'SUSPENDED').length,
    pending: rows.filter(r => r.status === 'PENDING').length,
  };
}

export async function fetchLicensesByType() {
  const { data, error } = await supabase
    .from('licenses')
    .select('type');

  if (error) throw error;
  const rows = data ?? [];

  const counts: Record<string, number> = {};
  rows.forEach(r => {
    counts[r.type] = (counts[r.type] ?? 0) + 1;
  });

  return Object.entries(counts).map(([type, count]) => ({ type, count }));
}

// ──────────────────────────────────────────────────────────────
// ANNOUNCEMENT ANALYTICS
// ──────────────────────────────────────────────────────────────
export async function fetchAnnouncementStats(): Promise<AnnouncementStats> {
  const { data, error } = await supabase
    .from('announcements')
    .select('type, start_date, end_date');

  if (error) throw error;

  const now = new Date();
  const rows = data ?? [];

  const byLayout: Record<string, number> = {};
  let active = 0, scheduled = 0, expired = 0;

  rows.forEach(r => {
    const start = new Date(r.start_date);
    const end = new Date(r.end_date);
    if (now < start) scheduled++;
    else if (now > end) expired++;
    else active++;

    byLayout[r.type] = (byLayout[r.type] ?? 0) + 1;
  });

  return {
    total: rows.length,
    active,
    scheduled,
    expired,
    byLayout: Object.entries(byLayout).map(([type, count]) => ({ type, count })),
  };
}

// ──────────────────────────────────────────────────────────────
// NOTIFICATION ANALYTICS
// ──────────────────────────────────────────────────────────────
export async function fetchNotificationStats(): Promise<NotificationStats> {
  try {
    const { data, error } = await supabase
      .from('notification_logs')
      .select('status');

    if (error) throw error;
    const rows = data ?? [];

    return {
      total: rows.length,
      sent: rows.filter(r => r.status === 'SENT').length,
      failed: rows.filter(r => r.status === 'FAILED').length,
      queued: rows.filter(r => r.status === 'QUEUED').length,
    };
  } catch {
    return { total: 0, sent: 0, failed: 0, queued: 0 };
  }
}

// ──────────────────────────────────────────────────────────────
// OTA ANALYTICS
// ──────────────────────────────────────────────────────────────
export async function fetchOtaReleases(): Promise<OtaRelease[]> {
  try {
    const { data, error } = await supabase
      .from('app_updates')
      .select('id, package_name, version_name, version_code, is_force_update, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return (data ?? []) as OtaRelease[];
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────────────────────────
// CUSTOMER ANALYTICS
// ──────────────────────────────────────────────────────────────
export async function fetchCustomerStats(): Promise<CustomerStats> {
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, email, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) throw error;
  const rows = data ?? [];

  const { count } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true });

  return {
    total: count ?? rows.length,
    recent: rows,
  };
}

// ──────────────────────────────────────────────────────────────
// SYSTEM HEALTH — ping services
// ──────────────────────────────────────────────────────────────
export async function pingSupabase(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = performance.now();
  try {
    const { error } = await supabase.from('admins').select('id').limit(1);
    const latencyMs = Math.round(performance.now() - start);
    return { ok: !error, latencyMs };
  } catch {
    return { ok: false, latencyMs: 0 };
  }
}

export async function pingCloudflare(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = performance.now();
  try {
    const res = await fetch('https://apk.ultralink.my.id/announcements.json', { method: 'HEAD' });
    const latencyMs = Math.round(performance.now() - start);
    return { ok: res.ok, latencyMs };
  } catch {
    return { ok: false, latencyMs: 0 };
  }
}
