import { GithubAuthIntegration } from "@noco-integrations/github-auth";

export const fetchBranches = async (
  auth: GithubAuthIntegration,
  config: { repo: string }
) => {
  try {
    const [owner, repo] = config.repo.split('/');

    const branches = await auth.use(async (octokit) => {
      const response = await octokit.rest.repos.listBranches({
        owner,
        repo,
        per_page: 100,
      });
      return response.data;
    });

    return branches.map((branch) => ({
      label: branch.name,
      value: branch.name,
    }));
  } catch (error) {
    console.error('[GitHub] Error fetching branches:', error);
    return [];
  }
}
