import React, { useEffect, useState, useRef } from 'react';
import { 
  RefreshCw, 
  Search, 
  Trash2, 
  Copy, 
  Check, 
  ExternalLink, 
  UploadCloud, 
  AlertTriangle, 
  FileText, 
  Image as ImageIcon, 
  HardDrive, 
  FolderOpen,
  FileCheck,
  FileCode
} from 'lucide-react';

interface R2File {
  key: string;
  size: number;
  uploaded: string;
  url: string;
}

export const CloudflareFileManagerScreen: React.FC = () => {
  const [files, setFiles] = useState<R2File[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'apk' | 'images' | 'json' | 'other'>('all');
  
  // Upload states
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<'IDLE' | 'UPLOADING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string>('');
  
  // Worker Method Not Allowed Error (405) indicator
  const [worker405Error, setWorker405Error] = useState<boolean>(false);
  const [generalError, setGeneralError] = useState<string>('');

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const workerUrl = import.meta.env.VITE_CLOUDFLARE_WORKER_URL || 'https://arlabs-apk-uploader.ardevlabs.workers.dev/upload';
  const uploadSecret = import.meta.env.VITE_CLOUDFLARE_UPLOAD_SECRET;

  useEffect(() => {
    fetchFiles();
    return () => {
      if (xhrRef.current) {
        xhrRef.current.abort();
      }
    };
  }, []);

  const fetchFiles = async () => {
    setLoading(true);
    setWorker405Error(false);
    setGeneralError('');
    
    if (!uploadSecret || uploadSecret === 'YOUR_UPLOAD_SECRET_HERE') {
      setGeneralError('Kunci rahasia VITE_CLOUDFLARE_UPLOAD_SECRET belum dikonfigurasi di file .env.local.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(workerUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${uploadSecret}`
        }
      });

      if (response.status === 405) {
        setWorker405Error(true);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error(`Worker merespons dengan status ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.files)) {
        setFiles(data.files);
      } else {
        throw new Error(data.error || 'Struktur data tidak valid');
      }
    } catch (err: any) {
      console.error('Gagal mengambil daftar file:', err);
      setGeneralError(err.message || 'Gagal menghubungi Cloudflare Worker.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = (url: string, key: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }).catch(err => {
      console.error('Gagal menyalin URL:', err);
    });
  };

  const handleDeleteFile = async (filename: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus berkas "${filename}" secara permanen dari Cloudflare R2?`)) {
      return;
    }

    try {
      const deleteUrl = new URL(workerUrl);
      deleteUrl.searchParams.set('filename', filename);

      const response = await fetch(deleteUrl.toString(), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${uploadSecret}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setFiles(prev => prev.filter(f => f.key !== filename));
        alert('Berkas berhasil dihapus.');
      } else {
        throw new Error(data.error || 'Gagal menghapus berkas');
      }
    } catch (err: any) {
      console.error('Gagal menghapus berkas:', err);
      alert(`Gagal menghapus berkas: ${err.message}`);
    }
  };

  // Upload Logic
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const uploadFile = (file: File) => {
    setUploadProgress(0);
    setUploadStatus('UPLOADING');
    setUploadErrorMsg('');

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
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

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
          if (response.success) {
            setUploadStatus('SUCCESS');
            fetchFiles(); // Refresh file list
            setTimeout(() => {
              setUploadStatus('IDLE');
            }, 3000);
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

  const cancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setUploadStatus('IDLE');
    setUploadProgress(0);
  };

  // Helper formatting
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'apk') return <FileCheck className="w-5 h-5 text-emerald-500" />;
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext || '')) return <ImageIcon className="w-5 h-5 text-blue-500" />;
    if (ext === 'json') return <FileCode className="w-5 h-5 text-amber-500" />;
    return <FileText className="w-5 h-5 text-slate-500" />;
  };

  // Filtering files
  const filteredFiles = files.filter(file => {
    const matchesSearch = file.key.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filterType === 'all') return true;
    const ext = file.key.split('.').pop()?.toLowerCase();
    if (filterType === 'apk') return ext === 'apk';
    if (filterType === 'images') return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext || '');
    if (filterType === 'json') return ext === 'json';
    if (filterType === 'other') return ext !== 'apk' && !['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'json'].includes(ext || '');
    return true;
  });

  const totalStorageSize = files.reduce((acc, file) => acc + file.size, 0);

  const workerCodeTemplate = `export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const authHeader = request.headers.get("Authorization");

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (!authHeader || authHeader !== \`Bearer \${env.UPLOAD_SECRET}\`) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const bucket = env.R2_BUCKET; // Pastikan binding R2 bucket di Cloudflare bernama R2_BUCKET

    if (request.method === "GET") {
      try {
        const listed = await bucket.list({ limit: 100 });
        const files = listed.objects.map(obj => ({
          key: obj.key,
          size: obj.size,
          uploaded: obj.uploaded,
          url: env.CDN_URL ? \`\${env.CDN_URL}/\${obj.key}\` : \`https://pub-your-id.r2.dev/\${obj.key}\`
        }));
        
        return new Response(JSON.stringify({ success: true, files }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    if (request.method === "POST") {
      try {
        const filename = url.searchParams.get("filename");
        if (!filename) {
          return new Response(JSON.stringify({ success: false, error: "Filename is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
        const body = await request.arrayBuffer();
        await bucket.put(filename, body, {
          httpMetadata: { contentType: request.headers.get("content-type") || "application/octet-stream" }
        });
        const downloadUrl = env.CDN_URL ? \`\${env.CDN_URL}/\${filename}\` : \`https://pub-your-id.r2.dev/\${filename}\`;
        return new Response(JSON.stringify({ success: true, url: downloadUrl }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    if (request.method === "DELETE") {
      try {
        const filename = url.searchParams.get("filename");
        if (!filename) {
          return new Response(JSON.stringify({ success: false, error: "Filename parameter is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
        await bucket.delete(filename);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};`;

  return (
    <div className="space-y-6">
      
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-[#E6E9EF] neu-flat flex items-center space-x-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-blue-100 text-blue-600 neu-convex">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-wider text-[#A0AEC0]">Total Storage Terpakai</h4>
            <p className="text-xl font-black text-[#2D3748] mt-0.5">{formatBytes(totalStorageSize)}</p>
          </div>
        </div>
        
        <div className="p-6 rounded-2xl bg-[#E6E9EF] neu-flat flex items-center space-x-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-emerald-100 text-emerald-600 neu-convex">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-wider text-[#A0AEC0]">Total Berkas R2</h4>
            <p className="text-xl font-black text-[#2D3748] mt-0.5">{files.length} Berkas</p>
          </div>
        </div>
      </div>

      {/* Cloudflare Worker 405 Setup Guidelines Alert */}
      {worker405Error && (
        <div className="p-6 rounded-[2rem] bg-[#E6E9EF] border-2 border-amber-500/20 neu-flat space-y-4">
          <div className="flex items-start space-x-3 text-amber-600">
            <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-black text-sm uppercase tracking-wider">Cloudflare Worker Perlu Diperbarui</h3>
              <p className="text-xs font-bold text-[#718096] mt-1 leading-relaxed">
                Cloudflare Worker merespons dengan <span className="text-red-500">405 Method Not Allowed</span>. Ini berarti worker yang berjalan saat ini belum mendukung metode <code className="bg-[#E6E9EF] px-1.5 py-0.5 rounded neu-inset font-mono text-[10px]">GET</code> untuk membaca daftar berkas.
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            <p className="text-xs font-black text-[#4A5568] uppercase tracking-wider">Langkah-langkah untuk memperbarui worker:</p>
            <ol className="list-decimal list-inside text-xs text-[#718096] font-semibold space-y-1 pl-1">
              <li>Buka dashboard Cloudflare Worker Anda.</li>
              <li>Pilih worker yang menangani unggahan/penghapusan berkas Anda.</li>
              <li>Klik <strong>Edit Code</strong> (atau gunakan wrangler jika dideploy dari CLI).</li>
              <li>Ganti isi file worker Anda dengan kode templat di bawah ini.</li>
              <li>Pastikan variabel environment <code className="font-mono text-[10px]">UPLOAD_SECRET</code> dan CDN URL dikonfigurasi di dashboard Cloudflare.</li>
            </ol>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-[#4A5568] uppercase tracking-widest">Templat Kode Cloudflare Worker:</span>
              <button 
                onClick={() => handleCopyUrl(workerCodeTemplate, 'worker-template')}
                className="px-3 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-wider bg-[#E6E9EF] text-blue-500 neu-flat hover:neu-pressed flex items-center space-x-1"
              >
                {copiedKey === 'worker-template' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Kode</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 rounded-xl font-mono text-[10px] text-[#2D3748] bg-[#E6E9EF] neu-inset max-h-60 overflow-y-auto whitespace-pre leading-relaxed select-all">
              {workerCodeTemplate}
            </pre>
          </div>
        </div>
      )}

      {/* General Error Alert */}
      {generalError && (
        <div className="p-4 rounded-xl bg-red-50 text-red-600 border border-red-200 text-xs font-semibold flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{generalError}</span>
        </div>
      )}

      {/* Main Container */}
      {!worker405Error && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* File List Block */}
          <div className="col-span-1 lg:col-span-8 p-6 rounded-[2.5rem] bg-[#E6E9EF] neu-flat space-y-6 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-[#2D3748] uppercase tracking-widest">Daftar Berkas R2</h3>
                <p className="text-[10px] text-[#A0AEC0] font-bold tracking-widest uppercase">Pencarian & Pengelolaan Berkas Fisik</p>
              </div>

              <button 
                onClick={fetchFiles} 
                disabled={loading}
                className="w-10 h-10 rounded-full flex items-center justify-center text-blue-500 neu-flat hover:neu-pressed disabled:opacity-50 transition-all self-end sm:self-auto"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Search and Filters */}
            <div className="space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 text-[#A0AEC0] absolute left-4 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Cari berkas berdasarkan nama..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-[#E6E9EF] neu-inset text-xs text-[#2D3748] placeholder-[#A0AEC0] outline-none font-medium"
                />
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'Semua Berkas' },
                  { id: 'apk', label: 'Biner APK' },
                  { id: 'images', label: 'Gambar' },
                  { id: 'json', label: 'Config JSON' },
                  { id: 'other', label: 'Lainnya' }
                ].map(pill => (
                  <button
                    key={pill.id}
                    onClick={() => setFilterType(pill.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                      filterType === pill.id 
                        ? 'bg-[#E6E9EF] text-blue-500 neu-pressed' 
                        : 'bg-[#E6E9EF] text-[#718096] neu-flat hover:neu-pressed'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            {/* List Element */}
            <div className="flex-grow min-h-[350px] overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center space-y-3 text-[#718096] h-64">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                  <span className="text-xs font-black tracking-widest uppercase">Membaca R2 Bucket...</span>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-[#718096] h-64 space-y-2">
                  <FolderOpen className="w-10 h-10 text-[#A0AEC0]" />
                  <span className="text-xs font-black tracking-widest uppercase">Tidak Ada Berkas Ditemukan</span>
                </div>
              ) : (
                <div className="space-y-3 pr-1">
                  {filteredFiles.map(file => (
                    <div 
                      key={file.key}
                      className="p-4 rounded-2xl bg-[#E6E9EF] neu-flat hover:neu-pressed transition-all flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl neu-inset flex items-center justify-center flex-shrink-0">
                          {getFileIcon(file.key)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-[#2D3748] truncate pr-2 select-all">{file.key}</h4>
                          <div className="flex items-center space-x-2 text-[9px] text-[#A0AEC0] font-bold mt-0.5">
                            <span>{formatBytes(file.size)}</span>
                            <span>•</span>
                            <span>{new Date(file.uploaded).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleCopyUrl(file.url, file.key)}
                          title="Salin URL CDN"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-500 bg-[#E6E9EF] neu-flat hover:neu-pressed transition-all"
                        >
                          {copiedKey === file.key ? (
                            <Check className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Buka/Unduh Berkas"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 bg-[#E6E9EF] neu-flat hover:neu-pressed transition-all"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>

                        <button
                          onClick={() => handleDeleteFile(file.key)}
                          title="Hapus Permanen"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500 bg-[#E6E9EF] neu-flat hover:neu-pressed transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Upload Block */}
          <div className="col-span-1 lg:col-span-4 p-6 rounded-[2.5rem] bg-[#E6E9EF] neu-flat flex flex-col space-y-6 h-fit">
            <div>
              <h3 className="text-sm font-black text-[#2D3748] uppercase tracking-widest">Unggah Berkas Baru</h3>
              <p className="text-[10px] text-[#A0AEC0] font-bold tracking-widest uppercase">Unggah langsung ke Cloudflare R2</p>
            </div>

            {/* Dropzone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-[2rem] p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 min-h-[220px] ${
                dragActive 
                  ? 'border-blue-500/50 bg-[#E6E9EF] neu-pressed' 
                  : 'border-slate-300 bg-[#E6E9EF] neu-inset hover:bg-slate-200/20'
              }`}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                onChange={handleFileChange}
                className="hidden" 
              />
              
              <div className="w-12 h-12 rounded-full neu-convex flex items-center justify-center text-blue-500">
                <UploadCloud className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <p className="text-xs font-black text-[#4A5568] uppercase tracking-wider">Seret & Lepas Berkas</p>
                <p className="text-[10px] text-[#718096] font-bold">atau klik untuk menelusuri folder</p>
              </div>
              <span className="text-[9px] font-black uppercase text-[#A0AEC0] bg-[#E6E9EF] px-3 py-1 rounded-full neu-flat">
                Maksimal 100MB
              </span>
            </div>

            {/* Progress / Status */}
            {uploadStatus !== 'IDLE' && (
              <div className="p-4 rounded-2xl bg-[#E6E9EF] neu-inset space-y-3">
                {uploadStatus === 'UPLOADING' && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-bold text-[#4A5568] uppercase tracking-wider">
                      <span>Sedang Mengunggah...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    
                    {/* Progress Bar Container */}
                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-150 ease-out" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>

                    <button 
                      onClick={cancelUpload}
                      className="w-full text-center py-2 text-[10px] font-black uppercase tracking-widest text-red-500 bg-[#E6E9EF] rounded-xl neu-flat hover:neu-pressed"
                    >
                      Batalkan Unggahan
                    </button>
                  </div>
                )}

                {uploadStatus === 'SUCCESS' && (
                  <div className="flex items-center space-x-2 text-emerald-600 font-bold text-xs">
                    <Check className="w-4 h-4 flex-shrink-0" />
                    <span>Berkas berhasil diunggah!</span>
                  </div>
                )}

                {uploadStatus === 'ERROR' && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-red-600 font-bold text-xs">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>Gagal mengunggah berkas</span>
                    </div>
                    {uploadErrorMsg && (
                      <p className="text-[10px] text-red-500 leading-normal">{uploadErrorMsg}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};
