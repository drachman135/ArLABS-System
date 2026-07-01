import React, { useEffect, useState } from 'react';
import { supabase } from '../../core/supabase';
import { RefreshCw, Loader2, Cpu, Settings, AlertTriangle, CheckCircle2, Save, Plus, X } from 'lucide-react';

interface Application {
  id: string;
  app_name: string;
  package_name: string;
  current_version: string;
  min_supported_version?: string;
  status: 'ACTIVE' | 'MAINTENANCE' | 'DEPRECATED';
  force_update_required?: boolean;
  download_url?: string;
  release_notes?: string;
  updated_at?: string;
}

export const AppManagementScreen: React.FC = () => {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  
  // Edit state fields
  const [editVersion, setEditVersion] = useState<string>('');
  const [editStatus, setEditStatus] = useState<Application['status']>('ACTIVE');
  
  const [saveLoading, setSaveLoading] = useState<boolean>(false);

  // Add App state fields
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newAppName, setNewAppName] = useState<string>('');
  const [newPackageName, setNewPackageName] = useState<string>('');
  const [newVersion, setNewVersion] = useState<string>('');
  const [newStatus, setNewStatus] = useState<Application['status']>('ACTIVE');
  const [createLoading, setCreateLoading] = useState<boolean>(false);

  // Fetch applications list
  const fetchApps = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .order('app_name', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setApps(data);
      } else {
        setApps([]);
      }
    } catch (err) {
      console.warn('Applications table fetch failed. Utilizing default sandbox baseline values.', err);
      // Fallback mockup apps
      setApps([
        { 
          id: 'app-1', 
          app_name: 'ArLABS Android Client', 
          package_name: 'com.arlabs.client', 
          current_version: '1.0.4', 
          min_supported_version: '1.0.0', 
          status: 'ACTIVE', 
          force_update_required: false, 
          download_url: 'https://dpthhttwmtgtbrsjtfcg.supabase.co/storage/v1/object/public/apks/arlabs-client-v1.0.4.apk',
          release_notes: 'Initial production build deployment with offline caching services.',
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
          download_url: 'https://dpthhttwmtgtbrsjtfcg.supabase.co/storage/v1/object/public/apks/arlabs-pos-v2.1.0.apk',
          release_notes: 'Scheduled database indexing and multi-tenant RLS hardening updates.',
          updated_at: new Date(Date.now() - 86400000).toISOString() 
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  // Setup edit form fields when selection changes
  const handleSelectApp = (app: Application) => {
    setSelectedApp(app);
    setEditVersion(app.current_version);
    setEditStatus(app.status);
  };

  // Submit edits
  const handleSaveAppUpdates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    setSaveLoading(true);

    try {
      // Update app rows directly in Supabase
      const { error } = await supabase
        .from('applications')
        .update({
          current_version: editVersion,
          status: editStatus
        })
        .eq('id', selectedApp.id);

      if (error) throw error;

      // Update state locally
      setApps(prev => prev.map(a => a.id === selectedApp.id ? {
        ...a,
        current_version: editVersion,
        status: editStatus
      } : a));

      // Reload selections
      setSelectedApp(prev => prev ? {
        ...prev,
        current_version: editVersion,
        status: editStatus
      } : null);

    } catch (err) {
      console.error('Failed to update application records. Local state toggle applied.', err);
      // Offline fallback state update
      setApps(prev => prev.map(a => a.id === selectedApp.id ? {
        ...a,
        current_version: editVersion,
        status: editStatus
      } : a));
    } finally {
      setSaveLoading(false);
    }
  };

  // Submit new application
  const handleCreateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppName || !newPackageName || !newVersion) return;
    setCreateLoading(true);

    const newAppPayload = {
      app_name: newAppName,
      package_name: newPackageName,
      current_version: newVersion,
      status: newStatus
    };

    try {
      const { data, error } = await supabase
        .from('applications')
        .insert([newAppPayload])
        .select();

      if (error) throw error;

      let createdApp: Application;
      if (data && data.length > 0) {
        createdApp = data[0];
      } else {
        // Fallback (highly unlikely with select())
        createdApp = {
          id: 'app-' + Math.random().toString(36).substr(2, 9),
          ...newAppPayload
        };
      }

      setApps(prev => [...prev, createdApp]);
      handleSelectApp(createdApp);

      // Reset form fields and hide modal
      setNewAppName('');
      setNewPackageName('');
      setNewVersion('');
      setNewStatus('ACTIVE');
      setShowAddModal(false);
    } catch (err: any) {
      console.error('Failed to register new application:', err);
      alert(`Gagal mendaftarkan aplikasi: ${err?.message || 'Unknown network error'}`);
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 font-['Outfit'] select-none">
      
      {/* 1. Frosted Glass Action Header Panel */}
      <section className="bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] hover:shadow-[10px_10px_20px_#d1d5db,-10px_-10px_20px_#ffffff] transition-all duration-300 p-6 rounded-[24px] flex justify-between items-center">
        <div>
          <span className="tracking-widest text-[9px] font-bold text-[#64748B] uppercase">Release Control</span>
          <h3 className="text-base font-black text-[#1E293B] tracking-tight mt-1">SYS // APPLICATION_WORKSPACE</h3>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="border border-transparent bg-[#0EA5E9] hover:bg-[#0EA5E9]/95 text-white px-4 py-2.5 rounded-xl transition-all duration-300 shadow-[2px_2px_5px_rgba(14,165,233,0.3)] flex items-center space-x-2 text-xs font-bold active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Aplikasi</span>
          </button>

          <button
            onClick={fetchApps}
            className="border border-white bg-white hover:border-[#0EA5E9]/50 hover:bg-[#0EA5E9]/10 text-[#1E293B] hover:text-[#0EA5E9] p-2.5 rounded-xl transition-all duration-300 shadow-sm flex items-center justify-center"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* 2. Asymmetric Workspace Layout (Grid Card view + Form Detail view) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: App List Cards (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center space-x-2 text-[#64748B]">
            <Cpu className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Daftar Aplikasi APK</span>
          </div>

          {loading ? (
            <div className="bg-white/80 border border-white/60 p-12 rounded-[24px] text-center text-[#64748B] shadow-sm flex items-center justify-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#0EA5E9]" />
              <span>Querying application profiles...</span>
            </div>
          ) : apps.length === 0 ? (
            <div className="bg-white/80 border border-white/60 p-12 rounded-[24px] text-center text-[#64748B] shadow-sm uppercase font-bold text-xs tracking-wider">
              NO_ACTIVE_RECORDS_FOUND
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {apps.map((app) => {
                const isActive = app.status === 'ACTIVE';
                const isMaintenance = app.status === 'MAINTENANCE';
                let badgeStyle = 'bg-gray-100 text-gray-500 border border-gray-200';

                if (isActive) badgeStyle = 'bg-green-50 text-green-600 border border-green-100';
                if (isMaintenance) badgeStyle = 'bg-yellow-50 text-yellow-600 border border-yellow-200';

                return (
                  <div
                    key={app.id}
                    onClick={() => handleSelectApp(app)}
                    className={`cursor-pointer bg-white/80 border transition-all duration-300 p-5 rounded-[20px] flex flex-col justify-between space-y-4 hover:-translate-y-1 ${
                      selectedApp?.id === app.id
                        ? 'border-[#0EA5E9] shadow-[6px_6px_12px_rgba(14,165,233,0.15)] ring-1 ring-[#0EA5E9]'
                        : 'border-white/60 shadow-[4px_4px_8px_#d1d5db,-4px_-4px_8px_#ffffff] hover:shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff]'
                    }`}
                  >
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-[#1E293B]">{app.app_name}</h4>
                      <p className="text-[10px] font-mono text-[#64748B] truncate">{app.package_name}</p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <div>
                        <span className="text-[9px] text-[#64748B] block font-bold uppercase">Version</span>
                        <span className="text-xs font-mono text-[#1E293B] font-bold">v{app.current_version}</span>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-bold tracking-wide uppercase ${badgeStyle}`}>
                        {app.status === 'ACTIVE' ? 'ACTIVE' : app.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Detail & Config Form Panel (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="flex items-center space-x-2 text-[#64748B]">
            <Settings className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Detail Aplikasi & Versi</span>
          </div>

          {selectedApp ? (
            <form onSubmit={handleSaveAppUpdates} className="bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] p-6 rounded-[24px] space-y-6">
              
              {/* App Summary */}
              <div className="border-b border-gray-100 pb-4">
                <h4 className="text-sm font-black text-[#1E293B]">{selectedApp.app_name}</h4>
                <p className="text-[10px] font-mono text-[#64748B]">{selectedApp.package_name}</p>
              </div>

              {/* Status Switch Option (Remote Kill-Switch) */}
              <div className="space-y-3">
                <label className="block text-[9px] text-[#64748B] uppercase font-bold tracking-widest">
                  Deployment Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['ACTIVE', 'MAINTENANCE', 'DEPRECATED'] as const).map((stat) => (
                    <button
                      key={stat}
                      type="button"
                      onClick={() => setEditStatus(stat)}
                      className={`py-2 px-1 text-[9px] font-bold rounded-lg border transition-all duration-300 tracking-tight text-center uppercase ${
                        editStatus === stat
                          ? 'bg-[#0EA5E9] text-white border-transparent shadow-sm'
                          : 'bg-white border-gray-200 text-[#64748B] hover:text-[#1E293B] hover:bg-gray-50'
                      }`}
                    >
                      {stat === 'ACTIVE' ? 'Active' : stat}
                    </button>
                  ))}
                </div>
                {editStatus === 'MAINTENANCE' && (
                  <div className="flex items-start space-x-2 bg-yellow-50 border border-yellow-200 p-2.5 rounded-lg text-[9px] text-yellow-700">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>Warning: Setting this status will activate the remote kill-switch overlay on client boots.</span>
                  </div>
                )}
              </div>

              {/* Version Inputs */}
              <div className="space-y-2">
                <label className="block text-[9px] text-[#64748B] uppercase font-bold tracking-wider">
                  Current Version
                </label>
                <input
                  type="text"
                  required
                  value={editVersion}
                  onChange={(e) => setEditVersion(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] font-mono shadow-sm"
                />
              </div>

              {/* Save changes triggers */}
              <button
                type="submit"
                disabled={saveLoading}
                className="w-full bg-[#0EA5E9] hover:bg-[#0ea5e9]/95 text-white font-bold text-xs py-3 rounded-xl transition-all duration-300 shadow-[2px_2px_5px_rgba(14,165,233,0.3)] flex items-center justify-center space-x-2 active:scale-98"
              >
                {saveLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Apply Updates</span>
                  </>
                )}
              </button>

            </form>
          ) : (
            <div className="bg-white/80 border border-white/60 p-12 rounded-[24px] text-center text-[#64748B] shadow-sm text-xs font-semibold">
              <CheckCircle2 className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <span>Select an application card to adjust versions and statuses.</span>
            </div>
          )}
        </div>

      </div>

      {/* 3. Frosted Glass Registration Modal for Adding New Apps */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white/95 backdrop-blur-md border border-white/60 shadow-[10px_10px_25px_rgba(0,0,0,0.1)] p-6 rounded-[28px] max-w-md w-full space-y-6">
            <div className="flex justify-between items-center border-b border-gray-100 pb-4">
              <div>
                <span className="tracking-widest text-[9px] font-bold text-[#64748B] uppercase">Registration</span>
                <h3 className="text-base font-black text-[#1E293B] tracking-tight">Tambah Aplikasi Baru</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateApp} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[9px] text-[#64748B] uppercase font-bold tracking-wider">Nama Aplikasi</label>
                <input
                  type="text"
                  required
                  placeholder="ArLABS New Client"
                  value={newAppName}
                  onChange={(e) => setNewAppName(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[9px] text-[#64748B] uppercase font-bold tracking-wider">Package Name</label>
                <input
                  type="text"
                  required
                  placeholder="com.arlabs.newclient"
                  value={newPackageName}
                  onChange={(e) => setNewPackageName(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] font-mono shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[9px] text-[#64748B] uppercase font-bold tracking-wider">Versi Awal</label>
                <input
                  type="text"
                  required
                  placeholder="1.0.0"
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] font-mono shadow-sm"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-[9px] text-[#64748B] uppercase font-bold tracking-widest">
                  Status Deploy
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['ACTIVE', 'MAINTENANCE', 'DEPRECATED'] as const).map((stat) => (
                    <button
                      key={stat}
                      type="button"
                      onClick={() => setNewStatus(stat)}
                      className={`py-2 px-1 text-[9px] font-bold rounded-lg border transition-all duration-300 tracking-tight text-center uppercase ${
                        newStatus === stat
                          ? 'bg-[#0EA5E9] text-white border-transparent shadow-sm'
                          : 'bg-white border-gray-200 text-[#64748B] hover:text-[#1E293B] hover:bg-gray-50'
                      }`}
                    >
                      {stat === 'ACTIVE' ? 'Active' : stat}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={createLoading}
                className="w-full bg-[#0EA5E9] hover:bg-[#0ea5e9]/95 text-white font-bold text-xs py-3 rounded-xl transition-all duration-300 shadow-[2px_2px_5px_rgba(14,165,233,0.3)] flex items-center justify-center space-x-2 active:scale-95 mt-4"
              >
                {createLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Daftarkan Aplikasi</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
