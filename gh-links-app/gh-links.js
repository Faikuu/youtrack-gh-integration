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
module.exports = { parseLinks, serializeLinks, addLink, removeLink, extractIssueIds, buildSearchQuery };
