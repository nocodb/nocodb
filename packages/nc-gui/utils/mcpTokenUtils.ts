import type { McpTokenPermissionsJson } from 'nocodb-sdk'
import type { SupportedDocsType } from '~/lib/types'

/**
 * The scopes a connection grants, or null when it predates them.
 *
 * Null is not "no access": such a connection carries its creator's own
 * authority in the one base it was made for, which is what every MCP token
 * minted before scopes existed still does.
 */
export function parseMcpTokenPermissions(token: {
  permissions?: string | McpTokenPermissionsJson | null
}): McpTokenPermissionsJson | null {
  if (!token?.permissions) return null

  try {
    const parsed = typeof token.permissions === 'string' ? JSON.parse(token.permissions) : token.permissions

    return Array.isArray(parsed?.scopes) ? (parsed as McpTokenPermissionsJson) : null
  } catch {
    return null
  }
}

/** Setup docs offered next to a connection's client config. */
export const MCP_SUPPORT_DOCS: SupportedDocsType[] = [
  { title: 'Getting Started with MCP Server', href: 'https://nocodb.com/docs/product-docs/mcp' },
  { title: 'Claude Setup', href: 'https://nocodb.com/docs/product-docs/mcp#claude' },
  { title: 'Cursor Setup', href: 'https://nocodb.com/docs/product-docs/mcp#cursor' },
  { title: 'Windsurf Setup', href: 'https://nocodb.com/docs/product-docs/mcp#windsurf' },
]
