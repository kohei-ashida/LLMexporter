/**
 * Centralized error handling utilities
 */

import * as vscode from 'vscode';

export enum ErrorType {
    FileSystem = 'FileSystem',
    Validation = 'Validation',
    Export = 'Export',
    Webview = 'Webview',
    Configuration = 'Configuration'
}

export interface ErrorContext {
    type: ErrorType;
    operation: string;
    filePath?: string;
    details?: any;
}

export class ExtensionError extends Error {
    constructor(
        message: string,
        public context: ErrorContext,
        public originalError?: Error
    ) {
        super(message);
        this.name = 'ExtensionError';
    }
}

export class ErrorHandler {
    private static outputChannel: vscode.OutputChannel;

    static initialize() {
        this.outputChannel = vscode.window.createOutputChannel('LLM Context Exporter');
    }

    static handleError(error: Error | ExtensionError, showToUser: boolean = true): void {
        const timestamp = new Date().toISOString();
        
        if (error instanceof ExtensionError) {
            this.logError(timestamp, error);
            
            if (showToUser) {
                this.showUserFriendlyError(error);
            }
        } else {
            // Handle generic errors
            const extensionError = new ExtensionError(
                error.message,
                {
                    type: ErrorType.FileSystem,
                    operation: 'unknown'
                },
                error
            );
            
            this.logError(timestamp, extensionError);
            
            if (showToUser) {
                this.showUserFriendlyError(extensionError);
            }
        }
    }

    private static logError(timestamp: string, error: ExtensionError): void {
        const logMessage = [
            `[${timestamp}] ERROR: ${error.message}`,
            `Type: ${error.context.type}`,
            `Operation: ${error.context.operation}`,
            error.context.filePath ? `File: ${error.context.filePath}` : '',
            error.context.details ? `Details: ${JSON.stringify(error.context.details)}` : '',
            error.originalError ? `Original Error: ${error.originalError.message}` : '',
            error.originalError?.stack ? `Stack: ${error.originalError.stack}` : '',
            '---'
        ].filter(line => line.length > 0).join('\n');

        this.outputChannel.appendLine(logMessage);
        console.error(logMessage);
    }

    private static showUserFriendlyError(error: ExtensionError): void {
        const userMessage = this.getUserFriendlyMessage(error);
        const actions = this.getErrorActions(error);

        if (actions.length > 0) {
            vscode.window.showErrorMessage(userMessage, ...actions).then(selection => {
                if (selection) {
                    this.handleErrorAction(selection, error);
                }
            });
        } else {
            vscode.window.showErrorMessage(userMessage);
        }
    }

    private static getUserFriendlyMessage(error: ExtensionError): string {
        switch (error.context.type) {
            case ErrorType.FileSystem:
                if (error.context.filePath) {
                    return `Failed to access file: ${error.context.filePath}. ${this.getFileSystemErrorHint(error)}`;
                }
                return `File system error: ${error.message}`;

            case ErrorType.Validation:
                return `Invalid configuration: ${error.message}`;

            case ErrorType.Export:
                return `Export failed: ${error.message}`;

            case ErrorType.Webview:
                return `Interface error: ${error.message}`;

            case ErrorType.Configuration:
                return `Configuration error: ${error.message}`;

            default:
                return `An error occurred: ${error.message}`;
        }
    }

    private static getFileSystemErrorHint(error: ExtensionError): string {
        const message = error.message.toLowerCase();
        
        if (message.includes('permission') || message.includes('access')) {
            return 'Please check file permissions.';
        }
        
        if (message.includes('not found') || message.includes('enoent')) {
            return 'The file may have been moved or deleted.';
        }
        
        if (message.includes('too large') || message.includes('size')) {
            return 'The file may be too large to process.';
        }
        
        return 'Please check if the file exists and is accessible.';
    }

    private static getErrorActions(error: ExtensionError): string[] {
        const actions: string[] = [];

        switch (error.context.type) {
            case ErrorType.FileSystem:
                actions.push('Show Output', 'Retry');
                break;

            case ErrorType.Export:
                actions.push('Show Output', 'Try Again');
                break;

            case ErrorType.Validation:
                actions.push('Reset to Defaults');
                break;

            default:
                actions.push('Show Output');
        }

        return actions;
    }

    private static handleErrorAction(action: string, error: ExtensionError): void {
        switch (action) {
            case 'Show Output':
                this.outputChannel.show();
                break;

            case 'Retry':
            case 'Try Again':
                // Could trigger a retry mechanism if implemented
                vscode.window.showInformationMessage('Please try the operation again.');
                break;

            case 'Reset to Defaults':
                // Could reset configuration to defaults
                vscode.window.showInformationMessage('Please check your configuration settings.');
                break;
        }
    }

    static createFileSystemError(operation: string, filePath: string, originalError: Error): ExtensionError {
        return new ExtensionError(
            `Failed to ${operation} file: ${originalError.message}`,
            {
                type: ErrorType.FileSystem,
                operation,
                filePath
            },
            originalError
        );
    }

    static createValidationError(field: string, value: any, reason: string): ExtensionError {
        return new ExtensionError(
            `Invalid ${field}: ${reason}`,
            {
                type: ErrorType.Validation,
                operation: 'validation',
                details: { field, value, reason }
            }
        );
    }

    static createExportError(operation: string, details?: any, originalError?: Error): ExtensionError {
        return new ExtensionError(
            `Export ${operation} failed: ${originalError?.message || 'Unknown error'}`,
            {
                type: ErrorType.Export,
                operation,
                details
            },
            originalError
        );
    }

    static createWebviewError(operation: string, details?: any): ExtensionError {
        return new ExtensionError(
            `Webview ${operation} failed`,
            {
                type: ErrorType.Webview,
                operation,
                details
            }
        );
    }

    static dispose(): void {
        if (this.outputChannel) {
            this.outputChannel.dispose();
        }
    }
}