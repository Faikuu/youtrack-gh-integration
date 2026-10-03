// tests/gh-links.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseLinks, serializeLinks, addLink, removeLink, extractIssueIds, buildIssuesQuery } = require('../gh-links-app/gh-links.js');

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

test('buildIssuesQuery appends required is:issue / is:pr qualifier', () => {
  assert.equal(buildIssuesQuery('login bug', '', 'issue'), 'login bug is:issue');
  assert.equal(buildIssuesQuery('login bug', '', 'pr'), 'login bug is:pr');
  assert.equal(buildIssuesQuery('', '', 'issue'), 'is:issue');
});

test('buildIssuesQuery preserves a user-supplied qualifier and appends repo', () => {
  assert.equal(buildIssuesQuery('is:pr fix crash', '', 'issue'), 'is:pr fix crash');
  assert.equal(buildIssuesQuery('crash', 'o/r', 'issue'), 'crash is:issue repo:o/r');
});

test('parseAllowlist maps entries to repo:/org: qualifiers', () => {
  const { parseAllowlist } = require('../gh-links-app/gh-links.js');
  assert.deepEqual(parseAllowlist('acme/web, acme/api'), ['repo:acme/web', 'repo:acme/api']);
  assert.deepEqual(parseAllowlist('org:acme'), ['org:acme']);
  assert.deepEqual(parseAllowlist('acme'), ['org:acme']);
  assert.deepEqual(parseAllowlist(''), []);
  assert.deepEqual(parseAllowlist(' , acme/web ,, '), ['repo:acme/web']);
});

test('parseDirectRef recognizes numbers, hashes, repo-qualified refs and URLs', () => {
  const { parseDirectRef } = require('../gh-links-app/gh-links.js');
  assert.deepEqual(parseDirectRef('#123'), { kind: 'number', owner: null, repo: null, number: 123 });
  assert.deepEqual(parseDirectRef('123'), { kind: 'number', owner: null, repo: null, number: 123 });
  assert.deepEqual(parseDirectRef('o/r#12'), { kind: 'number', owner: 'o', repo: 'r', number: 12 });
  assert.deepEqual(parseDirectRef('r#12'), { kind: 'number', owner: null, repo: 'r', number: 12 });
  assert.deepEqual(parseDirectRef('abc1234'), { kind: 'commit', owner: null, repo: null, sha: 'abc1234' });
  assert.deepEqual(parseDirectRef('https://github.com/o/r/pull/5'), { kind: 'number', owner: 'o', repo: 'r', number: 5 });
  assert.deepEqual(parseDirectRef('https://github.com/o/r/issues/6'), { kind: 'number', owner: 'o', repo: 'r', number: 6 });
  assert.deepEqual(parseDirectRef('https://github.com/o/r/commit/abc1234def'), { kind: 'commit', owner: 'o', repo: 'r', sha: 'abc1234def' });
  assert.equal(parseDirectRef('feat'), null);
  assert.equal(parseDirectRef(''), null);
});
