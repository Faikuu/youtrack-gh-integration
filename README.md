# GitHub Links for YouTrack

A YouTrack app that links GitHub issues, pull requests and commits to YouTrack
issues. Pick an item from a search dialog, or type `gh <query>` in the issue
panel, and the link is stored on the issue with a comment. A GitHub webhook also
comments on any YouTrack issue whose ID appears in a PR, issue or push.

## Features

- **Link picker**: search GitHub issues, PRs and commits from an issue's menu
  and link one.
- **Suggestion box**: type `gh <query>` in the Linked GitHub panel to search and
  link without leaving the issue.
- **Direct lookup**: `#123`, a commit hash or a GitHub URL resolves straight to
  that item.
- **Webhook**: PR, issue and push events that mention a YouTrack ID (for example
  `PROJ-123`) add a comment to that issue.
- **Repo allowlist**: limit searches to specific repos or whole orgs per project.
- **Unlink**: removes a link and adds an "Unlinked" comment.

## Requirements

- YouTrack **2024.1** or later (Cloud). The widgets load Ring UI from
  `unpkg.com`, so the instance must be able to reach that CDN.
- A GitHub fine-grained personal access token with read access to **Contents**,
  **Pull requests** and **Metadata**.
- Node.js, to run the test suite.

## Quick start

1. Build the app package. This runs the tests and creates `gh-links-app.zip`:

   ```sh
   sh scripts/package.sh
   ```

2. In YouTrack, go to **Administration → Apps → New App** and upload the zip.
3. Set `githubToken` in the app settings, then attach the app to a project.

The full setup is in [gh-links-app/README.md](gh-links-app/README.md): token
scopes, the repo allowlist, the GitHub webhook, usage, and troubleshooting.

## Repository layout

| Path | Contents |
|------|----------|
| `gh-links-app/` | The YouTrack app: manifest, HTTP handlers, GitHub helpers, widgets, settings schema |
| `gh-links-app/widgets/` | Linked GitHub panel, link picker, project settings |
| `tests/` | Test suite, run with `node --test` |
| `scripts/package.sh` | Runs the tests and builds the app zip |
| `docs/superpowers/` | Design spec and implementation plan |

## Tests

```sh
node --test
```

The tests check the app's structure and its pure logic: the manifest and
widgets, the request handlers, and the link helpers. They make no calls to
GitHub or YouTrack.

## Status

The app is unit-tested but has not yet been run end-to-end against a live
YouTrack instance. The manual checklist in section 8 of
[gh-links-app/README.md](gh-links-app/README.md) is still unchecked. Known v1
limitations are listed at the end of that file.

## License

Released under the [MIT License](LICENSE).
