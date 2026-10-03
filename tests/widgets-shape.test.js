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
