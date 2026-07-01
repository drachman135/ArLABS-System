// ============================================================
// ArLABS Crash & Error Reporting — TypeScript Types & DTOs
// ============================================================

export type ErrorSeverity = 'FATAL' | 'NON_FATAL' | 'ANR' | 'CRITICAL';
export type IssueStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'IGNORED' | 'ARCHIVED';

export interface DeviceMetadata {
  android_version: string;
  manufacturer: string;
  device_model: string;
  architecture: string;
  ram_total_gb: number;
  ram_available_gb: number;
  storage_total_gb: number;
  storage_available_gb: number;
  screen_resolution: string;
  screen_density: string;
  locale: string;
}

export interface CrashReport {
  id: string;
  issue_id: string;
  package_name: string;
  app_name: string;
  app_version: string;
  version_code: number;
  severity: ErrorSeverity;
  exception_type: string;
  exception_message: string;
  stack_trace: string;
  device_id: string;
  device_info: DeviceMetadata;
  license_id: string | null;
  customer_id: string | null;
  created_at: string;
  synced_at: string;
}

export interface IssueGroup {
  id: string;
  title: string;
  exception_type: string;
  exception_message: string;
  package_name: string;
  severity: ErrorSeverity;
  occurrences: number;
  affected_devices: number;
  first_seen: string;
  last_seen: string;
  status: IssueStatus;
  notes: string | null;
  developer_comments?: DeveloperComment[];
}

export interface DeveloperComment {
  id: string;
  issue_id: string;
  author: string;
  comment: string;
  created_at: string;
}

export interface CrashSummaryMetrics {
  totalCrashes: number;
  nonFatalErrors: number;
  crashFreeDevicesRate: number; // e.g. 98.7%
  crashFreeSessionsRate: number; // e.g. 99.2%
  todayCrashes: number;
  newIssuesCount: number;
  resolvedIssuesCount: number;
  appsAffectedCount: number;
}
