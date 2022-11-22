import { Request, Response, Router } from 'express';
import Model from '../../models/Model';
import { Tele } from 'nc-help';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import DOMPurify from 'isomorphic-dompurify';
import {
  AuditOperationSubTypes,
  AuditOperationTypes,
  isVirtualCol,
  ModelTypes,
  TableListType,
  TableReqType,
  TableType,
  UITypes,
} from 'nocodb-sdk';
import ProjectMgrv2 from '../../db/sql-mgr/v2/ProjectMgrv2';
import Project from '../../models/Project';
import Audit from '../../models/Audit';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { xcVisibilityMetaGet } from './modelVisibilityApis';
import View from '../../models/View';
import getColumnPropsFromUIDT from '../helpers/getColumnPropsFromUIDT';
import mapDefaultPrimaryValue from '../helpers/mapDefaultPrimaryValue';
import { NcError } from '../helpers/catchError';
import getTableNameAlias, { getColumnNameAlias } from '../helpers/getTableName';
import Column from '../../models/Column';
import NcConnectionMgrv2 from '../../utils/common/NcConnectionMgrv2';
import getColumnUiType from '../helpers/getColumnUiType';
import LinkToAnotherRecordColumn from '../../models/LinkToAnotherRecordColumn';
import { metaApiMetrics } from '../helpers/apiMetrics';

export async function tableGet(req: Request, res: Response<TableType>) {
  const table = await Model.getWithInfo({
    id: req.params.tableId,
  });

  // todo: optimise
  const viewList = <View[]>await xcVisibilityMetaGet(table.project_id, [table]);

  //await View.list(req.params.tableId)
  table.views = viewList.filter((table: any) => {
    return Object.keys((req as any).session?.passport?.user?.roles).some(
      (role) =>
        (req as any)?.session?.passport?.user?.roles[role] &&
        !table.disabled[role]
    );
  });

  res.json(table);
}

export async function tableReorder(req: Request, res: Response) {
  res.json(Model.updateOrder(req.params.tableId, req.body.order));
}

export async function tableList(req: Request, res: Response<TableListType>) {
  const viewList = await xcVisibilityMetaGet(req.params.projectId);

  // todo: optimise
  const tableViewMapping = viewList.reduce((o, view: any) => {
    o[view.fk_model_id] = o[view.fk_model_id] || 0;
    if (
      Object.keys((req as any).session?.passport?.user?.roles).some(
        (role) =>
          (req as any)?.session?.passport?.user?.roles[role] &&
          !view.disabled[role]
      )
    ) {
      o[view.fk_model_id]++;
    }
    return o;
  }, {});

  const tableList = (
    await Model.list({
      project_id: req.params.projectId,
      base_id: req.params.baseId,
    })
  ).filter((t) => tableViewMapping[t.id]);

  res.json(
    new PagedResponseImpl(
      req.query?.includeM2M === 'true'
        ? tableList
        : (tableList.filter((t) => !t.mm) as Model[])
    )
  );
}

export async function tableCreate(req: Request<any, any, TableReqType>, res) {
  const project = await Project.getWithInfo(req.params.projectId);
  const base = project.bases[0];

  if (
    !req.body.table_name ||
    (project.prefix && project.prefix === req.body.table_name)
  ) {
    NcError.badRequest(
      'Missing table name `table_name` property in request body'
    );
  }

  if (project.prefix) {
    if (!req.body.table_name.startsWith(project.prefix)) {
      req.body.table_name = `${project.prefix}_${req.body.table_name}`;
    }
  }

  req.body.table_name = DOMPurify.sanitize(req.body.table_name);

  // validate table name
  if (/^\s+|\s+$/.test(req.body.table_name)) {
    NcError.badRequest(
      'Leading or trailing whitespace not allowed in table names'
    );
  }

  if (
    !(await Model.checkTitleAvailable({
      table_name: req.body.table_name,
      project_id: project.id,
      base_id: base.id,
    }))
  ) {
    NcError.badRequest('Duplicate table name');
  }

  if (!req.body.title) {
    req.body.title = getTableNameAlias(
      req.body.table_name,
      project.prefix,
      base
    );
  }

  if (
    !(await Model.checkAliasAvailable({
      title: req.body.title,
      project_id: project.id,
      base_id: base.id,
    }))
  ) {
    NcError.badRequest('Duplicate table alias');
  }

  const sqlMgr = await ProjectMgrv2.getSqlMgr(project);
  const sqlClient = NcConnectionMgrv2.getSqlClient(base);

  let tableNameLengthLimit = 255;
  const sqlClientType = sqlClient.clientType;
  if (sqlClientType === 'mysql2' || sqlClientType === 'mysql') {
    tableNameLengthLimit = 64;
  } else if (sqlClientType === 'pg') {
    tableNameLengthLimit = 63;
  } else if (sqlClientType === 'mssql') {
    tableNameLengthLimit = 128;
  }

  if (req.body.table_name.length > tableNameLengthLimit) {
    NcError.badRequest(`Table name exceeds ${tableNameLengthLimit} characters`);
  }

  req.body.columns = req.body.columns?.map((c) => ({
    ...getColumnPropsFromUIDT(c as any, base),
    cn: c.column_name,
  }));
  await sqlMgr.sqlOpPlus(base, 'tableCreate', {
    ...req.body,
    tn: req.body.table_name,
  });

  const columns: Array<
    Omit<Column, 'column_name' | 'title'> & {
      cn: string;
      system?: boolean;
    }
  > = (await sqlClient.columnList({ tn: req.body.table_name }))?.data?.list;

  const tables = await Model.list({
    project_id: project.id,
    base_id: base.id,
  });

  await Audit.insert({
    project_id: project.id,
    op_type: AuditOperationTypes.TABLE,
    op_sub_type: AuditOperationSubTypes.CREATED,
    user: (req as any)?.user?.email,
    description: `created table ${req.body.table_name} with alias ${req.body.title}  `,
    ip: (req as any).clientIp,
  }).then(() => {});

  mapDefaultPrimaryValue(req.body.columns);

  Tele.emit('evt', { evt_type: 'table:created' });

  res.json(
    await Model.insert(project.id, base.id, {
      ...req.body,
      columns: columns.map((c, i) => {
        const colMetaFromReq = req.body?.columns?.find(
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
        };
      }),
      order: +(tables?.pop()?.order ?? 0) + 1,
    })
  );
}

export async function tableUpdate(req: Request<any, any>, res) {
  const model = await Model.get(req.params.tableId);

  const project = await Project.getWithInfo(req.body.project_id);
  const base = project.bases[0];

  if (!req.body.table_name) {
    NcError.badRequest(
      'Missing table name `table_name` property in request body'
    );
  }

  if (project.prefix) {
    if (!req.body.table_name.startsWith(project.prefix)) {
      req.body.table_name = `${project.prefix}${req.body.table_name}`;
    }
  }

  req.body.table_name = DOMPurify.sanitize(req.body.table_name);

  // validate table name
  if (/^\s+|\s+$/.test(req.body.table_name)) {
    NcError.badRequest(
      'Leading or trailing whitespace not allowed in table names'
    );
  }

  if (
    !(await Model.checkTitleAvailable({
      table_name: req.body.table_name,
      project_id: project.id,
      base_id: base.id,
    }))
  ) {
    NcError.badRequest('Duplicate table name');
  }

  if (!req.body.title) {
    req.body.title = getTableNameAlias(
      req.body.table_name,
      project.prefix,
      base
    );
  }

  if (
    !(await Model.checkAliasAvailable({
      title: req.body.title,
      project_id: project.id,
      base_id: base.id,
    }))
  ) {
    NcError.badRequest('Duplicate table alias');
  }

  const sqlMgr = await ProjectMgrv2.getSqlMgr(project);
  const sqlClient = NcConnectionMgrv2.getSqlClient(base);

  let tableNameLengthLimit = 255;
  const sqlClientType = sqlClient.clientType;
  if (sqlClientType === 'mysql2' || sqlClientType === 'mysql') {
    tableNameLengthLimit = 64;
  } else if (sqlClientType === 'pg') {
    tableNameLengthLimit = 63;
  } else if (sqlClientType === 'mssql') {
    tableNameLengthLimit = 128;
  }

  if (req.body.table_name.length > tableNameLengthLimit) {
    NcError.badRequest(`Table name exceeds ${tableNameLengthLimit} characters`);
  }

  await Model.updateAliasAndTableName(
    req.params.tableId,
    req.body.title,
    req.body.table_name
  );

  await sqlMgr.sqlOpPlus(base, 'tableRename', {
    ...req.body,
    tn: req.body.table_name,
    tn_old: model.table_name,
  });

  Tele.emit('evt', { evt_type: 'table:updated' });

  res.json({ msg: 'success' });
}

export async function tableDelete(req: Request, res: Response) {
  const table = await Model.getByIdOrName({ id: req.params.tableId });
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
    op_type: AuditOperationTypes.TABLE,
    op_sub_type: AuditOperationSubTypes.DELETED,
    user: (req as any)?.user?.email,
    description: `Deleted ${table.type} ${table.table_name} with alias ${table.title}  `,
    ip: (req as any).clientIp,
  }).then(() => {});

  Tele.emit('evt', { evt_type: 'table:deleted' });

  res.json(await table.delete());
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/db/meta/projects/:projectId/tables',
  metaApiMetrics,
  ncMetaAclMw(tableList, 'tableList')
);
router.post(
  '/api/v1/db/meta/projects/:projectId/tables',
  metaApiMetrics,
  ncMetaAclMw(tableCreate, 'tableCreate')
);
router.get(
  '/api/v1/db/meta/tables/:tableId',
  metaApiMetrics,
  ncMetaAclMw(tableGet, 'tableGet')
);
router.patch(
  '/api/v1/db/meta/tables/:tableId',
  metaApiMetrics,
  ncMetaAclMw(tableUpdate, 'tableUpdate')
);
router.delete(
  '/api/v1/db/meta/tables/:tableId',
  metaApiMetrics,
  ncMetaAclMw(tableDelete, 'tableDelete')
);
router.post(
  '/api/v1/db/meta/tables/:tableId/reorder',
  metaApiMetrics,
  ncMetaAclMw(tableReorder, 'tableReorder')
);
export default router;
