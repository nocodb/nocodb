# Form Builder Reference

Quick reference for building workflow node configuration forms.

## FormBuilderInputType Enum

| Type | Description | Use Case |
|------|-------------|----------|
| `SelectIntegration` | Dropdown for auth integrations | Link to OAuth/API key auth |
| `Select` | Standard dropdown | Static options or fetchOptionsKey |
| `Input` | Text input | Strings, URLs, IDs |
| `WorkflowInput` | Text with variable interpolation | Dynamic values with $(var) |
| `Radio` | Radio button group | Mutually exclusive options |
| `Checkbox` | Checkbox | Boolean options |
| `Multiline` | Textarea | Long text, messages |
| `Number` | Number input | Counts, limits |
| `Switch` | Toggle switch | On/off settings |
| `DatePicker` | Date selector | Date values |
| `TimePicker` | Time selector | Time values |

## FormBuilderValidatorType Enum

| Type | Description |
|------|-------------|
| `Required` | Field must have value |
| `Email` | Valid email format |
| `Url` | Valid URL format |
| `Min` | Minimum value/length |
| `Max` | Maximum value/length |
| `Pattern` | Regex pattern match |

## Complete Form Field Interface

```typescript
interface FormElement {
  // Required
  type: FormBuilderInputType;
  label: string;
  model: string;              // Config path: 'config.fieldName'

  // Optional - Common
  placeholder?: string;
  helpText?: string;
  defaultValue?: any;
  span?: number;              // Grid span (1-24, default 24)

  // Optional - Validation
  validators?: Array<{
    type: FormBuilderValidatorType;
    message: string;
    value?: any;              // For min/max/pattern
  }>;

  // Optional - Conditional Display
  condition?: {
    model: string;            // Path to check: 'config.sendTo'
    value: any;               // Value to match: 'channel'
  };

  // Optional - Select/Dropdown
  options?: Array<{
    label: string;
    value: any;
  }>;
  fetchOptionsKey?: string;   // Triggers fetchOptions(key)
  dependsOn?: string;         // Refetch when this path changes
  selectMode?: 'single' | 'multiple';

  // Optional - Integration Select
  integrationFilter?: {
    type: IntegrationType;    // 'auth', 'sync', 'workflow-node', 'ai'
    sub_type?: string;        // 'slack', 'github', etc.
  };

  // Optional - WorkflowInput
  plugins?: string[];         // ['multiline'] for textarea

  // Optional - Grouping
  group?: string;             // Group identifier
  groupLabel?: string;        // Group display label
  groupCollapsible?: boolean;
  groupDefaultCollapsed?: boolean;
}
```

## Common Form Patterns

### Auth Integration Selector
```typescript
{
  type: FormBuilderInputType.SelectIntegration,
  label: 'Slack Account',
  model: 'config.authIntegrationId',
  integrationFilter: { type: IntegrationType.Auth, sub_type: 'slack' },
  validators: [{ type: FormBuilderValidatorType.Required, message: 'Required' }],
}
```

### Dynamic Select with API Fetch
```typescript
{
  type: FormBuilderInputType.Select,
  label: 'Channel',
  model: 'config.channelId',
  fetchOptionsKey: 'channels',              // Calls fetchOptions('channels')
  dependsOn: 'config.authIntegrationId',    // Refetch on auth change
  placeholder: 'Select a channel',
  validators: [{ type: FormBuilderValidatorType.Required, message: 'Required' }],
}
```

### Conditional Field
```typescript
{
  type: FormBuilderInputType.Select,
  label: 'Channel',
  model: 'config.channelId',
  fetchOptionsKey: 'channels',
  condition: { model: 'config.sendTo', value: 'channel' },  // Only show when sendTo='channel'
  // ...
}
```

### Workflow Input with Variable Support
```typescript
{
  type: FormBuilderInputType.WorkflowInput,
  label: 'Message',
  model: 'config.message',
  plugins: ['multiline'],                   // Enable multiline textarea
  placeholder: 'Enter message (use $(varName) for variables)',
  validators: [{ type: FormBuilderValidatorType.Required, message: 'Required' }],
}
```

### Collapsible Advanced Options
```typescript
{
  type: FormBuilderInputType.Input,
  label: 'Bot Name',
  model: 'config.botName',
  placeholder: 'Custom bot name (optional)',
  group: 'advanced',
  groupLabel: 'Advanced Options',
  groupCollapsible: true,
  groupDefaultCollapsed: true,
},
{
  type: FormBuilderInputType.Input,
  label: 'Bot Icon',
  model: 'config.botIcon',
  placeholder: 'Icon URL or :emoji:',
  group: 'advanced',                        // Same group, no need for groupLabel again
}
```

### Multiple Selection
```typescript
{
  type: FormBuilderInputType.Select,
  label: 'Events',
  model: 'config.events',
  selectMode: 'multiple',
  options: [
    { label: 'Push', value: 'push' },
    { label: 'Pull Request', value: 'pull_request' },
    { label: 'Issues', value: 'issues' },
  ],
  validators: [{ type: FormBuilderValidatorType.Required, message: 'Select at least one event' }],
}
```

## fetchOptions Return Format

```typescript
// Simple options
return [
  { label: '#general', value: 'C123456' },
  { label: '#random', value: 'C789012' },
];

// With disabled state and tooltips
return items.map(item => ({
  label: item.name,
  value: item.id,
  ncItemDisabled: item.archived,              // Gray out option
  ncItemTooltip: item.archived ? 'Archived channel' : undefined,
}));
```

## Full Example: Slack Send Message Form

```typescript
const form: FormDefinition = [
  {
    type: FormBuilderInputType.SelectIntegration,
    label: 'Slack Account',
    model: 'config.authIntegrationId',
    integrationFilter: { type: IntegrationType.Auth, sub_type: 'slack' },
    validators: [{ type: FormBuilderValidatorType.Required, message: 'Required' }],
  },
  {
    type: FormBuilderInputType.Select,
    label: 'Send To',
    model: 'config.sendTo',
    defaultValue: 'channel',
    options: [
      { label: 'Channel', value: 'channel' },
      { label: 'User', value: 'user' },
    ],
  },
  {
    type: FormBuilderInputType.Select,
    label: 'Channel',
    model: 'config.channelId',
    fetchOptionsKey: 'channels',
    dependsOn: 'config.authIntegrationId',
    condition: { model: 'config.sendTo', value: 'channel' },
    validators: [{ type: FormBuilderValidatorType.Required, message: 'Required' }],
  },
  {
    type: FormBuilderInputType.Select,
    label: 'User',
    model: 'config.userId',
    fetchOptionsKey: 'users',
    dependsOn: 'config.authIntegrationId',
    condition: { model: 'config.sendTo', value: 'user' },
    validators: [{ type: FormBuilderValidatorType.Required, message: 'Required' }],
  },
  {
    type: FormBuilderInputType.WorkflowInput,
    label: 'Message',
    model: 'config.message',
    plugins: ['multiline'],
    validators: [{ type: FormBuilderValidatorType.Required, message: 'Required' }],
  },
  {
    type: FormBuilderInputType.Input,
    label: 'Bot Name',
    model: 'config.botName',
    group: 'options',
    groupLabel: 'More Options',
    groupCollapsible: true,
    groupDefaultCollapsed: true,
  },
];
```
