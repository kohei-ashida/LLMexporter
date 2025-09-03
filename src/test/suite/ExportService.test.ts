import * as assert from 'assert';
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
});