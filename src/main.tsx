import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { supabase } from './core/supabase';
import { LoginScreen } from './features/auth/LoginScreen';
import { DashboardScreen } from './features/dashboard/DashboardScreen';
import './index.css';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ name: string; role: string; email: string } | null>(null);

  // Initialize and check current auth session
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
    <DashboardScreen 
      session={session} 
      profile={profile} 
      onLogout={handleLogout} 
    />
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
