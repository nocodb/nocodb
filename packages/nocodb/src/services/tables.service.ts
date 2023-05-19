import { Injectable } from '@nestjs/common';
import DOMPurify from 'isomorphic-dompurify';
import { AppEvents, isVirtualCol, ModelTypes, UITypes } from 'nocodb-sdk';
import ProjectMgrv2 from '../db/sql-mgr/v2/ProjectMgrv2';
import { NcError } from '../helpers/catchError';
import getColumnPropsFromUIDT from '../helpers/getColumnPropsFromUIDT';
import getColumnUiType from '../helpers/getColumnUiType';
import getTableNameAlias, { getColumnNameAlias } from '../helpers/getTableName';
import mapDefaultDisplayValue from '../helpers/mapDefaultDisplayValue';
import { Column, Model, ModelRoleVisibility, Project } from '../models';
import NcConnectionMgrv2 from '../utils/common/NcConnectionMgrv2';
import { validatePayload } from '../helpers';
import { AppHooksService } from './app-hooks/app-hooks.service';
import type { LinkToAnotherRecordColumn, User, View } from '../models';
import type {
  ColumnType,
  NormalColumnRequestType,
  TableReqType,
} from 'nocodb-sdk';

@Injectable()
export class TablesService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async tableUpdate(param: {
    tableId: any;
    table: TableReqType & { project_id?: string };
    projectId?: string;
    user: User;
  }) {
    const model = await Model.get(param.tableId);

    const project = await Project.getWithInfo(
      param.table.project_id || param.projectId,
    );
    const base = project.bases.find((b) => b.id === model.base_id);

    if (model.project_id !== project.id) {
      NcError.badRequest('Model does not belong to project');
    }

    // if meta present update meta and return
    // todo: allow user to update meta  and other prop in single api call
    if ('meta' in param.table) {
      await Model.updateMeta(param.tableId, param.table.meta);

      return true;
    }

    if (!param.table.table_name) {
      NcError.badRequest(
        'Missing table name `table_name` property in request body',
      );
    }

    if (base.is_meta && project.prefix) {
      if (!param.table.table_name.startsWith(project.prefix)) {
        param.table.table_name = `${project.prefix}${param.table.table_name}`;
      }
    }

    param.table.table_name = DOMPurify.sanitize(param.table.table_name);

    // validate table name
    if (/^\s+|\s+$/.test(param.table.table_name)) {
      NcError.badRequest(
        'Leading or trailing whitespace not allowed in table names',
      );
    }

    if (
      !(await Model.checkTitleAvailable({
        table_name: param.table.table_name,
        project_id: project.id,
        base_id: base.id,
      }))
    ) {
      NcError.badRequest('Duplicate table name');
    }

    if (!param.table.title) {
      param.table.title = getTableNameAlias(
        param.table.table_name,
        project.prefix,
        base,
      );
    }

    if (
      !(await Model.checkAliasAvailable({
        title: param.table.title,
        project_id: project.id,
        base_id: base.id,
      }))
    ) {
      NcError.badRequest('Duplicate table alias');
    }

    const sqlMgr = await ProjectMgrv2.getSqlMgr(project);
    const sqlClient = await NcConnectionMgrv2.getSqlClient(base);

    let tableNameLengthLimit = 255;
    const sqlClientType = sqlClient.knex.clientType();
    if (sqlClientType === 'mysql2' || sqlClientType === 'mysql') {
      tableNameLengthLimit = 64;
    } else if (sqlClientType === 'pg') {
      tableNameLengthLimit = 63;
    } else if (sqlClientType === 'mssql') {
      tableNameLengthLimit = 128;
    }

    if (param.table.table_name.length > tableNameLengthLimit) {
      NcError.badRequest(
        `Table name exceeds ${tableNameLengthLimit} characters`,
      );
    }

    await Model.updateAliasAndTableName(
      param.tableId,
      param.table.title,
      param.table.table_name,
    );

    await sqlMgr.sqlOpPlus(base, 'tableRename', {
      ...param.table,
      tn: param.table.table_name,
      tn_old: model.table_name,
    });

    this.appHooksService.emit(AppEvents.TABLE_UPDATE, {
      table: model,
      user: param.user,
    });

    return true;
  }

  reorderTable(param: { tableId: string; order: any }) {
    return Model.updateOrder(param.tableId, param.order);
  }

  async tableDelete(param: { tableId: string; user: User; req?: any }) {
    const table = await Model.getByIdOrName({ id: param.tableId });
    await table.getColumns();

    const relationColumns = table.columns.filter(
      (c) => c.uidt === UITypes.LinkToAnotherRecord,
    );

    if (relationColumns?.length) {
      const referredTables = await Promise.all(
        relationColumns.map(async (c) =>
          c
            .getColOptions<LinkToAnotherRecordColumn>()
            .then((opt) => opt.getRelatedTable())
            .then(),
        ),
      );
      NcError.badRequest(
        `Table can't be deleted since Table is being referred in following tables : ${referredTables.join(
          ', ',
        )}. Delete LinkToAnotherRecord columns and try again.`,
      );
    }

    const project = await Project.getWithInfo(table.project_id);
    const base = project.bases.find((b) => b.id === table.base_id);
    const sqlMgr = await ProjectMgrv2.getSqlMgr(project);
    (table as any).tn = table.table_name;
    table.columns = table.columns.filter((c) => !isVirtualCol(c));
    table.columns.forEach((c) => {
      (c as any).cn = c.column_name;
    });

    if (table.type === ModelTypes.TABLE) {
      await sqlMgr.sqlOpPlus(base, 'tableDelete', table);
    } else if (table.type === ModelTypes.VIEW) {
      await sqlMgr.sqlOpPlus(base, 'viewDelete', {
        ...table,
        view_name: table.table_name,
      });
    }

    this.appHooksService.emit(AppEvents.TABLE_DELETE, {
      table,
      user: param.user,
      ip: param.req?.clientIp,
    });

    return table.delete();
  }

  async getTableWithAccessibleViews(param: { tableId: string; user: User }) {
    const table = await Model.getWithInfo({
      id: param.tableId,
    });

    // todo: optimise
    const viewList = <View[]>(
      await this.xcVisibilityMetaGet(table.project_id, [table])
    );

    //await View.list(param.tableId)
    table.views = viewList.filter((table: any) => {
      return Object.keys(param.user?.roles).some(
        (role) => param.user?.roles[role] && !table.disabled[role],
      );
    });

    return table;
  }

  async xcVisibilityMetaGet(
    projectId,
    _models: Model[] = null,
    includeM2M = true,
    // type: 'table' | 'tableAndViews' | 'views' = 'table'
  ) {
    // todo: move to
    const roles = [
      'owner',
      'creator',
      'viewer',
      'editor',
      'commenter',
      'guest',
    ];

    const defaultDisabled = roles.reduce((o, r) => ({ ...o, [r]: false }), {});

    let models =
      _models ||
      (await Model.list({
        project_id: projectId,
        base_id: undefined,
      }));

    models = includeM2M ? models : (models.filter((t) => !t.mm) as Model[]);

    const result = await models.reduce(async (_obj, model) => {
      const obj = await _obj;

      const views = await model.getViews();
      for (const view of views) {
        obj[view.id] = {
          ptn: model.table_name,
          _ptn: model.title,
          ptype: model.type,
          tn: view.title,
          _tn: view.title,
          table_meta: model.meta,
          ...view,
          disabled: { ...defaultDisabled },
        };
      }

      return obj;
    }, Promise.resolve({}));

    const disabledList = await ModelRoleVisibility.list(projectId);

    for (const d of disabledList) {
      if (result[d.fk_view_id])
        result[d.fk_view_id].disabled[d.role] = !!d.disabled;
    }

    return Object.values(result);
  }

  async getAccessibleTables(param: {
    projectId: string;
    baseId: string;
    includeM2M?: boolean;
    roles: Record<string, boolean>;
  }) {
    const viewList = await this.xcVisibilityMetaGet(param.projectId);

    // todo: optimise
    const tableViewMapping = viewList.reduce((o, view: any) => {
      o[view.fk_model_id] = o[view.fk_model_id] || 0;
      if (
        Object.keys(param.roles).some(
          (role) => param.roles[role] && !view.disabled[role],
        )
      ) {
        o[view.fk_model_id]++;
      }
      return o;
    }, {});

    const tableList = (
      await Model.list({
        project_id: param.projectId,
        base_id: param.baseId,
      })
    ).filter((t) => tableViewMapping[t.id]);

    return param.includeM2M
      ? tableList
      : (tableList.filter((t) => !t.mm) as Model[]);
  }

  async tableCreate(param: {
    projectId: string;
    baseId?: string;
    table: TableReqType;
    user: User;
    req?: any;
  }) {
    validatePayload('swagger.json#/components/schemas/TableReq', param.table);

    const tableCreatePayLoad: Omit<TableReqType, 'columns'> & {
      columns: (Omit<ColumnType, 'column_name' | 'title'> & { cn?: string })[];
    } = {
      ...param.table,
    };

    const project = await Project.getWithInfo(param.projectId);
    let base = project.bases[0];

    if (param.baseId) {
      base = project.bases.find((b) => b.id === param.baseId);
    }

    if (
      !tableCreatePayLoad.table_name ||
      (project.prefix && project.prefix === tableCreatePayLoad.table_name)
    ) {
      NcError.badRequest(
        'Missing table name `table_name` property in request body',
      );
    }

    if (base.is_meta && project.prefix) {
      if (!tableCreatePayLoad.table_name.startsWith(project.prefix)) {
        tableCreatePayLoad.table_name = `${project.prefix}_${tableCreatePayLoad.table_name}`;
      }
    }

    tableCreatePayLoad.table_name = DOMPurify.sanitize(
      tableCreatePayLoad.table_name,
    );

    // validate table name
    if (/^\s+|\s+$/.test(tableCreatePayLoad.table_name)) {
      NcError.badRequest(
        'Leading or trailing whitespace not allowed in table names',
      );
    }

    if (
      !(await Model.checkTitleAvailable({
        table_name: tableCreatePayLoad.table_name,
        project_id: project.id,
        base_id: base.id,
      }))
    ) {
      NcError.badRequest('Duplicate table name');
    }

    if (!tableCreatePayLoad.title) {
      tableCreatePayLoad.title = getTableNameAlias(
        tableCreatePayLoad.table_name,
        project.prefix,
        base,
      );
    }

    if (
      !(await Model.checkAliasAvailable({
        title: tableCreatePayLoad.title,
        project_id: project.id,
        base_id: base.id,
      }))
    ) {
      NcError.badRequest('Duplicate table alias');
    }

    const sqlMgr = await ProjectMgrv2.getSqlMgr(project);

    const sqlClient = await NcConnectionMgrv2.getSqlClient(base);

    let tableNameLengthLimit = 255;
    const sqlClientType = sqlClient.knex.clientType();
    if (sqlClientType === 'mysql2' || sqlClientType === 'mysql') {
      tableNameLengthLimit = 64;
    } else if (sqlClientType === 'pg') {
      tableNameLengthLimit = 63;
    } else if (sqlClientType === 'mssql') {
      tableNameLengthLimit = 128;
    }

    if (tableCreatePayLoad.table_name.length > tableNameLengthLimit) {
      NcError.badRequest(
        `Table name exceeds ${tableNameLengthLimit} characters`,
      );
    }

    const mxColumnLength = Column.getMaxColumnNameLength(sqlClientType);

    for (const column of param.table.columns) {
      if (column.column_name.length > mxColumnLength) {
        NcError.badRequest(
          `Column name ${column.column_name} exceeds ${mxColumnLength} characters`,
        );
      }
    }

    tableCreatePayLoad.columns = await Promise.all(
      param.table.columns?.map(async (c) => ({
        ...(await getColumnPropsFromUIDT(c as any, base)),
        cn: c.column_name,
        column_name: c.column_name,
      })),
    );
    await sqlMgr.sqlOpPlus(base, 'tableCreate', {
      ...tableCreatePayLoad,
      tn: tableCreatePayLoad.table_name,
    });

    const columns: Array<
      Omit<Column, 'column_name' | 'title'> & {
        cn: string;
        system?: boolean;
      }
    > = (await sqlClient.columnList({ tn: tableCreatePayLoad.table_name }))
      ?.data?.list;

    const tables = await Model.list({
      project_id: project.id,
      base_id: base.id,
    });

    mapDefaultDisplayValue(param.table.columns);

    // todo: type correction
    const result = await Model.insert(project.id, base.id, {
      ...tableCreatePayLoad,
      columns: columns.map((c, i) => {
        const colMetaFromReq = param.table?.columns?.find(
          (c1) => c.cn === c1.column_name,
        );
        return {
          ...colMetaFromReq,
          uidt: colMetaFromReq?.uidt || c.uidt || getColumnUiType(base, c),
          ...c,
          dtxp: [UITypes.MultiSelect, UITypes.SingleSelect].includes(
            colMetaFromReq.uidt as any,
          )
            ? colMetaFromReq.dtxp
            : c.dtxp,
          title: colMetaFromReq?.title || getColumnNameAlias(c.cn, base),
          column_name: c.cn,
          order: i + 1,
        } as NormalColumnRequestType;
      }),
      order: +(tables?.pop()?.order ?? 0) + 1,
    } as any);

    this.appHooksService.emit(AppEvents.TABLE_CREATE, {
      table: result,
      user: param.user,
      ip: param.req?.clientIp,
    });

    return result;
  }
}
