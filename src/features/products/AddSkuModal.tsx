import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../core/supabase';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Package, Camera, Keyboard, CheckCircle, AlertCircle, X,
  ImageIcon, Loader2, ArrowRight, RefreshCw
} from 'lucide-react';

interface AddSkuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess?: () => void;
  session: any;
}

export const AddSkuModal: React.FC<AddSkuModalProps> = ({ isOpen, onClose, onSaveSuccess, session }) => {
  const [modalMode, setModalMode] = useState<'scan' | 'manual'>('scan');
  const [inputBarcode, setInputBarcode] = useState('');
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

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
  const scannerId = "global-camera-scanner-view";

  useEffect(() => {
    if (isOpen) {
      // Reset state on open
      setFormMessage(null);
      setInputBarcode('');
      setScanResult(null);
      setCheckStatus('idle');
      setFoundProduct(null);
      setFormData({ sku: '', barcode: '', nama_produk: '', brand: '', image_url: '' });
      
      if (modalMode === 'scan') {
        startScanner();
      }
    } else {
      stopScanner();
    }
  }, [isOpen, modalMode, facingMode]);

  // Clean up scanner on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    setScanResult(null);
    setCheckStatus('idle');
    setFoundProduct(null);

    // Wait a brief tick for container to mount
    setTimeout(async () => {
      try {
        const container = document.getElementById(scannerId);
        if (!container) return;

        if (!html5QrCodeRef.current) {
          html5QrCodeRef.current = new Html5Qrcode(scannerId);
        }

        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }

        await html5QrCodeRef.current.start(
          { facingMode: facingMode },
          {
            fps: 10,
            qrbox: (width) => {
              return {
                width: Math.min(width * 0.8, 300),
                height: 140
              };
            }
          },
          (decodedText) => {
            handleBarcodeDetected(decodedText);
          },
          () => {}
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

  const handleBarcodeDetected = async (code: string) => {
    setScanResult(code);
    stopScanner();
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
        // 2. Trigger API Scraper
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
            setCheckStatus('not_found');
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
            setCheckStatus('not_found');
            setFormData({ sku: code, barcode: code, nama_produk: '', brand: '', image_url: '' });
          }
        } else {
          setCheckStatus('not_found');
          setFormData({ sku: code, barcode: code, nama_produk: '', brand: '', image_url: '' });
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
          id: foundProduct?.id || crypto.randomUUID(),
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
      setCheckStatus('found');
      
      if (onSaveSuccess) {
        onSaveSuccess();
      }
      
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err: any) {
      console.error("Save product error:", err);
      setFormMessage({ type: 'error', text: `Gagal menyimpan produk: ${err.message}` });
    } finally {
      setSavingProduct(false);
    }
  };

  const toggleModalMode = (mode: 'scan' | 'manual') => {
    setModalMode(mode);
    setCheckStatus('idle');
    setScanResult(null);
    setFoundProduct(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-[fadeInSoft_0.25s_ease-out] p-0 sm:p-4">
      
      {/* Inline animations for scanner laser and slide-up */}
      <style>{`
        @keyframes scan-laser {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
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
          aspect-ratio: 1/1;
          background-color: #0F172A;
          border-radius: 16px;
          overflow: hidden;
          border: 2px solid #E2E8F0;
        }
        #global-camera-scanner-view {
          width: 100% !important;
          height: 100% !important;
        }
        #global-camera-scanner-view video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
        }
      `}</style>

      <div className="bg-white rounded-t-[32px] sm:rounded-[32px] w-full max-w-lg shadow-2xl border-t border-gray-100 sm:border border-gray-100 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-[slideUp_0.3s_ease-out] sm:animate-[zoomInSoft_0.25s_ease-out]">
        
        {/* Mobile Bottom Sheet Handle Bar */}
        <div className="block sm:hidden w-full pt-3 pb-1 flex justify-center bg-gray-50/50">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
        </div>
        
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
            onClick={onClose}
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
              <div className="flex flex-col items-center space-y-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center animate-pulse">
                  Posisikan Barcode di dalam Kotak Sensor
                </p>
                <button
                  type="button"
                  onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
                  className="flex items-center space-x-1.5 bg-gray-100 hover:bg-gray-250 text-gray-700 text-[9px] font-black uppercase tracking-wider px-3.5 py-2 rounded-full border-none cursor-pointer transition-all duration-200 active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Ganti ke Kamera {facingMode === 'environment' ? 'Depan' : 'Belakang'}</span>
                </button>
              </div>
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
                    className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm sm:text-xs outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50 font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => verifyAndProcessBarcode(inputBarcode)}
                    disabled={!inputBarcode}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-black text-sm sm:text-xs uppercase tracking-wider px-5 py-3 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50 border-none flex items-center justify-center space-x-1"
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

          {/* BARCODE CHECKING LOADER */}
          {checkingBarcode && (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-xs font-black text-blue-800 uppercase tracking-widest animate-pulse">
                Memeriksa Database & Scraping Internet...
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

                <div className="space-y-1.5 min-w-0 flex-1">
                  <span className="text-[9px] font-mono font-bold text-gray-400 block">BARCODE: {foundProduct.barcode}</span>
                  <h4 className="text-sm font-bold text-gray-800 leading-tight">{foundProduct.nama_produk}</h4>
                  {foundProduct.brand ? (
                    <span className="inline-block px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase tracking-wider">
                      Merek: {foundProduct.brand}
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-455 italic font-semibold block">Tanpa Merek/Brand</span>
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setCheckStatus('not_found');
                  }}
                  className="px-4 py-3 sm:py-2 bg-white border border-gray-250 text-gray-650 hover:text-blue-600 hover:border-blue-300 font-black text-sm sm:text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                >
                  Ubah Data
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-3 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm sm:text-xs uppercase tracking-wider rounded-xl shadow-sm transition-all cursor-pointer border-none"
                >
                  Selesai
                </button>
              </div>
            </div>
          )}

          {/* BARCODE NOT FOUND -> FORM ENTRY */}
          {checkStatus === 'not_found' && (
            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="bg-blue-50/20 border border-blue-100/50 p-4 rounded-xl text-xs font-semibold text-blue-800 leading-relaxed">
                ⚙️ <strong>Sistem Integrasi:</strong> Barcode Anda berhasil didaftarkan. Lengkapi detail di bawah ini untuk menyimpan produk ke katalog SKU.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Barcode</label>
                  <input
                    type="text"
                    value={formData.barcode}
                    disabled
                    className="w-full px-3 py-3 sm:py-2.5 border border-gray-150 rounded-xl bg-gray-100 text-gray-500 font-mono font-bold text-sm sm:text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">SKU Code</label>
                  <input
                    type="text"
                    value={formData.sku}
                    disabled
                    className="w-full px-3 py-3 sm:py-2.5 border border-gray-150 rounded-xl bg-gray-100 text-gray-500 font-mono font-bold text-sm sm:text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Nama Produk <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="Masukkan nama lengkap produk (e.g. Sari Roti)..."
                  value={formData.nama_produk}
                  onChange={(e) => setFormData(prev => ({ ...prev, nama_produk: e.target.value }))}
                  required
                  className="w-full px-3 py-3 sm:py-2.5 border border-gray-200 rounded-xl text-sm sm:text-xs outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Brand / Merek</label>
                <input
                  type="text"
                  placeholder="Masukkan merek produk..."
                  value={formData.brand}
                  onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                  className="w-full px-3 py-3 sm:py-2.5 border border-gray-200 rounded-xl text-sm sm:text-xs outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider">URL Gambar Produk</label>
                <input
                  type="text"
                  placeholder="Masukkan link gambar (e.g. https://...)..."
                  value={formData.image_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                  className="w-full px-3 py-3 sm:py-2.5 border border-gray-200 rounded-xl text-sm sm:text-xs outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono"
                />
              </div>

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

              <div className="pt-4 border-t border-gray-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setCheckStatus('idle');
                    setScanResult(null);
                    if (modalMode === 'scan') {
                      startScanner();
                    }
                  }}
                  className="px-4 py-3 sm:py-2.5 bg-white border border-gray-250 text-gray-650 hover:text-gray-800 hover:bg-gray-50 font-black text-sm sm:text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black text-sm sm:text-xs uppercase tracking-wider px-5 py-3 sm:py-2.5 rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 border-none flex items-center justify-center space-x-2"
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
  );
};
