import {
  Api,
  BaseListType,
  BaseType,
  FilterListType,
  FilterType,
  HookListType,
  HookType,
  PaginatedType,
  SharedViewListType,
  SharedViewType,
  SignInReqType,
  SortListType,
  SortType,
  SourceType,
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
  base: BaseType;
  sources: SourceType[];
  users: UserType[];
  tables: TableInfo[];
}

export class BaseInfoApiUtil {
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
   * extracts the baseInfo using sdk via apis
   *
   * @param baseId
   * @returns
   */
  async extractProjectInfo(baseId: string): Promise<ProjectInfo> {
    // TODO: capture apiTokens, baseSettings, ACLVisibilityRules, UI ACL (discuss before adding)
    const base: BaseType = await this.api.base.read(baseId);
    // sources
    const sources: BaseListType = await this.api.source.list(baseId);
    // users
    const usersWrapper: any = await this.api.auth.baseUserList(baseId);

    // SET base, users and sources
    const baseInfo: ProjectInfo = { base: base, tables: [], sources: [], users: [] };
    baseInfo.sources = sources.list;
    if (usersWrapper.users) {
      baseInfo.users = usersWrapper.users.list as UserType[];
    }

    const tables: TableListType = await this.api.dbTable.list(baseId);
    for (const table of tables.list) {
      const tableInfo: TableInfo = await this.extractTableInfo(table, baseId);
      baseInfo.tables.push(tableInfo);
    }
    return baseInfo;
  }

  async extractTableInfo(table: TableType, baseId: string) {
    const tableInfo: TableInfo = { table: table, shares: [], views: [], webhooks: [] };
    const views: ViewListType = await this.api.dbView.list(table.id);
    for (const v of views.list) {
      const viewInfo: ViewInfo = await this.extractViewInfo(v, baseId, table.id);
      tableInfo.views.push(viewInfo);
    }
    const shares: SharedViewListType = await this.api.dbViewShare.list(table.id);
    const webhooks: HookListType = await this.api.dbTableWebhook.list(table.id);
    tableInfo.shares = shares.list;
    tableInfo.webhooks = webhooks.list;
    tableInfo.firstPageData = await this.api.dbTableRow.list('noco', baseId, table.id);
    return tableInfo;
  }

  private async extractViewInfo(v: ViewType, baseId: string, tableId: string) {
    const filters: FilterListType = await this.api.dbTableFilter.read(v.id);
    const sorts: SortListType = await this.api.dbTableSort.list(v.id);

    // create ViewData and push to array
    const viewInfo: ViewInfo = { view: v, filters: [], sorts: [] };
    viewInfo.firstPageData = await this.api.dbViewRow.list('noco', baseId, tableId, v.id);
    viewInfo.filters = filters.list;
    viewInfo.sorts = sorts.list;
    return viewInfo;
  }

  /**
   * helper function to print baseInfo
   * do not use this function to assert anything.
   * this is only helper function to debug and should
   * be allowed to modify without any test failures.
   *
   * @param baseData
   */
  async printProjectData(baseData: ProjectInfo) {
    console.log('base.title : ' + baseData.base.title);
    // sources
    console.log('Bases:');
    for (const source of baseData.sources) {
      console.log(source.id);
    }
    // users
    console.log('Users:');
    if (baseData.users) {
      for (const user of baseData.users) {
        console.log(user.email);
      }
    }
    console.log('Tables: ');

    if (baseData.tables) {
      for (const tableData of baseData.tables) {
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
