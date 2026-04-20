# Cowork Plugin Structure — Complete Reference

A Cowork plugin is a self-contained directory that extends Claude's capabilities with skills, agents, hooks, and MCP server integrations. A `.plugin` file is simply a zip of that directory's contents. This document covers the full structure, every component type, and how to package and install it.

## Directory layout

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json          # REQUIRED — the manifest
├── skills/                  # Skills (recommended component for Cowork)
│   └── skill-name/
│       ├── SKILL.md         # required inside each skill
│       ├── references/      # optional, detailed docs loaded on demand
│       ├── examples/        # optional
│       └── scripts/         # optional
├── agents/                  # optional — agent .md files (uncommon in Cowork)
│   └── agent-name.md
├── hooks/
│   └── hooks.json           # optional — rarely used in Cowork
├── .mcp.json                # optional — MCP server definitions
├── commands/                # LEGACY — prefer skills instead
├── CONNECTORS.md            # optional — only if plugin uses ~~placeholders
└── README.md                # recommended
```

**Rules**

- Use kebab-case for all directory and file names.
- `.claude-plugin/plugin.json` is always required.
- Component directories (`skills/`, `agents/`, `hooks/`) live at the plugin root, not inside `.claude-plugin/`.
- Only create directories you actually use.

## The manifest: `.claude-plugin/plugin.json`

The minimum required field is `name`. Typical manifest:

```json
{
  "name": "plugin-name",
  "version": "0.1.0",
  "description": "Brief explanation of plugin purpose",
  "author": { "name": "Your Name" }
}
```

**Rules**

- `name` must be kebab-case (lowercase + hyphens, no spaces or special chars).
- `version` uses semver — start at `0.1.0`.
- Optional fields: `homepage`, `repository`, `license`, `keywords`.

You can also specify custom component paths (these supplement, not replace, auto-discovery):

```json
{
  "commands": "./custom-commands",
  "agents": ["./agents", "./specialized-agents"],
  "hooks": "./config/hooks.json",
  "mcpServers": "./.mcp.json"
}
```

## Skills (`skills/skill-name/SKILL.md`)

Markdown + YAML frontmatter. This is the component Cowork users benefit from most.

**Frontmatter fields**

| Field                      | Required | Type            | Description                                                                  |
| -------------------------- | -------- | --------------- | ---------------------------------------------------------------------------- |
| `name`                     | yes      | string          | matches the directory name, lowercase + hyphens (max 64 chars)               |
| `description`              | yes      | string          | third-person, includes specific trigger phrases in quotes                    |
| `metadata`                 | no       | map             | arbitrary, e.g. `version`, `author`                                          |
| `allowed-tools`            | no       | string or array | tools Claude can use (see note below)                                        |
| `argument-hint`            | no       | string          | documents expected arguments for autocomplete (e.g. `[file-path]`)           |
| `when_to_use`              | no       | string          | additional trigger context, appended to description (combined 1,536 char cap)|
| `model`                    | no       | string          | model override: `sonnet`, `opus`, `haiku`                                    |
| `effort`                   | no       | string          | effort level: `low`, `medium`, `high`, `xhigh`, `max`                        |
| `disable-model-invocation` | no       | bool            | `true` prevents Claude from auto-invoking; user must type `/name` explicitly |
| `user-invocable`           | no       | bool            | `false` hides from user menu (Claude-only invocation). Default: `true`       |
| `context`                  | no       | string          | `fork` to run in an isolated subagent context                                |
| `agent`                    | no       | string          | which subagent type to use with `context: fork`                              |
| `hooks`                    | no       | map             | lifecycle hooks scoped to this skill                                         |
| `paths`                    | no       | array           | glob patterns limiting when skill auto-activates                             |
| `shell`                    | no       | string          | shell for command injection: `bash` or `powershell`                          |

**`allowed-tools` in skills**

Skills support the same `allowed-tools` field as legacy commands. This lets you constrain which tools Claude can use when the skill is active. However, as of April 2026, enforcement is not yet implemented — Claude may use tools outside the allowed list. See [claude-code#18837](https://github.com/anthropics/claude-code/issues/18837). Include the field anyway for forward compatibility and as documentation of intent.

```yaml
# MCP tools (use mcp__server-name__tool-name format)
allowed-tools: [Read, Write, Bash, mcp__my-server__my_tool]
```

**Argument substitution in skills**

Skills support the same substitution variables as legacy commands:

- `$ARGUMENTS` — all arguments as a single string
- `$1`, `$2`, `$3` — positional arguments
- `@path` — include file contents in context
- `` !`command` `` — execute bash inline for dynamic context

This means legacy commands can be migrated to skills with minimal changes (see migration guide below).

**Example frontmatter**

```yaml
---
name: api-design
description: >
  This skill should be used when the user asks to "design an API",
  "create API endpoints", or "review API structure".
argument-hint: [endpoint-spec]
allowed-tools: [Read, Write, Edit, Bash]
metadata:
  version: "0.1.0"
---
```

**Body rules**

- Imperative voice ("Parse the config", not "You should parse the config").
- Keep under ~3,000 words in `SKILL.md`; push detail into `references/`.
- The body is instructions for Claude, not a user-facing README.

**Skill directory structure**

```
skill-name/
├── SKILL.md              # Core knowledge (required)
├── references/           # Detailed docs loaded on demand
│   ├── patterns.md
│   └── advanced.md
├── examples/             # Working code examples
│   └── sample-config.json
└── scripts/              # Utility scripts
    └── validate.sh
```

**Progressive disclosure levels**

1. Metadata (always in context): name + description (~100 words).
2. SKILL.md body (when skill triggers): core knowledge (<5k words).
3. Bundled resources (as needed): references, examples, scripts (unlimited).

## Agents (`agents/agent-name.md`)

Markdown + YAML frontmatter. Rarely needed in Cowork.

| Field         | Required | Type   | Description                                          |
| ------------- | -------- | ------ | ---------------------------------------------------- |
| `name`        | yes      | string | 3-50 chars, lowercase + hyphens                      |
| `description` | yes      | string | include `<example>` blocks showing triggers          |
| `model`       | yes      | string | `inherit`, `sonnet`, `opus`, or `haiku`              |
| `color`       | yes      | string | `blue`, `cyan`, `green`, `yellow`, `magenta`, `red`  |
| `tools`       | no       | array  | restrict to specific tools                           |

The body of the file is the agent's system prompt.

**Example**

```markdown
---
name: code-reviewer
description: Use this agent when the user asks for a thorough code review or wants detailed analysis of code quality, security, and best practices.

<example>
Context: User has just written a new module
user: "Can you do a deep review of this code?"
assistant: "I'll use the code-reviewer agent to provide a thorough analysis."
<commentary>
User explicitly requested a detailed review, which matches this agent's specialty.
</commentary>
</example>

model: inherit
color: blue
tools: ["Read", "Grep", "Glob"]
---

You are a code review specialist focused on identifying issues across security, performance, maintainability, and correctness.
```

**Naming rules**

- 3-50 characters.
- Lowercase letters, numbers, hyphens only.
- Must start and end with alphanumeric.
- No underscores, spaces, or special characters.

**Color guidelines**

- Blue/Cyan: analysis, review
- Green: success-oriented tasks
- Yellow: caution, validation
- Red: critical, security
- Magenta: creative, generation

## Hooks (`hooks/hooks.json`)

JSON config.

**Supported events**

| Event              | When it fires                   |
| ------------------ | ------------------------------- |
| `PreToolUse`       | Before a tool call executes     |
| `PostToolUse`      | After a tool call completes     |
| `Stop`             | When Claude finishes a response |
| `SubagentStop`     | When a subagent finishes        |
| `SessionStart`     | When a session begins           |
| `SessionEnd`       | When a session ends             |
| `UserPromptSubmit` | When the user sends a message   |
| `PreCompact`       | Before context compaction       |
| `Notification`     | When a notification fires       |

**Prompt-based hook** (LLM-driven; supported on Stop, SubagentStop, UserPromptSubmit, PreToolUse):

```json
{ "type": "prompt", "prompt": "Evaluate ...: $TOOL_INPUT", "timeout": 30 }
```

**Command-based hook** (deterministic script):

```json
{ "type": "command", "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/validate.sh", "timeout": 60 }
```

**Example `hooks.json`**

```json
{
  "PreToolUse": [
    {
      "matcher": "Write|Edit",
      "hooks": [
        {
          "type": "prompt",
          "prompt": "Check that this file write follows project coding standards. If it violates standards, explain why and block.",
          "timeout": 30
        }
      ]
    }
  ],
  "SessionStart": [
    {
      "matcher": "",
      "hooks": [
        {
          "type": "command",
          "command": "cat ${CLAUDE_PLUGIN_ROOT}/context/project-context.md",
          "timeout": 10
        }
      ]
    }
  ]
}
```

**Command hook output format**

Command hooks return JSON to stdout:

```json
{ "decision": "block", "reason": "File write violates naming convention" }
```

Decisions: `approve`, `block`, `ask_user`.

## MCP servers (`.mcp.json` at plugin root)

Three transport types.

**stdio** (local process):

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/servers/server.js"],
      "env": { "API_KEY": "${API_KEY}" }
    }
  }
}
```

**SSE** (remote, server-sent events):

```json
{
  "mcpServers": {
    "asana": { "type": "sse", "url": "https://mcp.asana.com/sse" }
  }
}
```

**HTTP** (remote, streamable HTTP):

```json
{
  "mcpServers": {
    "api-service": {
      "type": "http",
      "url": "https://api.example.com/mcp",
      "headers": { "Authorization": "Bearer ${API_TOKEN}" }
    }
  }
}
```

**Environment variable expansion**

All MCP configs support `${VAR_NAME}` substitution:

- `${CLAUDE_PLUGIN_ROOT}` — the plugin directory (always use for portability)
- `${ANY_ENV_VAR}` — user environment variables

Document required env vars in the README.

**Directory servers without a URL**

Some MCP directory entries have no `url` because the endpoint is dynamic. Plugins can reference these servers by name — if the server name in the plugin's MCP config matches the directory entry name, it is treated the same as a URL match.

## Legacy commands (`commands/command-name.md`)

Still works, but prefer skills for new plugins. Useful if you need the single-file format with `$ARGUMENTS`/`$1` substitution and inline bash execution.

**Frontmatter fields**

| Field           | Required | Type            | Description                                          |
| --------------- | -------- | --------------- | ---------------------------------------------------- |
| `description`   | no       | string          | Brief description shown in `/help` (under 60 chars)  |
| `allowed-tools` | no       | string or array | Tools the command can use                            |
| `model`         | no       | string          | Model override: `sonnet`, `opus`, `haiku`            |
| `argument-hint` | no       | string          | Documents expected arguments for autocomplete        |

**Example**

```markdown
---
description: Review code for security issues
allowed-tools: Read, Grep, Bash(git:*)
argument-hint: [file-path]
---

Review @$1 for security vulnerabilities including:

- SQL injection
- XSS attacks
- Authentication bypass
- Insecure data handling

Provide specific line numbers, severity ratings, and remediation suggestions.
```

**Key rules**

- Commands are instructions for Claude, not messages for the user.
- `$ARGUMENTS` captures all arguments as a single string; `$1`, `$2`, `$3` capture positional arguments.
- `@path` syntax includes file contents in the command context.
- `` !`command` `` executes bash inline for dynamic context.
- Use `${CLAUDE_PLUGIN_ROOT}` to reference plugin files portably.

**`allowed-tools` patterns**

```yaml
# Specific tools
allowed-tools: Read, Write, Edit, Bash(git:*)

# Bash with specific commands only
allowed-tools: Bash(npm:*), Read

# MCP tools (specific)
allowed-tools: ["mcp__plugin_name_server__tool_name"]
```

## Migrating commands to skills

When installing a plugin with a `commands/` directory, Cowork shows: _"Plugin installed. Note: it uses the legacy commands/ format."_ Both formats work, but skills are the recommended path forward.

**Migration steps**

1. Create a skill directory for each command: `skills/command-name/SKILL.md`
2. Move frontmatter fields — `description`, `allowed-tools`, `argument-hint`, `model` all work identically in skills
3. Add `name` field to frontmatter (must match directory name, kebab-case)
4. Keep the body as-is — `$ARGUMENTS`, `$1`/`$2`, `@path`, and `` !`command` `` substitution all work in skills
5. Optionally rewrite the body to imperative voice (skill convention)
6. Delete the `commands/` directory

**Before (command)**

```
commands/
  analyze-data.md       # single file with frontmatter
```

**After (skill)**

```
skills/
  analyze-data/
    SKILL.md            # same content, plus name field in frontmatter
```

**What changes in frontmatter**

```yaml
# Command (commands/analyze-data.md)
---
description: Analyze dataset for anomalies
allowed-tools: [Read, Bash, mcp__server__tool]
argument-hint: [dataset-path]
---

# Skill (skills/analyze-data/SKILL.md)
---
name: analyze-data                              # NEW — must match directory name
description: >                                  # CHANGED — third-person with trigger phrases
  Analyze a dataset for anomalies. Triggers when
  the user asks to "analyze data" or "find anomalies".
allowed-tools: [Read, Bash, mcp__server__tool]  # SAME
argument-hint: [dataset-path]                   # SAME
---
```

**Key differences**

| Aspect          | Commands                     | Skills                                    |
| --------------- | ---------------------------- | ----------------------------------------- |
| File location   | `commands/name.md`           | `skills/name/SKILL.md`                    |
| `name` field    | not required                 | required, must match directory             |
| `description`   | brief, shown in `/help`      | third-person with trigger phrases          |
| Resources       | single file only             | `references/`, `examples/`, `scripts/`    |
| Auto-invocation | no (user must type `/name`)  | yes (Claude can trigger based on description) |
| `allowed-tools` | enforced                     | supported but not yet enforced (bug #18837)|

## CONNECTORS.md (only if sharing externally)

If the plugin references external tools by category rather than specific product (e.g., `~~project tracker` instead of Jira specifically), include a `CONNECTORS.md` at the plugin root explaining placeholders. Skip this if the plugin is only for internal use.

**Format**

```markdown
# Connectors

## How tool references work

Plugin files use `~~category` as a placeholder for whatever tool the user
connects in that category. For example, `~~project tracker` might mean
Asana, Linear, Jira, or any other project tracker with an MCP server.

Plugins are tool-agnostic — they describe workflows in terms of categories
rather than specific products.

## Connectors for this plugin

| Category        | Placeholder         | Included servers | Other options            |
| --------------- | ------------------- | ---------------- | ------------------------ |
| Chat            | `~~chat`            | Slack            | Microsoft Teams, Discord |
| Project tracker | `~~project tracker` | Linear           | Asana, Jira, Monday      |
```

**Using `~~` placeholders**

In plugin files (skills, agents), reference tools generically:

```markdown
Check ~~project tracker for open tickets assigned to the user.
Post a summary to ~~chat in the team channel.
```

During customization (via the cowork-plugin-customizer skill), these get replaced with specific tool names.

## README.md

Every plugin should include a README with:

1. **Overview** — what the plugin does.
2. **Components** — list of skills, agents, hooks, MCP servers.
3. **Setup** — any required environment variables or configuration.
4. **Usage** — how to trigger each skill.
5. **Customization** — if `CONNECTORS.md` exists, mention it.

## Packaging as a `.plugin` file

A `.plugin` file is just a zip of the plugin directory's contents (not the directory itself — zip from inside the plugin directory so `.claude-plugin/plugin.json` is at the archive root).

**Validate first**

```bash
claude plugin validate /path/to/plugin-dir/.claude-plugin/plugin.json
```

**Build the archive**

The convention is to create it in `/tmp/` first and then copy to your output folder, because writing directly into some output folders fails on permissions:

```bash
cd /path/to/plugin-dir \
  && zip -r /tmp/plugin-name.plugin . -x "*.DS_Store" \
  && cp /tmp/plugin-name.plugin /path/to/outputs/plugin-name.plugin
```

Name the file after the `name` field in `plugin.json` (e.g., `code-reviewer` → `code-reviewer.plugin`). When you drop the `.plugin` file into Cowork, it appears as a rich preview where the user can browse the files and install with a button.

## Best practices

- **Start small** — one well-crafted skill beats five half-baked components.
- **Progressive disclosure** — core knowledge in `SKILL.md`, detail in `references/`, samples in `examples/`.
- **Skills are for Claude** — write skill body content as directives, not user documentation.
- **Imperative style** — verb-first instructions in skills.
- **Portability** — always use `${CLAUDE_PLUGIN_ROOT}` for intra-plugin paths, never hardcoded paths.
- **Security** — environment variables for credentials, HTTPS for remote servers, least-privilege tool access.
- **Clear triggers** — skill descriptions should include specific phrases users would say; agent descriptions should include `<example>` blocks.
