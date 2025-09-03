import * as assert from 'assert';
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
});