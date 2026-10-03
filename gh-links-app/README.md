# GitHub Links for YouTrack (`gh-links-app`)

YouTrack app that links GitHub issues, pull requests and commits to YouTrack issues
via a visual picker and an inline suggestion box. App-only (no separate backend):
GitHub API calls and webhook handling run in YouTrack app HTTP handlers; the
GitHub token never reaches the browser.

Requires YouTrack **2024.1+** (Cloud). Widgets load Ring UI from
`https://unpkg.com` — the YouTrack instance must be able to reach the CDN.

## 1. Install

1. Build the package: `sh scripts/package.sh` (runs the test suite, then produces
   `gh-links-app.zip`).
2. In YouTrack: **Administration → Apps → New App** (or "Upload app"), upload
   `gh-links-app.zip`.
3. Open the app's settings and configure the token (next step).

## 2. Configure the GitHub token

In **Administration → Apps → GitHub Links → Settings** set:

- **`githubToken`** (required): a GitHub **fine-grained personal access token**
  with read access to **Contents**, **Pull requests** and **Metadata**
  (`contents:read`, `pull_requests:read`, `metadata:read`). Stored as a secret;
  used server-side only.
- **`webhookToken`** (required for the GitHub→YouTrack webhook): any shared
  secret string. It is appended to the webhook URL as `?token=…` (GitHub's
  "Secret" HMAC field is *not* checked by the handler — put the token in the URL).
- **`allowedRepos`**: comma-separated `owner/repo` list. Blank = all repos.
  (Declared setting; v1 does not yet filter search results by it.)
- **`allowCommands`**: reserved for future state commands (see Limitations).

## 3. Attach the app to a project

Open the target project → **Project Settings → Apps** → attach **GitHub Links**.
The widgets appear on issues in that project:

- **Linked GitHub** panel (issue field panel): list of linked items.
- **Link GitHub…** (issue options menu): opens the picker modal.
- **GitHub Settings** (project settings): shows the webhook URL and link count.

## 4. Repo allowlist

In the **GitHub Settings** project widget (or app settings), enter the
`owner/repo` values you want to scope this project to, e.g. `acme/web, acme/api`.
Leave blank to allow all repositories.

## 5. GitHub webhook setup

1. Copy the webhook URL printed in the **GitHub Settings** project widget:
   `https://<youtrack>/api/extensionEndpoints/gh-links-app/backend-global/gh-webhook?token=<webhookToken>`
2. On GitHub: repo **Settings → Webhooks → Add webhook**:
   - **Payload URL**: the URL above (keep the `?token=` query).
   - **Content type**: `application/json`.
   - **Events**: `pull_request`, `issues`, `push`.
3. The handler extracts YouTrack issue IDs (`PROJECT-123`, case-insensitive)
   from PR titles/bodies, issue titles/bodies and commit messages, then adds a
   comment ("GitHub activity: …") to each matching issue. Unknown IDs are skipped
   (no issues are created). Note: `push` events carry no single item URL in v1,
   so the comment shows commit messages only.

## 6. Usage

- **Link from picker**: issue menu → **Link GitHub…** → choose Issues / PRs /
  Commits tab → type ≥2 characters → (optionally narrow with `owner/repo`) →
  click a result → **Linked**. A comment `Linked GitHub <kind> <url> — <title>`
  is added and the item appears in the panel.
- **Suggestion box**: in the **Linked GitHub** panel, type `gh <search>` (2+
  chars, 300 ms debounce) → click a suggestion to link it.
- **Unlink**: click **x** next to an entry — it is removed and an
  `Unlinked GitHub <url>` comment is added.
- Links are stored on the issue as extension property `ghLinks`
  (JSON array of `{kind, repo, number?, sha?, url, title, state}`).

## 7. Troubleshooting

- **`400 — githubToken not configured`** on search: set `githubToken` in app
  settings (Administration → Apps → GitHub Links) and save. Verify the PAT has
  `contents:read`, `pull_requests:read`, `metadata:read`.
- **`502 — github search failed`**: GitHub API unreachable, token lacks scopes,
  or the token/IP is rate-limited (GitHub 403/429). Check the token, then retry.
- **`401 — bad token`** from the webhook: the `?token=` query value in the
  GitHub webhook URL does not match the app's `webhookToken` setting. Regenerate
  the secret in app settings and update the webhook URL on GitHub.
- **Permission error when linking**: linking/unlinking requires `UPDATE_ISSUE` on
  the project; viewers get a platform permission error (panel still readable).
- **No results**: query shorter than 2 characters, or the optional `owner/repo`
  filter is misspelled.

## 8. Manual e2e checklist — TO BE RUN BY THE OWNER ON STAGING

> **Status: NOT EXECUTED.** The automation agent has no access to the YouTrack
> instance. Run the steps below on a staging YouTrack Cloud project + GitHub repo
> and record the outcome. Do not treat the feature as verified until this table
> is filled in.

| # | Step | Expected result | Result |
|---|------|-----------------|--------|
| 1 | Link an **issue**: open a staging issue → **Link GitHub…** → Issues tab → search (≥2 chars) → select | "Linked" alert; comment `Linked GitHub issue owner/repo#N — title`; entry in Linked GitHub panel | ☐ |
| 2 | Link a **PR**: picker → PRs tab → select a pull request | Entry shows `pr owner/repo#N`; comment added | ☐ |
| 3 | Link a **commit**: picker → Commits tab → select a commit | Entry shows `commit owner/repo@abcdef0` (7-char sha) | ☐ |
| 4 | Suggestion box: in panel type `gh <query>` | Suggestions appear (latency < 2s); clicking one links it | ☐ |
| 5 | **Unlink**: click **x** on an entry | Entry removed from panel; `Unlinked GitHub <url>` comment | ☐ |
| 6 | **Webhook**: on the staging GitHub repo, open and close a PR whose title/body contains `PROJ-123`; also replay a `push` | YouTrack issue PROJ-123 gains `GitHub activity: <PR url> …` comment (push shows commit messages) | ☐ |
| 7 | **Permissions**: as a user without `UPDATE_ISSUE`, try to link | Platform permission error surfaced; panel remains readable | ☐ |
| 8 | **Reimport**: upload the same zip again via Administration → Apps | Links preserved (extension properties persist; do not rename the app) | ☐ |

### Known v1 limitations

- No pagination on GitHub search results (first page only).
- `allowedRepos` allowlist is declared but not yet enforced in search.
- `allowCommands` / `fix <text>` state commands are reserved; selecting from the
  suggestion box links only.
- Webhook auth is a shared-secret query param, not HMAC signature verification.
- Native GitHub VCS integration can stay enabled; this app only comments on
  explicit link actions and PR/issue/push events referencing issue IDs.
