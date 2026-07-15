import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../core/supabase';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Package, Search, RefreshCw, Trash2, Plus, 
  Camera, Keyboard, CheckCircle, AlertCircle, X,
  ImageIcon, Loader2, ArrowRight, ShieldCheck
} from 'lucide-react';

interface Product {
  id: string;
  sku: string;
  barcode: string;
  nama_produk: string;
  brand: string | null;
  image_url: string | null;
  created_at: string;
}

interface ProductManagementScreenProps {
  session: any;
  profile: any;
}

export const ProductManagementScreen: React.FC<ProductManagementScreenProps> = ({ session }) => {
  // Catalog State
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'scan' | 'manual'>('scan');
  const [inputBarcode, setInputBarcode] = useState('');
  const [scanResult, setScanResult] = useState<string | null>(null);

  // Scraper & Form state
  const [checkingBarcode, setCheckingBarcode] = useState(false);
  const [checkStatus, setCheckStatus] = useState<'idle' | 'found' | 'not_found' | 'error'>('idle');
  const [foundProduct, setFoundProduct] = useState<any | null>(null);
  
  // Form values
  const [formData, setFormData] = useState({
    sku: '',
    barcode: '',
    nama_produk: '',
    brand: '',
    image_url: ''
  });
  const [savingProduct, setSavingProduct] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Scanner Instance
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerId = "camera-scanner-view";

  useEffect(() => {
    loadProducts();
  }, [search, page]);

  // Clean up scanner on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('daftar_produk')
        .select('*', { count: 'exact' });

      if (search.trim() !== '') {
        // Safe check for Supabase query syntax
        query = query.or(`nama_produk.ilike.%${search}%,brand.ilike.%${search}%,barcode.ilike.%${search}%`);
      }

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (error) throw error;
      setProducts(data || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus produk "${name}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    try {
      const { error } = await supabase
        .from('daftar_produk')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadProducts();
    } catch (err: any) {
      alert(`Gagal menghapus produk: ${err.message}`);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // SCANNER MANAGEMENT
  // ──────────────────────────────────────────────────────────────
  const startScanner = async () => {
    setScanResult(null);
    setCheckStatus('idle');
    setFoundProduct(null);

    // Wait a brief tick for the container element to render in DOM
    setTimeout(async () => {
      try {
        if (!html5QrCodeRef.current) {
          html5QrCodeRef.current = new Html5Qrcode(scannerId);
        }

        // Avoid starting multiple scans on the same element
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }

        await html5QrCodeRef.current.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (width) => {
              // Custom scanning dimensions optimized for barcodes (wide and short)
              return {
                width: Math.min(width * 0.8, 300),
                height: 140
              };
            }
          },
          (decodedText) => {
            // Scan Success
            handleBarcodeDetected(decodedText);
          },
          () => {
            // Verbose logging of scan frame mismatches (safe to ignore)
          }
        );
      } catch (err: any) {
        console.error("Camera access/scanner start failed:", err);
        setCheckStatus('error');
        setFormMessage({ type: 'error', text: `Gagal mengakses kamera: ${err.message || 'Izin ditolak'}` });
      }
    }, 100);
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.warn("Failed to stop scanner cleanly:", err);
      }
    }
  };

  // ──────────────────────────────────────────────────────────────
  // BARCODE CHECKING & SCRAPING ENGINE
  // ──────────────────────────────────────────────────────────────
  const handleBarcodeDetected = async (code: string) => {
    setScanResult(code);
    stopScanner(); // Stop camera once detected
    await verifyAndProcessBarcode(code);
  };

  const verifyAndProcessBarcode = async (code: string) => {
    if (!code || code.trim() === '') return;
    
    setCheckingBarcode(true);
    setCheckStatus('idle');
    setFoundProduct(null);
    setFormMessage(null);

    try {
      // 1. Check local database first
      const { data: localData, error: dbError } = await supabase
        .from('daftar_produk')
        .select('*')
        .eq('barcode', code.trim())
        .maybeSingle();

      if (dbError) throw dbError;

      if (localData) {
        // Product already exists in the database
        setCheckStatus('found');
        setFoundProduct(localData);
        setFormData({
          sku: localData.sku,
          barcode: localData.barcode,
          nama_produk: localData.nama_produk,
          brand: localData.brand || '',
          image_url: localData.image_url || ''
        });
      } else {
        // 2. Product does not exist in local database. Let's trigger the scraper!
        console.log(`[UI] Product not found in database. Triggering API Scraper for barcode ${code}...`);
        
        const token = session?.access_token;
        const res = await fetch(`/api/scrape-product?barcode=${code}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (res.ok) {
          const scraped = await res.json();
          if (scraped.success && scraped.data) {
            // Product successfully found by the web scraper!
            setCheckStatus('not_found'); // Not in DB yet, but found on internet
            setFormData({
              sku: code,
              barcode: code,
              nama_produk: scraped.data.nama_produk || '',
              brand: scraped.data.brand || '',
              image_url: scraped.data.image_url || ''
            });
            setFormMessage({
              type: 'success',
              text: `Produk terdeteksi otomatis dari internet via ${scraped.source || 'Scraper'}! Silakan konfirmasi dan simpan.`
            });
          } else {
            // Fallback: Scraper finished but returned no data
            setCheckStatus('not_found');
            setFormData({
              sku: code,
              barcode: code,
              nama_produk: '',
              brand: '',
              image_url: ''
            });
          }
        } else {
          // Scraper returned 404/Error, fallback to manual form
          setCheckStatus('not_found');
          setFormData({
            sku: code,
            barcode: code,
            nama_produk: '',
            brand: '',
            image_url: ''
          });
        }
      }
    } catch (err: any) {
      console.error("Barcode processing error:", err);
      setCheckStatus('error');
      setFormMessage({ type: 'error', text: `Gagal verifikasi barcode: ${err.message}` });
    } finally {
      setCheckingBarcode(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama_produk.trim()) {
      setFormMessage({ type: 'error', text: 'Nama produk wajib diisi!' });
      return;
    }

    setSavingProduct(true);
    setFormMessage(null);

    try {
      const { error } = await supabase
        .from('daftar_produk')
        .upsert({
          id: foundProduct?.id || crypto.randomUUID(), // keep existing ID if editing
          sku: formData.sku,
          barcode: formData.barcode,
          nama_produk: formData.nama_produk.trim(),
          brand: formData.brand.trim() || null,
          image_url: formData.image_url.trim() || null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'sku'
        });

      if (error) throw error;

      setFormMessage({ type: 'success', text: 'Produk berhasil disimpan ke database!' });
      setCheckStatus('found'); // switch view to found state
      loadProducts();
      
      // Auto close modal after 1.5 seconds on success
      setTimeout(() => {
        handleCloseModal();
      }, 1500);

    } catch (err: any) {
      console.error("Save product error:", err);
      setFormMessage({ type: 'error', text: `Gagal menyimpan produk: ${err.message}` });
    } finally {
      setSavingProduct(false);
    }
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setFormMessage(null);
    setInputBarcode('');
    setScanResult(null);
    setCheckStatus('idle');
    setFoundProduct(null);
    setFormData({ sku: '', barcode: '', nama_produk: '', brand: '', image_url: '' });
    
    if (modalMode === 'scan') {
      startScanner();
    }
  };

  const handleCloseModal = () => {
    stopScanner();
    setIsModalOpen(false);
  };

  const toggleModalMode = (mode: 'scan' | 'manual') => {
    setModalMode(mode);
    setCheckStatus('idle');
    setScanResult(null);
    setFoundProduct(null);
    
    if (mode === 'scan') {
      startScanner();
    } else {
      stopScanner();
    }
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="space-y-6">
      {/* Inline animations for scanner laser and custom classes */}
      <style>{`
        @keyframes scan-laser {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
        .laser-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background-color: #EF4444;
          box-shadow: 0 0 8px 1px #EF4444;
          animation: scan-laser 2.5s infinite linear;
          z-index: 10;
        }
        .scanner-container {
          position: relative;
          width: 100%;
          max-width: 320px;
          margin: 0 auto;
          aspect-ratio: 4/3;
          background-color: #0F172A;
          border-radius: 16px;
          overflow: hidden;
          border: 2px solid #E2E8F0;
        }
        #camera-scanner-view {
          width: 100% !important;
          height: 100% !important;
        }
        #camera-scanner-view video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
        }
      `}</style>

      {/* Screen Title & Add SKU Trigger */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-4">
        <div>
          <h1 className="text-xl font-black text-gray-800 tracking-tight flex items-center space-x-2">
            <Package className="w-5.5 h-5.5 text-blue-600" />
            <span>KATALOG DAFTAR PRODUK (SKU)</span>
          </h1>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">
            Kelola data SKU barang yang beredar dengan pemindai barcode
          </p>
        </div>

        <button
          onClick={handleOpenModal}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer border-none"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah SKU / Scan</span>
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl flex flex-col justify-between h-20 shadow-sm">
          <span className="text-[8px] font-black uppercase text-blue-600 tracking-wider">Total Item SKU</span>
          <span className="text-2xl font-black text-blue-800 mt-1">{totalCount}</span>
        </div>
        <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl flex flex-col justify-between h-20 shadow-sm">
          <span className="text-[8px] font-black uppercase text-emerald-600 tracking-wider">SKU dengan Gambar</span>
          <span className="text-2xl font-black text-emerald-800 mt-1">
            {products.filter(p => p.image_url).length} <span className="text-xs text-emerald-500 font-bold">sampel halaman</span>
          </span>
        </div>
        <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl flex flex-col justify-between h-20 shadow-sm">
          <span className="text-[8px] font-black uppercase text-indigo-600 tracking-wider">Metode Pencarian</span>
          <span className="text-xs font-bold text-indigo-800 mt-2 flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>PWA Barcode Camera & Scraper</span>
          </span>
        </div>
      </div>

      {/* Catalog Filters */}
      <div className="bg-white border border-gray-150 p-4 rounded-[20px] shadow-sm flex flex-col md:flex-row md:items-center gap-4 justify-between">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Cari nama produk, brand, atau kode barcode..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none bg-gray-50/30"
          />
        </div>
        <button
          onClick={loadProducts}
          className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-blue-600 transition-all bg-white cursor-pointer"
          title="Refresh Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Product Table List */}
      <div className="bg-white border border-gray-200/80 rounded-[24px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[700px]">
            <thead>
              <tr className="bg-gray-50/70 text-gray-500 font-bold uppercase text-[9px] tracking-widest border-b border-gray-150">
                <th className="p-4 w-16 text-center">Gambar</th>
                <th className="p-4">Kode SKU / Barcode</th>
                <th className="p-4">Nama Produk</th>
                <th className="p-4">Brand / Merek</th>
                <th className="p-4">Terdaftar Pada</th>
                <th className="p-4 w-20 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-650 font-semibold">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="p-4"><div className="w-10 h-10 bg-gray-200 rounded-lg mx-auto"></div></td>
                    <td className="p-4"><div className="h-4 bg-gray-200 rounded w-28"></div></td>
                    <td className="p-4"><div className="h-4 bg-gray-200 rounded w-44"></div></td>
                    <td className="p-4"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                    <td className="p-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                    <td className="p-4"><div className="h-8 bg-gray-200 rounded w-12 mx-auto"></div></td>
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-gray-400 font-bold uppercase tracking-wider">
                    Tidak ada produk ditemukan
                  </td>
                </tr>
              ) : (
                products.map((prod) => (
                  <tr key={prod.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 text-center">
                      {prod.image_url ? (
                        <img 
                          src={prod.image_url} 
                          alt={prod.nama_produk} 
                          className="w-10 h-10 object-contain rounded-lg border border-gray-100 bg-white"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-100 text-gray-400">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-mono text-[10px] font-bold text-gray-900">
                      {prod.barcode}
                    </td>
                    <td className="p-4 font-bold text-gray-800 text-sm">
                      {prod.nama_produk}
                    </td>
                    <td className="p-4">
                      {prod.brand ? (
                        <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-[10px] font-bold">
                          {prod.brand}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic font-medium">N/A</span>
                      )}
                    </td>
                    <td className="p-4 text-gray-450 font-bold">
                      {new Date(prod.created_at).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => handleDelete(prod.id, prod.nama_produk)}
                        className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 border-none bg-transparent cursor-pointer transition-colors"
                        title="Hapus Produk"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-gray-500">
            <span>Menampilkan {products.length} dari {totalCount} produk</span>
            <div className="flex items-center space-x-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 cursor-pointer text-[10px]"
              >
                Sebelumnya
              </button>
              <span className="px-3 text-gray-700">Halaman {page} dari {totalPages}</span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 cursor-pointer text-[10px]"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────────
          POPUP MODAL: TAMBAH SKU / SCAN BARCODE
      ────────────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeInSoft_0.25s_ease-out]">
          <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-base font-black text-gray-800 tracking-tight uppercase flex items-center space-x-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  <span>Tambah Produk SKU Baru</span>
                </h3>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                  Scan kemasan produk atau ketik kode barcode manual
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all border-none bg-transparent cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Mode Selector Tabs */}
            <div className="flex border-b border-gray-100 bg-white">
              <button
                onClick={() => toggleModalMode('scan')}
                className={`flex-1 py-3 text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer border-none border-b-2
                  ${modalMode === 'scan' 
                    ? 'border-blue-600 text-blue-600 bg-blue-50/10' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 bg-white'}`}
              >
                <Camera className="w-4 h-4" />
                <span>Scan Kamera</span>
              </button>
              <button
                onClick={() => toggleModalMode('manual')}
                className={`flex-1 py-3 text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer border-none border-b-2
                  ${modalMode === 'manual' 
                    ? 'border-blue-600 text-blue-600 bg-blue-50/10' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 bg-white'}`}
              >
                <Keyboard className="w-4 h-4" />
                <span>Input Manual</span>
              </button>
            </div>

            {/* Scrollable Content Container */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* STATUS MESSAGES / TOAST MESSAGE */}
              {formMessage && (
                <div className={`p-4 rounded-xl flex items-start space-x-3 text-xs font-bold leading-tight
                  ${formMessage.type === 'success' 
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' 
                    : 'bg-rose-50 border border-rose-200 text-rose-700'}`}
                >
                  {formMessage.type === 'success' ? (
                    <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
                  )}
                  <span>{formMessage.text}</span>
                </div>
              )}

              {/* CAMERA MODE SCANNING BOX */}
              {modalMode === 'scan' && !scanResult && (
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="scanner-container">
                    <div className="laser-line"></div>
                    <div id={scannerId}></div>
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center animate-pulse">
                    Posisikan Barcode di dalam Kotak Sensor
                  </p>
                </div>
              )}

              {/* MANUAL MODE INPUT BOX */}
              {modalMode === 'manual' && checkStatus === 'idle' && !checkingBarcode && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Kode Barcode / EAN-13</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ketik angka barcode (e.g. 8996001600269)..."
                        value={inputBarcode}
                        onChange={(e) => setInputBarcode(e.target.value.replace(/\D/g, ''))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            verifyAndProcessBarcode(inputBarcode);
                          }
                        }}
                        className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50 font-mono font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => verifyAndProcessBarcode(inputBarcode)}
                        disabled={!inputBarcode}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider px-5 py-3 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50 border-none flex items-center justify-center space-x-1"
                      >
                        <span>Verifikasi</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-[9px] text-gray-400 font-semibold leading-normal block">
                      Tip: Anda juga dapat memindai langsung menggunakan alat pemindai fisik (USB Barcode Scanner) saat kursor aktif di input ini.
                    </span>
                  </div>
                </div>
              )}

              {/* BARCODE CHECKING LOADER (Scraper or DB fetch) */}
              {checkingBarcode && (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  <p className="text-xs font-black text-blue-800 uppercase tracking-widest animate-pulse">
                    Memeriksa Database & Scraping Internet...
                  </p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider text-center">
                    Mencoba mencocokkan di Open Food Facts, Tokopedia, dan Shopee
                  </p>
                </div>
              )}

              {/* BARCODE FOUND STATE (View Mode) */}
              {checkStatus === 'found' && foundProduct && (
                <div className="bg-emerald-50/30 border border-emerald-100/60 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center space-x-2 text-emerald-700 font-black text-xs uppercase tracking-wider">
                    <CheckCircle className="w-4 h-4" />
                    <span>Produk Ditemukan di Database!</span>
                  </div>

                  <div className="flex gap-4 items-start">
                    {foundProduct.image_url ? (
                      <img 
                        src={foundProduct.image_url} 
                        alt={foundProduct.nama_produk} 
                        className="w-20 h-20 object-contain rounded-xl border border-gray-100 bg-white shadow-sm flex-shrink-0"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gray-50 border border-gray-150 rounded-xl flex items-center justify-center text-gray-400 flex-shrink-0">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}

                    <div className="space-y-1.5 min-w-0">
                      <span className="text-[9px] font-mono font-bold text-gray-400 block">BARCODE: {foundProduct.barcode}</span>
                      <h4 className="text-sm font-bold text-gray-800 leading-tight">{foundProduct.nama_produk}</h4>
                      {foundProduct.brand ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase tracking-wider">
                          Merek: {foundProduct.brand}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-450 italic font-semibold block">Tanpa Merek/Brand</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCheckStatus('not_found'); // open edit form with existing details
                      }}
                      className="px-4 py-2 bg-white border border-gray-250 text-gray-600 hover:text-blue-600 hover:border-blue-300 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                    >
                      Ubah Data
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-sm transition-all cursor-pointer border-none"
                    >
                      Selesai
                    </button>
                  </div>
                </div>
              )}

              {/* BARCODE NOT FOUND IN DB STATE OR SCRAPED -> DISPLAY INPUT FORM */}
              {checkStatus === 'not_found' && (
                <form onSubmit={handleSaveProduct} className="space-y-4">
                  <div className="bg-blue-50/20 border border-blue-100/50 p-4 rounded-xl text-xs font-semibold text-blue-800 leading-relaxed">
                    ⚙️ <strong>Sistem Integrasi:</strong> Barcode Anda berhasil didaftarkan. Lengkapi detail di bawah ini untuk menyimpan produk ke katalog SKU.
                  </div>

                  {/* Barcode & SKU Read Only Row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Barcode</label>
                      <input
                        type="text"
                        value={formData.barcode}
                        disabled
                        className="w-full px-3 py-2.5 border border-gray-150 rounded-xl bg-gray-100 text-gray-500 font-mono font-bold text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">SKU Code</label>
                      <input
                        type="text"
                        value={formData.sku}
                        disabled
                        className="w-full px-3 py-2.5 border border-gray-150 rounded-xl bg-gray-100 text-gray-500 font-mono font-bold text-xs"
                      />
                    </div>
                  </div>

                  {/* Nama Produk */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Nama Produk <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      placeholder="Masukkan nama lengkap produk (e.g. Sari Roti Tawar Kupas)..."
                      value={formData.nama_produk}
                      onChange={(e) => setFormData(prev => ({ ...prev, nama_produk: e.target.value }))}
                      required
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-bold"
                    />
                  </div>

                  {/* Brand / Merek */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Brand / Merek</label>
                    <input
                      type="text"
                      placeholder="Masukkan merek produk (e.g. Indofood, Coca-Cola)..."
                      value={formData.brand}
                      onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-bold"
                    />
                  </div>

                  {/* Image URL with live preview */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">URL Gambar Produk</label>
                    <input
                      type="text"
                      placeholder="Masukkan link gambar (e.g. https://...)..."
                      value={formData.image_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono"
                    />
                  </div>

                  {/* Image Preview Container */}
                  {formData.image_url.trim() !== '' && (
                    <div className="border border-gray-150 p-3 rounded-xl flex items-center space-x-3 bg-gray-50/50">
                      <img 
                        src={formData.image_url} 
                        alt="Preview" 
                        className="w-12 h-12 object-contain rounded-lg border border-gray-100 bg-white"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <div>
                        <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider block">Preview Gambar</span>
                        <span className="text-[10px] text-gray-500 font-semibold truncate max-w-[250px] block">{formData.image_url}</span>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-4 border-t border-gray-100 flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        // Go back to scan or manual start
                        setCheckStatus('idle');
                        setScanResult(null);
                        if (modalMode === 'scan') {
                          startScanner();
                        }
                      }}
                      className="px-4 py-2.5 bg-white border border-gray-250 text-gray-600 hover:text-gray-800 hover:bg-gray-50 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={savingProduct}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 border-none flex items-center justify-center space-x-2"
                    >
                      {savingProduct && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>{foundProduct ? 'Perbarui Produk' : 'Simpan Produk'}</span>
                    </button>
                  </div>
                </form>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
