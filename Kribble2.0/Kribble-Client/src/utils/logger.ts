/**
 * Kribble 2.0 - Client-side Logger
 * Logs all component events, socket events, and errors
 * Logs are cleared on each app start for fresh debugging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'event';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: unknown;
  stack?: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private componentName: string;

  constructor(componentName: string) {
    this.componentName = componentName;
    this.loadLogs();
  }

  private loadLogs(): void {
    // Clear logs on each app start (don't load from storage)
    this.logs = [];
    this.saveLogs();
  }

  private saveLogs(): void {
    try {
      // Keep only last maxLogs entries
      if (this.logs.length > this.maxLogs) {
        this.logs = this.logs.slice(-this.maxLogs);
      }
      localStorage.setItem('kribble_logs', JSON.stringify(this.logs));
    } catch (e) {
      console.error('Failed to save logs:', e);
    }
  }

  private createEntry(level: LogLevel, message: string, data?: unknown): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      component: this.componentName,
      message,
      data: data ? this.sanitizeData(data) : undefined,
    };
  }

  private sanitizeData(data: unknown): unknown {
    // Remove sensitive data like passwords, tokens
    if (typeof data === 'object' && data !== null) {
      const sanitized = { ...data as Record<string, unknown> };
      delete sanitized.password;
      delete sanitized.token;
      delete sanitized.authToken;
      delete sanitized.secret;
      return sanitized;
    }
    return data;
  }

  log(level: LogLevel, message: string, data?: unknown): void {
    const entry = this.createEntry(level, message, data);
    this.logs.push(entry);
    this.saveLogs();

    // Also log to console with styling
    const styles = {
      debug: 'color: #6c757d',
      info: 'color: #17a2b8',
      warn: 'color: #ffc107',
      error: 'color: #dc3545; font-weight: bold',
      event: 'color: #28a745',
    };

    console.log(
      `%c[${entry.timestamp}] [${this.componentName}] ${message}`,
      styles[level]
    );
    if (data) {
      console.log('Data:', data);
    }
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    const entry = this.createEntry('error', message, data);
    entry.stack = new Error().stack;
    this.logs.push(entry);
    this.saveLogs();

    console.error(
      `%c[${entry.timestamp}] [${this.componentName}] ERROR: ${message}`,
      'color: #dc3545; font-weight: bold'
    );
    if (data) {
      console.error('Data:', data);
    }
    if (entry.stack) {
      console.error('Stack:', entry.stack);
    }
  }

  event(message: string, data?: unknown): void {
    this.log('event', message, data);
  }

  // Socket event logging
  socketEmit(event: string, data?: unknown): void {
    this.log('event', `Socket EMIT: ${event}`, data);
  }

  socketOn(event: string, data?: unknown): void {
    this.log('event', `Socket ON: ${event}`, data);
  }

  // Get all logs
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  // Get logs as formatted string
  getLogsAsString(): string {
    return this.logs.map(entry => {
      let str = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.component}] ${entry.message}`;
      if (entry.data) {
        str += `\n  Data: ${JSON.stringify(entry.data, null, 2)}`;
      }
      if (entry.stack) {
        str += `\n  Stack: ${entry.stack}`;
      }
      return str;
    }).join('\n\n');
  }

  // Download logs as file
  downloadLogs(): void {
    const blob = new Blob([this.getLogsAsString()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kribble-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Clear all logs
  clearLogs(): void {
    this.logs = [];
    this.saveLogs();
    console.log('Logs cleared');
  }
}

// Global logger instance for app-level logging
export const appLogger = new Logger('App');

// Factory function for component loggers
export const createLogger = (componentName: string): Logger => {
  return new Logger(componentName);
};

export default Logger;
