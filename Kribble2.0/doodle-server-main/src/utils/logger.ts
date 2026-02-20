/**
 * Kribble 2.0 - Server-side Logger
 * Logs all socket events, room operations, game events, and errors
 * Logs are cleared on each server restart for fresh debugging
 */

import fs from 'fs';
import path from 'path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'event' | 'socket';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: unknown;
  stack?: string;
  socketId?: string;
  roomId?: string;
  userId?: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs: number = 5000;
  private componentName: string;
  private logFilePath: string;

  constructor(componentName: string) {
    this.componentName = componentName;
    this.logFilePath = path.join(process.cwd(), 'logs', `kribble-server-${new Date().toISOString().split('T')[0]}.log`);
    this.ensureLogDirectory();
    this.loadLogs();
  }

  private ensureLogDirectory(): void {
    const logDir = path.dirname(this.logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  private loadLogs(): void {
    // Clear logs on each server start (fresh log file)
    this.logs = [];
    this.info('Logger initialized - fresh logs for this session');
  }

  private saveLogs(): void {
    try {
      // Keep only last maxLogs entries in memory
      if (this.logs.length > this.maxLogs) {
        this.logs = this.logs.slice(-this.maxLogs);
      }
      
      // Append to log file
      const recentLogs = this.logs.slice(-100); // Save last 100 to file
      const logString = recentLogs.map(entry => this.formatEntry(entry)).join('\n');
      fs.appendFileSync(this.logFilePath, logString + '\n');
    } catch (e) {
      console.error('Failed to save logs:', e);
    }
  }

  private formatEntry(entry: LogEntry): string {
    let str = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.component}] ${entry.message}`;
    
    if (entry.socketId) {
      str += ` [Socket: ${entry.socketId}]`;
    }
    if (entry.roomId) {
      str += ` [Room: ${entry.roomId}]`;
    }
    if (entry.userId) {
      str += ` [User: ${entry.userId}]`;
    }
    
    if (entry.data) {
      str += `\n  Data: ${JSON.stringify(entry.data, null, 2)}`;
    }
    if (entry.stack) {
      str += `\n  Stack: ${entry.stack}`;
    }
    
    return str;
  }

  private sanitizeData(data: unknown): unknown {
    // Remove sensitive data
    if (typeof data === 'object' && data !== null) {
      const sanitized = { ...(data as Record<string, unknown>) };
      delete sanitized.password;
      delete sanitized.token;
      delete sanitized.authToken;
      delete sanitized.secret;
      return sanitized;
    }
    return data;
  }

  private createEntry(
    level: LogLevel, 
    message: string, 
    data?: unknown,
    meta?: { socketId?: string; roomId?: string; userId?: string }
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      component: this.componentName,
      message,
      data: data ? this.sanitizeData(data) : undefined,
      socketId: meta?.socketId,
      roomId: meta?.roomId,
      userId: meta?.userId,
    };
  }

  log(level: LogLevel, message: string, data?: unknown, meta?: { socketId?: string; roomId?: string; userId?: string }): void {
    const entry = this.createEntry(level, message, data, meta);
    this.logs.push(entry);
    this.saveLogs();

    // Console output with colors
    const colors = {
      debug: '\x1b[36m',    // Cyan
      info: '\x1b[32m',     // Green
      warn: '\x1b[33m',     // Yellow
      error: '\x1b[31m',    // Red
      event: '\x1b[35m',    // Magenta
      socket: '\x1b[34m',   // Blue
    };
    const reset = '\x1b[0m';

    let consoleStr = `${colors[level]}[${entry.timestamp}] [${this.componentName}] ${message}${reset}`;
    
    if (meta?.socketId) {
      consoleStr += ` [Socket: ${meta.socketId}]`;
    }
    if (meta?.roomId) {
      consoleStr += ` [Room: ${meta.roomId}]`;
    }

    console.log(consoleStr);
    if (data) {
      console.log('  Data:', data);
    }
  }

  debug(message: string, data?: unknown, meta?: { socketId?: string; roomId?: string; userId?: string }): void {
    this.log('debug', message, data, meta);
  }

  info(message: string, data?: unknown, meta?: { socketId?: string; roomId?: string; userId?: string }): void {
    this.log('info', message, data, meta);
  }

  warn(message: string, data?: unknown, meta?: { socketId?: string; roomId?: string; userId?: string }): void {
    this.log('warn', message, data, meta);
  }

  error(message: string, data?: unknown, meta?: { socketId?: string; roomId?: string; userId?: string }): void {
    const entry = this.createEntry('error', message, data, meta);
    entry.stack = new Error().stack;
    this.logs.push(entry);
    this.saveLogs();

    console.error(
      `\x1b[31m[${entry.timestamp}] [${this.componentName}] ERROR: ${message}\x1b[0m`,
      meta ? `[Socket: ${meta.socketId}, Room: ${meta.roomId}]` : ''
    );
    if (data) {
      console.error('  Data:', data);
    }
    if (entry.stack) {
      console.error('  Stack:', entry.stack);
    }
  }

  event(message: string, data?: unknown, meta?: { socketId?: string; roomId?: string; userId?: string }): void {
    this.log('event', message, data, meta);
  }

  // Socket-specific logging
  socketEmit(event: string, data?: unknown, socketId?: string): void {
    this.log('socket', `EMIT: ${event}`, data, { socketId });
  }

  socketOn(event: string, data?: unknown, socketId?: string): void {
    this.log('socket', `ON: ${event}`, data, { socketId });
  }

  socketConnect(socketId: string, userId?: string): void {
    this.log('socket', 'Client connected', { socketId, userId }, { socketId, userId });
  }

  socketDisconnect(socketId: string, reason: string): void {
    this.log('socket', `Client disconnected: ${reason}`, { socketId }, { socketId });
  }

  // Room operations
  roomCreated(roomId: string, hostId: string): void {
    this.log('event', 'Room created', { roomId, hostId }, { roomId, userId: hostId });
  }

  roomJoined(roomId: string, userId: string, playerCount: number): void {
    this.log('event', 'Player joined room', { roomId, userId, playerCount }, { roomId, userId });
  }

  roomLeft(roomId: string, userId: string, playerCount: number): void {
    this.log('event', 'Player left room', { roomId, userId, playerCount }, { roomId, userId });
  }

  // Game operations
  gameStarted(roomId: string, gameId: string): void {
    this.log('event', 'Game started', { roomId, gameId }, { roomId });
  }

  gameEnded(roomId: string, gameId: string): void {
    this.log('event', 'Game ended', { roomId, gameId }, { roomId });
  }

  turnStarted(roomId: string, drawerId: string, word: string): void {
    this.log('event', 'Turn started', { roomId, drawerId, word }, { roomId, userId: drawerId });
  }

  guessMade(roomId: string, userId: string, guess: string, correct: boolean): void {
    this.log('event', `Guess made: ${correct ? 'CORRECT' : 'INCORRECT'}`, { roomId, userId, guess, correct }, { roomId, userId });
  }

  // Get all logs
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  // Get logs as formatted string
  getLogsAsString(): string {
    return this.logs.map(entry => this.formatEntry(entry)).join('\n\n');
  }

  // Export logs to file
  exportLogs(filePath?: string): void {
    const exportPath = filePath || path.join(process.cwd(), 'logs', `export-${Date.now()}.log`);
    fs.writeFileSync(exportPath, this.getLogsAsString());
    console.log(`Logs exported to: ${exportPath}`);
  }

  // Clear all logs
  clearLogs(): void {
    this.logs = [];
    if (fs.existsSync(this.logFilePath)) {
      fs.writeFileSync(this.logFilePath, '');
    }
    console.log('Logs cleared');
  }
}

// Global logger instance
export const appLogger = new Logger('App');

// Factory function for component loggers
export const createLogger = (componentName: string): Logger => {
  return new Logger(componentName);
};

export default Logger;
