import SqlMgrv2 from './SqlMgrv2';
import SqlMgrv2Trans from './SqlMgrv2Trans';
import type { MetaService } from '~/meta/meta.service';
// import type NcMetaIO from '~/meta/NcMetaIO';
import type Source from '~/models/Source';
import type { NcContext } from '~/interface/config';
import { LRUMap } from '~/utils/LRUMap';

const SQL_MGR_CACHE_MAX_SIZE = +(process.env.NC_SQL_MGR_CACHE_MAX_SIZE || 500);

export default class ProjectMgrv2 {
  private static sqlMgrMap = new LRUMap<SqlMgrv2>(SQL_MGR_CACHE_MAX_SIZE);

  public static getSqlMgr(
    context: NcContext,
    base: { id: string },
    ncMeta: MetaService = null,
  ): SqlMgrv2 {
    if (ncMeta) return new SqlMgrv2(context, base, ncMeta);

    let mgr = this.sqlMgrMap.get(base.id);
    if (!mgr) {
      mgr = new SqlMgrv2(context, base);
      this.sqlMgrMap.set(base.id, mgr);
    }
    return mgr;
  }

  public static async getSqlMgrTrans(
    context: NcContext,
    base: { id: string },
    // todo: tobe changed
    ncMeta: any,
    source: Source,
  ): Promise<SqlMgrv2Trans> {
    const sqlMgr = new SqlMgrv2Trans(context, base, ncMeta, source);
    await sqlMgr.startTransaction(source);
    return sqlMgr;
  }
}
