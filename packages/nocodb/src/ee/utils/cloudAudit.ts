import dayjs from 'dayjs';
import {
  KinesisClient,
  PutRecordCommand,
  PutRecordsCommand,
} from '@aws-sdk/client-kinesis';
import { createClient } from '@clickhouse/client';
import { NO_SCOPE } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { Audit } from '~/models';

const kinesisConfig = {
  region: process.env.NC_KINESIS_REGION,
  credentials: {
    accessKeyId: process.env.NC_KINESIS_ACCESS_KEY_ID,
    secretAccessKey: process.env.NC_KINESIS_SECRET_ACCESS_KEY,
  },
};

const auditClickhouseConfig = {
  url: process.env.NC_AUDIT_CLICKHOUSE_URL,
  username: process.env.NC_AUDIT_CLICKHOUSE_USER,
  password: process.env.NC_AUDIT_CLICKHOUSE_PASSWORD,
  database: process.env.NC_AUDIT_CLICKHOUSE_DATABASE,
};

const streamName = process.env.NC_KINESIS_STREAM_NAME;

const clickhouseAuditTable = process.env.NC_AUDIT_CLICKHOUSE_TABLE;

const kinesisClient = new KinesisClient(kinesisConfig);
const clickhouseClient = createClient(auditClickhouseConfig);

export async function getChRecordAudit(
  context: NcContext,
  {
    fk_model_id,
    row_id,
    cursor,
    limit = 25,
  }: {
    fk_model_id: string;
    row_id: string;
    cursor?: string;
    limit?: number;
  },
) {
  if (
    !auditClickhouseConfig.url ||
    !auditClickhouseConfig.username ||
    !auditClickhouseConfig.password
  ) {
    return [];
  }

  if (!context.workspace_id || !fk_model_id || !row_id) {
    return [];
  }

  const cursorParts = cursor?.split('|') ?? [];

  let id: string | undefined;
  let created_at: string | undefined;

  if (cursorParts.length === 2) {
    id = cursorParts[0];
    created_at = dayjs(cursorParts[1]).format('YYYY-MM-DD HH:mm:ss');
  }

  const queryParams: Record<string, any> = {
    workspace_id: context.workspace_id,
    model_id: fk_model_id,
    row_id: row_id,
    limit: limit,
  };

  let query = `
    SELECT * FROM ${clickhouseAuditTable}
    WHERE fk_workspace_id = {workspace_id: String}
    AND fk_model_id = {model_id: String}
    AND row_id = {row_id: String}`;

  if (id && created_at) {
    query += ` AND (created_at, id) < ({created_at: String}, {id: String})`;
    queryParams.created_at = created_at;
    queryParams.id = id;
  }

  query += `
    ORDER BY created_at DESC, id DESC
    LIMIT {limit: UInt32}`;

  const clickhouseResult = await clickhouseClient.query({
    query,
    query_params: queryParams,
  });

  const result = await clickhouseResult.json();

  return result.data ?? [];
}

export async function getChWorkspaceAudit(
  context: NcContext,
  {
    cursor,
    baseId,
    fkUserId,
    type,
    startDate,
    endDate,
    orderBy,
    limit = 25,
  }: {
    cursor?: string;
    baseId?: string;
    fkUserId?: string;
    type?: string[];
    startDate?: string;
    endDate?: string;
    orderBy?: {
      created_at?: 'asc' | 'desc';
    };
    limit?: number;
  },
) {
  if (
    !auditClickhouseConfig.url ||
    !auditClickhouseConfig.username ||
    !auditClickhouseConfig.password
  ) {
    return [];
  }

  if (!context.workspace_id) {
    return [];
  }

  if (baseId === NO_SCOPE) {
    baseId = undefined;
  }

  const whereConditions = ['fk_workspace_id = {workspace_id: String}'];
  const queryParams: Record<string, any> = {
    workspace_id: context.workspace_id,
    limit: limit,
  };

  if (baseId) {
    whereConditions.push('base_id = {base_id: String}');
    queryParams.base_id = baseId;
  }

  if (fkUserId) {
    whereConditions.push('fk_user_id = {fk_user_id: String}');
    queryParams.fk_user_id = fkUserId;
  }

  if (type && type.length > 0) {
    whereConditions.push('op_type IN {type_array: Array(String)}');
    queryParams.type_array = type;
  }

  if (startDate) {
    whereConditions.push('created_at >= {start_date: String}');
    queryParams.start_date = startDate;
  }

  if (endDate) {
    whereConditions.push('created_at <= {end_date: String}');
    queryParams.end_date = endDate;
  }

  const cursorParts = cursor?.split('|') ?? [];

  let id: string | undefined;
  let created_at: string | undefined;

  if (cursorParts.length === 2) {
    id = cursorParts[0];
    created_at = dayjs(cursorParts[1]).format('YYYY-MM-DD HH:mm:ss');
  }

  if (id && created_at) {
    if (orderBy?.created_at === 'asc') {
      whereConditions.push(
        '(created_at, id) > ({cursor_created_at: String}, {cursor_id: String})',
      );
    } else {
      whereConditions.push(
        '(created_at, id) < ({cursor_created_at: String}, {cursor_id: String})',
      );
    }
    queryParams.cursor_created_at = created_at;
    queryParams.cursor_id = id;
  }

  const orderDirection = orderBy?.created_at === 'asc' ? 'ASC' : 'DESC';

  const query = `
    SELECT * FROM ${clickhouseAuditTable}
    WHERE ${whereConditions.join(' AND ')}
    ORDER BY created_at ${orderDirection}, id ${orderDirection}
    LIMIT {limit: UInt32}
  `;

  const clickhouseResult = await clickhouseClient.query({
    query,
    query_params: queryParams,
  });

  const result = await clickhouseResult.json();

  return result.data ?? [];
}

export async function pushAuditToKinesis(audits: Audit | Audit[]) {
  if (
    !kinesisConfig.region ||
    !kinesisConfig.credentials.accessKeyId ||
    !kinesisConfig.credentials.secretAccessKey ||
    !streamName
  ) {
    return;
  }

  if (!Array.isArray(audits)) {
    await kinesisClient.send(
      new PutRecordCommand({
        StreamName: streamName,
        Data: new TextEncoder().encode(JSON.stringify(audits)),
        PartitionKey: 'audit',
      }),
    );
  } else {
    await kinesisClient.send(
      new PutRecordsCommand({
        StreamName: streamName,
        Records: audits.map((result) => ({
          Data: new TextEncoder().encode(JSON.stringify(result)),
          PartitionKey: 'audit',
        })),
      }),
    );
  }
}
