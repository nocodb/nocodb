import type { GithubAuthIntegration } from '@noco-integrations/github-auth';

export const fetchRepo = async (auth: GithubAuthIntegration) => {
  try {
    const options: { label: string; value: string }[] = [];

    const reposIterator = await auth.use(async (octokit) => {
      return octokit.paginate.iterator(
        octokit.rest.repos.listForAuthenticatedUser,
        {
          per_page: 100,
          sort: 'updated',
          direction: 'desc',
        },
      );
    });

    for await (const { data: repos } of reposIterator) {
      for (const repo of repos) {
        if (
          repo.permissions?.admin ||
          repo.permissions?.maintain ||
          repo.permissions?.push
        ) {
          options.push({
            label: `${repo.owner.login}/${repo.name}`,
            value: `${repo.owner.login}/${repo.name}`,
          });
        }
      }
    }

    return options;
  } catch (error) {
    console.error('[GitHub] Error fetching repositories:', error);
    return [];
  }
};
