// ============================================================
// ArLABS APK Download Statistics — TypeScript Types & DTOs
// Offline-First Architecture: data collected during natural
// server sync events only (activation, update check, etc.)
// ============================================================

export interface DownloadSummaryMetrics {
  totalDownloads: number;
  downloadsToday: number;
  downloadsThisWeek: number;
  downloadsThisMonth: number;
  latestReleaseDownloads: number;
  activeInstalledDevices: number;
  updateAdoptionRate: number;   // percentage 0-100
  downloadSuccessRate: number;  // percentage 0-100
}

export interface ApkDownloadLog {
  id: string;
  package_name: string;
  version_name: string;
  version_code: number;
  device_id: string | null;
  android_version: string | null;
  manufacturer: string | null;
  device_model: string | null;
  architecture: string | null;
  screen_density: string | null;
  download_source: 'CLOUDFLARE_CDN' | 'QR_CODE' | 'DIRECT_LINK' | 'WEBSITE' | 'GITHUB' | 'OTHER';
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  downloaded_at: string;
  installed_at: string | null;
  created_at: string;
}

export interface AppDownloadCard {
  id: string;
  app_name: string;
  package_name: string;
  current_version: string;
  latest_version: string;
  total_downloads: number;
  unique_devices: number;
  last_download_at: string | null;
  status: 'ACTIVE' | 'MAINTENANCE' | 'DEPRECATED';
  force_update_required?: boolean;
  download_url?: string;
  updated_at?: string;
}

export interface VersionStat {
  version_name: string;
  version_code: number;
  package_name: string;
  release_date: string;
  total_downloads: number;
  active_installations: number;
  adoption_percentage: number;
  is_force_update: boolean;
}

export interface DownloadChartPoint {
  label: string;
  value: number;
}

export interface DeviceDistribution {
  label: string;
  count: number;
  percentage: number;
}

export interface DownloadFilter {
  packageName: string;
  version: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}
