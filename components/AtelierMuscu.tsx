import React, { useState, useEffect, useMemo } from 'react';
import { UserRoutine, TrainingLog } from '../types';
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts';
import { downloadCSV, formatDateISO } from '../exportService';

interface AtelierMuscuProps {
  routines: UserRoutine[];
  onUpdateRoutines: React.Dispatch<React.SetStateAction<UserRoutine[]>>;
  onSaveLogs: (logs: TrainingLog[]) => void;
  trainingLogs: TrainingLog[];
  activitySessions?: any[]; 
  onDeleteSession: (date: string, sessionName: string) => void;
}

const COLORS = [
  { hex: '#000000', name: 'Noir' },
  { hex: '#EF4444', name: 'Rouge' },
  { hex: '#F97316', name: 'Orange' },
  { hex: '#10B981', name: 'Vert' },
  { hex: '#3B82F6', name: 'Bleu' },
  { hex: '#8B5CF6', name: 'Violet' },
  { hex: '#EC4899', name: 'Rose' }
];

interface SetData {
  weight: number;
  reps: number;
}

type StrengthItem = { 
  id: string; 
  date: string; 
  sessionName: string; 
  color: string; 
  tonnage: number; 
  exercisesCount: number; 
  logs: TrainingLog[] 
};

const AtelierMuscu: React.FC<AtelierMuscuProps> = ({ routines, onUpdateRoutines, onSaveLogs, trainingLogs, onDeleteSession }) => {
  const [activeTab, setActiveTab] = useState<'session' | 'journal' | 'manage'>('session');
  
  // --- SESSION STATE ---
  const [selectedRoutine, setSelectedRoutine] = useState<UserRoutine | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const [order, setOrder] = useState<number>(1);
  const [numSets, setNumSets] = useState<number>(3);
  const [setsData, setSetsData] = useState<SetData[]>(Array(10).fill({ weight: 0, reps: 0 }));

  // --- MANAGE STATE ---
  const [isCreating, setIsCreating] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState('');
  const [newRoutineColor, setNewRoutineColor] = useState('#000000');
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [quickExInput, setQuickExInput] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // --- JOURNAL STATE ---
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [analyzedExercise, setAnalyzedExercise] = useState<string | null>(null);
  
  // --- EXPLICIT SELECTION STATE ---
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [showBulkMenu, setShowBulkMenu] = useState(false);

  // =================================================================================
  //  DATA PROCESSING
  // =================================================================================

  const uniqueExercises = useMemo(() => {
    return Array.from(new Set(trainingLogs.map(l => l.exercise))).sort();
  }, [trainingLogs]);

  const timelineData = useMemo(() => {
    const strengthGroups: Record<string, TrainingLog[]> = {};
    trainingLogs.forEach(log => {
        const key = `${log.date}::${log.session}`;
        if (!strengthGroups[key]) strengthGroups[key] = [];
        strengthGroups[key].push(log);
    });

    let items: StrengthItem[] = Object.entries(strengthGroups).map(([key, logs]) => {
        const [date, sessionName] = key.split('::');
        const routine = routines.find(r => r.name === sessionName);
        return {
            id: key,
            date,
            sessionName,
            color: routine?.color || '#000000',
            tonnage: logs.reduce((acc, l) => acc + l.tonnage, 0),
            exercisesCount: new Set(logs.map(l => l.exercise)).size,
            logs
        };
    });

    items.sort((a, b) => b.date.localeCompare(a.date));

    // RECHERCHE (Appliquée même en Edit Mode pour permettre le filtrage dynamique)
    if (searchQuery.trim() && !analyzedExercise) {
        const q = searchQuery.toLowerCase();
        items = items.filter(i => 
            i.sessionName.toLowerCase().includes(q) || 
            i.logs.some(l => l.exercise.toLowerCase().includes(q))
        );
    }

    const grouped: Record<string, StrengthItem[]> = {};
    items.forEach(item => {
        const d = new Date(item.date);
        const key = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase();
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(item);
    });

    return { grouped, flatItems: items };
  }, [trainingLogs, routines, searchQuery, analyzedExercise]);

  const analyticsData = useMemo(() => {
    if (!analyzedExercise) return null;
    const logs = trainingLogs
        .filter(l => l.exercise === analyzedExercise)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (logs.length === 0) return null;

    const sessionMap = new Map<string, number>();
    logs.forEach(l => {
        const currMax = sessionMap.get(l.date) || 0;
        if (l.weight > currMax) sessionMap.set(l.date, l.weight);
    });

    const chartData = Array.from(sessionMap.entries()).map(([date, weight]) => ({
        dateStr: new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
        fullDate: date,
        weight
    }));

    const historyList = Array.from(sessionMap.keys()).reverse().map((date, idx, arr) => {
        const sessionLogs = logs.filter(l => l.date === date).sort((a,b) => a.setNum - b.setNum);
        const currentMax = sessionMap.get(date) || 0;
        const prevDate = arr[idx + 1];
        const prevMax = prevDate ? (sessionMap.get(prevDate) || 0) : currentMax;
        
        let trend: 'up' | 'down' | 'flat' = 'flat';
        if (currentMax > prevMax) trend = 'up';
        if (currentMax < prevMax) trend = 'down';

        return { date, logs: sessionLogs, maxWeight: currentMax, trend };
    });

    return { chartData, historyList };
  }, [analyzedExercise, trainingLogs]);


  // =================================================================================
  //  HANDLERS
  // =================================================================================

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const exactMatch = uniqueExercises.find(ex => ex.toLowerCase() === searchQuery.trim().toLowerCase());
    if (exactMatch) {
        setAnalyzedExercise(exactMatch);
        setSearchQuery(exactMatch);
    } else {
        setAnalyzedExercise(null);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setAnalyzedExercise(null);
  };

  // --- MODE GESTION (EDIT MODE) ---

  const toggleEditMode = () => {
      if (isEditMode) {
          setIsEditMode(false);
          setSelectedSessionIds(new Set());
          setShowBulkMenu(false);
          setSearchQuery(''); // Optional: clear search on exit
      } else {
          setIsEditMode(true);
          setExpandedSessionId(null);
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
        setExpandedSessionId(expandedSessionId === id ? null : id);
    }
  };

  // --- SMART TOGGLE FILTERS (Add/Remove Logic) ---

  // Helper to check if a group is fully selected
  const isGroupSelected = (itemsToCheck: StrengthItem[]) => {
      if (itemsToCheck.length === 0) return false;
      return itemsToCheck.every(item => selectedSessionIds.has(item.id));
  };

  const handleSmartSelect = (criteria: 'visible' | 'month' | 'program', value?: string) => {
      const newSet = new Set(selectedSessionIds);
      let targetItems: StrengthItem[] = [];

      // 1. Identify Target Items
      if (criteria === 'visible') {
          targetItems = timelineData.flatItems;
      } else if (criteria === 'month') {
          targetItems = timelineData.flatItems.filter(item => {
              const itemMonth = new Date(item.date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase();
              return itemMonth === value;
          });
      } else if (criteria === 'program') {
          targetItems = timelineData.flatItems.filter(item => item.sessionName === value);
      }

      if (targetItems.length === 0) return;

      // 2. Check State (All selected?)
      const allSelected = targetItems.every(item => newSet.has(item.id));

      // 3. Toggle Logic
      if (allSelected) {
          // Deselect all
          targetItems.forEach(item => newSet.delete(item.id));
      } else {
          // Select missing
          targetItems.forEach(item => newSet.add(item.id));
      }

      setSelectedSessionIds(newSet);
      setShowBulkMenu(false);
  };

  const handleExport = async () => {
    const itemsToExport = selectedSessionIds.size > 0 
        ? timelineData.flatItems.filter(i => selectedSessionIds.has(i.id))
        : []; // If nothing selected, maybe export filtered? For now, button disabled if 0.

    if (itemsToExport.length === 0) return;

    let rawDataToExport: TrainingLog[] = [];
    itemsToExport.forEach(item => {
        rawDataToExport = [...rawDataToExport, ...item.logs];
    });

    rawDataToExport.sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime() || 
               a.session.localeCompare(b.session) || 
               a.order - b.order || 
               a.setNum - b.setNum;
    });

    const headers = ['Date', 'Programme', 'Exercice', 'Ordre', 'Serie', 'Poids (kg)', 'Reps', 'Tonnage (kg)'];
    const rows = rawDataToExport.map(log => [
        formatDateISO(log.date),
        log.session,
        log.exercise,
        log.order,
        log.setNum,
        log.weight,
        log.reps,
        log.tonnage
    ]);
    const filename = `Athletica_Muscu_Export_${new Date().toISOString().split('T')[0]}.csv`;
    await downloadCSV(filename, headers, rows);
    
    setIsEditMode(false);
    setSelectedSessionIds(new Set());
  };

  // ... (Session Logic Helpers - Unchanged)
  useEffect(() => { setSetsData(Array(10).fill({ weight: 0, reps: 0 })); }, [selectedExercise]);
  
  const handleSaveSession = () => {
    if (!selectedRoutine || !selectedExercise) return;
    const date = new Date().toISOString().split('T')[0];
    const logs: TrainingLog[] = [];
    for (let i = 0; i < numSets; i++) {
      if (setsData[i].weight > 0 || setsData[i].reps > 0) {
        logs.push({
          date, session: selectedRoutine.name, exercise: selectedExercise,
          order, weight: setsData[i].weight, reps: setsData[i].reps,
          setNum: i + 1, tonnage: setsData[i].weight * setsData[i].reps
        });
      }
    }
    if (logs.length > 0) { onSaveLogs(logs); setOrder(prev => prev + 1); setSelectedExercise(''); }
  };

  const handleInputChange = (index: number, field: 'weight' | 'reps', value: string) => {
    const numValue = parseFloat(value) || 0;
    const newSets = [...setsData];
    newSets[index] = { ...newSets[index], [field]: numValue };
    setSetsData(newSets);
  };

  const adjustValue = (index: number, field: 'weight' | 'reps', amount: number) => {
    const newSets = [...setsData];
    const newVal = Math.max(0, parseFloat((newSets[index][field] + amount).toFixed(1)));
    newSets[index] = { ...newSets[index], [field]: newVal };
    if (field === 'weight' && index === 0) {
        for(let k=1; k < numSets; k++) {
            if (newSets[k].weight === 0) newSets[k].weight = newVal;
        }
    }
    setSetsData(newSets);
  };

  const handleCreateRoutine = () => {
    if (!newRoutineName.trim()) return;
    const newId = Date.now().toString();
    onUpdateRoutines(prev => [...prev, { id: newId, name: newRoutineName, exercises: [], color: newRoutineColor }]);
    setNewRoutineName(''); setIsCreating(false); setEditingRoutineId(newId);
  };

  const handleDeleteRoutineClick = (id: string) => {
    if (confirmDelete) { onUpdateRoutines(prev => prev.filter(r => r.id !== id)); setEditingRoutineId(null); setConfirmDelete(false); } 
    else { setConfirmDelete(true); }
  };
  
  const hasDataToSave = setsData.some(s => s.weight > 0 && s.reps > 0);
  const routineToEdit = routines.find(r => r.id === editingRoutineId);

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-8 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase text-gray-900 leading-none">
            STUDIO <span className="text-black/10">MUSCU</span>
          </h1>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-2">Professional Training Suite</p>
        </div>
        <div className="bg-black/5 p-1.5 rounded-[2rem] flex gap-1 border border-black/5 self-start sm:self-auto w-full sm:w-auto overflow-x-auto">
          <button onClick={() => setActiveTab('session')} className={`flex-1 px-6 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all min-h-[44px] whitespace-nowrap ${activeTab === 'session' ? 'bg-white text-black shadow-lg scale-105' : 'text-gray-400 hover:text-gray-600'}`}>Session</button>
          <button onClick={() => setActiveTab('journal')} className={`flex-1 px-6 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all min-h-[44px] whitespace-nowrap ${activeTab === 'journal' ? 'bg-white text-black shadow-lg scale-105' : 'text-gray-400 hover:text-gray-600'}`}>Journal</button>
          <button onClick={() => setActiveTab('manage')} className={`flex-1 px-6 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all min-h-[44px] whitespace-nowrap ${activeTab === 'manage' ? 'bg-white text-black shadow-lg scale-105' : 'text-gray-400 hover:text-gray-600'}`}>Config</button>
        </div>
      </div>

      {/* SESSION & MANAGE TABS: Unchanged */}
      {activeTab === 'session' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {routines.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-20 px-6 bg-white rounded-[3rem] border-2 border-dashed border-gray-100 text-center space-y-6">
                <span className="text-5xl grayscale opacity-30">🏋️</span>
                <p className="text-gray-400 font-medium text-sm">Configure tes programmes dans l'onglet "Config".</p>
                <button onClick={() => setActiveTab('manage')} className="px-8 py-5 bg-black text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 transition-transform">Aller à la configuration</button>
             </div>
          ) : (
            <>
              {/* ... Selection logic ... */}
              <section className="space-y-4">
                <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] ml-2">1. SÉLECTION PROGRAMME</h3>
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-4">
                  {routines.map((r, idx) => (
                    <button key={r.id} onClick={() => { setSelectedRoutine(r); setSelectedExercise(''); }} className={`relative p-6 rounded-[2rem] border transition-all duration-300 overflow-hidden group min-h-[100px] flex flex-col justify-between text-left ${selectedRoutine?.id === r.id ? 'bg-black border-black text-white shadow-xl scale-[1.02]' : 'bg-white border-black/5 text-gray-500 hover:border-black/20'}`}>
                      <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: r.color }} />
                      <span className="text-2xl mb-2 block opacity-50">{idx + 1 < 10 ? `0${idx + 1}` : idx + 1}</span>
                      <p className="text-[11px] font-black uppercase tracking-widest relative z-10 break-words leading-tight">{r.name}</p>
                    </button>
                  ))}
                </div>
              </section>

              {/* ... Rest of Session View ... */}
              {selectedRoutine && (
                <section className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                  <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] ml-2">2. SÉLECTION DU MOUVEMENT</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative group">
                      <select value={selectedExercise} onChange={(e) => setSelectedExercise(e.target.value)} className={`w-full bg-white border rounded-[2rem] py-6 px-10 text-base font-black uppercase tracking-widest appearance-none outline-none focus:ring-4 focus:ring-black/5 transition-all shadow-sm min-h-[72px] ${selectedExercise ? 'border-black' : 'border-black/5'}`}>
                        <option value="">— CHOISIR L'EXERCICE —</option>
                        {selectedRoutine.exercises.map((ex, i) => <option key={i} value={ex}>{ex}</option>)}
                      </select>
                      <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none text-gray-300"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7 7"></path></svg></div>
                    </div>
                    {/* Order selector */}
                    <div className="bg-white border border-black/5 rounded-[2rem] p-4 flex items-center justify-between shadow-sm min-h-[72px]">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-4">Ordre</span>
                      <div className="flex items-center gap-4">
                        <button onClick={() => setOrder(Math.max(1, order - 1))} className="w-12 h-12 rounded-full bg-black/5 hover:bg-black hover:text-white transition-all font-black text-lg flex items-center justify-center active:scale-90">−</button>
                        <span className="text-xl font-black w-8 text-center">#{order}</span>
                        <button onClick={() => setOrder(order + 1)} className="w-12 h-12 rounded-full bg-black/5 hover:bg-black hover:text-white transition-all font-black text-lg flex items-center justify-center active:scale-90">+</button>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {selectedExercise && (
                <section className="space-y-8 animate-in slide-in-from-bottom-8 duration-700">
                  <div className="flex justify-between items-center px-2">
                    <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">3. DONNÉES DE TERRAIN</h3>
                    <div className="bg-black/5 p-1 rounded-[1.2rem] flex border border-black/5 overflow-x-auto max-w-[60%] scrollbar-hide">
                      {[1, 2, 3, 4, 5, 6].map(n => (
                        <button key={n} onClick={() => setNumSets(n)} className={`w-11 h-11 flex-shrink-0 rounded-xl text-[10px] font-black transition-all ${numSets === n ? 'bg-black text-white shadow-lg scale-110' : 'text-gray-400 hover:text-gray-800'}`}>{n}</button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array(numSets).fill(0).map((_, i) => (
                      <div key={i} className="relative rounded-[2.5rem] border border-black/5 bg-white shadow-sm p-6">
                        <div className="flex justify-between items-center mb-6"><span className="text-[10px] font-black uppercase tracking-widest text-gray-300">SÉRIE {i + 1}</span></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-3">
                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest text-center">KG</p>
                                <input type="number" value={setsData[i].weight || ''} onChange={(e) => handleInputChange(i, 'weight', e.target.value)} className="w-full text-center bg-gray-50 rounded-2xl py-3 text-2xl font-black text-gray-900 outline-none focus:ring-2 focus:ring-black/5 transition-all placeholder-gray-200" placeholder="0" />
                                <div className="flex gap-1 justify-center">
                                    <button onClick={() => adjustValue(i, 'weight', -2.5)} className="flex-1 h-10 rounded-xl bg-gray-50 text-gray-400 hover:bg-black hover:text-white font-black text-[10px] active:scale-90 transition-all">-</button>
                                    <button onClick={() => adjustValue(i, 'weight', 2.5)} className="flex-1 h-10 rounded-xl bg-gray-50 text-gray-400 hover:bg-black hover:text-white font-black text-[10px] active:scale-90 transition-all">+</button>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest text-center">REPS</p>
                                <input type="number" value={setsData[i].reps || ''} onChange={(e) => handleInputChange(i, 'reps', e.target.value)} className="w-full text-center bg-gray-50 rounded-2xl py-3 text-2xl font-black text-gray-900 outline-none focus:ring-2 focus:ring-black/5 transition-all placeholder-gray-200" placeholder="0" />
                                <div className="flex gap-1 justify-center">
                                    <button onClick={() => adjustValue(i, 'reps', -1)} className="flex-1 h-10 rounded-xl bg-gray-50 text-gray-400 hover:bg-black hover:text-white font-black text-[10px] active:scale-90 transition-all">-</button>
                                    <button onClick={() => adjustValue(i, 'reps', 1)} className="flex-1 h-10 rounded-xl bg-gray-50 text-gray-400 hover:bg-black hover:text-white font-black text-[10px] active:scale-90 transition-all">+</button>
                                </div>
                            </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="sticky bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#FBFBFB] via-[#FBFBFB] to-transparent z-10 -mx-4 md:mx-0">
                    <button onClick={handleSaveSession} disabled={!hasDataToSave} className={`w-full py-5 rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] shadow-2xl active:scale-[0.98] transition-all backdrop-blur-md border border-white/20 ${hasDataToSave ? 'bg-black text-white hover:bg-gray-900' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>ENREGISTRER</button>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {/* =========================================================================
                                     ONGLET JOURNAL (DATA CENTER)
         ========================================================================= */}
      {activeTab === 'journal' && (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 min-h-[60vh] pb-32">
            
            {/* 1. POWER BAR HEADER (STICKY) */}
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
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
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
                                            {isGroupSelected(timelineData.flatItems) ? <span className="text-green-500">✓</span> : <span className="w-4 h-4 border rounded-sm border-gray-300"/>}
                                        </button>

                                        <div className="h-px bg-gray-100 my-1" />
                                        
                                        {/* Mois en cours */}
                                        <button onClick={() => handleSmartSelect('month', new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase())} className="w-full flex items-center justify-between px-3 py-3 hover:bg-gray-50 rounded-xl text-xs font-bold text-gray-800">
                                            <span>Ce mois-ci</span>
                                            {isGroupSelected(timelineData.flatItems.filter(i => new Date(i.date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase() === new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase())) 
                                                ? <span className="text-green-500">✓</span> : <span className="w-4 h-4 border rounded-sm border-gray-300"/>}
                                        </button>

                                        <div className="h-px bg-gray-100 my-1" />
                                        <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest px-3 py-2">Par Programme</p>
                                        
                                        {routines.slice(0, 4).map(r => {
                                            const groupItems = timelineData.flatItems.filter(i => i.sessionName === r.name);
                                            const isSelected = isGroupSelected(groupItems);
                                            return (
                                            <button key={r.id} onClick={() => handleSmartSelect('program', r.name)} className="w-full flex items-center justify-between px-3 py-3 hover:bg-gray-50 rounded-xl text-xs font-bold text-gray-800 truncate">
                                                <span>Tout {r.name}</span>
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
                    // --- ETAT A : MODE LECTURE (RECHERCHE SIMPLE) ---
                    <>
                        <div className="flex-1 max-w-md relative">
                            <form onSubmit={handleSearchSubmit} className="relative w-full">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                </div>
                                <input 
                                    type="text" 
                                    placeholder="Rechercher..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-gray-50 pl-12 pr-12 py-3 rounded-[2rem] text-sm font-bold placeholder-gray-300 outline-none focus:ring-2 focus:ring-black/5 border border-transparent focus:border-gray-200 transition-all"
                                />
                                {searchQuery && (
                                    <button type="button" onClick={clearSearch} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-black">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                )}
                            </form>
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

            {/* 2. MODE INSPECTEUR (ANALYTICS) - Masqué en mode édition */}
            {analyzedExercise && analyticsData && !isEditMode && (
                /* ... Analytics View ... */
                <div className="space-y-6 animate-in slide-in-from-bottom-8">
                    {/* Header Analytics */}
                    <div className="bg-black text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                         <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                         <h2 className="text-2xl font-black uppercase tracking-tighter mb-1">{analyzedExercise}</h2>
                         <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-6">Analyse de progression</p>
                         
                         <div className="h-40 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={analyticsData.chartData}>
                                    <defs>
                                        <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#fff" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#fff" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#111', border: 'none', borderRadius: '12px' }}
                                        itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                                        labelStyle={{ display: 'none' }}
                                    />
                                    <Area type="monotone" dataKey="weight" stroke="#fff" strokeWidth={3} fillOpacity={1} fill="url(#colorWeight)" />
                                </AreaChart>
                            </ResponsiveContainer>
                         </div>
                    </div>
                    {/* History List */}
                    <div className="space-y-3">
                        <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-widest ml-4">Historique Performances</h3>
                        {analyticsData.historyList.map((item, idx) => (
                            <div key={idx} className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between group">
                                <div>
                                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">{new Date(item.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl font-mono font-bold tracking-tight text-gray-900">{item.maxWeight}kg</span>
                                        {item.trend === 'up' && <span className="text-green-500 text-xs bg-green-50 px-1.5 py-0.5 rounded">↗</span>}
                                        {item.trend === 'down' && <span className="text-red-400 text-xs bg-red-50 px-1.5 py-0.5 rounded">↘</span>}
                                    </div>
                                </div>
                                <div className="text-right">
                                    {item.logs.map((log, lIdx) => (
                                        <div key={lIdx} className="text-xs font-mono text-gray-500">
                                            {log.reps} <span className="text-[9px] text-gray-300">reps</span> @ {log.weight}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 3. MODE TIMELINE (Liste Classique) */}
            {(!analyzedExercise || isEditMode) && (
                <div className="space-y-8">
                    {Object.entries(timelineData.grouped).map(([month, items]: [string, StrengthItem[]]) => (
                        <div key={month} className="space-y-4">
                            {/* Mois Header */}
                            <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] sticky top-[80px] bg-[#FBFBFB] py-2 z-10 pl-2">
                                {month}
                            </h3>

                            {items.map((item) => {
                                const isSelected = selectedSessionIds.has(item.id);
                                return (
                                <div key={item.id} className="relative group select-none">
                                    {/* CARD CONTAINER */}
                                    <div 
                                        onClick={() => handleCardClick(item.id)}
                                        className={`
                                            bg-white rounded-[2.5rem] border shadow-sm overflow-hidden transition-all duration-300 active:scale-[0.99] flex
                                            ${isSelected && isEditMode ? 'border-blue-500 bg-blue-50/10' : 'border-gray-100 hover:shadow-md'}
                                        `}
                                    >
                                        {/* SLIDE-IN CHECKBOX (Explicit Selection) */}
                                        <div className={`flex items-center justify-center transition-all duration-300 overflow-hidden ${isEditMode ? 'w-14 opacity-100' : 'w-0 opacity-0'}`}>
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}>
                                                {isSelected && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                            </div>
                                        </div>

                                        {/* Main Content */}
                                        <div className="flex-1 p-5 pl-2 grid gap-4 items-center" style={{ gridTemplateColumns: '50px 1fr auto' }}>   
                                            {/* Avatar (Static in this pattern) */}
                                            <div 
                                                className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg shadow-inner text-white font-black uppercase shrink-0"
                                                style={{ backgroundColor: item.color }}
                                            >
                                                {item.sessionName.substring(0, 2)}
                                            </div>

                                            {/* Info */}
                                            <div>
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                        {new Date(item.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}
                                                    </span>
                                                </div>
                                                <h4 className="text-base font-black uppercase tracking-tight leading-none text-gray-900 truncate max-w-[160px] sm:max-w-none">
                                                    {item.sessionName}
                                                </h4>
                                                
                                                {/* Preview Content */}
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {item.logs.reduce((acc: string[], curr) => {
                                                        if (!acc.includes(curr.exercise)) acc.push(curr.exercise);
                                                        return acc;
                                                    }, []).slice(0, 2).map((ex, i) => (
                                                        <span key={i} className="text-[9px] font-bold text-gray-500 bg-white border border-gray-100 px-2 py-1 rounded-lg truncate max-w-[100px]">{ex}</span>
                                                    ))}
                                                    {item.exercisesCount > 2 && <span className="text-[9px] font-bold text-gray-300">+{item.exercisesCount - 2}</span>}
                                                </div>
                                            </div>

                                            {/* Right Stats */}
                                            <div className="text-right hidden sm:block">
                                                <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Volume</p>
                                                <p className="text-base font-mono font-bold text-black">{(item.tonnage / 1000).toFixed(1)}t</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Details (Only in Read Mode) */}
                                    {expandedSessionId === item.id && !isEditMode && (
                                        <div className="bg-gray-50 border-x border-b border-gray-100 p-6 space-y-4 animate-in fade-in rounded-b-[2.5rem] -mt-6 pt-10 mx-1 mb-4 shadow-inner" onClick={(e) => e.stopPropagation()}>
                                            {Object.entries(item.logs.reduce<Record<string, TrainingLog[]>>((acc, log) => {
                                                if(!acc[log.exercise]) acc[log.exercise] = [];
                                                acc[log.exercise].push(log);
                                                return acc;
                                            }, {})).map(([exerciseName, sets], idx) => {
                                                const exerciseTonnage = sets.reduce((acc, s) => acc + s.tonnage, 0);
                                                return (
                                                <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center">
                                                    <h5 className="text-xs font-black uppercase tracking-wide w-1/3 truncate">
                                                        {exerciseName}
                                                        <span className="block text-[9px] font-bold text-gray-400 mt-1">{(exerciseTonnage).toFixed(0)} kg</span>
                                                    </h5>
                                                    <div className="flex flex-wrap justify-end gap-2 flex-1">
                                                        {sets.sort((a,b) => a.setNum - b.setNum).map((set, sIdx) => (
                                                            <div key={sIdx} className="bg-gray-50 px-2 py-1 rounded-lg text-center min-w-[50px]">
                                                                <div className="text-xs font-mono font-bold text-black">{set.weight}</div>
                                                                <div className="text-[9px] font-mono text-gray-400">x{set.reps}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )})}
                                            
                                            <div className="pt-2 flex justify-end">
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation(); 
                                                        onDeleteSession(item.date, item.sessionName);
                                                    }}
                                                    className="text-[10px] font-black text-red-400 hover:text-red-600 uppercase tracking-widest px-4 py-3 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                                                >
                                                    Supprimer la séance
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )})}
                        </div>
                    ))}
                    {Object.keys(timelineData.grouped).length === 0 && (
                        <div className="text-center py-20 opacity-50">
                            <p className="text-gray-400 font-bold">Aucune séance trouvée.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
      )}

      {/* MANAGE TAB: Unchanged */}
      {activeTab === 'manage' && (
        <div className="space-y-6 animate-in fade-in duration-300 min-h-[50vh]">
           {/* ... unchanged ... */}
           {routines.length === 0 && (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 space-y-4 pointer-events-none mt-20">
                <span className="text-4xl grayscale opacity-30">🏗️</span>
                <p className="text-gray-400 font-bold max-w-xs leading-relaxed text-sm">Commence par créer ton architecture d'entraînement.</p>
                <div className="text-[10px] font-black text-gray-300 uppercase tracking-widest mt-4">Appuie sur le + pour démarrer</div>
             </div>
           )}
           <div className="grid grid-cols-2 gap-4 pb-32">
             <button onClick={() => setIsCreating(true)} className="border-2 border-dashed border-gray-200 rounded-[2rem] flex flex-col items-center justify-center gap-2 text-gray-300 hover:text-black hover:border-black transition-all p-4 h-[120px] active:scale-95 bg-gray-50/50">
                <span className="text-3xl">+</span>
                <span className="text-[9px] font-black uppercase tracking-widest">Nouveau</span>
             </button>
             {routines.map(r => (
               <button key={r.id} onClick={() => setEditingRoutineId(r.id)} className="bg-white p-5 rounded-[2rem] border border-black/5 shadow-sm hover:shadow-lg transition-all text-left flex flex-col justify-between h-[120px] group relative overflow-hidden active:scale-95">
                 <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: r.color }} />
                 <div className="pl-3">
                     <div className="w-2 h-2 rounded-full mb-3 opacity-50" style={{ backgroundColor: r.color }} />
                     <h4 className="text-xl font-black uppercase tracking-tighter text-gray-900 leading-none mb-1 group-hover:scale-105 transition-transform origin-left truncate w-full">{r.name}</h4>
                     <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{r.exercises.length} Exos</p>
                 </div>
                 <div className="absolute bottom-4 right-4 text-gray-300 group-hover:text-black transition-colors">
                     <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                 </div>
               </button>
             ))}
           </div>
        </div>
      )}

      {/* OVERLAYS: Unchanged */}
      {isCreating && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm transition-opacity flex items-end justify-center" onClick={() => setIsCreating(false)}>
             {/* ... */}
              <div onClick={e => e.stopPropagation()} className="w-full bg-[#FBFBFB] rounded-t-[2.5rem] p-8 pb-12 shadow-2xl animate-in slide-in-from-bottom duration-300 relative">
                  <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-8 opacity-50" />
                  <div className="space-y-6 max-w-lg mx-auto">
                      <div className="text-center">
                          <h3 className="text-2xl font-black uppercase tracking-tighter mb-1">Nouveau Programme</h3>
                          <p className="text-sm text-gray-400 font-medium">Définis l'identité de ta séance.</p>
                      </div>
                      <div className="space-y-6">
                          <input type="text" placeholder="NOM (Ex: PUSH A)" value={newRoutineName} onChange={e => setNewRoutineName(e.target.value)} autoFocus className="w-full p-6 bg-white rounded-[2rem] text-xl font-black uppercase tracking-tight outline-none border-2 border-transparent focus:border-black transition-all shadow-sm text-center" />
                          <div className="space-y-2 text-center">
                            <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Code Couleur</label>
                            <div className="flex gap-4 overflow-x-auto pb-4 pt-2 px-2 scrollbar-hide justify-center">
                                {COLORS.map(c => (
                                <button key={c.hex} onClick={() => setNewRoutineColor(c.hex)} className={`w-14 h-14 rounded-full transition-all border-[4px] flex-shrink-0 ${newRoutineColor === c.hex ? 'border-black scale-110 shadow-lg' : 'border-transparent opacity-40 hover:opacity-100'}`} style={{ backgroundColor: c.hex }} />
                                ))}
                            </div>
                          </div>
                      </div>
                      <div className="flex gap-3 pt-4">
                          <button onClick={() => setIsCreating(false)} className="flex-1 py-5 text-xs font-black uppercase tracking-widest text-gray-400 bg-gray-100 hover:bg-gray-200 rounded-[1.5rem]">Annuler</button>
                          <button onClick={handleCreateRoutine} disabled={!newRoutineName.trim()} className={`flex-1 py-5 rounded-[1.5rem] text-xs font-black uppercase tracking-widest shadow-xl transition-all ${newRoutineName.trim() ? 'bg-black text-white hover:bg-gray-900 active:scale-95' : 'bg-gray-200 text-gray-400'}`}>Créer</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
      {editingRoutineId && routineToEdit && (
         <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setEditingRoutineId(null)}>
              <div onClick={e => e.stopPropagation()} className="w-full sm:max-w-xl h-[92vh] sm:h-[85vh] bg-[#FBFBFB] sm:rounded-[2.5rem] rounded-t-[2.5rem] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300 relative overflow-hidden">
                  <div className="px-6 pt-5 pb-5 bg-white/90 backdrop-blur-xl border-b border-gray-100 flex items-center justify-between shrink-0 z-20 relative">
                      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-200 rounded-full" />
                      <div className="mt-2">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Édition du programme</p>
                          <div className="flex items-center gap-3">
                              <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: routineToEdit.color }} />
                              <h2 className="text-2xl font-black uppercase tracking-tighter truncate max-w-[200px]">{routineToEdit.name}</h2>
                          </div>
                      </div>
                      <button onClick={() => setEditingRoutineId(null)} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors mt-2"><svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5 space-y-6 pb-40">
                      <div className="relative">
                          <input type="text" placeholder="AJOUTER UN EXERCICE..." value={quickExInput} onChange={(e) => setQuickExInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && quickExInput.trim()) { onUpdateRoutines(prev => prev.map(r => r.id === routineToEdit.id ? { ...r, exercises: [...r.exercises, quickExInput.trim()] } : r)); setQuickExInput(''); }}} className="w-full pl-6 pr-14 py-5 bg-white rounded-[1.8rem] shadow-sm border border-gray-100 text-sm font-bold uppercase tracking-wide outline-none focus:ring-2 focus:ring-black/5 placeholder-gray-300" autoFocus />
                          <button onClick={() => { if (quickExInput.trim()) { onUpdateRoutines(prev => prev.map(r => r.id === routineToEdit.id ? { ...r, exercises: [...r.exercises, quickExInput.trim()] } : r)); setQuickExInput(''); }}} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center font-black text-xl shadow-lg active:scale-90 transition-transform">+</button>
                      </div>
                      <div className="space-y-3">
                          {routineToEdit.exercises.length === 0 && (<div className="text-center py-12 opacity-50 bg-white rounded-[2rem] border border-dashed border-gray-200"><p className="text-sm font-medium text-gray-400">Playlist vide.</p></div>)}
                          {routineToEdit.exercises.map((ex, i) => (
                              <div key={i} className="bg-white p-4 pl-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between animate-in slide-in-from-bottom-2">
                                  <div className="flex items-center gap-4">
                                      <div className="flex flex-col items-center justify-center w-8 text-gray-300 border-r border-gray-100 pr-4 mr-1"><span className="text-[10px] font-black text-gray-200">#{i + 1}</span></div>
                                      <span className="text-sm font-black uppercase tracking-tight text-gray-800">{ex}</span>
                                  </div>
                                  <button type="button" onClick={(e) => { e.stopPropagation(); onUpdateRoutines(prev => prev.map(r => r.id === routineToEdit.id ? { ...r, exercises: r.exercises.filter((_, idx) => idx !== i) } : r)); }} className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-all active:scale-95"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                              </div>
                          ))}
                      </div>
                      <div className="pt-12 pb-4 px-2 text-center">
                          <button onClick={() => handleDeleteRoutineClick(routineToEdit.id)} className={`text-xs font-medium underline underline-offset-4 transition-all ${confirmDelete ? 'text-red-500 font-bold scale-105' : 'text-gray-400 hover:text-gray-600'}`}>{confirmDelete ? 'Êtes-vous sûr ? Tapez pour confirmer.' : 'Supprimer ce programme définitivement'}</button>
                      </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-6 bg-white/90 backdrop-blur-xl border-t border-gray-100 z-10 pb-8">
                      <button onClick={() => setEditingRoutineId(null)} className="w-full py-4 bg-black text-white rounded-[1.8rem] font-black text-sm uppercase tracking-[0.2em] shadow-xl hover:bg-gray-900 active:scale-[0.98] transition-all">TERMINER</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default AtelierMuscu;