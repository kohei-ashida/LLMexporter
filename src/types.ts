/**
 * Core data models and interfaces for the VSCode LLM Context Exporter
 */

export interface FileTreeNode {
    path: string;
    name: string;
    type: 'file' | 'directory';
    children?: FileTreeNode[];
    selected: boolean;
    size?: number;
    extension?: string;
    expanded?: boolean;
    hasChildren?: boolean;
    indeterminate?: boolean; // Add for partial selection state
}

export interface ExportConfiguration {
    format: 'txt' | 'md';
    outputMethod: 'file' | 'clipboard';
    includeDirectoryStructure: boolean;
    maxFileSize: number;
    excludePatterns: string[];
    includePatterns: string[];
    truncateThreshold: number;
}

export interface ExportResult {
    content: string;
    metadata: {
        totalFiles: number;
        totalSize: number;
        generatedAt: Date;
        truncatedFiles: string[];
    };
}

// Webview message types for communication between extension and webview
export interface WebviewMessage {
    type: string;
    payload?: any;
}

export interface RequestWorkspaceTreeMessage extends WebviewMessage {
    type: 'requestWorkspaceTree';
}

export interface UpdateSelectionMessage extends WebviewMessage {
    type: 'updateSelection';
    payload: {
        path: string;
        selected: boolean;
        indeterminate?: boolean; // Add for partial selection state
    };
}

export interface GenerateExportMessage extends WebviewMessage {
    type: 'generateExport';
    payload: {
        configuration: ExportConfiguration;
        selectedPaths: string[];
    };
}

export interface WorkspaceTreeResponseMessage extends WebviewMessage {
    type: 'workspaceTreeResponse';
    payload: {
        tree: FileTreeNode[];
        hasWorkspace: boolean;
    };
}

export interface ExportProgressMessage extends WebviewMessage {
    type: 'exportProgress';
    payload: {
        progress: number;
        message: string;
    };
}

export interface ExportCompleteMessage extends WebviewMessage {
    type: 'exportComplete';
    payload: {
        result: ExportResult;
        filePath?: string;
        clipboardSuccess?: boolean;
    };
}

export interface ErrorMessage extends WebviewMessage {
    type: 'error';
    payload: {
        message: string;
        details?: string;
    };
}

export interface LoadDirectoryChildrenMessage extends WebviewMessage {
    type: 'loadDirectoryChildren';
    payload: {
        path: string;
    };
}

export interface DirectoryChildrenResponseMessage extends WebviewMessage {
    type: 'directoryChildrenResponse';
    payload: {
        path: string;
        children: FileTreeNode[];
    };
}
