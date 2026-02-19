# NocoDB Integrations (noco-integrations)

## Architecture

Monorepo of 60+ integration packages in `packages/`:

```
packages/noco-integrations/
├── core/src/                         # Base classes & registry
│   ├── workflow-node/types.ts        # WorkflowNodeIntegration base
│   ├── auth/interface.ts             # AuthIntegration base
│   └── registry.ts                   # IntegrationRegistry singleton
└── packages/                         # Integration packages
    ├── {provider}-auth/              # OAuth/API key auth
    ├── {provider}-workflow-node/     # Workflow action/trigger nodes
    ├── {provider}-sync/              # Data sync integrations
    └── {provider}-ai/               # AI provider integrations
```

Each integration is a separate npm package with its own `package.json`, compiled independently, registered at runtime.

## Node Types

| Type | Category | Purpose | Example |
|------|----------|---------|---------|
| Trigger | `TRIGGER` | Starts workflow on event | GitHub webhook, Cron |
| Action | `ACTION` | Performs operation | Slack message, HTTP request |
| Flow | `FLOW` | Controls execution | If/else, Loop, Delay |

## Creating a New Integration

1. Create package at `packages/{provider}-workflow-node/`
2. Create `manifest.ts` with `IntegrationManifest`
3. Implement node class extending `WorkflowNodeIntegration<Config>`
4. Implement `definition()` → returns form, metadata, ports
5. Implement `fetchOptions(key)` → dynamic dropdown options
6. Implement `run(ctx)` → execution logic with logs and metrics
7. Export `IntegrationEntry[]` from `index.ts`

For triggers: also implement `onActivateHook()` and `onDeactivateHook()` for webhook lifecycle.

For auth: extend `AuthIntegration` base, implement `authenticate()`, `testConnection()`, `exchangeToken()`, `refreshToken()`.

## Form Builder

```typescript
enum FormBuilderInputType {
  SelectIntegration,  // Auth integration picker
  Select,             // Dropdown (static or via fetchOptionsKey)
  Input,              // Text
  WorkflowInput,      // Supports $(variable) interpolation
  Textarea,           // Multiline text
  Checkbox, Number, Switch, Password, OAuth,
  KeyValue,           // Key-value pairs
  EntitySelector,     // Select with manual input toggle
  SelectBase, SelectTable, SelectView, SelectField,  // NocoDB pickers
  Space,              // Visual separator
  ConditionBuilder,   // Complex filter builder
}
```

Key form field properties: `type`, `label`, `model` (config path), `fetchOptionsKey`, `dependsOn`, `condition`, `validators`, `group`, `groupCollapsible`.

## Auth Pattern

```typescript
// Load auth in workflow nodes:
const auth = await this.getIntegration<ProviderAuthIntegration>(config.authIntegrationId);
const result = await auth.use(async (client) => client.api.doAction());
```

## Test Mode

All nodes should handle `ctx.testMode` — return realistic sample data for UI testing.

## Scaffolding

```bash
cd packages/nc-integration-scaffolder && pnpm start
```

## Build

```bash
pnpm build              # Build all packages (optimized)
pnpm build:force        # Force rebuild all
pnpm build:verbose      # Build with verbose logging
```
