const http = require('@jetbrains/youtrack-scripting-api/http');
const { mapIssueItem, mapCommitItem } = require('./gh-format.js');
const { buildSearchQuery, buildIssuesQuery, parseAllowlist, parseDirectRef } = require('./gh-links.js');

function getJson(conn, path) {
  try {
    const r = conn.getSync(path, {});
    if (r && r.isSuccess) return r.json();
  } catch (e) { /* 404 etc: not found here */ }
  return null;
}

// Resolve #123 / hashes / GitHub URLs straight to API objects across the
// scoped repos. Returns an array (possibly empty = definitive miss) or null
// when there is nothing to resolve against (fall back to text search).
function lookupDirect(conn, ref, repoParam, allowRaw) {
  const allow = parseAllowlist(allowRaw);
  const cands = [];
  const push = (o, r) => {
    if (!o || !r || cands.length >= 10) return;
    if (!cands.some(c => c.owner.toLowerCase() === String(o).toLowerCase() && c.repo.toLowerCase() === String(r).toLowerCase())) cands.push({ owner: o, repo: r });
  };
  const split = (s) => { const i = String(s).indexOf('/'); return i < 0 ? null : { owner: s.slice(0, i), repo: s.slice(i + 1) }; };
  const listOrgRepos = (org) => {
    const list = getJson(conn, '/orgs/' + encodeURIComponent(org) + '/repos?per_page=100');
    return Array.isArray(list) ? list : [];
  };
  if (ref.owner && ref.repo) push(ref.owner, ref.repo);
  if (repoParam && repoParam.includes('/')) { const s = split(repoParam); if (s) push(s.owner, s.repo); }
  allow.filter(a => a.startsWith('repo:')).forEach(a => { const s = split(a.slice(5)); if (s) push(s.owner, s.repo); });
  const orgs = allow.filter(a => a.startsWith('org:')).map(a => a.slice(4));
  if (ref.repo && !ref.owner) {
    const owners = [...new Set(cands.map(c => c.owner))];
    if (owners.length) owners.forEach(o => push(o, ref.repo));
    else orgs.slice(0, 3).forEach(org => listOrgRepos(org).forEach(r => {
      if (r && r.name && r.full_name && r.name.toLowerCase() === ref.repo.toLowerCase()) {
        const s = split(r.full_name); if (s) push(s.owner, s.repo);
      }
    }));
  }
  if (!ref.owner && !ref.repo && !cands.length) {
    if (!orgs.length) return null;
    orgs.slice(0, 3).forEach(org => listOrgRepos(org).forEach(r => {
      if (r && r.full_name) { const s = split(r.full_name); if (s) push(s.owner, s.repo); }
    }));
  }
  if (!cands.length) return [];
  const items = [];
  cands.forEach(c => {
    if (items.length >= 10) return;
    const base = '/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo);
    if (ref.kind === 'commit') {
      const d = getJson(conn, base + '/commits/' + encodeURIComponent(ref.sha));
      if (d && d.sha) items.push(mapCommitItem(d, c.owner + '/' + c.repo));
    } else {
      const d = getJson(conn, base + '/issues/' + ref.number);
      if (d && d.number) items.push(mapIssueItem(d, c.owner + '/' + c.repo));
    }
  });
  return items;
}

function repoFor(item, repoParam) {
  if (repoParam) return repoParam;
  const parts = String((item && item.repository_url) || '').split('/');
  return parts.slice(-2).join('/') || (item && item.repository && item.repository.full_name) || '';
}

exports.httpHandler = {
  endpoints: [
    { scope: 'global', method: 'GET', path: 'search', permissions: ['READ_ISSUE'], handle: function (ctx) {
      const q = ctx.request.getParameter('q') || '';
      const type = ctx.request.getParameter('type') || 'issue';
      const repo = ctx.request.getParameter('repo') || '';
      if (!ctx.settings.githubToken) { ctx.response.code = 400; ctx.response.json({ error: 'githubToken not configured' }); return; }
      const conn = new http.Connection('https://api.github.com');
      conn.bearerAuth(ctx.settings.githubToken);
      conn.addHeader('Accept', 'application/vnd.github+json');
      conn.addHeader('X-GitHub-Api-Version', '2022-11-28');
      const ref = parseDirectRef(q);
      if (ref) {
        const direct = lookupDirect(conn, ref, repo, ctx.settings.allowedRepos || '');
        if (direct) { ctx.response.json({ items: direct }); return; }
      }
      if (q.length < 2) { ctx.response.json({ items: [] }); return; }
      let query = type === 'commit' ? buildSearchQuery(q, '') : buildIssuesQuery(q, '', type);
      const scopeQuals = repo ? ['repo:' + repo] : parseAllowlist(ctx.settings.allowedRepos || '');
      if (scopeQuals.length) query += ' ' + scopeQuals.join(' ');
      let path = '/search/issues?q=' + encodeURIComponent(query) + '&per_page=10';
      if (type === 'commit') path = '/search/commits?q=' + encodeURIComponent(query) + '&per_page=10';
      const res = conn.getSync(path, {});
      if (!res || !res.isSuccess) { ctx.response.code = 502; ctx.response.json({ error: 'github search failed' }); return; }
      const body = res.json() || {};
      const rawItems = body.items || [];
      const items = type === 'commit'
        ? rawItems.map(it => mapCommitItem(it, repoFor(it, repo)))
        : rawItems.map(it => mapIssueItem(it, repoFor(it, repo)));
      ctx.response.json({ items });
    } },
    { scope: 'global', method: 'POST', path: 'gh-webhook', handle: function (ctx) {
      const token = ctx.request.getParameter('token') || '';
      if (!ctx.settings.webhookToken || token !== ctx.settings.webhookToken) { ctx.response.code = 401; ctx.response.json({ error: 'bad token' }); return; }
      const entities = require('@jetbrains/youtrack-scripting-api/entities');
      const payload = ctx.request.json();
      let text = '';
      if (payload && payload.pull_request) text = (payload.pull_request.title || '') + '\n' + (payload.pull_request.body || '');
      else if (payload && payload.issue) text = (payload.issue.title || '') + '\n' + (payload.issue.body || '');
      else if (payload && Array.isArray(payload.commits)) text = payload.commits.map(function (c) { return String((c && c.message) || ''); }).join('\n');
      const ids = {};
      const re = /\b([A-Z][A-Z0-9]+-\d+)\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) ids[m[1].toUpperCase()] = true;
      const link = (payload && payload.pull_request && payload.pull_request.html_url) || (payload && payload.issue && payload.issue.html_url) || '';
      Object.keys(ids).forEach(function (id) {
        try {
          const issue = entities.Issue.findById(id);
          if (issue) issue.addComment('GitHub activity: ' + link + '\n' + text.slice(0, 500));
        } catch (e) { /* unknown issue: skip */ }
      });
      ctx.response.json({ ok: true });
    } }
  ]
};
