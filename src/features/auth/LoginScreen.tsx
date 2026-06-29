import React, { useState } from 'react';
import { supabase } from '../../core/supabase';
import { Mail, Lock, Eye, EyeOff, ShieldAlert, ArrowRight, Loader2 } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (session: any) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Authenticate via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error('Authentication failed. No user object returned.');
      }

      // 2. Query public.admins table (with fallback to public.users table from Phase 1)
      let profileData: { role: string; status: string } | null = null;

      const { data: adminData, error: adminError } = await supabase
        .from('admins')
        .select('role, status')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (!adminError && adminData) {
        profileData = {
          role: adminData.role,
          status: adminData.status,
        };
      } else {
        // Fallback to Phase 1 public.users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role, status')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (userError) {
          throw new Error(`Profile lookup failed: ${userError.message}`);
        }

        if (userData) {
          profileData = {
            role: userData.role,
            status: userData.status,
          };
        }
      }

      if (!profileData) {
        // Log out immediately to prevent dangling auth sessions for unauthorized users
        await supabase.auth.signOut();
        throw new Error('Access Denied: Admin profile not found in public database.');
      }

      const status = String(profileData.status).toUpperCase();
      const role = String(profileData.role).toLowerCase();

      // Verify profile is Active
      if (status !== 'ACTIVE') {
        await supabase.auth.signOut();
        throw new Error('Access Denied: Your admin profile is currently INACTIVE or Suspended.');
      }

      // Verify user has admin capabilities
      if (role !== 'admin' && role !== 'super_admin' && role !== 'owner') {
        await supabase.auth.signOut();
        throw new Error('Access Denied: You do not possess administrator rights.');
      }

      // 3. Callback on successful authentication
      onLoginSuccess(authData.session);

    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred during login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-m3-grid select-none font-['Outfit'] overflow-hidden relative">
      
      {/* Decorative premium gradients (Glassmorphism bg elements) */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-accent/10 blur-[120px] pointer-events-none" />

      {/* Main card viewport */}
      <div className="w-full max-w-[420px] bg-surface border border-muted p-8 rounded-m3-lg shadow-2xl relative z-10 transition-all duration-300 hover:border-primary/20">
        
        {/* Header Branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-m3-lg bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 mb-4 transform hover:rotate-6 transition-transform duration-300">
            <span className="text-background font-bold text-2xl tracking-wider">Ar</span>
          </div>
          <h1 className="text-2xl font-bold text-textPrimary tracking-tight">ArLABS System</h1>
          <p className="text-sm text-textSecondary mt-1">SaaS Administrator Console</p>
        </div>

        {/* Dynamic Alerts */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-m3-sm bg-error/10 border border-error/20 flex items-start space-x-3 text-error animate-shake">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span className="text-xs font-medium leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          {/* Email field */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider pl-1">
              Admin Email
            </label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-textSecondary group-focus-within:text-accent transition-colors duration-200" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@arlabs.com"
                className="w-full pl-12 pr-4 py-3.5 bg-background border border-muted rounded-m3-md text-textPrimary text-sm placeholder:text-textSecondary/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all duration-200"
              />
            </div>
          </div>

          {/* Password field */}
          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider">
                Password
              </label>
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-textSecondary group-focus-within:text-accent transition-colors duration-200" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-12 pr-12 py-3.5 bg-background border border-muted rounded-m3-md text-textPrimary text-sm placeholder:text-textSecondary/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-textSecondary hover:text-textPrimary transition-colors duration-200"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Action button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-background font-semibold py-4 rounded-m3-md flex items-center justify-center space-x-2 transition-all duration-300 transform active:scale-[0.98] shadow-lg shadow-accent/15 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Authenticating Console...</span>
              </>
            ) : (
              <>
                <span>Sign In To Workspace</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-textSecondary/40">
          <p>© 2026 ArLABS. Secure Console Sandbox.</p>
        </div>
      </div>
    </div>
  );
};
