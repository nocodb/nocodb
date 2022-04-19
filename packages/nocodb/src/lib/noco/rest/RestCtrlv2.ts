import autoBind from 'auto-bind';
import { Router } from 'express';

import { Acls } from '../../../interface/config';
import { BaseModelSql } from '../../dataMapper';

import { BaseModelSqlv2 } from '../../dataMapper/lib/sql/BaseModelSqlv2';
// import { nocoExecute } from '../noco-resolver/NocoExecute';

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
    table
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

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
