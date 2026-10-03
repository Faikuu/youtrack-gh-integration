# GitHub Integration for YouTrack — Design Spec

Date: 2026-10-03
Status: Approved
Constraints: YouTrack Cloud, github.com, App-only (no browser extension), service token, App-handlers-only (no separate backend)

## 1. Goal

Homebrew YouTrack App that lets users link GitHub issues, pull requests, and commits to YouTrack issues via a visual picker (modal) and a suggestion-box command bar inside the widget — ADO-style UX constrained to what the YouTrack Apps SDK allows (sandboxed iframes, no native input injection).

Keep native GitHub VCS integration enabled for commit→issue auto-linking. This app owns the picker + richer issue/PR display + server-side GitHub→YouTrack sync.

## 2. Architecture

YouTrack App zip (`gh-links-app/`) only. No separate backend.

- Widgets (iframe frontend, React + Ring UI via CDN, `YTApp.register()`):
  - `ISSUE_FIELD_PANEL_LAST` — "Linked GitHub" panel: badge list + `Link GitHub…` button + inline suggestion input.
  - `ISSUE_OPTIONS_MENU_ITEM` — "Link GitHub…" opens modal widget.
  - `PROJECT_SETTINGS` — repo allowlist mapping + token status + webhook URL display.
- HTTP handlers (`backend/gh-proxy.js`):
  - `GET /search` (scope `global` or `issue`): query GitHub Search API (`/search/issues`, `/search/commits`) with token from secret settings. Debounced from widget via `host.fetchApp()`.
  - `GET/POST/DELETE /links` (scope `issue`): read/write `ctx.issue.extensionProperties.ghLinks` (stringified JSON array).
  - `POST /gh-webhook` (scope `global`): receives GitHub webhooks (push, pull_request, issues). Auth via `?token=` query secret (HMAC verification is limited in scripting runtime; shared-secret query param is the pragmatic choice). Parses `Fixes PROJECT-123` / `PROJECT-123` in PR title/body, posts comment and optionally applies state command.
- Storage (`entity-extensions.json`):
  - `Issue.ghLinks: string` — JSON array `[{kind:'issue'|'pr'|'commit', repo, number?, sha?, url, title, state, updatedAt}]`.
  - `AppGlobalStorage.ghRepoMap: string` — JSON `{ "<projectShortName>": ["owner/repo", ...] }`, plus `ghWebhookToken`.
- Settings (`settings-schema.json`): `githubToken` (secret, PAT fine-grained `contents:read, pull_requests:read, metadata:read` or GitHub App installation token pasted), `allowedRepos` (string), `webhookToken` (secret, auto-generated), `allowCommands` (bool).

## 3. Key flows

1. Link from picker: widget `Link GitHub…` → `host.enterModalMode()` → tabs Issues/PRs/Commits → type query → `fetchApp('backend/search?...')` → handler `http.Connection('https://api.github.com')` with `Authorization: Bearer <token>` → results → `POST links` → handler updates `extensionProperties.ghLinks` + `issue.addComment("Linked GitHub PR owner/repo#123 — <title> <url>")` → `host.alert('Linked')` + re-render.
2. Unlink: `DELETE links?url=...` → removes entry + comment.
3. Suggestion-box commands: widget input; typing `gh <text>` shows dropdown from `/search`; selecting inserts link. Typing `fix <text>` links + applies `State Fixed` via scripting API if `allowCommands` and user has permission. No native command-box injection (SDK limitation, documented).
4. GitHub→YouTrack: repo webhook `https://<youtrack>/api/extensionEndpoints/gh-links-app/backend/gh-webhook?token=...` subscribed to `pull_request, issues, push`. Handler extracts YouTrack IDs (`/[A-Z]+-\d+/`) from PR title/body/commit messages, calls `entities.Issue.findById(id)` → `addComment()` with PR/issue link + state. Author mapping: match GitHub email/name to YouTrack user; fall back to bot comment.

## 4. Permissions / security

- Endpoints declare `permissions: ['READ_ISSUE']` (links/search) and `UPDATE_ISSUE` for link writes. Global webhook endpoint validates query token before doing anything.
- GitHub token stored as secret app setting, never sent to widget frontend except via handler-side use. Widget only sees search results.
- Guest users excluded (global endpoints deny guest by platform).

## 5. Error handling

- Missing token → settings tab + widget show "Configure GitHub token in Project Settings".
- GitHub 403/429 → return `{error:'rate-limited', retryAfter}` → widget shows friendly message.
- Bad `ghLinks` JSON → reset to `[]`, warn via `console.warn` + comment once.
- Webhook token mismatch → 401, no-op. Unknown issue ID → skip (do not create issues).

## 6. Testing / verification

- Manual e2e on staging project: link/unlink issue, PR, commit; search latency <2s; webhook replay (push + PR opened/closed) produces comment; restricted viewer cannot link (permission error surfaced).
- Reimport app preserves links (extension props persist unless renamed).
- Native VCS integration left on: no duplicate comments (app comments only on explicit link action or PR event referencing issue).

## 7. Out of scope

- Browser extension, native `#` autocomplete in comments/description/command dialog, GitHub-side UI injection, bidirectional state sync conflicts, GHE Server, per-user OAuth (service token only for v1).
