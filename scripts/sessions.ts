#!/usr/bin/env tsx
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const dbPath = process.env.DB_PATH ?? path.resolve(process.cwd(), 'data/sessions.db');

if (!fs.existsSync(dbPath)) {
  console.error(`Database not found: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

const sessions = db.prepare(`
  SELECT s.session_id, s.status, s.agent_type, s.working_directory,
         s.started_at, s.completed_at, s.last_activity,
         s.needs_attention, s.attention_reason, s.last_response_text,
         (SELECT COUNT(*) FROM session_files sf WHERE sf.session_id = s.session_id) AS files,
         (SELECT COUNT(*) FROM session_commands sc WHERE sc.session_id = s.session_id) AS commands
  FROM sessions s
  ORDER BY s.last_activity DESC
  LIMIT 20
`).all() as any[];

if (sessions.length === 0) {
  console.log('No sessions found.');
  process.exit(0);
}

for (const s of sessions) {
  const dir = s.working_directory ? path.basename(s.working_directory) : '?';
  const status = s.status === 'active' ? '🟢' : s.status === 'completed' ? '✅' : '⏸️';
  const attention = s.needs_attention ? ' ⚠️' : '';
  const age = timeSince(s.last_activity || s.started_at);

  console.log(`${status} ${s.session_id.slice(0, 8)} | ${dir} | ${s.status}${attention} | files:${s.files} cmds:${s.commands} | ${age} ago`);

  if (s.last_response_text) {
    const preview = s.last_response_text.slice(0, 120).replace(/\n/g, ' ');
    console.log(`   💬 ${preview}${s.last_response_text.length > 120 ? '…' : ''}`);
  }
  if (s.attention_reason) {
    console.log(`   ⚠️  ${s.attention_reason}`);
  }
}

// Check telegram message mappings
const mappings = db.prepare(`
  SELECT tm.telegram_message_id, tm.session_id, tm.created_at
  FROM telegram_messages tm
  ORDER BY tm.created_at DESC
  LIMIT 10
`).all() as any[];

if (mappings.length > 0) {
  console.log(`\n📨 Telegram message mappings (${mappings.length}):`);
  for (const m of mappings) {
    console.log(`   msg:${m.telegram_message_id} → ${m.session_id.slice(0, 8)} (${timeSince(m.created_at)} ago)`);
  }
}

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
