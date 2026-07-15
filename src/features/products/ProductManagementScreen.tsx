import React, { useState, useEffect } from 'react';
import { supabase } from '../../core/supabase';
import { 
  Package, Search, RefreshCw, Trash2, Plus, 
  ImageIcon, ShieldCheck
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
  onOpenSkuModal: () => void;
  productRefreshKey: number;
}

export const ProductManagementScreen: React.FC<ProductManagementScreenProps> = ({ 
  onOpenSkuModal, 
  productRefreshKey 
}) => {
  // Catalog State
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;

  useEffect(() => {
    loadProducts();
  }, [search, page, productRefreshKey]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('daftar_produk')
        .select('*', { count: 'exact' });

      if (search.trim() !== '') {
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

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="space-y-6">
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
          onClick={onOpenSkuModal}
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
            className="w-full pl-10 pr-4 py-3 sm:py-2.5 border border-gray-200 rounded-xl text-sm sm:text-xs font-bold focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none bg-gray-50/30"
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

      {/* Product Table & Card List Container */}
      <div className="bg-white border border-gray-200/80 rounded-[24px] overflow-hidden shadow-sm">
        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
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

        {/* Mobile View: Product Cards List */}
        <div className="block sm:hidden divide-y divide-gray-100">
          {loading ? (
            Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="p-4 flex items-center space-x-3.5 animate-pulse">
                <div className="w-14 h-14 bg-gray-200 rounded-xl flex-shrink-0"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-20"></div>
                  <div className="h-4 bg-gray-200 rounded w-36"></div>
                  <div className="h-3 bg-gray-200 rounded w-16"></div>
                </div>
                <div className="w-8 h-8 bg-gray-200 rounded-lg flex-shrink-0"></div>
              </div>
            ))
          ) : products.length === 0 ? (
            <div className="p-12 text-center text-gray-400 font-bold uppercase tracking-wider">
              Tidak ada produk ditemukan
            </div>
          ) : (
            products.map((prod) => (
              <div key={prod.id} className="p-4 flex items-center space-x-3.5 hover:bg-gray-50/30 transition-all">
                {prod.image_url ? (
                  <img 
                    src={prod.image_url} 
                    alt={prod.nama_produk} 
                    className="w-14 h-14 object-contain rounded-xl border border-gray-100 bg-white p-1 flex-shrink-0 shadow-sm"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100 text-gray-400 flex-shrink-0 shadow-sm">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                )}
                
                <div className="flex-1 min-w-0 space-y-1">
                  <span className="text-[9px] font-mono font-bold text-gray-400 block tracking-wider uppercase">
                    BARCODE: {prod.barcode}
                  </span>
                  <h4 className="text-xs font-bold text-gray-800 leading-snug line-clamp-2">
                    {prod.nama_produk}
                  </h4>
                  {prod.brand ? (
                    <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[9px] font-extrabold uppercase tracking-wide">
                      {prod.brand}
                    </span>
                  ) : (
                    <span className="text-[9px] text-gray-400 italic font-semibold">No Brand</span>
                  )}
                </div>

                <button
                  onClick={() => handleDelete(prod.id, prod.nama_produk)}
                  className="p-3 rounded-xl text-rose-500 hover:bg-rose-50 border-none bg-transparent cursor-pointer flex-shrink-0 touch-manipulation"
                  title="Hapus Produk"
                >
                  <Trash2 className="w-4.5 h-4.5" />
                </button>
              </div>
            ))
          )}
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
    </div>
  );
};
