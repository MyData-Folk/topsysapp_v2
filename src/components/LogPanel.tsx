import React, { useState, useEffect, useRef, useCallback } from 'react';
import { logger, LogEntry } from '../utils/logger';
import { Terminal, Trash2, X, Download, Copy, Check } from 'lucide-react';

export function LogPanel() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLogs([...logger.getLogs()]);
    const interval = setInterval(() => {
      const currentLogs = logger.getLogs();
      if (currentLogs.length !== logs.length) {
        setLogs([...currentLogs]);
      }
    }, 500); // Polling plus rapide pour les diagnostics
    return () => clearInterval(interval);
  }, [logs.length]);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  const formatLogs = useCallback(() => {
    return logs.map(l => {
      const dataStr = l.data ? `\n  DATA: ${JSON.stringify(l.data, null, 2)}` : '';
      return `[${l.timestamp.split('T')[1].split('.')[0]}] [${l.level.toUpperCase().padEnd(5)}] [${l.context}] ${l.message}${dataStr}`;
    }).join('\n');
  }, [logs]);

  const handleClear = () => {
    logger.clear();
    setLogs([]);
  };

  const handleDownload = () => {
    const blob = new Blob([formatLogs()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `topsys-debug-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatLogs());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback pour les navigateurs sans API clipboard
      const ta = document.createElement('textarea');
      ta.value = formatLogs();
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Niveau max présent pour colorier le compteur
  const maxLevel = logs.some(l => l.level === 'error') ? 'error'
    : logs.some(l => l.level === 'warn') ? 'warn' : 'ok';

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
    <div className="fixed bottom-0 right-0 left-0 md:left-auto md:right-4 md:bottom-4 md:w-[640px] z-[100] bg-surf1 border-t md:border border-border md:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-surf2 shrink-0">
        <div className="flex items-center gap-2 text-text font-bold text-sm">
          <Terminal size={15} className="text-gold" />
          <span>Diagnostic Logs</span>
          <span className={cn(
            "text-[10px] px-1.5 py-0.5 rounded-full font-mono",
            maxLevel === 'error' ? 'bg-red/15 text-red' : maxLevel === 'warn' ? 'bg-amber/15 text-amber' : 'bg-blue/10 text-blue'
          )}>{logs.length}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleCopy}
            className={cn("p-1.5 rounded-lg transition-colors text-[11px] flex items-center gap-1",
              copied ? "text-green bg-green/10" : "text-text-dark hover:text-gold hover:bg-gold/10")}
            title="Copier tous les logs"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copié !' : 'Copier'}
          </button>
          <button onClick={handleDownload} className="p-1.5 text-text-dark hover:text-blue hover:bg-blue/10 rounded-lg transition-colors" title="Télécharger">
            <Download size={13} />
          </button>
          <button onClick={handleClear} className="p-1.5 text-text-dark hover:text-red hover:bg-red/10 rounded-lg transition-colors" title="Effacer">
            <Trash2 size={13} />
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1.5 text-text-dark hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 font-mono text-[11px] space-y-1.5 bg-bg/60 custom-scrollbar">
        {logs.length === 0 && <div className="text-text-dark text-center py-8">Aucun log enregistré</div>}
        {logs.map((log, i) => (
          <div key={i} className="flex flex-col border-b border-white/[0.03] pb-1.5">
            <div className="flex gap-2 items-start">
              <span className="text-text-dark/60 shrink-0 tabular-nums">{log.timestamp.split('T')[1].split('.')[0]}</span>
              <span className={cn(
                "font-bold shrink-0 w-[42px] text-[10px] uppercase",
                log.level === 'error' ? 'text-red' :
                log.level === 'warn'  ? 'text-amber' :
                log.level === 'info'  ? 'text-blue' : 'text-text-dark'
              )}>{log.level}</span>
              <span className="text-gold/80 shrink-0 text-[10px]">[{log.context}]</span>
              <span className="text-text-dim break-all leading-relaxed">{log.message}</span>
            </div>
            {log.data && (
              <pre className="mt-1 ml-[106px] p-2 bg-black/30 rounded text-[9px] text-text-dark/80 overflow-x-auto">
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
