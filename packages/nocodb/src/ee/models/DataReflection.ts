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
  value?: string;
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
];

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
  }

  public recordQueryEnd(): void {
    const now = Date.now();
    const start = this.queryTimestamps[0];
    if (!start) return;

    this.totalQueryTime += now - start;
    this.cleanupOldTimestamps();
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

  public close(): void {
    if (this.closed) return;
    this.closed = true;

    logger.log(
      `Session closed for ${this.clientId} (${this.fk_workspace_id}). ` +
        `Total query time: ${this.totalQueryTime}ms, Total queries: ${this.totalQueries}`,
    );
    logger.log(`Total session time: ${Date.now() - this.sessionStartTime}ms`);
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

      logger.log(`Client ${clientId} connected`);

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
              clientSocket.end();
              session.pgSocket?.end();
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
          clientSocket.end();
          return;
        }
        clientSocket.end();
        session.pgSocket?.end();
      });

      clientSocket.on('end', () => {
        clientSessions.get(clientId)?.close();
        const session = clientSessions.get(clientId);
        if (!session) {
          return;
        }
        session.pgSocket?.end();
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
          logger.log(
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
          clientSocket.end();
        });

        pgSocket.on('end', () => {
          clientSessions.get(clientId)?.close();
          clientSocket.end();
        });
      } catch (error) {
        logger.error(`Failed to establish secure connection: ${error.message}`);
        clientSocket.write(Buffer.from([0x58, 0, 0, 0, 4])); // Terminate
        return;
      }
    }
  }
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
  const queryText = data.subarray(5).toString('utf8').replace(/\0/g, '');

  let ast;
  try {
    ast = parser.astify(queryText, { database: 'postgresql' });
  } catch (e) {
    logger.error('Failed to parse query:', queryText);
    return undefined;
  }

  const astArray = Array.isArray(ast) ? ast : [ast];
  let modified = false;

  for (const statement of astArray) {
    if (statement.type !== 'select') continue;
    // Check if the FROM clause includes a table that we need to intercept
    if (!statement.from || !Array.isArray(statement.from)) continue;

    for (const target of interceptMap) {
      const targetFrom = statement.from.find(
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

      // Inject the additional WHERE clause
      if (statement.where) {
        statement.where = {
          type: 'binary_expr',
          operator: 'AND',
          left: statement.where,
          right: additionalClause,
        };
      } else {
        statement.where = additionalClause;
      }
      modified = true;
    }
  }

  if (!modified) {
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
