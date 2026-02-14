export enum OAuthScopes {
  DATA_RECORDS_READ = 'data.records:read',
  DATA_RECORDS_WRITE = 'data.records:write',

  DATA_RECORD_COMMENT_READ = 'data.records.comment:read',
  DATA_RECORD_COMMENT_WRITE = 'data.records.comment:write',

  SCHEMA_BASE_READ = 'schema.base:read',
  SCHEMA_BASE_WRITE = 'schema.base:write',

  SCHEMA_WORKSPACES_READ = 'schema.workspaces:read',
  SCHEMA_WORKSPACES_WRITE = 'schema.workspaces:write',

  WEBHOOK_MANAGE = 'webhook:manage',
  INTEGRATION_MANAGE = 'integration:manage',

  USER_PROFILE_READ = 'user.profile:read',

  AI_ACCESS = 'ai:access',
}

export const scopeHierarchy: Record<string, string[]> = {
  // Data write includes read
  [OAuthScopes.DATA_RECORDS_WRITE]: [OAuthScopes.DATA_RECORDS_READ],
  [OAuthScopes.DATA_RECORD_COMMENT_WRITE]: [
    OAuthScopes.DATA_RECORD_COMMENT_READ,
  ],

  // Schema write includes read
  [OAuthScopes.SCHEMA_BASE_WRITE]: [OAuthScopes.SCHEMA_BASE_READ],
  [OAuthScopes.SCHEMA_WORKSPACES_WRITE]: [OAuthScopes.SCHEMA_WORKSPACES_READ],
};

export const scopeDescriptions: Record<
  string,
  { name: string; description: string }
> = {
  [OAuthScopes.DATA_RECORDS_READ]: {
    name: 'Read Records',
    description: 'View data records and their content',
  },
  [OAuthScopes.DATA_RECORDS_WRITE]: {
    name: 'Write Records',
    description:
      'Create, update, and delete data records (includes read access)',
  },
  [OAuthScopes.DATA_RECORD_COMMENT_READ]: {
    name: 'Read Comments',
    description: 'View comments on data records',
  },
  [OAuthScopes.DATA_RECORD_COMMENT_WRITE]: {
    name: 'Write Comments',
    description:
      'Add, edit, and delete comments on records (includes read access)',
  },
  [OAuthScopes.SCHEMA_BASE_READ]: {
    name: 'Read Base Schema',
    description: 'View base structure and base configuration',
  },
  [OAuthScopes.SCHEMA_BASE_WRITE]: {
    name: 'Write Base Schema',
    description:
      'Modify base structure and configuration (includes read access)',
  },
  [OAuthScopes.SCHEMA_WORKSPACES_READ]: {
    name: 'Read Workspace Schema',
    description: 'View workspace structure and organization',
  },
  [OAuthScopes.SCHEMA_WORKSPACES_WRITE]: {
    name: 'Write Workspace Schema',
    description:
      'Modify workspace structure and organization (includes read access)',
  },
  [OAuthScopes.WEBHOOK_MANAGE]: {
    name: 'Manage Webhooks',
    description: 'Create, update, and delete webhook configurations',
  },
  [OAuthScopes.INTEGRATION_MANAGE]: {
    name: 'Manage Integrations',
    description: 'Configure and manage third-party integrations',
  },
  [OAuthScopes.USER_PROFILE_READ]: {
    name: 'Read User Profile',
    description: 'Access user profile information and preferences',
  },
  [OAuthScopes.AI_ACCESS]: {
    name: 'AI Access',
    description: 'Use AI-powered features and functionality',
  },
};
