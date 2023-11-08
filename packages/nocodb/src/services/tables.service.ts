import { Injectable } from '@nestjs/common';
import DOMPurify from 'isomorphic-dompurify';
import {
  isLinksOrLTAR,
  isVirtualCol,
  ModelTypes,
  ProjectRoles,
  UITypes,
} from 'nocodb-sdk';
import { AppEvents } from 'nocodb-sdk';
import { MetaDiffsService } from './meta-diffs.service';
import { ColumnsService } from './columns.service';
import type { MetaService } from '~/meta/meta.service';
import type { LinkToAnotherRecordColumn, User, View } from '~/models';
import type {
  ColumnType,
  NormalColumnRequestType,
  TableReqType,
  UserType,
} from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import ProjectMgrv2 from '~/db/sql-mgr/v2/ProjectMgrv2';
import { NcError } from '~/helpers/catchError';
import getColumnPropsFromUIDT from '~/helpers/getColumnPropsFromUIDT';
import getColumnUiType from '~/helpers/getColumnUiType';
import getTableNameAlias, { getColumnNameAlias } from '~/helpers/getTableName';
import mapDefaultDisplayValue from '~/helpers/mapDefaultDisplayValue';
import { Base, Column, Model, ModelRoleVisibility } from '~/models';
import Noco from '~/Noco';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { sanitizeColumnName, validatePayload } from '~/helpers';

@Injectable()
export class TablesService {
  constructor(
    protected readonly metaDiffService: MetaDiffsService,
    protected readonly appHooksService: AppHooksService,
    protected readonly columnsService: ColumnsService,
  ) {}

  async tableUpdate(param: {
    tableId: any;
    table: TableReqType & { base_id?: string };
    baseId?: string;
    user: UserType;
    req: NcRequest;
  }) {
    const model = await Model.get(param.tableId);

    const base = await Base.getWithInfo(param.table.base_id || param.baseId);
    const source = base.sources.find((b) => b.id === model.source_id);

    if (model.base_id !== base.id) {
      NcError.badRequest('Model does not belong to base');
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

    if (source.isMeta(true) && base.prefix && !source.isMeta(true, 1)) {
      if (!param.table.table_name.startsWith(base.prefix)) {
        param.table.table_name = `${base.prefix}${param.table.table_name}`;
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
        base_id: base.id,
        source_id: source.id,
      }))
    ) {
      NcError.badRequest('Duplicate table name');
    }

    if (!param.table.title) {
      param.table.title = getTableNameAlias(
        param.table.table_name,
        base.prefix,
        source,
      );
    }

    if (
      !(await Model.checkAliasAvailable({
        title: param.table.title,
        base_id: base.id,
        source_id: source.id,
      }))
    ) {
      NcError.badRequest('Duplicate table alias');
    }

    const sqlMgr = await ProjectMgrv2.getSqlMgr(base);
    const sqlClient = await NcConnectionMgrv2.getSqlClient(source);

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

    await sqlMgr.sqlOpPlus(source, 'tableRename', {
      ...param.table,
      tn: param.table.table_name,
      tn_old: model.table_name,
      schema: source.getConfig()?.schema,
    });

    await Model.updateAliasAndTableName(
      param.tableId,
      param.table.title,
      param.table.table_name,
    );

    this.appHooksService.emit(AppEvents.TABLE_UPDATE, {
      table: model,
      user: param.user,
      req: param.req,
    });

    return true;
  }

  reorderTable(param: { tableId: string; order: any }) {
    return Model.updateOrder(param.tableId, param.order);
  }

  async tableDelete(param: { tableId: string; user: User; req?: any }) {
    const table = await Model.getByIdOrName({ id: param.tableId });
    await table.getColumns();

    const base = await Base.getWithInfo(table.base_id);
    const source = base.sources.find((b) => b.id === table.source_id);

    const relationColumns = table.columns.filter((c) => isLinksOrLTAR(c));

    if (relationColumns?.length && !source.isMeta()) {
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

    // start a transaction
    const ncMeta = await (Noco.ncMeta as MetaService).startTransaction();
    let result;
    try {
      // delete all relations
      for (const c of relationColumns) {
        // skip if column is hasmany relation to mm table
        if (c.system) {
          continue;
        }

        // verify column exist or not and based on that delete the column
        if (!(await Column.get({ colId: c.id }, ncMeta))) {
          continue;
        }

        await this.columnsService.columnDelete(
          {
            req: param.req,
            columnId: c.id,
            user: param.user,
          },
          ncMeta,
        );
      }

      const sqlMgr = await ProjectMgrv2.getSqlMgr(base, ncMeta);
      (table as any).tn = table.table_name;
      table.columns = table.columns.filter((c) => !isVirtualCol(c));
      table.columns.forEach((c) => {
        (c as any).cn = c.column_name;
      });

      if (table.type === ModelTypes.TABLE) {
        await sqlMgr.sqlOpPlus(source, 'tableDelete', table);
      } else if (table.type === ModelTypes.VIEW) {
        await sqlMgr.sqlOpPlus(source, 'viewDelete', {
          ...table,
          view_name: table.table_name,
        });
      }

      this.appHooksService.emit(AppEvents.TABLE_DELETE, {
        table,
        user: param.user,
        ip: param.req?.clientIp,
        req: param.req,
      });

      result = await table.delete(ncMeta);
      await ncMeta.commit();
    } catch (e) {
      await ncMeta.rollback();
      throw e;
    }
    return result;
  }

  async getTableWithAccessibleViews(param: {
    tableId: string;
    user: User | UserType;
  }) {
    const table = await Model.getWithInfo({
      id: param.tableId,
    });

    if (!table) {
      NcError.notFound('Table not found');
    }

    // todo: optimise
    const viewList = <View[]>(
      await this.xcVisibilityMetaGet(table.base_id, [table])
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
    baseId,
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
        base_id: baseId,
        source_id: undefined,
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

    const disabledList = await ModelRoleVisibility.list(baseId);

    for (const d of disabledList) {
      if (result[d.fk_view_id])
        result[d.fk_view_id].disabled[d.role] = !!d.disabled;
    }

    return Object.values(result);
  }

  async getAccessibleTables(param: {
    baseId: string;
    sourceId: string;
    includeM2M?: boolean;
    roles: Record<string, boolean>;
  }) {
    const viewList = await this.xcVisibilityMetaGet(param.baseId);

    // todo: optimise
    const tableViewMapping = viewList.reduce((o, view: any) => {
      o[view.fk_model_id] = o[view.fk_model_id] || 0;
      if (
        Object.values(ProjectRoles).some(
          (role) => param.roles[role] && !view.disabled[role],
        )
      ) {
        o[view.fk_model_id]++;
      }
      return o;
    }, {});

    const tableList = (
      await Model.list({
        base_id: param.baseId,
        source_id: param.sourceId,
      })
    ).filter((t) => tableViewMapping[t.id]);

    return param.includeM2M
      ? tableList
      : (tableList.filter((t) => !t.mm) as Model[]);
  }

  async tableCreate(param: {
    baseId: string;
    sourceId?: string;
    table: TableReqType;
    user: User | UserType;
    req?: any;
  }) {
    validatePayload('swagger.json#/components/schemas/TableReq', param.table);

    const tableCreatePayLoad: Omit<TableReqType, 'columns'> & {
      columns: (Omit<ColumnType, 'column_name' | 'title'> & { cn?: string })[];
    } = {
      ...param.table,
    };

    const base = await Base.getWithInfo(param.baseId);
    let source = base.sources[0];

    if (param.sourceId) {
      source = base.sources.find((b) => b.id === param.sourceId);
    }

    if (
      !tableCreatePayLoad.table_name ||
      (base.prefix && base.prefix === tableCreatePayLoad.table_name)
    ) {
      NcError.badRequest(
        'Missing table name `table_name` property in request body',
      );
    }

    if (source.is_meta && base.prefix) {
      if (!tableCreatePayLoad.table_name.startsWith(base.prefix)) {
        tableCreatePayLoad.table_name = `${base.prefix}_${tableCreatePayLoad.table_name}`;
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
        base_id: base.id,
        source_id: source.id,
      }))
    ) {
      NcError.badRequest('Duplicate table name');
    }

    if (!tableCreatePayLoad.title) {
      tableCreatePayLoad.title = getTableNameAlias(
        tableCreatePayLoad.table_name,
        base.prefix,
        source,
      );
    }

    if (
      !(await Model.checkAliasAvailable({
        title: tableCreatePayLoad.title,
        base_id: base.id,
        source_id: source.id,
      }))
    ) {
      NcError.badRequest('Duplicate table alias');
    }

    const sqlMgr = await ProjectMgrv2.getSqlMgr(base);

    const sqlClient = await NcConnectionMgrv2.getSqlClient(source);

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
      if (!isVirtualCol(column)) {
        column.column_name = sanitizeColumnName(column.column_name);
      }

      if (column.column_name.length > mxColumnLength) {
        NcError.badRequest(
          `Column name ${column.column_name} exceeds ${mxColumnLength} characters`,
        );
      }

      if (column.title && column.title.length > 255) {
        NcError.badRequest(
          `Column title ${column.title} exceeds 255 characters`,
        );
      }
    }

    tableCreatePayLoad.columns = await Promise.all(
      param.table.columns?.map(async (c) => ({
        ...(await getColumnPropsFromUIDT(c as any, source)),
        cn: c.column_name,
        column_name: c.column_name,
      })),
    );
    await sqlMgr.sqlOpPlus(source, 'tableCreate', {
      ...tableCreatePayLoad,
      tn: tableCreatePayLoad.table_name,
    });

    const columns: Array<
      Omit<Column, 'column_name' | 'title'> & {
        cn: string;
        system?: boolean;
      }
    > = (
      await sqlClient.columnList({
        tn: tableCreatePayLoad.table_name,
        schema: source.getConfig()?.schema,
      })
    )?.data?.list;

    const tables = await Model.list({
      base_id: base.id,
      source_id: source.id,
    });

    mapDefaultDisplayValue(param.table.columns);

    // todo: type correction
    const result = await Model.insert(base.id, source.id, {
      ...tableCreatePayLoad,
      columns: columns.map((c, i) => {
        const colMetaFromReq = param.table?.columns?.find(
          (c1) => c.cn === c1.column_name,
        );
        return {
          ...colMetaFromReq,
          uidt: colMetaFromReq?.uidt || c.uidt || getColumnUiType(source, c),
          ...c,
          dtxp: [UITypes.MultiSelect, UITypes.SingleSelect].includes(
            colMetaFromReq.uidt as any,
          )
            ? colMetaFromReq.dtxp
            : c.dtxp,
          title: colMetaFromReq?.title || getColumnNameAlias(c.cn, source),
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
      req: param.req,
    });

    return result;
  }
}
