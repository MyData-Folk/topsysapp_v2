import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { OccupancyData, AppConfig, HotelConfig } from '../types';
import { getOccupancyRate, getDayOccupied, getDayPrice } from '../utils/helpers';

interface ChartsProps {
  report: OccupancyData;
  config: AppConfig;
  hotel: HotelConfig;
  visibleCols: number[];
}

export function Charts({ report, config, hotel, visibleCols }: ChartsProps) {
  const occData = visibleCols.map(i => ({
    date: report.dateLabels[i].short,
    occ: Math.round(getOccupancyRate(report, i) * 100) / 100,
  }));

  const caData = visibleCols.map(i => ({
    date: report.dateLabels[i].short,
    revenue: getDayOccupied(report, i) * getDayPrice(report, i, hotel, config),
  }));

  const tooltipStyle = {
    backgroundColor: 'var(--theme-surf1)',
    border: '1px solid var(--theme-border)',
    borderRadius: '12px',
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-surf1 border border-border p-4 md:p-5 rounded-2xl overflow-x-auto custom-scrollbar">
        <h3 className="text-[10px] font-bold text-text-dark uppercase tracking-widest mb-6 flex items-center gap-2">
          <TrendingUp size={12} className="text-gold" /> Taux d'occupation (%)
        </h3>
        <div className="h-[230px] min-w-[420px] md:h-[250px] md:min-w-0 md:w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <AreaChart data={occData}>
              <defs>
                <linearGradient id="colorOcc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--theme-gold)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--theme-gold)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-border)" vertical={false} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'var(--theme-text-dark)', fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--theme-text-dark)', fontSize: 10 }} domain={[0, 100]} />
              <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'var(--theme-gold)', fontSize: '12px' }} labelStyle={{ color: 'var(--theme-text-dim)', fontSize: '10px' }} />
              <Area type="monotone" dataKey="occ" stroke="var(--theme-gold)" fillOpacity={1} fill="url(#colorOcc)" strokeWidth={2} name="Taux %" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-surf1 border border-border p-4 md:p-5 rounded-2xl overflow-x-auto custom-scrollbar">
        <h3 className="text-[10px] font-bold text-text-dark uppercase tracking-widest mb-6 flex items-center gap-2">
          <BarChart3 size={12} className="text-blue" /> CA journalier ({config.currency})
        </h3>
        <div className="h-[230px] min-w-[420px] md:h-[250px] md:min-w-0 md:w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <LineChart data={caData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-border)" vertical={false} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'var(--theme-text-dark)', fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--theme-text-dark)', fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'var(--theme-blue)', fontSize: '12px' }} labelStyle={{ color: 'var(--theme-text-dim)', fontSize: '10px' }} />
              <Line type="monotone" dataKey="revenue" stroke="var(--theme-blue)" strokeWidth={2} dot={{ r: 3, fill: 'var(--theme-blue)', strokeWidth: 0 }} name={`CA (${config.currency})`} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
