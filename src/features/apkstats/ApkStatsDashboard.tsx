import React, { useEffect, useState, useCallback } from 'react';
import {
  Download, Smartphone, TrendingUp, CheckCircle2, AlertTriangle,
  RefreshCw, Search, Filter, Package, BarChart2, Activity,
  ChevronUp, ChevronDown,
  Calendar, ArrowUpRight, Clock, Zap, Shield,
} from 'lucide-react';
import {
  fetchDownloadSummary,
  fetchAppDownloadCards,
  fetchVersionStats,
  fetchDailyDownloads,
  fetchManufacturerDistribution,
  fetchAndroidVersionDistribution,
  fetchDownloadLogs,
} from './services/apkstatsService';
import type {
  DownloadSummaryMetrics,
  AppDownloadCard,
  VersionStat,
  DownloadChartPoint,
  DeviceDistribution,
  ApkDownloadLog,
} from './types/apkstats.types';

// ─── Skeleton loading placeholder ──────────────────────────────
const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-lg ${className}`} />
);

// ─── Section card wrapper ──────────────────────────────────────
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] hover:shadow-[10px_10px_20px_#d1d5db,-10px_-10px_20px_#ffffff] transition-all duration-300 rounded-[20px] ${className}`}>
    {children}
  </div>
);

// ─── Section header label ──────────────────────────────────────
const SectionLabel: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode }> = ({
  icon, title, subtitle, action
}) => (
  <div className="flex items-center justify-between mb-5">
    <div className="flex items-center space-x-2">
      <span className="text-[#0EA5E9]">{icon}</span>
      <div>
        <p className="text-[9px] text-[#64748B] uppercase font-bold tracking-widest">{subtitle ?? 'APK Statistics'}</p>
        <h3 className="text-sm font-black text-[#1E293B] tracking-tight">{title}</h3>
      </div>
    </div>
    {action}
  </div>
);

// ─── KPI Card ─────────────────────────────────────────────────
const KpiCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number | string;
  suffix?: string;
  color: string;
  bg: string;
  loading?: boolean;
  delta?: string;
  deltaUp?: boolean;
}> = ({ icon, label, value, suffix, color, bg, loading, delta, deltaUp }) => (
  <Card className="p-5 space-y-3">
    <div className="flex items-start justify-between">
      <div className={`p-2.5 rounded-xl ${bg}`}>
        <span style={{ color }}>{icon}</span>
      </div>
      {delta && !loading && (
        <span className={`flex items-center text-[9px] font-bold ${deltaUp ? 'text-emerald-500' : 'text-red-400'}`}>
          {deltaUp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {delta}
        </span>
      )}
    </div>
    <div>
      <p className="text-[9px] text-[#94a3b8] uppercase font-bold tracking-widest mb-0.5">{label}</p>
      {loading ? <Skeleton className="h-8 w-24 mt-1" /> : (
        <p className="text-3xl font-black tracking-tight" style={{ color }}>
          {value}{suffix && <span className="text-base ml-1 text-[#94a3b8]">{suffix}</span>}
        </p>
      )}
    </div>
  </Card>
);

// ─── Status badge ──────────────────────────────────────────────
const Badge: React.FC<{ label: string; color: 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'gray' }> = ({
  label, color
}) => {
  const cls = {
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    red: 'bg-red-50 text-red-500 border-red-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    blue: 'bg-sky-50 text-sky-600 border-sky-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    gray: 'bg-gray-50 text-gray-500 border-gray-100',
  }[color];
  return <span className={`px-2 py-0.5 text-[8px] font-bold uppercase rounded border ${cls}`}>{label}</span>;
};

// ─── Pure SVG line/area chart ──────────────────────────────────
const AreaChart: React.FC<{
  data: DownloadChartPoint[];
  color?: string;
  height?: number;
}> = ({ data, color = '#0EA5E9', height = 110 }) => {
  if (!data.length) return <div className="h-28 flex items-center justify-center text-xs text-[#94a3b8] font-bold">No data available</div>;

  const w = 600;
  const max = Math.max(...data.map(d => d.value), 1);
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = height - (d.value / max) * (height - 10);
    return `${x},${y}`;
  });
  const areaPath = `M 0,${height} L ${pts.join(' L ')} L ${w},${height} Z`;
  const linePath = `M ${pts.join(' L ')}`;
  const gradId = `areaGrad_${color.replace('#', '')}`;

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${w} ${height + 28}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {/* grid lines */}
        {[0.25, 0.5, 0.75].map((f, i) => (
          <line key={i} x1="0" y1={height * f} x2={w} y2={height * f}
            stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4,4" />
        ))}
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* dots + labels */}
        {data.map((d, i) => {
          const x = (i / (data.length - 1)) * w;
          const y = height - (d.value / max) * (height - 10);
          const showLabel = i % Math.ceil(data.length / 7) === 0 || i === data.length - 1;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="3.5" fill={color} stroke="white" strokeWidth="1.5" />
              {showLabel && (
                <text x={x} y={height + 18} textAnchor="middle" fontSize="9"
                  fill="#94a3b8" fontFamily="Outfit, sans-serif">{d.label}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ─── Horizontal bar chart ──────────────────────────────────────
const HBarChart: React.FC<{
  items: DeviceDistribution[];
  color?: string;
}> = ({ items, color = '#6366F1' }) => {
  if (!items.length) return <p className="text-xs text-[#94a3b8] font-bold text-center py-6">No data</p>;
  const maxCount = Math.max(...items.map(i => i.count), 1);
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => (
        <div key={i} className="space-y-0.5">
          <div className="flex justify-between text-[10px]">
            <span className="text-[#64748B] font-bold truncate max-w-[60%]">{item.label}</span>
            <span className="font-black text-[#1E293B] ml-2">{item.count} <span className="text-[#94a3b8] font-normal">({item.percentage}%)</span></span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(item.count / maxCount) * 100}%`, backgroundColor: color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Progress ring ─────────────────────────────────────────────
const ProgressRing: React.FC<{
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label: string;
  sublabel?: string;
}> = ({ value, size = 100, stroke = 10, color = '#0EA5E9', label, sublabel }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (Math.min(value, 100) / 100) * circ;
  const cx = size / 2;

  return (
    <div className="flex flex-col items-center space-y-1">
      <svg width={size} height={size}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#E2E8F0" strokeWidth={stroke} />
        <circle
          cx={cx} cy={cx} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cx}px`, transition: 'stroke-dasharray 0.8s ease' }}
        />
        <text x={cx} y={cx - 4} textAnchor="middle" fontSize="18" fontWeight="900"
          fill="#1E293B" fontFamily="Outfit, sans-serif">{value}%</text>
        {sublabel && (
          <text x={cx} y={cx + 12} textAnchor="middle" fontSize="8"
            fill="#94a3b8" fontFamily="Outfit, sans-serif">{sublabel}</text>
        )}
      </svg>
      <span className="text-[10px] text-[#64748B] font-bold uppercase text-center">{label}</span>
    </div>
  );
};

// ─── Empty state ───────────────────────────────────────────────
const EmptyState: React.FC<{ icon: React.ReactNode; title: string; subtitle: string }> = ({
  icon, title, subtitle
}) => (
  <div className="flex flex-col items-center justify-center py-12 space-y-3">
    <div className="text-gray-200">{icon}</div>
    <p className="text-sm font-black text-[#94a3b8]">{title}</p>
    <p className="text-xs text-gray-400 text-center max-w-xs">{subtitle}</p>
  </div>
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  MAIN APK DOWNLOAD STATISTICS COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const ApkStatsDashboard: React.FC = () => {
  // ─── State ────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'overview' | 'versions' | 'devices' | 'logs'>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPackage, setFilterPackage] = useState('');

  // Data states
  const [summary, setSummary] = useState<DownloadSummaryMetrics | null>(null);
  const [appCards, setAppCards] = useState<AppDownloadCard[]>([]);
  const [versionStats, setVersionStats] = useState<VersionStat[]>([]);
  const [dailyDownloads, setDailyDownloads] = useState<DownloadChartPoint[]>([]);
  const [manufacturers, setManufacturers] = useState<DeviceDistribution[]>([]);
  const [androidVersions, setAndroidVersions] = useState<DeviceDistribution[]>([]);
  const [logs, setLogs] = useState<ApkDownloadLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(0);

  // Loading states
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingApps, setLoadingApps] = useState(true);
  const [loadingVersions, setLoadingVersions] = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // ─── Data loader ──────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setRefreshing(true);

    setLoadingSummary(true);
    fetchDownloadSummary().then(d => { setSummary(d); setLoadingSummary(false); });

    setLoadingApps(true);
    fetchAppDownloadCards().then(d => { setAppCards(d); setLoadingApps(false); }).catch(() => setLoadingApps(false));

    setLoadingVersions(true);
    fetchVersionStats().then(d => { setVersionStats(d); setLoadingVersions(false); }).catch(() => setLoadingVersions(false));

    setLoadingChart(true);
    fetchDailyDownloads().then(d => { setDailyDownloads(d); setLoadingChart(false); });

    setLoadingDevices(true);
    Promise.all([fetchManufacturerDistribution(), fetchAndroidVersionDistribution()]).then(([m, av]) => {
      setManufacturers(m);
      setAndroidVersions(av);
      setLoadingDevices(false);
    });

    setLoadingLogs(true);
    fetchDownloadLogs({ limit: 20, offset: 0 }).then(({ data, total }) => {
      setLogs(data);
      setLogsTotal(total);
      setLoadingLogs(false);
    });

    setLastRefreshed(new Date());
    setRefreshing(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const loadMoreLogs = async () => {
    const nextPage = logsPage + 1;
    setLogsPage(nextPage);
    const { data } = await fetchDownloadLogs({ limit: 20, offset: nextPage * 20 });
    setLogs(prev => [...prev, ...data]);
  };

  // ─── Filtered app cards ────────────────────────────────────
  const filteredApps = appCards.filter(a =>
    a.app_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.package_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredVersions = versionStats.filter(v =>
    (filterPackage ? v.package_name === filterPackage : true)
  );

  const hasData = summary ? (summary.totalDownloads > 0) : false;

  // ─── Tab navigation ────────────────────────────────────────
  const tabs: { key: typeof activeTab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <BarChart2 className="w-3.5 h-3.5" /> },
    { key: 'versions', label: 'Version Analytics', icon: <Package className="w-3.5 h-3.5" /> },
    { key: 'devices', label: 'Device Analytics', icon: <Smartphone className="w-3.5 h-3.5" /> },
    { key: 'logs', label: 'Download Logs', icon: <Activity className="w-3.5 h-3.5" /> },
  ];

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <div className="max-w-7xl mx-auto space-y-8 font-['Outfit'] select-none">

      {/* ── HEADER ─────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <p className="text-[9px] text-[#64748B] uppercase font-bold tracking-widest">ArLABS Ecosystem</p>
            <h2 className="text-base font-black text-[#1E293B] tracking-tight mt-0.5">
              SYS // APK_DOWNLOAD_STATISTICS
            </h2>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-[9px] text-[#94a3b8] font-mono">
                {lastRefreshed ? `Last sync: ${lastRefreshed.toLocaleTimeString('en-US', { hour12: false })}` : 'Loading...'}
              </span>
              <span className="text-[9px] bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded font-bold uppercase">
                Offline-First
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94a3b8]" />
              <input
                type="text"
                placeholder="Search app or package..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-[11px] text-[#1E293B] placeholder-[#94a3b8] focus:outline-none focus:border-[#0EA5E9] w-48 shadow-sm font-semibold"
              />
            </div>
            <button
              onClick={loadAll}
              disabled={refreshing}
              className="bg-[#0EA5E9] hover:bg-[#0ea5e9]/90 text-white px-4 py-2 rounded-xl text-[11px] font-bold transition-all duration-300 shadow-sm flex items-center space-x-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </button>
          </div>
        </div>

        {/* Offline-First Architecture Banner */}
        <div className="mt-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-xl p-3 flex items-start gap-3">
          <Zap className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider">Offline-First Architecture</p>
            <p className="text-[10px] text-amber-600 mt-0.5 leading-relaxed">
              Statistics are synchronized only during natural server events: <strong>License Activation</strong>, <strong>Update Check</strong>, <strong>Announcement Sync</strong>, <strong>Remote Config Sync</strong>, or <strong>Manual Sync</strong>. No continuous tracking required.
            </p>
          </div>
        </div>
      </Card>

      {/* ── SUB-TAB NAVIGATION ─────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${
              activeTab === tab.key
                ? 'bg-[#0EA5E9] text-white shadow-[2px_2px_8px_rgba(14,165,233,0.3)]'
                : 'bg-white/80 border border-white/60 text-[#64748B] hover:text-[#1E293B] shadow-sm'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
           TAB: OVERVIEW
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-8">

          {/* KPI Summary Cards — 8 tiles */}
          <section>
            <div className="flex items-center space-x-2 mb-4">
              <TrendingUp className="w-4 h-4 text-[#0EA5E9]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Download KPIs</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KpiCard icon={<Download className="w-4 h-4" />} label="Total Downloads"
                value={summary?.totalDownloads ?? 0} color="#0EA5E9" bg="bg-sky-50" loading={loadingSummary} />
              <KpiCard icon={<Calendar className="w-4 h-4" />} label="Downloads Today"
                value={summary?.downloadsToday ?? 0} color="#6366F1" bg="bg-indigo-50" loading={loadingSummary} />
              <KpiCard icon={<Activity className="w-4 h-4" />} label="This Week"
                value={summary?.downloadsThisWeek ?? 0} color="#8B5CF6" bg="bg-purple-50" loading={loadingSummary} />
              <KpiCard icon={<BarChart2 className="w-4 h-4" />} label="This Month"
                value={summary?.downloadsThisMonth ?? 0} color="#10B981" bg="bg-emerald-50" loading={loadingSummary} />
              <KpiCard icon={<ArrowUpRight className="w-4 h-4" />} label="Latest Release DL"
                value={summary?.latestReleaseDownloads ?? 0} color="#F59E0B" bg="bg-amber-50" loading={loadingSummary} />
              <KpiCard icon={<Smartphone className="w-4 h-4" />} label="Installed Devices"
                value={summary?.activeInstalledDevices ?? 0} color="#EC4899" bg="bg-pink-50" loading={loadingSummary} />
              <KpiCard icon={<TrendingUp className="w-4 h-4" />} label="Adoption Rate"
                value={summary?.updateAdoptionRate ?? 0} suffix="%" color="#0EA5E9" bg="bg-sky-50" loading={loadingSummary} />
              <KpiCard icon={<CheckCircle2 className="w-4 h-4" />} label="Success Rate"
                value={summary?.downloadSuccessRate ?? 100} suffix="%" color="#10B981" bg="bg-emerald-50" loading={loadingSummary} />
            </div>
          </section>

          {/* Download Trend Chart */}
          <Card className="p-6">
            <SectionLabel icon={<Activity className="w-4 h-4" />} title="Downloads Per Day — Last 14 Days" subtitle="Download Trend" />
            {loadingChart ? (
              <Skeleton className="h-36 w-full" />
            ) : !hasData ? (
              <EmptyState
                icon={<Download className="w-10 h-10" />}
                title="No download records yet"
                subtitle="Records will appear here once devices sync. Run the SQL below to create the tracking table."
              />
            ) : (
              <AreaChart data={dailyDownloads} color="#0EA5E9" height={110} />
            )}
          </Card>

          {/* Adoption + Success Rate Rings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card className="p-6">
              <SectionLabel icon={<TrendingUp className="w-4 h-4" />} title="Update Adoption Rate" subtitle="Update Analytics" />
              <div className="flex justify-center gap-8 py-2">
                <ProgressRing
                  value={summary?.updateAdoptionRate ?? 0}
                  size={110}
                  color="#0EA5E9"
                  label="Adoption Rate"
                  sublabel="of devices"
                />
                <ProgressRing
                  value={summary?.downloadSuccessRate ?? 100}
                  size={110}
                  color="#10B981"
                  label="Success Rate"
                  sublabel="of downloads"
                />
              </div>
            </Card>

            {/* Download Source breakdown — static structural placeholder */}
            <Card className="p-6">
              <SectionLabel icon={<Filter className="w-4 h-4" />} title="Download Source Breakdown" subtitle="Source Attribution" />
              <div className="space-y-2.5">
                {[
                  { label: 'Cloudflare CDN', pct: 85, color: '#F97316' },
                  { label: 'Direct Link', pct: 10, color: '#0EA5E9' },
                  { label: 'QR Code', pct: 3, color: '#8B5CF6' },
                  { label: 'Website', pct: 2, color: '#10B981' },
                ].map((src, i) => (
                  <div key={i} className="space-y-0.5">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-[#64748B] font-bold">{src.label}</span>
                      <span className="font-black text-[#1E293B]">{src.pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${src.pct}%`, backgroundColor: src.color }} />
                    </div>
                  </div>
                ))}
                <p className="text-[9px] text-[#94a3b8] mt-2">Source attribution requires <code className="bg-gray-100 px-1 rounded">download_source</code> field in apk_download_logs.</p>
              </div>
            </Card>
          </div>

          {/* Application Download Cards */}
          <section>
            <SectionLabel icon={<Package className="w-4 h-4" />} title="Download Stats Per Application" subtitle="Application Analytics" />
            {loadingApps ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
              </div>
            ) : filteredApps.length === 0 ? (
              <EmptyState
                icon={<Package className="w-10 h-10" />}
                title="No applications found"
                subtitle="Add applications via the Application Control module."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredApps.map(app => (
                  <Card key={app.id} className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-[10px] bg-gradient-to-tr from-[#0EA5E9] to-[#6366F1] flex items-center justify-center text-white font-black text-sm shadow-md">
                        {app.app_name.charAt(0)}
                      </div>
                      <Badge
                        label={app.status}
                        color={app.status === 'ACTIVE' ? 'green' : app.status === 'MAINTENANCE' ? 'amber' : 'red'}
                      />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-[#1E293B] truncate">{app.app_name}</h4>
                      <p className="text-[9px] font-mono text-[#94a3b8] mt-0.5 truncate">{app.package_name}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
                      <div className="text-center bg-sky-50 rounded-xl p-2.5">
                        <p className="text-xl font-black text-[#0EA5E9]">{app.total_downloads}</p>
                        <p className="text-[9px] text-[#94a3b8] font-bold uppercase">Downloads</p>
                      </div>
                      <div className="text-center bg-purple-50 rounded-xl p-2.5">
                        <p className="text-xl font-black text-[#6366F1]">{app.unique_devices}</p>
                        <p className="text-[9px] text-[#94a3b8] font-bold uppercase">Devices</p>
                      </div>
                    </div>
                    <div className="flex justify-between text-[10px] text-[#94a3b8]">
                      <span>v{app.current_version}</span>
                      {app.last_download_at ? (
                        <span>{new Date(app.last_download_at).toLocaleDateString()}</span>
                      ) : <span>No downloads yet</span>}
                    </div>
                    {app.force_update_required && (
                      <div className="flex items-center gap-1.5 text-[9px] text-red-500 font-bold bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
                        <AlertTriangle className="w-3 h-3" />
                        Force Update Required
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </section>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════
           TAB: VERSION ANALYTICS
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'versions' && (
        <div className="space-y-6">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white/80 border border-white/60 shadow-sm rounded-xl px-3 py-2">
              <Filter className="w-3.5 h-3.5 text-[#94a3b8]" />
              <select
                value={filterPackage}
                onChange={e => setFilterPackage(e.target.value)}
                className="bg-transparent text-[11px] font-bold text-[#1E293B] focus:outline-none"
              >
                <option value="">All Applications</option>
                {[...new Set(versionStats.map(v => v.package_name))].map(pkg => (
                  <option key={pkg} value={pkg}>{pkg}</option>
                ))}
              </select>
            </div>
            <span className="text-[10px] text-[#94a3b8] font-mono">{filteredVersions.length} releases found</span>
          </div>

          {loadingVersions ? (
            <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}</div>
          ) : filteredVersions.length === 0 ? (
            <EmptyState
              icon={<Package className="w-10 h-10" />}
              title="No OTA releases found"
              subtitle="Publish releases via OTA Update module to see version analytics here."
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[750px]">
                  <thead className="bg-gray-50/80 border-b border-gray-100 text-[#64748B] uppercase text-[9px] font-bold tracking-widest">
                    <tr>
                      <th className="py-4 px-5">Version</th>
                      <th className="py-4 px-5">Application</th>
                      <th className="py-4 px-5">Release Date</th>
                      <th className="py-4 px-5">Downloads</th>
                      <th className="py-4 px-5">Installations</th>
                      <th className="py-4 px-5">Adoption</th>
                      <th className="py-4 px-5">Flags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredVersions.map((v, i) => (
                      <tr key={i} className={`hover:bg-gray-50/60 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/20'}`}>
                        <td className="py-3.5 px-5">
                          <p className="font-black text-[#0EA5E9] text-sm">{v.version_name}</p>
                          <p className="text-[9px] text-[#94a3b8] font-mono">Code {v.version_code}</p>
                        </td>
                        <td className="py-3.5 px-5">
                          <p className="font-bold text-[#1E293B] truncate max-w-[160px]">{v.package_name}</p>
                        </td>
                        <td className="py-3.5 px-5 font-mono text-[10px] text-[#64748B]">
                          {new Date(v.release_date).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="text-lg font-black text-[#1E293B]">{v.total_downloads}</span>
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="text-lg font-black text-[#6366F1]">{v.active_installations}</span>
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-[#10B981] rounded-full"
                                style={{ width: `${v.adoption_percentage}%` }} />
                            </div>
                            <span className="text-[10px] font-bold text-[#64748B]">{v.adoption_percentage}%</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5">
                          {v.is_force_update
                            ? <Badge label="Force" color="red" />
                            : <Badge label="Optional" color="green" />
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
           TAB: DEVICE ANALYTICS
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'devices' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <SectionLabel icon={<Smartphone className="w-4 h-4" />} title="Manufacturer Distribution" subtitle="Device Analytics" />
            {loadingDevices ? (
              <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-6" />)}</div>
            ) : manufacturers.length === 0 ? (
              <EmptyState
                icon={<Smartphone className="w-8 h-8" />}
                title="No device data"
                subtitle="Manufacturer info is logged when devices sync. Run the SQL below to enable tracking."
              />
            ) : (
              <HBarChart items={manufacturers} color="#0EA5E9" />
            )}
          </Card>

          <Card className="p-6">
            <SectionLabel icon={<Shield className="w-4 h-4" />} title="Android Version Distribution" subtitle="Device Analytics" />
            {loadingDevices ? (
              <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-6" />)}</div>
            ) : androidVersions.length === 0 ? (
              <EmptyState
                icon={<Shield className="w-8 h-8" />}
                title="No Android version data"
                subtitle="Android version info is collected at device sync time."
              />
            ) : (
              <HBarChart items={androidVersions} color="#6366F1" />
            )}
          </Card>

          {/* Future fields placeholder */}
          <Card className="p-6 lg:col-span-2">
            <SectionLabel icon={<Activity className="w-4 h-4" />} title="Additional Device Signals" subtitle="Future Analytics" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {['Architecture (arm64-v8a)', 'Screen Density (xxhdpi)', 'Device Model', 'Country (future)'].map((f, i) => (
                <div key={i} className="bg-gray-50 border border-gray-100 border-dashed rounded-xl p-4 text-center space-y-2">
                  <div className="w-6 h-6 bg-gray-200 rounded-full mx-auto" />
                  <p className="text-[10px] text-[#94a3b8] font-bold">{f}</p>
                  <p className="text-[9px] text-gray-300 font-semibold">COMING SOON</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
           TAB: DOWNLOAD LOGS
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-[#94a3b8] font-mono">{logsTotal} total records</p>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[800px]">
                <thead className="bg-gray-50/80 border-b border-gray-100 text-[9px] text-[#64748B] uppercase font-bold tracking-widest">
                  <tr>
                    <th className="py-4 px-5">Package</th>
                    <th className="py-4 px-5">Version</th>
                    <th className="py-4 px-5">Device</th>
                    <th className="py-4 px-5">Android</th>
                    <th className="py-4 px-5">Source</th>
                    <th className="py-4 px-5">Status</th>
                    <th className="py-4 px-5">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingLogs ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center">
                        <div className="flex items-center justify-center gap-2 text-[#94a3b8]">
                          <RefreshCw className="w-4 h-4 animate-spin text-[#0EA5E9]" />
                          <span className="text-xs font-bold">Loading download logs...</span>
                        </div>
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12">
                        <EmptyState
                          icon={<Activity className="w-10 h-10" />}
                          title="No download logs yet"
                          subtitle="Logs appear here once devices sync. Create the apk_download_logs table using the SQL below."
                        />
                      </td>
                    </tr>
                  ) : (
                    logs.map((log, i) => (
                      <tr key={log.id} className={`hover:bg-gray-50/60 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/20'}`}>
                        <td className="py-3 px-5 font-mono text-[9px] text-[#64748B] max-w-[150px] truncate">
                          {log.package_name}
                        </td>
                        <td className="py-3 px-5">
                          <span className="font-black text-[#0EA5E9] text-[11px]">{log.version_name}</span>
                        </td>
                        <td className="py-3 px-5 text-[10px] text-[#64748B] max-w-[120px] truncate">
                          {log.manufacturer ? `${log.manufacturer} ${log.device_model ?? ''}`.trim() : '—'}
                        </td>
                        <td className="py-3 px-5 text-[10px] text-[#64748B]">
                          {log.android_version ? `Android ${log.android_version}` : '—'}
                        </td>
                        <td className="py-3 px-5">
                          <Badge
                            label={log.download_source.replace('_', ' ')}
                            color={log.download_source === 'CLOUDFLARE_CDN' ? 'amber' : 'blue'}
                          />
                        </td>
                        <td className="py-3 px-5">
                          <Badge
                            label={log.status}
                            color={log.status === 'SUCCESS' ? 'green' : log.status === 'FAILED' ? 'red' : 'gray'}
                          />
                        </td>
                        <td className="py-3 px-5 font-mono text-[9px] text-[#94a3b8]">
                          {new Date(log.downloaded_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {logs.length < logsTotal && (
            <button
              onClick={loadMoreLogs}
              className="w-full py-3 text-xs font-bold text-[#0EA5E9] bg-white/80 border border-white/60 rounded-xl hover:bg-[#0EA5E9]/5 transition-all shadow-sm"
            >
              Load More ({logsTotal - logs.length} remaining)
            </button>
          )}
        </div>
      )}

      {/* ── SQL SETUP CARD ─────────────────────────────────── */}
      <Card className="p-6 border-dashed border-2 border-amber-200 bg-amber-50/30">
        <SectionLabel icon={<Clock className="w-4 h-4 text-amber-500" />} title="Database Setup Required" subtitle="Action Required" />
        <p className="text-[11px] text-[#64748B] mb-3 leading-relaxed">
          Run the SQL below in your <strong>Supabase SQL Editor</strong> to create the <code className="bg-amber-100 px-1 rounded text-amber-700">apk_download_logs</code> table and start collecting offline-synced statistics.
        </p>
        <pre className="bg-[#1E293B] text-emerald-300 text-[10px] font-mono p-4 rounded-xl overflow-x-auto leading-relaxed whitespace-pre">
{`-- Create APK Download Logs table
-- Designed for Offline-First: data collected only during server sync
CREATE TABLE IF NOT EXISTS apk_download_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  package_name    TEXT NOT NULL,
  version_name    TEXT NOT NULL,
  version_code    INTEGER NOT NULL DEFAULT 1,
  device_id       TEXT,
  android_version TEXT,
  manufacturer    TEXT,
  device_model    TEXT,
  architecture    TEXT,
  screen_density  TEXT,
  download_source TEXT DEFAULT 'CLOUDFLARE_CDN',
  status          TEXT DEFAULT 'SUCCESS'
                  CHECK (status IN ('SUCCESS','FAILED','PENDING')),
  downloaded_at   TIMESTAMPTZ DEFAULT NOW(),
  installed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes for large-scale queries
CREATE INDEX IF NOT EXISTS idx_dl_package ON apk_download_logs(package_name);
CREATE INDEX IF NOT EXISTS idx_dl_version ON apk_download_logs(version_name);
CREATE INDEX IF NOT EXISTS idx_dl_date    ON apk_download_logs(downloaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_dl_device  ON apk_download_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_dl_status  ON apk_download_logs(status);`}
        </pre>
      </Card>

    </div>
  );
};
