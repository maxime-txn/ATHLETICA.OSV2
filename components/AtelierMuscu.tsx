import React, { useState, useEffect, useMemo } from 'react';
import { UserRoutine, TrainingLog } from '../types';
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts';
import { downloadCSV, formatDateISO } from '../exportService';
import { 
  Dumbbell, Plus, Trash2, Search, Settings, 
  ChevronLeft, ChevronRight, Save, LayoutList, 
  LineChart as ChartIcon, Check
} from 'lucide-react';

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

  // DATA PROCESSING
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

  const toggleEditMode = () => {
      if (isEditMode) {
          setIsEditMode(false);
          setSelectedSessionIds(new Set());
          setShowBulkMenu(false);
          setSearchQuery('');
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

  const isGroupSelected = (itemsToCheck: StrengthItem[]) => {
      if (itemsToCheck.length === 0) return false;
      return itemsToCheck.every(item => selectedSessionIds.has(item.id));
  };

  const handleSmartSelect = (criteria: 'visible' | 'month' | 'program', value?: string) => {
      const newSet = new Set(selectedSessionIds);
      let targetItems: StrengthItem[] = [];

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
    const itemsToExport = selectedSessionIds.size > 0 
        ? timelineData.flatItems.filter(i => selectedSessionIds.has(i.id))
        : []; 

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
          <h1 className="text-3xl font-black tracking-tighter uppercase text-gray-900 leading-none">
            Studio <span className="text-gray-400">Muscu</span>
          </h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2 flex items-center gap-1">
             <Dumbbell size={10} /> Professional Suite
          </p>
        </div>
        <div className="bg-white p-1 rounded-xl flex gap-1 border border-gray-100 shadow-sm w-full sm:w-auto overflow-x-auto">
          <button onClick={() => setActiveTab('session')} className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all min-h-[44px] whitespace-nowrap ${activeTab === 'session' ? 'bg-black text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>
            <Dumbbell size={14} /> Session
          </button>
          <button onClick={() => setActiveTab('journal')} className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all min-h-[44px] whitespace-nowrap ${activeTab === 'journal' ? 'bg-black text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>
            <LayoutList size={14} /> Journal
          </button>
          <button onClick={() => setActiveTab('manage')} className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all min-h-[44px] whitespace-nowrap ${activeTab === 'manage' ? 'bg-black text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>
            <Settings size={14} /> Config
          </button>
        </div>
      </div>

      {/* SESSION & MANAGE TABS */}
      {activeTab === 'session' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {routines.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-20 px-6 bg-white rounded-[2rem] border border-gray-200 text-center space-y-6 shadow-sm">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center">
                    <Dumbbell className="w-8 h-8 text-gray-400" />
                </div>
                <div className="space-y-2">
                    <h3 className="text-lg font-bold text-gray-900">Aucun programme configuré</h3>
                    <p className="text-gray-400 text-sm max-w-xs mx-auto">Commencez par créer vos routines dans l'onglet configuration.</p>
                </div>
                <button onClick={() => setActiveTab('manage')} className="px-6 py-3 bg-black text-white rounded-xl font-bold text-xs uppercase tracking-wide flex items-center gap-2 hover:bg-gray-800 transition-colors">
                    <Settings size={14} /> Configurer maintenant
                </button>
             </div>
          ) : (
            <>
              {/* 1. SELECTION PROGRAMME */}
              <section className="space-y-4">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">1. Programme</h3>
                <div className="flex flex-wrap gap-3">
                  {routines.map((r, idx) => (
                    <button 
                        key={r.id} 
                        onClick={() => { setSelectedRoutine(r); setSelectedExercise(''); }} 
                        className={`relative p-4 pr-6 rounded-2xl border transition-all duration-200 flex items-center gap-3 w-full sm:w-auto text-left group
                        ${selectedRoutine?.id === r.id 
                            ? 'bg-black border-black text-white shadow-lg ring-2 ring-offset-2 ring-black/10' 
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                      <div className={`w-3 h-3 rounded-full shrink-0 ${selectedRoutine?.id === r.id ? 'bg-white' : ''}`} style={{ backgroundColor: selectedRoutine?.id === r.id ? undefined : r.color }} />
                      <div>
                        <span className="text-[10px] font-bold opacity-60 block uppercase tracking-wider mb-0.5">Routine #{idx + 1}</span>
                        <p className="text-sm font-black uppercase tracking-tight">{r.name}</p>
                      </div>
                      {selectedRoutine?.id === r.id && <Check className="ml-auto w-4 h-4 text-white" />}
                    </button>
                  ))}
                </div>
              </section>

              {/* 2. SÉLECTION EXERCICE */}
              {selectedRoutine && (
                <section className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">2. Exercice</h3>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                      <select value={selectedExercise} onChange={(e) => setSelectedExercise(e.target.value)} className={`w-full bg-white border rounded-2xl py-4 pl-4 pr-10 text-sm font-bold uppercase tracking-wide appearance-none outline-none focus:ring-2 focus:ring-black transition-all shadow-sm ${selectedExercise ? 'border-black text-black' : 'border-gray-200 text-gray-500'}`}>
                        <option value="">— Sélectionner —</option>
                        {selectedRoutine.exercises.map((ex, i) => <option key={i} value={ex}>{ex}</option>)}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                          <ChevronRight className="w-5 h-5 rotate-90" />
                      </div>
                    </div>
                    
                    <div className="bg-white border border-gray-200 rounded-2xl p-2 flex items-center justify-between shadow-sm min-w-[160px]">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-3">Ordre</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setOrder(Math.max(1, order - 1))} className="w-10 h-10 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors"><ChevronLeft size={16} /></button>
                        <span className="text-lg font-black w-6 text-center">{order}</span>
                        <button onClick={() => setOrder(order + 1)} className="w-10 h-10 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors"><ChevronRight size={16} /></button>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* 3. SAISIE DONNÉES */}
              {selectedExercise && (
                <section className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                  <div className="flex justify-between items-center px-1">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">3. Performance</h3>
                    <div className="flex bg-gray-100 p-1 rounded-lg gap-1">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} onClick={() => setNumSets(n)} className={`w-8 h-8 flex items-center justify-center rounded-md text-[10px] font-bold transition-all ${numSets === n ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>{n}</button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    {Array(numSets).fill(0).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-black text-gray-500 shrink-0">
                            {i + 1}
                        </div>
                        
                        <div className="flex-1 grid grid-cols-2 gap-3">
                            <div className="relative">
                                <label className="absolute -top-1.5 left-3 text-[8px] font-black bg-white px-1 text-gray-400 uppercase tracking-widest">Poids</label>
                                <div className="flex items-stretch">
                                    <button onClick={() => adjustValue(i, 'weight', -2.5)} className="w-10 bg-gray-50 rounded-l-xl border-r border-white hover:bg-gray-100 transition-colors flex items-center justify-center text-gray-500 font-bold">-</button>
                                    <input 
                                        type="number" 
                                        value={setsData[i].weight || ''} 
                                        onChange={(e) => handleInputChange(i, 'weight', e.target.value)} 
                                        className="w-full text-center bg-gray-50 py-3 text-lg font-black text-gray-900 outline-none focus:bg-white focus:ring-2 focus:ring-black/5 transition-all" 
                                        placeholder="0" 
                                    />
                                    <button onClick={() => adjustValue(i, 'weight', 2.5)} className="w-10 bg-gray-50 rounded-r-xl border-l border-white hover:bg-gray-100 transition-colors flex items-center justify-center text-gray-500 font-bold">+</button>
                                </div>
                            </div>
                            <div className="relative">
                                <label className="absolute -top-1.5 left-3 text-[8px] font-black bg-white px-1 text-gray-400 uppercase tracking-widest">Reps</label>
                                <div className="flex items-stretch">
                                    <button onClick={() => adjustValue(i, 'reps', -1)} className="w-10 bg-gray-50 rounded-l-xl border-r border-white hover:bg-gray-100 transition-colors flex items-center justify-center text-gray-500 font-bold">-</button>
                                    <input 
                                        type="number" 
                                        value={setsData[i].reps || ''} 
                                        onChange={(e) => handleInputChange(i, 'reps', e.target.value)} 
                                        className="w-full text-center bg-gray-50 py-3 text-lg font-black text-gray-900 outline-none focus:bg-white focus:ring-2 focus:ring-black/5 transition-all" 
                                        placeholder="0" 
                                    />
                                    <button onClick={() => adjustValue(i, 'reps', 1)} className="w-10 bg-gray-50 rounded-r-xl border-l border-white hover:bg-gray-100 transition-colors flex items-center justify-center text-gray-500 font-bold">+</button>
                                </div>
                            </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4">
                    <button onClick={handleSaveSession} disabled={!hasDataToSave} className={`w-full py-4 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all ${hasDataToSave ? 'bg-black text-white hover:bg-gray-900 active:scale-[0.98]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                        <Save size={16} /> Enregistrer la série
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {/* JOURNAL TAB */}
      {activeTab === 'journal' && (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 min-h-[60vh] pb-32">
            
            {/* POWER BAR */}
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
                             <button 
                                onClick={() => setShowBulkMenu(!showBulkMenu)}
                                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${showBulkMenu ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                            >
                                <Settings size={18} />
                            </button>
                            {showBulkMenu && (
                                <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-50 text-black">
                                    <button onClick={() => handleSmartSelect('visible')} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 rounded-lg text-xs font-bold text-gray-800">
                                        <span>Tout sélectionner</span>
                                    </button>
                                </div>
                            )}
                            <button 
                                onClick={handleExport}
                                disabled={selectedSessionIds.size === 0}
                                className={`h-9 px-4 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all ${selectedSessionIds.size > 0 ? 'bg-white text-black' : 'bg-white/10 text-white/30'}`}
                            >
                                Export
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex-1 max-w-sm relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                <Search size={16} />
                            </div>
                            <form onSubmit={handleSearchSubmit}>
                                <input 
                                    type="text" 
                                    placeholder="Rechercher..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-gray-50 pl-10 pr-8 py-2.5 rounded-xl text-xs font-bold placeholder-gray-400 outline-none focus:ring-1 focus:ring-black/10 border border-transparent transition-all"
                                />
                            </form>
                        </div>
                        <button 
                            onClick={toggleEditMode}
                            className="ml-2 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-white border border-gray-200 hover:bg-gray-50 transition-all text-gray-600"
                        >
                            Select
                        </button>
                    </>
                )}
            </div>

            {/* ANALYTICS VIEW */}
            {analyzedExercise && analyticsData && !isEditMode && (
                <div className="space-y-6 animate-in slide-in-from-bottom-8">
                    <div className="bg-black text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
                         <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                         <div className="relative z-10">
                            <h2 className="text-xl font-black uppercase tracking-tight mb-1 flex items-center gap-2">
                                <ChartIcon size={20} /> {analyzedExercise}
                            </h2>
                            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-6">Analyse de progression</p>
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
                                            contentStyle={{ backgroundColor: '#111', border: 'none', borderRadius: '8px' }}
                                            itemStyle={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                                            labelStyle={{ display: 'none' }}
                                        />
                                        <Area type="monotone" dataKey="weight" stroke="#fff" strokeWidth={2} fillOpacity={1} fill="url(#colorWeight)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                         </div>
                    </div>
                    {/* History List */}
                    <div className="space-y-3">
                        {analyticsData.historyList.map((item, idx) => (
                            <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">{new Date(item.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-mono font-bold text-gray-900">{item.maxWeight}kg</span>
                                        {item.trend === 'up' && <span className="text-green-600 bg-green-50 px-1.5 py-0.5 rounded text-[10px] font-bold">↑</span>}
                                        {item.trend === 'down' && <span className="text-red-500 bg-red-50 px-1.5 py-0.5 rounded text-[10px] font-bold">↓</span>}
                                    </div>
                                </div>
                                <div className="text-right">
                                    {item.logs.map((log, lIdx) => (
                                        <div key={lIdx} className="text-[11px] font-mono text-gray-500">
                                            {log.reps} <span className="text-[9px] text-gray-300">reps</span> @ {log.weight}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TIMELINE VIEW */}
            {(!analyzedExercise || isEditMode) && (
                <div className="space-y-8">
                    {Object.entries(timelineData.grouped).map(([month, items]: [string, StrengthItem[]]) => (
                        <div key={month} className="space-y-3">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest sticky top-[70px] bg-[#FBFBFB] py-2 z-10 pl-2">
                                {month}
                            </h3>
                            {items.map((item) => {
                                const isSelected = selectedSessionIds.has(item.id);
                                return (
                                <div key={item.id} className="relative group select-none">
                                    <div 
                                        onClick={() => handleCardClick(item.id)}
                                        className={`
                                            bg-white rounded-2xl border shadow-sm overflow-hidden transition-all duration-200 active:scale-[0.99] flex
                                            ${isSelected && isEditMode ? 'border-blue-500 bg-blue-50/20' : 'border-gray-100'}
                                        `}
                                    >
                                        <div className={`flex items-center justify-center transition-all duration-300 overflow-hidden ${isEditMode ? 'w-12 opacity-100 pl-2' : 'w-0 opacity-0'}`}>
                                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}>
                                                {isSelected && <Check size={12} className="text-white" />}
                                            </div>
                                        </div>

                                        <div className="flex-1 p-4 grid gap-4 items-center" style={{ gridTemplateColumns: 'auto 1fr auto' }}>   
                                            <div 
                                                className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black text-white uppercase shrink-0"
                                                style={{ backgroundColor: item.color }}
                                            >
                                                {item.sessionName.substring(0, 2)}
                                            </div>

                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">
                                                        {new Date(item.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}
                                                    </span>
                                                </div>
                                                <h4 className="text-sm font-bold uppercase tracking-tight text-gray-900 truncate">
                                                    {item.sessionName}
                                                </h4>
                                                
                                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                    {item.logs.reduce((acc: string[], curr) => {
                                                        if (!acc.includes(curr.exercise)) acc.push(curr.exercise);
                                                        return acc;
                                                    }, []).slice(0, 2).map((ex, i) => (
                                                        <span key={i} className="text-[9px] font-medium text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded truncate max-w-[120px]">{ex}</span>
                                                    ))}
                                                    {item.exercisesCount > 2 && <span className="text-[9px] font-bold text-gray-300">+{item.exercisesCount - 2}</span>}
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <p className="text-[8px] font-bold text-gray-300 uppercase tracking-widest">Total</p>
                                                <p className="text-xs font-mono font-bold text-gray-900">{(item.tonnage / 1000).toFixed(1)}t</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {expandedSessionId === item.id && !isEditMode && (
                                        <div className="bg-gray-50 border-x border-b border-gray-100 p-4 space-y-3 animate-in fade-in rounded-b-2xl -mt-2 pt-6 mx-1 mb-4" onClick={(e) => e.stopPropagation()}>
                                            {Object.entries(item.logs.reduce<Record<string, TrainingLog[]>>((acc, log) => {
                                                if(!acc[log.exercise]) acc[log.exercise] = [];
                                                acc[log.exercise].push(log);
                                                return acc;
                                            }, {})).map(([exerciseName, sets], idx) => {
                                                const exerciseTonnage = sets.reduce((acc, s) => acc + s.tonnage, 0);
                                                return (
                                                <div key={idx} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-2">
                                                    <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                                                        <h5 className="text-xs font-bold uppercase tracking-tight text-gray-800">{exerciseName}</h5>
                                                        <span className="text-[9px] font-bold text-gray-400">{(exerciseTonnage).toFixed(0)} kg</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {sets.sort((a,b) => a.setNum - b.setNum).map((set, sIdx) => (
                                                            <div key={sIdx} className="bg-gray-50 px-2 py-1 rounded text-center min-w-[40px]">
                                                                <div className="text-xs font-mono font-bold text-gray-900">{set.weight}</div>
                                                                <div className="text-[8px] font-mono text-gray-400">x{set.reps}</div>
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
                                                    className="flex items-center gap-2 text-[10px] font-bold text-red-500 hover:text-red-700 uppercase tracking-widest px-3 py-2 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={12} /> Supprimer séance
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )})}
                        </div>
                    ))}
                    {Object.keys(timelineData.grouped).length === 0 && (
                        <div className="text-center py-20 opacity-50 flex flex-col items-center gap-3">
                            <Dumbbell className="text-gray-300 w-12 h-12" />
                            <p className="text-gray-400 font-bold text-sm">Aucune séance trouvée.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
      )}

      {/* MANAGE TAB */}
      {activeTab === 'manage' && (
        <div className="space-y-6 animate-in fade-in duration-300 min-h-[50vh] pb-32">
           {routines.length === 0 && (
             <div className="flex flex-col items-center justify-center text-center p-8 space-y-4 bg-white rounded-2xl border border-dashed border-gray-200">
                <Settings className="w-12 h-12 text-gray-300" />
                <p className="text-gray-500 font-bold text-sm">Votre architecture est vide.</p>
             </div>
           )}
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <button onClick={() => setIsCreating(true)} className="border border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-black hover:border-black transition-all p-6 h-[100px] bg-gray-50/50">
                <Plus size={24} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Nouveau Programme</span>
             </button>
             {routines.map(r => (
               <button key={r.id} onClick={() => setEditingRoutineId(r.id)} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all text-left flex flex-col justify-between h-[100px] relative overflow-hidden group">
                 <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: r.color }} />
                 <div className="pl-2">
                     <h4 className="text-base font-black uppercase tracking-tight text-gray-900 truncate w-full mb-1">{r.name}</h4>
                     <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{r.exercises.length} Mouvements</p>
                 </div>
                 <ChevronRight className="absolute bottom-4 right-4 text-gray-300 group-hover:text-black transition-colors" size={16} />
               </button>
             ))}
           </div>
        </div>
      )}

      {/* MODAL CREATION */}
      {isCreating && (
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 sm:p-0" onClick={() => setIsCreating(false)}>
              <div onClick={e => e.stopPropagation()} className="w-full sm:max-w-md bg-white rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
                  <h3 className="text-lg font-black uppercase tracking-tight mb-6 text-center">Nouveau Programme</h3>
                  <div className="space-y-6">
                      <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Nom</label>
                          <input type="text" placeholder="Ex: PUSH A" value={newRoutineName} onChange={e => setNewRoutineName(e.target.value)} autoFocus className="w-full p-4 bg-gray-50 rounded-xl text-base font-bold outline-none border border-gray-200 focus:border-black focus:ring-1 focus:ring-black transition-all" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Couleur</label>
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                            {COLORS.map(c => (
                            <button key={c.hex} onClick={() => setNewRoutineColor(c.hex)} className={`w-10 h-10 rounded-full border-[3px] flex-shrink-0 transition-transform ${newRoutineColor === c.hex ? 'border-black scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`} style={{ backgroundColor: c.hex }} />
                            ))}
                        </div>
                      </div>
                      <div className="flex gap-3 pt-2">
                          <button onClick={() => setIsCreating(false)} className="flex-1 py-3 text-xs font-bold uppercase tracking-widest text-gray-500 bg-gray-100 rounded-xl">Annuler</button>
                          <button onClick={handleCreateRoutine} disabled={!newRoutineName.trim()} className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest shadow-md transition-all ${newRoutineName.trim() ? 'bg-black text-white' : 'bg-gray-200 text-gray-400'}`}>Créer</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL EDITION */}
      {editingRoutineId && (
         <div className="fixed inset-0 z-[100] bg-white flex flex-col" onClick={() => setEditingRoutineId(null)}>
              {/* Header Modal */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white z-10 safe-top">
                  <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Édition</p>
                      <h2 className="text-xl font-black uppercase tracking-tighter truncate">{routines.find(r => r.id === editingRoutineId)?.name}</h2>
                  </div>
                  <button onClick={() => setEditingRoutineId(null)} className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
                      <Check size={20} />
                  </button>
              </div>

              {/* Content */}
              <div onClick={e => e.stopPropagation()} className="flex-1 overflow-y-auto p-6 space-y-6 pb-32">
                  <div className="relative">
                      <input type="text" placeholder="Ajouter un exercice..." value={quickExInput} onChange={(e) => setQuickExInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && quickExInput.trim()) { onUpdateRoutines(prev => prev.map(r => r.id === editingRoutineId ? { ...r, exercises: [...r.exercises, quickExInput.trim()] } : r)); setQuickExInput(''); }}} className="w-full pl-4 pr-12 py-4 bg-gray-50 rounded-xl text-sm font-bold uppercase outline-none focus:ring-2 focus:ring-black/10 border border-transparent focus:bg-white transition-all" autoFocus />
                      <button onClick={() => { if (quickExInput.trim()) { onUpdateRoutines(prev => prev.map(r => r.id === editingRoutineId ? { ...r, exercises: [...r.exercises, quickExInput.trim()] } : r)); setQuickExInput(''); }}} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black text-white rounded-lg flex items-center justify-center transition-transform active:scale-90">
                          <Plus size={16} />
                      </button>
                  </div>

                  <div className="space-y-2">
                      {routines.find(r => r.id === editingRoutineId)?.exercises.length === 0 && (
                          <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
                              <p className="text-xs font-bold text-gray-400">Aucun exercice.</p>
                          </div>
                      )}
                      {routines.find(r => r.id === editingRoutineId)?.exercises.map((ex, i) => (
                          <div key={i} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                  <span className="text-[10px] font-bold text-gray-300 w-6">#{i + 1}</span>
                                  <span className="text-sm font-bold uppercase text-gray-900">{ex}</span>
                              </div>
                              <button type="button" onClick={() => onUpdateRoutines(prev => prev.map(r => r.id === editingRoutineId ? { ...r, exercises: r.exercises.filter((_, idx) => idx !== i) } : r))} className="text-gray-300 hover:text-red-500 transition-colors p-2">
                                  <Trash2 size={16} />
                              </button>
                          </div>
                      ))}
                  </div>

                  <div className="pt-8 text-center">
                      <button onClick={() => handleDeleteRoutineClick(editingRoutineId!)} className={`text-xs font-bold transition-all px-4 py-2 rounded-lg ${confirmDelete ? 'text-red-600 bg-red-50' : 'text-gray-400 hover:text-red-500'}`}>
                          {confirmDelete ? 'Confirmer la suppression' : 'Supprimer ce programme'}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default AtelierMuscu;