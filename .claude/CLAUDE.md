# Cursor Session Monitor

Fastify server that monitors Cursor IDE sessions via webhook hooks, sends Telegram notifications, and provides a web UI for browsing Cursor conversations.

## Architecture

- **Runtime**: Node.js + TypeScript, Fastify HTTP server
- **Database**: SQLite via `better-sqlite3` (readonly access to Cursor's DBs + own session DB)
- **Frontend**: Inline HTML served from Fastify — zero build step, no framework, no bundler
- **Notifications**: Telegram Bot API
- **Package manager**: pnpm
- **Dev**: `tsx watch` via `portless` (assigns dynamic ports)

## Key Paths

- Cursor's global state DB: `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb`
- Cursor's workspace storage: `~/Library/Application Support/Cursor/User/workspaceStorage/{hash}/`
- Open window detection: `~/Library/Application Support/Cursor/User/globalStorage/storage.json` → `windowsState`
- Conversation data: `cursorDiskKV` table, keys = `bubbleId:{conversationId}:{messageId}`

## Performance Rules — CRITICAL

This app is accessed over the network. Every millisecond matters. Every byte matters.

### SQLite: Range Queries, Never LIKE

```sql
-- NEVER do this (full table scan on 144K+ rows = 180ms/query):
SELECT * FROM cursorDiskKV WHERE key LIKE 'bubbleId:' || ? || ':%'

-- ALWAYS do this (uses primary key index = ~0ms/query):
SELECT * FROM cursorDiskKV WHERE key >= ? AND key < ?
-- with prefix = 'bubbleId:{id}:' and prefixEnd = 'bubbleId:{id}:\xff'
```

This was a real bug: switching from LIKE to range queries gave a **370x speedup** (55s → 0.15s).

### SQLite: General Rules

- Always use `LIMIT` — never return unbounded result sets
- Always use prepared statements (query plan caching)
- Open databases `{ readonly: true }` when only reading
- Close databases in `finally` blocks
- Use `EXPLAIN QUERY PLAN` to verify `SEARCH` not `SCAN`
- For counting: `SELECT COUNT(*)` with same range pattern, not `rows.length`

### API: Pagination

- **Conversations list**: Return all (they're just metadata — IDs, titles, counts)
- **Messages**: Return only the **last N messages** (default 50) with cursor-based pagination
  - API: `GET /api/conversations/:id?limit=50&before={timestamp}`
  - Response includes `hasMore: boolean` and `oldestTimestamp` for "load more"
  - Client shows "Load earlier messages" button at top of thread
  - Never send the entire message history in one response

### API: Response Optimization

- Minimize JSON payload — only send fields the client needs
- Use short field names in high-frequency responses where it matters
- Set `Cache-Control: no-cache` + ETag for polling endpoints
- Compress responses (Fastify `@fastify/compress` with Brotli)

### Frontend: DOM Performance

- **Never** use `innerHTML` to append individual messages (triggers full reparse)
- Keep DOM node count bounded — max ~200 message elements visible
- Use `requestAnimationFrame` for batch DOM updates
- Intersection Observer for "load more" triggers (not scroll event listeners)
- Scroll to bottom only on new messages, not on "load more" (preserve scroll position)

### Frontend: Network

- Polling interval: 5s active, exponential backoff to 30s when idle
- Use `If-None-Match` / ETag for conditional polling (304 = no payload)
- Batch requests: one call for 50 messages, not 5 calls for 10
- On "load more": fetch next page, prepend to DOM, restore scroll position

### Frontend: Rendering

- Markdown rendered client-side (no external library — inline renderer)
- Code blocks extracted before HTML escaping to preserve content
- Tables, links, bold, italic, headers, lists, horizontal rules supported
- Escape HTML *after* extracting protected blocks, not before

## Conventions

- TypeScript strict mode
- Conventional commits: `feat:`, `fix:`, `refactor:`, `chore:`
- Error handling: log with `logger`, never silent catch
- File reads: `fs.existsSync` guard before `readFileSync`
- DB pattern: `openReadonly()` helper returns `null` on failure

## Testing

- `vitest` for tests
- Run: `pnpm test`
- Tests in `tests/` directory
