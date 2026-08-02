import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { supabase } from './core/supabase';
import { LoginScreen } from './features/auth/LoginScreen';
import { DashboardScreen } from './features/dashboard/DashboardScreen';
import { useNetworkStatus, initNetworkListener, NETWORK_CHANGE_EVENT } from './core/networkStatus';
import { processSyncQueue, SYNC_COMPLETE_EVENT, SYNC_START_EVENT } from './core/devNotesSyncEngine';
import { getSyncQueueCount } from './core/offlineStorage';
import './index.css';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ name: string; role: string; email: string } | null>(null);

  // Network & Sync state
  const { isOffline } = useNetworkStatus();
  const [syncToast, setSyncToast] = useState<{ type: 'syncing' | 'done' | 'none'; count?: number } | null>(null);
  const syncToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize network listener + OneSignal
  useEffect(() => {
    // Init Capacitor Network listener
    initNetworkListener();

    // Listen for sync events to show toast
    const handleSyncStart = () => {
      if (syncToastTimerRef.current) clearTimeout(syncToastTimerRef.current);
      setSyncToast({ type: 'syncing' });
    };

    const handleSyncComplete = (e: Event) => {
      const { successCount } = (e as CustomEvent<{ successCount: number; errorCount: number }>).detail;
      if (successCount > 0) {
        setSyncToast({ type: 'done', count: successCount });
        syncToastTimerRef.current = setTimeout(() => setSyncToast(null), 4000);
      } else {
        setSyncToast(null);
      }
    };

    window.addEventListener(SYNC_COMPLETE_EVENT, handleSyncComplete);
    window.addEventListener(SYNC_START_EVENT, handleSyncStart);

    // Saat kembali online, proses antrian sinkronisasi
    const handleNetworkChange = async (e: Event) => {
      const { status } = (e as CustomEvent<{ status: string }>).detail;
      if (status === 'online') {
        const queueCount = await getSyncQueueCount();
        if (queueCount > 0) {
          console.log(`[App] Back online, processing ${queueCount} queued sync item(s)...`);
          await processSyncQueue();
          // Trigger refresh data di seluruh app
          window.dispatchEvent(new Event('db-refresh'));
        }
      }
    };

    window.addEventListener(NETWORK_CHANGE_EVENT, handleNetworkChange);

    // OneSignal init
    let attempts = 0;
    const maxAttempts = 20;
    const tryInitOneSignal = () => {
      const win = window as any;
      if (win.plugins?.OneSignal) {
        try {
          const OneSignal = win.plugins.OneSignal;
          OneSignal.initialize("156b25a9-4052-4faa-a38f-d39b7cfc27bd");
          OneSignal.Notifications.requestPermission(true).then((success: boolean) => {
            console.log("OneSignal push notification permission response:", success);
          });
          return true;
        } catch (err) {
          console.error("Failed to initialize OneSignal SDK:", err);
          return false;
        }
      }
      return false;
    };
    const intervalId = setInterval(() => {
      attempts++;
      if (tryInitOneSignal() || attempts >= maxAttempts) clearInterval(intervalId);
    }, 500);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener(SYNC_COMPLETE_EVENT, handleSyncComplete);
      window.removeEventListener(SYNC_START_EVENT, handleSyncStart);
      window.removeEventListener(NETWORK_CHANGE_EVENT, handleNetworkChange);
      if (syncToastTimerRef.current) clearTimeout(syncToastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen to changes in authorization status
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      if (currentSession) {
        fetchProfile(currentSession.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      // Check admin profile from admins table
      const { data: adminData } = await supabase
        .from('admins')
        .select('name, role, email')
        .eq('id', userId)
        .maybeSingle();

      if (adminData) {
        setProfile({
          name: adminData.name || 'Administrator',
          role: adminData.role || 'admin',
          email: adminData.email || '',
        });
      } else {
        // Fallback to public.users table from Phase 1
        const { data: userData } = await supabase
          .from('users')
          .select('name, role, email')
          .eq('id', userId)
          .maybeSingle();

        if (userData) {
          setProfile({
            name: userData.name || 'User Profile',
            role: userData.role || 'staff',
            email: userData.email || '',
          });
        } else {
          setProfile({
            name: 'SysAdmin',
            role: 'super_admin',
            email: 'admin@system.com',
          });
        }
      }
    } catch {
      // Set mock profile if tables are not fully populated in sandbox
      setProfile({
        name: 'Administrator',
        role: 'super_admin',
        email: 'admin@system.com',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-textSecondary text-sm font-medium mt-4">Initializing Security Sandbox...</p>
      </div>
    );
  }

  // Render LoginScreen if not authenticated
  if (!session) {
    return <LoginScreen onLoginSuccess={(activeSession) => setSession(activeSession)} />;
  }

  // Render DashboardScreen if authenticated
  return (
    <div className="relative">
      {/* ── OFFLINE BANNER ── */}
      {isOffline && (
        <div
          className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2.5 px-4 py-2.5"
          style={{
            background: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
            boxShadow: '0 2px 12px rgba(245,158,11,0.45)',
            animation: 'slideDownBanner 0.3s ease-out',
          }}
        >
          <span style={{ fontSize: '14px' }}>📡</span>
          <span className="text-white font-black text-xs uppercase tracking-widest">
            Mode Offline — Data lokal ditampilkan. Perubahan Dev Notes akan tersinkron saat online.
          </span>
        </div>
      )}

      {/* ── SYNC TOAST ── */}
      {syncToast && syncToast.type !== 'none' && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-2xl"
          style={{
            background: syncToast.type === 'done'
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
              : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            animation: 'fadeInUp 0.3s ease-out',
          }}
        >
          {syncToast.type === 'syncing' ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <span className="text-white font-bold text-xs">Menyinkronkan data offline...</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: '14px' }}>✅</span>
              <span className="text-white font-bold text-xs">
                {syncToast.count} catatan berhasil disinkronkan ke server!
              </span>
            </>
          )}
        </div>
      )}

      <DashboardScreen 
        session={session} 
        profile={profile} 
        onLogout={handleLogout}
        isOffline={isOffline}
      />
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ── Register Service Worker for PWA install support ─────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[ArLABS PWA] Service Worker registered, scope:', registration.scope);

        // Check for SW updates silently
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[ArLABS PWA] New version available, will update on next reload.');
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn('[ArLABS PWA] Service Worker registration failed:', err);
      });
  });
}
