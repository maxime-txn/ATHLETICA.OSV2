import React, { useState, useMemo, useEffect } from 'react';
import { NutritionLog, SleepLog, NutrientConfig, NutritionEntry } from '../types';

interface NutritionViewProps {
  onUpdateHealth: (sleep?: SleepLog, nutrientEntry?: NutritionEntry, isReset?: boolean) => void;
  onUndoNutrition: () => void;
  onDeleteLog: (date: string) => void;
  currentNutrition?: NutritionLog;
  nutritionHistory: NutritionLog[];
  nutrients: NutrientConfig[];
  onUpdateNutrients: React.Dispatch<React.SetStateAction<NutrientConfig[]>>;
}

const COLORS = ['orange', 'green', 'yellow', 'blue', 'purple', 'cyan', 'red'] as const;
const PREDEFINED_UNITS = ['g', 'kcal', 'ml', 'L', 'mg', 'µg', 'IU', '%', 'h'];

const NutritionView: React.FC<NutritionViewProps> = ({ 
  onUpdateHealth, 
  onUndoNutrition,
  onDeleteLog,
  currentNutrition,
  nutritionHistory,
  nutrients,
  onUpdateNutrients
}) => {
  const [activeTab, setActiveTab] = useState<'bio-data' | 'journal' | 'settings'>('bio-data');
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  
  // -- STATES POUR LE JOURNAL PRO --
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());
  const [isColumnConfigOpen, setIsColumnConfigOpen] = useState(false);

  // -- EXPLICIT EDIT MODE STATES --
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [showBulkMenu, setShowBulkMenu] = useState(false);

  // -- STATES POUR CONFIG & DATA ENTRY --
  const [newNutrient, setNewNutrient] = useState({ name: '', unit: 'g', goal: '0', color: 'blue' as any, emoji: '🧬' });

  // Init visible columns with all nutrients on load (if not set)
  useEffect(() => {
    if (nutrients.length > 0 && visibleColumns.size === 0) {
      setVisibleColumns(new Set(nutrients.map(n => n.id)));
    }
  }, [nutrients]);

  const handleAddValue = (nId: string) => {
    const val = parseFloat(inputValues[nId]);
    if (!isNaN(val)) {
      onUpdateHealth(undefined, { nutrientId: nId, value: val });
      setInputValues(prev => ({ ...prev, [nId]: '' }));
    }
  };

  const handleAddNutrient = () => {
    if (!newNutrient.name.trim()) return;
    const id = Date.now().toString();
    const nutrientToAdd: NutrientConfig = { 
      id, 
      name: newNutrient.name, 
      unit: newNutrient.unit, 
      goal: parseFloat(newNutrient.goal) || 0,
      color: newNutrient.color,
      emoji: newNutrient.emoji || '🧬'
    };
    
    onUpdateNutrients(prev => [...prev, nutrientToAdd]);
    // Auto-show new nutrient column
    setVisibleColumns(prev => new Set(prev).add(id));
    setNewNutrient({ name: '', unit: 'g', goal: '0', color: 'blue', emoji: '🧬' });
  };

  const removeNutrient = (id: string) => {
    onUpdateNutrients(prev => prev.filter(n => n.id !== id));
    setVisibleColumns(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
    });
  };

  const activeNutrientsList = useMemo(() => {
      return nutrients.filter(n => visibleColumns.has(n.id));
  }, [nutrients, visibleColumns]);

  // -- SMART JOURNAL LOGIC --

  const activeHistory = useMemo(() => {
    if (visibleColumns.size === 0) return [];

    return [...nutritionHistory]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .filter(log => {
         return activeNutrientsList.some(n => (log.totals[n.id] || 0) > 0);
      });
  }, [nutritionHistory, activeNutrientsList, visibleColumns]);

  // --- SELECTION LOGIC ---

  const toggleEditMode = () => {
      if (isEditMode) {
          setIsEditMode(false);
          setSelectedDates(new Set());
          setShowBulkMenu(false);
      } else {
          setIsEditMode(true);
      }
  };

  const toggleDateSelection = (date: string) => {
    if (!isEditMode) return;
    const newSet = new Set(selectedDates);
    if (newSet.has(date)) newSet.delete(date);
    else newSet.add(date);
    setSelectedDates(newSet);
  };

  // --- SMART TOGGLE FILTERS ---

  // Helper
  const isGroupSelected = (logsToCheck: NutritionLog[]) => {
      if (logsToCheck.length === 0) return false;
      return logsToCheck.every(log => selectedDates.has(log.date));
  };

  const handleSmartSelect = (criteria: 'all' | 'month', value?: string) => {
      const newSet = new Set(selectedDates);
      let targetLogs: NutritionLog[] = [];
      
      if (criteria === 'all') {
          targetLogs = activeHistory;
      } else if (criteria === 'month') {
          targetLogs = activeHistory.filter(log => {
              const logMonth = new Date(log.date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase();
              return logMonth === value;
          });
      }

      if (targetLogs.length === 0) return;

      const allSelected = targetLogs.every(log => newSet.has(log.date));

      if (allSelected) {
          targetLogs.forEach(log => newSet.delete(log.date));
      } else {
          targetLogs.forEach(log => newSet.add(log.date));
      }

      setSelectedDates(newSet);
      setShowBulkMenu(false);
  };

  const toggleColumnVisibility = (id: string) => {
    const newSet = new Set(visibleColumns);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setVisibleColumns(newSet);
  };

  const handleExportCSV = () => {
    if (selectedDates.size === 0) return;

    // 1. Headers
    const headers = ['Date', ...activeNutrientsList.map(n => `${n.name} (${n.unit})`)];
    
    // 2. Rows
    const rows = activeHistory
        .filter(log => selectedDates.has(log.date))
        .map(log => {
            const values = activeNutrientsList.map(n => log.totals[n.id] || 0);
            return [log.date, ...values].join(',');
        });

    // 3. Construct CSV
    const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(','), ...rows].join('\n');

    // 4. Download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `athletica_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setIsEditMode(false);
    setSelectedDates(new Set());
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight uppercase">Bio-Data & Vitalité</h2>
          <p className="text-gray-400 font-medium italic">Optimisation des apports nutritionnels</p>
        </div>
        <div className="bg-gray-100 p-1 rounded-xl flex gap-1 shadow-inner overflow-x-auto max-w-full w-full sm:w-auto">
          <button onClick={() => setActiveTab('bio-data')} className={`flex-1 sm:flex-none px-4 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all min-h-[44px] whitespace-nowrap ${activeTab === 'bio-data' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Apports</button>
          <button onClick={() => setActiveTab('journal')} className={`flex-1 sm:flex-none px-4 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all min-h-[44px] whitespace-nowrap ${activeTab === 'journal' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Journal</button>
          <button onClick={() => setActiveTab('settings')} className={`flex-1 sm:flex-none px-4 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all min-h-[44px] whitespace-nowrap ${activeTab === 'settings' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Config</button>
        </div>
      </header>

      {/* --- TAB: APPORTS (DATA ENTRY) --- */}
      {activeTab === 'bio-data' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
          {nutrients.length === 0 ? (
            <div className="text-center py-24 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
              <span className="text-4xl mb-4 block">🧬</span>
              <p className="text-gray-400 font-bold italic max-w-xs mx-auto text-sm">Aucun tracker actif. Configurez vos métriques bio-chimiques dans l'onglet Config.</p>
              <button onClick={() => setActiveTab('settings')} className="mt-6 text-[10px] font-black text-blue-500 uppercase tracking-widest p-4">Configurer</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {nutrients.map(n => (
                <div key={n.id} className="bg-white p-6 rounded-[2.2rem] border border-gray-100 shadow-sm space-y-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{n.name}</span>
                    <span className="text-xl">{n.emoji}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-4xl font-black ${n.color === 'orange' ? 'text-orange-500' : n.color === 'green' ? 'text-green-500' : n.color === 'yellow' ? 'text-yellow-500' : n.color === 'blue' ? 'text-blue-500' : n.color === 'purple' ? 'text-purple-500' : n.color === 'cyan' ? 'text-cyan-500' : 'text-red-500'}`}>{Math.round(currentNutrition?.totals[n.id] || 0)}</span>
                    <span className="text-[10px] font-bold text-gray-300 uppercase">/ Cible {n.goal}{n.unit}</span>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="number" placeholder="Quantité" 
                      value={inputValues[n.id] || ''} 
                      onChange={(e) => setInputValues(p => ({ ...p, [n.id]: e.target.value }))}
                      className="flex-1 p-4 bg-gray-50 rounded-2xl outline-none font-black text-center text-lg focus:ring-2 focus:ring-gray-200 transition-all min-h-[56px]" 
                    />
                    <button onClick={() => handleAddValue(n.id)} className="bg-black text-white w-16 rounded-2xl font-black text-2xl active:scale-90 transition-transform min-h-[56px] shadow-lg">+</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {nutrients.length > 0 && (
            <div className="text-center pt-4">
              <button onClick={onUndoNutrition} className="text-[10px] font-black text-gray-300 hover:text-gray-500 uppercase tracking-widest px-6 py-4 rounded-full bg-gray-50 border border-gray-100 transition-colors">↩ Annuler la dernière saisie</button>
            </div>
          )}
        </div>
      )}

      {/* --- TAB: JOURNAL PRO (DATA GRID) --- */}
      {activeTab === 'journal' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
           
           <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                
                {/* CONTEXTUAL TOP BAR (STICKY) */}
                <div className={`p-4 border-b border-gray-100 flex items-center justify-between gap-4 sticky top-0 z-10 transition-all duration-300 min-h-[72px] ${isEditMode ? 'bg-gray-900 text-white' : 'bg-white/90 backdrop-blur-md'}`}>
                    
                    {isEditMode ? (
                        // MODE EDIT (POWER BAR)
                        <>
                            <div className="flex items-center gap-3 shrink-0">
                                <button onClick={toggleEditMode} className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                                <span className="text-xs font-black uppercase tracking-widest bg-white/10 px-3 py-1.5 rounded-lg">{selectedDates.size}</span>
                            </div>

                            {/* No Search here for Nutrition usually, but can be added if needed. For now, kept simple as per original layout but darker. */}
                            <div className="flex-1" />

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
                                            <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest px-3 py-2">Par Période</p>
                                            
                                            {/* Tout */}
                                            <button onClick={() => handleSmartSelect('all')} className="w-full flex items-center justify-between px-3 py-3 hover:bg-gray-50 rounded-xl text-xs font-bold text-gray-800">
                                                <span>Tout l'historique</span>
                                                {isGroupSelected(activeHistory) ? <span className="text-green-500">✓</span> : <span className="w-4 h-4 border rounded-sm border-gray-300"/>}
                                            </button>

                                            <div className="h-px bg-gray-100 my-1" />

                                            {/* Mois en cours */}
                                            <button onClick={() => handleSmartSelect('month', new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase())} className="w-full flex items-center justify-between px-3 py-3 hover:bg-gray-50 rounded-xl text-xs font-bold text-gray-800">
                                                <span>Ce mois-ci</span>
                                                {isGroupSelected(activeHistory.filter(l => new Date(l.date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase() === new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase())) 
                                                    ? <span className="text-green-500">✓</span> : <span className="w-4 h-4 border rounded-sm border-gray-300"/>}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <button 
                                    onClick={handleExportCSV}
                                    disabled={selectedDates.size === 0}
                                    className={`h-10 px-4 rounded-full font-black text-[10px] uppercase tracking-widest transition-all ${selectedDates.size > 0 ? 'bg-white text-black hover:bg-gray-100' : 'bg-white/10 text-white/30 cursor-not-allowed'}`}
                                >
                                    EXP.
                                </button>
                            </div>
                        </>
                    ) : (
                        // MODE LECTURE (CONFIG & SELECT)
                        <>
                            <p className="text-sm font-black text-gray-900 ml-2">Journal Historique</p>
                            
                            <div className="flex items-center gap-2">
                                {/* Column Config (Only in Read Mode) */}
                                <div className="relative">
                                    <button 
                                        onClick={() => setIsColumnConfigOpen(!isColumnConfigOpen)}
                                        className={`flex items-center gap-2 px-4 py-3 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all border ${isColumnConfigOpen ? 'bg-gray-200 border-gray-300 text-black' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                                    >
                                        <span>⚙️</span>
                                    </button>
                                    {isColumnConfigOpen && (
                                        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-20 animate-in zoom-in-95 duration-200">
                                            <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-3">Indicateurs Visibles</p>
                                            <div className="space-y-1 max-h-60 overflow-y-auto">
                                                {nutrients.map(n => {
                                                    const isSelected = visibleColumns.has(n.id);
                                                    return (
                                                    <label key={n.id} className={`flex items-center justify-between cursor-pointer p-3 rounded-xl transition-all ${isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
                                                        <div className="flex items-center gap-3">
                                                            <span className={`flex items-center justify-center w-5 h-5 rounded-full border transition-all ${isSelected ? 'bg-black border-black text-white' : 'border-gray-200 bg-white'}`}>
                                                                {isSelected && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                                                            </span>
                                                            <span className={`text-xs ${isSelected ? 'font-black text-black' : 'font-medium text-gray-400'}`}>{n.emoji} {n.name}</span>
                                                        </div>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={isSelected} 
                                                            onChange={() => toggleColumnVisibility(n.id)}
                                                            className="hidden"
                                                        />
                                                    </label>
                                                )})}
                                                {nutrients.length === 0 && <p className="text-xs text-gray-400 italic">Aucun marqueur configuré.</p>}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button 
                                    onClick={toggleEditMode}
                                    className="px-5 py-3 rounded-[2rem] text-[10px] font-black uppercase tracking-widest bg-white border border-gray-200 hover:bg-gray-50 transition-all shadow-sm"
                                >
                                    SÉLECTIONNER
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* CONTENT AREA (Conditional Rendering) */}
                
                {/* CAS 1 : Aucune colonne sélectionnée (Zero State Config) */}
                {visibleColumns.size === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-60">
                        <span className="text-4xl mb-4 grayscale">⚙️</span>
                        <p className="text-sm font-black text-gray-900 mb-1">Affichage masqué</p>
                        <p className="text-xs text-gray-500 max-w-xs">Aucune colonne n'est sélectionnée. Utilisez le bouton paramètres en haut à droite pour choisir vos indicateurs.</p>
                    </div>
                ) : 
                /* CAS 2 : Colonnes actives mais aucune donnée (Zero State Data) */
                activeHistory.length === 0 ? (
                   <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-50">
                      <span className="text-4xl mb-4">📓</span>
                      <p className="text-gray-300 font-black text-[10px] uppercase italic">Aucune donnée active</p>
                      <p className="text-gray-400 text-xs mt-2 max-w-xs">Le journal n'affiche que les jours contenant des valeurs pour les colonnes sélectionnées.</p>
                   </div>
                ) : (
                /* CAS 3 : Data Grid */
                <div className="overflow-x-auto flex-1">
                    <div className="min-w-full inline-block align-middle">
                        <div className="border-b border-gray-100 bg-white grid gap-4 items-center px-6 py-3 transition-all" 
                             style={{ gridTemplateColumns: `${isEditMode ? '40px' : '0px'} 140px repeat(${activeNutrientsList.length}, minmax(100px, 1fr)) 40px` }}>
                            
                            {/* Headers */}
                            <div className={`font-bold text-gray-300 text-center overflow-hidden transition-all duration-300 ${isEditMode ? 'w-full opacity-100' : 'w-0 opacity-0'}`}>✓</div>
                            <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Date</div>
                            {activeNutrientsList.map(n => (
                                <div key={n.id} className="text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">
                                    {n.name} <span className="text-[8px] opacity-50">({n.unit})</span>
                                </div>
                            ))}
                            <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Del</div>
                        </div>

                        <div className="divide-y divide-gray-50">
                            {activeHistory.map((log) => (
                                <div 
                                    key={log.date} 
                                    onClick={() => toggleDateSelection(log.date)}
                                    className={`
                                        grid gap-4 items-center px-6 py-4 transition-all duration-200 group 
                                        ${isEditMode ? 'cursor-pointer active:scale-[0.99]' : ''}
                                        ${selectedDates.has(log.date) && isEditMode
                                            ? 'bg-blue-50 border-y-2 border-blue-500 -my-[1px] relative z-10' 
                                            : 'hover:bg-gray-50'
                                        }
                                    `}
                                    style={{ gridTemplateColumns: `${isEditMode ? '40px' : '0px'} 140px repeat(${activeNutrientsList.length}, minmax(100px, 1fr)) 40px` }}
                                >
                                    {/* Checkbox (Visual Indicator) - SLIDE IN */}
                                    <div className={`flex justify-center overflow-hidden transition-all duration-300 ${isEditMode ? 'w-full opacity-100' : 'w-0 opacity-0'}`}>
                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors pointer-events-none ${selectedDates.has(log.date) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                                            {selectedDates.has(log.date) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                        </div>
                                    </div>

                                    {/* Date */}
                                    <div>
                                        <p className="text-xs font-black uppercase text-gray-900">
                                            {new Date(log.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                                        </p>
                                        <p className="text-[9px] text-gray-400 font-medium">
                                            {new Date(log.date).getFullYear()}
                                        </p>
                                    </div>

                                    {/* Dynamic Columns */}
                                    {activeNutrientsList.map(n => {
                                        const val = log.totals[n.id] || 0;
                                        return (
                                            <div key={n.id} className="text-center">
                                                <span className={`text-sm font-bold ${val === 0 ? 'text-gray-200' : 'text-gray-800'}`}>
                                                    {val > 0 ? Math.round(val) : '-'}
                                                </span>
                                            </div>
                                        );
                                    })}

                                    {/* Actions (Hidden in Edit Mode if needed, or simply disabled) */}
                                    <div className="text-right">
                                        {!isEditMode && (
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation(); 
                                                    onDeleteLog(log.date);
                                                }} 
                                                className="p-2 text-gray-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                title="Supprimer cette entrée"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                )}
             </div>
        </div>
      )}

      {/* --- TAB: SETTINGS (CONFIG) --- */}
      {activeTab === 'settings' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">
           <section className="bg-white p-8 rounded-[2.2rem] border border-gray-100 shadow-sm space-y-6">
            <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Nouveau Marqueur Bio-Data</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Label</label>
                <input type="text" placeholder="ex: Protéines" value={newNutrient.name} onChange={e => setNewNutrient(p => ({...p, name: e.target.value}))} className="w-full p-4 bg-gray-50 rounded-xl font-bold outline-none focus:ring-1 focus:ring-black text-base" />
              </div>
              
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Unité de mesure</label>
                {/* UNIT CAROUSEL */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {PREDEFINED_UNITS.map(unit => (
                        <button 
                            key={unit}
                            onClick={() => setNewNutrient(p => ({...p, unit: unit}))}
                            className={`px-4 py-3 rounded-xl text-sm font-black transition-all whitespace-nowrap ${newNutrient.unit === unit ? 'bg-black text-white shadow-md scale-105' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                        >
                            {unit}
                        </button>
                    ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Objectif Quotidien</label>
                <input type="number" placeholder="0" value={newNutrient.goal} onChange={e => setNewNutrient(p => ({...p, goal: e.target.value}))} className="w-full p-4 bg-gray-50 rounded-xl font-bold outline-none focus:ring-1 focus:ring-black text-base" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Symbole</label>
                <input type="text" placeholder="🧬" value={newNutrient.emoji} onChange={e => setNewNutrient(p => ({...p, emoji: e.target.value}))} className="w-full p-4 bg-gray-50 rounded-xl font-bold outline-none focus:ring-1 focus:ring-black text-base" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Signature Visuelle</label>
              <div className="flex gap-3 p-2 overflow-x-auto">
                {COLORS.map(c => (
                  <button 
                    key={c} 
                    type="button"
                    onClick={() => setNewNutrient(p => ({...p, color: c}))} 
                    className={`h-10 w-10 flex-shrink-0 rounded-full border-4 transition-all ${newNutrient.color === c ? 'border-gray-200 scale-110 shadow-sm' : 'border-transparent opacity-60 hover:opacity-100'} ${c === 'orange' ? 'bg-orange-500' : c === 'green' ? 'bg-green-500' : c === 'yellow' ? 'bg-yellow-500' : c === 'blue' ? 'bg-blue-500' : c === 'purple' ? 'bg-purple-500' : c === 'cyan' ? 'bg-cyan-500' : 'bg-red-500'}`} 
                  />
                ))}
              </div>
            </div>
            <button onClick={handleAddNutrient} className="w-full p-5 bg-black text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-lg hover:shadow-xl transition-all active:scale-[0.98] min-h-[64px]">INTÉGRER AU SYSTÈME</button>
          </section>

          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-widest ml-4">Architecture des Marqueurs</h3>
            {nutrients.map(n => (
              <div key={n.id} className="flex items-center justify-between p-6 bg-white rounded-[2rem] border border-gray-100 shadow-sm">
                <div className="flex items-center gap-5">
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-xl shadow-inner ${n.color === 'orange' ? 'bg-orange-50' : n.color === 'green' ? 'bg-green-50' : n.color === 'yellow' ? 'bg-yellow-50' : n.color === 'blue' ? 'bg-blue-50' : n.color === 'purple' ? 'bg-purple-50' : n.color === 'cyan' ? 'bg-cyan-50' : 'bg-red-50'}`}>
                    {n.emoji}
                  </div>
                  <div>
                    <h4 className="font-black text-gray-900 uppercase text-xs tracking-tight">{n.name}</h4>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Vecteur cible : {n.goal} {n.unit}</p>
                  </div>
                </div>
                <button 
                  onClick={() => removeNutrient(n.id)} 
                  className="px-6 py-3 text-red-400 hover:text-red-600 text-[10px] font-black uppercase tracking-widest transition-all rounded-2xl min-h-[44px]"
                >
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NutritionView;