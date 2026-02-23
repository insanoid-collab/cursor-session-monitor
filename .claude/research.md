# Cursor IDE Internals Research

Everything we've learned about Cursor's internal data structures, database schema, state management, and how to interact with the IDE programmatically.

---

## Database Architecture

### Global State Database

**Path**: `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb`

SQLite database with a single key-value table:

```sql
CREATE TABLE cursorDiskKV (key TEXT PRIMARY KEY, value TEXT);
```

This is the primary data store. All conversation messages, composer metadata, and tool state live here. The `key` column is indexed as a primary key — always use range queries, never LIKE.

### Workspace Storage

**Path**: `~/Library/Application Support/Cursor/User/workspaceStorage/{hash}/`

Each workspace gets a directory named by hash. Inside:
- `workspace.json` — metadata with `folder` field (the actual filesystem path)
- `state.vscdb` — workspace-specific state database (contains `ItemTable` for cached state)

The hash is opaque — you must read `workspace.json` to find which workspace it maps to.

### Desktop Window State

**Path**: `~/Library/Application Support/Cursor/User/globalStorage/storage.json`

JSON file tracking open windows:

```json
{
  "windowsState": {
    "lastActiveWindow": { "folder": "file:///Users/you/project" },
    "openedWindows": [
      { "folder": "file:///Users/you/other-project" }
    ]
  }
}
```

Folder paths use `file://` protocol prefix — strip it for filesystem use.

---

## Key Formats

### Conversation Messages

```
bubbleId:{conversationId}:{messageId}
```

Each message in a conversation gets one row. `conversationId` is the composer's UUID, `messageId` is the bubble's UUID.

**Range query pattern** (critical for performance):
```sql
SELECT value FROM cursorDiskKV
WHERE key >= 'bubbleId:{id}:' AND key < 'bubbleId:{id}:\xff'
```

### Composer Metadata

```
composerData:{conversationId}
```

Stores AI-generated title, subtitle, and conversation metadata. This is the source of truth for conversation names.

### Composer List (Workspace-scoped)

In each workspace's `state.vscdb`, the `ItemTable` key `composer.composerData` contains:

```json
{
  "allComposers": [
    {
      "composerId": "uuid",
      "createdAt": 1708900000000,
      "unifiedMode": "agentic_edit",
      "subagentInfo": {
        "parentComposerId": "parent-uuid-or-null",
        "subagentTypeName": "researcher"
      }
    }
  ]
}
```

---

## Bubble (Message) Structure

Every message stored as JSON in `cursorDiskKV.value`:

```javascript
{
  _v: 3,                          // Schema version
  bubbleId: "uuid",               // Unique message ID
  type: 1 | 2,                    // 1=user, 2=assistant
  text: "message content",
  createdAt: "2024-02-23T...",    // ISO timestamp
  isAgentic: true | false,
  unifiedMode: 1 | 2,            // Mirrors type field
  capabilityType: 30,            // 30 = context window separator (skip these)

  // Tool execution data (present on agentic messages)
  toolFormerData: {
    name: "tool_name",           // e.g., "edit_file_v2", "ask_question"
    params: "{}",                // JSON string of tool parameters
    result: "{}",                // JSON string of result (when completed)
    status: "running",           // "running" | "completed" | "error" | "cancelled"
    userDecision: null,          // "accepted" | "rejected" | null
    additionalData: {}           // Tool-specific metadata (see below)
  },

  // Required empty arrays (always present in schema v3)
  approximateLintErrors: [],
  lints: [],
  codebaseContextChunks: [],
  commits: [],
  pullRequests: [],
  attachedCodeChunks: [],
  assistantSuggestedDiffs: [],
  gitDiffs: [],
  interpreterResults: [],
  images: [],
  suggestedCodeBlocks: [],
  toolResults: [],
  cursorRules: [],
  allThinkingBlocks: []
}
```

### Message Types
- `type: 1` — User message
- `type: 2` — Assistant message (includes tool calls, thinking steps, responses)
- `capabilityType: 30` — Context window separator (always skip)

### Thinking Steps vs Real Responses

Short assistant messages (<80 chars) are typically thinking steps / status updates like "Analyzing imports...", "Checking file...". Filter these for display, but always preserve the last assistant text message regardless of length.

---

## Tool-Specific Data Structures

### ask_question

```javascript
toolFormerData: {
  name: "ask_question",
  status: "running" | "completed",
  params: JSON.stringify({
    questions: [{
      id: "q1",
      prompt: "Which approach?",
      options: [
        { id: "opt1", label: "Option A" },
        { id: "opt2", label: "Option B" }
      ]
    }]
  }),
  result: JSON.stringify({
    answers: [{ questionId: "q1", selectedOptionIds: ["opt1"] }]
  }),
  additionalData: {
    status: "pending" | "submitted",
    currentSelections: { "q1": ["opt1"] },
    freeformTexts: { "q1": "custom text" }
  }
}
```

### create_plan

```javascript
toolFormerData: {
  name: "create_plan",
  status: "running" | "completed" | "error" | "cancelled",
  params: JSON.stringify({
    name: "Migration Plan",
    overview: "Steps to migrate...",
    plan: "## Step 1\n...",          // Full markdown
    todos: [
      { id: "t1", content: "Do X", status: "pending" | "done" }
    ]
  }),
  result: JSON.stringify(
    { accepted: {} }                  // Approved
    // OR
    { rejected: {} }                  // Rejected (but see caveats below!)
  ),
  additionalData: {
    reviewData: {
      status: "Requested" | "Approved" | "Rejected",
      selectedOption: "none" | "approve" | "reject"
    }
  }
}
```

### task_v2 (Sub-agent)

```javascript
toolFormerData: {
  name: "task_v2",
  status: "running" | "completed" | "error" | "cancelled",
  params: JSON.stringify({
    description: "Research the API docs"
  }),
  additionalData: {
    status: "loading" | "success" | "error",
    terminationReason: "completed" | null,
    subagentComposerId: "sub-agent-conversation-uuid"
  }
}
```

### File Operations

Different API versions use different parameter names:

| Tool | Newer Param | Older Param |
|------|-------------|-------------|
| `read_file_v2` / `read_file` | `targetFile` | `filePath` |
| `edit_file_v2` / `search_replace` / `write` | `targetFile` | `relativeWorkspacePath` |
| `delete_file` / `apply_patch` | `targetFile` | `relativeWorkspacePath` |
| `run_terminal_command_v2` / `run_terminal_cmd` | `command` | `command` |
| `list_dir_v2` / `list_dir` | `directory` | `path` |

Always check both parameter names: `params.targetFile || params.relativeWorkspacePath`

### Other Tools

| Name | Category | Key Param |
|------|----------|-----------|
| `ripgrep_raw_search` / `grep` | search | `pattern` / `query` |
| `codebase_search` / `semantic_search_full` / `file_search` | search | `query` |
| `glob_file_search` | search | `pattern` |
| `web_search` | web | `query` |
| `web_fetch` | web | `url` |
| `read_lints` | read | (none) |
| `todo_write` | edit | (none) |
| `mcp-*` | mcp | varies |

---

## Bugs & Gotchas

### reviewData.status is Unreliable (CRITICAL)

**Problem**: `reviewData.status` stays `"Requested"` in ~95% of resolved plans. We found 304 out of 304 resolved plans still showing `"Requested"`.

**Root cause**: Cursor doesn't reliably update `reviewData.status` after user action.

**Solution**: Derive plan status from multiple fields in priority order:

```javascript
const resultObj = JSON.parse(tfd.result);
const option = ad.reviewData?.selectedOption ?? 'none';

if (resultObj?.accepted !== undefined) {
  // Approved: either explicit or auto
  status = (option === 'approve') ? 'Approved' : 'Auto-accepted';
} else if (resultObj?.rejected !== undefined) {
  // ONLY "Rejected" if user explicitly chose reject
  status = (option === 'reject') ? 'Rejected' : 'Auto-accepted';
} else if (tfd.status === 'error') {
  status = 'Error';
} else if (tfd.status === 'cancelled') {
  status = 'Cancelled';
} else if (tfd.status === 'completed') {
  status = 'Completed';
} else {
  status = 'Requested'; // Actually pending
}
```

### result: { rejected: {} } Doesn't Mean User Rejected

**Problem**: Cursor stores `{ rejected: {} }` even for plans that auto-proceeded when `selectedOption === "none"`. This is NOT a user rejection.

**Solution**: Only treat as rejected when `selectedOption === 'reject'`. Otherwise it's `'Auto-accepted'`.

### Pending Detection Must Check Multiple Fields

A tool is resolved (no longer pending) if:
```javascript
const isResolved = !!tfd.result || ['completed', 'error', 'cancelled'].includes(tfd.status);
```

Don't rely on `reviewData.status` or `additionalData.status` alone.

### Context Window Replays Create Duplicates

When Cursor's context window fills, it replays earlier messages with **new bubble IDs**. This creates duplicates in the DB.

Detection & dedup approach:
1. Build a state map keyed on text/question prompts/plan names/subagent IDs
2. Walk messages backwards, keeping only the last occurrence of each unique message
3. Handle orphaned assistant messages that appear before their triggering user message

### edit_file_v2 Uses relativeWorkspacePath, Not targetFile

Newer edit operations may use `params.relativeWorkspacePath` instead of `params.targetFile`. Always check both:
```javascript
const file = params.targetFile || params.relativeWorkspacePath || '';
```

---

## Detecting Agent Running State

### Method 1: Our Active Process Map

When we spawn agents via `cursor agent --resume`, track them in memory:
```javascript
const activeAgents = new Map<string, AgentState>();
// AgentState: { startedAt, pid, output[], lastUpdate }
```

### Method 2: Database Bubble Status (for Cursor-native runs)

Check if any bubble has `toolFormerData.status === 'running'`:
```javascript
if (tfd && tfd.status === 'running') {
  agentBusy = true;
}
```

This works even when Cursor itself runs the agent (not via our CLI).

### Combined Detection

```javascript
const agentRunning = activeAgents.has(conversationId) || page.agentBusy;
```

### Cursor Writes Bubbles in Batches

Cursor does NOT write messages incrementally to the DB. It writes them in batches after a tool call completes. This means DB polling won't show real-time streaming — you'll see chunks appear at once.

For real-time output: use `cursor agent --resume --print` which streams stdout.

### Cursor's ItemTable is Cached in Memory

`ItemTable` (workspace state.vscdb) is cached in Cursor's process memory. Writing to the DB doesn't guarantee Cursor will see the change. The `onDidChangeItemsExternal` event returns `Event.None` — there is no external change notification.

---

## Writing to Cursor's Database

### Submitting Question Answers

Update the bubble's `toolFormerData`:
```javascript
tfd.additionalData.status = 'submitted';
tfd.additionalData.currentSelections = { [questionId]: [selectedOptionId] };
tfd.additionalData.freeformTexts = { [questionId]: freeformText };
tfd.result = JSON.stringify({ answers: [{ questionId, selectedOptionIds }] });
tfd.userDecision = 'accepted';
```

### Approving Plans

```javascript
tfd.additionalData.reviewData = { status: 'Approved', selectedOption: 'approve' };
tfd.result = JSON.stringify({});
tfd.userDecision = 'accepted';
```

### Rejecting Plans

```javascript
tfd.additionalData.reviewData = { status: 'Rejected', selectedOption: 'reject' };
tfd.result = JSON.stringify({ rejected: {} });
tfd.userDecision = 'rejected';
```

### Resetting Plans (back to pending)

```javascript
tfd.additionalData.reviewData = { status: 'Requested', selectedOption: 'none' };
tfd.result = '';
tfd.userDecision = null;
tfd.status = 'running';
```

### Injecting Messages

Create new bubble JSON with all required fields:
```javascript
{
  _v: 3,
  type: 1,  // user message
  bubbleId: randomUUID(),
  text: '[via Remote] ' + prompt,
  createdAt: new Date().toISOString(),
  isAgentic: true,
  unifiedMode: 1,
  // ... all required empty arrays
}
```

Use offset timestamps for ordering: user message at `now`, assistant placeholder at `now + 1ms`.

---

## Triggering Agent Execution

### Cursor CLI

```bash
cursor agent \
  --resume {conversationId} \
  --trust --yolo \
  --print \
  [--workspace /path/to/project] \
  "{prompt}"
```

Flags:
- `--resume` — Resume existing conversation
- `--trust` — Auto-approve tool calls
- `--yolo` — Skip confirmations
- `--print` — Stream output to stdout (essential for real-time capture)

Process spawning: `detached: true`, `child.unref()`, capture stdout line-by-line.

### Streaming Agent Output

Stdout captured into `AgentState.output: string[]` via line buffering:
```javascript
let lineBuf = '';
child.stdout.on('data', (chunk) => {
  lineBuf += chunk.toString();
  const lines = lineBuf.split('\n');
  lineBuf = lines.pop(); // Keep incomplete line
  for (const line of lines) {
    agent.output.push(line);
    agent.lastUpdate = Date.now();
  }
});
```

Client polls: `GET /api/agents/{id}/output?after={lineCount}` — returns new lines since index.

---

## Forcing Cursor UI Refresh (macOS)

Cursor has no external change notification mechanism. The only way to force it to see DB changes is to reload the window via AppleScript.

### AppleScript: Targeted Window Reload

```applescript
tell application "System Events"
  tell process "Cursor"
    -- Find window matching workspace folder name
    set targetWindow to missing value
    repeat with w in (every window)
      if name of w contains "{folderName}" then
        set targetWindow to w
        exit repeat
      end if
    end repeat

    if targetWindow is not missing value then
      perform action "AXRaise" of targetWindow
      delay 0.3
      -- Cmd+Shift+P → "Reload Window" → Enter
      keystroke "p" using {command down, shift down}
      delay 0.5
      keystroke "Reload Window"
      delay 0.3
      key code 36
    end if
  end tell
end tell
```

Falls back to frontmost window if no workspace name match found.

---

## Conversation Title Resolution

Priority order:
1. `composerData:{conversationId}` → `.name` field (AI-generated)
2. `composerData:{conversationId}` → `.subtitle` field
3. First user message (type=1) text, truncated to 80 chars
4. `"Untitled"` fallback

The composerData key is in the global `state.vscdb`, NOT the workspace DB.

---

## Performance Rules

### Range Queries, Never LIKE

```sql
-- NEVER (full table scan on 144K+ rows = 180ms/query):
SELECT * FROM cursorDiskKV WHERE key LIKE 'bubbleId:' || ? || ':%'

-- ALWAYS (primary key index = ~0ms/query):
SELECT * FROM cursorDiskKV WHERE key >= ? AND key < ?
```

This was a real bug: switching from LIKE to range queries gave a **370x speedup** (55s → 0.15s).

### General SQLite Rules

- Always use `LIMIT`
- Always use prepared statements (query plan caching)
- Open databases `{ readonly: true }` when only reading
- Close databases in `finally` blocks
- Use `EXPLAIN QUERY PLAN` to verify `SEARCH` not `SCAN`

---

## Sub-agent Hierarchy

Conversations form a tree:
- Root conversation: `parentComposerId: null`
- Sub-agent: `parentComposerId: "parent-uuid"`
- Type: `subagentTypeName: "researcher"` etc.

Built by:
1. Collecting all composer entries from workspace ItemTable
2. Creating map of `id → ConversationSummary`
3. Nesting children under parents
4. Removing children from root list
5. Sorting children by `createdAt`, roots by `lastMessageAt`
