// gh-links-app/lib/gh-links.js
function parseLinks(raw) {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter(e => e && typeof e.url === 'string');
  } catch { return []; }
}
function serializeLinks(arr) { return JSON.stringify(arr || []); }
function addLink(arr, entry) {
  const list = Array.isArray(arr) ? arr.slice() : [];
  if (!entry || !entry.url) return list;
  if (list.some(e => e.url === entry.url)) return list;
  list.push(entry);
  return list;
}
function removeLink(arr, url) { return (Array.isArray(arr) ? arr : []).filter(e => e.url !== url); }
function extractIssueIds(text) {
  if (!text) return [];
  const out = [];
  const re = /\b([A-Z][A-Z0-9]+-\d+)\b/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const id = m[1].toUpperCase();
    if (!out.includes(id)) out.push(id);
  }
  return out;
}
function buildSearchQuery(text, repo) {
  const q = String(text || '').trim();
  return repo ? `${q} repo:${repo}` : q;
}
// Direct references bypass text search: '#123' / '123' (issue or PR number),
// 'o/r#123' / 'r#123', full GitHub URLs, or a 7–40 char commit hash.
// Returns {kind:'number'|'commit', owner, repo, number?, sha?} or null.
// All-digit strings prefer number (7-digit all-numeric SHAs are vanishingly rare).
function parseDirectRef(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  let m = t.match(/^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/(pull|issues)\/(\d+)(?:\/|\?.*)?$/i);
  if (m) return { kind: 'number', owner: m[1], repo: m[2], number: Number(m[4]) };
  m = t.match(/^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/commit\/([0-9a-f]{7,40})(?:\/|\?.*)?$/i);
  if (m) return { kind: 'commit', owner: m[1], repo: m[2], sha: m[3] };
  m = t.match(/^(?:([\w.-]+)\/)?([\w.-]+)#(\d+)$/);
  if (m) return { kind: 'number', owner: m[1] || null, repo: m[2], number: Number(m[3]) };
  m = t.match(/^#?(\d+)$/);
  if (m) return { kind: 'number', owner: null, repo: null, number: Number(m[1]) };
  m = t.match(/^[0-9a-f]{7,40}$/i);
  if (m && !/^\d+$/.test(t)) return { kind: 'commit', owner: null, repo: null, sha: t.toLowerCase() };
  return null;
}
// GitHub's /search/issues endpoint rejects queries without a type qualifier
// (422 "Query must include 'is:issue' or 'is:pull-request'"). Commits use the
// separate /search/commits endpoint and must NOT get the qualifier.
function buildIssuesQuery(text, repo, kind) {
  let q = String(text || '').trim();
  if (!/\bis:(issue|pr|pull-request)\b/i.test(q)) {
    q = (q ? q + ' ' : '') + (kind === 'pr' ? 'is:pr' : 'is:issue');
  }
  if (repo) q += ' repo:' + repo;
  return q;
}
// allowedRepos setting: comma-separated list. Entries with a slash are repos
// (`acme/web` → `repo:acme/web`); bare names or `org:`-prefixed entries are
// orgs (`acme` or `org:acme` → `org:acme`). Blank = unscoped (all of GitHub).
function parseAllowlist(raw) {
  return String(raw || '').split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(e => e.toLowerCase().startsWith('org:') ? 'org:' + e.slice(4).trim() : (e.includes('/') ? 'repo:' + e : 'org:' + e))
    .filter(q => q !== 'org:' && q !== 'repo:');
}
module.exports = { parseLinks, serializeLinks, addLink, removeLink, extractIssueIds, buildSearchQuery, buildIssuesQuery, parseAllowlist, parseDirectRef };
