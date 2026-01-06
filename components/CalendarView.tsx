import React, { useState, useMemo } from 'react';
import { ActivitySession, TrainingLog, UserRoutine, CardioType } from '../types';

interface CalendarViewProps {
  activitySessions: ActivitySession[];
  trainingLogs: TrainingLog[];
  routines: UserRoutine[];
  cardioTypes: CardioType[];
}

const CalendarView: React.FC<CalendarViewProps> = ({ activitySessions, trainingLogs, routines, cardioTypes }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Normalisation des dates
  const normalizeDate = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('/')) {
      const [d, m, y] = dateStr.split('/');
      const year = y.length === 2 ? `20${y}` : y;
      return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return dateStr.split('T')[0];
  };

  // --- CALENDAR LOGIC ---
  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Dimanche
    const offset = firstDayIndex === 0 ? 6 : firstDayIndex - 1; // Lundi start
    
    const days = [];
    for (let i = 0; i < offset; i++) days.push(null);
    for (let i = 1; i <= totalDays; i++) days.push(i);
    return days;
  }, [currentDate]);

  // --- DATA HELPERS ---
  const getDayData = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    
    // Muscu Data (Avec Nom pour le badge)
    const training = trainingLogs.filter(t => normalizeDate(t.date) === dateStr);
    const uniqueSessions = Array.from(new Set(training.map(t => t.session))).map(name => {
        const routine = routines.find(r => r.name === name);
        return { 
            type: 'muscu', 
            name: name, // Nom complet pour le traitement texte
            color: routine?.color || '#000' 
        };
    });

    // Cardio Data (Avec Nom pour le badge)
    const endurance = activitySessions.filter(s => normalizeDate(s.date) === dateStr).map(s => {
        const cType = cardioTypes.find(c => c.name === s.type);
        return { 
            type: 'cardio', 
            name: s.type, // Nom complet
            color: cType?.color || '#EF4444' 
        };
    });
    
    return { dateStr, items: [...uniqueSessions, ...endurance] };
  };

  const getDayDetails = (dateStr: string) => {
     const endurance = activitySessions.filter(s => normalizeDate(s.date) === dateStr);
     const training = trainingLogs.filter(t => normalizeDate(t.date) === dateStr);
     
     const details: any[] = [];
     
     // Group Muscu
     const uniqueSessionNames = Array.from(new Set(training.map(t => t.session)));
     uniqueSessionNames.forEach(name => {
         const sessionLogs = training.filter(t => t.session === name);
         const routine = routines.find(r => r.name === name);
         const exercises = Array.from(new Set(sessionLogs.map(l => l.exercise)));
         details.push({
             type: 'muscu',
             name: name,
             color: routine?.color || '#000000',
             exercises: exercises,
             tonnage: sessionLogs.reduce((acc, curr) => acc + curr.tonnage, 0)
         });
     });

     // Group Cardio
     endurance.forEach(s => {
         const cType = cardioTypes.find(c => c.name === s.type);
         details.push({
             type: 'cardio',
             name: s.type,
             emoji: s.typeEmoji || '🏃',
             color: cType?.color || '#EF4444',
             duration: s.duration,
             distance: s.distance,
             mode: s.mode,
             notes: s.notes
         });
     });

     return details;
  };

  // Helper pour formatter le texte du badge (4 lettres max)
  const formatBadgeText = (text: string) => {
    // Nettoie les emojis éventuels et espaces
    const cleanText = text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();
    // Prend les 4 premiers caractères
    return cleanText.substring(0, 4).toUpperCase();
  };

  const currentDetails = getDayDetails(selectedDate);

  return (
    <div className="h-full flex flex-col gap-8 animate-in fade-in duration-500 pb-12">
      
      {/* HEADER NAVIGATION */}
      <div className="flex items-center justify-between px-2">
        <div>
            {/* CORRECTION TITRE : clamp() */}
            <h2 className="font-black tracking-tighter uppercase text-gray-900 leading-none" style={{ fontSize: 'clamp(24px, 5vw, 48px)', wordBreak: 'break-word' }}>
            STRATÉGIE <span className="text-black/10">TEMPORELLE</span>
            </h2>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-2">Vue d'ensemble tactique</p>
        </div>
        <div className="flex items-center gap-4 bg-white border border-gray-100 p-1.5 rounded-[1.5rem] shadow-sm shrink-0">
            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 rounded-full transition-colors font-black text-lg">←</button>
            <span className="text-xs font-black uppercase w-20 md:w-32 text-center tracking-widest truncate">{currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 rounded-full transition-colors font-black text-lg">→</button>
        </div>
      </div>

      {/* SPLIT VIEW CONTAINER */}
      <div className="flex flex-col lg:flex-row gap-8 h-full">
          
          {/* LEFT: CALENDAR GRID (BADGE SYSTEM) */}
          <div className="flex-1 bg-white rounded-[2.5rem] p-4 md:p-8 border border-gray-100 shadow-sm h-fit">
             <div className="grid grid-cols-7 mb-6">
                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => (
                  <div key={d} className="text-center text-[10px] font-black text-gray-300 uppercase tracking-widest">{d}</div>
                ))}
             </div>
             <div className="grid grid-cols-7 gap-1 md:gap-2">
                {daysInMonth.map((day, i) => {
                    if (day === null) return <div key={`e-${i}`} className="aspect-[3/4] md:aspect-square" />; // Aspect ratio plus haut pour les piles verticales
                    const data = getDayData(day);
                    const isSelected = data.dateStr === selectedDate;
                    const isToday = new Date().toISOString().split('T')[0] === data.dateStr;
                    
                    return (
                        <button 
                            key={day}
                            onClick={() => setSelectedDate(data.dateStr)}
                            className={`
                                aspect-[3/4] md:aspect-square flex flex-col items-center justify-start pt-2 rounded-2xl relative transition-all duration-200 group overflow-hidden
                                ${isSelected 
                                    ? 'bg-black text-white shadow-xl scale-105 z-10' 
                                    : isToday 
                                        ? 'bg-gray-100 text-black border border-gray-200'
                                        : 'hover:bg-gray-50 text-gray-500'
                                }`
                            }
                        >
                            <span className={`text-sm font-black mb-1 ${isSelected ? 'text-white' : ''}`}>{day}</span>
                            
                            {/* MICRO-BADGES SYSTEM */}
                            <div className="w-full px-0.5 flex flex-col gap-0.5 items-center">
                                {data.items.map((item, idx) => (
                                    <div 
                                        key={idx}
                                        className={`
                                            w-[90%] h-[18px] flex items-center justify-center
                                            text-[9px] font-black text-white tracking-wider shadow-sm leading-none
                                            ${item.type === 'muscu' 
                                                ? 'rounded-[3px]' // BRIQUE (Muscu)
                                                : 'rounded-full'  // PILULE (Cardio)
                                            }
                                        `}
                                        style={{ backgroundColor: item.color }}
                                    >
                                        {formatBadgeText(item.name)}
                                    </div>
                                ))}
                            </div>
                        </button>
                    )
                })}
             </div>
          </div>

          {/* RIGHT: REGISTRY PANEL (FIXED DETAIL) */}
          <div className="w-full lg:w-96 flex flex-col gap-6 animate-in slide-in-from-right-4 duration-500">
             
             {/* Header du Jour */}
             <div className="bg-[#FBFBFB] border-b border-gray-200 pb-4 sticky top-0 z-10">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-1">Registre Journalier</p>
                 <h3 className="text-4xl font-black uppercase tracking-tighter text-gray-900">
                    {new Date(selectedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })}
                 </h3>
             </div>

             {/* Liste des Activités */}
             <div className="flex flex-col gap-4 overflow-y-auto max-h-[60vh] pr-2">
                {currentDetails.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center opacity-40 border-2 border-dashed border-gray-200 rounded-[2rem]">
                        <span className="text-4xl mb-2 grayscale">💤</span>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Repos / Inactif</p>
                    </div>
                ) : (
                    currentDetails.map((item, idx) => (
                        <div key={idx} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group animate-in slide-in-from-bottom-2">
                            
                            {/* MUSCU CARD */}
                            {item.type === 'muscu' && (
                                <>
                                    <div className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: item.color }} />
                                    <div className="pl-4">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="text-xl font-black uppercase tracking-tighter">{item.name}</h4>
                                            <span className="text-[10px] font-black bg-black text-white px-2 py-1 rounded">{(item.tonnage/1000).toFixed(1)}t</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {item.exercises.map((ex: string, i: number) => (
                                                <span key={i} className="text-[9px] font-bold text-gray-500 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-lg uppercase tracking-wide">
                                                    {ex}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* CARDIO CARD */}
                            {item.type === 'cardio' && (
                                <>
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner bg-gray-50" style={{ color: item.color }}>
                                            {item.emoji}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-lg font-black uppercase tracking-tight">{item.name}</h4>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                                {item.mode === 'interval' ? 'Fractionné' : 'Continu'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-gray-50">
                                        <div className="text-center">
                                            <p className="text-[9px] font-black text-gray-300 uppercase">Distance</p>
                                            <p className="text-xl font-black text-gray-900">{item.distance}<span className="text-xs text-gray-400">km</span></p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[9px] font-black text-gray-300 uppercase">Durée</p>
                                            <p className="text-xl font-black text-gray-900">{item.duration}<span className="text-xs text-gray-400">min</span></p>
                                        </div>
                                    </div>
                                    {item.notes && (
                                        <div className="mt-4 bg-gray-50 p-3 rounded-xl">
                                            <p className="text-xs text-gray-500 italic">"{item.notes}"</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ))
                )}
             </div>
          </div>
      </div>
    </div>
  );
};

export default CalendarView;