import SqlMgrv2 from './SqlMgrv2';
import SqlMgrv2Trans from './SqlMgrv2Trans';
// import type NcMetaIO from '../../../meta/NcMetaIO';
import type Base from '../../../models/Base';

export default class ProjectMgrv2 {
  private static sqlMgrMap: {
    [key: string]: SqlMgrv2;
  } = {};

  public static getSqlMgr(project: { id: string }): SqlMgrv2 {
    if (!this.sqlMgrMap[project.id]) {
      this.sqlMgrMap[project.id] = new SqlMgrv2(project);
    }
    return this.sqlMgrMap[project.id];
  }

  public static async getSqlMgrTrans(
    project: { id: string },
    // todo: tobe changed
    ncMeta: any,
    base: Base,
  ): Promise<SqlMgrv2Trans> {
    const sqlMgr = new SqlMgrv2Trans(project, ncMeta, base);
    await sqlMgr.startTransaction(base);
    return sqlMgr;
  }
}
