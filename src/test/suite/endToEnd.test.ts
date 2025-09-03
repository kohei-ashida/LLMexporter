import * as assert from 'assert';
import * as vscode from 'vscode';
import { ExportService } from '../../services/ExportService';
import { ExportConfiguration } from '../../types';
import { createMockFileTreeService, mockExportConfiguration } from '../fixtures/mockData';

suite('End-to-End Test Suite', () => {
    let exportService: ExportService;
    let mockFileTreeService: any;

    setup(() => {
        mockFileTreeService = createMockFileTreeService();
        exportService = new ExportService(mockFileTreeService);
    });

    test('Complete export workflow with markdown format', async () => {
        const selectedPaths = ['src/main.ts', 'src/utils.ts', 'README.md'];
        const config: ExportConfiguration = {
            ...mockExportConfiguration,
            format: 'md',
            includeDirectoryStructure: true
        };

        let progressUpdates: Array<{ progress: number; message: string }> = [];
        const progressCallback = (progress: number, message: string) => {
            progressUpdates.push({ progress, message });
        };

        const result = await exportService.generateExport(selectedPaths, config, progressCallback);

        // Verify result structure
        assert.ok(result.content);
        assert.ok(result.metadata);
        assert.strictEqual(result.metadata.totalFiles, 3);
        assert.ok(result.metadata.generatedAt instanceof Date);

        // Verify content format
        assert.ok(result.content.includes('# LLM Context Export'));
        assert.ok(result.content.includes('## Directory Structure'));
        assert.ok(result.content.includes('## File: src/main.ts'));
        assert.ok(result.content.includes('```typescript'));
        assert.ok(result.content.includes('## Export Summary'));

        // Verify progress was reported
        assert.ok(progressUpdates.length > 0);
        assert.ok(progressUpdates.some(update => update.progress === 100));
    });

    test('Complete export workflow with text format', async () => {
        const selectedPaths = ['src/main.ts', 'package.json'];
        const config: ExportConfiguration = {
            ...mockExportConfiguration,
            format: 'txt',
            includeDirectoryStructure: false
        };

        const result = await exportService.generateExport(selectedPaths, config);

        // Verify text format
        assert.ok(result.content.includes('LLM Context Export'));
        assert.ok(!result.content.includes('# LLM Context Export')); // No markdown headers
        assert.ok(!result.content.includes('## Directory Structure')); // Structure disabled
        assert.ok(result.content.includes('File: src/main.ts'));
        assert.ok(!result.content.includes('```')); // No code blocks
        assert.ok(result.content.includes('Export Summary:'));

        assert.strictEqual(result.metadata.totalFiles, 2);
    });

    test('Handle large file truncation', async () => {
        const selectedPaths = ['large-file.txt'];
        const config: ExportConfiguration = {
            ...mockExportConfiguration,
            maxFileSize: 1024, // 1KB limit to force truncation
            format: 'md'
        };

        const result = await exportService.generateExport(selectedPaths, config);

        // Verify truncation occurred
        assert.strictEqual(result.metadata.truncatedFiles.length, 1);
        assert.strictEqual(result.metadata.truncatedFiles[0], 'large-file.txt');
        assert.ok(result.content.includes('Content truncated due to size limit'));
    });

    test('Handle file processing errors gracefully', async () => {
        const selectedPaths = ['nonexistent-file.txt', 'src/main.ts'];
        const config: ExportConfiguration = {
            ...mockExportConfiguration,
            format: 'md'
        };

        const result = await exportService.generateExport(selectedPaths, config);

        // Should process the valid file and handle the error for the invalid one
        assert.ok(result.content.includes('**Error**: File not found'));
        assert.ok(result.content.includes('## File: src/main.ts'));
        assert.strictEqual(result.metadata.totalFiles, 1); // Only successful files counted
    });

    test('Filter out binary files automatically', async () => {
        const selectedPaths = ['src/main.ts', 'assets/image.jpg', 'assets/icon.png'];
        const config: ExportConfiguration = {
            ...mockExportConfiguration,
            format: 'md'
        };

        const result = await exportService.generateExport(selectedPaths, config);

        // Should only process the text file
        assert.ok(result.content.includes('## File: src/main.ts'));
        assert.ok(!result.content.includes('image.jpg'));
        assert.ok(!result.content.includes('icon.png'));
        assert.strictEqual(result.metadata.totalFiles, 1);
    });

    test('Generate directory structure correctly', async () => {
        const selectedPaths = ['src/main.ts', 'src/components/Button.tsx', 'package.json'];
        const config: ExportConfiguration = {
            ...mockExportConfiguration,
            format: 'md',
            includeDirectoryStructure: true
        };

        const result = await exportService.generateExport(selectedPaths, config);

        // Verify directory structure is included and formatted correctly
        assert.ok(result.content.includes('## Directory Structure'));
        assert.ok(result.content.includes('📁 src'));
        assert.ok(result.content.includes('├── main.ts'));
        assert.ok(result.content.includes('└── 📁 components'));
        assert.ok(result.content.includes('Button.tsx'));
        assert.ok(result.content.includes('package.json'));
    });

    test('Handle empty selection', async () => {
        const selectedPaths: string[] = [];
        const config: ExportConfiguration = {
            ...mockExportConfiguration,
            format: 'md'
        };

        const result = await exportService.generateExport(selectedPaths, config);

        // Should generate header and footer but no file content
        assert.ok(result.content.includes('# LLM Context Export'));
        assert.ok(result.content.includes('## Export Summary'));
        assert.strictEqual(result.metadata.totalFiles, 0);
        assert.strictEqual(result.metadata.totalSize, 0);
    });

    test('Progress callback receives expected updates', async () => {
        const selectedPaths = ['src/main.ts', 'src/utils.ts', 'README.md'];
        const config: ExportConfiguration = {
            ...mockExportConfiguration,
            format: 'md'
        };

        const progressUpdates: Array<{ progress: number; message: string }> = [];
        const progressCallback = (progress: number, message: string) => {
            progressUpdates.push({ progress, message });
        };

        await exportService.generateExport(selectedPaths, config, progressCallback);

        // Verify progress updates
        assert.ok(progressUpdates.length >= 3); // At least start, processing, and complete
        
        // Check that progress increases
        const progressValues = progressUpdates.map(update => update.progress);
        assert.ok(progressValues[0] <= progressValues[progressValues.length - 1]);
        
        // Check that final progress is 100
        assert.strictEqual(progressValues[progressValues.length - 1], 100);
        
        // Check that messages are meaningful
        assert.ok(progressUpdates.some(update => update.message.includes('structure')));
        assert.ok(progressUpdates.some(update => update.message.includes('complete')));
    });

    suite('Clipboard End-to-End Tests', () => {
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

        test('Complete clipboard export workflow with markdown format', async () => {
            let clipboardContent = '';
            let informationMessage = '';

            // Mock clipboard API
            (vscode.env as any).clipboard = {
                writeText: async (text: string) => {
                    clipboardContent = text;
                    return Promise.resolve();
                }
            };

            (vscode.window as any).showInformationMessage = (message: string) => {
                informationMessage = message;
                return Promise.resolve();
            };

            const selectedPaths = ['src/main.ts', 'src/utils.ts', 'README.md'];
            const config: ExportConfiguration = {
                ...mockExportConfiguration,
                outputMethod: 'clipboard',
                format: 'md',
                includeDirectoryStructure: true
            };

            let progressUpdates: Array<{ progress: number; message: string }> = [];
            const progressCallback = (progress: number, message: string) => {
                progressUpdates.push({ progress, message });
            };

            const result = await exportService.generateAndExport(selectedPaths, config, progressCallback);

            // Verify clipboard result
            assert.strictEqual(result.clipboardResult?.success, true);
            assert.strictEqual(result.clipboardResult?.error, undefined);
            assert.strictEqual(result.clipboardResult?.fallbackUsed, undefined);

            // Verify clipboard content
            assert.ok(clipboardContent.includes('# LLM Context Export'));
            assert.ok(clipboardContent.includes('## Directory Structure'));
            assert.ok(clipboardContent.includes('## File: src/main.ts'));
            assert.ok(clipboardContent.includes('```typescript'));
            assert.ok(clipboardContent.includes('## Export Summary'));

            // Verify success message
            assert.strictEqual(informationMessage, 'Content copied to clipboard successfully!');

            // Verify clipboard-specific progress updates
            assert.ok(progressUpdates.some(update => update.message.includes('Copying to clipboard')));
            assert.ok(progressUpdates.some(update => update.progress >= 95));
        });

        test('Complete clipboard export workflow with text format', async () => {
            let clipboardContent = '';

            // Mock clipboard API
            (vscode.env as any).clipboard = {
                writeText: async (text: string) => {
                    clipboardContent = text;
                    return Promise.resolve();
                }
            };

            (vscode.window as any).showInformationMessage = () => Promise.resolve();

            const selectedPaths = ['src/main.ts', 'package.json'];
            const config: ExportConfiguration = {
                ...mockExportConfiguration,
                outputMethod: 'clipboard',
                format: 'txt',
                includeDirectoryStructure: false
            };

            const result = await exportService.generateAndExport(selectedPaths, config);

            // Verify clipboard result
            assert.strictEqual(result.clipboardResult?.success, true);

            // Verify text format in clipboard
            assert.ok(clipboardContent.includes('LLM Context Export'));
            assert.ok(!clipboardContent.includes('# LLM Context Export')); // No markdown headers
            assert.ok(!clipboardContent.includes('## Directory Structure')); // Structure disabled
            assert.ok(clipboardContent.includes('File: src/main.ts'));
            assert.ok(!clipboardContent.includes('```')); // No code blocks
            assert.ok(clipboardContent.includes('Export Summary:'));
        });

        test('Handle clipboard failure with file save fallback', async () => {
            let errorMessage = '';
            let saveDialogOptions: any;
            let savedContent = '';

            // Mock failing clipboard API
            (vscode.env as any).clipboard = {
                writeText: async () => {
                    throw new Error('Clipboard access denied');
                }
            };

            (vscode.window as any).showErrorMessage = (message: string, ...items: string[]) => {
                errorMessage = message;
                return Promise.resolve('Save as File');
            };

            (vscode.window as any).showSaveDialog = (options: any) => {
                saveDialogOptions = options;
                return Promise.resolve(vscode.Uri.file('/test/export.txt'));
            };

            // Mock workspace.fs.writeFile
            const originalWriteFile = vscode.workspace.fs.writeFile;
            (vscode.workspace.fs as any).writeFile = async (uri: vscode.Uri, content: Uint8Array) => {
                savedContent = Buffer.from(content).toString('utf8');
                return Promise.resolve();
            };

            (vscode.window as any).showInformationMessage = () => Promise.resolve();

            const selectedPaths = ['src/main.ts'];
            const config: ExportConfiguration = {
                ...mockExportConfiguration,
                outputMethod: 'clipboard',
                format: 'md'
            };

            const result = await exportService.generateAndExport(selectedPaths, config);

            // Verify fallback was used
            assert.strictEqual(result.clipboardResult?.success, true);
            assert.strictEqual(result.clipboardResult?.fallbackUsed, true);

            // Verify error handling
            assert.ok(errorMessage.includes('Failed to copy to clipboard'));

            // Verify save dialog was called with correct options
            assert.ok(saveDialogOptions);
            assert.ok(saveDialogOptions.filters);
            assert.ok(saveDialogOptions.filters['Text Files']);

            // Verify content was saved
            assert.ok(savedContent.includes('# LLM Context Export'));
            assert.ok(savedContent.includes('## File: src/main.ts'));

            // Restore original writeFile
            (vscode.workspace.fs as any).writeFile = originalWriteFile;
        });

        test('Handle large content with truncation fallback', async () => {
            let clipboardAttempts = 0;
            let warningMessage = '';
            let finalClipboardContent = '';

            // Mock clipboard API that fails on first attempt but succeeds on second
            (vscode.env as any).clipboard = {
                writeText: async (text: string) => {
                    clipboardAttempts++;
                    if (clipboardAttempts === 1) {
                        throw new Error('Content too large');
                    } else {
                        finalClipboardContent = text;
                        return Promise.resolve();
                    }
                }
            };

            (vscode.window as any).showWarningMessage = (message: string) => {
                warningMessage = message;
                return Promise.resolve();
            };

            (vscode.window as any).showInformationMessage = () => Promise.resolve();

            // Create config that will generate large content
            const selectedPaths = ['large-file.txt'];
            const config: ExportConfiguration = {
                ...mockExportConfiguration,
                outputMethod: 'clipboard',
                format: 'md',
                maxFileSize: 10 * 1024 * 1024 // Allow large files
            };

            const result = await exportService.generateAndExport(selectedPaths, config);

            // Verify fallback was used
            assert.strictEqual(result.clipboardResult?.success, true);
            assert.strictEqual(result.clipboardResult?.fallbackUsed, true);

            // Verify truncation occurred
            assert.strictEqual(clipboardAttempts, 2);
            assert.ok(warningMessage.includes('Content was truncated and copied to clipboard'));
            assert.ok(finalClipboardContent.includes('[... Content truncated for clipboard compatibility ...]'));
        });

        test('Handle user cancellation of large content warning', async () => {
            (vscode.window as any).showWarningMessage = (message: string, ...items: string[]) => {
                return Promise.resolve('Cancel');
            };

            // Create large content to trigger warning
            const selectedPaths = ['large-file.txt'];
            const config: ExportConfiguration = {
                ...mockExportConfiguration,
                outputMethod: 'clipboard',
                format: 'md',
                maxFileSize: 10 * 1024 * 1024 // Allow large files to reach clipboard stage
            };

            const result = await exportService.generateAndExport(selectedPaths, config);

            // Verify operation was cancelled
            assert.strictEqual(result.clipboardResult?.success, false);
            assert.strictEqual(result.clipboardResult?.error, 'Operation cancelled by user');
        });

        test('Handle complete clipboard failure scenario', async () => {
            let errorMessage = '';

            // Mock completely failing clipboard API
            (vscode.env as any).clipboard = {
                writeText: async () => {
                    throw new Error('Clipboard not available');
                }
            };

            (vscode.window as any).showErrorMessage = (message: string, ...items: string[]) => {
                errorMessage = message;
                return Promise.resolve('Cancel'); // User cancels file save
            };

            const selectedPaths = ['src/main.ts'];
            const config: ExportConfiguration = {
                ...mockExportConfiguration,
                outputMethod: 'clipboard',
                format: 'md'
            };

            const result = await exportService.generateAndExport(selectedPaths, config);

            // Verify complete failure
            assert.strictEqual(result.clipboardResult?.success, false);
            assert.ok(result.clipboardResult?.error?.includes('Clipboard operation failed'));
            assert.ok(errorMessage.includes('Failed to copy to clipboard'));
        });
    });
});