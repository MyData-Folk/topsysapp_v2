import React from 'react';
import { OccupancyData, AppConfig, HotelConfig, FilterState } from '../types';
import { cn } from '../utils/cn';
import { getOccupancyRate, getRateClass } from '../utils/helpers';

interface OccupancyTableProps {
  report: OccupancyData;
  config: AppConfig;
  hotel: HotelConfig;
  filters: FilterState;
  visibleCols: number[];
  fontSize: number;
  selectedDayIdx: number | null;
  onDayClick: (idx: number) => void;
}

export function OccupancyTable({ report, config, hotel, filters, visibleCols, fontSize, selectedDayIdx, onDayClick }: OccupancyTableProps) {
  const visibleTypes = hotel.types.filter(t => filters.types.size === 0 || filters.types.has(t.code));
  const showLibresRows = config.showCategoryLibres && filters.view !== 'taux';

  return (
    <div className="overflow-x-auto custom-scrollbar border border-border rounded-2xl bg-surf1">
      <table className="w-full border-separate border-spacing-0" style={{ fontSize: `${fontSize}px` }}>
        <thead>
          <tr className="bg-surf2 text-text-dark uppercase tracking-wider font-bold">
            <th className="sticky top-0 left-0 z-50 bg-surf2 p-4 text-left border-r border-b border-border min-w-[180px] shadow-[2px_2px_5px_rgba(0,0,0,0.2)]">
              Catégories
            </th>
            {visibleCols.map(i => {
              const dl = report.dateLabels[i];
              return (
                <th
                  key={i}
                  onClick={() => onDayClick(i)}
                  className={cn(
                    "sticky top-0 z-30 p-3 text-center cursor-pointer border-b border-border min-w-[50px] transition-all bg-surf2",
                    dl.isWk && "bg-gold/5",
                    selectedDayIdx === i && "bg-blue/10 border-b-blue ring-1 ring-inset ring-blue/20"
                  )}
                  title="Cliquer pour le détail"
                >
                  <div className={cn(dl.isWk ? "text-gold" : "text-text-dim")}>{dl.day.split(' ')[0]}</div>
                  <div className="text-[9px] mt-0.5 tabular-nums">{dl.short}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {/* Per-type rows */}
          {(filters.view === 'all' || filters.view === 'occupees') && visibleTypes.map(type => {
            const occ = report.occupied[type.code] || [];
            const lib = report.libresType[type.code] || [];
            return (
              <React.Fragment key={type.code}>
                <tr className="border-b border-border/50 group hover:bg-white/5 transition-colors">
                  <td className="sticky left-0 z-10 bg-surf1 group-hover:bg-surf2 p-3 border-r border-border transition-colors">
                    <div className="font-bold text-gold-light truncate">{type.label}</div>
                    <div className="text-[8px] text-text-dark uppercase">Cap: {type.capacity}</div>
                  </td>
                  {visibleCols.map(i => (
                    <td key={i} className={cn(
                      "p-2 text-center font-bold border-x border-border/5",
                      report.dateLabels[i].isWk && "bg-white/3",
                      occ[i] >= type.capacity * 0.9 ? "text-green bg-green/5" :
                      occ[i] >= type.capacity * 0.5 ? "text-amber bg-amber/5" :
                      occ[i] === 0 ? "text-text-dark/20" : "text-gold-light bg-gold/5"
                    )}>
                      {occ[i] ?? 0}
                    </td>
                  ))}
                </tr>
                {showLibresRows && (
                  <tr className="border-b border-border/10 bg-blue/5">
                    <td className="sticky left-0 z-10 bg-surf1 border-r border-border italic text-[9px] text-blue/60 pl-6 py-1">
                      ↳ Libres {type.label}
                    </td>
                    {visibleCols.map(i => (
                      <td key={i} className={cn(
                        "p-1 text-center",
                        lib[i] === 0 ? "text-text-dark/10" : lib[i] === type.capacity ? "text-amber" : "text-blue/80"
                      )}>
                        {lib[i] ?? 0}
                      </td>
                    ))}
                  </tr>
                )}
              </React.Fragment>
            );
          })}

          {/* Libres-only view */}
          {filters.view === 'libres' && visibleTypes.map(type => {
            const lib = report.libresType[type.code] || [];
            return (
              <tr key={type.code} className="border-b border-border/50 hover:bg-white/5">
                <td className="sticky left-0 z-10 bg-surf1 p-3 border-r border-border italic text-blue">
                  Libres {type.label}
                </td>
                {visibleCols.map(i => (
                  <td key={i} className={cn("p-2 text-center font-bold", lib[i] === 0 ? "text-text-dark/20" : "text-blue")}>
                    {lib[i] ?? 0}
                  </td>
                ))}
              </tr>
            );
          })}

          {/* Separator */}
          <tr><td colSpan={visibleCols.length + 1} className="h-1 bg-surf2 border-none" /></tr>

          {/* Libres PDF total */}
          {(filters.view === 'all' || filters.view === 'libres') && (
            <>
              <tr className="font-bold">
                <td className="sticky left-0 z-10 bg-surf1 p-3 border-r border-border text-[10px] uppercase tracking-wider">Libres (rapport)</td>
                {visibleCols.map(i => (
                  <td key={i} className={cn("p-2 text-center text-blue", report.dateLabels[i].isWk && "bg-white/3")}>
                    {report.libresTotal[i]}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="sticky left-0 z-10 bg-surf1 p-2 border-r border-border text-[9px] text-text-dark">∑ libres/type</td>
                {visibleCols.map(i => (
                  <td key={i} className="p-1 text-center text-[9px]">
                    <span className={report.validation[i] ? "text-green" : "text-amber"}>
                      {report.validation[i] ? '✓' : report.libresTypeSumCheck[i]}
                    </span>
                  </td>
                ))}
              </tr>
            </>
          )}

          {/* Separator */}
          <tr><td colSpan={visibleCols.length + 1} className="h-1 bg-surf2 border-none" /></tr>

          {/* Occupées total */}
          {(filters.view === 'all' || filters.view === 'occupees') && (
            <tr className="bg-surf2/40 font-bold border-t-4 border-gold/40 h-14">
              <td className="sticky left-0 z-40 bg-surf2 p-4 border-r border-border uppercase text-[10px] tracking-widest text-gold-light font-black">
                Chambres occupées
              </td>
              {visibleCols.map(i => {
                const val = report.capaciteDay[i] - report.libresTotal[i];
                return <td key={i} className="p-2 text-center text-lg font-black text-text bg-gold/10">{val}</td>;
              })}
            </tr>
          )}

          {/* Taux */}
          {(filters.view === 'all' || filters.view === 'taux') && (
            <tr className="bg-surf1 font-bold border-t border-border/40 h-14">
              <td className="sticky left-0 z-40 bg-surf1 p-4 border-r border-border uppercase text-[9px] tracking-widest text-text-dim">
                Taux d'occupation
              </td>
              {visibleCols.map(i => {
                const rate = getOccupancyRate(report, i);
                const cls = getRateClass(rate, config);
                const colorMap = { high: 'bg-green text-bg', mid: 'bg-amber text-bg', low: 'bg-red text-bg' };
                return (
                  <td key={i} className="p-2 text-center">
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-black", colorMap[cls])}>
                      {rate.toFixed(0)}%
                    </span>
                  </td>
                );
              })}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
