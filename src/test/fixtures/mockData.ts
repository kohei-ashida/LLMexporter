/**
 * Mock data and fixtures for testing
 */

import { FileTreeNode, ExportConfiguration, ExportResult } from '../../types';

export const mockFileTreeNodes: FileTreeNode[] = [
    {
        path: 'src',
        name: 'src',
        type: 'directory',
        selected: false,
        expanded: true,
        hasChildren: true,
        children: [
            {
                path: 'src/main.ts',
                name: 'main.ts',
                type: 'file',
                selected: false,
                size: 1024,
                extension: '.ts',
                expanded: false,
                hasChildren: false
            },
            {
                path: 'src/utils.ts',
                name: 'utils.ts',
                type: 'file',
                selected: false,
                size: 512,
                extension: '.ts',
                expanded: false,
                hasChildren: false
            },
            {
                path: 'src/components',
                name: 'components',
                type: 'directory',
                selected: false,
                expanded: true,
                hasChildren: true,
                children: [
                    {
                        path: 'src/components/Button.tsx',
                        name: 'Button.tsx',
                        type: 'file',
                        selected: false,
                        size: 2048,
                        extension: '.tsx',
                        expanded: false,
                        hasChildren: false
                    }
                ]
            }
        ]
    },
    {
        path: 'package.json',
        name: 'package.json',
        type: 'file',
        selected: false,
        size: 1536,
        extension: '.json',
        expanded: false,
        hasChildren: false
    },
    {
        path: 'README.md',
        name: 'README.md',
        type: 'file',
        selected: false,
        size: 3072,
        extension: '.md',
        expanded: false,
        hasChildren: false
    }
];

export const mockExportConfiguration: ExportConfiguration = {
    format: 'md',
    outputMethod: 'file',
    includeDirectoryStructure: true,
    maxFileSize: 1024 * 1024, // 1MB
    excludePatterns: ['node_modules/**', '*.log'],
    includePatterns: [],
    truncateThreshold: 10 * 1024 * 1024 // 10MB
};

export const mockExportResult: ExportResult = {
    content: `# LLM Context Export

Generated on: 2024-01-01T00:00:00.000Z

---

## Directory Structure

\`\`\`
├── 📁 src
│   ├── main.ts
│   └── utils.ts
└── README.md
\`\`\`

## File: src/main.ts

\`\`\`typescript
// Main application entry point
console.log('Hello, World!');
\`\`\`

## File: src/utils.ts

\`\`\`typescript
// Utility functions
export function helper() {
    return 'helper';
}
\`\`\`

## File: README.md

\`\`\`markdown
# Test Project

This is a test project.
\`\`\`

---

## Export Summary

- **Total Files**: 3
- **Total Size**: 5 KB
`,
    metadata: {
        totalFiles: 3,
        totalSize: 5120,
        generatedAt: new Date('2024-01-01T00:00:00.000Z'),
        truncatedFiles: []
    }
};

export const mockFileContents: { [path: string]: string } = {
    'src/main.ts': `// Main application entry point
console.log('Hello, World!');`,
    
    'src/utils.ts': `// Utility functions
export function helper() {
    return 'helper';
}`,
    
    'src/components/Button.tsx': `import React from 'react';

interface ButtonProps {
    label: string;
    onClick: () => void;
}

export const Button: React.FC<ButtonProps> = ({ label, onClick }) => {
    return <button onClick={onClick}>{label}</button>;
};`,
    
    'package.json': `{
  "name": "test-project",
  "version": "1.0.0",
  "main": "src/main.ts"
}`,
    
    'README.md': `# Test Project

This is a test project for testing the LLM Context Exporter extension.

## Features

- File selection
- Export generation
- Multiple formats`
};

export const mockBinaryFiles = [
    'assets/image.jpg',
    'assets/icon.png',
    'dist/bundle.js.map',
    'docs/manual.pdf'
];

export const mockLargeFile = {
    path: 'large-file.txt',
    size: 5 * 1024 * 1024, // 5MB
    content: 'x'.repeat(5 * 1024 * 1024)
};

export function createMockFileTreeService() {
    return {
        getWorkspaceTree: async () => mockFileTreeNodes,
        filterFiles: (nodes: FileTreeNode[], include: string[], exclude: string[]) => {
            // Simple mock implementation
            return nodes.filter(node => {
                if (exclude.some(pattern => node.path.includes(pattern.replace('/**', '')))) {
                    return false;
                }
                if (include.length > 0) {
                    return include.some(pattern => node.path.includes(pattern.replace('*', '')));
                }
                return true;
            });
        },
        isBinaryFile: (path: string) => mockBinaryFiles.includes(path),
        getFileContent: async (path: string) => {
            if (mockFileContents[path]) {
                return mockFileContents[path];
            }
            if (path === mockLargeFile.path) {
                return mockLargeFile.content;
            }
            throw new Error(`File not found: ${path}`);
        },
        getFileStats: async (path: string) => {
            if (path === mockLargeFile.path) {
                return { size: mockLargeFile.size, modified: new Date() };
            }
            return { size: 1024, modified: new Date() };
        }
    };
}