#!/usr/bin/env python3
"""
NocoDB Sync Integration Scaffolding Tool

Generates boilerplate for new sync integrations.

Usage:
    python scaffold-sync-integration.py monday --category "Project Management"
    python scaffold-sync-integration.py salesforce --category CRM --with-oauth
"""

import argparse
import os
from pathlib import Path
from datetime import datetime

# Base path for noco-integrations
INTEGRATIONS_PATH = Path(__file__).parent.parent.parent.parent.parent / "packages" / "noco-integrations" / "integrations"
NC_GUI_PATH = Path(__file__).parent.parent.parent.parent.parent / "packages" / "nc-gui"


def to_pascal_case(name: str) -> str:
    """Convert to PascalCase."""
    return ''.join(word.capitalize() for word in name.replace('-', '_').split('_'))


def to_camel_case(name: str) -> str:
    """Convert to camelCase."""
    pascal = to_pascal_case(name)
    return pascal[0].lower() + pascal[1:]


def create_sync_integration(name: str, category: str, with_oauth: bool = False):
    """Create a sync integration package."""

    pascal_name = to_pascal_case(name)
    camel_name = to_camel_case(name)

    # Create integration directory
    integration_path = INTEGRATIONS_PATH / name
    integration_path.mkdir(parents=True, exist_ok=True)

    # Create index.ts
    index_content = f'''/**
 * {pascal_name} Sync Integration
 * Category: {category}
 * Created: {datetime.now().strftime("%Y-%m-%d")}
 */

export {{ {pascal_name}SyncIntegration }} from './{name}.integration'
{'export { ' + pascal_name + 'AuthIntegration } from "./' + name + '.auth"' if with_oauth else ''}
'''

    (integration_path / "index.ts").write_text(index_content)
    print(f"✅ Created {integration_path / 'index.ts'}")

    # Create integration.ts
    integration_content = f'''import {{ PassThrough, Readable }} from 'stream'
import type {{
  AuthIntegrationWrapper,
  DestinationColumn,
  DestinationSchema,
  DestinationTable,
  FetchDataOptions,
  SyncDataRecord,
}} from '@noco-local-integrations/core'
import {{ SyncIntegration, UITypes }} from '@noco-local-integrations/core'

/**
 * {pascal_name} API Client
 * TODO: Replace with actual SDK or implement API calls
 */
interface {pascal_name}Client {{
  // Define client methods based on API
  workspaces: {{
    list(): Promise<any[]>
  }}
  items: {{
    list(workspaceId: string): Promise<any[]>
    listUpdatedSince(workspaceId: string, since: string): Promise<any[]>
  }}
}}

interface {pascal_name}Config {{
  workspaceId?: string
  // Add service-specific configuration
}}

/**
 * {pascal_name} Sync Integration
 *
 * Syncs data from {pascal_name} into NocoDB tables.
 *
 * Features:
 * - Full sync: Complete data replacement
 * - Incremental sync: Only fetch changes since last sync
 * - Multi-workspace support
 */
export class {pascal_name}SyncIntegration extends SyncIntegration<{pascal_name}Config> {{
  /**
   * Get available tables/schemas from {pascal_name}
   */
  async getDestinationSchema(
    authWrapper: AuthIntegrationWrapper
  ): Promise<DestinationSchema> {{
    const client = await this.getClient(authWrapper)
    const workspaces = await client.workspaces.list()

    const tables: DestinationTable[] = []

    for (const workspace of workspaces) {{
      // Filter by configured workspace if specified
      if (this.config.workspaceId && workspace.id !== this.config.workspaceId) {{
        continue
      }}

      // TODO: Fetch tables/boards/objects from workspace
      // const items = await client.tables.list(workspace.id)

      // Example table definition
      tables.push({{
        name: workspace.name,
        key: workspace.id,
        namespace: workspace.id,
        columns: this.getDefaultColumns(),
      }})
    }}

    return {{ tables }}
  }}

  /**
   * Fetch data from {pascal_name} as a stream
   */
  async fetchData(
    authWrapper: AuthIntegrationWrapper,
    options: FetchDataOptions
  ): Promise<Readable> {{
    const client = await this.getClient(authWrapper)
    const stream = new PassThrough({{ objectMode: true }})

    // Process asynchronously
    this.streamData(client, options, stream).catch(err => {{
      stream.destroy(err)
    }})

    return stream
  }}

  /**
   * Stream data for target tables
   */
  private async streamData(
    client: {pascal_name}Client,
    options: FetchDataOptions,
    stream: PassThrough
  ): Promise<void> {{
    for (const targetTable of options.targetTables) {{
      const tableKey = targetTable.key

      // Get incremental value if available (for incremental sync)
      const lastSyncedAt = options.targetTableIncrementalValues?.[tableKey]

      // Fetch items
      const items = lastSyncedAt
        ? await client.items.listUpdatedSince(tableKey, lastSyncedAt)
        : await client.items.list(tableKey)

      for (const item of items) {{
        const record: SyncDataRecord = {{
          tableName: tableKey,
          data: this.transformItem(item),
          meta: {{
            remoteId: item.id,
            remoteSyncedAt: new Date().toISOString(),
            remoteNamespace: targetTable.namespace,
            remoteUpdatedAt: item.updated_at,
          }},
        }}

        stream.push(record)
      }}
    }}

    stream.push(null)  // End stream
  }}

  /**
   * Transform external item to NocoDB row format
   */
  private transformItem(item: any): Record<string, any> {{
    // TODO: Map external fields to NocoDB columns
    return {{
      name: item.name,
      description: item.description,
      status: item.status,
      created_at: item.created_at,
      updated_at: item.updated_at,
      // Add more field mappings
    }}
  }}

  /**
   * Get default column definitions
   * TODO: Customize based on {pascal_name} schema
   */
  private getDefaultColumns(): DestinationColumn[] {{
    return [
      {{
        title: 'Name',
        key: 'name',
        uidt: UITypes.SingleLineText,
      }},
      {{
        title: 'Description',
        key: 'description',
        uidt: UITypes.LongText,
      }},
      {{
        title: 'Status',
        key: 'status',
        uidt: UITypes.SingleSelect,
        meta: {{
          options: [
            {{ title: 'Active', color: '#4CAF50' }},
            {{ title: 'Inactive', color: '#9E9E9E' }},
          ],
        }},
      }},
      {{
        title: 'Created At',
        key: 'created_at',
        uidt: UITypes.DateTime,
      }},
      {{
        title: 'Updated At',
        key: 'updated_at',
        uidt: UITypes.DateTime,
      }},
    ]
  }}

  /**
   * Map external column types to NocoDB UITypes
   */
  private mapColumnType(externalType: string): UITypes {{
    const typeMap: Record<string, UITypes> = {{
      'text': UITypes.SingleLineText,
      'long_text': UITypes.LongText,
      'number': UITypes.Number,
      'date': UITypes.Date,
      'datetime': UITypes.DateTime,
      'checkbox': UITypes.Checkbox,
      'dropdown': UITypes.SingleSelect,
      'multi_select': UITypes.MultiSelect,
      'email': UITypes.Email,
      'url': UITypes.URL,
      'currency': UITypes.Currency,
      'rating': UITypes.Rating,
    }}

    return typeMap[externalType] || UITypes.SingleLineText
  }}

  /**
   * Get authenticated client
   */
  private async getClient(authWrapper: AuthIntegrationWrapper): Promise<{pascal_name}Client> {{
    const credentials = await authWrapper.getCredentials()

    // TODO: Initialize actual API client
    // return new {pascal_name}SDK({{
    //   {'accessToken: credentials.access_token,' if with_oauth else 'apiKey: credentials.apiKey,'}
    // }})

    throw new Error('TODO: Implement {pascal_name} client initialization')
  }}
}}
'''

    (integration_path / f"{name}.integration.ts").write_text(integration_content)
    print(f"✅ Created {integration_path / f'{name}.integration.ts'}")

    # Create auth integration if OAuth
    if with_oauth:
        auth_content = f'''import type {{
  AuthConfig,
  OAuthCredentials,
}} from '@noco-local-integrations/core'
import {{ OAuthIntegration }} from '@noco-local-integrations/core'

/**
 * {pascal_name} OAuth Integration
 *
 * Handles OAuth 2.0 authentication with {pascal_name}.
 */
export class {pascal_name}AuthIntegration extends OAuthIntegration {{
  // OAuth configuration
  static readonly AUTH_URL = 'https://api.{name}.com/oauth/authorize'
  static readonly TOKEN_URL = 'https://api.{name}.com/oauth/token'
  static readonly SCOPES = ['read', 'write']  // TODO: Define required scopes

  /**
   * Get OAuth authorization URL
   */
  getAuthorizationUrl(config: AuthConfig): string {{
    const params = new URLSearchParams({{
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: {pascal_name}AuthIntegration.SCOPES.join(' '),
      state: config.state || '',
    }})

    return `${{{pascal_name}AuthIntegration.AUTH_URL}}?${{params.toString()}}`
  }}

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    code: string,
    config: AuthConfig
  ): Promise<OAuthCredentials> {{
    const response = await fetch({pascal_name}AuthIntegration.TOKEN_URL, {{
      method: 'POST',
      headers: {{
        'Content-Type': 'application/x-www-form-urlencoded',
      }},
      body: new URLSearchParams({{
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
      }}),
    }})

    if (!response.ok) {{
      throw new Error(`Token exchange failed: ${{response.statusText}}`)
    }}

    const data = await response.json()

    return {{
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in * 1000),
      token_type: data.token_type,
    }}
  }}

  /**
   * Refresh expired access token
   */
  async refreshAccessToken(
    refreshToken: string,
    config: AuthConfig
  ): Promise<OAuthCredentials> {{
    const response = await fetch({pascal_name}AuthIntegration.TOKEN_URL, {{
      method: 'POST',
      headers: {{
        'Content-Type': 'application/x-www-form-urlencoded',
      }},
      body: new URLSearchParams({{
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }}),
    }})

    if (!response.ok) {{
      throw new Error(`Token refresh failed: ${{response.statusText}}`)
    }}

    const data = await response.json()

    return {{
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
      expires_at: Date.now() + (data.expires_in * 1000),
      token_type: data.token_type,
    }}
  }}
}}
'''
        (integration_path / f"{name}.auth.ts").write_text(auth_content)
        print(f"✅ Created {integration_path / f'{name}.auth.ts'}")

    # Update frontend sync data utils
    update_frontend_sync_data(name, pascal_name, category)

    print(f"\n🎉 {pascal_name} sync integration scaffolded successfully!")
    print(f"\nNext steps:")
    print(f"  1. Implement the API client in {name}.integration.ts")
    print(f"  2. Map column types for {pascal_name} schema")
    print(f"  3. Test with: pnpm dev:ee")
    print(f"  4. Register in packages/noco-integrations/integrations/index.ts")


def update_frontend_sync_data(name: str, pascal_name: str, category: str):
    """Add integration to frontend sync data utils."""

    sync_data_file = NC_GUI_PATH / "utils" / "syncDataUtils.ts"

    if not sync_data_file.exists():
        print(f"⚠️  Could not find {sync_data_file}")
        return

    content = sync_data_file.read_text()

    # Check if already exists
    if f"'{name}'" in content or f'"{name}"' in content:
        print(f"ℹ️  {pascal_name} already exists in syncDataUtils.ts")
        return

    # Find the category in syncIntegrationCategories
    category_marker = f"'{category}':"
    if category_marker not in content:
        category_marker = f'"{category}":'

    if category_marker in content:
        # Add to existing category
        insert_pos = content.find(category_marker)
        bracket_pos = content.find('[', insert_pos)
        first_entry_pos = content.find('{', bracket_pos)

        new_entry = f'''{{
        name: '{pascal_name}',
        icon: '{name}',
        type: '{name}',
        enabled: true,
      }},
      '''

        new_content = content[:first_entry_pos] + new_entry + content[first_entry_pos:]
        sync_data_file.write_text(new_content)
        print(f"✅ Added {pascal_name} to {category} category in syncDataUtils.ts")
    else:
        print(f"⚠️  Category '{category}' not found in syncDataUtils.ts")
        print(f"    Please add manually:")
        print(f'''
    '{category}': [
      {{
        name: '{pascal_name}',
        icon: '{name}',
        type: '{name}',
        enabled: true,
      }},
    ],
''')


def main():
    parser = argparse.ArgumentParser(
        description="NocoDB Sync Integration Scaffolding Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scaffold-sync-integration.py monday --category "Project Management"
  python scaffold-sync-integration.py salesforce --category CRM --with-oauth
  python scaffold-sync-integration.py stripe --category Finance --with-oauth
        """
    )

    parser.add_argument("name", help="Integration name (lowercase, e.g., monday, salesforce)")
    parser.add_argument(
        "--category", "-c",
        required=True,
        help="Integration category (e.g., CRM, Ticketing, 'Project Management')"
    )
    parser.add_argument(
        "--with-oauth",
        action="store_true",
        help="Include OAuth authentication integration"
    )

    args = parser.parse_args()

    # Validate name
    name = args.name.lower().replace(' ', '-')

    # Verify paths exist
    if not INTEGRATIONS_PATH.exists():
        print(f"❌ Integrations path not found: {INTEGRATIONS_PATH}")
        print("Make sure you're running from the nocohub repository.")
        return

    create_sync_integration(name, args.category, args.with_oauth)


if __name__ == "__main__":
    main()
