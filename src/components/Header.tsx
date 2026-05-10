import { HotelConfig, OccupancyData, ThemeMode } from '../types';
import { ThemeToggle } from './ThemeToggle';
import { AuthState } from '../hooks/useAuth';
import { Cloud, LogOut } from 'lucide-react';

interface HeaderProps {
  hotel: HotelConfig;
  report: OccupancyData | null;
  theme: ThemeMode;
  onThemeChange: (t: ThemeMode) => void;
  auth: AuthState;
}

export function Header({ hotel, report, theme, onThemeChange, auth }: HeaderProps) {
  return (
    <header className="px-8 py-5 border-b border-border bg-surf1 relative overflow-hidden shrink-0">
      <div className="absolute top-0 right-0 w-80 h-80 bg-gold/3 rounded-full blur-3xl -mr-40 -mt-40 pointer-events-none" />
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <span className="text-gold font-serif font-bold text-lg">T</span>
          </div>
          <div>
            <h1 className="font-serif text-xl font-bold text-text tracking-tight">{hotel.name}</h1>
            <p className="text-text-dark text-[10px] uppercase tracking-widest">
              {hotel.address}{hotel.reference ? ` • ${hotel.reference}` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {/* Cloud Status Card - Persistant pendant la session */}
          {auth.user && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-gold/5 border border-gold/20 p-2 rounded-xl">
              <div className="flex items-center gap-2 px-2 py-1">
                <Cloud size={14} className="text-gold" />
                <span className="text-[10px] font-bold text-text truncate max-w-[140px] sm:max-w-[200px]">
                  {auth.user?.email || 'Chargement...'}
                </span>
              </div>
              <button
                onClick={() => auth.signOut()}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-surf2 border border-border rounded-lg text-[10px] font-bold text-text-dim hover:text-red hover:border-red/30 transition-colors"
              >
                <LogOut size={12} /> Déconnexion
              </button>
            </div>
          )}

          <div className="flex items-center justify-between sm:justify-end gap-3">
            {report && (
              <div className="flex gap-2">
                <span className="px-3 py-1.5 rounded-lg bg-gold/10 border border-gold/20 text-gold text-[10px] font-bold">
                  {report.dateLabels[0]?.short} → {report.dateLabels[report.daysCount - 1]?.short}
                </span>
              </div>
            )}
            <ThemeToggle theme={theme} onChange={onThemeChange} />
          </div>
        </div>
      </div>
    </header>
  );
}
