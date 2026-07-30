import React, { useEffect, useState, useCallback } from 'react';
import { 
  MessageSquare, Search, RefreshCw, Terminal, 
  CheckCircle2, X, ChevronRight, ChevronLeft, Calendar, 
  Eye, ShieldAlert, ArrowRight, UserCheck, AlertTriangle, Send, User, Shield, CheckCheck, Info
} from 'lucide-react';
import { 
  fetchFeedbackStats, 
  fetchFeedbackReports, 
  fetchFeedbackReportDetail, 
  updateFeedbackReport,
  fetchFeedbackMessages,
  sendFeedbackMessage,
  bulkUpdateFeedbackReports,
  bulkDeleteFeedbackReports
} from './services/feedbackService';
import type { FeedbackReport, FeedbackSummaryStats, FeedbackStatus, FeedbackMessage } from './types/feedback.types';
import { supabase } from '../../core/supabase';

// ─── Skeleton Loading Helper ─────────────────────────────────
const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-lg ${className}`} />
);

// ─── Card Neomorphic Component ──────────────────────────────
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] hover:shadow-[10px_10px_20px_#d1d5db,-10px_-10px_20px_#ffffff] transition-all duration-300 rounded-[24px] ${className}`}>
    {children}
  </div>
);

// ─── KPI Metric Card ─────────────────────────────────────────
const KpiCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  bg: string;
  loading?: boolean;
}> = ({ icon, label, value, color, bg, loading }) => (
  <Card className="p-3.5 sm:p-5 flex flex-col justify-between h-28 sm:h-32 min-w-0">
    <div className="flex justify-between items-start">
      <div className={`p-1.5 sm:p-2.5 rounded-xl ${bg}`} style={{ color }}>
        {icon}
      </div>
    </div>
    <div className="min-w-0">
      <p className="text-[8px] sm:text-[9px] text-[#94a3b8] uppercase font-bold tracking-wide sm:tracking-widest mb-1 truncate" title={label}>{label}</p>
      {loading ? (
        <Skeleton className="h-6 sm:h-8 w-12 sm:w-16" />
      ) : (
        <p className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight font-sans" style={{ color }}>
          {value}
        </p>
      )}
    </div>
  </Card>
);

// ─── Badge Status Component ──────────────────────────────────
const Badge: React.FC<{ status: FeedbackStatus }> = ({ status }) => {
  const safeStatus = status || 'NEW';
  const cls = {
    NEW: 'bg-blue-50 text-blue-600 border-blue-100',
    IN_PROGRESS: 'bg-amber-50 text-amber-600 border-amber-100',
    RESOLVED: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    REJECTED: 'bg-rose-50 text-rose-600 border-rose-100'
  }[safeStatus] || 'bg-gray-50 text-gray-500 border-gray-100';

  return (
    <span className={`px-2 py-0.5 text-[8.5px] font-bold uppercase rounded border ${cls}`}>
      {safeStatus.replace('_', ' ')}
    </span>
  );
};

interface FeedbackCenterScreenProps {
  session: any;
  profile?: { name: string; role: string; email: string } | null;
}

export const FeedbackCenterScreen: React.FC<FeedbackCenterScreenProps> = ({ session, profile }) => {
  const token = session.access_token;

  // Telemetry Dashboard Metrics
  const [stats, setStats] = useState<FeedbackSummaryStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Listing Data States
  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [count, setCount] = useState(0);
  const [loadingList, setLoadingList] = useState(true);
  
  // Bulk selection states
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);

  // Selected Detail Modal / Drawer state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FeedbackReport | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // Chat messaging states
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [activeTabDetail, setActiveTabDetail] = useState<'chat' | 'telemetry'>('chat');

  // Developer Notes Form state
  const [devNote, setDevNote] = useState('');
  const [targetStatus, setTargetStatus] = useState<FeedbackStatus>('NEW');
  const [savingDetail, setSavingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Full Screen Image Lightbox state
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Search, Filters and Pagination states
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterApplication, setFilterApplication] = useState('');
  const [filterPackage, setFilterPackage] = useState('');
  const [filterLicense, setFilterLicense] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  // Dynamic filter dropdown options
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableApplications, setAvailableApplications] = useState<string[]>([]);
  const [availablePackages, setAvailablePackages] = useState<string[]>([]);
  const [availableLicenses, setAvailableLicenses] = useState<string[]>([]);

  // Fetch unique database values to populate filter dropdowns dynamically
  const fetchUniqueFilterOptions = async () => {
    try {
      const { data, error } = await supabase
        .from('feedback_reports')
        .select('category, application_name, package_name, license_id');

      if (!error && data) {
        const categories = Array.from(new Set(data.map(item => item.category).filter(Boolean)));
        const applications = Array.from(new Set(data.map(item => item.application_name).filter(Boolean)));
        const packages = Array.from(new Set(data.map(item => item.package_name).filter(Boolean)));
        const licenses = Array.from(new Set(data.map(item => item.license_id).filter(Boolean)));

        setAvailableCategories(categories);
        setAvailableApplications(applications);
        setAvailablePackages(packages);
        setAvailableLicenses(licenses);
      }
    } catch (e) {
      console.warn('Failed to load filter option values:', e);
    }
  };

  // Fetch metrics data
  const loadStats = async () => {
    setLoadingStats(true);
    const s = await fetchFeedbackStats();
    setStats(s);
    setLoadingStats(false);
  };

  // Fetch reports based on current queries
  const loadReports = useCallback(async () => {
    setLoadingList(true);
    try {
      const offset = (page - 1) * pageSize;
      const res = await fetchFeedbackReports(token, {
        search: search || undefined,
        status: filterStatus || undefined,
        category: filterCategory || undefined,
        application: filterApplication || undefined,
        package: filterPackage || undefined,
        license: filterLicense || undefined,
        startDate: filterStartDate ? new Date(filterStartDate).toISOString() : undefined,
        endDate: filterEndDate ? new Date(filterEndDate).toISOString() : undefined,
        limit: pageSize,
        offset
      });
      setReports(res.data);
      setCount(res.count);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoadingList(false);
    }
  }, [token, search, filterStatus, filterCategory, filterApplication, filterPackage, filterLicense, filterStartDate, filterEndDate, page, pageSize]);

  // Load all dashboard content on mount and filter changes
  useEffect(() => {
    loadStats();
    fetchUniqueFilterOptions();
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Handle row selection for details view
  const handleSelectReport = async (id: string) => {
    setSelectedId(id);
    setLoadingDetail(true);
    setDetailError(null);
    setMessages([]);
    setActiveTabDetail('chat'); // Default to chat tab
    try {
      const report = await fetchFeedbackReportDetail(token, id);
      setDetail(report);
      setDevNote(report.developer_note || '');
      setTargetStatus(report.status);

      // Load existing messages in chat thread
      setLoadingMessages(true);
      const msgs = await fetchFeedbackMessages(id);
      setMessages(msgs);
    } catch (err: any) {
      setDetailError(err.message || 'Failed to fetch report details.');
      setDetail(null);
    } finally {
      setLoadingDetail(false);
      setLoadingMessages(false);
    }
  };

  // Toggle selection for a single report ID
  const handleToggleSelectBulk = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the detail panel
    setSelectedBulkIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Toggle selection for all reports on the current page
  const handleToggleSelectAll = () => {
    if (selectedBulkIds.length === reports.length) {
      setSelectedBulkIds([]);
    } else {
      setSelectedBulkIds(reports.map(r => r.id));
    }
  };

  // Run bulk update status
  const handleBulkUpdateStatus = async (status: FeedbackStatus) => {
    if (selectedBulkIds.length === 0) return;
    setIsBulkActionLoading(true);
    try {
      await bulkUpdateFeedbackReports(selectedBulkIds, { status });
      setSelectedBulkIds([]);
      loadReports();
      loadStats();
    } catch (err: any) {
      alert(`Gagal memperbarui status secara massal: ${err.message}`);
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  // Run bulk delete
  const handleBulkDelete = async () => {
    if (selectedBulkIds.length === 0) return;
    if (!window.confirm(`Apakah Anda yakin ingin menghapus ${selectedBulkIds.length} laporan terpilih secara permanen? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    setIsBulkActionLoading(true);
    try {
      await bulkDeleteFeedbackReports(selectedBulkIds);
      const deletedIds = [...selectedBulkIds];
      setSelectedBulkIds([]);
      loadReports();
      loadStats();
      if (selectedId && deletedIds.includes(selectedId)) {
        setSelectedId(null);
        setDetail(null);
      }
    } catch (err: any) {
      alert(`Gagal menghapus laporan secara massal: ${err.message}`);
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    if (activeTabDetail === 'chat') {
      setTimeout(scrollToBottom, 100);
    }
  }, [messages, activeTabDetail]);

  // Real-time listener for incoming messages on the selected feedback report
  useEffect(() => {
    if (!selectedId) return;

    const channel = supabase
      .channel(`feedback_messages_room:${selectedId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'feedback_messages',
        filter: `feedback_report_id=eq.${selectedId}`
      }, (payload) => {
        const newMsg = payload.new as FeedbackMessage;
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedId]);

  // Handle sending a reply in the chat room
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedId) return;
    setSendingReply(true);
    try {
      const senderName = profile?.name || 'Admin';
      const newMsg = await sendFeedbackMessage(selectedId, 'ADMIN', senderName, replyText);
      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      setReplyText('');
    } catch (err: any) {
      alert('Gagal mengirim balasan: ' + (err.message || err));
    } finally {
      setSendingReply(false);
    }
  };

  // Handle saving developer notes & status changes
  const handleSaveDetail = async () => {
    if (!detail) return;
    setSavingDetail(true);
    setDetailError(null);
    try {
      const updated = await updateFeedbackReport(token, detail.id, {
        status: targetStatus !== detail.status ? targetStatus : undefined,
        developer_note: devNote
      });
      
      setDetail(updated);
      setDevNote(updated.developer_note || '');
      setTargetStatus(updated.status);

      // Refresh list and stats
      loadReports();
      loadStats();
    } catch (err: any) {
      setDetailError(err.message || 'Failed to update feedback report.');
    } finally {
      setSavingDetail(false);
    }
  };

  // Reset all filters
  const handleClearFilters = () => {
    setSearch('');
    setFilterStatus('');
    setFilterCategory('');
    setFilterApplication('');
    setFilterPackage('');
    setFilterLicense('');
    setFilterStartDate('');
    setFilterEndDate('');
    setPage(1);
  };

  const totalPages = Math.ceil(count / pageSize) || 1;

  // Status transitions check based on requirements:
  // NEW -> IN_PROGRESS -> RESOLVED or REJECTED
  const getAvailableTransitions = (current: FeedbackStatus): FeedbackStatus[] => {
    if (current === 'NEW') return ['NEW', 'IN_PROGRESS'];
    if (current === 'IN_PROGRESS') return ['IN_PROGRESS', 'RESOLVED', 'REJECTED'];
    return [current]; // Resolved and Rejected can no longer transition
  };

  return (
    <div className="space-y-8 select-text">
      
      {/* ─── TITLE & CONTROL BLOCK ──────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#1E293B] tracking-tight">Pusat Masukan</h1>
          <p className="text-xs text-[#64748B] font-medium tracking-wide">
            Analisis, kelola, dan proses laporan masukan yang dikirim oleh perangkat aplikasi ArLABS.
          </p>
        </div>
        <button
          onClick={() => {
            loadStats();
            loadReports();
            fetchUniqueFilterOptions();
          }}
          className="flex items-center space-x-2 bg-white hover:bg-gray-50 text-[#1E293B] px-4 py-2 rounded-xl text-xs font-bold border border-gray-200 shadow-sm transition-all duration-300 active:scale-95"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Perbarui Database</span>
        </button>
      </div>

      {/* ─── KPI STATISTICS METRIC ROW ─────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          icon={<MessageSquare className="w-5 h-5" />}
          label="Laporan Baru"
          value={stats?.newCount || 0}
          color="#0EA5E9"
          bg="bg-sky-50"
          loading={loadingStats}
        />
        <KpiCard
          icon={<RefreshCw className="w-5 h-5" />}
          label="Sedang Diproses"
          value={stats?.inProgressCount || 0}
          color="#F59E0B"
          bg="bg-amber-50"
          loading={loadingStats}
        />
        <KpiCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="Selesai"
          value={stats?.resolvedCount || 0}
          color="#10B981"
          bg="bg-emerald-50"
          loading={loadingStats}
        />
        <KpiCard
          icon={<ShieldAlert className="w-5 h-5" />}
          label="Ditolak"
          value={stats?.rejectedCount || 0}
          color="#EF4444"
          bg="bg-rose-50"
          loading={loadingStats}
        />
        <KpiCard
          icon={<Calendar className="w-5 h-5" />}
          label="Dikirim Hari Ini"
          value={stats?.todayCount || 0}
          color="#6366F1"
          bg="bg-indigo-50"
          loading={loadingStats}
        />
        <KpiCard
          icon={<ChevronRight className="w-5 h-5" />}
          label="Minggu Ini"
          value={stats?.thisWeekCount || 0}
          color="#8B5CF6"
          bg="bg-purple-50"
          loading={loadingStats}
        />
      </div>

      {/* ─── MAIN CONTENT BLOCK ────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: LIST PANEL (Spans 12 or 7 depending on detail view) */}
        <section className={`col-span-12 ${selectedId ? 'lg:col-span-7' : 'col-span-12'} space-y-6`}>
          <Card className="p-6">
            <h3 className="text-sm font-bold text-[#1E293B] uppercase tracking-wider mb-6 flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-[#0EA5E9]" />
              <span>Log Database Masukan</span>
            </h3>

            {/* Bulk Actions Panel */}
            {selectedBulkIds.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-[20px] p-4 mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-in slide-in-from-top-4 duration-200 shadow-inner">
                <div className="flex items-center space-x-3">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-black">
                    {selectedBulkIds.length}
                  </div>
                  <span className="text-xs font-bold text-[#334155]">Laporan terpilih untuk tindakan massal</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider mr-1">Ubah Status:</span>
                  <button
                    disabled={isBulkActionLoading}
                    onClick={() => handleBulkUpdateStatus('IN_PROGRESS')}
                    className="px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-100 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    Proses
                  </button>
                  <button
                    disabled={isBulkActionLoading}
                    onClick={() => handleBulkUpdateStatus('RESOLVED')}
                    className="px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    Selesai
                  </button>
                  <button
                    disabled={isBulkActionLoading}
                    onClick={() => handleBulkUpdateStatus('REJECTED')}
                    className="px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    Tolak
                  </button>
                  
                  <div className="w-px h-6 bg-slate-200 mx-2 hidden md:block"></div>
                  
                  <button
                    disabled={isBulkActionLoading}
                    onClick={handleBulkDelete}
                    className="px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-all flex items-center space-x-1 shadow-sm cursor-pointer"
                  >
                    <span>Hapus Permanen</span>
                  </button>
                </div>
              </div>
            )}

            {/* Filter Actions */}
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                
                {/* Search Bar */}
                <div className="relative col-span-1 sm:col-span-2">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    placeholder="Cari judul, deskripsi, lisensi..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-[#0EA5E9] focus:border-[#0EA5E9] outline-none"
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-[#0EA5E9] outline-none bg-white font-medium"
                >
                  <option value="">Semua Status</option>
                  <option value="NEW">Baru</option>
                  <option value="IN_PROGRESS">Sedang Diproses</option>
                  <option value="RESOLVED">Selesai</option>
                  <option value="REJECTED">Ditolak</option>
                </select>

                {/* Category Filter */}
                <select
                  value={filterCategory}
                  onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-[#0EA5E9] outline-none bg-white font-medium"
                >
                  <option value="">Semua Kategori</option>
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

              </div>

              {/* Advanced Filter Collapse panel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                
                {/* Application Name */}
                <select
                  value={filterApplication}
                  onChange={(e) => { setFilterApplication(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-[#0EA5E9] outline-none bg-white"
                >
                  <option value="">Semua Aplikasi</option>
                  {availableApplications.map(app => (
                    <option key={app} value={app}>{app}</option>
                  ))}
                </select>

                {/* Package Name */}
                <select
                  value={filterPackage}
                  onChange={(e) => { setFilterPackage(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-[#0EA5E9] outline-none bg-white"
                >
                  <option value="">Semua Paket</option>
                  {availablePackages.map(pkg => (
                    <option key={pkg} value={pkg}>{pkg}</option>
                  ))}
                </select>

                {/* License Filter */}
                <select
                  value={filterLicense}
                  onChange={(e) => { setFilterLicense(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-[#0EA5E9] outline-none bg-white"
                >
                  <option value="">Semua Lisensi</option>
                  {availableLicenses.map(lic => (
                    <option key={lic} value={lic}>{lic.substring(0, 18)}...</option>
                  ))}
                </select>

                {/* Clear Filter Action Button */}
                <button
                  onClick={handleClearFilters}
                  className="w-full text-xs font-bold bg-[#F8FAFC] border border-gray-200 hover:bg-gray-100 text-[#64748B] py-2 rounded-xl transition-all duration-300"
                >
                  Reset Parameter Filter
                </button>

              </div>

              {/* Date Filters */}
              <div className="grid grid-cols-2 gap-3 max-w-md pt-1">
                <div>
                  <label className="block text-[9px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Tanggal Mulai</label>
                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => { setFilterStartDate(e.target.value); setPage(1); }}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#0EA5E9]"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Tanggal Selesai</label>
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => { setFilterEndDate(e.target.value); setPage(1); }}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#0EA5E9]"
                  />
                </div>
              </div>
            </div>

            {/* List Table Container (Desktop Only) */}
            <div className="hidden lg:block overflow-x-auto border border-gray-100 rounded-2xl">
              <table className="w-full border-collapse text-left text-xs font-sans">
                <thead>
                  <tr className="bg-[#F8FAFC] text-[#64748B] font-bold border-b border-gray-100">
                    <th className="p-4 w-10">
                      <input
                        type="checkbox"
                        checked={reports.length > 0 && selectedBulkIds.length === reports.length}
                        onChange={handleToggleSelectAll}
                        className="rounded border-gray-300 text-[#0EA5E9] focus:ring-[#0EA5E9] w-3.5 h-3.5 cursor-pointer"
                      />
                    </th>
                    <th className="p-4 uppercase tracking-wider text-[9px]">Status</th>
                    <th className="p-4 uppercase tracking-wider text-[9px]">Kategori</th>
                    <th className="p-4 uppercase tracking-wider text-[9px]">Judul</th>
                    <th className="p-4 uppercase tracking-wider text-[9px]">Info Aplikasi</th>
                    <th className="p-4 uppercase tracking-wider text-[9px]">ID Lisensi</th>
                    <th className="p-4 uppercase tracking-wider text-[9px]">Dibuat Pada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-55 text-[#1E293B]">
                  {loadingList ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td className="p-4 w-10"><Skeleton className="h-4 w-4" /></td>
                        <td className="p-4"><Skeleton className="h-4 w-12" /></td>
                        <td className="p-4"><Skeleton className="h-4 w-16" /></td>
                        <td className="p-4"><Skeleton className="h-4 w-40" /></td>
                        <td className="p-4"><Skeleton className="h-4 w-32" /></td>
                        <td className="p-4"><Skeleton className="h-4 w-24" /></td>
                        <td className="p-4"><Skeleton className="h-4 w-28" /></td>
                      </tr>
                    ))
                  ) : reports.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <div className="p-4 bg-slate-50 text-slate-400 rounded-full">
                            <MessageSquare className="w-8 h-8" />
                          </div>
                          <p className="text-xs font-bold text-[#64748B]">Tidak ada laporan masukan yang cocok dengan kueri.</p>
                          <p className="text-[10px] text-[#94a3b8]">Kirim masukan baru atau sesuaikan filter di atas.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    reports.map(report => (
                      <tr 
                        key={report.id}
                        onClick={() => handleSelectReport(report.id)}
                        className={`hover:bg-[#F8FAFC]/70 transition-colors duration-200 cursor-pointer ${selectedId === report.id ? 'bg-[#0EA5E9]/5 hover:bg-[#0EA5E9]/10' : ''}`}
                      >
                        <td className="p-4 w-10" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedBulkIds.includes(report.id)}
                            onChange={(e) => handleToggleSelectBulk(report.id, e as any)}
                            className="rounded border-gray-300 text-[#0EA5E9] focus:ring-[#0EA5E9] w-3.5 h-3.5 cursor-pointer"
                          />
                        </td>
                        <td className="p-4"><Badge status={report.status} /></td>
                        <td className="p-4 font-bold text-[#1E293B]">{report.category}</td>
                        <td className="p-4 font-semibold text-[#64748B]">
                          <div className="truncate max-w-[180px]" title={report.title}>{report.title}</div>
                        </td>
                        <td className="p-4 text-[#64748B]">
                          <div className="font-bold text-[#1E293B] text-[10px]">
                            {report.application_name || 'Generic App'}
                          </div>
                          <div className="text-[9px] font-mono">{report.package_name} (v{report.app_version})</div>
                        </td>
                        <td className="p-4 text-[#64748B] font-mono text-[10px]" title={report.license_id || ''}>
                          {(report.license_id || '').substring(0, 8)}...
                        </td>
                        <td className="p-4 text-[#94a3b8] text-[10px] whitespace-nowrap">
                          {new Date(report.created_at).toLocaleString('en-US', { hour12: false })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="block lg:hidden space-y-4">
              {loadingList ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="animate-pulse bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-4 bg-gray-100 rounded w-2/3"></div>
                    <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                  </div>
                ))
              ) : reports.length === 0 ? (
                <div className="p-8 bg-white border border-gray-200 rounded-[20px] text-center text-[#64748B] font-bold">
                  Tidak ada laporan
                </div>
              ) : (
                reports.map(report => (
                  <div 
                    key={report.id}
                    onClick={() => handleSelectReport(report.id)}
                    className={`p-4 rounded-[20px] border bg-white space-y-3 transition-colors ${selectedId === report.id ? 'border-[#0EA5E9] bg-[#0EA5E9]/5 shadow-sm' : 'border-gray-200'}`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedBulkIds.includes(report.id)}
                          onChange={(e) => handleToggleSelectBulk(report.id, e as any)}
                          className="rounded border-gray-300 text-[#0EA5E9] focus:ring-[#0EA5E9] w-3.5 h-3.5 cursor-pointer"
                        />
                        <Badge status={report.status} />
                      </div>
                      <span className="text-[10px] text-[#94a3b8] font-mono">
                        {new Date(report.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-[#1E293B] text-xs">{report.title}</h4>
                      <p className="text-[10px] text-[#64748B] mt-0.5">{report.category}</p>
                    </div>
                    <div className="flex justify-between items-center text-[10px] pt-2 border-t border-gray-50 text-[#64748B] font-mono">
                      <span className="font-sans font-semibold">{report.application_name || 'Generic App'} (v{report.app_version})</span>
                      <span>{(report.license_id || '').substring(0, 8)}...</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination Controls */}
            {!loadingList && count > 0 && (
              <div className="flex items-center justify-between border-t border-gray-100 pt-6 mt-6">
                <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider">
                  Total Laporan: {count}
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                    className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-[#64748B] disabled:opacity-40 disabled:pointer-events-none transition-all duration-200"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-[#1E293B]">
                    Halaman {page} dari {totalPages}
                  </span>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                    className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-[#64748B] disabled:opacity-40 disabled:pointer-events-none transition-all duration-200"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </Card>
        </section>

        {/* Backdrop for mobile slide-out drawer */}
        {selectedId && (
          <div 
            onClick={() => { setSelectedId(null); setDetail(null); }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden"
          />
        )}

        {/* RIGHT COLUMN: SLIDING OR DETAILED REPORT PANE */}
        {selectedId && (
          <section className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white/95 backdrop-blur-md shadow-2xl overflow-y-auto p-4 lg:p-0 lg:static lg:bg-transparent lg:shadow-none lg:w-auto lg:max-w-none lg:overflow-visible lg:col-span-5">
            <Card className="p-6 relative select-text border-0 lg:border border-white/60 shadow-none lg:shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff]">
              {/* Close Button */}
              <button
                onClick={() => { setSelectedId(null); setDetail(null); }}
                className="absolute top-6 right-6 p-1 text-[#64748B] hover:text-[#1E293B] hover:bg-gray-100 rounded-lg transition-all duration-200"
              >
                <X className="w-4 h-4" />
              </button>

              <h3 className="text-sm font-bold text-[#1E293B] uppercase tracking-wider mb-6 flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-[#0EA5E9]" />
                <span>Analisis Detail Laporan</span>
              </h3>

              {loadingDetail ? (
                <div className="space-y-6">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-40 w-full" />
                </div>
              ) : detailError ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-red-500 space-y-2">
                  <AlertTriangle className="w-8 h-8" />
                  <p className="text-xs font-bold">Gagal memuat detail: {detailError}</p>
                </div>
              ) : detail ? (
                <div className="space-y-6 animate-in fade-in duration-200">
                  
                  {/* Category, Title, Status Row */}
                  <div>
                    <div className="flex items-center space-x-3 mb-2">
                      <Badge status={detail.status} />
                      <span className="text-[10px] text-[#94a3b8] font-bold uppercase tracking-widest bg-gray-50 px-2 py-0.5 rounded border border-gray-200 font-sans">
                        {detail.category}
                      </span>
                    </div>
                    <h2 className="text-base font-black text-[#1E293B] tracking-tight mb-2">
                      {detail.title}
                    </h2>
                    <p className="text-xs text-slate-600 bg-slate-50/50 p-4 rounded-2xl border border-gray-100 leading-relaxed font-sans">
                      {detail.description}
                    </p>
                  </div>

                  {/* Detail Panel Tabs */}
                  <div className="flex border-b border-gray-100 mb-2 text-xs font-bold uppercase tracking-wider font-sans">
                    <button
                      onClick={() => setActiveTabDetail('chat')}
                      className={`flex-1 pb-3 text-center border-b-2 transition-all ${
                        activeTabDetail === 'chat'
                          ? 'border-[#0EA5E9] text-[#0EA5E9]'
                          : 'border-transparent text-[#94a3b8] hover:text-[#1E293B]'
                      }`}
                    >
                      Utas Diskusi (Chat)
                    </button>
                    <button
                      onClick={() => setActiveTabDetail('telemetry')}
                      className={`flex-1 pb-3 text-center border-b-2 transition-all ${
                        activeTabDetail === 'telemetry'
                          ? 'border-[#0EA5E9] text-[#0EA5E9]'
                          : 'border-transparent text-[#94a3b8] hover:text-[#1E293B]'
                      }`}
                    >
                      Data Telemetri
                    </button>
                  </div>

                  {/* TAB 1: Chat/Obrolan dengan Klien */}
                  {activeTabDetail === 'chat' && (
                    <div className="flex flex-col h-[500px] bg-[#E5DDD5] rounded-[24px] overflow-hidden shadow-inner relative border border-gray-200/60 font-sans">
                      
                      {/* Chat Header (WhatsApp style) */}
                      <div className="bg-[#F0F2F5] px-4 py-3 flex items-center justify-between border-b border-gray-200/60 z-10 shrink-0 shadow-sm">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center border-2 border-white shadow-sm overflow-hidden shrink-0">
                            <User className="w-5 h-5 text-gray-500" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[13px] font-bold text-[#111B21] truncate">{detail.application_name || 'Klien Aplikasi'}</span>
                            <span className="text-[11px] text-[#667781] truncate">
                              {detail.whatsapp ? `Wa: ${detail.whatsapp}` : 'sedang aktif'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 text-[#54656F]">
                          <button type="button" className="p-2 hover:bg-gray-200 rounded-full transition-colors"><Search className="w-4 h-4" /></button>
                          <button type="button" className="p-2 hover:bg-gray-200 rounded-full transition-colors"><Info className="w-4 h-4" /></button>
                        </div>
                      </div>

                      {/* Messages Thread Box (WhatsApp wallpaper vibe) */}
                      <div 
                        className="flex-1 overflow-y-auto p-4 flex flex-col space-y-2 relative"
                        style={{ backgroundColor: '#efeae2', backgroundImage: 'radial-gradient(#d5ceca 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                      >
                        {loadingMessages ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#efeae2]/50 backdrop-blur-sm z-10 space-y-2">
                            <div className="bg-white p-3 rounded-full shadow-md">
                              <RefreshCw className="w-5 h-5 animate-spin text-[#00A884]" />
                            </div>
                          </div>
                        ) : messages.length === 0 ? (
                          <div className="flex justify-center mt-4">
                            <div className="bg-[#FFEECD] text-[#54656F] text-[11px] px-4 py-2 rounded-xl shadow-sm text-center max-w-[85%] leading-relaxed border border-[#FAD686]/30">
                              <ShieldAlert className="w-3.5 h-3.5 inline-block mr-1 mb-0.5 text-[#8F7437]" />
                              Pesan ini diamankan secara end-to-end (simulasi). Hanya Anda dan klien ini yang dapat membacanya.
                            </div>
                          </div>
                        ) : (
                          messages.map((msg, index) => {
                            const isAdmin = msg.sender_type === 'ADMIN';
                            return (
                              <div
                                key={msg.id}
                                className={`flex w-full ${isAdmin ? 'justify-end' : 'justify-start'} group mb-1`}
                              >
                                <div
                                  className={`relative max-w-[85%] px-3 pt-2 pb-4 text-[13px] shadow-sm flex flex-col ${
                                    isAdmin
                                      ? 'bg-[#D9FDD3] text-[#111B21] rounded-2xl rounded-tr-sm'
                                      : 'bg-white text-[#111B21] rounded-2xl rounded-tl-sm'
                                  }`}
                                >
                                  {/* Triangle Tail */}
                                  <div className={`absolute top-0 w-3 h-3 ${isAdmin ? '-right-1.5 bg-[#D9FDD3]' : '-left-1.5 bg-white'}`} style={{ clipPath: isAdmin ? 'polygon(0 0, 100% 0, 0 100%)' : 'polygon(0 0, 100% 0, 100% 100%)' }}></div>
                                  
                                  {/* Message Body */}
                                  <span className="leading-relaxed whitespace-pre-wrap z-10 pr-6">{msg.message}</span>
                                  
                                  {/* Timestamp & Read Tick */}
                                  <div className="absolute bottom-1 right-2 flex items-center space-x-1 z-10">
                                    <span className="text-[9px] text-[#667781] font-medium">
                                      {new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {isAdmin && <CheckCheck className="w-3.5 h-3.5 text-[#53BDEB]" />}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                        <div ref={messagesEndRef} />
                      </div>

                      {/* Message Input Box (WhatsApp style) */}
                      <form onSubmit={handleSendReply} className="bg-[#F0F2F5] px-3 py-3 flex items-end space-x-2 shrink-0 z-10">
                        <div className="flex-1 bg-white rounded-2xl flex items-center px-2 py-1 shadow-sm border border-transparent focus-within:border-gray-200 min-h-[44px]">
                          <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Ketik pesan"
                            className="flex-1 bg-transparent px-3 py-2 text-[14px] outline-none text-[#111B21] placeholder-[#8696A0]"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={sendingReply || !replyText.trim()}
                          className={`p-3 rounded-full flex items-center justify-center transition-all min-h-[44px] min-w-[44px] ${
                            replyText.trim() && !sendingReply ? 'bg-[#00A884] text-white hover:bg-[#008f6f] shadow-md active:scale-95' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {sendingReply ? (
                            <RefreshCw className="w-5 h-5 animate-spin" />
                          ) : (
                            <Send className="w-5 h-5 ml-0.5" />
                          )}
                        </button>
                      </form>
                    </div>
                  )}

                  {/* TAB 2: Metadata Telemetri, Lampiran, & Catatan Pengembang */}
                  {activeTabDetail === 'telemetry' && (
                    <div className="space-y-6">
                      
                      {/* Device & Package Meta Info Grid */}
                      <div className="border-t border-gray-100 pt-4">
                        <h4 className="text-[10px] font-bold text-[#1E293B] uppercase tracking-wider mb-3">Telemetri Perangkat & Paket</h4>
                        <div className="grid grid-cols-2 gap-4 text-xs font-sans">
                          
                          <div>
                            <span className="text-[9px] text-[#94a3b8] uppercase font-bold tracking-wider block">Aplikasi</span>
                            <span className="font-bold text-[#1E293B]">{detail.application_name || 'Generic POS'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-[#94a3b8] uppercase font-bold tracking-wider block">Nama Paket</span>
                            <span className="font-mono text-[#64748B] text-[10px]">{detail.package_name}</span>
                          </div>
                          
                          <div>
                            <span className="text-[9px] text-[#94a3b8] uppercase font-bold tracking-wider block">Versi Aplikasi</span>
                            <span className="font-bold text-[#1E293B]">v{detail.app_version}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-[#94a3b8] uppercase font-bold tracking-wider block">Versi Database</span>
                            <span className="font-mono text-[#64748B]">{detail.database_version || 'N/A'}</span>
                          </div>

                          <div>
                            <span className="text-[9px] text-[#94a3b8] uppercase font-bold tracking-wider block">Android / SDK</span>
                            <span className="font-semibold text-[#1E293B]">Android {detail.android_version || 'N/A'} (API {detail.sdk_version || 'N/A'})</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-[#94a3b8] uppercase font-bold tracking-wider block">Tipe Build</span>
                            <span className="font-mono text-xs text-[#64748B]">{detail.build_type || 'RELEASE'}</span>
                          </div>

                          <div>
                            <span className="text-[9px] text-[#94a3b8] uppercase font-bold tracking-wider block">Host Perangkat Keras</span>
                            <span className="font-semibold text-[#1E293B]">
                              {detail.manufacturer || ''} {detail.device_brand || ''} {detail.device_model || ''}
                            </span>
                            {detail.device_name && <span className="text-[10px] text-gray-400 block">({detail.device_name})</span>}
                          </div>
                          <div>
                            <span className="text-[9px] text-[#94a3b8] uppercase font-bold tracking-wider block">ID Lisensi</span>
                            <span className="font-mono text-[10px] text-[#64748B] truncate block" title={detail.license_id || ''}>
                              {detail.license_id}
                            </span>
                          </div>

                          {detail.whatsapp && (
                            <div>
                              <span className="text-[9px] text-[#94a3b8] uppercase font-bold tracking-wider block">Kontak WhatsApp</span>
                              <span className="font-bold text-emerald-600 block">{detail.whatsapp}</span>
                            </div>
                          )}
                          
                          <div>
                            <span className="text-[9px] text-[#94a3b8] uppercase font-bold tracking-wider block">Waktu Pengambilan</span>
                            <span className="text-gray-500 font-mono text-[10px]">
                              {new Date(detail.timestamp).toLocaleString('en-US', { hour12: false })}
                            </span>
                          </div>

                        </div>
                      </div>

                      {/* Screenshot Section */}
                      {detail.screenshot_url && (
                        <div className="border-t border-gray-100 pt-6">
                          <h4 className="text-[10px] font-bold text-[#1E293B] uppercase tracking-wider mb-3">Tangkapan Layar Terlampir</h4>
                          <div 
                            onClick={() => setLightboxUrl(detail.screenshot_url)}
                            className="relative max-w-full rounded-2xl overflow-hidden border border-gray-200 cursor-zoom-in hover:brightness-95 transition-all duration-300 shadow-sm"
                          >
                            <img 
                              src={detail.screenshot_url} 
                              alt="Tangkapan Layar Masukan" 
                              className="max-h-48 object-cover w-full"
                            />
                            <div className="absolute bottom-3 right-3 bg-black/60 text-white rounded-lg p-1.5 flex items-center space-x-1">
                              <Eye className="w-3.5 h-3.5" />
                              <span className="text-[8px] font-bold uppercase tracking-wider">Klik untuk Memperbesar</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Diagnostic Log */}
                      {detail.diagnostic_log && (
                        <div className="border-t border-gray-100 pt-6">
                          <h4 className="text-[10px] font-bold text-[#1E293B] uppercase tracking-wider mb-3">Payload Log Diagnostik</h4>
                          <pre className="bg-[#1E293B] text-gray-200 p-4 rounded-2xl text-[10px] font-mono overflow-auto max-h-48 whitespace-pre-wrap select-text">
                            {detail.diagnostic_log}
                          </pre>
                        </div>
                      )}

                      {/* Status & Developer Notes Form */}
                      <div className="border-t border-[#F0F2F5] pt-6 space-y-4">
                        <h4 className="text-[10px] font-bold text-[#1E293B] uppercase tracking-wider">Intervensi Pengembang</h4>
                        
                        {/* Status Management */}
                        <div>
                          <label className="block text-[9px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Alur Kerja Pembaruan Status</label>
                          <div className="flex flex-wrap gap-2">
                            {['NEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'].map((st) => {
                              const statusVal = st as FeedbackStatus;
                              const currentVal = detail.status || 'NEW';
                              const isAllowed = getAvailableTransitions(currentVal).includes(statusVal);
                              const isActive = targetStatus === statusVal;

                              return (
                                <button
                                  key={statusVal}
                                  disabled={!isAllowed}
                                  onClick={() => setTargetStatus(statusVal)}
                                  className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all duration-200 ${
                                    isActive 
                                      ? 'bg-[#1E293B] text-white border-transparent' 
                                      : isAllowed
                                        ? 'bg-white border-gray-200 hover:bg-gray-50 text-[#64748B]'
                                        : 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed opacity-50'
                                  }`}
                                >
                                  {statusVal}
                                </button>
                              );
                            })}
                          </div>
                          
                          {/* Workflow help tip info box */}
                          <p className="text-[8.5px] text-[#94a3b8] font-semibold mt-2 uppercase tracking-wide flex items-center space-x-1.5 font-sans">
                            <UserCheck className="w-3 h-3 text-[#0EA5E9]" />
                            <span>Alur kerja: NEW ➔ IN_PROGRESS ➔ RESOLVED atau REJECTED</span>
                          </p>
                        </div>

                        {/* Developer internal note */}
                        <div>
                          <label className="block text-[9px] font-bold text-[#64748B] uppercase tracking-wider mb-2">
                            Catatan Pengembang (Hanya Catatan Internal)
                          </label>
                          <textarea
                            rows={3}
                            value={devNote}
                            onChange={(e) => setDevNote(e.target.value)}
                            placeholder="Tulis resolusi tim internal, log masalah perangkat keras, atau catatan debug..."
                            className="w-full p-3 border border-gray-200 rounded-2xl text-xs focus:ring-1 focus:ring-[#0EA5E9] outline-none"
                          />
                        </div>

                        {/* Save update button */}
                        <button
                          disabled={savingDetail || (targetStatus === detail.status && devNote === (detail.developer_note || ''))}
                          onClick={handleSaveDetail}
                          className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-[#0EA5E9] to-[#38bdf8] text-white font-bold py-2.5 rounded-2xl text-xs shadow-md disabled:opacity-50 disabled:pointer-events-none transition-all duration-300 active:scale-98 font-sans"
                        >
                          {savingDetail ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Menyimpan Perubahan...</span>
                            </>
                          ) : (
                            <>
                              <ArrowRight className="w-3.5 h-3.5" />
                              <span>Simpan Catatan & Atur Status</span>
                            </>
                          )}
                        </button>
                      </div>

                    </div>
                  )}

                </div>
              ) : null}
            </Card>
          </section>
        )}

      </div>

      {/* ─── FULL SCREEN SCREENSHOT LIGHTBOX OVERLAY ───────────── */}
      {lightboxUrl && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl">
            <img 
              src={lightboxUrl} 
              alt="Expanded Screenshot Attachment" 
              className="max-h-[80vh] w-auto object-contain mx-auto"
            />
            <button 
              onClick={() => setLightboxUrl(null)}
              className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all duration-200 active:scale-90"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
