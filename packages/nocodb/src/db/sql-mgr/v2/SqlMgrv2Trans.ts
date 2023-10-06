import KnexMigratorv2Tans from '../../sql-migrator/lib/KnexMigratorv2Tans';
import SqlMgrv2 from './SqlMgrv2';
import type { Knex } from 'knex';
import type { XKnex } from '../../CustomKnex';
import type Source from '~/models/Source';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

export default class SqlMgrv2Trans extends SqlMgrv2 {
  protected trx: Knex.Transaction;
  // todo: tobe changed
  protected ncMeta: any; // NcMetaIO;
  protected baseId: string;
  protected source: Source;

  /**
   * Creates an instance of SqlMgr.
   * @param {*} args
   * @param {String} args.toolDbPath - path to sqlite file that sql mgr will use
   * @memberof SqlMgr
   */
  // todo: tobe changed
  constructor(args: { id: string }, ncMeta: any, source: Source) {
    super(args);
    this.baseId = args.id;
    this.ncMeta = ncMeta;
    this.source = source;
  }

  public async migrator() {
    return new KnexMigratorv2Tans(
      { id: this.baseId },
      await this.getSqlClient(this.source),
      this.ncMeta,
    );
  }

  public async startTransaction(source: Source) {
    const knex: XKnex = await NcConnectionMgrv2.get(source);
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

  protected async getSqlClient(source: Source) {
    return NcConnectionMgrv2.getSqlClient(source, this.trx);
  }

  public async sqlOp(source: Source, op, opArgs): Promise<any> {
    return super.sqlOp(source, op, opArgs);
  }

  public async sqlOpPlus(source: Source, op, opArgs): Promise<any> {
    return super.sqlOpPlus(source, op, opArgs);
  }
}
