/**
 * Logging utility for the extension
 */

import * as vscode from 'vscode';

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

export class Logger {
    private static outputChannel: vscode.OutputChannel;
    private static logLevel: LogLevel = LogLevel.INFO;

    static initialize(channelName: string = 'LLM Context Exporter') {
        this.outputChannel = vscode.window.createOutputChannel(channelName);
        
        // Get log level from configuration
        const config = vscode.workspace.getConfiguration('llmContextExporter');
        const configLevel = config.get<string>('logLevel', 'info');
        this.logLevel = this.parseLogLevel(configLevel);
    }

    private static parseLogLevel(level: string): LogLevel {
        switch (level.toLowerCase()) {
            case 'debug': return LogLevel.DEBUG;
            case 'info': return LogLevel.INFO;
            case 'warn': return LogLevel.WARN;
            case 'error': return LogLevel.ERROR;
            default: return LogLevel.INFO;
        }
    }

    static debug(message: string, ...args: any[]): void {
        this.log(LogLevel.DEBUG, message, ...args);
    }

    static info(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, message, ...args);
    }

    static warn(message: string, ...args: any[]): void {
        this.log(LogLevel.WARN, message, ...args);
    }

    static error(message: string, error?: Error, ...args: any[]): void {
        if (error) {
            this.log(LogLevel.ERROR, `${message}: ${error.message}`, error.stack, ...args);
        } else {
            this.log(LogLevel.ERROR, message, ...args);
        }
    }

    private static log(level: LogLevel, message: string, ...args: any[]): void {
        if (level < this.logLevel) {
            return;
        }

        const timestamp = new Date().toISOString();
        const levelName = LogLevel[level];
        const formattedMessage = `[${timestamp}] [${levelName}] ${message}`;

        // Log to output channel
        if (this.outputChannel) {
            this.outputChannel.appendLine(formattedMessage);
            
            if (args.length > 0) {
                args.forEach(arg => {
                    if (typeof arg === 'object') {
                        this.outputChannel.appendLine(JSON.stringify(arg, null, 2));
                    } else {
                        this.outputChannel.appendLine(String(arg));
                    }
                });
            }
        }

        // Also log to console for development
        switch (level) {
            case LogLevel.DEBUG:
                console.debug(formattedMessage, ...args);
                break;
            case LogLevel.INFO:
                console.info(formattedMessage, ...args);
                break;
            case LogLevel.WARN:
                console.warn(formattedMessage, ...args);
                break;
            case LogLevel.ERROR:
                console.error(formattedMessage, ...args);
                break;
        }
    }

    static show(): void {
        if (this.outputChannel) {
            this.outputChannel.show();
        }
    }

    static dispose(): void {
        if (this.outputChannel) {
            this.outputChannel.dispose();
        }
    }
}