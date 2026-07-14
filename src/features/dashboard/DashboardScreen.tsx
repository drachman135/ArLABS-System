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
import { CloudflareFileManagerScreen } from '../updates/CloudflareFileManagerScreen';
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
  Activity,
  Copy,
  Check,
  ExternalLink
} from 'lucide-react';

interface DashboardScreenProps {
  session: any;
  profile: { name: string; role: string; email: string } | null;
  onLogout: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ session, profile, onLogout }) => {
  const [activeView, setActiveView] = useState<'dashboard' | 'analytics' | 'apkstats' | 'crash' | 'licenses' | 'customers' | 'applications' | 'updates' | 'notifications' | 'announcements' | 'config' | 'feedback' | 'cloudflare_files'>('dashboard');
  const [connected, setConnected] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>('');

  // App cards dashboard state
  const [apps, setApps] = useState<any[]>([]);
  const [licensesList, setLicensesList] = useState<any[]>([]);
  const [devicesList, setDevicesList] = useState<any[]>([]);
  const [selectedAppForModal, setSelectedAppForModal] = useState<any | null>(null);
  const [isAppModalOpen, setIsAppModalOpen] = useState<boolean>(false);
  const [copiedAppId, setCopiedAppId] = useState<string | null>(null);

  // Exit Dialog State
  const [showExitModal, setShowExitModal] = useState<boolean>(false);

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

  // Refs for tracking activeView and showExitModal inside the event listener to avoid stale closure
  const activeViewRef = useRef(activeView);
  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  const showExitModalRef = useRef(showExitModal);
  useEffect(() => {
    showExitModalRef.current = showExitModal;
  }, [showExitModal]);

  useEffect(() => {
    let listener: any = null;

    const setupBackButton = async () => {
      try {
        const { App } = await import('@capacitor/app');
        listener = await App.addListener('backButton', () => {
          if (showExitModalRef.current) {
            setShowExitModal(false);
          } else if (activeViewRef.current !== 'dashboard') {
            setActiveView('dashboard');
          } else {
            setShowExitModal(true);
          }
        });
      } catch (err) {
        console.warn('Capacitor App plugin not available on this platform.', err);
      }
    };

    setupBackButton();

    return () => {
      if (listener) {
        listener.remove();
      }
    };
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
    const onesignalAppId = import.meta.env.VITE_ONESIGNAL_APP_ID;
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
      const { error: pingError } = await supabase.from('admins').select('id').limit(1);
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

      // Fetch Applications
      const { data: appsData, error: appsError } = await supabase
        .from('applications')
        .select('*')
        .order('app_name', { ascending: true });

      let loadedApps = appsData || [];
      if (appsError || !appsData || appsData.length === 0) {
        loadedApps = [
          { 
            id: 'app-1', 
            app_name: 'ArLABS Android Client', 
            package_name: 'com.arlabs.client', 
            current_version: '1.0.4', 
            min_supported_version: '1.0.0', 
            status: 'ACTIVE', 
            force_update_required: false, 
            download_url: 'https://cdn.arlabs.io/apk/release-v1.0.4.apk',
            release_notes: 'Initial production build deployment with offline caching services and key validations.',
            updated_at: new Date().toISOString() 
          },
          { 
            id: 'app-2', 
            app_name: 'ArLABS POS Companion', 
            package_name: 'com.arlabs.pos', 
            current_version: '2.1.0', 
            min_supported_version: '2.0.0', 
            status: 'MAINTENANCE', 
            force_update_required: true, 
            download_url: 'https://cdn.arlabs.io/apk/release-v2.1.0.apk',
            release_notes: 'Scheduled database indexing and multi-tenant RLS hardening updates.',
            updated_at: new Date(Date.now() - 86400000).toISOString() 
          }
        ];
      }
      setApps(loadedApps);

      // Fetch raw data lists for client-side aggregation
      const { data: licensesData } = await supabase.from('licenses').select('id, application_id, status');
      setLicensesList(licensesData || []);

      const { data: devicesData } = await supabase.from('devices').select('id, license_id');
      setDevicesList(devicesData || []);
    } catch (err: any) {
      setConnected(false);
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
                  <button onClick={() => handleActionClick('cloudflare_files')} className="neu-menu-btn"><Database className="w-4 h-4 mr-4 text-[#10B981]" /> <span>Berkas Cloudflare</span></button>
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
          <div className="space-y-6">
            
            {/* Header / Summary Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-[#2D3748] font-black text-xl tracking-tight uppercase">Dashboard Utama</h2>
                <p className="text-xs text-[#718096] font-bold">Ringkasan status aplikasi dan statistik penggunaan platform</p>
              </div>
              <button 
                onClick={fetchDashboardData} 
                disabled={loading}
                className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-blue-500 bg-[#E6E9EF] neu-flat hover:neu-pressed disabled:opacity-50 transition-all flex items-center space-x-2 self-end sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Segarkan data</span>
              </button>
            </div>

            {/* Quick Summary Cards (Responsive Row) */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-[#E6E9EF] neu-flat flex flex-col justify-center">
                <span className="text-[9px] text-[#718096] font-black tracking-widest uppercase mb-1">Aplikasi</span>
                <span className="text-xl md:text-2xl font-black text-[#2D3748]">{loading ? '...' : apps.length}</span>
              </div>
              <div className="p-4 rounded-2xl bg-[#E6E9EF] neu-flat flex flex-col justify-center">
                <span className="text-[9px] text-[#718096] font-black tracking-widest uppercase mb-1">Lisensi Aktif</span>
                <span className="text-xl md:text-2xl font-black text-blue-500">{loading ? '...' : metrics.activeLicenses}</span>
              </div>
              <div className="p-4 rounded-2xl bg-[#E6E9EF] neu-flat flex flex-col justify-center">
                <span className="text-[9px] text-[#718096] font-black tracking-widest uppercase mb-1">Perangkat</span>
                <span className="text-xl md:text-2xl font-black text-emerald-500">{loading ? '...' : metrics.activeDevices}</span>
              </div>
            </div>

            {/* Applications Grid: Optimized for Mobile & Desktop */}
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-black text-[#4A5568] uppercase tracking-widest">Aplikasi Terdaftar ({apps.length})</span>
                <button 
                  onClick={() => handleActionClick('applications')}
                  className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider text-[#718096] bg-[#E6E9EF] neu-flat hover:neu-pressed transition-all flex items-center space-x-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Tambah Aplikasi</span>
                </button>
              </div>

              {loading && apps.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-[#718096] bg-[#E6E9EF] rounded-[2.5rem] neu-inset h-64 space-y-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                  <span className="text-xs font-black tracking-widest uppercase">Memuat data aplikasi...</span>
                </div>
              ) : apps.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-[#718096] bg-[#E6E9EF] rounded-[2.5rem] neu-inset h-64 space-y-2">
                  <Smartphone className="w-10 h-10 text-[#A0AEC0]" />
                  <span className="text-xs font-black tracking-widest uppercase">Belum ada aplikasi terdaftar</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {apps.map(app => {
                    const appLicenses = licensesList.filter(l => l.application_id === app.id);
                    const totalLics = appLicenses.length;
                    const activeLics = appLicenses.filter(l => l.status === 'ACTIVE').length;
                    
                    const appLicenseIds = new Set(appLicenses.map(l => l.id));
                    const appDevicesCount = devicesList.filter(d => d.license_id && appLicenseIds.has(d.license_id)).length;

                    let statusColor = 'text-[#10B981]';
                    let statusBg = 'bg-[#10B981]/10';
                    if (app.status === 'MAINTENANCE') {
                      statusColor = 'text-[#F59E0B]';
                      statusBg = 'bg-[#F59E0B]/10';
                    } else if (app.status === 'DEPRECATED') {
                      statusColor = 'text-[#F43F5E]';
                      statusBg = 'bg-[#F43F5E]/10';
                    }

                    return (
                      <div 
                        key={app.id}
                        onClick={() => {
                          setSelectedAppForModal(app);
                          setIsAppModalOpen(true);
                        }}
                        className="bg-[#E6E9EF] p-5 rounded-[2rem] neu-flat hover:scale-[0.98] active:scale-[0.96] transition-all cursor-pointer flex flex-col justify-between space-y-4"
                      >
                        <div className="flex justify-between items-start">
                          <div className="w-10 h-10 rounded-xl neu-convex flex items-center justify-center text-[#3B82F6] flex-shrink-0">
                            <Smartphone className="w-5 h-5" />
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${statusBg} ${statusColor} neu-inset`}>
                            {app.status}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <h3 className="text-sm font-black text-[#2D3748] tracking-tight truncate leading-tight">{app.app_name}</h3>
                          <p className="text-[10px] text-[#718096] font-bold mt-1 leading-tight break-all">{app.package_name}</p>
                        </div>

                        <div className="h-[1px] bg-slate-300/50 w-full rounded" />

                        <div className="grid grid-cols-2 gap-3 text-[10px] font-bold text-[#718096]">
                          <div className="flex items-center space-x-1.5 font-bold min-w-0">
                            <Key className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                            <span className="truncate">{activeLics} / {totalLics} Lic</span>
                          </div>
                          <div className="flex items-center space-x-1.5 font-bold min-w-0">
                            <Activity className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                            <span className="truncate">{appDevicesCount} Dev</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-1 text-[9px] text-[#A0AEC0] font-black uppercase">
                          <span className="neu-inset px-2.5 py-1 rounded-lg text-blue-500">v{app.current_version}</span>
                          <span>Updated {app.updated_at ? new Date(app.updated_at).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' }) : 'Baru'}</span>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Navigation Buttons */}
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button 
                onClick={() => handleActionClick('licenses')}
                className="w-full py-4 text-[#8B5CF6] font-black uppercase tracking-wider text-xs rounded-2xl bg-[#E6E9EF] neu-flat hover:neu-pressed flex items-center justify-center space-x-2"
              >
                <Key className="w-4 h-4" />
                <span>Kelola Lisensi</span>
              </button>
              <button 
                onClick={() => handleActionClick('updates')}
                className="w-full py-4 text-[#10B981] font-black uppercase tracking-wider text-xs rounded-2xl bg-[#E6E9EF] neu-flat hover:neu-pressed flex items-center justify-center space-x-2"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Unggah Pembaharuan</span>
              </button>
              <button 
                onClick={() => handleActionClick('feedback')}
                className="w-full py-4 text-[#F43F5E] font-black uppercase tracking-wider text-xs rounded-2xl bg-[#E6E9EF] neu-flat hover:neu-pressed flex items-center justify-center space-x-2"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Crash & Feedback</span>
              </button>
            </div>

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
              {activeView === 'cloudflare_files' && <CloudflareFileManagerScreen />}
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

      {/* --- APPLICATION DETAIL MODAL --- */}
      {isAppModalOpen && selectedAppForModal && (() => {
        const app = selectedAppForModal;
        const appLicenses = licensesList.filter(l => l.application_id === app.id);
        const totalLics = appLicenses.length;
        const activeLics = appLicenses.filter(l => l.status === 'ACTIVE').length;
        const expiredLics = appLicenses.filter(l => l.status === 'EXPIRED' || l.status === 'SUSPENDED').length;
        
        const appLicenseIds = new Set(appLicenses.map(l => l.id));
        const appDevicesCount = devicesList.filter(d => d.license_id && appLicenseIds.has(d.license_id)).length;

        let statusColor = 'text-[#10B981]';
        let statusBg = 'bg-[#10B981]/10';
        if (app.status === 'MAINTENANCE') {
          statusColor = 'text-[#F59E0B]';
          statusBg = 'bg-[#F59E0B]/10';
        } else if (app.status === 'DEPRECATED') {
          statusColor = 'text-[#F43F5E]';
          statusBg = 'bg-[#F43F5E]/10';
        }

        const handleCopyText = (text: string) => {
          navigator.clipboard.writeText(text).then(() => {
            setCopiedAppId(app.id);
            setTimeout(() => setCopiedAppId(null), 2000);
          });
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#E6E9EF]/60 backdrop-blur-md animate-[zoomInSoft_0.25s_ease-out]">
            <div className="w-full max-w-lg bg-[#E6E9EF] p-6 rounded-[2.5rem] neu-flat max-h-[90vh] overflow-y-auto relative flex flex-col space-y-6">
              
              {/* Close Button */}
              <button 
                onClick={() => {
                  setIsAppModalOpen(false);
                  setSelectedAppForModal(null);
                }}
                className="absolute top-6 right-6 w-10 h-10 rounded-full flex items-center justify-center text-[#A0AEC0] hover:text-[#2D3748] bg-[#E6E9EF] neu-flat hover:neu-pressed transition-all"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Title Header */}
              <div className="flex items-center space-x-4 pt-2">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-[#3B82F6] flex items-center justify-center flex-shrink-0 neu-convex">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div className="min-w-0 pr-10">
                  <h3 className="text-base font-black text-[#2D3748] truncate-none flex-wrap leading-tight">{app.app_name}</h3>
                  <div className="flex items-center space-x-1.5 mt-1">
                    <span className="text-[10px] text-[#718096] font-bold break-all select-all">{app.package_name}</span>
                    <button 
                      onClick={() => handleCopyText(app.package_name)}
                      className="text-blue-500 hover:text-blue-600 focus:outline-none"
                      title="Salin Package Name"
                    >
                      {copiedAppId === app.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats Panel */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-[#E6E9EF] neu-inset flex flex-col justify-center">
                  <span className="text-[9px] text-[#718096] font-black uppercase tracking-wider">Status Aplikasi</span>
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest mt-1.5 w-fit ${statusBg} ${statusColor} neu-flat`}>
                    {app.status}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-[#E6E9EF] neu-inset flex flex-col justify-center">
                  <span className="text-[9px] text-[#718096] font-black uppercase tracking-wider">Versi Terpasang</span>
                  <span className="text-xs font-black text-blue-500 mt-1 uppercase tracking-wider">
                    v{app.current_version}
                  </span>
                </div>
              </div>

              {/* License & Device Breakdown */}
              <div className="p-5 rounded-2xl bg-[#E6E9EF] neu-inset space-y-3">
                <h4 className="text-[10px] font-black text-[#4A5568] uppercase tracking-wider">Distribusi & Penggunaan</h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <p className="text-[10px] text-[#A0AEC0] font-bold uppercase">Total Lisensi</p>
                    <p className="font-black text-[#2D3748]">{totalLics} Lisensi</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-[#A0AEC0] font-bold uppercase">Lisensi Aktif</p>
                    <p className="font-black text-[#10B981]">{activeLics} Aktif</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-[#A0AEC0] font-bold uppercase">Perangkat Terhubung</p>
                    <p className="font-black text-emerald-500">{appDevicesCount} Perangkat</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-[#A0AEC0] font-bold uppercase">Lisensi Expired</p>
                    <p className="font-black text-rose-500">{expiredLics} Expired</p>
                  </div>
                </div>
              </div>

              {/* Version Config Notes */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-[#4A5568] uppercase tracking-wider">Catatan Rilis & Informasi Versi</h4>
                <div className="p-4 rounded-2xl bg-[#E6E9EF] neu-inset text-xs font-semibold text-[#718096] leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {app.release_notes || 'Tidak ada catatan rilis untuk versi ini.'}
                </div>
              </div>

              {/* Download URL Section */}
              {app.download_url && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-[#4A5568] uppercase tracking-wider">Tautan Unduhan APK</h4>
                  <div className="flex items-center space-x-2">
                    <div className="flex-grow p-3 rounded-xl bg-[#E6E9EF] neu-inset text-[10px] text-[#718096] truncate pr-4 font-mono select-all">
                      {app.download_url}
                    </div>
                    <a 
                      href={app.download_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-xl bg-[#E6E9EF] neu-flat hover:neu-pressed flex items-center justify-center text-blue-500 flex-shrink-0 transition-all"
                      title="Unduh APK"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              )}

              {/* Settings / Config redirect */}
              <div className="pt-2 flex space-x-3">
                <button
                  onClick={() => {
                    setIsAppModalOpen(false);
                    setSelectedAppForModal(null);
                    handleActionClick('applications');
                  }}
                  className="flex-1 py-3 text-blue-500 font-black uppercase tracking-wider text-xs rounded-xl bg-[#E6E9EF] neu-flat hover:neu-pressed transition-all"
                >
                  Kelola Detail Aplikasi
                </button>
                <button
                  onClick={() => {
                    setIsAppModalOpen(false);
                    setSelectedAppForModal(null);
                  }}
                  className="px-6 py-3 text-[#718096] font-black uppercase tracking-wider text-xs rounded-xl bg-[#E6E9EF] neu-flat hover:neu-pressed transition-all"
                >
                  Tutup
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* --- EXIT CONFIRMATION DIALOG (Glassmorphism) --- */}
      {showExitModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-[zoomInSoft_0.2s_ease-out]">
          <div className="bg-white/95 border border-white/60 shadow-[10px_10px_30px_rgba(0,0,0,0.15)] p-6 max-w-sm w-full rounded-[24px] text-center space-y-6">
            <div className="flex flex-col items-center space-y-2">
              <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center shadow-inner">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <h4 className="text-sm font-black text-[#1E293B] uppercase tracking-wider pt-2">
                Keluar Aplikasi?
              </h4>
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Apakah Anda yakin ingin keluar dari aplikasi ArLABS Admin?
            </p>
            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setShowExitModal(false)}
                className="flex-1 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold text-xs py-3 rounded-xl transition-all duration-300 shadow-sm uppercase"
              >
                [ Batal ]
              </button>
              <button
                onClick={async () => {
                  const { App } = await import('@capacitor/app');
                  await App.exitApp();
                }}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold text-xs py-3 rounded-xl transition-all duration-300 shadow-md uppercase"
              >
                [ Keluar ]
              </button>
            </div>
          </div>
        </div>
      )}

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