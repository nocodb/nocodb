import { Injectable, Logger } from '@nestjs/common';
import DOMPurify from 'isomorphic-dompurify';
import {
  AppEvents,
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isLinksOrLTAR,
  isOrderCol,
  isVirtualCol,
  ModelTypes,
  ProjectRoles,
  RelationTypes,
  UITypes,
} from 'nocodb-sdk';
import { NcApiVersion } from 'nocodb-sdk';
import { MetaDiffsService } from './meta-diffs.service';
import { ColumnsService } from './columns.service';
import type {
  ColumnType,
  NormalColumnRequestType,
  TableReqType,
  TableType,
  UserType,
} from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import type { LinkToAnotherRecordColumn, User, View } from '~/models';
import type { NcContext, NcRequest } from '~/interface/config';
import { Base, Column, Model, ModelRoleVisibility } from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import ProjectMgrv2 from '~/db/sql-mgr/v2/ProjectMgrv2';
import { NcError } from '~/helpers/catchError';
import getColumnPropsFromUIDT from '~/helpers/getColumnPropsFromUIDT';
import getColumnUiType from '~/helpers/getColumnUiType';
import getTableNameAlias, { getColumnNameAlias } from '~/helpers/getTableName';
import mapDefaultDisplayValue from '~/helpers/mapDefaultDisplayValue';
import Noco from '~/Noco';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { sanitizeColumnName, validatePayload } from '~/helpers';
import {
  getUniqueColumnAliasName,
  getUniqueColumnName,
} from '~/helpers/getUniqueName';
import { MetaTable } from '~/utils/globals';

@Injectable()
export class TablesService {
  protected logger = new Logger(TablesService.name);

  constructor(
    protected readonly metaDiffService: MetaDiffsService,
    protected readonly appHooksService: AppHooksService,
    protected readonly columnsService: ColumnsService,
  ) {}

  async tableUpdate(
    context: NcContext,
    param: {
      tableId: any;
      table: Partial<TableReqType> & { base_id?: string };
      baseId?: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    const model = await Model.get(context, param.tableId);

    const base = await Base.getWithInfo(
      context,
      param.table.base_id || param.baseId,
    );
    const source = base.sources.find((b) => b.id === model.source_id);

    if (model.base_id !== base.id) {
      NcError.badRequest('Model does not belong to base');
    }

    // if meta/description present update and return
    // todo: allow user to update meta  and other prop in single api call
    if ('meta' in param.table || 'description' in param.table) {
      await Model.updateMeta(context, param.tableId, param.table);

      this.appHooksService.emit(AppEvents.TABLE_UPDATE, {
        table: param.table,
        prevTable: model,
        req: param.req,
        context,
      });

      return true;
    }

    // allow user to only update meta json data when source is restricted changes to schema
    if (source?.is_schema_readonly) {
      NcError.sourceMetaReadOnly(source.alias);
    }

    if (!param.table.table_name) {
      NcError.badRequest(
        'Missing table name `table_name` property in request body',
      );
    }

    if (source.type === 'databricks') {
      param.table.table_name = param.table.table_name
        .replace(/\s/g, '_')
        .toLowerCase();
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
      !(await Model.checkTitleAvailable(context, {
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
      !(await Model.checkAliasAvailable(context, {
        title: param.table.title,
        base_id: base.id,
        source_id: source.id,
      }))
    ) {
      NcError.badRequest('Duplicate table alias');
    }

    const sqlMgr = await ProjectMgrv2.getSqlMgr(context, base);
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
      context,
      param.tableId,
      param.table.title,
      param.table.table_name,
    );

    this.appHooksService.emit(AppEvents.TABLE_UPDATE, {
      table: param.table,
      prevTable: model,
      req: param.req,
      context,
    });

    return true;
  }

  async reorderTable(
    context: NcContext,
    param: { tableId: string; order: any; req: NcRequest },
  ) {
    const model = await Model.get(context, param.tableId);

    const res = await Model.updateOrder(context, param.tableId, param.order);

    this.appHooksService.emit(AppEvents.TABLE_UPDATE, {
      prevTable: model as TableType,
      table: {
        ...model,
        order: param.order,
      } as TableType,
      req: param.req,
      context,
    } as any);

    return res;
  }

  async tableDelete(
    context: NcContext,
    param: {
      tableId: string;
      user: User;
      forceDeleteRelations?: boolean;
      req?: any;
    },
  ) {
    const table = await Model.getByIdOrName(context, { id: param.tableId });
    await table.getColumns(context);

    if (table.mm) {
      const columns = await table.getColumns(context);

      // get table names of the relation which uses the current table as junction table
      const tables = await Promise.all(
        columns
          .filter((c) => isLinksOrLTAR(c))
          .map((c) => c.colOptions.getRelatedTable()),
      );

      // get relation column names
      const relColumns = await Promise.all(
        tables.map((t) => {
          return t.getColumns(context).then((cols) => {
            return cols.find((c) => {
              return (
                isLinksOrLTAR(c) &&
                (c.colOptions as LinkToAnotherRecordColumn).type ===
                  RelationTypes.MANY_TO_MANY &&
                (c.colOptions as LinkToAnotherRecordColumn).fk_mm_model_id ===
                  table.id
              );
            });
          });
        }),
      );

      NcError.badRequest(
        `This is a many to many table for ${tables[0]?.title} (${relColumns[0]?.title}) & ${tables[1]?.title} (${relColumns[1]?.title}). You can disable "Show M2M tables" in base settings to avoid seeing this.`,
      );
    } else {
      // if table is using in custom relation as junction table then delete all the relation
      const relations = await Noco.ncMeta.metaList2(
        table.fk_workspace_id,
        table.base_id,
        MetaTable.COL_RELATIONS,
        {
          condition: {
            fk_mm_model_id: table.id,
          },
        },
      );

      if (relations.length) {
        const relCol = await Column.get(context, {
          colId: relations[0].fk_column_id,
        });
        const relTable = await Model.get(context, relCol.fk_model_id);
        NcError.tableAssociatedWithLink(table.id, {
          customMessage: `This is a many to many table for '${relTable?.title}' (${relTable?.title}), please delete the column before deleting the table.`,
        });
      }
    }

    const base = await Base.getWithInfo(context, table.base_id);
    const source = base.sources.find((b) => b.id === table.source_id);

    const relationColumns = table.columns.filter((c) => isLinksOrLTAR(c));

    const deleteRelations = source.isMeta() || param.forceDeleteRelations;

    if (relationColumns?.length && !deleteRelations) {
      const referredTables = await Promise.all(
        relationColumns.map(async (c) =>
          c
            .getColOptions<LinkToAnotherRecordColumn>(context)
            .then((opt) => opt.getRelatedTable(context))
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
        if (c.system && !table.mm) {
          continue;
        }

        // verify column exist or not and based on that delete the column
        if (!(await Column.get(context, { colId: c.id }, ncMeta))) {
          continue;
        }

        await this.columnsService.columnDelete(
          context,
          {
            req: param.req,
            columnId: c.id,
            user: param.user,
            forceDeleteSystem: true,
          },
          ncMeta,
        );
      }

      const sqlMgr = await ProjectMgrv2.getSqlMgr(context, base, ncMeta);
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
        req: param.req,
        context,
      });

      result = await table.delete(context, ncMeta);
      await ncMeta.commit();
    } catch (e) {
      await ncMeta.rollback();
      throw e;
    }
    return result;
  }

  async getTableWithAccessibleViews(
    context: NcContext,
    param: {
      tableId: string;
      user: User | UserType;
    },
  ) {
    const table = await Model.getWithInfo(context, {
      id: param.tableId,
    });

    if (!table) {
      NcError.tableNotFound(param.tableId);
    }

    // todo: optimise
    const viewList = <View[]>(
      await this.xcVisibilityMetaGet(context, table.base_id, [table])
    );

    //await View.list(param.tableId)
    table.views = viewList.filter((view: any) => {
      return Object.keys(param.user?.roles).some(
        (role) => param.user?.roles[role] && !view.disabled[role],
      );
    });

    return table;
  }

  async xcVisibilityMetaGet(
    context: NcContext,
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
      (await Model.list(context, {
        base_id: baseId,
        source_id: undefined,
      }));

    models = includeM2M ? models : (models.filter((t) => !t.mm) as Model[]);

    const result = await models.reduce(async (_obj, model) => {
      const obj = await _obj;

      const views = await model.getViews(context);
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

    const disabledList = await ModelRoleVisibility.list(context, baseId);

    for (const d of disabledList) {
      if (result[d.fk_view_id])
        result[d.fk_view_id].disabled[d.role] = !!d.disabled;
    }

    return Object.values(result);
  }

  async getAccessibleTables(
    context: NcContext,
    param: {
      baseId: string;
      sourceId: string;
      includeM2M?: boolean;
      roles: Record<string, boolean>;
    },
  ) {
    const viewList = await this.xcVisibilityMetaGet(context, param.baseId);

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
      await Model.list(context, {
        base_id: param.baseId,
        source_id: param.sourceId,
      })
    ).filter((t) => tableViewMapping[t.id]);

    return param.includeM2M
      ? tableList
      : (tableList.filter((t) => !t.mm) as Model[]);
  }

  async tableCreate(
    context: NcContext,
    param: {
      baseId: string;
      sourceId?: string;
      table: TableReqType;
      user: User | UserType;
      req: NcRequest;
      apiVersion?: NcApiVersion;
    },
  ) {
    // before validating add title for columns if only column name is present
    if (param.table.columns) {
      param.table.columns.forEach((c) => {
        if (!c.title && c.column_name) {
          c.title = c.column_name;
        }
      });
    }

    // before validating add title for table if only table name is present
    if (!param.table.title && param.table.table_name) {
      param.table.title = param.table.table_name;
    }

    validatePayload('swagger.json#/components/schemas/TableReq', param.table);

    const tableCreatePayLoad: Omit<TableReqType, 'columns'> & {
      columns: (ColumnType & { cn?: string })[];
    } = {
      ...param.table,
    };

    const base = await Base.getWithInfo(context, param.baseId);
    let source = base.sources[0];

    if (param.sourceId) {
      source = base.sources.find((b) => b.id === param.sourceId);
    }

    // add CreatedTime and LastModifiedTime system columns if missing in request payload
    {
      for (const uidt of [
        ...(param.apiVersion === NcApiVersion.V3 ? [UITypes.ID] : []),
        UITypes.CreatedTime,
        UITypes.LastModifiedTime,
        UITypes.CreatedBy,
        UITypes.LastModifiedBy,
        UITypes.Order,
      ]) {
        const col = tableCreatePayLoad.columns.find(
          (c) => c.uidt === uidt,
        ) as ColumnType;

        let columnName, columnTitle;

        switch (uidt) {
          case UITypes.CreatedTime:
            columnName = 'created_at';
            columnTitle = 'CreatedAt';
            break;
          case UITypes.LastModifiedTime:
            columnName = 'updated_at';
            columnTitle = 'UpdatedAt';
            break;
          case UITypes.CreatedBy:
            columnName = 'created_by';
            columnTitle = 'nc_created_by';
            break;
          case UITypes.LastModifiedBy:
            columnName = 'updated_by';
            columnTitle = 'nc_updated_by';
            break;
          case UITypes.Order:
            columnTitle = 'nc_order';
            columnName = 'nc_order';
            break;
          case UITypes.ID:
            columnTitle = 'id';
            columnName = 'id';
            break;
        }

        const colName = getUniqueColumnName(
          tableCreatePayLoad.columns as any[],
          columnName,
        );

        const colAlias = getUniqueColumnAliasName(
          tableCreatePayLoad.columns as any[],
          columnTitle,
        );

        if (!col || (!col.system && col.uidt !== UITypes.ID)) {
          tableCreatePayLoad.columns.push({
            ...(await getColumnPropsFromUIDT({ uidt } as any, source)),
            column_name: colName,
            cn: colName,
            title: colAlias,
            system: true,
          });
        } else {
          // temporary fix for updating if user passed system columns with duplicate names
          if (
            tableCreatePayLoad.columns.some(
              (c: ColumnType) =>
                c.uidt !== uidt && c.column_name === col.column_name,
            )
          ) {
            Object.assign(col, {
              column_name: colName,
              cn: colName,
            });
          }
          if (
            tableCreatePayLoad.columns.some(
              (c: ColumnType) => c.uidt !== uidt && c.title === col.title,
            )
          ) {
            Object.assign(col, {
              title: colAlias,
            });
          }
        }
      }
    }

    if (!tableCreatePayLoad.title) {
      NcError.badRequest('Missing table `title` property in request body');
    }

    if (!tableCreatePayLoad.table_name) {
      tableCreatePayLoad.table_name = tableCreatePayLoad.title;
    }

    if (
      !(await Model.checkAliasAvailable(context, {
        title: tableCreatePayLoad.title,
        base_id: base.id,
        source_id: source.id,
      }))
    ) {
      NcError.badRequest('Duplicate table alias');
    }

    if (source.type === 'databricks') {
      tableCreatePayLoad.table_name = tableCreatePayLoad.table_name
        .replace(/\s/g, '_')
        .toLowerCase();
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
      !(await Model.checkTitleAvailable(context, {
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

    const sqlMgr = await ProjectMgrv2.getSqlMgr(context, base);

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

    const uniqueColumnNameCount = {};

    mapDefaultDisplayValue(param.table.columns);

    const virtualColumns = [];

    for (const column of param.table.columns) {
      if (
        !isVirtualCol(column) ||
        (isCreatedOrLastModifiedTimeCol(column) && (column as any).system) ||
        (isCreatedOrLastModifiedByCol(column) && (column as any).system)
      ) {
        // set column name using title if not present
        if (!column.column_name && column.title) {
          column.column_name = column.title;
        }

        // - 5 is a buffer for suffix
        column.column_name = sanitizeColumnName(
          column.column_name.slice(0, mxColumnLength - 5),
          source.type,
        );

        if (uniqueColumnNameCount[column.column_name]) {
          let suffix = 1;
          let targetColumnName = `${column.column_name}_${suffix++}`;
          while (uniqueColumnNameCount[targetColumnName]) {
            targetColumnName = `${column.column_name}_${suffix++}`;
          }
          column.column_name = targetColumnName;
        }
        uniqueColumnNameCount[column.column_name] = 1;

        if (column.column_name.length > mxColumnLength) {
          column.column_name = column.column_name.slice(0, mxColumnLength);
        }
      }

      if (column.title && column.title.length > 255) {
        NcError.badRequest(
          `Column title ${column.title} exceeds 255 characters`,
        );
      }
    }

    tableCreatePayLoad.columns = await Promise.all(
      param.table.columns
        // exclude alias columns from column list
        ?.filter((c) => {
          const allowed =
            (!isCreatedOrLastModifiedTimeCol(c) &&
              !isCreatedOrLastModifiedByCol(c)) ||
            (c as any).system ||
            isOrderCol(c);

          if (!allowed) {
            virtualColumns.push(c);
          }

          return allowed;
        })
        .map(async (c) => ({
          ...(await getColumnPropsFromUIDT(c as any, source)),
          cn: c.column_name,
          column_name: c.column_name,
        })),
    );

    await sqlMgr.sqlOpPlus(source, 'tableCreate', {
      ...tableCreatePayLoad,
      tn: tableCreatePayLoad.table_name,
    });

    let columns: Array<
      Omit<Column, 'column_name' | 'title'> & {
        cn: string;
        system?: boolean;
      }
    >;

    if (!source.isMeta()) {
      columns = (
        await sqlMgr.sqlOpPlus(source, 'columnList', {
          tn: tableCreatePayLoad.table_name,
          schema: source.getConfig()?.schema,
        })
      )?.data?.list;
    }

    const tables = await Model.list(context, {
      base_id: base.id,
      source_id: source.id,
    });

    // todo: type correction
    const result = await Model.insert(context, base.id, source.id, {
      ...tableCreatePayLoad,
      columns: [
        ...tableCreatePayLoad.columns.map((c, i) => {
          const colMetaFromDb = columns?.find((c1) => c.cn === c1.cn);
          return {
            ...c,
            uidt: c.uidt || getColumnUiType(source, colMetaFromDb || c),
            ...(colMetaFromDb || {}),
            title: c.title || getColumnNameAlias(c.cn, source),
            column_name: colMetaFromDb?.cn || c.cn || c.column_name,
            order: i + 1,
          } as NormalColumnRequestType;
        }),
        ...virtualColumns.map((c, i) => ({
          ...c,
          uidt: c.uidt || getColumnUiType(source, c),
          title: c.title || getColumnNameAlias(c.cn, source),
          order: tableCreatePayLoad.columns.length + i + 1,
        })),
      ],
      order: +(tables?.pop()?.order ?? 0) + 1,
    } as any);

    try {
      // create nc_order index column
      const metaOrderColumn = tableCreatePayLoad.columns.find(
        (c) => c.uidt === UITypes.Order,
      );

      if (!source.isMeta()) {
        const orderColumn = columns.find(
          (c) => c.cn === metaOrderColumn.column_name,
        );

        if (!orderColumn) {
          throw new Error(
            `Column ${metaOrderColumn.column_name} not found in database`,
          );
        }
      }

      const dbDriver = await NcConnectionMgrv2.get(source);

      const baseModel = await Model.getBaseModelSQL(context, {
        model: result,
        source,
        dbDriver,
      });

      await sqlClient.raw(`CREATE INDEX ?? ON ?? (??)`, [
        `${tableCreatePayLoad.table_name}_order_idx`,
        baseModel.getTnPath(tableCreatePayLoad.table_name),
        metaOrderColumn.column_name,
      ]);
    } catch (e) {
      this.logger.log(`Something went wrong while creating index for nc_order`);
      this.logger.error(e);
    }

    this.appHooksService.emit(AppEvents.TABLE_CREATE, {
      table: {
        ...param.table,
        id: result.id,
      },
      source,
      user: param.user,
      req: param.req,
      context,
    });

    return result;
  }
}
