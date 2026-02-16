import net from 'net';
import tls from 'tls';
import getPort from 'get-port';
import { nanoid } from 'nanoid';
import { serialize } from 'pg-protocol';
import { Parser } from 'node-sql-parser';
import { Logger } from '@nestjs/common';
import DataReflectionCE from 'src/models/DataReflection';
import { NcBaseError } from 'nocodb-sdk';
import type { Socket } from 'net';
import type { TLSSocket } from 'tls';
import { NcError } from '~/helpers/ncError';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { Base, Workspace } from '~/models';
import Noco from '~/Noco';
import {
  createDatabaseUser,
  dropDatabaseUser,
  generateWhereClause,
  genPassword,
  genSuffix,
  grantAccessToSchema,
  NC_DATA_REFLECTION_SETTINGS,
  revokeAccessToSchema,
} from '~/helpers/dataReflectionHelpers';

const logger = new Logger('DataReflection');

// Environment variables
const NC_DATA_REFLECTION_WINDOW_SIZE =
  +process.env.NC_DATA_REFLECTION_WINDOW_SIZE || 60_000;
const NC_DATA_REFLECTION_QUERY_LIMIT =
  +process.env.NC_DATA_REFLECTION_QUERY_LIMIT || 60;

// Interception rules
const interceptMap: {
  table_name: string;
  column_name: string;
  type: 'in' | 'eq';
  sessionValue?: string;
  value?: string | string[];
}[] = [
  {
    table_name: 'pg_namespace',
    column_name: 'nspname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'schemata',
    column_name: 'schema_name',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_tables',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_database',
    column_name: 'datname',
    type: 'eq',
    sessionValue: 'fk_workspace_id',
  },
  {
    table_name: 'pg_roles',
    column_name: 'rolname',
    type: 'eq',
    sessionValue: 'pgUser',
  },
  {
    table_name: 'pg_user',
    column_name: 'usename',
    type: 'eq',
    sessionValue: 'pgUser',
  },
  // pg_stat views — schema-level filtering to prevent cross-tenant enumeration
  {
    table_name: 'pg_stat_user_tables',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_stat_all_tables',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_stat_xact_user_tables',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_stat_xact_all_tables',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_statio_user_tables',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_statio_all_tables',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_stat_user_indexes',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_stat_all_indexes',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_statio_user_indexes',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_statio_all_indexes',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_statio_user_sequences',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_statio_all_sequences',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_indexes',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  {
    table_name: 'pg_sequences',
    column_name: 'schemaname',
    type: 'in',
    sessionValue: 'availableSchemas',
  },
  // pg_stat_activity — only show own connections
  {
    table_name: 'pg_stat_activity',
    column_name: 'usename',
    type: 'eq',
    sessionValue: 'pgUser',
  },
  // pg_settings — whitelist safe settings only (clients need these for protocol/encoding)
  {
    table_name: 'pg_settings',
    column_name: 'name',
    type: 'in',
    value: [
      'server_version',
      'server_encoding',
      'client_encoding',
      'standard_conforming_strings',
      'DateStyle',
      'TimeZone',
      'IntervalStyle',
      'integer_datetimes',
      'application_name',
      'default_transaction_read_only',
      'is_superuser',
      'session_authorization',
      'lc_messages',
      'lc_monetary',
      'lc_numeric',
      'lc_time',
      'bytea_output',
      'xmloption',
      'statement_timeout',
      'idle_in_transaction_session_timeout',
      'search_path',
    ],
  },
];

// Blocked query patterns — these statements are never allowed through the proxy
const blockedQueryPatterns: { pattern: RegExp; message: string }[] = [
  {
    pattern: /\bALTER\s+(ROLE|USER)\b/i,
    message: 'ALTER ROLE/USER is not permitted',
  },
  {
    pattern: /\bDO\s+\$/i,
    message: 'Anonymous code blocks are not permitted',
  },
  { pattern: /\bLISTEN\b/i, message: 'LISTEN is not permitted' },
  { pattern: /\bNOTIFY\b/i, message: 'NOTIFY is not permitted' },
  {
    pattern: /\bCREATE\s+TEMP(ORARY)?\b/i,
    message: 'Creating temporary objects is not permitted',
  },
  {
    pattern: /\bpg_sleep\s*\(/i,
    message: 'pg_sleep is not permitted',
  },
  {
    pattern: /\bpg_advisory_(un)?lock/i,
    message: 'Advisory locks are not permitted',
  },
  // Block OID-to-name type casts that bypass schema filtering
  {
    pattern: /::regclass\b/i,
    message: 'Type cast to regclass is not permitted',
  },
  {
    pattern: /::regnamespace\b/i,
    message: 'Type cast to regnamespace is not permitted',
  },
  // Block dangerous catalog functions that leak cross-tenant metadata
  {
    pattern: /\bpg_relation_filepath\s*\(/i,
    message: 'pg_relation_filepath is not permitted',
  },
  {
    pattern: /\bpg_identify_object\s*\(/i,
    message: 'pg_identify_object is not permitted',
  },
  {
    pattern: /\bpg_get_indexdef\s*\(/i,
    message: 'pg_get_indexdef is not permitted',
  },
  {
    pattern: /\bpg_get_constraintdef\s*\(/i,
    message: 'pg_get_constraintdef is not permitted',
  },
  {
    pattern: /\bpg_get_viewdef\s*\(/i,
    message: 'pg_get_viewdef is not permitted',
  },
  {
    pattern: /\bpg_get_functiondef\s*\(/i,
    message: 'pg_get_functiondef is not permitted',
  },
  {
    pattern: /\bpg_get_triggerdef\s*\(/i,
    message: 'pg_get_triggerdef is not permitted',
  },
  {
    pattern: /\bhas_schema_privilege\s*\(/i,
    message: 'has_schema_privilege is not permitted',
  },
  {
    pattern: /\bhas_table_privilege\s*\(/i,
    message: 'has_table_privilege is not permitted',
  },
  // Block catalog tables that leak cross-tenant dependency/object info
  {
    pattern: /\bpg_depend\b/i,
    message: 'Access to pg_depend is not permitted',
  },
  {
    pattern: /\bpg_shdepend\b/i,
    message: 'Access to pg_shdepend is not permitted',
  },
];

class QueryBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueryBlockedError';
  }
}

/**
 * Build a PostgreSQL wire protocol ErrorResponse + ReadyForQuery.
 */
function buildPgErrorResponse(message: string): Buffer {
  const severity = Buffer.from('SERROR\0', 'utf8');
  const severityV = Buffer.from('VERROR\0', 'utf8');
  const code = Buffer.from('C42501\0', 'utf8'); // insufficient_privilege
  const msg = Buffer.from(`M${message}\0`, 'utf8');
  const terminator = Buffer.from('\0', 'utf8');

  const fieldsBody = Buffer.concat([
    severity,
    severityV,
    code,
    msg,
    terminator,
  ]);

  const errorHeader = Buffer.alloc(5);
  errorHeader.writeUInt8(0x45, 0); // 'E'
  errorHeader.writeUInt32BE(4 + fieldsBody.length, 1);

  const readyForQuery = Buffer.alloc(6);
  readyForQuery.writeUInt8(0x5a, 0); // 'Z'
  readyForQuery.writeUInt32BE(5, 1);
  readyForQuery.writeUInt8(0x49, 5); // 'I' (idle)

  return Buffer.concat([errorHeader, fieldsBody, readyForQuery]);
}

/**
 * Catalog tables that require namespace OID-based filtering.
 * These tables don't have a text schema column — they use OID references
 * to pg_namespace, so we inject a subquery filter.
 */
const catalogNamespaceFilters: {
  table_name: string;
  column_name: string;
  /** If 'nested', the column references pg_class.oid instead of pg_namespace.oid directly */
  mode: 'direct' | 'nested';
}[] = [
  // pg_class.relnamespace → pg_namespace.oid
  { table_name: 'pg_class', column_name: 'relnamespace', mode: 'direct' },
  // pg_type.typnamespace → pg_namespace.oid
  { table_name: 'pg_type', column_name: 'typnamespace', mode: 'direct' },
  // pg_attribute.attrelid → pg_class.oid (nested: pg_class → pg_namespace)
  { table_name: 'pg_attribute', column_name: 'attrelid', mode: 'nested' },
  // pg_index.indrelid → pg_class.oid (nested)
  { table_name: 'pg_index', column_name: 'indrelid', mode: 'nested' },
  // pg_constraint.conrelid → pg_class.oid (nested)
  { table_name: 'pg_constraint', column_name: 'conrelid', mode: 'nested' },
  // pg_attrdef.adrelid → pg_class.oid (nested) — pg_get_expr() leaks schema names via default expressions
  { table_name: 'pg_attrdef', column_name: 'adrelid', mode: 'nested' },
  // pg_trigger.tgrelid → pg_class.oid (nested)
  { table_name: 'pg_trigger', column_name: 'tgrelid', mode: 'nested' },
  // pg_rewrite.ev_class → pg_class.oid (nested)
  { table_name: 'pg_rewrite', column_name: 'ev_class', mode: 'nested' },
];

/**
 * Build a subquery AST node for filtering by namespace OID.
 * Generates: <alias>.<column> IN (SELECT oid FROM pg_namespace WHERE nspname IN (...schemas))
 * The inner SELECT is marked with _ncGenerated to prevent the recursive walker from
 * applying additional interceptMap rules (which would double-filter pg_namespace).
 */
function buildNamespaceOidSubquery(
  alias: string,
  column: string,
  schemas: string[],
) {
  const allSchemas = [
    ...schemas,
    'pg_catalog',
    'information_schema',
    'pg_toast',
    'public',
  ];

  return {
    type: 'binary_expr',
    operator: 'IN',
    left: {
      type: 'column_ref',
      table: alias,
      column: { expr: { type: 'default', value: column } },
    },
    right: {
      type: 'expr_list',
      value: [
        {
          ast: {
            _ncGenerated: true,
            type: 'select',
            options: null,
            distinct: { type: null },
            columns: [
              {
                type: 'expr',
                expr: {
                  type: 'column_ref',
                  table: null,
                  column: { expr: { type: 'default', value: 'oid' } },
                },
                as: null,
              },
            ],
            into: { position: null },
            from: [{ db: null, table: 'pg_namespace', as: null }],
            where: {
              type: 'binary_expr',
              operator: 'IN',
              left: {
                type: 'column_ref',
                table: null,
                column: { expr: { type: 'default', value: 'nspname' } },
              },
              right: {
                type: 'expr_list',
                value: allSchemas.map((s) => ({
                  type: 'single_quote_string',
                  value: s,
                })),
              },
            },
            groupby: null,
            having: null,
            orderby: null,
            limit: { seperator: '', value: [] },
            window: null,
          },
        },
      ],
    },
  };
}

/**
 * Build a nested subquery AST for filtering via pg_class.
 * Generates: <alias>.<column> IN (SELECT oid FROM pg_class WHERE relnamespace IN (SELECT oid FROM pg_namespace WHERE nspname IN (...)))
 */
function buildNestedClassSubquery(
  alias: string,
  column: string,
  schemas: string[],
) {
  const namespaceSubquery = buildNamespaceOidSubquery(
    null,
    'relnamespace',
    schemas,
  );

  return {
    type: 'binary_expr',
    operator: 'IN',
    left: {
      type: 'column_ref',
      table: alias,
      column: { expr: { type: 'default', value: column } },
    },
    right: {
      type: 'expr_list',
      value: [
        {
          ast: {
            _ncGenerated: true,
            type: 'select',
            options: null,
            distinct: { type: null },
            columns: [
              {
                type: 'expr',
                expr: {
                  type: 'column_ref',
                  table: null,
                  column: { expr: { type: 'default', value: 'oid' } },
                },
                as: null,
              },
            ],
            into: { position: null },
            from: [{ db: null, table: 'pg_class', as: null }],
            where: namespaceSubquery,
            groupby: null,
            having: null,
            orderby: null,
            limit: { seperator: '', value: [] },
            window: null,
          },
        },
      ],
    },
  };
}

class DataReflectionSession {
  private closed = false;
  private queryTimestamps: number[] = [];
  private totalQueryTime = 0;
  private totalQueries = 0;
  private readonly sessionStartTime: number;

  public fk_workspace_id?: string;
  public availableSchemas?: string[];

  public pgSocket: Socket | TLSSocket | null = null;
  public connected = false;

  public pgUser: string | null = null;
  public pgDatabase: string | null = null;

  public constructor(public readonly clientId: string) {
    this.sessionStartTime = Date.now();
  }

  public recordQueryStart(): void {
    this.queryTimestamps.unshift(Date.now());
    this.totalQueries++;

    logger.debug(`Query started for workspace ${this.fk_workspace_id}.`);
  }

  public recordQueryEnd(): void {
    const now = Date.now();
    const start = this.queryTimestamps[0];
    if (!start) return;

    const queryDuration = now - start;
    this.totalQueryTime += queryDuration;
    this.cleanupOldTimestamps();

    logger.debug(
      `Query completed for workspace ${this.fk_workspace_id}. Duration: ${queryDuration}ms`,
    );
  }

  private cleanupOldTimestamps(): void {
    const cutoff = Date.now() - NC_DATA_REFLECTION_WINDOW_SIZE;
    this.queryTimestamps = this.queryTimestamps.filter((ts) => ts >= cutoff);
  }

  public queryCountWithinWindow(): number {
    this.cleanupOldTimestamps();
    return this.queryTimestamps.length;
  }

  public getTotalQueryTime(): number {
    return this.totalQueryTime;
  }

  public close(clientSocket?: Socket): void {
    if (this.closed) return;
    this.closed = true;

    if (this.pgSocket) {
      try {
        this.pgSocket.removeAllListeners();
        if (!this.pgSocket.destroyed) {
          this.pgSocket.destroy();
        }
        this.pgSocket = null;
      } catch (e) {
        logger.error(e);
      }
    }

    if (clientSocket) {
      try {
        clientSocket.removeAllListeners();
        if (!clientSocket.destroyed) {
          clientSocket.destroy();
        }
      } catch (e) {
        logger.error(e);
      }
    }

    clientSessions.delete(this.clientId);

    logger.debug(
      `Session closed for ${this.fk_workspace_id}. Queries: ${
        this.totalQueries
      } (${this.totalQueryTime}ms). Session: ${
        Date.now() - this.sessionStartTime
      }ms.`,
    );
  }
}

const clientSessions = new Map<string, DataReflectionSession>();

export default class DataReflection extends DataReflectionCE {
  /**
   * Initialize the data reflection proxy server.
   * This server acts as a middleware layer between the clients and the actual PostgreSQL server.
   */
  public static async init(): Promise<void> {
    const parser = new Parser();

    const server = net.createServer((clientSocket: Socket) => {
      const clientId = nanoid();

      logger.debug(`Client ${clientId} connected`);

      clientSocket.on('data', async (data: Buffer) => {
        try {
          const messageType = data.readUInt8(0);

          if (!clientSessions.get(clientId)?.connected) {
            return handleStartupMessage(clientSocket, data, clientId);
          }

          const session = clientSessions.get(clientId);

          if (!session) {
            clientSocket.end();
            return;
          }

          if (messageType === 0x51) {
            const queryCount = session.queryCountWithinWindow();
            if (queryCount > NC_DATA_REFLECTION_QUERY_LIMIT) {
              logger.warn(
                `Too many queries for workspace ${session.fk_workspace_id}. Closing connection.`,
              );
              session.close(clientSocket);
              return;
            }

            session.recordQueryStart();

            const modifiedQueryBuffer = await interceptQueryIfNeeded(
              data,
              session,
              parser,
            );

            // If we modified the query write that; otherwise fallback to the original data
            session.pgSocket?.write(modifiedQueryBuffer ?? data);
            return;
          }

          session.pgSocket?.write(data);
        } catch (error) {
          if (error instanceof QueryBlockedError) {
            clientSocket.write(buildPgErrorResponse(error.message));
            return;
          }
          logger.error(`Error processing client data: ${error.message}.`);
          const session = clientSessions.get(clientId);
          if (!session) {
            clientSocket.end();
            return;
          }
          session.pgSocket?.write(data);
        }
      });

      clientSocket.on('error', (err) => {
        logger.error(`Client socket error: ${err.message}`);
        const session = clientSessions.get(clientId);
        if (!session) {
          clientSocket.destroy();
          return;
        }
        session.close(clientSocket);
      });

      clientSocket.on('end', () => {
        const session = clientSessions.get(clientId);
        if (!session) {
          return;
        }
        session.close(clientSocket);
      });
    });

    const port = await getPort({
      port: getPort.makeRange(
        NC_DATA_REFLECTION_SETTINGS.port,
        NC_DATA_REFLECTION_SETTINGS.port + 100,
      ),
    });

    NC_DATA_REFLECTION_SETTINGS.port = port;

    server.listen(port, () => {
      logger.log(`Proxy server listening on port ${port}`);
      server.unref();
    });
  }

  // ... (keeping all the static methods unchanged for brevity)
  public static async create(fk_workspace_id: string, ncMeta = Noco.ncMeta) {
    const workspace = await Workspace.get(fk_workspace_id, false, ncMeta);

    if (!workspace) {
      NcError._.workspaceNotFound(fk_workspace_id);
    }

    const sanitizedWorkspaceTitle = workspace.title.replace(/[^a-z0-9]/gi, '_');
    const username = `nc_${sanitizedWorkspaceTitle}_readonly_${genSuffix()}`;
    const password = genPassword();

    const knex = await (
      await NcConnectionMgrv2.getWorkspaceDataKnex(fk_workspace_id)
    )?.transaction();

    const dataConfig = await NcConnectionMgrv2.getWorkspaceDataConfig(
      fk_workspace_id,
    );

    const database = dataConfig.connection.database;

    try {
      await createDatabaseUser(knex, username, password, database);
      await DataReflection.insert(
        {
          fk_workspace_id,
          username,
          password,
          // We use the workspace id as the database name for backlinking to data reflection record (TODO: move to using data reflection id)
          database: fk_workspace_id,
        },
        ncMeta,
      );

      const bases = await Base.listByWorkspace(fk_workspace_id, {}, ncMeta);
      for (const base of bases) {
        await grantAccessToSchema(knex, base.id, username);
      }

      await knex.commit();
    } catch (e) {
      await knex.rollback();
      if (e instanceof NcError || e instanceof NcBaseError) throw e;
      logger.error('Failed to create data reflection', e);
      NcError._.internalServerError('Failed to create data reflection');
    }

    return DataReflection.get({ fk_workspace_id }, ncMeta);
  }

  public static async destroy(fk_workspace_id: string, ncMeta = Noco.ncMeta) {
    const reflection = await DataReflection.get({ fk_workspace_id }, ncMeta);
    if (!reflection) return;

    const knex = await (
      await NcConnectionMgrv2.getWorkspaceDataKnex(fk_workspace_id)
    )?.transaction();

    const dataConfig = await NcConnectionMgrv2.getWorkspaceDataConfig(
      fk_workspace_id,
    );

    const database = dataConfig.connection.database;

    try {
      const bases = await Base.listByWorkspace(fk_workspace_id, {}, ncMeta);
      for (const base of bases) {
        await revokeAccessToSchema(knex, base.id, reflection.username);
      }

      await dropDatabaseUser(knex, reflection.username, database);
      await DataReflection.delete({ fk_workspace_id }, ncMeta);
      await knex.commit();
    } catch (e) {
      await knex.rollback();
      logger.error(`Failed to destroy reflection for ${fk_workspace_id}`, e);
    }
  }

  public static async grantBase(
    fk_workspace_id: string,
    base_id: string,
    ncMeta = Noco.ncMeta,
  ) {
    const reflection = await DataReflection.get({ fk_workspace_id }, ncMeta);
    if (!reflection) return;

    const knex = await (
      await NcConnectionMgrv2.getWorkspaceDataKnex(fk_workspace_id)
    )?.transaction();

    try {
      await grantAccessToSchema(knex, base_id, reflection.username);
      await knex.commit();
    } catch (e) {
      await knex.rollback();
      logger.error(
        `Failed to grant access to schema ${base_id} in ${fk_workspace_id}`,
      );
      logger.error(e);
    }
  }

  public static async revokeBase(
    fk_workspace_id: string,
    base_id: string,
    ncMeta = Noco.ncMeta,
  ) {
    const reflection = await DataReflection.get({ fk_workspace_id }, ncMeta);
    if (!reflection) return;

    const knex = await (
      await NcConnectionMgrv2.getWorkspaceDataKnex(fk_workspace_id)
    )?.transaction();

    try {
      await revokeAccessToSchema(knex, base_id, reflection.username);
      await knex.commit();
    } catch (e) {
      await knex.rollback();
      logger.error(
        `Failed to revoke access to schema ${base_id} in ${fk_workspace_id}`,
      );
      logger.error(e);
    }
  }

  public static async refreshAccess(
    fk_workspace_id: string,
    ncMeta = Noco.ncMeta,
  ) {
    const basesList = await Base.listByWorkspace(
      fk_workspace_id,
      {
        includeDeleted: true,
        includeSnapshot: true,
      },
      ncMeta,
    );

    const reflection = await DataReflection.get({ fk_workspace_id }, ncMeta);
    if (!reflection) return;

    const knex = await NcConnectionMgrv2.getWorkspaceDataKnex(fk_workspace_id);

    const dataConfig = await NcConnectionMgrv2.getWorkspaceDataConfig(
      fk_workspace_id,
    );

    const database = dataConfig.connection.database;

    for (const base of basesList) {
      try {
        await revokeAccessToSchema(knex, base.id, reflection.username);
      } catch (e) {
        logger.error(
          `Failed to revoke access to schema ${base.id} in ${fk_workspace_id}`,
        );
      }
    }

    try {
      await dropDatabaseUser(knex, reflection.username, database);
    } catch (e) {
      logger.error(e);
      logger.error(
        `Failed to drop database user ${reflection.username} in ${fk_workspace_id}`,
      );
    }

    const trx = await knex.transaction();

    try {
      await createDatabaseUser(
        trx,
        reflection.username,
        reflection.password,
        database,
      );

      for (const base of basesList) {
        if (base.deleted) continue;
        await grantAccessToSchema(trx, base.id, reflection.username);
      }

      await trx.commit();
    } catch (e) {
      await trx.rollback();
      logger.error(`Failed to refresh access for ${fk_workspace_id}`, e);
    }
  }
}

/**
 * Create a secure connection to PostgreSQL with SSL
 */
function createSecurePostgresConnection(
  dataConfig: any,
): Promise<TLSSocket | Socket> {
  return new Promise((resolve, reject) => {
    // Check if SSL is required
    const sslRequired = dataConfig.ssl || dataConfig.connection?.ssl;

    if (!sslRequired) {
      // Use plain socket for non-SSL connections
      const socket = new net.Socket();
      socket.connect(dataConfig.port, dataConfig.host, () => {
        resolve(socket);
      });
      socket.on('error', reject);
      return;
    }

    // First, establish a plain connection
    const plainSocket = new net.Socket();

    plainSocket.connect(dataConfig.port, dataConfig.host, () => {
      // Send SSL request (8 bytes: length + SSL request code)
      const sslRequest = Buffer.alloc(8);
      sslRequest.writeUInt32BE(8, 0); // length
      sslRequest.writeUInt32BE(80877103, 4); // SSL request code

      plainSocket.write(sslRequest);
    });

    plainSocket.once('data', (response: Buffer) => {
      const sslResponse = response[0];

      if (sslResponse === 0x53) {
        // 'S' - SSL supported
        // Upgrade to TLS
        const tlsOptions = {
          socket: plainSocket,
          rejectUnauthorized: false, // For self-signed certs - adjust based on your needs
          servername: dataConfig.host,
        };

        // Add SSL configuration if provided
        if (typeof dataConfig.ssl === 'object') {
          if (dataConfig.ssl.rejectUnauthorized !== undefined) {
            tlsOptions.rejectUnauthorized = dataConfig.ssl.rejectUnauthorized;
          }
        }

        const tlsSocket = tls.connect(tlsOptions, () => {
          logger.debug(
            `SSL connection established to ${dataConfig.host}:${dataConfig.port}`,
          );
          resolve(tlsSocket);
        });

        tlsSocket.on('error', (err) => {
          logger.error(`SSL connection error: ${err.message}`);
          reject(err);
        });
      } else if (sslResponse === 0x4e) {
        // 'N' - SSL not supported
        logger.warn(
          `SSL not supported by PostgreSQL server at ${dataConfig.host}:${dataConfig.port}`,
        );
        // Continue with plain connection
        resolve(plainSocket);
      } else {
        reject(new Error(`Unexpected SSL response: ${sslResponse}`));
      }
    });

    plainSocket.on('error', reject);
  });
}

function rewriteSASLMechanisms(buf: Buffer): Buffer {
  const saslMechs = parseNullDelimitedBuffer(buf.subarray(9));
  const filtered = saslMechs.filter((m) => m !== 'SCRAM-SHA-256-PLUS');

  if (filtered.length === 0) {
    NcError._.internalServerError('No valid SASL mechanisms after filtering');
  }

  const mechList = Buffer.concat(filtered.map((m) => Buffer.from(m + '\0')));

  const totalLength = 4 + 4 + mechList.length; // 4 (length), 4 (auth type), N

  const header = Buffer.alloc(9);
  header.writeUInt8(0x52, 0); // 'R'
  header.writeUInt32BE(totalLength, 1);
  header.writeUInt32BE(10, 5); // AuthenticationSASL

  return Buffer.concat([header, mechList]);
}

/**
 * Handle the startup message from the client and establish secure backend connection
 */
async function handleStartupMessage(
  clientSocket: Socket,
  data: Buffer,
  clientId: string,
) {
  let session = clientSessions.get(clientId);

  if (!session) {
    clientSessions.set(clientId, new DataReflectionSession(clientId));
    session = clientSessions.get(clientId);
  }

  if (session.connected) {
    return;
  }

  // Handle SSLRequest from client (always deny - client connects in plain text)
  if (data.length === 8 && data.readUInt32BE(4) === 80877103) {
    // Respond 'N' (no SSL) to client - proxy handles SSL to backend
    clientSocket.write(Buffer.from([0x4e]));
    return;
  }

  const textData = data.toString('utf-8');

  // If no database field, return handshake
  if (!textData.includes('database')) {
    clientSocket.write(Buffer.from([0x4e, 0, 0, 0, 0]));
    return;
  }

  // Parse startup message
  const protocolVersion = data.readUInt32BE(4);
  const startupBody = data.subarray(8);
  const parts = parseNullDelimitedBuffer(startupBody);

  let workspaceId: string | undefined;
  for (let i = 0; i < parts.length; i += 2) {
    const key = parts[i];
    const value = parts[i + 1];

    if (key === 'database') {
      workspaceId = value;

      const reflection = await DataReflectionCE.get({
        fk_workspace_id: workspaceId,
      });

      if (!reflection) {
        // No reflection: terminate connection
        clientSocket.write(Buffer.from([0x58, 0, 0, 0, 4]));
        session.close(clientSocket);
        return;
      }

      try {
        // Get data configuration
        const dataConfig = (
          await NcConnectionMgrv2.getWorkspaceDataConfig(workspaceId)
        ).connection;

        // postgresql://username:password@db-id-pooler.region.aws.neon.tech/nocodb?sslmode=require&channel_binding=require
        dataConfig.host = dataConfig.host.replace(
          /-pooler(\..*\.neon\.tech)/,
          '$1',
        );

        // Create secure connection to PostgreSQL
        const pgSocket = await createSecurePostgresConnection(dataConfig);

        // Prepare session
        const availableSchemas = await DataReflection.availableSchemas(
          reflection.fk_workspace_id,
        );

        session.pgSocket = pgSocket;
        session.connected = true;
        session.fk_workspace_id = workspaceId;
        session.availableSchemas = availableSchemas;
        session.pgUser = reflection.username;
        session.pgDatabase = dataConfig.database;

        // Use the underlying DB name from the actual Postgres connection
        parts[i + 1] = dataConfig.database;

        // Inject session-level timeout limits via startup options
        const timeoutOpts =
          '-c statement_timeout=60000 -c idle_in_transaction_session_timeout=60000';
        let optionsInjected = false;
        for (let j = 0; j < parts.length; j += 2) {
          if (parts[j] === 'options') {
            parts[j + 1] = `${parts[j + 1]} ${timeoutOpts}`;
            optionsInjected = true;
            break;
          }
        }
        if (!optionsInjected) {
          // Insert before the trailing empty string
          const lastIdx = parts.length - 1;
          if (parts[lastIdx] === '') {
            parts.splice(lastIdx, 0, 'options', timeoutOpts);
          } else {
            parts.push('options', timeoutOpts, '');
          }
        }

        // Rebuild startup message for backend
        const newBody = parts
          .map((part) => Buffer.concat([Buffer.from(part), Buffer.from([0])]))
          .reduce((acc, cur) => Buffer.concat([acc, cur]), Buffer.alloc(0));

        const newHeader = Buffer.alloc(8);
        newHeader.writeUInt32BE(8 + newBody.length, 0);
        newHeader.writeUInt32BE(protocolVersion, 4);
        const newStartupMessage = Buffer.concat([newHeader, newBody]);

        // Send startup message to backend
        pgSocket.write(newStartupMessage);

        // Handle responses from PostgreSQL
        pgSocket.on('data', (data: Buffer) => {
          try {
            const messageType = data.readUInt8(0);

            if (messageType === 0x52) {
              const authType = data.readUInt32BE(5);
              if (authType === 10) {
                const rewritten = rewriteSASLMechanisms(data);

                clientSocket.write(rewritten);
                return;
              }
            }

            // Track query completion
            switch (messageType) {
              case 0x54: // RowDescription
              case 0x44: // DataRow
              case 0x43: // CommandComplete
              case 0x45: // ErrorResponse
              case 0x49: // EmptyQueryResponse
              case 0x5a: // ReadyForQuery
                {
                  const session = clientSessions.get(clientId);
                  session?.recordQueryEnd();
                }
                break;
            }

            clientSocket.write(data);
          } catch (error) {
            logger.error(`Error processing Postgres data: ${error.message}`);
            clientSocket.write(data);
          }
        });

        pgSocket.on('error', (err) => {
          logger.error(`Postgres socket error: ${err.message}`);
          const session = clientSessions.get(clientId);
          if (session) {
            session.close(clientSocket);
          }
        });

        pgSocket.on('end', () => {
          const session = clientSessions.get(clientId);
          if (session) {
            session.close(clientSocket);
          }
        });
      } catch (error) {
        logger.error(`Failed to establish secure connection: ${error.message}`);
        clientSocket.write(Buffer.from([0x58, 0, 0, 0, 4])); // Terminate
        session.close(clientSocket);
        return;
      }
    }
  }
}

// Settings allowed through SHOW and pg_settings (same whitelist for consistency)
const allowedShowSettings = new Set([
  'server_version',
  'server_encoding',
  'client_encoding',
  'standard_conforming_strings',
  'datestyle',
  'timezone',
  'intervalstyle',
  'integer_datetimes',
  'application_name',
  'default_transaction_read_only',
  'is_superuser',
  'session_authorization',
  'lc_messages',
  'lc_monetary',
  'lc_numeric',
  'lc_time',
  'bytea_output',
  'xmloption',
  'statement_timeout',
  'idle_in_transaction_session_timeout',
  'search_path',
  'transaction_isolation',
  'transaction_read_only',
]);

/**
 * Recursively walk the AST and apply intercept rules to all SELECT statements,
 * including those inside subqueries, CTEs, and WHERE clauses.
 */
function applyInterceptRulesRecursive(
  node: any,
  session: DataReflectionSession,
  visited = new WeakSet(),
): boolean {
  if (!node || typeof node !== 'object' || visited.has(node)) return false;
  visited.add(node);

  // Skip nodes generated by our own subquery builders (prevents double-filtering)
  if (node._ncGenerated) return false;

  let modified = false;

  // Apply intercept rules to SELECT statements with FROM clauses
  if (node.type === 'select' && node.from && Array.isArray(node.from)) {
    // 1. Text-column based intercept rules (schemaname, nspname, etc.)
    for (const target of interceptMap) {
      const targetFrom = node.from.find(
        (f: any) => f.table === target.table_name,
      );
      if (!targetFrom) continue;

      const alias = targetFrom.as || targetFrom.table;
      const additionalClause = generateWhereClause(
        alias,
        target.column_name,
        target.type,
        target.value ? target.value : session[target.sessionValue],
      );

      if (node.where) {
        node.where = {
          type: 'binary_expr',
          operator: 'AND',
          left: node.where,
          right: additionalClause,
        };
      } else {
        node.where = additionalClause;
      }
      modified = true;
    }

    // 2. OID-based namespace filters for catalog tables (pg_class, pg_type, pg_attribute, etc.)
    for (const filter of catalogNamespaceFilters) {
      const targetFrom = node.from.find(
        (f: any) => f.table === filter.table_name,
      );
      if (!targetFrom) continue;

      const alias = targetFrom.as || targetFrom.table;
      const schemas = session.availableSchemas || [];

      const additionalClause =
        filter.mode === 'direct'
          ? buildNamespaceOidSubquery(alias, filter.column_name, schemas)
          : buildNestedClassSubquery(alias, filter.column_name, schemas);

      if (node.where) {
        node.where = {
          type: 'binary_expr',
          operator: 'AND',
          left: node.where,
          right: additionalClause,
        };
      } else {
        node.where = additionalClause;
      }
      modified = true;
    }
  }

  // Recurse into all child nodes to find nested SELECTs
  for (const key of Object.keys(node)) {
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (typeof item === 'object' && item !== null) {
          if (applyInterceptRulesRecursive(item, session, visited))
            modified = true;
        }
      }
    } else if (typeof child === 'object' && child !== null) {
      if (applyInterceptRulesRecursive(child, session, visited))
        modified = true;
    }
  }

  return modified;
}

/**
 * Attempt to parse and intercept the query.
 * If it matches our interception rules inject a WHERE clause to restrict the query.
 * Return modified query buffer if successful (undefined otherwise).
 */
async function interceptQueryIfNeeded(
  data: Buffer,
  session: DataReflectionSession,
  parser: Parser,
): Promise<Buffer | undefined> {
  // Extract the query text from the buffer
  // Byte 0: Message type (0x51 for 'Q')
  // Bytes 1-4: Message length
  let queryText = data.subarray(5).toString('utf8').replace(/\0/g, '');

  // Check for blocked patterns before parsing
  for (const { pattern, message } of blockedQueryPatterns) {
    if (pattern.test(queryText)) {
      throw new QueryBlockedError(message);
    }
  }

  // Block SHOW for sensitive settings (SHOW bypasses the AST-based interceptor)
  const showMatch = queryText.match(/^\s*SHOW\s+(ALL|[\w]+)\s*;?\s*$/i);
  if (showMatch) {
    const setting = showMatch[1].toLowerCase();
    if (!allowedShowSettings.has(setting)) {
      throw new QueryBlockedError(`SHOW ${showMatch[1]} is not permitted`);
    }
  }

  // Rewrite current_database() and current_catalog to return the workspace ID
  let forceModified = false;
  const rewritten = queryText
    .replace(/\bcurrent_database\s*\(\s*\)/gi, `'${session.fk_workspace_id}'`)
    .replace(/\bcurrent_catalog\b/gi, `'${session.fk_workspace_id}'`);
  if (rewritten !== queryText) {
    queryText = rewritten;
    forceModified = true;
  }

  let ast;
  try {
    ast = parser.astify(queryText, { database: 'postgresql' });
  } catch (e) {
    logger.error('Failed to parse query:', queryText);
    // If we already rewrote current_database(), serialize the text directly
    if (forceModified) {
      return serialize.query(queryText);
    }
    return undefined;
  }

  const astArray = Array.isArray(ast) ? ast : [ast];
  let modified = false;

  for (const statement of astArray) {
    if (applyInterceptRulesRecursive(statement, session)) {
      modified = true;
    }
  }

  if (!modified && !forceModified) {
    return undefined;
  }

  // Convert the AST back to SQL
  const modifiedQuery = parser.sqlify(
    astArray.length === 1 ? astArray[0] : astArray,
    {
      database: 'postgresql',
    },
  );

  // Serialize the modified query into a PostgreSQL wire protocol query message
  return serialize.query(modifiedQuery);
}

/**
 * Splits a buffer by null bytes into a list of strings.
 */
function parseNullDelimitedBuffer(buf: Buffer): string[] {
  const bytes = Array.from(buf);
  const parts: string[] = [];
  let temp: number[] = [];

  for (const byte of bytes) {
    if (byte === 0) {
      parts.push(Buffer.from(temp).toString('utf8'));
      temp = [];
    } else {
      temp.push(byte);
    }
  }

  // If there's trailing non-null content (shouldn't happen in startup messages but just in case)
  if (temp.length > 0) {
    parts.push(Buffer.from(temp).toString('utf8'));
  }

  return parts;
}
