import * as assert from 'assert';
import { validateExportConfiguration, validateFileTreeNode, validateFilePath, ValidationError } from '../../validation';
import { ExportConfiguration } from '../../types';

suite('Validation Test Suite', () => {
    
    suite('validateExportConfiguration', () => {
        test('Should validate valid configuration', () => {
            const config: Partial<ExportConfiguration> = {
                format: 'md',
                includeDirectoryStructure: true,
                maxFileSize: 1024,
                excludePatterns: ['*.log'],
                includePatterns: ['*.ts'],
                truncateThreshold: 10240
            };

            const result = validateExportConfiguration(config);
            assert.strictEqual(result.format, 'md');
            assert.strictEqual(result.includeDirectoryStructure, true);
            assert.strictEqual(result.maxFileSize, 1024);
        });

        test('Should apply defaults for missing values', () => {
            const config: Partial<ExportConfiguration> = {
                format: 'txt'
            };

            const result = validateExportConfiguration(config);
            assert.strictEqual(result.format, 'txt');
            assert.strictEqual(result.includeDirectoryStructure, true);
            assert.strictEqual(result.maxFileSize, 1024 * 1024);
            assert.deepStrictEqual(result.excludePatterns, []);
            assert.deepStrictEqual(result.includePatterns, []);
        });

        test('Should throw error for invalid format', () => {
            const config = { format: 'invalid' as any };
            
            assert.throws(() => {
                validateExportConfiguration(config);
            }, ValidationError);
        });

        test('Should throw error for negative maxFileSize', () => {
            const config = { format: 'md' as const, maxFileSize: -1 };
            
            assert.throws(() => {
                validateExportConfiguration(config);
            }, ValidationError);
        });

        test('Should throw error for invalid patterns', () => {
            const config = { format: 'md' as const, excludePatterns: 'not-an-array' as any };
            
            assert.throws(() => {
                validateExportConfiguration(config);
            }, ValidationError);
        });
    });

    suite('validateFileTreeNode', () => {
        test('Should validate valid file node', () => {
            const node = {
                path: 'src/main.ts',
                name: 'main.ts',
                type: 'file',
                selected: false,
                size: 1024,
                extension: '.ts'
            };

            const result = validateFileTreeNode(node);
            assert.deepStrictEqual(result, node);
        });

        test('Should validate valid directory node', () => {
            const node = {
                path: 'src',
                name: 'src',
                type: 'directory',
                selected: true,
                children: []
            };

            const result = validateFileTreeNode(node);
            assert.deepStrictEqual(result, node);
        });

        test('Should throw error for missing required fields', () => {
            const node = {
                name: 'test',
                type: 'file'
                // missing path and selected
            };

            assert.throws(() => {
                validateFileTreeNode(node);
            }, ValidationError);
        });

        test('Should throw error for invalid type', () => {
            const node = {
                path: 'test',
                name: 'test',
                type: 'invalid',
                selected: false
            };

            assert.throws(() => {
                validateFileTreeNode(node);
            }, ValidationError);
        });

        test('Should validate nested children', () => {
            const node = {
                path: 'src',
                name: 'src',
                type: 'directory',
                selected: false,
                children: [
                    {
                        path: 'src/main.ts',
                        name: 'main.ts',
                        type: 'file',
                        selected: false
                    }
                ]
            };

            const result = validateFileTreeNode(node);
            assert.ok(result.children);
            assert.strictEqual(result.children.length, 1);
        });

        test('Should throw error for invalid children', () => {
            const node = {
                path: 'src',
                name: 'src',
                type: 'directory',
                selected: false,
                children: [
                    {
                        // invalid child - missing required fields
                        name: 'invalid'
                    }
                ]
            };

            assert.throws(() => {
                validateFileTreeNode(node);
            }, ValidationError);
        });
    });

    suite('validateFilePath', () => {
        test('Should validate valid relative paths', () => {
            assert.strictEqual(validateFilePath('src/main.ts'), true);
            assert.strictEqual(validateFilePath('folder/subfolder/file.txt'), true);
            assert.strictEqual(validateFilePath('file.txt'), true);
        });

        test('Should reject paths with directory traversal', () => {
            assert.strictEqual(validateFilePath('../outside.txt'), false);
            assert.strictEqual(validateFilePath('src/../outside.txt'), false);
            assert.strictEqual(validateFilePath('folder/../../outside.txt'), false);
        });

        test('Should reject absolute paths', () => {
            assert.strictEqual(validateFilePath('/absolute/path.txt'), false);
            assert.strictEqual(validateFilePath('/src/main.ts'), false);
        });

        test('Should reject paths with double slashes', () => {
            assert.strictEqual(validateFilePath('src//main.ts'), false);
            assert.strictEqual(validateFilePath('folder//subfolder/file.txt'), false);
        });

        test('Should reject empty or invalid paths', () => {
            assert.strictEqual(validateFilePath(''), false);
            assert.strictEqual(validateFilePath(null as any), false);
            assert.strictEqual(validateFilePath(undefined as any), false);
        });
    });
});