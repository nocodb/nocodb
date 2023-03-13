import autoBind from 'auto-bind';
import type { Router } from 'express';

import type { Acls } from '../../../interface/config';
import type { BaseModelSql } from '../../db/sql-data-mapper';

import type { BaseModelSqlv2 } from '../../db/sql-data-mapper/lib/sql/BaseModelSqlv2';
// import { nocoExecute } from '../v1-legacy-resolver/NocoExecute';

// function parseHrtimeToSeconds(hrtime) {
//   const seconds = (hrtime[0] + hrtime[1] / 1e6).toFixed(3);
//   return seconds;
// }

export class RestCtrlv2 {
  public app: any;
  // private router: Router;

  protected rootResolver: string;
  protected models: { [key: string]: BaseModelSql };
  protected acls: Acls;
  protected table: string;
  protected baseModels2?: {
    [key: string]: BaseModelSqlv2;
  };

  constructor({
    app,
    models,
    baseModels2,
    rootResolver,
    table,
  }: {
    app: any;
    models: { [key: string]: BaseModelSql };
    baseModels2?: {
      [key: string]: BaseModelSqlv2;
    };
    table: string;
    rootResolver: any;
  }) {
    autoBind(this);
    this.app = app;
    this.baseModels2 = baseModels2;
    this.table = table;
    this.rootResolver = rootResolver;
    this.models = models;
    // this.router = Router();
  }

  public mapRoutes(_router: Router): any {
    // ruoter
    //   router.get('/v2', async (_req, res) => {
    //     try {
    //       res.json(
    //         await nocoExecute(
    //           {
    //             [`${this.models[this.table]._tn}List`]: await this.baseModels2[
    //               this.table
    //             ].defaultResolverReq
    //           },
    //           this.rootResolver,
    //           {},
    //           1
    //         )
    //       );
    //     } catch (e) {
    //       console.log(e);
    //       res.status(500).json({ msg: e.message });
    //     }
    //   });
    //   router.get('/v2/:id', async (req, res) => {
    //     try {
    //       res.json(
    //         await nocoExecute(
    //           {
    //             [`${this.models[this.table]._tn}Read`]: await this.baseModels2[
    //               this.table
    //             ].defaultResolverReq
    //           },
    //           this.rootResolver,
    //           {},
    //           req.params.id
    //         )
    //       );
    //     } catch (e) {
    //       console.log(e);
    //       res.status(500).json({ msg: e.message });
    //     }
    //   });
    // }
  }
}
