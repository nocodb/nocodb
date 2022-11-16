import Model from '../../models/Model';
import ModelRoleVisibility from '../../models/ModelRoleVisibility';
import { Router } from 'express';
import { Tele } from 'nc-help';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import Project from '../../models/Project';
import { metaApiMetrics } from '../helpers/apiMetrics';
async function xcVisibilityMetaSetAll(req, res) {
  Tele.emit('evt', { evt_type: 'uiAcl:updated' });
  for (const d of req.body) {
    for (const role of Object.keys(d.disabled)) {
      const dataInDb = await ModelRoleVisibility.get({
        role,
        // fk_model_id: d.fk_model_id,
        fk_view_id: d.id,
      });
      if (dataInDb) {
        if (d.disabled[role]) {
          if (!dataInDb.disabled) {
            await ModelRoleVisibility.update(d.id, role, {
              disabled: d.disabled[role],
            });
          }
        } else {
          await dataInDb.delete();
        }
      } else if (d.disabled[role]) {
        await ModelRoleVisibility.insert({
          fk_view_id: d.id,
          disabled: d.disabled[role],
          role,
        });
      }
    }
  }
  Tele.emit('evt', { evt_type: 'uiAcl:updated' });

  res.json({ msg: 'success' });
}

// @ts-ignore
export async function xcVisibilityMetaGet(
  projectId,
  _models: Model[] = null,
  includeM2M = true
  // type: 'table' | 'tableAndViews' | 'views' = 'table'
) {
  // todo: move to
  const roles = ['owner', 'creator', 'viewer', 'editor', 'commenter', 'guest'];

  const defaultDisabled = roles.reduce((o, r) => ({ ...o, [r]: false }), {});
  const project = await Project.getWithInfo(projectId);

  let models =
    _models ||
    (await Model.list({
      project_id: projectId,
      base_id: project?.bases?.[0]?.id,
    }));

  models = includeM2M ? models : (models.filter((t) => !t.mm) as Model[]);

  const result = await models.reduce(async (_obj, model) => {
    const obj = await _obj;
    // obj[model.id] = {
    //   tn: model.tn,
    //   _tn: model._tn,
    //   order: model.order,
    //   fk_model_id: model.id,
    //   id: model.id,
    //   type: model.type,
    //   disabled: { ...defaultDisabled }
    // };
    // if (type === 'tableAndViews') {
    const views = await model.getViews();
    for (const view of views) {
      obj[view.id] = {
        ptn: model.table_name,
        _ptn: model.title,
        ptype: model.type,
        tn: view.title,
        _tn: view.title,
        ...view,
        disabled: { ...defaultDisabled },
      };
      // }
    }

    return obj;
  }, Promise.resolve({}));

  const disabledList = await ModelRoleVisibility.list(projectId);

  for (const d of disabledList) {
    // if (d.fk_model_id) result[d.fk_model_id].disabled[d.role] = !!d.disabled;
    // else if (type === 'tableAndViews' && d.fk_view_id)
    if (result[d.fk_view_id])
      result[d.fk_view_id].disabled[d.role] = !!d.disabled;
  }

  return Object.values(result);
  // ?.sort(
  // (a: any, b: any) =>
  //   (a.order || 0) - (b.order || 0) ||
  //   (a?._tn || a?.tn)?.localeCompare(b?._tn || b?.tn)
  // );
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/db/meta/projects/:projectId/visibility-rules',
  metaApiMetrics,
  ncMetaAclMw(async (req, res) => {
    res.json(
      await xcVisibilityMetaGet(
        req.params.projectId,
        null,
        req.query.includeM2M === true || req.query.includeM2M === 'true'
      )
    );
  }, 'modelVisibilityList')
);
router.post(
  '/api/v1/db/meta/projects/:projectId/visibility-rules',
  metaApiMetrics,
  ncMetaAclMw(xcVisibilityMetaSetAll, 'modelVisibilitySet')
);
export default router;
