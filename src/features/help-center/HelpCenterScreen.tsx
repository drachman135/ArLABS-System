import React, { useEffect, useState } from 'react';
import { supabase } from '../../core/supabase';
import { 
  Search, 
  Loader2, 
  RefreshCw, 
  X, 
  HelpCircle, 
  Plus, 
  Edit3, 
  Trash2, 
  ExternalLink, 
  FolderTree
} from 'lucide-react';

export interface HelpCenterItem {
  id: string;
  title: string;
  subtitle?: string | null;
  category: string;
  key?: string | null;
  url?: string | null;
  parent_id?: string | null;
  order?: number | null;
  is_active?: boolean | null;
  created_at?: string;
  updated_at?: string | null;
}

export const HelpCenterScreen: React.FC = () => {
  const [items, setItems] = useState<HelpCenterItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modal states
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<HelpCenterItem | null>(null);
  const [formLoading, setFormLoading] = useState<boolean>(false);

  // Form fields
  const [title, setTitle] = useState<string>('');
  const [subtitle, setSubtitle] = useState<string>('');
  const [category, setCategory] = useState<string>('QUICK_HELP');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [itemKey, setItemKey] = useState<string>('');
  const [url, setUrl] = useState<string>('');
  const [parentId, setParentId] = useState<string>('');
  const [itemOrder, setItemOrder] = useState<string>('0');

  // Fetch help center hierarchy items
  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('help_center_hierarchy')
        .select('*')
        .order('order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setItems(data || []);
    } catch (err: any) {
      console.error('Failed to fetch help center hierarchy:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();

    // Real-time subscription
    const channel = supabase
      .channel('public:help_center_hierarchy')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'help_center_hierarchy' }, () => {
        fetchItems();
      })
      .subscribe();

    const handleDbRefresh = () => fetchItems();
    window.addEventListener('db-refresh', handleDbRefresh);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('db-refresh', handleDbRefresh);
    };
  }, []);

  // Open Modal for Create or Edit
  const handleOpenModal = (item?: HelpCenterItem) => {
    if (item) {
      setEditingItem(item);
      setTitle(item.title || '');
      setSubtitle(item.subtitle || '');
      
      const predefinedCats = ['QUICK_HELP', 'COMMUNICATION', 'FAQ', 'TUTORIAL'];
      if (predefinedCats.includes(item.category)) {
        setCategory(item.category);
        setCustomCategory('');
      } else {
        setCategory('CUSTOM');
        setCustomCategory(item.category || '');
      }

      setItemKey(item.key || '');
      setUrl(item.url || '');
      setParentId(item.parent_id || '');
      setItemOrder(item.order !== undefined && item.order !== null ? String(item.order) : '0');
    } else {
      setEditingItem(null);
      setTitle('');
      setSubtitle('');
      setCategory('QUICK_HELP');
      setCustomCategory('');
      setItemKey('');
      setUrl('');
      setParentId('');
      setItemOrder(String((items.length + 1) * 10));
    }
    setShowModal(true);
  };

  // Submit Form (Create / Update)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Judul (Title) wajib diisi');
      return;
    }

    const finalCategory = category === 'CUSTOM' ? customCategory.trim() : category;
    if (!finalCategory) {
      alert('Kategori wajib diisi');
      return;
    }

    setFormLoading(true);
    try {
      const payload: any = {
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        category: finalCategory,
        key: itemKey.trim() || null,
        url: url.trim() || null,
        parent_id: parentId ? parentId : null,
        order: parseInt(itemOrder, 10) || 0,
        updated_at: new Date().toISOString()
      };

      if (editingItem) {
        const { error } = await supabase
          .from('help_center_hierarchy')
          .update(payload)
          .eq('id', editingItem.id);

        if (error) throw error;

        // Log action
        await supabase.from('logs').insert([{
          action: 'HELP_CENTER_UPDATE',
          description: `Konten bantuan diubah: ${title}`,
          severity: 'info'
        }]);
      } else {
        const { error } = await supabase
          .from('help_center_hierarchy')
          .insert([{
            ...payload,
            created_at: new Date().toISOString()
          }]);

        if (error) throw error;

        // Log action
        await supabase.from('logs').insert([{
          action: 'HELP_CENTER_CREATE',
          description: `Konten bantuan baru ditambahkan: ${title}`,
          severity: 'info'
        }]);
      }

      setShowModal(false);
      fetchItems();
      window.dispatchEvent(new Event('db-refresh'));
    } catch (err: any) {
      console.error('Failed saving help center content:', err);
      alert(`Gagal menyimpan data: ${err?.message || 'Terjadi kesalahan sistem'}`);
    } finally {
      setFormLoading(false);
    }
  };

  // Delete Item
  const handleDeleteItem = async (item: HelpCenterItem) => {
    const confirmDel = window.confirm(`Apakah Anda yakin ingin menghapus konten "${item.title}"?`);
    if (!confirmDel) return;

    setActionLoading(item.id);
    try {
      const { error } = await supabase
        .from('help_center_hierarchy')
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      await supabase.from('logs').insert([{
        action: 'HELP_CENTER_DELETE',
        description: `Konten bantuan dihapus: ${item.title}`,
        severity: 'warning'
      }]);

      setItems(prev => prev.filter(x => x.id !== item.id));
      window.dispatchEvent(new Event('db-refresh'));
    } catch (err: any) {
      console.error('Failed to delete help center item:', err);
      alert(`Gagal menghapus data: ${err?.message || 'Terjadi kesalahan'}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Filter items based on search query & category
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      (item.title && item.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.key && item.key.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCat = categoryFilter === 'ALL' || item.category === categoryFilter;

    return matchesSearch && matchesCat;
  });

  // Extract unique categories for filter dropdown
  const uniqueCategories = Array.from(new Set(items.map(i => i.category))).filter(Boolean);

  // Helper to find parent title
  const getParentTitle = (parent_id?: string | null) => {
    if (!parent_id) return null;
    const found = items.find(i => i.id === parent_id);
    return found ? found.title : 'Unknown Parent';
  };

  return (
    <div className="space-y-6">
      {/* 1. Frosted Glass Action Header Panel */}
      <section className="bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] hover:shadow-[10px_10px_20px_#d1d5db,-10px_-10px_20px_#ffffff] transition-all duration-300 p-4 sm:p-6 rounded-[24px] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="w-full">
          <span className="tracking-widest text-[9px] font-bold text-[#64748B] uppercase">Android Client Content Sync</span>
          <h3 className="text-base font-black text-[#1E293B] tracking-tight mt-1 break-all">SYS // HELP_CENTER_HIERARCHY</h3>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search Field */}
          <div className="relative flex-grow sm:flex-grow-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <input
              type="text"
              placeholder="Cari bantuan, kategori, key..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs text-[#1E293B] placeholder:text-[#64748B]/60 focus:outline-none focus:border-[#0EA5E9] focus:ring-1 focus:ring-[#0EA5E9] transition-all duration-300 w-full sm:w-52 shadow-sm font-semibold"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-[#1E293B] focus:outline-none focus:border-[#0EA5E9] shadow-sm font-semibold cursor-pointer"
          >
            <option value="ALL">Semua Kategori</option>
            <option value="QUICK_HELP">QUICK_HELP</option>
            <option value="COMMUNICATION">COMMUNICATION</option>
            <option value="FAQ">FAQ</option>
            <option value="TUTORIAL">TUTORIAL</option>
            {uniqueCategories.map(cat => (
              !['QUICK_HELP', 'COMMUNICATION', 'FAQ', 'TUTORIAL'].includes(cat) && (
                <option key={cat} value={cat}>{cat}</option>
              )
            ))}
          </select>

          {/* Sync Trigger */}
          <button
            onClick={fetchItems}
            className="border border-white bg-white hover:border-[#0EA5E9]/50 hover:bg-[#0EA5E9]/10 text-[#1E293B] hover:text-[#0EA5E9] p-2 rounded-xl transition-all duration-300 shadow-sm flex items-center justify-center cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#0EA5E9]' : ''}`} />
          </button>

          {/* Add trigger */}
          <button
            onClick={() => handleOpenModal()}
            className="bg-[#0EA5E9] hover:bg-[#0ea5e9]/95 text-white font-bold text-xs py-2 px-4 rounded-xl transition-all duration-300 shadow-[2px_2px_5px_rgba(14,165,233,0.3)] active:scale-95 uppercase tracking-wide border-none flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>[ + Tambah Konten Bantuan ]</span>
          </button>
        </div>
      </section>

      {/* 2. Glassmorphic Table Container (Desktop Only) */}
      <div className="hidden lg:block bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] rounded-[24px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[850px]">
            <thead className="bg-gray-100/50 border-b border-gray-200/50 text-[#64748B] uppercase text-[9px] font-bold tracking-widest">
              <tr>
                <th className="py-4 px-6">TITLE & SUBTITLE</th>
                <th className="py-4 px-6">CATEGORY</th>
                <th className="py-4 px-6">KEY / IDENTIFIER</th>
                <th className="py-4 px-6">URL / TARGET</th>
                <th className="py-4 px-6">PARENT ID</th>
                <th className="py-4 px-6 text-center">ORDER</th>
                <th className="py-4 px-6 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-[#1E293B]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#64748B]">
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#0EA5E9]" />
                      <span>FETCHING_HELP_CENTER_DATA...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#64748B] font-bold tracking-wide uppercase">
                    BELUM ADA DATA HELP CENTER
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  let catBadge = 'bg-gray-100 text-gray-600 border border-gray-200';
                  if (item.category === 'QUICK_HELP') catBadge = 'bg-sky-50 text-[#0EA5E9] border border-sky-100';
                  else if (item.category === 'COMMUNICATION') catBadge = 'bg-emerald-50 text-emerald-600 border border-emerald-100';
                  else if (item.category === 'FAQ') catBadge = 'bg-amber-50 text-amber-600 border border-amber-100';
                  else if (item.category === 'TUTORIAL') catBadge = 'bg-purple-50 text-purple-600 border border-purple-100';

                  const parentName = getParentTitle(item.parent_id);

                  return (
                    <tr key={item.id} className={`transition-colors duration-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                      {/* Title & Subtitle */}
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="font-bold text-[#1E293B] text-xs">{item.title}</span>
                          {item.subtitle && (
                            <span className="text-[10px] text-[#64748B] font-semibold mt-0.5 line-clamp-1">{item.subtitle}</span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-4 px-6">
                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${catBadge}`}>
                          {item.category}
                        </span>
                      </td>

                      {/* Key */}
                      <td className="py-4 px-6 font-mono text-xs font-bold text-slate-700 select-all">
                        {item.key ? (
                          <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200 text-[#1E293B]">
                            {item.key}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-semibold">-</span>
                        )}
                      </td>

                      {/* URL / Target */}
                      <td className="py-4 px-6">
                        {item.url ? (
                          <div className="flex items-center space-x-1 max-w-[180px]">
                            <span className="text-[11px] font-mono text-blue-600 truncate underline" title={item.url}>
                              {item.url}
                            </span>
                            <a 
                              href={item.url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-gray-400 hover:text-blue-600"
                              title="Buka Tautan"
                            >
                              <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-gray-400 font-semibold">-</span>
                        )}
                      </td>

                      {/* Parent ID */}
                      <td className="py-4 px-6">
                        {parentName ? (
                          <div className="flex items-center space-x-1.5 text-xs text-indigo-600 font-bold">
                            <FolderTree className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{parentName}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[10px] uppercase font-bold">Top Level</span>
                        )}
                      </td>

                      {/* Order */}
                      <td className="py-4 px-6 text-center font-mono font-bold text-xs text-slate-600">
                        {item.order ?? 0}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleOpenModal(item)}
                            disabled={actionLoading === item.id}
                            className="bg-slate-100 hover:bg-[#0EA5E9] hover:text-white text-slate-700 p-2 rounded-xl transition-all duration-200 shadow-sm border-none cursor-pointer"
                            title="Edit Konten"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item)}
                            disabled={actionLoading === item.id}
                            className="bg-red-50 hover:bg-red-500 hover:text-white text-red-500 p-2 rounded-xl transition-all duration-200 shadow-sm border-none cursor-pointer"
                            title="Hapus Konten"
                          >
                            {actionLoading === item.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
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
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-white border border-gray-200 rounded-[20px] p-5 space-y-3">
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              <div className="h-3 bg-gray-100 rounded w-1/2"></div>
              <div className="h-8 bg-gray-100 rounded"></div>
            </div>
          ))
        ) : filteredItems.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-[20px] p-8 text-center text-[#64748B] font-bold uppercase tracking-wider">
            BELUM ADA DATA HELP CENTER
          </div>
        ) : (
          filteredItems.map((item) => {
            let catBadge = 'bg-gray-100 text-gray-600 border border-gray-200';
            if (item.category === 'QUICK_HELP') catBadge = 'bg-sky-50 text-[#0EA5E9] border border-sky-100';
            else if (item.category === 'COMMUNICATION') catBadge = 'bg-emerald-50 text-emerald-600 border border-emerald-100';
            else if (item.category === 'FAQ') catBadge = 'bg-amber-50 text-amber-600 border border-amber-100';
            else if (item.category === 'TUTORIAL') catBadge = 'bg-purple-50 text-purple-600 border border-purple-100';

            const parentName = getParentTitle(item.parent_id);

            return (
              <div key={item.id} className="bg-white border border-gray-200/80 rounded-[20px] p-4 space-y-3 shadow-sm">
                <div className="flex justify-between items-start gap-2">
                  <div className="font-bold text-xs text-[#1E293B]">
                    {item.title}
                    {item.subtitle && (
                      <p className="text-[10px] text-[#64748B] font-semibold mt-0.5">{item.subtitle}</p>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wide flex-shrink-0 ${catBadge}`}>
                    {item.category}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] text-[#64748B] pt-2.5 border-t border-gray-50">
                  <div>
                    <span className="block font-semibold text-[8px] text-gray-400 uppercase">Key / Identifier</span>
                    <span className="font-mono font-bold text-[#1E293B] block truncate">
                      {item.key || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="block font-semibold text-[8px] text-gray-400 uppercase">Parent Item</span>
                    <span className="font-bold text-indigo-600 block truncate">
                      {parentName || 'Top Level'}
                    </span>
                  </div>
                  <div>
                    <span className="block font-semibold text-[8px] text-gray-400 uppercase">Order</span>
                    <span className="font-mono font-bold text-[#1E293B] block">
                      {item.order ?? 0}
                    </span>
                  </div>
                  <div>
                    <span className="block font-semibold text-[8px] text-gray-400 uppercase">Target URL</span>
                    <span className="font-mono text-blue-600 block truncate">
                      {item.url || '-'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100 justify-end">
                  <button
                    onClick={() => handleOpenModal(item)}
                    className="bg-slate-100 hover:bg-[#0EA5E9] hover:text-white text-slate-700 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item)}
                    className="bg-red-50 hover:bg-red-500 hover:text-white text-red-500 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* --- CREATE / EDIT MODAL --- */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#E6E9EF]/60 backdrop-blur-md animate-[zoomInSoft_0.25s_ease-out]">
          <div className="w-full max-w-lg bg-[#E6E9EF] p-6 rounded-[2.5rem] neu-flat max-h-[90vh] overflow-y-auto relative flex flex-col space-y-6">
            
            {/* Close Button */}
            <button 
              onClick={() => setShowModal(false)}
              className="absolute top-6 right-6 w-10 h-10 rounded-full flex items-center justify-center text-[#A0AEC0] hover:text-[#2D3748] bg-[#E6E9EF] neu-flat hover:neu-pressed transition-all cursor-pointer border-none"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Title Header */}
            <div className="flex items-center space-x-4 pt-2">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-[#0EA5E9] flex items-center justify-center flex-shrink-0 neu-convex">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-[#2D3748] uppercase tracking-tight">
                  {editingItem ? 'Edit Konten Bantuan' : 'Tambah Konten Baru'}
                </h3>
                <p className="text-[10px] text-[#718096] font-bold">
                  {editingItem ? `ID: ${editingItem.id}` : 'Registrasi item help_center_hierarchy'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4">
              {/* Title Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-[#4A5568] uppercase tracking-wider block">
                  Judul Konten (Title) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Panduan Penggunaan"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-3.5 rounded-2xl bg-[#E6E9EF] neu-inset text-xs font-bold text-[#2D3748] placeholder:text-[#A0AEC0] border-none focus:outline-none"
                />
              </div>

              {/* Subtitle Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-[#4A5568] uppercase tracking-wider block">
                  Deskripsi / Subtitle
                </label>
                <input
                  type="text"
                  placeholder="e.g. Panduan tertulis memulai sistem kasir"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="w-full p-3.5 rounded-2xl bg-[#E6E9EF] neu-inset text-xs font-bold text-[#2D3748] placeholder:text-[#A0AEC0] border-none focus:outline-none"
                />
              </div>

              {/* Category & Key Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-[#4A5568] uppercase tracking-wider block">
                    Kategori Tab (Android) *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-3.5 rounded-2xl bg-[#E6E9EF] neu-inset text-xs font-bold text-[#2D3748] border-none focus:outline-none cursor-pointer"
                  >
                    <option value="QUICK_HELP">QUICK_HELP (Bantuan Cepat)</option>
                    <option value="COMMUNICATION">COMMUNICATION (Saluran Komunikasi)</option>
                    <option value="FAQ">FAQ</option>
                    <option value="TUTORIAL">TUTORIAL</option>
                    <option value="CUSTOM">+ Kategori Kustom</option>
                  </select>
                  {category === 'CUSTOM' && (
                    <input
                      type="text"
                      required
                      placeholder="Ketik string kategori..."
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="w-full p-3 mt-2 rounded-xl bg-[#E6E9EF] neu-inset text-xs font-bold text-[#2D3748] placeholder:text-[#A0AEC0] border-none focus:outline-none"
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-[#4A5568] uppercase tracking-wider block">
                    Key / Identifier
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. panduan_penggunaan"
                    value={itemKey}
                    onChange={(e) => setItemKey(e.target.value)}
                    className="w-full p-3.5 rounded-2xl bg-[#E6E9EF] neu-inset font-mono text-xs font-bold text-[#2D3748] placeholder:text-[#A0AEC0] border-none focus:outline-none"
                  />
                </div>
              </div>

              {/* URL & Parent ID Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-[#4A5568] uppercase tracking-wider block">
                    Target URL / Tautan
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. https://... atau mailto:..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full p-3.5 rounded-2xl bg-[#E6E9EF] neu-inset font-mono text-xs font-bold text-[#2D3748] placeholder:text-[#A0AEC0] border-none focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-[#4A5568] uppercase tracking-wider block">
                    Parent ID (Hierarchy)
                  </label>
                  <select
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                    className="w-full p-3.5 rounded-2xl bg-[#E6E9EF] neu-inset text-xs font-bold text-[#2D3748] border-none focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Top Level (Tidak ada Parent) --</option>
                    {items
                      .filter(i => !editingItem || i.id !== editingItem.id)
                      .map(i => (
                        <option key={i.id} value={i.id}>
                          {i.title} ({i.category})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Order (@SerializedName("order")) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-[#4A5568] uppercase tracking-wider block">
                  Order (Urutan Tampilan di Android)
                </label>
                <input
                  type="number"
                  value={itemOrder}
                  onChange={(e) => setItemOrder(e.target.value)}
                  className="w-full p-3.5 rounded-2xl bg-[#E6E9EF] neu-inset font-mono text-xs font-bold text-[#2D3748] border-none focus:outline-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3.5 text-[#718096] font-black uppercase tracking-wider text-xs rounded-xl bg-[#E6E9EF] neu-flat hover:neu-pressed transition-all cursor-pointer border-none"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-3.5 text-white font-black uppercase tracking-wider text-xs rounded-xl bg-[#0EA5E9] hover:bg-[#0ea5e9]/90 shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer border-none"
                >
                  {formLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingItem ? 'Simpan Perubahan' : 'Tambah Konten'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
