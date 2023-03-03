import { Request, Response, Router } from 'express';
import DOMPurify from 'isomorphic-dompurify';
import { TableListType, TableReqType, TableType } from 'nocodb-sdk';
import ProjectMgrv2 from '../db/sql-mgr/v2/ProjectMgrv2';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import { NcError } from '../meta/helpers/catchError';
import getTableNameAlias from '../meta/helpers/getTableName';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { PagedResponseImpl } from '../meta/helpers/PagedResponse';
import Model from '../models/Model';
import Project from '../models/Project';
import { T } from 'nc-help';
import { tableService } from '../services';
import NcConnectionMgrv2 from '../utils/common/NcConnectionMgrv2';

export async function tableList(req: Request, res: Response<TableListType>) {
  res.json(
    new PagedResponseImpl(
      await tableService.getAccessibleTables({
        projectId: req.params.projectId,
        baseId: req.params.baseId,
        includeM2M: req.query?.includeM2M === 'true',
        roles: (req as any).session?.passport?.user?.roles,
      })
    )
  );
}

export async function tableCreate(req: Request<any, any, TableReqType>, res) {
  const result = await tableService.tableCreate({
    projectId: req.params.projectId,
    baseId: req.params.baseId,
    table: req.body,
    user: (req as any).session?.passport?.user,
  });

  res.json(result);
}

export async function tableGet(req: Request, res: Response<TableType>) {
  const table = await tableService.getTableWithAccessibleViews({
    tableId: req.params.tableId,
    user: (req as any).session?.passport?.user,
  });

  res.json(table);
}

export async function tableDelete(req: Request, res: Response) {
  const result = await tableService.tableDelete({
    tableId: req.params.tableId,
    user: (req as any).session?.passport?.user,
  });

  res.json(result);
}

export async function tableReorder(req: Request, res: Response) {
  res.json(
    await tableService.reorderTable({
      tableId: req.params.tableId,
      order: req.body.order,
    })
  );
}

// todo: move to table service
export async function tableUpdate(req: Request<any, any>, res) {
  const model = await Model.get(req.params.tableId);

  const project = await Project.getWithInfo(
    req.body.project_id || (req as any).ncProjectId
  );
  const base = project.bases.find((b) => b.id === model.base_id);

  if (model.project_id !== project.id) {
    NcError.badRequest('Model does not belong to project');
  }

  // if meta present update meta and return
  // todo: allow user to update meta  and other prop in single api call
  if ('meta' in req.body) {
    await Model.updateMeta(req.params.tableId, req.body.meta);

    return res.json({ msg: 'success' });
  }

  if (!req.body.table_name) {
    NcError.badRequest(
      'Missing table name `table_name` property in request body'
    );
  }

  if (base.is_meta && project.prefix) {
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

  T.emit('evt', { evt_type: 'table:updated' });

  res.json({ msg: 'success' });
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/db/meta/projects/:projectId/tables',
  metaApiMetrics,
  ncMetaAclMw(tableList, 'tableList')
);
router.get(
  '/api/v1/db/meta/projects/:projectId/:baseId/tables',
  metaApiMetrics,
  ncMetaAclMw(tableList, 'tableList')
);
router.post(
  '/api/v1/db/meta/projects/:projectId/tables',
  metaApiMetrics,
  ncMetaAclMw(tableCreate, 'tableCreate')
);
router.post(
  '/api/v1/db/meta/projects/:projectId/:baseId/tables',
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
