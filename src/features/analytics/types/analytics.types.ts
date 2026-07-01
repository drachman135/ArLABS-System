// ============================================================
// ArLABS Analytics Dashboard — TypeScript Types & DTOs
// ============================================================

export interface SummaryMetrics {
  totalApps: number;
  totalDevices: number;
  activeLicenses: number;
  totalCustomers: number;
  expiredLicenses: number;
  pendingUpdates: number;
  todayAnnouncements: number;
  notificationsSentToday: number;
}

export interface AppCard {
  id: string;
  app_name: string;
  package_name: string;
  current_version: string;
  status: 'ACTIVE' | 'MAINTENANCE' | 'DEPRECATED';
  force_update_required?: boolean;
  download_url?: string;
  updated_at?: string;
}

export interface LicenseStats {
  total: number;
  active: number;
  expired: number;
  suspended: number;
  pending: number;
}

export interface LicenseByType {
  type: string;
  count: number;
}

export interface AnnouncementStats {
  total: number;
  active: number;
  scheduled: number;
  expired: number;
  byLayout: { type: string; count: number }[];
}

export interface OtaRelease {
  id: string;
  package_name: string;
  version_name: string;
  version_code: number;
  is_force_update: boolean;
  created_at: string;
}

export interface NotificationStats {
  total: number;
  sent: number;
  failed: number;
  queued: number;
}

export interface ServiceHealth {
  name: string;
  status: 'ok' | 'degraded' | 'down';
  latencyMs?: number;
  description: string;
}

export interface CustomerStats {
  total: number;
  recent: { id: string; name: string; email: string; created_at: string }[];
}

export interface ChartDataPoint {
  label: string;
  value: number;
}
