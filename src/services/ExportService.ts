/**
 * Service for generating formatted export files from selected content
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { ExportConfiguration, ExportResult, FileTreeNode } from '../types';
import { FileTreeService } from './FileTreeService';

export class ExportService {
    private fileTreeService: FileTreeService;

    constructor(fileTreeService: FileTreeService) {
        this.fileTreeService = fileTreeService;
    }

    /**
     * Generate and export content based on configuration (file or clipboard)
     */
    async generateAndExport(
        selectedPaths: string[],
        configuration: ExportConfiguration,
        progressCallback?: (progress: number, message: string) => void
    ): Promise<ExportResult & { clipboardResult?: { success: boolean; error?: string; fallbackUsed?: boolean } }> {
        // Generate the export content
        const exportResult = await this.generateExport(selectedPaths, configuration, progressCallback);
        
        // If clipboard output is requested, copy to clipboard
        if (configuration.outputMethod === 'clipboard') {
            progressCallback?.(95, 'Copying to clipboard...');
            const clipboardResult = await this.copyToClipboardWithProgress(
                exportResult.content,
                (progress, message) => {
                    // Adjust progress to fit within the remaining 5%
                    const adjustedProgress = 95 + (progress * 0.05);
                    progressCallback?.(adjustedProgress, message);
                }
            );
            
            return {
                ...exportResult,
                clipboardResult
            };
        }
        
        return exportResult;
    }

    /**
     * Generate export content from selected files with memory optimization
     */
    async generateExport(
        selectedPaths: string[],
        configuration: ExportConfiguration,
        progressCallback?: (progress: number, message: string) => void
    ): Promise<ExportResult> {
        const startTime = Date.now();
        const truncatedFiles: string[] = [];
        let totalFiles = 0;
        let totalSize = 0;

        // Use streaming approach for large exports to optimize memory usage
        const contentChunks: string[] = [];
        const CHUNK_SIZE_LIMIT = 1024 * 1024; // 1MB chunks
        let currentChunkSize = 0;

        // Add header
        const header = this.generateHeader(configuration);
        contentChunks.push(header);
        currentChunkSize += header.length;

        // Add directory structure if requested
        if (configuration.includeDirectoryStructure) {
            progressCallback?.(10, 'Generating directory structure...');
            const directoryStructure = await this.generateDirectoryStructure(selectedPaths);

            if (currentChunkSize + directoryStructure.length > CHUNK_SIZE_LIMIT) {
                // Start new chunk if needed
                contentChunks.push(directoryStructure);
                currentChunkSize = directoryStructure.length;
            } else {
                contentChunks[contentChunks.length - 1] += directoryStructure;
                currentChunkSize += directoryStructure.length;
            }
        }

        // Process files in batches to manage memory - filter out directories and binary files
        const validFiles = await this.filterValidFiles(selectedPaths);
        const BATCH_SIZE = 10; // Process 10 files at a time

        for (let batchStart = 0; batchStart < validFiles.length; batchStart += BATCH_SIZE) {
            const batchEnd = Math.min(batchStart + BATCH_SIZE, validFiles.length);
            const batch = validFiles.slice(batchStart, batchEnd);

            // Process batch
            for (let i = 0; i < batch.length; i++) {
                const filePath = batch[i];
                const overallProgress = 20 + ((batchStart + i) / validFiles.length) * 70;
                progressCallback?.(overallProgress, `Processing ${path.basename(filePath)}...`);

                try {
                    const fileContent = await this.processFile(filePath, configuration);
                    if (fileContent.truncated) {
                        truncatedFiles.push(filePath);
                    }

                    // Manage memory by chunking content
                    if (currentChunkSize + fileContent.content.length > CHUNK_SIZE_LIMIT) {
                        contentChunks.push(fileContent.content);
                        currentChunkSize = fileContent.content.length;
                    } else {
                        if (contentChunks.length === 0) {
                            contentChunks.push(fileContent.content);
                        } else {
                            contentChunks[contentChunks.length - 1] += fileContent.content;
                        }
                        currentChunkSize += fileContent.content.length;
                    }

                    totalFiles++;
                    totalSize += fileContent.size;
                } catch (error) {
                    console.error(`Error processing file ${filePath}:`, error);
                    const err = error as Error;
                    const errorContent = this.formatError(filePath, err.message, configuration.format);

                    if (currentChunkSize + errorContent.length > CHUNK_SIZE_LIMIT) {
                        contentChunks.push(errorContent);
                        currentChunkSize = errorContent.length;
                    } else {
                        contentChunks[contentChunks.length - 1] += errorContent;
                        currentChunkSize += errorContent.length;
                    }
                }
            }

            // Force garbage collection hint after each batch
            if (global.gc) {
                global.gc();
            }
        }

        // Add footer
        const footer = this.generateFooter(configuration, totalFiles, totalSize, truncatedFiles);
        if (currentChunkSize + footer.length > CHUNK_SIZE_LIMIT) {
            contentChunks.push(footer);
        } else {
            contentChunks[contentChunks.length - 1] += footer;
        }

        progressCallback?.(95, 'Finalizing export...');

        // Combine chunks efficiently
        const content = contentChunks.join('');

        progressCallback?.(100, 'Export complete!');

        return {
            content,
            metadata: {
                totalFiles,
                totalSize,
                generatedAt: new Date(),
                truncatedFiles
            }
        };
    }

    /**
     * Process a single file and return formatted content
     */
    private async processFile(
        filePath: string,
        configuration: ExportConfiguration
    ): Promise<{ content: string; size: number; truncated: boolean }> {
        const stats = await this.fileTreeService.getFileStats(filePath);
        let fileContent = await this.fileTreeService.getFileContent(filePath);
        let truncated = false;

        // Check if file exceeds size limits
        if (stats.size > configuration.maxFileSize) {
            const truncateAt = Math.floor(configuration.maxFileSize * 0.8); // Leave some buffer
            fileContent = fileContent.substring(0, truncateAt) + '\n\n[... Content truncated due to size limit ...]';
            truncated = true;
        }

        const formattedContent = this.formatFileContent(filePath, fileContent, configuration.format);

        return {
            content: formattedContent,
            size: stats.size,
            truncated
        };
    }

    /**
     * Generate header for the export file
     */
    private generateHeader(configuration: ExportConfiguration): string {
        const timestamp = new Date().toISOString();

        if (configuration.format === 'md') {
            return `# LLM Context Export

Generated on: ${timestamp}

---

`;
        } else {
            return `LLM Context Export
Generated on: ${timestamp}

${'='.repeat(50)}

`;
        }
    }

    /**
     * Generate footer for the export file
     */
    private generateFooter(
        configuration: ExportConfiguration,
        totalFiles: number,
        totalSize: number,
        truncatedFiles: string[]
    ): string {
        const sizeInKB = Math.round(totalSize / 1024);

        let footer = '';

        if (configuration.format === 'md') {
            footer += `\n---\n\n## Export Summary\n\n`;
            footer += `- **Total Files**: ${totalFiles}\n`;
            footer += `- **Total Size**: ${sizeInKB} KB\n`;

            if (truncatedFiles.length > 0) {
                footer += `- **Truncated Files**: ${truncatedFiles.length}\n\n`;
                footer += `### Truncated Files:\n`;
                truncatedFiles.forEach(file => {
                    footer += `- ${file}\n`;
                });
            }
        } else {
            footer += `\n${'='.repeat(50)}\n\n`;
            footer += `Export Summary:\n`;
            footer += `- Total Files: ${totalFiles}\n`;
            footer += `- Total Size: ${sizeInKB} KB\n`;

            if (truncatedFiles.length > 0) {
                footer += `- Truncated Files: ${truncatedFiles.length}\n\n`;
                footer += `Truncated Files:\n`;
                truncatedFiles.forEach(file => {
                    footer += `  - ${file}\n`;
                });
            }
        }

        return footer;
    }

    /**
     * Generate directory structure overview
     */
    private async generateDirectoryStructure(selectedPaths: string[]): Promise<string> {
        // Get only valid files (not directories) for the structure
        const validFiles = await this.filterValidFiles(selectedPaths);

        // Build a tree structure from file paths
        const tree = await this.buildPathTree(validFiles);
        const treeString = this.renderTree(tree);

        return `## Directory Structure\n\n\`\`\`\n${treeString}\n\`\`\`\n\n`;
    }

    /**
     * Build a tree structure from file paths
     */
    private async buildPathTree(filePaths: string[]): Promise<TreeNode> {
        const root: TreeNode = { name: '', children: new Map(), isFile: false };

        for (const filePath of filePaths) {
            // If the path is '.', it represents the root, so we don't split it further for the tree structure
            if (filePath === '.') {
                continue;
            }

            const parts = filePath.split('/').filter(part => part.length > 0);
            let current = root;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const isLastPart = i === parts.length - 1;

                let isFile = false;
                if (isLastPart) {
                    // Determine if it's a file by checking if it's NOT a directory
                    isFile = !(await this.fileTreeService.isDirectory(filePath));
                }

                if (!current.children.has(part)) {
                    current.children.set(part, {
                        name: part,
                        children: new Map(),
                        isFile: isFile
                    });
                }
                current = current.children.get(part)!;
            }
        }

        return root;
    }

    /**
     * Render tree structure as ASCII art
     */
    private renderTree(node: TreeNode, prefix: string = '', isLast: boolean = true): string {
        let result = '';
        const children = Array.from(node.children.values()).sort((a, b) => {
            // Directories first, then files
            if (a.isFile !== b.isFile) {
                return a.isFile ? 1 : -1;
            }
            return a.name.localeCompare(b.name);
        });

        children.forEach((child, index) => {
            const isLastChild = index === children.length - 1;
            const connector = isLastChild ? '└── ' : '├── ';
            const icon = child.isFile ? '' : '📁 ';

            result += `${prefix}${connector}${icon}${child.name}\n`;

            if (child.children.size > 0) {
                const newPrefix = prefix + (isLastChild ? '    ' : '│   ');
                result += this.renderTree(child, newPrefix, isLastChild);
            }
        });

        return result;
    }

    /**
     * Format file content with headers and syntax highlighting hints
     */
    private formatFileContent(filePath: string, content: string, format: 'txt' | 'md'): string {
        const extension = path.extname(filePath);
        const language = this.getLanguageFromExtension(extension);

        if (format === 'md') {
            return `## File: ${filePath}\n\n\`\`\`${language}\n${content}\n\`\`\`\n\n`;
        } else {
            const separator = '='.repeat(Math.min(filePath.length + 10, 80));
            return `${separator}\nFile: ${filePath}\n${separator}\n\n${content}\n\n`;
        }
    }

    /**
     * Format error message for failed file processing
     */
    private formatError(filePath: string, errorMessage: string, format: 'txt' | 'md'): string {
        if (format === 'md') {
            return `## File: ${filePath}\n\n**Error**: ${errorMessage}\n\n`;
        } else {
            const separator = '='.repeat(Math.min(filePath.length + 10, 80));
            return `${separator}\nFile: ${filePath}\n${separator}\n\nError: ${errorMessage}\n\n`;
        }
    }

    /**
     * Filter selected paths to only include valid files (not directories or binary files)
     */
    private async filterValidFiles(selectedPaths: string[]): Promise<string[]> {
        const validFiles: string[] = [];

        for (const filePath of selectedPaths) {
            try {
                // Skip directories
                const isDir = await this.fileTreeService.isDirectory(filePath);
                if (isDir) {
                    console.log(`Skipping directory: ${filePath}`);
                    continue;
                }

                // Skip binary files
                if (this.fileTreeService.isBinaryFile(filePath)) {
                    console.log(`Skipping binary file: ${filePath}`);
                    continue;
                }

                // If we get here, it's a valid text file
                validFiles.push(filePath);
            } catch (error) {
                const err = error as Error;
                console.warn(`Could not process ${filePath}:`, err.message);
            }
        }

        return validFiles;
    }



    /**
     * Copy formatted content to system clipboard with error handling and fallback mechanisms
     */
    async copyToClipboard(content: string): Promise<{ success: boolean; error?: string; fallbackUsed?: boolean }> {
        try {
            // First attempt: Use VSCode's clipboard API
            await vscode.env.clipboard.writeText(content);
            
            // Show visual confirmation
            vscode.window.showInformationMessage('Content copied to clipboard successfully!');
            
            return { success: true };
        } catch (primaryError) {
            console.error('Primary clipboard operation failed:', primaryError);
            
            // Fallback mechanism 1: Try with smaller chunks if content is too large
            if (content.length > 1024 * 1024) { // 1MB threshold
                try {
                    // Truncate content and try again
                    const truncatedContent = content.substring(0, 1024 * 1024) + '\n\n[... Content truncated for clipboard compatibility ...]';
                    await vscode.env.clipboard.writeText(truncatedContent);
                    
                    vscode.window.showWarningMessage('Content was truncated and copied to clipboard due to size limitations.');
                    
                    return { success: true, fallbackUsed: true };
                } catch (fallbackError) {
                    console.error('Fallback clipboard operation failed:', fallbackError);
                }
            }
            
            // Fallback mechanism 2: Offer to save as file instead
            const errorMessage = primaryError instanceof Error ? primaryError.message : 'Unknown clipboard error';
            const fallbackAction = await vscode.window.showErrorMessage(
                `Failed to copy to clipboard: ${errorMessage}. Would you like to save as a file instead?`,
                'Save as File',
                'Cancel'
            );
            
            if (fallbackAction === 'Save as File') {
                try {
                    const saveUri = await vscode.window.showSaveDialog({
                        defaultUri: vscode.Uri.file('llm-context-export.txt'),
                        filters: {
                            'Text Files': ['txt'],
                            'Markdown Files': ['md'],
                            'All Files': ['*']
                        }
                    });
                    
                    if (saveUri) {
                        // Add UTF-8 BOM to prevent encoding issues
                        const utf8BOM = Buffer.from([0xEF, 0xBB, 0xBF]);
                        const contentBuffer = Buffer.from(content, 'utf8');
                        const finalBuffer = Buffer.concat([utf8BOM, contentBuffer]);
                        
                        await vscode.workspace.fs.writeFile(saveUri, finalBuffer);
                        vscode.window.showInformationMessage(`Content saved to ${saveUri.fsPath}`);
                        return { success: true, fallbackUsed: true };
                    }
                } catch (saveError) {
                    console.error('File save fallback failed:', saveError);
                    const saveErrorMessage = saveError instanceof Error ? saveError.message : 'Unknown save error';
                    vscode.window.showErrorMessage(`Failed to save file: ${saveErrorMessage}`);
                }
            }
            
            // All fallbacks failed
            return { 
                success: false, 
                error: `Clipboard operation failed: ${errorMessage}` 
            };
        }
    }

    /**
     * Copy formatted content to clipboard with progress tracking
     */
    async copyToClipboardWithProgress(
        content: string,
        progressCallback?: (progress: number, message: string) => void
    ): Promise<{ success: boolean; error?: string; fallbackUsed?: boolean }> {
        progressCallback?.(0, 'Preparing clipboard operation...');
        
        // Check content size and warn user if it's very large
        const sizeInMB = content.length / (1024 * 1024);
        if (sizeInMB > 10) {
            const proceed = await vscode.window.showWarningMessage(
                `The content is ${sizeInMB.toFixed(1)}MB. Large clipboard operations may be slow or fail. Continue?`,
                'Continue',
                'Cancel'
            );
            
            if (proceed !== 'Continue') {
                return { success: false, error: 'Operation cancelled by user' };
            }
        }
        
        progressCallback?.(50, 'Copying to clipboard...');
        
        const result = await this.copyToClipboard(content);
        
        progressCallback?.(100, result.success ? 'Copied successfully!' : 'Copy failed');
        
        return result;
    }

    /**
     * Get language identifier from file extension for syntax highlighting
     */
    private getLanguageFromExtension(extension: string): string {
        const languageMap: { [key: string]: string } = {
            '.js': 'javascript',
            '.ts': 'typescript',
            '.jsx': 'jsx',
            '.tsx': 'tsx',
            '.py': 'python',
            '.java': 'java',
            '.c': 'c',
            '.cpp': 'cpp',
            '.cs': 'csharp',
            '.php': 'php',
            '.rb': 'ruby',
            '.go': 'go',
            '.rs': 'rust',
            '.swift': 'swift',
            '.kt': 'kotlin',
            '.scala': 'scala',
            '.html': 'html',
            '.css': 'css',
            '.scss': 'scss',
            '.sass': 'sass',
            '.less': 'less',
            '.xml': 'xml',
            '.json': 'json',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.toml': 'toml',
            '.ini': 'ini',
            '.cfg': 'ini',
            '.conf': 'ini',
            '.sh': 'bash',
            '.bash': 'bash',
            '.zsh': 'zsh',
            '.fish': 'fish',
            '.ps1': 'powershell',
            '.sql': 'sql',
            '.md': 'markdown',
            '.dockerfile': 'dockerfile',
            '.gitignore': 'gitignore',
            '.env': 'bash'
        };

        return languageMap[extension.toLowerCase()] || '';
    }
}

interface TreeNode {
    name: string;
    children: Map<string, TreeNode>;
    isFile: boolean;
}
