CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    agent_type TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    last_activity TEXT,
    completed_at TEXT,
    working_directory TEXT,
    needs_attention INTEGER DEFAULT 0,
    attention_reason TEXT,
    last_response_text TEXT,
    metadata TEXT
);

CREATE TABLE IF NOT EXISTS events (
    event_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    payload TEXT NOT NULL,
    metadata TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);

CREATE TABLE IF NOT EXISTS session_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    edit_count INTEGER DEFAULT 1,
    first_edit TEXT NOT NULL,
    last_edit TEXT NOT NULL,
    UNIQUE(session_id, file_path),
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);

CREATE TABLE IF NOT EXISTS session_commands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    command TEXT NOT NULL,
    executed_at TEXT NOT NULL,
    cwd TEXT,
    flagged INTEGER DEFAULT 0,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);

CREATE TABLE IF NOT EXISTS telegram_messages (
    telegram_message_id INTEGER PRIMARY KEY,
    session_id TEXT,
    conversation_id TEXT,
    workspace_path TEXT,
    created_at TEXT NOT NULL
);
