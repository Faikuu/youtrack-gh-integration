// tests/webhook-shape.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extractIssueIds } = require('../gh-links-app/gh-links.js');
test('webhook text extraction covers PR title+body', () => {
  const ids = extractIssueIds('[DEMO-1] feat\nFixes DEMO-2, relates DEMO-1');
  assert.deepEqual(ids.sort(), ['DEMO-1', 'DEMO-2']);
});
test('webhook text extraction matches lowercase issue keys', () => {
  const ids = extractIssueIds('fixes demo-3 in this push');
  assert.deepEqual(ids.sort(), ['DEMO-3']);
});
