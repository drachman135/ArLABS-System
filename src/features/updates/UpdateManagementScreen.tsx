import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../core/supabase';
import { RefreshCw, Loader2, Cloud, Calendar, FileText, Server, UploadCloud, HelpCircle, Check, AlertTriangle, X } from 'lucide-react';

interface AppUpdate {
  id: string;
  application_id?: string;
  package_name?: string;
  version_code: number;
  version_name: string;
  changelog: string;
  apk_cloudflare_url: string;
  download_url?: string;
  is_force_update: boolean;
  force_update?: boolean;
  is_active?: boolean;
  created_at: string;
}

interface ApplicationOption {
  id: string;
  package_name: string;
  app_name: string;
}

declare global {
  interface Window {
    AppInfoParser: any;
  }
}

export const UpdateManagementScreen: React.FC = () => {
  const [updates, setUpdates] = useState<AppUpdate[]>([]);
  const [apps, setApps] = useState<ApplicationOption[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitLoading, setSubmitLoading] = useState<boolean>(false);

  // UX & simplification states
  const [latestVersionInfo, setLatestVersionInfo] = useState<string>('Memuat info rilis...');
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [fetchingLatest, setFetchingLatest] = useState<boolean>(false);
  const [versionWarning, setVersionWarning] = useState<string>('');
  const [latestVersionCodeNum, setLatestVersionCodeNum] = useState<number>(0);
  const [latestVersionNameStr, setLatestVersionNameStr] = useState<string>('');
  const [mobileActiveView, setMobileActiveView] = useState<'FORM' | 'HISTORY'>('FORM');

  // Form states
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [versionName, setVersionName] = useState<string>('v1.0.0');
  const [versionCode, setVersionCode] = useState<number>(1);
  const [apkUrl, setApkUrl] = useState<string>('');
  const [changelog, setChangelog] = useState<string>('');
  const [isForce, setIsForce] = useState<boolean>(false);

  // Helper to suggest next patch version (e.g. v1.2.3 -> v1.2.4)
  const suggestNextVersion = (current: string): string => {
    const match = current.match(/^(v?)(\d+)\.(\d+)\.(\d+)$/i);
    if (match) {
      const [_, prefix, major, minor, patch] = match;
      return `${prefix}${major}.${minor}.${parseInt(patch) + 1}`;
    }
    return current;
  };

  // Confirmation Modal
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // File upload states
  const [useManualUrl, setUseManualUrl] = useState<boolean>(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<'IDLE' | 'UPLOADING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string>('');
  const [dragActive, setDragActive] = useState<boolean>(false);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.apk')) {
        startUpload(file);
      } else {
        alert('Hanya berkas format .apk yang diperbolehkan!');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      startUpload(e.target.files[0]);
    }
  };

  const startUpload = (file: File) => {
    // Max 100MB limit for Cloudflare Worker body
    if (file.size > 100 * 1024 * 1024) {
      setUploadStatus('ERROR');
      setUploadErrorMsg('Ukuran file melebihi batas maksimal 100MB.');
      return;
    }

    // Ekstraksi Metadata APK secara otomatis di browser via CDN
    if (window.AppInfoParser) {
      const parser = new window.AppInfoParser(file);
      parser.parse().then((result: any) => {
        const pkg = result.package || (result.manifest && result.manifest.package);
        const verName = result.versionName || (result.manifest && result.manifest.versionName);
        const verCode = result.versionCode || (result.manifest && result.manifest.versionCode);

        console.log("Parsed APK metadata:", { pkg, verName, verCode });

        if (pkg) {
          const matchedApp = apps.find(a => a.package_name.toLowerCase() === pkg.toLowerCase());
          if (matchedApp) {
            setSelectedAppId(matchedApp.id);
            setSelectedPackage(matchedApp.package_name);
          } else {
            console.warn(`Package '${pkg}' belum terdaftar. Tetap mengunggah.`);
          }
        }

        if (verName) {
          setVersionName(verName);
        }

        if (verCode) {
          const codeVal = parseInt(verCode) || 0;
          setVersionCode(codeVal);
        }
      }).catch((err: any) => {
        console.warn("Gagal membaca metadata APK. Menggunakan fallback form.", err);
      });
    }

    setUploadFile(file);
    setUploadProgress(0);
    setUploadStatus('UPLOADING');
    setUploadErrorMsg('');

    const workerUrl = import.meta.env.VITE_CLOUDFLARE_WORKER_URL || 'https://arlabs-apk-uploader.ardevlabs.workers.dev/upload';
    const uploadSecret = import.meta.env.VITE_CLOUDFLARE_UPLOAD_SECRET;

    if (!uploadSecret || uploadSecret === 'YOUR_UPLOAD_SECRET_HERE') {
      setUploadStatus('ERROR');
      setUploadErrorMsg('Kunci rahasia VITE_CLOUDFLARE_UPLOAD_SECRET belum dikonfigurasi di file .env.local.');
      return;
    }

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    const uploadUrl = new URL(workerUrl);
    uploadUrl.searchParams.set('filename', file.name);

    xhr.open('POST', uploadUrl.toString(), true);
    xhr.setRequestHeader('Authorization', `Bearer ${uploadSecret}`);

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percentComplete);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          if (response.success && response.url) {
            setApkUrl(response.url);
            setUploadStatus('SUCCESS');
          } else {
            throw new Error(response.error || 'Respons gagal dari server');
          }
        } catch (err: any) {
          setUploadStatus('ERROR');
          setUploadErrorMsg(`Gagal memproses respons: ${err?.message || 'Format tidak valid'}`);
        }
      } else {
        setUploadStatus('ERROR');
        setUploadErrorMsg(`Gagal mengunggah file (${xhr.status}): ${xhr.statusText || 'Kesalahan jaringan'}`);
      }
    });

    xhr.addEventListener('error', () => {
      setUploadStatus('ERROR');
      setUploadErrorMsg('Kesalahan jaringan saat menghubungi Cloudflare Worker.');
    });

    xhr.send(file);
  };

  const resetUpload = () => {
    setUploadFile(null);
    setUploadProgress(0);
    setUploadStatus('IDLE');
    setUploadErrorMsg('');
    setApkUrl('');
    xhrRef.current = null;
  };

  const cancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setUploadFile(null);
    setUploadProgress(0);
    setUploadStatus('IDLE');
    setUploadErrorMsg('');
  };

  // Fetch applications list for dynamic dropdown
  const fetchAppsDropdown = async () => {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('id, package_name, app_name')
        .order('app_name', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setApps(data);
        setSelectedAppId(data[0].id);
        setSelectedPackage(data[0].package_name);
      } else {
        throw new Error('No applications registered.');
      }
    } catch (err) {
      console.warn('Failed to fetch applications for dropdown. Utilizing fallback packages.', err);
      const fallbackApps = [
        { id: 'app-1', package_name: 'com.arlabs.client', app_name: 'ArLABS Android Client' },
        { id: 'app-2', package_name: 'com.arlabs.pos', app_name: 'ArLABS POS Companion' }
      ];
      setApps(fallbackApps);
      setSelectedAppId(fallbackApps[0].id);
      setSelectedPackage(fallbackApps[0].package_name);
    }
  };

  // Fetch latest version info for the selected application to auto-suggest version and code
  const fetchLatestVersionInfo = async (appId: string) => {
    if (!appId) return;
    setFetchingLatest(true);
    setLatestVersionInfo('Memuat versi terakhir...');
    try {
      const { data, error } = await supabase
        .from('application_versions')
        .select('version_name, version_code')
        .eq('application_id', appId)
        .order('version_code', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setLatestVersionInfo(`Terakhir: ${data.version_name} (Code: ${data.version_code})`);
        setLatestVersionCodeNum(data.version_code);
        setLatestVersionNameStr(data.version_name);
        setVersionCode(data.version_code + 1);
        setVersionName(suggestNextVersion(data.version_name));
      } else {
        setLatestVersionInfo('Belum ada rilis versi terdaftar');
        setLatestVersionCodeNum(0);
        setLatestVersionNameStr('');
        setVersionCode(1);
        setVersionName('v1.0.0');
      }
    } catch (err) {
      console.warn('Failed to query latest version from DB. Setting fallback suggestions.', err);
      setLatestVersionInfo('Gagal memuat info versi (Menggunakan fallback)');
      
      // If error occurs, read from current local history of updates as fallback
      const matchingUpdates = updates.filter(u => u.application_id === appId);
      if (matchingUpdates.length > 0) {
        const sorted = [...matchingUpdates].sort((a, b) => b.version_code - a.version_code);
        const latest = sorted[0];
        setLatestVersionInfo(`Terakhir (Lokal): ${latest.version_name} (Code: ${latest.version_code})`);
        setLatestVersionCodeNum(latest.version_code);
        setLatestVersionNameStr(latest.version_name);
        setVersionCode(latest.version_code + 1);
        setVersionName(suggestNextVersion(latest.version_name));
      } else {
        setLatestVersionCodeNum(0);
        setLatestVersionNameStr('');
        setVersionCode(1);
        setVersionName('v1.0.0');
      }
    } finally {
      setFetchingLatest(false);
    }
  };

  // Feature 1: Toggle release active state in Supabase
  const toggleReleaseActiveState = async (id: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;
      const { error } = await supabase
        .from('application_versions')
        .update({ is_active: newStatus })
        .eq('id', id);

      if (error) throw error;

      // Update state locally
      setUpdates(prev => prev.map(upd => upd.id === id ? { ...upd, is_active: newStatus } : upd));
    } catch (err: any) {
      console.error("Gagal mengubah status aktif rilis:", err);
      alert("Gagal mengubah status aktif: " + err.message);
    }
  };

  // Helper: Extract filename from URL
  const getFilenameFromUrl = (url: string): string => {
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname;
      return pathname.substring(pathname.lastIndexOf('/') + 1);
    } catch {
      return '';
    }
  };

  // Feature 3: Delete release from DB and R2
  const deleteRelease = async (id: string, downloadUrl: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus rilis ini secara permanen?")) {
      return;
    }

    const deleteApkFromR2 = window.confirm("Apakah Anda juga ingin menghapus berkas biner APK fisik dari Cloudflare R2?");

    try {
      // 1. Delete from database
      const { error } = await supabase
        .from('application_versions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // 2. Best-effort delete from Cloudflare R2
      if (deleteApkFromR2 && downloadUrl) {
        const filename = getFilenameFromUrl(downloadUrl);
        if (filename) {
          const workerUrl = import.meta.env.VITE_CLOUDFLARE_WORKER_URL || 'https://arlabs-apk-uploader.ardevlabs.workers.dev/upload';
          const uploadSecret = import.meta.env.VITE_CLOUDFLARE_UPLOAD_SECRET;
          
          const deleteUrl = new URL(workerUrl);
          deleteUrl.searchParams.set('filename', filename);

          await fetch(deleteUrl.toString(), {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${uploadSecret}`
            }
          }).then(res => {
            if (res.ok) {
              console.log("Fisik APK berhasil dihapus dari Cloudflare R2.");
            } else {
              console.warn("Cloudflare R2 merespons dengan status: " + res.status);
            }
          }).catch(err => {
            console.warn("Gagal menghubungi Cloudflare R2 untuk penghapusan berkas:", err);
          });
        }
      }

      // Update local state
      setUpdates(prev => prev.filter(upd => upd.id !== id));
      alert("Rilis berhasil dihapus.");
    } catch (err: any) {
      console.error("Gagal menghapus rilis:", err);
      alert("Gagal menghapus rilis: " + err.message);
    }
  };

  // Feature 2: Send FCM update push notifications
  const sendFcmNotification = async (notifTitle: string, notifBody: string, targetTokenOrTopic: string) => {
    try {
      const response = await fetch('/api/send-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: notifTitle,
          body: notifBody,
          targetTokenOrTopic
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to send notification: ${response.statusText}`);
      }
      return true;
    } catch (err) {
      console.warn("Gagal mengirimkan push notification FCM:", err);
      return false;
    }
  };

  // Feature 4: Changelog quick tags helper
  const appendChangelogTag = (tag: string) => {
    setChangelog(prev => {
      const bullet = prev ? `\n- ${tag}: ` : `- ${tag}: `;
      return prev + bullet;
    });
  };

  // Fetch recent updates
  const fetchUpdates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('application_versions')
        .select('id, application_id, version_code, version_name, changelog, download_url, force_update, is_active, created_at, applications(package_name)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        // Map the structure of application_versions to AppUpdate
        const mappedData: AppUpdate[] = data.map((item: any) => ({
          id: item.id,
          application_id: item.application_id,
          package_name: item.applications?.package_name || 'unknown',
          version_code: item.version_code,
          version_name: item.version_name,
          changelog: item.changelog || '',
          apk_cloudflare_url: item.download_url || '',
          download_url: item.download_url || '',
          is_force_update: !!item.force_update,
          force_update: !!item.force_update,
          is_active: item.is_active !== false,
          created_at: item.created_at
        }));
        setUpdates(mappedData);
      } else {
        setUpdates([]);
      }
    } catch (err) {
      console.warn('application_versions table query failed. Setting local sandbox history list.', err);
      // Fallback sandbox mockup history logs
      setUpdates([
        { 
          id: 'upd-1', 
          package_name: 'com.arlabs.client',
          version_code: 11, 
          version_name: 'v1.1.5', 
          changelog: '- Fixed offline licensing registration validation check\n- Hardened PostgreSQL row security partitions', 
          apk_cloudflare_url: 'https://cdn.arlabs.io/apk/release-v1.1.5.apk', 
          is_force_update: false, 
          created_at: new Date(Date.now() - 86400000 * 3).toISOString() 
        },
        { 
          id: 'upd-2', 
          package_name: 'com.arlabs.pos',
          version_code: 10, 
          version_name: 'v1.1.0', 
          changelog: '- Initial APK release to CDN storage\n- Embedded multi-tenant auth gateways', 
          apk_cloudflare_url: 'https://cdn.arlabs.io/apk/release-v1.1.0.apk', 
          is_force_update: true, 
          created_at: new Date(Date.now() - 86400000 * 10).toISOString() 
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpdates();
    fetchAppsDropdown();
  }, []);

  useEffect(() => {
    if (selectedAppId) {
      fetchLatestVersionInfo(selectedAppId);
    }
  }, [selectedAppId]);

  // Validation useEffect for warning if version code/name is lower or equal to database
  useEffect(() => {
    if (!latestVersionCodeNum) {
      setVersionWarning('');
      return;
    }

    let warning = '';
    
    // 1. Compare version codes
    if (versionCode <= latestVersionCodeNum) {
      warning = `Version Code (${versionCode}) lebih rendah atau sama dengan versi terakhir di database (Code: ${latestVersionCodeNum}).`;
    }
    
    // 2. Compare version names
    else if (versionName && latestVersionNameStr) {
      const cleanNew = versionName.replace(/^v/i, '').trim();
      const cleanOld = latestVersionNameStr.replace(/^v/i, '').trim();
      if (cleanNew === cleanOld) {
        warning = `Version Name (${versionName}) sama dengan versi rilis terakhir di database.`;
      }
    }

    setVersionWarning(warning);
  }, [versionCode, versionName, latestVersionCodeNum, latestVersionNameStr]);

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirmModal(true);
  };

  // Perform database insert after confirmation
  const executeDeployRelease = async () => {
    setShowConfirmModal(false);
    setSubmitLoading(true);

    const newRelease = {
      application_id: selectedAppId,
      version_code: versionCode,
      version_name: versionName,
      changelog: changelog,
      download_url: apkUrl,
      force_update: isForce,
      is_active: true,
      created_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase
        .from('application_versions')
        .insert([newRelease]);

      if (error) throw error;

      // Ambil nilai sebelum di-reset untuk push notification
      const releasedVersionName = versionName;
      const releasedPackageName = selectedPackage;
      const releasedAppId = selectedAppId;

      // Reset form fields
      setApkUrl('');
      setChangelog('');
      
      // Re-fetch history
      await fetchUpdates();

      // Re-fetch latest version info to update suggestion labels
      await fetchLatestVersionInfo(selectedAppId);

      // Kirim Notifikasi Push FCM otomatis ke perangkat client POS yang bersangkutan
      try {
        const notifTitle = `Pembaruan Aplikasi Tersedia`;
        const notifBody = `Versi ${releasedVersionName} (${releasedPackageName}) sudah dirilis. Silakan perbarui aplikasi Anda.`;
        const topic = `/topics/${releasedAppId}`;
        
        console.log(`Broadcasting FCM Release Update: ${notifTitle} to ${topic}`);
        await sendFcmNotification(notifTitle, notifBody, topic);
      } catch (fcmErr) {
        console.warn("Gagal mengirimkan push notification otomatis:", fcmErr);
      }

    } catch (err) {
      console.warn('Failed to insert metadata into application_versions table. Syncing local sandbox state.', err);
      // Offline fallback simulator
      const simulated: AppUpdate = {
        id: `upd-sim-${Date.now()}`,
        application_id: selectedAppId,
        package_name: selectedPackage,
        version_code: versionCode,
        version_name: versionName,
        changelog: changelog,
        apk_cloudflare_url: apkUrl,
        download_url: apkUrl,
        is_force_update: isForce,
        force_update: isForce,
        created_at: new Date().toISOString()
      };

      setUpdates(prev => [simulated, ...prev]);

      setLatestVersionInfo(`Terakhir (Lokal): ${versionName} (Code: ${versionCode})`);
      setVersionCode(versionCode + 1);
      setVersionName(suggestNextVersion(versionName));

      setApkUrl('');
      setChangelog('');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 font-['Outfit'] select-none">
      
      {/* 1. Frosted Glass Action Header Panel */}
      <section className="bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] hover:shadow-[10px_10px_20px_#d1d5db,-10px_-10px_20px_#ffffff] transition-all duration-300 p-4 sm:p-6 rounded-[24px] flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="w-full">
          <span className="tracking-widest text-[9px] font-bold text-[#64748B] uppercase">OTA CDN Deployment</span>
          <h3 className="text-base font-black text-[#1E293B] tracking-tight mt-1 break-all">SYS // OTA_UPDATE_MANAGER</h3>
        </div>

        <button
          onClick={() => { fetchUpdates(); fetchAppsDropdown(); }}
          className="border border-white bg-white hover:border-[#0EA5E9]/50 hover:bg-[#0EA5E9]/10 text-[#1E293B] hover:text-[#0EA5E9] p-2.5 rounded-xl transition-all duration-300 shadow-sm flex items-center justify-center self-end sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </section>

      {/* Mobile-Only Segmented Tab Control */}
      <div className="flex lg:hidden bg-white/85 backdrop-blur-md border border-white/60 p-1.5 rounded-2xl shadow-[4px_4px_10px_rgba(0,0,0,0.05)]">
        <button
          type="button"
          onClick={() => setMobileActiveView('FORM')}
          className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all duration-300 cursor-pointer border border-transparent ${
            mobileActiveView === 'FORM'
              ? 'bg-[#0EA5E9] text-white shadow-sm'
              : 'text-[#64748B] hover:text-[#1E293B]'
          }`}
        >
          Publish Update
        </button>
        <button
          type="button"
          onClick={() => setMobileActiveView('HISTORY')}
          className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all duration-300 cursor-pointer border border-transparent ${
            mobileActiveView === 'HISTORY'
              ? 'bg-[#0EA5E9] text-white shadow-sm'
              : 'text-[#64748B] hover:text-[#1E293B]'
          }`}
        >
          History Logs ({updates.length})
        </button>
      </div>

      {/* 2. Decoupled Form and Logs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Release Deployer Form (5 cols) */}
        <div className={`lg:col-span-5 space-y-6 ${mobileActiveView === 'FORM' ? 'block' : 'hidden lg:block'}`}>
          <div className="flex items-center space-x-2 text-[#64748B]">
            <UploadCloud className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Publish New Release</span>
          </div>

          <form onSubmit={handleOpenConfirm} className="bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] p-6 rounded-[24px] space-y-6">
            
            {/* App Package Dropdown */}
            <div className="space-y-2">
              <label className="block text-[9px] text-[#64748B] uppercase font-bold tracking-widest">
                Target Application Package
              </label>
              <select
                value={selectedAppId}
                onChange={(e) => {
                  const appId = e.target.value;
                  setSelectedAppId(appId);
                  const matched = apps.find(a => a.id === appId);
                  if (matched) {
                    setSelectedPackage(matched.package_name);
                  }
                }}
                className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] cursor-pointer shadow-sm font-bold"
              >
                {apps.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.app_name} [{app.package_name}]
                  </option>
                ))}
              </select>
              
              {/* Info Versi Terakhir */}
              <div className="flex justify-between items-center px-2 py-1 bg-gray-50 border border-gray-100 rounded-md">
                <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider">Status Versi Terakhir:</span>
                <span className={`text-[9px] font-black font-mono ${
                  fetchingLatest ? 'text-[#0EA5E9] animate-pulse' : 'text-gray-600'
                }`}>
                  {latestVersionInfo}
                </span>
              </div>
            </div>

            {/* Cloudflare CDN Url with File Uploader */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <label className="block text-[9px] text-[#64748B] uppercase font-bold tracking-widest">
                  APK Binary File / Storage Link
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setUseManualUrl(!useManualUrl);
                    resetUpload();
                  }}
                  className="text-[9px] text-[#0EA5E9] hover:underline font-bold text-left sm:text-right"
                >
                  {useManualUrl ? 'Gunakan File Uploader' : 'Masukkan URL Manual'}
                </button>
              </div>

              {useManualUrl ? (
                <input
                  type="url"
                  required
                  placeholder="https://cdn.arlabs.io/apk/release-v1.2.0.apk"
                  value={apkUrl}
                  onChange={(e) => setApkUrl(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] font-mono shadow-sm"
                />
              ) : (
                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-[20px] p-6 text-center transition-all duration-300 ${
                    dragActive 
                      ? 'border-[#0EA5E9] bg-[#0EA5E9]/5' 
                      : uploadStatus === 'SUCCESS'
                        ? 'border-green-500 bg-green-50/20'
                        : uploadStatus === 'ERROR'
                          ? 'border-red-500 bg-red-50/20'
                          : 'border-gray-200 bg-white/50 hover:border-[#0EA5E9]/50'
                  }`}
                >
                  {uploadStatus === 'IDLE' && (
                    <label className="cursor-pointer flex flex-col items-center space-y-2 py-2">
                      <UploadCloud className="w-8 h-8 text-[#64748B] hover:text-[#0EA5E9] transition-colors" />
                      <span className="text-xs font-bold text-[#1E293B]">Klik untuk cari berkas atau seret berkas ke sini</span>
                      <span className="text-[9px] text-[#64748B] uppercase font-semibold">Format: .apk (Maks. 100MB)</span>
                      <input 
                        type="file" 
                        accept=".apk"
                        onChange={handleFileSelect}
                        className="hidden" 
                      />
                    </label>
                  )}

                  {uploadStatus === 'UPLOADING' && (
                    <div className="space-y-3 py-2">
                      <div className="flex justify-between items-center text-xs font-semibold text-[#1E293B]">
                        <span className="truncate max-w-[180px]">{uploadFile?.name}</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-[#0EA5E9] h-1.5 transition-all duration-300 rounded-full" 
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-[9px] text-[#64748B] uppercase tracking-wider animate-pulse">Mengunggah file ke Cloudflare R2...</p>
                      <button
                        type="button"
                        onClick={cancelUpload}
                        className="flex items-center justify-center space-x-1.5 w-full text-[9px] bg-white border border-red-200 hover:bg-red-50 hover:border-red-400 text-red-500 hover:text-red-700 font-bold px-3 py-1.5 rounded-lg transition-all duration-200 shadow-sm uppercase tracking-wider"
                      >
                        <X className="w-3 h-3" />
                        <span>Batalkan Upload</span>
                      </button>
                    </div>
                  )}

                  {uploadStatus === 'SUCCESS' && (
                    <div className="flex flex-col items-center space-y-2">
                      <Check className="w-8 h-8 text-green-500 animate-bounce" />
                      <span className="text-xs font-bold text-green-600">Berhasil Diunggah!</span>
                      <span className="text-[10px] text-[#64748B] truncate max-w-[300px] font-mono block">{apkUrl}</span>
                      <button
                        type="button"
                        onClick={resetUpload}
                        className="text-[9px] bg-white border border-gray-200 hover:border-gray-300 text-[#1E293B] font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                      >
                        Ganti File
                      </button>
                    </div>
                  )}

                  {uploadStatus === 'ERROR' && (
                    <div className="flex flex-col items-center space-y-2">
                      <AlertTriangle className="w-8 h-8 text-red-500 animate-pulse" />
                      <span className="text-xs font-bold text-red-600">Gagal Mengunggah Berkas</span>
                      <span className="text-[9px] text-red-500 max-w-[280px] leading-relaxed block">{uploadErrorMsg}</span>
                      <button
                        type="button"
                        onClick={resetUpload}
                        className="text-[9px] bg-white border border-red-200 hover:bg-red-50 text-red-600 font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                      >
                        Coba Lagi
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Version Metadata inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-[9px] text-[#64748B] uppercase font-bold tracking-wider">
                  Version Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. v1.2.0"
                  value={versionName}
                  onChange={(e) => setVersionName(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] font-mono shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[9px] text-[#64748B] uppercase font-bold tracking-wider">
                  Version Code (Integer)
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 12"
                  value={versionCode}
                  onChange={(e) => setVersionCode(parseInt(e.target.value) || 0)}
                  className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] font-mono shadow-sm"
                />
              </div>
            </div>

            {/* Changelog Editor */}
            <div className="space-y-2">
              <label className="block text-[9px] text-[#64748B] uppercase font-bold tracking-wider">
                Release Changelog Notes
              </label>
              <textarea
                required
                rows={3}
                placeholder="- Added Sunmi printer integration&#10;- Optimized SQL queries for customer tables"
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] shadow-sm resize-none"
              />
              {/* Quick Changelog Tags */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => appendChangelogTag('Fitur Baru')}
                  className="px-2.5 py-1 text-[8px] font-bold bg-sky-50 hover:bg-[#0EA5E9]/10 text-[#0EA5E9] border border-[#0EA5E9]/20 rounded-md transition-all uppercase cursor-pointer"
                >
                  + Fitur Baru
                </button>
                <button
                  type="button"
                  onClick={() => appendChangelogTag('Perbaikan Bug')}
                  className="px-2.5 py-1 text-[8px] font-bold bg-red-55 hover:bg-red-100/10 text-red-500 border border-red-200/40 rounded-md transition-all uppercase cursor-pointer"
                >
                  🐞 Bug Fix
                </button>
                <button
                  type="button"
                  onClick={() => appendChangelogTag('Optimasi Performa')}
                  className="px-2.5 py-1 text-[8px] font-bold bg-amber-55 hover:bg-amber-100/10 text-amber-600 border border-amber-200/40 rounded-md transition-all uppercase cursor-pointer"
                >
                  ⚡ Optimasi
                </button>
                <button
                  type="button"
                  onClick={() => appendChangelogTag('Keamanan')}
                  className="px-2.5 py-1 text-[8px] font-bold bg-green-55 hover:bg-green-100/10 text-green-600 border border-green-200/40 rounded-md transition-all uppercase cursor-pointer"
                >
                  🔒 Keamanan
                </button>
              </div>
            </div>

            {/* Update Enforcement Toggle Splitter */}
            <div className="space-y-2">
              <label className="block text-[9px] text-[#64748B] uppercase font-bold tracking-widest">
                Enforcement Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsForce(true)}
                  className={`py-2 px-1 text-[10px] font-bold rounded-lg border transition-all duration-300 uppercase ${
                    isForce
                      ? 'bg-red-500 text-white border-transparent shadow-sm'
                      : 'bg-white border-gray-200 text-[#64748B] hover:text-[#1E293B]'
                  }`}
                >
                  Force Update
                </button>
                <button
                  type="button"
                  onClick={() => setIsForce(false)}
                  className={`py-2 px-1 text-[10px] font-bold rounded-lg border transition-all duration-300 uppercase ${
                    !isForce
                      ? 'bg-[#0EA5E9] text-white border-transparent shadow-sm'
                      : 'bg-white border-gray-200 text-[#64748B] hover:text-[#1E293B]'
                  }`}
                >
                  Optional Update
                </button>
              </div>
            </div>

            {/* Peringatan Downgrade/Konflik Versi */}
            {versionWarning && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-xl flex items-start space-x-2 animate-pulse shadow-sm">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="text-[10px] font-black uppercase tracking-wider block text-amber-900">Peringatan Konflik Versi</span>
                  <span className="text-[10px] leading-relaxed block font-semibold">{versionWarning}</span>
                </div>
              </div>
            )}

            {/* Submit deploy */}
            <button
              type="submit"
              disabled={submitLoading}
              className="w-full bg-[#0EA5E9] hover:bg-[#0ea5e9]/95 text-white font-bold text-xs py-3 rounded-xl transition-all duration-300 shadow-[2px_2px_5px_rgba(14,165,233,0.3)] flex items-center justify-center space-x-2 active:scale-98"
            >
              {submitLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Cloud className="w-4 h-4" />
                  <span>[ Publish Update ]</span>
                </>
              )}
            </button>

          </form>
        </div>

        {/* Right Side: Update History Logs (7 cols) */}
        <div className={`lg:col-span-7 space-y-6 ${mobileActiveView === 'HISTORY' ? 'block' : 'hidden lg:block'}`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2 text-[#64748B]">
              <Server className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Release Deployment History</span>
            </div>
            <span className="text-[10px] text-gray-400 font-bold font-mono">
              Filter: {activeTab === 'ALL' ? 'Semua Aplikasi' : activeTab}
            </span>
          </div>

          {/* App Tab Filters */}
          <div className="flex flex-wrap gap-2 pb-1 border-b border-gray-100">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all duration-200 border border-transparent ${
                activeTab === 'ALL'
                  ? 'bg-[#0EA5E9] text-white shadow-sm'
                  : 'bg-white border-gray-200 text-gray-500 hover:text-gray-800'
              }`}
            >
              Semua
            </button>
            {apps.map((app) => (
              <button
                key={app.id}
                onClick={() => setActiveTab(app.package_name)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-200 flex items-center space-x-1.5 border border-transparent ${
                  activeTab === app.package_name
                    ? 'bg-[#0EA5E9] text-white shadow-sm'
                    : 'bg-white border-gray-200 text-gray-500 hover:text-gray-800'
                }`}
              >
                <span>{app.app_name}</span>
                <span className={`text-[8px] font-mono rounded px-1 py-0.25 ${
                  activeTab === app.package_name 
                    ? 'bg-white/20 text-white' 
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {app.package_name}
                </span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="bg-white/80 border border-white/60 p-12 rounded-[24px] text-center text-[#64748B] shadow-sm flex items-center justify-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#0EA5E9]" />
              <span>Querying update history logs...</span>
            </div>
          ) : updates.length === 0 ? (
            <div className="bg-white/80 border border-white/60 p-12 rounded-[24px] text-center text-[#64748B] shadow-sm uppercase font-bold text-xs tracking-wider">
              NO_DEPLOYED_VERSIONS_FOUND
            </div>
          ) : (
            <div className="space-y-4">
              {(() => {
                const filtered = updates.filter(upd => activeTab === 'ALL' || upd.package_name === activeTab);
                if (filtered.length === 0) {
                  return (
                    <div className="bg-white/80 border border-white/60 p-12 rounded-[24px] text-center text-[#64748B] shadow-sm uppercase font-bold text-xs tracking-wider">
                      Belum ada versi dirilis untuk aplikasi ini
                    </div>
                  );
                }
                return filtered.map((upd) => (
                  <div
                    key={upd.id}
                    className="bg-white/80 border border-white/60 shadow-[4px_4px_8px_#d1d5db,-4px_-4px_8px_#ffffff] hover:shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] transition-all duration-300 p-6 rounded-[20px] space-y-4"
                  >
                    <div className="flex justify-between items-center pb-2.5 border-b border-gray-100">
                      <div className="flex items-center space-x-2.5">
                        <span className="text-sm font-black text-[#1E293B]">{upd.version_name}</span>
                        <span className="text-[10px] bg-gray-100 text-gray-500 border border-gray-200 rounded px-2 py-0.5 font-mono">
                          Code: {upd.version_code}
                        </span>
                        {upd.package_name && (
                          <span className="text-[9px] text-[#0EA5E9] font-mono border border-[#0EA5E9]/20 bg-[#0EA5E9]/5 rounded px-2 py-0.5">
                            {upd.package_name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 text-[9px] font-bold">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-[#64748B]">{new Date(upd.created_at).toLocaleDateString()}</span>
                        
                        <span className={`px-2 py-0.5 rounded ml-2 uppercase text-[8px] ${
                          upd.is_force_update 
                            ? 'bg-red-50 text-red-600 border border-red-100' 
                            : 'bg-sky-50 text-[#0EA5E9] border border-sky-100'
                        }`}>
                          {upd.is_force_update ? 'Force' : 'Optional'}
                        </span>
                      </div>
                    </div>

                    {/* CDN APK Link */}
                    <div className="bg-gray-50 border border-gray-100 p-2.5 rounded-lg text-[9px] font-mono text-gray-500 break-all select-all shadow-inner">
                      URL: {upd.apk_cloudflare_url}
                    </div>

                    {/* Changelog Notes */}
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-[#64748B] uppercase flex items-center space-x-1">
                        <FileText className="w-3.5 h-3.5 mr-1" />
                        Changelog notes
                      </span>
                      <pre className="text-[10px] text-[#1E293B] font-sans leading-relaxed whitespace-pre-wrap pl-1">
                        {upd.changelog}
                      </pre>
                    </div>

                    {/* Tombol Kontrol Rollback & Hapus Rilis */}
                    <div className="flex justify-between items-center pt-3 border-t border-gray-100 mt-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-[9px] text-[#64748B] uppercase font-bold tracking-wider">Status Distribusi:</span>
                        <button
                          type="button"
                          onClick={() => toggleReleaseActiveState(upd.id, upd.is_active !== false)}
                          className={`px-3 py-1 rounded-md text-[9px] font-bold uppercase transition-all duration-300 cursor-pointer border border-transparent ${
                            upd.is_active !== false
                              ? 'bg-green-500 text-white shadow-sm hover:bg-green-600'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {upd.is_active !== false ? '● Aktif' : '○ Nonaktif (Rollback)'}
                        </button>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => deleteRelease(upd.id, upd.apk_cloudflare_url || upd.download_url || '')}
                        className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 rounded-md text-[9px] font-bold uppercase transition-all duration-200 border border-red-200/40 cursor-pointer"
                      >
                        Hapus Rilis
                      </button>
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>

      </div>

      {/* 3. Neumorphic Glass & Frost Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white/95 border border-white/60 shadow-[10px_10px_30px_rgba(0,0,0,0.15)] p-6 max-w-sm w-full rounded-[24px] text-center space-y-6 animate-scale-up">
            <div className="flex flex-col items-center space-y-2">
              <HelpCircle className="w-12 h-12 text-[#0EA5E9] animate-pulse" />
              <h4 className="text-sm font-black text-[#1E293B] uppercase tracking-wider pt-2">Confirm Release Publish</h4>
            </div>

            <p className="text-xs text-[#64748B] leading-relaxed">
              Are you sure you want to push Version <span className="font-bold text-[#1E293B]">{versionName}</span> to Package <span className="font-mono text-[#0EA5E9] font-bold">{selectedPackage}</span>?
            </p>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold text-xs py-3 rounded-xl transition-all duration-300 shadow-sm uppercase"
              >
                [ Cancel_Abort ]
              </button>
              <button
                onClick={executeDeployRelease}
                className="flex-1 bg-[#0EA5E9] hover:bg-[#0ea5e9]/95 text-white font-bold text-xs py-3 rounded-xl transition-all duration-300 shadow-md uppercase"
              >
                [ Confirm_Execute ]
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
