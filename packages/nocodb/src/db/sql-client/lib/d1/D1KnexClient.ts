const Sqlite3Client = require('knex/lib/dialects/sqlite3/index.js');

type D1Connection = {
  accountId?: string;
  databaseId?: string;
  apiToken?: string;
  account_id?: string;
  database_id?: string;
  key?: string;
  fetch?: typeof fetch;
};

type D1QueryResponse = {
  success?: boolean;
  errors?: Array<{ message?: string; code?: number | string }>;
  result?: Array<{
    success?: boolean;
    error?: string;
    errors?: Array<{ message?: string; code?: number | string }>;
    results?: any[];
    meta?: Record<string, any>;
  }>;
};

export type D1BatchQuery = {
  sql: string;
  params?: any[];
  method?: string;
  returning?: boolean;
  pluck?: string;
  output?: (rows: any[]) => any;
};

type D1RequestBody =
  | {
      sql: string;
      params: any[];
    }
  | {
      batch: Array<{ sql: string; params: any[] }>;
    };

let transactionWarningShown = false;

export class D1KnexClient extends Sqlite3Client {
  static driverName = 'd1';
  driverName = 'd1';

  constructor(config) {
    const connection = config.connection || {};
    config.connection = {
      ...connection,
      filename: ':memory:',
    };
    config.useNullAsDefault = true;
    super(config);
  }

  _driver() {
    return this;
  }

  acquireRawConnection() {
    return Promise.resolve(this);
  }

  async destroyRawConnection() {
    return Promise.resolve();
  }

  async _query(_connection, obj) {
    if (!obj.sql) throw new Error('The query is empty');

    const sql = obj.sql.trim();
    const normalizedSql = sql.replace(/;+$/, '').toUpperCase();
    if (this.isD1InternalForeignKeyPragma(sql)) {
      return { response: this.emptyResponseFor(obj), context: obj.context };
    }

    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(normalizedSql)) {
      if (!transactionWarningShown) {
        transactionWarningShown = true;
        console.warn(
          'Cloudflare D1 does not support interactive transactions over the HTTP API. Use D1 batch for precompiled atomic multi-statement writes; interactive transaction blocks are best-effort.',
        );
      }
      return { response: this.emptyResponseFor(obj), context: obj.context };
    }

    const bindings = obj.bindings || [];
    this.validateQueryLimits(sql, bindings);

    const body = await this.queryD1({ sql, params: bindings });
    return {
      response: this.processD1Body(body, obj),
      context: obj.context,
    };
  }

  async batch(queries: D1BatchQuery[]) {
    if (!queries.length) return [];

    const batch = queries.map((query) => {
      const sql = query.sql?.trim();
      if (!sql) throw new Error('The batch query contains an empty statement');

      const params = query.params || [];
      this.validateQueryLimits(sql, params);

      return { sql, params };
    });

    const body = await this.queryD1({ batch });

    return queries.map((query, index) =>
      this.processD1Body(
        body,
        {
          ...query,
          method: query.method || 'raw',
          bindings: query.params || [],
        },
        index,
      ),
    );
  }

  processResponse(res, obj) {
    if (res && typeof res === 'object' && 'response' in res) {
      return res.response;
    }
    return super.processResponse(res, obj);
  }

  private isD1InternalForeignKeyPragma(sql: string) {
    return /^PRAGMA\s+foreign_key_list\s*\(\s*[`"']?_cf_/i.test(sql);
  }

  private validateQueryLimits(sql: string, bindings: any[]) {
    if (bindings.length > 100) {
      throw new Error(
        `Cloudflare D1 supports at most 100 bound parameters per query; received ${bindings.length}.`,
      );
    }

    if (Buffer.byteLength(sql, 'utf8') > 100 * 1024) {
      throw new Error('Cloudflare D1 supports SQL statements up to 100 KB.');
    }
  }

  private async queryD1(requestBody: D1RequestBody) {
    const connection = this.config.connection as D1Connection;
    const accountId = connection.accountId || connection.account_id;
    const databaseId = connection.databaseId || connection.database_id;
    const apiToken = connection.apiToken || connection.key;

    if (!accountId) throw new Error('Missing required Cloudflare account ID');
    if (!databaseId)
      throw new Error('Missing required Cloudflare D1 database ID');
    if (!apiToken) throw new Error('Missing required Cloudflare API token');

    const fetchImpl = connection.fetch || globalThis.fetch;
    if (!fetchImpl)
      throw new Error('Fetch API is not available in this runtime');

    const response = await fetchImpl(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify(requestBody),
      },
    );

    let body: D1QueryResponse;
    try {
      body = await response.json();
    } catch (e) {
      throw new Error(
        `Cloudflare D1 returned an invalid JSON response (${response.status} ${response.statusText})`,
      );
    }

    if (!response.ok) {
      throw new Error(
        this.formatD1Error(
          body,
          `Cloudflare D1 request failed (${response.status} ${response.statusText})`,
        ),
      );
    }

    if (!body.success) {
      throw new Error(this.formatD1Error(body, 'Cloudflare D1 query failed'));
    }

    return body;
  }

  private processD1Body(body: D1QueryResponse, obj, resultIndex = 0) {
    const result = body.result?.[resultIndex];
    if (!result) return this.emptyResponseFor(obj);
    if (result.success === false || result.error || result.errors?.length) {
      throw new Error(
        this.formatD1Error(
          {
            errors:
              result.errors ||
              (result.error ? [{ message: result.error }] : undefined),
          },
          `Cloudflare D1 statement ${resultIndex + 1} failed`,
        ),
      );
    }

    const rows = result.results || [];
    const meta = result.meta || {};

    if (obj.output) return obj.output.call(null, rows);

    switch (obj.method) {
      case 'first':
        return rows[0];
      case 'insert':
        if (obj.returning) return rows;
        return [meta.last_row_id ?? meta.lastRowId ?? meta.changes ?? 0];
      case 'update':
      case 'del':
      case 'counter':
        if (obj.returning) return rows;
        return meta.changes ?? 0;
      case 'pluck':
        return rows.map((row) => row[obj.pluck]);
      default:
        return rows;
    }
  }

  private emptyResponseFor(obj) {
    switch (obj.method) {
      case 'insert':
        return [0];
      case 'update':
      case 'del':
      case 'counter':
        return 0;
      default:
        return [];
    }
  }

  private formatD1Error(body: D1QueryResponse, fallback: string) {
    const message = body?.errors
      ?.map((error) =>
        error?.code
          ? `${error.message || 'Unknown error'} (${error.code})`
          : error?.message,
      )
      .filter(Boolean)
      .join('; ');

    return message ? `${fallback}: ${message}` : fallback;
  }
}

export default D1KnexClient;
