// tests/fetchapp-usage.test.js — final-review regression wave:
// host.fetchApp() returns ALREADY-PARSED JSON; handlers live at package root split by scope.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const widgets = ['linked-panel', 'picker', 'project-settings'];

for (const w of widgets) {
  test(w + ' never calls .json() on a fetchApp result', () => {
    const html = fs.readFileSync(`gh-links-app/widgets/${w}/index.html`, 'utf8');
    assert.ok(!html.includes('.json()'), w + ' contains .json() — fetchApp results are already parsed');
    assert.ok(!/fetchApp[\s\S]{0,200}\.json\(\)/.test(html), w + ' matches fetchApp(...).json() pattern');
  });

  test(w + ' wraps fetchApp in try/catch (no stuck Loading)', () => {
    const html = fs.readFileSync(`gh-links-app/widgets/${w}/index.html`, 'utf8');
    assert.ok(html.includes('try') && html.includes('catch'), w + ' missing try/catch around fetchApp');
  });
}

test('GET params pass via query option, not URL string', () => {
  for (const w of ['linked-panel', 'picker', 'project-settings']) {
    const html = fs.readFileSync(`gh-links-app/widgets/${w}/index.html`, 'utf8');
    assert.ok(html.includes('query:'), w + ' missing query: option form');
    assert.ok(!html.includes('backend/search?'), w + ' still builds backend/search query string');
  }
});

test('project-settings does not call issue-scope backend/links', () => {
  const html = fs.readFileSync('gh-links-app/widgets/project-settings/index.html', 'utf8');
  assert.ok(html.includes('YTApp.register'), 'missing register');
  assert.ok(html.includes('fetchApp'), 'missing fetchApp probe');
  assert.ok(!html.includes("fetchApp('backend/links'"), 'cross-scope backend/links call still present');
  assert.ok(html.includes('backend-global/search'), 'expected backend-global/search status probe');
});

test('handler layout: package-root files split by scope, no backend/ dir', () => {
  assert.ok(fs.existsSync('gh-links-app/backend.js'), 'backend.js missing');
  assert.ok(fs.existsSync('gh-links-app/backend-global.js'), 'backend-global.js missing');
  assert.ok(!fs.existsSync('gh-links-app/backend'), 'backend/ dir still present');
  const issue = fs.readFileSync('gh-links-app/backend.js', 'utf8');
  const glob = fs.readFileSync('gh-links-app/backend-global.js', 'utf8');
  assert.ok(issue.includes("scope: 'issue'"), 'backend.js must hold issue-scope endpoints');
  assert.ok(!issue.includes("scope: 'global'"), 'backend.js must not mix global scope');
  assert.ok(glob.includes("scope: 'global'"), 'backend-global.js must hold global endpoints');
  assert.ok(!glob.includes("scope: 'issue'"), 'backend-global.js must not mix issue scope');
  assert.ok(glob.includes("path: 'search'") && glob.includes("path: 'gh-webhook'"), 'backend-global.js must hold search + webhook');
});

test('manifest declares icon', () => {
  const m = JSON.parse(fs.readFileSync('gh-links-app/manifest.json', 'utf8'));
  assert.equal(m.icon, 'icon.svg');
  assert.ok(fs.existsSync('gh-links-app/icon.svg'), 'icon.svg missing');
});

test('global endpoints are called WITHOUT scope:true (flag is only for entity-scope handlers)', () => {
  for (const w of widgets) {
    const html = fs.readFileSync(`gh-links-app/widgets/${w}/index.html`, 'utf8');
    assert.ok(!html.includes("backend-global/") || !/fetchApp\('backend-global\/[^']*',\s*\{[^}]*scope:\s*true/.test(html),
      w + ' calls a global endpoint with scope:true — fetchApp then targets a scoped URL that 404s');
  }
});

test('widgets paint an explicit themed background (no transparent surfaces)', () => {
  for (const w of widgets) {
    const html = fs.readFileSync(`gh-links-app/widgets/${w}/index.html`, 'utf8');
    assert.ok(/background:\s*var\(--bg\)/.test(html), w + ' has no themed background');
  }
});

test('search UI carries icons and friendly timeout errors', () => {
  for (const w of ['linked-panel', 'picker']) {
    const html = fs.readFileSync(`gh-links-app/widgets/${w}/index.html`, 'utf8');
    assert.ok(html.includes('<svg'), w + ' has no icons');
    assert.ok(/timed out/i.test(html), w + ' has no friendly timeout message');
  }
  const backend = fs.readFileSync('gh-links-app/backend-global.js', 'utf8');
  assert.ok(backend.includes('per_page'), 'search should bound page size to reduce timeout risk');
});
test('widgets respect OS theme (no hardcoded light surfaces)', () => {
  for (const w of widgets) {
    const html = fs.readFileSync(`gh-links-app/widgets/${w}/index.html`, 'utf8');
    assert.ok(html.includes('prefers-color-scheme'), w + ' has no dark-mode rules');
    assert.ok(!/background:\s*#fff/i.test(html), w + ' hardcodes a white background');
  }
});
test('panel offers per-type search tabs (issues, prs, commits) and sends the type', () => {
  const html = fs.readFileSync('gh-links-app/widgets/linked-panel/index.html', 'utf8');
  for (const t of ['data-t="issue"', 'data-t="pr"', 'data-t="commit"']) {
    assert.ok(html.includes(t), 'panel missing tab ' + t);
  }
  assert.ok(/query:\{[^}]*type/.test(html), 'panel search must pass the selected type to the backend');
  assert.ok(html.includes('sha'), 'panel must render commit rows (sha), not just issue numbers');
});

test('panel input needs no command prefix (gh/fix prefixes are stripped)', () => {
  const html = fs.readFileSync('gh-links-app/widgets/linked-panel/index.html', 'utf8');
  assert.ok(/gh\|fix/i.test(html) || /gh.*fix.*replace|replace.*gh/i.test(html),
    'panel must strip optional gh/fix prefix before searching');
  assert.ok(!html.includes('placeholder="gh <search>'), 'panel placeholder must not require a gh prefix');
});

test('issue-scope backend/links keeps scope:true from issue widgets', () => {
  for (const w of ['linked-panel', 'picker']) {
    const html = fs.readFileSync(`gh-links-app/widgets/${w}/index.html`, 'utf8');
    assert.ok(html.includes("fetchApp('backend/links', {scope:true"),
      w + ' must call issue-scope backend/links with scope:true');
  }
});
