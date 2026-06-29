import React, { useEffect, useState } from 'react';
import { supabase } from '../../core/supabase';
import { 
  RefreshCw, 
  Loader2, 
  Settings, 
  Sliders, 
  AlertOctagon, 
  Save
} from 'lucide-react';

interface RemoteConfig {
  key: string;
  value: string;
  description: string;
  updated_at?: string;
}

const DEFAULT_CONFIGS: RemoteConfig[] = [
  { key: 'maintenance_mode', value: 'false', description: 'Enable/disable global application maintenance mode lockout.' },
  { key: 'feature_laundry', value: 'true', description: 'Toggle the visibility and access of the laundry services module.' },
  { key: 'feature_rental', value: 'true', description: 'Toggle the visibility and access of the item rentals module.' },
  { key: 'app_timeout_seconds', value: '30', description: 'App background timeout constant in seconds before session lock.' }
];

export const RemoteConfigScreen: React.FC = () => {
  const [configs, setConfigs] = useState<RemoteConfig[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // States for input constants (app_timeout_seconds)
  const [timeoutVal, setTimeoutVal] = useState<string>('30');

  // Confirmation Modal for Maintenance Mode Toggle
  const [showMaintConfirm, setShowMaintConfirm] = useState<boolean>(false);
  const [pendingMaintValue, setPendingMaintValue] = useState<boolean>(false);

  // Fetch configs
  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('remote_config')
        .select('*');

      if (error) throw error;

      // Merge defaults with database values
      const merged = DEFAULT_CONFIGS.map(def => {
        const dbRow = data?.find(row => row.key === def.key);
        return {
          key: def.key,
          value: dbRow ? dbRow.value : def.value,
          description: dbRow?.description || def.description,
          updated_at: dbRow?.updated_at
        };
      });

      setConfigs(merged);

      // Sync constant input states
      const timeoutRow = merged.find(c => c.key === 'app_timeout_seconds');
      if (timeoutRow) {
        setTimeoutVal(timeoutRow.value);
      }
    } catch (err) {
      console.error('Failed to fetch remote config:', err);
      // Fallback to defaults on error/empty
      setConfigs(DEFAULT_CONFIGS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  // Save/Update config helper
  const updateConfigValue = async (targetKey: string, newValue: string) => {
    setSavingKey(targetKey);
    try {
      const configItem = configs.find(c => c.key === targetKey) || DEFAULT_CONFIGS.find(c => c.key === targetKey);
      const targetDesc = configItem ? configItem.description : '';

      // Use upsert to support empty table inserts
      const { error } = await supabase
        .from('remote_config')
        .upsert({
          key: targetKey,
          value: newValue,
          description: targetDesc,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      // Update state locally
      setConfigs(prev => prev.map(c => 
        c.key === targetKey 
          ? { ...c, value: newValue, updated_at: new Date().toISOString() } 
          : c
      ));

      alert(`Success! Configuration key "${targetKey}" updated.`);
    } catch (err: any) {
      console.error(`Failed to update config ${targetKey}:`, err);
      alert(`Gagal memperbarui konfigurasi: ${err.message || 'Error RLS / Connection'}`);
    } finally {
      setSavingKey(null);
    }
  };

  // Toggle handlers for boolean flags
  const handleToggleFlag = async (targetKey: string, currentValue: string) => {
    const nextValue = currentValue === 'true' ? 'false' : 'true';
    
    // Explicit confirmation for maintenance mode
    if (targetKey === 'maintenance_mode') {
      setPendingMaintValue(nextValue === 'true');
      setShowMaintConfirm(true);
      return;
    }

    await updateConfigValue(targetKey, nextValue);
  };

  // Execute maintenance mode toggle after modal confirmation
  const confirmMaintToggle = async () => {
    setShowMaintConfirm(false);
    await updateConfigValue('maintenance_mode', pendingMaintValue ? 'true' : 'false');
  };

  // Constant update handlers
  const handleUpdateConstants = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(Number(timeoutVal)) || Number(timeoutVal) <= 0) {
      alert("Rentang timeout seconds harus berupa angka positif.");
      return;
    }
    await updateConfigValue('app_timeout_seconds', timeoutVal);
  };

  const getMaintenanceModeRow = () => configs.find(c => c.key === 'maintenance_mode') || DEFAULT_CONFIGS[0];
  const getFeatureFlags = () => configs.filter(c => c.key.startsWith('feature_'));

  const isMaintActive = getMaintenanceModeRow().value === 'true';

  return (
    <div className="max-w-6xl mx-auto space-y-8 font-['Outfit'] select-none">
      
      {/* Header Panel */}
      <section className="bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] hover:shadow-[10px_10px_20px_#d1d5db,-10px_-10px_20px_#ffffff] transition-all duration-300 p-6 rounded-[24px] flex justify-between items-center">
        <div>
          <span className="tracking-widest text-[9px] font-bold text-[#64748B] uppercase">Remote Controls</span>
          <h3 className="text-base font-black text-[#1E293B] tracking-tight mt-1">SYS // REMOTE_CONFIG_ENGINE</h3>
        </div>

        <button
          onClick={fetchConfigs}
          className="border border-white bg-white hover:border-[#0EA5E9]/50 hover:bg-[#0EA5E9]/10 text-[#1E293B] hover:text-[#0EA5E9] p-2.5 rounded-xl transition-all duration-300 shadow-sm flex items-center justify-center"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </section>

      {/* Loading Overlay */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 text-[#64748B] space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#0EA5E9]" />
          <span className="text-xs font-bold uppercase tracking-wider">Syncing Remote config parameters...</span>
        </div>
      )}

      {!loading && (
        <div className="space-y-8">
          
          {/* SECTION 1: GLOBAL MAINTENANCE MODE CARD */}
          <div className={`border transition-all duration-500 rounded-[28px] overflow-hidden shadow-md p-8 relative ${
            isMaintActive 
              ? 'bg-red-50/90 border-red-200 shadow-[0_4px_20px_rgba(239,68,68,0.15)] animate-pulse-subtle' 
              : 'bg-white/80 backdrop-blur-md border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff]'
          }`}>
            
            {/* Warning indicator light */}
            <div className="absolute top-6 right-8 flex items-center space-x-2">
              <span className={`w-3.5 h-3.5 rounded-full ${isMaintActive ? 'bg-red-500 animate-ping shadow-[0_0_8px_#ef4444]' : 'bg-green-500'}`} />
              <span className={`font-mono text-[9px] font-bold uppercase ${isMaintActive ? 'text-red-500' : 'text-green-500'}`}>
                {isMaintActive ? 'MAINTENANCE_LOCKOUT_ACTIVE' : 'PRODUCTION_ONLINE'}
              </span>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 max-w-4xl">
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-[#1E293B]">
                  <AlertOctagon className={`w-6 h-6 ${isMaintActive ? 'text-red-500' : 'text-[#64748B]'}`} />
                  <h4 className="text-base font-black uppercase tracking-tight">Global Maintenance Lockout</h4>
                </div>
                <p className="text-xs text-[#64748B] leading-relaxed max-w-xl">
                  Mengaktifkan Maintenance Mode akan langsung memblokir akses seluruh pengguna Android Client APK secara global. Mode lockout ini digunakan hanya jika terjadi gangguan server krusial atau migrasi database.
                </p>
                {getMaintenanceModeRow().updated_at && (
                  <div className="text-[10px] text-gray-400 font-mono">
                    Last check-in: {new Date(getMaintenanceModeRow().updated_at!).toLocaleString()}
                  </div>
                )}
              </div>

              {/* Large Neumorphic Switch */}
              <div className="flex items-center space-x-4 self-start md:self-auto">
                <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Mode Switch:</span>
                
                <button
                  type="button"
                  disabled={savingKey === 'maintenance_mode'}
                  onClick={() => handleToggleFlag('maintenance_mode', getMaintenanceModeRow().value)}
                  className={`relative inline-flex h-9 w-20 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none ${
                    isMaintActive ? 'bg-red-500' : 'bg-gray-200'
                  }`}
                >
                  <span className="sr-only">Toggle Maintenance Mode</span>
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-8 w-8 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out flex items-center justify-center font-bold text-[9px] ${
                      isMaintActive ? 'translate-x-11 text-red-500' : 'translate-x-0 text-gray-400'
                    }`}
                  >
                    {isMaintActive ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 2 & 3: GRID LAYOUT */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Feature Flags Switches Grid (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center space-x-2 text-[#64748B]">
                <Sliders className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Client Modules Feature Flags</span>
              </div>

              <div className="bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] rounded-[24px] p-6 divide-y divide-gray-100">
                {getFeatureFlags().length === 0 ? (
                  <p className="text-center py-8 text-xs text-gray-400 font-bold uppercase tracking-wider">
                    No modules feature flags configured.
                  </p>
                ) : (
                  getFeatureFlags().map((flag) => {
                    const isEnabled = flag.value === 'true';

                    return (
                      <div key={flag.key} className="flex justify-between items-center py-5 first:pt-0 last:pb-0 gap-4">
                        <div className="space-y-1.5 max-w-md">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-black text-[#1E293B]">{flag.key}</span>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-bold tracking-wide uppercase font-mono ${
                              isEnabled 
                                ? 'bg-sky-50 text-sky-600 border border-sky-100' 
                                : 'bg-gray-100 text-gray-400 border border-gray-200'
                            }`}>
                              {isEnabled ? 'ENABLED' : 'DISABLED'}
                            </span>
                          </div>
                          <p className="text-xs text-[#64748B] leading-normal">
                            {flag.description}
                          </p>
                        </div>

                        {/* Switch button toggle */}
                        <button
                          type="button"
                          disabled={savingKey === flag.key}
                          onClick={() => handleToggleFlag(flag.key, flag.value)}
                          className={`relative inline-flex h-6 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            isEnabled ? 'bg-[#0EA5E9]' : 'bg-gray-200'
                          }`}
                        >
                          <span className="sr-only">Toggle {flag.key}</span>
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              isEnabled ? 'translate-x-6' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Dynamic System Variables Constants Panel (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="flex items-center space-x-2 text-[#64748B]">
                <Settings className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Dynamic App Variables</span>
              </div>

              <form onSubmit={handleUpdateConstants} className="bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] p-6 rounded-[24px] space-y-6">
                
                {/* app_timeout_seconds Input */}
                <div className="space-y-3.5 text-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <label className="block text-[9px] text-[#64748B] uppercase font-bold tracking-widest">
                        APP_TIMEOUT_SECONDS
                      </label>
                      <span className="text-[10px] text-gray-400 block mt-0.5">
                        Constant background inactivity timeout before lock
                      </span>
                    </div>
                    <span className="font-mono text-[9px] bg-sky-50 text-[#0EA5E9] px-2 py-0.5 rounded font-bold border border-sky-100">
                      SECONDS
                    </span>
                  </div>

                  <input
                    type="number"
                    required
                    min={5}
                    max={3600}
                    value={timeoutVal}
                    onChange={(e) => setTimeoutVal(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] shadow-sm font-semibold font-mono"
                  />
                  
                  <p className="text-[9px] text-[#64748B] leading-relaxed">
                    * Parameter ini secara otomatis digunakan oleh SQLite/Room database pada Android Client APK sebagai batas waktu *inactivity* sebelum layar dikunci.
                  </p>
                </div>

                {/* Save button */}
                <button
                  type="submit"
                  disabled={savingKey === 'app_timeout_seconds'}
                  className="w-full bg-[#0EA5E9] hover:bg-[#0ea5e9]/95 text-white font-bold text-xs py-3 rounded-xl transition-all duration-300 shadow-[2px_2px_5px_rgba(14,165,233,0.3)] flex items-center justify-center space-x-2 active:scale-98"
                >
                  {savingKey === 'app_timeout_seconds' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>[ Update System Constants ]</span>
                    </>
                  )}
                </button>

              </form>
            </div>

          </div>

        </div>
      )}

      {/* Maintenance Mode Confirmation Modal */}
      {showMaintConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white/95 border border-white/60 shadow-[10px_10px_30px_rgba(0,0,0,0.15)] p-6 max-w-sm w-full rounded-[24px] text-center space-y-6 animate-scale-up">
            <div className="flex flex-col items-center space-y-2">
              <AlertOctagon className="w-12 h-12 text-red-500 animate-pulse" />
              <h4 className="text-sm font-black text-red-500 uppercase tracking-wider pt-2">
                {pendingMaintValue ? 'Enable Maintenance Mode?' : 'Disable Maintenance Mode?'}
              </h4>
            </div>

            <p className="text-xs text-[#64748B] leading-relaxed">
              {pendingMaintValue 
                ? "PERINGATAN: Seluruh perangkat Android Client APK akan terkunci seketika dan kehilangan akses penuh ke aplikasi. Lanjutkan?" 
                : "Apakah Anda yakin ingin mematikan maintenance mode lockout dan membuka kembali akses aplikasi secara global?"
              }
            </p>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setShowMaintConfirm(false)}
                className="flex-1 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold text-xs py-3 rounded-xl transition-all duration-300 shadow-sm uppercase tracking-wider"
              >
                [ Batal ]
              </button>
              <button
                onClick={confirmMaintToggle}
                className={`flex-1 text-white font-bold text-xs py-3 rounded-xl transition-all duration-300 shadow-md uppercase tracking-wider ${
                  pendingMaintValue ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                [ Konfirmasi ]
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
