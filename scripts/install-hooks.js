#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const HOOKS_FILE = path.join(os.homedir(), '.cursor', 'hooks.json');
const BACKUP_FILE = HOOKS_FILE + '.backup';

const uninstall = process.argv.includes('--uninstall');
const direct = process.argv.includes('--direct');

const PORTLESS_NAME = 'cursor-monitor';
const PORTLESS_PORT = 1355;

// Read config.yaml to get the configured port
function getPort() {
  try {
    const yaml = fs.readFileSync(path.join(__dirname, '..', 'config.yaml'), 'utf8');
    const match = yaml.match(/port:\s*(\d+)/);
    return match ? match[1] : '9876';
  } catch {
    return '9876';
  }
}

function getBaseUrl() {
  if (direct) {
    const host = process.argv.find((a) => a.startsWith('--host='))?.split('=')[1] || 'localhost';
    const port = process.argv.find((a) => a.startsWith('--port='))?.split('=')[1] || getPort();
    return `http://${host}:${port}`;
  }
  return `http://${PORTLESS_NAME}.localhost:${PORTLESS_PORT}`;
}

function buildHooks(baseUrl) {
  return {
    afterFileEdit: [
      {
        command: `curl -sS -X POST ${baseUrl}/hooks/cursor/afterFileEdit -H 'Content-Type: application/json' -d @-`,
      },
    ],
    beforeShellExecution: [
      {
        command: `curl -sS -X POST ${baseUrl}/hooks/cursor/beforeShellExecution -H 'Content-Type: application/json' -d @-`,
      },
    ],
    afterAgentResponse: [
      {
        command: `curl -sS -X POST ${baseUrl}/hooks/cursor/afterAgentResponse -H 'Content-Type: application/json' -d @-`,
      },
    ],
    stop: [
      {
        command: `curl -sS -X POST ${baseUrl}/hooks/cursor/stop -H 'Content-Type: application/json' -d @-`,
      },
    ],
  };
}

if (uninstall) {
  if (fs.existsSync(BACKUP_FILE)) {
    fs.copyFileSync(BACKUP_FILE, HOOKS_FILE);
    fs.unlinkSync(BACKUP_FILE);
    console.log(`Restored backup: ${HOOKS_FILE}`);
  } else if (fs.existsSync(HOOKS_FILE)) {
    fs.unlinkSync(HOOKS_FILE);
    console.log(`Removed: ${HOOKS_FILE}`);
  } else {
    console.log('No hooks file found, nothing to uninstall.');
  }
  process.exit(0);
}

// Install — merge into existing hooks.json if present
const baseUrl = getBaseUrl();
const newHooks = buildHooks(baseUrl);

let existing = {};
if (fs.existsSync(HOOKS_FILE)) {
  fs.copyFileSync(HOOKS_FILE, BACKUP_FILE);
  console.log(`Backed up existing hooks to: ${BACKUP_FILE}`);
  try {
    existing = JSON.parse(fs.readFileSync(HOOKS_FILE, 'utf8'));
  } catch {
    existing = {};
  }
}

// Merge: add our hooks without clobbering unrelated ones
const hooks = existing.hooks || {};
for (const [event, entries] of Object.entries(newHooks)) {
  const current = hooks[event] || [];
  // Remove any existing cursor-session-monitor entries
  const filtered = current.filter(
    (h) => !h.command?.includes('/hooks/cursor/'),
  );
  hooks[event] = [...filtered, ...entries];
}

const config = { ...existing, hooks };
if (!config.version) config.version = 1;

fs.writeFileSync(HOOKS_FILE, JSON.stringify(config, null, 2) + '\n');
console.log(`Installed cursor-session-monitor hooks to: ${HOOKS_FILE}`);
console.log(`Server URL: ${baseUrl}`);
if (!direct) {
  console.log(`\nUsing portless. Start the server with: pnpm dev`);
}
console.log('\nRestart Cursor for hooks to take effect.');
