export enum OAuthScopes {
  DATA_RECORDS_READ = 'data.records:read',
  DATA_RECORDS_WRITE = 'data.records:write',

  DATA_RECORD_COMMENT_READ = 'data.records.comment:read',
  DATA_RECORD_COMMENT_WRITE = 'data.records.comment:write',

  SCHEMA_BASE_READ = 'schema.base:read',
  SCHEMA_BASE_WRITE = 'schema.base:write',
  SCHEMA_TABLES_READ = 'schema.tables:read',
  SCHEMA_TABLES_WRITE = 'schema.tables:write',

  WEBHOOK_MANAGE = 'webhook:manage',
  INTEGRATION_MANAGE = 'integration:manage',

  USER_EMAIL_READ = 'user.email:read',
}
