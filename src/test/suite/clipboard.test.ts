import * as assert from 'assert';
import * as vscode from 'vscode';
import { ExportService } from '../../services/ExportService';
import { FileTreeService } from '../../services/FileTreeService';
import { ExportConfiguration } from '../../types';

suite('Clipboard Functionality Test Suite', () => {
    let exportService: ExportService;
    let mockFileTreeService: FileTreeService;
    let originalClipboard: any;
    let originalWindow: any;
    let originalWorkspace: any;

    setup(() => {
        // Create a mock FileTreeService for testing
        mockFileTreeService = {
            isBinaryFile: (path: string) => path.endsWith('.jpg') || path.endsWith('.png'),
            isDirectory: async (path: string) => path.includes('directory'),
            getFileStats: async (path: string) => ({
                size: path.includes('large') ? 15 * 1024 * 1024 : 1000, // 15MB for large files
                modified: new Date()
            }),
            getFileContent: async (path: string) => {
                if (path.includes('error')) {
                    throw new Error('File not found');
                }
                if (path.includes('large')) {
                    return 'x'.repeat(15 * 1024 * 1024); // 15MB content
                }
                return `// Content of ${path}\nconsole.log('Hello from ${path}');`;
            }
        } as any;

        exportService = new ExportService(mockFileTreeService);

        // Store original APIs
        originalClipboard = vscode.env.clipboard;
        originalWindow = {
            showInformationMessage: vscode.window.showInformationMessage,
            showErrorMessage: vscode.window.showErrorMessage,
            showWarningMessage: vscode.window.showWarningMessage,
            showSaveDialog: vscode.window.showSaveDialog
        };
        originalWorkspace = {
            writeFile: vscode.workspace.fs.writeFile
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
        if (originalWorkspace) {
            (vscode.workspace.fs as any).writeFile = originalWorkspace.writeFile;
        }
    });

    suite('Basic Clipboard Operations', () => {
        test('Should successfully copy simple content to clipboard', async () => {
            let copiedContent = '';
            let informationMessage = '';

            // Mock successful clipboard operation
            (vscode.env as any).clipboard = {
                writeText: async (text: string) => {
                    copiedContent = text;
                    return Promise.resolve();
                }
            };

            (vscode.window as any).showInformationMessage = (message: string) => {
                informationMessage = message;
                return Promise.resolve();
            };

            const testContent = 'Simple test content for clipboard';
            const result = await exportService.copyToClipboard(testContent);

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.error, undefined);
            assert.strictEqual(result.fallbackUsed, undefined);
            assert.strictEqual(copiedContent, testContent);
            assert.strictEqual(informationMessage, 'Content copied to clipboard successfully!');
        });

        test('Should handle empty content', async () => {
            let copiedContent = '';

            (vscode.env as any).clipboard = {
                writeText: async (text: string) => {
                    copiedContent = text;
                    return Promise.resolve();
                }
            };

            (vscode.window as any).showInformationMessage = () => Promise.resolve();

            const result = await exportService.copyToClipboard('');

            assert.strictEqual(result.success, true);
            assert.strictEqual(copiedContent, '');
        });

        test('Should handle special characters and unicode', async () => {
            let copiedContent = '';

            (vscode.env as any).clipboard = {
                writeText: async (text: string) => {
                    copiedContent = text;
                    return Promise.resolve();
                }
            };

            (vscode.window as any).showInformationMessage = () => Promise.resolve();

            const specialContent = 'Special chars: 🚀 ñáéíóú "quotes" \'apostrophes\' <tags> & symbols';
            const result = await exportService.copyToClipboard(specialContent);

            assert.strictEqual(result.success, true);
            assert.strictEqual(copiedContent, specialContent);
        });
    });

    suite('Clipboard Error Handling', () => {
        test('Should handle clipboard access denied error', async () => {
            let errorMessage = '';
            let errorActions: string[] = [];

            (vscode.env as any).clipboard = {
                writeText: async () => {
                    throw new Error('Clipboard access denied');
                }
            };

            (vscode.window as any).showErrorMessage = (message: string, ...items: string[]) => {
                errorMessage = message;
                errorActions = items;
                return Promise.resolve('Cancel');
            };

            const result = await exportService.copyToClipboard('test content');

            assert.strictEqual(result.success, false);
            assert.ok(result.error?.includes('Clipboard operation failed'));
            assert.ok(errorMessage.includes('Failed to copy to clipboard'));
            assert.ok(errorActions.includes('Save as File'));
            assert.ok(errorActions.includes('Cancel'));
        });

        test('Should handle clipboard timeout error', async () => {
            (vscode.env as any).clipboard = {
                writeText: async () => {
                    throw new Error('Operation timed out');
                }
            };

            (vscode.window as any).showErrorMessage = () => Promise.resolve('Cancel');

            const result = await exportService.copyToClipboard('test content');

            assert.strictEqual(result.success, false);
            assert.ok(result.error?.includes('Operation timed out'));
        });

        test('Should handle unknown clipboard errors', async () => {
            (vscode.env as any).clipboard = {
                writeText: async () => {
                    throw new Error('Unknown error'); // Non-Error object
                }
            };

            (vscode.window as any).showErrorMessage = () => Promise.resolve('Cancel');

            const result = await exportService.copyToClipboard('test content');

            assert.strictEqual(result.success, false);
            assert.ok(result.error?.includes('Unknown clipboard error'));
        });
    });

    suite('Large Content Handling', () => {
        test('Should handle content exactly at 1MB threshold', async () => {
            let copiedContent = '';

            (vscode.env as any).clipboard = {
                writeText: async (text: string) => {
                    copiedContent = text;
                    return Promise.resolve();
                }
            };

            (vscode.window as any).showInformationMessage = () => Promise.resolve();

            const exactlyOneMB = 'x'.repeat(1024 * 1024); // Exactly 1MB
            const result = await exportService.copyToClipboard(exactlyOneMB);

            assert.strictEqual(result.success, true);
            assert.strictEqual(copiedContent, exactlyOneMB);
        });

        test('Should trigger truncation fallback for content over 1MB', async () => {
            let clipboardAttempts = 0;
            let finalContent = '';
            let warningMessage = '';

            (vscode.env as any).clipboard = {
                writeText: async (text: string) => {
                    clipboardAttempts++;
                    if (clipboardAttempts === 1) {
                        throw new Error('Content too large');
                    } else {
                        finalContent = text;
                        return Promise.resolve();
                    }
                }
            };

            (vscode.window as any).showWarningMessage = (message: string) => {
                warningMessage = message;
                return Promise.resolve();
            };

            const largeContent = 'x'.repeat(1024 * 1024 + 100); // Just over 1MB
            const result = await exportService.copyToClipboard(largeContent);

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.fallbackUsed, true);
            assert.strictEqual(clipboardAttempts, 2);
            assert.ok(warningMessage.includes('Content was truncated'));
            assert.ok(finalContent.includes('[... Content truncated for clipboard compatibility ...]'));
            assert.strictEqual(finalContent.length, 1024 * 1024 + '[... Content truncated for clipboard compatibility ...]'.length);
        });

        test('Should fail gracefully when both primary and fallback clipboard operations fail', async () => {
            (vscode.env as any).clipboard = {
                writeText: async () => {
                    throw new Error('Clipboard completely unavailable');
                }
            };

            (vscode.window as any).showErrorMessage = () => Promise.resolve('Cancel');

            const largeContent = 'x'.repeat(2 * 1024 * 1024); // 2MB
            const result = await exportService.copyToClipboard(largeContent);

            assert.strictEqual(result.success, false);
            assert.ok(result.error?.includes('Clipboard operation failed'));
        });
    });

    suite('File Save Fallback', () => {
        test('Should successfully save file when user chooses fallback', async () => {
            let savedUri: vscode.Uri | undefined;
            let savedContent = '';
            let informationMessage = '';

            (vscode.env as any).clipboard = {
                writeText: async () => {
                    throw new Error('Clipboard failed');
                }
            };

            (vscode.window as any).showErrorMessage = () => Promise.resolve('Save as File');

            (vscode.window as any).showSaveDialog = (options: any) => {
                // Verify save dialog options
                assert.ok(options.filters);
                assert.ok(options.filters['Text Files']);
                assert.ok(options.filters['Markdown Files']);
                assert.ok(options.filters['All Files']);
                return Promise.resolve(vscode.Uri.file('/test/export.txt'));
            };

            (vscode.workspace.fs as any).writeFile = async (uri: vscode.Uri, content: Uint8Array) => {
                savedUri = uri;
                savedContent = Buffer.from(content).toString('utf8');
                return Promise.resolve();
            };

            (vscode.window as any).showInformationMessage = (message: string) => {
                informationMessage = message;
                return Promise.resolve();
            };

            const testContent = 'Test content for file save';
            const result = await exportService.copyToClipboard(testContent);

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.fallbackUsed, true);
            assert.strictEqual(savedUri?.fsPath, '/test/export.txt');
            assert.strictEqual(savedContent, testContent);
            assert.ok(informationMessage.includes('Content saved to'));
        });

        test('Should handle save dialog cancellation', async () => {
            (vscode.env as any).clipboard = {
                writeText: async () => {
                    throw new Error('Clipboard failed');
                }
            };

            (vscode.window as any).showErrorMessage = () => Promise.resolve('Save as File');

            (vscode.window as any).showSaveDialog = () => {
                return Promise.resolve(undefined); // User cancelled
            };

            const result = await exportService.copyToClipboard('test content');

            assert.strictEqual(result.success, false);
            assert.ok(result.error?.includes('Clipboard operation failed'));
        });

        test('Should handle file save errors', async () => {
            let errorMessage = '';

            (vscode.env as any).clipboard = {
                writeText: async () => {
                    throw new Error('Clipboard failed');
                }
            };

            (vscode.window as any).showErrorMessage = (message: string) => {
                if (message.includes('Failed to save file')) {
                    errorMessage = message;
                }
                return Promise.resolve('Save as File');
            };

            (vscode.window as any).showSaveDialog = () => {
                return Promise.resolve(vscode.Uri.file('/readonly/export.txt'));
            };

            (vscode.workspace.fs as any).writeFile = async () => {
                throw new Error('Permission denied');
            };

            const result = await exportService.copyToClipboard('test content');

            assert.strictEqual(result.success, false);
            assert.ok(result.error?.includes('Clipboard operation failed'));
            assert.ok(errorMessage.includes('Failed to save file'));
        });
    });

    suite('Progress Tracking', () => {
        test('Should track progress for normal clipboard operation', async () => {
            let progressUpdates: Array<{ progress: number; message: string }> = [];

            (vscode.env as any).clipboard = {
                writeText: async () => Promise.resolve()
            };

            (vscode.window as any).showInformationMessage = () => Promise.resolve();

            const progressCallback = (progress: number, message: string) => {
                progressUpdates.push({ progress, message });
            };

            const result = await exportService.copyToClipboardWithProgress('test content', progressCallback);

            assert.strictEqual(result.success, true);
            assert.ok(progressUpdates.length >= 3); // At least prepare, copy, complete
            assert.ok(progressUpdates.some(update => update.message.includes('Preparing clipboard')));
            assert.ok(progressUpdates.some(update => update.message.includes('Copying to clipboard')));
            assert.ok(progressUpdates.some(update => update.message.includes('Copied successfully')));
            assert.strictEqual(progressUpdates[progressUpdates.length - 1].progress, 100);
        });

        test('Should show warning for very large content', async () => {
            let warningMessage = '';
            let warningActions: string[] = [];

            (vscode.env as any).clipboard = {
                writeText: async () => Promise.resolve()
            };

            (vscode.window as any).showInformationMessage = () => Promise.resolve();

            (vscode.window as any).showWarningMessage = (message: string, ...items: string[]) => {
                warningMessage = message;
                warningActions = items;
                return Promise.resolve('Continue');
            };

            const veryLargeContent = 'x'.repeat(15 * 1024 * 1024); // 15MB
            const result = await exportService.copyToClipboardWithProgress(veryLargeContent);

            assert.strictEqual(result.success, true);
            assert.ok(warningMessage.includes('The content is 15.0MB'));
            assert.ok(warningActions.includes('Continue'));
            assert.ok(warningActions.includes('Cancel'));
        });

        test('Should handle user cancellation of large content warning', async () => {
            (vscode.window as any).showWarningMessage = () => Promise.resolve('Cancel');

            const veryLargeContent = 'x'.repeat(15 * 1024 * 1024); // 15MB
            const result = await exportService.copyToClipboardWithProgress(veryLargeContent);

            assert.strictEqual(result.success, false);
            assert.strictEqual(result.error, 'Operation cancelled by user');
        });

        test('Should track progress for failed operations', async () => {
            let progressUpdates: Array<{ progress: number; message: string }> = [];

            (vscode.env as any).clipboard = {
                writeText: async () => {
                    throw new Error('Clipboard failed');
                }
            };

            (vscode.window as any).showErrorMessage = () => Promise.resolve('Cancel');

            const progressCallback = (progress: number, message: string) => {
                progressUpdates.push({ progress, message });
            };

            const result = await exportService.copyToClipboardWithProgress('test content', progressCallback);

            assert.strictEqual(result.success, false);
            assert.ok(progressUpdates.length >= 2); // At least prepare and failed
            assert.ok(progressUpdates.some(update => update.message.includes('Copy failed')));
        });
    });

    suite('Integration with Export Generation', () => {
        test('Should integrate clipboard with full export workflow', async () => {
            let clipboardContent = '';

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

            const selectedPaths = ['src/main.ts', 'src/utils.ts'];
            const result = await exportService.generateAndExport(selectedPaths, config);

            assert.strictEqual(result.clipboardResult?.success, true);
            assert.ok(clipboardContent.includes('# LLM Context Export'));
            assert.ok(clipboardContent.includes('## Directory Structure'));
            assert.ok(clipboardContent.includes('## File: src/main.ts'));
            assert.ok(clipboardContent.includes('## File: src/utils.ts'));
            assert.ok(clipboardContent.includes('## Export Summary'));
        });

        test('Should handle clipboard failure during export workflow', async () => {
            let errorMessage = '';

            (vscode.env as any).clipboard = {
                writeText: async () => {
                    throw new Error('Clipboard unavailable');
                }
            };

            (vscode.window as any).showErrorMessage = (message: string) => {
                errorMessage = message;
                return Promise.resolve('Cancel');
            };

            const config: ExportConfiguration = {
                format: 'txt',
                outputMethod: 'clipboard',
                includeDirectoryStructure: false,
                maxFileSize: 1024 * 1024,
                excludePatterns: [],
                includePatterns: [],
                truncateThreshold: 10 * 1024 * 1024
            };

            const selectedPaths = ['src/main.ts'];
            const result = await exportService.generateAndExport(selectedPaths, config);

            assert.strictEqual(result.clipboardResult?.success, false);
            assert.ok(result.clipboardResult?.error?.includes('Clipboard operation failed'));
            assert.ok(errorMessage.includes('Failed to copy to clipboard'));
        });

        test('Should handle progress tracking in full export workflow', async () => {
            let progressUpdates: Array<{ progress: number; message: string }> = [];

            (vscode.env as any).clipboard = {
                writeText: async () => Promise.resolve()
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

            const selectedPaths = ['src/main.ts'];
            const result = await exportService.generateAndExport(selectedPaths, config, progressCallback);

            assert.strictEqual(result.clipboardResult?.success, true);
            
            // Verify export progress
            assert.ok(progressUpdates.some(update => update.message.includes('structure')));
            assert.ok(progressUpdates.some(update => update.message.includes('Processing')));
            
            // Verify clipboard progress (should start around 95%)
            assert.ok(progressUpdates.some(update => update.message.includes('Copying to clipboard')));
            assert.ok(progressUpdates.some(update => update.progress >= 95));
            
            // Verify completion
            assert.strictEqual(progressUpdates[progressUpdates.length - 1].progress, 100);
        });
    });
});