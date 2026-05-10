import React, { useState, useEffect, useRef } from 'react';
import { logger, LogEntry } from '../utils/logger';
import { Terminal, Trash2, X, ChevronDown, ChevronUp, Download } from 'lucide-react';

export function LogPanel() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial fetch
    setLogs([...logger.getLogs()]);

    // Simple polling for logs (performance-friendly)
    const interval = setInterval(() => {
      const currentLogs = logger.getLogs();
      if (currentLogs.length !== logs.length) {
        setLogs([...currentLogs]);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [logs.length]);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  const handleClear = () => {
    logger.clear();
    setLogs([]);
  };

  const handleDownload = () => {
    const text = logs.map(l => {
      const dataStr = l.data ? `\nDATA: ${JSON.stringify(l.data, null, 2)}` : '';
      return `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.context}] ${l.message}${dataStr}`;
    }).join('\n---\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `topsys-debug-${new Date().toISOString().slice(0, 19)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-[99] p-3 bg-surf2 border border-border rounded-full text-text-dark hover:text-gold hover:border-gold transition-all shadow-xl"
        title="Ouvrir les logs de diagnostic"
      >
        <Terminal size={20} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 left-0 md:left-auto md:right-4 md:bottom-4 md:w-[600px] z-[100] bg-surf1 border-t md:border border-border md:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-surf2">
        <div className="flex items-center gap-2 text-text font-bold text-sm">
          <Terminal size={16} className="text-gold" />
          <span>Diagnostic Logs</span>
          <span className="text-[10px] bg-gold/10 text-gold px-1.5 rounded-full">{logs.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleDownload} className="p-1.5 text-text-dark hover:text-blue rounded-lg transition-colors" title="Télécharger">
            <Download size={14} />
          </button>
          <button onClick={handleClear} className="p-1.5 text-text-dark hover:text-red rounded-lg transition-colors" title="Effacer">
            <Trash2 size={14} />
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1.5 text-text-dark hover:text-white rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 font-mono text-[11px] space-y-2 bg-bg/50 custom-scrollbar">
        {logs.length === 0 && <div className="text-text-dark text-center py-8">Aucun log enregistré</div>}
        {logs.map((log, i) => (
          <div key={i} className="flex flex-col border-b border-white/[0.03] pb-2">
            <div className="flex gap-2">
              <span className="text-text-dark shrink-0">[{log.timestamp.split('T')[1].split('.')[0]}]</span>
              <span className={cn(
                "font-bold shrink-0 w-12",
                log.level === 'error' ? 'text-red' : log.level === 'warn' ? 'text-amber' : 'text-blue'
              )}>{log.level.toUpperCase()}</span>
              <span className="text-gold shrink-0">[{log.context}]</span>
              <span className="text-text-dim break-all">{log.message}</span>
            </div>
            {log.data && (
              <pre className="mt-1 ml-14 p-2 bg-black/30 rounded text-[9px] text-text-dark overflow-x-auto">
                {JSON.stringify(log.data, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
