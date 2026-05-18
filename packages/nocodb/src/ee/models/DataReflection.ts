import net from 'net';
import tls from 'tls';
import getPort from 'get-port';
import { nanoid } from 'nanoid';
import { Parser } from 'node-sql-parser';
import { Logger } from '@nestjs/common';
import DataReflectionCE from 'src/models/DataReflection';
import { NcBaseError } from 'nocodb-sdk';
import type { Socket } from 'net';
import type { TLSSocket } from 'tls';
import type { InterceptSession } from '~/helpers/dataReflectionInterceptor';
import { NcError } from '~/helpers/ncError';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { Base, Workspace } from '~/models';
import Noco from '~/Noco';
import {
  createDatabaseUser,
  dropDatabaseUser,
  genPassword,
  genSuffix,
  grantAccessToSchema,
  NC_DATA_REFLECTION_SETTINGS,
  revokeAccessToSchema,
} from '~/helpers/dataReflectionHelpers';
import {
  buildPgErrorResponse,
  interceptQueryIfNeeded,
  parseNullDelimitedBuffer,
  QueryBlockedError,
  rewriteSASLMechanisms,
} from '~/helpers/dataReflectionInterceptor';

const logger = new Logger('DataReflection');

// Environment variables
const NC_DATA_REFLECTION_WINDOW_SIZE =
  +process.env.NC_DATA_REFLECTION_WINDOW_SIZE || 60_000;
const NC_DATA_REFLECTION_QUERY_LIMIT =
  +process.env.NC_DATA_REFLECTION_QUERY_LIMIT || 60;

class DataReflectionSession implements InterceptSession {
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
              (q) =>
                logger.error(
                  `Failed to parse query: ${q.slice(0, 128)}${
                    q.length > 128 ? '...' : ''
                  }`,
                ),
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

  public static async create(fk_workspace_id: string, ncMeta = Noco.ncMeta) {
    const workspace = await Workspace.get(fk_workspace_id, false, ncMeta);

    if (!workspace) {
      NcError._.workspaceNotFound(fk_workspace_id);
    }

    // Idempotent at the caller level: if a reflection already exists, return it.
    const existing = await DataReflection.get({ fk_workspace_id }, ncMeta);
    if (existing) return existing;

    const sanitizedWorkspaceTitle = workspace.title.replace(/[^a-z0-9]/gi, '_');
    const username = `nc_${sanitizedWorkspaceTitle}_readonly_${genSuffix()}`;
    const password = genPassword();

    // Resolve the workspace knex + database name BEFORE opening a transaction.
    // If either lookup throws (Redis hiccup, missing dbServer, null deref), an
    // already-opened trx would have no try/catch covering it and would leak
    // its pg connection as `idle in transaction` until the server reaped it.
    const workspaceKnex = await NcConnectionMgrv2.getWorkspaceDataKnex(
      fk_workspace_id,
    );
    const dataConfig = await NcConnectionMgrv2.getWorkspaceDataConfig(
      fk_workspace_id,
    );
    const database = dataConfig.connection.database;

    if (!workspaceKnex) {
      NcError._.internalServerError(
        'Workspace data DB is not available for data reflection setup',
      );
    }

    // Resolve meta-side data BEFORE opening the workspace-DB trx so we don't
    // hold the trx open during a meta query.
    const bases = await Base.listByWorkspace(fk_workspace_id, {}, ncMeta);

    // Phase 1 — provision the role + grants in the workspace data DB.
    // Single transaction so any partial failure rolls back cleanly.
    const trx = await workspaceKnex.transaction();
    try {
      await createDatabaseUser(trx, username, password, database);
      for (const base of bases) {
        await grantAccessToSchema(trx, base.id, username);
      }
      await trx.commit();
    } catch (e) {
      await trx.rollback().catch(() => {});
      if (e instanceof NcError || e instanceof NcBaseError) throw e;
      logger.error(`Failed to create data reflection: ${e.message}`, e.stack);
      NcError._.internalServerError('Failed to create data reflection');
    }

    // Phase 2 — persist meta. If this fails, compensate by dropping the role
    // we just created so we don't leave a usable orphan in the data DB.
    try {
      await DataReflection.insert(
        {
          fk_workspace_id,
          username,
          password,
          // Logical (proxy-facing) database name for the connection string.
          // The proxy rewrites this to the real DB name on startup.
          database: fk_workspace_id,
        },
        ncMeta,
      );
    } catch (e) {
      logger.error(
        `Failed to persist data reflection meta for ${fk_workspace_id}; rolling back DB role: ${e.message}`,
        e.stack,
      );
      try {
        const cleanup = await workspaceKnex.transaction();
        try {
          await dropDatabaseUser(cleanup, username, database);
          await cleanup.commit();
        } catch (cleanupInner) {
          await cleanup.rollback().catch(() => {});
          throw cleanupInner;
        }
      } catch (cleanupErr) {
        logger.error(
          `Compensating drop of data reflection role ${username} failed for ${fk_workspace_id}: ${cleanupErr.message}`,
          cleanupErr.stack,
        );
      }
      throw e;
    }

    return DataReflection.get({ fk_workspace_id }, ncMeta);
  }

  public static async destroy(fk_workspace_id: string, ncMeta = Noco.ncMeta) {
    const reflection = await DataReflection.get({ fk_workspace_id }, ncMeta);
    if (!reflection) return;

    const workspaceKnex = await NcConnectionMgrv2.getWorkspaceDataKnex(
      fk_workspace_id,
    );
    const dataConfig = await NcConnectionMgrv2.getWorkspaceDataConfig(
      fk_workspace_id,
    );
    const database = dataConfig.connection.database;

    // Only delete the meta row after the DB-side cleanup succeeds — otherwise
    // we'd orphan the role with no way to find it from meta. If the DB is
    // unavailable, leave meta in place and let the next destroy retry.
    let dbCleanupOk = !workspaceKnex;
    if (workspaceKnex) {
      // Resolve bases before opening the trx — meta query stays outside.
      const bases = await Base.listByWorkspace(
        fk_workspace_id,
        { includeDeleted: true, includeSnapshot: true },
        ncMeta,
      );
      const trx = await workspaceKnex.transaction();
      try {
        for (const base of bases) {
          await revokeAccessToSchema(trx, base.id, reflection.username);
        }
        await dropDatabaseUser(trx, reflection.username, database);
        await trx.commit();
        dbCleanupOk = true;
      } catch (e) {
        await trx.rollback().catch(() => {});
        logger.error(
          `Failed to destroy data reflection role for ${fk_workspace_id}: ${e.message}`,
          e.stack,
        );
      }
    }

    if (dbCleanupOk) {
      await DataReflection.delete({ fk_workspace_id }, ncMeta);
    }
  }

  public static async grantBase(
    fk_workspace_id: string,
    base_id: string,
    ncMeta = Noco.ncMeta,
  ) {
    const reflection = await DataReflection.get({ fk_workspace_id }, ncMeta);
    if (!reflection) return;

    const workspaceKnex = await NcConnectionMgrv2.getWorkspaceDataKnex(
      fk_workspace_id,
    );
    if (!workspaceKnex) return;

    // Single atomic DO block — no trx needed, the server-side guard is the
    // unit of atomicity. Best-effort: failures here shouldn't block base creation.
    try {
      await grantAccessToSchema(workspaceKnex, base_id, reflection.username);
    } catch (e) {
      logger.error(
        `Failed to grant access to schema ${base_id} in ${fk_workspace_id}: ${e.message}`,
        e.stack,
      );
    }
  }

  public static async revokeBase(
    fk_workspace_id: string,
    base_id: string,
    ncMeta = Noco.ncMeta,
  ) {
    const reflection = await DataReflection.get({ fk_workspace_id }, ncMeta);
    if (!reflection) return;

    const workspaceKnex = await NcConnectionMgrv2.getWorkspaceDataKnex(
      fk_workspace_id,
    );
    if (!workspaceKnex) return;

    // Single atomic DO block — no trx needed. Best-effort: failures here
    // shouldn't block base deletion.
    try {
      await revokeAccessToSchema(workspaceKnex, base_id, reflection.username);
    } catch (e) {
      logger.error(
        `Failed to revoke access to schema ${base_id} in ${fk_workspace_id}: ${e.message}`,
        e.stack,
      );
    }
  }

  // Reconcile the data reflection role with the current set of bases in one
  // atomic transaction. Drops + recreates the role inside the trx so a partial
  // failure rolls back to the previous state — never leaves the workspace with
  // a missing role. All helpers are idempotent and skip missing roles/schemas,
  // so ghost meta rows don't abort the flow.
  public static async refreshAccess(
    fk_workspace_id: string,
    ncMeta = Noco.ncMeta,
  ) {
    const reflection = await DataReflection.get({ fk_workspace_id }, ncMeta);
    if (!reflection) return;

    const basesList = await Base.listByWorkspace(
      fk_workspace_id,
      { includeDeleted: true, includeSnapshot: true },
      ncMeta,
    );

    const workspaceKnex = await NcConnectionMgrv2.getWorkspaceDataKnex(
      fk_workspace_id,
    );
    if (!workspaceKnex) {
      logger.warn(
        `No workspace data DB for ${fk_workspace_id}; skipping data reflection refresh`,
      );
      return;
    }

    const dataConfig = await NcConnectionMgrv2.getWorkspaceDataConfig(
      fk_workspace_id,
    );
    const database = dataConfig.connection.database;

    const trx = await workspaceKnex.transaction();
    try {
      // 1. Tear down: revoke + drop. Both idempotent — schemas that don't
      //    exist (ghost meta rows for deleted bases) are silently skipped.
      for (const base of basesList) {
        await revokeAccessToSchema(trx, base.id, reflection.username);
      }
      await dropDatabaseUser(trx, reflection.username, database);

      // 2. Rebuild: create the role and grant against every live base.
      //    Grant helper is idempotent — missing schemas are skipped, so a
      //    snapshot base without a physical schema won't abort the trx.
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
      await trx.rollback().catch(() => {});
      logger.error(
        `Failed to refresh access for ${fk_workspace_id}: ${e.message}`,
        e.stack,
      );
      throw e;
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

        // Sanitize and inject session-level timeout limits via startup options.
        // Client-provided -c params are filtered to a whitelist of harmless GUCs
        // to prevent bypassing the SET command whitelist via startup options.
        const ALLOWED_STARTUP_GUCS = new Set([
          'application_name',
          'client_encoding',
          'datestyle',
          'timezone',
          'intervalstyle',
          'extra_float_digits',
          'geqo',
          'lc_messages',
          'lc_monetary',
          'lc_numeric',
          'lc_time',
        ]);

        const timeoutOpts =
          '-c statement_timeout=60000 -c idle_in_transaction_session_timeout=60000';

        let optionsInjected = false;
        for (let j = 0; j < parts.length; j += 2) {
          if (parts[j] === 'options') {
            // Parse client options, keep only whitelisted -c params and non -c flags
            const clientOpts = parts[j + 1] as string;
            const sanitized = clientOpts
              .split(/(?=-c\s)/)
              .map((s) => s.trim())
              .filter((segment) => {
                const match = segment.match(
                  /^-c\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=/,
                );
                if (match) {
                  return ALLOWED_STARTUP_GUCS.has(match[1].toLowerCase());
                }
                // Keep non -c flags (e.g. --search_path) — they're harmless
                return !segment.startsWith('-c');
              })
              .join(' ');

            parts[j + 1] = `${sanitized} ${timeoutOpts}`.trim();
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
