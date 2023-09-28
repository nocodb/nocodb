import SqlMgr from './SqlMgr';

export default class ProjectMgr {
  public static make(): ProjectMgr {
    if (!ProjectMgr._instance) {
      ProjectMgr._instance = new ProjectMgr();
    }
    return ProjectMgr._instance;
  }

  private static _instance: ProjectMgr;
  private sqlMgrMap: {
    [key: string]: SqlMgr;
  };

  constructor() {
    this.sqlMgrMap = {};
  }

  getSqlMgr(base): SqlMgr {
    if (!this.sqlMgrMap[base.id]) {
      this.sqlMgrMap[base.id] = new SqlMgr(base);
    }
    return this.sqlMgrMap[base.id];
  }
}
