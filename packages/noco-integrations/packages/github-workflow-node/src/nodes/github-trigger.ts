import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  IntegrationType,
  TriggerActivationType,
  WorkflowNodeCategory,
  WorkflowNodeIntegration,
} from '@noco-integrations/core';
import type { GithubAuthIntegration } from '@noco-integrations/github-auth';
import type {
  FormDefinition,
  WorkflowActivationContext,
  WorkflowActivationState,
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeLog,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';

interface GitHubTriggerConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  repo: string; // Format: "owner/repository"
  events: string[];
}

export class GitHubTriggerNode extends WorkflowNodeIntegration<GitHubTriggerConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [
      {
        type: FormBuilderInputType.SelectIntegration,
        label: 'GitHub Account',
        span: 24,
        model: 'config.authIntegrationId',
        placeholder: 'Select GitHub account',
        integrationFilter: { type: IntegrationType.Auth, sub_type: 'github' },
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'GitHub account is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Repository',
        span: 24,
        model: 'config.repo',
        placeholder: 'Select repository',
        fetchOptionsKey: 'repos',
        dependsOn: 'config.authIntegrationId',
        options: [],
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Repository is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Events',
        span: 24,
        model: 'config.events',
        placeholder: 'Select events to trigger on',
        selectMode: 'multiple',
        options: [
          { label: 'Push', value: 'push' },
          { label: 'Pull Request', value: 'pull_request' },
          { label: 'Issues', value: 'issues' },
          { label: 'Issue Comment', value: 'issue_comment' },
          { label: 'Release', value: 'release' },
          { label: 'Star', value: 'star' },
          { label: 'Fork', value: 'fork' },
          { label: 'Watch', value: 'watch' },
        ],
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'At least one event is required',
          },
        ],
      },
    ];

    return {
      id: 'github.trigger',
      title: 'GitHub Webhook',
      description: 'Triggers when a GitHub event occurs in a repository',
      icon: 'ncGithub',
      hidden: true,
      category: WorkflowNodeCategory.TRIGGER,
      activationType: TriggerActivationType.WEBHOOK,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      keywords: ['trigger', 'github', 'webhook', 'repository', 'event'],
    };
  }

  /**
   * Called when workflow is published - creates GitHub webhook
   */
  public async onActivateHook(
    context: WorkflowActivationContext,
  ): Promise<WorkflowActivationState> {
    const auth = await this.getIntegration<GithubAuthIntegration>(
      this.config.authIntegrationId,
    );

    return await auth.use(async (octokit) => {
      const [owner, repo] = this.config.repo.split('/');
      const { events } = this.config;

      const response = await octokit.rest.repos.createWebhook({
        owner,
        repo,
        config: {
          url: context.webhookUrl,
          content_type: 'json',
          insecure_ssl: '0',
        },
        events: events?.length ? events : ['push'],
        active: true,
      });

      return {
        webhookId: response.data.id,
        webhookUrl: response.data.url,
        createdAt: new Date().toISOString(),
      };
    });
  }

  /**
   * Called when workflow is unpublished - deletes GitHub webhook
   */
  public async onDeactivateHook(
    context: WorkflowActivationContext,
    state?: WorkflowActivationState,
  ): Promise<void> {
    if (!state?.webhookId) return;

    const auth = await this.getIntegration<GithubAuthIntegration>(
      this.config.authIntegrationId,
    );

    await auth.use(async (octokit) => {
      const [owner, repo] = this.config.repo.split('/');

      await octokit.rest.repos.deleteWebhook({
        owner,
        repo,
        hook_id: Number(state.webhookId),
      });
    });
  }

  public async validate(config: GitHubTriggerConfig) {
    const errors: { path?: string; message: string }[] = [];

    if (!config.authIntegrationId) {
      errors.push({
        path: 'config.authIntegrationId',
        message: 'GitHub account is required',
      });
    }

    if (!config.repo) {
      errors.push({
        path: 'config.repo',
        message: 'Repository is required',
      });
    }

    if (!config.events || config.events.length === 0) {
      errors.push({
        path: 'config.events',
        message: 'At least one event is required',
      });
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Fetch repositories where user has admin/write access (needed for webhooks)
   */
  public async fetchOptions(key: string): Promise<unknown> {
    if (key === 'repos') {
      try {
        const auth = await this.getIntegration<GithubAuthIntegration>(
          this.config.authIntegrationId,
        );

        const options: { label: string; value: string }[] = [];

        // Fetch user's repositories with admin/write permissions
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
            // Only include repos where user has admin or write access (needed for webhooks)
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
        console.error('[GitHub Trigger] Error fetching repositories:', error);
        return [];
      }
    }

    return [];
  }

  public async run(ctx: WorkflowNodeRunContext): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      // In test mode, return sample payload
      if (ctx.testMode) {
        const [owner, repo] = this.config.repo?.split('/') || [
          'user',
          'sample-repo',
        ];

        const samplePayload = {
          repository: {
            id: 123456789,
            name: repo,
            full_name: this.config.repo || 'user/sample-repo',
            owner: {
              login: owner,
              id: 1234567,
            },
          },
          sender: {
            login: 'testuser',
            id: 1234567,
          },
          event: this.config.events?.[0] || 'push',
        };

        logs.push({
          level: 'info',
          message: 'Using sample GitHub webhook payload for testing',
          ts: Date.now(),
        });

        return {
          outputs: {
            event: samplePayload.event,
            repository: samplePayload.repository,
            sender: samplePayload.sender,
            payload: samplePayload,
          },
          status: 'success',
          logs,
          metrics: {
            executionTimeMs: Date.now() - startTime,
          },
        };
      }

      const inputs = ctx.inputs as any;

      const webhookPayload = inputs.webhook?.body || {};
      const headers = inputs.webhook?.headers || {};

      // Extract GitHub event type from X-GitHub-Event header
      const githubEvent =
        headers['x-github-event'] || headers['X-GitHub-Event'];

      logs.push({
        level: 'info',
        message: `GitHub webhook triggered: ${githubEvent || webhookPayload.action || 'event'}`,
        ts: Date.now(),
        data: {
          event: githubEvent,
          action: webhookPayload.action,
          repository: webhookPayload.repository?.full_name,
        },
      });

      return {
        outputs: {
          event: githubEvent || 'unknown',
          action: webhookPayload.action,
          repository: webhookPayload.repository,
          sender: webhookPayload.sender,
          payload: webhookPayload,
          headers: headers,
        },
        status: 'success',
        logs,
        metrics: {
          executionTimeMs: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      logs.push({
        level: 'error',
        message: `GitHub trigger failed: ${error.message}`,
        ts: Date.now(),
        data: error.stack,
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || 'GitHub trigger failed',
          code: error.code,
        },
        logs,
        metrics: {
          executionTimeMs: Date.now() - startTime,
        },
      };
    }
  }
}
