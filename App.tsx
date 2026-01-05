import React, { useState, useEffect } from 'react';
import { TrainingLog, SleepLog, NutritionLog, ActivitySession, UserRoutine, NutrientConfig, CardioType, INITIAL_CARDIO_TYPES } from './types';
import NutritionView from './components/NutritionView';
import ActivityView from './components/ActivityView';
import AnalysisView from './components/AnalysisView';
import CalendarView from './components/CalendarView';
import AtelierMuscu from './components/AtelierMuscu';
import Layout from './components/Layout';
import { analyzeAthletePerformance } from './geminiService';
import { mockTraining, mockNutrition, mockSleep, mockActivity } from './mockData';

const TRAINING_CACHE_KEY = 'athletica_training_history';
const ROUTINES_CACHE_KEY = 'athletica_user_routines';
const NUTRITION_LOGS_KEY = 'athletica_nutrition_history';
const NUTRIENT_CONFIG_KEY = 'athletica_nutrient_config'; 
const ACTIVITY_SESSIONS_KEY = 'athletica_activity_sessions';
const CARDIO_TYPES_KEY = 'athletica_cardio_types';
const SLEEP_LOGS_KEY = 'athletica_sleep_history';
const AI_ANALYSIS_KEY = 'athletica_ai_analysis';

// CLEAN SLATE : Tableau vide pour forcer la configuration utilisateur
const DEFAULT_ROUTINES: UserRoutine[] = [];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'atelier' | 'endurance' | 'vitalite' | 'calendrier' | 'lab'>('atelier');
  
  // -- STATE MANAGEMENT (LOCAL ONLY) --

  const [training, setTraining] = useState<TrainingLog[]>(() => {
    const cached = localStorage.getItem(TRAINING_CACHE_KEY);
    return cached ? JSON.parse(cached) : mockTraining; // Fallback to Mock
  });
  
  const [sleep, setSleep] = useState<SleepLog[]>(() => {
    const cached = localStorage.getItem(SLEEP_LOGS_KEY);
    return cached ? JSON.parse(cached) : mockSleep;
  });
  
  const [nutrition, setNutrition] = useState<NutritionLog[]>(() => {
    const cached = localStorage.getItem(NUTRITION_LOGS_KEY);
    return cached ? JSON.parse(cached) : mockNutrition;
  });

  const [nutrientConfig, setNutrientConfig] = useState<NutrientConfig[]>(() => {
    const cached = localStorage.getItem(NUTRIENT_CONFIG_KEY);
    return cached ? JSON.parse(cached) : [];
  });

  const [activitySessions, setActivitySessions] = useState<ActivitySession[]>(() => {
    const cached = localStorage.getItem(ACTIVITY_SESSIONS_KEY);
    return cached ? JSON.parse(cached) : mockActivity; // Fallback to Mock
  });

  const [cardioTypes, setCardioTypes] = useState<CardioType[]>(() => {
    const cached = localStorage.getItem(CARDIO_TYPES_KEY);
    return cached ? JSON.parse(cached) : INITIAL_CARDIO_TYPES;
  });

  const [routines, setRoutines] = useState<UserRoutine[]>(() => {
    const cached = localStorage.getItem(ROUTINES_CACHE_KEY);
    return cached ? JSON.parse(cached) : DEFAULT_ROUTINES;
  });

  const [aiLoading, setAiLoading] = useState(false);
  const [aiData, setAiData] = useState<any>(() => {
    const cached = localStorage.getItem(AI_ANALYSIS_KEY);
    return cached ? JSON.parse(cached) : null;
  });

  // -- PERSISTENCE (AUTO-SAVE) --
  useEffect(() => {
    localStorage.setItem(TRAINING_CACHE_KEY, JSON.stringify(training));
    localStorage.setItem(ROUTINES_CACHE_KEY, JSON.stringify(routines));
    localStorage.setItem(NUTRITION_LOGS_KEY, JSON.stringify(nutrition));
    localStorage.setItem(NUTRIENT_CONFIG_KEY, JSON.stringify(nutrientConfig));
    localStorage.setItem(SLEEP_LOGS_KEY, JSON.stringify(sleep));
    localStorage.setItem(ACTIVITY_SESSIONS_KEY, JSON.stringify(activitySessions));
    localStorage.setItem(CARDIO_TYPES_KEY, JSON.stringify(cardioTypes));
    localStorage.setItem(AI_ANALYSIS_KEY, JSON.stringify(aiData));
  }, [training, routines, nutrition, nutrientConfig, sleep, activitySessions, cardioTypes, aiData]);

  // -- HANDLERS --

  const handleRunAnalysis = async () => {
    setAiLoading(true);
    try {
      const result = await analyzeAthletePerformance(training, nutrition, activitySessions, 80);
      setAiData(result);
    } catch (e) { console.error(e); }
    setAiLoading(false);
  };

  const handleUpdateHealth = (newSleep?: SleepLog, nutrientEntry?: any, isReset: boolean = false) => {
    const today = new Date().toISOString().split('T')[0];
    if (newSleep) {
      setSleep(prev => {
        const others = prev.filter(s => s.date !== today);
        return [...others, newSleep];
      });
    }
    if (nutrientEntry) {
      setNutrition(prev => {
        const existing = prev.find(n => n.date === today) || { date: today, totals: {} };
        const newTotals = { ...existing.totals };
        newTotals[nutrientEntry.nutrientId] = (newTotals[nutrientEntry.nutrientId] || 0) + nutrientEntry.value;
        const newLog = { ...existing, totals: newTotals };
        return [...prev.filter(n => n.date !== today), newLog];
      });
    }
  };

  const handleDeleteNutritionLog = (date: string) => {
    if (window.confirm('Voulez-vous supprimer les entrées nutritionnelles pour cette date ?')) {
      setNutrition(prev => prev.filter(n => n.date !== date));
    }
  };

  const handleAddTraining = (logs: TrainingLog[]) => {
    setTraining(prev => [...prev, ...logs]);
  };

  const handleDeleteTrainingSession = (date: string, sessionName: string) => {
    if (window.confirm('Supprimer définitivement cette séance ?')) {
      setTraining(prev => prev.filter(log => !(log.date === date && log.session === sessionName)));
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'atelier' && (
        <AtelierMuscu 
          routines={routines} 
          onUpdateRoutines={setRoutines} 
          onSaveLogs={handleAddTraining}
          trainingLogs={training}
          onDeleteSession={handleDeleteTrainingSession}
          activitySessions={activitySessions}
        />
      )}
      {activeTab === 'endurance' && (
        <ActivityView 
          onAddSession={(s) => setActivitySessions(p => [s, ...p])} 
          onDeleteSession={(id) => setActivitySessions(p => p.filter(s => s.id !== id))} 
          sessions={activitySessions}
          cardioTypes={cardioTypes}
          onUpdateCardioTypes={setCardioTypes}
        />
      )}
      {activeTab === 'vitalite' && (
        <NutritionView 
          onUpdateHealth={handleUpdateHealth} 
          onUndoNutrition={() => {}} 
          onDeleteLog={handleDeleteNutritionLog}
          currentNutrition={nutrition.find(n => n.date === new Date().toISOString().split('T')[0])} 
          nutritionHistory={nutrition}
          nutrients={nutrientConfig} 
          onUpdateNutrients={setNutrientConfig}
        />
      )}
      {activeTab === 'calendrier' && (
        <CalendarView 
          activitySessions={activitySessions} 
          trainingLogs={training}
          routines={routines}
          cardioTypes={cardioTypes}
        />
      )}
      {activeTab === 'lab' && (
        <AnalysisView 
          training={training} 
          aiAnalysis={aiData} 
          loading={aiLoading} 
          onRefresh={handleRunAnalysis} 
          lastUpdated={null}
        />
      )}
    </Layout>
  );
};

export default App;