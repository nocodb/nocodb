import SqlMgrv2 from './SqlMgrv2';
import Base from '../../../models/Base';
import NcConnectionMgrv2 from '../../../utils/common/NcConnectionMgrv2';
import { Knex } from 'knex';
import { XKnex } from '../../sql-data-mapper';
import NcMetaIO from '../../../meta/NcMetaIO';
import KnexMigratorv2Tans from '../../sql-migrator/lib/KnexMigratorv2Tans';

export default class SqlMgrv2Trans extends SqlMgrv2 {
  protected trx: Knex.Transaction;
  protected ncMeta: NcMetaIO;
  protected projectId: string;
  protected base: Base;

  /**
   * Creates an instance of SqlMgr.
   * @param {*} args
   * @param {String} args.toolDbPath - path to sqlite file that sql mgr will use
   * @memberof SqlMgr
   */
  constructor(args: { id: string }, ncMeta: NcMetaIO, base: Base) {
    super(args);
    this.projectId = args.id;
    this.ncMeta = ncMeta;
    this.base = base;
  }

  public migrator() {
    return new KnexMigratorv2Tans(
      { id: this.projectId },
      this.getSqlClient(this.base),
      this.ncMeta
    );
  }

  public async startTransaction(base: Base) {
    const knex: XKnex = NcConnectionMgrv2.get(base);
    this.trx = await knex.transaction();
  }

  public async commit() {
    if (this.trx) {
      await this.trx.commit();
      this.trx = null;
    }
  }

  public async rollback(error?) {
    if (this.trx) {
      await this.trx.rollback(error);
      this.trx = null;
    }
  }

  protected getSqlClient(base: Base) {
    return NcConnectionMgrv2.getSqlClient(base, this.trx);
  }

  public async sqlOp(base: Base, op, opArgs): Promise<any> {
    return super.sqlOp(base, op, opArgs);
  }

  public async sqlOpPlus(base: Base, op, opArgs): Promise<any> {
    return super.sqlOpPlus(base, op, opArgs);
  }
}
