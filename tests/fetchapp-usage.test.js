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
