// tests/gh-links.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseLinks, serializeLinks, addLink, removeLink, extractIssueIds } = require('../gh-links-app/gh-links.js');

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
