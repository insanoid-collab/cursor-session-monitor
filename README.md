# cursor-session-monitor

Cursor hook receiver + session tracker with Telegram notifications.

## Phase 2 highlights
- YAML config loader (`config.yaml`) with env var overrides
- Telegram notifier abstraction:
  - **OpenClaw message tool mode** (preferred)
  - **Bot API mode** fallback
- Config-driven notification rules
- Batching scheduler for file edits + shell commands
- Notification templates:
  - Session start
  - Dangerous command alert
  - Completion summary
- Integration tests for hook endpoints + notifier paths

## Run

```bash
npm install
cp config.yaml.example config.yaml
npm run dev
```

## Configuration

Default config file path: `./config.yaml`
Override with:

```bash
export CURSOR_MONITOR_CONFIG=/path/to/config.yaml
```

### Env var overrides
- `HOST`, `PORT`, `LOG_LEVEL`, `DB_PATH`
- `TELEGRAM_ENABLED`
- `TELEGRAM_MODE` (`openclaw` | `bot_api`)
- `TELEGRAM_CHANNEL`, `TELEGRAM_ACCOUNT`, `TELEGRAM_TARGET`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- `CURSOR_SESSION_TIMEOUT_MINUTES`

## Telegram setup

### Option A: OpenClaw message tool (recommended)

`config.yaml`:

```yaml
telegram:
  enabled: true
  mode: "openclaw"
  channel: "telegram"
  account: "codex"
  target: "telegram:<chat_or_topic_id>"
```

This uses:

```bash
openclaw message send --channel telegram --target <target> --message "..."
```

### Option B: Bot API fallback

1. Create a bot with `@BotFather`
2. Get bot token + chat id
3. Configure:

```yaml
telegram:
  enabled: true
  mode: "bot_api"
  bot_token: "${TELEGRAM_BOT_TOKEN}"
  chat_id: "<chat_id>"
```

Or set env vars:

```bash
export TELEGRAM_MODE=bot_api
export TELEGRAM_BOT_TOKEN=...
export TELEGRAM_CHAT_ID=...
```

## Endpoints

### Hooks
- `POST /hooks/cursor/afterFileEdit`
- `POST /hooks/cursor/beforeShellExecution`
- `POST /hooks/cursor/stop`

### Status
- `GET /health`
- `GET /sessions?status=active&limit=50`
- `GET /sessions/active`
- `GET /sessions/:sessionId`

## Test + build

```bash
npm test
npm run build
```
