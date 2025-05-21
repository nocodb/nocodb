import SqlMgrv2 from './SqlMgrv2';
import SqlMgrv2Trans from './SqlMgrv2Trans';
import type { MetaService } from '~/meta/meta.service';
// import type NcMetaIO from '~/meta/NcMetaIO';
import type Source from '~/models/Source';
import type { NcContext } from '~/interface/config';

export default class ProjectMgrv2 {
  private static sqlMgrMap: {
    [key: string]: SqlMgrv2;
  } = {};

  public static getSqlMgr(
    context: NcContext,
    base: { id: string },
    ncMeta: MetaService = null,
  ): SqlMgrv2 {
    if (ncMeta) return new SqlMgrv2(context, base, ncMeta);

    if (!this.sqlMgrMap[base.id]) {
      this.sqlMgrMap[base.id] = new SqlMgrv2(context, base);
    }
    return this.sqlMgrMap[base.id];
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
