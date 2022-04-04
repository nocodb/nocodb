import { Request, Response, Router } from 'express';
import Model from '../../../noco-models/Model';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import { Tele } from 'nc-help';
import {
  AuditOperationSubTypes,
  AuditOperationTypes,
  ModelTypes,
  TableListType,
  TableReqType,
  TableType
} from 'nocodb-sdk';
import ProjectMgrv2 from '../../../sqlMgr/v2/ProjectMgrv2';
import Project from '../../../noco-models/Project';
import Audit from '../../../noco-models/Audit';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { xcVisibilityMetaGet } from './modelVisibilityApis';
import View from '../../../noco-models/View';
import getColumnPropsFromUIDT from '../helpers/getColumnPropsFromUIDT';
import mapDefaultPrimaryValue from '../helpers/mapDefaultPrimaryValue';
import { NcError } from '../helpers/catchError';
import getTableNameAlias from '../helpers/getTableName';
export async function tableGet(req: Request, res: Response<TableType>) {
  const table = await Model.getWithInfo({
    id: req.params.tableId
  });

  // todo: optimise
  const viewList = <View[]>await xcVisibilityMetaGet(table.project_id, [table]);

  //await View.list(req.params.tableId)
  table.views = viewList.filter((table: any) => {
    return Object.keys((req as any).session?.passport?.user?.roles).some(
      role =>
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
        role =>
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
      base_id: req.params.baseId
    })
  ).filter(t => tableViewMapping[t.id]);

  res // todo: pagination
    .json(
      new PagedResponseImpl(
        req.query?.includeM2M
          ? tableList
          : (tableList.filter(t => !t.mm) as Model[])
      )
    );
}

export async function tableCreate(req: Request<any, any, TableReqType>, res) {
  const project = await Project.getWithInfo(req.params.projectId);
  const base = project.bases[0];

  if (!req.body.table_name) {
    NcError.badRequest(
      'Missing table name `table_name` property in request body'
    );
  }

  if (project.prefix) {
    if (!req.body.table_name.startsWith(project.prefix)) {
      req.body.table_name = `${project.prefix}_${req.body.table_name}`;
    }
  }

  if (
    !(await Model.checkTitleAvailable({
      table_name: req.body.table_name,
      project_id: project.id,
      base_id: base.id
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
      base_id: base.id
    }))
  ) {
    NcError.badRequest('Duplicate table alias');
  }

  const sqlMgr = await ProjectMgrv2.getSqlMgr(project);
  req.body.columns = req.body.columns?.map(c => ({
    ...getColumnPropsFromUIDT(c as any, base),
    cn: c.column_name
  }));
  await sqlMgr.sqlOpPlus(base, 'tableCreate', {
    ...req.body,
    tn: req.body.table_name
  });

  const tables = await Model.list({
    project_id: project.id,
    base_id: base.id
  });

  Audit.insert({
    project_id: project.id,
    op_type: AuditOperationTypes.TABLE,
    op_sub_type: AuditOperationSubTypes.CREATED,
    user: (req as any)?.user?.email,
    description: `created table ${req.body.table_name} with alias ${req.body.title}  `,
    ip: (req as any).clientIp
  }).then(() => {});

  mapDefaultPrimaryValue(req.body.columns);

  Tele.emit('evt', { evt_type: 'table:created' });

  res.json(
    await Model.insert(project.id, base.id, {
      ...req.body,
      // todo: sanitise
      order: +(tables?.pop()?.order ?? 0) + 1
    })
  );
}

export async function tableUpdate(req: Request<any, any>, res) {
  const model = await Model.get(req.params.tableId);

  if (
    !(await Model.checkAliasAvailable({
      title: req.body.title,
      project_id: model.project_id,
      base_id: model.base_id,
      exclude_id: req.params.tableId
    }))
  ) {
    NcError.badRequest('Duplicate table name');
  }

  await Model.updateAlias(req.params.tableId, req.body.title);

  Tele.emit('evt', { evt_type: 'table:updated' });

  res.json({ msg: 'success' });
}

export async function tableDelete(req: Request, res: Response, next) {
  try {
    console.log(req.params);
    const table = await Model.getByIdOrName({ id: req.params.tableId });
    await table.getColumns();

    const project = await Project.getWithInfo(table.project_id);
    const base = project.bases.find(b => b.id === table.base_id);
    const sqlMgr = await ProjectMgrv2.getSqlMgr(project);
    (table as any).tn = table.table_name;
    table.columns.forEach(c => {
      (c as any).cn = c.column_name;
    });

    if (table.type === ModelTypes.TABLE) {
      await sqlMgr.sqlOpPlus(base, 'tableDelete', table);
    } else if (table.type === ModelTypes.VIEW) {
      await sqlMgr.sqlOpPlus(base, 'viewDelete', {
        ...table,
        view_name: table.table_name
      });
    }

    Audit.insert({
      project_id: project.id,
      op_type: AuditOperationTypes.TABLE,
      op_sub_type: AuditOperationSubTypes.DELETED,
      user: (req as any)?.user?.email,
      description: `Deleted ${table.type} ${table.table_name} with alias ${table.title}  `,
      ip: (req as any).clientIp
    }).then(() => {});

    Tele.emit('evt', { evt_type: 'table:deleted' });

    res.json(await table.delete());
  } catch (e) {
    console.log(e);
    next(e);
  }
}

const router = Router({ mergeParams: true });
router.get('/projects/:projectId/:baseId/tables', ncMetaAclMw(tableList));
router.post('/projects/:projectId/:baseId/tables', ncMetaAclMw(tableCreate));
router.get('/tables/:tableId', ncMetaAclMw(tableGet));
router.put('/tables/:tableId', ncMetaAclMw(tableUpdate));
router.delete('/tables/:tableId', ncMetaAclMw(tableDelete));
router.post('/tables/:tableId/reorder', ncMetaAclMw(tableReorder));
export default router;
