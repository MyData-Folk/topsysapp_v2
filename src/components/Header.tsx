import { HotelConfig, OccupancyData, ThemeMode } from '../types';
import { ThemeToggle } from './ThemeToggle';
import { AuthState } from '../hooks/useAuth';
import { Cloud, LogOut, RefreshCw, ChevronDown, Building2 } from 'lucide-react';
import { cn } from '../utils/cn';

interface HeaderProps {
  hotels: HotelConfig[];
  selectedHotelId: string | null;
  onHotelChange: (id: string | null) => void;
  report: OccupancyData | null;
  theme: ThemeMode;
  onThemeChange: (t: ThemeMode) => void;
  onRefresh: () => void;
  auth: AuthState;
  isLoading?: boolean;
}

export function Header({ 
  hotels, 
  selectedHotelId, 
  onHotelChange, 
  report, 
  theme, 
  onThemeChange, 
  onRefresh, 
  auth,
  isLoading 
}: HeaderProps) {
  const activeHotel = hotels.find(h => h.id === selectedHotelId);

  return (
    <header className="px-6 py-4 border-b border-border bg-surf1 relative overflow-hidden shrink-0">
      <div className="absolute top-0 right-0 w-80 h-80 bg-gold/3 rounded-full blur-3xl -mr-40 -mt-40 pointer-events-none" />
      <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        
        {/* Section Gauche : Logo + Sélecteur d'Hôtel */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gold/10 rounded-xl flex items-center justify-center shrink-0">
              <span className="text-gold font-serif font-bold text-lg">T</span>
            </div>
            <div className="hidden sm:block h-8 w-px bg-border mx-1" />
          </div>

          <div className="flex flex-col gap-1 min-w-[200px]">
            <div className="relative group">
              <select
                value={selectedHotelId || ''}
                onChange={(e) => onHotelChange(e.target.value)}
                className={cn(
                  "w-full appearance-none bg-surf2 border border-border rounded-xl px-4 py-2.5 pr-10 text-xs font-bold text-text focus:border-gold focus:ring-1 focus:ring-gold/20 outline-none transition-all cursor-pointer",
                  !selectedHotelId && "text-gold border-gold/30 bg-gold/5"
                )}
              >
                {!selectedHotelId && <option value="">(Mode Global Actif)</option>}
                {hotels.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-dim group-hover:text-gold transition-colors">
                <ChevronDown size={14} />
              </div>
            </div>
            <label className="flex items-center gap-2 px-1 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={!selectedHotelId}
                onChange={(e) => {
                  if (e.target.checked) {
                    onHotelChange(null);
                  } else {
                    const firstId = hotels.length > 0 ? hotels[0].id : null;
                    onHotelChange(firstId);
                  }
                }}
                className="w-3 h-3 rounded border-border text-gold focus:ring-gold bg-surf2 transition-all cursor-pointer"
              />
              <span className="text-[10px] font-bold text-text-dark group-hover:text-text transition-colors uppercase tracking-tight">Afficher tous les hôtels</span>
            </label>
            {activeHotel && (
              <p className="text-[9px] text-text-dark uppercase tracking-widest truncate max-w-[250px] mt-1 opacity-60">
                {activeHotel.address}
              </p>
            )}
          </div>
        </div>

        {/* Section Droite : Actions + Auth */}
        <div className="flex flex-wrap items-center justify-end gap-3 w-full lg:w-auto">
          
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className={cn(
                "p-2.5 bg-surf2 border border-border rounded-xl text-text-dim hover:text-gold hover:border-gold/30 transition-all shadow-sm",
                isLoading && "opacity-50"
              )}
              title="Actualiser les données"
            >
              <RefreshCw size={15} className={cn(isLoading && "animate-spin")} />
            </button>
            <ThemeToggle theme={theme} onChange={onThemeChange} />
          </div>

          {auth.user && (
            <div className="flex items-center gap-2 bg-gold/5 border border-gold/20 p-1.5 rounded-xl shadow-sm">
              <div className="flex items-center gap-2 px-2.5">
                <Cloud size={14} className="text-gold" />
                <span className="text-[10px] font-bold text-text truncate max-w-[120px]">
                  {auth.user.email}
                </span>
              </div>
              <button
                onClick={() => auth.signOut()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-surf2 border border-border rounded-lg text-[10px] font-bold text-text-dim hover:text-red hover:border-red/30 transition-all"
              >
                <LogOut size={12} />
              </button>
            </div>
          )}

          {report && (
            <div className="hidden sm:flex px-3 py-2 rounded-xl bg-surf2 border border-border text-gold text-[10px] font-bold shadow-sm">
              <span className="opacity-50 mr-2">Période :</span>
              {report.dateLabels[0]?.short} → {report.dateLabels[report.daysCount - 1]?.short}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
