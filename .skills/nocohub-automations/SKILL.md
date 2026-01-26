---
name: nocohub-automations
description: |
  NocoDB Enterprise automation/workflow node development for SaaS integrations.
  MANDATORY TRIGGERS: automation, workflow, node, trigger, action, integration, SaaS, webhook, Slack, GitHub, Linear, OAuth
  Use when: (1) Creating new workflow automation nodes, (2) Adding SaaS service integrations, (3) Building triggers with webhooks, (4) Creating action nodes, (5) Setting up OAuth authentication integrations, (6) Working with the noco-integrations monorepo
---

# NocoDB Automation Node Development

## Architecture Overview

NocoDB's automation system uses a **modular integration framework** in `packages/noco-integrations/`:

```
packages/noco-integrations/
├── core/src/                    # Base classes & registry
│   ├── workflow-node/types.ts   # WorkflowNodeIntegration base class
│   ├── auth/interface.ts        # AuthIntegration base class
│   └── registry.ts              # IntegrationRegistry singleton
└── packages/                    # 59+ integration packages
    ├── {provider}-auth/         # OAuth/API key integrations
    ├── {provider}-workflow-node/# Workflow action/trigger nodes
    └── {provider}-sync/         # Data sync integrations
```

## Node Types

| Type | Category | Purpose | Example |
|------|----------|---------|---------|
| **Trigger** | `TRIGGER` | Starts workflow on event | GitHub webhook, Cron schedule |
| **Action** | `ACTION` | Performs operation | Slack send message, HTTP request |
| **Flow** | `FLOW` | Controls execution | If/else, Loop, Delay |

## Development Workflows

### Workflow 1: Create Action Node (e.g., Slack Send Message)

1. **Create package structure**
   ```
   packages/noco-integrations/packages/{provider}-workflow-node/
   ├── package.json
   ├── tsconfig.json
   └── src/
       ├── index.ts           # Export IntegrationEntry[]
       ├── manifest.ts        # Package metadata
       └── nodes/
           └── {action}.ts    # Node implementation
   ```

2. **Create package.json**
   ```json
   {
     "name": "@noco-integrations/{provider}-workflow-node",
     "version": "1.0.0",
     "main": "dist/index.js",
     "types": "dist/index.d.ts",
     "scripts": {
       "build": "tsc",
       "clean": "rimraf dist"
     },
     "dependencies": {
       "@noco-integrations/core": "workspace:*"
     },
     "devDependencies": {
       "rimraf": "^5.0.10",
       "typescript": "^5.8.3"
     }
   }
   ```

3. **Create manifest.ts**
   ```typescript
   import type { IntegrationManifest } from '@noco-integrations/core';

   export const manifest: IntegrationManifest = {
     title: '{Provider}',
     icon: '{providerIcon}',
     description: 'Integration with {Provider} service',
     version: '0.1.0',
     author: 'NocoDB',
     website: 'https://github.com/nocodb/nocodb',
     order: 10,
   };
   ```

4. **Implement the action node** (`src/nodes/{action}.ts`)
   ```typescript
   import {
     IntegrationType,
     WorkflowNodeCategory,
     WorkflowNodeIntegration,
     FormBuilderInputType,
     FormBuilderValidatorType,
   } from '@noco-integrations/core';
   import type { {Provider}AuthIntegration } from '@noco-integrations/{provider}-auth';
   import type {
     WorkflowNodeConfig,
     WorkflowNodeDefinition,
     WorkflowNodeResult,
     WorkflowNodeRunContext,
     FormDefinition,
   } from '@noco-integrations/core';

   interface {Action}NodeConfig extends WorkflowNodeConfig {
     authIntegrationId: string;
     // ... action-specific config
   }

   export class {Action}Node extends WorkflowNodeIntegration<{Action}NodeConfig> {
     public async definition(): Promise<WorkflowNodeDefinition> {
       const form: FormDefinition = [
         {
           type: FormBuilderInputType.SelectIntegration,
           label: '{Provider} Account',
           model: 'config.authIntegrationId',
           integrationFilter: { type: IntegrationType.Auth, sub_type: '{provider}' },
           validators: [{ type: FormBuilderValidatorType.Required, message: 'Required' }],
         },
         // ... more form fields
       ];

       return {
         id: '{provider}.{action}',
         title: '{Action Title}',
         description: '{Action description}',
         icon: '{providerIcon}',
         category: WorkflowNodeCategory.ACTION,
         ports: [{ id: 'output', direction: 'output', order: 0 }],
         form,
         keywords: ['{provider}', '{action}', ...],
       };
     }

     public async fetchOptions(key: string): Promise<unknown> {
       if (!this.config.authIntegrationId) return [];

       const auth = await this.getIntegration<{Provider}AuthIntegration>(
         this.config.authIntegrationId
       );

       switch (key) {
         case 'items':
           return auth.use(async (client) => {
             const items = await client.api.listItems();
             return items.map(item => ({ label: item.name, value: item.id }));
           });
         default:
           return [];
       }
     }

     public async run(ctx: WorkflowNodeRunContext): Promise<WorkflowNodeResult> {
       const startTime = Date.now();
       const logs: any[] = [];
       const config = ctx.inputs?.config || {};

       try {
         const auth = await this.getIntegration<{Provider}AuthIntegration>(
           config.authIntegrationId
         );

         const result = await auth.use(async (client) => {
           return client.api.doAction({ ...config });
         });

         logs.push({ level: 'info', message: 'Action completed', ts: Date.now() });

         return {
           outputs: { success: true, result },
           status: 'success',
           logs,
           metrics: { executionTimeMs: Date.now() - startTime },
         };
       } catch (error: any) {
         logs.push({ level: 'error', message: error.message, ts: Date.now() });
         return {
           outputs: { success: false },
           status: 'error',
           error: { message: error.message, code: error.code },
           logs,
           metrics: { executionTimeMs: Date.now() - startTime },
         };
       }
     }
   }
   ```

5. **Create index.ts with IntegrationEntry**
   ```typescript
   import { type IntegrationEntry, IntegrationType } from '@noco-integrations/core';
   import { manifest } from './manifest';
   import { {Action}Node } from './nodes/{action}';

   export const entries: IntegrationEntry[] = [
     {
       type: IntegrationType.WorkflowNode,
       sub_type: '{provider}.{action}',
       wrapper: {Action}Node,
       form: [],
       manifest: { ...manifest, title: '{Action Title}', icon: 'nc{Provider}', order: 10 },
       packageManifest: manifest,
     },
   ];

   export default entries;
   ```

### Workflow 2: Create Trigger Node (with Webhooks)

1. **Implement trigger node with webhook lifecycle**
   ```typescript
   import {
     WorkflowNodeCategory,
     TriggerActivationType,
     WorkflowNodeIntegration,
   } from '@noco-integrations/core';
   import type {
     WorkflowActivationContext,
     WorkflowActivationState,
     WorkflowNodeConfig,
     WorkflowNodeDefinition,
     WorkflowNodeResult,
     WorkflowNodeRunContext,
   } from '@noco-integrations/core';

   interface {Provider}TriggerConfig extends WorkflowNodeConfig {
     authIntegrationId: string;
     events: string[];
     // ... trigger-specific config
   }

   export class {Provider}TriggerNode extends WorkflowNodeIntegration<{Provider}TriggerConfig> {
     public async definition(): Promise<WorkflowNodeDefinition> {
       return {
         id: '{provider}.trigger',
         title: '{Provider} Webhook',
         description: 'Triggers when event occurs in {Provider}',
         icon: 'nc{Provider}',
         category: WorkflowNodeCategory.TRIGGER,
         activationType: TriggerActivationType.WEBHOOK,
         ports: [{ id: 'output', direction: 'output', order: 0 }],
         form: [/* ... */],
         keywords: ['trigger', '{provider}', 'webhook'],
       };
     }

     /**
      * Called when workflow is published - create external webhook
      */
     public async onActivateHook(
       context: WorkflowActivationContext
     ): Promise<WorkflowActivationState> {
       const auth = await this.getIntegration<{Provider}AuthIntegration>(
         this.config.authIntegrationId
       );

       return await auth.use(async (client) => {
         const webhook = await client.webhooks.create({
           url: context.webhookUrl,  // NocoDB provides this URL
           events: this.config.events,
         });

         return {
           webhookId: webhook.id,
           createdAt: new Date().toISOString(),
         };
       });
     }

     /**
      * Called when workflow is unpublished - cleanup webhook
      */
     public async onDeactivateHook(
       context: WorkflowActivationContext,
       state?: WorkflowActivationState
     ): Promise<void> {
       if (!state?.webhookId) return;

       const auth = await this.getIntegration<{Provider}AuthIntegration>(
         this.config.authIntegrationId
       );

       await auth.use(async (client) => {
         await client.webhooks.delete(state.webhookId);
       });
     }

     public async run(ctx: WorkflowNodeRunContext): Promise<WorkflowNodeResult> {
       const logs: any[] = [];
       const startTime = Date.now();

       // Test mode returns sample payload
       if (ctx.testMode) {
         return {
           outputs: { event: 'sample_event', payload: { test: true } },
           status: 'success',
           logs: [{ level: 'info', message: 'Using test payload', ts: Date.now() }],
           metrics: { executionTimeMs: Date.now() - startTime },
         };
       }

       // Real execution receives webhook payload
       const inputs = ctx.inputs as any;
       const webhookPayload = inputs.webhook?.body || {};
       const headers = inputs.webhook?.headers || {};

       return {
         outputs: {
           event: headers['x-{provider}-event'],
           payload: webhookPayload,
         },
         status: 'success',
         logs,
         metrics: { executionTimeMs: Date.now() - startTime },
       };
     }
   }
   ```

### Workflow 3: Create OAuth Auth Integration

1. **Create auth package structure**
   ```
   packages/noco-integrations/packages/{provider}-auth/
   ├── package.json
   ├── tsconfig.json
   └── src/
       ├── index.ts
       ├── manifest.ts
       ├── integration.ts   # AuthIntegration implementation
       ├── form.ts          # OAuth form config
       ├── config.ts        # OAuth credentials
       └── types.ts         # Config types
   ```

2. **Implement AuthIntegration** (`src/integration.ts`)
   ```typescript
   import { AuthIntegration, AuthType } from '@noco-integrations/core';
   import type { TestConnectionResponse } from '@noco-integrations/core';
   import { {Provider}Client } from '{provider}-sdk';
   import type { {Provider}AuthConfig } from './types';

   export class {Provider}AuthIntegration extends AuthIntegration<
     {Provider}AuthConfig,
     {Provider}Client
   > {
     public client: {Provider}Client | null = null;

     public async authenticate(): Promise<{Provider}Client> {
       switch (this.config.type) {
         case AuthType.ApiKey:
           this.client = new {Provider}Client({ apiKey: this.config.token });
           return this.client;

         case AuthType.OAuth:
           this.client = new {Provider}Client({ accessToken: this.config.oauth_token });
           return this.client;

         default:
           throw new Error('Unsupported authentication type');
       }
     }

     public async testConnection(): Promise<TestConnectionResponse> {
       try {
         await this.use(async (client) => {
           await client.users.me();  // Test API call
         });
         return { success: true };
       } catch (error: any) {
         return { success: false, message: error.message };
       }
     }

     public async exchangeToken(payload: { code: string }): Promise<{
       oauth_token: string;
       refresh_token?: string;
     }> {
       // Exchange authorization code for tokens
       const response = await axios.post(tokenUri, {
         client_id: clientId,
         client_secret: clientSecret,
         code: payload.code,
         redirect_uri: redirectUri,
         grant_type: 'authorization_code',
       });

       return {
         oauth_token: response.data.access_token,
         refresh_token: response.data.refresh_token,
       };
     }

     public async refreshToken(payload: { refresh_token: string }): Promise<{
       oauth_token: string;
       refresh_token: string;
     }> {
       const response = await axios.post(tokenUri, {
         client_id: clientId,
         client_secret: clientSecret,
         refresh_token: payload.refresh_token,
         grant_type: 'refresh_token',
       });

       return {
         oauth_token: response.data.access_token,
         refresh_token: response.data.refresh_token,
       };
     }

     protected shouldRefreshToken(err: any): boolean {
       return this.config.type === AuthType.OAuth &&
              this.config.refresh_token &&
              err?.response?.status === 401;
     }

     public async destroy(): Promise<void> {
       this.client = null;
     }
   }
   ```

## Form Builder Reference

### Input Types
```typescript
enum FormBuilderInputType {
  SelectIntegration,  // Select auth integration
  Select,             // Dropdown (static or fetchOptionsKey)
  Input,              // Text input
  WorkflowInput,      // Supports $(variable) interpolation
  Radio,
  Checkbox,
  Multiline,
  Number,
  Switch,
  DatePicker,
  TimePicker,
}
```

### Form Field Pattern
```typescript
{
  type: FormBuilderInputType.Select,
  label: 'Channel',
  model: 'config.channelId',           // Path in node config
  fetchOptionsKey: 'channels',          // Triggers fetchOptions('channels')
  dependsOn: 'config.authIntegrationId', // Refetch when this changes
  placeholder: 'Select a channel',
  condition: { model: 'config.sendTo', value: 'channel' },  // Conditional display
  validators: [{ type: FormBuilderValidatorType.Required, message: 'Required' }],
  group: 'advanced',                    // Collapsible group
  groupCollapsible: true,
  groupDefaultCollapsed: true,
}
```

### Dynamic Options (fetchOptions)
```typescript
public async fetchOptions(key: string): Promise<unknown> {
  const auth = await this.getIntegration<AuthIntegration>(this.config.authIntegrationId);

  switch (key) {
    case 'channels':
      return auth.use(async (client) => {
        const items = await client.conversations.list();
        return items.map(item => ({
          label: item.name,
          value: item.id,
          ncItemDisabled: item.archived,        // Disable option
          ncItemTooltip: item.archived ? 'Archived' : undefined,
        }));
      });
    default:
      return [];
  }
}
```

## Key Patterns

### Loading Auth Integrations
```typescript
// In workflow nodes, use getIntegration to load auth
const auth = await this.getIntegration<SlackAuthIntegration>(this.config.authIntegrationId);

// Execute authenticated API calls
const result = await auth.use(async (client) => {
  return client.api.doSomething();
});
```

### Error Handling
```typescript
try {
  // ... operation
} catch (error: any) {
  return {
    outputs: { success: false },
    status: 'error',
    error: {
      message: error.message || 'Operation failed',
      code: error.code || 'UNKNOWN_ERROR',
      data: error.data,
    },
    logs: [{ level: 'error', message: error.message, ts: Date.now() }],
  };
}
```

### Test Mode Support
```typescript
public async run(ctx: WorkflowNodeRunContext): Promise<WorkflowNodeResult> {
  if (ctx.testMode) {
    // Return realistic sample data for UI testing
    return {
      outputs: { event: 'push', repo: 'sample/repo' },
      status: 'success',
      logs: [{ level: 'info', message: 'Test mode - sample data', ts: Date.now() }],
    };
  }
  // ... actual execution
}
```

## Build & Development

```bash
# In packages/noco-integrations/packages/{package}/
pnpm build              # Build TypeScript

# From noco-integrations root
pnpm build              # Build all packages
pnpm build:optimized    # Production build
```

## Reference Files

- **Form Builder Types**: See [references/form-builder.md](references/form-builder.md)
- **Node Patterns**: See [references/node-patterns.md](references/node-patterns.md)
- **Available Integrations**: See `packages/noco-integrations/packages/`

## Quick Scaffolding

```bash
# Use the existing scaffolder tool
cd packages/nc-integration-scaffolder
pnpm start
```

Or use the automation node scaffolder:
```bash
python .skills/nocohub-automations/scripts/scaffold-workflow-node.py {provider} --action {action}
python .skills/nocohub-automations/scripts/scaffold-workflow-node.py stripe --action create-customer
python .skills/nocohub-automations/scripts/scaffold-workflow-node.py discord --trigger message-received
```
