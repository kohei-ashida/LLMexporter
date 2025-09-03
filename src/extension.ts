import * as vscode from 'vscode';
import { WebviewProvider } from './providers/WebviewProvider';
import { ErrorHandler } from './utils/ErrorHandler';

export function activate(context: vscode.ExtensionContext) {
    console.log('LLM Context Exporter extension is now active');

    // Initialize error handling
    ErrorHandler.initialize();

    // Create webview provider
    const provider = new WebviewProvider(context.extensionUri, context);

    // Register webview provider
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(WebviewProvider.viewType, provider)
    );

    // Register main command to open exporter panel
    const openExporterCommand = vscode.commands.registerCommand('llmContextExporter.openExporter', () => {
        // Focus on the webview if it exists, otherwise show a message
        vscode.commands.executeCommand('workbench.view.extension.llmContextExporter');
    });

    // Register command to refresh the file tree
    const refreshCommand = vscode.commands.registerCommand('llmContextExporter.refresh', () => {
        provider.refresh();
        vscode.window.showInformationMessage('LLM Context Exporter refreshed');
    });

    // Register context menu command for files
    const addFileCommand = vscode.commands.registerCommand('llmContextExporter.addFile', (uri: vscode.Uri) => {
        if (uri) {
            const relativePath = vscode.workspace.asRelativePath(uri);
            vscode.window.showInformationMessage(`Added ${relativePath} to LLM Context Exporter selection`);
            // The actual selection will be handled by the webview
            vscode.commands.executeCommand('workbench.view.extension.llmContextExporter');
        }
    });

    // Register context menu command for folders
    const addFolderCommand = vscode.commands.registerCommand('llmContextExporter.addFolder', (uri: vscode.Uri) => {
        if (uri) {
            const relativePath = vscode.workspace.asRelativePath(uri);
            vscode.window.showInformationMessage(`Added folder ${relativePath} to LLM Context Exporter selection`);
            // The actual selection will be handled by the webview
            vscode.commands.executeCommand('workbench.view.extension.llmContextExporter');
        }
    });

    // Register keyboard shortcut commands
    const selectAllCommand = vscode.commands.registerCommand('llmContextExporter.selectAll', () => {
        provider.selectAll();
    });

    const deselectAllCommand = vscode.commands.registerCommand('llmContextExporter.deselectAll', () => {
        provider.deselectAll();
    });

    const quickExportCommand = vscode.commands.registerCommand('llmContextExporter.quickExport', () => {
        provider.quickExport();
    });

    // Register all commands
    context.subscriptions.push(
        openExporterCommand,
        refreshCommand,
        addFileCommand,
        addFolderCommand,
        selectAllCommand,
        deselectAllCommand,
        quickExportCommand
    );

    // Show welcome message on first activation
    const hasShownWelcome = context.globalState.get('llmContextExporter.hasShownWelcome', false);
    if (!hasShownWelcome) {
        vscode.window.showInformationMessage(
            'LLM Context Exporter is now active! Use the command palette or explorer context menu to get started.',
            'Open Exporter'
        ).then(selection => {
            if (selection === 'Open Exporter') {
                vscode.commands.executeCommand('llmContextExporter.openExporter');
            }
        });
        context.globalState.update('llmContextExporter.hasShownWelcome', true);
    }
}

export function deactivate() {
    console.log('LLM Context Exporter extension is now deactivated');
    ErrorHandler.dispose();
}