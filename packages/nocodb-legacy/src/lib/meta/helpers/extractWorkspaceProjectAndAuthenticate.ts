import { promisify } from 'util';

import passport from 'passport';
import Model from '../../models/Model';
import View from '../../models/View';
import Hook from '../../models/Hook';
import GridViewColumn from '../../models/GridViewColumn';
import FormViewColumn from '../../models/FormViewColumn';
import GalleryViewColumn from '../../models/GalleryViewColumn';
import Project from '../../models/Project';
import Column from '../../models/Column';
import Filter from '../../models/Filter';
import Sort from '../../models/Sort';

export default async (req, res, next) => {
  try {
    const { params, query, body } = req;

    // extract project id based on request path params
    if (params.projectName) {
      const project = await Project.getByTitleOrId(params.projectName);
      req.ncProjectId = project.id;
      res.locals.project = project;
    }
    if (params.projectId) {
      req.ncProjectId = params.projectId;
    } else if (req.query.project_id) {
      req.ncProjectId = req.query.project_id;
    } else if (
      params.tableId ||
      req.query.fk_model_id ||
      req.body?.fk_model_id
    ) {
      const model = await Model.getByIdOrName({
        id: params.tableId || req.query?.fk_model_id || req.body?.fk_model_id,
      });
      req.ncProjectId = model?.project_id;
    } else if (params.viewId) {
      const view =
        (await View.get(params.viewId)) || (await Model.get(params.viewId));
      req.ncProjectId = view?.project_id;
    } else if (
      params.formViewId ||
      params.gridViewId ||
      params.kanbanViewId ||
      params.galleryViewId
    ) {
      const view = await View.get(
        params.formViewId ||
          params.gridViewId ||
          params.kanbanViewId ||
          params.galleryViewId
      );
      req.ncProjectId = view?.project_id;
    } else if (params.publicDataUuid) {
      const view = await View.getByUUID(req.params.publicDataUuid);
      req.ncProjectId = view?.project_id;
    } else if (params.hookId) {
      const hook = await Hook.get(params.hookId);
      req.ncProjectId = hook?.project_id;
    } else if (params.gridViewColumnId) {
      const gridViewColumn = await GridViewColumn.get(params.gridViewColumnId);
      req.ncProjectId = gridViewColumn?.project_id;
    } else if (params.formViewColumnId) {
      const formViewColumn = await FormViewColumn.get(params.formViewColumnId);
      req.ncProjectId = formViewColumn?.project_id;
    } else if (params.galleryViewColumnId) {
      const galleryViewColumn = await GalleryViewColumn.get(
        params.galleryViewColumnId
      );
      req.ncProjectId = galleryViewColumn?.project_id;
    } else if (params.columnId) {
      const column = await Column.get({ colId: params.columnId });
      req.ncProjectId = column?.project_id;
    } else if (params.filterId) {
      const filter = await Filter.get(params.filterId);
      req.ncProjectId = filter?.project_id;
    } else if (params.filterParentId) {
      const filter = await Filter.get(params.filterParentId);
      req.ncProjectId = filter?.project_id;
    } else if (params.sortId) {
      const sort = await Sort.get(params.sortId);
      req.ncProjectId = sort?.project_id;
    }
    // todo : verify id not present in body
    else if (body.projectId) {
      req.ncProjectId = body.projectId;
    } else if (body.project_id) {
      req.ncProjectId = body.project_id;
    } else if (query.projectId) {
      req.ncProjectId = query.projectId;
    } else if (query.project_id) {
      req.ncProjectId = query.project_id;
    }

    // todo:  verify all scenarios
    // extract workspace id based on request path params or projectId
    if (req.ncProjectId) {
      req.ncWorkspaceId = (await Project.get(req.ncProjectId))?.fk_workspace_id;
    } else if (req.params.workspaceId) {
      req.ncWorkspaceId = req.params.workspaceId;
    } else if (req.body.fk_workspace_id) {
      req.ncWorkspaceId = req.body.fk_workspace_id;
    }

    const user = await new Promise((resolve, _reject) => {
      passport.authenticate('jwt', { session: false }, (_err, user, _info) => {
        if (
          user &&
          !req.headers['xc-shared-base-id'] &&
          !req.headers['xc-shared-erd-id']
        ) {
          if (
            req.path.indexOf('/user/me') === -1 &&
            req.header('xc-preview') &&
            /(?:^|,)(?:owner|creator)(?:$|,)/.test(user.roles)
          ) {
            return resolve({
              ...user,
              isAuthorized: true,
              roles: req.header('xc-preview'),
            });
          }

          return resolve({ ...user, isAuthorized: true });
        }

        if (req.headers['xc-token']) {
          passport.authenticate(
            'authtoken',
            {
              session: false,
              optional: false,
            },
            (_err, user, _info) => {
              // if (_err) return reject(_err);
              if (user) {
                return resolve({
                  ...user,
                  isAuthorized: true,
                  roles: user.roles === 'owner' ? 'owner,creator' : user.roles,
                });
              } else {
                resolve({ roles: 'guest' });
              }
            }
          )(req, res, next);
        } else if (req.headers['xc-shared-base-id']) {
          passport.authenticate('baseView', {}, (_err, user, _info) => {
            // if (_err) return reject(_err);
            if (user) {
              return resolve({
                ...user,
                isAuthorized: true,
                isPublicBase: true,
              });
            } else {
              resolve({ roles: 'guest' });
            }
          })(req, res, next);
        } else if (req.headers['xc-shared-erd-id']) {
          passport.authenticate('erdView', {}, (_err, user, _info) => {
            // if (_err) return reject(_err);
            if (user) {
              return resolve({
                ...user,
                isAuthorized: true,
                isPublicBase: true,
              });
            } else {
              resolve({ roles: 'guest' });
            }
          })(req, res, next);
        } else {
          resolve({ roles: 'guest' });
        }
      })(req, res, next);
    });

    await promisify((req as any).login.bind(req))(user);
    next();
  } catch (e) {
    console.log(e);
    next(new Error('Internal error'));
  }
};
