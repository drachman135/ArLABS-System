import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../core/supabase';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Tag, 
  X,
  ChevronDown,
  GripVertical,
  ArrowDownUp,
  Pin,
  Copy,
  LayoutGrid,
  List,
  Send
} from 'lucide-react';

interface Application {
  id: string;
  app_name: string;
  package_name: string;
}

interface DevNote {
  id: string;
  app_id?: string;
  title: string;
  description: string;
  target_version: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  type: 'BUG' | 'FEATURE' | 'IMPROVEMENT' | 'TASK';
  is_pinned?: boolean;
  labels?: string[];
  created_at: string;
  updated_at: string;
}

export const DevNotesScreen: React.FC = () => {
  const [apps, setApps] = useState<Application[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [appStatuses, setAppStatuses] = useState<Record<string, 'RED' | 'GREEN'>>({});
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [notes, setNotes] = useState<DevNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Tab, Filter & Sorting states
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'COMPLETED'>('ACTIVE');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST' | 'PRIORITY'>('NEWEST');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<DevNote | null>(null);
  
  const [viewingNote, setViewingNote] = useState<DevNote | null>(null);
  const [newItemText, setNewItemText] = useState('');
  
  // Drag and Drop states
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [dragOverItemIndex, setDragOverItemIndex] = useState<number | null>(null);
  
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, type: 'NOTE' | 'ITEM', id: string, lineIndex?: number} | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>(() => {
    const saved = localStorage.getItem('devNotesViewMode');
    return (saved === 'LIST' || saved === 'GRID') ? saved : 'GRID';
  });

  useEffect(() => {
    localStorage.setItem('devNotesViewMode', viewMode);
  }, [viewMode]);
  
  // Mobile UX States
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [swipeY, setSwipeY] = useState(0);
  const [startY, setStartY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    type: string;
    priority: string;
    target_version: string;
    labels: string[];
  }>({
    title: '',
    description: '',
    type: 'BUG',
    priority: 'MEDIUM',
    target_version: '',
    labels: []
  });

  useEffect(() => {
    fetchApps();
  }, []);

  useEffect(() => {
    if (selectedAppId) {
      fetchNotes(selectedAppId);
      localStorage.setItem('lastSelectedAppId_devNotes', selectedAppId);
    } else {
      setNotes([]);
    }
  }, [selectedAppId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (selectedAppId) {
      if (notes.length > 0) {
        let hasRed = false;
        for (const note of notes) {
          const lines = (note.description || '').split('\n').filter(l => l.trim() !== '');
          const hasUnchecked = lines.length === 0 || lines.some(l => !l.trim().match(/^(\[[xXvV]\]|\([xXvV]\))/));
          if (hasUnchecked) {
            hasRed = true;
            break;
          }
        }
        setAppStatuses(prev => ({ ...prev, [selectedAppId]: hasRed ? 'RED' : 'GREEN' }));
      } else if (!loading) {
        setAppStatuses(prev => ({ ...prev, [selectedAppId]: 'GREEN' }));
      }
    }
  }, [notes, selectedAppId, loading]);

  const fetchApps = async () => {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('id, app_name, package_name')
        .order('app_name', { ascending: true });

      if (error) throw error;
      setApps(data || []);
      
      const { data: allNotes, error: notesError } = await supabase
        .from('dev_notes')
        .select('app_id, description');
        
      if (!notesError && allNotes) {
        const statuses: Record<string, 'RED' | 'GREEN'> = {};
        const appNotes: Record<string, any[]> = {};
        
        allNotes.forEach(note => {
          if (note.app_id) {
            if (!appNotes[note.app_id]) appNotes[note.app_id] = [];
            appNotes[note.app_id].push(note);
          }
        });

        Object.keys(appNotes).forEach(appId => {
          const appNoteList = appNotes[appId];
          let hasRed = false;
          
          for (const note of appNoteList) {
            const lines = (note.description || '').split('\n').filter((l: string) => l.trim() !== '');
            const hasUnchecked = lines.length === 0 || lines.some((l: string) => !l.trim().match(/^(\[[xXvV]\]|\([xXvV]\))/));
            if (hasUnchecked) {
              hasRed = true;
              break;
            }
          }
          statuses[appId] = hasRed ? 'RED' : 'GREEN';
        });
        
        setAppStatuses(statuses);
      }

      if (data && data.length > 0) {
        const savedAppId = localStorage.getItem('lastSelectedAppId_devNotes');
        const isValidApp = data.find(app => app.id === savedAppId);
        if (isValidApp) {
          setSelectedAppId(savedAppId);
        } else {
          setSelectedAppId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching apps:', err);
    }
  };

  const fetchNotes = async (appId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('dev_notes')
        .select('*')
        .eq('app_id', appId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (err) {
      console.error('Error fetching dev notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (note?: DevNote) => {
    if (note) {
      setEditingNote(note);
      setFormData({
        title: note.title,
        description: note.description,
        target_version: note.target_version || '',
        priority: note.priority,
        type: note.type,
        labels: note.labels || []
      });
    } else {
      setEditingNote(null);
      setFormData({
        title: '',
        description: '',
        target_version: '',
        priority: 'MEDIUM',
        type: 'BUG',
        labels: []
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingNote(null);
  };

  const handleSaveNote = async () => {
    if (!formData.title) return;
    
    setLoading(true);
    try {
      if (editingNote) {
        const { error } = await supabase
          .from('dev_notes')
          .update({
            title: formData.title,
            description: formData.description,
            target_version: formData.target_version || null,
            priority: formData.priority,
            type: formData.type,
            labels: formData.labels,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingNote.id);
          
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('dev_notes')
          .insert([{
            app_id: selectedAppId,
            title: formData.title,
            description: formData.description,
            target_version: formData.target_version || null,
            status: 'OPEN',
            priority: formData.priority,
            type: formData.type,
            labels: formData.labels
          }]);
          
        if (error) throw error;
      }
      
      handleCloseModal();
      if (selectedAppId) fetchNotes(selectedAppId);
    } catch (err) {
      console.error('Error saving dev note:', err);
      alert('Gagal menyimpan catatan');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('dev_notes')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      setDeleteConfirm(null);
      if (selectedAppId) fetchNotes(selectedAppId);
    } catch (err) {
      console.error('Error deleting note:', err);
      alert('Gagal menghapus catatan');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePin = async (note: DevNote, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const updatedNote = { ...note, is_pinned: !note.is_pinned };
    setNotes(notes.map(n => n.id === note.id ? updatedNote : n));
    
    try {
      const { error } = await supabase
        .from('dev_notes')
        .update({ is_pinned: !note.is_pinned, updated_at: new Date().toISOString() })
        .eq('id', note.id);
        
      if (error) throw error;
    } catch (err) {
      console.error('Error toggling pin:', err);
      if (selectedAppId) fetchNotes(selectedAppId);
    }
  };

  const handleToggleChecklist = async (note: DevNote, lineIndex: number) => {
    const lines = note.description.split('\n');
    let lineToUpdate = lines[lineIndex];

    const hasCheckedMark = lineToUpdate.trim().match(/^(\[[xXvV]\]|\([xXvV]\))/);
    const hasUncheckedMark = lineToUpdate.trim().startsWith('[ ]');

    if (hasCheckedMark) {
      // Uncheck it
      lineToUpdate = lineToUpdate.replace(/^(\s*)(\[[xXvV]\]|\([xXvV]\))\s*/, '$1[ ] ');
    } else if (hasUncheckedMark) {
      // Check it
      lineToUpdate = lineToUpdate.replace(/^(\s*)\[ \]\s*/, '$1[x] ');
    } else if (lineToUpdate.trim().startsWith('-')) {
      // Replace dash with checked mark
      lineToUpdate = lineToUpdate.replace(/^(\s*)-\s*/, '$1[x] ');
    } else {
      // Prepend checked mark
      lineToUpdate = '[x] ' + lineToUpdate;
    }

    lines[lineIndex] = lineToUpdate;
    const newDescription = lines.join('\n');

    // Optimistic update
    const updatedNote = { ...note, description: newDescription };
    setViewingNote(updatedNote);
    setNotes(notes.map(n => n.id === note.id ? updatedNote : n));

    try {
      const { error } = await supabase
        .from('dev_notes')
        .update({ description: newDescription, updated_at: new Date().toISOString() })
        .eq('id', note.id);
        
      if (error) throw error;
    } catch (err) {
      console.error('Error toggling checklist:', err);
      setViewingNote(note); // Revert UI
      if (selectedAppId) fetchNotes(selectedAppId);
    }
  };

  const handleAddNewItem = async () => {
    if (!newItemText.trim() || !viewingNote) return;
    
    const newDescription = viewingNote.description.trim() 
      ? viewingNote.description + `\n[ ] ${newItemText}` 
      : `[ ] ${newItemText}`;
      
    const updatedNote = { ...viewingNote, description: newDescription };
    setViewingNote(updatedNote);
    setNotes(notes.map(n => n.id === viewingNote.id ? updatedNote : n));
    setNewItemText('');

    try {
      const { error } = await supabase
        .from('dev_notes')
        .update({ description: newDescription, updated_at: new Date().toISOString() })
        .eq('id', viewingNote.id);
        
      if (error) throw error;
    } catch (err) {
      console.error('Error adding item:', err);
      if (selectedAppId) fetchNotes(selectedAppId);
    }
  };

  const handleDeleteChecklistItem = async (lineIndex: number) => {
    if (!viewingNote) return;
    
    const lines = viewingNote.description.split('\n');
    lines.splice(lineIndex, 1);
    const newDescription = lines.join('\n');
      
    const updatedNote = { ...viewingNote, description: newDescription };
    setViewingNote(updatedNote);
    setNotes(notes.map(n => n.id === viewingNote.id ? updatedNote : n));
    setDeleteConfirm(null);

    try {
      const { error } = await supabase
        .from('dev_notes')
        .update({ description: newDescription, updated_at: new Date().toISOString() })
        .eq('id', viewingNote.id);
        
      if (error) throw error;
    } catch (err) {
      console.error('Error deleting item:', err);
      if (selectedAppId) fetchNotes(selectedAppId);
    }
  };

  const handleCopyUnchecked = async () => {
    if (!viewingNote) return;
    
    const lines = viewingNote.description.split('\n');
    const uncheckedTasks = lines.filter(line => {
      if (line.trim() === '') return false;
      const isChecked = line.trim().match(/^(\[[xXvV]\]|\([xXvV]\))/);
      return !isChecked;
    }).map(line => line.replace(/^(\[[xXvV ]\]|\([xXvV ]\)|-)\s*/i, '').trim());
    
    if (uncheckedTasks.length > 0) {
      const action = viewingNote.type === 'BUG' ? 'melakukan perbaikan bug' : 
                     viewingNote.type === 'FEATURE' ? 'melakukan implementasi fitur' : 
                     viewingNote.type === 'IMPROVEMENT' ? 'melakukan peningkatan sistem' : 
                     'mengerjakan tugas';
                     
      const targetApp = apps.find(a => a.id === viewingNote.app_id);
      
      let flavorText = '';
      if (targetApp && targetApp.app_name) {
        const parts = targetApp.app_name.trim().split(' ');
        const lastName = parts[parts.length - 1];
        flavorText = ` pada flavor ${lastName.toLowerCase()} saja tanpa melakukan perubahan pada flavor lainnya`;
      }
      
      const textToCopy = `Tolong bantu saya ${action}${flavorText} berdasarkan daftar berikut:\n\n${uncheckedTasks.map(t => `- ${t}`).join('\n')}`;
      try {
        await navigator.clipboard.writeText(textToCopy);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy text: ', err);
      }
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverItemIndex(index);
  };

  const handleDragEnd = async () => {
    if (draggedItemIndex !== null && dragOverItemIndex !== null && draggedItemIndex !== dragOverItemIndex && viewingNote) {
      const lines = viewingNote.description.split('\n');
      
      const draggedLine = lines[draggedItemIndex];
      lines.splice(draggedItemIndex, 1);
      lines.splice(dragOverItemIndex, 0, draggedLine);
      
      const newDescription = lines.join('\n');
      
      const updatedNote = { ...viewingNote, description: newDescription };
      setViewingNote(updatedNote);
      setNotes(notes.map(n => n.id === viewingNote.id ? updatedNote : n));
      
      try {
        const { error } = await supabase
          .from('dev_notes')
          .update({ description: newDescription, updated_at: new Date().toISOString() })
          .eq('id', viewingNote.id);
        if (error) throw error;
      } catch (err) {
        console.error('Error reordering items:', err);
        if (selectedAppId) fetchNotes(selectedAppId);
      }
    }
    setDraggedItemIndex(null);
    setDragOverItemIndex(null);
  };

  const priorityWeight: Record<string, number> = {
    'CRITICAL': 4,
    'HIGH': 3,
    'MEDIUM': 2,
    'LOW': 1
  };

  const processedNotes = notes.filter(note => {
    // Determine completed status based on checklist
    const lines = (note.description || '').split('\n').filter(l => l.trim() !== '');
    const hasUnchecked = lines.length === 0 || lines.some(l => !l.trim().match(/^(\[[xXvV]\]|\([xXvV]\))/));
    const isCompleted = !hasUnchecked;
    
    // Tab filter
    if (activeTab === 'ACTIVE' && isCompleted) return false;
    if (activeTab === 'COMPLETED' && !isCompleted) return false;
    
    // Search filter
    const matchesSearch = note.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          note.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Type filter
    const matchesType = filterType === 'ALL' || note.type === filterType;
    
    // Priority filter
    const matchesPriority = filterPriority === 'ALL' || note.priority === filterPriority;
    
    return matchesSearch && matchesType && matchesPriority;
  }).sort((a, b) => {
    // Pinned notes always come first if we are in ACTIVE tab
    if (activeTab === 'ACTIVE') {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
    }
    
    if (sortBy === 'PRIORITY') {
      const pA = priorityWeight[a.priority] || 0;
      const pB = priorityWeight[b.priority] || 0;
      if (pA !== pB) return pB - pA;
      // Fallback to newest
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    } else if (sortBy === 'OLDEST') {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    } else {
      // NEWEST (Default)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  const getPriorityIcon = (priority: string) => {
    switch(priority) {
      case 'CRITICAL': return <AlertCircle className="w-3.5 h-3.5 text-red-600" />;
      case 'HIGH': return <AlertCircle className="w-3.5 h-3.5 text-orange-500" />;
      case 'MEDIUM': return <Clock className="w-3.5 h-3.5 text-yellow-500" />;
      case 'LOW': return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
      default: return null;
    }
  };

  const getTypeColor = (type: string) => {
    switch(type) {
      case 'BUG': return 'text-red-600 bg-red-50';
      case 'FEATURE': return 'text-purple-600 bg-purple-50';
      case 'IMPROVEMENT': return 'text-emerald-600 bg-emerald-50';
      case 'TASK': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-800 tracking-tight">Catatan Pengembangan</h2>
          <p className="text-sm text-gray-500 font-medium">Kelola tugas, perbaikan bug, dan rencana fitur aplikasi.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          disabled={!selectedAppId}
          className="hidden sm:flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-xl font-bold transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Catatan</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100/80 p-1 rounded-xl w-full sm:w-fit">
        <button
          onClick={() => setActiveTab('ACTIVE')}
          className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'ACTIVE' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Aktif
        </button>
        <button
          onClick={() => setActiveTab('COMPLETED')}
          className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'COMPLETED' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Selesai
        </button>
      </div>

      {/* Filters */}
      <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 flex flex-col md:flex-row gap-4 flex-wrap">
        <div className="w-full md:max-w-[250px] relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 flex justify-between items-center"
          >
            <span className="truncate pr-2">
              {apps.length === 0 
                ? 'Belum ada aplikasi' 
                : apps.find(a => a.id === selectedAppId)?.app_name || 'Pilih Aplikasi'}
            </span>
            <div className="flex items-center gap-2">
              {selectedAppId && appStatuses[selectedAppId] && (
                <div className={`w-2.5 h-2.5 rounded-full ${appStatuses[selectedAppId] === 'RED' ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]' : 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]'}`}></div>
              )}
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {/* Custom Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
              {apps.map(app => {
                const status = appStatuses[app.id];
                return (
                  <button
                    key={app.id}
                    onClick={() => {
                      setSelectedAppId(app.id);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between border-b border-gray-100 last:border-0 ${selectedAppId === app.id ? 'bg-blue-50/50' : ''}`}
                  >
                    <span className={`text-sm font-bold truncate pr-3 ${selectedAppId === app.id ? 'text-blue-700' : 'text-gray-700'}`}>
                      {app.app_name}
                    </span>
                    {status && (
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${status === 'RED' ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]' : 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]'}`}></div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari catatan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          
          <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1 shrink-0">
            <button
              onClick={() => setViewMode('GRID')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'GRID' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              title="Tampilan Grid"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('LIST')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'LIST' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              title="Tampilan List"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button 
            onClick={() => setIsMobileFilterOpen(true)}
            className="flex sm:hidden items-center justify-center bg-white border border-gray-200 rounded-xl px-4 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 active:bg-gray-50 transition-all shrink-0"
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>
        
        <div className="hidden sm:flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 bg-white border border-gray-200 rounded-xl px-3 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="py-2.5 text-sm font-bold text-gray-700 focus:outline-none bg-transparent cursor-pointer"
            >
              <option value="ALL">Tipe</option>
              <option value="BUG">Bug</option>
              <option value="FEATURE">Fitur</option>
              <option value="IMPROVEMENT">Peningkatan</option>
              <option value="TASK">Tugas</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-1.5 bg-white border border-gray-200 rounded-xl px-3 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="py-2.5 text-sm font-bold text-gray-700 focus:outline-none bg-transparent cursor-pointer"
            >
              <option value="ALL">Prioritas</option>
              <option value="CRITICAL">Kritis</option>
              <option value="HIGH">Tinggi</option>
              <option value="MEDIUM">Sedang</option>
              <option value="LOW">Rendah</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-1.5 bg-white border border-gray-200 rounded-xl px-3 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
            <ArrowDownUp className="w-4 h-4 text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="py-2.5 text-sm font-bold text-gray-700 focus:outline-none bg-transparent cursor-pointer"
            >
              <option value="NEWEST">Terbaru</option>
              <option value="OLDEST">Terlama</option>
              <option value="PRIORITY">Prioritas Tertinggi</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notes Grid */}
      {loading && notes.length === 0 ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : processedNotes.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <Tag className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-1">Tidak ada catatan</h3>
          <p className="text-sm text-gray-500 font-medium">Belum ada catatan pengembangan yang ditambahkan atau cocok dengan pencarian.</p>
        </div>
      ) : (
        <div className={viewMode === 'GRID' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "flex flex-col gap-3"}>
          {processedNotes.map((note) => {
            const lines = (note.description || '').split('\n').filter(l => l.trim() !== '');
            const hasUnchecked = lines.length === 0 || lines.some(l => !l.trim().match(/^(\[[xXvV]\]|\([xXvV]\))/));
            
            if (viewMode === 'LIST') {
              const checkedCount = lines.filter(l => l.trim().match(/^(\[[xXvV]\]|\([xXvV]\))/)).length;
              const progress = lines.length > 0 ? Math.round((checkedCount / lines.length) * 100) : 0;
              const statusColor = hasUnchecked ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]';
              
              return (
                <div key={note.id} onClick={() => setViewingNote(note)} className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 hover:shadow-md hover:border-blue-200 transition-all flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 cursor-pointer group relative">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusColor}`}></div>
                    <h3 className="font-bold text-gray-800 truncate">{note.title}</h3>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider flex-shrink-0 hidden sm:flex items-center gap-1 ${getTypeColor(note.type)}`}>
                      {note.type === 'BUG' ? 'BUG' : note.type === 'FEATURE' ? 'FITUR' : note.type === 'IMPROVEMENT' ? 'PENINGKATAN' : note.type === 'TASK' ? 'TUGAS' : note.type}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-2 sm:mt-0 pl-5 sm:pl-0">
                    {lines.length > 0 && (
                      <div className="flex items-center gap-2 w-32">
                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div className={`h-1.5 rounded-full ${progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }}></div>
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">{progress}%</span>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => handleTogglePin(note, e)} className={`p-1.5 rounded-lg transition-colors ${note.is_pinned ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}><Pin className={`w-4 h-4 ${note.is_pinned ? 'fill-blue-600' : ''}`} /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleOpenModal(note); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ isOpen: true, type: 'NOTE', id: note.id }); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
            <div 
              key={note.id} 
              onClick={() => setViewingNote(note)}
              className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md hover:border-blue-200 transition-all relative group cursor-pointer flex flex-col min-h-[140px]"
            >
              {/* Status Indicator Dot */}
              <div 
                className={`absolute top-5 right-5 w-3 h-3 rounded-full transition-opacity duration-200 group-hover:opacity-0 sm:group-hover:opacity-0 ${
                  hasUnchecked ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'
                }`}
              ></div>
              
              <div className="flex justify-between items-start mb-4 gap-2">
                <div className="flex space-x-2 items-center flex-wrap gap-y-2 flex-1">
                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 ${getTypeColor(note.type)}`}>
                    {note.type === 'BUG' ? 'BUG' :
                     note.type === 'FEATURE' ? 'FITUR' :
                     note.type === 'IMPROVEMENT' ? 'PENINGKATAN' :
                     note.type === 'TASK' ? 'TUGAS' : note.type}
                  </span>
                  {note.labels && note.labels.map(label => (
                    <span key={label} className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200 truncate max-w-[80px]">
                      {label}
                    </span>
                  ))}
                </div>
                
                <div className="flex items-center space-x-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button 
                    onClick={(e) => handleTogglePin(note, e)} 
                    className={`p-1.5 rounded-lg transition-colors ${note.is_pinned ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                    title={note.is_pinned ? "Lepaskan sematan" : "Sematkan ke atas"}
                  >
                    <Pin className={`w-4 h-4 ${note.is_pinned ? 'fill-blue-600' : ''}`} />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleOpenModal(note); }} 
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit Catatan"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ isOpen: true, type: 'NOTE', id: note.id }); }} 
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Hapus Catatan"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <h3 className="font-bold text-gray-800 mb-3 line-clamp-2">{note.title}</h3>
              
              {(() => {
                const lines = (note.description || '').split('\n').filter(l => l.trim() !== '');
                if (lines.length === 0) return null;
                
                const checkedCount = lines.filter(l => l.trim().match(/^(\[[xXvV]\]|\([xXvV]\))/)).length;
                const progress = Math.round((checkedCount / lines.length) * 100);
                
                return (
                  <div className="mb-4">
                    {/* Progress Bar */}
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1.5 overflow-hidden">
                      <div 
                        className={`h-1.5 rounded-full transition-all duration-500 ${progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-bold text-gray-400">
                      <span>Progres</span>
                      <span>{checkedCount}/{lines.length} ({progress}%)</span>
                    </div>
                  </div>
                );
              })()}
              
              <div className="pt-3 mt-auto border-t border-gray-100 flex items-center justify-between text-xs font-semibold text-gray-450">
                <div className="flex items-center space-x-1.5">
                  {getPriorityIcon(note.priority)}
                  <span>
                    {note.priority === 'CRITICAL' ? 'Kritis' :
                     note.priority === 'HIGH' ? 'Tinggi' :
                     note.priority === 'MEDIUM' ? 'Sedang' :
                     note.priority === 'LOW' ? 'Rendah' : note.priority}
                  </span>
                </div>
                {note.target_version && (
                  <div className="flex items-center space-x-1 bg-gray-50 px-2 py-1 rounded-md text-gray-500">
                    <Tag className="w-3 h-3" />
                    <span>v{note.target_version}</span>
                  </div>
                )}
              </div>
            </div>
          );
          })}
        </div>
      )}

      {/* Modal Add/Edit */}
      {isModalOpen && (
        <div 
          onClick={handleCloseModal}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-[fadeInSoft_0.2s_ease-out]"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-black text-gray-800 text-lg">
                {editingNote ? 'Edit Catatan' : 'Catatan Baru'}
              </h3>
              <button 
                onClick={handleCloseModal}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Judul</label>
                <input 
                  type="text" 
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="Contoh: Perbaiki layout tombol login"
                />
              </div>
              
              {!!editingNote && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Deskripsi</label>
                  <textarea 
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-h-[120px] resize-none"
                    placeholder="Jelaskan detail perubahan yang diperlukan..."
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Tipe</label>
                  <select 
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value as any})}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:outline-none focus:border-blue-500"
                  >
                    <option value="BUG">Bug</option>
                    <option value="FEATURE">Fitur</option>
                    <option value="IMPROVEMENT">Peningkatan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Prioritas</label>
                  <select 
                    value={formData.priority}
                    onChange={e => setFormData({...formData, priority: e.target.value as any})}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:outline-none focus:border-blue-500"
                  >
                    <option value="LOW">Rendah</option>
                    <option value="MEDIUM">Sedang</option>
                    <option value="HIGH">Tinggi</option>
                    <option value="CRITICAL">Kritis</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-100 flex justify-end space-x-3 bg-gray-50/50">
              <button 
                onClick={handleCloseModal}
                className="px-5 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-200 transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={handleSaveNote}
                disabled={!formData.title || loading}
                className="px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shadow-sm"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Simpan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Viewing Modal (Checklist View) */}
      {viewingNote && (
        <div 
          onClick={() => setViewingNote(null)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-[fadeInSoft_0.2s_ease-out]"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => {
              setStartY(e.touches[0].clientY);
              setIsDragging(true);
            }}
            onTouchMove={(e) => {
              if (!isDragging) return;
              const currentY = e.touches[0].clientY;
              const diff = currentY - startY;
              if (diff > 0) { // Hanya izinkan drag ke bawah
                setSwipeY(diff);
              }
            }}
            onTouchEnd={() => {
              setIsDragging(false);
              if (swipeY > 100) {
                setViewingNote(null);
              }
              setSwipeY(0);
            }}
            style={{ transform: `translateY(${swipeY}px)`, transition: isDragging ? 'none' : 'transform 0.3s ease-out' }}
            className="bg-[#f0f2f5] rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-[slideUp_0.3s_ease-out]"
          >
            {/* Grab handle for mobile feeling */}
            <div className="w-full flex justify-center pt-3 pb-1 sm:hidden bg-white">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full"></div>
            </div>

            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white">
              <h3 className="font-black text-gray-800 text-lg">
                Rincian Catatan
              </h3>
              <div className="flex items-center space-x-1">
                <button 
                  onClick={handleCopyUnchecked}
                  title="Salin tugas yang belum selesai"
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors flex items-center justify-center"
                >
                  {isCopied ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                </button>
                <button 
                  onClick={() => setViewingNote(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <h2 className="text-xl font-bold text-gray-800 mb-6">{viewingNote.title}</h2>
              
              <div className="flex flex-col gap-2">
                {viewingNote.description.split('\n').map((line, idx) => {
                  if (line.trim() === '') return null;
                  
                  const isChecked = line.trim().match(/^(\[[xXvV]\]|\([xXvV]\))/);
                  const cleanLine = line.replace(/^(\[[xXvV ]\]|\([xXvV ]\)|-)\s*/i, '').trim();
                  
                  return (
                    <div 
                      key={idx} 
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragEnter={(e) => handleDragEnter(e, idx)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => e.preventDefault()}
                      onClick={() => handleToggleChecklist(viewingNote, idx)}
                      className={`flex items-start gap-3 p-3.5 rounded-xl hover:bg-gray-200/60 active:bg-gray-300/50 transition-colors cursor-pointer group ${draggedItemIndex === idx ? 'opacity-50 bg-gray-200' : ''} ${dragOverItemIndex === idx && draggedItemIndex !== idx ? 'border-t-2 border-blue-500' : ''}`}
                    >
                      <div className="mt-0.5 flex-shrink-0 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <GripVertical className="w-5 h-5" />
                      </div>
                      <div className="mt-0.5 flex-shrink-0">
                        <input 
                          type="checkbox" 
                          checked={!!isChecked} 
                          readOnly 
                          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer pointer-events-none" 
                        />
                      </div>
                      <span className={`text-base font-medium leading-snug flex-1 ${isChecked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                        {cleanLine}
                      </span>
                      <button
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setDeleteConfirm({ isOpen: true, type: 'ITEM', id: viewingNote.id, lineIndex: idx });
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex-shrink-0"
                        title="Hapus Tugas"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

            </div>
            
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                <input 
                  type="text" 
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddNewItem();
                  }}
                  placeholder="Ketik tugas baru..."
                  className="flex-1 bg-transparent border-none focus:outline-none text-sm font-medium text-gray-700 placeholder-gray-400"
                />
                <button 
                  onClick={handleAddNewItem}
                  disabled={!newItemText.trim()}
                  className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors disabled:bg-gray-300 flex-shrink-0"
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {deleteConfirm?.isOpen && (
        <div 
          onClick={() => setDeleteConfirm(null)}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-[fadeInSoft_0.2s_ease-out]"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 text-center animate-[scaleIn_0.2s_ease-out]"
          >
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-xl font-black text-gray-800 mb-2">Hapus Data?</h3>
            <p className="text-sm text-gray-500 font-medium mb-6">
              Apakah Anda yakin ingin menghapus {deleteConfirm.type === 'NOTE' ? 'catatan' : 'tugas'} ini? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={() => {
                  if (deleteConfirm.type === 'NOTE') {
                    handleDeleteNote(deleteConfirm.id);
                  } else if (deleteConfirm.lineIndex !== undefined) {
                    handleDeleteChecklistItem(deleteConfirm.lineIndex);
                  }
                }}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile FAB */}
      <button
        onClick={() => handleOpenModal()}
        disabled={!selectedAppId}
        className="flex sm:hidden fixed bottom-6 right-6 z-40 bg-blue-600 text-white w-14 h-14 rounded-full items-center justify-center shadow-[0_8px_16px_rgba(37,99,235,0.4)] hover:bg-blue-700 active:scale-95 transition-all disabled:bg-gray-400 disabled:shadow-none"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Mobile Filter Bottom Sheet */}
      {isMobileFilterOpen && (
        <div 
          onClick={() => setIsMobileFilterOpen(false)}
          className="fixed inset-0 z-50 flex items-end sm:hidden bg-black/50 backdrop-blur-sm animate-[fadeInSoft_0.2s_ease-out]"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-t-3xl w-full p-6 shadow-xl animate-[slideUp_0.3s_ease-out]"
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6"></div>
            <h3 className="font-black text-gray-800 text-lg mb-4">Filter & Sortir</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Tipe</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full py-3 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:outline-none"
                >
                  <option value="ALL">Semua Tipe</option>
                  <option value="BUG">Bug</option>
                  <option value="FEATURE">Fitur</option>
                  <option value="IMPROVEMENT">Peningkatan</option>
                  <option value="TASK">Tugas</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Prioritas</label>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="w-full py-3 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:outline-none"
                >
                  <option value="ALL">Semua Prioritas</option>
                  <option value="CRITICAL">Kritis</option>
                  <option value="HIGH">Tinggi</option>
                  <option value="MEDIUM">Sedang</option>
                  <option value="LOW">Rendah</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Urutan</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full py-3 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:outline-none"
                >
                  <option value="NEWEST">Terbaru</option>
                  <option value="OLDEST">Terlama</option>
                  <option value="PRIORITY">Prioritas Tertinggi</option>
                </select>
              </div>
            </div>
            
            <button
              onClick={() => setIsMobileFilterOpen(false)}
              className="w-full mt-6 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors"
            >
              Terapkan
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
