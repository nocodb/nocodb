import { promisify } from 'util';

import passport from 'passport';
import Model from '../../../noco-models/Model';
import View from '../../../noco-models/View';
import Hook from '../../../noco-models/Hook';
import GridViewColumn from '../../../noco-models/GridViewColumn';
import FormViewColumn from '../../../noco-models/FormViewColumn';
import GalleryViewColumn from '../../../noco-models/GalleryViewColumn';
import Project from '../../../noco-models/Project';

export default async (req, res, next) => {
  try {
    const { params } = req;

    // extract project id based on request path params
    if (params.projectName) {
      const project = await Project.getByTitle(params.projectName);
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
        id: params.tableId || req.query?.fk_model_id || req.body?.fk_model_id
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
    }

    const user = await new Promise((resolve, _reject) => {
      passport.authenticate('jwt', { session: false }, (_err, user, _info) => {
        if (user && !req.headers['xc-shared-base-id']) {
          if (
            req.path.indexOf('/user/me') === -1 &&
            req.header('xc-preview') &&
            /(?:^|,)(?:owner|creator)(?:$|,)/.test(user.roles)
          ) {
            return resolve({
              ...user,
              isAuthorized: true,
              roles: req.header('xc-preview')
            });
          }

          return resolve({ ...user, isAuthorized: true });
        }

        if (req.headers['xc-token']) {
          passport.authenticate(
            'authtoken',
            {
              session: false,
              optional: false
            },
            (_err, user, _info) => {
              // if (_err) return reject(_err);
              if (user) {
                return resolve({
                  ...user,
                  isAuthorized: true,
                  roles: user.roles === 'owner' ? 'owner,creator' : user.roles
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
                isPublicBase: true
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
