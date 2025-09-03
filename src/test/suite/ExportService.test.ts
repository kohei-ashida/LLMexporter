import * as assert from 'assert';
import * as vscode from 'vscode';
import { ExportService } from '../../services/ExportService';
import { FileTreeService } from '../../services/FileTreeService';
import { ExportConfiguration } from '../../types';

suite('ExportService Test Suite', () => {
    let exportService: ExportService;
    let mockFileTreeService: FileTreeService;

    setup(() => {
        // Create a mock FileTreeService for testing
        mockFileTreeService = {
            isBinaryFile: (path: string) => path.endsWith('.jpg') || path.endsWith('.png'),
            getFileStats: async (path: string) => ({
                size: path.includes('large') ? 2000000 : 1000,
                modified: new Date()
            }),
            getFileContent: async (path: string) => {
                if (path.includes('error')) {
                    throw new Error('File not found');
                }
                return `// Content of ${path}\nconsole.log('Hello from ${path}');`;
            }
        } as any;

        exportService = new ExportService(mockFileTreeService);
    });

    test('Should generate export with directory structure', async () => {
        const config: ExportConfiguration = {
            format: 'md',
            outputMethod: 'file',
            includeDirectoryStructure: true,
            maxFileSize: 1024 * 1024,
            excludePatterns: [],
            includePatterns: [],
            truncateThreshold: 10 * 1024 * 1024
        };

        const selectedPaths = ['src/main.ts', 'src/utils/helper.ts'];
        const result = await exportService.generateExport(selectedPaths, config);

        assert.ok(result.content.includes('# LLM Context Export'));
        assert.ok(result.content.includes('## Directory Structure'));
        assert.ok(result.content.includes('## File: src/main.ts'));
        assert.ok(result.content.includes('## File: src/utils/helper.ts'));
        assert.strictEqual(result.metadata.totalFiles, 2);
    });

    test('Should generate export without directory structure', async () => {
        const config: ExportConfiguration = {
            format: 'txt',
            outputMethod: 'file',
            includeDirectoryStructure: false,
            maxFileSize: 1024 * 1024,
            excludePatterns: [],
            includePatterns: [],
            truncateThreshold: 10 * 1024 * 1024
        };

        const selectedPaths = ['src/main.ts'];
        const result = await exportService.generateExport(selectedPaths, config);

        assert.ok(result.content.includes('LLM Context Export'));
        assert.ok(!result.content.includes('Directory Structure'));
        assert.ok(result.content.includes('File: src/main.ts'));
        assert.strictEqual(result.metadata.totalFiles, 1);
    });

    test('Should handle file processing errors gracefully', async () => {
        const config: ExportConfiguration = {
            format: 'md',
            outputMethod: 'file',
            includeDirectoryStructure: false,
            maxFileSize: 1024 * 1024,
            excludePatterns: [],
            includePatterns: [],
            truncateThreshold: 10 * 1024 * 1024
        };

        const selectedPaths = ['src/error-file.ts', 'src/good-file.ts'];
        const result = await exportService.generateExport(selectedPaths, config);

        assert.ok(result.content.includes('**Error**: File not found'));
        assert.ok(result.content.includes('## File: src/good-file.ts'));
        assert.strictEqual(result.metadata.totalFiles, 1); // Only successful files counted
    });

    test('Should exclude binary files from processing', async () => {
        const config: ExportConfiguration = {
            format: 'md',
            outputMethod: 'file',
            includeDirectoryStructure: false,
            maxFileSize: 1024 * 1024,
            excludePatterns: [],
            includePatterns: [],
            truncateThreshold: 10 * 1024 * 1024
        };

        const selectedPaths = ['src/main.ts', 'assets/image.jpg', 'assets/icon.png'];
        const result = await exportService.generateExport(selectedPaths, config);

        assert.ok(result.content.includes('## File: src/main.ts'));
        assert.ok(!result.content.includes('image.jpg'));
        assert.ok(!result.content.includes('icon.png'));
        assert.strictEqual(result.metadata.totalFiles, 1);
    });

    test('Should truncate large files', async () => {
        const config: ExportConfiguration = {
            format: 'md',
            outputMethod: 'file',
            includeDirectoryStructure: false,
            maxFileSize: 1000, // Very small limit to trigger truncation
            excludePatterns: [],
            includePatterns: [],
            truncateThreshold: 10 * 1024 * 1024
        };

        const selectedPaths = ['src/large-file.ts'];
        const result = await exportService.generateExport(selectedPaths, config);

        assert.ok(result.content.includes('Content truncated due to size limit'));
        assert.strictEqual(result.metadata.truncatedFiles.length, 1);
        assert.strictEqual(result.metadata.truncatedFiles[0], 'src/large-file.ts');
    });

    test('Should format content correctly for markdown', async () => {
        const config: ExportConfiguration = {
            format: 'md',
            outputMethod: 'file',
            includeDirectoryStructure: false,
            maxFileSize: 1024 * 1024,
            excludePatterns: [],
            includePatterns: [],
            truncateThreshold: 10 * 1024 * 1024
        };

        const selectedPaths = ['src/main.ts'];
        const result = await exportService.generateExport(selectedPaths, config);

        assert.ok(result.content.includes('```typescript'));
        assert.ok(result.content.includes('## File: src/main.ts'));
        assert.ok(result.content.includes('## Export Summary'));
    });

    test('Should format content correctly for text', async () => {
        const config: ExportConfiguration = {
            format: 'txt',
            outputMethod: 'file',
            includeDirectoryStructure: false,
            maxFileSize: 1024 * 1024,
            excludePatterns: [],
            includePatterns: [],
            truncateThreshold: 10 * 1024 * 1024
        };

        const selectedPaths = ['src/main.ts'];
        const result = await exportService.generateExport(selectedPaths, config);

        assert.ok(result.content.includes('File: src/main.ts'));
        assert.ok(result.content.includes('Export Summary:'));
        assert.ok(!result.content.includes('```'));
        assert.ok(!result.content.includes('##'));
    });

    suite('Clipboard Functionality Tests', () => {
        let originalClipboard: any;
        let clipboardWriteText: any;
        let showInformationMessage: any;
        let showErrorMessage: any;
        let showWarningMessage: any;
        let showSaveDialog: any;

        setup(() => {
            // Mock VSCode APIs for clipboard testing
            originalClipboard = vscode.env.clipboard;
            clipboardWriteText = undefined;
            showInformationMessage = undefined;
            showErrorMessage = undefined;
            showWarningMessage = undefined;
            showSaveDialog = undefined;

            // Mock clipboard API
            (vscode.env as any).clipboard = {
                writeText: async (text: string) => {
                    if (clipboardWriteText) {
                        return clipboardWriteText(text);
                    }
                    return Promise.resolve();
                }
            };

            // Mock window APIs
            (vscode.window as any).showInformationMessage = (message: string) => {
                if (showInformationMessage) {
                    return showInformationMessage(message);
                }
                return Promise.resolve();
            };

            (vscode.window as any).showErrorMessage = (message: string, ...items: string[]) => {
                if (showErrorMessage) {
                    return showErrorMessage(message, ...items);
                }
                return Promise.resolve();
            };

            (vscode.window as any).showWarningMessage = (message: string, ...items: string[]) => {
                if (showWarningMessage) {
                    return showWarningMessage(message, ...items);
                }
                return Promise.resolve();
            };

            (vscode.window as any).showSaveDialog = (options: any) => {
                if (showSaveDialog) {
                    return showSaveDialog(options);
                }
                return Promise.resolve();
            };
        });

        teardown(() => {
            // Restore original clipboard
            if (originalClipboard) {
                (vscode.env as any).clipboard = originalClipboard;
            }
        });

        test('Should successfully copy content to clipboard', async () => {
            let copiedContent = '';
            let informationMessage = '';

            clipboardWriteText = async (text: string) => {
                copiedContent = text;
                return Promise.resolve();
            };

            showInformationMessage = (message: string) => {
                informationMessage = message;
                return Promise.resolve();
            };

            const testContent = 'Test content for clipboard';
            const result = await exportService.copyToClipboard(testContent);

            assert.strictEqual(result.success, true);
            assert.strictEqual(copiedContent, testContent);
            assert.strictEqual(informationMessage, 'Content copied to clipboard successfully!');
            assert.strictEqual(result.error, undefined);
            assert.strictEqual(result.fallbackUsed, undefined);
        });

        test('Should handle clipboard failure and offer file save fallback', async () => {
            let errorMessage = '';
            let errorActions: string[] = [];
            let saveDialogCalled = false;

            clipboardWriteText = async () => {
                throw new Error('Clipboard access denied');
            };

            showErrorMessage = (message: string, ...items: string[]) => {
                errorMessage = message;
                errorActions = items;
                return Promise.resolve('Save as File');
            };

            showSaveDialog = (options: any) => {
                saveDialogCalled = true;
                return Promise.resolve(vscode.Uri.file('/test/path/export.txt'));
            };

            // Mock workspace.fs.writeFile
            const originalWriteFile = vscode.workspace.fs.writeFile;
            let writtenContent = '';
            (vscode.workspace.fs as any).writeFile = async (uri: vscode.Uri, content: Uint8Array) => {
                writtenContent = Buffer.from(content).toString('utf8');
                return Promise.resolve();
            };

            const testContent = 'Test content for clipboard';
            const result = await exportService.copyToClipboard(testContent);

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.fallbackUsed, true);
            assert.ok(errorMessage.includes('Failed to copy to clipboard'));
            assert.ok(errorActions.includes('Save as File'));
            assert.strictEqual(saveDialogCalled, true);
            assert.strictEqual(writtenContent, testContent);

            // Restore original writeFile
            (vscode.workspace.fs as any).writeFile = originalWriteFile;
        });

        test('Should handle large content with truncation fallback', async () => {
            let clipboardAttempts = 0;
            let warningMessage = '';

            clipboardWriteText = async (text: string) => {
                clipboardAttempts++;
                if (clipboardAttempts === 1) {
                    // First attempt fails for large content
                    throw new Error('Content too large');
                } else {
                    // Second attempt succeeds with truncated content
                    assert.ok(text.includes('[... Content truncated for clipboard compatibility ...]'));
                    return Promise.resolve();
                }
            };

            showWarningMessage = (message: string) => {
                warningMessage = message;
                return Promise.resolve();
            };

            // Create large content (over 1MB)
            const largeContent = 'x'.repeat(1024 * 1024 + 1);
            const result = await exportService.copyToClipboard(largeContent);

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.fallbackUsed, true);
            assert.strictEqual(clipboardAttempts, 2);
            assert.ok(warningMessage.includes('Content was truncated and copied to clipboard'));
        });

        test('Should handle complete clipboard failure', async () => {
            let errorMessage = '';

            clipboardWriteText = async () => {
                throw new Error('Clipboard not available');
            };

            showErrorMessage = (message: string, ...items: string[]) => {
                errorMessage = message;
                return Promise.resolve('Cancel');
            };

            const testContent = 'Test content for clipboard';
            const result = await exportService.copyToClipboard(testContent);

            assert.strictEqual(result.success, false);
            assert.ok(result.error?.includes('Clipboard operation failed'));
            assert.ok(errorMessage.includes('Failed to copy to clipboard'));
        });

        test('Should handle clipboard operation with progress tracking', async () => {
            let progressUpdates: Array<{ progress: number; message: string }> = [];
            let warningMessage = '';
            let warningActions: string[] = [];

            clipboardWriteText = async (text: string) => {
                return Promise.resolve();
            };

            showInformationMessage = () => Promise.resolve();

            showWarningMessage = (message: string, ...items: string[]) => {
                warningMessage = message;
                warningActions = items;
                return Promise.resolve('Continue');
            };

            const progressCallback = (progress: number, message: string) => {
                progressUpdates.push({ progress, message });
            };

            // Create large content to trigger warning
            const largeContent = 'x'.repeat(15 * 1024 * 1024); // 15MB
            const result = await exportService.copyToClipboardWithProgress(largeContent, progressCallback);

            assert.strictEqual(result.success, true);
            assert.ok(warningMessage.includes('The content is'));
            assert.ok(warningActions.includes('Continue'));
            assert.ok(progressUpdates.length > 0);
            assert.ok(progressUpdates.some(update => update.message === 'Preparing clipboard operation...'));
            assert.ok(progressUpdates.some(update => update.message === 'Copied successfully!'));
        });

        test('Should cancel operation when user declines large content warning', async () => {
            showWarningMessage = (message: string, ...items: string[]) => {
                return Promise.resolve('Cancel');
            };

            const progressCallback = (progress: number, message: string) => {
                // Should not be called for cancelled operation
                assert.fail('Progress callback should not be called for cancelled operation');
            };

            // Create large content to trigger warning
            const largeContent = 'x'.repeat(15 * 1024 * 1024); // 15MB
            const result = await exportService.copyToClipboardWithProgress(largeContent, progressCallback);

            assert.strictEqual(result.success, false);
            assert.strictEqual(result.error, 'Operation cancelled by user');
        });

        test('Should integrate clipboard functionality with generateAndExport', async () => {
            let copiedContent = '';

            clipboardWriteText = async (text: string) => {
                copiedContent = text;
                return Promise.resolve();
            };

            showInformationMessage = () => Promise.resolve();

            const config: ExportConfiguration = {
                format: 'md',
                outputMethod: 'clipboard',
                includeDirectoryStructure: false,
                maxFileSize: 1024 * 1024,
                excludePatterns: [],
                includePatterns: [],
                truncateThreshold: 10 * 1024 * 1024
            };

            const selectedPaths = ['src/main.ts'];
            const result = await exportService.generateAndExport(selectedPaths, config);

            assert.strictEqual(result.clipboardResult?.success, true);
            assert.ok(copiedContent.includes('## File: src/main.ts'));
            assert.ok(copiedContent.includes('# LLM Context Export'));
        });
    });
});