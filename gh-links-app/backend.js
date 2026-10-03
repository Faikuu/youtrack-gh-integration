const { validateEntry } = require('./lib/gh-format.js');

function readLinks(issue) {
  const raw = (issue && issue.extensionProperties && issue.extensionProperties.ghLinks) || '';
  try {
    const links = raw ? JSON.parse(raw) : [];
    return Array.isArray(links) ? links : [];
  } catch (e) { return []; }
}

exports.httpHandler = {
  endpoints: [
    { scope: 'issue', method: 'GET', path: 'links', permissions: ['READ_ISSUE'], handle: function (ctx) {
      ctx.response.json({ links: readLinks(ctx.issue) });
    } },
    { scope: 'issue', method: 'POST', path: 'links', permissions: ['UPDATE_ISSUE'], handle: function (ctx) {
      const entry = ctx.request.json();
      if (!validateEntry(entry)) { ctx.response.code = 400; ctx.response.json({ error: 'invalid entry' }); return; }
      let links = readLinks(ctx.issue);
      if (!Array.isArray(links)) links = [];
      if (!links.some(function (x) { return x && x.url === entry.url; })) {
        links.push(entry);
        ctx.issue.extensionProperties.ghLinks = JSON.stringify(links);
        ctx.issue.addComment('Linked GitHub ' + entry.kind + ' ' + entry.url + (entry.title ? ' — ' + entry.title : ''));
      }
      ctx.response.json({ links: links });
    } },
    { scope: 'issue', method: 'DELETE', path: 'links', permissions: ['UPDATE_ISSUE'], handle: function (ctx) {
      const url = ctx.request.getParameter('url') || '';
      let links = readLinks(ctx.issue);
      if (!Array.isArray(links)) links = [];
      const next = links.filter(function (x) { return x && x.url !== url; });
      if (next.length === links.length) { ctx.response.json({ links: links }); return; }
      ctx.issue.extensionProperties.ghLinks = JSON.stringify(next);
      ctx.issue.addComment('Unlinked GitHub ' + url);
      ctx.response.json({ links: next });
    } }
  ]
};
