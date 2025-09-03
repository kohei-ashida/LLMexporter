import * as assert from 'assert';
import * as vscode from 'vscode';
import { FileTreeService } from '../../services/FileTreeService';
import { FileTreeNode } from '../../types';

suite('FileTreeService Test Suite', () => {
    let fileTreeService: FileTreeService;

    setup(() => {
        fileTreeService = new FileTreeService();
    });

    test('Should filter files based on exclude patterns', () => {
        const nodes: FileTreeNode[] = [
            {
                path: 'src/main.ts',
                name: 'main.ts',
                type: 'file',
                selected: false,
                extension: '.ts'
            },
            {
                path: 'node_modules/package/index.js',
                name: 'index.js',
                type: 'file',
                selected: false,
                extension: '.js'
            },
            {
                path: 'dist/bundle.js',
                name: 'bundle.js',
                type: 'file',
                selected: false,
                extension: '.js'
            }
        ];

        const excludePatterns = ['node_modules/**', 'dist/**'];
        const filtered = fileTreeService.filterFiles(nodes, [], excludePatterns);

        assert.strictEqual(filtered.length, 1);
        assert.strictEqual(filtered[0].path, 'src/main.ts');
    });

    test('Should filter files based on include patterns', () => {
        const nodes: FileTreeNode[] = [
            {
                path: 'src/main.ts',
                name: 'main.ts',
                type: 'file',
                selected: false,
                extension: '.ts'
            },
            {
                path: 'src/utils.js',
                name: 'utils.js',
                type: 'file',
                selected: false,
                extension: '.js'
            },
            {
                path: 'README.md',
                name: 'README.md',
                type: 'file',
                selected: false,
                extension: '.md'
            }
        ];

        const includePatterns = ['*.ts', '*.md'];
        const filtered = fileTreeService.filterFiles(nodes, includePatterns, []);

        assert.strictEqual(filtered.length, 2);
        assert.ok(filtered.some(f => f.path === 'src/main.ts'));
        assert.ok(filtered.some(f => f.path === 'README.md'));
    });

    test('Should identify binary files correctly', () => {
        assert.strictEqual(fileTreeService.isBinaryFile('image.jpg'), true);
        assert.strictEqual(fileTreeService.isBinaryFile('document.pdf'), true);
        assert.strictEqual(fileTreeService.isBinaryFile('archive.zip'), true);
        assert.strictEqual(fileTreeService.isBinaryFile('script.js'), false);
        assert.strictEqual(fileTreeService.isBinaryFile('style.css'), false);
        assert.strictEqual(fileTreeService.isBinaryFile('README.md'), false);
    });

    test('Should handle directory filtering with children', () => {
        const nodes: FileTreeNode[] = [
            {
                path: 'src',
                name: 'src',
                type: 'directory',
                selected: false,
                children: [
                    {
                        path: 'src/main.ts',
                        name: 'main.ts',
                        type: 'file',
                        selected: false,
                        extension: '.ts'
                    },
                    {
                        path: 'src/utils.js',
                        name: 'utils.js',
                        type: 'file',
                        selected: false,
                        extension: '.js'
                    }
                ]
            }
        ];

        const includePatterns = ['*.ts'];
        const filtered = fileTreeService.filterFiles(nodes, includePatterns, []);

        assert.strictEqual(filtered.length, 1);
        assert.strictEqual(filtered[0].type, 'directory');
        assert.strictEqual(filtered[0].children?.length, 1);
        assert.strictEqual(filtered[0].children?.[0].path, 'src/main.ts');
    });

    test('Should exclude directories with no matching children', () => {
        const nodes: FileTreeNode[] = [
            {
                path: 'src',
                name: 'src',
                type: 'directory',
                selected: false,
                children: [
                    {
                        path: 'src/utils.js',
                        name: 'utils.js',
                        type: 'file',
                        selected: false,
                        extension: '.js'
                    }
                ]
            }
        ];

        const includePatterns = ['*.ts'];
        const filtered = fileTreeService.filterFiles(nodes, includePatterns, []);

        assert.strictEqual(filtered.length, 0);
    });
});