import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TrainingLog, ActivitySession, AnalysisResponse, ChatMessage, NutritionLog } from '../types';
import { sendChatMessage } from '../geminiService';
import { 
  LineChart, Line, XAxis, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, AreaChart, Area
} from 'recharts';

interface AnalysisViewProps {
  training: TrainingLog[];
  activity?: ActivitySession[];
  aiAnalysis: AnalysisResponse | any;
  loading: boolean;
  onRefresh: () => void;
  lastUpdated: number | null;
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ training, activity = [], aiAnalysis, loading, onRefresh }) => {
  const [subTab, setSubTab] = useState<'dashboard' | 'chat'>('dashboard');
  
  // --- CHAT STATE ---
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'model', text: 'Salut ! Je suis ton coach IA. J\'ai analysé tes 30 derniers jours. Une question sur ta récup ou ton volume ?' }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-refresh analysis on mount if empty (silent update)
  useEffect(() => {
    if (!aiAnalysis && !loading) {
      onRefresh();
    }
  }, []);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, subTab]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: inputMessage };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsChatLoading(true);

    // Prepare history format for Gemini SDK
    const historyForSdk = messages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));

    // Mock Nutrition Log (to be passed via props ideally)
    const mockNutrition: NutritionLog[] = []; 

    const responseText = await sendChatMessage(userMsg.text, training, mockNutrition, activity, historyForSdk);
    
    const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: responseText };
    setMessages(prev => [...prev, aiMsg]);
    setIsChatLoading(false);
  };

  // --- DATA COMPUTATION ---
  
  // Volume Load (Strength)
  const strengthData = useMemo(() => {
    const data: Record<string, number> = {};
    const now = new Date();
    // Last 14 days
    for(let i=13; i>=0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        data[key] = 0;
    }
    training.forEach(log => {
        const logDate = new Date(log.date);
        const timeDiff = now.getTime() - logDate.getTime();
        if (timeDiff <= 14 * 24 * 60 * 60 * 1000) { // Within 14 days
             const key = logDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
             if (data[key] !== undefined) data[key] += log.tonnage;
        }
    });
    return Object.entries(data).map(([date, vol]) => ({ date, vol: Math.round(vol/100) })); // Scale down
  }, [training]);

  // Cardio Volume (Last 14 days)
  const cardioData = useMemo(() => {
     return activity
        .slice(0, 10)
        .reverse()
        .map(s => ({
            date: new Date(s.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' }),
            dist: s.distance
        }));
  }, [activity]);

  return (
    <div className={`space-y-6 animate-in fade-in duration-500 pb-24 h-full flex flex-col ${subTab === 'chat' ? 'h-[calc(100dvh-140px)]' : ''}`}>
      
      {/* HEADER & TABS */}
      <div className="flex items-center justify-between px-2">
         <div>
            <h2 className="text-3xl font-black tracking-tighter uppercase">INTELLIGENCE <span className="text-gray-300">HUB</span></h2>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Gemini 3 Powered Analysis</p>
         </div>
         <div className="bg-white border border-gray-100 p-1 rounded-2xl flex shadow-sm">
            <button 
              onClick={() => setSubTab('dashboard')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${subTab === 'dashboard' ? 'bg-black text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Tableau de Bord
            </button>
            <button 
              onClick={() => setSubTab('chat')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${subTab === 'chat' ? 'bg-black text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Assistant Coach
            </button>
         </div>
      </div>

      {/* --- DASHBOARD VIEW --- */}
      {subTab === 'dashboard' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          {/* ... (Contenu Dashboard inchangé) ... */}
          {/* 1. AI INSIGHT CARD (Auto-generated) */}
          <div className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden min-h-[160px] flex flex-col justify-center">
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            
            {loading ? (
               <div className="flex items-center gap-3 animate-pulse">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                  <span className="text-xs font-bold uppercase tracking-widest text-white/50">Analyse en cours...</span>
               </div>
            ) : (
               <div className="relative z-10 space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="px-2 py-1 bg-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest text-blue-200 backdrop-blur-md">
                        {aiAnalysis?.trend === 'UP' ? '📈 Tendance Positive' : aiAnalysis?.trend === 'DOWN' ? '📉 Attention' : '➡ Stable'}
                    </span>
                    <button onClick={onRefresh} className="text-white/20 hover:text-white transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                  </div>
                  <h3 className="text-xl font-black italic leading-tight">"{aiAnalysis?.headline || "Données insuffisantes"}"</h3>
                  <p className="text-sm text-gray-300 font-medium leading-relaxed">{aiAnalysis?.advice || "Enregistre plus de séances pour obtenir des conseils."}</p>
               </div>
            )}
          </div>

          {/* 2. STATS GRID */}
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm space-y-2">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Charge Muscu (14j)</p>
                <div className="h-24">
                   <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={strengthData}>
                         <defs>
                            <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="#000" stopOpacity={0.3}/>
                               <stop offset="95%" stopColor="#000" stopOpacity={0}/>
                            </linearGradient>
                         </defs>
                         <Area type="monotone" dataKey="vol" stroke="#000" fillOpacity={1} fill="url(#colorVol)" strokeWidth={2} />
                      </AreaChart>
                   </ResponsiveContainer>
                </div>
             </div>
             <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm space-y-2">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Volume Cardio (10 sessions)</p>
                <div className="h-24">
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cardioData}>
                         <Bar dataKey="dist" fill="#EF4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                   </ResponsiveContainer>
                </div>
             </div>
          </div>

          {/* 3. METRICS ROW */}
          <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex justify-between divide-x divide-gray-100">
             <div className="flex-1 px-2 text-center">
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Score Charge</p>
                <p className="text-3xl font-black">{aiAnalysis?.metrics?.loadScore || 0}<span className="text-xs text-gray-300">/100</span></p>
             </div>
             <div className="flex-1 px-2 text-center">
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Régularité</p>
                <p className="text-3xl font-black text-blue-600">{aiAnalysis?.metrics?.consistency || 0}<span className="text-lg">%</span></p>
             </div>
             <div className="flex-1 px-2 text-center">
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Top Perf</p>
                <p className="text-xs font-black bg-gray-50 py-2 rounded-lg truncate">{aiAnalysis?.metrics?.pr || "-"}</p>
             </div>
          </div>

          {/* SOURCES */}
          {aiAnalysis?.groundingUrls && aiAnalysis.groundingUrls.length > 0 && (
            <div className="px-4">
                <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-2">Sources vérifiées</p>
                <div className="flex flex-wrap gap-2">
                    {aiAnalysis.groundingUrls.map((url: any, idx: number) => (
                        <a key={idx} href={url.uri} target="_blank" rel="noopener noreferrer" className="text-[9px] font-bold text-blue-500 bg-blue-50 px-3 py-1 rounded-full hover:underline">
                            {url.title} ↗
                        </a>
                    ))}
                </div>
            </div>
          )}
        </div>
      )}

      {/* --- CHAT VIEW (100% Height Mode) --- */}
      {subTab === 'chat' && (
        <div className="flex-1 flex flex-col bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden animate-in slide-in-from-right-4 h-full relative">
           {/* Messages Area - flex-1 to take available space */}
           <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 pb-20">
              {messages.map((msg) => (
                 <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-2xl text-base font-medium leading-relaxed ${
                        msg.role === 'user' 
                        ? 'bg-black text-white rounded-tr-none shadow-md' 
                        : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none shadow-sm'
                    }`}>
                        {msg.text}
                    </div>
                 </div>
              ))}
              {isChatLoading && (
                 <div className="flex justify-start">
                    <div className="bg-white border border-gray-100 p-4 rounded-2xl rounded-tl-none shadow-sm flex gap-2 items-center">
                       <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                       <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                       <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    </div>
                 </div>
              )}
              <div ref={messagesEndRef} />
           </div>

           {/* Input Area - Absolute bottom to act as keyboard accessory */}
           <div className="absolute bottom-0 left-0 right-0 p-3 bg-white border-t border-gray-100 bg-opacity-90 backdrop-blur-sm z-10">
              <div className="flex gap-2 items-end">
                 <textarea 
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                    placeholder="Posez une question..."
                    rows={1}
                    className="flex-1 bg-gray-100 border-none rounded-[1.5rem] px-5 py-3 text-base font-medium focus:ring-2 focus:ring-black/5 outline-none resize-none max-h-32"
                    disabled={isChatLoading}
                 />
                 <button 
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isChatLoading}
                    className="bg-black text-white p-3 rounded-full disabled:opacity-50 transition-opacity hover:bg-gray-900 min-w-[48px] min-h-[48px] flex items-center justify-center shadow-md mb-0.5"
                 >
                    <svg className="w-5 h-5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisView;