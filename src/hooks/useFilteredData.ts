import { useMemo } from 'react';
import { OccupancyData, FilterState, AppConfig, HotelConfig } from '../types';
import { getOccupancyRate, getDayOccupied, getDayPrice } from '../utils/helpers';

export function useFilteredData(
  report: OccupancyData | null,
  filters: FilterState,
  config: AppConfig,
  hotel: HotelConfig
) {
  // kpiCols: date + dow + taux — always used for KPI computation
  const kpiCols = useMemo(() => {
    if (!report) return [];
    const cols: number[] = [];
    for (let i = 0; i < report.daysCount; i++) {
      if (filters.dateFrom >= 0 && i < filters.dateFrom) continue;
      if (filters.dateTo >= 0 && i > filters.dateTo) continue;
      const dl = report.dateLabels[i];
      if (dl.date && !filters.dows.has(dl.date.getDay())) continue;
      const rate = getOccupancyRate(report, i);
      if (rate < filters.tauxMin || rate > filters.tauxMax) continue;
      cols.push(i);
    }
    return cols;
  }, [report, filters.dateFrom, filters.dateTo, filters.dows, filters.tauxMin, filters.tauxMax]);

  // visibleCols: columns shown in the table.
  // When showOnlyFiltered is true, mirrors kpiCols (taux range hides columns).
  // When false, applies only date + dow filters so all days remain visible.
  const visibleCols = useMemo(() => {
    if (!report) return [];
    if (filters.showOnlyFiltered) return kpiCols;
    const cols: number[] = [];
    for (let i = 0; i < report.daysCount; i++) {
      if (filters.dateFrom >= 0 && i < filters.dateFrom) continue;
      if (filters.dateTo >= 0 && i > filters.dateTo) continue;
      const dl = report.dateLabels[i];
      if (dl.date && !filters.dows.has(dl.date.getDay())) continue;
      cols.push(i);
    }
    return cols;
  }, [report, kpiCols, filters.showOnlyFiltered, filters.dateFrom, filters.dateTo, filters.dows]);

  const kpis = useMemo(() => {
    if (!report || kpiCols.length === 0) return null;

    let totalOcc = 0, totalCap = 0, totalLibres = 0, totalCA = 0;
    let peakRate = -1, peakIdx = 0;

    for (const i of kpiCols) {
      const cap = report.capaciteDay[i];
      const occ = getDayOccupied(report, i);
      const price = getDayPrice(report, i, hotel, config);
      totalOcc += occ;
      totalCap += cap;
      totalLibres += report.libresTotal[i];
      totalCA += occ * price;
      const rate = cap > 0 ? (occ / cap * 100) : 0;
      if (rate > peakRate) { peakRate = rate; peakIdx = i; }
    }

    const avgRate = totalCap > 0 ? (totalOcc / totalCap * 100) : 0;
    const revpar = totalCap > 0 ? (totalCA / totalCap) : 0;

    return {
      avgRate,
      totalOcc,
      totalLibres,
      totalCA: Math.round(totalCA),
      revpar: Math.round(revpar),
      peakDay: report.dateLabels[peakIdx]?.day || '-',
      peakRate,
      daysCount: kpiCols.length,
    };
  }, [report, kpiCols, config, hotel]);

  return { visibleCols, kpis };
}
