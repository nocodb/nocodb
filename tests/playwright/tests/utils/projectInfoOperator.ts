import {
  Api,
  BaseListType,
  BaseType,
  FilterListType,
  FilterType,
  HookListType,
  HookType,
  PaginatedType,
  ProjectType,
  SharedViewListType,
  SharedViewType,
  SignInReqType,
  SortListType,
  SortType,
  TableListType,
  TableType,
  UserType,
  ViewListType,
  ViewType,
} from 'nocodb-sdk';

export class ViewInfo {
  view: ViewType;
  filters: FilterType[];
  sorts: SortType[];
  firstPageData?: {
    /** List of data objects */
    list: any[];
    /** Paginated Info */
    pageInfo: PaginatedType;
  };
}

export class TableInfo {
  table: TableType;
  views: ViewInfo[];
  shares: SharedViewType[];
  webhooks: HookType[];
  firstPageData?: {
    /** List of data objects */
    list: any[];
    /** Paginated Info */
    pageInfo: PaginatedType;
  };
}

export class ProjectInfo {
  project: ProjectType;
  bases: BaseType[];
  users: UserType[];
  tables: TableInfo[];
}

export class ProjectInfoOperator {
  api: Api<any>;

  constructor(token: string) {
    this.api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': token,
      },
    });
  }
  /**
   * extracts the projectInfo using sdk via apis
   *
   * @param projectId
   * @returns
   */
  async extractProjectData(projectId: string): Promise<ProjectInfo> {
    // TODO: capture apiTokens, projectSettings, ACLVisibilityRules, UI ACL (discuss before adding)
    const project: ProjectType = await this.api.project.read(projectId);
    // bases
    const bases: BaseListType = await this.api.base.list(projectId);
    // users
    const usersWrapper: any = await this.api.auth.projectUserList(projectId);

    // SET project, users and bases
    const projectInfo: ProjectInfo = { project: project, tables: [], bases: [], users: [] };
    projectInfo.bases = bases.list;
    if (usersWrapper.users) {
      projectInfo.users = usersWrapper.users.list as UserType[];
    }

    const tables: TableListType = await this.api.dbTable.list(projectId);
    for (const table of tables.list) {
      const tableInfo: TableInfo = { table: table, shares: [], views: [], webhooks: [] };
      const views: ViewListType = await this.api.dbView.list(table.id);
      for (const v of views.list) {
        const filters: FilterListType = await this.api.dbTableFilter.read(v.id);
        const sorts: SortListType = await this.api.dbTableSort.list(v.id);

        // create ViewData and push to array
        const viewInfo: ViewInfo = { view: v, filters: [], sorts: [] };
        viewInfo.firstPageData = await this.api.dbViewRow.list('noco', projectId, table.id, v.id);
        viewInfo.filters = filters.list;
        viewInfo.sorts = sorts.list;
        tableInfo.views.push(viewInfo);
      }
      const shares: SharedViewListType = await this.api.dbViewShare.list(table.id);
      const webhooks: HookListType = await this.api.dbTableWebhook.list(table.id);
      tableInfo.shares = shares.list;
      tableInfo.webhooks = webhooks.list;
      projectInfo.tables.push(tableInfo);
      tableInfo.firstPageData = await this.api.dbTableRow.list('noco', projectId, table.id);
    }
    return projectInfo;
  }

  /**
   * helper function to print projectInfo
   * do not use this function to assert anything.
   * this is only helper function to debug and should
   * be allowed to modify without any test failures.
   *
   * @param projectData
   */
  async printProjectData(projectData: ProjectInfo) {
    console.log('project.title : ' + projectData.project.title);
    // bases
    console.log('Bases:');
    for (const base of projectData.bases) {
      console.log(base.id);
    }
    // users
    console.log('Users:');
    if (projectData.users) {
      for (const user of projectData.users) {
        console.log(user.email);
      }
    }
    console.log('Tables: ');

    if (projectData.tables) {
      for (const tableData of projectData.tables) {
        console.log('Table: ' + tableData.table.title);
        console.log('Views: ');

        console.log('Filters: ');
        for (const viewData of tableData.views) {
          const v: ViewType = viewData.view;
          console.log(`${v.title}  ${v.id}`);
          if (viewData.filters.length > 0) {
            console.log('======= Filters =======');
            console.log(viewData.filters);
          }
          if (viewData.sorts.length > 0) {
            console.log('======= Sorts =======');
            console.log(viewData.sorts);
          }
        }

        if (tableData.shares.length > 0) {
          console.log('======= Shares =======');
          console.log(tableData.shares.forEach(s => console.log(s.uuid)));
        }

        if (tableData.webhooks.length > 0) {
          console.log('======= Webhooks =======');
          console.log(tableData.webhooks.forEach(w => console.log(w.id)));
        }
      }
    }
  }
}
