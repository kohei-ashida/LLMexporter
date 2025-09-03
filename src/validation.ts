/**
 * Validation functions for configuration objects and data models
 */

import { ExportConfiguration, FileTreeNode } from './types';

export class ValidationError extends Error {
    constructor(message: string, public field?: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

export function validateExportConfiguration(config: Partial<ExportConfiguration>): ExportConfiguration {
    const errors: string[] = [];

    // Validate format
    if (!config.format || !['txt', 'md'].includes(config.format)) {
        errors.push('Format must be either "txt" or "md"');
    }

    // Validate outputMethod
    if (!config.outputMethod || !['file', 'clipboard'].includes(config.outputMethod)) {
        errors.push('Output method must be either "file" or "clipboard"');
    }

    // Validate maxFileSize
    if (config.maxFileSize !== undefined) {
        if (typeof config.maxFileSize !== 'number' || config.maxFileSize <= 0) {
            errors.push('maxFileSize must be a positive number');
        }
    }

    // Validate truncateThreshold
    if (config.truncateThreshold !== undefined) {
        if (typeof config.truncateThreshold !== 'number' || config.truncateThreshold <= 0) {
            errors.push('truncateThreshold must be a positive number');
        }
    }

    // Validate patterns
    if (config.excludePatterns && !Array.isArray(config.excludePatterns)) {
        errors.push('excludePatterns must be an array of strings');
    }

    if (config.includePatterns && !Array.isArray(config.includePatterns)) {
        errors.push('includePatterns must be an array of strings');
    }

    if (errors.length > 0) {
        throw new ValidationError(`Configuration validation failed: ${errors.join(', ')}`);
    }

    // Return validated configuration with defaults
    return {
        format: config.format || 'txt',
        outputMethod: config.outputMethod || 'file',
        includeDirectoryStructure: config.includeDirectoryStructure ?? true,
        maxFileSize: config.maxFileSize || 1024 * 1024, // 1MB default
        excludePatterns: config.excludePatterns || [],
        includePatterns: config.includePatterns || [],
        truncateThreshold: config.truncateThreshold || 10 * 1024 * 1024 // 10MB default
    };
}

export function validateFileTreeNode(node: any): FileTreeNode {
    if (!node || typeof node !== 'object') {
        throw new ValidationError('FileTreeNode must be an object');
    }

    if (!node.path || typeof node.path !== 'string') {
        throw new ValidationError('FileTreeNode.path must be a non-empty string');
    }

    if (!node.name || typeof node.name !== 'string') {
        throw new ValidationError('FileTreeNode.name must be a non-empty string');
    }

    if (!node.type || !['file', 'directory'].includes(node.type)) {
        throw new ValidationError('FileTreeNode.type must be either "file" or "directory"');
    }

    if (typeof node.selected !== 'boolean') {
        throw new ValidationError('FileTreeNode.selected must be a boolean');
    }

    // Validate optional fields
    if (node.size !== undefined && (typeof node.size !== 'number' || node.size < 0)) {
        throw new ValidationError('FileTreeNode.size must be a non-negative number');
    }

    if (node.extension !== undefined && typeof node.extension !== 'string') {
        throw new ValidationError('FileTreeNode.extension must be a string');
    }

    if (node.children !== undefined) {
        if (!Array.isArray(node.children)) {
            throw new ValidationError('FileTreeNode.children must be an array');
        }
        // Recursively validate children
        node.children.forEach((child: any, index: number) => {
            try {
                validateFileTreeNode(child);
            } catch (error) {
                const err = error as Error;
                throw new ValidationError(`Invalid child at index ${index}: ${err.message}`);
            }
        });
    }

    return node as FileTreeNode;
}

export function validateFilePath(path: string): boolean {
    if (!path || typeof path !== 'string') {
        return false;
    }

    // Basic path validation - no directory traversal
    if (path.includes('..') || path.includes('//')) {
        return false;
    }

    // Must not start with / (relative paths only)
    if (path.startsWith('/')) {
        return false;
    }

    return true;
}

export function sanitizeFilePath(path: string): string {
    if (!validateFilePath(path)) {
        throw new ValidationError(`Invalid file path: ${path}`);
    }

    // Normalize path separators and remove any dangerous patterns
    return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}