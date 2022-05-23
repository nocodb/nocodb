/**
 * Class to create an instance of KnexMigrator
 *
 * @class KnexMigrator
 * @extends {SqlMigrator}
 */
import KnexMigratorv2 from './KnexMigratorv2';
import Base from '../../../noco-models/Base';
import NcConnectionMgrv2 from '../../../noco/common/NcConnectionMgrv2';
import Noco from '../../../noco/Noco';
import { XKnex } from '../../../dataMapper';
import NcMetaIO from '../../../noco/meta/NcMetaIO';

export default class KnexMigratorv2Tans extends KnexMigratorv2 {
  protected sqlClient: any;
  protected ncMeta: NcMetaIO;

  constructor(project: { id: string }, sqlClient = null, ncMeta = Noco.ncMeta) {
    super(project);
    this.sqlClient = sqlClient;
    this.ncMeta = ncMeta;
  }

  protected get metaDb(): XKnex {
    return this.ncMeta.knex || Noco.ncMeta.knex;
  }
  protected getSqlClient(base: Base) {
    return this.sqlClient || NcConnectionMgrv2.getSqlClient(base);
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
