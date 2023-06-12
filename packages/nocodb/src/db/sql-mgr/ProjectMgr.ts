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

  getSqlMgr(project): SqlMgr {
    if (!this.sqlMgrMap[project.id]) {
      this.sqlMgrMap[project.id] = new SqlMgr(project);
    }
    return this.sqlMgrMap[project.id];
  }
}
