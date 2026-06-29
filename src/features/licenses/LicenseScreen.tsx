import React, { useEffect, useState } from 'react';
import { supabase } from '../../core/supabase';
import { Search, Loader2, RefreshCw, X, User } from 'lucide-react';

interface License {
  id: string;
  license_key: string;
  type: 'TRIAL' | 'STANDARD' | 'PREMIUM' | 'LIFETIME';
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
  associated_device: string | null;
  customer_id?: string | null;
  created_at: string;
  customers?: {
    id: string;
    name: string;
    email: string;
    whatsapp: string;
  } | null;
}

export const LicenseScreen: React.FC = () => {
  // Initial state defaults to empty array
  const [licenses, setLicenses] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchKey, setSearchKey] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);
  
  // Bulk modal state
  const [qty, setQty] = useState<number>(5);
  const [licenseType, setLicenseType] = useState<License['type']>('STANDARD');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Associated Customer Detail Modal state
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [selectedCustomer, setSelectedCustomer] = useState<License['customers'] | null>(null);

  // Fetch licenses from database with LEFT JOIN to pull customer profile details
  const fetchLicenses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('licenses')
      .select('*, customers(id, name, email, whatsapp)')
      .order('created_at', { ascending: false });
    if (!error && data) setLicenses(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchLicenses();
  }, []);

  // Suspend License Status
  const handleSuspend = async (id: string) => {
    setActionLoading(id);
    try {
      const { error } = await supabase
        .from('licenses')
        .update({ status: 'SUSPENDED' })
        .eq('id', id);

      if (error) throw error;

      // Update state locally upon success
      setLicenses(prev => prev.map(lic => lic.id === id ? { ...lic, status: 'SUSPENDED' } : lic));
    } catch (err) {
      console.error('Failed to suspend license row: ', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Reset associated device
  const handleResetDevice = async (id: string) => {
    setActionLoading(id);
    try {
      // Call Supabase Edge Function 'reset-device-association'
      const { error } = await supabase.functions.invoke('reset-device-association', {
        body: { license_id: id }
      });

      if (error) throw error;

      // Update state locally upon success
      setLicenses(prev => prev.map(lic => lic.id === id ? { ...lic, associated_device: null } : lic));
    } catch (err) {
      console.error('Reset device Edge Function invocation failed: ', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Bulk Generator triggers
  const handleBulkGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowModal(false);
    setLoading(true);

    try {
      // Invoke Supabase Edge Function 'generate-bulk-licenses'
      const { error } = await supabase.functions.invoke('generate-bulk-licenses', {
        body: { license_type: licenseType, quantity: qty }
      });

      if (error) throw error;

      // Trigger the data-fetching function again immediately upon success
      await fetchLicenses();
    } catch (err) {
      console.error('Bulk generation Edge Function failed: ', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetailModal = (cust: License['customers']) => {
    setSelectedCustomer(cust);
    setIsDetailModalOpen(true);
  };

  // Filter keys
  const filteredLicenses = licenses.filter(lic => 
    lic.license_key.toLowerCase().includes(searchKey.toLowerCase()) ||
    (lic.associated_device && lic.associated_device.toLowerCase().includes(searchKey.toLowerCase())) ||
    lic.type.toLowerCase().includes(searchKey.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 font-['Outfit'] select-none">
      
      {/* 1. Frosted Glass Action Header Panel */}
      <section className="bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] hover:shadow-[10px_10px_20px_#d1d5db,-10px_-10px_20px_#ffffff] transition-all duration-300 p-6 rounded-[24px] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="tracking-widest text-[9px] font-bold text-[#64748B] uppercase">Security Registry</span>
          <h3 className="text-base font-black text-[#1E293B] tracking-tight mt-1">SYS // LICENSE_REGISTRY</h3>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {/* Search Field */}
          <div className="relative flex-grow sm:flex-grow-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search keys..."
              value={searchKey}
              onChange={(e) => setSearchKey(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-[#1E293B] placeholder:text-[#64748B]/60 focus:outline-none focus:border-[#0EA5E9] focus:ring-1 focus:ring-[#0EA5E9] transition-all duration-300 w-full sm:w-48 shadow-sm"
            />
          </div>

          {/* Sync Trigger */}
          <button
            onClick={fetchLicenses}
            className="border border-white bg-white hover:border-[#0EA5E9]/50 hover:bg-[#0EA5E9]/10 text-[#1E293B] hover:text-[#0EA5E9] p-2.5 rounded-xl transition-all duration-300 shadow-sm flex items-center justify-center"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Generate trigger */}
          <button
            onClick={() => setShowModal(true)}
            className="bg-[#0EA5E9] hover:bg-[#0ea5e9]/95 text-white font-bold text-xs py-2.5 px-5 rounded-xl transition-all duration-300 shadow-[2px_2px_5px_rgba(14,165,233,0.3)] active:scale-95 uppercase tracking-wide"
          >
            [ + Generate Bulk ]
          </button>
        </div>
      </section>

      {/* 2. Glassmorphic Table Container */}
      <div className="bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] rounded-[24px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-gray-100/50 border-b border-gray-200/50 text-[#64748B] uppercase text-[9px] font-bold tracking-widest">
              <tr>
                <th className="py-4 px-6">LICENSE_KEY</th>
                <th className="py-4 px-6">TYPE</th>
                <th className="py-4 px-6">STATUS</th>
                <th className="py-4 px-6">ASSOCIATED_DEVICE</th>
                <th className="py-4 px-6 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-[#1E293B]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#64748B]">
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#0EA5E9]" />
                      <span>FETCHING_LIVE_STREAM...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLicenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#64748B] font-bold tracking-wide uppercase">
                    NO DATA IN DATABASE
                  </td>
                </tr>
              ) : (
                filteredLicenses.map((lic, idx) => {
                  const isActive = lic.status === 'ACTIVE';
                  let statusBadge = 'bg-gray-100 text-gray-500 border border-gray-200';
                  
                  if (isActive) statusBadge = 'bg-sky-50 text-[#0EA5E9] border border-sky-100';
                  if (lic.status === 'EXPIRED') statusBadge = 'bg-red-50 text-red-500 border border-red-100';

                  return (
                    <tr key={lic.id} className={`transition-colors duration-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                      {/* License Key */}
                      <td className="py-4 px-6 font-mono tracking-tight text-[#1E293B] font-bold select-all">
                        {lic.license_key}
                      </td>

                      {/* License Type */}
                      <td className="py-4 px-6 font-mono text-[10px] text-[#64748B] font-semibold">
                        {lic.type}
                      </td>

                      {/* License Status */}
                      <td className="py-4 px-6 font-mono text-[10px]">
                        <span className={`px-2.5 py-1 rounded-full text-[8px] font-bold tracking-wide uppercase ${statusBadge}`}>
                          {lic.status}
                        </span>
                      </td>

                      {/* Associated Device */}
                      <td className="py-4 px-6 font-mono text-[10px] text-[#64748B] font-semibold">
                        {lic.associated_device || 'UNBOUND'}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right space-x-2">
                        {/* Owner Detail Button */}
                        <button
                          onClick={() => handleOpenDetailModal(lic.customers)}
                          className="bg-slate-100 hover:bg-sky-500 hover:text-white text-slate-600 border border-slate-200 hover:border-transparent text-[10px] font-black px-3 py-1.5 rounded-lg transition-all duration-300 shadow-sm"
                        >
                          [ Detail ]
                        </button>

                        {isActive && (
                          <button
                            disabled={actionLoading !== null}
                            onClick={() => handleSuspend(lic.id)}
                            className="bg-white hover:bg-red-500 hover:text-white border border-gray-200 hover:border-transparent text-xs text-[#1E293B] px-3 py-1.5 rounded-lg transition-all duration-300 shadow-sm"
                          >
                            [ Suspend ]
                          </button>
                        )}
                        
                        {lic.associated_device && (
                          <button
                            disabled={actionLoading !== null}
                            onClick={() => handleResetDevice(lic.id)}
                            className="bg-white hover:bg-gray-100 border border-gray-200 text-xs text-[#1E293B] px-3 py-1.5 rounded-lg transition-all duration-300 shadow-sm"
                          >
                            [ Reset Device ]
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Bulk Generator Overlay Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white/95 border border-white/60 shadow-[10px_10px_30px_rgba(0,0,0,0.1)] p-6 max-w-sm w-full rounded-[20px] space-y-6">
            <div className="border-b border-gray-100 pb-3 flex justify-between items-center">
              <h4 className="text-sm font-black text-[#1E293B] uppercase tracking-wider">Generate Bulk Licenses</h4>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBulkGenerate} className="space-y-4 text-xs">
              <div className="space-y-2">
                <label className="block text-[#64748B] uppercase font-bold tracking-wider">
                  Quantity (Keys to create)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={50}
                  value={qty}
                  onChange={(e) => setQty(parseInt(e.target.value) || 1)}
                  className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] font-mono shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[#64748B] uppercase font-bold tracking-wider">
                  License Class
                </label>
                <select
                  value={licenseType}
                  onChange={(e) => setLicenseType(e.target.value as any)}
                  className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] cursor-pointer shadow-sm font-bold"
                >
                  <option value="TRIAL">TRIAL (30 Days)</option>
                  <option value="STANDARD">STANDARD tier</option>
                  <option value="PREMIUM">PREMIUM tier</option>
                  <option value="LIFETIME">LIFETIME tier</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg transition-all duration-300 font-bold uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#0EA5E9] hover:bg-[#0ea5e9]/90 text-white px-5 py-2 rounded-lg transition-all duration-300 font-bold uppercase shadow-sm"
                >
                  Generate Key Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Owner Detail Overlay Modal (Glass & Frost) */}
      {isDetailModalOpen && (
        <div 
          onClick={() => setIsDetailModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent cursor-pointer animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white/95 backdrop-blur-md border border-white/60 shadow-[10px_10px_30px_rgba(0,0,0,0.15)] p-6 rounded-[24px] cursor-default space-y-6"
          >
            <div className="border-b border-gray-100 pb-3 flex justify-between items-center">
              <div className="flex items-center space-x-2 text-[#0EA5E9]">
                <User className="w-5 h-5" />
                <h4 className="text-sm font-black text-[#1E293B] uppercase tracking-wider">SYS // OWNER_PROFILE</h4>
              </div>
              <button 
                onClick={() => setIsDetailModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedCustomer ? (
              <div className="space-y-4">
                <div className="bg-slate-50 border border-gray-150 p-4 rounded-xl space-y-3">
                  <div>
                    <label className="text-[9px] text-[#64748B] uppercase font-bold tracking-wider block">Owner Name</label>
                    <span className="text-xs font-black text-[#1E293B]">{selectedCustomer.name}</span>
                  </div>
                  <div>
                    <label className="text-[9px] text-[#64748B] uppercase font-bold tracking-wider block">Email Address</label>
                    <span className="text-xs font-mono text-[#64748B]">{selectedCustomer.email}</span>
                  </div>
                  <div>
                    <label className="text-[9px] text-[#64748B] uppercase font-bold tracking-wider block">WhatsApp contact</label>
                    <span className="text-xs font-mono text-[#64748B]">{selectedCustomer.whatsapp}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs font-bold text-slate-500 uppercase tracking-wide">
                No Customer Registered to this Key // Unassigned
              </div>
            )}

            <div className="pt-2 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="w-full bg-[#1E293B] hover:bg-[#1E293B]/90 text-white font-bold text-xs py-3 rounded-xl transition-all duration-300 shadow-md uppercase tracking-wide"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
