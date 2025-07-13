export function normalizeRepo(repo: string): string {
  if (!repo) return repo;
  repo = repo.trim().replace(/\.git$/, '');
  if (repo.startsWith('http://') || repo.startsWith('https://')) {
    try {
      const url = new URL(repo);
      if (url.hostname.endsWith('github.com')) {
        const parts = url.pathname.replace(/^\//, '').split('/');
        if (parts.length >= 2) {
          return `${parts[0]}/${parts[1]}`;
        }
      }
    } catch {
      // fall through
    }
  } else if (repo.startsWith('git@github.com:')) {
    repo = repo.substring('git@github.com:'.length);
  }
  return repo;
}
