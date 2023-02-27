// @ts-ignore
import DOMPurify from 'isomorphic-dompurify';
import {
  AuditOperationSubTypes,
  AuditOperationTypes,
  isVirtualCol,
  ModelTypes,
  NormalColumnRequestType,
  TableReqType,
  UITypes,
} from 'nocodb-sdk';
import ProjectMgrv2 from '../db/sql-mgr/v2/ProjectMgrv2';
import { NcError } from '../meta/helpers/catchError';
import getColumnPropsFromUIDT from '../meta/helpers/getColumnPropsFromUIDT';
import getColumnUiType from '../meta/helpers/getColumnUiType';
import getTableNameAlias, {
  getColumnNameAlias,
} from '../meta/helpers/getTableName';
import mapDefaultDisplayValue from '../meta/helpers/mapDefaultDisplayValue';
import Audit from '../models/Audit';
import Column from '../models/Column';
import LinkToAnotherRecordColumn from '../models/LinkToAnotherRecordColumn';
import Model from '../models/Model';
import ModelRoleVisibility from '../models/ModelRoleVisibility';
import Project from '../models/Project';
import User from '../models/User';
import View from '../models/View';
import NcConnectionMgrv2 from '../utils/common/NcConnectionMgrv2';
import { Tele } from 'nc-help';

export function reorderTable(param: { tableId: string; order: any }) {
  return Model.updateOrder(param.tableId, param.order);
}

export async function tableDelete(param: { tableId: string; user: User }) {
  const table = await Model.getByIdOrName({ id: param.tableId });
  await table.getColumns();

  const relationColumns = table.columns.filter(
    (c) => c.uidt === UITypes.LinkToAnotherRecord
  );

  if (relationColumns?.length) {
    const referredTables = await Promise.all(
      relationColumns.map(async (c) =>
        c
          .getColOptions<LinkToAnotherRecordColumn>()
          .then((opt) => opt.getRelatedTable())
          .then()
      )
    );
    NcError.badRequest(
      `Table can't be deleted since Table is being referred in following tables : ${referredTables.join(
        ', '
      )}. Delete LinkToAnotherRecord columns and try again.`
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

  await Audit.insert({
    project_id: project.id,
    base_id: base.id,
    op_type: AuditOperationTypes.TABLE,
    op_sub_type: AuditOperationSubTypes.DELETED,
    user: param.user?.email,
    description: `Deleted ${table.type} ${table.table_name} with alias ${table.title}  `,
    // ip: (req as any).clientIp,
  }).then(() => {});

  Tele.emit('evt', { evt_type: 'table:deleted' });

  return table.delete();
}

export async function getTableWithAccessibleViews(param: {
  tableId: string;
  user: User;
}) {
  const table = await Model.getWithInfo({
    id: param.tableId,
  });

  // todo: optimise
  const viewList = <View[]>await xcVisibilityMetaGet(table.project_id, [table]);

  //await View.list(req.params.tableId)
  table.views = viewList.filter((table: any) => {
    return Object.keys(param.user?.roles).some(
      (role) => param.user?.roles[role] && !table.disabled[role]
    );
  });

  return table;
}

export async function xcVisibilityMetaGet(
  projectId,
  _models: Model[] = null,
  includeM2M = true
  // type: 'table' | 'tableAndViews' | 'views' = 'table'
) {
  // todo: move to
  const roles = ['owner', 'creator', 'viewer', 'editor', 'commenter', 'guest'];

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

export async function getAccessibleTables(param: {
  projectId: string;
  baseId: string;
  includeM2M?: boolean;
  roles: Record<string, boolean>;
}) {
  const viewList = await xcVisibilityMetaGet(param.projectId);

  // todo: optimise
  const tableViewMapping = viewList.reduce((o, view: any) => {
    o[view.fk_model_id] = o[view.fk_model_id] || 0;
    if (
      Object.keys(param.roles).some(
        (role) => param.roles[role] && !view.disabled[role]
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

export async function tableCreate(args: {
  projectId: string;
  baseId?: string;
  table: TableReqType;
  user: User;
}) {
  const project = await Project.getWithInfo(args.projectId);
  let base = project.bases[0];

  if (args.baseId) {
    base = project.bases.find((b) => b.id === args.baseId);
  }

  if (
    !args.table.table_name ||
    (project.prefix && project.prefix === args.table.table_name)
  ) {
    NcError.badRequest(
      'Missing table name `table_name` property in request body'
    );
  }

  if (base.is_meta && project.prefix) {
    if (!args.table.table_name.startsWith(project.prefix)) {
      args.table.table_name = `${project.prefix}_${args.table.table_name}`;
    }
  }

  args.table.table_name = DOMPurify.sanitize(args.table.table_name);

  // validate table name
  if (/^\s+|\s+$/.test(args.table.table_name)) {
    NcError.badRequest(
      'Leading or trailing whitespace not allowed in table names'
    );
  }

  if (
    !(await Model.checkTitleAvailable({
      table_name: args.table.table_name,
      project_id: project.id,
      base_id: base.id,
    }))
  ) {
    NcError.badRequest('Duplicate table name');
  }

  if (!args.table.title) {
    args.table.title = getTableNameAlias(
      args.table.table_name,
      project.prefix,
      base
    );
  }

  if (
    !(await Model.checkAliasAvailable({
      title: args.table.title,
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

  if (args.table.table_name.length > tableNameLengthLimit) {
    NcError.badRequest(`Table name exceeds ${tableNameLengthLimit} characters`);
  }

  const mxColumnLength = Column.getMaxColumnNameLength(sqlClientType);

  for (const column of args.table.columns) {
    if (column.column_name.length > mxColumnLength) {
      NcError.badRequest(
        `Column name ${column.column_name} exceeds ${mxColumnLength} characters`
      );
    }
  }

  args.table.columns = args.table.columns?.map((c) => ({
    ...getColumnPropsFromUIDT(c as any, base),
    cn: c.column_name,
  }));
  await sqlMgr.sqlOpPlus(base, 'tableCreate', {
    ...args.table,
    tn: args.table.table_name,
  });

  const columns: Array<
    Omit<Column, 'column_name' | 'title'> & {
      cn: string;
      system?: boolean;
    }
  > = (await sqlClient.columnList({ tn: args.table.table_name }))?.data?.list;

  const tables = await Model.list({
    project_id: project.id,
    base_id: base.id,
  });

  await Audit.insert({
    project_id: project.id,
    base_id: base.id,
    op_type: AuditOperationTypes.TABLE,
    op_sub_type: AuditOperationSubTypes.CREATED,
    user: args.user?.email,
    description: `created table ${args.table.table_name} with alias ${args.table.title}  `,
    // ip: (req as any).clientIp,
  }).then(() => {});

  mapDefaultDisplayValue(args.table.columns);

  Tele.emit('evt', { evt_type: 'table:created' });

  const result = await Model.insert(project.id, base.id, {
    ...args.table,
    columns: columns.map((c, i) => {
      const colMetaFromReq = args.table?.columns?.find(
        (c1) => c.cn === c1.column_name
      );
      return {
        ...colMetaFromReq,
        uidt: colMetaFromReq?.uidt || c.uidt || getColumnUiType(base, c),
        ...c,
        dtxp: [UITypes.MultiSelect, UITypes.SingleSelect].includes(
          colMetaFromReq.uidt as any
        )
          ? colMetaFromReq.dtxp
          : c.dtxp,
        title: colMetaFromReq?.title || getColumnNameAlias(c.cn, base),
        column_name: c.cn,
        order: i + 1,
      } as NormalColumnRequestType;
    }),
    order: +(tables?.pop()?.order ?? 0) + 1,
  });

  return result;
}
