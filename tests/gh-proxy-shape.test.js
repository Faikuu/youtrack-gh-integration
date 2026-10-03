// tests/gh-proxy-shape.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mapIssueItem, mapCommitItem } = require('../gh-links-app/gh-format.js');
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
