import { XKnex } from '../db/sql-data-mapper';
import type { Request } from 'express';

export default class MetaAPILogger {
  static _instance: MetaAPILogger;
  knex: XKnex;

  constructor() {
    this.knex = XKnex({
      client: 'sqlite3',
      connection: {
        filename: 'noco_log.db',
      },
    });
  }

  async init() {
    await this.knex.migrate.latest({
      migrationSource: new XcLoggerMigrationSource(),
      tableName: 'xc_knex_migrations',
    });
  }

  static async mw(req, res, next) {
    if (process.env.NC_LOGGER) {
      const oldWrite = res.write,
        oldEnd = res.end;

      const chunks = [];

      res.write = function (chunk) {
        chunks.push(chunk);

        // eslint-disable-next-line prefer-rest-params
        oldWrite.apply(res, arguments);
      };

      res.end = function (chunk) {
        if (chunk) chunks.push(chunk);

        const body = Buffer.concat(chunks).toString('utf8');

        MetaAPILogger.log(req, body);
        // eslint-disable-next-line prefer-rest-params
        oldEnd.apply(res, arguments);
      };
    }
    next();
  }

  private static async log(req: Request, res: any) {
    if (!process.env.NC_LOGGER) {
      return;
    }
    if (!this._instance) {
      this._instance = new MetaAPILogger();
      await this._instance.init();
    }
    await this._instance.knex('nc_log').insert({
      path: req.url,
      params: JSON.stringify(req.query),
      body: JSON.stringify(req.body),
      headers: JSON.stringify(req.headers),
      method: req.method,
      operation: req.body?.api,
      response: typeof res === 'string' ? res : JSON.stringify(res),
    });
  }
}

class XcLoggerMigrationSource {
  // Must return a Promise containing a list of migrations.
  // Migrations can be whatever you want, they will be passed as
  // arguments to getMigrationName and getMigration
  public getMigrations(): Promise<any> {
    // In this run we are just returning migration names
    return Promise.resolve(['logger']);
  }

  public getMigrationName(migration): string {
    return migration;
  }

  public getMigration(migration): any {
    switch (migration) {
      case 'logger':
        return {
          async up(knex: XKnex) {
            await knex.schema.createTable('nc_log', (table) => {
              table.increments();
              table.string('path');
              table.string('method');
              table.string('operation');
              table.string('params');
              table.text('headers');
              table.text('body');
              table.text('response');
              table.text('comments');
              table.timestamps(true, true);
            });
          },
          async down(knex) {
            await knex.schema.dropTable('nc_log');
          },
        };
    }
  }
}
