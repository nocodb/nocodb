import net from 'net';
import getPort from 'get-port';
import { nanoid } from 'nanoid';
import { serialize } from 'pg-protocol';
import { Parser } from 'node-sql-parser';
import { Logger } from '@nestjs/common';
import DataReflectionCE from 'src/models/DataReflection';
import type { Socket } from 'net';
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

const logger = new Logger('DataReflection');

// Environment variables
const NC_DATA_REFLECTION_DB_HOST = process.env.NC_DATA_REFLECTION_DB_HOST;
const NC_DATA_REFLECTION_DB_PORT = +process.env.NC_DATA_REFLECTION_DB_PORT;
const NC_DATA_REFLECTION_WINDOW_SIZE =
  +process.env.NC_DATA_REFLECTION_WINDOW_SIZE || 60_000;
const NC_DATA_REFLECTION_QUERY_LIMIT =
  +process.env.NC_DATA_REFLECTION_QUERY_LIMIT || 60;

// Interception rules
// For these tables and columns append a WHERE clause to restrict schemas
const interceptMap = [
  { table_name: 'pg_namespace', column_name: 'nspname' },
  { table_name: 'schemata', column_name: 'schema_name' },
  { table_name: 'pg_tables', column_name: 'schemaname' },
];

class DataReflectionSession {
  private closed = false;
  private queryTimestamps: number[] = [];
  private totalQueryTime = 0;
  private totalQueries = 0;
  private readonly sessionStartTime: number;

  public constructor(
    public readonly clientId: string,
    public readonly fk_workspace_id: string,
    public readonly availableSchemas: string[],
  ) {
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

    // TODO: Save session stats
    logger.log(
      `Session closed for ${this.clientId} (${this.fk_workspace_id}). ` +
        `Total query time: ${this.totalQueryTime}ms, Total queries: ${this.totalQueries}`,
    );
    logger.log(`Total session time: ${Date.now() - this.sessionStartTime}ms`);
  }
}

const clientSessions = new Map<string, DataReflectionSession>();

function generateWhereClause(
  table: string,
  column: string,
  allowedSchemas: string[],
) {
  return {
    type: 'binary_expr',
    operator: 'in',
    left: {
      type: 'column_ref',
      table,
      column: {
        expr: {
          type: 'default',
          value: column,
        },
      },
    },
    right: {
      type: 'expr_list',
      value: allowedSchemas.map((schema) => ({
        type: 'string',
        value: schema,
      })),
    },
  };
}

export default class DataReflection extends DataReflectionCE {
  /**
   * Initialize the data reflection proxy server.
   * This server acts as a middleware layer between the clients and the actual PostgreSQL server.
   */
  public static async init(): Promise<void> {
    const dataConfig: {
      client: string;
      host: string;
      port: number;
      database: string;
    } = (await NcConnectionMgrv2.getDataConfig()).connection as any;

    const parser = new Parser();

    const server = net.createServer((clientSocket: Socket) => {
      const clientId = nanoid();

      const pgSocket = new net.Socket();

      logger.log(
        `Client ${clientId} connected ${
          NC_DATA_REFLECTION_DB_HOST || dataConfig.host
        }:${NC_DATA_REFLECTION_DB_PORT || dataConfig.port}`,
      );

      pgSocket.connect(
        NC_DATA_REFLECTION_DB_PORT || dataConfig.port,
        NC_DATA_REFLECTION_DB_HOST || dataConfig.host,
      );

      clientSocket.on('data', async (data: Buffer) => {
        try {
          const messageType = data.readUInt8(0);

          // Handle startup message (no message type for startup; often 0)
          if (messageType === 0) {
            return handleStartupMessage(data, pgSocket, clientId, dataConfig);
          }

          // 'Q' (0x51) message: Simple Query
          if (messageType === 0x51) {
            const session = clientSessions.get(clientId);
            if (!session) {
              // If we don't have a session for this client terminate the connection
              clientSocket.end();
              pgSocket.end();
              return;
            }

            // Check query frequency limit
            const queryCount = session.queryCountWithinWindow();
            if (queryCount > NC_DATA_REFLECTION_QUERY_LIMIT) {
              logger.warn(
                `Too many queries for workspace ${session.fk_workspace_id}. Closing connection.`,
              );
              clientSocket.end();
              pgSocket.end();
              return;
            }

            session.recordQueryStart();

            const modifiedQueryBuffer = await interceptQueryIfNeeded(
              data,
              session,
              parser,
            );

            // If we modified the query write that; otherwise fallback to the original data
            pgSocket.write(modifiedQueryBuffer ?? data);
            return;
          }

          pgSocket.write(data);
        } catch (error) {
          logger.error(`Error processing client data: ${error.message}.`);
          pgSocket.write(data); // Fallback to original data
        }
      });

      pgSocket.on('data', (data: Buffer) => {
        try {
          const messageType = data.readUInt8(0);

          // Messages indicating end of a query execution cycle
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
          logger.error(`Error processing Postgres data: ${error.message}.`);
          clientSocket.write(data); // Fallback to original data
        }
      });

      pgSocket.on('error', (err) => {
        logger.error(`Postgres socket error: ${err.message}`);
        clientSocket.end();
      });

      clientSocket.on('error', (err) => {
        logger.error(`Client socket error: ${err.message}`);
        pgSocket.end();
      });

      clientSocket.on('end', () => {
        clientSessions.get(clientId)?.close();
        pgSocket.end();
      });

      pgSocket.on('end', () => {
        clientSessions.get(clientId)?.close();
        clientSocket.end();
      });
    });

    const port = await getPort({
      port: getPort.makeRange(
        NC_DATA_REFLECTION_SETTINGS.port,
        NC_DATA_REFLECTION_SETTINGS.port + 100,
      ),
    });

    // Update the port in the settings
    NC_DATA_REFLECTION_SETTINGS.port = port;

    server.listen(port, () => {
      logger.log(`Proxy server listening on port ${port}`);

      server.unref();
    });
  }

  public static async create(fk_workspace_id: string, ncMeta = Noco.ncMeta) {
    const workspace = await Workspace.get(fk_workspace_id, false, ncMeta);

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const sanitizedWorkspaceTitle = workspace.title.replace(/[^a-z0-9]/gi, '_');

    const username = `nc_${sanitizedWorkspaceTitle}_readonly_${genSuffix()}`;
    const password = genPassword();
    const database = workspace.id;

    const knex = await (await NcConnectionMgrv2.getDataKnex())?.transaction();

    try {
      await createDatabaseUser(knex, username, password);

      await DataReflection.insert(
        {
          fk_workspace_id,
          username,
          password,
          database,
        },
        ncMeta,
      );

      const bases = await Base.listByWorkspace(fk_workspace_id, false, ncMeta);

      for (const base of bases) {
        await grantAccessToSchema(knex, base.id, username);
      }

      await knex.commit();
    } catch (e) {
      await knex.rollback();
      throw e;
    }

    return DataReflection.get({ fk_workspace_id }, ncMeta);
  }

  public static async destroy(fk_workspace_id: string, ncMeta = Noco.ncMeta) {
    const reflection = await DataReflection.get({ fk_workspace_id }, ncMeta);

    if (!reflection) {
      return;
    }

    const knex = await (await NcConnectionMgrv2.getDataKnex())?.transaction();

    try {
      const bases = await Base.listByWorkspace(fk_workspace_id, false, ncMeta);

      for (const base of bases) {
        await revokeAccessToSchema(knex, base.id, reflection.username);
      }

      await dropDatabaseUser(knex, reflection.username);

      await DataReflection.delete({ fk_workspace_id }, ncMeta);

      await knex.commit();
    } catch (e) {
      await knex.rollback();
      logger.error(`Failed to destroy reflection for ${fk_workspace_id}`);
      logger.error(e);
    }

    return;
  }

  public static async grantBase(
    fk_workspace_id: string,
    base_id: string,
    ncMeta = Noco.ncMeta,
  ) {
    const reflection = await DataReflection.get({ fk_workspace_id }, ncMeta);

    if (!reflection) {
      return;
    }

    const knex = await (await NcConnectionMgrv2.getDataKnex())?.transaction();

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

    if (!reflection) {
      return;
    }

    const knex = await (await NcConnectionMgrv2.getDataKnex())?.transaction();

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
 * Handle the startup message from the client.
 * Extract the workspace ID from the 'database' field and set up a session.
 * If data reflection is not set up for the workspace terminate the connection.
 */
async function handleStartupMessage(
  data: Buffer,
  pgSocket: Socket,
  clientId: string,
  dataConfig: { database: string },
) {
  const textData = data.toString('utf-8');

  // If no database field just forward the startup message as is (possible handshake)
  if (!textData.includes('database')) {
    pgSocket.write(data);
    return;
  }

  // Extract key-value pairs from the startup message
  const protocolVersion = data.readUInt32BE(4);
  const startupBody = data.subarray(8);
  const parts = parseNullDelimitedBuffer(startupBody);

  // Identify and replace 'database' field
  let workspaceId: string | undefined;
  for (let i = 0; i < parts.length; i += 2) {
    const key = parts[i];
    const value = parts[i + 1];
    if (key === 'database') {
      workspaceId = value;
      // Attempt to fetch the reflection object for this workspace
      const reflection = await DataReflectionCE.get({
        fk_workspace_id: workspaceId,
      });
      if (!reflection) {
        // No reflection: terminate the connection with an 'X' (Terminate) message
        const terminateBuffer = Buffer.from([0x58, 0, 0, 0, 4]);
        pgSocket.write(terminateBuffer);
        return;
      }

      // Prepare session
      const availableSchemas = await DataReflection.availableSchemas(
        reflection.fk_workspace_id,
      );
      clientSessions.set(
        clientId,
        new DataReflectionSession(clientId, workspaceId, availableSchemas),
      );

      // Use the underlying DB name from the actual Postgres connection
      parts[i + 1] = dataConfig.database;
    }
  }

  // Rebuild the startup message
  const newBody = parts
    .map((part) => Buffer.concat([Buffer.from(part), Buffer.from([0])]))
    .reduce((acc, cur) => Buffer.concat([acc, cur]), Buffer.alloc(0));

  const newHeader = Buffer.alloc(8);
  newHeader.writeUInt32BE(8 + newBody.length, 0);
  newHeader.writeUInt32BE(protocolVersion, 4);
  const newStartupMessage = Buffer.concat([newHeader, newBody]);

  pgSocket.write(newStartupMessage);
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
        session.availableSchemas,
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
