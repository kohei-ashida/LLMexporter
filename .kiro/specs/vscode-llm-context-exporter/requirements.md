# Requirements Document

## Introduction

This feature is a VSCode extension that allows users to generate attachment files containing selected source files and directory structures from their workspace. The generated files are optimized for sharing with LLMs in interactive browser-based UIs, enabling users to provide comprehensive project context without relying on API-based LLM services or agents.

## Requirements

### Requirement 1

**User Story:** As a developer, I want to select specific files and directories from my VSCode workspace, so that I can generate a consolidated attachment file for sharing with LLMs.

#### Acceptance Criteria

1. WHEN the user opens the extension THEN the system SHALL display the current workspace directory structure as the starting point
2. WHEN the user views the directory tree THEN the system SHALL show all files and folders in an expandable tree format
3. WHEN the user clicks on files or directories THEN the system SHALL allow multi-selection with checkboxes
4. WHEN the user selects a directory THEN the system SHALL provide options to include all contents or select specific items within it
5. IF no workspace is open THEN the system SHALL display an appropriate message and disable the selection functionality

### Requirement 2

**User Story:** As a developer, I want to generate a structured attachment file from my selected files, so that I can easily share project context with LLMs in browser interfaces.

#### Acceptance Criteria

1. WHEN the user clicks generate THEN the system SHALL create a single text file containing all selected content
2. WHEN generating the file THEN the system SHALL include the directory structure overview at the beginning
3. WHEN including source files THEN the system SHALL format each file with clear headers showing the file path
4. WHEN processing files THEN the system SHALL preserve original formatting and syntax
5. WHEN the file is generated THEN the system SHALL save it to a user-specified location or default location
6. WHEN the user chooses clipboard output THEN the system SHALL copy the formatted content directly to the system clipboard
7. WHEN copying to clipboard THEN the system SHALL provide visual confirmation that the content has been copied successfully

### Requirement 3

**User Story:** As a developer, I want to customize the output format and filtering options, so that I can optimize the attachment for different LLM use cases.

#### Acceptance Criteria

1. WHEN configuring output THEN the system SHALL allow users to choose between different file formats (txt, md)
2. WHEN configuring output THEN the system SHALL allow users to choose between file export and clipboard copy as output methods
3. WHEN selecting files THEN the system SHALL provide filtering options by file extension or patterns
4. WHEN generating output THEN the system SHALL allow users to exclude certain file types (e.g., binary files, logs)
5. WHEN processing large files THEN the system SHALL provide options to truncate or summarize content
6. IF the total content exceeds a threshold THEN the system SHALL warn the user and suggest optimization options

### Requirement 4

**User Story:** As a developer, I want the extension to integrate seamlessly with VSCode's interface, so that I can access the functionality efficiently within my development workflow.

#### Acceptance Criteria

1. WHEN the extension is installed THEN the system SHALL add a command to the VSCode command palette
2. WHEN accessing the feature THEN the system SHALL provide a dedicated panel or webview interface
3. WHEN the user right-clicks on files or folders in the explorer THEN the system SHALL offer context menu options to add items to selection
4. WHEN working with the extension THEN the system SHALL remember previous selections and settings within the session
5. WHEN the extension is active THEN the system SHALL provide clear visual feedback about selected items