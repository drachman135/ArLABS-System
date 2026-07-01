import React, { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle, Smartphone, RefreshCw, Search,
  Activity, ChevronRight, MessageSquare, Terminal, CheckCircle2,
  X, Info
} from 'lucide-react';
import {
  fetchCrashSummary,
  fetchCrashIssues,
  fetchCrashReportsForIssue,
  updateIssueStatus,
  updateIssueNotes,
  fetchIssueComments,
  addIssueComment
} from './services/crashService';
import type {
  CrashSummaryMetrics,
  IssueGroup,
  CrashReport,
  DeveloperComment,
  IssueStatus
} from './types/crash.types';

// ─── Skeleton Loading Component ─────────────────────────────
const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-lg ${className}`} />
);

// ─── Section Label Component ─────────────────────────────────
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

// ─── KPI Card Component ──────────────────────────────────────
const KpiCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number | string;
  suffix?: string;
  color: string;
  bg: string;
  loading?: boolean;
}> = ({ icon, label, value, suffix, color, bg, loading }) => (
  <Card className="p-5 flex flex-col justify-between space-y-3">
    <div className="flex justify-between items-start">
      <div className={`p-2.5 rounded-xl ${bg}`}>
        <span style={{ color }}>{icon}</span>
      </div>
    </div>
    <div>
      <p className="text-[9px] text-[#94a3b8] uppercase font-bold tracking-widest mb-1">{label}</p>
      {loading ? (
        <Skeleton className="h-8 w-20" />
      ) : (
        <p className="text-3xl font-black tracking-tight" style={{ color }}>
          {value}{suffix && <span className="text-sm ml-1 text-[#94a3b8]">{suffix}</span>}
        </p>
      )}
    </div>
  </Card>
);

// ─── Card Wrapper ───────────────────────────────────────────
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] hover:shadow-[10px_10px_20px_#d1d5db,-10px_-10px_20px_#ffffff] transition-all duration-300 rounded-[20px] ${className}`}>
    {children}
  </div>
);

// ─── Badge Component ────────────────────────────────────────
const Badge: React.FC<{ label: string; variant: 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'gray' }> = ({
  label, variant
}) => {
  const cls = {
    red: 'bg-red-50 text-red-600 border-red-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    blue: 'bg-sky-50 text-sky-600 border-sky-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    gray: 'bg-gray-50 text-gray-500 border-gray-100',
  }[variant];
  return <span className={`px-2 py-0.5 text-[8.5px] font-bold uppercase rounded border ${cls}`}>{label}</span>;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  MAIN SCREEN COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const CrashReportScreen: React.FC = () => {
  // UI views
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<IssueGroup | null>(null);
  const [reports, setReports] = useState<CrashReport[]>([]);
  const [comments, setComments] = useState<DeveloperComment[]>([]);
  
  // Input fields
  const [newComment, setNewComment] = useState('');
  const [developerName, setDeveloperName] = useState('Developer');
  const [newNotes, setNewNotes] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Data states
  const [summary, setSummary] = useState<CrashSummaryMetrics | null>(null);
  const [issues, setIssues] = useState<IssueGroup[]>([]);

  // Loading flags
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingIssues, setLoadingIssues] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Load summary and list
  const loadData = useCallback(async () => {
    setRefreshing(true);
    setLoadingSummary(true);
    fetchCrashSummary().then(s => { setSummary(s); setLoadingSummary(false); });

    setLoadingIssues(true);
    fetchCrashIssues({
      status: filterStatus || undefined,
      severity: filterSeverity || undefined,
      searchQuery: searchQuery || undefined
    }).then(list => {
      setIssues(list);
      setLoadingIssues(false);
    }).catch(() => setLoadingIssues(false));

    setRefreshing(false);
  }, [filterStatus, filterSeverity, searchQuery]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load detailed reports and comments when an issue is selected
  const handleSelectIssue = async (issue: IssueGroup) => {
    setSelectedIssue(issue);
    setNewNotes(issue.notes || '');
    setEditingNotes(false);
    setLoadingDetail(true);
    
    try {
      const [reps, comms] = await Promise.all([
        fetchCrashReportsForIssue(issue.id),
        fetchIssueComments(issue.id)
      ]);
      setReports(reps);
      setComments(comms);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Change Issue Status
  const handleStatusChange = async (newStatus: IssueStatus) => {
    if (!selectedIssue) return;
    const ok = await updateIssueStatus(selectedIssue.id, newStatus);
    if (ok) {
      setSelectedIssue(prev => prev ? { ...prev, status: newStatus } : null);
      loadData();
    }
  };

  // Save developer notes/comments
  const handleSaveNotes = async () => {
    if (!selectedIssue) return;
    const ok = await updateIssueNotes(selectedIssue.id, newNotes);
    if (ok) {
      setSelectedIssue(prev => prev ? { ...prev, notes: newNotes } : null);
      setEditingNotes(false);
      loadData();
    }
  };

  // Post new conversation note
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue || !newComment.trim()) return;
    const ok = await addIssueComment(selectedIssue.id, developerName, newComment);
    if (ok) {
      const comms = await fetchIssueComments(selectedIssue.id);
      setComments(comms);
      setNewComment('');
    }
  };

  const severityColors = {
    FATAL: 'red',
    CRITICAL: 'orange',
    ANR: 'yellow',
    NON_FATAL: 'blue'
  } as const;

  const statusColors = {
    OPEN: 'red',
    INVESTIGATING: 'orange',
    RESOLVED: 'green',
    IGNORED: 'gray',
    ARCHIVED: 'gray'
  } as const;

  return (
    <div className="max-w-7xl mx-auto space-y-8 font-['Outfit'] select-none">
      
      {/* ── HEADER PANEL ───────────────────────────────────── */}
      <section className="bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] p-6 rounded-[24px] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="tracking-widest text-[9px] font-bold text-[#64748B] uppercase">Stability Management</span>
          <h3 className="text-base font-black text-[#1E293B] tracking-tight mt-1">SYS // CRASH_ERROR_REPORTING</h3>
          <p className="text-[9px] text-[#94a3b8] font-mono mt-1">
            Offline-first diagnostics queue cache synchronization
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94a3b8]" />
            <input
              type="text"
              placeholder="Search stack trace, messages..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-[11px] text-[#1E293B] focus:outline-none focus:border-[#0EA5E9] w-48 shadow-sm font-semibold"
            />
          </div>

          <button
            onClick={loadData}
            disabled={refreshing}
            className="border border-white bg-white hover:border-[#0EA5E9]/50 hover:bg-[#0EA5E9]/10 text-[#1E293B] hover:text-[#0EA5E9] p-2.5 rounded-xl transition-all duration-300 shadow-sm flex items-center justify-center disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </section>

      {/* ── OFFLINE-FIRST FLOW BANNER ──────────────────────── */}
      <Card className="p-4 bg-gradient-to-r from-indigo-50 to-sky-50 border border-indigo-100 flex items-start gap-4">
        <Info className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-black text-indigo-700 uppercase tracking-wider">Offline-First Crash Report Architecture</p>
          <p className="text-[10px] text-indigo-600 leading-relaxed">
            Aplikasi ArLABS POS / Rental menyimpan laporan crash secara lokal pada database SQLite/Room saat offline. Laporan ini tidak akan memblokir aplikasi Anda dan baru akan diunggah secara senyap ketika aplikasi terhubung kembali ke jaringan server saat melakukan sinkronisasi modul lainnya (License, Announcement, OTA Update, dll.).
          </p>
        </div>
      </Card>

      {/* ── SECTION 1: SUMMARY KPI CARDS ───────────────────── */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Total Crashes (Fatal)"
          value={summary?.totalCrashes ?? 0}
          color="#EF4444"
          bg="bg-red-50"
          loading={loadingSummary}
        />
        <KpiCard
          icon={<Info className="w-4 h-4" />}
          label="Non-Fatal Errors"
          value={summary?.nonFatalErrors ?? 0}
          color="#3B82F6"
          bg="bg-blue-50"
          loading={loadingSummary}
        />
        <KpiCard
          icon={<Smartphone className="w-4 h-4" />}
          label="Crash-Free Devices"
          value={summary?.crashFreeDevicesRate ?? 100}
          suffix="%"
          color="#10B981"
          bg="bg-emerald-50"
          loading={loadingSummary}
        />
        <KpiCard
          icon={<Activity className="w-4 h-4" />}
          label="Affected Apps"
          value={summary?.appsAffectedCount ?? 0}
          color="#8B5CF6"
          bg="bg-purple-50"
          loading={loadingSummary}
        />
      </section>

      {/* ── SECTION 2: FILTERS & ISSUE LIST ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Heavy: Issue Listing (8 columns) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-[#64748B]">
              <Terminal className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Unresolved Issues</span>
            </div>
            
            {/* Filter buttons */}
            <div className="flex gap-2">
              <select
                value={filterSeverity}
                onChange={e => setFilterSeverity(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg text-[10px] text-[#1E293B] px-2 py-1 focus:outline-none font-bold"
              >
                <option value="">All Severities</option>
                <option value="FATAL">FATAL</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="ANR">ANR</option>
                <option value="NON_FATAL">NON FATAL</option>
              </select>

              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg text-[10px] text-[#1E293B] px-2 py-1 focus:outline-none font-bold"
              >
                <option value="">All Statuses</option>
                <option value="OPEN">OPEN</option>
                <option value="INVESTIGATING">INVESTIGATING</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="IGNORED">IGNORED</option>
              </select>
            </div>
          </div>

          {loadingIssues ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : issues.length === 0 ? (
            <Card className="p-12 text-center text-[#64748B]">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3 animate-pulse" />
              <p className="text-sm font-black">All Clean! No Crashes Registered</p>
              <p className="text-xs text-gray-400 mt-1">Ecosystem stability is running within normal thresholds.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {issues.map(iss => (
                <div
                  key={iss.id}
                  onClick={() => handleSelectIssue(iss)}
                  className={`p-5 rounded-[20px] border transition-all duration-300 cursor-pointer ${
                    selectedIssue?.id === iss.id
                      ? 'bg-gradient-to-r from-[#0EA5E9]/10 to-[#38bdf8]/5 border-[#0EA5E9]/40 shadow-md'
                      : 'bg-white/80 border-white/60 shadow-[3px_3px_8px_#d1d5db] hover:border-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge label={iss.severity} variant={severityColors[iss.severity] ?? 'gray'} />
                        <Badge label={iss.status} variant={statusColors[iss.status] ?? 'gray'} />
                        <span className="text-[10px] text-[#64748B] font-bold font-mono">{iss.package_name}</span>
                      </div>
                      <h4 className="text-xs font-black text-[#1E293B] truncate leading-tight">{iss.title}</h4>
                      <p className="text-[9px] text-[#94a3b8] font-mono truncate">{iss.exception_message}</p>
                    </div>

                    <div className="flex items-center space-x-6 text-right flex-shrink-0">
                      <div>
                        <p className="text-lg font-black text-[#1E293B] leading-none">{iss.occurrences}</p>
                        <p className="text-[8px] text-[#94a3b8] font-bold uppercase tracking-wider mt-1">Events</p>
                      </div>
                      <div>
                        <p className="text-lg font-black text-[#6366F1] leading-none">{iss.affected_devices}</p>
                        <p className="text-[8px] text-[#94a3b8] font-bold uppercase tracking-wider mt-1">Users</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#94a3b8]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Panel: Detail View (4 columns) */}
        <div className="lg:col-span-4">
          {selectedIssue ? (
            <Card className="p-6 space-y-6 max-h-[85vh] overflow-y-auto animate-scale-up">
              
              {/* Header Title */}
              <div className="flex justify-between items-start border-b border-gray-100 pb-4">
                <div className="min-w-0 space-y-1">
                  <span className="text-[8px] text-[#64748B] uppercase font-bold tracking-widest block">Issue Profile</span>
                  <h4 className="text-xs font-black text-[#1E293B] leading-snug">{selectedIssue.title}</h4>
                  <p className="text-[9px] text-[#94a3b8] font-mono break-all mt-1">{selectedIssue.exception_type}</p>
                </div>
                <button 
                  onClick={() => setSelectedIssue(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status control */}
              <div className="space-y-2.5">
                <span className="text-[9px] text-[#64748B] uppercase font-bold tracking-widest block">Update Life Cycle Status</span>
                <div className="flex flex-wrap gap-2">
                  {(['OPEN', 'INVESTIGATING', 'RESOLVED', 'IGNORED'] as IssueStatus[]).map(st => (
                    <button
                      key={st}
                      onClick={() => handleStatusChange(st)}
                      className={`px-3 py-1 rounded-lg text-[9px] font-bold border transition-all ${
                        selectedIssue.status === st
                          ? 'bg-[#0EA5E9] text-white border-transparent shadow-sm'
                          : 'bg-white hover:bg-gray-50 border-gray-200 text-[#64748B]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Developer internal notes */}
              <div className="space-y-2 border-t border-gray-100 pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-[#64748B] uppercase font-bold tracking-widest block">Developer Notes</span>
                  <button
                    onClick={() => {
                      if (editingNotes) handleSaveNotes();
                      else setEditingNotes(true);
                    }}
                    className="text-[9px] text-[#0EA5E9] font-bold hover:underline"
                  >
                    {editingNotes ? '[ Save Notes ]' : '[ Edit Notes ]'}
                  </button>
                </div>

                {editingNotes ? (
                  <textarea
                    rows={3}
                    value={newNotes}
                    onChange={e => setNewNotes(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl text-[10px] text-[#1E293B] p-2 focus:outline-none resize-none font-semibold"
                  />
                ) : (
                  <p className="text-[10px] text-gray-600 leading-relaxed bg-gray-50 rounded-xl p-3 border border-gray-100 whitespace-pre-wrap">
                    {selectedIssue.notes || 'No notes added yet. Click edit to add developer diagnostic comments.'}
                  </p>
                )}
              </div>

              {/* Stack Trace Display */}
              {loadingDetail ? (
                <Skeleton className="h-44 w-full" />
              ) : reports[0] ? (
                <div className="space-y-2 border-t border-gray-100 pt-4">
                  <span className="text-[9px] text-[#64748B] uppercase font-bold tracking-widest block">Stack Trace</span>
                  <div className="relative">
                    <pre className="bg-slate-900 text-red-300 text-[8.5px] font-mono p-3 rounded-xl overflow-x-auto leading-relaxed max-h-56 select-text whitespace-pre">
                      {reports[0].stack_trace}
                    </pre>
                  </div>
                </div>
              ) : null}

              {/* Hardware Context */}
              {reports[0] && (
                <div className="space-y-3.5 border-t border-gray-100 pt-4 text-[10px]">
                  <span className="text-[9px] text-[#64748B] uppercase font-bold tracking-widest block">Sync Device Context</span>
                  
                  <div className="grid grid-cols-2 gap-2 text-[9.5px]">
                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <p className="text-gray-400 font-bold uppercase">Device</p>
                      <p className="font-bold text-[#1E293B] truncate">{reports[0].device_info.manufacturer} {reports[0].device_info.device_model}</p>
                    </div>
                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <p className="text-gray-400 font-bold uppercase">Android version</p>
                      <p className="font-bold text-[#1E293B]">Android {reports[0].device_info.android_version}</p>
                    </div>
                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <p className="text-gray-400 font-bold uppercase">RAM / Storage</p>
                      <p className="font-bold text-[#1E293B]">{reports[0].device_info.ram_total_gb}GB / {reports[0].device_info.storage_total_gb}GB</p>
                    </div>
                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <p className="text-gray-400 font-bold uppercase">Screen Res</p>
                      <p className="font-bold text-[#1E293B]">{reports[0].device_info.screen_resolution}</p>
                    </div>
                  </div>

                  {/* Customer context */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-1 text-[#64748B] font-mono text-[9px]">
                    <p>DEVICE_ID: {reports[0].device_id}</p>
                    {reports[0].license_id && <p>LICENSE_ID: {reports[0].license_id}</p>}
                    {reports[0].customer_id && <p>CUSTOMER_ID: {reports[0].customer_id}</p>}
                  </div>
                </div>
              )}

              {/* Developer Collaboration Comments Section */}
              <div className="space-y-4 border-t border-gray-100 pt-4">
                <span className="text-[9px] text-[#64748B] uppercase font-bold tracking-widest block">Team Comments ({comments.length})</span>
                
                {comments.length > 0 && (
                  <div className="space-y-3 max-h-40 overflow-y-auto">
                    {comments.map(c => (
                      <div key={c.id} className="bg-gray-50 rounded-xl p-3 space-y-1.5 border border-gray-100">
                        <div className="flex justify-between items-center text-[8.5px]">
                          <span className="font-bold text-[#0EA5E9]">{c.author}</span>
                          <span className="text-gray-400 font-mono">{new Date(c.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-[9.5px] text-gray-700 leading-normal font-semibold">{c.comment}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Comment composer */}
                <form onSubmit={handlePostComment} className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Your Name"
                      value={developerName}
                      onChange={e => setDeveloperName(e.target.value)}
                      className="bg-white border border-gray-200 rounded-lg text-[9.5px] text-[#1E293B] p-2 focus:outline-none font-bold"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Add diagnostic comments..."
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      className="flex-1 bg-white border border-gray-200 rounded-lg text-[9.5px] text-[#1E293B] p-2 focus:outline-none font-semibold"
                    />
                    <button
                      type="submit"
                      className="bg-[#0EA5E9] text-white font-bold text-[9px] px-3.5 rounded-lg uppercase shadow-sm"
                    >
                      Post
                    </button>
                  </div>
                </form>
              </div>

            </Card>
          ) : (
            <Card className="p-12 text-center text-[#94a3b8] flex flex-col justify-center items-center min-h-[350px]">
              <MessageSquare className="w-8 h-8 opacity-40 mb-3" />
              <p className="text-xs font-black">No Issue Profile Selected</p>
              <p className="text-[10px] text-gray-400 mt-1">Select an issue on the left list to view diagnostic logs, stack trace, and device hardware profiling.</p>
            </Card>
          )}
        </div>

      </div>

      {/* ── SQL SETUP CARD ─────────────────────────────────── */}
      <Card className="p-6 border-dashed border-2 border-indigo-200 bg-indigo-50/20">
        <SectionLabel icon={<Terminal className="w-4 h-4 text-indigo-500" />} title="Database Configuration Schema" subtitle="Action Required" />
        <p className="text-[11px] text-[#64748B] mb-3 leading-relaxed">
          Salin dan jalankan perintah SQL berikut di **Supabase SQL Editor** Anda untuk melengkapi infrastruktur database pelaporan crash (`crash_issues`, `crash_reports`, dan `crash_comments`):
        </p>
        <pre className="bg-[#1E293B] text-emerald-300 text-[10px] font-mono p-4 rounded-xl overflow-x-auto leading-relaxed whitespace-pre">
{`-- 1. Tabel Master Isu Grouping
CREATE TABLE IF NOT EXISTS crash_issues (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title             TEXT NOT NULL,
  exception_type    TEXT NOT NULL,
  exception_message TEXT NOT NULL,
  package_name      TEXT NOT NULL,
  severity          TEXT NOT NULL CHECK (severity IN ('FATAL', 'NON_FATAL', 'ANR', 'CRITICAL')),
  occurrences       INTEGER DEFAULT 1,
  affected_devices  INTEGER DEFAULT 1,
  first_seen        TIMESTAMPTZ DEFAULT NOW(),
  last_seen         TIMESTAMPTZ DEFAULT NOW(),
  status            TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'IGNORED', 'ARCHIVED')),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabel Laporan Detail Crash dari Perangkat
CREATE TABLE IF NOT EXISTS crash_reports (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id          UUID REFERENCES crash_issues(id) ON DELETE CASCADE,
  package_name      TEXT NOT NULL,
  app_name          TEXT NOT NULL,
  app_version       TEXT NOT NULL,
  version_code      INTEGER NOT NULL,
  severity          TEXT NOT NULL CHECK (severity IN ('FATAL', 'NON_FATAL', 'ANR', 'CRITICAL')),
  exception_type    TEXT NOT NULL,
  exception_message TEXT NOT NULL,
  stack_trace       TEXT NOT NULL,
  device_id         TEXT NOT NULL,
  device_info       JSONB NOT NULL,
  license_id        TEXT,
  customer_id       TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  synced_at         TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabel Kolaborasi Diskusi Tim Developer
CREATE TABLE IF NOT EXISTS crash_comments (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id          UUID REFERENCES crash_issues(id) ON DELETE CASCADE,
  author            TEXT NOT NULL,
  comment           TEXT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Index Kecepatan Baca Diagnostik
CREATE INDEX IF NOT EXISTS idx_ci_status ON crash_issues(status);
CREATE INDEX IF NOT EXISTS idx_cr_issue_id ON crash_reports(issue_id);
CREATE INDEX IF NOT EXISTS idx_cr_created_at ON crash_reports(created_at DESC);`}
        </pre>
      </Card>

    </div>
  );
};
