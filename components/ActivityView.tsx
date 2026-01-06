import React, { useState, useMemo, useEffect } from 'react';
import { ActivitySession, CardioType, ActivityMetric, IntervalSegment } from '../types';
import { downloadCSV, formatDateISO } from '../exportService';
import { 
  Activity, Timer, MapPin, Heart, Zap, Flame, Mountain, Footprints, 
  Trash2, Plus, Settings, ChevronRight, Save, Check, Search, Share2 
} from 'lucide-react';

interface ActivityViewProps {
  onAddSession: (session: ActivitySession) => void;
  onDeleteSession: (id: string) => void;
  sessions: ActivitySession[];
  cardioTypes: CardioType[];
  onUpdateCardioTypes: (types: CardioType[]) => void;
}

const COLORS = [
  { hex: '#EF4444', name: 'Rouge' },
  { hex: '#F97316', name: 'Orange' },
  { hex: '#F59E0B', name: 'Jaune' },
  { hex: '#10B981', name: 'Vert' },
  { hex: '#3B82F6', name: 'Bleu' },
  { hex: '#8B5CF6', name: 'Violet' },
  { hex: '#EC4899', name: 'Rose' },
  { hex: '#000000', name: 'Noir' }
];

const METRIC_GROUPS = [
  {
    category: 'Essentiels',
    items: [
      { id: 'distance', label: 'Distance', icon: MapPin },
      { id: 'duration', label: 'Durée', icon: Timer },
    ] as const
  },
  {
    category: 'Physio',
    items: [
      { id: 'hr', label: 'Fréq. Cardiaque', icon: Heart },
      { id: 'calories', label: 'Calories', icon: Flame },
    ] as const
  },
  {
    category: 'Mécanique',
    items: [
      { id: 'watts', label: 'Puissance', icon: Zap },
      { id: 'cadence', label: 'Cadence', icon: Footprints },
      { id: 'speed', label: 'Vitesse', icon: Activity },
    ] as const
  },
  {
    category: 'Terrain',
    items: [
      { id: 'elevation', label: 'Dénivelé', icon: Mountain },
      { id: 'incline', label: 'Pente', icon: Mountain },
    ] as const
  }
];

const ActivityView: React.FC<ActivityViewProps> = ({ 
  onAddSession, 
  onDeleteSession,
  sessions,
  cardioTypes,
  onUpdateCardioTypes
}) => {
  const [activeTab, setActiveTab] = useState<'log' | 'garage' | 'journal'>('log');
  const [selectedType, setSelectedType] = useState<CardioType | null>(cardioTypes[0] || null);
  
  // LOGGING STATE
  const [globalData, setGlobalData] = useState<any>({});
  const [segments, setSegments] = useState<IntervalSegment[]>([]);
  const [numSegments, setNumSegments] = useState(1);
  const [rpe, setRpe] = useState(5);
  const [notes, setNotes] = useState('');

  // GARAGE STATE
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileColor, setNewProfileColor] = useState('#EF4444');
  const [newProfileMode, setNewProfileMode] = useState<'continuous' | 'interval'>('continuous');
  const [newProfileMetrics, setNewProfileMetrics] = useState<ActivityMetric[]>(['distance', 'duration']);

  // JOURNAL STATE
  const [historySearch, setHistorySearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [showBulkMenu, setShowBulkMenu] = useState(false);

  useEffect(() => {
    setGlobalData({});
    setSegments(Array(3).fill({}));
    setNumSegments(3);
    setRpe(5);
    setNotes('');
  }, [selectedType]);

  const toggleMetric = (m: ActivityMetric) => {
    setNewProfileMetrics(prev => 
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    );
  };

  const handleCreateProfile = () => {
    if (!newProfileName.trim()) return;
    const newProfile: CardioType = {
      id: Date.now().toString(),
      name: newProfileName,
      emoji: '🏃', // Legacy fallback (not used in new UI)
      color: newProfileColor,
      mode: newProfileMode,
      metrics: newProfileMetrics
    };
    onUpdateCardioTypes([...cardioTypes, newProfile]);
    setNewProfileName('');
    setNewProfileMetrics(['distance', 'duration']);
    setNewProfileMode('continuous');
    setActiveTab('log');
    setSelectedType(newProfile);
  };

  const handleDeleteProfile = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const updatedList = cardioTypes.filter(c => String(c.id) !== String(id));
    onUpdateCardioTypes(updatedList);
    if (selectedType && String(selectedType.id) === String(id)) {
        setSelectedType(updatedList.length > 0 ? updatedList[0] : null);
    }
  };

  const handleUpdateSegment = (idx: number, field: string, value: string) => {
    const newSegs = [...segments];
    newSegs[idx] = { ...newSegs[idx], [field]: parseFloat(value) };
    setSegments(newSegs);
  };

  const handleSaveSession = () => {
    if (!selectedType) return;
    const todayISO = new Date().toISOString().split('T')[0];
    
    let finalDistance = 0;
    let finalDuration = 0;
    let finalWatts = undefined;
    let finalHr = undefined;
    let finalElevation = undefined;
    let structureText = '';

    if (selectedType.mode === 'continuous') {
      finalDistance = parseFloat(globalData.distance) || 0;
      finalDuration = parseFloat(globalData.duration) || 0;
      finalWatts = parseFloat(globalData.watts);
      finalHr = parseFloat(globalData.hr);
      finalElevation = parseFloat(globalData.elevation);
    } else {
      const activeSegments = segments.slice(0, numSegments);
      finalDistance = activeSegments.reduce((acc, s) => acc + (s.distance || 0), 0);
      finalDuration = activeSegments.reduce((acc, s) => acc + (s.duration || 0), 0);
      const wattsVals = activeSegments.map(s => s.watts).filter(v => v);
      if (wattsVals.length) finalWatts = Math.round(wattsVals.reduce((a,b) => (a||0)+(b||0), 0) / wattsVals.length);
      const hrVals = activeSegments.map(s => s.hr).filter(v => v);
      if (hrVals.length) finalHr = Math.round(hrVals.reduce((a,b) => (a||0)+(b||0), 0) / hrVals.length);
      structureText = `${numSegments} Séries (Mode Intervalle)`;
    }

    onAddSession({
      id: Date.now().toString(),
      date: todayISO,
      type: selectedType.name,
      typeEmoji: selectedType.emoji,
      mode: selectedType.mode,
      distance: finalDistance,
      duration: finalDuration,
      elevation: finalElevation || 0,
      rpe: rpe,
      hr: finalHr,
      watts: finalWatts,
      intervalStructure: structureText,
      segments: selectedType.mode === 'interval' ? segments.slice(0, numSegments) : undefined,
      notes: notes
    });

    setGlobalData({});
    setSegments(Array(3).fill({}));
    setNotes('');
  };

  const filteredHistory = useMemo(() => {
    let result = [...sessions].reverse();
    if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        result = result.filter(s => 
            s.type.toLowerCase().includes(q) || 
            (s.notes && s.notes.toLowerCase().includes(q))
        );
    }
    return result;
  }, [sessions, historySearch]);

  const toggleEditMode = () => {
      if (isEditMode) {
          setIsEditMode(false);
          setSelectedSessionIds(new Set());
          setShowBulkMenu(false);
          setHistorySearch('');
      } else {
          setIsEditMode(true);
          setExpandedId(null);
      }
  };

  const toggleSessionSelection = (sessionId: string) => {
    const newSet = new Set(selectedSessionIds);
    if (newSet.has(sessionId)) newSet.delete(sessionId);
    else newSet.add(sessionId);
    setSelectedSessionIds(newSet);
  };

  const handleCardClick = (id: string) => {
    if (isEditMode) {
        toggleSessionSelection(id);
    } else {
        setExpandedId(expandedId === id ? null : id);
    }
  };

  const isGroupSelected = (itemsToCheck: ActivitySession[]) => {
      if (itemsToCheck.length === 0) return false;
      return itemsToCheck.every(item => selectedSessionIds.has(item.id));
  };

  const handleSmartSelect = (criteria: 'visible' | 'month' | 'type', value?: string) => {
      const newSet = new Set(selectedSessionIds);
      let targetItems: ActivitySession[] = [];
      if (criteria === 'visible') targetItems = filteredHistory;
      else if (criteria === 'month') targetItems = filteredHistory.filter(s => new Date(s.date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase() === value);
      else if (criteria === 'type') targetItems = filteredHistory.filter(s => s.type === value);

      if (targetItems.length === 0) return;
      const allSelected = targetItems.every(item => newSet.has(item.id));
      if (allSelected) targetItems.forEach(item => newSet.delete(item.id));
      else targetItems.forEach(item => newSet.add(item.id));
      setSelectedSessionIds(newSet);
      setShowBulkMenu(false);
  };

  const handleExport = async () => {
    const rawData = selectedSessionIds.size > 0 ? filteredHistory.filter(s => selectedSessionIds.has(s.id)) : [];
    if (rawData.length === 0) return;
    const sorted = [...rawData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const headers = ['Date', 'Type Sport', 'Mode', 'Distance (km)', 'Durée (min)', 'Allure', 'FC Moy', 'Puissance (w)', 'RPE', 'Notes'];
    const rows = sorted.map(s => {
        let pace = '-';
        if (s.distance > 0 && s.duration > 0) {
            const paceDecimal = s.duration / s.distance;
            const paceMin = Math.floor(paceDecimal);
            const paceSec = Math.round((paceDecimal - paceMin) * 60);
            pace = `${paceMin}'${paceSec.toString().padStart(2, '0')}"`;
        }
        return [formatDateISO(s.date), s.type, s.mode || 'continuous', s.distance, s.duration, pace, s.hr || '', s.watts || '', s.rpe, s.notes || ''];
    });
    await downloadCSV(`Endurance_Export.csv`, headers, rows);
    setIsEditMode(false);
    setSelectedSessionIds(new Set());
  };


  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 px-1">
        <div>
          <h2 className="text-3xl font-black tracking-tighter uppercase text-gray-900 leading-none">
            Cardio <span className="text-gray-400">Lab</span>
          </h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2 flex items-center gap-1">
             <Activity size={10} /> Endurance Tracker
          </p>
        </div>
        <div className="bg-white p-1 rounded-xl flex gap-1 border border-gray-100 shadow-sm w-full md:w-auto overflow-x-auto">
          <button onClick={() => setActiveTab('log')} className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all min-h-[44px] whitespace-nowrap ${activeTab === 'log' ? 'bg-black text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>
            <Timer size={14} /> Log
          </button>
          <button onClick={() => setActiveTab('garage')} className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all min-h-[44px] whitespace-nowrap ${activeTab === 'garage' ? 'bg-black text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>
            <Settings size={14} /> Profils
          </button>
          <button onClick={() => setActiveTab('journal')} className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all min-h-[44px] whitespace-nowrap ${activeTab === 'journal' ? 'bg-black text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>
            <Activity size={14} /> Journal
          </button>
        </div>
      </div>

      {/* --- TAB: LOG --- */}
      {activeTab === 'log' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          {cardioTypes.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-gray-100 text-center space-y-4">
                <Activity className="w-12 h-12 text-gray-300" />
                <p className="text-gray-500 font-bold text-sm">Aucun profil configuré.</p>
                <button onClick={() => setActiveTab('garage')} className="px-6 py-3 bg-black text-white rounded-xl font-bold text-xs uppercase tracking-wide">Créer un profil</button>
             </div>
          ) : (
            <>
              {/* Profile Selector */}
              <section className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-1 px-1">
                {cardioTypes.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type)}
                    className={`flex-none w-32 p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between h-32 relative group overflow-hidden ${selectedType?.id === type.id ? 'bg-black text-white border-black shadow-lg scale-105' : 'bg-white text-gray-500 border-gray-200'}`}
                  >
                    <div className={`absolute top-0 left-0 w-full h-1`} style={{ backgroundColor: type.color }} />
                    <div className="mt-2 text-2xl">
                        {selectedType?.id === type.id ? <Activity className="text-white" /> : <Activity className="text-gray-300" />}
                    </div>
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-60 block">Profil</span>
                        <span className="text-xs font-black uppercase tracking-tight truncate block">{type.name}</span>
                    </div>
                  </button>
                ))}
              </section>

              {/* ENGINE VIEW */}
              {selectedType && (
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-8 relative pb-32">
                  <div className="flex justify-between items-center border-b border-gray-50 pb-4">
                    <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                        <Activity className="text-black" size={20} /> {selectedType.name}
                    </h3>
                    <span className={`text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg ${selectedType.mode === 'interval' ? 'bg-black text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {selectedType.mode === 'interval' ? 'Fractionné' : 'Continu'}
                    </span>
                  </div>

                  {/* MODE: INTERVALLE */}
                  {selectedType.mode === 'interval' ? (
                    <div className="space-y-6">
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {[1, 2, 3, 4, 5, 6, 8, 10, 12, 15].map(n => (
                          <button key={n} onClick={() => setNumSegments(n)} className={`w-10 h-10 flex-shrink-0 rounded-lg text-xs font-bold transition-all ${numSegments === n ? 'bg-black text-white' : 'bg-gray-50 text-gray-400'}`}>{n}</button>
                        ))}
                      </div>

                      <div className="space-y-3">
                        {Array(numSegments).fill(0).map((_, i) => (
                          <div key={i} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 relative group">
                            <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-5 h-5 bg-black text-white rounded-md flex items-center justify-center text-[10px] font-bold shadow-sm z-10">{i + 1}</div>
                            <div className={`grid gap-3 ${selectedType.metrics.length > 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
                              {selectedType.metrics.map(metric => (
                                <div key={metric} className="pl-2">
                                  <label className="text-[8px] font-bold text-gray-400 uppercase block mb-1">{metric}</label>
                                  <input type="number" placeholder="-" value={segments[i]?.[metric as keyof IntervalSegment] || ''} onChange={(e) => handleUpdateSegment(i, metric, e.target.value)} className="w-full bg-white rounded-lg p-2 text-sm font-bold outline-none border border-gray-200 focus:border-black transition-all" />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* MODE: CONTINU */
                    <div className="flex flex-col gap-6">
                        {/* Primary Metrics */}
                        {selectedType.metrics.filter(m => ['distance', 'duration'].includes(m)).map(metric => (
                            <div key={metric} className="relative">
                                <label className="absolute top-3 left-4 text-[9px] font-bold text-gray-400 uppercase">{metric === 'distance' ? 'Distance (km)' : 'Durée (min)'}</label>
                                <input type="number" placeholder="0" value={globalData[metric] || ''} onChange={(e) => setGlobalData({...globalData, [metric]: e.target.value})} className="w-full p-4 pt-8 bg-gray-50 rounded-2xl text-3xl font-black outline-none focus:bg-white focus:ring-2 focus:ring-black/5 transition-all text-gray-900 placeholder-gray-300" />
                                <div className="absolute top-4 right-4 text-gray-300">
                                    {metric === 'distance' ? <MapPin size={20} /> : <Timer size={20} />}
                                </div>
                            </div>
                        ))}
                        
                        {/* Secondary Metrics */}
                        <div className="grid grid-cols-2 gap-4">
                            {selectedType.metrics.filter(m => !['distance', 'duration'].includes(m)).map(metric => (
                                <div key={metric} className="bg-gray-50 rounded-2xl p-3">
                                    <label className="text-[8px] font-bold text-gray-400 uppercase block mb-1 text-center">{metric}</label>
                                    <input type="number" placeholder="-" value={globalData[metric] || ''} onChange={(e) => setGlobalData({...globalData, [metric]: e.target.value})} className="w-full bg-transparent text-center text-lg font-bold outline-none" />
                                </div>
                            ))}
                        </div>
                    </div>
                  )}

                  {/* RPE & Notes */}
                  <div className="pt-6 border-t border-gray-100 space-y-4">
                    <div className="flex justify-between items-end">
                        <label className="text-[9px] font-bold text-gray-400 uppercase">Effort (RPE)</label>
                        <span className="text-xl font-black">{rpe}<span className="text-xs text-gray-300">/10</span></span>
                    </div>
                    <input type="range" min="1" max="10" value={rpe} onChange={e => setRpe(parseInt(e.target.value))} className="w-full h-2 bg-gray-100 rounded-full appearance-none cursor-pointer accent-black" />
                    <textarea placeholder="Notes de séance..." value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-gray-50 rounded-xl p-3 text-sm font-medium outline-none border-transparent focus:bg-white focus:border-gray-200 border transition-all resize-none h-20" />
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-100 rounded-b-3xl">
                      <button onClick={handleSaveSession} className="w-full py-4 bg-black text-white rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-gray-900 transition-colors">
                        <Save size={16} /> Enregistrer
                      </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* --- TAB: GARAGE --- */}
      {activeTab === 'garage' && (
        <div className="space-y-8 animate-in fade-in duration-500 pb-32">
           <section className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nouveau Profil</h3>
            <div className="flex flex-col gap-4">
                <input type="text" placeholder="Nom du profil (ex: Running)" value={newProfileName} onChange={e => setNewProfileName(e.target.value)} className="w-full p-4 bg-gray-50 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-black transition-all" />
                <div className="flex gap-2">
                    {['continuous', 'interval'].map(m => (
                        <button key={m} onClick={() => setNewProfileMode(m as any)} className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase transition-all ${newProfileMode === m ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'}`}>
                            {m === 'continuous' ? 'Continu' : 'Fractionné'}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {COLORS.map(c => (
                        <button key={c.hex} onClick={() => setNewProfileColor(c.hex)} className={`w-8 h-8 rounded-full border-[3px] flex-shrink-0 transition-transform ${newProfileColor === c.hex ? 'border-black scale-110' : 'border-transparent opacity-40 hover:opacity-100'}`} style={{ backgroundColor: c.hex }} />
                    ))}
                </div>
                
                <div className="space-y-3 pt-2">
                    <p className="text-[9px] font-bold text-gray-400 uppercase">Métriques</p>
                    <div className="grid grid-cols-2 gap-2">
                        {METRIC_GROUPS.flatMap(g => g.items as unknown as Array<{id: string, label: string, icon: any}>).map(m => {
                            const Icon = m.icon;
                            return (
                                <button key={m.id} onClick={() => toggleMetric(m.id as ActivityMetric)} className={`p-3 rounded-xl flex items-center gap-2 text-xs font-bold transition-all border ${newProfileMetrics.includes(m.id as ActivityMetric) ? 'bg-black border-black text-white' : 'bg-white border-gray-100 text-gray-400'}`}>
                                    <Icon size={14} /> {m.label}
                                </button>
                            )
                        })}
                    </div>
                </div>

                <button onClick={handleCreateProfile} disabled={!newProfileName} className={`w-full py-4 rounded-xl font-bold text-xs uppercase tracking-widest mt-2 ${newProfileName ? 'bg-black text-white' : 'bg-gray-200 text-gray-400'}`}>Créer</button>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Profils Actifs</h3>
            <div className="flex flex-col gap-3">
               {cardioTypes.map(type => (
                 <div key={type.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: type.color }}>
                        <Activity size={20} />
                      </div>
                      <div>
                        <h4 className="font-black text-sm uppercase">{type.name}</h4>
                        <p className="text-[9px] font-bold text-gray-400 uppercase">{type.mode === 'interval' ? 'Intervalle' : 'Continu'} • {type.metrics.length} metrics</p>
                      </div>
                    </div>
                    <button onClick={(e) => handleDeleteProfile(type.id, e)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 size={18} />
                    </button>
                 </div>
               ))}
            </div>
          </section>
        </div>
      )}

      {/* --- TAB: JOURNAL --- */}
      {activeTab === 'journal' && (
         <div className="space-y-4 pb-32">
            <div className={`sticky top-0 z-50 rounded-2xl py-2 px-3 transition-all duration-300 shadow-sm flex items-center justify-between min-h-[60px] -mx-2 md:mx-0 ${isEditMode ? 'bg-gray-900 text-white' : 'bg-white/90 backdrop-blur-md border border-gray-100'}`}>
                {isEditMode ? (
                    <>
                        <div className="flex items-center gap-3 shrink-0">
                            <button onClick={toggleEditMode} className="w-9 h-9 flex items-center justify-center bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                                <Check size={18} />
                            </button>
                            <span className="text-xs font-bold uppercase tracking-wide bg-white/10 px-3 py-1.5 rounded-lg">{selectedSessionIds.size}</span>
                        </div>
                        <div className="flex-1" />
                        <div className="flex items-center gap-2 shrink-0">
                            <button onClick={handleExport} disabled={selectedSessionIds.size === 0} className={`h-9 px-4 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all ${selectedSessionIds.size > 0 ? 'bg-white text-black' : 'bg-white/10 text-white/30'}`}>Export</button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex-1 max-w-sm relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Search size={16} /></div>
                            <input type="text" placeholder="Rechercher..." value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} className="w-full bg-gray-50 pl-10 pr-8 py-2.5 rounded-xl text-xs font-bold placeholder-gray-400 outline-none focus:ring-1 focus:ring-black/10 border border-transparent transition-all" />
                        </div>
                        <button onClick={toggleEditMode} className="ml-2 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-white border border-gray-200 hover:bg-gray-50 transition-all text-gray-600">Select</button>
                    </>
                )}
            </div>

            {filteredHistory.length === 0 ? (
                <div className="text-center py-20 opacity-50 flex flex-col items-center gap-2">
                    <Activity className="text-gray-300" size={32} />
                    <p className="text-gray-400 font-bold text-xs">Historique vide.</p>
                </div>
            ) : (
                filteredHistory.map(s => {
                   const profile = cardioTypes.find(c => c.name === s.type);
                   const color = profile?.color || '#000000';
                   const isSelected = selectedSessionIds.has(s.id);
                   const isExpanded = expandedId === s.id;
                   
                   return (
                    <div key={s.id} onClick={() => handleCardClick(s.id)} className={`bg-white p-5 rounded-2xl border shadow-sm transition-all duration-200 active:scale-[0.99] space-y-3 ${isSelected && isEditMode ? 'border-blue-500 bg-blue-50/10' : 'border-gray-100'}`}>
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: color }}>
                                    <Activity size={18} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-bold text-gray-400 uppercase">{s.date}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold text-white ${s.rpe > 7 ? 'bg-red-500' : s.rpe > 4 ? 'bg-orange-400' : 'bg-green-500'}`}>RPE {s.rpe}</span>
                                    </div>
                                    <h4 className="text-sm font-black uppercase tracking-tight">{s.type}</h4>
                                </div>
                            </div>
                            {isSelected && <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center"><Check size={12} className="text-white" /></div>}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl">
                            <div className="text-center border-r border-gray-200">
                                <p className="text-[8px] font-bold text-gray-400 uppercase">Distance</p>
                                <p className="text-xs font-black">{s.distance} km</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[8px] font-bold text-gray-400 uppercase">Durée</p>
                                <p className="text-xs font-black">{s.duration} min</p>
                            </div>
                        </div>

                        {isExpanded && !isEditMode && (
                            <div className="pt-2 border-t border-gray-100 animate-in fade-in space-y-2">
                                {s.notes && <p className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded-lg">"{s.notes}"</p>}
                                <button onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); }} className="w-full py-2 text-[10px] font-bold text-red-500 uppercase tracking-widest bg-red-50 rounded-lg">Supprimer</button>
                            </div>
                        )}
                    </div>
                   );
                })
            )}
         </div>
      )}
    </div>
  );
};

export default ActivityView;