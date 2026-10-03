function mapIssueItem(it, repo) {
  const isPR = Boolean(it.pull_request) || String(it.html_url || '').includes('/pull/');
  return { kind: isPR ? 'pr' : 'issue', repo, number: it.number, url: it.html_url, title: it.title, state: it.state || it.draft || 'unknown' };
}
function mapCommitItem(it, repo) {
  return { kind: 'commit', repo, sha: it.sha, url: it.html_url, title: String((it.commit && it.commit.message) || '').split('\n')[0], state: 'committed' };
}
module.exports = { mapIssueItem, mapCommitItem };
