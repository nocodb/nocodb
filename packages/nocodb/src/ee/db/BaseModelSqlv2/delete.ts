import { Logger } from '@nestjs/common';
import { BaseModelDelete as BaseModelDeleteCE } from 'src/db/BaseModelSqlv2/delete';
import type {
  ExecQueryType,
  MetaQueryType,
} from 'src/db/BaseModelSqlv2/delete';
import { runExternal } from '~/helpers/muxHelpers';

export class BaseModelDelete extends BaseModelDeleteCE {
  logger = new Logger(BaseModelDelete.name);
  override get isDbExternal(): boolean {
    return (this.baseModel.dbDriver as any).isExternal;
  }
  override async executeBulkAll({
    execQueries,
    metaQueries,
    ids,
    rows,
    qb,
  }: {
    execQueries: ExecQueryType[];
    metaQueries: MetaQueryType[];
    ids: any[];
    rows: any[];
    qb: any;
  }) {
    const response: any[] = [];
    const queries: string[] = [];
    if (this.isDbExternal) {
      for (const execQuery of execQueries) {
        queries.push(
          ...execQuery({
            trx: this.baseModel.dbDriver,
            qb: qb.clone(),
            rows,
            ids,
          }).map((query) => query.toQuery()),
        );
      }
    }
    const trx = await this.baseModel.dbDriver.transaction();
    try {
      if (this.isDbExternal) {
        const runResponse = await runExternal(
          this.baseModel.sanitizeQuery(queries),
          (this.baseModel.dbDriver as any).extDb,
          {
            raw: true,
          },
        );
        response.push(
          ...(Array.isArray(runResponse) ? runResponse : [runResponse]),
        );
      } else {
        for (const execQuery of execQueries) {
          await Promise.all(execQuery({ trx, qb: qb.clone(), ids, rows }));
        }
      }
      await trx.commit();
      response.push(...rows);
    } catch (ex) {
      await trx.rollback();
      // silent error, may be improved to log into response
      this.logger.error(ex.message);
    }
    for (const metaQuery of metaQueries) {
      await metaQuery({ qb: qb.clone(), ids, rows });
    }

    await this.baseModel.statsUpdate({
      count: -ids.length,
    });

    return response;
  }
}
