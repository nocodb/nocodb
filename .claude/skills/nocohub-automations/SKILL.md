---
name: nocohub-automations
description: Workflow automation node development for SaaS integrations in noco-integrations. Use when creating action/trigger nodes, OAuth auth integrations, or form builder definitions.
---

# Automation Node Development

## Architecture

```
packages/noco-integrations/
├── core/src/                         # Base classes & registry
│   ├── workflow-node/types.ts        # WorkflowNodeIntegration base
│   ├── auth/interface.ts             # AuthIntegration base
│   └── registry.ts                   # IntegrationRegistry singleton
└── packages/                         # 60+ integration packages
    ├── {provider}-auth/              # OAuth/API key auth
    ├── {provider}-workflow-node/     # Workflow nodes
    └── {provider}-sync/              # Data sync
```

## Node Types

| Type | Category | Purpose |
|------|----------|---------|
| Trigger | `TRIGGER` | Starts workflow on event (webhook, cron) |
| Action | `ACTION` | Performs operation (send message, create record) |
| Flow | `FLOW` | Controls execution (if/else, loop, delay) |

## Creating a Node

Every node extends `WorkflowNodeIntegration<Config>` and implements three methods:

| Method | Purpose |
|--------|---------|
| `definition()` | Returns metadata, form fields, ports, keywords |
| `fetchOptions(key)` | Returns dynamic dropdown options (called when `fetchOptionsKey` triggers) |
| `run(ctx)` | Executes the node. Must handle `ctx.testMode` with sample data. |

Triggers additionally implement:
- `onActivateHook(context)` — create external webhook when workflow published
- `onDeactivateHook(context, state)` — cleanup webhook when unpublished
- `heartbeat(context, state)` — optional, verify webhook is still active (re-creates if deleted)
- `validate(config)` — optional, return `{ valid, errors[] }` for config validation

**For a complete working example, read:** `packages/noco-integrations/packages/slack-workflow-node/`

### Package Structure

```
packages/noco-integrations/packages/{provider}-workflow-node/
├── package.json              # name: @noco-integrations/{provider}-workflow-node
├── tsconfig.json
└── src/
    ├── index.ts              # Export IntegrationEntry[]
    ├── manifest.ts           # IntegrationManifest (title, icon, version)
    └── nodes/{action}.ts     # Node class
```

### IntegrationEntry Export

```typescript
export const entries: IntegrationEntry[] = [
  {
    type: IntegrationType.WorkflowNode,
    sub_type: '{provider}.{action}',
    wrapper: ActionNode,
    form: [],
    manifest: { ...manifest, title: 'Action Title', icon: 'ncProvider', order: 10 },
    packageManifest: manifest,
  },
];
export default entries;
```

## Auth Integrations

Extend `AuthIntegration<Config, Client>`. Must implement:

| Method | Purpose |
|--------|---------|
| `authenticate()` | Create and return API client |
| `testConnection()` | Verify credentials work |
| `exchangeToken({ code })` | OAuth code → token exchange |
| `refreshToken({ refresh_token })` | Refresh expired OAuth token |
| `shouldRefreshToken(err)` | Return true if error indicates token expiry |

Use in nodes: `const auth = await this.getIntegration<ProviderAuth>(config.authIntegrationId)`
Execute calls: `await auth.use(async (client) => client.api.doAction())`

## Form Builder

### Input Types

`SelectIntegration` | `Select` | `Input` | `WorkflowInput` (supports `$(variable)`) | `Textarea` | `Checkbox` | `Number` | `Switch` | `Password` | `OAuth` | `KeyValue` | `EntitySelector` | `SelectBase` | `SelectTable` | `SelectView` | `SelectField` | `Space` | `ConditionBuilder`

### Form Field Interface

```typescript
{
  // Required
  type: FormBuilderInputType,
  label: string,
  model: string,                    // Config path: 'config.channelId'

  // Display
  placeholder?: string,
  helpText?: string,
  defaultValue?: any,
  span?: number,                    // Grid span 1-24 (default 24)

  // Validation
  validators?: [{ type: FormBuilderValidatorType.Required | .Regex | .MinValue | .MaxValue | .MinLength | .MaxLength | .Email | .Url | .Custom, message: string }],

  // Conditional visibility
  condition?: { model: string, value: any },

  // Select/Dropdown
  options?: [{ label, value }],
  fetchOptionsKey?: string,         // Triggers fetchOptions(key)
  dependsOn?: string,               // Refetch when this config path changes
  selectMode?: 'single' | 'multiple',

  // Integration select
  integrationFilter?: { type: IntegrationType, sub_type?: string },

  // WorkflowInput
  plugins?: ['multiline'],          // Enable multiline textarea

  // Grouping
  group?: string,
  groupLabel?: string,
  groupCollapsible?: boolean,
  groupDefaultCollapsed?: boolean,
}
```

### fetchOptions Return Format

```typescript
return items.map(item => ({
  label: item.name,
  value: item.id,
  ncItemDisabled?: boolean,         // Gray out option
  ncItemTooltip?: string,           // Tooltip on hover
}));
```

## Run Method Pattern

```typescript
public async run(ctx: WorkflowNodeRunContext): Promise<WorkflowNodeResult> {
  if (ctx.testMode) {
    return { outputs: { /* sample data */ }, status: 'success', logs: [...], metrics: { ... } };
  }
  // Real execution — always return { outputs, status, logs, metrics }
  // On error: status: 'error', error: { message, code }
}
```

## Build

```bash
cd packages/noco-integrations && pnpm build            # All packages
cd packages/noco-integrations/packages/{pkg} && pnpm build  # Single package
```

## Scaffolding

```bash
# Interactive scaffolder
cd packages/nc-integration-scaffolder && pnpm start

# Script-based (action or trigger)
python .claude/skills/nocohub-automations/scripts/scaffold-workflow-node.py {provider} --action {action}
python .claude/skills/nocohub-automations/scripts/scaffold-workflow-node.py {provider} --trigger {event}
```
