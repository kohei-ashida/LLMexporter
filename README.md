# LLM Context Exporter for VSCode

A powerful VSCode extension that allows you to export selected files and directory structures into a single, well-formatted file optimized for sharing with Large Language Models (LLMs) in browser-based interfaces.

## Features

### 🚀 Core Functionality
- **Interactive File Selection**: Browse and select files using an intuitive tree interface
- **Multiple Export Formats**: Export as Markdown (.md) or plain text (.txt)
- **Directory Structure**: Include visual directory tree in exports
- **Smart Filtering**: Exclude/include files based on patterns and extensions
- **Memory Optimized**: Handles large workspaces efficiently with lazy loading

### 🎯 Performance Optimizations
- **Lazy Loading**: Directory contents load on-demand for better performance
- **Virtual Scrolling**: Smooth navigation through large file trees
- **Memory Management**: Optimized for large file selections with chunked processing
- **Batch Processing**: Files processed in batches to prevent memory issues

### ♿ Accessibility Features
- **Keyboard Navigation**: Full keyboard support with arrow keys, space, and enter
- **Screen Reader Support**: ARIA labels and proper semantic structure
- **High Contrast Mode**: Optimized for high contrast themes
- **Focus Management**: Clear visual focus indicators

### ⌨️ Keyboard Shortcuts
- `Ctrl+Shift+E` (Mac: `Cmd+Shift+E`) - Open LLM Context Exporter
- `Ctrl+Shift+X` (Mac: `Cmd+Shift+X`) - Quick export selected files
- `Ctrl+A` (Mac: `Cmd+A`) - Select all files (when focused on exporter)
- `Ctrl+D` (Mac: `Cmd+D`) - Deselect all files (when focused on exporter)

### 🎛️ Configuration Options
- **File Size Limits**: Set maximum file size for inclusion
- **Exclude Patterns**: Define glob patterns to exclude files/folders
- **Include Patterns**: Optionally specify which files to include
- **Configuration Presets**: Save and reuse common configurations
- **Session Memory**: Remember selections between sessions

## Installation

1. Open VSCode
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "LLM Context Exporter"
4. Click Install

## Usage

### Basic Usage

1. **Open the Exporter**
   - Use Command Palette (`Ctrl+Shift+P`) → "Open LLM Context Exporter"
   - Or use keyboard shortcut `Ctrl+Shift+E` (Mac: `Cmd+Shift+E`)
   - Or right-click files/folders in Explorer → "Add to LLM Context Export"

2. **Select Files**
   - Check boxes next to files you want to include
   - Click folder icons to expand/collapse directories
   - Use keyboard navigation: Arrow keys to navigate, Space/Enter to select

3. **Configure Export**
   - Choose format (Markdown or Text)
   - Set file size limits
   - Configure include/exclude patterns
   - Select a preset or create custom configuration

4. **Generate Export**
   - Click "Generate Export" button
   - Or use quick export shortcut `Ctrl+Shift+X` (Mac: `Cmd+Shift+X`)
   - Choose save location
   - File will be created and optionally opened

### Advanced Features

#### Configuration Presets
The extension includes several built-in presets:
- **Minimal**: Basic files only, small size limits
- **Comprehensive**: All relevant files with generous limits
- **Documentation**: Focus on README, docs, and configuration files
- **Source Only**: Just source code files

#### File Filtering
Use glob patterns to control which files are included:
- `**/*.ts` - Include all TypeScript files
- `node_modules/**` - Exclude node_modules directory
- `*.log` - Exclude log files
- `src/**/*.{js,ts}` - Include JS/TS files in src directory

#### Keyboard Navigation in File Tree
- `→` (Right Arrow): Expand directory or move to first child
- `←` (Left Arrow): Collapse directory or move to parent
- `↓` (Down Arrow): Move to next visible item
- `↑` (Up Arrow): Move to previous visible item
- `Space` or `Enter`: Toggle selection
- `Ctrl+A` / `Cmd+A`: Select all visible files
- `Ctrl+D` / `Cmd+D`: Deselect all files

## Configuration

### Extension Settings

Access via File → Preferences → Settings → Extensions → LLM Context Exporter:

- **Default Format**: Choose between 'txt' and 'md' (default: 'md')
- **Max File Size**: Maximum file size in KB (default: 1024)
- **Include Directory Structure**: Include tree view in exports (default: true)
- **Exclude Patterns**: Default patterns to exclude (default: node_modules, .git, etc.)
- **Include Patterns**: Default patterns to include (default: empty = all)
- **Remember Selections**: Save selections between sessions (default: true)
- **Default Preset**: Choose a default configuration preset

### Example Settings

```json
{
  "llmContextExporter.defaultFormat": "md",
  "llmContextExporter.maxFileSize": 2048,
  "llmContextExporter.excludePatterns": [
    "node_modules/**",
    ".git/**",
    "dist/**",
    "*.log",
    "*.tmp"
  ],
  "llmContextExporter.includePatterns": [
    "src/**/*.{js,ts,jsx,tsx}",
    "*.md",
    "*.json"
  ],
  "llmContextExporter.defaultPreset": "comprehensive"
}
```

## Output Format

### Markdown Format
```markdown
# LLM Context Export

Generated on: 2024-01-15T10:30:00.000Z

---

## Directory Structure

```
├── 📁 src/
│   ├── 📁 components/
│   │   └── Button.tsx
│   └── index.ts
└── README.md
```

## File: src/components/Button.tsx

```tsx
import React from 'react';

export const Button = ({ children, onClick }) => {
  return <button onClick={onClick}>{children}</button>;
};
```

## File: README.md

```markdown
# My Project
This is a sample project.
```

---

## Export Summary

- **Total Files**: 2
- **Total Size**: 156 KB
```

### Text Format
```
LLM Context Export
Generated on: 2024-01-15T10:30:00.000Z

==================================================

Directory Structure:

├── src/
│   ├── components/
│   │   └── Button.tsx
│   └── index.ts
└── README.md

==================================================
File: src/components/Button.tsx
==================================================

import React from 'react';

export const Button = ({ children, onClick }) => {
  return <button onClick={onClick}>{children}</button>;
};

==================================================

Export Summary:
- Total Files: 2
- Total Size: 156 KB
```

## Performance Tips

### For Large Workspaces
- Use specific include patterns to limit scope
- Set reasonable file size limits
- Use exclude patterns to skip unnecessary directories
- Process files in smaller batches

### Memory Optimization
- The extension automatically chunks large exports
- Files are processed in batches of 10
- Memory is managed through streaming approach
- Garbage collection is triggered between batches

## Troubleshooting

### Common Issues

**Extension not appearing**
- Ensure you have a workspace folder open
- Check that the extension is enabled
- Try reloading the window (Ctrl+Shift+P → "Reload Window")

**Large files causing issues**
- Reduce the max file size setting
- Use exclude patterns to skip large files
- Check available system memory

**Export taking too long**
- Reduce the number of selected files
- Use more specific include patterns
- Increase exclude patterns to skip unnecessary files

**Keyboard shortcuts not working**
- Ensure the exporter view has focus
- Check for conflicting keybindings in VSCode settings
- Try using the Command Palette as alternative

### Performance Issues
- Enable lazy loading (default)
- Use virtual scrolling for large trees
- Limit file selections to necessary files only
- Close other memory-intensive extensions

## Contributing

This extension is open source. Contributions are welcome!

### Development Setup
1. Clone the repository
2. Run `npm install`
3. Open in VSCode
4. Press F5 to launch extension development host
5. Make changes and test

### Reporting Issues
Please report issues on the GitHub repository with:
- VSCode version
- Extension version
- Steps to reproduce
- Expected vs actual behavior
- Console errors (if any)

## License

MIT License - see LICENSE file for details.

## Changelog

### Version 1.0.0
- Initial release
- Interactive file tree selection
- Markdown and text export formats
- Configuration presets
- Keyboard shortcuts
- Accessibility features
- Performance optimizations
- Memory management
- Lazy loading
- Virtual scrolling

---

**Enjoy using LLM Context Exporter!** 🚀

For more information, visit the [GitHub repository](https://github.com/your-username/vscode-llm-context-exporter).