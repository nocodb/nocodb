/**
 * Class to create an instance of KnexMigrator
 *
 * @class KnexMigrator
 * @extends {SqlMigrator}
 */
import KnexMigratorv2 from './KnexMigratorv2';
import Base from '../../../models/Base';
import NcConnectionMgrv2 from '../../../utils/common/NcConnectionMgrv2';
import Noco from '../../../Noco';
import { XKnex } from '../../sql-data-mapper';
import NcMetaIO from '../../../meta/NcMetaIO';

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
  protected async getSqlClient(base: Base): Promise<any> {
    return this.sqlClient || await NcConnectionMgrv2.getSqlClient(base);
  }
}
