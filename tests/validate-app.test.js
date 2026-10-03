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

test('settings and entity extensions match handler contract', () => {
  const s = JSON.parse(fs.readFileSync('gh-links-app/settings.json', 'utf8'));
  assert.equal(s.properties.githubToken.format, 'secret');
  assert.equal(s.properties.webhookToken.format, 'secret');
  assert.equal(s.properties.allowCommands.type, 'boolean');
  const e = JSON.parse(fs.readFileSync('gh-links-app/entity-extensions.json', 'utf8'));
  const issue = e.entityTypeExtensions.find(x => x.entityType === 'Issue');
  assert.equal(issue.properties.ghLinks.type, 'string');
});
