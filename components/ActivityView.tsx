import React, { useState, useMemo, useEffect } from 'react';
import { ActivitySession, CardioType, ActivityMetric, IntervalSegment } from '../types';
import { downloadCSV, formatDateISO } from '../exportService';

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
      { id: 'distance', label: 'Distance', icon: '📏' },
      { id: 'duration', label: 'Durée', icon: '⏱️' },
    ] as const
  },
  {
    category: 'Physio',
    items: [
      { id: 'hr', label: 'Fréquence Cardiaque', icon: '❤️' },
      { id: 'calories', label: 'Calories', icon: '🔥' },
    ] as const
  },
  {
    category: 'Mécanique',
    items: [
      { id: 'watts', label: 'Puissance', icon: '⚡' },
      { id: 'cadence', label: 'Cadence', icon: '🦶' },
      { id: 'speed', label: 'Vitesse', icon: '🚀' },
    ] as const
  },
  {
    category: 'Terrain',
    items: [
      { id: 'elevation', label: 'Dénivelé', icon: '⛰️' },
      { id: 'incline', label: 'Pente', icon: '📐' },
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
  
  // --- STATES FOR LOGGING ---
  const [globalData, setGlobalData] = useState<any>({});
  const [segments, setSegments] = useState<IntervalSegment[]>([]);
  const [numSegments, setNumSegments] = useState(1);
  const [rpe, setRpe] = useState(5);
  const [notes, setNotes] = useState('');

  // --- STATES FOR GARAGE ---
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileEmoji, setNewProfileEmoji] = useState('🏃');
  const [newProfileColor, setNewProfileColor] = useState('#EF4444');
  const [newProfileMode, setNewProfileMode] = useState<'continuous' | 'interval'>('continuous');
  const [newProfileMetrics, setNewProfileMetrics] = useState<ActivityMetric[]>(['distance', 'duration']);

  // --- STATE FOR JOURNAL & EDIT MODE ---
  const [historySearch, setHistorySearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Explicit Edit Mode
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
      emoji: newProfileEmoji,
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

  // CORRECTIF APPLIQUÉ : Suppression DIRECTE sans confirmation
  const handleDeleteProfile = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Bloque la remontée vers le parent pour ne pas déclencher le 'hover' ou le 'click' de la carte
    
    // Suppression immédiate
    const updatedList = cardioTypes.filter(c => String(c.id) !== String(id));
    onUpdateCardioTypes(updatedList);
    
    // Si on supprime le profil en cours d'édition/sélection, on reset vers le premier dispo
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

  // --- SELECTION LOGIC ---
  
  const toggleEditMode = () => {
      if (isEditMode) {
          setIsEditMode(false);
          setSelectedSessionIds(new Set());
          setShowBulkMenu(false);
          setHistorySearch(''); // Optional
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

  const clearSearch = () => {
    setHistorySearch('');
  };

  // --- SMART TOGGLE FILTERS ---

  // Helper
  const isGroupSelected = (itemsToCheck: ActivitySession[]) => {
      if (itemsToCheck.length === 0) return false;
      return itemsToCheck.every(item => selectedSessionIds.has(item.id));
  };

  const handleSmartSelect = (criteria: 'visible' | 'month' | 'type', value?: string) => {
      const newSet = new Set(selectedSessionIds);
      let targetItems: ActivitySession[] = [];

      if (criteria === 'visible') {
          targetItems = filteredHistory;
      } else if (criteria === 'month') {
          targetItems = filteredHistory.filter(s => {
              const sessionMonth = new Date(s.date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase();
              return sessionMonth === value;
          });
      } else if (criteria === 'type') {
          targetItems = filteredHistory.filter(s => s.type === value);
      }

      if (targetItems.length === 0) return;

      const allSelected = targetItems.every(item => newSet.has(item.id));

      if (allSelected) {
          targetItems.forEach(item => newSet.delete(item.id));
      } else {
          targetItems.forEach(item => newSet.add(item.id));
      }

      setSelectedSessionIds(newSet);
      setShowBulkMenu(false);
  };

  const handleExport = async () => {
    const rawDataToExport = selectedSessionIds.size > 0 
        ? filteredHistory.filter(s => selectedSessionIds.has(s.id))
        : [];

    if (rawDataToExport.length === 0) return;

    // Tri chronologique
    const sortedExport = [...rawDataToExport].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const headers = ['Date', 'Type Sport', 'Mode', 'Distance (km)', 'Durée (min)', 'Allure', 'FC Moy', 'Puissance (w)', 'RPE', 'Notes'];
    
    const rows = sortedExport.map(s => {
        let pace = '-';
        if (s.distance > 0 && s.duration > 0) {
            const paceDecimal = s.duration / s.distance;
            const paceMin = Math.floor(paceDecimal);
            const paceSec = Math.round((paceDecimal - paceMin) * 60);
            pace = `${paceMin}'${paceSec.toString().padStart(2, '0')}"`;
        }

        return [
            formatDateISO(s.date),
            s.type,
            s.mode || 'continuous',
            s.distance,
            s.duration,
            pace,
            s.hr || '',
            s.watts || '',
            s.rpe,
            s.notes || ''
        ];
    });

    const filename = `Athletica_Endurance_Export_${new Date().toISOString().split('T')[0]}.csv`;
    await downloadCSV(filename, headers, rows);
    
    setIsEditMode(false);
    setSelectedSessionIds(new Set());
  };


  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-2">
      {/* Header & Navigation */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 px-2">
        <div>
          <h2 className="text-3xl font-black tracking-tighter uppercase text-gray-900 leading-none">
            ENDURANCE <span className="text-black/10">GARAGE</span>
          </h2>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-2">Interval Engine & Analytics</p>
        </div>
        <div className="bg-black/5 p-1.5 rounded-[2rem] flex gap-1 border border-black/5 self-start md:self-auto overflow-x-auto max-w-full w-full md:w-auto">
          <button onClick={() => setActiveTab('log')} className={`flex-1 md:flex-none px-6 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all min-h-[44px] ${activeTab === 'log' ? 'bg-white text-black shadow-md' : 'text-gray-400 hover:text-black'}`}>Terrain</button>
          <button onClick={() => setActiveTab('garage')} className={`flex-1 md:flex-none px-6 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all min-h-[44px] ${activeTab === 'garage' ? 'bg-white text-black shadow-md' : 'text-gray-400 hover:text-black'}`}>Garage</button>
          <button onClick={() => setActiveTab('journal')} className={`flex-1 md:flex-none px-6 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all min-h-[44px] ${activeTab === 'journal' ? 'bg-white text-black shadow-md' : 'text-gray-400 hover:text-black'}`}>Journal</button>
        </div>
      </header>

      {/* --- TAB: LOG (TERRAIN) --- */}
      {activeTab === 'log' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4">
          {/* ... Logging Content ... */}
          {cardioTypes.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-20 px-6 bg-white rounded-[3rem] border-2 border-dashed border-gray-100 text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
                <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center text-5xl shadow-sm">
                    🏃
                </div>
                <div className="space-y-2 max-w-sm">
                    <h3 className="text-2xl font-black uppercase tracking-tight text-gray-900">Garage Vide</h3>
                    <p className="text-gray-400 font-medium text-sm leading-relaxed">
                        Configure tes profils d'endurance (Running, Cyclisme, Piste...) pour commencer à enregistrer tes séances.
                    </p>
                </div>
                <button
                    onClick={() => setActiveTab('garage')}
                    className="px-8 py-5 bg-black text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 transition-transform"
                >
                    + Assembler un profil
                </button>
             </div>
          ) : (
            <>
              {/* Profile Selector */}
              <section className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide px-2 -mx-2">
                {cardioTypes.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type)}
                    className={`flex-none min-w-[140px] p-6 rounded-[2.2rem] border transition-all duration-300 flex flex-col items-center gap-3 group relative overflow-hidden min-h-[140px] ${selectedType?.id === type.id ? 'bg-white border-black text-black shadow-xl scale-105' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-300'}`}
                  >
                    <div className={`absolute top-0 left-0 w-full h-1`} style={{ backgroundColor: type.color }} />
                    <span className="text-4xl filter drop-shadow-sm group-hover:scale-110 transition-transform">{type.emoji}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-center leading-tight">{type.name}</span>
                    {type.mode === 'interval' && <span className="absolute top-2 right-2 text-[8px] bg-black text-white px-1.5 py-0.5 rounded-full font-black">INT</span>}
                  </button>
                ))}
                <button onClick={() => setActiveTab('garage')} className="flex-none min-w-[80px] rounded-[2.2rem] border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 hover:border-black hover:text-black transition-all min-h-[140px]">
                  <span className="text-2xl">+</span>
                </button>
              </section>

              {/* ENGINE VIEW */}
              {selectedType && (
                <div className="bg-white p-6 md:p-8 rounded-[3rem] border border-gray-100 shadow-sm space-y-8 relative pb-40">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{selectedType.emoji}</span>
                      <h3 className="text-lg font-black uppercase tracking-tight">{selectedType.name}</h3>
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${selectedType.mode === 'interval' ? 'bg-black text-white' : 'bg-gray-100 text-gray-500'}`}>
                      Mode: {selectedType.mode === 'interval' ? 'Séquencé' : 'Continu'}
                    </span>
                  </div>

                  {/* MODE: INTERVALLE */}
                  {selectedType.mode === 'interval' ? (
                    <div className="space-y-6">
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {[1, 2, 3, 4, 5, 6, 8, 10, 12, 15].map(n => (
                          <button 
                            key={n} 
                            onClick={() => setNumSegments(n)}
                            className={`w-11 h-11 flex-shrink-0 rounded-xl text-[10px] font-black transition-all ${numSegments === n ? 'bg-black text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                          >{n}</button>
                        ))}
                      </div>

                      <div className="space-y-4">
                        {Array(numSegments).fill(0).map((_, i) => (
                          <div key={i} className="bg-gray-50 p-5 rounded-[2rem] border border-gray-100 relative group transition-all hover:bg-white hover:shadow-md">
                            <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-6 h-6 bg-black text-white rounded-full flex items-center justify-center text-[10px] font-black shadow-lg z-10">
                              {i + 1}
                            </div>
                            
                            <div className={`grid gap-4 ${selectedType.metrics.length > 2 ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2'}`}>
                              {selectedType.metrics.map(metric => (
                                <div key={metric} className="space-y-1 pl-3">
                                  <label className="text-[8px] font-black text-gray-300 uppercase block">{metric}</label>
                                  <input 
                                    type="number" 
                                    placeholder="-" 
                                    value={segments[i]?.[metric as keyof IntervalSegment] || ''}
                                    onChange={(e) => handleUpdateSegment(i, metric, e.target.value)}
                                    className="w-full bg-transparent text-lg font-black outline-none placeholder-gray-200 focus:text-blue-600 transition-colors p-2"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* MODE: CONTINU */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Primary Metrics (Big) */}
                      <div className="space-y-6">
                        {selectedType.metrics.filter(m => ['distance', 'duration'].includes(m)).map(metric => (
                          <div key={metric} className="space-y-2">
                            <label className="text-[9px] font-black text-gray-300 uppercase ml-4">{metric === 'distance' ? 'Distance (km)' : 'Durée (min)'}</label>
                            <input 
                              type="number" 
                              placeholder="0"
                              value={globalData[metric] || ''}
                              onChange={(e) => setGlobalData({...globalData, [metric]: e.target.value})}
                              className="w-full p-6 bg-gray-50 rounded-[2.5rem] text-4xl font-black outline-none focus:bg-white focus:shadow-lg transition-all text-center placeholder-gray-200"
                            />
                          </div>
                        ))}
                      </div>

                      {/* Secondary Metrics (Grid) */}
                      <div className="grid grid-cols-2 gap-4 content-start">
                        {selectedType.metrics.filter(m => !['distance', 'duration'].includes(m)).map(metric => (
                          <div key={metric} className="space-y-2">
                            <label className="text-[8px] font-black text-gray-300 uppercase text-center block">{metric}</label>
                            <input 
                              type="number" 
                              placeholder="-"
                              value={globalData[metric] || ''}
                              onChange={(e) => setGlobalData({...globalData, [metric]: e.target.value})}
                              className="w-full p-4 bg-gray-50 rounded-2xl text-xl font-black text-center outline-none focus:bg-white focus:ring-2 focus:ring-black/5"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer: RPE & Notes */}
                  <div className="pt-6 border-t border-gray-50 space-y-6">
                    <div className="space-y-4">
                      <div className="flex justify-between items-baseline px-2">
                        <label className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Perception de l'effort (RPE)</label>
                        <span className="text-xl font-black text-black">{rpe}<span className="text-sm text-gray-400">/10</span></span>
                      </div>
                      <input 
                        type="range" min="1" max="10" value={rpe} onChange={e => setRpe(parseInt(e.target.value))}
                        className="w-full h-4 bg-gray-100 rounded-full appearance-none cursor-pointer accent-black"
                      />
                    </div>
                    
                    <textarea 
                      placeholder="Sensations, météo, détails techniques..."
                      value={notes} onChange={e => setNotes(e.target.value)}
                      className="w-full bg-gray-50 rounded-2xl p-4 text-base font-medium outline-none border border-transparent focus:bg-white focus:shadow-sm resize-none min-h-[100px]"
                      rows={3}
                    />
                  </div>

                  {/* Sticky Bottom Save Button */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white from-50% via-white/80 to-transparent rounded-b-[3rem] z-10">
                      <button 
                        onClick={handleSaveSession}
                        className="w-full p-5 bg-black text-white rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] shadow-xl hover:bg-gray-900 active:scale-[0.98] transition-all"
                      >
                        ENREGISTRER
                      </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* --- TAB: GARAGE (CONFIG) --- */}
      {activeTab === 'garage' && (
        <div className="space-y-12 animate-in fade-in duration-500">
           {/* ... Garage Content (Unchanged) ... */}
           <section className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm space-y-8">
            <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] ml-2">Garage Builder</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Left Col: Identity */}
              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Identité Visuelle</label>
                  <input 
                    type="text" placeholder="Ex: Piste 400m, Natation..."
                    value={newProfileName} onChange={e => setNewProfileName(e.target.value)}
                    className="w-full p-5 bg-gray-50 rounded-2xl text-base font-bold outline-none focus:bg-white focus:ring-2 focus:ring-black/5"
                  />
                  <div className="flex gap-4">
                     <input 
                       type="text" value={newProfileEmoji} onChange={e => setNewProfileEmoji(e.target.value)}
                       className="w-16 h-16 text-center text-3xl bg-gray-50 rounded-2xl outline-none"
                     />
                     <div className="flex flex-wrap gap-2 flex-1">
                       {COLORS.map(c => (
                         <button 
                           key={c.hex}
                           onClick={() => setNewProfileColor(c.hex)}
                           className={`w-10 h-10 rounded-full border-2 transition-transform ${newProfileColor === c.hex ? 'border-black scale-110' : 'border-transparent'}`}
                           style={{ backgroundColor: c.hex }}
                         />
                       ))}
                     </div>
                  </div>
                </div>

                <div className="space-y-4 bg-gray-50 p-5 rounded-[2rem] border border-gray-100">
                   <label className="text-[9px] font-black text-gray-400 uppercase">Structure de l'effort</label>
                   <div className="flex gap-2">
                     <button 
                       onClick={() => setNewProfileMode('continuous')}
                       className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase transition-all min-h-[44px] ${newProfileMode === 'continuous' ? 'bg-black text-white shadow-lg' : 'bg-white text-gray-400'}`}
                     >
                       Continu
                     </button>
                     <button 
                       onClick={() => setNewProfileMode('interval')}
                       className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase transition-all min-h-[44px] ${newProfileMode === 'interval' ? 'bg-black text-white shadow-lg' : 'bg-white text-gray-400'}`}
                     >
                       Intervalle
                     </button>
                   </div>
                   <p className="text-[9px] text-gray-400 font-medium px-2">
                     {newProfileMode === 'continuous' 
                       ? "Enregistre une séance globale (Ex: 10km en 50min)." 
                       : "Enregistre une suite de séries/tours (Ex: 10x400m)."}
                   </p>
                </div>
              </div>

              {/* Right Col: Variable Picker */}
              <div className="space-y-6">
                 <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Variables à Tracker</label>
                 <div className="space-y-6">
                   {METRIC_GROUPS.map(group => (
                     <div key={group.category} className="space-y-3">
                       <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest px-2">{group.category}</p>
                       <div className="grid grid-cols-2 gap-3">
                         {group.items.map(m => (
                           <button
                             key={m.id}
                             onClick={() => toggleMetric(m.id as ActivityMetric)}
                             className={`p-3 rounded-xl flex items-center gap-3 text-xs font-bold transition-all min-h-[50px] active:scale-95 ${newProfileMetrics.includes(m.id as ActivityMetric) ? 'bg-white border-2 border-black text-black shadow-md' : 'bg-gray-50 border-2 border-transparent text-gray-400 hover:bg-gray-100'}`}
                           >
                             <span className="text-xl">{m.icon}</span>
                             <span>{m.label}</span>
                           </button>
                         ))}
                       </div>
                     </div>
                   ))}
                 </div>
              </div>
            </div>

            <button 
              onClick={handleCreateProfile}
              disabled={!newProfileName}
              className={`w-full p-6 rounded-[2rem] font-black text-xs uppercase tracking-widest mt-8 min-h-[64px] ${newProfileName ? 'bg-black text-white shadow-xl hover:bg-gray-900' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
            >
              ASSEMBLER LE PROFIL
            </button>
          </section>
          
          {/* History Section retained as is */}
          <section className="space-y-6">
            <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-widest ml-6">Profils en Service</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {cardioTypes.map(type => (
                 <div key={type.id} className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center justify-between group hover:shadow-lg transition-all relative overflow-visible">
                    <div className="flex items-center gap-4 overflow-hidden">
                      <div className="w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center text-3xl bg-gray-50 relative" style={{ color: type.color }}>
                        {type.emoji}
                        {type.mode === 'interval' && <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-black rounded-full border-2 border-white" />}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-sm uppercase truncate">{type.name}</h4>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight truncate">{type.mode === 'interval' ? 'Séquencé' : 'Continu'} • {type.metrics.length} Data Points</p>
                      </div>
                    </div>
                    {/* CORRECTIF APPLIQUÉ ICI : Bouton en flex item (non absolute) pour garantir la zone de clic */}
                    <button 
                      type="button"
                      onClick={(e) => handleDeleteProfile(type.id, e)} 
                      className="ml-4 shrink-0 cursor-pointer w-10 h-10 flex items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all text-xl hover:scale-110 active:scale-95 shadow-sm z-10"
                    >
                      ×
                    </button>
                 </div>
               ))}
            </div>
          </section>
        </div>
      )}

      {/* ... TAB: JOURNAL ... */}
      {activeTab === 'journal' && (
         <div className="space-y-4 px-2 pb-32">
            {/* ...Journal Content... */}
            {/* ...Code inchangé pour le mode journal... */}
            {/* CONTEXTUAL TOP BAR (STICKY) */}
            <div className={`sticky top-0 z-50 rounded-[2.5rem] py-3 px-4 transition-all duration-300 shadow-sm flex items-center justify-between min-h-[72px] -mx-4 md:mx-0 ${isEditMode ? 'bg-gray-900 text-white' : 'bg-white/90 backdrop-blur-md border border-gray-100'}`}>
                
                {isEditMode ? (
                    // --- ETAT B : MODE SELECTION (POWER BAR) ---
                    <>
                        {/* Zone 1 : Cancel + Count */}
                        <div className="flex items-center gap-3 shrink-0">
                            <button onClick={toggleEditMode} className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                            <span className="text-xs font-black uppercase tracking-widest bg-white/10 px-3 py-1.5 rounded-lg">{selectedSessionIds.size}</span>
                        </div>

                        {/* Zone 2 : Persistent Search */}
                        <div className="flex-1 max-w-[200px] sm:max-w-xs mx-2">
                            <div className="relative">
                                <input 
                                    type="text" 
                                    placeholder="Filtrer..." 
                                    value={historySearch}
                                    onChange={(e) => setHistorySearch(e.target.value)}
                                    className="w-full bg-white/10 text-white placeholder-gray-500 pl-9 pr-4 py-2.5 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-white/20 transition-all border border-transparent"
                                />
                                <svg className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                        </div>

                        {/* Zone 3 : Actions (Filters + Export) */}
                        <div className="flex items-center gap-2 shrink-0">
                            {/* Dropdown Filtres */}
                            <div className="relative">
                                <button 
                                    onClick={() => setShowBulkMenu(!showBulkMenu)}
                                    className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${showBulkMenu ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                                >
                                    <span className="text-lg">⚡</span>
                                </button>
                                {showBulkMenu && (
                                    <div className="absolute top-full right-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 animate-in slide-in-from-top-2 z-50 text-black">
                                        <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest px-3 py-2">Filtres Intelligents</p>
                                        
                                        {/* "Tout ce qui est visible" */}
                                        <button onClick={() => handleSmartSelect('visible')} className="w-full flex items-center justify-between px-3 py-3 hover:bg-gray-50 rounded-xl text-xs font-bold text-gray-800">
                                            <span>Tout sélectionner (visible)</span>
                                            {isGroupSelected(filteredHistory) ? <span className="text-green-500">✓</span> : <span className="w-4 h-4 border rounded-sm border-gray-300"/>}
                                        </button>

                                        <div className="h-px bg-gray-100 my-1" />

                                        {/* Par Période */}
                                        <button onClick={() => handleSmartSelect('month', new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase())} className="w-full flex items-center justify-between px-3 py-3 hover:bg-gray-50 rounded-xl text-xs font-bold text-gray-800">
                                            <span>Ce mois-ci</span>
                                            {isGroupSelected(filteredHistory.filter(s => new Date(s.date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase() === new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase())) 
                                                ? <span className="text-green-500">✓</span> : <span className="w-4 h-4 border rounded-sm border-gray-300"/>}
                                        </button>

                                        <div className="h-px bg-gray-100 my-1" />
                                        <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest px-3 py-2">Par Type</p>
                                        
                                        {cardioTypes.slice(0, 4).map(c => {
                                            const groupItems = filteredHistory.filter(s => s.type === c.name);
                                            const isSelected = isGroupSelected(groupItems);
                                            return (
                                            <button key={c.id} onClick={() => handleSmartSelect('type', c.name)} className="w-full flex items-center justify-between px-3 py-3 hover:bg-gray-50 rounded-xl text-xs font-bold text-gray-800 truncate">
                                                <span>Tout {c.name}</span>
                                                {isSelected ? <span className="text-green-500">✓</span> : <span className="w-4 h-4 border rounded-sm border-gray-300"/>}
                                            </button>
                                        )})}
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={handleExport}
                                disabled={selectedSessionIds.size === 0}
                                className={`h-10 px-4 rounded-full font-black text-[10px] uppercase tracking-widest transition-all ${selectedSessionIds.size > 0 ? 'bg-white text-black hover:bg-gray-100' : 'bg-white/10 text-white/30 cursor-not-allowed'}`}
                            >
                                EXP.
                            </button>
                        </div>
                    </>
                ) : (
                    // --- ETAT A : MODE LECTURE ---
                    <>
                        <div className="flex-1 max-w-md relative">
                            <div className="flex gap-2 items-center">
                                <div className="relative w-full">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                    </div>
                                    <input 
                                        type="text" 
                                        placeholder="Rechercher..." 
                                        value={historySearch}
                                        onChange={(e) => setHistorySearch(e.target.value)}
                                        className="w-full bg-gray-50 pl-12 pr-12 py-3 rounded-[2rem] text-sm font-bold placeholder-gray-300 outline-none focus:ring-2 focus:ring-black/5 border border-transparent focus:border-gray-200 transition-all"
                                    />
                                    {historySearch && (
                                        <button type="button" onClick={clearSearch} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-black">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={toggleEditMode}
                            className="ml-3 px-5 py-3 rounded-[2rem] text-[10px] font-black uppercase tracking-widest bg-white border border-gray-200 hover:bg-gray-50 transition-all shadow-sm whitespace-nowrap"
                        >
                            SÉLECTIONNER
                        </button>
                    </>
                )}
            </div>

            {filteredHistory.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-[3rem] border border-dashed border-gray-200">
                  <p className="text-gray-300 font-black text-[10px] uppercase italic">Aucune donnée disponible</p>
                </div>
            ) : (
                filteredHistory.map(s => {
                   const profile = cardioTypes.find(c => c.name === s.type);
                   const color = profile?.color || '#000000';
                   const isSelected = selectedSessionIds.has(s.id);
                   const isExpanded = expandedId === s.id;
                   
                   return (
                    <div key={s.id} className="relative group select-none">
                        
                        <div 
                            onClick={() => handleCardClick(s.id)}
                            className={`
                                bg-white p-6 rounded-[2.5rem] border shadow-sm space-y-4 animate-in slide-in-from-bottom-2 
                                cursor-pointer transition-all duration-300 active:scale-[0.98] flex items-start gap-4
                                ${isSelected && isEditMode ? 'border-blue-500 bg-blue-50/10' : 'border-gray-100 hover:shadow-md'}
                            `}
                        >
                            {/* SLIDE-IN CHECKBOX */}
                            <div className={`flex items-center justify-center transition-all duration-300 overflow-hidden self-center ${isEditMode ? 'w-8 opacity-100 mr-2' : 'w-0 opacity-0'}`}>
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}>
                                    {isSelected && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                </div>
                            </div>

                            <div className="flex-1 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-md transition-all duration-300 ${isSelected ? 'opacity-80' : ''}`} style={{ backgroundColor: color }}>
                                            <span className="text-white">{s.typeEmoji || '🏃'}</span>
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-gray-400 uppercase">{s.date}</span>
                                                <span className={`px-2 py-0.5 rounded text-[7px] font-black text-white ${s.rpe > 7 ? 'bg-red-500' : s.rpe > 4 ? 'bg-orange-400' : 'bg-green-500'}`}>RPE {s.rpe}</span>
                                            </div>
                                            <h4 className={`text-lg font-black uppercase tracking-tight transition-colors`}>{s.type}</h4>
                                        </div>
                                    </div>
                                    {/* Delete Button (Only in Read Mode) */}
                                    {!isEditMode && (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation(); 
                                                if(window.confirm('Supprimer définitivement cette séance de l\'historique ?')) {
                                                    onDeleteSession(s.id);
                                                }
                                            }} 
                                            className="text-gray-300 hover:text-red-500 transition-colors text-xs font-black p-2"
                                        >
                                            SUPPRIMER
                                        </button>
                                    )}
                                </div>
                                
                                {/* Metrics Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-2xl pointer-events-none">
                                <div className="text-center">
                                    <p className="text-[8px] font-black text-gray-400 uppercase">Distance</p>
                                    <p className="text-sm font-black">{s.distance} km</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-[8px] font-black text-gray-400 uppercase">Durée</p>
                                    <p className="text-sm font-black">{s.duration} min</p>
                                </div>
                                {s.hr && (
                                    <div className="text-center">
                                        <p className="text-[8px] font-black text-gray-400 uppercase">FC Moy</p>
                                        <p className="text-sm font-black">{s.hr} bpm</p>
                                    </div>
                                )}
                                {s.watts && (
                                    <div className="text-center">
                                        <p className="text-[8px] font-black text-gray-400 uppercase">Puissance</p>
                                        <p className="text-sm font-black">{s.watts} w</p>
                                    </div>
                                )}
                                </div>
                                
                                {/* Expandable Details (Notes, Segments) - Only visible if expanded AND NOT selected (to keep UI clean) */}
                                {(isExpanded && !isEditMode) && (
                                    <div className="space-y-4 pt-2 animate-in fade-in">
                                        {!s.segments && s.intervalStructure && (
                                        <div className="bg-gray-50 p-4 rounded-2xl border-l-4 border-black/10 pointer-events-none">
                                            <p className="text-[8px] font-black text-gray-400 uppercase mb-2">Notes</p>
                                            <p className="text-xs font-medium whitespace-pre-wrap">{s.intervalStructure}</p>
                                        </div>
                                        )}
                                        {s.notes && (
                                            <div className="pointer-events-none">
                                                <p className="text-[9px] font-black text-gray-300 uppercase">Commentaire</p>
                                                <p className="text-xs text-gray-500 italic">{s.notes}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
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