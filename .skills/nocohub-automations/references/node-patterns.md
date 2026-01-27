# Workflow Node Patterns

Complete code patterns for different node types.

## Table of Contents
1. [Action Node (Basic)](#action-node-basic)
2. [Trigger Node (Webhook)](#trigger-node-webhook)
3. [Trigger Node (Polling/Schedule)](#trigger-node-pollingschedule)
4. [Auth Integration (OAuth)](#auth-integration-oauth)
5. [Auth Integration (API Key)](#auth-integration-api-key)

## Action Node (Basic)

Complete example of an action node that calls an external API.

```typescript
import {
  IntegrationType,
  WorkflowNodeCategory,
  WorkflowNodeIntegration,
  FormBuilderInputType,
  FormBuilderValidatorType,
} from '@noco-integrations/core';
import type { ProviderAuthIntegration } from '@noco-integrations/provider-auth';
import type {
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
  FormDefinition,
  WorkflowNodeLog,
} from '@noco-integrations/core';

// 1. Define config interface
interface CreateItemNodeConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  projectId: string;
  title: string;
  description?: string;
  assigneeId?: string;
}

// 2. Implement the node class
export class CreateItemNode extends WorkflowNodeIntegration<CreateItemNodeConfig> {

  // 3. Define node metadata and form
  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [
      {
        type: FormBuilderInputType.SelectIntegration,
        label: 'Account',
        model: 'config.authIntegrationId',
        integrationFilter: { type: IntegrationType.Auth, sub_type: 'provider' },
        validators: [{ type: FormBuilderValidatorType.Required, message: 'Account is required' }],
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Project',
        model: 'config.projectId',
        fetchOptionsKey: 'projects',
        dependsOn: 'config.authIntegrationId',
        validators: [{ type: FormBuilderValidatorType.Required, message: 'Project is required' }],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Title',
        model: 'config.title',
        placeholder: 'Enter item title',
        validators: [{ type: FormBuilderValidatorType.Required, message: 'Title is required' }],
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Description',
        model: 'config.description',
        plugins: ['multiline'],
        placeholder: 'Enter description (optional)',
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Assignee',
        model: 'config.assigneeId',
        fetchOptionsKey: 'users',
        dependsOn: 'config.authIntegrationId',
        placeholder: 'Select assignee (optional)',
      },
    ];

    return {
      id: 'provider.create_item',
      title: 'Create Item',
      description: 'Create a new item in Provider',
      icon: 'ncProvider',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      documentation: 'https://nocodb.com/docs/workflows/nodes/provider',
      keywords: ['provider', 'create', 'item', 'task'],
    };
  }

  // 4. Implement dynamic option fetching
  public async fetchOptions(key: string): Promise<unknown> {
    if (!this.config.authIntegrationId) return [];

    const auth = await this.getIntegration<ProviderAuthIntegration>(
      this.config.authIntegrationId
    );

    switch (key) {
      case 'projects':
        return auth.use(async (client) => {
          const projects = await client.projects.list();
          return projects.map(p => ({ label: p.name, value: p.id }));
        });

      case 'users':
        return auth.use(async (client) => {
          const users = await client.users.list();
          return users.map(u => ({
            label: u.displayName || u.email,
            value: u.id,
          }));
        });

      default:
        return [];
    }
  }

  // 5. Implement the run method
  public async run(ctx: WorkflowNodeRunContext): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    const logs: WorkflowNodeLog[] = [];
    const config = ctx.inputs?.config || {};

    try {
      // Validate required fields
      if (!config.authIntegrationId) {
        return this.errorResult('Account is required', 'MISSING_AUTH', startTime, logs);
      }

      if (!config.projectId) {
        return this.errorResult('Project is required', 'MISSING_PROJECT', startTime, logs);
      }

      if (!config.title) {
        return this.errorResult('Title is required', 'MISSING_TITLE', startTime, logs);
      }

      // Load auth integration
      const auth = await this.getIntegration<ProviderAuthIntegration>(
        config.authIntegrationId
      );

      logs.push({
        level: 'info',
        message: `Creating item in project ${config.projectId}`,
        ts: Date.now(),
      });

      // Execute API call
      const result = await auth.use(async (client) => {
        return client.items.create({
          projectId: config.projectId,
          title: config.title,
          description: config.description,
          assigneeId: config.assigneeId,
        });
      });

      logs.push({
        level: 'info',
        message: `Item created: ${result.id}`,
        ts: Date.now(),
        data: { itemId: result.id },
      });

      return {
        outputs: {
          success: true,
          itemId: result.id,
          item: result,
        },
        status: 'success',
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };

    } catch (error: any) {
      return this.errorResult(error.message, error.code, startTime, logs, error.data);
    }
  }

  // Helper for error results
  private errorResult(
    message: string,
    code: string,
    startTime: number,
    logs: WorkflowNodeLog[],
    data?: any
  ): WorkflowNodeResult {
    logs.push({ level: 'error', message, ts: Date.now(), data });
    return {
      outputs: { success: false },
      status: 'error',
      error: { message, code, data },
      logs,
      metrics: { executionTimeMs: Date.now() - startTime },
    };
  }
}
```

## Trigger Node (Webhook)

Complete webhook trigger that registers external webhooks.

```typescript
import {
  IntegrationType,
  WorkflowNodeCategory,
  TriggerActivationType,
  WorkflowNodeIntegration,
  FormBuilderInputType,
  FormBuilderValidatorType,
} from '@noco-integrations/core';
import type { ProviderAuthIntegration } from '@noco-integrations/provider-auth';
import type {
  WorkflowActivationContext,
  WorkflowActivationState,
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
  WorkflowNodeLog,
  FormDefinition,
} from '@noco-integrations/core';

interface ProviderTriggerConfig extends WorkflowNodeConfig {
  authIntegrationId: string;
  projectId: string;
  events: string[];
}

export class ProviderTriggerNode extends WorkflowNodeIntegration<ProviderTriggerConfig> {

  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [
      {
        type: FormBuilderInputType.SelectIntegration,
        label: 'Account',
        model: 'config.authIntegrationId',
        integrationFilter: { type: IntegrationType.Auth, sub_type: 'provider' },
        validators: [{ type: FormBuilderValidatorType.Required, message: 'Required' }],
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Project',
        model: 'config.projectId',
        fetchOptionsKey: 'projects',
        dependsOn: 'config.authIntegrationId',
        validators: [{ type: FormBuilderValidatorType.Required, message: 'Required' }],
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Events',
        model: 'config.events',
        selectMode: 'multiple',
        options: [
          { label: 'Item Created', value: 'item.created' },
          { label: 'Item Updated', value: 'item.updated' },
          { label: 'Item Deleted', value: 'item.deleted' },
          { label: 'Comment Added', value: 'comment.created' },
        ],
        validators: [{ type: FormBuilderValidatorType.Required, message: 'Select at least one' }],
      },
    ];

    return {
      id: 'provider.trigger',
      title: 'Provider Event',
      description: 'Triggers when an event occurs in Provider',
      icon: 'ncProvider',
      category: WorkflowNodeCategory.TRIGGER,
      activationType: TriggerActivationType.WEBHOOK,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      keywords: ['trigger', 'provider', 'webhook', 'event'],
    };
  }

  /**
   * Called when workflow is published/enabled.
   * Create webhook in external service.
   */
  public async onActivateHook(
    context: WorkflowActivationContext
  ): Promise<WorkflowActivationState> {
    const auth = await this.getIntegration<ProviderAuthIntegration>(
      this.config.authIntegrationId
    );

    return await auth.use(async (client) => {
      // Register webhook with external service
      const webhook = await client.webhooks.create({
        url: context.webhookUrl,  // NocoDB provides this callback URL
        projectId: this.config.projectId,
        events: this.config.events,
        secret: this.generateSecret(),  // Optional: for signature verification
      });

      // Return state that will be passed to onDeactivateHook
      return {
        webhookId: webhook.id,
        webhookUrl: webhook.url,
        secret: webhook.secret,
        createdAt: new Date().toISOString(),
      };
    });
  }

  /**
   * Called when workflow is unpublished/disabled.
   * Cleanup webhook from external service.
   */
  public async onDeactivateHook(
    context: WorkflowActivationContext,
    state?: WorkflowActivationState
  ): Promise<void> {
    if (!state?.webhookId) return;

    const auth = await this.getIntegration<ProviderAuthIntegration>(
      this.config.authIntegrationId
    );

    await auth.use(async (client) => {
      try {
        await client.webhooks.delete(state.webhookId);
      } catch (error: any) {
        // Log but don't throw - webhook may already be deleted
        console.warn(`Failed to delete webhook ${state.webhookId}:`, error.message);
      }
    });
  }

  /**
   * Optional: Verify webhook is still active.
   * Called periodically to ensure external webhook is healthy.
   */
  public async heartbeat(
    context: WorkflowActivationContext,
    state?: WorkflowActivationState
  ): Promise<WorkflowActivationState> {
    if (!state?.webhookId) {
      // Re-create webhook if state is missing
      return this.onActivateHook(context);
    }

    const auth = await this.getIntegration<ProviderAuthIntegration>(
      this.config.authIntegrationId
    );

    const isValid = await auth.use(async (client) => {
      try {
        const webhook = await client.webhooks.get(state.webhookId);
        return webhook && webhook.active;
      } catch {
        return false;
      }
    });

    if (!isValid) {
      // Re-create webhook if it was deleted
      await this.onDeactivateHook(context, state);
      return this.onActivateHook(context);
    }

    return state;
  }

  public async validate(config: ProviderTriggerConfig) {
    const errors: { path?: string; message: string }[] = [];

    if (!config.authIntegrationId) {
      errors.push({ path: 'config.authIntegrationId', message: 'Account is required' });
    }
    if (!config.projectId) {
      errors.push({ path: 'config.projectId', message: 'Project is required' });
    }
    if (!config.events?.length) {
      errors.push({ path: 'config.events', message: 'At least one event is required' });
    }

    return { valid: errors.length === 0, errors };
  }

  public async fetchOptions(key: string): Promise<unknown> {
    if (key === 'projects' && this.config.authIntegrationId) {
      const auth = await this.getIntegration<ProviderAuthIntegration>(
        this.config.authIntegrationId
      );
      return auth.use(async (client) => {
        const projects = await client.projects.list();
        return projects.map(p => ({ label: p.name, value: p.id }));
      });
    }
    return [];
  }

  public async run(ctx: WorkflowNodeRunContext): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    // Test mode: return sample payload
    if (ctx.testMode) {
      const samplePayload = {
        event: this.config.events?.[0] || 'item.created',
        projectId: this.config.projectId || 'proj_sample',
        item: {
          id: 'item_sample123',
          title: 'Sample Item',
          createdAt: new Date().toISOString(),
        },
        user: {
          id: 'user_sample',
          email: 'user@example.com',
        },
      };

      logs.push({
        level: 'info',
        message: 'Test mode - using sample payload',
        ts: Date.now(),
      });

      return {
        outputs: samplePayload,
        status: 'success',
        logs,
        metrics: { executionTimeMs: Date.now() - startTime },
      };
    }

    // Real execution: extract webhook payload
    const inputs = ctx.inputs as any;
    const webhookPayload = inputs.webhook?.body || {};
    const headers = inputs.webhook?.headers || {};

    // Optional: Verify webhook signature
    // const signature = headers['x-provider-signature'];
    // if (!this.verifySignature(webhookPayload, signature, state.secret)) {
    //   return { status: 'error', error: { message: 'Invalid signature' } };
    // }

    logs.push({
      level: 'info',
      message: `Received webhook event: ${webhookPayload.event || 'unknown'}`,
      ts: Date.now(),
      data: { event: webhookPayload.event },
    });

    return {
      outputs: {
        event: webhookPayload.event || headers['x-provider-event'],
        payload: webhookPayload,
        headers,
      },
      status: 'success',
      logs,
      metrics: { executionTimeMs: Date.now() - startTime },
    };
  }

  private generateSecret(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }
}
```

## Auth Integration (OAuth)

```typescript
import axios from 'axios';
import { AuthIntegration, AuthType } from '@noco-integrations/core';
import type { TestConnectionResponse } from '@noco-integrations/core';
import { ProviderClient } from 'provider-sdk';

interface ProviderAuthConfig {
  type: AuthType;
  token?: string;           // For API key auth
  oauth_token?: string;     // For OAuth
  refresh_token?: string;   // For OAuth token refresh
}

export class ProviderAuthIntegration extends AuthIntegration<
  ProviderAuthConfig,
  ProviderClient
> {
  public client: ProviderClient | null = null;

  // OAuth configuration
  private static readonly clientId = process.env.PROVIDER_CLIENT_ID;
  private static readonly clientSecret = process.env.PROVIDER_CLIENT_SECRET;
  private static readonly redirectUri = process.env.PROVIDER_REDIRECT_URI;
  private static readonly tokenUri = 'https://api.provider.com/oauth/token';

  public async authenticate(): Promise<ProviderClient> {
    switch (this.config.type) {
      case AuthType.ApiKey:
        if (!this.config.token) {
          throw new Error('API token is required');
        }
        this.client = new ProviderClient({ apiKey: this.config.token });
        return this.client;

      case AuthType.OAuth:
        if (!this.config.oauth_token) {
          throw new Error('OAuth token is required');
        }
        this.client = new ProviderClient({ accessToken: this.config.oauth_token });
        return this.client;

      default:
        throw new Error('Unsupported authentication type');
    }
  }

  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      await this.use(async (client) => {
        await client.users.me();
      });
      return { success: true };
    } catch (error: any) {
      // Handle provider-specific errors
      if (error.code === 'UNAUTHORIZED') {
        return { success: false, message: 'Invalid credentials' };
      }
      if (error.code === 'RATE_LIMITED') {
        return { success: false, message: 'Rate limited - try again later' };
      }
      return {
        success: false,
        message: error.message || 'Connection failed',
      };
    }
  }

  public async exchangeToken(payload: { code: string }): Promise<{
    oauth_token: string;
    refresh_token?: string;
  }> {
    const { code } = payload;

    if (!code) {
      throw new Error('Authorization code is required');
    }

    const response = await axios.post(
      ProviderAuthIntegration.tokenUri,
      new URLSearchParams({
        client_id: ProviderAuthIntegration.clientId!,
        client_secret: ProviderAuthIntegration.clientSecret!,
        code,
        redirect_uri: ProviderAuthIntegration.redirectUri!,
        grant_type: 'authorization_code',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    if (!response.data.access_token) {
      throw new Error('No access token received');
    }

    return {
      oauth_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
    };
  }

  public async refreshToken(payload: { refresh_token: string }): Promise<{
    oauth_token: string;
    refresh_token: string;
    expires_in?: number;
  }> {
    const { refresh_token } = payload;

    if (!refresh_token) {
      throw new Error('Refresh token is required');
    }

    const response = await axios.post(
      ProviderAuthIntegration.tokenUri,
      new URLSearchParams({
        client_id: ProviderAuthIntegration.clientId!,
        client_secret: ProviderAuthIntegration.clientSecret!,
        refresh_token,
        grant_type: 'refresh_token',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    return {
      oauth_token: response.data.access_token,
      refresh_token: response.data.refresh_token || refresh_token,
      expires_in: response.data.expires_in,
    };
  }

  protected shouldRefreshToken(err: any): boolean {
    // Only refresh for OAuth type
    if (this.config.type !== AuthType.OAuth) {
      return false;
    }

    // Need refresh token
    if (!this.config.refresh_token) {
      return false;
    }

    // Check error codes
    const status = err?.response?.status || err?.status;
    const code = err?.code || err?.data?.error;

    return (
      status === 401 ||
      code === 'token_expired' ||
      code === 'invalid_token'
    );
  }

  public async destroy(): Promise<void> {
    this.client = null;
  }
}
```

## Auth Integration (API Key)

Simpler auth for services that only support API keys.

```typescript
import { AuthIntegration, AuthType } from '@noco-integrations/core';
import type { TestConnectionResponse } from '@noco-integrations/core';
import { ProviderClient } from 'provider-sdk';

interface ProviderApiKeyConfig {
  type: AuthType.ApiKey;
  token: string;
}

export class ProviderAuthIntegration extends AuthIntegration<
  ProviderApiKeyConfig,
  ProviderClient
> {
  public client: ProviderClient | null = null;

  public async authenticate(): Promise<ProviderClient> {
    if (!this.config.token) {
      throw new Error('API key is required');
    }

    this.client = new ProviderClient({
      apiKey: this.config.token,
    });

    return this.client;
  }

  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      await this.use(async (client) => {
        await client.account.get();
      });
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Invalid API key',
      };
    }
  }

  // Not needed for API key auth
  public async exchangeToken(): Promise<never> {
    throw new Error('OAuth not supported for API key auth');
  }

  public async refreshToken(): Promise<never> {
    throw new Error('Token refresh not supported for API key auth');
  }

  protected shouldRefreshToken(): boolean {
    return false;  // API keys don't expire
  }

  public async destroy(): Promise<void> {
    this.client = null;
  }
}
```
