import React, { useEffect, useState, useRef } from 'react';
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
  Smartphone,
  Activity
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

  // Action Sheet Animation States
  const [openDropdown, setOpenDropdown] = useState<'stats' | 'reports' | 'registry' | 'distribution' | 'broadcast' | null>(null);
  const [isAnimatingOut, setIsAnimatingOut] = useState<boolean>(false);
  const openDropdownRef = useRef(openDropdown);

  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);

  useEffect(() => {
    openDropdownRef.current = openDropdown;
  }, [openDropdown]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dock-container') && !target.closest('.neu-dropdown-panel')) {
        if (openDropdownRef.current) {
          setIsAnimatingOut(true);
          setTimeout(() => {
            setOpenDropdown(null);
            setIsAnimatingOut(false);
          }, 250);
        }
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleDockNavigation = (tabName: 'dashboard' | 'stats' | 'reports' | 'registry' | 'distribution' | 'broadcast') => {
    if (tabName === 'dashboard') {
      if (openDropdown) {
        setIsAnimatingOut(true);
        setTimeout(() => {
          setOpenDropdown(null);
          setIsAnimatingOut(false);
          setActiveView('dashboard');
        }, 250);
      } else {
        setActiveView('dashboard');
      }
      return;
    }

    if (openDropdown === tabName) {
      setIsAnimatingOut(true);
      setTimeout(() => {
        setOpenDropdown(null);
        setIsAnimatingOut(false);
      }, 250);
    } else if (openDropdown !== null) {
      setIsAnimatingOut(true);
      setTimeout(() => {
        setOpenDropdown(tabName as any);
        setIsAnimatingOut(false);
      }, 250);
    } else {
      setOpenDropdown(tabName as any);
    }
  };

  const handleActionClick = (viewName: any) => {
    setIsAnimatingOut(true);
    setTimeout(() => {
      setActiveView(viewName);
      setOpenDropdown(null);
      setIsAnimatingOut(false);
    }, 250);
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
      setCurrentTime(date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));
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

  // Soft, pleasant notification sound for light theme
  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine'; // Soft, rounded tone
      oscillator.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);

      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.4);
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
    }, 5000);
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

      const { count: activeLicCount } = await supabase.from('licenses').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE');
      const { count: activeDevCount } = await supabase.from('devices').select('*', { count: 'exact', head: true });
      const { count: expiredLicCount } = await supabase.from('licenses').select('*', { count: 'exact', head: true }).in('status', ['EXPIRED', 'SUSPENDED']);

      setMetrics({
        activeDevices: activeDevCount || 0,
        activeLicenses: activeLicCount || 0,
        expiredLicenses: expiredLicCount || 0
      });

      const { data: logData, error: logError } = await supabase.from('logs').select('id, action, description, severity, created_at').order('created_at', { ascending: false }).limit(6);
      if (!logError && logData && logData.length > 0) {
        setLogs(logData.map(l => ({
          id: l.id, action: l.action, description: l.description, severity: l.severity as 'info' | 'warning' | 'critical',
          created_at: new Date(l.created_at).toLocaleTimeString('en-US', { hour12: false })
        })));
      } else {
        setLogs([
          { id: '1', action: 'SYS_SYNC', description: `System verified in ${Math.round(end - start)}ms`, severity: 'info', created_at: new Date().toLocaleTimeString('en-US', { hour12: false }) },
          { id: '2', action: 'AUTH_OK', description: `Welcome back, ${profile?.name || 'Administrator'}`, severity: 'info', created_at: new Date(Date.now() - 3000).toLocaleTimeString('en-US', { hour12: false }) }
        ]);
      }
    } catch (err: any) {
      setConnected(false);
      setLogs([{ id: 'err-1', action: 'OFFLINE', description: 'Failed to sync with database.', severity: 'critical', created_at: new Date().toLocaleTimeString('en-US', { hour12: false }) }]);
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
    // Base Soft Background (#E6E9EF) - The canvas for Neumorphism
    <div className="min-h-screen bg-[#E6E9EF] text-[#4A5568] font-sans font-medium select-none pb-32 lg:pb-12 lg:pl-[120px] overflow-x-hidden relative">

      {/* --- SOFT TACTILE HEADER --- */}
      <header className="sticky top-0 z-40 bg-[#E6E9EF]/80 backdrop-blur-xl px-4 md:px-8 py-4 flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center neu-convex text-[#3B82F6] font-black text-xl">
            Ar
          </div>
          <div className="hidden sm:block">
            <h1 className="text-[#2D3748] font-black tracking-tight text-lg">ArLABS Panel</h1>
            <p className="text-[11px] text-[#718096] font-bold tracking-wider uppercase">Workspace // {currentTime}</p>
          </div>
        </div>

        <div className="flex items-center space-x-5">
          {/* Inset Connectivity Status */}
          <div className="flex items-center space-x-2 neu-inset px-4 py-2 rounded-full">
            <Wifi className={`w-4 h-4 ${connected ? 'text-emerald-500' : 'text-rose-500'}`} />
            <span className="hidden sm:inline font-bold text-[10px] uppercase tracking-widest text-[#718096]">
              {connected ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          <button
            onClick={() => setIsMobileDrawerOpen(true)}
            className="flex items-center justify-center w-12 h-12 rounded-full neu-flat hover:neu-pressed text-[#4A5568] hover:text-[#3B82F6] transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* --- NEUMORPHIC BOTTOM NAV DOCK --- */}
      <nav className="dock-container fixed bottom-6 left-6 right-6 lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:left-6 lg:right-auto lg:w-[80px] lg:h-auto bg-[#E6E9EF] rounded-[2rem] p-3 lg:py-6 flex flex-row lg:flex-col justify-between lg:justify-start lg:space-y-6 items-center z-50 neu-flat">
        {[
          { id: 'dashboard', icon: LayoutDashboard, views: ['dashboard'], color: 'text-[#3B82F6]' },
          { id: 'registry', icon: Key, views: ['licenses', 'customers'], color: 'text-[#8B5CF6]' },
          { id: 'distribution', icon: Box, views: ['applications', 'updates'], color: 'text-[#10B981]' },
          { id: 'broadcast', icon: Radio, views: ['notifications', 'announcements', 'config'], color: 'text-[#F59E0B]' },
          { id: 'reports', icon: Terminal, views: ['analytics', 'apkstats', 'crash', 'feedback'], color: 'text-[#F43F5E]' }
        ].map((item) => {
          const Icon = item.icon;
          const isActive = item.views.includes(activeView) || openDropdown === item.id;

          return (
            <button
              key={item.id}
              onClick={(e) => {
                e.stopPropagation();
                handleDockNavigation(item.id as any);
              }}
              className={`relative p-4 rounded-2xl transition-all duration-300 flex-1 lg:flex-none flex justify-center mx-1 lg:mx-0
                ${isActive ? 'neu-pressed ' + item.color : 'neu-flat hover:neu-pressed text-[#A0AEC0] hover:text-[#4A5568]'}`}
            >
              <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-90' : 'hover:scale-95'}`} />
            </button>
          )
        })}
      </nav>

      {/* --- NEUMORPHIC ACTION SHEETS (Dropdowns) --- */}
      {openDropdown && (
        <div className="fixed inset-0 z-40 bg-[#E6E9EF]/40 backdrop-blur-sm lg:pl-32 lg:flex lg:items-center">
          <div
            className={`neu-dropdown-panel absolute bottom-28 left-6 right-6 lg:relative lg:bottom-auto lg:left-auto lg:right-auto lg:w-80 bg-[#E6E9EF] p-6 rounded-[2rem] neu-flat 
            ${isAnimatingOut ? 'animate-[slideDownSoft_0.25s_ease-in_forwards]' : 'animate-[slideUpSoft_0.25s_ease-out_forwards]'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6 pb-2">
              <span className="text-xs font-black text-[#718096] uppercase tracking-widest flex items-center">
                <Activity className="w-4 h-4 mr-2 text-[#3B82F6]" /> SELECT MODULE
              </span>
              <button
                onClick={() => {
                  setIsAnimatingOut(true);
                  setTimeout(() => { setOpenDropdown(null); setIsAnimatingOut(false); }, 250);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center neu-flat hover:neu-pressed text-[#A0AEC0] hover:text-[#F43F5E]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {openDropdown === 'registry' && (
                <>
                  <button onClick={() => handleActionClick('licenses')} className="neu-menu-btn"><Key className="w-4 h-4 mr-4 text-[#8B5CF6]" /> <span>Kelola lisensi</span></button>
                  <button onClick={() => handleActionClick('customers')} className="neu-menu-btn"><Menu className="w-4 h-4 mr-4 text-[#8B5CF6]" /> <span>Klien</span></button>
                </>
              )}
              {openDropdown === 'distribution' && (
                <>
                  <button onClick={() => handleActionClick('applications')} className="neu-menu-btn"><Smartphone className="w-4 h-4 mr-4 text-[#10B981]" /> <span>Aplikasi</span></button>
                  <button onClick={() => handleActionClick('updates')} className="neu-menu-btn"><UploadCloud className="w-4 h-4 mr-4 text-[#10B981]" /> <span>Pembaharuan</span></button>
                </>
              )}
              {openDropdown === 'broadcast' && (
                <>
                  <button onClick={() => handleActionClick('notifications')} className="neu-menu-btn"><Bell className="w-4 h-4 mr-4 text-[#F59E0B]" /> <span>Notifikasi mengambang</span></button>
                  <button onClick={() => handleActionClick('announcements')} className="neu-menu-btn"><MessageSquare className="w-4 h-4 mr-4 text-[#F59E0B]" /> <span>Notifikasi diaplikasi</span></button>
                  <button onClick={() => handleActionClick('config')} className="neu-menu-btn"><RefreshCw className="w-4 h-4 mr-4 text-[#F59E0B]" /> <span>Konfigurasi jarak jauh (SOON)</span></button>
                </>
              )}
              {openDropdown === 'reports' && (
                <>
                  <button onClick={() => handleActionClick('analytics')} className="neu-menu-btn"><LayoutDashboard className="w-4 h-4 mr-4 text-[#F43F5E]" /> <span>System Analytics</span></button>
                  <button onClick={() => handleActionClick('apkstats')} className="neu-menu-btn"><Database className="w-4 h-4 mr-4 text-[#F43F5E]" /> <span>Download Stats</span></button>
                  <button onClick={() => handleActionClick('crash')} className="neu-menu-btn"><AlertTriangle className="w-4 h-4 mr-4 text-[#F43F5E]" /> <span>Crash Reports</span></button>
                  <button onClick={() => handleActionClick('feedback')} className="neu-menu-btn"><MessageSquare className="w-4 h-4 mr-4 text-[#F43F5E]" /> <span>User Feedback</span></button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- PROFILE & SETTINGS DRAWER --- */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 bg-[#E6E9EF]/60 backdrop-blur-md z-50 flex justify-center items-center p-4" onClick={() => setIsMobileDrawerOpen(false)}>
          <div
            className="w-full max-w-sm bg-[#E6E9EF] p-8 rounded-[2.5rem] neu-flat animate-[zoomInSoft_0.25s_ease-out]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-8">
              <span className="text-xs font-black text-[#4A5568] uppercase tracking-widest">Operator Card</span>
              <button onClick={() => setIsMobileDrawerOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center neu-flat hover:neu-pressed text-[#A0AEC0] hover:text-[#2D3748]"><X className="w-4 h-4" /></button>
            </div>

            <div className="neu-inset p-6 rounded-3xl mb-8 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full neu-convex flex items-center justify-center font-black text-[#3B82F6] text-3xl mb-4">
                {profile?.name?.charAt(0) || 'A'}
              </div>
              <h4 className="text-[#2D3748] font-black text-xl mb-1">{profile?.name || 'Administrator'}</h4>
              <p className="text-xs text-[#718096] font-bold mb-4">{profile?.email || 'admin@system.com'}</p>
              <span className="text-[10px] font-black uppercase bg-[#E6E9EF] text-[#8B5CF6] px-4 py-1.5 rounded-full neu-flat">
                Role: {profile?.role || 'Owner'}
              </span>
            </div>

            <button
              onClick={() => { onLogout(); setIsMobileDrawerOpen(false); }}
              className="w-full flex items-center justify-center p-4 text-[#F43F5E] font-black uppercase tracking-widest rounded-2xl neu-flat hover:neu-pressed transition-all"
            >
              <LogOut className="w-5 h-5 mr-3" /> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* --- MAIN DASHBOARD WORKSPACE --- */}
      <div className="px-4 md:px-6 lg:px-8 max-w-[1400px] mx-auto relative z-10">
        {activeView === 'dashboard' ? (
          <div className="space-y-8">

            {/* 1. SOFT QUICK ACTIONS */}
            <div className="grid grid-cols-3 gap-4 md:gap-8">
              {[
                { label: 'Lisensi baru', icon: Plus, view: 'licenses', color: 'text-[#8B5CF6]' },
                { label: 'Laporan', icon: AlertTriangle, view: 'feedback', color: 'text-[#F43F5E]' },
                { label: 'Pembaharuan', icon: UploadCloud, view: 'updates', color: 'text-[#10B981]' }
              ].map((btn, idx) => (
                <button
                  key={idx}
                  onClick={() => handleActionClick(btn.view)}
                  className={`bg-[#E6E9EF] rounded-[2rem] p-5 flex flex-col items-center justify-center space-y-4 transition-all neu-flat hover:neu-pressed group`}
                >
                  <div className={`w-12 h-12 flex items-center justify-center rounded-full neu-convex group-hover:scale-95 transition-transform ${btn.color}`}>
                    <btn.icon className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] md:text-xs font-black text-[#718096] group-hover:text-[#4A5568] uppercase tracking-widest text-center">
                    {btn.label}
                  </span>
                </button>
              ))}
            </div>

            <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">

              {/* BLOCK 1: Smooth Area Chart */}
              <section className="col-span-1 lg:col-span-8 bg-[#E6E9EF] p-6 md:p-8 rounded-[2.5rem] neu-flat flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-lg font-black text-[#2D3748] tracking-tight">Onboarding Trends</h3>
                    <span className="tracking-widest text-[10px] font-bold text-[#A0AEC0] uppercase">7-Day Rolling Activations</span>
                  </div>
                  <button
                    onClick={fetchDashboardData}
                    disabled={loading}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-[#3B82F6] neu-flat hover:neu-pressed disabled:opacity-50 transition-all"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="w-full h-64 neu-inset rounded-[2rem] p-4 relative flex items-end justify-center overflow-hidden">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center space-y-3 text-[#718096] h-full">
                      <RefreshCw className="w-6 h-6 animate-spin text-[#3B82F6]" />
                      <span className="text-xs font-bold tracking-widest uppercase">Syncing...</span>
                    </div>
                  ) : (
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 500 130" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      {/* Soft Grid Lines */}
                      <line x1="0" y1="32" x2="500" y2="32" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="4,4" />
                      <line x1="0" y1="65" x2="500" y2="65" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="4,4" />
                      <line x1="0" y1="98" x2="500" y2="98" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="4,4" />

                      {/* Smooth Area */}
                      <path d="M 0 130 L 0 95 C 40 95 60 75 83 75 C 120 75 140 85 166 85 C 200 85 220 45 249 45 C 280 45 300 65 332 65 C 370 65 390 25 415 25 C 450 25 470 30 500 30 L 500 130 Z" fill="url(#blueGradient)" />

                      {/* Smooth Line */}
                      <path d="M 0 95 C 40 95 60 75 83 75 C 120 75 140 85 166 85 C 200 85 220 45 249 45 C 280 45 300 65 332 65 C 370 65 390 25 415 25 C 450 25 470 30 500 30" fill="none" stroke="#3B82F6" strokeWidth="3" strokeLinecap="round" />

                      {/* Touchable Dots */}
                      {[{ x: 83, y: 75 }, { x: 166, y: 85 }, { x: 249, y: 45 }, { x: 332, y: 65 }, { x: 415, y: 25 }].map((pt, i) => (
                        <circle key={i} cx={pt.x} cy={pt.y} r="5" fill="#E6E9EF" stroke="#3B82F6" strokeWidth="3" className="shadow-lg" />
                      ))}
                    </svg>
                  )}
                  {!loading && (
                    <div className="absolute inset-0 flex justify-between px-6 pt-6 pointer-events-none">
                      {activationHistory.map((h, i) => (
                        <div key={i} className="flex flex-col justify-between h-full items-center text-[10px] text-[#A0AEC0] font-black">
                          <span className="text-[#3B82F6] opacity-0">{h.count}</span>
                          <span className="mt-auto pt-2">{h.day}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* BLOCK 2: Physical Counter Metrics */}
              <section className="col-span-1 lg:col-span-4 flex flex-col justify-between space-y-6">

                {/* Metric 1 */}
                <div className="bg-[#E6E9EF] p-6 rounded-[2rem] neu-flat flex flex-col justify-center relative overflow-hidden flex-1">
                  <div className="absolute right-4 top-4 w-10 h-10 rounded-full neu-inset flex items-center justify-center">
                    <Key className="w-4 h-4 text-[#8B5CF6]" />
                  </div>
                  <span className="text-[10px] text-[#718096] font-black tracking-widest uppercase mb-2">Active Licenses</span>
                  <div className="neu-inset p-3 rounded-2xl inline-flex self-start">
                    <span className="text-3xl md:text-4xl font-black text-[#2D3748] tracking-tight">{loading ? '--' : metrics.activeLicenses}</span>
                  </div>
                </div>

                {/* Metric 2 & 3 in a row or stacked */}
                <div className="flex gap-6 flex-1">
                  <div className="bg-[#E6E9EF] p-5 rounded-[2rem] neu-flat flex-1 flex flex-col justify-between">
                    <span className="text-[9px] text-[#718096] font-black tracking-widest uppercase">Devices</span>
                    <span className="text-2xl font-black text-[#10B981]">{loading ? '-' : metrics.activeDevices}</span>
                  </div>

                  <div className="bg-[#E6E9EF] p-5 rounded-[2rem] neu-flat flex-1 flex flex-col justify-between relative overflow-hidden">
                    <span className="text-[9px] text-[#718096] font-black tracking-widest uppercase">Expired</span>
                    <span className="text-2xl font-black text-[#F43F5E]">{loading ? '-' : metrics.expiredLicenses}</span>
                  </div>
                </div>

              </section>

              {/* BLOCK 3: Carved Screen Log Output */}
              <section className="col-span-1 lg:col-span-12 bg-[#E6E9EF] p-6 md:p-8 rounded-[2.5rem] neu-flat">
                <div className="flex justify-between items-center mb-6 px-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full neu-inset flex items-center justify-center">
                      <Terminal className="w-4 h-4 text-[#718096]" />
                    </div>
                    <h3 className="text-xs font-black text-[#4A5568] tracking-widest uppercase">System Logs</h3>
                  </div>
                  <span className="text-[9px] bg-[#E6E9EF] text-[#10B981] px-3 py-1 rounded-full font-black uppercase tracking-widest neu-convex">
                    Healthy
                  </span>
                </div>

                <div className="neu-inset rounded-[2rem] p-4 md:p-6 text-[11px] space-y-3 font-mono">
                  {logs.map((log) => {
                    let badgeColor = 'text-[#10B981]';
                    let bgBadge = 'bg-[#10B981]/10';
                    if (log.severity === 'warning') { badgeColor = 'text-[#F59E0B]'; bgBadge = 'bg-[#F59E0B]/10'; }
                    if (log.severity === 'critical') { badgeColor = 'text-[#F43F5E] font-black'; bgBadge = 'bg-[#F43F5E]/10'; }

                    return (
                      <div key={log.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-2 rounded-xl hover:bg-[#E6E9EF] transition-colors">
                        <span className="text-[#A0AEC0] font-bold flex-shrink-0">[{log.created_at}]</span>
                        <div className="flex-grow flex flex-col sm:flex-row sm:items-center sm:space-x-3">
                          <span className={`px-2 py-1 rounded-md text-[9px] uppercase tracking-wider ${badgeColor} ${bgBadge}`}>
                            {log.action}
                          </span>
                          <span className="text-[#4A5568] font-semibold">{log.description}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

            </main>
          </div>
        ) : (
          // RENDER OTHER VIEWS (Workspace Wrapper with Neumorphic Override)
          <div className="bg-[#E6E9EF] p-4 md:p-8 rounded-[2.5rem] neu-flat min-h-[70vh] animate-[zoomInSoft_0.3s_ease-out]">
            <div className="flex items-center space-x-4 mb-8">
              <button onClick={() => handleDockNavigation('dashboard')} className="w-10 h-10 rounded-full flex items-center justify-center text-[#718096] neu-flat hover:neu-pressed transition-all">
                <ChevronUp className="w-5 h-5 -rotate-90" />
              </button>
              <div>
                <h2 className="text-[#2D3748] font-black uppercase tracking-widest text-lg">Active Workspace</h2>
                <span className="text-[10px] text-[#A0AEC0] font-bold tracking-widest uppercase">Module // {activeView}</span>
              </div>
            </div>

            {/* Sub-components rendered inside Neumorphic filter rules */}
            <div className="neu-content-wrapper rounded-3xl overflow-hidden p-1">
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
          </div>
        )}
      </div>

      {/* --- NEUMORPHIC TOAST NOTIFICATIONS (Pills) --- */}
      <div className="fixed top-20 lg:top-6 right-4 lg:right-6 z-[100] flex flex-col space-y-4 max-w-[85vw] sm:max-w-sm w-full pointer-events-none">
        {toasts.map((t) => {
          let icon = <Bell className="w-5 h-5 text-[#3B82F6]" />;
          let accent = 'text-[#3B82F6]';

          if (t.type === 'activation') {
            icon = <Key className="w-5 h-5 text-[#10B981]" />;
            accent = 'text-[#10B981]';
          } else if (t.type === 'feedback') {
            icon = <AlertTriangle className="w-5 h-5 text-[#F43F5E]" />;
            accent = 'text-[#F43F5E]';
          }

          return (
            <div
              key={t.id}
              className="pointer-events-auto p-4 bg-[#E6E9EF] rounded-[2rem] neu-flat flex items-start space-x-4 animate-[slideInRightSoft_0.3s_ease-out]"
            >
              <div className={`w-10 h-10 rounded-full neu-convex flex items-center justify-center flex-shrink-0 ${accent}`}>
                {icon}
              </div>
              <div className="flex-grow min-w-0 pt-1">
                <h4 className={`text-sm font-black uppercase tracking-wider ${accent}`}>{t.title}</h4>
                <p className="text-[11px] text-[#718096] font-bold mt-1 whitespace-pre-wrap leading-relaxed">{t.body}</p>
              </div>
              <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="w-8 h-8 rounded-full neu-flat hover:neu-pressed flex items-center justify-center text-[#A0AEC0]">
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* --- CSS INJECTIONS FOR NEUMORPHISM 2.0 SHADOWS & OVERRIDES --- */}
      <style>{`
        /* Core Soft Tactile Utility Classes */
        .neu-flat {
          box-shadow: 8px 8px 16px #D1D5DB, -8px -8px 16px #FFFFFF;
          background-color: #E6E9EF;
        }
        .neu-pressed {
          box-shadow: inset 6px 6px 12px #D1D5DB, inset -6px -6px 12px #FFFFFF;
          background-color: #E6E9EF;
        }
        .neu-convex {
          background: linear-gradient(145deg, #F0F3F8, #CDD1D8);
          box-shadow: 8px 8px 16px #D1D5DB, -8px -8px 16px #FFFFFF;
        }
        .neu-inset {
          box-shadow: inset 8px 8px 16px #D1D5DB, inset -8px -8px 16px #FFFFFF;
          background-color: #E6E9EF;
        }

        /* Menu Button Soft */
        .neu-menu-btn {
          width: 100%;
          display: flex;
          align-items: center;
          padding: 16px 20px;
          border-radius: 16px;
          color: #4A5568;
          font-weight: 800;
          font-size: 12px;
          letter-spacing: 0.05em;
          transition: all 0.2s;
          margin-bottom: 8px;
        }
        .neu-menu-btn:hover {
          box-shadow: inset 4px 4px 8px #D1D5DB, inset -4px -4px 8px #FFFFFF;
          color: #2D3748;
        }

        /* Animations */
        @keyframes slideUpSoft {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideDownSoft {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(20px); opacity: 0; }
        }
        @keyframes zoomInSoft {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes slideInRightSoft {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        /* ========================================================================= */
        /* GLOBAL CSS OVERRIDE: FORCE NEUMORPHISM ON CHILD COMPONENTS                */
        /* Menyesuaikan file lain agar menyatu dengan tema Soft Tactile              */
        /* ========================================================================= */
        
        .neu-content-wrapper > div {
           max-width: 100%;
           overflow-x: auto;
        }

        /* 1. Override basic background to flat clay */
        .neu-content-wrapper div[class*="bg-white"],
        .neu-content-wrapper div[class*="bg-slate-"],
        .neu-content-wrapper div[class*="bg-gray-"],
        .neu-content-wrapper div[class*="bg-[#"] {
          background-color: #E6E9EF !important;
          box-shadow: 6px 6px 12px #D1D5DB, -6px -6px 12px #FFFFFF !important;
          border: none !important;
          border-radius: 24px !important;
          margin-bottom: 16px;
        }

        /* 2. Text standardization for readability */
        .neu-content-wrapper [class*="text-white"],
        .neu-content-wrapper [class*="text-gray-2"],
        .neu-content-wrapper [class*="text-gray-3"] {
          color: #4A5568 !important;
        }
        .neu-content-wrapper h1, 
        .neu-content-wrapper h2, 
        .neu-content-wrapper h3 {
          color: #2D3748 !important;
          font-weight: 900 !important;
        }

        /* 3. Inputs, Textareas, and Selects become inset physical fields */
        .neu-content-wrapper input,
        .neu-content-wrapper select,
        .neu-content-wrapper textarea {
          background-color: #E6E9EF !important;
          box-shadow: inset 4px 4px 8px #D1D5DB, inset -4px -4px 8px #FFFFFF !important;
          border: none !important;
          color: #2D3748 !important;
          border-radius: 12px !important;
          padding: 12px 16px !important;
          outline: none !important;
        }
        
        .neu-content-wrapper input::placeholder,
        .neu-content-wrapper textarea::placeholder {
          color: #A0AEC0 !important;
          font-weight: bold;
        }

        /* 4. Buttons become convex or pressed */
        .neu-content-wrapper button[class*="bg-blue"],
        .neu-content-wrapper button[class*="bg-[#0EA5E9]"] {
          background: linear-gradient(145deg, #F0F3F8, #CDD1D8) !important;
          box-shadow: 6px 6px 12px #D1D5DB, -6px -6px 12px #FFFFFF !important;
          color: #3B82F6 !important;
          border: none !important;
          border-radius: 12px !important;
          font-weight: 900 !important;
        }
        .neu-content-wrapper button:active {
          box-shadow: inset 4px 4px 8px #D1D5DB, inset -4px -4px 8px #FFFFFF !important;
        }
      `}</style>
    </div>
  );
};