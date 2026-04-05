import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log file path
const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'development.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Clear log file on startup (only in development)
if (process.env.NODE_ENV !== 'production') {
  const timestamp = new Date().toISOString();
  fs.writeFileSync(LOG_FILE, `[${timestamp}] === LOG STARTED - Kribble Server ===\n`);
  console.log(`[Logger] Log file cleared: ${LOG_FILE}`);
}

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'TRACE';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  action: string;
  details?: any;
  userId?: string;
  sessionId?: string;
  duration?: number;
  error?: Error;
}

class Logger {
  private static instance: Logger;
  private logFile: string;

  private constructor() {
    this.logFile = LOG_FILE;
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatEntry(entry: LogEntry): string {
    const base = `[${entry.timestamp}] [${entry.level}] [${entry.component}] ${entry.action}`;
    
    let details = '';
    if (entry.userId) details += ` | User: ${entry.userId}`;
    if (entry.sessionId) details += ` | Session: ${entry.sessionId}`;
    if (entry.duration) details += ` | Duration: ${entry.duration}ms`;
    if (entry.details) {
      try {
        const detailStr = typeof entry.details === 'object' 
          ? JSON.stringify(entry.details, null, 2) 
          : String(entry.details);
        details += ` | Details: ${detailStr}`;
      } catch (e) {
        details += ` | Details: [Object]`;
      }
    }
    if (entry.error) {
      details += ` | Error: ${entry.error.message}\n${entry.error.stack}`;
    }
    
    return base + details + '\n';
  }

  private write(entry: LogEntry): void {
    const formatted = this.formatEntry(entry);
    
    // Write to file
    fs.appendFileSync(this.logFile, formatted);
    
    // Also console log for development
    const consoleMethod = entry.level === 'ERROR' ? console.error 
      : entry.level === 'WARN' ? console.warn 
      : console.log;
    consoleMethod(`[${entry.level}] ${entry.component}: ${entry.action}`);
  }

  // Public logging methods
  info(component: string, action: string, details?: any, userId?: string): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      component,
      action,
      details,
      userId
    });
  }

  warn(component: string, action: string, details?: any, userId?: string): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: 'WARN',
      component,
      action,
      details,
      userId
    });
  }

  error(component: string, action: string, error: Error, details?: any, userId?: string): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      component,
      action,
      details,
      userId,
      error
    });
  }

  debug(component: string, action: string, details?: any, userId?: string): void {
    if (process.env.DEBUG === 'true') {
      this.write({
        timestamp: new Date().toISOString(),
        level: 'DEBUG',
        component,
        action,
        details,
        userId
      });
    }
  }

  trace(component: string, action: string, details?: any, userId?: string, sessionId?: string): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: 'TRACE',
      component,
      action,
      details,
      userId,
      sessionId
    });
  }

  // Performance logging
  perf(component: string, action: string, duration: number, details?: any, userId?: string): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      component,
      action: `PERF: ${action}`,
      details,
      userId,
      duration
    });
  }

  // API request logging
  apiRequest(method: string, path: string, userId?: string, body?: any, ip?: string): void {
    this.trace('API', `${method} ${path}`, { body, ip }, userId);
  }

  apiResponse(method: string, path: string, statusCode: number, duration: number, userId?: string): void {
    this.perf('API', `${method} ${path} - ${statusCode}`, duration, { statusCode }, userId);
  }

  // Socket event logging
  socketEvent(event: string, socketId: string, data?: any, roomId?: string): void {
    this.trace('SOCKET', event, { data, roomId }, undefined, socketId);
  }

  // Database operation logging
  dbQuery(operation: string, table: string, duration: number, details?: any): void {
    this.perf('DB', `${operation} ${table}`, duration, details);
  }

  // Game state logging
  gameState(roomId: string, action: string, state?: any): void {
    this.info('GAME', action, { roomId, state });
  }

  // User action logging
  userAction(userId: string, action: string, details?: any, ip?: string): void {
    this.info('USER', action, { ...details, ip }, userId);
  }
}

export const logger = Logger.getInstance();
export default logger;
