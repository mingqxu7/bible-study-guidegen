# Claude Code Slash Commands Reference

## Overview

Claude Code provides built-in slash commands that enhance your development workflow. These commands allow you to manage conversations, configure settings, interact with tools, and more. You can also create custom slash commands to automate frequently-used prompts.

## Built-in Slash Commands

### Session Management

#### `/clear`
- **Description**: Clear conversation history and start fresh
- **Usage**: `/clear`
- **Notes**: Wipes the conversation history, giving Claude a completely fresh start

#### `/compact [instructions]`
- **Description**: Compact conversation with optional focus instructions
- **Usage**: `/compact` or `/compact focus on the API implementation`
- **Notes**: Reduces context window usage when it gets full. You can provide optional instructions to guide what Claude should focus on during compaction

#### `/resume`
- **Description**: Switch between conversations within Claude Code
- **Usage**: `/resume`
- **Notes**: Allows you to resume previous conversations or switch to a different conversation

#### `/export`
- **Description**: Export a conversation for sharing
- **Usage**: `/export`
- **Notes**: Quickly export the current conversation in a shareable format

### Configuration & Settings

#### `/config`
- **Description**: View or modify configuration settings
- **Usage**: `/config`
- **Notes**: Interactive command to toggle settings like automatic conversation compaction

#### `/model`
- **Description**: Select or change the AI model
- **Usage**: `/model`
- **Notes**: Switch between available models (opus, sonnet, haiku) during conversation

#### `/vim`
- **Description**: Enter vim mode for alternating insert and command modes
- **Usage**: `/vim`
- **Notes**: Enables Vim-style key bindings for text input

#### `/terminal-setup`
- **Description**: Install Shift+Enter key binding for newlines
- **Usage**: `/terminal-setup`
- **Notes**: Helps configure terminal for better multi-line input support

### Tool & Permission Management

#### `/permissions`
- **Description**: View or update tool permissions
- **Usage**: `/permissions`
- **Notes**: Manage which tools Claude can use (formerly `/allowed-tools`)

#### `/approved-tools`
- **Description**: Manage tool permissions (alternative command)
- **Usage**: `/approved-tools`
- **Notes**: Another way to control which tools Claude has access to

#### `/mcp`
- **Description**: Manage MCP (Model Context Protocol) server connections and OAuth authentication
- **Usage**: `/mcp`
- **Notes**: Configure and manage MCP servers, view available tools from connected servers

### Development Tools

#### `/agents`
- **Description**: Manage custom AI subagents for specialized tasks
- **Usage**: `/agents`
- **Notes**: Create and configure specialized subagents that can handle specific types of tasks

#### `/hooks`
- **Description**: Configure hooks through an interactive menu interface
- **Usage**: `/hooks`
- **Notes**: Set up automated actions that run before/after tool use (e.g., format code after edits)

#### `/review`
- **Description**: Request code review
- **Usage**: `/review`
- **Notes**: Get Claude to review your code changes

#### `/pr-comments`
- **Description**: View pull request comments
- **Usage**: `/pr-comments`
- **Notes**: Access and review comments from pull requests

#### `/install-github-app`
- **Description**: Set up automatic PR reviews by Claude
- **Usage**: `/install-github-app`
- **Notes**: Configures GitHub integration for automated pull request reviews

### Project Management

#### `/init`
- **Description**: Initialize project with CLAUDE.md guide
- **Usage**: `/init`
- **Notes**: Creates a CLAUDE.md file to provide project context to Claude

#### `/memory`
- **Description**: Edit CLAUDE.md memory files
- **Usage**: `/memory`
- **Notes**: Manage project-specific context and instructions

#### `/add-dir`
- **Description**: Add additional working directories
- **Usage**: `/add-dir /path/to/directory`
- **Notes**: Supports typeahead for directory paths and tilde (~) expansion

### Account & System

#### `/login`
- **Description**: Switch Anthropic accounts
- **Usage**: `/login`
- **Notes**: Change to a different Anthropic account

#### `/logout`
- **Description**: Sign out from your Anthropic account
- **Usage**: `/logout`
- **Notes**: Log out of the current account

#### `/status`
- **Description**: View account and system statuses
- **Usage**: `/status`
- **Notes**: Check your account status and system information

#### `/upgrade`
- **Description**: Switch to Claude Max plans
- **Usage**: `/upgrade`
- **Notes**: Upgrade your subscription plan for enhanced features

### Information & Support

#### `/help`
- **Description**: Get usage help
- **Usage**: `/help`
- **Notes**: Display help information about using Claude Code

#### `/cost`
- **Description**: Show token usage statistics
- **Usage**: `/cost`
- **Notes**: View how many tokens have been used in the current session

#### `/release-notes`
- **Description**: View release notes
- **Usage**: `/release-notes`
- **Notes**: Display the latest updates and changes to Claude Code

#### `/doctor`
- **Description**: Check the health of your Claude Code installation
- **Usage**: `/doctor`
- **Notes**: Enhanced with CLAUDE.md and MCP tool context for self-serve debugging

#### `/bug`
- **Description**: Report bugs (sends conversation to Anthropic)
- **Usage**: `/bug`
- **Notes**: Submit bug reports directly to the Anthropic team

## Custom Slash Commands

### Creating Custom Commands

Custom slash commands are Markdown files stored in specific directories:
- **Project-specific**: `.claude/commands/` in your project root
- **User-specific**: `~/.claude/commands/` in your home directory

### Command Structure

#### Basic Command
```markdown
---
description: Brief description of what the command does
---

Your prompt template here
```

#### Advanced Command with Frontmatter
```markdown
---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*)
argument-hint: [message]
description: Create a git commit
model: haiku
---

Fix issue #$ARGUMENTS following our coding standards
```

### Frontmatter Options

| Option | Purpose | Default |
|--------|---------|---------|
| `allowed-tools` | List of tools the command can use | Inherits from conversation |
| `argument-hint` | Arguments expected (shown in autocomplete) | None |
| `description` | Brief description of the command | First line of prompt |
| `model` | AI model to use (opus, sonnet, haiku) | Inherits from conversation |

### Special Features

#### Dynamic Arguments
Use `$ARGUMENTS` to pass parameters:
```
/fix-issue 123
```
The `$ARGUMENTS` placeholder will be replaced with "123"

#### Execute Bash Commands
Prefix with `!` to run commands before the slash command:
```markdown
!git status
Review the current git status above and suggest improvements
```

#### Include File Contents
Use `@` prefix to reference files:
```markdown
Review the implementation in @src/utils/helpers.js
Compare @src/old-version.js with @src/new-version.js
```

### Command Namespacing

Organize commands in subdirectories:
- `.claude/commands/frontend/component.md` → `/frontend:component`
- `.claude/commands/backend/api.md` → `/backend:api`

## Tips & Best Practices

1. **Tab Completion**: Use Tab to autocomplete command names and file paths
2. **Team Sharing**: Check custom commands into git for team collaboration
3. **Frequent Tasks**: Create commands for repetitive workflows
4. **Tool Restrictions**: Use `allowed-tools` to limit what commands can do
5. **Model Selection**: Use cheaper models (haiku) for simple tasks

## Community Resources

- [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code): Curated list of commands and workflows
- [Claude Command Suite](https://github.com/qdhenry/Claude-Command-Suite): 119+ professional slash commands
- MCP servers can expose additional commands dynamically

## Version History

This documentation reflects Claude Code as of January 2025. Commands may be added or modified in future releases. Use `/release-notes` to check for updates.