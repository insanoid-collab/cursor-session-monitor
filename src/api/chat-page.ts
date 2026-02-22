export function chatPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cursor Conversations</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%231a1a2e'/><path d='M8 10h12l-6 12z' fill='%236c63ff'/><circle cx='22' cy='10' r='3' fill='%2300d68f'/></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
:root, [data-theme="dark"] {
  --bg: #0d0d12; --bg-elevated: #13131a; --sidebar-bg: #111118;
  --surface: #1a1a24; --surface-hover: #22222e;
  --border: rgba(255,255,255,0.07); --border-strong: rgba(255,255,255,0.12);
  --text: #b8b8cc; --text-dim: #6b6b80; --text-bright: #e8e8f0;
  --user-bg: #2d1b69; --user-bg-hover: #3a2480;
  --assistant-bg: #16161f; --assistant-border: rgba(255,255,255,0.06);
  --accent: #6c63ff; --accent-hover: #8179ff; --accent-glow: rgba(108,99,255,0.15);
  --green: #00d68f; --green-dim: rgba(0,214,143,0.15);
  --orange: #ffb347; --orange-dim: rgba(255,179,71,0.15);
  --input-bg: #1a1a24; --input-border: rgba(255,255,255,0.1);
  --radius: 12px; --radius-sm: 8px; --radius-xs: 6px;
  --shadow: 0 2px 8px rgba(0,0,0,0.3); --shadow-lg: 0 8px 32px rgba(0,0,0,0.4);
  --transition: 0.2s ease;
  --code-bg: rgba(108,99,255,0.1); --pre-bg: rgba(0,0,0,0.4);
  --scrollbar-thumb: rgba(255,255,255,0.08); --scrollbar-hover: rgba(255,255,255,0.15);
}
[data-theme="light"] {
  --bg: #f5f5f7; --bg-elevated: #ffffff; --sidebar-bg: #fafafa;
  --surface: #eeeef0; --surface-hover: #e4e4e8;
  --border: rgba(0,0,0,0.08); --border-strong: rgba(0,0,0,0.14);
  --text: #4a4a5a; --text-dim: #8a8a9a; --text-bright: #1a1a2e;
  --user-bg: #e8e0ff; --user-bg-hover: #ddd3ff;
  --assistant-bg: #ffffff; --assistant-border: rgba(0,0,0,0.06);
  --accent: #5b52e0; --accent-hover: #4a42cc; --accent-glow: rgba(91,82,224,0.1);
  --green: #00b377; --green-dim: rgba(0,179,119,0.1);
  --orange: #e09530; --orange-dim: rgba(224,149,48,0.1);
  --input-bg: #ffffff; --input-border: rgba(0,0,0,0.12);
  --shadow: 0 1px 4px rgba(0,0,0,0.06); --shadow-lg: 0 4px 16px rgba(0,0,0,0.1);
  --code-bg: rgba(91,82,224,0.07); --pre-bg: #f0f0f4;
  --scrollbar-thumb: rgba(0,0,0,0.1); --scrollbar-hover: rgba(0,0,0,0.2);
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    --bg: #f5f5f7; --bg-elevated: #ffffff; --sidebar-bg: #fafafa;
    --surface: #eeeef0; --surface-hover: #e4e4e8;
    --border: rgba(0,0,0,0.08); --border-strong: rgba(0,0,0,0.14);
    --text: #4a4a5a; --text-dim: #8a8a9a; --text-bright: #1a1a2e;
    --user-bg: #e8e0ff; --user-bg-hover: #ddd3ff;
    --assistant-bg: #ffffff; --assistant-border: rgba(0,0,0,0.06);
    --accent: #5b52e0; --accent-hover: #4a42cc; --accent-glow: rgba(91,82,224,0.1);
    --green: #00b377; --green-dim: rgba(0,179,119,0.1);
    --orange: #e09530; --orange-dim: rgba(224,149,48,0.1);
    --input-bg: #ffffff; --input-border: rgba(0,0,0,0.12);
    --shadow: 0 1px 4px rgba(0,0,0,0.06); --shadow-lg: 0 4px 16px rgba(0,0,0,0.1);
    --code-bg: rgba(91,82,224,0.07); --pre-bg: #f0f0f4;
    --scrollbar-thumb: rgba(0,0,0,0.1); --scrollbar-hover: rgba(0,0,0,0.2);
  }
}
html, body { height: 100%; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); font-size: 13px; line-height: 1.5; -webkit-font-smoothing: antialiased; }
#app { display: flex; height: 100vh; }

/* Sidebar */
#sidebar { width: 320px; min-width: 320px; background: var(--sidebar-bg); border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; transition: transform 0.3s ease; }
#sidebar-header { padding: 16px 20px; border-bottom: 1px solid var(--border); font-size: 14px; font-weight: 600; color: var(--text-bright); display: flex; align-items: center; gap: 10px; letter-spacing: -0.01em; }
#sidebar-header .logo { width: 24px; height: 24px; border-radius: 6px; background: var(--accent); display: flex; align-items: center; justify-content: center; }
#sidebar-header .logo svg { width: 14px; height: 14px; }
#search-box { padding: 12px 16px; border-bottom: 1px solid var(--border); }
#search-box input { width: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); padding: 9px 12px; font-size: 12px; font-family: inherit; outline: none; transition: all var(--transition); }
#search-box input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
#search-box input::placeholder { color: var(--text-dim); }
#workspace-list { flex: 1; overflow-y: auto; padding: 4px 0; }
.workspace { margin: 0; }
.workspace + .workspace { border-top: 1px solid var(--border); }
.workspace-header { padding: 12px 20px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--text-dim); user-select: none; transition: all var(--transition); }
.workspace-header:hover { background: var(--surface-hover); color: var(--text); }
.workspace-header .arrow { font-size: 9px; transition: transform var(--transition); opacity: 0.5; }
.workspace-header.open .arrow { transform: rotate(90deg); opacity: 0.8; }
.workspace-header .name { flex: 1; overflow: hidden; font-weight: 500; word-break: break-word; transition: color var(--transition); }
.workspace-header .open-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); flex-shrink: 0; box-shadow: 0 0 6px rgba(0,214,143,0.4); }
.workspace-header .count { font-size: 11px; font-weight: 500; color: var(--accent); background: var(--accent-glow); padding: 2px 8px; border-radius: 10px; }
.workspace.is-open > .workspace-header .name { color: var(--text-bright); }
.conversation-list { display: none; padding-bottom: 4px; }
.workspace-header.open + .conversation-list { display: block; }
.conversation-item { padding: 10px 20px 10px 36px; cursor: pointer; font-size: 12px; border-left: 2px solid transparent; transition: all var(--transition); min-height: 44px; display: flex; flex-direction: column; justify-content: center; }
.conversation-item:hover { background: var(--surface-hover); }
.conversation-item.active { background: var(--surface); border-left-color: var(--accent); }
.conversation-item .conv-title { color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 3px; display: flex; align-items: center; gap: 8px; }
.conversation-item .conv-title > span:nth-child(2) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.conversation-item .conv-meta { color: var(--text-dim); font-size: 11px; display: flex; gap: 8px; }
.activity-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.activity-dot.running { background: var(--green); box-shadow: 0 0 6px rgba(0,214,143,0.5); animation: pulse 2s ease-in-out infinite; }
.activity-dot.recent { background: var(--green); }
.activity-dot.waiting { background: var(--orange); box-shadow: 0 0 4px rgba(255,179,71,0.3); }
.activity-dot.stale { background: var(--text-dim); opacity: 0.25; }
@keyframes pulse { 0%, 100% { opacity: 1; box-shadow: 0 0 6px rgba(0,214,143,0.5); } 50% { opacity: 0.4; box-shadow: 0 0 2px rgba(0,214,143,0.2); } }
.subagent-count { font-size: 10px; font-weight: 500; color: var(--accent); background: var(--accent-glow); padding: 1px 7px; border-radius: 10px; flex-shrink: 0; white-space: nowrap; margin-left: auto; }
.subagent-badge { font-size: 10px; color: var(--accent); background: var(--accent-glow); padding: 1px 7px; border-radius: 10px; flex-shrink: 0; white-space: nowrap; }

/* Sub-agent tabs */
#agent-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border); padding: 0 20px; overflow-x: auto; min-height: 0; background: var(--bg-elevated); }
#agent-tabs:empty { display: none; }
.agent-tab { padding: 10px 16px; font-size: 12px; color: var(--text-dim); cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap; display: flex; align-items: center; gap: 8px; transition: all var(--transition); flex-shrink: 0; }
.agent-tab:hover { color: var(--text); background: var(--surface-hover); }
.agent-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
.agent-tab .tab-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.agent-tab .tab-badge { font-size: 10px; color: var(--accent); opacity: 0.6; }
.agent-tab.more-tab { color: var(--text-dim); font-size: 11px; padding: 10px 14px; margin-left: auto; letter-spacing: 0; }
.agent-tab.more-tab.expanded { color: var(--accent); }
.older-agents { display: none; }
.older-agents.show { display: contents; }

/* Main area */
#main { flex: 1; display: flex; flex-direction: column; min-width: 0; background: var(--bg); }
#main-header { padding: 14px 24px; border-bottom: 1px solid var(--border); font-size: 13px; font-weight: 500; color: var(--text-dim); display: flex; align-items: center; gap: 10px; min-height: 52px; background: var(--bg-elevated); }
#main-header .conv-mode { font-size: 11px; background: var(--accent-glow); padding: 3px 10px; border-radius: 10px; color: var(--accent); font-weight: 500; }
#mobile-back-btn { display: none; cursor: pointer; padding: 4px 8px 4px 0; color: var(--text-dim); font-size: 18px; }
#messages { flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 16px; }
#empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-dim); font-size: 14px; gap: 12px; }
#empty-state svg { opacity: 0.15; }

.message { max-width: 75%; padding: 12px 16px; border-radius: var(--radius); font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-wrap: break-word; transition: transform 0.1s ease; }
.message.user { align-self: flex-end; background: var(--user-bg); color: var(--text-bright); border-bottom-right-radius: 4px; box-shadow: var(--shadow); }
.message.assistant { align-self: flex-start; background: var(--assistant-bg); border: 1px solid var(--assistant-border); border-bottom-left-radius: 4px; box-shadow: var(--shadow); }
.message .msg-time { font-size: 10px; color: var(--text-dim); margin-top: 6px; text-align: right; opacity: 0.7; }
.message.assistant .msg-time { text-align: left; }

/* Thinking steps */
.thinking-group { align-self: flex-start; max-width: 75%; margin: 4px 0; }
.thinking-group summary { list-style: none; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px 16px; color: var(--text-dim); font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all var(--transition); }
.thinking-group summary:hover { border-color: var(--accent); color: var(--text); background: var(--surface-hover); }
.thinking-group summary::-webkit-details-marker { display: none; }
.thinking-group summary .arrow { font-size: 9px; transition: transform var(--transition); display: inline-block; }
.thinking-group[open] summary .arrow { transform: rotate(90deg); }
.thinking-group[open] summary { border-color: rgba(108,99,255,0.3); background: var(--surface-hover); border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
.thinking-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); opacity: 0.6; flex-shrink: 0; }
.thinking-steps { padding: 0; margin: 0; background: var(--surface); border: 1px solid var(--border); border-top: none; border-radius: 0 0 var(--radius-sm) var(--radius-sm); overflow: hidden; }
.thinking-step { padding: 8px 16px 8px 34px; font-size: 12px; color: var(--text-dim); white-space: pre-wrap; word-wrap: break-word; position: relative; border-top: 1px solid var(--border); line-height: 1.5; }
.thinking-step::before { content: ''; position: absolute; left: 16px; top: 14px; width: 5px; height: 5px; border-radius: 50%; background: var(--text-dim); opacity: 0.3; }
.question-card { align-self: flex-start; max-width: 75%; margin: 6px 0; background: var(--surface); border: 1px solid var(--orange); border-left: 3px solid var(--orange); border-radius: var(--radius-sm); padding: 12px 16px; }
.question-card.answered { border-color: var(--green); border-left-color: var(--green); opacity: 0.7; }
.question-card-header { font-size: 11px; color: var(--orange); font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
.question-card.answered .question-card-header { color: var(--green); }
.question-item { margin-bottom: 10px; }
.question-item:last-child { margin-bottom: 0; }
.question-prompt { font-size: 13px; color: var(--text-bright); font-weight: 500; margin-bottom: 6px; }
.question-options { display: flex; flex-direction: column; gap: 4px; }
.question-option { display: flex; align-items: flex-start; gap: 8px; padding: 5px 10px; border-radius: var(--radius-xs); background: var(--bg); font-size: 12px; color: var(--text); transition: all var(--transition); border: 1px solid transparent; }
.question-card:not(.answered) .question-option { cursor: pointer; }
.question-option:hover { background: var(--surface-hover); }
.question-option.selected { background: var(--green-dim); border-color: var(--green); }
.question-option.active { background: rgba(108,99,255,0.15); border-color: var(--accent); }
.option-letter { font-weight: 600; color: var(--accent); min-width: 16px; flex-shrink: 0; }
.question-option.selected .option-letter { color: var(--green); }
.question-option.active .option-letter { color: var(--accent); }
.question-freeform { width: 100%; background: var(--input-bg); border: 1px solid var(--input-border); border-radius: var(--radius-xs); color: var(--text-bright); padding: 6px 10px; font-size: 12px; font-family: inherit; outline: none; margin-top: 4px; transition: border-color var(--transition); box-sizing: border-box; }
.question-freeform:focus { border-color: var(--accent); }
.question-freeform::placeholder { color: var(--text-dim); }
.question-submit-row { display: flex; justify-content: flex-end; align-items: center; gap: 10px; margin-top: 10px; }
.question-submit-btn { background: var(--accent); color: #fff; border: none; border-radius: var(--radius-xs); padding: 7px 20px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all var(--transition); }
.question-submit-btn:hover { filter: brightness(1.15); }
.question-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.question-error { color: var(--orange); font-size: 11px; }
.question-card .msg-time { margin-top: 8px; }

/* Code & markdown */
.message code { background: var(--code-bg); padding: 2px 6px; border-radius: 4px; font-family: 'SF Mono', 'Fira Code', Menlo, monospace; font-size: 12px; color: var(--text-bright); }
.message pre { background: var(--pre-bg); padding: 14px; border-radius: var(--radius-sm); overflow-x: auto; margin: 8px 0; border: 1px solid var(--border); }
.message pre code { background: none; padding: 0; color: var(--text); }
.message h1, .message h2, .message h3 { margin: 10px 0 4px; color: var(--text-bright); font-weight: 600; }
.message h1 { font-size: 16px; } .message h2 { font-size: 14px; } .message h3 { font-size: 13px; }
.message ul, .message ol { padding-left: 20px; margin: 4px 0; }
.message strong { color: var(--text-bright); }

/* Input */
#input-area { padding: 16px 24px; border-top: 1px solid var(--border); display: flex; gap: 10px; align-items: flex-end; background: var(--bg-elevated); }
#input-area textarea { flex: 1; background: var(--input-bg); border: 1px solid var(--input-border); border-radius: var(--radius-sm); color: var(--text-bright); padding: 11px 14px; font-size: 13px; font-family: inherit; resize: none; min-height: 44px; max-height: 160px; outline: none; transition: all var(--transition); }
#input-area textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
#input-area button { background: var(--accent); color: #fff; border: none; border-radius: var(--radius-sm); padding: 11px 20px; font-size: 13px; cursor: pointer; font-weight: 600; white-space: nowrap; transition: all var(--transition); letter-spacing: -0.01em; }
#input-area button:hover { background: var(--accent-hover); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(108,99,255,0.3); }
#input-area button:active { transform: translateY(0); }
#input-area button:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
#input-area.is-running textarea { opacity: 0.3; pointer-events: none; }
#input-area.is-running button { display: none; }
#running-indicator { display: none; align-items: center; gap: 8px; font-size: 12px; color: var(--green); padding: 8px 0; white-space: nowrap; font-weight: 500; }
#input-area.is-running #running-indicator { display: flex; }
#running-indicator .pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--green); animation: pulse 2s ease-in-out infinite; flex-shrink: 0; }

/* Scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-hover); }

/* Loading & buttons */
.loading { text-align: center; padding: 24px; color: var(--text-dim); font-size: 13px; }
#show-all-btn { display: block; width: calc(100% - 32px); margin: 8px 16px; padding: 9px; background: transparent; border: 1px dashed var(--border-strong); border-radius: var(--radius-xs); color: var(--text-dim); font-size: 12px; cursor: pointer; text-align: center; transition: all var(--transition); }
#show-all-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-glow); }
.load-more-btn { display: block; margin: 0 auto 16px; padding: 8px 20px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--radius-xs); color: var(--text-dim); font-size: 12px; cursor: pointer; transition: all var(--transition); }
.load-more-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-glow); }

/* Telegram toggle */
.toggle-row { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--text-dim); cursor: pointer; user-select: none; white-space: nowrap; }
.toggle-row:hover { color: var(--text); }
.toggle-switch { width: 32px; height: 18px; border-radius: 9px; background: var(--surface-hover); position: relative; transition: background var(--transition); flex-shrink: 0; }
.toggle-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: var(--text-dim); transition: all var(--transition); }
.toggle-row.on .toggle-switch { background: var(--green-dim); }
.toggle-row.on .toggle-switch::after { left: 16px; background: var(--green); }

/* Sidebar highlight for updated conversations */
.conversation-item.updated { border-left-color: var(--green); background: rgba(0,214,143,0.04); }
.conversation-item.updated .conv-title { color: var(--text-bright); }
.conversation-item.updated .activity-dot { background: var(--green); box-shadow: 0 0 6px rgba(0,214,143,0.4); }

/* Stale conversations (>12h) — compact single line */
.conversation-item.stale-conv { min-height: 0; padding: 6px 20px 6px 36px; }
.conversation-item.stale-conv .conv-title { font-size: 11px; color: var(--text); margin-bottom: 0; }
.conversation-item.stale-conv .conv-meta { display: none; }
.conversation-item.stale-conv .stale-time { font-size: 10px; color: var(--text-dim); opacity: 0.6; margin-left: auto; flex-shrink: 0; }
.conversation-item.stale-conv .subagent-count { display: none; }

/* Mobile */
@media (max-width: 768px) {
  #app { flex-direction: column; }
  #sidebar { width: 100%; min-width: 100%; max-height: 100vh; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 100; }
  #main { width: 100%; }
  #app.mobile-chat-open #sidebar { transform: translateX(-100%); pointer-events: none; }
  #app.mobile-chat-open #main { display: flex; }
  #app:not(.mobile-chat-open) #main { display: none; }
  #mobile-back-btn { display: block; }
  .message { max-width: 90%; }
  .thinking-group { max-width: 90%; }
  #messages { padding: 16px; gap: 12px; }
  #input-area { padding: 12px 16px; }
  .conversation-item { min-height: 48px; padding: 12px 20px 12px 36px; }
  #main-header { padding: 12px 16px; }
}
</style>
</head>
<body>
<div id="app">
  <div id="sidebar">
    <div id="sidebar-header">
      <div class="logo"><svg viewBox="0 0 14 14" fill="none"><path d="M3 4h8l-4 8z" fill="white"/></svg></div>
      Cursor Chats
      <span id="theme-toggle" onclick="toggleTheme()" title="Toggle light/dark mode" style="cursor:pointer;font-size:16px;margin-left:auto;opacity:0.6;transition:opacity 0.2s" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0.6">&#9788;</span>
      <div class="toggle-row" id="tg-toggle" onclick="toggleTelegram()">
        <span>TG</span><div class="toggle-switch"></div>
      </div>
    </div>
    <div id="search-box"><input id="search-input" type="text" placeholder="Search workspaces..." oninput="filterWorkspaces(this.value)"></div>
    <div id="workspace-list"><div class="loading">Loading workspaces...</div></div>
  </div>
  <div id="main">
    <div id="main-header"><span id="mobile-back-btn" onclick="showSidebar()">&#8592;</span> Select a conversation</div>
    <div id="agent-tabs"></div>
    <div id="empty-state">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="8" y="12" width="32" height="24" rx="4" stroke="currentColor" stroke-width="1.5"/><path d="M8 18l16 10 16-10" stroke="currentColor" stroke-width="1.5"/></svg>
      Choose a conversation from the sidebar
    </div>
    <div id="messages" style="display:none"></div>
    <div id="input-area" style="display:none">
      <textarea id="reply-input" placeholder="Type a reply..." rows="1"></textarea>
      <button id="send-btn" onclick="sendReply()">Send</button>
      <div id="running-indicator"><span class="pulse"></span>Agent is running...</div>
    </div>
  </div>
</div>
<script>
const API = '';
let activeConvId = null;
let activeWorkspaceHash = null;
let pollTimer = null;
let allWorkspaces = [];
let showingAll = false;
let oldestTimestamp = null;
let hasMoreMessages = false;
let loadingMore = false;
let lastMessageCount = 0;

function isMobile() { return window.innerWidth <= 768; }

function showSidebar() {
  document.getElementById('app').classList.remove('mobile-chat-open');
}

function showMain() {
  document.getElementById('app').classList.add('mobile-chat-open');
}

function renderWorkspaceList(workspaces) {
  const el = document.getElementById('workspace-list');
  if (!workspaces || workspaces.length === 0) {
    el.innerHTML = '<div class="loading">' + (showingAll ? 'No workspaces found' : 'No open Cursor windows') + '</div>';
    if (!showingAll) el.innerHTML += '<button id="show-all-btn" onclick="loadAllWorkspaces()">Show all workspaces</button>';
    return;
  }
  let html = workspaces.map(ws =>
    '<div class="workspace' + (ws.isOpen ? ' is-open' : '') + '" data-name="' + esc(ws.name).toLowerCase() + '" data-folder="' + esc(ws.folder).toLowerCase() + '">' +
      '<div class="workspace-header" onclick="toggleWorkspace(this, \\'' + ws.hash + '\\')">' +
        '<span class="arrow">&#9654;</span>' +
        (ws.isOpen ? '<span class="open-dot"></span>' : '') +
        '<span class="name" title="' + esc(ws.folder) + '">' + esc(ws.name) + '</span>' +
        (ws.conversationCount > 0 ? '<span class="count">' + ws.conversationCount + '</span>' : '') +
      '</div>' +
      '<div class="conversation-list" id="convs-' + ws.hash + '"><div class="loading">Loading...</div></div>' +
    '</div>'
  ).join('');
  if (showingAll) {
    html += '<button id="show-all-btn" onclick="loadWorkspaces()">Show only open workspaces</button>';
  } else {
    html += '<button id="show-all-btn" onclick="loadAllWorkspaces()">Show all workspaces</button>';
  }
  el.innerHTML = html;
}

function filterWorkspaces(query) {
  const q = query.toLowerCase().trim();
  if (!q) {
    renderWorkspaceList(allWorkspaces);
    return;
  }
  const filtered = allWorkspaces.filter(ws =>
    ws.name.toLowerCase().includes(q) || ws.folder.toLowerCase().includes(q)
  );
  renderWorkspaceList(filtered);
}

async function loadWorkspaces() {
  const el = document.getElementById('workspace-list');
  try {
    const res = await fetch(API + '/api/workspaces?onlyOpen=1');
    const data = await res.json();
    allWorkspaces = data.workspaces || [];
    showingAll = false;
    renderWorkspaceList(allWorkspaces);
    for (const ws of allWorkspaces.filter(w => w.isOpen)) {
      const header = document.querySelector('#convs-' + ws.hash)?.previousElementSibling;
      if (header) {
        header.classList.add('open');
        loadConversationsForWorkspace(ws.hash);
      }
    }
  } catch (e) {
    el.innerHTML = '<div class="loading">Failed to load workspaces</div>';
  }
}

async function loadAllWorkspaces() {
  const btn = document.getElementById('show-all-btn');
  if (btn) { btn.textContent = 'Loading...'; btn.disabled = true; }
  try {
    const res = await fetch(API + '/api/workspaces');
    const data = await res.json();
    allWorkspaces = data.workspaces || [];
    showingAll = true;
    renderWorkspaceList(allWorkspaces);
  } catch (e) {
    if (btn) btn.textContent = 'Failed, try again';
  }
}

var conversationCache = {};

function isStaleConv(c) {
  if (!c.lastMessageAt) return true;
  return (Date.now() - new Date(c.lastMessageAt).getTime()) > 5 * 60 * 60 * 1000;
}

function renderConvItem(c, hash) {
  conversationCache[c.id] = c;
  var status = activityStatus(c.lastMessageAt, c.lastMessageType, c.lastMessageLength);
  var childCount = (c.children && c.children.length) || 0;
  var stale = isStaleConv(c);
  return '<div class="conversation-item' + (stale ? ' stale-conv' : '') + '" data-id="' + c.id + '" onclick="loadConversation(\\'' + c.id + '\\', \\'' + hash + '\\', this)">' +
    '<div class="conv-title"><span class="activity-dot ' + status + '"></span>' +
    '<span>' + esc(c.title) + '</span>' +
    (stale ? '<span class="stale-time">' + timeAgo(c.lastMessageAt || c.createdAt) + '</span>' : '') +
    (childCount > 0 ? '<span class="subagent-count"><svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" style="vertical-align:-1px"><rect x="3" y="5" width="10" height="8" rx="2"/><rect x="5" y="2" width="6" height="4" rx="1"/><circle cx="6.5" cy="9" r="1" fill="var(--bg-elevated)"/><circle cx="9.5" cy="9" r="1" fill="var(--bg-elevated)"/><rect x="1" y="7" width="2" height="3" rx="1"/><rect x="13" y="7" width="2" height="3" rx="1"/></svg> ' + childCount + '</span>' : '') +
    '</div>' +
    '<div class="conv-meta"><span>' + c.messageCount + '</span><span>' + c.mode + '</span>' +
    (c.lastMessageAt ? '<span>' + timeAgo(c.lastMessageAt) + '</span>' : (c.createdAt ? '<span>' + shortDate(c.createdAt) + '</span>' : '')) +
    '</div></div>';
}

async function loadConversationsForWorkspace(hash) {
  const el = document.getElementById('convs-' + hash);
  if (!el) return;
  try {
    const res = await fetch(API + '/api/conversations?workspace=' + hash);
    const data = await res.json();
    if (!data.conversations || data.conversations.length === 0) {
      el.innerHTML = '<div class="loading" style="padding:8px 32px;font-size:11px;color:var(--text-dim)">No conversations yet</div>';
      return;
    }
    el.innerHTML = data.conversations.map(c => renderConvItem(c, hash)).join('');
  } catch (e) {
    el.innerHTML = '<div class="loading" style="padding:8px 32px;font-size:12px">Failed to load</div>';
  }
}

async function toggleWorkspace(header, hash) {
  const isOpen = header.classList.toggle('open');
  if (!isOpen) return;
  loadConversationsForWorkspace(hash);
}

var activeRootConvId = null;

var olderAgentsExpanded = false;

function agentTabHtml(c, rootId) {
  var status = activityStatus(c.lastMessageAt, c.lastMessageType, c.lastMessageLength);
  var dotClass = status === 'running' ? 'running' : (status === 'recent' ? 'recent' : (status === 'waiting' ? 'waiting' : 'stale'));
  var isActive = c.id === activeConvId;
  var label = c.id === rootId ? 'Main agent' : (c.subagentType || 'sub-agent');
  var title = c.title ? c.title.slice(0, 40) : '';
  return '<div class="agent-tab' + (isActive ? ' active' : '') + '" onclick="switchToAgent(\\'' + c.id + '\\')" title="' + esc(title) + '">' +
    '<span class="tab-dot activity-dot ' + dotClass + '"></span>' +
    '<span>' + esc(label) + '</span>' +
    (c.id !== rootId && title ? '<span class="tab-badge">' + esc(title.slice(0, 20)) + (title.length > 20 ? '...' : '') + '</span>' : '') +
  '</div>';
}

function renderAgentTabs(rootId) {
  var tabs = document.getElementById('agent-tabs');
  var root = conversationCache[rootId];
  if (!root || !root.children || root.children.length === 0) {
    tabs.innerHTML = '';
    return;
  }
  var RECENT_MINS = 5;
  var now = Date.now();
  var recent = [];
  var older = [];
  for (var i = 0; i < root.children.length; i++) {
    var child = root.children[i];
    var age = child.lastMessageAt ? (now - new Date(child.lastMessageAt).getTime()) / 60000 : 9999;
    if (age < RECENT_MINS || child.id === activeConvId) {
      recent.push(child);
    } else {
      older.push(child);
    }
  }
  var html = agentTabHtml(root, rootId);
  for (var j = 0; j < recent.length; j++) html += agentTabHtml(recent[j], rootId);
  if (older.length > 0) {
    if (olderAgentsExpanded) {
      for (var k = 0; k < older.length; k++) html += agentTabHtml(older[k], rootId);
    }
    html += '<div class="agent-tab more-tab' + (olderAgentsExpanded ? ' expanded' : '') + '" onclick="toggleOlderAgents()">' +
      (olderAgentsExpanded ? 'Less' : older.length + ' more') + '</div>';
  }
  tabs.innerHTML = html;
}

function toggleOlderAgents() {
  olderAgentsExpanded = !olderAgentsExpanded;
  renderAgentTabs(activeRootConvId);
}

async function switchToAgent(id) {
  activeConvId = id;
  oldestTimestamp = null;
  hasMoreMessages = false;
  lastMessageCount = 0;

  renderAgentTabs(activeRootConvId);

  var msgs = document.getElementById('messages');
  msgs.innerHTML = '<div class="loading">Loading messages...</div>';

  try {
    var res = await fetch(API + '/api/conversations/' + id + '?limit=50');
    var data = await res.json();
    document.getElementById('main-header').innerHTML =
      '<span id="mobile-back-btn" onclick="showSidebar()">&#8592;</span>' +
      esc(data.title || 'Conversation') +
      (data.totalCount ? ' <span class="conv-mode">' + data.totalCount + ' msgs</span>' : '');
    hasMoreMessages = data.hasMore;
    oldestTimestamp = data.oldestTimestamp;
    lastMessageCount = data.totalCount;
    renderMessages(data.messages || [], true);
  } catch (e) {
    msgs.innerHTML = '<div class="loading">Failed to load conversation</div>';
  }
}

async function loadConversation(id, wsHash, el) {
  document.querySelectorAll('.conversation-item.active').forEach(e => e.classList.remove('active'));
  if (el) el.classList.add('active');
  activeConvId = id;
  activeRootConvId = id;
  activeWorkspaceHash = wsHash;
  oldestTimestamp = null;
  hasMoreMessages = false;

  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('messages').style.display = 'flex';
  document.getElementById('input-area').style.display = 'flex';

  if (isMobile()) showMain();

  renderAgentTabs(id);

  const msgs = document.getElementById('messages');
  msgs.innerHTML = '<div class="loading">Loading messages...</div>';

  try {
    const res = await fetch(API + '/api/conversations/' + id + '?limit=50');
    const data = await res.json();
    document.getElementById('main-header').innerHTML =
      '<span id="mobile-back-btn" onclick="showSidebar()">&#8592;</span>' +
      esc(data.title || 'Conversation') +
      (data.totalCount ? ' <span class="conv-mode">' + data.totalCount + ' msgs</span>' : '');
    hasMoreMessages = data.hasMore;
    oldestTimestamp = data.oldestTimestamp;
    lastMessageCount = data.totalCount;
    renderMessages(data.messages || [], true);
  } catch (e) {
    msgs.innerHTML = '<div class="loading">Failed to load conversation</div>';
  }

  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => refreshMessages(), 5000);
}

async function loadEarlierMessages() {
  if (!activeConvId || !hasMoreMessages || loadingMore) return;
  loadingMore = true;
  const btn = document.getElementById('load-more-btn');
  if (btn) btn.textContent = 'Loading...';

  try {
    const res = await fetch(API + '/api/conversations/' + activeConvId + '?limit=50&before=' + encodeURIComponent(oldestTimestamp));
    const data = await res.json();
    hasMoreMessages = data.hasMore;
    oldestTimestamp = data.oldestTimestamp;

    const msgs = document.getElementById('messages');
    const prevHeight = msgs.scrollHeight;
    const prevTop = msgs.scrollTop;

    if (btn) btn.remove();

    let html = '';
    if (data.hasMore) {
      html += '<button id="load-more-btn" onclick="loadEarlierMessages()" class="load-more-btn">Load earlier messages</button>';
    }
    html += buildMessagesHtml(data.messages || []);

    msgs.insertAdjacentHTML('afterbegin', html);
    msgs.scrollTop = prevTop + (msgs.scrollHeight - prevHeight);
  } catch (e) {
    if (btn) btn.textContent = 'Failed — click to retry';
  }
  loadingMore = false;
}

function isThinkingStep(m) {
  if (m.askQuestion) return false;
  return m.type === 2 && m.text.length < 300 && !/^#/.test(m.text.trim());
}

var thinkingCounter = 0;

var OPTION_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function buildQuestionHtml(m) {
  var aq = m.askQuestion;
  var isAnswered = aq.status === 'submitted';
  var answerMap = {};
  if (aq.answers) {
    aq.answers.forEach(function(a) {
      (a.selectedOptionIds || []).forEach(function(oid) { answerMap[a.questionId + ':' + oid] = true; });
    });
  }

  var cls = 'question-card' + (isAnswered ? ' answered' : '');
  var html = '<div class="' + cls + '" data-bubble-id="' + esc(m.bubbleId) + '">';
  html += '<div class="question-card-header">' + (isAnswered ? '&#10003; Answered' : '&#9679; Questions') + '</div>';

  aq.questions.forEach(function(q, qi) {
    html += '<div class="question-item" data-question-id="' + esc(q.id) + '">';
    html += '<div class="question-prompt">' + (qi + 1) + '. ' + esc(q.prompt) + '</div>';
    html += '<div class="question-options">';
    q.options.forEach(function(opt, oi) {
      var letter = OPTION_LETTERS[oi] || String(oi);
      var sel = answerMap[q.id + ':' + opt.id] ? ' selected' : '';
      var clickAttr = isAnswered ? '' : ' onclick="selectOption(this)"';
      html += '<div class="question-option' + sel + '" data-option-id="' + esc(opt.id) + '" data-option-label="' + esc(opt.label) + '"' + clickAttr + '>';
      html += '<span class="option-letter">' + letter + '</span>';
      html += '<span>' + esc(opt.label) + '</span>';
      html += '</div>';
    });
    html += '</div>';
    if (!isAnswered) {
      html += '<input class="question-freeform" data-question-id="' + esc(q.id) + '" placeholder="Or type your own answer..." oninput="onFreeformInput(this)" />';
    }
    html += '</div>';
  });

  if (!isAnswered) {
    html += '<div class="question-submit-row">';
    html += '<span class="question-error"></span>';
    html += '<button class="question-submit-btn" onclick="submitQuestionAnswers(this)">Submit</button>';
    html += '</div>';
  }

  html += '<div class="msg-time">' + (m.createdAt ? shortTime(m.createdAt) : '') + '</div>';
  html += '</div>';
  return html;
}

function selectOption(el) {
  var item = el.closest('.question-item');
  var siblings = item.querySelectorAll('.question-option');
  siblings.forEach(function(s) { s.classList.remove('active'); });
  el.classList.add('active');
  var freeform = item.querySelector('.question-freeform');
  if (freeform) freeform.value = '';
  var card = el.closest('.question-card');
  var errEl = card.querySelector('.question-error');
  if (errEl) errEl.textContent = '';
}

function onFreeformInput(el) {
  var item = el.closest('.question-item');
  if (el.value.trim()) {
    item.querySelectorAll('.question-option').forEach(function(o) { o.classList.remove('active'); });
  }
  var card = el.closest('.question-card');
  var errEl = card.querySelector('.question-error');
  if (errEl) errEl.textContent = '';
}

async function submitQuestionAnswers(btn) {
  var card = btn.closest('.question-card');
  var bubbleId = card.getAttribute('data-bubble-id');
  var items = card.querySelectorAll('.question-item');
  var answers = [];
  var missing = false;

  items.forEach(function(item) {
    var qId = item.getAttribute('data-question-id');
    var active = item.querySelector('.question-option.active');
    var freeform = item.querySelector('.question-freeform');
    var freeText = freeform ? freeform.value.trim() : '';

    if (active) {
      answers.push({
        questionId: qId,
        selectedOptionId: active.getAttribute('data-option-id'),
        freeformText: null,
      });
    } else if (freeText) {
      answers.push({
        questionId: qId,
        selectedOptionId: null,
        freeformText: freeText,
      });
    } else {
      missing = true;
    }
  });

  var errEl = card.querySelector('.question-error');
  if (missing) {
    if (errEl) errEl.textContent = 'Please answer all questions';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Submitting...';
  if (errEl) errEl.textContent = '';

  try {
    var res = await fetch(API + '/api/conversations/' + activeConvId + '/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bubbleId: bubbleId, answers: answers, workspaceHash: activeWorkspaceHash }),
    });
    if (!res.ok) throw new Error('failed');
    await refreshMessages();
  } catch (e) {
    if (errEl) errEl.textContent = 'Failed to submit';
    btn.disabled = false;
    btn.textContent = 'Submit';
  }
}

function buildMessagesHtml(messages) {
  var html = '';
  var i = 0;
  while (i < messages.length) {
    var m = messages[i];
    if (m.askQuestion && m.askQuestion.questions && m.askQuestion.questions.length > 0) {
      html += buildQuestionHtml(m);
      i++;
    } else if (m.type === 1) {
      html += '<div class="message user">' +
        renderMarkdown(m.text) +
        '<div class="msg-time">' + (m.createdAt ? shortTime(m.createdAt) : '') + '</div>' +
      '</div>';
      i++;
    } else if (isThinkingStep(m)) {
      var steps = [];
      while (i < messages.length && isThinkingStep(messages[i])) {
        steps.push(messages[i]);
        i++;
      }
      thinkingCounter++;
      html += '<details class="thinking-group">' +
        '<summary>' +
          '<span class="thinking-dot"></span>' +
          '<span class="arrow">&#9654;</span> ' + steps.length + ' thinking step' + (steps.length > 1 ? 's' : '') +
        '</summary>' +
        '<div class="thinking-steps">' +
          steps.map(function(s) {
            return '<div class="thinking-step">' + esc(s.text.trim()) + '</div>';
          }).join('') +
        '</div>' +
      '</details>';
    } else {
      html += '<div class="message assistant">' +
        renderMarkdown(m.text) +
        '<div class="msg-time">' + (m.createdAt ? shortTime(m.createdAt) : '') + '</div>' +
      '</div>';
      i++;
    }
  }
  return html;
}

function updateRunningState(messages) {
  var inputArea = document.getElementById('input-area');
  if (!messages || messages.length === 0) { inputArea.classList.remove('is-running'); return; }
  var last = messages[messages.length - 1];
  var status = activityStatus(last.createdAt, last.type, (last.text || '').length);
  if (status === 'running') {
    inputArea.classList.add('is-running');
  } else {
    inputArea.classList.remove('is-running');
  }
}

function renderMessages(messages, scrollToBottom) {
  const msgs = document.getElementById('messages');
  let html = '';
  if (hasMoreMessages) {
    html += '<button id="load-more-btn" onclick="loadEarlierMessages()" class="load-more-btn">Load earlier messages</button>';
  }
  html += buildMessagesHtml(messages);
  msgs.innerHTML = html;
  if (scrollToBottom) msgs.scrollTop = msgs.scrollHeight;
  updateRunningState(messages);
}

async function refreshMessages() {
  if (!activeConvId) return;
  try {
    const res = await fetch(API + '/api/conversations/' + activeConvId + '?limit=50');
    const data = await res.json();
    updateRunningState(data.messages || []);
    if (!loadingMore && data.totalCount !== lastMessageCount) {
      lastMessageCount = data.totalCount;
      hasMoreMessages = data.hasMore;
      oldestTimestamp = data.oldestTimestamp;
      const msgs = document.getElementById('messages');
      const wasAtBottom = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 60;
      renderMessages(data.messages || [], false);
      if (wasAtBottom) msgs.scrollTop = msgs.scrollHeight;
    }
  } catch {}
}

async function sendReply() {
  const input = document.getElementById('reply-input');
  const text = input.value.trim();
  if (!text || !activeConvId) return;

  const btn = document.getElementById('send-btn');
  btn.disabled = true;
  input.value = '';
  autoResize(input);

  const msgs = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'message user';
  div.innerHTML = esc(text) + '<div class="msg-time">sending...</div>';
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;

  try {
    await fetch(API + '/api/conversations/' + activeConvId + '/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, workspaceHash: activeWorkspaceHash }),
    });
    await refreshMessages();
  } catch (e) {
    div.querySelector('.msg-time').textContent = 'failed to send';
  }
  btn.disabled = false;
}

function renderMarkdown(text) {
  if (!text) return '';
  const codeBlocks = [];
  let src = text.replace(/\\\`\\\`\\\`(\\w*)\\n([\\s\\S]*?)\\\`\\\`\\\`/g, function(_, lang, code) {
    codeBlocks.push('<pre><code>' + esc(code) + '</code></pre>');
    return '%%CB' + (codeBlocks.length - 1) + '%%';
  });
  const inlineCode = [];
  src = src.replace(/\\\`([^\\\`]+?)\\\`/g, function(_, code) {
    inlineCode.push('<code>' + esc(code) + '</code>');
    return '%%IC' + (inlineCode.length - 1) + '%%';
  });
  src = esc(src);
  src = src.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank" style="color:var(--accent)">$1</a>');
  src = src.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
  src = src.replace(/\\*(.+?)\\*/g, '<em>$1</em>');
  src = src.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  src = src.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  src = src.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  src = src.replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:8px 0">');
  src = src.replace(/(^\\|.+\\|\\n?)+/gm, function(block) {
    const rows = block.trim().split('\\n').filter(r => r.trim());
    if (rows.length < 2) return block;
    const isSep = /^[\\|\\s:\\-]+$/.test(rows[1]);
    let html = '<table style="border-collapse:collapse;margin:8px 0;font-size:12px;width:100%">';
    rows.forEach(function(row, i) {
      if (isSep && i === 1) return;
      const cells = row.split('|').filter(function(c, j, a) { return j > 0 && j < a.length - 1; });
      const tag = (isSep && i === 0) ? 'th' : 'td';
      html += '<tr>' + cells.map(function(c) {
        return '<' + tag + ' style="padding:6px 10px;border:1px solid var(--border);text-align:left">' + c.trim() + '</' + tag + '>';
      }).join('') + '</tr>';
    });
    html += '</table>';
    return html;
  });
  src = src.replace(/^(\\d+)\\. (.+)$/gm, '<li style="list-style:decimal;margin-left:20px">$2</li>');
  src = src.replace(/^[\\-\\*] (.+)$/gm, '<li style="list-style:disc;margin-left:20px">$1</li>');
  src = src.replace(/%%IC(\\d+)%%/g, function(_, i) { return inlineCode[parseInt(i)]; });
  src = src.replace(/%%CB(\\d+)%%/g, function(_, i) { return codeBlocks[parseInt(i)]; });
  return src;
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function shortDate(iso) {
  try { const d = new Date(iso); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  catch { return ''; }
}

function shortTime(iso) {
  try { const d = new Date(iso); return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  catch { return ''; }
}

function timeAgo(iso) {
  if (!iso) return '';
  try {
    var ms = Date.now() - new Date(iso).getTime();
    if (ms < 0) ms = 0;
    var s = Math.floor(ms / 1000);
    if (s < 60) return s + 's ago';
    var m = Math.floor(s / 60);
    if (m < 60) return m + 'm ago';
    var h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    var d = Math.floor(h / 24);
    return d + 'd ago';
  } catch { return ''; }
}

function activityStatus(lastMessageAt, lastMessageType, lastMessageLength) {
  if (!lastMessageAt) return 'stale';
  var ms = Date.now() - new Date(lastMessageAt).getTime();
  var mins = ms / 60000;
  var len = lastMessageLength || 0;
  // Agent actively generating (short thinking steps arriving)
  if (lastMessageType === 2 && mins < 2 && len < 300) return 'running';
  // Agent finished with a real response — needs user input
  if (lastMessageType === 2 && mins < 60) return 'waiting';
  // User sent a message recently — agent should be working on it
  if (lastMessageType === 1 && mins < 30) return 'recent';
  if (mins < 30) return 'recent';
  return 'stale';
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

const input = document.getElementById('reply-input');
input.addEventListener('input', function() { autoResize(this); });
input.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); }
});

// --- Telegram toggle ---
var tgEnabled = false;

async function loadSettings() {
  try {
    var res = await fetch(API + '/api/settings');
    var data = await res.json();
    tgEnabled = data.telegramEnabled;
    updateToggleUI();
  } catch {}
}

function updateToggleUI() {
  var el = document.getElementById('tg-toggle');
  if (el) el.className = 'toggle-row' + (tgEnabled ? ' on' : '');
}

async function toggleTelegram() {
  tgEnabled = !tgEnabled;
  updateToggleUI();
  try {
    await fetch(API + '/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramEnabled: tgEnabled }),
    });
  } catch {}
}

// --- Live sidebar highlighting ---
var lastSeenAt = {};
var lastUpdatePoll = Date.now();

function markConversationSeen(convId) {
  var c = conversationCache[convId];
  if (c && c.lastMessageAt) lastSeenAt[convId] = c.lastMessageAt;
}

async function pollUpdates() {
  try {
    var res = await fetch(API + '/api/updates?since=' + lastUpdatePoll);
    var data = await res.json();
    if (data.updates && data.updates.length > 0) {
      refreshOpenWorkspaces();
    }
    lastUpdatePoll = data.serverTime || Date.now();
  } catch {}
}

async function refreshOpenWorkspaces() {
  var headers = document.querySelectorAll('.workspace-header.open');
  for (var i = 0; i < headers.length; i++) {
    var convList = headers[i].nextElementSibling;
    if (!convList || !convList.id) continue;
    var hash = convList.id.replace('convs-', '');
    if (!hash) continue;
    try {
      var res = await fetch(API + '/api/conversations?workspace=' + hash);
      var data = await res.json();
      if (!data.conversations || data.conversations.length === 0) continue;
      convList.innerHTML = data.conversations.map(function(c) { return renderConvItem(c, hash); }).join('');
      // Apply highlights and re-mark active
      applyHighlights(convList);
      var active = convList.querySelector('[data-id="' + activeConvId + '"]');
      if (active) active.classList.add('active');
    } catch {}
  }
}

function applyHighlights(container) {
  var items = container.querySelectorAll('.conversation-item');
  for (var i = 0; i < items.length; i++) {
    var id = items[i].getAttribute('data-id');
    var c = conversationCache[id];
    // Only highlight root conversations (no parentId) that have new activity
    if (c && !c.parentId && c.lastMessageAt && c.lastMessageAt !== lastSeenAt[id]) {
      items[i].classList.add('updated');
    }
  }
}

// Override loadConversation to mark as seen
var _origLoadConversation = loadConversation;
loadConversation = async function(id, wsHash, el) {
  markConversationSeen(id);
  // Remove highlight from clicked item
  if (el) el.classList.remove('updated');
  return _origLoadConversation(id, wsHash, el);
};

// --- Theme toggle ---
function getPreferredTheme() {
  var saved = localStorage.getItem('theme');
  if (saved) return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  var icon = document.getElementById('theme-toggle');
  if (icon) icon.textContent = theme === 'light' ? '\\u263E' : '\\u2606';
}

function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme') || getPreferredTheme();
  var next = current === 'light' ? 'dark' : 'light';
  localStorage.setItem('theme', next);
  applyTheme(next);
}

applyTheme(getPreferredTheme());

loadSettings();
loadWorkspaces();
setInterval(pollUpdates, 10000);
</script>
</body>
</html>`;
}
