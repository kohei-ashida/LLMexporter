# Design Document

## Overview

The VSCode LLM Context Exporter is an extension that provides a user-friendly interface for selecting and exporting project files and directory structures into a single, well-formatted attachment file. The extension uses VSCode's webview API to create an interactive tree interface and leverages the workspace API for file system operations.

## Architecture

The extension follows VSCode's standard extension architecture with the following key components:

```
Extension Host Process
├── Extension Main (extension.ts)
├── Commands & Context Menus
├── Webview Provider
└── File Processing Service

Webview Process
├── React-based UI
├── File Tree Component
├── Configuration Panel
└── Export Controls
```

### Communication Flow
1. Extension activates and registers commands
2. User triggers command → Main extension creates webview
3. Webview requests workspace data → Extension provides file tree
4. User makes selections → Webview sends selections to extension
5. Extension processes files → Generates output file

## Components and Interfaces

### 1. Extension Main (`extension.ts`)
- **Purpose**: Entry point, command registration, webview management
- **Key Methods**:
  - `activate()`: Register commands and providers
  - `createExporterPanel()`: Initialize webview
  - `handleWebviewMessage()`: Process messages from webview

### 2. Webview Provider (`WebviewProvider.ts`)
- **Purpose**: Manages webview lifecycle and communication
- **Key Methods**:
  - `getHtml()`: Generate webview HTML content
  - `handleMessage()`: Process webview messages
  - `updateWebview()`: Send data to webview

### 3. File Tree Service (`FileTreeService.ts`)
- **Purpose**: Workspace file system operations
- **Key Methods**:
  - `getWorkspaceTree()`: Build directory tree structure
  - `readFileContent()`: Read selected file contents
  - `filterFiles()`: Apply user-defined filters

### 4. Export Service (`ExportService.ts`)
- **Purpose**: Generate formatted output files
- **Key Methods**:
  - `generateExport()`: Create consolidated output
  - `formatFileContent()`: Format individual files
  - `generateDirectoryStructure()`: Create tree overview

### 5. Webview UI Components
- **FileTreeComponent**: Interactive tree with checkboxes
- **FilterPanel**: File type and pattern filtering
- **ExportPanel**: Output format and generation controls
- **SettingsPanel**: User preferences and options

## Data Models

### FileTreeNode
```typescript
interface FileTreeNode {
  path: string;
  name: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  selected: boolean;
  size?: number;
  extension?: string;
}
```

### ExportConfiguration
```typescript
interface ExportConfiguration {
  format: 'txt' | 'md';
  includeDirectoryStructure: boolean;
  maxFileSize: number;
  excludePatterns: string[];
  includePatterns: string[];
  truncateThreshold: number;
}
```

### ExportResult
```typescript
interface ExportResult {
  content: string;
  metadata: {
    totalFiles: number;
    totalSize: number;
    generatedAt: Date;
    truncatedFiles: string[];
  };
}
```

## Error Handling

### File System Errors
- **Large Files**: Warn user and offer truncation options
- **Binary Files**: Automatically exclude with user notification
- **Permission Errors**: Display clear error messages with suggested actions
- **Missing Files**: Skip with warning in export metadata

### Webview Communication Errors
- **Message Failures**: Implement retry mechanism with exponential backoff
- **State Synchronization**: Maintain state consistency between extension and webview
- **Resource Loading**: Graceful fallbacks for missing resources

### Export Generation Errors
- **Memory Limits**: Implement streaming for large exports
- **File Write Errors**: Provide alternative save locations
- **Format Errors**: Validate output before saving

## Testing Strategy

### Unit Tests
- File tree building logic
- Export formatting functions
- Filter application
- Configuration validation

### Integration Tests
- Webview communication flow
- File system operations
- Export generation end-to-end
- Command registration and execution

### Manual Testing Scenarios
- Large workspace handling (1000+ files)
- Various file types and encodings
- Different workspace structures
- Error conditions and edge cases

### Performance Testing
- Memory usage with large selections
- Export generation time
- Webview responsiveness
- File tree rendering performance

## Implementation Notes

### VSCode API Usage
- Use `vscode.workspace.fs` for file operations
- Leverage `vscode.window.createWebviewPanel` for UI
- Implement `vscode.commands.registerCommand` for commands
- Use `vscode.workspace.getConfiguration` for settings

### Security Considerations
- Sanitize file paths to prevent directory traversal
- Validate user input in webview messages
- Limit file size and count to prevent memory issues
- Use CSP headers in webview for security

### Performance Optimizations
- Lazy load directory contents
- Implement virtual scrolling for large trees
- Use worker threads for file processing
- Cache file tree structure

### User Experience
- Provide progress indicators for long operations
- Implement keyboard shortcuts for common actions
- Save user preferences between sessions
- Offer preset configurations for common use cases