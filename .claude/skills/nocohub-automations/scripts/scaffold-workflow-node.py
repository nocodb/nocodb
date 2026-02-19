#!/usr/bin/env python3
"""
NocoDB Workflow Node Scaffolder

Generates workflow node packages for SaaS integrations.

Usage:
    python scaffold-workflow-node.py <provider> --action <action_name>
    python scaffold-workflow-node.py <provider> --trigger <trigger_name>

Examples:
    python scaffold-workflow-node.py stripe --action create-customer
    python scaffold-workflow-node.py discord --trigger message-received
    python scaffold-workflow-node.py notion --action create-page --action update-page
"""

import argparse
import os
import re
from pathlib import Path


def to_pascal_case(name: str) -> str:
    """Convert kebab-case or snake_case to PascalCase"""
    return ''.join(word.capitalize() for word in re.split(r'[-_]', name))


def to_camel_case(name: str) -> str:
    """Convert kebab-case or snake_case to camelCase"""
    pascal = to_pascal_case(name)
    return pascal[0].lower() + pascal[1:]


def to_kebab_case(name: str) -> str:
    """Convert to kebab-case"""
    return name.lower().replace('_', '-')


def to_snake_case(name: str) -> str:
    """Convert to snake_case"""
    return name.lower().replace('-', '_')


PACKAGE_JSON_TEMPLATE = '''{
  "name": "@noco-integrations/{provider}-workflow-node",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "clean": "rimraf dist",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "@noco-integrations/core": "workspace:*"
  },
  "devDependencies": {
    "rimraf": "^5.0.10",
    "typescript": "^5.8.3"
  }
}
'''

TSCONFIG_TEMPLATE = '''{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
'''

MANIFEST_TEMPLATE = '''import type {{ IntegrationManifest }} from '@noco-integrations/core';

export const manifest: IntegrationManifest = {{
  title: '{provider_title}',
  icon: '{provider_icon}',
  description: 'Integration with {provider_title}',
  version: '0.1.0',
  author: 'NocoDB',
  website: 'https://github.com/nocodb/nocodb',
  order: 10,
}};
'''

ACTION_NODE_TEMPLATE = '''import {{
  IntegrationType,
  WorkflowNodeCategory,
  WorkflowNodeIntegration,
  FormBuilderInputType,
  FormBuilderValidatorType,
}} from '@noco-integrations/core';
import type {{ {provider_pascal}AuthIntegration }} from '@noco-integrations/{provider}-auth';
import type {{
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
  WorkflowNodeLog,
  FormDefinition,
}} from '@noco-integrations/core';

interface {action_pascal}NodeConfig extends WorkflowNodeConfig {{
  authIntegrationId: string;
  // TODO: Add action-specific config fields
}}

export class {action_pascal}Node extends WorkflowNodeIntegration<{action_pascal}NodeConfig> {{
  public async definition(): Promise<WorkflowNodeDefinition> {{
    const form: FormDefinition = [
      {{
        type: FormBuilderInputType.SelectIntegration,
        label: '{provider_title} Account',
        model: 'config.authIntegrationId',
        integrationFilter: {{ type: IntegrationType.Auth, sub_type: '{provider}' }},
        validators: [
          {{ type: FormBuilderValidatorType.Required, message: '{provider_title} account is required' }},
        ],
      }},
      // TODO: Add form fields for action configuration
    ];

    return {{
      id: '{provider}.{action_snake}',
      title: '{action_title}',
      description: '{action_title} in {provider_title}',
      icon: 'nc{provider_pascal}',
      category: WorkflowNodeCategory.ACTION,
      ports: [{{ id: 'output', direction: 'output', order: 0 }}],
      form,
      documentation: 'https://nocodb.com/docs/workflows/nodes/{provider}',
      keywords: ['{provider}', '{action_snake}'],
    }};
  }}

  public async fetchOptions(key: string): Promise<unknown> {{
    if (!this.config.authIntegrationId) return [];

    const auth = await this.getIntegration<{provider_pascal}AuthIntegration>(
      this.config.authIntegrationId
    );

    switch (key) {{
      // TODO: Implement dynamic options fetching
      // case 'items':
      //   return auth.use(async (client) => {{
      //     const items = await client.api.listItems();
      //     return items.map(item => ({{ label: item.name, value: item.id }}));
      //   }});
      default:
        return [];
    }}
  }}

  public async run(ctx: WorkflowNodeRunContext): Promise<WorkflowNodeResult> {{
    const startTime = Date.now();
    const logs: WorkflowNodeLog[] = [];
    const config = ctx.inputs?.config || {{}};

    try {{
      if (!config.authIntegrationId) {{
        return {{
          outputs: {{ success: false }},
          status: 'error',
          error: {{ message: '{provider_title} account is required', code: 'MISSING_AUTH' }},
          logs,
        }};
      }}

      const auth = await this.getIntegration<{provider_pascal}AuthIntegration>(
        config.authIntegrationId
      );

      logs.push({{
        level: 'info',
        message: 'Executing {action_title}',
        ts: Date.now(),
      }});

      // TODO: Implement the actual action
      const result = await auth.use(async (client) => {{
        // return await client.api.doAction({{ ... }});
        return {{ id: 'sample', success: true }};
      }});

      logs.push({{
        level: 'info',
        message: '{action_title} completed successfully',
        ts: Date.now(),
        data: result,
      }});

      return {{
        outputs: {{
          success: true,
          result,
        }},
        status: 'success',
        logs,
        metrics: {{ executionTimeMs: Date.now() - startTime }},
      }};

    }} catch (error: any) {{
      logs.push({{
        level: 'error',
        message: error.message || '{action_title} failed',
        ts: Date.now(),
        data: error.data,
      }});

      return {{
        outputs: {{ success: false }},
        status: 'error',
        error: {{
          message: error.message || '{action_title} failed',
          code: error.code || 'UNKNOWN_ERROR',
          data: error.data,
        }},
        logs,
        metrics: {{ executionTimeMs: Date.now() - startTime }},
      }};
    }}
  }}
}}
'''

TRIGGER_NODE_TEMPLATE = '''import {{
  IntegrationType,
  WorkflowNodeCategory,
  TriggerActivationType,
  WorkflowNodeIntegration,
  FormBuilderInputType,
  FormBuilderValidatorType,
}} from '@noco-integrations/core';
import type {{ {provider_pascal}AuthIntegration }} from '@noco-integrations/{provider}-auth';
import type {{
  WorkflowActivationContext,
  WorkflowActivationState,
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
  WorkflowNodeLog,
  FormDefinition,
}} from '@noco-integrations/core';

interface {trigger_pascal}TriggerConfig extends WorkflowNodeConfig {{
  authIntegrationId: string;
  events: string[];
  // TODO: Add trigger-specific config fields
}}

export class {trigger_pascal}TriggerNode extends WorkflowNodeIntegration<{trigger_pascal}TriggerConfig> {{
  public async definition(): Promise<WorkflowNodeDefinition> {{
    const form: FormDefinition = [
      {{
        type: FormBuilderInputType.SelectIntegration,
        label: '{provider_title} Account',
        model: 'config.authIntegrationId',
        integrationFilter: {{ type: IntegrationType.Auth, sub_type: '{provider}' }},
        validators: [
          {{ type: FormBuilderValidatorType.Required, message: '{provider_title} account is required' }},
        ],
      }},
      {{
        type: FormBuilderInputType.Select,
        label: 'Events',
        model: 'config.events',
        selectMode: 'multiple',
        options: [
          // TODO: Add event options
          {{ label: 'Event 1', value: 'event1' }},
          {{ label: 'Event 2', value: 'event2' }},
        ],
        validators: [
          {{ type: FormBuilderValidatorType.Required, message: 'At least one event is required' }},
        ],
      }},
    ];

    return {{
      id: '{provider}.{trigger_snake}',
      title: '{trigger_title}',
      description: 'Triggers when {trigger_title} occurs in {provider_title}',
      icon: 'nc{provider_pascal}',
      category: WorkflowNodeCategory.TRIGGER,
      activationType: TriggerActivationType.WEBHOOK,
      ports: [{{ id: 'output', direction: 'output', order: 0 }}],
      form,
      keywords: ['trigger', '{provider}', 'webhook', '{trigger_snake}'],
    }};
  }}

  /**
   * Called when workflow is published - create external webhook
   */
  public async onActivateHook(
    context: WorkflowActivationContext
  ): Promise<WorkflowActivationState> {{
    const auth = await this.getIntegration<{provider_pascal}AuthIntegration>(
      this.config.authIntegrationId
    );

    return await auth.use(async (client) => {{
      // TODO: Create webhook in external service
      // const webhook = await client.webhooks.create({{
      //   url: context.webhookUrl,
      //   events: this.config.events,
      // }});

      return {{
        webhookId: 'webhook_id_placeholder',
        createdAt: new Date().toISOString(),
      }};
    }});
  }}

  /**
   * Called when workflow is unpublished - cleanup webhook
   */
  public async onDeactivateHook(
    context: WorkflowActivationContext,
    state?: WorkflowActivationState
  ): Promise<void> {{
    if (!state?.webhookId) return;

    const auth = await this.getIntegration<{provider_pascal}AuthIntegration>(
      this.config.authIntegrationId
    );

    await auth.use(async (client) => {{
      // TODO: Delete webhook from external service
      // await client.webhooks.delete(state.webhookId);
    }});
  }}

  public async fetchOptions(key: string): Promise<unknown> {{
    if (!this.config.authIntegrationId) return [];

    const auth = await this.getIntegration<{provider_pascal}AuthIntegration>(
      this.config.authIntegrationId
    );

    switch (key) {{
      // TODO: Implement options fetching
      default:
        return [];
    }}
  }}

  public async run(ctx: WorkflowNodeRunContext): Promise<WorkflowNodeResult> {{
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    // Test mode: return sample payload
    if (ctx.testMode) {{
      const samplePayload = {{
        event: this.config.events?.[0] || 'sample_event',
        timestamp: new Date().toISOString(),
        data: {{
          id: 'sample_id',
          // TODO: Add realistic sample data
        }},
      }};

      logs.push({{
        level: 'info',
        message: 'Test mode - using sample payload',
        ts: Date.now(),
      }});

      return {{
        outputs: samplePayload,
        status: 'success',
        logs,
        metrics: {{ executionTimeMs: Date.now() - startTime }},
      }};
    }}

    // Real execution: extract webhook payload
    const inputs = ctx.inputs as any;
    const webhookPayload = inputs.webhook?.body || {{}};
    const headers = inputs.webhook?.headers || {{}};

    logs.push({{
      level: 'info',
      message: `Received webhook event: ${{webhookPayload.event || 'unknown'}}`,
      ts: Date.now(),
    }});

    return {{
      outputs: {{
        event: webhookPayload.event || headers['x-{provider}-event'],
        payload: webhookPayload,
        headers,
      }},
      status: 'success',
      logs,
      metrics: {{ executionTimeMs: Date.now() - startTime }},
    }};
  }}
}}
'''

INDEX_TEMPLATE = '''import {{ type IntegrationEntry, IntegrationType }} from '@noco-integrations/core';
import {{ manifest }} from './manifest';
{imports}

export const entries: IntegrationEntry[] = [
{entries}
];

export default entries;
'''

INDEX_ENTRY_TEMPLATE = '''  {{
    type: IntegrationType.WorkflowNode,
    sub_type: '{provider}.{node_snake}',
    wrapper: {node_class},
    form: [],
    manifest: {{
      ...manifest,
      title: '{node_title}',
      icon: 'nc{provider_pascal}',
      order: {order},
    }},
    packageManifest: manifest,
  }}'''


def scaffold_workflow_node(
    provider: str,
    actions: list[str] = None,
    triggers: list[str] = None,
    base_path: str = None
):
    """Scaffold a workflow node package"""

    provider_kebab = to_kebab_case(provider)
    provider_pascal = to_pascal_case(provider)
    provider_title = provider_pascal

    # Determine base path
    if base_path:
        packages_dir = Path(base_path)
    else:
        cwd = Path.cwd()
        if (cwd / 'packages/noco-integrations/packages').exists():
            packages_dir = cwd / 'packages/noco-integrations/packages'
        elif (cwd / 'packages').exists():
            packages_dir = cwd / 'packages'
        else:
            packages_dir = cwd

    package_dir = packages_dir / f'{provider_kebab}-workflow-node'
    src_dir = package_dir / 'src'
    nodes_dir = src_dir / 'nodes'

    files_created = []

    # Create directories
    nodes_dir.mkdir(parents=True, exist_ok=True)

    # Create package.json
    package_json_path = package_dir / 'package.json'
    if not package_json_path.exists():
        package_json_path.write_text(
            PACKAGE_JSON_TEMPLATE.format(provider=provider_kebab)
        )
        files_created.append(str(package_json_path))

    # Create tsconfig.json
    tsconfig_path = package_dir / 'tsconfig.json'
    if not tsconfig_path.exists():
        tsconfig_path.write_text(TSCONFIG_TEMPLATE)
        files_created.append(str(tsconfig_path))

    # Create manifest.ts
    manifest_path = src_dir / 'manifest.ts'
    if not manifest_path.exists():
        manifest_path.write_text(MANIFEST_TEMPLATE.format(
            provider_title=provider_title,
            provider_icon=provider_kebab,
        ))
        files_created.append(str(manifest_path))

    # Track nodes for index.ts
    node_imports = []
    node_entries = []
    order = 10

    # Create action nodes
    actions = actions or []
    for action in actions:
        action_kebab = to_kebab_case(action)
        action_pascal = to_pascal_case(action)
        action_snake = to_snake_case(action)
        action_title = ' '.join(word.capitalize() for word in action.split('-'))

        node_path = nodes_dir / f'{action_kebab}.ts'
        if not node_path.exists():
            node_path.write_text(ACTION_NODE_TEMPLATE.format(
                provider=provider_kebab,
                provider_pascal=provider_pascal,
                provider_title=provider_title,
                action_pascal=action_pascal,
                action_snake=action_snake,
                action_title=action_title,
            ))
            files_created.append(str(node_path))

        node_imports.append(f"import {{ {action_pascal}Node }} from './nodes/{action_kebab}';")
        node_entries.append(INDEX_ENTRY_TEMPLATE.format(
            provider=provider_kebab,
            provider_pascal=provider_pascal,
            node_snake=action_snake,
            node_class=f'{action_pascal}Node',
            node_title=action_title,
            order=order,
        ))
        order += 1

    # Create trigger nodes
    triggers = triggers or []
    for trigger in triggers:
        trigger_kebab = to_kebab_case(trigger)
        trigger_pascal = to_pascal_case(trigger)
        trigger_snake = to_snake_case(trigger)
        trigger_title = ' '.join(word.capitalize() for word in trigger.split('-'))

        node_path = nodes_dir / f'{trigger_kebab}.ts'
        if not node_path.exists():
            node_path.write_text(TRIGGER_NODE_TEMPLATE.format(
                provider=provider_kebab,
                provider_pascal=provider_pascal,
                provider_title=provider_title,
                trigger_pascal=trigger_pascal,
                trigger_snake=trigger_snake,
                trigger_title=trigger_title,
            ))
            files_created.append(str(node_path))

        node_imports.append(f"import {{ {trigger_pascal}TriggerNode }} from './nodes/{trigger_kebab}';")
        node_entries.append(INDEX_ENTRY_TEMPLATE.format(
            provider=provider_kebab,
            provider_pascal=provider_pascal,
            node_snake=trigger_snake,
            node_class=f'{trigger_pascal}TriggerNode',
            node_title=trigger_title,
            order=order,
        ))
        order += 1

    # Create index.ts
    index_path = src_dir / 'index.ts'
    if node_imports:
        index_path.write_text(INDEX_TEMPLATE.format(
            imports='\n'.join(node_imports),
            entries=',\n'.join(node_entries),
        ))
        files_created.append(str(index_path))

    return files_created, {
        'provider': provider_kebab,
        'provider_pascal': provider_pascal,
        'actions': actions,
        'triggers': triggers,
        'package_dir': str(package_dir),
    }


def main():
    parser = argparse.ArgumentParser(
        description='Scaffold a NocoDB workflow node package',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  %(prog)s stripe --action create-customer
  %(prog)s discord --trigger message-received
  %(prog)s notion --action create-page --action update-page

After scaffolding:
  1. Ensure @noco-integrations/{provider}-auth package exists
  2. Implement TODO items in generated node files
  3. Add package to noco-integrations/pnpm-workspace.yaml
  4. Run pnpm install && pnpm build
        '''
    )
    parser.add_argument('provider', help='Provider name (e.g., stripe, discord, notion)')
    parser.add_argument('--action', action='append', dest='actions',
                       help='Action node to create (can be repeated)')
    parser.add_argument('--trigger', action='append', dest='triggers',
                       help='Trigger node to create (can be repeated)')
    parser.add_argument('--path', help='Base path to noco-integrations/packages/')

    args = parser.parse_args()

    if not args.actions and not args.triggers:
        parser.error('At least one --action or --trigger is required')

    files_created, context = scaffold_workflow_node(
        args.provider,
        actions=args.actions,
        triggers=args.triggers,
        base_path=args.path
    )

    if files_created:
        print(f"\n✅ Scaffolded workflow node package: @noco-integrations/{context['provider']}-workflow-node")
        print(f"\n📁 Package location: {context['package_dir']}")
        print("\nFiles created:")
        for f in files_created:
            print(f"  - {f}")

        print("\n📋 Next steps:")
        print(f"  1. Ensure @noco-integrations/{context['provider']}-auth package exists")
        print("  2. Implement TODO items in generated node files:")
        for action in context['actions'] or []:
            print(f"     - src/nodes/{to_kebab_case(action)}.ts")
        for trigger in context['triggers'] or []:
            print(f"     - src/nodes/{to_kebab_case(trigger)}.ts")
        print("  3. Add package to noco-integrations/pnpm-workspace.yaml if needed")
        print("  4. Run: cd packages/noco-integrations && pnpm install && pnpm build")
    else:
        print("No files were created (all files already exist)")


if __name__ == '__main__':
    main()
