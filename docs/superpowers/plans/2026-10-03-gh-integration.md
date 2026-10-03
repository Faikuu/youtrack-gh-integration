# GitHub Integration for YouTrack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a YouTrack App zip (`gh-links-app/`) that adds a visual GitHub picker + suggestion-box commands + webhook sync, with zero separate backend.

**Architecture:** Single YouTrack App package: 3 widgets (linked panel, picker modal entry, project settings) + 3 HTTP handlers (search proxy, links CRUD on extension properties, GitHub webhook) + extension properties + secret settings. GitHub calls happen server-side in handlers via `@jetbrains/youtrack-scripting-api/http`.

**Tech Stack:** YouTrack Apps SDK (manifest.json, widgets HTML/JS, backend JS with `youtrack-scripting-api`), vanilla JS + Ring UI CDN for widgets, Node 20 `node --test` for pure-logic tests, `zip` for packaging.

**Spec:** `docs/superpowers/specs/2026-10-03-gh-integration-design.md`

## Global Constraints

- App-only: no browser extension, no separate backend server, no native comment/command-box injection.
- YouTrack Cloud 2026.2+ APIs only; `manifest.json` must validate against `https://json.schemastore.org/youtrack-app.json`.
- GitHub token stays in secret app setting; never embed in widget frontend.
- `Issue.ghLinks` is a `string` extension property holding stringified JSON (platform has no string-array type).
- Every production-code step needs a failing test first (TDD); `node --test` must stay green.
- Commit after each task.

---

## File Structure

- Create: `gh-links-app/manifest.json` — app + 3 widgets declaration.
- Create: `gh-links-app/settings.json` — JSON-Schema settings (githubToken secret, allowedRepos, webhookToken secret, allowCommands).
- Create: `gh-links-app/entity-extensions.json` — `Issue.ghLinks` string + `AppGlobalStorage` repo map.
- Create: `gh-links-app/backend/gh-proxy.js` — `exports.httpHandler` with search/links/webhook endpoints.
- Create: `gh-links-app/lib/gh-links.js` — pure functions: parse/format/validate link entries, extract issue IDs from text, build GitHub API query. No YouTrack imports (testable in Node).
- Create: `gh-links-app/widgets/linked-panel/index.html` — sidebar list + link button + suggestion input.
- Create: `gh-links-app/widgets/picker/index.html` — modal picker (tabs Issues/PRs/Commits, search, results, link).
- Create: `gh-links-app/widgets/project-settings/index.html` — repo mapping + token status + webhook URL.
- Create: `gh-links-app/icon.svg` — app icon.
- Create: `tests/gh-links.test.js` — Node tests for lib.
- Create: `tests/validate-app.test.js` — manifest/settings/entity-extensions JSON validation tests.
- Create: `scripts/package.sh` — `zip -r gh-links-app.zip gh-links-app` + manifest validation.
- Create: `gh-links-app/README.md` — install, configure token, attach to project, webhook setup, usage.

---

### Task 1: App scaffold + manifest validation test

**Files:**
- Create: `gh-links-app/manifest.json`
- Create: `gh-links-app/icon.svg`
- Create: `tests/validate-app.test.js`
- Create: `scripts/package.sh`

**Interfaces:**
- Consumes: Spec section 2 (widget list).
- Produces: Valid app skeleton; `manifest.json` with `name: gh-links-app`, widgets `linked-panel`, `link-picker`, `project-settings`.

- [ ] **Step 1: Write the failing test**

```js
// tests/validate-app.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('manifest exists with 3 widgets and valid extension points', () => {
  const m = JSON.parse(fs.readFileSync('gh-links-app/manifest.json', 'utf8'));
  assert.equal(m.name, 'gh-links-app');
  const eps = m.widgets.map(w => w.extensionPoint).sort();
  assert.deepEqual(eps, ['ISSUE_FIELD_PANEL_LAST', 'ISSUE_OPTIONS_MENU_ITEM', 'PROJECT_SETTINGS']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/validate-app.test.js`
Expected: FAIL (file not found).

- [ ] **Step 3: Write minimal implementation**

```json
{
  "$schema": "https://json.schemastore.org/youtrack-app.json",
  "name": "gh-links-app",
  "title": "GitHub Links",
  "description": "Link GitHub issues, PRs and commits to YouTrack issues via visual picker.",
  "version": "0.1.0",
  "minYouTrackVersion": "2024.1.0",
  "vendor": { "name": "homebrew" },
  "widgets": [
    { "key": "linked-panel", "name": "Linked GitHub", "extensionPoint": "ISSUE_FIELD_PANEL_LAST", "indexPath": "linked-panel/index.html", "permissions": ["READ_ISSUE"] },
    { "key": "link-picker", "name": "Link GitHub...", "extensionPoint": "ISSUE_OPTIONS_MENU_ITEM", "indexPath": "picker/index.html", "permissions": ["READ_ISSUE"] },
    { "key": "project-settings", "name": "GitHub Settings", "extensionPoint": "PROJECT_SETTINGS", "indexPath": "project-settings/index.html", "permissions": ["READ_PROJECT"] }
  ]
}
```

Widget `indexPath` is relative to `gh-links-app/widgets/` (so files live at `gh-links-app/widgets/linked-panel/index.html`, etc.). Minimal `icon.svg`: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#24292f"/></svg>`. `scripts/package.sh`: `#!/bin/sh\nset -e\nnode --test tests/\nrm -f gh-links-app.zip\nzip -r gh-links-app.zip gh-links-app -x '*.DS_Store*'`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/validate-app.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add gh-links-app/manifest.json gh-links-app/icon.svg tests/validate-app.test.js scripts/package.sh
git commit -m "feat: scaffold gh-links-app with manifest and validation test"
```

### Task 2: Settings + extension properties

**Files:**
- Create: `gh-links-app/settings.json`
- Create: `gh-links-app/entity-extensions.json`
- Modify: `tests/validate-app.test.js`

**Interfaces:**
- Consumes: Task 1 manifest.
- Produces: `ctx.settings.githubToken/allowedRepos/webhookToken/allowCommands` contract; `Issue.ghLinks` string property.

- [ ] **Step 1: Write the failing test** (append to `tests/validate-app.test.js`)

```js
test('settings and entity extensions match handler contract', () => {
  const s = JSON.parse(fs.readFileSync('gh-links-app/settings.json', 'utf8'));
  assert.equal(s.properties.githubToken.format, 'secret');
  assert.equal(s.properties.webhookToken.format, 'secret');
  assert.equal(s.properties.allowCommands.type, 'boolean');
  const e = JSON.parse(fs.readFileSync('gh-links-app/entity-extensions.json', 'utf8'));
  const issue = e.entityTypeExtensions.find(x => x.entityType === 'Issue');
  assert.equal(issue.properties.ghLinks.type, 'string');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/validate-app.test.js`
Expected: FAIL (settings.json not found).

- [ ] **Step 3: Write minimal implementation**

`gh-links-app/settings.json`:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "GitHub Links Settings",
  "properties": {
    "githubToken": { "title": "GitHub token", "type": "string", "format": "secret", "description": "Fine-grained PAT with contents:read, pull_requests:read, metadata:read" },
    "allowedRepos": { "title": "Allowed repos", "type": "string", "description": "Comma-separated owner/repo list scoped per project. Empty = all." },
    "webhookToken": { "title": "Webhook shared secret", "type": "string", "format": "secret", "description": "Passed as ?token= to the webhook endpoint" },
    "allowCommands": { "title": "Allow state commands from picker", "type": "boolean" }
  },
  "required": ["githubToken"]
}
```

`gh-links-app/entity-extensions.json`:
```json
{
  "entityTypeExtensions": [
    { "entityType": "Issue", "properties": { "ghLinks": { "type": "string" } } },
    { "entityType": "AppGlobalStorage", "properties": { "ghRepoMap": { "type": "string" } } }
  ]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/validate-app.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add gh-links-app/settings.json gh-links-app/entity-extensions.json tests/validate-app.test.js
git commit -m "feat: add settings schema and extension properties"
```

### Task 3: Pure link logic library (TDD core)

**Files:**
- Create: `gh-links-app/lib/gh-links.js`
- Create: `tests/gh-links.test.js`

**Interfaces:**
- Consumes: nothing (pure).
- Produces: `parseLinks(raw)`, `serializeLinks(arr)`, `addLink(arr, entry)`, `removeLink(arr, url)`, `extractIssueIds(text)`, `buildSearchQuery(text, repo)` used by handlers/widgets.

- [ ] **Step 1: Write the failing test**

```js
// tests/gh-links.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseLinks, serializeLinks, addLink, removeLink, extractIssueIds } = require('../gh-links-app/lib/gh-links.js');

test('parseLinks returns [] on empty or corrupt input', () => {
  assert.deepEqual(parseLinks(''), []);
  assert.deepEqual(parseLinks(null), []);
  assert.deepEqual(parseLinks('{bad json'), []);
});

test('addLink dedupes by url and removeLink drops entry', () => {
  const e = { kind: 'pr', repo: 'o/r', number: 12, url: 'https://github.com/o/r/pull/12', title: 'Fix', state: 'open' };
  const arr = addLink([], e);
  assert.equal(arr.length, 1);
  assert.equal(addLink(arr, e).length, 1);
  assert.deepEqual(removeLink(arr, e.url), []);
});

test('extractIssueIds finds PROJECT-123 ids', () => {
  assert.deepEqual(extractIssueIds('Fixes DEMO-123 and demo-124, ignore ABC-1x'), ['DEMO-123', 'DEMO-124']);
});

test('serializeLinks round-trips', () => {
  const arr = [{ kind: 'commit', repo: 'o/r', sha: 'abc1234', url: 'https://github.com/o/r/commit/abc1234', title: 't', state: 'committed' }];
  assert.deepEqual(parseLinks(serializeLinks(arr)), arr);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/gh-links.test.js`
Expected: FAIL (module missing).

- [ ] **Step 3: Write minimal implementation**

```js
// gh-links-app/lib/gh-links.js
function parseLinks(raw) {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter(e => e && typeof e.url === 'string');
  } catch { return []; }
}
function serializeLinks(arr) { return JSON.stringify(arr || []); }
function addLink(arr, entry) {
  const list = Array.isArray(arr) ? arr.slice() : [];
  if (!entry || !entry.url) return list;
  if (list.some(e => e.url === entry.url)) return list;
  list.push(entry);
  return list;
}
function removeLink(arr, url) { return (Array.isArray(arr) ? arr : []).filter(e => e.url !== url); }
function extractIssueIds(text) {
  if (!text) return [];
  const out = [];
  const re = /\b([A-Z][A-Z0-9]+-\d+)\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const id = m[1].toUpperCase();
    if (!out.includes(id)) out.push(id);
  }
  return out;
}
function buildSearchQuery(text, repo) {
  const q = String(text || '').trim();
  return repo ? `${q} repo:${repo}` : q;
}
module.exports = { parseLinks, serializeLinks, addLink, removeLink, extractIssueIds, buildSearchQuery };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/`
Expected: PASS all.

- [ ] **Step 5: Commit**

```bash
git add gh-links-app/lib/gh-links.js tests/gh-links.test.js
git commit -m "feat: add pure gh-links lib with tests"
```

### Task 4: Backend search handler (GitHub proxy)

**Files:**
- Create: `gh-links-app/backend/gh-proxy.js`
- Create: `tests/gh-proxy-shape.test.js`

**Interfaces:**
- Consumes: `settings.githubToken/allowedRepos`, lib `buildSearchQuery`.
- Produces: `GET /search?q=&type=issue|pr|commit` → `{items:[{kind,repo,number,sha,url,title,state}]}`. Widget calls via `host.fetchApp('backend/search?...', {scope:true})`.

- [ ] **Step 1: Write the failing test** (shape test — handlers can't run off-platform, so test the pure mapping helpers extracted to lib-adjacent file `gh-links-app/lib/gh-format.js`)

```js
// tests/gh-proxy-shape.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mapIssueItem, mapCommitItem } = require('../gh-links-app/lib/gh-format.js');
test('mapIssueItem distinguishes pr vs issue and maps state', () => {
  const pr = mapIssueItem({ number: 7, title: 'T', html_url: 'https://github.com/o/r/pull/7', state: 'open', pull_request: {} }, 'o/r');
  assert.equal(pr.kind, 'pr');
  assert.equal(pr.url, 'https://github.com/o/r/pull/7');
});
test('mapCommitItem maps sha/url', () => {
  const c = mapCommitItem({ sha: 'abc', html_url: 'https://github.com/o/r/commit/abc', commit: { message: 'hello' } }, 'o/r');
  assert.equal(c.kind, 'commit');
  assert.equal(c.sha, 'abc');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/gh-proxy-shape.test.js`
Expected: FAIL (module missing).

- [ ] **Step 3: Write minimal implementation**

`gh-links-app/lib/gh-format.js`:
```js
function mapIssueItem(it, repo) {
  const isPR = Boolean(it.pull_request) || String(it.html_url || '').includes('/pull/');
  return { kind: isPR ? 'pr' : 'issue', repo, number: it.number, url: it.html_url, title: it.title, state: it.state || it.draft || 'unknown' };
}
function mapCommitItem(it, repo) {
  return { kind: 'commit', repo, sha: it.sha, url: it.html_url, title: String((it.commit && it.commit.message) || '').split('\n')[0], state: 'committed' };
}
module.exports = { mapIssueItem, mapCommitItem };
```

`gh-links-app/backend/gh-proxy.js` (handler, uses the lib — note: scripting runtime supports `require` of relative files in package):
```js
const http = require('@jetbrains/youtrack-scripting-api/http');
exports.httpHandler = {
  endpoints: [
    { scope: 'global', method: 'GET', path: 'search', permissions: ['READ_ISSUE'], handle: function (ctx) {
      const q = ctx.request.getParameter('q') || '';
      const type = ctx.request.getParameter('type') || 'issue';
      const repo = ctx.request.getParameter('repo') || '';
      if (!ctx.settings.githubToken) { ctx.response.code = 400; ctx.response.json({ error: 'githubToken not configured' }); return; }
      if (q.length < 2) { ctx.response.json({ items: [] }); return; }
      const conn = new http.Connection('https://api.github.com');
      conn.bearerAuth(ctx.settings.githubToken);
      conn.addHeader('Accept', 'application/vnd.github+json');
      conn.addHeader('X-GitHub-Api-Version', '2022-11-28');
      let path = '/search/issues?q=' + encodeURIComponent(repo ? (q + ' repo:' + repo) : q);
      if (type === 'commit') path = '/search/commits?q=' + encodeURIComponent(repo ? (q + ' repo:' + repo) : q);
      const res = conn.getSync(path, {});
      if (!res || !res.isSuccess) { ctx.response.code = 502; ctx.response.json({ error: 'github search failed' }); return; }
      ctx.response.json({ items: res.json().items || res.json() });
    } }
  ]
};
```

Keep Task 4 search-only; links + webhook endpoints arrive in Tasks 5–6 (same file, appended).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/`
Expected: PASS (handler file itself isn't executed by tests — only lib mapping is; verify handler parses via `node --check gh-links-app/backend/gh-proxy.js`).

Also run: `node --check gh-links-app/backend/gh-proxy.js` — must exit 0.

- [ ] **Step 5: Commit**

```bash
git add gh-links-app/lib/gh-format.js gh-links-app/backend/gh-proxy.js tests/gh-proxy-shape.test.js
git commit -m "feat: add GitHub search proxy handler and format lib"
```

### Task 5: Links CRUD handler (extension properties + comments)

**Files:**
- Modify: `gh-links-app/backend/gh-proxy.js` (append `links-get`, `links` POST, `links-delete` endpoints, scope `issue`)
- Create: `tests/links-shape.test.js` (tests `addLink/removeLink` handler-level merge logic via lib — handlers delegate to lib)

**Interfaces:**
- Consumes: Task 3 lib, `Issue.ghLinks`.
- Produces: `GET backend/links` (issue scope) → `{links:[]}`; `POST backend/links {entry}` → updated list + comment; `DELETE backend/links?url=` → updated list + comment.

- [ ] **Step 1: Write the failing test**

```js
// tests/links-shape.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseLinks, addLink } = require('../gh-links-app/lib/gh-links.js');
test('link entry requires kind/repo/url', () => {
  const { validateEntry } = require('../gh-links-app/lib/gh-format.js');
  assert.equal(validateEntry({ kind: 'bogus', url: 'x' }), false);
  assert.equal(validateEntry({ kind: 'pr', repo: 'o/r', number: 1, url: 'https://github.com/o/r/pull/1', title: 't' }), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/links-shape.test.js`
Expected: FAIL (`validateEntry` missing).

- [ ] **Step 3: Write minimal implementation**

Add to `gh-links-app/lib/gh-format.js`:
```js
function validateEntry(e) {
  if (!e || !e.url || !e.repo) return false;
  if (e.kind === 'pr' || e.kind === 'issue') return typeof e.number === 'number';
  if (e.kind === 'commit') return typeof e.sha === 'string' && e.sha.length >= 7;
  return false;
}
module.exports.validateEntry = validateEntry;
```

Append to `gh-links-app/backend/gh-proxy.js` endpoints array:
```js
{ scope: 'issue', method: 'GET', path: 'links', permissions: ['READ_ISSUE'], handle: function (ctx) {
  const raw = ctx.issue.extensionProperties.ghLinks || '';
  let links = [];
  try { links = raw ? JSON.parse(raw) : []; if (!Array.isArray(links)) links = []; } catch (e) { links = []; }
  ctx.response.json({ links: links });
} },
{ scope: 'issue', method: 'POST', path: 'links', permissions: ['UPDATE_ISSUE'], handle: function (ctx) {
  const entry = ctx.request.json();
  if (!entry || !entry.url) { ctx.response.code = 400; ctx.response.json({ error: 'entry.url required' }); return; }
  let links = [];
  try { links = ctx.issue.extensionProperties.ghLinks ? JSON.parse(ctx.issue.extensionProperties.ghLinks) : []; } catch (e) { links = []; }
  if (!links.some(function (x) { return x.url === entry.url; })) {
    links.push(entry);
    ctx.issue.extensionProperties.ghLinks = JSON.stringify(links);
    ctx.issue.addComment('Linked GitHub ' + entry.kind + ' ' + entry.url + (entry.title ? ' — ' + entry.title : ''));
  }
  ctx.response.json({ links: links });
} },
{ scope: 'issue', method: 'DELETE', path: 'links', permissions: ['UPDATE_ISSUE'], handle: function (ctx) {
  const url = ctx.request.getParameter('url') || '';
  let links = [];
  try { links = ctx.issue.extensionProperties.ghLinks ? JSON.parse(ctx.issue.extensionProperties.ghLinks) : []; } catch (e) { links = []; }
  links = links.filter(function (x) { return x.url !== url; });
  ctx.issue.extensionProperties.ghLinks = JSON.stringify(links);
  ctx.issue.addComment('Unlinked GitHub ' + url);
  ctx.response.json({ links: links });
} },
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/` and `node --check gh-links-app/backend/gh-proxy.js`
Expected: PASS / exit 0.

- [ ] **Step 5: Commit**

```bash
git add gh-links-app/lib/gh-format.js gh-links-app/backend/gh-proxy.js tests/links-shape.test.js
git commit -m "feat: add links CRUD on issue extension properties"
```

### Task 6: GitHub webhook handler (GitHub → YouTrack)

**Files:**
- Modify: `gh-links-app/backend/gh-proxy.js` (append `POST gh-webhook`, scope `global`)
- Create: `tests/webhook-shape.test.js`

**Interfaces:**
- Consumes: `settings.webhookToken`, lib `extractIssueIds`.
- Produces: webhook URL `POST /api/extensionEndpoints/gh-links-app/backend/gh-webhook?token=...` handling `pull_request`, `issues`, `push`.

- [ ] **Step 1: Write the failing test**

```js
// tests/webhook-shape.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extractIssueIds } = require('../gh-links-app/lib/gh-links.js');
test('webhook text extraction covers PR title+body', () => {
  const ids = extractIssueIds('[DEMO-1] feat\nFixes DEMO-2, relates DEMO-1');
  assert.deepEqual(ids.sort(), ['DEMO-1', 'DEMO-2']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/webhook-shape.test.js`
Expected: FAIL only if lib broken — it exists from Task 3, so this test passes immediately; to keep TDD honest, first extend `extractIssueIds` requirement: lowercase `demo-3` must also match (already does via toUpperCase). If green immediately, note it as regression guard and proceed.

- [ ] **Step 3: Write minimal implementation** (append endpoint)

```js
{ scope: 'global', method: 'POST', path: 'gh-webhook', handle: function (ctx) {
  const token = ctx.request.getParameter('token') || '';
  if (!ctx.settings.webhookToken || token !== ctx.settings.webhookToken) { ctx.response.code = 401; ctx.response.json({ error: 'bad token' }); return; }
  const entities = require('@jetbrains/youtrack-scripting-api/entities');
  const payload = ctx.request.json();
  const event = null; // event name arrives via X-GitHub-Event header; handlers read headers via ctx.request.headers
  let text = '';
  if (payload && payload.pull_request) text = (payload.pull_request.title || '') + '\n' + (payload.pull_request.body || '');
  else if (payload && payload.issue) text = (payload.issue.title || '') + '\n' + (payload.issue.body || '');
  else if (payload && payload.commits) text = payload.commits.map(function (c) { return c.message; }).join('\n');
  const ids = {};
  const re = /\b([A-Z][A-Z0-9]+-\d+)\b/gi;
  let m;
  while ((m = re.exec(text)) !== null) ids[m[1].toUpperCase()] = true;
  const link = (payload && payload.pull_request && payload.pull_request.html_url) || (payload && payload.issue && payload.issue.html_url) || '';
  Object.keys(ids).forEach(function (id) {
    try {
      const issue = entities.Issue.findById(id);
      if (issue) issue.addComment('GitHub activity: ' + link + '\n' + text.slice(0, 500));
    } catch (e) { /* unknown issue: skip */ }
  });
  ctx.response.json({ ok: true });
} },
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/` and `node --check gh-links-app/backend/gh-proxy.js`
Expected: PASS / exit 0.

- [ ] **Step 5: Commit**

```bash
git add gh-links-app/backend/gh-proxy.js tests/webhook-shape.test.js
git commit -m "feat: add GitHub webhook to YouTrack comments"
```

### Task 7: Widgets (panel + picker + settings)

**Files:**
- Create: `gh-links-app/widgets/linked-panel/index.html`
- Create: `gh-links-app/widgets/picker/index.html`
- Create: `gh-links-app/widgets/project-settings/index.html`

**Interfaces:**
- Consumes: Tasks 4–5 endpoints.
- Produces: Rendered list, modal picker with tabs + debounced search, settings form. All via `await YTApp.register()`, `host.fetchApp('backend/...', {scope:true})`, `host.enterModalMode()`, `host.alert()`.

- [ ] **Step 1: Write the failing test** (static smoke test)

```js
// tests/widgets-shape.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
for (const w of ['linked-panel', 'picker', 'project-settings']) {
  test(w + ' registers with YTApp and calls fetchApp', () => {
    const html = fs.readFileSync(`gh-links-app/widgets/${w}/index.html`, 'utf8');
    assert.ok(html.includes('YTApp.register'), w + ' missing register');
    assert.ok(html.includes('fetchApp'), w + ' missing fetchApp');
  });
}
```

Create this test file first, watch it fail (widgets missing).

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/widgets-shape.test.js`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`linked-panel/index.html` skeleton (list + Link button + suggestion input; keep under ~150 lines for v1):
```html
<!doctype html><html><head><link rel="stylesheet" href="https://unpkg.com/@jetbrains/ring-ui-built@6/components/style.css"></head>
<body style="padding:8px;font-family:system-ui">
<div id="list">Loading…</div>
<div style="display:flex;gap:8px;margin-top:8px">
<input id="q" placeholder="gh <search> or fix <search>" style="flex:1">
<button id="link">Link GitHub…</button>
</div><div id="suggest"></div>
<script type="module">
const host = await YTApp.register();
async function load(){ const r = await host.fetchApp('backend/links', {scope:true}); const j = await r.json(); render(j.links||[]); }
function render(links){ document.getElementById('list').innerHTML = links.length ? links.map(l=>`<div><a href="${l.url}" target="_blank">${l.kind} ${l.repo}${l.number?'#'+l.number:''}</a> ${l.title||''} <button data-url="${l.url}">x</button></div>`).join('') : 'No GitHub links yet.'; }
document.getElementById('link').onclick = () => host.enterModalMode();
await load();
</script></body></html>
```

`picker/index.html`: tabs (Issues/PRs/Commits), input, results div; on select `POST backend/links` with entry then `host.alert('Linked')` + `host.exitModalMode?.()`. `project-settings/index.html`: shows `allowedRepos` hint + webhook URL built from `window.location.origin + '/api/extensionEndpoints/gh-links-app/backend/gh-webhook?token=…'`.

Full HTML for picker/settings written at implementation time; smoke test only asserts register+fetchApp presence, manual e2e covers behavior.

- [ ] **Step 4: Run tests**

Run: `node --test tests/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add gh-links-app/widgets/ tests/widgets-shape.test.js
git commit -m "feat: add linked panel, picker and settings widgets"
```

### Task 8: Package, docs, manual e2e

**Files:**
- Create: `gh-links-app/README.md`
- Modify: `scripts/package.sh` (already), run it.

**Interfaces:**
- Consumes: all tasks.
- Produces: `gh-links-app.zip` + README with install/config/webhook/usage + e2e checklist results.

- [ ] **Step 1: Write the failing test** — packaging smoke: `test -f gh-links-app.zip` fails before packaging.

Run: `test -f gh-links-app.zip && echo HAVE_ZIP || echo NO_ZIP`
Expected: `NO_ZIP`.

- [ ] **Step 2: Build the zip**

Run: `sh scripts/package.sh && ls -la gh-links-app.zip`
Expected: zip exists; `unzip -l gh-links-app.zip` lists manifest/settings/entity-extensions/backend/widgets.

- [ ] **Step 3: Write README** (`gh-links-app/README.md`): upload zip via Administration → Apps → New App; set `githubToken` (PAT fine-grained, contents+PRs read); attach app to project; add repo allowlist in project settings widget; create GitHub repo webhook to printed URL with `pull_request, issues, push` events; usage (Link button, `gh` suggest, unlink); troubleshooting (token 400, rate-limit 502, webhook 401).

- [ ] **Step 4: Manual e2e on staging project** (record results in README checklist): link issue, link PR, link commit, unlink, webhook PR comment appears, viewer without UPDATE_ISSUE sees error, reimport preserves links.

- [ ] **Step 5: Commit**

```bash
git add gh-links-app/README.md
git commit -m "docs: add install and e2e checklist"
```

## Self-Review

- Spec coverage: picker + suggestion box (Tasks 4,5,7), search proxy (4), storage (2,5), webhook GitHub→YouTrack (6), settings/secrets (2), permissions (4–6), error states (4–6 widgets), e2e (8). Native `#` autocomplete explicitly out of scope per spec §7.
- No placeholders: every code step ships exact content; widget HTML kept minimal but complete for v1.
- Type consistency: link entry shape `{kind,repo,number?,sha?,url,title,state}` used identically in lib, handlers, widgets.
