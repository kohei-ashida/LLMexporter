import * as assert from 'assert';
import * as vscode from 'vscode';
import { ErrorHandler, ErrorType, ExtensionError } from '../../utils/ErrorHandler';

suite('ErrorHandler Test Suite', () => {
    
    setup(() => {
        ErrorHandler.initialize();
    });

    teardown(() => {
        ErrorHandler.dispose();
    });

    test('Should create file system error', () => {
        const originalError = new Error('File not found');
        const error = ErrorHandler.createFileSystemError('read', '/path/to/file.txt', originalError);

        assert.ok(error instanceof ExtensionError);
        assert.strictEqual(error.context.type, ErrorType.FileSystem);
        assert.strictEqual(error.context.operation, 'read');
        assert.strictEqual(error.context.filePath, '/path/to/file.txt');
        assert.strictEqual(error.originalError, originalError);
    });

    test('Should create validation error', () => {
        const error = ErrorHandler.createValidationError('format', 'invalid', 'must be txt or md');

        assert.ok(error instanceof ExtensionError);
        assert.strictEqual(error.context.type, ErrorType.Validation);
        assert.strictEqual(error.context.operation, 'validation');
        assert.deepStrictEqual(error.context.details, {
            field: 'format',
            value: 'invalid',
            reason: 'must be txt or md'
        });
    });

    test('Should create export error', () => {
        const originalError = new Error('Export failed');
        const error = ErrorHandler.createExportError('generation', { fileCount: 5 }, originalError);

        assert.ok(error instanceof ExtensionError);
        assert.strictEqual(error.context.type, ErrorType.Export);
        assert.strictEqual(error.context.operation, 'generation');
        assert.deepStrictEqual(error.context.details, { fileCount: 5 });
        assert.strictEqual(error.originalError, originalError);
    });

    test('Should create webview error', () => {
        const error = ErrorHandler.createWebviewError('message handling', { messageType: 'test' });

        assert.ok(error instanceof ExtensionError);
        assert.strictEqual(error.context.type, ErrorType.Webview);
        assert.strictEqual(error.context.operation, 'message handling');
        assert.deepStrictEqual(error.context.details, { messageType: 'test' });
    });

    test('Should handle generic errors', () => {
        const genericError = new Error('Generic error');
        
        // This should not throw
        assert.doesNotThrow(() => {
            ErrorHandler.handleError(genericError, false);
        });
    });

    test('Should handle extension errors', () => {
        const extensionError = new ExtensionError(
            'Test error',
            {
                type: ErrorType.FileSystem,
                operation: 'test'
            }
        );
        
        // This should not throw
        assert.doesNotThrow(() => {
            ErrorHandler.handleError(extensionError, false);
        });
    });
});