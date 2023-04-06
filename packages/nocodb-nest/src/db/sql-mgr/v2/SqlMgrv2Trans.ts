import NcConnectionMgrv2 from '../../../utils/common/NcConnectionMgrv2';
import KnexMigratorv2Tans from '../../sql-migrator/lib/KnexMigratorv2Tans';
import SqlMgrv2 from './SqlMgrv2';
import type Base from '../../../models/Base';
import type { Knex } from 'knex';
import type { XKnex } from '../../CustomKnex';

export default class SqlMgrv2Trans extends SqlMgrv2 {
  protected trx: Knex.Transaction;
  // todo: tobe changed
  protected ncMeta: any // NcMetaIO;
  protected projectId: string;
  protected base: Base;

  /**
   * Creates an instance of SqlMgr.
   * @param {*} args
   * @param {String} args.toolDbPath - path to sqlite file that sql mgr will use
   * @memberof SqlMgr
   */
  // todo: tobe changed
  constructor(args: { id: string }, ncMeta: any, base: Base) {
    super(args);
    this.projectId = args.id;
    this.ncMeta = ncMeta;
    this.base = base;
  }

  public async migrator() {
    return new KnexMigratorv2Tans(
      { id: this.projectId },
      await this.getSqlClient(this.base),
      this.ncMeta
    );
  }

  public async startTransaction(base: Base) {
    const knex: XKnex = await NcConnectionMgrv2.get(base);
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

  protected async getSqlClient(base: Base) {
    return NcConnectionMgrv2.getSqlClient(base, this.trx);
  }

  public async sqlOp(base: Base, op, opArgs): Promise<any> {
    return super.sqlOp(base, op, opArgs);
  }

  public async sqlOpPlus(base: Base, op, opArgs): Promise<any> {
    return super.sqlOpPlus(base, op, opArgs);
  }
}
