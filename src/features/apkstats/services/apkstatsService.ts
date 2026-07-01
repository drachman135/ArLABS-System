// ============================================================
// ArLABS APK Download Statistics — Service Layer
//
// OFFLINE-FIRST ARCHITECTURE NOTE:
// Data is collected only during natural server communication:
//   - License Activation  → records device + version installed
//   - Update Check        → records version check event
//   - Announcement Sync   → piggyback telemetry
//   - Remote Config Sync  → piggyback telemetry
//   - Manual Sync         → explicit user-triggered sync
//
// Never require continuous online tracking.
// Never use background analytics services.
// ============================================================

import { supabase } from '../../../core/supabase';
import type {
  DownloadSummaryMetrics,
  ApkDownloadLog,
  AppDownloadCard,
  VersionStat,
  DownloadChartPoint,
  DeviceDistribution,
} from '../types/apkstats.types';

// ──────────────────────────────────────────────────────────────
// SUMMARY METRICS — 8 KPI tiles
// Falls back gracefully if apk_download_logs table doesn't exist
// ──────────────────────────────────────────────────────────────
export async function fetchDownloadSummary(): Promise<DownloadSummaryMetrics> {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
  const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  try {
    const [totalRes, todayRes, weekRes, monthRes, successRes, failedRes, devicesRes] = await Promise.allSettled([
      supabase.from('apk_download_logs').select('*', { count: 'exact', head: true }),
      supabase.from('apk_download_logs').select('*', { count: 'exact', head: true }).gte('downloaded_at', todayStart.toISOString()),
      supabase.from('apk_download_logs').select('*', { count: 'exact', head: true }).gte('downloaded_at', weekStart.toISOString()),
      supabase.from('apk_download_logs').select('*', { count: 'exact', head: true }).gte('downloaded_at', monthStart.toISOString()),
      supabase.from('apk_download_logs').select('*', { count: 'exact', head: true }).eq('status', 'SUCCESS'),
      supabase.from('apk_download_logs').select('*', { count: 'exact', head: true }).eq('status', 'FAILED'),
      supabase.from('devices').select('*', { count: 'exact', head: true }),
    ]);

    const getCount = (r: PromiseSettledResult<any>) =>
      r.status === 'fulfilled' ? (r.value.count ?? 0) : 0;

    const totalDownloads = getCount(totalRes);
    const successCount = getCount(successRes);
    const failedCount = getCount(failedRes);
    const totalAttempts = successCount + failedCount;

    // Get latest release downloads — use the most recent app_updates entry
    const { data: latestRelease } = await supabase
      .from('app_updates')
      .select('version_name, package_name')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let latestReleaseDownloads = 0;
    if (latestRelease) {
      const { count } = await supabase
        .from('apk_download_logs')
        .select('*', { count: 'exact', head: true })
        .eq('version_name', latestRelease.version_name)
        .eq('package_name', latestRelease.package_name);
      latestReleaseDownloads = count ?? 0;
    }

    const activeDevices = getCount(devicesRes);

    // Adoption rate: devices that have downloaded latest version / total devices
    const adoptionRate = activeDevices > 0
      ? Math.round((latestReleaseDownloads / Math.max(activeDevices, 1)) * 100)
      : 0;

    const successRate = totalAttempts > 0
      ? Math.round((successCount / totalAttempts) * 100)
      : 100; // assume 100% if no data

    return {
      totalDownloads,
      downloadsToday: getCount(todayRes),
      downloadsThisWeek: getCount(weekRes),
      downloadsThisMonth: getCount(monthRes),
      latestReleaseDownloads,
      activeInstalledDevices: activeDevices,
      updateAdoptionRate: Math.min(adoptionRate, 100),
      downloadSuccessRate: successRate,
    };
  } catch {
    // Graceful fallback when table doesn't exist
    const { count: deviceCount } = await supabase
      .from('devices')
      .select('*', { count: 'exact', head: true });

    return {
      totalDownloads: 0,
      downloadsToday: 0,
      downloadsThisWeek: 0,
      downloadsThisMonth: 0,
      latestReleaseDownloads: 0,
      activeInstalledDevices: deviceCount ?? 0,
      updateAdoptionRate: 0,
      downloadSuccessRate: 100,
    };
  }
}

// ──────────────────────────────────────────────────────────────
// DOWNLOAD LOGS — paginated list with filters
// ──────────────────────────────────────────────────────────────
export async function fetchDownloadLogs(
  filters: {
    packageName?: string;
    version?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ data: ApkDownloadLog[]; total: number }> {
  try {
    let query = supabase
      .from('apk_download_logs')
      .select('*', { count: 'exact' })
      .order('downloaded_at', { ascending: false });

    if (filters.packageName) query = query.eq('package_name', filters.packageName);
    if (filters.version) query = query.eq('version_name', filters.version);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.dateFrom) query = query.gte('downloaded_at', filters.dateFrom);
    if (filters.dateTo) query = query.lte('downloaded_at', filters.dateTo);

    const from = filters.offset ?? 0;
    const to = from + (filters.limit ?? 20) - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;

    return { data: (data ?? []) as ApkDownloadLog[], total: count ?? 0 };
  } catch {
    return { data: [], total: 0 };
  }
}

// ──────────────────────────────────────────────────────────────
// APP DOWNLOAD CARDS — per-application summary
// Merges applications table with download log aggregates
// ──────────────────────────────────────────────────────────────
export async function fetchAppDownloadCards(): Promise<AppDownloadCard[]> {
  const { data: apps, error } = await supabase
    .from('applications')
    .select('id, app_name, package_name, current_version, status, force_update_required, download_url, updated_at')
    .order('app_name', { ascending: true });

  if (error || !apps) return [];

  // Enrich each app with download counts from apk_download_logs
  const enriched = await Promise.all(
    apps.map(async (app) => {
      let totalDownloads = 0;
      let uniqueDevices = 0;
      let lastDownload: string | null = null;

      try {
        const { count: dlCount } = await supabase
          .from('apk_download_logs')
          .select('*', { count: 'exact', head: true })
          .eq('package_name', app.package_name);

        // Unique devices via distinct device_id - approximate using count distinct approach
        const { data: devices } = await supabase
          .from('apk_download_logs')
          .select('device_id')
          .eq('package_name', app.package_name)
          .not('device_id', 'is', null);

        const { data: lastLog } = await supabase
          .from('apk_download_logs')
          .select('downloaded_at')
          .eq('package_name', app.package_name)
          .order('downloaded_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        totalDownloads = dlCount ?? 0;
        uniqueDevices = new Set((devices ?? []).map((d: any) => d.device_id)).size;
        lastDownload = lastLog?.downloaded_at ?? null;
      } catch {
        // Table may not exist yet — show 0
      }

      return {
        id: app.id,
        app_name: app.app_name,
        package_name: app.package_name,
        current_version: app.current_version ?? 'N/A',
        latest_version: app.current_version ?? 'N/A',
        total_downloads: totalDownloads,
        unique_devices: uniqueDevices,
        last_download_at: lastDownload,
        status: app.status,
        force_update_required: app.force_update_required,
        download_url: app.download_url,
        updated_at: app.updated_at,
      } as AppDownloadCard;
    })
  );

  return enriched;
}

// ──────────────────────────────────────────────────────────────
// VERSION ANALYTICS — from app_updates table
// ──────────────────────────────────────────────────────────────
export async function fetchVersionStats(): Promise<VersionStat[]> {
  const { data: updates, error } = await supabase
    .from('app_updates')
    .select('id, package_name, version_name, version_code, is_force_update, created_at')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error || !updates) return [];

  const stats = await Promise.all(
    updates.map(async (u) => {
      let totalDownloads = 0;
      let activeInstallations = 0;

      try {
        const { count: dlCount } = await supabase
          .from('apk_download_logs')
          .select('*', { count: 'exact', head: true })
          .eq('package_name', u.package_name)
          .eq('version_name', u.version_name)
          .eq('status', 'SUCCESS');

        const { count: installedCount } = await supabase
          .from('apk_download_logs')
          .select('*', { count: 'exact', head: true })
          .eq('package_name', u.package_name)
          .eq('version_name', u.version_name)
          .not('installed_at', 'is', null);

        totalDownloads = dlCount ?? 0;
        activeInstallations = installedCount ?? 0;
      } catch { /* table may not exist */ }

      return {
        version_name: u.version_name,
        version_code: u.version_code,
        package_name: u.package_name,
        release_date: u.created_at,
        total_downloads: totalDownloads,
        active_installations: activeInstallations,
        adoption_percentage: 0, // computed in UI from total devices
        is_force_update: u.is_force_update,
      } as VersionStat;
    })
  );

  return stats;
}

// ──────────────────────────────────────────────────────────────
// DAILY DOWNLOAD CHART — last 14 days
// ──────────────────────────────────────────────────────────────
export async function fetchDailyDownloads(): Promise<DownloadChartPoint[]> {
  const points: DownloadChartPoint[] = [];

  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(d.getDate() + 1);

    const label = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

    try {
      const { count } = await supabase
        .from('apk_download_logs')
        .select('*', { count: 'exact', head: true })
        .gte('downloaded_at', d.toISOString())
        .lt('downloaded_at', next.toISOString());
      points.push({ label, value: count ?? 0 });
    } catch {
      points.push({ label, value: 0 });
    }
  }

  return points;
}

// ──────────────────────────────────────────────────────────────
// DEVICE DISTRIBUTION from apk_download_logs
// ──────────────────────────────────────────────────────────────
export async function fetchManufacturerDistribution(): Promise<DeviceDistribution[]> {
  try {
    const { data, error } = await supabase
      .from('apk_download_logs')
      .select('manufacturer')
      .not('manufacturer', 'is', null);

    if (error || !data) return [];

    const counts: Record<string, number> = {};
    data.forEach((r: any) => {
      const m = r.manufacturer ?? 'Unknown';
      counts[m] = (counts[m] ?? 0) + 1;
    });

    const total = data.length || 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, count]) => ({
        label,
        count,
        percentage: Math.round((count / total) * 100),
      }));
  } catch {
    return [];
  }
}

export async function fetchAndroidVersionDistribution(): Promise<DeviceDistribution[]> {
  try {
    const { data, error } = await supabase
      .from('apk_download_logs')
      .select('android_version')
      .not('android_version', 'is', null);

    if (error || !data) return [];

    const counts: Record<string, number> = {};
    data.forEach((r: any) => {
      const v = r.android_version ?? 'Unknown';
      counts[v] = (counts[v] ?? 0) + 1;
    });

    const total = data.length || 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, count]) => ({
        label: `Android ${label}`,
        count,
        percentage: Math.round((count / total) * 100),
      }));
  } catch {
    return [];
  }
}
