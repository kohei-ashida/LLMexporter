/**
 * Service for workspace file system operations and tree building
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { FileTreeNode } from '../types';
import { validateFilePath, sanitizeFilePath } from '../validation';
import { ErrorHandler } from '../utils/ErrorHandler';

export class FileTreeService {
    private static readonly BINARY_EXTENSIONS = new Set([
        '.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o', '.a', '.lib',
        '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.svg', '.webp',
        '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm',
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'
    ]);

    private static readonly DEFAULT_EXCLUDE_PATTERNS = [
        'node_modules/**',
        '.git/**',
        'dist/**',
        'build/**',
        'out/**',
        '*.log',
        '.DS_Store',
        'Thumbs.db'
    ];

    /**
     * Build directory tree structure from VSCode workspace with lazy loading
     */
    async getWorkspaceTree(lazyLoad: boolean = true): Promise<FileTreeNode[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders || workspaceFolders.length === 0) {
            return [];
        }

        const trees: FileTreeNode[] = [];

        for (const folder of workspaceFolders) {
            // For the root workspace folder, load children immediately to show the workspace content
            const rootNode = await this.buildTreeFromUri(folder.uri, folder.name, false);
            if (rootNode) {
                // Set the root to be expanded by default
                rootNode.expanded = true;
                // Ensure the root path is '.' for consistent relative paths
                rootNode.path = '.';
                console.log(`Root node created: ${rootNode.name}, children: ${rootNode.children?.length || 0}`);
                trees.push(rootNode);
            }
        }

        return trees;
    }

    /**
     * Build tree structure from a specific URI with optional lazy loading
     */
    private async buildTreeFromUri(uri: vscode.Uri, name?: string, lazyLoad: boolean = true): Promise<FileTreeNode | null> {
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);

            let relativePath = '';
            if (workspaceFolder) {
                relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
                // If it's the workspace root itself, path.relative returns '', so we use '.'
                if (relativePath === '') {
                    relativePath = '.';
                }
            } else {
                // Fallback for non-workspace files, though typically we operate within a workspace
                relativePath = vscode.workspace.asRelativePath(uri);
            }

            const node: FileTreeNode = {
                path: relativePath,
                name: name || path.basename(uri.fsPath),
                type: stat.type === vscode.FileType.Directory ? 'directory' : 'file',
                selected: false,
                size: stat.type === vscode.FileType.File ? stat.size : undefined,
                extension: stat.type === vscode.FileType.File ? path.extname(uri.fsPath) : undefined,
                expanded: false,
                hasChildren: false,
                indeterminate: false // Initialize indeterminate state
            };

            // If it's a directory, handle children based on lazy loading
            if (stat.type === vscode.FileType.Directory) {
                if (lazyLoad) {
                    // For lazy loading, just check if directory has children
                    node.hasChildren = await this.hasDirectoryChildren(uri);
                    node.children = []; // Empty initially, will be loaded on demand
                } else {
                    // Load all children immediately (legacy behavior)
                    node.children = await this.getDirectoryChildren(uri, lazyLoad);
                    node.hasChildren = node.children.length > 0;
                    node.expanded = true;
                }
            }

            return node;
        } catch (error) {
            ErrorHandler.handleError(
                ErrorHandler.createFileSystemError('read directory tree', uri.fsPath, error as Error),
                false
            );
            return null;
        }
    }

    /**
     * Check if directory has children (for lazy loading)
     */
    private async hasDirectoryChildren(dirUri: vscode.Uri): Promise<boolean> {
        try {
            const entries = await vscode.workspace.fs.readDirectory(dirUri);
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(dirUri);

            for (const [name, _] of entries) {
                const childUri = vscode.Uri.joinPath(dirUri, name);

                // Get proper relative path from workspace root
                let relativePath = name;
                if (workspaceFolder) {
                    relativePath = path.relative(workspaceFolder.uri.fsPath, childUri.fsPath);
                }

                // If we find at least one non-excluded item, directory has children
                if (!this.shouldExcludeByDefault(relativePath)) {
                    return true;
                }
            }

            return false;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get children of a directory
     */
    private async getDirectoryChildren(dirUri: vscode.Uri, lazyLoad: boolean = true): Promise<FileTreeNode[]> {
        try {
            const entries = await vscode.workspace.fs.readDirectory(dirUri);
            const children: FileTreeNode[] = [];
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(dirUri);

            for (const [name, type] of entries) {
                const childUri = vscode.Uri.joinPath(dirUri, name);

                // Get proper relative path from workspace root
                let relativePath = name;
                if (workspaceFolder) {
                    relativePath = path.relative(workspaceFolder.uri.fsPath, childUri.fsPath);
                }

                // Skip if matches default exclude patterns
                if (this.shouldExcludeByDefault(relativePath)) {
                    continue;
                }

                const child: FileTreeNode = {
                    path: relativePath,
                    name: name,
                    type: type === vscode.FileType.Directory ? 'directory' : 'file',
                    selected: false,
                    expanded: false,
                    hasChildren: false,
                    indeterminate: false // Initialize indeterminate state
                };

                if (type === vscode.FileType.File) {
                    try {
                        const stat = await vscode.workspace.fs.stat(childUri);
                        child.size = stat.size;
                        child.extension = path.extname(name);
                    } catch (error) {
                        console.warn(`Could not get stats for ${childUri.fsPath}:`, error);
                    }
                } else if (type === vscode.FileType.Directory) {
                    // Handle directory children based on lazy loading
                    if (lazyLoad) {
                        child.hasChildren = await this.hasDirectoryChildren(childUri);
                        child.children = [];
                        child.expanded = false;
                    } else {
                        child.children = await this.getDirectoryChildren(childUri, lazyLoad);
                        child.hasChildren = child.children.length > 0;
                        child.expanded = true;
                    }
                }

                children.push(child);
            }

            // Sort children: directories first, then files, both alphabetically
            return children.sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === 'directory' ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
            });
        } catch (error) {
            ErrorHandler.handleError(
                ErrorHandler.createFileSystemError('read directory', dirUri.fsPath, error as Error),
                false
            );
            return [];
        }
    }

    /**
     * Filter files based on patterns and extensions
     */
    filterFiles(nodes: FileTreeNode[], includePatterns: string[], excludePatterns: string[]): FileTreeNode[] {
        return nodes.map(node => this.filterNode(node, includePatterns, excludePatterns))
            .filter(node => node !== null) as FileTreeNode[];
    }

    /**
     * Filter a single node and its children
     */
    private filterNode(node: FileTreeNode, includePatterns: string[], excludePatterns: string[]): FileTreeNode | null {
        // Check if this node should be excluded
        if (this.matchesPatterns(node.path, excludePatterns)) {
            return null;
        }

        // If include patterns are specified, check if this node matches
        if (includePatterns.length > 0 && !this.matchesPatterns(node.path, includePatterns)) {
            // For directories, still check children in case they match
            if (node.type === 'directory' && node.children && node.children.length > 0) {
                const filteredChildren = node.children
                    .map(child => this.filterNode(child, includePatterns, excludePatterns))
                    .filter(child => child !== null) as FileTreeNode[];

                // Only include directory if it has matching children
                if (filteredChildren.length > 0) {
                    return {
                        ...node,
                        children: filteredChildren,
                        hasChildren: filteredChildren.length > 0
                    };
                }
            }
            return null;
        }

        // Filter children if this is a directory
        if (node.type === 'directory' && node.children && node.children.length > 0) {
            const filteredChildren = node.children
                .map(child => this.filterNode(child, includePatterns, excludePatterns))
                .filter(child => child !== null) as FileTreeNode[];

            return {
                ...node,
                children: filteredChildren,
                hasChildren: filteredChildren.length > 0
            };
        }

        return node;
    }

    /**
     * Check if a path matches any of the given patterns
     */
    private matchesPatterns(filePath: string, patterns: string[]): boolean {
        return patterns.some(pattern => this.matchesPattern(filePath, pattern));
    }

    /**
     * Check if a path matches a specific pattern (supports basic glob patterns)
     */
    private matchesPattern(filePath: string, pattern: string): boolean {
        // Convert glob pattern to regex
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '[^/]');

        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(filePath);
    }

    /**
     * Check if a file should be excluded by default
     */
    private shouldExcludeByDefault(filePath: string): boolean {
        return this.matchesPatterns(filePath, FileTreeService.DEFAULT_EXCLUDE_PATTERNS);
    }

    /**
     * Check if a file is likely binary based on its extension
     */
    isBinaryFile(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        return FileTreeService.BINARY_EXTENSIONS.has(ext);
    }

    /**
     * Get file content as string
     */
    async getFileContent(filePath: string): Promise<string> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error('No workspace folder available');
            }

            // Handle both workspace folder names and relative paths
            let resolvedPath = filePath;
            if (filePath === workspaceFolder.name) {
                // This is the workspace folder itself, not a file
                throw new Error(`Cannot read directory as file: ${filePath}`);
            }

            // If path starts with workspace folder name, remove it
            if (filePath.startsWith(workspaceFolder.name + '/')) {
                resolvedPath = filePath.substring(workspaceFolder.name.length + 1);
            }

            if (!validateFilePath(resolvedPath)) {
                throw new Error(`Invalid file path: ${filePath}`);
            }

            const sanitizedPath = sanitizeFilePath(resolvedPath);
            const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, sanitizedPath);
            const content = await vscode.workspace.fs.readFile(fileUri);

            // Convert Uint8Array to string with encoding detection
            return this.decodeFileContent(content);
        } catch (error) {
            throw ErrorHandler.createFileSystemError('read', filePath, error as Error);
        }
    }

    /**
     * Decode file content with encoding detection
     */
    private decodeFileContent(content: Uint8Array): string {
        const buffer = Buffer.from(content);
        
        // Check for BOM (Byte Order Mark)
        if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
            // UTF-8 with BOM
            return buffer.slice(3).toString('utf8');
        }
        
        if (buffer.length >= 2) {
            if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
                // UTF-16 LE with BOM
                return buffer.slice(2).toString('utf16le');
            }
            if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
                // UTF-16 BE with BOM
                return buffer.slice(2).swap16().toString('utf16le');
            }
        }
        
        // Get VSCode's file encoding setting
        const encoding = this.getVSCodeEncoding();
        
        try {
            return buffer.toString(encoding);
        } catch (error) {
            // Try UTF-8 as fallback
            try {
                return buffer.toString('utf8');
            } catch (utf8Error) {
                // Last resort: latin1 (preserves all bytes)
                console.warn('Failed to decode file with UTF-8, using latin1 as fallback');
                return buffer.toString('latin1');
            }
        }
    }

    /**
     * Get VSCode's file encoding setting
     */
    private getVSCodeEncoding(): BufferEncoding {
        const config = vscode.workspace.getConfiguration('files');
        const encoding = config.get<string>('encoding', 'utf8');
        
        // Map VSCode encoding names to Node.js encoding names
        const encodingMap: { [key: string]: BufferEncoding } = {
            'utf8': 'utf8',
            'utf8bom': 'utf8',
            'utf16le': 'utf16le',
            'utf16be': 'utf16le', // Node.js doesn't have utf16be, we handle BOM separately
            'windows1252': 'latin1',
            'iso88591': 'latin1',
            'shiftjis': 'latin1', // Fallback to latin1 for unsupported encodings
            'eucjp': 'latin1',
            'gb2312': 'latin1',
            'big5': 'latin1'
        };
        
        return encodingMap[encoding.toLowerCase()] || 'utf8';
    }

    /**
     * Load children for a specific directory (for lazy loading)
     */
    async loadDirectoryChildren(dirPath: string): Promise<FileTreeNode[]> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error('No workspace folder available');
            }

            let dirUri: vscode.Uri;

            // Handle workspace folder root
            if (dirPath === workspaceFolder.name) {
                dirUri = workspaceFolder.uri;
            } else {
                // Remove workspace folder name prefix if present
                let resolvedPath = dirPath;
                if (dirPath.startsWith(workspaceFolder.name + '/')) {
                    resolvedPath = dirPath.substring(workspaceFolder.name.length + 1);
                }
                dirUri = vscode.Uri.joinPath(workspaceFolder.uri, resolvedPath);
            }

            return await this.getDirectoryChildren(dirUri, true);
        } catch (error) {
            ErrorHandler.handleError(
                ErrorHandler.createFileSystemError('load directory children', dirPath, error as Error),
                false
            );
            return [];
        }
    }

    /**
     * Check if a path is a directory
     */
    async isDirectory(filePath: string): Promise<boolean> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return false;
            }

            // Handle both workspace folder names and relative paths
            let resolvedPath = filePath;
            if (filePath === workspaceFolder.name) {
                // This is the workspace folder itself, which is a directory
                return true;
            }

            // If path starts with workspace folder name, remove it
            if (filePath.startsWith(workspaceFolder.name + '/')) {
                resolvedPath = filePath.substring(workspaceFolder.name.length + 1);
            }

            if (!validateFilePath(resolvedPath)) {
                return false;
            }

            const sanitizedPath = sanitizeFilePath(resolvedPath);
            const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, sanitizedPath);
            const stat = await vscode.workspace.fs.stat(fileUri);

            return stat.type === vscode.FileType.Directory;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get file stats
     */
    async getFileStats(filePath: string): Promise<{ size: number; modified: Date }> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error('No workspace folder available');
            }

            // Handle both workspace folder names and relative paths
            let resolvedPath = filePath;
            if (filePath === workspaceFolder.name) {
                // This is the workspace folder itself
                const stat = await vscode.workspace.fs.stat(workspaceFolder.uri);
                return {
                    size: stat.size,
                    modified: new Date(stat.mtime)
                };
            }

            // If path starts with workspace folder name, remove it
            if (filePath.startsWith(workspaceFolder.name + '/')) {
                resolvedPath = filePath.substring(workspaceFolder.name.length + 1);
            }

            if (!validateFilePath(resolvedPath)) {
                throw new Error(`Invalid file path: ${filePath}`);
            }

            const sanitizedPath = sanitizeFilePath(resolvedPath);
            const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, sanitizedPath);
            const stat = await vscode.workspace.fs.stat(fileUri);

            return {
                size: stat.size,
                modified: new Date(stat.mtime)
            };
        } catch (error) {
            throw ErrorHandler.createFileSystemError('get stats', filePath, error as Error);
        }
    }
}
