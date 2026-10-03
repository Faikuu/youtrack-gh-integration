const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const APP = 'gh-links-app';

test('backend relative requires resolve to root-level sibling modules only', () => {
  const handlers = fs.readdirSync(APP).filter(f => f.endsWith('.js'));
  assert.ok(handlers.includes('backend.js'), 'backend.js missing at root');
  assert.ok(handlers.includes('backend-global.js'), 'backend-global.js missing at root');
  for (const h of handlers) {
    const src = fs.readFileSync(path.join(APP, h), 'utf8');
    for (const m of src.matchAll(/require\('(\.[^']*)'\)/g)) {
      const target = m[1];
      const rel = target.replace(/^\.\//, '');
      assert.ok(!rel.includes('/'), `${h}: backend require '${target}' must be a root-level sibling (subdirs are not registered as scripts)`);
      const disk = path.join(APP, rel);
      assert.ok(fs.existsSync(disk), `${h}: required module '${target}' does not exist at ${disk}`);
    }
  }
});

test('no backend js lives in subdirectories (importer only registers root-level files)', () => {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
  const stray = walk(APP).filter(p => p.endsWith('.js') && path.dirname(p) !== APP && !p.includes('widgets'));
  assert.deepEqual(stray, [], `backend js outside package root: ${stray.join(', ')}`);
});
