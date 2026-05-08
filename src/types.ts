export interface RoomType {
  code: string;
  label: string;
  description: string;
  capacity: number;
}

export interface DateLabel {
  full: string;
  short: string;
  day: string;
  isWk: boolean;
  date: Date | null;
}

export interface OccupancyData {
  id: string;
  fileName: string;
  uploadDate: number;
  dateLabels: DateLabel[];
  daysCount: number;
  occupied: Record<string, number[]>;
  libresType: Record<string, number[]>;
  libresTotal: number[];
  libresTypeSumCheck: number[];
  capaciteDay: number[];
  validation: boolean[];
  periodStr: string;
  prices: number[];
  establishmentName?: string;
  establishmentAddress?: string;
  editionDate?: string;
}

export interface HotelConfig {
  id: string;
  name: string;
  address: string;
  reference: string;
  totalCapacity: number;
  types: RoomType[];
  defaultRoomPrice: number;
  ignorePrefixes: string[];
  supabaseRegistered?: boolean;
}

export type ThemeMode = 'dark' | 'light';

export interface AppConfig {
  selectedHotelId: string;
  hotels: HotelConfig[];
  pms: string;
  highOccupancyThreshold: number;
  lowOccupancyThreshold: number;
  currency: string;
  showCategoryLibres: boolean;
  dateFormat: 'full' | 'short' | 'day';
  xlsxName: string;
  useAveragePriceForRevenue: boolean;
  autoSave: boolean;
  theme: ThemeMode;
  archiveFolderName: string;
  cloudSync: boolean;
}

export type ViewMode = 'all' | 'libres' | 'occupees' | 'taux';
export type TabId = 'import' | 'analyse' | 'evolution' | 'settings' | 'help' | 'cloud' | 'admin';

export interface FilterState {
  view: ViewMode;
  types: Set<string>;
  dateFrom: number;
  dateTo: number;
  dateSnap: number;
  tauxMin: number;
  tauxMax: number;
  dows: Set<number>;
  showOnlyFiltered: boolean;
}
