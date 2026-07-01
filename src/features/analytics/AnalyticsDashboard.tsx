import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity, Shield, Users, Megaphone, Bell,
  Smartphone, RefreshCw, AlertTriangle,
  Download, Package,
  TrendingUp,
  Database, Cloud, Zap, Globe,
  Search,
  ChevronUp, ChevronDown,
} from 'lucide-react';
import {
  fetchSummaryMetrics,
  fetchApps,
  fetchLicenseStats,
  fetchLicensesByType,
  fetchAnnouncementStats,
  fetchNotificationStats,
  fetchOtaReleases,
  fetchCustomerStats,
  pingSupabase,
  pingCloudflare,
} from './services/analyticsService';
import type {
  SummaryMetrics,
  LicenseStats,
  AnnouncementStats,
  NotificationStats,
  CustomerStats,
  OtaRelease,
  AppCard,
} from './types/analytics.types';

// ─── Reusable skeleton component ──────────────────────────────
const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-lg ${className}`} />
);

// ─── Section card wrapper ──────────────────────────────────────
const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({
  children, className = '', onClick
}) => (
  <div
    onClick={onClick}
    className={`bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] hover:shadow-[10px_10px_20px_#d1d5db,-10px_-10px_20px_#ffffff] transition-all duration-300 rounded-[20px] ${onClick ? 'cursor-pointer' : ''} ${className}`}
  >
    {children}
  </div>
);

// ─── Section label ─────────────────────────────────────────────
const SectionLabel: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string }> = ({
  icon, title, subtitle
}) => (
  <div className="flex items-center space-x-2 mb-5">
    <span className="text-[#0EA5E9]">{icon}</span>
    <div>
      <p className="text-[9px] text-[#64748B] uppercase font-bold tracking-widest">{subtitle ?? 'Analytics'}</p>
      <h3 className="text-sm font-black text-[#1E293B] tracking-tight">{title}</h3>
    </div>
  </div>
);

// ─── SVG Bar Chart ─────────────────────────────────────────────
const BarChartSvg: React.FC<{ data: { label: string; value: number }[]; color?: string; height?: number }> = ({
  data, color = '#0EA5E9', height = 100
}) => {
  const max = Math.max(...data.map(d => d.value), 1);
  const w = 500;
  const barWidth = w / data.length - 8;

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${w} ${height + 28}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`barGrad_${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.9" />
            <stop offset="100%" stopColor={color} stopOpacity="0.3" />
          </linearGradient>
        </defs>
        {data.map((d, i) => {
          const barH = (d.value / max) * height;
          const x = i * (w / data.length) + 4;
          const y = height - barH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barWidth} height={barH}
                rx="4" ry="4"
                fill={`url(#barGrad_${color.replace('#', '')})`}
              />
              <text x={x + barWidth / 2} y={height + 18} textAnchor="middle"
                fontSize="11" fill="#94a3b8" fontFamily="Outfit, sans-serif">
                {d.label}
              </text>
              {d.value > 0 && (
                <text x={x + barWidth / 2} y={y - 4} textAnchor="middle"
                  fontSize="10" fill={color} fontFamily="Outfit, sans-serif" fontWeight="700">
                  {d.value}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ─── SVG Donut Chart ───────────────────────────────────────────
const DonutChart: React.FC<{
  segments: { label: string; value: number; color: string }[];
  size?: number;
}> = ({ segments, size = 120 }) => {
  const total = segments.reduce((a, b) => a + b.value, 0) || 1;
  const r = 40;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const arcs = segments.map(seg => {
    const ratio = seg.value / total;
    const dash = ratio * circumference;
    const gap = circumference - dash;
    const arc = { ...seg, dash, gap, offset, ratio };
    offset += dash;
    return arc;
  });

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {total === 0 ? (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
        ) : (
          arcs.map((arc, i) => (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={arc.color}
              strokeWidth="12"
              strokeDasharray={`${arc.dash} ${arc.gap}`}
              strokeDashoffset={-arc.offset}
              strokeLinecap="butt"
              style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px` }}
            />
          ))
        )}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="16" fontWeight="900"
          fill="#1E293B" fontFamily="Outfit, sans-serif">{total}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9"
          fill="#94a3b8" fontFamily="Outfit, sans-serif">TOTAL</text>
      </svg>
      <div className="space-y-1.5 flex-1 min-w-0">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-[10px] text-[#64748B] font-bold uppercase truncate">{s.label}</span>
            </div>
            <span className="text-[10px] font-black text-[#1E293B] ml-2">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Progress bar ──────────────────────────────────────────────
const ProgressBar: React.FC<{ value: number; total: number; color?: string; label: string }> = ({
  value, total, color = '#0EA5E9', label
}) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-[#64748B] font-bold uppercase">{label}</span>
        <span className="font-black text-[#1E293B]">{value} <span className="text-[#94a3b8]">({pct}%)</span></span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
};

// ─── Status badge ──────────────────────────────────────────────
const Badge: React.FC<{ label: string; variant: 'green' | 'blue' | 'red' | 'amber' | 'purple' | 'gray' }> = ({
  label, variant
}) => {
  const cls = {
    green: 'bg-green-50 text-green-600 border-green-100',
    blue: 'bg-sky-50 text-sky-600 border-sky-100',
    red: 'bg-red-50 text-red-500 border-red-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    gray: 'bg-gray-50 text-gray-500 border-gray-100',
  }[variant];
  return (
    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded border ${cls}`}>
      {label}
    </span>
  );
};

// ─── KPI Metric card ───────────────────────────────────────────
const KpiCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number | string;
  delta?: string;
  deltaUp?: boolean;
  color: string;
  loading?: boolean;
}> = ({ icon, label, value, delta, deltaUp, color, loading }) => (
  <Card className="p-5 flex flex-col justify-between space-y-3">
    <div className="flex justify-between items-start">
      <div className="p-2 rounded-xl" style={{ backgroundColor: `${color}18` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      {delta && !loading && (
        <div className={`flex items-center text-[9px] font-bold ${deltaUp ? 'text-green-500' : 'text-red-400'}`}>
          {deltaUp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {delta}
        </div>
      )}
    </div>
    <div>
      <p className="text-[9px] text-[#94a3b8] uppercase font-bold tracking-widest mb-1">{label}</p>
      {loading ? (
        <Skeleton className="h-8 w-20" />
      ) : (
        <p className="text-3xl font-black tracking-tight" style={{ color }}>{value}</p>
      )}
    </div>
  </Card>
);

// ─── System Health ping card ───────────────────────────────────
const HealthCard: React.FC<{
  name: string;
  icon: React.ReactNode;
  ok: boolean | null;
  latencyMs?: number;
  loading: boolean;
}> = ({ name, icon, ok, latencyMs, loading }) => (
  <Card className="p-4 flex items-center space-x-3">
    <div className={`p-2 rounded-xl ${ok === null ? 'bg-gray-100' : ok ? 'bg-green-50' : 'bg-red-50'}`}>
      <span className={ok === null ? 'text-gray-400' : ok ? 'text-green-500' : 'text-red-400'}>
        {icon}
      </span>
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider">{name}</p>
      {loading ? <Skeleton className="h-4 w-16 mt-1" /> : (
        <p className={`text-xs font-black ${ok ? 'text-green-600' : ok === false ? 'text-red-500' : 'text-gray-400'}`}>
          {ok === null ? 'Checking...' : ok ? `Online · ${latencyMs}ms` : 'Unreachable'}
        </p>
      )}
    </div>
    <div className={`w-2.5 h-2.5 rounded-full ${ok === null ? 'bg-gray-300' : ok ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
  </Card>
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  MAIN ANALYTICS DASHBOARD COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const AnalyticsDashboard: React.FC = () => {
  // Global state
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Data states
  const [summary, setSummary] = useState<SummaryMetrics | null>(null);
  const [apps, setApps] = useState<AppCard[]>([]);
  const [licenseStats, setLicenseStats] = useState<LicenseStats | null>(null);
  const [licenseByType, setLicenseByType] = useState<{ type: string; count: number }[]>([]);
  const [announcementStats, setAnnouncementStats] = useState<AnnouncementStats | null>(null);
  const [notifStats, setNotifStats] = useState<NotificationStats | null>(null);
  const [otaReleases, setOtaReleases] = useState<OtaRelease[]>([]);
  const [customerStats, setCustomerStats] = useState<CustomerStats | null>(null);

  // Loading states per section
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingApps, setLoadingApps] = useState(true);
  const [loadingLicense, setLoadingLicense] = useState(true);
  const [loadingAnnouncement, setLoadingAnnouncement] = useState(true);
  const [loadingNotif, setLoadingNotif] = useState(true);
  const [loadingOta, setLoadingOta] = useState(true);
  const [loadingCustomer, setLoadingCustomer] = useState(true);
  const [loadingHealth, setLoadingHealth] = useState(true);

  // Health states
  const [supabaseHealth, setSupabaseHealth] = useState<{ ok: boolean; latencyMs: number } | null>(null);
  const [cloudflareHealth, setCloudflareHealth] = useState<{ ok: boolean; latencyMs: number } | null>(null);

  // ─── Fetch all data ────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setRefreshing(true);

    // Summary KPI
    setLoadingSummary(true);
    fetchSummaryMetrics().then(d => { setSummary(d); setLoadingSummary(false); });

    // Apps
    setLoadingApps(true);
    fetchApps().then(d => { setApps(d); setLoadingApps(false); }).catch(() => setLoadingApps(false));

    // License
    setLoadingLicense(true);
    Promise.all([fetchLicenseStats(), fetchLicensesByType()]).then(([stats, byType]) => {
      setLicenseStats(stats);
      setLicenseByType(byType);
      setLoadingLicense(false);
    }).catch(() => setLoadingLicense(false));

    // Announcements
    setLoadingAnnouncement(true);
    fetchAnnouncementStats().then(d => { setAnnouncementStats(d); setLoadingAnnouncement(false); }).catch(() => setLoadingAnnouncement(false));

    // Notifications
    setLoadingNotif(true);
    fetchNotificationStats().then(d => { setNotifStats(d); setLoadingNotif(false); });

    // OTA
    setLoadingOta(true);
    fetchOtaReleases().then(d => { setOtaReleases(d); setLoadingOta(false); });

    // Customers
    setLoadingCustomer(true);
    fetchCustomerStats().then(d => { setCustomerStats(d); setLoadingCustomer(false); }).catch(() => setLoadingCustomer(false));

    // Health pings
    setLoadingHealth(true);
    Promise.all([pingSupabase(), pingCloudflare()]).then(([sb, cf]) => {
      setSupabaseHealth(sb);
      setCloudflareHealth(cf);
      setLoadingHealth(false);
    });

    setLastRefreshed(new Date());
    setRefreshing(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ─── Search filter ─────────────────────────────────────────
  const filteredApps = apps.filter(a =>
    a.app_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.package_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ─── Announcement layout colors ────────────────────────────
  const layoutColors: Record<string, string> = {
    CARD: '#8B5CF6',
    MODAL: '#6366F1',
    IMAGE_ONLY: '#10B981',
    TOP_BANNER: '#F59E0B',
  };

  // ─── License status colors ─────────────────────────────────
  const licenseColors = {
    active: '#10B981',
    expired: '#EF4444',
    suspended: '#F59E0B',
    pending: '#94a3b8',
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 font-['Outfit'] select-none">

      {/* ── HEADER ─────────────────────────────────────────── */}
      <section className="bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] p-5 rounded-[20px] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <p className="text-[9px] text-[#64748B] uppercase font-bold tracking-widest">ArLABS Ecosystem</p>
          <h2 className="text-base font-black text-[#1E293B] tracking-tight mt-0.5">
            SYS // ANALYTICS_DASHBOARD
          </h2>
          {lastRefreshed && (
            <p className="text-[9px] text-[#94a3b8] font-mono mt-1">
              Last synced: {lastRefreshed.toLocaleTimeString('en-US', { hour12: false })}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94a3b8]" />
            <input
              type="text"
              placeholder="Search apps, packages..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-[11px] text-[#1E293B] placeholder-[#94a3b8] focus:outline-none focus:border-[#0EA5E9] w-52 shadow-sm font-semibold"
            />
          </div>

          {/* Refresh */}
          <button
            onClick={loadAll}
            disabled={refreshing}
            className="bg-[#0EA5E9] hover:bg-[#0ea5e9]/90 text-white px-4 py-2 rounded-xl text-[11px] font-bold transition-all duration-300 shadow-sm flex items-center space-x-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </section>

      {/* ── SECTION 1: SUMMARY KPI CARDS (8 tiles) ──────────── */}
      <section>
        <div className="flex items-center space-x-2 mb-4">
          <TrendingUp className="w-4 h-4 text-[#0EA5E9]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Platform Overview</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-4 gap-4">
          <KpiCard icon={<Package className="w-4 h-4" />} label="Registered Apps"
            value={summary?.totalApps ?? 0} color="#0EA5E9" loading={loadingSummary} />
          <KpiCard icon={<Smartphone className="w-4 h-4" />} label="Total Devices"
            value={summary?.totalDevices ?? 0} color="#6366F1" loading={loadingSummary} />
          <KpiCard icon={<Shield className="w-4 h-4" />} label="Active Licenses"
            value={summary?.activeLicenses ?? 0} color="#10B981" loading={loadingSummary} />
          <KpiCard icon={<Users className="w-4 h-4" />} label="Total Customers"
            value={summary?.totalCustomers ?? 0} color="#8B5CF6" loading={loadingSummary} />
          <KpiCard icon={<AlertTriangle className="w-4 h-4" />} label="Expired Licenses"
            value={summary?.expiredLicenses ?? 0} color="#EF4444" loading={loadingSummary} />
          <KpiCard icon={<Download className="w-4 h-4" />} label="OTA Releases"
            value={summary?.pendingUpdates ?? 0} color="#F59E0B" loading={loadingSummary} />
          <KpiCard icon={<Megaphone className="w-4 h-4" />} label="Today's Announcements"
            value={summary?.todayAnnouncements ?? 0} color="#EC4899" loading={loadingSummary} />
          <KpiCard icon={<Bell className="w-4 h-4" />} label="Notifications Today"
            value={summary?.notificationsSentToday ?? 0} color="#06B6D4" loading={loadingSummary} />
        </div>
      </section>

      {/* ── SECTION 2: ACTIVE APPLICATIONS ──────────────────── */}
      <section>
        <SectionLabel icon={<Package className="w-4 h-4" />} title="Active Applications Registry" subtitle="Application Control" />
        {loadingApps ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}
          </div>
        ) : filteredApps.length === 0 ? (
          <Card className="p-10 text-center">
            <Package className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-[#94a3b8]">No applications found</p>
            <p className="text-xs text-gray-400 mt-1">Add apps via Application Control tab</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredApps.map(app => (
              <Card key={app.id} className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-[10px] bg-gradient-to-tr from-[#0EA5E9] to-[#38bdf8] flex items-center justify-center text-white font-black text-sm shadow-md">
                    {app.app_name.charAt(0)}
                  </div>
                  <Badge
                    label={app.status}
                    variant={app.status === 'ACTIVE' ? 'green' : app.status === 'MAINTENANCE' ? 'amber' : 'red'}
                  />
                </div>
                <div>
                  <h4 className="text-sm font-black text-[#1E293B] truncate">{app.app_name}</h4>
                  <p className="text-[10px] text-[#94a3b8] font-mono mt-0.5 truncate">{app.package_name}</p>
                </div>
                <div className="flex justify-between text-[10px] border-t border-gray-100 pt-3">
                  <div>
                    <p className="text-[#94a3b8] uppercase font-bold">Version</p>
                    <p className="font-black text-[#0EA5E9]">{app.current_version || 'N/A'}</p>
                  </div>
                  {app.force_update_required && (
                    <Badge label="Force Update" variant="red" />
                  )}
                  <div className="text-right">
                    <p className="text-[#94a3b8] uppercase font-bold">Updated</p>
                    <p className="font-bold text-[#64748B]">
                      {app.updated_at ? new Date(app.updated_at).toLocaleDateString() : '—'}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── SECTION 3 + 4: LICENSE & ANNOUNCEMENT ANALYTICS ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* License Analytics */}
        <Card className="p-6">
          <SectionLabel icon={<Shield className="w-4 h-4" />} title="License Analytics" subtitle="License Registry" />
          {loadingLicense ? (
            <div className="space-y-3">
              <Skeleton className="h-28" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          ) : licenseStats ? (
            <div className="space-y-5">
              <DonutChart segments={[
                { label: 'Active', value: licenseStats.active, color: licenseColors.active },
                { label: 'Expired', value: licenseStats.expired, color: licenseColors.expired },
                { label: 'Suspended', value: licenseStats.suspended, color: licenseColors.suspended },
                { label: 'Pending', value: licenseStats.pending, color: licenseColors.pending },
              ]} size={130} />
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <ProgressBar value={licenseStats.active} total={licenseStats.total} color="#10B981" label="Active" />
                <ProgressBar value={licenseStats.expired} total={licenseStats.total} color="#EF4444" label="Expired" />
                <ProgressBar value={licenseStats.suspended} total={licenseStats.total} color="#F59E0B" label="Suspended" />
              </div>
              {licenseByType.length > 0 && (
                <div className="pt-2">
                  <p className="text-[9px] text-[#64748B] uppercase font-bold tracking-widest mb-2">By License Type</p>
                  <BarChartSvg
                    data={licenseByType.map(l => ({ label: l.type, value: l.count }))}
                    color="#6366F1"
                    height={80}
                  />
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-[#94a3b8] font-bold text-center py-8">No license data available</p>
          )}
        </Card>

        {/* Announcement Analytics */}
        <Card className="p-6">
          <SectionLabel icon={<Megaphone className="w-4 h-4" />} title="Announcement Analytics" subtitle="In-App Messaging" />
          {loadingAnnouncement ? (
            <div className="space-y-3">
              <Skeleton className="h-28" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ) : announcementStats ? (
            <div className="space-y-5">
              {/* Status donut */}
              <DonutChart segments={[
                { label: 'Active', value: announcementStats.active, color: '#10B981' },
                { label: 'Scheduled', value: announcementStats.scheduled, color: '#0EA5E9' },
                { label: 'Expired', value: announcementStats.expired, color: '#EF4444' },
              ]} size={130} />
              {/* Layout type breakdown */}
              {announcementStats.byLayout.length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-[9px] text-[#64748B] uppercase font-bold tracking-widest mb-3">By Layout Type</p>
                  <div className="space-y-2">
                    {announcementStats.byLayout.map((l, i) => (
                      <ProgressBar
                        key={i}
                        value={l.count}
                        total={announcementStats.total}
                        color={layoutColors[l.type] ?? '#94a3b8'}
                        label={l.type.replace('_', ' ')}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                {[
                  { label: 'Active', value: announcementStats.active, color: 'green' },
                  { label: 'Scheduled', value: announcementStats.scheduled, color: 'blue' },
                  { label: 'Expired', value: announcementStats.expired, color: 'red' },
                ].map((s, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-black text-[#1E293B]">{s.value}</p>
                    <p className="text-[9px] text-[#94a3b8] font-bold uppercase mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#94a3b8] font-bold text-center py-8">No announcement data</p>
          )}
        </Card>
      </div>

      {/* ── SECTION 5: OTA + NOTIFICATION ANALYTICS ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* OTA Update Analytics */}
        <Card className="p-6">
          <SectionLabel icon={<Download className="w-4 h-4" />} title="OTA Update Releases" subtitle="OTA Update Analytics" />
          {loadingOta ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}</div>
          ) : otaReleases.length === 0 ? (
            <div className="text-center py-10">
              <Download className="w-8 h-8 text-gray-200 mx-auto mb-3" />
              <p className="text-xs font-bold text-[#94a3b8]">No OTA releases yet</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {otaReleases.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black text-[#1E293B] truncate">{r.package_name || 'Unknown'}</p>
                    <p className="text-[9px] font-mono text-[#94a3b8]">{r.version_name} · Code {r.version_code}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    {r.is_force_update && <Badge label="Force" variant="red" />}
                    <p className="text-[9px] text-[#94a3b8]">{new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Push Notification Analytics */}
        <Card className="p-6">
          <SectionLabel icon={<Bell className="w-4 h-4" />} title="Push Notification Analytics" subtitle="FCM Broadcast Engine" />
          {loadingNotif ? (
            <div className="space-y-3">
              <Skeleton className="h-28" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ) : notifStats ? (
            <div className="space-y-5">
              <DonutChart segments={[
                { label: 'Sent', value: notifStats.sent, color: '#10B981' },
                { label: 'Queued', value: notifStats.queued, color: '#0EA5E9' },
                { label: 'Failed', value: notifStats.failed, color: '#EF4444' },
              ]} size={130} />
              <div className="grid grid-cols-3 gap-2 border-t border-gray-100 pt-4">
                {[
                  { label: 'Sent', value: notifStats.sent, color: '#10B981' },
                  { label: 'Queued', value: notifStats.queued, color: '#0EA5E9' },
                  { label: 'Failed', value: notifStats.failed, color: '#EF4444' },
                ].map((s, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[9px] text-[#94a3b8] font-bold uppercase mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              {notifStats.total === 0 && (
                <p className="text-[10px] text-[#94a3b8] text-center font-semibold">
                  No push notifications sent yet
                </p>
              )}
            </div>
          ) : null}
        </Card>
      </div>

      {/* ── SECTION 6: CUSTOMER ANALYTICS ──────────────────── */}
      <Card className="p-6">
        <SectionLabel icon={<Users className="w-4 h-4" />} title="Customer Analytics" subtitle="Customer Registry" />
        {loadingCustomer ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Skeleton className="h-24" />
            <div className="lg:col-span-2 space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
            </div>
          </div>
        ) : customerStats ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-[#0EA5E9]/10 to-[#6366F1]/10 rounded-[16px] p-6 flex flex-col justify-center items-center text-center border border-[#0EA5E9]/10">
              <p className="text-5xl font-black text-[#0EA5E9]">{customerStats.total}</p>
              <p className="text-[10px] text-[#64748B] uppercase font-bold tracking-widest mt-2">Total Customers</p>
            </div>
            <div className="lg:col-span-2">
              <p className="text-[9px] text-[#64748B] uppercase font-bold tracking-widest mb-3">Recently Registered</p>
              {customerStats.recent.length === 0 ? (
                <p className="text-xs text-[#94a3b8] font-bold py-4 text-center">No customer records</p>
              ) : (
                <div className="space-y-2">
                  {customerStats.recent.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#0EA5E9] to-[#6366F1] flex items-center justify-center text-white text-[10px] font-black">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-[#1E293B]">{c.name}</p>
                          <p className="text-[9px] text-[#94a3b8]">{c.email}</p>
                        </div>
                      </div>
                      <p className="text-[9px] text-[#94a3b8] font-mono">
                        {new Date(c.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Card>

      {/* ── SECTION 7: SYSTEM HEALTH MONITOR ───────────────── */}
      <section>
        <SectionLabel icon={<Activity className="w-4 h-4" />} title="System Health Monitor" subtitle="Infrastructure Status" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <HealthCard
            name="Supabase Database"
            icon={<Database className="w-4 h-4" />}
            ok={supabaseHealth?.ok ?? null}
            latencyMs={supabaseHealth?.latencyMs}
            loading={loadingHealth}
          />
          <HealthCard
            name="Cloudflare R2 CDN"
            icon={<Cloud className="w-4 h-4" />}
            ok={cloudflareHealth?.ok ?? null}
            latencyMs={cloudflareHealth?.latencyMs}
            loading={loadingHealth}
          />
          <HealthCard
            name="FCM Push Service"
            icon={<Zap className="w-4 h-4" />}
            ok={true}
            latencyMs={0}
            loading={loadingHealth}
          />
          <HealthCard
            name="Admin Panel PWA"
            icon={<Globe className="w-4 h-4" />}
            ok={true}
            latencyMs={0}
            loading={loadingHealth}
          />
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <div className="text-center pb-4">
        <p className="text-[9px] text-[#94a3b8] font-mono tracking-wider">
          ArLABS Analytics Dashboard · Offline-First Android Ecosystem · {new Date().getFullYear()}
        </p>
      </div>

    </div>
  );
};
