import React, { useEffect, useState } from 'react';
import { supabase } from '../../core/supabase';
import { Search, Loader2, RefreshCw, X, Calendar, Smartphone, User, Plus, Check } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  status: 'ACTIVE' | 'SUSPENDED';
  license_count: number;
  created_at: string;
}

interface ActivationLog {
  id: string;
  device_name: string;
  ip_address: string;
  activated_at: string;
  status: 'SUCCESS' | 'REVOKED';
}

export const CustomerScreen: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchKey, setSearchKey] = useState<string>('');
  const [sortBy, setSortBy] = useState<'created_at' | 'license_count'>('created_at');
  
  // Selection & Detail drawer state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [activationLogs, setActivationLogs] = useState<ActivationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState<boolean>(false);

  // Register Customer modal state
  const [showRegModal, setShowRegModal] = useState<boolean>(false);
  const [newCustName, setNewCustName] = useState<string>('');
  const [newCustEmail, setNewCustEmail] = useState<string>('');
  const [newCustWhatsapp, setNewCustWhatsapp] = useState<string>('');
  const [regLoading, setRegLoading] = useState<boolean>(false);

  // Toast / Generated Key overlay state
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Fetch customers list
  const fetchCustomers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setCustomers(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchActivationHistory = async (customer: any) => {
    setLogsLoading(true);
    const { data, error } = await supabase
      .from('license_activations')
      .select('id, ip_address, created_at, status')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false });
    if (!error && data) {
      setActivationLogs(data.map((log: any) => ({
        id: log.id,
        device_name: log.device_name || 'POS_TERMINAL',
        ip_address: log.ip_address || '127.0.0.1',
        activated_at: new Date(log.created_at).toLocaleString(),
        status: log.status
      })));
    } else {
      setActivationLogs([]);
    }
    setLogsLoading(false);
  };

  const handleSelectCustomer = (customer: any) => {
    setSelectedCustomer(customer);
    fetchActivationHistory(customer);
  };

  // Register Customer + Generate license transaction
  const handleRegisterClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegLoading(true);

    const name = newCustName;
    const email = newCustEmail;
    const whatsapp = newCustWhatsapp;

    try {
      // Step A: Insert into public.customers using array mapping
      const { data: insertedRows, error: customerError } = await supabase
        .from('customers')
        .insert([{ name, email, whatsapp }])
        .select();

      if (customerError || !insertedRows || insertedRows.length === 0) {
        console.error("DETAILED CUSTOMER ERROR:", customerError);
        alert(`Failed to register customer: ${customerError?.message || 'Unknown network error'}`);
        return;
      }

      const newCustomer = insertedRows[0];

      // Step B: Generate the random 16-character key string
      const generateRandomKey = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const segment = () => Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        return `AR-${segment()}-${segment()}-${segment()}`;
      };
      const generatedKeyVal = generateRandomKey();

      // Step C: Insert into public.licenses linked to newCustomer.id
      const { error: licenseError } = await supabase
        .from('licenses')
        .insert([{
          license_key: generatedKeyVal,
          type: 'LIFETIME',
          status: 'ACTIVE',
          customer_id: newCustomer.id,
          associated_device: 'UNBOUND'
        }]);

      if (licenseError) {
        console.error("DETAILED LICENSE ERROR:", licenseError);
        alert(`Customer created, but key generation failed: ${licenseError.message}`);
        return;
      }

      // Reload Table
      await fetchCustomers();

      // Clear the form text fields
      setNewCustName('');
      setNewCustEmail('');
      setNewCustWhatsapp('');

      // Close modal
      setShowRegModal(false);

      // Display key display overlay / toast
      setGeneratedKey(generatedKeyVal);
      setCopied(false);

      // Alert success
      alert(`Success! Customer Registered. License Key: ${generatedKeyVal}`);

    } catch (err) {
      console.error('Customer registration transaction failed. ', err);
    } finally {
      setRegLoading(false);
    }
  };

  // Copy key clipboard helper
  const handleCopyKey = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter and sort customer entries
  const filteredCustomers = customers
    .filter(cust => 
      cust.name.toLowerCase().includes(searchKey.toLowerCase()) ||
      cust.email.toLowerCase().includes(searchKey.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'created_at') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else {
        return b.license_count - a.license_count;
      }
    });

  return (
    <div className="max-w-7xl mx-auto space-y-8 font-['Outfit'] select-none relative">
      
      {/* 1. Frosted Glass Action Header Panel */}
      <section className="bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] hover:shadow-[10px_10px_20px_#d1d5db,-10px_-10px_20px_#ffffff] transition-all duration-300 p-6 rounded-[24px] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="tracking-widest text-[9px] font-bold text-[#64748B] uppercase">Accounts Module</span>
          <h3 className="text-base font-black text-[#1E293B] tracking-tight mt-1">SYS // CUSTOMER_REGISTRY</h3>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {/* Search Field */}
          <div className="relative flex-grow sm:flex-grow-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <input
              type="text"
              placeholder="SEARCH_CUSTOMER..."
              value={searchKey}
              onChange={(e) => setSearchKey(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-[#1E293B] placeholder:text-[#64748B]/60 focus:outline-none focus:border-[#0EA5E9] focus:ring-1 focus:ring-[#0EA5E9] transition-all duration-300 w-full sm:w-56 shadow-sm"
            />
          </div>

          {/* Sorting Dropdown Filter */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white border border-gray-200 rounded-xl text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] transition-all duration-300 font-semibold cursor-pointer shadow-sm"
            >
              <option value="created_at">Sort by Date</option>
              <option value="license_count">Sort by Active Licenses</option>
            </select>
          </div>

          {/* Sync Trigger */}
          <button
            onClick={fetchCustomers}
            className="border border-white bg-white hover:border-[#0EA5E9]/50 hover:bg-[#0EA5E9]/10 text-[#1E293B] hover:text-[#0EA5E9] p-2.5 rounded-xl transition-all duration-300 shadow-sm flex items-center justify-center"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Register trigger */}
          <button
            onClick={() => setShowRegModal(true)}
            className="bg-[#0EA5E9] hover:bg-[#0ea5e9]/95 text-white font-bold text-xs py-2.5 px-5 rounded-xl transition-all duration-300 shadow-[2px_2px_5px_rgba(14,165,233,0.3)] active:scale-95 flex items-center justify-center space-x-1 uppercase tracking-wide"
          >
            <Plus className="w-4 h-4" />
            <span>[ Register New Client ]</span>
          </button>
        </div>
      </section>

      {/* 2. Customer Table Grid */}
      {loading ? (
        <div className="bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] rounded-[24px] p-16 flex flex-col items-center justify-center space-y-3 min-h-[320px]">
          <Loader2 className="w-8 h-8 animate-spin text-[#0EA5E9]" />
          <span className="text-xs text-[#64748B] font-bold tracking-widest uppercase">FETCHING_LIVE_STREAM...</span>
        </div>
      ) : (
        <div className="bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] rounded-[24px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-gray-100/50 border-b border-gray-200/50 text-[#64748B] uppercase text-[9px] font-bold tracking-widest">
                <tr>
                  <th className="py-4 px-6">Customer Name</th>
                  <th className="py-4 px-6">Email Address</th>
                  <th className="py-4 px-6">WhatsApp</th>
                  <th className="py-4 px-6">Active Licenses</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Registration Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-[#1E293B]">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#64748B] font-bold tracking-wide uppercase">
                      NO_ACTIVE_RECORDS_FOUND
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((cust, idx) => {
                    const isActive = cust.status === 'ACTIVE';
                    const statusBadge = isActive 
                      ? 'bg-sky-50 text-[#0EA5E9] border border-sky-100' 
                      : 'bg-gray-100 text-gray-500 border border-gray-200';

                    return (
                      <tr 
                        key={cust.id} 
                        onClick={() => handleSelectCustomer(cust)}
                        className={`cursor-pointer transition-colors duration-200 hover:bg-sky-500/5 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                      >
                        {/* Name */}
                        <td className="py-4 px-6 font-bold text-[#1E293B]">
                          {cust.name}
                        </td>

                        {/* Email */}
                        <td className="py-4 px-6 font-mono text-[11px] text-[#64748B]">
                          {cust.email}
                        </td>

                        {/* WhatsApp */}
                        <td className="py-4 px-6 font-mono text-[11px] text-[#64748B]">
                          {cust.whatsapp}
                        </td>

                        {/* License count */}
                        <td className="py-4 px-6 font-mono text-xs font-bold text-[#0EA5E9] pl-10">
                          {cust.license_count}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-6">
                          <span className={`px-2.5 py-1 rounded-full text-[8px] font-bold tracking-wide uppercase ${statusBadge}`}>
                            {cust.status}
                          </span>
                        </td>

                        {/* Registration Date */}
                        <td className="py-4 px-6 text-right font-mono text-[10px] text-gray-400">
                          {new Date(cust.created_at).toLocaleDateString('en-US')}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Centered Customer Detail Modal (Neumorphic Hybrid View) */}
      {selectedCustomer && (
        <div 
          onClick={() => setSelectedCustomer(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white/95 backdrop-blur-md border border-white/60 shadow-[10px_10px_30px_rgba(0,0,0,0.15)] flex flex-col justify-between p-6 rounded-[24px] max-h-[85vh] overflow-y-auto cursor-default relative"
          >
            
            <div className="space-y-6">
              
              {/* Modal Header */}
              <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                <div className="flex items-center space-x-2 text-[#0EA5E9]">
                  <User className="w-5 h-5" />
                  <h4 className="text-sm font-black text-[#1E293B] uppercase tracking-wider">Detail Customer</h4>
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors duration-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Profile Card */}
              <div className="bg-white/50 border border-white/60 shadow-[4px_4px_8px_#d1d5db,-4px_-4px_8px_#ffffff] p-5 rounded-2xl space-y-3">
                <div>
                  <label className="text-[9px] text-[#64748B] uppercase font-bold tracking-wider">Full Name</label>
                  <p className="text-sm font-black text-[#1E293B]">{selectedCustomer.name}</p>
                </div>
                <div>
                  <label className="text-[9px] text-[#64748B] uppercase font-bold tracking-wider">Email Address</label>
                  <p className="text-xs font-mono text-[#64748B]">{selectedCustomer.email}</p>
                </div>
                <div>
                  <label className="text-[9px] text-[#64748B] uppercase font-bold tracking-wider">WhatsApp Line</label>
                  <p className="text-xs font-mono text-[#64748B]">{selectedCustomer.whatsapp}</p>
                </div>
              </div>

              {/* Activation Logs (History) */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-[#64748B]">
                  <Calendar className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Riwayat Aktivasi (Device logs)</span>
                </div>

                <div className="border border-gray-200/50 rounded-2xl overflow-hidden divide-y divide-gray-100 text-[11px] font-mono shadow-sm">
                  {logsLoading ? (
                    <div className="py-8 text-center text-[#64748B]">
                      <div className="flex items-center justify-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin text-[#0EA5E9]" />
                        <span>Querying history logs...</span>
                      </div>
                    </div>
                  ) : activationLogs.length === 0 ? (
                    <div className="py-8 text-center text-gray-400">
                      NO_ACTIVATION_RECORDS_FOUND
                    </div>
                  ) : (
                    activationLogs.map((log) => {
                      const isSuccess = log.status === 'SUCCESS';
                      const badgeStyle = isSuccess 
                        ? 'bg-green-50 text-green-600 border border-green-100' 
                        : 'bg-red-50 text-red-500 border border-red-100';

                      return (
                        <div key={log.id} className="p-3 bg-white space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-[#1E293B] flex items-center space-x-1">
                              <Smartphone className="w-3.5 h-3.5 text-gray-400 mr-1" />
                              {log.device_name}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-bold tracking-wide uppercase ${badgeStyle}`}>
                              {log.status}
                            </span>
                          </div>
                          <div className="flex justify-between text-[9px] text-[#64748B]">
                            <span>IP: {log.ip_address}</span>
                            <span>{log.activated_at}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-gray-100 mt-6">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="w-full bg-[#1E293B] hover:bg-[#1E293B]/90 text-white font-bold text-xs py-3 rounded-xl transition-all duration-300 shadow-md uppercase tracking-wide"
              >
                Close View
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 4. Centered Client Registration Modal */}
      {showRegModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white/95 border border-white/60 shadow-[10px_10px_30px_rgba(0,0,0,0.1)] p-6 max-w-md w-full rounded-[20px] space-y-6">
            <div className="border-b border-gray-100 pb-3 flex justify-between items-center">
              <h4 className="text-sm font-black text-[#1E293B] uppercase tracking-wider">Register New Client</h4>
              <button onClick={() => setShowRegModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterClient} className="space-y-4 text-xs">
              {/* Name */}
              <div className="space-y-2">
                <label className="block text-[#64748B] uppercase font-bold tracking-wider">
                  Customer Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] transition-all duration-300 shadow-sm"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className="block text-[#64748B] uppercase font-bold tracking-wider">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. john@example.com"
                  value={newCustEmail}
                  onChange={(e) => setNewCustEmail(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] transition-all duration-300 shadow-sm font-mono"
                />
              </div>

              {/* WhatsApp */}
              <div className="space-y-2">
                <label className="block text-[#64748B] uppercase font-bold tracking-wider">
                  WhatsApp Number
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 081234567890"
                  value={newCustWhatsapp}
                  onChange={(e) => setNewCustWhatsapp(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] transition-all duration-300 shadow-sm font-mono"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowRegModal(false)}
                  className="bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg transition-all duration-300 font-bold uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={regLoading}
                  className="bg-[#0EA5E9] hover:bg-[#0ea5e9]/90 text-white px-5 py-2 rounded-lg transition-all duration-300 font-bold uppercase shadow-sm flex items-center space-x-1"
                >
                  {regLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Confirm & Generate Key</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Neumorphic Generated Key Toast Overlay Dialog */}
      {generatedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white/95 border border-white/60 shadow-[10px_10px_30px_rgba(0,0,0,0.15)] p-6 max-w-sm w-full rounded-[24px] text-center space-y-6 animate-scale-up">
            
            <div className="space-y-2">
              <span className="text-[9px] bg-green-50 text-green-600 border border-green-100 rounded-full px-3 py-1 font-bold uppercase tracking-widest">
                Client Registered Successfully
              </span>
              <h4 className="text-sm font-black text-[#1E293B] uppercase tracking-wider pt-2">Generated License Key</h4>
              <p className="text-xs text-[#64748B]">Send this code to the client device to unlock premium assets.</p>
            </div>

            {/* Generated Key monospaced text display */}
            <div className="bg-gray-50 border border-gray-200/50 p-4 rounded-2xl font-mono text-base font-black tracking-tight text-[#0EA5E9] select-all break-all shadow-inner">
              {generatedKey}
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={handleCopyKey}
                className="flex-1 bg-[#0EA5E9] hover:bg-[#0ea5e9]/95 text-white font-bold text-xs py-3 rounded-xl transition-all duration-300 shadow-md flex items-center justify-center space-x-1 uppercase"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <span>[ Copy Key ]</span>
                )}
              </button>
              <button
                onClick={() => setGeneratedKey(null)}
                className="bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold text-xs px-5 py-3 rounded-xl transition-all duration-300 shadow-sm uppercase"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
