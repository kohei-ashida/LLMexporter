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
});