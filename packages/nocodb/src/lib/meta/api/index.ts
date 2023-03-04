import { Tele } from 'nc-help';
import orgLicenseController from '../../controllers/orgLicenseController';
import orgTokenController from '../../controllers/orgTokenController';
import orgUserController from '../../controllers/orgUserController';
import projectController from '../../controllers/projectController';
import baseController from '../../controllers/baseController';
import tableController from '../../controllers/tableController';
import columnController from '../../controllers/columnController';
import { Router } from 'express';
import sortController from '../../controllers/sortController';
import filterController from '../../controllers/filterController';
import viewColumnController from '../../controllers/viewColumnController';
import gridViewController from '../../controllers/gridViewController';
import viewController from '../../controllers/viewController';
import galleryViewController from '../../controllers/galleryViewController';
import formViewController from '../../controllers/formViewController';
import formViewColumnController from '../../controllers/formViewColumnController';
import attachmentController from '../../controllers/attachmentController';
import exportController from '../../controllers/exportController';
import auditController from '../../controllers/auditController';
import hookController from '../../controllers/hookController';
import pluginController from '../../controllers/pluginController';
import gridViewColumnController from '../../controllers/gridViewColumnController';
import kanbanViewController from '../../controllers/kanbanViewController';
import { userController } from '../../controllers/userController';
// import extractProjectIdAndAuthenticate from './helpers/extractProjectIdAndAuthenticate';
import utilController from '../../controllers/utilController';
import projectUserController from '../../controllers/projectUserController';
import sharedBaseController from '../../controllers/sharedBaseController';
import { initStrategies } from '../../controllers/userController/initStrategies';
import modelVisibilityController from '../../controllers/modelVisibilityController';
import metaDiffController from '../../controllers/metaDiffController';
import cacheController from '../../controllers/cacheController';
import apiTokenController from '../../controllers/apiTokenController';
import hookFilterController from '../../controllers/hookFilterController';
import testController from '../../controllers/testController';
import {
  bulkDataAliasController,
  dataAliasController,
  dataAliasExportController,
  dataAliasNestedController,
  dataController,
  oldDataController,
} from '../../controllers/dataApis';
import {
  publicDataController,
  publicDataExportController,
  publicMetaController,
} from '../../controllers/public';
import { Server, Socket } from 'socket.io';
import passport from 'passport';

import crypto from 'crypto';
import swaggerController from '../../controllers/swaggerController';
import importController from '../../controllers/syncController/importApis';
import syncSourceController from '../../controllers/syncController';
import mapViewController from '../../controllers/mapViewController';

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
  router.use(hookFilterController);
  router.use(swaggerController);
  router.use(syncSourceController);
  router.use(kanbanViewController);
  router.use(mapViewController);

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
      (process.env.NC_SERVER_UUID || Tele.id) +
        (socket?.handshake as any)?.user?.id
    );

    socket.on('page', (args) => {
      Tele.page({ ...args, id });
    });
    socket.on('event', (args) => {
      Tele.event({ ...args, id });
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
