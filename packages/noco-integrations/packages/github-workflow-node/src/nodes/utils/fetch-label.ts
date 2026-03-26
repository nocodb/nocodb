import type { GithubAuthIntegration } from '@noco-integrations/github-auth';

export const fetchLabel = async (
  auth: GithubAuthIntegration,
  config: { repo: string },
) => {
  try {
    const [owner, repo] = config.repo.split('/');

    const labels = await auth.use(async (octokit) => {
      const response = await octokit.rest.issues.listLabelsForRepo({
        owner,
        repo,
        per_page: 100,
      });
      return response.data;
    });

    return labels.map((label) => ({
      label: label.name,
      value: label.name,
    }));
  } catch (error) {
    console.error('[GitHub] Error fetching labels:', error);
    return [];
  }
};
