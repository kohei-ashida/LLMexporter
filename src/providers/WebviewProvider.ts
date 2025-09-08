/**
 * Webview provider for managing the LLM Context Exporter UI
 */

import * as vscode from 'vscode';
import * as path from 'path';
import {
    WebviewMessage,
    UpdateSelectionMessage,
    GenerateExportMessage,
    WorkspaceTreeResponseMessage,
    ExportProgressMessage,
    ExportCompleteMessage,
    ErrorMessage,
    ExportConfiguration,
    LoadDirectoryChildrenMessage,
    DirectoryChildrenResponseMessage,
    FileTreeNode // Import FileTreeNode
} from '../types';
import { FileTreeService } from '../services/FileTreeService';
import { ExportService } from '../services/ExportService';
import { ConfigurationService, SessionState } from '../services/ConfigurationService';
import { validateExportConfiguration, ValidationError } from '../validation';
import { ErrorHandler } from '../utils/ErrorHandler';
import { Logger } from '../utils/Logger';

export class WebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'llmContextExporter.exporterView';

    private _view?: vscode.WebviewView;
    private fileTreeService: FileTreeService;
    private exportService: ExportService;
    private configurationService: ConfigurationService;
    private selectedPaths: Set<string> = new Set();
    private currentConfiguration: ExportConfiguration;
    private workspaceTree: FileTreeNode[] = []; // Add workspaceTree property

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) {
        this.fileTreeService = new FileTreeService();
        this.exportService = new ExportService(this.fileTreeService);
        this.configurationService = new ConfigurationService(_context);
        // Load default configuration, potentially from a preset
        const defaultPreset = this.configurationService.getDefaultPreset();
        if (defaultPreset) {
            const presets = this.configurationService.getConfigurationPresets();
            this.currentConfiguration = presets[defaultPreset] || this.configurationService.getDefaultExportConfiguration();
        } else {
            this.currentConfiguration = this.configurationService.getDefaultExportConfiguration();
        }

        // Load session state if available and enabled
        if (this.configurationService.shouldRememberSelections()) {
            this.loadSessionState();
        }

        // Watch for configuration changes
        _context.subscriptions.push(
            this.configurationService.onConfigurationChanged(config => {
                this.currentConfiguration = config;
                this.sendConfigurationUpdate();
            })
        );
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            (message: WebviewMessage) => this.handleMessage(message),
            undefined,
            []
        );

        // Send initial data when webview loads
        this.sendWorkspaceTree();
        this.sendConfigurationUpdate();
    }

    private async handleMessage(message: WebviewMessage) {
        try {
            switch (message.type) {
                case 'requestWorkspaceTree':
                    await this.handleRequestWorkspaceTree();
                    break;

                case 'updateSelection':
                    this.handleUpdateSelection(message as UpdateSelectionMessage);
                    break;

                case 'generateExport':
                    await this.handleGenerateExport(message as GenerateExportMessage);
                    break;

                case 'updateConfiguration':
                    this.handleUpdateConfiguration(message);
                    break;

                case 'loadPreset':
                    this.handleLoadPreset(message);
                    break;

                case 'loadDirectoryChildren':
                    await this.handleLoadDirectoryChildren(message as LoadDirectoryChildrenMessage);
                    break;

                default:
                    console.warn(`Unknown message type: ${message.type}`);
            }
        } catch (error) {
            const webviewError = ErrorHandler.createWebviewError('message handling', { messageType: message.type });
            ErrorHandler.handleError(webviewError, false);
            const err = error as Error;
            this.sendError(`Error handling message: ${err.message}`, err.stack);
        }
    }

    private async handleRequestWorkspaceTree() {
        await this.sendWorkspaceTree();
    }

    private handleUpdateSelection(message: UpdateSelectionMessage) {
        const { path, selected, indeterminate } = message.payload;

        // Update selectedPaths set
        if (selected) {
            this.selectedPaths.add(path);
        } else {
            this.selectedPaths.delete(path);
        }

        // Update the actual workspaceTree node with selected and indeterminate states
        this.updateTreeNodeSelectionState(path, selected, indeterminate);

        Logger.debug(`Selection updated: ${path} = ${selected}, indeterminate = ${indeterminate}. Total selected: ${this.selectedPaths.size}`);

        // Save session state
        this.saveSessionState();
    }

    /**
     * Recursively finds a node in the tree and updates its selection and indeterminate state.
     */
    private updateTreeNodeSelectionState(targetPath: string, selected: boolean, indeterminate: boolean = false, nodes: FileTreeNode[] = this.workspaceTree): boolean {
        for (const node of nodes) {
            if (node.path === targetPath) {
                node.selected = selected;
                node.indeterminate = indeterminate;
                return true;
            }
            if (node.children && this.updateTreeNodeSelectionState(targetPath, selected, indeterminate, node.children)) {
                return true;
            }
        }
        return false;
    }

    private handleUpdateConfiguration(message: WebviewMessage) {
        try {
            const config = message.payload as Partial<ExportConfiguration>;
            this.currentConfiguration = this.configurationService.validateAndMigrateConfiguration(config);
            this.saveSessionState();
            Logger.debug('Configuration updated', this.currentConfiguration);
        } catch (error) {
            Logger.error('Failed to update configuration', error as Error);
            this.sendError('Invalid configuration settings');
        }
    }

    private handleLoadPreset(message: WebviewMessage) {
        try {
            const presetName = message.payload.presetName as string;
            const presets = this.configurationService.getConfigurationPresets();

            if (presets[presetName]) {
                this.currentConfiguration = presets[presetName];
                this.saveSessionState();
                this.sendConfigurationUpdate();
                Logger.info(`Loaded configuration preset: ${presetName}`);
            } else {
                this.sendError(`Unknown preset: ${presetName}`);
            }
        } catch (error) {
            Logger.error('Failed to load preset', error as Error);
            this.sendError('Failed to load configuration preset');
        }
    }

    private async handleGenerateExport(message: GenerateExportMessage) {
        const { configuration, selectedPaths } = message.payload;

        try {
            // Validate configuration
            const validConfig = validateExportConfiguration(configuration);

            // Update selected paths from message (in case of sync issues)
            this.selectedPaths = new Set(selectedPaths);

            if (this.selectedPaths.size === 0) {
                this.sendError('No files selected for export');
                return;
            }

            // Generate and export content based on configuration
            const result = await this.exportService.generateAndExport(
                Array.from(this.selectedPaths),
                validConfig,
                (progress, message) => {
                    this.sendProgress(progress, message);
                }
            );

            if (validConfig.outputMethod === 'clipboard') {
                // Handle clipboard export result
                const clipboardResult = result.clipboardResult;
                
                this.sendExportComplete(result, undefined, clipboardResult?.success);

                if (clipboardResult?.success) {
                    const successMessage = clipboardResult.fallbackUsed 
                        ? `Export completed with fallback! ${result.metadata.totalFiles} files processed.`
                        : `Export completed successfully! ${result.metadata.totalFiles} files copied to clipboard.`;
                    vscode.window.showInformationMessage(successMessage);
                } else {
                    this.sendError(clipboardResult?.error || 'Failed to copy content to clipboard');
                }
            } else {
                // Save the file
                const defaultFileName = `llm-context-export-${new Date().toISOString().split('T')[0]}.${validConfig.format}`;
                const saveUri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(defaultFileName),
                    filters: validConfig.format === 'md'
                        ? { 'Markdown': ['md'] }
                        : { 'Text': ['txt'] }
                });

                if (saveUri) {
                    // Add UTF-8 BOM to prevent encoding issues
                    const utf8BOM = Buffer.from([0xEF, 0xBB, 0xBF]);
                    const contentBuffer = Buffer.from(result.content, 'utf8');
                    const finalBuffer = Buffer.concat([utf8BOM, contentBuffer]);
                    
                    await vscode.workspace.fs.writeFile(saveUri, finalBuffer);

                    this.sendExportComplete(result, saveUri.fsPath);

                    // Show success message
                    const openAction = 'Open File';
                    const choice = await vscode.window.showInformationMessage(
                        `Export completed successfully! ${result.metadata.totalFiles} files exported to ${path.basename(saveUri.fsPath)}`,
                        openAction
                    );

                    if (choice === openAction) {
                        await vscode.window.showTextDocument(saveUri);
                    }
                } else {
                    this.sendError('Export cancelled by user');
                }
            }
        } catch (error) {
            if (error instanceof ValidationError) {
                const validationError = ErrorHandler.createValidationError(
                    error.field || 'configuration',
                    'invalid',
                    error.message
                );
                ErrorHandler.handleError(validationError);
            } else {
                const exportError = ErrorHandler.createExportError('generation', { selectedCount: this.selectedPaths.size }, error as Error);
                ErrorHandler.handleError(exportError);
            }
            const err = error as Error;
            this.sendError(`Export failed: ${err.message}`, err.stack);
        }
    }

    private async handleLoadDirectoryChildren(message: LoadDirectoryChildrenMessage) {
        try {
            const { path } = message.payload;
            const children = await this.fileTreeService.loadDirectoryChildren(path);

            const response: DirectoryChildrenResponseMessage = {
                type: 'directoryChildrenResponse',
                payload: {
                    path,
                    children
                }
            };

            this._view?.webview.postMessage(response);
        } catch (error) {
            const err = error as Error;
            this.sendError(`Failed to load directory children: ${err.message}`, err.stack);
        }
    }

    private async sendWorkspaceTree() {
        try {
            // Load workspace tree with lazy loading for subdirectories
            const tree = await this.fileTreeService.getWorkspaceTree(true);
            this.workspaceTree = tree; // Update the workspaceTree property
            const hasWorkspace = vscode.workspace.workspaceFolders !== undefined;

            const message: WorkspaceTreeResponseMessage = {
                type: 'workspaceTreeResponse',
                payload: {
                    tree: this.workspaceTree, // Send the updated tree
                    hasWorkspace
                }
            };

            this._view?.webview.postMessage(message);
        } catch (error) {
            const err = error as Error;
            const treeError = ErrorHandler.createFileSystemError('load workspace tree', 'workspace', err);
            ErrorHandler.handleError(treeError, false);
            this.sendError(`Failed to load workspace tree: ${err.message}`, err.stack);
        }
    }

    private sendProgress(progress: number, message: string) {
        const progressMessage: ExportProgressMessage = {
            type: 'exportProgress',
            payload: {
                progress,
                message
            }
        };

        this._view?.webview.postMessage(progressMessage);
    }

    private sendExportComplete(result: any, filePath?: string, clipboardSuccess?: boolean) {
        const completeMessage: ExportCompleteMessage = {
            type: 'exportComplete',
            payload: {
                result,
                filePath,
                clipboardSuccess
            }
        };

        this._view?.webview.postMessage(completeMessage);
    }

    private sendError(message: string, details?: string) {
        const errorMessage: ErrorMessage = {
            type: 'error',
            payload: {
                message,
                details
            }
        };

        this._view?.webview.postMessage(errorMessage);

        // Also show error in VSCode
        vscode.window.showErrorMessage(`LLM Context Exporter: ${message}`);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));

        // Use a nonce to only allow a specific script to be run.
        const nonce = getNonce();

        // Get VSCode's display language
        const locale = vscode.env.language || 'en';
        
        return `<!DOCTYPE html>
            <html lang="${locale}">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleResetUri}" rel="stylesheet">
                <link href="${styleVSCodeUri}" rel="stylesheet">
                <link href="${styleMainUri}" rel="stylesheet">
                <title>LLM Context Exporter</title>
            </head>
            <body>
                <div id="root">
                    <div class="loading">
                        <div class="loading-spinner"></div>
                        <p>Loading workspace...</p>
                    </div>
                </div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }

    public updateWebview(data: any) {
        if (this._view) {
            this._view.webview.postMessage(data);
        }
    }

    public refresh() {
        this.sendWorkspaceTree();
    }

    public selectAll() {
        if (this._view) {
            this._view.webview.postMessage({ type: 'selectAll' });
        }
    }

    public deselectAll() {
        if (this._view) {
            this._view.webview.postMessage({ type: 'deselectAll' });
        }
    }

    public quickExport() {
        if (this._view) {
            this._view.webview.postMessage({ type: 'quickExport' });
        }
    }

    /**
     * Load session state from workspace storage
     */
    private loadSessionState() {
        try {
            const sessionState = this.configurationService.loadSessionState();
            if (sessionState) {
                this.selectedPaths = new Set(sessionState.selectedPaths);
                this.currentConfiguration = this.configurationService.validateAndMigrateConfiguration(sessionState.lastConfiguration);
                Logger.info(`Loaded session state with ${this.selectedPaths.size} selected files`);
            }
        } catch (error) {
            Logger.warn('Failed to load session state, using defaults', error as Error);
        }
    }

    /**
     * Save current session state to workspace storage
     */
    private saveSessionState() {
        if (!this.configurationService.shouldRememberSelections()) {
            return;
        }

        try {
            const sessionState: SessionState = {
                selectedPaths: Array.from(this.selectedPaths),
                lastConfiguration: this.currentConfiguration,
                timestamp: Date.now()
            };
            this.configurationService.saveSessionState(sessionState);
        } catch (error) {
            Logger.warn('Failed to save session state', error as Error);
        }
    }

    /**
     * Send configuration update to webview
     */
    private sendConfigurationUpdate() {
        if (this._view) {
            const message = {
                type: 'configurationUpdate',
                payload: {
                    configuration: this.currentConfiguration,
                    presets: this.configurationService.getConfigurationPresets(),
                    summary: this.configurationService.getConfigurationSummary(this.currentConfiguration)
                }
            };
            this._view.webview.postMessage(message);
        }
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
