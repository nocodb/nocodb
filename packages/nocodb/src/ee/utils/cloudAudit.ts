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

  const clickhouseResult = await clickhouseClient.query({
    query: `
        SELECT * FROM ${clickhouseAuditTable}
        WHERE fk_workspace_id = '${context.workspace_id}'
        AND fk_model_id = '${fk_model_id}'
        AND row_id = '${row_id}'
        ${
          id && created_at
            ? `AND (created_at, id) < ('${created_at}', '${id}')`
            : ''
        }
        ORDER BY (created_at, id) DESC
        LIMIT ${limit}
      `,
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

  const whereConditions = [`fk_workspace_id = '${context.workspace_id}'`];

  if (baseId) {
    whereConditions.push(`base_id = '${baseId}'`);
  }

  if (fkUserId) {
    whereConditions.push(`fk_user_id = '${fkUserId}'`);
  }

  if (type && type.length > 0) {
    const typeConditions = type.map((t) => `'${t}'`).join(', ');
    whereConditions.push(`op_type IN (${typeConditions})`);
  }

  if (startDate) {
    whereConditions.push(`created_at >= '${startDate}'`);
  }

  if (endDate) {
    whereConditions.push(`created_at <= '${endDate}'`);
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
      whereConditions.push(`(created_at, id) > ('${created_at}', '${id}')`);
    } else {
      whereConditions.push(`(created_at, id) < ('${created_at}', '${id}')`);
    }
  }

  const orderDirection = orderBy?.created_at === 'asc' ? 'ASC' : 'DESC';

  const query = `
    SELECT * FROM ${clickhouseAuditTable}
    WHERE ${whereConditions.join(' AND ')}
    ORDER BY (created_at, id) ${orderDirection}
    LIMIT ${limit}
  `;

  const clickhouseResult = await clickhouseClient.query({
    query,
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
