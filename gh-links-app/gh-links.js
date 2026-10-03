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
module.exports = { parseLinks, serializeLinks, addLink, removeLink, extractIssueIds, buildSearchQuery, buildIssuesQuery, parseAllowlist };
