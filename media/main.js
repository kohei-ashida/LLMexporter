// Main JavaScript for the webview
(function () {
    const vscode = acquireVsCodeApi();

    let workspaceTree = [];
    let selectedPaths = new Set();
    let isExporting = false;
    let currentConfiguration = {};
    let configurationPresets = {};

    // DOM elements
    let rootElement;
    let fileTreeElement;
    let configElement;
    let exportButton;
    let progressSection;
    let selectionSummary;

    // Initialize when DOM is loaded
    document.addEventListener('DOMContentLoaded', function () {
        rootElement = document.getElementById('root');
        initializeUI();
        requestWorkspaceTree();
    });

    // Listen for messages from the extension
    window.addEventListener('message', event => {
        const message = event.data;

        switch (message.type) {
            case 'workspaceTreeResponse':
                handleWorkspaceTreeResponse(message.payload);
                break;
            case 'directoryChildrenResponse':
                handleDirectoryChildrenResponse(message.payload);
                break;
            case 'exportProgress':
                handleExportProgress(message.payload);
                break;
            case 'exportComplete':
                handleExportComplete(message.payload);
                break;
            case 'error':
                handleError(message.payload);
                break;
            case 'configurationUpdate':
                handleConfigurationUpdate(message.payload);
                break;
            case 'selectAll':
                handleSelectAll();
                break;
            case 'deselectAll':
                handleDeselectAll();
                break;
            case 'quickExport':
                handleQuickExport();
                break;
        }
    });

    function initializeUI() {
        rootElement.innerHTML = `
            <div class="container">
                <div class="section">
                    <div class="section-title">File Selection</div>
                    <div id="file-tree" class="file-tree">
                        <div class="loading">
                            <div class="loading-spinner"></div>
                            <p>Loading workspace...</p>
                        </div>
                    </div>
                    <div id="selection-summary" class="selection-summary" style="display: none;">
                        No files selected
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Export Configuration</div>
                    <div id="config" class="config-section">
                        <div class="config-row">
                            <label class="config-label">Configuration Preset:</label>
                            <div class="config-input">
                                <select id="preset-select">
                                    <option value="">Custom Configuration</option>
                                </select>
                            </div>
                        </div>
                        <div class="config-row">
                            <label class="config-label">Format:</label>
                            <div class="config-input">
                                <select id="format-select">
                                    <option value="txt">Text (.txt)</option>
                                    <option value="md" selected>Markdown (.md)</option>
                                </select>
                            </div>
                        </div>
                        <div class="config-row">
                            <label class="config-label">Output:</label>
                            <div class="config-input">
                                <div class="radio-group">
                                    <label class="radio-option">
                                        <input type="radio" name="output-method" value="file" checked>
                                        <span class="radio-label">Save to file</span>
                                    </label>
                                    <label class="radio-option">
                                        <input type="radio" name="output-method" value="clipboard">
                                        <span class="radio-label">Copy to clipboard</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div class="config-row">
                            <label class="config-label">
                                <input type="checkbox" id="include-structure" checked> 
                                Include directory structure
                            </label>
                        </div>
                        <div class="config-row">
                            <label class="config-label">Max file size (KB):</label>
                            <div class="config-input">
                                <input type="number" id="max-file-size" value="1024" min="1" max="10240">
                            </div>
                        </div>
                        <div class="config-row">
                            <label class="config-label">Exclude patterns:</label>
                            <div class="config-input">
                                <textarea id="exclude-patterns" rows="3" placeholder="node_modules/**&#10;.git/**&#10;*.log"></textarea>
                            </div>
                        </div>
                        <div class="config-row">
                            <label class="config-label">Include patterns (optional):</label>
                            <div class="config-input">
                                <textarea id="include-patterns" rows="2" placeholder="*.ts&#10;*.js&#10;*.md"></textarea>
                            </div>
                        </div>
                        <div id="config-summary" class="config-summary" style="display: none;"></div>
                    </div>
                </div>

                <div class="section export-section">
                    <button id="export-button" class="export-button" disabled>
                        Generate Export
                    </button>
                    <div id="clipboard-notification" class="clipboard-notification" style="display: none;">
                        <div class="notification-content">
                            <span id="notification-message"></span>
                        </div>
                    </div>
                </div>

                <div id="progress-section" class="progress-section" style="display: none;">
                    <div class="progress-bar">
                        <div id="progress-fill" class="progress-fill" style="width: 0%"></div>
                    </div>
                    <div id="progress-message" class="progress-message">Preparing export...</div>
                </div>
            </div>
        `;

        // Get references to elements
        fileTreeElement = document.getElementById('file-tree');
        configElement = document.getElementById('config');
        exportButton = document.getElementById('export-button');
        progressSection = document.getElementById('progress-section');
        selectionSummary = document.getElementById('selection-summary');

        // Add event listeners
        exportButton.addEventListener('click', handleExportClick);

        // Add configuration change listeners
        document.getElementById('preset-select').addEventListener('change', handlePresetChange);
        document.getElementById('format-select').addEventListener('change', handleConfigurationChange);
        document.getElementById('include-structure').addEventListener('change', handleConfigurationChange);
        document.getElementById('max-file-size').addEventListener('input', handleConfigurationChange);
        document.getElementById('exclude-patterns').addEventListener('input', handleConfigurationChange);
        document.getElementById('include-patterns').addEventListener('input', handleConfigurationChange);
        
        // Add output method change listeners
        document.querySelectorAll('input[name="output-method"]').forEach(radio => {
            radio.addEventListener('change', handleOutputMethodChange);
        });
    }

    function requestWorkspaceTree() {
        vscode.postMessage({ type: 'requestWorkspaceTree' });
    }

    function handleWorkspaceTreeResponse(payload) {
        const { tree, hasWorkspace } = payload;

        if (!hasWorkspace) {
            fileTreeElement.innerHTML = `
                <div class="no-workspace">
                    <p>No workspace folder is open.</p>
                    <p>Please open a folder to use the LLM Context Exporter.</p>
                </div>
            `;
            return;
        }

        workspaceTree = tree;
        renderFileTree();
    }

    function renderFileTree() {
        if (workspaceTree.length === 0) {
            fileTreeElement.innerHTML = `
                <div class="no-workspace">
                    <p>No files found in workspace.</p>
                </div>
            `;
            return;
        }

        const treeHTML = workspaceTree.map(node => renderTreeNode(node, 0)).join('');
        fileTreeElement.innerHTML = `<div class="tree-container">${treeHTML}</div>`;

        // Add click listeners to checkboxes and expand/collapse
        fileTreeElement.addEventListener('change', handleTreeNodeChange);
        fileTreeElement.addEventListener('click', handleTreeNodeClick);

        // Add keyboard navigation
        fileTreeElement.addEventListener('keydown', handleTreeKeyDown);
        fileTreeElement.setAttribute('tabindex', '0');
    }

    function renderTreeNode(node, depth) {
        const isSelected = selectedPaths.has(node.path);
        const isDirectory = node.type === 'directory';
        const hasChildren = node.hasChildren || (node.children && node.children.length > 0);
        const isExpanded = node.expanded || false;

        // Determine icon based on type and expansion state
        let icon = '📄';
        if (isDirectory) {
            icon = isExpanded ? '📂' : '📁';
        }

        const sizeText = node.size ? `(${formatFileSize(node.size)})` : '';
        const expanderIcon = hasChildren ? (isExpanded ? '▼' : '▶') : '';

        let html = `
            <div class="tree-node" data-path="${node.path}" data-type="${node.type}" data-expanded="${isExpanded}" data-has-children="${hasChildren}" tabindex="0" role="treeitem" aria-expanded="${isExpanded}" aria-selected="${isSelected}">
                <div class="tree-node-indent" style="width: ${depth * 16}px;"></div>
                ${hasChildren ? `<div class="tree-node-expander" role="button" aria-label="Toggle expansion">${expanderIcon}</div>` : '<div class="tree-node-expander-spacer"></div>'}
                <input type="checkbox" class="tree-node-checkbox" ${isSelected ? 'checked' : ''} ${node.indeterminate ? 'indeterminate' : ''} aria-label="Select ${node.name}">
                <div class="tree-node-icon">${icon}</div>
                <div class="tree-node-label">${node.name}</div>
                <div class="tree-node-size">${sizeText}</div>
            </div>
        `;

        // Only render children if expanded and they exist
        if (isExpanded && node.children && node.children.length > 0) {
            html += `<div class="tree-node-children">`;
            html += node.children.map(child => renderTreeNode(child, depth + 1)).join('');
            html += `</div>`;
        }

        return html;
    }

    function handleTreeNodeChange(event) {
        if (event.target.type === 'checkbox') {
            const treeNodeElement = event.target.closest('.tree-node');
            const path = treeNodeElement.dataset.path;
            const isChecked = event.target.checked;
            const node = findNodeByPath(workspaceTree, path);

            if (!node) return;

            // Update current node's selection
            node.selected = isChecked;
            node.indeterminate = false; // When explicitly checked/unchecked, it's no longer indeterminate
            updateSelectionState(node, isChecked, false);

            // If it's a directory, update all children
            if (node.type === 'directory') {
                updateChildSelection(node, isChecked);
            }

            // Update parent's selection state based on children
            updateParentSelection(node);

            // Re-render the tree to reflect all changes
            renderFileTree();
            updateSelectionSummary();
            updateExportButton();
        }
    }

    // Recursively update selection state of children
    function updateChildSelection(node, selected) {
        if (node.children) {
            node.children.forEach(child => {
                child.selected = selected;
                child.indeterminate = false;
                updateSelectionState(child, selected, false);
                if (child.type === 'directory') {
                    updateChildSelection(child, selected);
                }
            });
        }
    }

    // Update parent's selection state based on children
    function updateParentSelection(node) {
        const parentNode = findParentNode(workspaceTree, node.path);
        if (!parentNode) return;

        const children = parentNode.children || [];
        const allChildrenSelected = children.every(child => child.selected);
        const noChildrenSelected = children.every(child => !child.selected && !child.indeterminate);
        const someChildrenSelected = children.some(child => child.selected || child.indeterminate);

        if (allChildrenSelected) {
            parentNode.selected = true;
            parentNode.indeterminate = false;
            updateSelectionState(parentNode, true, false);
        } else if (noChildrenSelected) {
            parentNode.selected = false;
            parentNode.indeterminate = false;
            updateSelectionState(parentNode, false, false);
        } else if (someChildrenSelected) {
            parentNode.selected = false;
            parentNode.indeterminate = true;
            updateSelectionState(parentNode, false, true);
        } else {
            parentNode.selected = false;
            parentNode.indeterminate = false;
            updateSelectionState(parentNode, false, false);
        }

        // Recursively update grand-parents
        updateParentSelection(parentNode);
    }

    // Helper to update the global selectedPaths set and notify extension
    function updateSelectionState(node, selected, indeterminate = false) {
        if (selected) {
            selectedPaths.add(node.path);
        } else {
            selectedPaths.delete(node.path);
        }
        // Send update to extension
        vscode.postMessage({
            type: 'updateSelection',
            payload: { path: node.path, selected: selected, indeterminate: indeterminate }
        });
    }

    // Find parent node by child path
    function findParentNode(nodes, childPath) {
        for (let node of nodes) {
            if (node.children) {
                for (let child of node.children) {
                    if (child.path === childPath) {
                        return node;
                    }
                }
                const found = findParentNode(node.children, childPath);
                if (found) return found;
            }
        }
        return null;
    }

    function handleTreeNodeClick(event) {
        // Handle expanding/collapsing directories
        if (event.target.classList.contains('tree-node-expander') ||
            (event.target.classList.contains('tree-node-label') && event.target.closest('.tree-node').dataset.type === 'directory')) {

            const treeNode = event.target.closest('.tree-node');
            const path = treeNode.dataset.path;
            const hasChildren = treeNode.dataset.hasChildren === 'true';
            const isExpanded = treeNode.dataset.expanded === 'true';

            if (hasChildren) {
                toggleDirectoryExpansion(path, !isExpanded);
            }
        }
    }

    function handleDirectoryChildrenResponse(payload) {
        const { path, children } = payload;

        // Find the node in the tree and update its children
        updateNodeChildren(workspaceTree, path, children);

        // Re-render the tree
        renderFileTree();
    }

    function updateNodeChildren(nodes, targetPath, children) {
        for (let node of nodes) {
            if (node.path === targetPath) {
                node.children = children;
                node.expanded = true;
                return true;
            }
            if (node.children) {
                // After loading children, update their selection state based on parent
                // and then update parent's state based on newly loaded children
                children.forEach(child => {
                    child.selected = node.selected;
                    if (node.selected) {
                        selectedPaths.add(child.path);
                    } else {
                        selectedPaths.delete(child.path);
                    }
                });
                updateParentSelection(node); // Re-evaluate parent after children are loaded
                if (updateNodeChildren(node.children, targetPath, children)) {
                    return true;
                }
            }
        }
        return false;
    }

    function toggleDirectoryExpansion(path, expand) {
        const node = findNodeByPath(workspaceTree, path);
        if (!node || node.type !== 'directory') return;

        if (expand && (!node.children || node.children.length === 0)) {
            // Load children from extension
            vscode.postMessage({
                type: 'loadDirectoryChildren',
                payload: { path }
            });
        } else {
            // Just toggle expansion state
            node.expanded = expand;
            renderFileTree();
        }
    }

    function findNodeByPath(nodes, targetPath) {
        for (let node of nodes) {
            if (node.path === targetPath) {
                return node;
            }
            if (node.children) {
                const found = findNodeByPath(node.children, targetPath);
                if (found) return found;
            }
        }
        return null;
    }

    function handleTreeKeyDown(event) {
        const focusedElement = document.activeElement;
        if (!focusedElement || !focusedElement.classList.contains('tree-node')) return;

        const currentNode = focusedElement;
        const path = currentNode.dataset.path;

        switch (event.key) {
            case 'ArrowRight':
                // Expand directory or move to first child
                if (currentNode.dataset.type === 'directory' && currentNode.dataset.hasChildren === 'true') {
                    if (currentNode.dataset.expanded !== 'true') {
                        toggleDirectoryExpansion(path, true);
                    } else {
                        // Move to first child
                        const nextSibling = currentNode.nextElementSibling;
                        if (nextSibling && nextSibling.classList.contains('tree-node-children')) {
                            const firstChild = nextSibling.querySelector('.tree-node');
                            if (firstChild) firstChild.focus();
                        }
                    }
                }
                event.preventDefault();
                break;

            case 'ArrowLeft':
                // Collapse directory or move to parent
                if (currentNode.dataset.type === 'directory' && currentNode.dataset.expanded === 'true') {
                    toggleDirectoryExpansion(path, false);
                } else {
                    // Move to parent
                    const parent = currentNode.closest('.tree-node-children')?.previousElementSibling;
                    if (parent && parent.classList.contains('tree-node')) {
                        parent.focus();
                    }
                }
                event.preventDefault();
                break;

            case 'ArrowDown':
                // Move to next visible node
                const nextNode = getNextVisibleNode(currentNode);
                if (nextNode) nextNode.focus();
                event.preventDefault();
                break;

            case 'ArrowUp':
                // Move to previous visible node
                const prevNode = getPreviousVisibleNode(currentNode);
                if (prevNode) prevNode.focus();
                event.preventDefault();
                break;

            case ' ':
            case 'Enter':
                // Toggle selection
                const checkbox = currentNode.querySelector('.tree-node-checkbox');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                }
                event.preventDefault();
                break;
        }
    }

    function getNextVisibleNode(currentNode) {
        // Check if current node has expanded children
        const childrenContainer = currentNode.nextElementSibling;
        if (childrenContainer && childrenContainer.classList.contains('tree-node-children')) {
            const firstChild = childrenContainer.querySelector('.tree-node');
            if (firstChild) return firstChild;
        }

        // Look for next sibling
        let nextSibling = currentNode.nextElementSibling;
        while (nextSibling && !nextSibling.classList.contains('tree-node')) {
            nextSibling = nextSibling.nextElementSibling;
        }
        if (nextSibling) return nextSibling;

        // Look up the tree for parent's next sibling
        let parent = currentNode.closest('.tree-node-children')?.previousElementSibling;
        while (parent) {
            let parentNext = parent.nextElementSibling;
            while (parentNext && !parentNext.classList.contains('tree-node')) {
                parentNext = parentNext.nextElementSibling;
            }
            if (parentNext) return parentNext;

            parent = parent.closest('.tree-node-children')?.previousElementSibling;
        }

        return null;
    }

    function getPreviousVisibleNode(currentNode) {
        // Look for previous sibling
        let prevSibling = currentNode.previousElementSibling;
        while (prevSibling && !prevSibling.classList.contains('tree-node')) {
            prevSibling = prevSibling.previousElementSibling;
        }

        if (prevSibling) {
            // If previous sibling has expanded children, go to last visible child
            return getLastVisibleDescendant(prevSibling) || prevSibling;
        }

        // Go to parent
        const parent = currentNode.closest('.tree-node-children')?.previousElementSibling;
        return parent && parent.classList.contains('tree-node') ? parent : null;
    }

    function getLastVisibleDescendant(node) {
        const childrenContainer = node.nextElementSibling;
        if (!childrenContainer || !childrenContainer.classList.contains('tree-node-children')) {
            return null;
        }

        const children = childrenContainer.querySelectorAll(':scope > .tree-node');
        if (children.length === 0) return null;

        const lastChild = children[children.length - 1];
        return getLastVisibleDescendant(lastChild) || lastChild;
    }

    function updateSelectionSummary() {
        const count = selectedPaths.size;
        if (count === 0) {
            selectionSummary.textContent = 'No files selected';
            selectionSummary.style.display = 'none';
        } else {
            selectionSummary.textContent = `${count} file${count === 1 ? '' : 's'} selected`;
            selectionSummary.style.display = 'block';
        }
    }

    function updateExportButton() {
        exportButton.disabled = selectedPaths.size === 0 || isExporting;
    }

    function handleConfigurationUpdate(payload) {
        const { configuration, presets, summary } = payload;

        currentConfiguration = configuration;
        configurationPresets = presets;

        // Update preset dropdown
        const presetSelect = document.getElementById('preset-select');
        presetSelect.innerHTML = '<option value="">Custom Configuration</option>';

        Object.keys(presets).forEach(presetName => {
            const option = document.createElement('option');
            option.value = presetName;
            option.textContent = presetName.charAt(0).toUpperCase() + presetName.slice(1).replace('-', ' ');
            presetSelect.appendChild(option);
        });

        // Check if current configuration matches a preset
        const matchingPreset = findMatchingPreset(configuration, presets);
        if (matchingPreset) {
            presetSelect.value = matchingPreset;
        }

        // Update configuration UI
        updateConfigurationUI(configuration);

        // Update summary
        const summaryElement = document.getElementById('config-summary');
        if (summary) {
            summaryElement.textContent = summary;
            summaryElement.style.display = 'block';
        }
    }

    function findMatchingPreset(configuration, presets) {
        for (const [presetName, presetConfig] of Object.entries(presets)) {
            if (JSON.stringify(configuration) === JSON.stringify(presetConfig)) {
                return presetName;
            }
        }
        return null;
    }

    function handlePresetChange(event) {
        const presetName = event.target.value;

        if (presetName && configurationPresets[presetName]) {
            vscode.postMessage({
                type: 'loadPreset',
                payload: { presetName }
            });
        }
    }

    function handleConfigurationChange() {
        const configuration = getCurrentConfiguration();

        // Send configuration update to extension
        vscode.postMessage({
            type: 'updateConfiguration',
            payload: configuration
        });

        // Reset preset selection to "Custom"
        document.getElementById('preset-select').value = '';
        
        // Update export button text based on output method
        updateExportButtonText();
    }

    function handleOutputMethodChange() {
        handleConfigurationChange();
    }

    function updateExportButtonText() {
        const outputMethod = document.querySelector('input[name="output-method"]:checked').value;
        const exportButton = document.getElementById('export-button');
        
        if (outputMethod === 'clipboard') {
            exportButton.textContent = 'Copy to Clipboard';
        } else {
            exportButton.textContent = 'Generate Export';
        }
    }

    function getCurrentConfiguration() {
        const excludePatternsText = document.getElementById('exclude-patterns').value.trim();
        const includePatternsText = document.getElementById('include-patterns').value.trim();
        const outputMethod = document.querySelector('input[name="output-method"]:checked').value;

        return {
            format: document.getElementById('format-select').value,
            outputMethod: outputMethod,
            includeDirectoryStructure: document.getElementById('include-structure').checked,
            maxFileSize: parseInt(document.getElementById('max-file-size').value) * 1024, // Convert KB to bytes
            excludePatterns: excludePatternsText ? excludePatternsText.split('\n').map(p => p.trim()).filter(p => p) : [],
            includePatterns: includePatternsText ? includePatternsText.split('\n').map(p => p.trim()).filter(p => p) : [],
            truncateThreshold: 10 * 1024 * 1024 // 10MB
        };
    }

    function updateConfigurationUI(configuration) {
        document.getElementById('format-select').value = configuration.format || 'md';
        document.getElementById('include-structure').checked = configuration.includeDirectoryStructure !== false;
        document.getElementById('max-file-size').value = Math.round((configuration.maxFileSize || 1024 * 1024) / 1024);
        document.getElementById('exclude-patterns').value = (configuration.excludePatterns || []).join('\n');
        document.getElementById('include-patterns').value = (configuration.includePatterns || []).join('\n');
        
        // Update output method radio buttons
        const outputMethod = configuration.outputMethod || 'file';
        document.querySelector(`input[name="output-method"][value="${outputMethod}"]`).checked = true;
        
        // Update export button text
        updateExportButtonText();
    }

    function handleExportClick() {
        if (selectedPaths.size === 0) return;

        const configuration = getCurrentConfiguration();

        isExporting = true;
        updateExportButton();
        progressSection.style.display = 'block';

        vscode.postMessage({
            type: 'generateExport',
            payload: {
                configuration,
                selectedPaths: Array.from(selectedPaths)
            }
        });
    }

    function handleExportProgress(payload) {
        const { progress, message } = payload;

        document.getElementById('progress-fill').style.width = `${progress}%`;
        document.getElementById('progress-message').textContent = message;
    }

    function handleExportComplete(payload) {
        const { result, filePath, clipboardSuccess } = payload;

        isExporting = false;
        updateExportButton();
        progressSection.style.display = 'none';

        if (clipboardSuccess !== undefined) {
            // Clipboard export
            if (clipboardSuccess) {
                showClipboardNotification(`Successfully copied ${result.metadata.totalFiles} files to clipboard!`, 'success');
            } else {
                showClipboardNotification('Failed to copy content to clipboard', 'error');
            }
        } else {
            // File export
            showMessage(`Export completed successfully! ${result.metadata.totalFiles} files exported.`, 'success');
        }
    }

    function showClipboardNotification(message, type = 'success') {
        const notification = document.getElementById('clipboard-notification');
        const messageElement = document.getElementById('notification-message');
        
        messageElement.textContent = message;
        notification.className = `clipboard-notification ${type === 'error' ? 'error' : 'success'}`;
        notification.style.display = 'block';

        // Auto-hide after 3 seconds
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }

    function handleError(payload) {
        const { message, details } = payload;

        isExporting = false;
        updateExportButton();
        progressSection.style.display = 'none';

        showMessage(`Error: ${message}`, 'error');

        if (details) {
            console.error('Export error details:', details);
        }
    }

    function showMessage(text, type = 'info') {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.message');
        existingMessages.forEach(msg => msg.remove());

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type === 'error' ? 'error-message' : 'info-message'}`;
        messageDiv.textContent = text;

        rootElement.insertBefore(messageDiv, rootElement.firstChild);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }

    function handleSelectAll() {
        // Select all visible files
        const allNodes = getAllVisibleNodes(workspaceTree);
        allNodes.forEach(node => {
            if (node.type === 'file') {
                selectedPaths.add(node.path);
            }
        });

        // Update UI
        updateAllCheckboxes();
        updateSelectionSummary();
        updateExportButton();
    }

    function handleDeselectAll() {
        // Clear all selections
        selectedPaths.clear();

        // Update UI
        updateAllCheckboxes();
        updateSelectionSummary();
        updateExportButton();
    }

    function handleQuickExport() {
        if (selectedPaths.size > 0) {
            handleExportClick();
        } else {
            showMessage('No files selected for export', 'error');
        }
    }

    function getAllVisibleNodes(nodes) {
        let allNodes = [];

        function traverse(nodeList) {
            nodeList.forEach(node => {
                allNodes.push(node);
                if (node.children && node.expanded) {
                    traverse(node.children);
                }
            });
        }

        traverse(nodes);
        return allNodes;
    }

    function updateAllCheckboxes() {
        const checkboxes = document.querySelectorAll('.tree-node-checkbox');
        checkboxes.forEach(checkbox => {
            const treeNode = checkbox.closest('.tree-node');
            const path = treeNode.dataset.path;
            checkbox.checked = selectedPaths.has(path);
        });
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
})();
