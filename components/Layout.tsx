import React from 'react';
import { CalendarDays, Dumbbell, Activity, Apple, Bot } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: any) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const [time, setTime] = React.useState(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));

  React.useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const navItems = [
    { id: 'calendrier', label: 'Agenda', icon: CalendarDays },
    { id: 'atelier', label: 'Musculation', icon: Dumbbell },
    { id: 'endurance', label: 'Cardio', icon: Activity },
    { id: 'vitalite', label: 'Vitalité', icon: Apple },
    { id: 'lab', label: 'Coach IA', icon: Bot },
  ];

  return (
    <div className="min-h-[100dvh] flex bg-[#FBFBFB] text-[#1D1D1F]">
      {/* Desktop Sidebar (visible ≥ 768px) */}
      <nav className="hidden md:flex fixed left-0 top-0 bottom-0 w-72 sidebar-glass border-r border-black/5 flex-col p-8 z-50">
        <div className="mb-12 flex items-center gap-3">
          <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white shadow-xl">
            <span className="font-black text-lg">A</span>
          </div>
          <span className="text-xl font-black tracking-tighter uppercase italic">Athletica<span className="text-black/20">OS</span></span>
        </div>
        
        <div className="space-y-2 flex-1">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-[1.5rem] transition-all duration-300 ${
                  activeTab === item.id 
                  ? 'bg-black text-white shadow-[0_10px_30px_rgba(0,0,0,0.15)] scale-[1.02]' 
                  : 'text-gray-500 hover:bg-black/5 hover:translate-x-1'
                }`}
              >
                <Icon strokeWidth={2} size={20} />
                <span className="font-bold text-sm tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="pt-8 border-t border-black/5">
          <div className="bg-white/50 p-4 rounded-2xl border border-black/5 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Système Actif</span>
          </div>
        </div>
      </nav>

      {/* Mobile Nav Top Bar (hidden ≥ 768px) */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-[calc(3rem+env(safe-area-inset-top))] bg-white/90 backdrop-blur-xl z-50 px-6 flex items-end pb-3 justify-between pt-[env(safe-area-inset-top)] border-b border-black/5 shadow-sm">
        <span className="text-sm font-black tracking-tighter italic uppercase">Athletica<span className="text-black/20">OS</span></span>
        <div className="flex items-center gap-4">
           <span className="text-xs font-black tabular-nums">{time}</span>
           <div className="w-2 h-2 rounded-full bg-green-500" />
        </div>
      </header>

      {/* Main Content Area */}
      {/* Correction Marge de sécurité inférieure : !pb-[120px] sur mobile pour garantir le scroll au-dessus de la nav */}
      <main className="flex-1 md:ml-72 min-h-[100dvh] relative pt-[calc(3rem+env(safe-area-inset-top)+1rem)] md:pt-0 !pb-[120px] md:pb-12">
        <div className="max-w-6xl mx-auto px-4 md:p-12">
          <div className="view-animate">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Nav - Fixed Tab Bar (hidden ≥ 768px) */}
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-black/5 z-50 flex items-stretch justify-around pb-[env(safe-area-inset-bottom)] shadow-[0_-5px_20px_rgba(0,0,0,0.03)]"
        style={{ height: 'calc(60px + env(safe-area-inset-bottom))' }}
      >
        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 pt-2 active:opacity-50 transition-opacity ${
                activeTab === item.id ? 'text-black' : 'text-gray-400'
              }`}
            >
              <span className={`transition-transform duration-200 ${activeTab === item.id ? 'scale-110 -translate-y-1' : 'scale-100'}`}>
                <Icon strokeWidth={activeTab === item.id ? 2.5 : 2} size={22} />
              </span>
              <span className="text-[9px] font-bold tracking-wide">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default Layout;