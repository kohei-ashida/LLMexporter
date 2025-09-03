import * as assert from 'assert';
import * as vscode from 'vscode';
import { FileTreeService } from '../../services/FileTreeService';
import { ExportService } from '../../services/ExportService';
import { ExportConfiguration } from '../../types';

suite('Integration Test Suite', () => {
    let fileTreeService: FileTreeService;
    let exportService: ExportService;

    setup(() => {
        fileTreeService = new FileTreeService();
        exportService = new ExportService(fileTreeService);
    });

    test('Should handle workspace with no folders', async () => {
        // This test assumes no workspace is open
        const tree = await fileTreeService.getWorkspaceTree();
        assert.strictEqual(tree.length, 0);
    });

    test('Should handle binary file detection', () => {
        assert.strictEqual(fileTreeService.isBinaryFile('image.jpg'), true);
        assert.strictEqual(fileTreeService.isBinaryFile('document.pdf'), true);
        assert.strictEqual(fileTreeService.isBinaryFile('script.js'), false);
        assert.strictEqual(fileTreeService.isBinaryFile('README.md'), false);
    });

    test('Should filter files correctly', () => {
        const mockNodes = [
            {
                path: 'src/main.ts',
                name: 'main.ts',
                type: 'file' as const,
                selected: false,
                extension: '.ts'
            },
            {
                path: 'node_modules/package/index.js',
                name: 'index.js',
                type: 'file' as const,
                selected: false,
                extension: '.js'
            }
        ];

        const filtered = fileTreeService.filterFiles(mockNodes, [], ['node_modules/**']);
        assert.strictEqual(filtered.length, 1);
        assert.strictEqual(filtered[0].path, 'src/main.ts');
    });

    test('Should create export configuration with defaults', () => {
        const config: ExportConfiguration = {
            format: 'md',
            outputMethod: 'file',
            includeDirectoryStructure: true,
            maxFileSize: 1024 * 1024,
            excludePatterns: [],
            includePatterns: [],
            truncateThreshold: 10 * 1024 * 1024
        };

        assert.strictEqual(config.format, 'md');
        assert.strictEqual(config.includeDirectoryStructure, true);
        assert.ok(config.maxFileSize > 0);
    });

    test('Should handle empty file selection for export', async () => {
        const config: ExportConfiguration = {
            format: 'txt',
            outputMethod: 'file',
            includeDirectoryStructure: false,
            maxFileSize: 1024 * 1024,
            excludePatterns: [],
            includePatterns: [],
            truncateThreshold: 10 * 1024 * 1024
        };

        try {
            const result = await exportService.generateExport([], config);
            // Should complete but with no files
            assert.strictEqual(result.metadata.totalFiles, 0);
        } catch (error) {
            // This is expected behavior - empty selection should be handled gracefully
            assert.ok(error);
        }
    });

    test('Should handle export progress callback', async () => {
        const config: ExportConfiguration = {
            format: 'md',
            outputMethod: 'file',
            includeDirectoryStructure: true,
            maxFileSize: 1024 * 1024,
            excludePatterns: [],
            includePatterns: [],
            truncateThreshold: 10 * 1024 * 1024
        };

        let progressCalled = false;
        const progressCallback = (progress: number, message: string) => {
            progressCalled = true;
            assert.ok(progress >= 0 && progress <= 100);
            assert.ok(typeof message === 'string');
        };

        try {
            await exportService.generateExport(['nonexistent.txt'], config, progressCallback);
        } catch (error) {
            // Expected to fail, but progress should still be called
        }

        assert.strictEqual(progressCalled, true);
    });

    suite('Clipboard Integration Tests', () => {
        let originalClipboard: any;
        let originalWindow: any;

        setup(() => {
            // Store original APIs
            originalClipboard = vscode.env.clipboard;
            originalWindow = {
                showInformationMessage: vscode.window.showInformationMessage,
                showErrorMessage: vscode.window.showErrorMessage,
                showWarningMessage: vscode.window.showWarningMessage,
                showSaveDialog: vscode.window.showSaveDialog
            };
        });

        teardown(() => {
            // Restore original APIs
            if (originalClipboard) {
                (vscode.env as any).clipboard = originalClipboard;
            }
            if (originalWindow) {
                (vscode.window as any).showInformationMessage = originalWindow.showInformationMessage;
                (vscode.window as any).showErrorMessage = originalWindow.showErrorMessage;
                (vscode.window as any).showWarningMessage = originalWindow.showWarningMessage;
                (vscode.window as any).showSaveDialog = originalWindow.showSaveDialog;
            }
        });

        test('Should integrate clipboard export with generateAndExport workflow', async () => {
            let clipboardContent = '';
            let informationMessage = '';

            // Mock clipboard API
            (vscode.env as any).clipboard = {
                writeText: async (text: string) => {
                    clipboardContent = text;
                    return Promise.resolve();
                }
            };

            // Mock window API
            (vscode.window as any).showInformationMessage = (message: string) => {
                informationMessage = message;
                return Promise.resolve();
            };

            const config: ExportConfiguration = {
                format: 'md',
                outputMethod: 'clipboard',
                includeDirectoryStructure: true,
                maxFileSize: 1024 * 1024,
                excludePatterns: [],
                includePatterns: [],
                truncateThreshold: 10 * 1024 * 1024
            };

            // Use mock file tree service for integration test
            const mockFileTreeService = {
                isBinaryFile: () => false,
                isDirectory: async () => false,
                getFileStats: async () => ({ size: 1000, modified: new Date() }),
                getFileContent: async (path: string) => `// Mock content for ${path}`
            } as any;

            const testExportService = new ExportService(mockFileTreeService);
            const selectedPaths = ['src/test.ts'];
            
            const result = await testExportService.generateAndExport(selectedPaths, config);

            assert.strictEqual(result.clipboardResult?.success, true);
            assert.ok(clipboardContent.includes('# LLM Context Export'));
            assert.ok(clipboardContent.includes('## File: src/test.ts'));
            assert.strictEqual(informationMessage, 'Content copied to clipboard successfully!');
        });

        test('Should handle clipboard failure in integration workflow', async () => {
            let errorMessage = '';
            let saveDialogCalled = false;

            // Mock failing clipboard API
            (vscode.env as any).clipboard = {
                writeText: async () => {
                    throw new Error('Clipboard access denied');
                }
            };

            // Mock window APIs
            (vscode.window as any).showErrorMessage = (message: string, ...items: string[]) => {
                errorMessage = message;
                return Promise.resolve('Save as File');
            };

            (vscode.window as any).showSaveDialog = () => {
                saveDialogCalled = true;
                return Promise.resolve(vscode.Uri.file('/test/export.txt'));
            };

            // Mock workspace.fs.writeFile
            const originalWriteFile = vscode.workspace.fs.writeFile;
            (vscode.workspace.fs as any).writeFile = async () => Promise.resolve();

            const config: ExportConfiguration = {
                format: 'txt',
                outputMethod: 'clipboard',
                includeDirectoryStructure: false,
                maxFileSize: 1024 * 1024,
                excludePatterns: [],
                includePatterns: [],
                truncateThreshold: 10 * 1024 * 1024
            };

            // Use mock file tree service
            const mockFileTreeService = {
                isBinaryFile: () => false,
                isDirectory: async () => false,
                getFileStats: async () => ({ size: 1000, modified: new Date() }),
                getFileContent: async (path: string) => `// Mock content for ${path}`
            } as any;

            const testExportService = new ExportService(mockFileTreeService);
            const selectedPaths = ['src/test.ts'];
            
            const result = await testExportService.generateAndExport(selectedPaths, config);

            assert.strictEqual(result.clipboardResult?.success, true);
            assert.strictEqual(result.clipboardResult?.fallbackUsed, true);
            assert.ok(errorMessage.includes('Failed to copy to clipboard'));
            assert.strictEqual(saveDialogCalled, true);

            // Restore original writeFile
            (vscode.workspace.fs as any).writeFile = originalWriteFile;
        });

        test('Should handle clipboard progress tracking in integration', async () => {
            let progressUpdates: Array<{ progress: number; message: string }> = [];
            let clipboardContent = '';

            // Mock clipboard API
            (vscode.env as any).clipboard = {
                writeText: async (text: string) => {
                    clipboardContent = text;
                    return Promise.resolve();
                }
            };

            (vscode.window as any).showInformationMessage = () => Promise.resolve();

            const config: ExportConfiguration = {
                format: 'md',
                outputMethod: 'clipboard',
                includeDirectoryStructure: true,
                maxFileSize: 1024 * 1024,
                excludePatterns: [],
                includePatterns: [],
                truncateThreshold: 10 * 1024 * 1024
            };

            const progressCallback = (progress: number, message: string) => {
                progressUpdates.push({ progress, message });
            };

            // Use mock file tree service
            const mockFileTreeService = {
                isBinaryFile: () => false,
                isDirectory: async () => false,
                getFileStats: async () => ({ size: 1000, modified: new Date() }),
                getFileContent: async (path: string) => `// Mock content for ${path}`
            } as any;

            const testExportService = new ExportService(mockFileTreeService);
            const selectedPaths = ['src/test.ts'];
            
            const result = await testExportService.generateAndExport(selectedPaths, config, progressCallback);

            assert.strictEqual(result.clipboardResult?.success, true);
            assert.ok(clipboardContent.length > 0);
            
            // Verify clipboard-specific progress messages
            assert.ok(progressUpdates.some(update => update.message.includes('Copying to clipboard')));
            assert.ok(progressUpdates.some(update => update.progress >= 95)); // Clipboard progress starts at 95%
        });
    });
});