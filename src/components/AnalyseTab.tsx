import { useState, useMemo } from 'react';
import { Download, FileText, TrendingUp, Bed, CheckCircle2, Euro, Users, Calendar, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { OccupancyData, AppConfig, HotelConfig, FilterState } from '../types';
import { useFilteredData } from '../hooks/useFilteredData';
import { downloadBlob } from '../utils/helpers';
import { cn } from '../utils/cn';
import { KPICard } from './KPICard';
import { FilterBar } from './FilterBar';
import { Charts } from './Charts';
import { OccupancyTable } from './OccupancyTable';
import { DayInspector } from './DayInspector';
import { PdfViewer } from './PdfViewer';

interface AnalyseTabProps {
  report: OccupancyData | null;
  config: AppConfig;
  hotel: HotelConfig;
  filters: FilterState;
  pdfFile: File | null;
  onFiltersChange: (f: FilterState) => void;
  onResetFilters: () => void;
  onShowToast: (msg: string, type?: 'ok' | 'error') => void;
}

export function AnalyseTab({ report, config, hotel, filters, pdfFile, onFiltersChange, onResetFilters, onShowToast }: AnalyseTabProps) {
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);
  const [tableFontSize, setTableFontSize] = useState(11);
  const [viewingPdf, setViewingPdf] = useState(false);

  const { visibleCols, kpis } = useFilteredData(report, filters, config, hotel);

  const invalidDays = useMemo(() => {
    if (!report) return [];
    return report.dateLabels.filter((_, i) => report.validation[i] === false);
  }, [report]);

  if (!report) {
    return (
      <div className="text-center py-24 opacity-40">
        <TrendingUp size={64} className="mx-auto mb-4" />
        <p>Aucun rapport chargé. Importez un fichier PDF Topsys.</p>
      </div>
    );
  }

  const exportExcel = () => {
    const rows: (string | number)[][] = [
      ['Catégorie', 'Description', 'Cap.', 'Label', ...visibleCols.map(i => report.dateLabels[i].full)],
    ];
    hotel.types.forEach(t => {
      rows.push([t.code, t.description, t.capacity, t.label, ...visibleCols.map(i => report.occupied[t.code]?.[i] || 0)]);
      rows.push([`↳ Libres ${t.label}`, '', '', '', ...visibleCols.map(i => report.libresType[t.code]?.[i] || 0)]);
    });
    rows.push(['TOTAL Libres PDF', '', '', '', ...visibleCols.map(i => report.libresTotal[i])]);
    rows.push(['Occupées Total', '', '', '', ...visibleCols.map(i => report.capaciteDay[i] - report.libresTotal[i])]);
    rows.push(['Taux', '', '', '', ...visibleCols.map(i => {
      const cap = report.capaciteDay[i];
      return cap > 0 ? ((cap - report.libresTotal[i]) / cap * 100).toFixed(1) + '%' : '0%';
    })]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 8 }, { wch: 8 }, ...visibleCols.map(() => ({ wch: 13 }))];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Occupation');
    XLSX.writeFile(wb, `${config.xlsxName}.xlsx`);
    onShowToast('Export Excel téléchargé');
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${report.fileName.replace('.pdf', '')}_data.json`);
    onShowToast('Export JSON téléchargé');
  };

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      {/* Lateral filter sidebar */}
      <FilterBar filters={filters} report={report} config={config} hotel={hotel} onFiltersChange={onFiltersChange} onReset={onResetFilters} />

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Validation warning banner */}
        {invalidDays.length > 0 && (
          <div className="flex items-start gap-3 p-4 bg-amber/10 border border-amber/30 rounded-2xl text-amber text-xs">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Données incohérentes détectées — </span>
              {invalidDays.length} jour{invalidDays.length > 1 ? 's' : ''} où la somme des libres par type ne correspond pas au total PDF :{' '}
              <span className="font-mono">{invalidDays.map(d => d.day).join(', ')}</span>.
              Consultez la ligne <em>∑ libres/type</em> dans le tableau pour le détail.
            </div>
          </div>
        )}

        {/* Report info banner */}
        {report.establishmentName && (
          <div className="flex flex-col gap-3 p-4 bg-gold/5 border border-gold/10 rounded-2xl md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3 md:gap-4">
              <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center text-gold">
                <TrendingUp size={20} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-text uppercase tracking-wider truncate">{report.establishmentName}</div>
                <div className="text-[10px] text-text-dark truncate">{report.establishmentAddress || ''}</div>
              </div>
            </div>
            <div className="text-left md:text-right">
              <div className="text-[10px] font-bold text-text-dark uppercase tracking-widest">Période</div>
              <div className="text-xs text-gold font-bold">{report.periodStr}</div>
              {report.editionDate && <div className="text-[9px] text-text-dark mt-1">Édité le {report.editionDate}</div>}
            </div>
          </div>
        )}

        {/* KPIs */}
        {kpis ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              <KPICard label="Taux d'occupation" value={`${kpis.avgRate.toFixed(1)}%`} sub={`Moyenne sur ${kpis.daysCount} jours`} icon={TrendingUp} color="gold" />
              <KPICard label="Nuitées vendues" value={`${kpis.totalOcc.toLocaleString('fr')}`} sub="Chambres total occupées" icon={Bed} color="gold" />
              <KPICard label="Chambres libres" value={`${kpis.totalLibres.toLocaleString('fr')}`} sub="Total disponibles" icon={CheckCircle2} color="blue" />
              <KPICard label="Chiffre d'affaires" value={`${kpis.totalCA.toLocaleString('fr')} ${config.currency}`} sub={config.useAveragePriceForRevenue ? 'Prix fixe' : 'Prix rapport'} icon={Euro} color="blue" />
              <KPICard label="RevPAR" value={`${kpis.revpar.toLocaleString('fr')} ${config.currency}`} sub="Revenu par chambre dispo" icon={Users} color="green" />
              <KPICard label="Pic d'activité" value={`${kpis.peakRate.toFixed(1)}%`} sub={kpis.peakDay} icon={Calendar} color="amber" />
            </div>

            {/* Export buttons */}
            <div className="flex flex-wrap gap-3 md:gap-4">
              <button onClick={exportExcel} className="px-4 py-2 bg-surf2 border border-border text-text-dim text-xs font-bold rounded-xl hover:bg-surf3 transition-all flex items-center gap-2">
                <Download size={14} /> EXPORTER XLS
              </button>
              <button onClick={exportJson} className="px-4 py-2 bg-surf2 border border-border text-text-dim text-xs font-bold rounded-xl hover:bg-surf3 transition-all flex items-center gap-2">
                <FileText size={14} /> EXPORTER JSON
              </button>
            </div>

            {/* Charts */}
            <Charts report={report} config={config} hotel={hotel} visibleCols={visibleCols} />

            {/* Table */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-sm font-bold flex-1">Tableau d'occupation</h3>
                {pdfFile && (
                  <button onClick={() => setViewingPdf(true)} className="flex items-center gap-2 px-3 py-1.5 bg-gold/10 border border-gold/20 hover:bg-gold/20 text-gold rounded-lg text-[10px] font-bold uppercase">
                    <FileText size={14} /> VOIR PDF
                  </button>
                )}
                <div className="flex p-1 bg-surf2 rounded-lg border border-border">
                  <button onClick={() => setTableFontSize(11)} className={cn("px-3 py-1 rounded text-[10px] font-bold", tableFontSize === 11 ? "bg-surf3 text-text" : "text-text-dark")}>A</button>
                  <button onClick={() => setTableFontSize(14)} className={cn("px-3 py-1 rounded text-[10px] font-bold", tableFontSize === 14 ? "bg-surf3 text-text" : "text-text-dark")}>A+</button>
                </div>
              </div>
              <OccupancyTable
                report={report}
                config={config}
                hotel={hotel}
                filters={filters}
                visibleCols={visibleCols}
                fontSize={tableFontSize}
                selectedDayIdx={selectedDayIdx}
                onDayClick={setSelectedDayIdx}
              />
            </div>
          </>
        ) : (
          <div className="bg-amber/10 border border-amber/20 rounded-2xl p-8 text-center text-amber">
            Aucune colonne visible avec les filtres actuels.
          </div>
        )}

        {/* Day Inspector */}
        <DayInspector
          report={report}
          initialIndex={selectedDayIdx}
          hotel={hotel}
          config={config}
          onClose={() => setSelectedDayIdx(null)}
        />

        {/* PDF Viewer */}
        {viewingPdf && <PdfViewer file={pdfFile} fileName={report.fileName} onClose={() => setViewingPdf(false)} />}
      </div>
    </div>
  );
}
