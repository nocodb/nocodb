import type { ApiTokenScopeEntry } from '~/lib/apiToken';

/**
 * The `nc_mcp_tokens.permissions` column, as stored.
 *
 * A **missing `scopes` array** is the legacy marker, and it does not mean "no
 * access": it means the credential predates scopes and carries the user's own
 * authority, pinned to the base it was created for. That is what every MCP
 * token minted before this shape existed does, and rewriting those rows would
 * change live credentials nobody asked us to touch — so the absence of scopes
 * IS the migration. `grantFromMcpToken` is the one place that reading lives.
 */
export interface McpTokenStoredPermissions {
  version: 1;
  scopes?: ApiTokenScopeEntry[];
  /**
   * The tools this credential may call, by name.
   *
   * Present means the grant is per tool: the scope rows say *where* it reaches
   * and this says *what* it may call, and the category levels on those rows are
   * not consulted. Absent means the older category-shaped grant, which is what
   * a fine-grained PAT used over MCP still carries.
   *
   * An allowlist rather than a denylist on purpose — a tool added in a later
   * release is not silently granted to a credential someone approved before it
   * existed.
   */
  tools?: string[];
  /**
   * Bases this credential itself brought into existence. Its authority reaches
   * them however narrow its scopes are: an agent that cannot open the base it
   * was just told to create cannot build anything.
   */
  created_bases?: string[];
}

/** The same column read as a scoped credential — `scopes` present. */
export interface McpTokenPermissionsJson extends McpTokenStoredPermissions {
  /** Same rows a fine-grained PAT carries, so one picker feeds both surfaces. */
  scopes: ApiTokenScopeEntry[];
}

/**
 * How a tool is classified, read off its own registration. The grant is per
 * tool, not per group — this is what the picker groups the list by, and what
 * lets `delete` be called out on the rows that destroy something.
 */
export enum McpToolGroupKey {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
}

/**
 * The rows of the connection picker. Each tool family the server registers
 * folds into one of these; the picker offers a level per section, and the
 * grant is still written out as the tool names that level implies.
 */
export enum McpToolSection {
  ACCOUNT = 'account',
  RECORDS = 'records',
  SCHEMA = 'schema',
  VIEWS = 'views',
  AUTOMATION = 'automation',
  INTERFACES = 'interfaces',
  ACCESS = 'access',
  PLATFORM = 'platform',
}

/** One tool, as the connection picker lists it. */
export interface McpToolCatalogEntry {
  name: string;
  title: string;
  group: McpToolGroupKey;
  section: McpToolSection;
  /** What the tool does, as its registration tells the MCP client. */
  description?: string;
}

/** The header an MCP client sends its credential in. */
export const MCP_TOKEN_HEADER = 'xc-mcp-token';
