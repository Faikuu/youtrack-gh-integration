const http = require('@jetbrains/youtrack-scripting-api/http');
const { mapIssueItem, mapCommitItem } = require('./lib/gh-format.js');
const { buildSearchQuery } = require('./lib/gh-links.js');

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
