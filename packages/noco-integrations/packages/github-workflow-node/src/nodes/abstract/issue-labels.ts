import {
  NocoSDK,
  WorkflowNodeIntegration,
} from '@noco-integrations/core';
import type { WorkflowNodeConfig } from '@noco-integrations/core';
import type { GithubAuthIntegration } from '@noco-integrations/github-auth';

/**
 * Base configuration interface for GitHub issue label action nodes
 * Concrete nodes should extend this with their specific label field(s)
 */
export interface GitHubIssueLabelBaseConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  repo: string;
  issueNumber: string;
}

/**
 * Abstract base class for GitHub issue label action nodes
 * Provides common functionality for fetching repositories and labels,
 * and standardized output variable definitions
 */
export abstract class GitHubIssueLabelActionNode<
  TConfig extends GitHubIssueLabelBaseConfig,
> extends WorkflowNodeIntegration<TConfig> {
  /**
   * Fetch options for dropdown fields in the node configuration form
   * Handles fetching repositories and labels from GitHub
   */
  public async fetchOptions(key: string): Promise<unknown> {
    const authIntegrationId = this.config.authIntegrationId;

    if (!authIntegrationId) {
      return [];
    }

    const auth =
      await this.getIntegration<GithubAuthIntegration>(authIntegrationId);

    switch (key) {
      case 'repos': {
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
      }

      case 'labels': {
        if (!this.config.repo) return [];

        try {
          const [owner, repo] = this.config.repo.split('/');

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
      }

      default:
        return [];
    }
  }

  /**
   * Generate standardized output variables for label action nodes
   * All label operations return success status and updated labels array
   */
  public async generateOutputVariables(): Promise<
    NocoSDK.VariableDefinition[]
  > {
    return [
      {
        key: 'success',
        type: NocoSDK.VariableType.Boolean,
        name: 'Success',
        extra: {
          icon: 'cellCheckbox',
          description: 'Whether the label operation was successful',
        },
      },
      {
        key: 'labels',
        type: NocoSDK.VariableType.Array,
        name: 'Labels',
        isArray: true,
        extra: {
          icon: 'ncTag',
          description: 'Updated list of labels on the issue',
          itemSchema: [
            {
              key: 'name',
              type: NocoSDK.VariableType.String,
              name: 'Name',
            },
            {
              key: 'color',
              type: NocoSDK.VariableType.String,
              name: 'Color',
            },
            {
              key: 'description',
              type: NocoSDK.VariableType.String,
              name: 'Description',
            },
          ],
        },
      },
    ];
  }
}
