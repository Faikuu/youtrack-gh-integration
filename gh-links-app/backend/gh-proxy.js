const http = require('@jetbrains/youtrack-scripting-api/http');
const { mapIssueItem, mapCommitItem } = require('../lib/gh-format.js');
const { buildSearchQuery } = require('../lib/gh-links.js');

function repoFor(item, repoParam) {
  if (repoParam) return repoParam;
  const parts = String(item.repository_url || '').split('/');
  return parts.slice(-2).join('/');
}

exports.httpHandler = {
  endpoints: [
    { scope: 'global', method: 'GET', path: 'search', permissions: ['READ_ISSUE'], handle: function (ctx) {
      const q = ctx.request.getParameter('q') || '';
      const type = ctx.request.getParameter('type') || 'issue';
      const repo = ctx.request.getParameter('repo') || '';
      if (!ctx.settings.githubToken) { ctx.response.code = 400; ctx.response.json({ error: 'githubToken not configured' }); return; }
      if (q.length < 2) { ctx.response.json({ items: [] }); return; }
      const conn = new http.Connection('https://api.github.com');
      conn.bearerAuth(ctx.settings.githubToken);
      conn.addHeader('Accept', 'application/vnd.github+json');
      conn.addHeader('X-GitHub-Api-Version', '2022-11-28');
      const query = buildSearchQuery(q, repo);
      let path = '/search/issues?q=' + encodeURIComponent(query);
      if (type === 'commit') path = '/search/commits?q=' + encodeURIComponent(query);
      const res = conn.getSync(path, {});
      if (!res || !res.isSuccess) { ctx.response.code = 502; ctx.response.json({ error: 'github search failed' }); return; }
      const rawItems = (res.json() && res.json().items) || [];
      const items = type === 'commit'
        ? rawItems.map(it => mapCommitItem(it, repoFor(it, repo)))
        : rawItems.map(it => mapIssueItem(it, repoFor(it, repo)));
      ctx.response.json({ items });
    } }
  ]
};
