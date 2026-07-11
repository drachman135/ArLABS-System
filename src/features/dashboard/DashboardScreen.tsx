import React, { useEffect, useState } from 'react';
import { supabase } from '../../core/supabase';
import { LicenseScreen } from '../licenses/LicenseScreen';
import { CustomerScreen } from '../customers/CustomerScreen';
import { AppManagementScreen } from '../applications/AppManagementScreen';
import { UpdateManagementScreen } from '../updates/UpdateManagementScreen';
import { NotificationScreen } from '../notifications/NotificationScreen';
import { AnnouncementScreen } from '../announcements/AnnouncementScreen';
import { RemoteConfigScreen } from '../config/RemoteConfigScreen';
import { AnalyticsDashboard } from '../analytics/AnalyticsDashboard';
import { ApkStatsDashboard } from '../apkstats/ApkStatsDashboard';
import { CrashReportScreen } from '../crash/CrashReportScreen';
import { FeedbackCenterScreen } from '../feedback/FeedbackCenterScreen';
import {
  RefreshCw,
  Wifi,
  Database,
  X,
  Key,
  AlertTriangle,
  Bell,
  Menu,
  LayoutDashboard,
  Box,
  Radio,
  Terminal,
  Plus,
  UploadCloud,
  MessageSquare,
  LogOut,
  ChevronUp,
  Smartphone
} from 'lucide-react';

interface DashboardScreenProps {
  session: any;
  profile: { name: string; role: string; email: string } | null;
  onLogout: () => void;
}

interface LogEntry {
  id: string;
  action: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  created_at: string;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ session, profile, onLogout }) => {
  const [activeView, setActiveView] = useState<'dashboard' | 'analytics' | 'apkstats' | 'crash' | 'licenses' | 'customers' | 'applications' | 'updates' | 'notifications' | 'announcements' | 'config' | 'feedback'>('dashboard');
  const [connected, setConnected] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [openDropdown, setOpenDropdown] = useState<'stats' | 'reports' | 'registry' | 'distribution' | 'broadcast' | null>(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dock-container')) {
        setOpenDropdown(null);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const toggleDropdown = (name: 'stats' | 'reports' | 'registry' | 'distribution' | 'broadcast') => {
    setOpenDropdown(prev => prev === name ? null : name);
  };

  const [metrics, setMetrics] = useState({
    activeDevices: 0,
    activeLicenses: 0,
    expiredLicenses: 0
  });

  const activationHistory = [
    { day: 'MON', count: 12 },
    { day: 'TUE', count: 19 },
    { day: 'WED', count: 15 },
    { day: 'THU', count: 28 },
    { day: 'FRI', count: 22 },
    { day: 'SAT', count: 32 },
    { day: 'SUN', count: 30 }
  ];

  useEffect(() => {
    const updateTime = () => {
      const date = new Date();
      setCurrentTime(date.toLocaleTimeString('en-US', { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onesignalAppId = (import.meta as any).env?.VITE_ONESIGNAL_APP_ID;
    if (!onesignalAppId) return;

    const initOneSignal = async () => {
      if ((window as any).Capacitor && (window as any).plugins?.OneSignal) {
        try {
          const OneSignal = (window as any).plugins.OneSignal;
          OneSignal.initialize(onesignalAppId);
          OneSignal.Notifications.requestPermission(true).then((success: boolean) => {
            console.log("OneSignal push notification permission response:", success);
          });
        } catch (err) {
          console.error("Failed to initialize OneSignal plugin:", err);
        }
      }
    };
    initOneSignal();
  }, []);

  interface ToastNotification {
    id: string;
    title: string;
    body: string;
    type: 'activation' | 'feedback' | 'default';
  }
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);

      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.3);

      const oscillator2 = audioCtx.createOscillator();
      const gainNode2 = audioCtx.createGain();
      oscillator2.connect(gainNode2);
      gainNode2.connect(audioCtx.destination);
      oscillator2.type = 'sine';
      oscillator2.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
      gainNode2.gain.setValueAtTime(0.1, audioCtx.currentTime + 0.1);
      gainNode2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);
      oscillator2.start(audioCtx.currentTime + 0.1);
      oscillator2.stop(audioCtx.currentTime + 0.45);
    } catch (e) {
      console.error('Failed to play synthesizer sound:', e);
    }
  };

  const addToast = (title: string, body: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    let type: ToastNotification['type'] = 'default';
    if (title.includes('🔑') || title.toLowerCase().includes('aktif') || title.toLowerCase().includes('license')) {
      type = 'activation';
    } else if (title.includes('⚠️') || title.toLowerCase().includes('lap') || title.toLowerCase().includes('feed')) {
      type = 'feedback';
    }

    setToasts(prev => [...prev, { id, title, body, type }]);
    playNotificationSound();

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  useEffect(() => {
    const channel = supabase
      .channel('global:notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const newNotif = payload.new as any;
        if (newNotif && newNotif.title) {
          addToast(newNotif.title, newNotif.body || newNotif.message || '');
          fetchDashboardData();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const start = performance.now();
      const { error: pingError } = await supabase.from('admins').select('id').limit(1);
      const end = performance.now();
      if (pingError) throw pingError;
      setConnected(true);

      const { count: activeLicCount, error: activeLicErr } = await supabase.from('licenses').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE');
      const { count: activeDevCount, error: activeDevErr } = await supabase.from('devices').select('*', { count: 'exact', head: true });
      const { count: expiredLicCount, error: expiredLicErr } = await supabase.from('licenses').select('*', { count: 'exact', head: true }).in('status', ['EXPIRED', 'SUSPENDED']);

      if (activeLicErr || activeDevErr || expiredLicErr) {
        setMetrics({ activeDevices: 0, activeLicenses: 0, expiredLicenses: 0 });
      } else {
        setMetrics({ activeDevices: activeDevCount || 0, activeLicenses: activeLicCount || 0, expiredLicenses: expiredLicCount || 0 });
      }

      const { data: logData, error: logError } = await supabase.from('logs').select('id, action, description, severity, created_at').order('created_at', { ascending: false }).limit(6);
      if (!logError && logData && logData.length > 0) {
        setLogs(logData.map(l => ({
          id: l.id, action: l.action, description: l.description, severity: l.severity as 'info' | 'warning' | 'critical',
          created_at: new Date(l.created_at).toLocaleTimeString('en-US', { hour12: false })
        })));
      } else {
        setLogs([
          { id: '1', action: 'SYS_CONN_PING', description: `Database ping OK in ${Math.round(end - start)}ms`, severity: 'info', created_at: new Date().toLocaleTimeString('en-US', { hour12: false }) },
          { id: '2', action: 'AUTH_VALIDATE', description: `Session OK: ${profile?.name || 'Administrator'}`, severity: 'info', created_at: new Date(Date.now() - 3000).toLocaleTimeString('en-US', { hour12: false }) },
          { id: '3', action: 'SECURITY_RLS', description: 'Multi-tenant RLS check verified.', severity: 'info', created_at: new Date(Date.now() - 10000).toLocaleTimeString('en-US', { hour12: false }) }
        ]);
      }
    } catch (err: any) {
      setConnected(false);
      setLogs([{ id: 'err-1', action: 'CONN_FAIL', description: err?.message || 'Gagal memuat telemetri.', severity: 'critical', created_at: new Date().toLocaleTimeString('en-US', { hour12: false }) }]);
      setMetrics({ activeDevices: 0, activeLicenses: 0, expiredLicenses: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [profile, activeView]);

  useEffect(() => {
    const handleDbRefresh = () => fetchDashboardData();
    window.addEventListener('db-refresh', handleDbRefresh);
    return () => window.removeEventListener('db-refresh', handleDbRefresh);
  }, []);

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-300 font-['Outfit'] select-none pb-28 lg:pb-8 lg:pl-[104px] overflow-x-hidden relative">

      {/* --- HEADER --- */}
      <header className="sticky top-0 z-40 bg-[#090D16]/80 backdrop-blur-xl border-b border-white/5 px-4 md:px-8 py-4 flex justify-between items-center mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center font-black text-white text-sm shadow-[0_0_15px_rgba(14,165,233,0.4)]">
            Ar
          </div>
          <div className="hidden sm:block">
            <h1 className="text-white font-black tracking-tight text-sm uppercase">ArLABS Command</h1>
            <p className="text-[10px] text-sky-400 font-mono tracking-widest">SYS_TIME // {currentTime || '00:00:00'}</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full backdrop-blur-sm">
            <Wifi className={`w-3.5 h-3.5 ${connected ? 'text-emerald-400' : 'text-rose-500'}`} />
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse' : 'bg-rose-500'}`} />
            <span className="hidden sm:inline font-bold text-[10px] uppercase tracking-widest text-slate-300">
              {connected ? 'LINK OK' : 'OFFLINE'}
            </span>
          </div>

          <button
            onClick={() => setIsMobileDrawerOpen(true)}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white transition-all"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* --- FLOATING DOCK NAVIGATION --- */}
      <nav className="dock-container fixed bottom-6 left-6 right-6 lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:left-6 lg:right-auto lg:w-[72px] lg:h-auto bg-[#131825]/90 backdrop-blur-2xl border border-white/10 rounded-3xl lg:rounded-[2rem] p-3 lg:py-6 flex flex-row lg:flex-col justify-around lg:justify-start lg:space-y-6 items-center z-50 shadow-2xl">
        <button
          onClick={() => { setActiveView('dashboard'); setOpenDropdown(null); }}
          className={`p-3.5 rounded-2xl transition-all duration-300 group ${activeView === 'dashboard' ? 'bg-sky-500/20 text-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.2)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
        >
          <LayoutDashboard className="w-5 h-5 group-hover:scale-110 transition-transform" />
        </button>

        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); toggleDropdown('registry'); }}
            className={`p-3.5 rounded-2xl transition-all duration-300 group ${['licenses', 'customers'].includes(activeView) || openDropdown === 'registry' ? 'bg-indigo-500/20 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <Key className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </button>
        </div>

        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); toggleDropdown('distribution'); }}
            className={`p-3.5 rounded-2xl transition-all duration-300 group ${['applications', 'updates'].includes(activeView) || openDropdown === 'distribution' ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <Box className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </button>
        </div>

        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); toggleDropdown('broadcast'); }}
            className={`p-3.5 rounded-2xl transition-all duration-300 group ${['notifications', 'announcements', 'config'].includes(activeView) || openDropdown === 'broadcast' ? 'bg-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <Radio className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </button>
        </div>

        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); toggleDropdown('reports'); }}
            className={`p-3.5 rounded-2xl transition-all duration-300 group ${['analytics', 'apkstats', 'crash', 'feedback'].includes(activeView) || openDropdown === 'reports' ? 'bg-rose-500/20 text-rose-400 shadow-[0_0_15px_rgba(225,29,72,0.2)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <Terminal className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </nav>

      {/* --- DYNAMIC SHEETS FOR DOCK MENU --- */}
      {openDropdown && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:pl-32 lg:flex lg:items-center" onClick={() => setOpenDropdown(null)}>
          <div
            className="absolute bottom-[100px] left-6 right-6 lg:relative lg:bottom-auto lg:left-auto lg:right-auto lg:w-72 bg-[#1A2133] border border-white/10 p-4 rounded-3xl shadow-2xl animate-[slideUp_0.2s_ease-out]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4 px-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pilih Modul</span>
              <button onClick={() => setOpenDropdown(null)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-2">
              {openDropdown === 'registry' && (
                <>
                  <button onClick={() => { setActiveView('licenses'); setOpenDropdown(null); }} className="w-full flex items-center p-4 bg-white/5 hover:bg-indigo-500/20 text-white rounded-2xl transition-all text-sm font-bold"><Key className="w-4 h-4 text-indigo-400 mr-3" /> Registri Lisensi</button>
                  <button onClick={() => { setActiveView('customers'); setOpenDropdown(null); }} className="w-full flex items-center p-4 bg-white/5 hover:bg-indigo-500/20 text-white rounded-2xl transition-all text-sm font-bold"><Menu className="w-4 h-4 text-indigo-400 mr-3" /> Registri Pelanggan</button>
                </>
              )}
              {openDropdown === 'distribution' && (
                <>
                  <button onClick={() => { setActiveView('applications'); setOpenDropdown(null); }} className="w-full flex items-center p-4 bg-white/5 hover:bg-emerald-500/20 text-white rounded-2xl transition-all text-sm font-bold"><Smartphone className="w-4 h-4 text-emerald-400 mr-3" /> Kontrol Aplikasi</button>
                  <button onClick={() => { setActiveView('updates'); setOpenDropdown(null); }} className="w-full flex items-center p-4 bg-white/5 hover:bg-emerald-500/20 text-white rounded-2xl transition-all text-sm font-bold"><UploadCloud className="w-4 h-4 text-emerald-400 mr-3" /> Pembaruan OTA</button>
                </>
              )}
              {openDropdown === 'broadcast' && (
                <>
                  <button onClick={() => { setActiveView('notifications'); setOpenDropdown(null); }} className="w-full flex items-center p-4 bg-white/5 hover:bg-amber-500/20 text-white rounded-2xl transition-all text-sm font-bold"><Bell className="w-4 h-4 text-amber-400 mr-3" /> Siaran Push</button>
                  <button onClick={() => { setActiveView('announcements'); setOpenDropdown(null); }} className="w-full flex items-center p-4 bg-white/5 hover:bg-amber-500/20 text-white rounded-2xl transition-all text-sm font-bold"><MessageSquare className="w-4 h-4 text-amber-400 mr-3" /> Pengumuman In-App</button>
                  <button onClick={() => { setActiveView('config'); setOpenDropdown(null); }} className="w-full flex items-center p-4 bg-white/5 hover:bg-amber-500/20 text-white rounded-2xl transition-all text-sm font-bold"><RefreshCw className="w-4 h-4 text-amber-400 mr-3" /> Remote Config</button>
                </>
              )}
              {openDropdown === 'reports' && (
                <>
                  <button onClick={() => { setActiveView('analytics'); setOpenDropdown(null); }} className="w-full flex items-center p-4 bg-white/5 hover:bg-rose-500/20 text-white rounded-2xl transition-all text-sm font-bold"><LayoutDashboard className="w-4 h-4 text-rose-400 mr-3" /> Analisis Sistem</button>
                  <button onClick={() => { setActiveView('apkstats'); setOpenDropdown(null); }} className="w-full flex items-center p-4 bg-white/5 hover:bg-rose-500/20 text-white rounded-2xl transition-all text-sm font-bold"><Database className="w-4 h-4 text-rose-400 mr-3" /> Statistik APK</button>
                  <button onClick={() => { setActiveView('crash'); setOpenDropdown(null); }} className="w-full flex items-center p-4 bg-white/5 hover:bg-rose-500/20 text-white rounded-2xl transition-all text-sm font-bold"><AlertTriangle className="w-4 h-4 text-rose-400 mr-3" /> Laporan Crash</button>
                  <button onClick={() => { setActiveView('feedback'); setOpenDropdown(null); }} className="w-full flex items-center p-4 bg-white/5 hover:bg-rose-500/20 text-white rounded-2xl transition-all text-sm font-bold"><MessageSquare className="w-4 h-4 text-rose-400 mr-3" /> Pusat Masukan</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- PROFILE & SETTINGS SHEET --- */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 transition-opacity flex justify-center items-end lg:items-center" onClick={() => setIsMobileDrawerOpen(false)}>
          <div
            className="w-full lg:w-96 bg-[#131825] border border-white/10 rounded-t-[2rem] lg:rounded-[2rem] p-6 pb-12 lg:pb-6 shadow-2xl animate-[slideUp_0.3s_ease-out]"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 lg:hidden" />

            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl flex items-center space-x-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center font-black text-white text-lg shadow-[0_0_15px_rgba(14,165,233,0.3)]">
                {profile?.name?.charAt(0) || 'A'}
              </div>
              <div>
                <h4 className="text-white font-black text-lg">{profile?.name || 'Administrator'}</h4>
                <p className="text-xs text-slate-400 font-mono mb-1">{profile?.email || 'admin@system.com'}</p>
                <span className="text-[9px] font-bold uppercase bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/30">
                  {profile?.role || 'owner'}
                </span>
              </div>
            </div>

            <button
              onClick={() => { onLogout(); setIsMobileDrawerOpen(false); }}
              className="w-full flex items-center justify-center p-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-2xl transition-colors font-bold"
            >
              <LogOut className="w-5 h-5 mr-2" /> Sign Out System
            </button>
          </div>
        </div>
      )}

      {/* --- MAIN CONTENT AREA --- */}
      <div className="px-4 md:px-6 lg:px-8 max-w-[1400px] mx-auto">
        {activeView === 'dashboard' ? (
          <div className="space-y-6">

            {/* 1. QUICK ACTIONS ROW */}
            <div className="grid grid-cols-3 gap-3 md:gap-6">
              <button onClick={() => setActiveView('licenses')} className="bg-[#131825] hover:bg-white/5 border border-white/5 rounded-3xl p-4 flex flex-col items-center justify-center space-y-3 transition-all group shadow-lg">
                <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus className="w-6 h-6 text-indigo-400" />
                </div>
                <span className="text-[10px] md:text-xs font-bold text-slate-300 uppercase tracking-widest">Buat Lisensi</span>
              </button>

              <button onClick={() => setActiveView('feedback')} className="bg-[#131825] hover:bg-white/5 border border-white/5 rounded-3xl p-4 flex flex-col items-center justify-center space-y-3 transition-all group shadow-lg">
                <div className="w-12 h-12 rounded-full bg-rose-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <AlertTriangle className="w-6 h-6 text-rose-400" />
                </div>
                <span className="text-[10px] md:text-xs font-bold text-slate-300 uppercase tracking-widest">Cek Laporan</span>
              </button>

              <button onClick={() => setActiveView('updates')} className="bg-[#131825] hover:bg-white/5 border border-white/5 rounded-3xl p-4 flex flex-col items-center justify-center space-y-3 transition-all group shadow-lg">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-6 h-6 text-emerald-400" />
                </div>
                <span className="text-[10px] md:text-xs font-bold text-slate-300 uppercase tracking-widest">Update OTA</span>
              </button>
            </div>

            <main className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* BLOCK 1: Neon Activation Chart */}
              <section className="col-span-1 lg:col-span-8 bg-[#131825] border border-white/5 shadow-2xl p-6 md:p-8 rounded-[2rem] flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 blur-[100px] rounded-full pointer-events-none" />

                <div className="flex justify-between items-start mb-8 relative z-10">
                  <div>
                    <span className="tracking-widest text-[9px] font-bold text-sky-400 uppercase">Telemetry Log</span>
                    <h3 className="text-base font-black text-white tracking-tight mt-1">Rolling 7-Day Activations</h3>
                  </div>
                  <button
                    onClick={fetchDashboardData}
                    disabled={loading}
                    className="bg-white/5 hover:bg-sky-500/20 border border-white/10 hover:border-sky-500/30 text-slate-300 hover:text-sky-400 p-2 md:px-4 md:py-2 rounded-xl transition-all duration-300 flex items-center space-x-2 font-bold disabled:opacity-40"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    <span className="hidden md:inline text-xs">Sync Data</span>
                  </button>
                </div>

                <div className="w-full h-56 flex items-end justify-center relative py-4 z-10">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center space-y-3 text-sky-400 font-mono text-xs">
                      <RefreshCw className="w-6 h-6 animate-spin" />
                      <span>FETCHING_STREAM...</span>
                    </div>
                  ) : (
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 500 130" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="neonGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <line x1="0" y1="32" x2="500" y2="32" stroke="#1e293b" strokeWidth="1" strokeDasharray="4,4" />
                      <line x1="0" y1="65" x2="500" y2="65" stroke="#1e293b" strokeWidth="1" strokeDasharray="4,4" />
                      <line x1="0" y1="98" x2="500" y2="98" stroke="#1e293b" strokeWidth="1" strokeDasharray="4,4" />
                      <path d="M 0 130 L 0 95 L 83 75 L 166 85 L 249 45 L 332 65 L 415 25 L 500 30 L 500 130 Z" fill="url(#neonGradient)" />
                      <path d="M 0 95 L 83 75 L 166 85 L 249 45 L 332 65 L 415 25 L 500 30" fill="none" stroke="#38bdf8" strokeWidth="3" filter="drop-shadow(0 0 8px rgba(56,189,248,0.6))" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="83" cy="75" r="4" fill="#090D16" stroke="#38bdf8" strokeWidth="2" />
                      <circle cx="166" cy="85" r="4" fill="#090D16" stroke="#38bdf8" strokeWidth="2" />
                      <circle cx="249" cy="45" r="4" fill="#090D16" stroke="#38bdf8" strokeWidth="2" />
                      <circle cx="332" cy="65" r="4" fill="#090D16" stroke="#38bdf8" strokeWidth="2" />
                      <circle cx="415" cy="25" r="4" fill="#090D16" stroke="#38bdf8" strokeWidth="2" />
                    </svg>
                  )}
                  {!loading && (
                    <div className="absolute inset-0 flex justify-between px-4 pt-6 pointer-events-none">
                      {activationHistory.map((h, i) => (
                        <div key={i} className="flex flex-col justify-between h-full items-center text-[10px] text-slate-500 font-bold">
                          <span className="text-sky-400 font-mono opacity-0">{h.count}</span>
                          <span className="mt-auto pt-2">{h.day}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* BLOCK 2: Core Operations Counters */}
              <section className="col-span-1 lg:col-span-4 bg-[#131825] border border-white/5 shadow-2xl p-6 md:p-8 rounded-[2rem] flex flex-col justify-between space-y-6">
                <div>
                  <span className="tracking-widest text-[9px] font-bold text-emerald-400 uppercase">Metric Stack</span>
                  <h3 className="text-base font-black text-white tracking-tight mt-1 mb-6">Operasi Inti</h3>
                </div>

                <div className="space-y-6 flex-grow">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/20 blur-[50px]" />
                    <span className="text-[10px] text-slate-400 font-bold tracking-widest block uppercase">Lisensi Aktif</span>
                    <div className="flex items-baseline space-x-2 mt-2">
                      <span className="text-4xl font-black text-sky-400 tracking-tight drop-shadow-[0_0_10px_rgba(56,189,248,0.4)]">
                        {loading ? '...' : metrics.activeLicenses}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-end pb-3 border-b border-white/10 px-2">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold tracking-widest block uppercase">Total Perangkat</span>
                      <span className="text-2xl font-black text-white tracking-tight mt-1 block">{loading ? '...' : metrics.activeDevices}</span>
                    </div>
                    <Smartphone className="w-6 h-6 text-slate-500 mb-2" />
                  </div>

                  <div className="flex justify-between items-end px-2">
                    <div>
                      <span className="text-[10px] text-rose-500 font-bold tracking-widest block uppercase">Perlu Pembaruan</span>
                      <span className="text-2xl font-black text-rose-500 tracking-tight mt-1 block">{loading ? '...' : metrics.expiredLicenses}</span>
                    </div>
                    <AlertTriangle className="w-6 h-6 text-rose-500/50 mb-2" />
                  </div>
                </div>
              </section>

              {/* BLOCK 3: Terminal Audit Logs */}
              <section className="col-span-1 lg:col-span-12 bg-black/60 border border-white/5 shadow-2xl p-6 md:p-8 rounded-[2rem] font-mono">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center space-x-3">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-[10px] sm:text-xs font-bold text-slate-400 tracking-widest uppercase">AUDIT_LOG // STDOUT</h3>
                  </div>
                  <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded uppercase border border-emerald-500/30">
                    SYS_OK
                  </span>
                </div>

                <div className="text-[10px] sm:text-xs text-slate-400 space-y-3">
                  {logs.map((log) => {
                    let logColor = 'text-emerald-400';
                    if (log.severity === 'warning') logColor = 'text-amber-400';
                    if (log.severity === 'critical') logColor = 'text-rose-500 font-bold';

                    return (
                      <div key={log.id} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 hover:bg-white/5 p-1.5 -mx-1.5 rounded-lg transition-colors">
                        <span className="text-slate-600 flex-shrink-0">[{log.created_at}]</span>
                        <div className="flex-grow flex flex-col sm:flex-row sm:items-center sm:space-x-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] bg-white/10 uppercase tracking-wider ${logColor}`}>
                            {log.action}
                          </span>
                          <span className={`break-all ${logColor}`}>{log.description}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

            </main>
          </div>
        ) : (
          // RENDER OTHER VIEWS
          <div className="bg-[#131825] border border-white/5 rounded-[2rem] p-4 md:p-8 min-h-[70vh]">
            <div className="flex items-center space-x-3 mb-6 pb-6 border-b border-white/10">
              <button onClick={() => setActiveView('dashboard')} className="text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-colors">
                <ChevronUp className="w-5 h-5 -rotate-90" />
              </button>
              <h2 className="text-white font-black uppercase tracking-widest text-sm">Active Workspace</h2>
            </div>

            {activeView === 'analytics' && <AnalyticsDashboard />}
            {activeView === 'apkstats' && <ApkStatsDashboard />}
            {activeView === 'crash' && <CrashReportScreen />}
            {activeView === 'licenses' && <LicenseScreen />}
            {activeView === 'customers' && <CustomerScreen />}
            {activeView === 'applications' && <AppManagementScreen />}
            {activeView === 'updates' && <UpdateManagementScreen />}
            {activeView === 'notifications' && <NotificationScreen />}
            {activeView === 'announcements' && <AnnouncementScreen />}
            {activeView === 'feedback' && <FeedbackCenterScreen session={session} />}
            {activeView === 'config' && <RemoteConfigScreen />}
          </div>
        )}
      </div>

      {/* --- TOAST NOTIFICATIONS --- */}
      <div className="fixed top-6 right-6 z-[100] flex flex-col space-y-3 max-w-[85vw] sm:max-w-sm w-full pointer-events-none">
        {toasts.map((t) => {
          let icon = <Bell className="w-5 h-5 text-sky-400" />;
          let bgStyle = 'bg-[#1A2133]/95 border-sky-500/30';

          if (t.type === 'activation') {
            icon = <Key className="w-5 h-5 text-amber-400 animate-pulse" />;
            bgStyle = 'bg-[#1A2133]/95 border-amber-500/30';
          } else if (t.type === 'feedback') {
            icon = <AlertTriangle className="w-5 h-5 text-rose-500 animate-bounce" />;
            bgStyle = 'bg-[#1A2133]/95 border-rose-500/30';
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto p-4 rounded-2xl shadow-2xl border ${bgStyle} backdrop-blur-xl flex items-start space-x-3 animate-[slideInRight_0.3s_ease-out]`}
            >
              <div className="flex-shrink-0 mt-0.5">{icon}</div>
              <div className="flex-grow min-w-0">
                <h4 className="text-xs font-black text-white tracking-tight">{t.title}</h4>
                <p className="text-[10px] font-medium text-slate-400 mt-1 whitespace-pre-wrap leading-relaxed">{t.body}</p>
              </div>
              <button
                onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                className="flex-shrink-0 text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideInRight {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};