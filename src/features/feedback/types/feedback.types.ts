export type FeedbackStatus = 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED';

export interface FeedbackReport {
  id: string;
  status: FeedbackStatus;
  category: string;
  title: string;
  description: string;
  whatsapp: string | null;
  license_id: string;
  application_name: string | null;
  package_name: string;
  app_version: string;
  database_version: string | null;
  android_version: string | null;
  sdk_version: string | null;
  manufacturer: string | null;
  device_brand: string | null;
  device_model: string | null;
  device_name: string | null;
  build_type: string | null;
  diagnostic_log: string | null;
  screenshot_url: string | null;
  developer_note: string | null;
  timestamp: string;
  created_at: string;
  updated_at: string;
}

export interface FeedbackSummaryStats {
  newCount: number;
  inProgressCount: number;
  resolvedCount: number;
  rejectedCount: number;
  todayCount: number;
  thisWeekCount: number;
}
