import React, { useEffect, useState } from 'react';
import { supabase } from '../../core/supabase';
import { Search, Loader2, RefreshCw, X, Calendar, Smartphone, User, Plus, Check, Trash2, AlertTriangle, CheckSquare, Square } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  phone?: string | null;
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
  const [customerLicenses, setCustomerLicenses] = useState<any[]>([]);

  // Register Customer modal state
  const [showRegModal, setShowRegModal] = useState<boolean>(false);
  const [newCustName, setNewCustName] = useState<string>('');
  const [newCustEmail, setNewCustEmail] = useState<string>('');
  const [newCustWhatsapp, setNewCustWhatsapp] = useState<string>('');
  const [regLoading, setRegLoading] = useState<boolean>(false);

  // Toast / Generated Key overlay state
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Delete state
  const [selectedForDelete, setSelectedForDelete] = useState<string[]>([]);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [showBulkConfirm, setShowBulkConfirm] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);

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

  useEffect(() => {
    const handleDbRefresh = () => {
      fetchCustomers();
    };
    window.addEventListener('db-refresh', handleDbRefresh);
    return () => window.removeEventListener('db-refresh', handleDbRefresh);
  }, []);

  const fetchActivationHistory = async (customer: any) => {
    setLogsLoading(true);
    const { data, error } = await supabase
      .from('devices')
      .select('id, created_at, model, secure_device_id, licenses!inner(customer_id)')
      .eq('licenses.customer_id', customer.id)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setActivationLogs(data.map((log: any) => ({
        id: log.id,
        device_name: log.model || 'Unknown Device',
        ip_address: log.secure_device_id ? `HWID: ${log.secure_device_id.substring(0, 10)}` : 'UNKNOWN',
        activated_at: new Date(log.created_at).toLocaleString(),
        status: 'SUCCESS'
      })));
    } else {
      setActivationLogs([]);
    }
    setLogsLoading(false);
  };

  const fetchCustomerLicenses = async (customer: any) => {
    const { data, error } = await supabase
      .from('licenses')
      .select('id, license_key, status, applications(app_name, package_name)')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
       setCustomerLicenses(data);
    } else {
       setCustomerLicenses([]);
    }
  };

  const handleSelectCustomer = (customer: any) => {
    setSelectedCustomer(customer);
    fetchActivationHistory(customer);
    fetchCustomerLicenses(customer);
  };

  // Register Customer + Generate license transaction
  const handleRegisterClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegLoading(true);

    const name = newCustName;
    const email = newCustEmail;
    const whatsapp = newCustWhatsapp;

    try {
      let customerId;

      // Check if customer with same email exists
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
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
        customerId = insertedRows[0].id;
      }

      // Step B: Generate the random 16-character key string
      const generateRandomKey = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const segment = () => Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        return `AR-${segment()}-${segment()}-${segment()}`;
      };
      const generatedKeyVal = generateRandomKey();

      // Step C: Insert into public.licenses linked to customerId
      const { error: licenseError } = await supabase
        .from('licenses')
        .insert([{
          license_key: generatedKeyVal,
          license_type: 'LIFETIME',
          type: 'LIFETIME',
          status: 'PENDING',
          customer_id: customerId,
          associated_device: 'UNBOUND',
          created_at: new Date().toISOString()
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

  // Delete helpers
  const toggleSelectCustomer = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedForDelete.includes(id)) {
      setSelectedForDelete(selectedForDelete.filter(item => item !== id));
    } else {
      setSelectedForDelete([...selectedForDelete, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedForDelete.length === filteredCustomers.length && filteredCustomers.length > 0) {
      setSelectedForDelete([]);
    } else {
      setSelectedForDelete(filteredCustomers.map(c => c.id));
    }
  };

  const handleDeleteSingle = async (customer: Customer) => {
    setDeleting(true);
    try {
      // Fetch licenses to delete associated devices
      const { data: customerLicenses } = await supabase.from('licenses').select('id').eq('customer_id', customer.id);
      if (customerLicenses && customerLicenses.length > 0) {
        const licenseIds = customerLicenses.map((l: any) => l.id);
        await supabase.from('devices').delete().in('license_id', licenseIds);
      }
      // Delete licenses of this customer
      await supabase.from('licenses').delete().eq('customer_id', customer.id);
      // Delete the customer record itself
      const { error } = await supabase.from('customers').delete().eq('id', customer.id);
      if (error) throw error;

      setCustomerToDelete(null);
      if (selectedCustomer?.id === customer.id) setSelectedCustomer(null);
      setSelectedForDelete(prev => prev.filter(id => id !== customer.id));
      await fetchCustomers();
    } catch (err: any) {
      console.error('Failed to delete customer:', err);
      alert(`Gagal menghapus pelanggan: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteBulk = async () => {
    if (selectedForDelete.length === 0) return;
    setDeleting(true);
    try {
      const { data: bulkLicenses } = await supabase.from('licenses').select('id').in('customer_id', selectedForDelete);
      if (bulkLicenses && bulkLicenses.length > 0) {
        const licenseIds = bulkLicenses.map((l: any) => l.id);
        await supabase.from('devices').delete().in('license_id', licenseIds);
      }
      await supabase.from('licenses').delete().in('customer_id', selectedForDelete);
      const { error } = await supabase.from('customers').delete().in('id', selectedForDelete);
      if (error) throw error;

      setShowBulkConfirm(false);
      if (selectedCustomer && selectedForDelete.includes(selectedCustomer.id)) {
        setSelectedCustomer(null);
      }
      setSelectedForDelete([]);
      await fetchCustomers();
    } catch (err: any) {
      console.error('Failed bulk delete:', err);
      alert(`Gagal menghapus pelanggan terpilih: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 font-['Outfit'] select-none relative">
      
      {/* 1. Frosted Glass Action Header Panel */}
      <section className="bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] hover:shadow-[10px_10px_20px_#d1d5db,-10px_-10px_20px_#ffffff] transition-all duration-300 p-4 sm:p-6 rounded-[24px] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="w-full">
          <span className="tracking-widest text-[9px] font-bold text-[#64748B] uppercase">Accounts Module</span>
          <h3 className="text-base font-black text-[#1E293B] tracking-tight mt-1 break-all">SYS // CUSTOMER_REGISTRY</h3>
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
            </select>
          </div>

          {/* Sync Trigger */}
          <button
            onClick={fetchCustomers}
            className="border border-white bg-white hover:border-[#0EA5E9]/50 hover:bg-[#0EA5E9]/10 text-[#1E293B] hover:text-[#0EA5E9] p-2.5 rounded-xl transition-all duration-300 shadow-sm flex items-center justify-center"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Bulk Delete Trigger */}
          {selectedForDelete.length > 0 && (
            <button
              onClick={() => setShowBulkConfirm(true)}
              className="bg-red-500 hover:bg-red-600 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all duration-300 shadow-[2px_2px_5px_rgba(239,68,68,0.3)] active:scale-95 flex items-center justify-center space-x-1.5 uppercase tracking-wide cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Hapus ({selectedForDelete.length}) Terpilih</span>
            </button>
          )}

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
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] rounded-[24px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-gray-100/50 border-b border-gray-200/50 text-[#64748B] uppercase text-[9px] font-bold tracking-widest">
                  <tr>
                    <th className="py-4 px-4 w-10">
                      <button onClick={toggleSelectAll} className="text-gray-400 hover:text-gray-600 flex items-center justify-center border-none bg-transparent cursor-pointer">
                        {filteredCustomers.length > 0 && selectedForDelete.length === filteredCustomers.length ? (
                          <CheckSquare className="w-4 h-4 text-[#0EA5E9]" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-4 px-6">Customer Name</th>
                    <th className="py-4 px-6">Email Address</th>
                    <th className="py-4 px-6">WhatsApp</th>
                    <th className="py-4 px-6">Ecommerce</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6 text-right">Registration Date</th>
                    <th className="py-4 px-4 text-center w-12">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-[#1E293B]">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-[#64748B] font-bold tracking-wide uppercase">
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
                          {/* Checkbox */}
                          <td className="py-4 px-4" onClick={(e) => toggleSelectCustomer(cust.id, e)}>
                            <button className="text-gray-400 hover:text-gray-600 flex items-center justify-center border-none bg-transparent cursor-pointer">
                              {selectedForDelete.includes(cust.id) ? (
                                <CheckSquare className="w-4 h-4 text-[#0EA5E9]" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>

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

                          {/* Ecommerce */}
                          <td className="py-4 px-6 font-mono text-[11px] text-[#64748B]">
                            {cust.phone || '-'}
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

                          {/* Action Delete */}
                          <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setCustomerToDelete(cust)}
                              className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
                              title="Hapus Data Pelanggan Ini"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="block lg:hidden space-y-4">
            {filteredCustomers.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-[20px] p-8 text-center text-[#64748B] font-bold uppercase tracking-wider">
                NO_ACTIVE_RECORDS_FOUND
              </div>
            ) : (
              filteredCustomers.map((cust) => {
                const isActive = cust.status === 'ACTIVE';
                const statusBadge = isActive 
                  ? 'bg-sky-50 text-[#0EA5E9] border border-sky-100' 
                  : 'bg-gray-100 text-gray-500 border border-gray-200';

                return (
                  <div 
                    key={cust.id} 
                    onClick={() => handleSelectCustomer(cust)}
                    className="cursor-pointer bg-white border border-gray-200/80 rounded-[20px] p-4 space-y-3 shadow-sm hover:border-[#0EA5E9]/30 transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-2.5">
                        <button onClick={(e) => toggleSelectCustomer(cust.id, e)} className="text-gray-400 hover:text-gray-600 flex items-center justify-center border-none bg-transparent cursor-pointer p-0">
                          {selectedForDelete.includes(cust.id) ? (
                            <CheckSquare className="w-4 h-4 text-[#0EA5E9]" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                        <span className="font-bold text-sm text-[#1E293B] block truncate max-w-[150px]">
                          {cust.name}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wide flex-shrink-0 ${statusBadge}`}>
                        {cust.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] text-[#64748B] pt-2.5 border-t border-gray-50">
                      <div>
                        <span className="block font-semibold text-[8px] text-gray-400 uppercase">Email</span>
                        <span className="font-mono text-[#1E293B] block truncate max-w-[120px]">{cust.email}</span>
                      </div>
                      <div>
                        <span className="block font-semibold text-[8px] text-gray-400 uppercase">WhatsApp</span>
                        <span className="font-mono text-[#1E293B] block truncate max-w-[120px]">{cust.whatsapp}</span>
                      </div>
                      <div>
                        <span className="block font-semibold text-[8px] text-gray-400 uppercase">Ecommerce</span>
                        <span className="font-mono text-[#1E293B] block truncate max-w-[120px]">{cust.phone || '-'}</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center pt-1 border-t border-gray-50/50">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCustomerToDelete(cust);
                        }}
                        className="flex items-center space-x-1 text-red-500 hover:text-red-600 text-[10px] font-bold uppercase border-none bg-transparent cursor-pointer p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                      <div className="text-[9px] text-gray-400 font-mono">
                        Registered: {new Date(cust.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
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
                {selectedCustomer.phone && (
                  <div>
                    <label className="text-[9px] text-[#64748B] uppercase font-bold tracking-wider">Ecommerce</label>
                    <p className="text-xs font-mono text-[#64748B]">{selectedCustomer.phone}</p>
                  </div>
                )}
                <div>
                  <label className="text-[9px] text-[#64748B] uppercase font-bold tracking-wider">Active Licenses</label>
                  <p className="text-sm font-black text-[#0EA5E9] font-mono">{selectedCustomer.license_count}</p>
                </div>
              </div>

              {/* Registered Licenses */}
              {customerLicenses.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-[#64748B]">
                    <span className="text-xs font-bold uppercase tracking-wider">Lisensi Terdaftar</span>
                  </div>
                  <div className="space-y-2">
                    {customerLicenses.map((lic, idx) => {
                      const isActive = lic.status === 'ACTIVE';
                      const isSuspended = lic.status === 'SUSPENDED';
                      const isExpired = lic.status === 'EXPIRED';

                      let statusBadge = 'bg-gray-50 text-gray-500 border border-gray-200';
                      if (isActive) statusBadge = 'bg-sky-50 text-sky-600 border border-sky-100';
                      if (isSuspended) statusBadge = 'bg-orange-50 text-orange-600 border border-orange-100';
                      if (isExpired) statusBadge = 'bg-red-50 text-red-600 border border-red-100';

                      return (
                        <div key={idx} className="bg-white border border-gray-100 p-3 rounded-xl flex justify-between items-center shadow-sm">
                          <div>
                            <p className="text-[11px] font-bold text-[#1E293B]">{lic.applications?.app_name || 'Premium License'}</p>
                            <p className="text-[9px] font-mono text-[#64748B] mt-0.5">{lic.license_key}</p>
                          </div>
                          <span className={`px-2 py-1 rounded-md text-[8px] font-bold tracking-wider uppercase ${statusBadge}`}>
                            {lic.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
            <div className="pt-4 border-t border-gray-100 mt-6 flex space-x-3">
              <button
                onClick={() => {
                  const toDel = selectedCustomer;
                  setSelectedCustomer(null);
                  setCustomerToDelete(toDel);
                }}
                className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-bold text-xs px-4 py-3 rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5 uppercase cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Hapus</span>
              </button>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="flex-1 bg-[#1E293B] hover:bg-[#1E293B]/90 text-white font-bold text-xs py-3 rounded-xl transition-all duration-300 shadow-md uppercase tracking-wide cursor-pointer"
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

      {/* 6. Single Delete Confirmation Modal */}
      {customerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white/95 border border-white/60 shadow-[10px_10px_30px_rgba(0,0,0,0.2)] p-6 max-w-sm w-full rounded-[24px] space-y-5 text-center animate-scale-up">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-500 flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-sm font-black text-[#1E293B] uppercase tracking-wider">Konfirmasi Hapus Data</h4>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Apakah Anda yakin ingin menghapus permanen data pelanggan <span className="font-bold text-[#1E293B]">{customerToDelete.name}</span> ({customerToDelete.email})? Seluruh lisensi dan riwayat aktivasi perangkatnya juga akan dihapus.
              </p>
            </div>
            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setCustomerToDelete(null)}
                disabled={deleting}
                className="flex-1 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold text-xs py-3 rounded-xl transition-all uppercase cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSingle(customerToDelete)}
                disabled={deleting}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md uppercase flex items-center justify-center space-x-1 cursor-pointer"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Ya, Hapus</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Bulk Delete Confirmation Modal */}
      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white/95 border border-white/60 shadow-[10px_10px_30px_rgba(0,0,0,0.2)] p-6 max-w-sm w-full rounded-[24px] space-y-5 text-center animate-scale-up">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-500 flex items-center justify-center mx-auto shadow-inner">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-sm font-black text-[#1E293B] uppercase tracking-wider">Hapus ({selectedForDelete.length}) Pelanggan</h4>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Anda memilih <span className="font-bold text-red-500">{selectedForDelete.length} data pelanggan</span> untuk dihapus. Semua data lisensi, aktivasi, dan profil yang terpilih akan dibersihkan permanen dari database. Lanjutkan?
              </p>
            </div>
            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkConfirm(false)}
                disabled={deleting}
                className="flex-1 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold text-xs py-3 rounded-xl transition-all uppercase cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteBulk}
                disabled={deleting}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md uppercase flex items-center justify-center space-x-1 cursor-pointer"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Hapus Semua</span>}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
