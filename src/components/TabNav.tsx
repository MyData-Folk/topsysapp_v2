import { FileUp, LayoutDashboard, Settings, GitCompareArrows, HelpCircle, Cloud, ShieldCheck } from 'lucide-react';
import type { ComponentType } from 'react';
import { TabId } from '../types';
import { cn } from '../utils/cn';

const BASE_TABS: { id: TabId; label: string; shortLabel: string; icon: ComponentType<{ size?: number }> }[] = [
  { id: 'import', label: 'Importer', shortLabel: 'Import', icon: FileUp },
  { id: 'analyse', label: 'Analyse & KPIs', shortLabel: 'Analyse', icon: LayoutDashboard },
  { id: 'evolution', label: 'Évolution', shortLabel: 'Évol.', icon: GitCompareArrows },
  { id: 'settings', label: 'Configuration', shortLabel: 'Config', icon: Settings },
  { id: 'cloud', label: 'Cloud', shortLabel: 'Cloud', icon: Cloud },
];

const HELP_TAB = { id: 'help' as TabId, label: 'Aide', shortLabel: 'Aide', icon: HelpCircle };
const ADMIN_TAB = { id: 'admin' as TabId, label: 'Admin', shortLabel: 'Admin', icon: ShieldCheck };

interface TabNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  isCloudConnected?: boolean;
  isAdmin?: boolean;
}

export function TabNav({ activeTab, onTabChange, isCloudConnected, isAdmin }: TabNavProps) {
  const tabs = isAdmin 
    ? [...BASE_TABS, ADMIN_TAB, HELP_TAB] 
    : [...BASE_TABS, HELP_TAB];
  return (
    <nav className="hidden md:flex px-8 border-b border-border bg-surf1 h-12 shrink-0 sticky top-0 z-50">
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => onTabChange(tab.id)}
          className={cn(
            "flex items-center gap-2 px-5 border-b-2 text-xs font-semibold transition-all h-full outline-none",
            activeTab === tab.id ? "border-gold text-gold" : "border-transparent text-text-dim hover:text-text hover:border-border-hover",
            tab.id === 'admin' && "text-green hover:text-green border-transparent hover:border-green/40",
            tab.id === 'admin' && activeTab === 'admin' && "border-green text-green",
          )}
        >
          <div className="relative">
            <tab.icon size={15} />
            {tab.id === 'cloud' && isCloudConnected && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-green rounded-full" />
            )}
          </div>
          <span className="hidden sm:inline">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

export function TabNavMobile({ activeTab, onTabChange, isCloudConnected, isAdmin }: TabNavProps) {
  const tabs = isAdmin 
    ? [...BASE_TABS, ADMIN_TAB, HELP_TAB] 
    : [...BASE_TABS, HELP_TAB];
  
  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surf1/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="flex overflow-x-auto no-scrollbar items-center h-16 px-1">
        {tabs.map(tab => (
          <button key={tab.id} type="button" onClick={() => onTabChange(tab.id)}
            aria-label={tab.label} aria-current={activeTab === tab.id ? 'page' : undefined}
            className={cn(
              "flex-1 min-w-[60px] h-full rounded-xl text-[8px] font-bold transition-all flex flex-col items-center justify-center gap-0.5",
              activeTab === tab.id
                ? tab.id === 'admin' ? "text-green bg-green/10" : "text-gold bg-gold/10"
                : "text-text-dark hover:text-text"
            )}
          >
            <div className="relative">
              <tab.icon size={16} />
              {tab.id === 'cloud' && isCloudConnected && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-green rounded-full" />
              )}
            </div>
            <span className="leading-none text-center px-0.5">{tab.shortLabel}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
