import { useState, useCallback, useMemo, useEffect } from 'react';
import { get, set } from 'idb-keyval';
import { AppConfig, OccupancyData, HotelConfig, TabId, FilterState } from '../types';
import { DEFAULT_CONFIG, DEFAULT_HOTEL, DEFAULT_IGNORE_PREFIXES } from '../utils/constants';
import { loadCloudConfig, saveConfig } from '../lib/supabaseStorage';
import { supabase } from '../lib/supabaseClient';
import { hydrateReport } from '../utils/helpers';
import { logger } from '../utils/logger';

const IDB_KEY = 'hotel_analyzer_reports_v2';
const LS_KEY = 'hotel_analyzer_config';

function loadConfig(): AppConfig {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (!saved) return DEFAULT_CONFIG;
    const parsed = JSON.parse(saved);

    const legacyIgnore: string[] = parsed.ignorePrefixes || DEFAULT_IGNORE_PREFIXES;

    if (!parsed.hotels) {
      const migratedHotel: HotelConfig = {
        id: 'migrated-primary',
        name: parsed.name || DEFAULT_HOTEL.name,
        address: parsed.address || DEFAULT_HOTEL.address,
        reference: parsed.reference || DEFAULT_HOTEL.reference,
        totalCapacity: parsed.totalCapacity || DEFAULT_HOTEL.totalCapacity,
        types: parsed.types || DEFAULT_HOTEL.types,
        defaultRoomPrice: parsed.defaultRoomPrice || DEFAULT_HOTEL.defaultRoomPrice,
        ignorePrefixes: legacyIgnore,
      };
      const { ignorePrefixes: _, ...rest } = parsed;
      return { ...DEFAULT_CONFIG, ...rest, selectedHotelId: 'migrated-primary', hotels: [migratedHotel] };
    }

    const hotels = parsed.hotels.map((h: any) => ({
      ...h,
      ignorePrefixes: h.ignorePrefixes || legacyIgnore,
    }));

    const { ignorePrefixes: _, ...cleanParsed } = parsed;
    return { ...DEFAULT_CONFIG, ...cleanParsed, hotels };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export const DEFAULT_FILTERS: FilterState = {
  view: 'all',
  types: new Set(),
  dateFrom: -1,
  dateTo: -1,
  dateSnap: -1,
  tauxMin: 0,
  tauxMax: 100,
  dows: new Set([0, 1, 2, 3, 4, 5, 6]),
  showOnlyFiltered: false,
};

export function useAppStore() {
  const [config, setConfig] = useState<AppConfig>(loadConfig);
  const [reports, setReports] = useState<OccupancyData[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('import');
  const [filters, setFilters] = useState<FilterState>({ ...DEFAULT_FILTERS });
  const [pdfFiles, setPdfFiles] = useState<Record<string, File>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'ok' | 'error' } | null>(null);

  const activeHotel = useMemo(() => {
    return config.hotels.find(h => h.id === config.selectedHotelId) || config.hotels[0];
  }, [config.hotels, config.selectedHotelId]);

  const activeReport = useMemo(() => {
    return reports.find(r => r.id === selectedReportId) || reports[0] || null;
  }, [reports, selectedReportId]);

  // Load reports from IndexedDB
  useEffect(() => {
    logger.info('Store', 'Démarrage hydratation IndexedDB...');
    get(IDB_KEY).then(saved => {
      if (saved && Array.isArray(saved)) {
        logger.info('Store', `${saved.length} rapports chargés depuis IndexedDB`);
        setReports(saved.map(hydrateReport));
      } else {
        logger.debug('Store', 'IndexedDB vide');
      }
    }).catch(err => logger.error('Store', 'Erreur hydratation IndexedDB', err));
  }, []);

  // Persist config to localStorage
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(config));
  }, [config]);

  // Persist config to Cloud (Supabase)
  useEffect(() => {
    if (!config.cloudSync || !supabase) return;
    
    const timeout = setTimeout(() => {
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          // Injection des filtres dans le JSON de config pour sauvegarde
          const fullConfig = { 
            ...config, 
            lastFilters: {
              ...filters,
              types: Array.from(filters.types),
              dows: Array.from(filters.dows)
            }
          };
          logger.info('Store', 'Sauvegarde auto de la config et des filtres vers le Cloud...');
          saveConfig(fullConfig as any).catch(err => logger.error('Store', 'Erreur sauvegarde Cloud config', err));
        }
      });
    }, 2000); // Debounce de 2s

    return () => clearTimeout(timeout);
  }, [config, filters]);

  // Persist reports to IndexedDB
  useEffect(() => {
    if (config.autoSave && reports.length > 0) {
      set(IDB_KEY, reports).catch(err => logger.error('Store', 'Erreur persistance reports', err));
    }
  }, [reports, config.autoSave]);

  // Auto-select hotel when report changes
  useEffect(() => {
    if (!activeReport?.establishmentName) return;
    setConfig(prev => {
      const match = prev.hotels.find(h =>
        h.name.toLowerCase().includes(activeReport.establishmentName!.toLowerCase()) ||
        activeReport.establishmentName!.toLowerCase().includes(h.name.toLowerCase())
      );
      if (match && match.id !== prev.selectedHotelId) {
        logger.info('Store', `Auto-sélection hôtel: ${match.name}`);
        return { ...prev, selectedHotelId: match.id };
      }
      return prev;
    });
  }, [activeReport?.id, activeReport?.establishmentName]);

  const showToast = useCallback((message: string, type: 'ok' | 'error' = 'ok') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const addReport = useCallback((report: OccupancyData): boolean => {
    let duplicate = false;
    setReports(prev => {
      duplicate = prev.some(r =>
        r.periodStr === report.periodStr &&
        r.establishmentName === report.establishmentName &&
        r.daysCount === report.daysCount
      );
      if (duplicate) return prev;
      return [report, ...prev];
    });
    if (!duplicate) {
      logger.info('Store', `Rapport ajouté: ${report.id}`);
      setSelectedReportId(report.id);
    }
    return !duplicate;
  }, []);

  const deleteReport = useCallback((id: string) => {
    logger.info('Store', `Suppression rapport: ${id}`);
    setReports(prev => prev.filter(r => r.id !== id));
    setPdfFiles(prev => { const n = { ...prev }; delete n[id]; return n; });
    if (selectedReportId === id) setSelectedReportId(null);
  }, [selectedReportId]);

  const updateConfig = useCallback((updates: Partial<AppConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const updateActiveHotel = useCallback((updates: Partial<HotelConfig>) => {
    setConfig(prev => ({
      ...prev,
      hotels: prev.hotels.map(h =>
        h.id === prev.selectedHotelId ? { ...h, ...updates } : h
      ),
    }));
  }, []);

  const addHotel = useCallback((hotel: HotelConfig) => {
    setConfig(prev => {
      const exists = prev.hotels.find(h => h.name.toLowerCase() === hotel.name.toLowerCase());
      if (exists) {
        logger.warn('Store', `Hôtel déjà présent: ${hotel.name}`);
        return { ...prev, selectedHotelId: exists.id };
      }
      logger.info('Store', `Ajout hôtel: ${hotel.name}`);
      return {
        ...prev,
        hotels: [...prev.hotels, hotel],
        selectedHotelId: hotel.id,
      };
    });
  }, []);

  const deleteHotel = useCallback((id: string) => {
    if (config.hotels.length <= 1) return;
    logger.info('Store', `Suppression hôtel: ${id}`);
    setConfig(prev => {
      const filtered = prev.hotels.filter(h => h.id !== id);
      return { ...prev, hotels: filtered, selectedHotelId: filtered[0].id };
    });
  }, [config.hotels.length]);

  const resetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS, types: new Set(), dows: new Set([0, 1, 2, 3, 4, 5, 6]) });
  }, []);

  const storePdfFile = useCallback((reportId: string, file: File) => {
    setPdfFiles(prev => ({ ...prev, [reportId]: file }));
  }, []);

  return {
    config, setConfig, updateConfig,
    reports, setReports, addReport, deleteReport,
    selectedReportId, setSelectedReportId,
    activeTab, setActiveTab,
    activeHotel, updateActiveHotel, addHotel, deleteHotel,
    activeReport,
    filters, setFilters, resetFilters,
    pdfFiles, storePdfFile,
    isLoading, setIsLoading,
    error, setError,
    toast, showToast,
  };
}
