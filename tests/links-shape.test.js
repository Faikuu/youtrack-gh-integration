// tests/links-shape.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseLinks, addLink } = require('../gh-links-app/lib/gh-links.js');
test('link entry requires kind/repo/url', () => {
  const { validateEntry } = require('../gh-links-app/lib/gh-format.js');
  assert.equal(validateEntry({ kind: 'bogus', url: 'x' }), false);
  assert.equal(validateEntry({ kind: 'pr', repo: 'o/r', number: 1, url: 'https://github.com/o/r/pull/1', title: 't' }), true);
});
