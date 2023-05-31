import crypto from 'crypto';
import { T } from 'nc-help';
import { Server } from 'socket.io';
import passport from 'passport';
import orgLicenseController from '../../controllers/orgLicense.ctl';
import orgTokenController from '../../controllers/orgToken.ctl';
import orgUserController from '../../controllers/orgUser.ctl';
import projectController from '../../controllers/project.ctl';
import baseController from '../../controllers/base.ctl';
import tableController from '../../controllers/table.ctl';
import columnController from '../../controllers/column.ctl';
import sortController from '../../controllers/sort.ctl';
import filterController from '../../controllers/filter.ctl';
import viewColumnController from '../../controllers/viewColumn.ctl';
import gridViewController from '../../controllers/views/gridView.ctl';
import viewController from '../../controllers/view.ctl';
import galleryViewController from '../../controllers/views/galleryView.ctl';
import formViewController from '../../controllers/views/formView.ctl';
import formViewColumnController from '../../controllers/views/formViewColumn.ctl';
import attachmentController from '../../controllers/attachment.ctl';
import exportController from '../../controllers/export.ctl';
import auditController from '../../controllers/audit.ctl';
import hookController from '../../controllers/hook.ctl';
import pluginController from '../../controllers/plugin.ctl';
import gridViewColumnController from '../../controllers/views/gridViewColumn.ctl';
import kanbanViewController from '../../controllers/views/kanbanView.ctl';
import { userController } from '../../controllers/user';
import utilController from '../../controllers/util.ctl';
import projectUserController from '../../controllers/projectUser.ctl';
import sharedBaseController from '../../controllers/sharedBase.ctl';
import { initStrategies } from '../../controllers/user/initStrategies';
import modelVisibilityController from '../../controllers/modelVisibility.ctl';
import metaDiffController from '../../controllers/metaDiff.ctl';
import cacheController from '../../controllers/cache.ctl';
import apiTokenController from '../../controllers/apiToken.ctl';
import testController from '../../controllers/test.ctl';
import {
  bulkDataAliasController,
  dataAliasController,
  dataAliasExportController,
  dataAliasNestedController,
  dataController,
  oldDataController,
} from '../../controllers/dbData';
import {
  publicDataController,
  publicDataExportController,
  publicMetaController,
} from '../../controllers/publicControllers';
import swaggerController from '../../controllers/apiDocs';
import { importController, syncSourceController } from '../../controllers/sync';
import mapViewController from '../../controllers/views/mapView.ctl';
import exportImportController from '../../controllers/exportImport'
import type { Socket } from 'socket.io';
import type { Router } from 'express';

const clients: { [id: string]: Socket } = {};
const jobs: { [id: string]: { last_message: any } } = {};

export default function (router: Router, server) {
  initStrategies(router);
  projectController(router);
  baseController(router);
  utilController(router);

  if (process.env['PLAYWRIGHT_TEST'] === 'true') {
    router.use(testController);
  }
  router.use(columnController);
  router.use(exportController);
  router.use(dataController);
  router.use(bulkDataAliasController);
  router.use(dataAliasController);
  router.use(dataAliasNestedController);
  router.use(dataAliasExportController);
  router.use(oldDataController);
  router.use(sortController);
  router.use(filterController);
  router.use(viewColumnController);
  router.use(gridViewController);
  router.use(formViewColumnController);
  router.use(publicDataController);
  router.use(publicDataExportController);
  router.use(publicMetaController);
  router.use(gridViewColumnController);
  router.use(tableController);
  router.use(galleryViewController);
  router.use(formViewController);
  router.use(viewController);
  router.use(attachmentController);
  router.use(auditController);
  router.use(hookController);
  router.use(pluginController);
  router.use(projectUserController);
  router.use(orgUserController);
  router.use(orgTokenController);
  router.use(orgLicenseController);
  router.use(sharedBaseController);
  router.use(modelVisibilityController);
  router.use(metaDiffController);
  router.use(cacheController);
  router.use(apiTokenController);
  router.use(swaggerController);
  router.use(syncSourceController);
  router.use(kanbanViewController);
  router.use(mapViewController);
  router.use(exportImportController.exportController);
  router.use(exportImportController.importController);

  userController(router);

  const io = new Server(server, {
    cors: {
      origin: '*',
      allowedHeaders: ['xc-auth'],
      credentials: true,
    },
  });
  io.use(function (socket, next) {
    passport.authenticate(
      'jwt',
      { session: false },
      (_err, user, _info): any => {
        if (!user) {
          socket.disconnect();
          return next(new Error('Unauthorized'));
        }
        (socket.handshake as any).user = user;
        next();
      }
    )(socket.handshake, {}, next);
  }).on('connection', (socket) => {
    clients[socket.id] = socket;
    const id = getHash(
      (process.env.NC_SERVER_UUID || T.id) +
        (socket?.handshake as any)?.user?.id
    );

    socket.on('page', (args) => {
      T.page({ ...args, id });
    });
    socket.on('event', (args) => {
      T.event({ ...args, id });
    });
    socket.on('subscribe', (room) => {
      if (room in jobs) {
        socket.join(room);
        socket.emit('job');
        socket.emit('progress', jobs[room].last_message);
      }
    });
  });

  importController(router, io, jobs);
}

function getHash(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}
