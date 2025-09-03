/**
 * Tests for ConfigurationService
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { ConfigurationService, SessionState } from '../../services/ConfigurationService';
import { ExportConfiguration } from '../../types';

suite('ConfigurationService Tests', () => {
    let configurationService: ConfigurationService;
    let mockContext: vscode.ExtensionContext;

    setup(() => {
        // Create mock extension context
        mockContext = {
            workspaceState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                keys: () => []
            },
            globalState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                setKeysForSync: () => {},
                keys: () => []
            },
            subscriptions: [],
            extensionUri: vscode.Uri.file('/test'),
            extensionPath: '/test',
            asAbsolutePath: (relativePath: string) => `/test/${relativePath}`,
            storageUri: vscode.Uri.file('/test/storage'),
            globalStorageUri: vscode.Uri.file('/test/global'),
            logUri: vscode.Uri.file('/test/log'),
            extensionMode: vscode.ExtensionMode.Test,
            secrets: {} as any,
            environmentVariableCollection: {} as any,
            extension: {} as any,
            logPath: '/test/log',
            storagePath: '/test/storage',
            globalStoragePath: '/test/global',
            languageModelAccessInformation: {} as any
        } as vscode.ExtensionContext;

        configurationService = new ConfigurationService(mockContext);
    });

    test('should get default export configuration', () => {
        const config = configurationService.getDefaultExportConfiguration();
        
        assert.strictEqual(typeof config.format, 'string');
        assert.ok(['txt', 'md'].includes(config.format));
        assert.strictEqual(typeof config.includeDirectoryStructure, 'boolean');
        assert.strictEqual(typeof config.maxFileSize, 'number');
        assert.ok(config.maxFileSize > 0);
        assert.ok(Array.isArray(config.excludePatterns));
        assert.ok(Array.isArray(config.includePatterns));
        assert.strictEqual(typeof config.truncateThreshold, 'number');
        assert.ok(config.truncateThreshold > 0);
    });

    test('should get configuration presets', () => {
        const presets = configurationService.getConfigurationPresets();
        
        assert.ok(typeof presets === 'object');
        assert.ok('minimal' in presets);
        assert.ok('comprehensive' in presets);
        assert.ok('documentation' in presets);
        assert.ok('source-only' in presets);

        // Validate minimal preset
        const minimal = presets.minimal;
        assert.strictEqual(minimal.format, 'txt');
        assert.strictEqual(minimal.includeDirectoryStructure, false);
        assert.ok(minimal.excludePatterns.length > 0);
        assert.ok(minimal.includePatterns.length > 0);

        // Validate comprehensive preset
        const comprehensive = presets.comprehensive;
        assert.strictEqual(comprehensive.format, 'md');
        assert.strictEqual(comprehensive.includeDirectoryStructure, true);
        assert.ok(comprehensive.excludePatterns.length > 0);
        assert.strictEqual(comprehensive.includePatterns.length, 0);
    });

    test('should validate and migrate configuration', () => {
        const invalidConfig = {
            format: 'invalid' as any,
            maxFileSize: -100,
            excludePatterns: 'not-an-array' as any
        };

        const validConfig = configurationService.validateAndMigrateConfiguration(invalidConfig);
        
        assert.strictEqual(validConfig.format, 'md'); // Should be migrated to default
        assert.ok(validConfig.maxFileSize > 0); // Should be migrated to positive value
        assert.ok(Array.isArray(validConfig.excludePatterns)); // Should be migrated to array
    });

    test('should save and load session state', () => {
        const sessionState: SessionState = {
            selectedPaths: ['/test/file1.ts', '/test/file2.js'],
            lastConfiguration: {
                format: 'md',
                includeDirectoryStructure: true,
                maxFileSize: 1024 * 1024,
                excludePatterns: ['node_modules/**'],
                includePatterns: ['*.ts'],
                truncateThreshold: 10 * 1024 * 1024
            },
            timestamp: Date.now()
        };

        // Mock workspace state update
        let savedState: any;
        mockContext.workspaceState.update = (key: string, value: any) => {
            savedState = value;
            return Promise.resolve();
        };
        mockContext.workspaceState.get = (key: string) => savedState;

        // Save state
        configurationService.saveSessionState(sessionState);
        
        // Load state
        const loadedState = configurationService.loadSessionState();
        
        assert.deepStrictEqual(loadedState, sessionState);
    });

    test('should clear session state', () => {
        let clearedState: any = 'not-cleared';
        mockContext.workspaceState.update = (key: string, value: any) => {
            clearedState = value;
            return Promise.resolve();
        };

        configurationService.clearSessionState();
        
        assert.strictEqual(clearedState, undefined);
    });

    test('should generate configuration summary', () => {
        const config: ExportConfiguration = {
            format: 'md',
            includeDirectoryStructure: true,
            maxFileSize: 2048 * 1024, // 2MB
            excludePatterns: ['node_modules/**', '*.log'],
            includePatterns: ['*.ts', '*.js'],
            truncateThreshold: 20 * 1024 * 1024 // 20MB
        };

        const summary = configurationService.getConfigurationSummary(config);
        
        assert.ok(summary.includes('Format: MD'));
        assert.ok(summary.includes('Max file size: 2048 KB'));
        assert.ok(summary.includes('Truncate threshold: 20 MB'));
        assert.ok(summary.includes('Directory structure: Yes'));
        assert.ok(summary.includes('Exclude patterns: 2'));
        assert.ok(summary.includes('Include patterns: 2'));
    });

    test('should handle configuration changes', (done) => {
        // This test would require mocking vscode.workspace.onDidChangeConfiguration
        // For now, we'll just test that the method exists and can be called
        const disposable = configurationService.onConfigurationChanged(() => {
            done();
        });
        
        assert.ok(disposable);
        assert.ok(typeof disposable.dispose === 'function');
        disposable.dispose();
        done();
    });

    test('should get default preset from settings', () => {
        // This would require mocking vscode.workspace.getConfiguration
        // For now, test that the method exists and returns expected type
        const defaultPreset = configurationService.getDefaultPreset();
        assert.ok(defaultPreset === undefined || typeof defaultPreset === 'string');
    });

    test('should check remember selections setting', () => {
        // This would require mocking vscode.workspace.getConfiguration
        // For now, test that the method exists and returns boolean
        const shouldRemember = configurationService.shouldRememberSelections();
        assert.strictEqual(typeof shouldRemember, 'boolean');
    });
});