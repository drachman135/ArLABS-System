import React, { useEffect, useState } from 'react';
import { supabase } from '../../core/supabase';
import { 
  RefreshCw, 
  Loader2, 
  Megaphone, 
  Trash2, 
  Image as ImageIcon, 
  Calendar,
  HelpCircle,
  X
} from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'POPUP' | 'BANNER';
  image_url: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
}

export const AnnouncementScreen: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitLoading, setSubmitLoading] = useState<boolean>(false);

  // Form states
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [type, setType] = useState<'POPUP' | 'BANNER'>('POPUP');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [dragActive, setDragActive] = useState<boolean>(false);

  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // Setup/Cleanup image preview URL
  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(imageFile);
    setImagePreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  // Fetch announcements list
  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setAnnouncements(data);
      }
    } catch (err) {
      console.error("Failed to fetch announcements:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  // Handle file drop
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
      setImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  // Open confirmation modal
  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      alert("Silakan tentukan masa aktif pengumuman.");
      return;
    }
    setShowConfirmModal(true);
  };

  // Execution handler after confirmation
  const executeCreateAnnouncement = async () => {
    setShowConfirmModal(false);
    setSubmitLoading(true);
    try {
      let imageUrl: string | null = null;

      // Step 1: Upload image if selected
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('notification-images')
          .upload(fileName, imageFile);

        if (uploadError) {
          console.error("Supabase Storage Upload Error:", uploadError);
          throw uploadError;
        }

        const { data: publicUrlData } = supabase.storage
          .from('notification-images')
          .getPublicUrl(fileName);

        imageUrl = publicUrlData.publicUrl;
      }

      // Step 2: Insert complete record into announcements table
      const { error: insertError } = await supabase
        .from('announcements')
        .insert([
          {
            title,
            content,
            type,
            image_url: imageUrl,
            start_date: new Date(startDate).toISOString(),
            end_date: new Date(endDate).toISOString()
          }
        ]);

      if (insertError) {
        throw insertError;
      }

      // Success feedback
      alert("Pengumuman berhasil dibuat!");
      
      // Reset form fields
      setTitle('');
      setContent('');
      setType('POPUP');
      setImageFile(null);
      setStartDate('');
      setEndDate('');

      // Refresh list
      await fetchAnnouncements();
    } catch (err: any) {
      console.error("Gagal membuat pengumuman:", err);
      alert(`Gagal membuat pengumuman: ${err.message || 'Kesalahan jaringan'}`);
    } finally {
      setSubmitLoading(false);
    }
  };

  // Delete handler
  const handleDeleteAnnouncement = async (ann: Announcement) => {
    const confirmDelete = window.confirm("Apakah Anda yakin ingin menghapus pengumuman ini secara permanen?");
    if (!confirmDelete) return;

    try {
      // Step 1: Delete associated image from Supabase storage if applicable
      if (ann.image_url) {
        const fileName = ann.image_url.substring(ann.image_url.lastIndexOf('/') + 1);
        await supabase.storage
          .from('notification-images')
          .remove([fileName]);
      }

      // Step 2: Delete DB record
      const { error: deleteError } = await supabase
        .from('announcements')
        .delete()
        .eq('id', ann.id);

      if (deleteError) {
        throw deleteError;
      }

      alert("Pengumuman berhasil dihapus!");
      
      // Refresh list
      await fetchAnnouncements();
    } catch (err: any) {
      console.error("Gagal menghapus pengumuman:", err);
      alert(`Gagal menghapus pengumuman: ${err.message}`);
    }
  };

  // Helper to calculate status
  const getStatusText = (start: string, end: string) => {
    const now = new Date().getTime();
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();

    if (now >= startTime && now <= endTime) {
      return 'ACTIVE';
    }
    return 'EXPIRED';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 font-['Outfit'] select-none">
      
      {/* Header Panel */}
      <section className="bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] hover:shadow-[10px_10px_20px_#d1d5db,-10px_-10px_20px_#ffffff] transition-all duration-300 p-6 rounded-[24px] flex justify-between items-center">
        <div>
          <span className="tracking-widest text-[9px] font-bold text-[#64748B] uppercase">Notification & Announcements</span>
          <h3 className="text-base font-black text-[#1E293B] tracking-tight mt-1">SYS // IN_APP_ANNOUNCEMENT_MANAGER</h3>
        </div>

        <button
          onClick={fetchAnnouncements}
          className="border border-white bg-white hover:border-[#0EA5E9]/50 hover:bg-[#0EA5E9]/10 text-[#1E293B] hover:text-[#0EA5E9] p-2.5 rounded-xl transition-all duration-300 shadow-sm flex items-center justify-center"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </section>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Composer Form */}
        <div className="lg:col-span-5 space-y-6">
          <div className="flex items-center space-x-2 text-[#64748B]">
            <Megaphone className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Announcement Composer</span>
          </div>

          <form onSubmit={handleCreateAnnouncement} className="bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] p-6 rounded-[24px] space-y-5">
            
            {/* Title */}
            <div className="space-y-2 text-xs">
              <label className="block text-[9px] text-[#64748B] uppercase font-bold tracking-widest">
                Announcement Title
              </label>
              <input
                type="text"
                required
                placeholder="Enter title (e.g. Server Maintenance)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] shadow-sm font-semibold"
              />
            </div>

            {/* Content */}
            <div className="space-y-2 text-xs">
              <label className="block text-[9px] text-[#64748B] uppercase font-bold tracking-widest">
                Body Content
              </label>
              <textarea
                required
                rows={3}
                placeholder="Enter description content..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] shadow-sm resize-none"
              />
            </div>

            {/* Type & File picker grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <label className="block text-[9px] text-[#64748B] uppercase font-bold tracking-wider">
                  Layout Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] cursor-pointer shadow-sm font-bold"
                >
                  <option value="POPUP">POPUP CARD</option>
                  <option value="BANNER">BANNER NOTIFICATION</option>
                </select>
              </div>

              {/* Active Dates Scheduling */}
              <div className="space-y-2">
                <label className="block text-[9px] text-[#64748B] uppercase font-bold tracking-wider">
                  Active Start Date
                </label>
                <input
                  type="datetime-local"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] font-mono shadow-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <label className="block text-[9px] text-[#64748B] uppercase font-bold tracking-wider">
                  Active End Date
                </label>
                <input
                  type="datetime-local"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] font-mono shadow-sm"
                />
              </div>

              {/* Dummy spacing to align form grids */}
              <div className="hidden md:block"></div>
            </div>

            {/* Media Upload Area */}
            <div className="space-y-2 text-xs">
              <label className="block text-[9px] text-[#64748B] uppercase font-bold tracking-widest">
                Banner / Poster Media File
              </label>
              
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`relative w-full h-36 border-2 border-dashed rounded-2xl flex flex-col justify-center items-center transition-all duration-300 overflow-hidden ${
                  dragActive ? 'border-[#0EA5E9] bg-[#0EA5E9]/5' : 'border-gray-300 hover:border-gray-400 bg-gray-50/50'
                }`}
              >
                {imagePreviewUrl ? (
                  <div className="absolute inset-0 w-full h-full group">
                    <img src={imagePreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex flex-col justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-4">
                      <p className="text-[10px] text-white font-bold mb-2 truncate max-w-full">{imageFile?.name}</p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setImageFile(null);
                        }}
                        className="bg-red-500 hover:bg-red-600 text-white font-bold text-[9px] px-3 py-1.5 rounded-lg transition-colors uppercase tracking-wider"
                      >
                        Hapus Gambar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <div className="text-center p-4 space-y-1">
                      <div className="flex justify-center text-[#64748B]">
                        <ImageIcon className="w-8 h-8 opacity-70" />
                      </div>
                      <p className="text-[10px] text-[#64748B] font-bold">
                        Drag & drop image here or click to browse
                      </p>
                      <p className="text-[9px] text-gray-400">Supported formats: JPEG, PNG, WEBP (Max 2MB)</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <button
              type="submit"
              disabled={submitLoading}
              className="w-full bg-[#0EA5E9] hover:bg-[#0ea5e9]/95 text-white font-bold text-xs py-3 rounded-xl transition-all duration-300 shadow-[2px_2px_5px_rgba(14,165,233,0.3)] flex items-center justify-center space-x-2 active:scale-98"
            >
              {submitLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Megaphone className="w-4 h-4" />
                  <span>[ Publish Announcement ]</span>
                </>
              )}
            </button>

          </form>
        </div>

        {/* Right Side: Log History Table */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center space-x-2 text-[#64748B]">
            <Calendar className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Announcement History Logs</span>
          </div>

          <div className="bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] rounded-[24px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[650px]">
                <thead className="bg-gray-100/50 border-b border-gray-200/50 text-[#64748B] uppercase text-[9px] font-bold tracking-widest">
                  <tr>
                    <th className="py-4 px-6">Announcement Title</th>
                    <th className="py-4 px-6">Type</th>
                    <th className="py-4 px-6">Active Range</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-[#1E293B]">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-[#64748B]">
                        <div className="flex items-center justify-center space-x-2">
                          <Loader2 className="w-4 h-4 animate-spin text-[#0EA5E9]" />
                          <span>FETCHING_ANNOUNCEMENT_RECORDS...</span>
                        </div>
                      </td>
                    </tr>
                  ) : announcements.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-[#64748B] font-bold tracking-wide uppercase">
                        NO_ANNOUNCEMENT_RECORDS_FOUND
                      </td>
                    </tr>
                  ) : (
                    announcements.map((ann, idx) => {
                      const status = getStatusText(ann.start_date, ann.end_date);
                      const isPopup = ann.type === 'POPUP';
                      const isActive = status === 'ACTIVE';

                      const typeBadge = isPopup 
                        ? 'bg-purple-50 text-purple-600 border border-purple-100'
                        : 'bg-indigo-50 text-indigo-600 border border-indigo-100';

                      const statusBadge = isActive
                        ? 'bg-green-50 text-green-600 border border-green-100'
                        : 'bg-red-50 text-red-500 border border-red-100';

                      return (
                        <tr key={ann.id} className={`hover:bg-gray-50/50 transition-colors duration-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/10'}`}>
                          {/* Title & Preview Image Indicator */}
                          <td className="py-4 px-6 font-bold text-[#1E293B]">
                            <div className="flex items-center space-x-2">
                              <span>{ann.title}</span>
                              {ann.image_url && (
                                <a 
                                  href={ann.image_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-sky-500 hover:underline flex items-center"
                                  title="View Media"
                                >
                                  <ImageIcon className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          </td>

                          {/* Type */}
                          <td className="py-4 px-6 font-mono text-[9px]">
                            <span className={`px-2 py-0.5 rounded font-bold uppercase ${typeBadge}`}>
                              {ann.type}
                            </span>
                          </td>

                          {/* Date range */}
                          <td className="py-4 px-6 font-mono text-[10px] text-[#64748B] space-y-0.5">
                            <div>S: {new Date(ann.start_date).toLocaleDateString()} {new Date(ann.start_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}</div>
                            <div>E: {new Date(ann.end_date).toLocaleDateString()} {new Date(ann.end_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}</div>
                          </td>

                          {/* Status */}
                          <td className="py-4 px-6 font-mono text-[9px]">
                            <span className={`px-2 py-0.5 rounded font-bold uppercase ${statusBadge}`}>
                              {status}
                            </span>
                          </td>

                          {/* Action */}
                          <td className="py-4 px-6 text-right">
                            <button
                              onClick={() => handleDeleteAnnouncement(ann)}
                              className="bg-red-50 hover:bg-red-500 hover:text-white border border-red-200 hover:border-transparent text-[11px] font-bold text-red-600 p-2 rounded-lg transition-all duration-300 shadow-sm inline-flex items-center space-x-1"
                              title="Delete Announcement"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        </div>

      </div>

      {/* 4. Neumorphic Glass Confirmation Modal with Live Preview */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white/95 border border-white/60 shadow-[10px_10px_30px_rgba(0,0,0,0.15)] p-6 max-w-lg w-full rounded-[24px] flex flex-col space-y-6 animate-scale-up max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div className="flex items-center space-x-2 text-[#1E293B]">
                <HelpCircle className="w-5 h-5 text-[#0EA5E9]" />
                <h4 className="text-sm font-black uppercase tracking-wider">Confirm Announcement</h4>
              </div>
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#64748B] leading-relaxed">
              Silakan konfirmasi pratinjau tampilan pengumuman berikut sebelum dipublikasikan ke perangkat Android:
            </p>

            {/* Live Preview Container (Mock Screen) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center relative min-h-[220px] overflow-hidden shadow-inner">
              <span className="absolute top-2 left-3 text-[8px] font-bold text-white/30 uppercase tracking-widest font-mono">
                Android Device Mockup
              </span>

              {type === 'POPUP' ? (
                // POPUP LAYOUT PREVIEW
                <div className="w-full max-w-[260px] bg-white rounded-2xl shadow-xl overflow-hidden animate-fade-in flex flex-col">
                  {imagePreviewUrl && (
                    <img 
                      src={imagePreviewUrl} 
                      alt="Popup preview image" 
                      className="w-full h-32 object-cover border-b border-gray-100" 
                    />
                  )}
                  <div className="p-4 space-y-2 text-left">
                    <h5 className="text-xs font-black text-[#1E293B] tracking-tight">{title || 'Announcement Title'}</h5>
                    <p className="text-[10px] text-gray-600 leading-normal max-h-[80px] overflow-y-auto whitespace-pre-wrap">{content || 'Description content text...'}</p>
                    <button 
                      type="button"
                      disabled
                      className="w-full bg-[#0EA5E9] text-white font-bold text-[9px] py-2 rounded-lg mt-1 uppercase"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              ) : (
                // BANNER LAYOUT PREVIEW
                <div className="w-full max-w-[320px] bg-white/95 backdrop-blur-md border border-white/20 p-3.5 rounded-xl shadow-lg flex items-center space-x-3 text-left animate-fade-in absolute top-8 left-1/2 -translate-x-1/2">
                  {imagePreviewUrl && (
                    <img 
                      src={imagePreviewUrl} 
                      alt="Banner thumbnail" 
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0" 
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h5 className="text-[11px] font-black text-[#1E293B] truncate leading-tight">{title || 'Banner Title'}</h5>
                    <p className="text-[9px] text-gray-600 truncate leading-snug">{content || 'Description snippet content...'}</p>
                  </div>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9] animate-pulse" />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold text-xs py-3 rounded-xl transition-all duration-300 shadow-sm uppercase tracking-wider"
              >
                [ Batal ]
              </button>
              <button
                onClick={executeCreateAnnouncement}
                className="flex-1 bg-[#0EA5E9] hover:bg-[#0ea5e9]/95 text-white font-bold text-xs py-3 rounded-xl transition-all duration-300 shadow-md uppercase tracking-wider"
              >
                [ Publikasikan ]
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
