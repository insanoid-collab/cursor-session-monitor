import Database from 'better-sqlite3';
import { NormalizedEvent } from '../types/domain';

interface SessionManagerOptions {
  dangerousCommandPatterns?: string[];
  sessionTimeoutMinutes?: number;
}

export class SessionManager {
  private readonly dangerousPatterns: RegExp[];
  private readonly sessionTimeoutMinutes: number;

  constructor(private readonly db: Database.Database, options: SessionManagerOptions = {}) {
    this.dangerousPatterns = (options.dangerousCommandPatterns ?? ['rm -rf', 'sudo', 'curl .*\\|\\s*sh']).map(
      (pattern) => new RegExp(pattern, 'i'),
    );
    this.sessionTimeoutMinutes = options.sessionTimeoutMinutes ?? 120;
  }

  ingest(event: NormalizedEvent): { flagged?: boolean; sessionStarted?: boolean } {
    let sessionStarted = false;
    const session = this.db
      .prepare('SELECT session_id FROM sessions WHERE session_id = ?')
      .get(event.sessionId) as { session_id: string } | undefined;

    if (!session) {
      this.db
        .prepare(
          `INSERT INTO sessions (
            session_id, agent_type, status, started_at, last_activity, working_directory, metadata
          ) VALUES (?, ?, 'active', ?, ?, ?, ?)`
        )
        .run(
          event.sessionId,
          event.agentType,
          event.timestamp,
          event.timestamp,
          (event.metadata.cwd as string | null) ?? null,
          JSON.stringify({ source: 'cursor-hooks' }),
        );

      this.insertEvent({ ...event, eventId: `${event.eventId}-start`, eventType: 'session_start' });
      sessionStarted = true;
    }

    this.insertEvent(event);

    if (event.eventType === 'file_edit') {
      const filePath = String(event.metadata.filePath ?? '');
      this.db
        .prepare(
          `INSERT INTO session_files (session_id, file_path, first_edit, last_edit)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(session_id, file_path)
           DO UPDATE SET edit_count = edit_count + 1, last_edit = excluded.last_edit`
        )
        .run(event.sessionId, filePath, event.timestamp, event.timestamp);

      this.touchSession(event.sessionId, event.timestamp, (event.metadata.cwd as string | null) ?? null);
      return { sessionStarted };
    }

    if (event.eventType === 'shell_exec') {
      const command = String(event.metadata.command ?? '');
      const flagged = this.dangerousPatterns.some((pattern) => pattern.test(command));
      this.db
        .prepare(
          `INSERT INTO session_commands (session_id, command, executed_at, cwd, flagged)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(
          event.sessionId,
          command,
          event.timestamp,
          (event.metadata.cwd as string | null) ?? null,
          flagged ? 1 : 0,
        );

      this.touchSession(event.sessionId, event.timestamp, (event.metadata.cwd as string | null) ?? null);

      if (flagged) {
        this.db
          .prepare(
            `UPDATE sessions SET needs_attention = 1, attention_reason = ?, last_activity = ? WHERE session_id = ?`
          )
          .run(`Dangerous command detected: ${command}`, event.timestamp, event.sessionId);
      }

      return { flagged, sessionStarted };
    }

    if (event.eventType === 'session_end') {
      this.db
        .prepare(
          `UPDATE sessions
           SET status = 'completed', completed_at = ?, last_activity = ?
           WHERE session_id = ?`
        )
        .run(event.timestamp, event.timestamp, event.sessionId);
    }

    return { sessionStarted };
  }

  markTimedOutSessions(now = new Date()): number {
    const threshold = new Date(now.getTime() - this.sessionTimeoutMinutes * 60 * 1000).toISOString();
    const result = this.db
      .prepare(
        `UPDATE sessions
         SET status = 'idle'
         WHERE status = 'active' AND last_activity IS NOT NULL AND last_activity < ?`,
      )
      .run(threshold);
    return result.changes;
  }

  private insertEvent(event: NormalizedEvent): void {
    this.db
      .prepare(
        `INSERT INTO events (event_id, session_id, event_type, timestamp, payload, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        event.eventId,
        event.sessionId,
        event.eventType,
        event.timestamp,
        JSON.stringify(event.payload),
        JSON.stringify(event.metadata),
      );
  }

  private touchSession(sessionId: string, ts: string, cwd: string | null): void {
    this.db
      .prepare(
        `UPDATE sessions
         SET last_activity = ?, working_directory = COALESCE(?, working_directory)
         WHERE session_id = ?`
      )
      .run(ts, cwd, sessionId);
  }

  listSessions(status?: string, limit = 50) {
    const where = status ? 'WHERE s.status = ?' : '';
    const stmt = this.db.prepare(
      `SELECT s.*,
              (SELECT COUNT(*) FROM session_files sf WHERE sf.session_id = s.session_id) AS files_modified,
              (SELECT COUNT(*) FROM session_commands sc WHERE sc.session_id = s.session_id) AS commands_executed
       FROM sessions s ${where}
       ORDER BY s.started_at DESC
       LIMIT ?`,
    );
    return status ? stmt.all(status, limit) : stmt.all(limit);
  }

  getSession(sessionId: string) {
    const session = this.db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(sessionId);
    if (!session) return null;

    const files = this.db
      .prepare(
        'SELECT file_path AS path, edit_count AS editCount, last_edit AS lastEdit FROM session_files WHERE session_id = ? ORDER BY last_edit DESC',
      )
      .all(sessionId);

    const commands = this.db
      .prepare(
        'SELECT command, executed_at AS executedAt, flagged FROM session_commands WHERE session_id = ? ORDER BY executed_at DESC',
      )
      .all(sessionId);

    const events = this.db
      .prepare(
        'SELECT event_type AS type, timestamp, metadata FROM events WHERE session_id = ? ORDER BY timestamp DESC LIMIT 100',
      )
      .all(sessionId);

    return { ...session, files, commands, events };
  }

  getActiveSessions() {
    return this.db
      .prepare(
        `SELECT s.session_id, s.agent_type, s.working_directory, s.last_activity,
                (SELECT COUNT(*) FROM session_files sf WHERE sf.session_id = s.session_id) AS files_modified
         FROM sessions s
         WHERE s.status = 'active'
         ORDER BY s.last_activity DESC`,
      )
      .all();
  }

  getSummary(sessionId: string) {
    const files = this.db
      .prepare('SELECT COUNT(*) AS count FROM session_files WHERE session_id = ?')
      .get(sessionId) as { count: number };
    const commands = this.db
      .prepare('SELECT COUNT(*) AS count FROM session_commands WHERE session_id = ?')
      .get(sessionId) as { count: number };
    const session = this.db
      .prepare('SELECT started_at, completed_at FROM sessions WHERE session_id = ?')
      .get(sessionId) as { started_at: string; completed_at: string | null } | undefined;

    if (!session) return null;

    const start = new Date(session.started_at).getTime();
    const end = new Date(session.completed_at ?? new Date().toISOString()).getTime();
    const durationMinutes = Math.max(0, Math.round((end - start) / 60000));

    return {
      filesModified: files.count,
      commandsExecuted: commands.count,
      durationMinutes,
    };
  }
}
