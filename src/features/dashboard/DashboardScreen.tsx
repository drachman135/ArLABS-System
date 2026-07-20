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
import { ProductManagementScreen } from '../products/ProductManagementScreen';
import { AddSkuModal } from '../products/AddSkuModal';
import { MayarIntegrationScreen } from '../mayar/MayarIntegrationScreen';
import { HelpCenterScreen } from '../help-center/HelpCenterScreen';
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
  UploadCloud,
  MessageSquare,
  LogOut,
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Clock,
  BookOpen,
  User,
  Package,
  Plus,
  CreditCard,
  HelpCircle
} from 'lucide-react';

interface DashboardScreenProps {
  session: any;
  profile: { name: string; role: string; email: string } | null;
  onLogout: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ session, profile, onLogout }) => {
  const [activeView, setActiveView] = useState<'dashboard' | 'analytics' | 'apkstats' | 'crash' | 'licenses' | 'customers' | 'applications' | 'updates' | 'notifications' | 'announcements' | 'config' | 'feedback' | 'cloudflare_files' | 'products' | 'mayar' | 'help_center'>('dashboard');
  const [connected, setConnected] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeView]);

  // App cards dashboard state
  const [apps, setApps] = useState<any[]>([]);
  const [licensesList, setLicensesList] = useState<any[]>([]);
  const [devicesList, setDevicesList] = useState<any[]>([]);
  const [selectedAppForModal, setSelectedAppForModal] = useState<any | null>(null);
  const [isAppModalOpen, setIsAppModalOpen] = useState<boolean>(false);
  const [copiedAppId, setCopiedAppId] = useState<string | null>(null);

  // Exit Dialog State
  const [showExitModal, setShowExitModal] = useState<boolean>(false);

  // Sidebar States (collapsible/hoverable/pinned)
  const [isSidebarPinned, setIsSidebarPinned] = useState<boolean>(true);
  const [isSidebarHovered, setIsSidebarHovered] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Extra dashboard metrics & logs
  const [updatesCount, setUpdatesCount] = useState<number>(0);
  const [feedbackCount, setFeedbackCount] = useState<number>(0);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);

  // Global Add SKU Modal State
  const [isSkuModalOpen, setIsSkuModalOpen] = useState(false);
  const [productRefreshKey, setProductRefreshKey] = useState(0);



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

  const handleActionClick = (viewName: any) => {
    setActiveView(viewName);
    setIsMobileSidebarOpen(false);
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
      const { data: appsData } = await supabase
        .from('applications')
        .select('*')
        .order('app_name', { ascending: true });

      const loadedApps = appsData || [];
      
      // Fetch raw data lists for client-side aggregation
      const { data: licensesData } = await supabase
        .from('licenses')
        .select('id, application_id, status, created_at, updated_at, activated_at, last_validation, renewed_at');
      const loadedLicenses = licensesData || [];
      setLicensesList(loadedLicenses);

      const { data: devicesData } = await supabase.from('devices').select('id, license_id, created_at, last_online');
      const loadedDevices = devicesData || [];
      setDevicesList(loadedDevices);

      // Dynamically sort apps based on last activity time
      const sortedApps = [...loadedApps].map(app => {
        let lastActiveTime = app.updated_at ? new Date(app.updated_at).getTime() : 0;

        // Check associated licenses for any later timestamps
        const appLicenses = loadedLicenses.filter(l => l.application_id === app.id);
        appLicenses.forEach(l => {
          const times = [
            l.created_at ? new Date(l.created_at).getTime() : 0,
            l.updated_at ? new Date(l.updated_at).getTime() : 0,
            l.activated_at ? new Date(l.activated_at).getTime() : 0,
            l.last_validation ? new Date(l.last_validation).getTime() : 0,
            l.renewed_at ? new Date(l.renewed_at).getTime() : 0,
          ];
          const maxLicTime = Math.max(...times);
          if (maxLicTime > lastActiveTime) {
            lastActiveTime = maxLicTime;
          }

          // Check devices connected to this license
          const licenseDevices = loadedDevices.filter(d => d.license_id === l.id);
          licenseDevices.forEach(d => {
            const devTimes = [
              d.created_at ? new Date(d.created_at).getTime() : 0,
              d.last_online ? new Date(d.last_online).getTime() : 0
            ];
            const maxDevTime = Math.max(...devTimes);
            if (maxDevTime > lastActiveTime) {
              lastActiveTime = maxDevTime;
            }
          });
        });

        return { ...app, lastActiveTime };
      }).sort((a, b) => b.lastActiveTime - a.lastActiveTime);

      setApps(sortedApps);

      // Fetch additional dashboard summary info matching Rumahweb redesign
      try {
        const { count: upCount } = await supabase
          .from('application_versions')
          .select('*', { count: 'exact', head: true });
        setUpdatesCount(upCount || 0);
      } catch (e) {
        console.warn("Failed fetching versions count: ", e);
      }

      try {
        const { count: feedCount } = await supabase
          .from('feedback_reports')
          .select('*', { count: 'exact', head: true });
        setFeedbackCount(feedCount || 0);
      } catch (e) {
        console.warn("Failed fetching feedback count: ", e);
      }

      try {
        const { data: logsData } = await supabase
          .from('logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);

        setActivityLogs(logsData || []);
      } catch (e) {
        console.warn("Failed fetching logs: ", e);
        setActivityLogs([]);
      }
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
    // Base light blue-gray background (#F4F7FC) mimicking Rumahweb Clientzone
    <div className={`min-h-screen bg-[#F4F7FC] text-[#2C3E50] font-sans font-medium select-none overflow-x-hidden relative transition-all duration-300 ease-in-out ${isSidebarPinned ? 'lg:pl-[260px]' : 'lg:pl-[80px]'}`}>

      {/* --- RESPONSIVE SIDEBAR BACKDROP (Mobile only) --- */}
      {isMobileSidebarOpen && (
        <div 
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden animate-[fadeInSoft_0.2s_ease-out]"
        />
      )}

      {/* --- COLLAPSIBLE & HOVERABLE SIDEBAR --- */}
      <aside
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200/80 flex flex-col justify-between transition-all duration-300 ease-in-out shadow-sm select-none
          ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
          lg:translate-x-0 lg:h-screen lg:fixed lg:top-0 lg:left-0 
          ${(isSidebarPinned || isSidebarHovered) ? 'lg:w-[260px]' : 'lg:w-[80px]'}`}
      >
        {/* Top logo & branding bar */}
        <div className="h-16 border-b border-gray-200/60 flex items-center justify-between px-4 w-full flex-shrink-0">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm flex-shrink-0">
              Ar
            </div>
            {(isSidebarPinned || isSidebarHovered) && (
              <span className="font-extrabold text-[#2C3E50] text-sm tracking-tight whitespace-nowrap">
                ArLABS Panel
              </span>
            )}
          </div>
          
          {/* Collapse toggle (Desktop only) */}
          <button 
            onClick={() => setIsSidebarPinned(!isSidebarPinned)}
            className="hidden lg:flex w-8 h-8 rounded-lg items-center justify-center text-gray-400 hover:text-[#2C3E50] hover:bg-gray-100 transition-colors border-none bg-transparent cursor-pointer"
          >
            {isSidebarPinned ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* Scrollable menu structure */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-4 w-full">
          {[
            {
              title: 'Main Menu',
              items: [
                { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, views: ['dashboard'], badge: null }
              ]
            },
            {
              title: 'Registry',
              items: [
                { id: 'licenses', label: 'Kelola Lisensi', icon: Key, views: ['licenses'], badge: metrics.activeLicenses },
                { id: 'customers', label: 'Klien', icon: User, views: ['customers'], badge: null },
                { id: 'products', label: 'Daftar Produk / SKU', icon: Package, views: ['products'], badge: null }
              ]
            },
            {
              title: 'Distribution',
              items: [
                { id: 'applications', label: 'Aplikasi', icon: Smartphone, views: ['applications'], badge: apps.length },
                { id: 'updates', label: 'Pembaharuan', icon: UploadCloud, views: ['updates'], badge: updatesCount },
                { id: 'cloudflare_files', label: 'Berkas Cloudflare', icon: Database, views: ['cloudflare_files'], badge: null }
              ]
            },
            {
              title: 'Broadcast',
              items: [
                { id: 'notifications', label: 'Notifikasi Mengambang', icon: Bell, views: ['notifications'], badge: null },
                { id: 'announcements', label: 'Notifikasi Diaplikasi', icon: MessageSquare, views: ['announcements'], badge: null },
                { id: 'config', label: 'Konfigurasi Jarak Jauh', icon: RefreshCw, views: ['config'], badge: null },
                { id: 'help_center', label: 'Manajemen Pusat Bantuan', icon: HelpCircle, views: ['help_center'], badge: null }
              ]
            },
            {
              title: 'Payment Gateway',
              items: [
                { id: 'mayar', label: 'Integrasi Mayar', icon: CreditCard, views: ['mayar'], badge: null }
              ]
            },
            {
              title: 'Reports',
              items: [
                { id: 'analytics', label: 'System Analytics', icon: LayoutDashboard, views: ['analytics'], badge: null },
                { id: 'apkstats', label: 'Download Stats', icon: Database, views: ['apkstats'], badge: null },
                { id: 'crash', label: 'Crash Reports', icon: AlertTriangle, views: ['crash'], badge: null },
                { id: 'feedback', label: 'User Feedback', icon: MessageSquare, views: ['feedback'], badge: feedbackCount }
              ]
            }
          ].map((section, idx) => {
            const isExpanded = isSidebarPinned || isSidebarHovered;
            
            return (
              <div key={idx} className="space-y-1">
                {isExpanded && (
                  <span className="block px-3 text-[9px] font-black uppercase text-gray-400 tracking-wider">
                    {section.title}
                  </span>
                )}
                
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.views.includes(activeView);
                    
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleActionClick(item.id as any)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all duration-200 border-none cursor-pointer text-left bg-transparent
                          ${isActive 
                            ? 'bg-blue-50 text-blue-600 font-extrabold shadow-sm' 
                            : 'text-gray-600 hover:bg-gray-50 hover:text-[#2C3E50] font-semibold'}`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                          {isExpanded && (
                            <span className="text-xs truncate">{item.label}</span>
                          )}
                        </div>
                        {isExpanded && item.badge !== null && item.badge > 0 && (
                          <span className="bg-blue-100 text-blue-700 text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer (Profile / Sign Out) */}
        <div className="p-3 border-t border-gray-200/60 w-full flex-shrink-0">
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center lg:justify-start space-x-3 p-2.5 rounded-xl text-red-500 hover:bg-red-50 transition-colors border-none bg-transparent cursor-pointer font-bold"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {(isSidebarPinned || isSidebarHovered) && (
              <span className="text-xs">Sign Out</span>
            )}
          </button>
        </div>
      </aside>

      {/* --- TOP GREETING HEADER --- */}
      <header className={`fixed top-0 left-0 right-0 z-30 bg-[#F4F7FC]/85 backdrop-blur-md px-6 py-4 flex justify-between items-center border-b border-gray-200/50 transition-all duration-300 ease-in-out ${isSidebarPinned ? 'lg:left-[260px]' : 'lg:left-[80px]'}`}>
        <div className="flex items-center space-x-3">
          {/* Mobile hamburger menu trigger */}
          <button 
            onClick={() => setIsMobileSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:text-blue-600 shadow-sm flex items-center justify-center cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="bg-[#10B981] text-white text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-lg shadow-sm">
            {activeView === 'dashboard' ? 'Dashboard' : activeView.toUpperCase()}
          </div>

          <span className="hidden md:inline-block text-[10px] text-gray-400 font-bold uppercase tracking-wider">
            Workspace // {currentTime}
          </span>
        </div>

        <div className="flex items-center space-x-3 sm:space-x-4 text-xs font-bold">
          {/* Add SKU Global Button */}
          <button
            onClick={() => setIsSkuModalOpen(true)}
            className="flex items-center space-x-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 border-none cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-white" />
            <span>+ SKU</span>
          </button>

          {/* Connectivity Status */}
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-500 text-[10px] font-black uppercase tracking-wider">
            <Wifi className={`w-3.5 h-3.5 ${connected ? 'text-emerald-500' : 'text-rose-500'}`} />
            <span className="hidden sm:inline">{connected ? 'ONLINE' : 'OFFLINE'}</span>
          </div>



          {/* User Profile Info greeting */}
          <div className="flex items-center space-x-2.5">
            <span className="hidden sm:inline text-gray-500 font-semibold">Hi, <strong className="text-gray-800">{profile?.name || 'Administrator'}</strong></span>
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-black flex items-center justify-center uppercase text-xs border border-white shadow-sm animate-[pulse_3s_infinite]">
              {profile?.name?.charAt(0) || 'A'}
            </div>
          </div>
        </div>
      </header>

      {/* --- MAIN DASHBOARD WORKSPACE --- */}
      <div className="max-w-[1400px] mx-auto relative z-10 w-full pt-[88px] px-4 md:px-0">
        {activeView === 'dashboard' ? (
          <div className="px-6 space-y-6 pb-12 animate-[zoomInSoft_0.2s_ease-out]">
            


            {/* Row 2: The 4 Grid Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              
              {/* Card 1: Aplikasi Terdaftar */}
              <div 
                onClick={() => handleActionClick('applications')}
                className="bg-[#E8F2FF] border border-[#BFDBFE] p-5 rounded-[20px] shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex flex-col items-center justify-center aspect-[1/1.05] sm:aspect-auto sm:h-36"
              >
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-3xl font-black text-[#1E40AF]">{loading ? '...' : apps.length}</span>
                  <Smartphone className="w-5 h-5 text-[#1E40AF] flex-shrink-0" />
                </div>
                <span className="block text-[10px] md:text-xs font-black text-[#1E40AF]/80 uppercase tracking-wider mt-3 text-center">
                  Aplikasi Terdaftar
                </span>
              </div>

              {/* Card 2: Lisensi Aktif */}
              <div 
                onClick={() => handleActionClick('licenses')}
                className="bg-[#E6F9F5] border border-[#99F6E4] p-5 rounded-[20px] shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex flex-col items-center justify-center aspect-[1/1.05] sm:aspect-auto sm:h-36"
              >
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-3xl font-black text-[#0F766E]">{loading ? '...' : metrics.activeLicenses}</span>
                  <Key className="w-5 h-5 text-[#0F766E] flex-shrink-0" />
                </div>
                <span className="block text-[10px] md:text-xs font-black text-[#0F766E]/80 uppercase tracking-wider mt-3 text-center">
                  Lisensi Aktif
                </span>
              </div>

              {/* Card 3: Update Control */}
              <div 
                onClick={() => handleActionClick('updates')}
                className="bg-[#FFFBEB] border border-[#FDE68A] p-5 rounded-[20px] shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex flex-col items-center justify-center aspect-[1/1.05] sm:aspect-auto sm:h-36"
              >
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-3xl font-black text-[#B45309]">{loading ? '...' : updatesCount}</span>
                  <UploadCloud className="w-5 h-5 text-[#B45309] flex-shrink-0" />
                </div>
                <span className="block text-[10px] md:text-xs font-black text-[#B45309]/80 uppercase tracking-wider mt-3 text-center">
                  Update Control
                </span>
              </div>

              {/* Card 4: User Feedback */}
              <div 
                onClick={() => handleActionClick('feedback')}
                className="bg-[#FFF1F2] border border-[#FECDD3] p-5 rounded-[20px] shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex flex-col items-center justify-center aspect-[1/1.05] sm:aspect-auto sm:h-36"
              >
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-3xl font-black text-[#BE123C]">{loading ? '...' : feedbackCount}</span>
                  <MessageSquare className="w-5 h-5 text-[#BE123C] flex-shrink-0" />
                </div>
                <span className="block text-[10px] md:text-xs font-black text-[#BE123C]/80 uppercase tracking-wider mt-3 text-center">
                  User Feedback
                </span>
              </div>

            </div>

            {/* Row 3: Activity Logs (Left) & Developer Guides (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Activity Logs (Left Container) */}
              <div className="lg:col-span-8 bg-white border border-gray-200/60 rounded-[24px] p-6 shadow-sm flex flex-col justify-between min-h-[350px]">
                <div className="w-full">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4">
                    <div>
                      <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Log Aktifitas Client dan Admin</h3>
                      <p className="text-[10px] text-gray-400 font-bold">5 aktivitas platform terbaru secara riil</p>
                    </div>
                    <button 
                      onClick={fetchDashboardData}
                      disabled={loading}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all border-none bg-transparent cursor-pointer flex items-center justify-center"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-left text-xs min-w-[500px]">
                      <thead>
                        <tr className="text-gray-400 font-bold uppercase text-[9px] tracking-wider border-b border-gray-150 pb-2">
                          <th className="py-2.5">Waktu</th>
                          <th className="py-2.5">Aksi</th>
                          <th className="py-2.5">Deskripsi</th>
                          <th className="py-2.5 text-right">Severity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 text-gray-600 font-medium">
                        {activityLogs.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-gray-400 font-bold uppercase tracking-wider">
                              Tidak Ada Log Aktifitas
                            </td>
                          </tr>
                        ) : (
                          activityLogs.map((log) => {
                            let badgeColor = 'bg-blue-50 text-blue-600';
                            if (log.severity === 'warning') badgeColor = 'bg-amber-50 text-amber-600';
                            if (log.severity === 'critical') badgeColor = 'bg-rose-50 text-rose-600';

                            const formattedTime = new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

                            return (
                              <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="py-3 flex items-center space-x-1.5">
                                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                                  <span className="font-semibold text-gray-700">{formattedTime}</span>
                                </td>
                                <td className="py-3">
                                  <span className="font-mono text-[10px] font-bold text-gray-800">{log.action}</span>
                                </td>
                                <td className="py-3">
                                  <span className="font-semibold text-gray-600 line-clamp-1">{log.description}</span>
                                </td>
                                <td className="py-3 text-right">
                                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${badgeColor}`}>
                                    {log.severity}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex justify-end">
                  <button 
                    onClick={() => handleActionClick('analytics')}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer border-none"
                  >
                    Seluruh Log Sistem
                  </button>
                </div>
              </div>

              {/* Developer Guides Panel (Right Container) */}
              <div className="lg:col-span-4 bg-white border border-gray-200/60 rounded-[24px] p-6 shadow-sm flex flex-col space-y-4">
                <div className="border-b border-gray-100 pb-3 flex items-center space-x-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">Panduan Developer & Admin</h3>
                </div>
                <div className="space-y-3.5 text-xs flex-1 overflow-y-auto">
                  {[
                    { title: "Cara Mendaftarkan Lisensi Klien Baru", desc: "Panduan cepat meregistrasikan pembeli lisensi baru dan mengirim WhatsApp template." },
                    { title: "Menghubungkan Aplikasi dengan ArLABS SDK", desc: "Integrasi client library untuk verifikasi serial key lisensi." },
                    { title: "Konfigurasi R2 & Cloudflare", desc: "Langkah-langkah setup bucket penyimpanan untuk update APK secara aman." },
                    { title: "Integrasi Push Firebase/OneSignal", desc: "Pengiriman notifikasi floating ke device klien Android." }
                  ].map((guide, idx) => (
                    <div key={idx} className="group cursor-pointer hover:bg-gray-50 p-2.5 rounded-xl transition-all flex flex-col space-y-1">
                      <h4 className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors leading-tight">
                        {guide.title}
                      </h4>
                      <p className="text-[10px] text-gray-450 font-semibold leading-relaxed">
                        {guide.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        ) : (
          // RENDER OTHER VIEWS inside clean container
          <div 
            className="bg-white p-4 sm:p-6 rounded-[24px] border border-gray-200/60 shadow-sm min-h-[75vh] animate-[zoomInSoft_0.3s_ease-out] mx-auto mb-12 w-full overflow-hidden"
            style={{ maxWidth: 'calc(100vw - 32px)' }}
          >
            <div className="flex items-center space-x-4 mb-8">
              <button 
                onClick={() => handleActionClick('dashboard')} 
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:text-blue-600 hover:bg-gray-100 transition-all border border-gray-200 bg-white cursor-pointer animate-[pulse_1.5s_infinite]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-gray-800 font-black text-sm tracking-tight uppercase">Active Module</h2>
                <span className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">{activeView}</span>
              </div>
            </div>

            <div className="rounded-2xl overflow-hidden p-1 neu-content-wrapper">
              {activeView === 'analytics' && <AnalyticsDashboard />}
              {activeView === 'apkstats' && <ApkStatsDashboard />}
              {activeView === 'crash' && <CrashReportScreen />}
              {activeView === 'licenses' && <LicenseScreen />}
              {activeView === 'customers' && <CustomerScreen />}
              {activeView === 'applications' && <AppManagementScreen />}
              {activeView === 'updates' && <UpdateManagementScreen />}
              {activeView === 'notifications' && <NotificationScreen />}
              {activeView === 'announcements' && <AnnouncementScreen />}
              {activeView === 'feedback' && <FeedbackCenterScreen session={session} profile={profile} />}
              {activeView === 'config' && <RemoteConfigScreen />}
              {activeView === 'help_center' && <HelpCenterScreen />}
              {activeView === 'cloudflare_files' && <CloudflareFileManagerScreen />}
              {activeView === 'products' && (
                <ProductManagementScreen 
                  session={session} 
                  onOpenSkuModal={() => setIsSkuModalOpen(true)}
                  productRefreshKey={productRefreshKey}
                />
              )}
              {activeView === 'mayar' && <MayarIntegrationScreen />}
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

      {/* Global Add SKU Modal */}
      <AddSkuModal 
        isOpen={isSkuModalOpen} 
        onClose={() => setIsSkuModalOpen(false)} 
        onSaveSuccess={() => setProductRefreshKey(prev => prev + 1)}
        session={session}
      />

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
      `}</style>
    </div>
  );
};