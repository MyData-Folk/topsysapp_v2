import { supabase } from '../lib/supabaseClient';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: any;
}

const LOG_KEY = 'topsys_debug_logs';
const MAX_LOGS = 200;

class Logger {
  private logs: LogEntry[] = [];

  constructor() {
    const saved = localStorage.getItem(LOG_KEY);
    if (saved) {
      try {
        this.logs = JSON.parse(saved);
      } catch {
        this.logs = [];
      }
    }
  }

  private addLog(level: LogLevel, context: string, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      data: data ? this.sanitizeData(data) : undefined
    };

    this.logs.push(entry);
    if (this.logs.length > MAX_LOGS) this.logs.shift();
    localStorage.setItem(LOG_KEY, JSON.stringify(this.logs));
    
    if (process.env.NODE_ENV !== 'production') {
      const color = level === 'error' ? 'red' : level === 'warn' ? 'orange' : level === 'debug' ? 'gray' : 'blue';
      console.log(`%c[${context}] ${message}`, `color: ${color}`, data || '');
    }

    // Envoi silencieux de TOUS les logs vers le Cloud pour l'Admin
    if (supabase) {
      this.pushToCloud(entry);
    }
  }

  private async pushToCloud(entry: LogEntry) {
    try {
      const { data: { user } } = await supabase!.auth.getUser();
      if (!user) return;

      await supabase!
        .from('app_logs')
        .insert({
          user_id: user.id,
          user_email: user.email,
          level: entry.level,
          context: entry.context,
          message: entry.message,
          metadata: entry.data || {}
        });
    } catch { /* Silent fail for logs */ }
  }

  private sanitizeData(data: any): any {
    try {
      return JSON.parse(JSON.stringify(data));
    } catch {
      return '[Data non sérialisable]';
    }
  }

  debug(context: string, message: string, data?: any) { this.addLog('debug', context, message, data); }
  info(context: string, message: string, data?: any) { this.addLog('info', context, message, data); }
  warn(context: string, message: string, data?: any) { this.addLog('warn', context, message, data); }
  error(context: string, message: string, data?: any) { this.addLog('error', context, message, data); }

  clear() {
    this.logs = [];
    localStorage.removeItem(LOG_KEY);
  }

  getLogs() { return this.logs; }

  exportReport() {
    const report = {
      app: 'TopsysExplorer V2 (Debug Mode)',
      userAgent: navigator.userAgent,
      time: new Date().toISOString(),
      logs: this.logs
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `topsys-report-${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export const logger = new Logger();
