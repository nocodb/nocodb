import type { GithubAuthIntegration } from '@noco-integrations/github-auth';

export const fetchAssignee = async (
  auth: GithubAuthIntegration,
  config: { repo: string },
) => {
  try {
    const [owner, repo] = config.repo.split('/');

    const assignees = await auth.use(async (octokit) => {
      const response = await octokit.rest.repos.listCollaborators({
        owner,
        repo,
        per_page: 100,
      });
      return response.data;
    });

    return assignees.map((user) => ({
      label: user.login,
      value: user.login,
    }));
  } catch (error) {
    console.error('[GitHub] Error fetching assignees:', error);
    return [];
  }
};
