import React, { useEffect, useState } from 'react';
import { supabase } from '../../core/supabase';
import { Search, Loader2, RefreshCw, X, User, Check, Unlock, Trash2 } from 'lucide-react';

interface License {
  id: string;
  license_key: string;
  type: string;
  license_type?: string | null;
  duration_days?: number | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'PENDING';
  associated_device: string | null;
  customer_id?: string | null;
  application_id?: string | null;
  created_at: string;
  activated_at?: string | null;
  expires_at?: string | null;
  renewed_at?: string | null;
  last_validation?: string | null;
  customers?: {
    id: string;
    name: string;
    email: string;
    whatsapp: string;
    phone?: string | null;
  } | null;
  applications?: {
    id: string;
    app_name: string;
    package_name: string;
    download_url?: string | null;
  } | null;
}

const buildCustomerTemplate = (licenseKey: string, downloadUrl: string, appName: string, licenseType: string, durationDays: number | null) => {
  let durationText = 'Lifetime License';
  if (licenseType === 'TRIAL') {
    durationText = `Trial License (${durationDays || 7} Hari)`;
  } else if (licenseType !== 'LIFETIME' && durationDays) {
    durationText = `Lisensi Berjangka (${durationDays} Hari)`;
  }

  return `Halo 👋

Terima kasih telah membeli ${appName || 'aplikasi kami'}.

Berikut data lisensi Anda:

🔑 License Key
${licenseKey}

📥 Link Download Aplikasi
${downloadUrl || '-'}

Cara Aktivasi
1. Install APK.
2. Buka aplikasi.
3. Halaman Welcome akan muncul saat pertama kali dibuka.
4. Klik Lanjut.
5. Masukkan License Key.
6. Klik Aktivasi.
7. Tunggu hingga proses selesai.

Penting
• License hanya berlaku untuk perangkat yang diaktivasi.
• Simpan License Key dengan baik.
• Aktivasi pertama membutuhkan koneksi internet.

Sebagai pengguna Anda mendapatkan:
• ${durationText}
• Gratis seluruh pembaruan dan perbaikan
• Prioritas fitur berdasarkan masukan pengguna

Apabila mengalami kendala,
gunakan menu Laporkan Masalah di dalam aplikasi.

Terima kasih telah mempercayai ${appName || 'aplikasi kami'}.`;
};

export const LicenseScreen: React.FC = () => {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchKey, setSearchKey] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);
  
  // Unified Registration Form state
  const [customerName, setCustomerName] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [customerWhatsapp, setCustomerWhatsapp] = useState<string>('');
  const [customerEcommerce, setCustomerEcommerce] = useState<string>('');
  const [formLoading, setFormLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Success overlay state
  const [successKey, setSuccessKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  
  // Generator State
  const [generationMode, setGenerationMode] = useState<'RELEASE' | 'RE_GENERATE'>('RELEASE');
  const [copiedTemplate, setCopiedTemplate] = useState<boolean>(false);
  const [showDetailedSuccess, setShowDetailedSuccess] = useState<boolean>(false);
  const [generatedTemplate, setGeneratedTemplate] = useState<string>('');

  // Target Applications State
  interface AppOption {
    id: string;
    app_name: string;
    package_name: string;
    download_url?: string;
  }
  const [appsList, setAppsList] = useState<AppOption[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [appsLoading, setAppsLoading] = useState<boolean>(false);

  // License Duration System State
  const [selectedLicenseType, setSelectedLicenseType] = useState<string>('LIFETIME');
  const [customDays, setCustomDays] = useState<string>('30');

  // Renew License State
  const [showRenewModal, setShowRenewModal] = useState<boolean>(false);
  const [renewingLicense, setRenewingLicense] = useState<License | null>(null);
  const [renewType, setRenewType] = useState<string>('30_DAYS');
  const [renewCustomDays, setRenewCustomDays] = useState<string>('30');
  const [renewFormLoading, setRenewFormLoading] = useState<boolean>(false);

  // Filter State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [packageFilter, setPackageFilter] = useState<string>('ALL');

  // Detail Modal state
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null);

  // Helper calculation for remaining days
  const getRemainingDaysText = (lic: License) => {
    const lType = lic.license_type || lic.type;
    if (lType === 'LIFETIME') {
      return 'Lifetime';
    }
    if (!lic.expires_at) {
      return 'Pending Activation';
    }
    const now = new Date();
    const exp = new Date(lic.expires_at);
    if (exp < now) {
      return 'Expired';
    }
    const diffMs = exp.getTime() - now.getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return `${days} Days Remaining`;
  };

  const getExpirationText = (lic: License) => {
    const lType = lic.license_type || lic.type;
    if (lType === 'LIFETIME') {
      return 'Lifetime';
    }
    if (!lic.expires_at) {
      return 'Pending Activation';
    }
    return new Date(lic.expires_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
  };



  // Fetch applications list from Supabase
  const fetchAppsList = async () => {
    setAppsLoading(true);
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('id, app_name, package_name')
        .order('app_name', { ascending: true });
      if (!error && data) {
        setAppsList(data);
        if (data.length > 0) {
          setSelectedAppId(data[0].id);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch applications list:', err);
    } finally {
      setAppsLoading(false);
    }
  };

  // Fetch licenses
  const fetchLicenses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('licenses')
      .select('*, customers(id, name, email, whatsapp, phone), applications(id, app_name, package_name)')
      .order('created_at', { ascending: false });
    if (!error && data) setLicenses(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchLicenses();
    fetchAppsList();
  }, []);

  // Suspend License Status
  const handleSuspend = async (id: string) => {
    setActionLoading(id);
    try {
      const lic = licenses.find(l => l.id === id);
      const keyText = lic ? lic.license_key : id;

      const { error } = await supabase
        .from('licenses')
        .update({ status: 'SUSPENDED', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      // Log activity
      await supabase.from('logs').insert([{
        action: 'LIC_SUSPEND',
        description: `Lisensi [KEY: ${keyText}] ditangguhkan (Suspended)`,
        severity: 'warning'
      }]);

      setLicenses(prev => prev.map(lic => lic.id === id ? { ...lic, status: 'SUSPENDED' } : lic));
      window.dispatchEvent(new Event('db-refresh'));
    } catch (err) {
      console.error('Failed to suspend license: ', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Reset associated device
  const handleResetDevice = async (id: string) => {
    setActionLoading(id);
    try {
      const lic = licenses.find(l => l.id === id);
      const keyText = lic ? lic.license_key : id;

      // 1. Delete associated device record
      const { error: deleteError } = await supabase
        .from('devices')
        .delete()
        .eq('license_id', id);

      if (deleteError) throw deleteError;

      // 2. Clear activation states, leaving duration and type intact
      const { error: updateError } = await supabase
        .from('licenses')
        .update({ 
          status: 'PENDING', 
          associated_device: 'UNBOUND',
          activated_at: null,
          expires_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // Log activity
      await supabase.from('logs').insert([{
        action: 'DEV_RESET',
        description: `Perangkat di-reset untuk lisensi [KEY: ${keyText}]`,
        severity: 'info'
      }]);

      setLicenses(prev => prev.map(lic => lic.id === id ? { 
        ...lic, 
        associated_device: 'UNBOUND', 
        status: 'PENDING',
        activated_at: null,
        expires_at: null
      } : lic));
      window.dispatchEvent(new Event('db-refresh'));
    } catch (err) {
      console.error('Reset device failed: ', err);
      alert('Gagal meriset perangkat.');
    } finally {
      setActionLoading(null);
    }
  };

  // Reactivate / Open Suspend
  const handleOpenSuspend = async (id: string) => {
    const confirmActivation = window.confirm("Apakah Anda yakin ingin mengaktifkan kembali lisensi ini?");
    if (!confirmActivation) return;

    setActionLoading(id);
    try {
      const lic = licenses.find(l => l.id === id);
      const keyText = lic ? lic.license_key : id;

      const { error } = await supabase
        .from('licenses')
        .update({ status: 'ACTIVE', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      // Log activity
      await supabase.from('logs').insert([{
        action: 'LIC_ACTIVATE',
        description: `Lisensi [KEY: ${keyText}] diaktifkan kembali`,
        severity: 'info'
      }]);

      setLicenses(prev => prev.map(lic => lic.id === id ? { ...lic, status: 'ACTIVE' } : lic));
      window.dispatchEvent(new Event('db-refresh'));
    } catch (err) {
      console.error('Failed to reactivate license: ', err);
      alert('Gagal mengaktifkan kembali lisensi.');
    } finally {
      setActionLoading(null);
    }
  };

  // Delete License permanently
  const handleDeleteLicense = async (id: string) => {
    const confirmDelete = window.confirm("PERINGATAN: Menghapus lisensi ini akan menghapus semua data perangkat yang tertaut secara permanen. Lanjutkan?");
    if (!confirmDelete) return;

    setActionLoading(id);
    try {
      const lic = licenses.find(l => l.id === id);
      const keyText = lic ? lic.license_key : id;

      const { error: deviceError } = await supabase
        .from('devices')
        .delete()
        .eq('license_id', id);

      if (deviceError) throw deviceError;

      const { error: licenseError } = await supabase
        .from('licenses')
        .delete()
        .eq('id', id);

      if (licenseError) throw licenseError;

      // Log activity
      await supabase.from('logs').insert([{
        action: 'LIC_DELETE',
        description: `Lisensi [KEY: ${keyText}] dihapus permanen`,
        severity: 'critical'
      }]);

      setLicenses(prev => prev.filter(lic => lic.id !== id));
      window.dispatchEvent(new Event('db-refresh'));
    } catch (err) {
      console.error('Failed to delete license: ', err);
      alert('Gagal menghapus lisensi.');
    } finally {
      setActionLoading(null);
    }
  };

  // Generate License
  const handleGenerateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      const selectedApp = appsList.find(app => app.id === selectedAppId);
      const appName = selectedApp ? selectedApp.app_name : 'Aplikasi Kami';
      let apkUrl = '';

      if (selectedAppId) {
        try {
          const { data, error } = await supabase
            .from('application_versions')
            .select('download_url')
            .eq('application_id', selectedAppId)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1);

          if (!error && data && data.length > 0) {
            apkUrl = data[0].download_url;
          } else {
            // Check if there is any version at all for this app
            const { data: anyVerData, error: anyVerError } = await supabase
              .from('application_versions')
              .select('download_url')
              .eq('application_id', selectedAppId)
              .order('created_at', { ascending: false })
              .limit(1);
            if (!anyVerError && anyVerData && anyVerData.length > 0) {
              apkUrl = anyVerData[0].download_url;
            }
          }
        } catch (err) {
          console.warn('Failed to fetch latest APK download URL for selected application on submit:', err);
        }
      }

      // Step A: Insert Customer
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .insert([{
          name: customerName,
          email: customerEmail,
          whatsapp: customerWhatsapp,
          phone: customerEcommerce,
          status: 'ACTIVE'
        }])
        .select()
        .single();

      if (customerError || !customerData) {
        console.error("DETAILED CUSTOMER ERROR:", customerError);
        alert(`Failed to register customer: ${customerError?.message || 'Unknown network error'}`);
        return;
      }

      const newlyCreatedCustomerId = customerData.id;

      // Step B: Determine Duration and Insert License
      const generateUniqueKey = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const segment = (len: number) => Array.from({length: len}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        return `AR-${segment(5)}-${segment(5)}-${segment(5)}`;
      };
      const generatedKey = generateUniqueKey();

      let finalType = selectedLicenseType === 'LIFETIME' ? 'LIFETIME' : 'TRIAL';
      let finalLicenseType = selectedLicenseType;
      let finalDurationDays: number | null = null;
      if (selectedLicenseType === 'TRIAL') finalDurationDays = 7;
      else if (selectedLicenseType === '30_DAYS') finalDurationDays = 30;
      else if (selectedLicenseType === '90_DAYS') finalDurationDays = 90;
      else if (selectedLicenseType === '180_DAYS') finalDurationDays = 180;
      else if (selectedLicenseType === '365_DAYS') finalDurationDays = 365;
      else if (selectedLicenseType === 'CUSTOM') finalDurationDays = parseInt(customDays) || 30;

      const { error: licenseError } = await supabase
        .from('licenses')
        .insert([{
          license_key: generatedKey,
          customer_id: newlyCreatedCustomerId,
          license_type: finalLicenseType,
          type: finalType,
          duration_days: finalDurationDays,
          status: 'PENDING',
          associated_device: 'UNBOUND',
          application_id: selectedAppId || null,
          created_at: new Date().toISOString()
        }]);

      if (licenseError) {
        console.error("DETAILED LICENSE ERROR:", licenseError);
        alert(`Customer created, but license generation failed: ${licenseError.message}`);
        return;
      }

      // Log activity
      await supabase.from('logs').insert([{
        action: 'LIC_GEN',
        description: `Lisensi baru [KEY: ${generatedKey}] dibuat untuk ${customerName}`,
        severity: 'info'
      }]);

      setSuccessKey(generatedKey);
      setCopied(false);

      if (generationMode === 'RE_GENERATE') {
        setShowDetailedSuccess(false);
      } else {
        const template = buildCustomerTemplate(generatedKey, apkUrl, appName, finalType, finalDurationDays);
        setGeneratedTemplate(template);
        setShowDetailedSuccess(true);
        setCopiedTemplate(false);
      }

      setCustomerName('');
      setCustomerEmail('');
      setCustomerWhatsapp('');
      setCustomerEcommerce('');
      if (appsList.length > 0) {
        setSelectedAppId(appsList[0].id);
      }
      setShowModal(false);

      await fetchLicenses();
      window.dispatchEvent(new Event('db-refresh'));
    } catch (err) {
      console.error('License generation transaction failed: ', err);
    } finally {
      setFormLoading(false);
    }
  };

  // Renew License
  const handleRenewLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewingLicense) return;
    setRenewFormLoading(true);

    try {
      let finalType = renewType === 'LIFETIME' ? 'LIFETIME' : 'TRIAL';
      let finalLicenseType = renewType;
      let finalDurationDays: number | null = null;
      if (renewType === 'LIFETIME') finalDurationDays = null;
      else if (renewType === 'TRIAL') finalDurationDays = 7;
      else if (renewType === '30_DAYS') finalDurationDays = 30;
      else if (renewType === '90_DAYS') finalDurationDays = 90;
      else if (renewType === '180_DAYS') finalDurationDays = 180;
      else if (renewType === '365_DAYS') finalDurationDays = 365;
      else if (renewType === 'CUSTOM') finalDurationDays = parseInt(renewCustomDays) || 30;

      let newExpiresAt: string | null = null;
      const now = new Date();

      if (finalLicenseType !== 'LIFETIME' && finalDurationDays !== null) {
        let baseDate = now;
        // Extend existing expiry if active and not already expired
        if (renewingLicense.expires_at && new Date(renewingLicense.expires_at) > now) {
          baseDate = new Date(renewingLicense.expires_at);
        }
        baseDate.setDate(baseDate.getDate() + finalDurationDays);
        newExpiresAt = baseDate.toISOString();
      }

      const { error } = await supabase
        .from('licenses')
        .update({
          license_type: finalLicenseType,
          type: finalType,
          duration_days: finalDurationDays,
          expires_at: newExpiresAt,
          status: 'ACTIVE', // Sets back to active (reactivates expired/pending if necessary)
          renewed_at: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', renewingLicense.id);

      if (error) throw error;

      // Log activity
      await supabase.from('logs').insert([{
        action: 'LIC_RENEW',
        description: `Lisensi [KEY: ${renewingLicense.license_key}] diperpanjang (${finalLicenseType})`,
        severity: 'info'
      }]);

      alert('License renewed successfully.');
      setShowRenewModal(false);
      setRenewingLicense(null);
      await fetchLicenses();
      window.dispatchEvent(new Event('db-refresh'));
    } catch (err: any) {
      console.error('Failed to renew license: ', err);
      alert(`Failed to renew license: ${err.message}`);
    } finally {
      setRenewFormLoading(false);
    }
  };

  const handleOpenRenewModal = (lic: License) => {
    setRenewingLicense(lic);
    setRenewType(lic.license_type || lic.type || '30_DAYS');
    setRenewCustomDays(lic.duration_days ? String(lic.duration_days) : '30');
    setShowRenewModal(true);
  };

  const handleOpenDetailModal = (lic: License) => {
    setSelectedLicense(lic);
    setIsDetailModalOpen(true);
  };

  // Advanced Filtering
  const filteredLicenses = licenses.filter(lic => {
    const matchesSearch = 
      lic.license_key.toLowerCase().includes(searchKey.toLowerCase()) ||
      (lic.associated_device && lic.associated_device.toLowerCase().includes(searchKey.toLowerCase())) ||
      (lic.customers && lic.customers.name.toLowerCase().includes(searchKey.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || lic.status === statusFilter;

    const lType = lic.license_type || lic.type;
    const matchesType = typeFilter === 'ALL' || 
      (typeFilter === 'LIFETIME' && lType === 'LIFETIME') ||
      (typeFilter === 'TRIAL' && lType === 'TRIAL') ||
      (typeFilter === '30_DAYS' && lType === '30_DAYS') ||
      (typeFilter === '90_DAYS' && (lType === '90_DAYS' || lType === '3_MONTHS')) ||
      (typeFilter === '180_DAYS' && (lType === '180_DAYS' || lType === '6_MONTHS')) ||
      (typeFilter === '365_DAYS' && (lType === '365_DAYS' || lType === '1_YEAR')) ||
      (typeFilter === 'CUSTOM' && lType === 'CUSTOM');

    const matchesPackage = packageFilter === 'ALL' || (lic.applications && lic.applications.package_name === packageFilter);

    return matchesSearch && matchesStatus && matchesType && matchesPackage;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8 font-['Outfit'] select-none">
      
      {/* 1. Frosted Glass Action Header Panel */}
      <section className="bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] hover:shadow-[10px_10px_20px_#d1d5db,-10px_-10px_20px_#ffffff] transition-all duration-300 p-6 rounded-[24px] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="tracking-widest text-[9px] font-bold text-[#64748B] uppercase">Security Registry</span>
          <h3 className="text-base font-black text-[#1E293B] tracking-tight mt-1">SYS // LICENSE_REGISTRY</h3>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search Field */}
          <div className="relative flex-grow sm:flex-grow-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search keys..."
              value={searchKey}
              onChange={(e) => setSearchKey(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs text-[#1E293B] placeholder:text-[#64748B]/60 focus:outline-none focus:border-[#0EA5E9] focus:ring-1 focus:ring-[#0EA5E9] transition-all duration-300 w-full sm:w-40 shadow-sm"
            />
          </div>

          {/* Package Filter */}
          <select
            value={packageFilter}
            onChange={(e) => setPackageFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-[#1E293B] focus:outline-none focus:border-[#0EA5E9] shadow-sm font-semibold cursor-pointer max-w-[150px] truncate"
          >
            <option value="ALL">All Packages</option>
            {appsList.map((app) => (
              <option key={app.id} value={app.package_name}>
                {app.app_name}
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-[#1E293B] focus:outline-none focus:border-[#0EA5E9] shadow-sm font-semibold cursor-pointer"
          >
            <option value="ALL">All Types</option>
            <option value="LIFETIME">Lifetime</option>
            <option value="TRIAL">Trial</option>
            <option value="30_DAYS">30 Days</option>
            <option value="90_DAYS">3 Months</option>
            <option value="180_DAYS">6 Months</option>
            <option value="365_DAYS">1 Year</option>
            <option value="CUSTOM">Custom</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-[#1E293B] focus:outline-none focus:border-[#0EA5E9] shadow-sm font-semibold cursor-pointer"
          >
            <option value="ALL">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="ACTIVE">Active</option>
            <option value="EXPIRED">Expired</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          {/* Sync Trigger */}
          <button
            onClick={fetchLicenses}
            className="border border-white bg-white hover:border-[#0EA5E9]/50 hover:bg-[#0EA5E9]/10 text-[#1E293B] hover:text-[#0EA5E9] p-2 rounded-xl transition-all duration-300 shadow-sm flex items-center justify-center"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Generate trigger */}
          <button
            onClick={() => setShowModal(true)}
            className="bg-[#0EA5E9] hover:bg-[#0ea5e9]/95 text-white font-bold text-xs py-2 px-4 rounded-xl transition-all duration-300 shadow-[2px_2px_5px_rgba(14,165,233,0.3)] active:scale-95 uppercase tracking-wide border-none"
          >
            [ + Generate License ]
          </button>
        </div>
      </section>

      {/* 2. Glassmorphic Table Container (Desktop Only) */}
      <div className="hidden lg:block bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] rounded-[24px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[800px]">
            <thead className="bg-gray-100/50 border-b border-gray-200/50 text-[#64748B] uppercase text-[9px] font-bold tracking-widest">
              <tr>
                <th className="py-4 px-6">LICENSE_KEY</th>
                <th className="py-4 px-6">CUSTOMER / ECOMMERCE</th>
                <th className="py-4 px-6">PACKAGE</th>
                <th className="py-4 px-6">TYPE / DURATION</th>
                <th className="py-4 px-6">EXPIRES / REMAINING</th>
                <th className="py-4 px-6">STATUS</th>
                <th className="py-4 px-6">ASSOCIATED_DEVICE</th>
                <th className="py-4 px-6 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-[#1E293B]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#64748B]">
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#0EA5E9]" />
                      <span>FETCHING_LIVE_STREAM...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLicenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#64748B] font-bold tracking-wide uppercase">
                    NO DATA IN DATABASE
                  </td>
                </tr>
              ) : (
                filteredLicenses.map((lic, idx) => {
                  const isActive = lic.status === 'ACTIVE';
                  let statusBadge = 'bg-gray-100 text-gray-500 border border-gray-200';
                  
                  if (isActive) statusBadge = 'bg-sky-50 text-[#0EA5E9] border border-sky-100';
                  if (lic.status === 'EXPIRED') statusBadge = 'bg-red-50 text-red-500 border border-red-100';
                  if (lic.status === 'SUSPENDED') statusBadge = 'bg-amber-50 text-amber-600 border border-amber-100';
                  if (lic.status === 'PENDING') statusBadge = 'bg-yellow-50 text-yellow-600 border border-yellow-100 animate-pulse';

                  const remDaysText = getRemainingDaysText(lic);

                  return (
                    <tr key={lic.id} className={`transition-colors duration-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                      {/* License Key */}
                      <td className="py-4 px-6 font-mono tracking-tight text-[#1E293B] font-bold select-all">
                        {lic.license_key}
                      </td>

                      {/* Customer / Ecommerce */}
                      <td className="py-4 px-6">
                        {lic.customers ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-[#1E293B]">{lic.customers.name}</span>
                            <span className="text-[10px] text-sky-600 font-semibold uppercase">{lic.customers.phone || 'No Ecommerce'}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 font-semibold">-</span>
                        )}
                      </td>

                      {/* Package */}
                      <td className="py-4 px-6">
                        {lic.applications ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-[#1E293B]">{lic.applications.app_name}</span>
                            <span className="text-[10px] text-gray-500 font-mono">{lic.applications.package_name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 font-semibold">-</span>
                        )}
                      </td>

                      {/* License Type / Duration */}
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="font-mono text-[10px] text-[#1E293B] font-bold uppercase">{lic.license_type || lic.type}</span>
                          {lic.duration_days && (
                            <span className="text-[9px] text-[#64748B] font-semibold">{lic.duration_days} Days</span>
                          )}
                        </div>
                      </td>

                      {/* Expires / Remaining */}
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="font-bold text-[10px] text-[#1E293B]">{getExpirationText(lic)}</span>
                          <span className={`text-[9px] font-bold ${remDaysText === 'Expired' ? 'text-red-500 font-black' : 'text-[#64748B]'}`}>
                            {remDaysText}
                          </span>
                        </div>
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
                      <td className="py-4 px-6 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenDetailModal(lic)}
                          className="bg-slate-100 hover:bg-[#1E293B] hover:text-white text-slate-600 border border-slate-200 hover:border-transparent text-[10px] font-bold px-2 py-1 rounded-lg transition-all duration-300"
                        >
                          Detail
                        </button>

                        <button
                          disabled={actionLoading !== null}
                          onClick={() => handleOpenRenewModal(lic)}
                          className="bg-sky-50 hover:bg-[#0EA5E9] hover:text-white border border-sky-100 hover:border-transparent text-[10px] font-bold text-sky-600 px-2 py-1 rounded-lg transition-all duration-300"
                        >
                          Renew
                        </button>

                        {isActive && (
                          <button
                            disabled={actionLoading !== null}
                            onClick={() => handleSuspend(lic.id)}
                            className="bg-white hover:bg-red-500 hover:text-white border border-gray-200 hover:border-transparent text-[10px] font-bold text-[#1E293B] px-2 py-1 rounded-lg transition-all duration-300"
                          >
                            Suspend
                          </button>
                        )}

                        {lic.status === 'SUSPENDED' && (
                          <button
                            disabled={actionLoading !== null}
                            onClick={() => handleOpenSuspend(lic.id)}
                            className="bg-emerald-50 hover:bg-emerald-500 hover:text-white border border-emerald-200 hover:border-transparent text-[10px] font-bold text-emerald-600 px-2 py-1 rounded-lg transition-all duration-300 inline-flex items-center space-x-1"
                          >
                            <Unlock className="w-3 h-3" />
                            <span>Activate</span>
                          </button>
                        )}
                        
                        {lic.associated_device && lic.associated_device !== 'UNBOUND' && (
                          <button
                            disabled={actionLoading !== null}
                            onClick={() => handleResetDevice(lic.id)}
                            className="bg-white hover:bg-gray-100 border border-gray-200 text-[10px] font-bold text-[#1E293B] px-2 py-1 rounded-lg transition-all duration-300"
                          >
                            Reset Device
                          </button>
                        )}

                        <button
                          disabled={actionLoading !== null}
                          onClick={() => handleDeleteLicense(lic.id)}
                          className="bg-red-50 hover:bg-red-500 hover:text-white border border-red-150 hover:border-transparent text-[10px] font-bold text-red-600 px-2 py-1 rounded-lg transition-all duration-300 inline-flex items-center space-x-1 animate-pulse"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
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

      {/* 2b. Cards Layout Container (Mobile Only) */}
      <div className="block lg:hidden space-y-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-white border border-gray-200 rounded-[20px] p-5 space-y-3">
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              <div className="h-3 bg-gray-100 rounded w-1/2"></div>
              <div className="h-8 bg-gray-100 rounded"></div>
            </div>
          ))
        ) : filteredLicenses.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-[20px] p-8 text-center text-[#64748B] font-bold uppercase tracking-wider">
            NO DATA IN DATABASE
          </div>
        ) : (
          filteredLicenses.map((lic) => {
            const isActive = lic.status === 'ACTIVE';
            let statusBadge = 'bg-gray-100 text-gray-500 border border-gray-200';
            
            if (isActive) statusBadge = 'bg-sky-50 text-[#0EA5E9] border border-sky-100';
            if (lic.status === 'EXPIRED') statusBadge = 'bg-red-50 text-red-500 border border-red-100';
            if (lic.status === 'SUSPENDED') statusBadge = 'bg-amber-50 text-amber-600 border border-amber-100';
            if (lic.status === 'PENDING') statusBadge = 'bg-yellow-50 text-yellow-600 border border-yellow-100 animate-pulse';

            const remDaysText = getRemainingDaysText(lic);

            return (
              <div key={lic.id} className="bg-white border border-gray-200/80 rounded-[20px] p-4 space-y-3 shadow-sm">
                <div className="flex justify-between items-start">
                  <div className="font-mono font-bold text-xs select-all text-[#1E293B] break-all pr-2">
                    {lic.license_key}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wide flex-shrink-0 ${statusBadge}`}>
                    {lic.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] text-[#64748B] pt-2.5 border-t border-gray-50">
                  <div>
                    <span className="block font-semibold text-[8px] text-gray-400 uppercase">Customer</span>
                    <span className="font-bold text-[#1E293B] block truncate max-w-[120px]">
                      {lic.customers ? lic.customers.name : '-'}
                    </span>
                    {lic.customers?.phone && (
                      <span className="text-[8px] text-sky-600 font-semibold uppercase block truncate max-w-[120px]">
                        {lic.customers.phone}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="block font-semibold text-[8px] text-gray-400 uppercase">Package</span>
                    <span className="font-bold text-[#1E293B] block truncate max-w-[120px]">
                      {lic.applications ? lic.applications.app_name : '-'}
                    </span>
                    {lic.applications && (
                      <span className="text-[8px] text-gray-500 font-mono block truncate max-w-[120px]">
                        {lic.applications.package_name}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="block font-semibold text-[8px] text-gray-400 uppercase">Device</span>
                    <span className="font-mono text-[#1E293B] block truncate max-w-[120px]">
                      {lic.associated_device || 'UNBOUND'}
                    </span>
                  </div>
                  <div>
                    <span className="block font-semibold text-[8px] text-gray-400 uppercase">License Type</span>
                    <span className="font-mono text-[#1E293B] font-bold">{lic.license_type || lic.type}</span>
                    {lic.duration_days && (
                      <span className="text-[9px] text-[#64748B] font-semibold block">{lic.duration_days} Days</span>
                    )}
                  </div>
                  <div className="col-span-2">
                    <span className="block font-semibold text-[8px] text-gray-400 uppercase">Expiration / Remaining</span>
                    <span className="text-[#1E293B] font-bold block">{getExpirationText(lic)}</span>
                    <span className={`text-[9.5px] font-bold block ${remDaysText === 'Expired' ? 'text-red-500' : 'text-[#64748B]'}`}>{remDaysText}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-3 border-t border-gray-100 justify-end">
                  <button
                    onClick={() => handleOpenDetailModal(lic)}
                    className="bg-slate-100 hover:bg-[#1E293B] hover:text-white text-slate-600 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all"
                  >
                    Detail
                  </button>

                  <button
                    onClick={() => handleOpenRenewModal(lic)}
                    className="bg-sky-50 hover:bg-[#0EA5E9] hover:text-white text-sky-600 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all"
                  >
                    Renew
                  </button>

                  {isActive && (
                    <button
                      disabled={actionLoading !== null}
                      onClick={() => handleSuspend(lic.id)}
                      className="bg-white hover:bg-red-500 hover:text-white border border-gray-200 text-[10px] font-bold text-[#1E293B] px-3 py-1.5 rounded-lg transition-all"
                    >
                      Suspend
                    </button>
                  )}

                  {lic.status === 'SUSPENDED' && (
                    <button
                      disabled={actionLoading !== null}
                      onClick={() => handleOpenSuspend(lic.id)}
                      className="bg-emerald-50 hover:bg-emerald-500 hover:text-white border border-emerald-200 text-[10px] font-bold text-emerald-600 px-3 py-1.5 rounded-lg transition-all inline-flex items-center space-x-1"
                    >
                      <Unlock className="w-3 h-3" />
                      <span>Activate</span>
                    </button>
                  )}
                  
                  {lic.associated_device && lic.associated_device !== 'UNBOUND' && (
                    <button
                      disabled={actionLoading !== null}
                      onClick={() => handleResetDevice(lic.id)}
                      className="bg-white hover:bg-gray-100 border border-gray-200 text-[10px] font-bold text-[#1E293B] px-3 py-1.5 rounded-lg transition-all"
                    >
                      Reset
                    </button>
                  )}

                  <button
                    disabled={actionLoading !== null}
                    onClick={() => handleDeleteLicense(lic.id)}
                    className="bg-red-50 hover:bg-red-500 hover:text-white border border-red-200 text-[10px] font-bold text-red-600 px-3 py-1.5 rounded-lg transition-all inline-flex items-center space-x-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. Generate License & Customer Registration Overlay Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white/95 border border-white/60 shadow-[10px_10px_30px_rgba(0,0,0,0.1)] p-6 max-w-sm w-full rounded-[20px] space-y-4">
            <div className="border-b border-gray-100 pb-2 flex justify-between items-center">
              <h4 className="text-sm font-black text-[#1E293B] uppercase tracking-wider">Generate License</h4>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGenerateLicense} className="space-y-3.5 text-xs">
              <div className="space-y-1.5">
                <label className="block text-[#64748B] uppercase font-bold tracking-widest text-[9px]">
                  Generate Option
                </label>
                <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setGenerationMode('RELEASE')}
                    className={`py-1.5 rounded-lg text-center font-bold text-[9px] uppercase transition-all duration-200 border-none ${
                      generationMode === 'RELEASE'
                        ? 'bg-white text-[#0EA5E9] shadow-sm'
                        : 'text-[#64748B] hover:text-[#1E293B] bg-transparent'
                    }`}
                  >
                    Release
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenerationMode('RE_GENERATE')}
                    className={`py-1.5 rounded-lg text-center font-bold text-[9px] uppercase transition-all duration-200 border-none ${
                      generationMode === 'RE_GENERATE'
                        ? 'bg-white text-[#0EA5E9] shadow-sm'
                        : 'text-[#64748B] hover:text-[#1E293B] bg-transparent'
                    }`}
                  >
                    Re-Gen
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[#64748B] uppercase font-bold tracking-widest text-[9px]">
                  Target Aplikasi (Package)
                </label>
                {appsLoading ? (
                  <div className="flex items-center space-x-2 py-2 text-gray-500 font-semibold">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0EA5E9]" />
                    <span>Memuat daftar aplikasi...</span>
                  </div>
                ) : appsList.length === 0 ? (
                  <div className="bg-red-50 text-red-600 border border-red-200 p-2.5 rounded-lg font-bold text-center">
                    Aplikasi belum terdaftar di admin panel. Silakan tambahkan aplikasi terlebih dahulu.
                  </div>
                ) : (
                  <select
                    required
                    value={selectedAppId}
                    onChange={(e) => setSelectedAppId(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] shadow-sm font-semibold cursor-pointer"
                  >
                    {appsList.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.app_name} ({app.package_name})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-[#64748B] uppercase font-bold tracking-wider">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] shadow-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[#64748B] uppercase font-bold tracking-wider">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. john@example.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] shadow-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[#64748B] uppercase font-bold tracking-wider">
                  WhatsApp Number
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 081234567890"
                  value={customerWhatsapp}
                  onChange={(e) => setCustomerWhatsapp(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] shadow-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[#64748B] uppercase font-bold tracking-wider">
                  Ecommerce Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shopee, Tokopedia"
                  value={customerEcommerce}
                  onChange={(e) => setCustomerEcommerce(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] shadow-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[#64748B] uppercase font-bold tracking-wider">
                  License Duration
                </label>
                <select
                  value={selectedLicenseType}
                  onChange={(e) => setSelectedLicenseType(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] shadow-sm font-semibold cursor-pointer"
                >
                  <option value="LIFETIME">Lifetime</option>
                  <option value="TRIAL">Trial (7 Days)</option>
                  <option value="30_DAYS">30 Days</option>
                  <option value="90_DAYS">90 Days (3 Months)</option>
                  <option value="180_DAYS">180 Days (6 Months)</option>
                  <option value="365_DAYS">365 Days (1 Year)</option>
                  <option value="CUSTOM">Custom Duration</option>
                </select>
              </div>

              {selectedLicenseType === 'CUSTOM' && (
                <div className="space-y-1.5">
                  <label className="block text-[#64748B] uppercase font-bold tracking-wider">
                    Custom Duration (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="e.g. 45"
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] shadow-sm font-medium"
                  />
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg transition-all duration-300 font-bold uppercase border-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading || appsList.length === 0}
                  className={`px-5 py-2 rounded-lg transition-all duration-300 font-bold uppercase shadow-sm flex items-center space-x-1 border-none ${
                    appsList.length === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-[#0EA5E9] hover:bg-[#0ea5e9]/90 text-white'
                  }`}
                >
                  {formLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Generate & Register</span>
                  )}
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white/95 backdrop-blur-md border border-white/60 shadow-[10px_10px_30px_rgba(0,0,0,0.15)] p-6 rounded-[24px] cursor-default space-y-6 animate-scale-up"
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

            {selectedLicense ? (
              <div className="space-y-4">
                <div className="bg-slate-50 border border-gray-150 p-4 rounded-xl space-y-3">
                  <div>
                    <label className="text-[9px] text-[#64748B] uppercase font-bold tracking-wider block">Owner Name</label>
                    <span className="text-xs font-black text-[#1E293B]">{selectedLicense.customers?.name || '-'}</span>
                  </div>
                  <div>
                    <label className="text-[9px] text-[#64748B] uppercase font-bold tracking-wider block">Email Address</label>
                    <span className="text-xs font-mono text-[#64748B]">{selectedLicense.customers?.email || '-'}</span>
                  </div>
                  <div>
                    <label className="text-[9px] text-[#64748B] uppercase font-bold tracking-wider block">WhatsApp contact</label>
                    <span className="text-xs font-mono text-[#64748B]">{selectedLicense.customers?.whatsapp || '-'}</span>
                  </div>
                  {selectedLicense.customers?.phone && (
                    <div>
                      <label className="text-[9px] text-[#64748B] uppercase font-bold tracking-wider block">Ecommerce</label>
                      <span className="text-xs font-mono text-[#64748B]">{selectedLicense.customers.phone}</span>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-[9px] text-[#64748B] uppercase font-bold tracking-wider block">Package / Application</label>
                    <span className="text-xs font-bold text-[#1E293B] block">
                      {selectedLicense.applications 
                        ? `${selectedLicense.applications.app_name} (${selectedLicense.applications.package_name})` 
                        : '-'}
                    </span>
                  </div>

                  <div className="border-t border-gray-200/60 pt-3 mt-3 space-y-2">
                    <div>
                      <label className="text-[9px] text-[#64748B] uppercase font-bold tracking-wider block">License Key</label>
                      <span className="text-xs font-mono font-bold text-[#0EA5E9] select-all block break-all">{selectedLicense.license_key}</span>
                    </div>
                    <div>
                      <label className="text-[9px] text-[#64748B] uppercase font-bold tracking-wider block">License Type</label>
                      <span className="text-xs font-bold text-[#1E293B] block uppercase">{selectedLicense.license_type || selectedLicense.type}</span>
                    </div>
                    {selectedLicense.duration_days && (
                      <div>
                        <label className="text-[9px] text-[#64748B] uppercase font-bold tracking-wider block">Duration Days</label>
                        <span className="text-xs font-bold text-[#1E293B] block">{selectedLicense.duration_days} Days</span>
                      </div>
                    )}
                    <div>
                      <label className="text-[9px] text-[#64748B] uppercase font-bold tracking-wider block">Expires At</label>
                      <span className="text-xs font-bold text-[#1E293B] block">{getExpirationText(selectedLicense)}</span>
                    </div>
                    <div>
                      <label className="text-[9px] text-[#64748B] uppercase font-bold tracking-wider block">Remaining Days</label>
                      <span className={`text-xs font-bold block ${getRemainingDaysText(selectedLicense) === 'Expired' ? 'text-red-500' : 'text-[#1E293B]'}`}>{getRemainingDaysText(selectedLicense)}</span>
                    </div>
                    <div>
                      <label className="text-[9px] text-[#64748B] uppercase font-bold tracking-wider block">Status</label>
                      <span className="text-xs font-bold text-[#1E293B] uppercase block">{selectedLicense.status}</span>
                    </div>
                    {selectedLicense.activated_at && (
                      <div>
                        <label className="text-[9px] text-[#64748B] uppercase font-bold tracking-wider block">Activated At</label>
                        <span className="text-xs text-[#64748B] block">{new Date(selectedLicense.activated_at).toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    {selectedLicense.renewed_at && (
                      <div>
                        <label className="text-[9px] text-[#64748B] uppercase font-bold tracking-wider block">Last Renewed At</label>
                        <span className="text-xs text-[#64748B] block">{new Date(selectedLicense.renewed_at).toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    {selectedLicense.last_validation && (
                      <div>
                        <label className="text-[9px] text-[#64748B] uppercase font-bold tracking-wider block">Last Validated At</label>
                        <span className="text-xs text-[#64748B] block">{new Date(selectedLicense.last_validation).toLocaleString('id-ID')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs font-bold text-slate-500 uppercase tracking-wide">
                No License details loaded.
              </div>
            )}

            <div className="pt-2 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="w-full bg-[#1E293B] hover:bg-[#1E293B]/90 text-white font-bold text-xs py-3 rounded-xl transition-all duration-300 shadow-md uppercase tracking-wide border-none"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4b. Renew License Overlay Modal */}
      {showRenewModal && renewingLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm cursor-pointer">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white/95 border border-white/60 shadow-[10px_10px_30px_rgba(0,0,0,0.1)] p-6 max-w-sm w-full rounded-[20px] space-y-6 cursor-default animate-scale-up"
          >
            <div className="border-b border-gray-100 pb-3 flex justify-between items-center">
              <h4 className="text-sm font-black text-[#1E293B] uppercase tracking-wider">Renew License</h4>
              <button 
                onClick={() => { setShowRenewModal(false); setRenewingLicense(null); }} 
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRenewLicense} className="space-y-4 text-xs">
              <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-xl border border-gray-150">
                <span className="text-[8px] text-[#64748B] uppercase font-bold tracking-widest block">License Key</span>
                <span className="font-mono font-bold text-xs text-[#0EA5E9] block select-all">{renewingLicense.license_key}</span>
                <span className="text-[8px] text-[#64748B] uppercase font-bold tracking-widest block mt-2">Current Expiry</span>
                <span className="font-bold text-xs text-[#1E293B] block">{getExpirationText(renewingLicense)} ({getRemainingDaysText(renewingLicense)})</span>
              </div>

              <div className="space-y-2">
                <label className="block text-[#64748B] uppercase font-bold tracking-wider font-semibold">
                  Add Duration / Convert Type
                </label>
                <select
                  value={renewType}
                  onChange={(e) => setRenewType(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] shadow-sm font-semibold cursor-pointer"
                >
                  <option value="LIFETIME">Convert to Lifetime</option>
                  <option value="TRIAL">Add Trial (7 Days)</option>
                  <option value="30_DAYS">Add 30 Days</option>
                  <option value="90_DAYS">Add 90 Days (3 Months)</option>
                  <option value="180_DAYS">Add 180 Days (6 Months)</option>
                  <option value="365_DAYS">Add 365 Days (1 Year)</option>
                  <option value="CUSTOM">Add Custom Days</option>
                </select>
              </div>

              {renewType === 'CUSTOM' && (
                <div className="space-y-2">
                  <label className="block text-[#64748B] uppercase font-bold tracking-wider font-semibold">
                    Additional Days
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="e.g. 30"
                    value={renewCustomDays}
                    onChange={(e) => setRenewCustomDays(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] shadow-sm font-medium"
                  />
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => { setShowRenewModal(false); setRenewingLicense(null); }}
                  className="bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg transition-all duration-300 font-bold uppercase border-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renewFormLoading}
                  className="bg-[#0EA5E9] hover:bg-[#0ea5e9]/90 text-white px-5 py-2 rounded-lg transition-all duration-300 font-bold uppercase shadow-sm flex items-center space-x-1 border-none"
                >
                  {renewFormLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Renew License</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Success Dialog Switcher */}
      {successKey && (
        showDetailedSuccess ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white/95 border border-white/60 shadow-[10px_10px_30px_rgba(0,0,0,0.15)] p-6 max-w-md w-full rounded-[24px] space-y-5 animate-scale-up">
              
              <div className="text-center space-y-1.5">
                <span className="text-[9px] bg-green-50 text-green-600 border border-green-100 rounded-full px-3 py-1 font-bold uppercase tracking-widest inline-block">
                  Success
                </span>
                <h4 className="text-sm font-black text-[#1E293B] uppercase tracking-wider pt-1">
                  License Successfully Generated
                </h4>
              </div>

              {/* License Key Section */}
              <div className="space-y-1.5 text-left">
                <label className="text-[9px] text-[#64748B] uppercase font-bold tracking-widest block">
                  License Key
                </label>
                <div className="bg-gray-50 border border-gray-200 p-3.5 rounded-xl font-mono text-sm font-black tracking-tight text-[#0EA5E9] select-all text-center shadow-inner break-all">
                  {successKey}
                </div>
              </div>

              {/* Customer Delivery Template Section */}
              <div className="space-y-1.5 text-left">
                <label className="text-[9px] text-[#64748B] uppercase font-bold tracking-widest block">
                  Customer Delivery Template
                </label>
                <textarea
                  readOnly
                  value={generatedTemplate}
                  className="w-full h-48 bg-slate-50 border border-gray-200 rounded-xl p-3 font-mono text-[10px] leading-relaxed text-[#334155] focus:outline-none focus:ring-1 focus:ring-[#0EA5E9] resize-none shadow-inner"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(successKey);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="bg-white hover:bg-gray-50 text-[#1E293B] border border-gray-200 font-bold text-[10px] py-3 rounded-xl transition-all duration-300 shadow-sm flex items-center justify-center space-x-1 uppercase border-none"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <span>Copy License</span>
                  )}
                </button>
                
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedTemplate);
                    setCopiedTemplate(true);
                    setTimeout(() => setCopiedTemplate(false), 2000);
                  }}
                  className="bg-[#0EA5E9] hover:bg-[#0ea5e9]/95 text-white font-bold text-[10px] py-3 rounded-xl transition-all duration-300 shadow-md flex items-center justify-center space-x-1 uppercase border-none"
                >
                  {copiedTemplate ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <span>Copy Template</span>
                  )}
                </button>

                <button
                  onClick={() => {
                    setSuccessKey(null);
                    setShowDetailedSuccess(false);
                  }}
                  className="bg-[#1E293B] hover:bg-[#1E293B]/90 text-white font-bold text-[10px] py-3 rounded-xl transition-all duration-300 shadow-md uppercase border-none"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        ) : (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white/95 border border-white/60 shadow-[10px_10px_30px_rgba(0,0,0,0.15)] p-6 max-w-sm w-full rounded-[24px] text-center space-y-6 animate-scale-up">
              
              <div className="space-y-2">
                <span className="text-[9px] bg-green-50 text-green-600 border border-green-100 rounded-full px-3 py-1 font-bold uppercase tracking-widest">
                  License Key Generated
                </span>
                <h4 className="text-sm font-black text-[#1E293B] uppercase tracking-wider pt-2">Generated License Key</h4>
                <p className="text-xs text-[#64748B]">Send this code to the client device to unlock premium assets.</p>
              </div>

              {/* Generated Key display */}
              <div className="bg-gray-50 border border-gray-200/50 p-4 rounded-2xl font-mono text-base font-black tracking-tight text-[#0EA5E9] select-all break-all shadow-inner">
                {successKey}
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(successKey);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="flex-1 bg-[#0EA5E9] hover:bg-[#0ea5e9]/95 text-white font-bold text-xs py-3 rounded-xl transition-all duration-300 shadow-md flex items-center justify-center space-x-1 uppercase border-none"
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
                  onClick={() => setSuccessKey(null)}
                  className="bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold text-xs px-5 py-3 rounded-xl transition-all duration-300 shadow-sm uppercase border-none"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        )
      )}

    </div>
  );
};
