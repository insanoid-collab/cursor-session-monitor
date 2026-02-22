export function chatPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cursor Conversations</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%23264f78'/><path d='M8 10h12l-6 12z' fill='%23569cd6'/><circle cx='22' cy='10' r='3' fill='%234ec953'/></svg>">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
:root {
  --bg: #1e1e1e; --sidebar-bg: #252526; --border: #3c3c3c;
  --text: #cccccc; --text-dim: #888; --text-bright: #e0e0e0;
  --user-bg: #264f78; --assistant-bg: #2d2d2d;
  --accent: #569cd6; --accent-hover: #6cb0f0;
  --input-bg: #3c3c3c; --hover: #2a2d2e;
}
html, body { height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); }
#app { display: flex; height: 100vh; }

/* Sidebar */
#sidebar { width: 300px; min-width: 300px; background: var(--sidebar-bg); border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
#sidebar-header { padding: 12px 16px; border-bottom: 1px solid var(--border); font-size: 14px; font-weight: 600; color: var(--text-bright); display: flex; align-items: center; gap: 8px; }
#sidebar-header span { font-size: 16px; }
#search-box { padding: 8px 12px; border-bottom: 1px solid var(--border); }
#search-box input { width: 100%; background: var(--input-bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text); padding: 7px 10px; font-size: 12px; font-family: inherit; outline: none; }
#search-box input:focus { border-color: var(--accent); }
#search-box input::placeholder { color: var(--text-dim); }
#workspace-list { flex: 1; overflow-y: auto; }
.workspace { border-bottom: 1px solid var(--border); }
.workspace-header { padding: 10px 16px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-dim); user-select: none; }
.workspace-header:hover { background: var(--hover); color: var(--text); }
.workspace-header .arrow { font-size: 10px; transition: transform 0.15s; }
.workspace-header.open .arrow { transform: rotate(90deg); }
.workspace-header .name { flex: 1; overflow: hidden; font-weight: 500; word-break: break-word; }
.workspace-header .open-dot { width: 7px; height: 7px; border-radius: 50%; background: #4ec953; flex-shrink: 0; }
.workspace-header .count { font-size: 11px; color: var(--text-dim); background: var(--input-bg); padding: 1px 6px; border-radius: 8px; }
.workspace.is-open > .workspace-header .name { color: var(--text-bright); }
.conversation-list { display: none; }
.workspace-header.open + .conversation-list { display: block; }
.conversation-item { padding: 8px 16px 8px 32px; cursor: pointer; font-size: 12px; border-left: 2px solid transparent; }
.conversation-item:hover { background: var(--hover); }
.conversation-item.active { background: var(--hover); border-left-color: var(--accent); }
.conversation-item .conv-title { color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 2px; display: flex; align-items: center; gap: 6px; }
.conversation-item .conv-title span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.conversation-item .conv-meta { color: var(--text-dim); font-size: 11px; display: flex; gap: 8px; }
.activity-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.activity-dot.running { background: #4ec953; animation: blink 1.2s ease-in-out infinite; }
.activity-dot.recent { background: #4ec953; }
.activity-dot.waiting { background: #e8a838; }
.activity-dot.stale { background: var(--text-dim); opacity: 0.3; }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
.subagent-count { font-size: 10px; color: var(--text-dim); background: var(--input-bg); padding: 1px 5px; border-radius: 3px; flex-shrink: 0; white-space: nowrap; margin-left: auto; }
.subagent-badge { font-size: 10px; color: var(--accent); background: rgba(86,156,214,0.12); padding: 0 5px; border-radius: 3px; flex-shrink: 0; white-space: nowrap; }

/* Sub-agent tabs in main header */
#agent-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border); padding: 0 20px; overflow-x: auto; min-height: 0; }
#agent-tabs:empty { display: none; }
.agent-tab { padding: 8px 14px; font-size: 12px; color: var(--text-dim); cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap; display: flex; align-items: center; gap: 6px; transition: all 0.15s; flex-shrink: 0; }
.agent-tab:hover { color: var(--text); background: var(--hover); }
.agent-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
.agent-tab .tab-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.agent-tab .tab-badge { font-size: 10px; color: var(--accent); opacity: 0.7; }
.agent-tab.more-tab { color: var(--text-dim); font-size: 14px; letter-spacing: 2px; padding: 8px 10px; }
.agent-tab.more-tab.expanded { color: var(--accent); }
.older-agents { display: none; }
.older-agents.show { display: contents; }

/* Main area */
#main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
#main-header { padding: 12px 20px; border-bottom: 1px solid var(--border); font-size: 13px; color: var(--text-dim); display: flex; align-items: center; gap: 8px; min-height: 48px; }
#main-header .conv-mode { font-size: 11px; background: var(--input-bg); padding: 2px 8px; border-radius: 4px; color: var(--accent); }
#messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; }
#empty-state { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text-dim); font-size: 14px; }

.message { max-width: 80%; padding: 10px 14px; border-radius: 10px; font-size: 13px; line-height: 1.55; white-space: pre-wrap; word-wrap: break-word; }
.message.user { align-self: flex-end; background: var(--user-bg); color: #fff; border-bottom-right-radius: 3px; }
.message.assistant { align-self: flex-start; background: var(--assistant-bg); border: 1px solid var(--border); border-bottom-left-radius: 3px; }
.message .msg-time { font-size: 10px; color: var(--text-dim); margin-top: 4px; text-align: right; }
.message.assistant .msg-time { text-align: left; }

/* Thinking steps (collapsed group of short AI messages) */
.thinking-group { align-self: flex-start; max-width: 80%; margin: 2px 0; }
.thinking-group summary { list-style: none; background: var(--sidebar-bg); border: 1px solid var(--border); border-radius: 8px; padding: 7px 14px; color: var(--text-dim); font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.15s; }
.thinking-group summary:hover { border-color: var(--accent); color: var(--text); background: var(--hover); }
.thinking-group summary::-webkit-details-marker { display: none; }
.thinking-group summary .arrow { font-size: 9px; transition: transform 0.15s; display: inline-block; }
.thinking-group[open] summary .arrow { transform: rotate(90deg); }
.thinking-group[open] summary { border-color: var(--accent); background: var(--hover); border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
.thinking-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); opacity: 0.7; flex-shrink: 0; }
.thinking-steps { padding: 0; margin: 0; background: var(--sidebar-bg); border: 1px solid var(--border); border-top: none; border-radius: 0 0 8px 8px; overflow: hidden; }
.thinking-step { padding: 7px 14px 7px 32px; font-size: 12px; color: var(--text-dim); white-space: pre-wrap; word-wrap: break-word; position: relative; border-top: 1px solid rgba(255,255,255,0.04); line-height: 1.5; }
.thinking-step::before { content: ''; position: absolute; left: 14px; top: 12px; width: 5px; height: 5px; border-radius: 50%; background: var(--text-dim); opacity: 0.4; }
.message code { background: rgba(255,255,255,0.08); padding: 1px 4px; border-radius: 3px; font-family: 'SF Mono', Menlo, monospace; font-size: 12px; }
.message pre { background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px; overflow-x: auto; margin: 6px 0; }
.message pre code { background: none; padding: 0; }
.message h1, .message h2, .message h3 { margin: 8px 0 4px; color: var(--text-bright); }
.message h1 { font-size: 16px; } .message h2 { font-size: 14px; } .message h3 { font-size: 13px; }
.message ul, .message ol { padding-left: 20px; margin: 4px 0; }
.message strong { color: var(--text-bright); }

/* Input */
#input-area { padding: 12px 20px; border-top: 1px solid var(--border); display: flex; gap: 8px; align-items: flex-end; }
#input-area textarea { flex: 1; background: var(--input-bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); padding: 10px 12px; font-size: 13px; font-family: inherit; resize: none; min-height: 42px; max-height: 160px; outline: none; }
#input-area textarea:focus { border-color: var(--accent); }
#input-area button { background: var(--accent); color: #fff; border: none; border-radius: 8px; padding: 10px 18px; font-size: 13px; cursor: pointer; font-weight: 500; white-space: nowrap; }
#input-area button:hover { background: var(--accent-hover); }
#input-area button:disabled { opacity: 0.5; cursor: not-allowed; }
#input-area.is-running textarea { opacity: 0.4; pointer-events: none; }
#input-area.is-running button { display: none; }
#running-indicator { display: none; align-items: center; gap: 8px; font-size: 12px; color: var(--text-dim); padding: 8px 0; white-space: nowrap; }
#input-area.is-running #running-indicator { display: flex; }
#running-indicator .pulse { width: 8px; height: 8px; border-radius: 50%; background: #4ec953; animation: blink 1.2s ease-in-out infinite; flex-shrink: 0; }

/* Scrollbar */
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #555; }

/* Loading */
.loading { text-align: center; padding: 20px; color: var(--text-dim); font-size: 13px; }
#show-all-btn { display: block; width: calc(100% - 24px); margin: 8px 12px; padding: 7px; background: transparent; border: 1px dashed var(--border); border-radius: 6px; color: var(--text-dim); font-size: 12px; cursor: pointer; text-align: center; }
#show-all-btn:hover { border-color: var(--accent); color: var(--text); }
.load-more-btn { display: block; margin: 0 auto 12px; padding: 6px 16px; background: transparent; border: 1px dashed var(--border); border-radius: 6px; color: var(--text-dim); font-size: 12px; cursor: pointer; }
.load-more-btn:hover { border-color: var(--accent); color: var(--text); }
</style>
</head>
<body>
<div id="app">
  <div id="sidebar">
    <div id="sidebar-header"><span>&#9671;</span> Cursor Conversations</div>
    <div id="search-box"><input id="search-input" type="text" placeholder="Search workspaces..." oninput="filterWorkspaces(this.value)"></div>
    <div id="workspace-list"><div class="loading">Loading workspaces...</div></div>
  </div>
  <div id="main">
    <div id="main-header">Select a conversation</div>
    <div id="agent-tabs"></div>
    <div id="empty-state">Choose a workspace and conversation from the sidebar</div>
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
        '<span class="count">' + ws.conversationCount + '</span>' +
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
    // Auto-expand open workspaces and load their conversations
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

// Store conversation data for sub-agent tab switching
var conversationCache = {};

function renderConvItem(c, hash) {
  // Cache for tab rendering later
  conversationCache[c.id] = c;
  var status = activityStatus(c.lastMessageAt, c.lastMessageType, c.lastMessageLength);
  var childCount = (c.children && c.children.length) || 0;
  return '<div class="conversation-item" data-id="' + c.id + '" onclick="loadConversation(\\'' + c.id + '\\', \\'' + hash + '\\', this)">' +
    '<div class="conv-title"><span class="activity-dot ' + status + '"></span>' +
    '<span>' + esc(c.title) + '</span>' +
    (childCount > 0 ? '<span class="subagent-count">' + childCount + ' sub</span>' : '') +
    '</div>' +
    '<div class="conv-meta"><span>' + c.messageCount + ' msgs</span><span>' + c.mode + '</span>' +
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
      el.innerHTML = '<div class="loading" style="padding:8px 32px">No conversations with messages</div>';
      return;
    }
    el.innerHTML = data.conversations.map(c => renderConvItem(c, hash)).join('');
  } catch (e) {
    el.innerHTML = '<div class="loading" style="padding:8px 32px">Failed to load</div>';
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
    // Always show the active tab as recent so it stays visible
    if (age < RECENT_MINS || child.id === activeConvId) {
      recent.push(child);
    } else {
      older.push(child);
    }
  }
  var html = agentTabHtml(root, rootId);
  for (var j = 0; j < recent.length; j++) html += agentTabHtml(recent[j], rootId);
  if (older.length > 0) {
    html += '<div class="agent-tab more-tab' + (olderAgentsExpanded ? ' expanded' : '') + '" onclick="toggleOlderAgents()" title="' + older.length + ' older sub-agents">' +
      '<span>\\u00B7\\u00B7\\u00B7</span><span style="font-size:10px;margin-left:2px">' + older.length + '</span></div>';
    html += '<span class="older-agents' + (olderAgentsExpanded ? ' show' : '') + '">';
    for (var k = 0; k < older.length; k++) html += agentTabHtml(older[k], rootId);
    html += '</span>';
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

  renderAgentTabs(id);

  const msgs = document.getElementById('messages');
  msgs.innerHTML = '<div class="loading">Loading messages...</div>';

  try {
    const res = await fetch(API + '/api/conversations/' + id + '?limit=50');
    const data = await res.json();
    document.getElementById('main-header').innerHTML =
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
    // Preserve scroll position: measure before prepending
    const prevHeight = msgs.scrollHeight;
    const prevTop = msgs.scrollTop;

    // Remove old load-more button
    if (btn) btn.remove();

    // Build new HTML to prepend
    let html = '';
    if (data.hasMore) {
      html += '<button id="load-more-btn" onclick="loadEarlierMessages()" class="load-more-btn">Load earlier messages</button>';
    }
    html += buildMessagesHtml(data.messages || []);

    msgs.insertAdjacentHTML('afterbegin', html);

    // Restore scroll position so user doesn't jump
    msgs.scrollTop = prevTop + (msgs.scrollHeight - prevHeight);
  } catch (e) {
    if (btn) btn.textContent = 'Failed — click to retry';
  }
  loadingMore = false;
}

function isThinkingStep(m) {
  return m.type === 2 && m.text.length < 300 && !/^#/.test(m.text.trim());
}

var thinkingCounter = 0;

function buildMessagesHtml(messages) {
  var html = '';
  var i = 0;
  while (i < messages.length) {
    var m = messages[i];
    if (m.type === 1) {
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
    // Always update running state even if message count unchanged
    updateRunningState(data.messages || []);
    // Only re-render if message count changed (avoids wiping UI state like open details)
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

  // Optimistic append
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
  // Extract code blocks first to protect them from further processing
  const codeBlocks = [];
  let src = text.replace(/\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g, function(_, lang, code) {
    codeBlocks.push('<pre><code>' + esc(code) + '</code></pre>');
    return '%%CB' + (codeBlocks.length - 1) + '%%';
  });
  // Extract inline code
  const inlineCode = [];
  src = src.replace(/\`([^\`]+?)\`/g, function(_, code) {
    inlineCode.push('<code>' + esc(code) + '</code>');
    return '%%IC' + (inlineCode.length - 1) + '%%';
  });
  // Now escape the rest
  src = esc(src);
  // Links [text](url)
  src = src.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank" style="color:var(--accent)">$1</a>');
  // Bold
  src = src.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
  // Italic
  src = src.replace(/\\*(.+?)\\*/g, '<em>$1</em>');
  // Headers
  src = src.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  src = src.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  src = src.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // Horizontal rule
  src = src.replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:8px 0">');
  // Tables: detect lines with pipes
  src = src.replace(/(^\\|.+\\|\\n?)+/gm, function(block) {
    const rows = block.trim().split('\\n').filter(r => r.trim());
    if (rows.length < 2) return block;
    // Check if second row is separator (|---|---|)
    const isSep = /^[\\|\\s:\\-]+$/.test(rows[1]);
    let html = '<table style="border-collapse:collapse;margin:6px 0;font-size:12px;width:100%">';
    rows.forEach(function(row, i) {
      if (isSep && i === 1) return; // skip separator row
      const cells = row.split('|').filter(function(c, j, a) { return j > 0 && j < a.length - 1; });
      const tag = (isSep && i === 0) ? 'th' : 'td';
      html += '<tr>' + cells.map(function(c) {
        return '<' + tag + ' style="padding:4px 8px;border:1px solid var(--border);text-align:left">' + c.trim() + '</' + tag + '>';
      }).join('') + '</tr>';
    });
    html += '</table>';
    return html;
  });
  // Numbered lists
  src = src.replace(/^(\\d+)\\. (.+)$/gm, '<li style="list-style:decimal;margin-left:20px">$2</li>');
  // Unordered lists
  src = src.replace(/^[\\-\\*] (.+)$/gm, '<li style="list-style:disc;margin-left:20px">$1</li>');
  // Restore inline code
  src = src.replace(/%%IC(\\d+)%%/g, function(_, i) { return inlineCode[parseInt(i)]; });
  // Restore code blocks
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
  // type 2 = assistant, type 1 = user
  // Only short assistant messages (<300 chars, i.e. thinking steps) within 2 min indicate running.
  // Long responses mean the agent finished and is waiting for user input.
  var len = lastMessageLength || 0;
  if (lastMessageType === 2 && mins < 2 && len < 300) return 'running';
  if (lastMessageType === 1 && mins < 30) return 'waiting';
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

loadWorkspaces();
</script>
</body>
</html>`;
}
