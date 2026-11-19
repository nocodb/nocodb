/**
 * MCP connectors: remote MCP servers people connect to with their own account,
 * for AI chat and for the agents they talk to.
 *
 * A connector is where a server comes from — NocoDB's verified list, one an
 * admin added for a workspace or org, or a URL someone pasted. A connection is
 * one person's signed-in account on it.
 */

export * from './verified';

/** How a connector signs people in. */
export enum McpConnectorAuth {
  /**
   * OAuth with nothing to set up: NocoDB's client ID metadata document where the
   * server accepts one, else dynamic client registration.
   */
  OAuthDynamic = 'oauth_dcr',
  /** OAuth with a client registered ahead of time (by NocoDB, or by an admin). */
  OAuthClient = 'oauth_client',
  /** A key or token the person pastes. */
  ApiKey = 'api_key',
  /** Headers the person enters, sent with every request. */
  Headers = 'headers',
  None = 'none',
}

/** At most this many custom headers per connection. */
export const MCP_MAX_CUSTOM_HEADERS = 20;

export type McpTransport = 'http' | 'sse';

export enum McpConnectorCategory {
  Work = 'work',
  Files = 'files',
  Communication = 'communication',
  Crm = 'crm',
  Support = 'support',
  Marketing = 'marketing',
  Finance = 'finance',
  Forms = 'forms',
  Data = 'data',
}

/** Where a connector comes from. */
export enum McpConnectorSource {
  Verified = 'verified',
  Workspace = 'workspace',
  Org = 'org',
  Custom = 'custom',
}

/**
 * A connector whose server lives per account or tenant: the person enters
 * their own URL, which must be on one of the vendor's hosts.
 */
export interface McpServerUrlInput {
  placeholder: string;
  /** Allowed hosts; `*.` matches any subdomain, `*` any host (then `paths` decides). */
  hosts: string[];
  /** The path must end with one of these. */
  paths?: string[];
  /** The URL carries a key (in its query): stored encrypted, shown without it. */
  secret?: boolean;
}

/**
 * One entry of NocoDB's verified list. Enum fields take their string values,
 * so the list needs no enum at module load.
 */
export interface McpVerifiedConnector {
  id: string;
  title: string;
  developer: string;
  description: string;
  category: `${McpConnectorCategory}`;
  /** Absent when each person enters their own (`serverUrl`). */
  url?: string;
  serverUrl?: McpServerUrlInput;
  transport: McpTransport;
  auth: `${McpConnectorAuth}`;
  websiteUrl?: string;
  privacyUrl?: string;
  termsUrl?: string;
  docsUrl?: string;
  /** Example requests shown on the connector's page. */
  prompts?: string[];
}

/** A connector an admin added for a workspace or an org. */
export interface McpConnectorType {
  id: string;
  scope: McpConnectorSource.Workspace | McpConnectorSource.Org;
  scope_id: string;
  title: string;
  description?: string;
  url: string;
  transport: McpTransport;
  auth: McpConnectorAuth;
  /** With `OAuthClient`: the client the admin registered with the server. */
  oauth_client_id?: string;
  /** Whether a client secret is stored; the secret itself never leaves the server. */
  has_client_secret?: boolean;
  icon_url?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface McpConnectorCreateReqType {
  title: string;
  description?: string;
  url: string;
  transport?: McpTransport;
  auth: McpConnectorAuth;
  oauth_client_id?: string;
  oauth_client_secret?: string;
  icon_url?: string;
}

/** Whether a connection's tools run without asking. */
export enum McpPermissionMode {
  /** Every call waits for the person. */
  Ask = 'ask',
  /** Read-only, non-destructive tools run; the rest ask. */
  LowRisk = 'low_risk',
  /** Nothing asks. */
  All = 'all',
}

export type McpToolApproval = 'ask' | 'allow';

/** A tool as the server described it when its list was last read. */
export interface McpToolInfo {
  name: string;
  title?: string;
  description: string;
  /** The server's own hints (MCP annotations). */
  readOnly?: boolean;
  destructive?: boolean;
  /** Hash of description + input schema. */
  fingerprint: string;
}

/** A person's choice for one tool, overriding the connection's defaults. */
export interface McpToolSetting {
  enabled?: boolean;
  approval?: McpToolApproval;
}

export enum McpConnectionStatus {
  Connected = 'connected',
  /** The sign-in expired or was revoked. */
  NeedsReconnect = 'needs_reconnect',
}

/** One person's signed-in account on a connector. Never shared. */
export interface McpConnectionType {
  id: string;
  source: McpConnectorSource;
  /** Verified id or admin connector id; absent for a custom URL. */
  connector_id?: string;
  title: string;
  url: string;
  transport: McpTransport;
  auth: McpConnectorAuth;
  /** The person's own label for this account. */
  name?: string;
  /** Who the server says signed in, when it tells us. */
  identity?: string;
  /** A custom server's own icon, as a data URL; verified connectors use NocoDB's logos. */
  icon_url?: string;
  is_default?: boolean;
  permission: McpPermissionMode;
  tool_settings: Record<string, McpToolSetting>;
  tools: McpToolInfo[];
  status: McpConnectionStatus;
  created_at?: string;
  updated_at?: string;
  /** Read in a workspace: why its policy hides this connection there. */
  blocked_reason?: McpBlockedReason;
}

export enum McpBlockedReason {
  /** The workspace allows only approved connectors and this is not one. */
  NotApproved = 'not_approved',
  /** An admin connector of another workspace or org. */
  OtherWorkspace = 'other_workspace',
  /** Its admin connector was removed. */
  Removed = 'removed',
}

export interface McpConnectionUpdateReqType {
  name?: string;
  is_default?: boolean;
  permission?: McpPermissionMode;
  /** Merged into the stored settings; `null` clears one tool's override. */
  tool_settings?: Record<string, McpToolSetting | null>;
}

/** Which connectors a workspace (or every workspace of an org) allows. */
export interface McpConnectorPolicyType {
  mode: 'any' | 'restricted';
  /** With `restricted`: which verified connectors stay allowed. */
  verified: 'all' | 'selected' | 'none';
  verified_ids: string[];
}

export const DEFAULT_MCP_CONNECTOR_POLICY: McpConnectorPolicyType = {
  mode: 'any',
  verified: 'all',
  verified_ids: [],
};

/** The policy that applies in a workspace, and whether the org set it. */
export interface McpConnectorPolicyState {
  policy: McpConnectorPolicyType;
  managedByOrg: boolean;
}

/** Everything the browse page needs, read in one workspace. */
export interface McpConnectorCatalog {
  verified: McpVerifiedConnector[];
  /** Verified connectors this NocoDB has no OAuth app for yet: shown, not connectable. */
  needs_setup: string[];
  /** Admin-added connectors that apply in this workspace. */
  connectors: McpConnectorType[];
  connections: McpConnectionType[];
  policy: McpConnectorPolicyState;
}

/** An org's connectors and policy, for its admin page. */
export interface McpOrgConnectorsState {
  verified: McpVerifiedConnector[];
  connectors: McpConnectorType[];
  /** Null leaves each workspace its own policy. */
  policy: McpConnectorPolicyType | null;
}

/** Where the OAuth popup must go, and what to hand back with the code. */
export interface McpConnectStart {
  authorization_url: string;
  state: string;
  /** Opaque; returned unchanged to `mcpConnectFinish`. */
  pending: string;
}

/** Identifies the connector to connect to: a verified id, an admin connector id, or a custom URL. */
export interface McpConnectTarget {
  source: McpConnectorSource;
  connector_id?: string;
  url?: string;
  transport?: McpTransport;
  title?: string;
  /** A custom URL signing in with the person's own OAuth client. */
  client_id?: string;
  client_secret?: string;
}

/** Whether `url` is an https URL on one of the connector's hosts and paths. */
export function mcpServerUrlAllowed(
  input: McpServerUrlInput,
  url: string | undefined,
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url ?? '');
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  const hostOk = input.hosts.some((pattern) =>
    pattern === '*'
      ? true
      : pattern.startsWith('*.')
      ? host.endsWith(pattern.slice(1))
      : host === pattern,
  );
  const path = parsed.pathname.replace(/\/+$/, '');
  const pathOk =
    !input.paths?.length || input.paths.some((p) => path.endsWith(p));
  return hostOk && pathOk;
}

/** Whether a model-facing tool name is a connection's tool (`mcp_<id>__<tool>`). */
export function isConnectorToolName(name: string): boolean {
  return /^mcp_.{6}__./.test(name);
}

/** The tool settings a connection's defaults and overrides add up to. */
export function mcpEffectiveToolSetting(
  connection: Partial<Pick<McpConnectionType, 'permission' | 'tool_settings'>>,
  tool: Pick<McpToolInfo, 'name' | 'readOnly' | 'destructive'>,
): Required<McpToolSetting> {
  const own = connection.tool_settings?.[tool.name] ?? {};
  const lowRisk = !!tool.readOnly && !tool.destructive;
  return {
    // Destructive tools stay off until switched on.
    enabled: own.enabled ?? !tool.destructive,
    approval:
      own.approval ??
      (connection.permission === McpPermissionMode.All ||
      (connection.permission === McpPermissionMode.LowRisk && lowRisk)
        ? 'allow'
        : 'ask'),
  };
}
