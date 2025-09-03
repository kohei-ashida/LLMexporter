/**
 * Service for managing extension configuration and settings
 */

import * as vscode from 'vscode';
import { ExportConfiguration } from '../types';
import { validateExportConfiguration } from '../validation';
import { Logger } from '../utils/Logger';

export class ConfigurationService {
    private static readonly CONFIG_SECTION = 'llmContextExporter';
    private static readonly SESSION_STATE_KEY = 'llmContextExporter.sessionState';

    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Get default export configuration from VSCode settings
     */
    getDefaultExportConfiguration(): ExportConfiguration {
        const config = vscode.workspace.getConfiguration(ConfigurationService.CONFIG_SECTION);
        
        const defaultConfig: Partial<ExportConfiguration> = {
            format: config.get<'txt' | 'md'>('defaultFormat', 'md'),
            outputMethod: config.get<'file' | 'clipboard'>('defaultOutputMethod', 'file'),
            includeDirectoryStructure: config.get<boolean>('includeDirectoryStructure', true),
            maxFileSize: config.get<number>('maxFileSize', 1024) * 1024, // Convert KB to bytes
            excludePatterns: config.get<string[]>('excludePatterns', [
                'node_modules/**',
                '.git/**',
                'dist/**',
                'build/**',
                '*.log'
            ]),
            includePatterns: config.get<string[]>('includePatterns', []),
            truncateThreshold: config.get<number>('truncateThreshold', 10240) * 1024 // Convert KB to bytes
        };

        try {
            return validateExportConfiguration(defaultConfig);
        } catch (error) {
            Logger.warn('Invalid default configuration, using fallback', error);
            return this.getFallbackConfiguration();
        }
    }

    /**
     * Get fallback configuration when default config is invalid
     */
    private getFallbackConfiguration(): ExportConfiguration {
        return {
            format: 'md',
            outputMethod: 'file',
            includeDirectoryStructure: true,
            maxFileSize: 1024 * 1024, // 1MB
            excludePatterns: ['node_modules/**', '.git/**'],
            includePatterns: [],
            truncateThreshold: 10 * 1024 * 1024 // 10MB
        };
    }

    /**
     * Get configuration presets for common use cases
     */
    getConfigurationPresets(): { [name: string]: ExportConfiguration } {
        return {
            'minimal': {
                format: 'txt',
                outputMethod: 'file',
                includeDirectoryStructure: false,
                maxFileSize: 512 * 1024, // 512KB
                excludePatterns: [
                    'node_modules/**',
                    '.git/**',
                    'dist/**',
                    'build/**',
                    'out/**',
                    '*.log',
                    '*.map',
                    'coverage/**',
                    '.nyc_output/**'
                ],
                includePatterns: ['*.ts', '*.js', '*.json', '*.md'],
                truncateThreshold: 5 * 1024 * 1024 // 5MB
            },
            'comprehensive': {
                format: 'md',
                outputMethod: 'file',
                includeDirectoryStructure: true,
                maxFileSize: 2 * 1024 * 1024, // 2MB
                excludePatterns: [
                    'node_modules/**',
                    '.git/**',
                    '*.log'
                ],
                includePatterns: [],
                truncateThreshold: 20 * 1024 * 1024 // 20MB
            },
            'documentation': {
                format: 'md',
                outputMethod: 'file',
                includeDirectoryStructure: true,
                maxFileSize: 1024 * 1024, // 1MB
                excludePatterns: [
                    'node_modules/**',
                    '.git/**',
                    'dist/**',
                    'build/**',
                    'src/**',
                    'lib/**'
                ],
                includePatterns: ['*.md', '*.txt', '*.rst', 'README*', 'CHANGELOG*', 'LICENSE*'],
                truncateThreshold: 10 * 1024 * 1024 // 10MB
            },
            'source-only': {
                format: 'md',
                outputMethod: 'file',
                includeDirectoryStructure: true,
                maxFileSize: 1024 * 1024, // 1MB
                excludePatterns: [
                    'node_modules/**',
                    '.git/**',
                    'dist/**',
                    'build/**',
                    'out/**',
                    '*.log',
                    '*.map',
                    'coverage/**',
                    'docs/**',
                    '*.md',
                    '*.txt'
                ],
                includePatterns: [
                    '*.ts',
                    '*.js',
                    '*.tsx',
                    '*.jsx',
                    '*.py',
                    '*.java',
                    '*.c',
                    '*.cpp',
                    '*.h',
                    '*.hpp',
                    '*.cs',
                    '*.go',
                    '*.rs',
                    '*.php',
                    '*.rb'
                ],
                truncateThreshold: 15 * 1024 * 1024 // 15MB
            }
        };
    }

    /**
     * Save session state (selected files, current configuration, etc.)
     */
    saveSessionState(state: SessionState): void {
        try {
            this.context.workspaceState.update(ConfigurationService.SESSION_STATE_KEY, state);
            Logger.debug('Session state saved', state);
        } catch (error) {
            Logger.error('Failed to save session state', error as Error);
        }
    }

    /**
     * Load session state
     */
    loadSessionState(): SessionState | undefined {
        try {
            const state = this.context.workspaceState.get<SessionState>(ConfigurationService.SESSION_STATE_KEY);
            Logger.debug('Session state loaded', state);
            return state;
        } catch (error) {
            Logger.error('Failed to load session state', error as Error);
            return undefined;
        }
    }

    /**
     * Clear session state
     */
    clearSessionState(): void {
        try {
            this.context.workspaceState.update(ConfigurationService.SESSION_STATE_KEY, undefined);
            Logger.debug('Session state cleared');
        } catch (error) {
            Logger.error('Failed to clear session state', error as Error);
        }
    }

    /**
     * Validate and migrate configuration if needed
     */
    validateAndMigrateConfiguration(config: Partial<ExportConfiguration>): ExportConfiguration {
        try {
            // Try to validate as-is first
            return validateExportConfiguration(config);
        } catch (error) {
            Logger.warn('Configuration validation failed, attempting migration', error);
            
            // Attempt to migrate/fix common issues
            const migratedConfig = this.migrateConfiguration(config);
            
            try {
                return validateExportConfiguration(migratedConfig);
            } catch (migrationError) {
                Logger.error('Configuration migration failed, using defaults', migrationError as Error);
                return this.getDefaultExportConfiguration();
            }
        }
    }

    /**
     * Migrate configuration from older versions
     */
    private migrateConfiguration(config: Partial<ExportConfiguration>): Partial<ExportConfiguration> {
        const migrated = { ...config };

        // Fix invalid format values
        if (migrated.format && !['txt', 'md'].includes(migrated.format)) {
            Logger.info(`Migrating invalid format '${migrated.format}' to 'md'`);
            migrated.format = 'md';
        }

        // Fix invalid outputMethod values
        if (migrated.outputMethod && !['file', 'clipboard'].includes(migrated.outputMethod)) {
            Logger.info(`Migrating invalid outputMethod '${migrated.outputMethod}' to 'file'`);
            migrated.outputMethod = 'file';
        }

        // Fix negative or zero values
        if (migrated.maxFileSize !== undefined && migrated.maxFileSize <= 0) {
            Logger.info(`Migrating invalid maxFileSize '${migrated.maxFileSize}' to default`);
            migrated.maxFileSize = 1024 * 1024;
        }

        if (migrated.truncateThreshold !== undefined && migrated.truncateThreshold <= 0) {
            Logger.info(`Migrating invalid truncateThreshold '${migrated.truncateThreshold}' to default`);
            migrated.truncateThreshold = 10 * 1024 * 1024;
        }

        // Fix invalid pattern arrays
        if (migrated.excludePatterns && !Array.isArray(migrated.excludePatterns)) {
            Logger.info('Migrating invalid excludePatterns to empty array');
            migrated.excludePatterns = [];
        }

        if (migrated.includePatterns && !Array.isArray(migrated.includePatterns)) {
            Logger.info('Migrating invalid includePatterns to empty array');
            migrated.includePatterns = [];
        }

        return migrated;
    }

    /**
     * Watch for configuration changes
     */
    onConfigurationChanged(callback: (config: ExportConfiguration) => void): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration(ConfigurationService.CONFIG_SECTION)) {
                Logger.info('Configuration changed, reloading defaults');
                const newConfig = this.getDefaultExportConfiguration();
                callback(newConfig);
            }
        });
    }

    /**
     * Get default preset name from settings
     */
    getDefaultPreset(): string | undefined {
        const config = vscode.workspace.getConfiguration(ConfigurationService.CONFIG_SECTION);
        const defaultPreset = config.get<string>('defaultPreset');
        return defaultPreset && defaultPreset.trim() !== '' ? defaultPreset : undefined;
    }

    /**
     * Check if session state should be remembered
     */
    shouldRememberSelections(): boolean {
        const config = vscode.workspace.getConfiguration(ConfigurationService.CONFIG_SECTION);
        return config.get<boolean>('rememberSelections', true);
    }

    /**
     * Get user-friendly configuration summary
     */
    getConfigurationSummary(config: ExportConfiguration): string {
        const sizeInKB = Math.round(config.maxFileSize / 1024);
        const thresholdInMB = Math.round(config.truncateThreshold / (1024 * 1024));
        
        const parts = [
            `Format: ${config.format.toUpperCase()}`,
            `Output: ${config.outputMethod === 'clipboard' ? 'Clipboard' : 'File'}`,
            `Max file size: ${sizeInKB} KB`,
            `Truncate threshold: ${thresholdInMB} MB`,
            `Directory structure: ${config.includeDirectoryStructure ? 'Yes' : 'No'}`
        ];

        if (config.excludePatterns.length > 0) {
            parts.push(`Exclude patterns: ${config.excludePatterns.length}`);
        }

        if (config.includePatterns.length > 0) {
            parts.push(`Include patterns: ${config.includePatterns.length}`);
        }

        return parts.join(', ');
    }
}

export interface SessionState {
    selectedPaths: string[];
    lastConfiguration: ExportConfiguration;
    lastExportPath?: string;
    timestamp: number;
}