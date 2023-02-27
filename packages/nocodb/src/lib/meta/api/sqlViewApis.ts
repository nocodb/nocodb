import { Request, Response, Router } from 'express';
import DOMPurify from 'isomorphic-dompurify';
import { AuditOperationTypes, AuditOperationSubTypes, ModelTypes } from 'nocodb-sdk';
import Project from '../../models/Project';
import Model from '../../models/Model';
import Column from '../../models/Column';
import getTableNameAlias, { getColumnNameAlias } from '../helpers/getTableName';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { metaApiMetrics } from '../helpers/apiMetrics';
import { NcError } from '../helpers/catchError';
import ProjectMgrv2 from '../../db/sql-mgr/v2/ProjectMgrv2';
import Audit from '../../models/Audit';
import NcConnectionMgrv2 from '../../utils/common/NcConnectionMgrv2';
import getColumnUiType from '../helpers/getColumnUiType';
import mapDefaultDisplayValue from '../helpers/mapDefaultDisplayValue';

export async function sqlViewCreate(
  req: Request<any, any, any>,
  res: Response<any>
) {
  const project = await Project.getWithInfo(req.params.projectId);
  let base = project.bases[0];

  if (req.params.baseId) {
    base = project.bases.find((b) => b.id === req.params.baseId);
  }

  if (
    !req.body.view_name ||
    (project.prefix && project.prefix === req.body.view_name)
  ) {
    NcError.badRequest(
      'Missing table name `view_name` property in request body'
    );
  }

  if (base.is_meta && project.prefix) {
    if (!req.body.view_name.startsWith(project.prefix)) {
      req.body.view_name = `${project.prefix}_${req.body.view_name}`;
    }
  }

  req.body.view_name = DOMPurify.sanitize(req.body.view_name);

  // validate table name
  if (/^\s+|\s+$/.test(req.body.view_name)) {
    NcError.badRequest(
      'Leading or trailing whitespace not allowed in table names'
    );
  }

  if (
    !(await Model.checkTitleAvailable({
      table_name: req.body.view_name,
      project_id: project.id,
      base_id: base.id,
    }))
  ) {
    NcError.badRequest('Duplicate table name');
  }

  if (!req.body.title) {
    req.body.title = getTableNameAlias(
      req.body.view_name,
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

  if (req.body.view_name.length > tableNameLengthLimit) {
    NcError.badRequest(`Table name exceeds ${tableNameLengthLimit} characters`);
  }

  await sqlMgr.sqlOpPlus(base, 'viewCreate', {
    view_name: req.body.view_name,
    view_definition: req.body.view_definition,
  });

  const columns: Array<
    Omit<Column, 'column_name' | 'title'> & {
      cn: string;
      system?: boolean;
    }
  > = (await sqlClient.columnList({ tn: req.body.view_name }))?.data?.list;

  const tables = await Model.list({
    project_id: project.id,
    base_id: base.id,
  });

  await Audit.insert({
    project_id: project.id,
    base_id: base.id,
    op_type: AuditOperationTypes.TABLE,
    op_sub_type: AuditOperationSubTypes.CREATED,
    user: (req as any)?.user?.email,
    description: `created view ${req.body.view_name} with alias ${req.body.title}  `,
    ip: (req as any).clientIp,
  }).then(() => {});

  mapDefaultDisplayValue(columns);

  const model = await Model.insert(project.id, base.id, {
    table_name: req.body.view_name,
    title: getTableNameAlias(req.body.view_name, project.prefix, base),
    type: ModelTypes.VIEW,
    order: +(tables?.pop()?.order ?? 0) + 1,
  })

  let colOrder = 1;

  for (const column of columns) {
    await Column.insert({
      fk_model_id: model.id,
      ...column,
      title: getColumnNameAlias(column.cn, base),
      order: colOrder++,
      uidt: getColumnUiType(base, column),
    });
  }

  res.json(await Model.get(model.id));
}

const router = Router({ mergeParams: true });

router.post(
  '/api/v1/db/meta/projects/:projectId/bases/:baseId/sqlView',
  metaApiMetrics,
  ncMetaAclMw(sqlViewCreate, 'sqlViewCreate')
);

export default router;
