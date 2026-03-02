import { GithubAuthIntegration } from "@noco-integrations/github-auth";

export const fetchMilestone = async (auth: GithubAuthIntegration, config: { repo: string }) => {
  try {
    const [owner, repo] = config.repo.split('/');

    const milestones = await auth.use(async (octokit) => {
      const response = await octokit.rest.issues.listMilestones({
        owner,
        repo,
        state: 'open',
        per_page: 100,
      });
      return response.data;
    });

    return milestones.map((milestone) => ({
      label: milestone.title,
      value: milestone.number,
    }));
  } catch (error) {
    console.error('[GitHub] Error fetching milestones:', error);
    return [];
  }
}
