import { Tele } from 'nc-help';
import orgLicenseApis from '../../controllers/orgLicenseController';
import orgTokenApis from '../../controllers/orgTokenController';
import orgUserApis from '../../controllers/orgUserController';
import projectApis from '../../controllers/projectController';
import baseApis from '../../controllers/baseController';
import tableApis from '../../controllers/tableController';
import columnApis from '../../controllers/columnController';
import { Router } from 'express';
import sortApis from '../../controllers/sortController';
import filterApis from '../../controllers/filterController';
import viewColumnApis from '../../controllers/viewColumnController';
import gridViewApis from '../../controllers/gridViewController';
import viewApis from '../../controllers/viewController';
import galleryViewApis from '../../controllers/galleryViewController';
import formViewApis from '../../controllers/formViewController';
import formViewColumnApis from '../../controllers/formViewColumnController';
import attachmentApis from '../../controllers/attachmentController';
import exportApis from '../../controllers/exportController';
import auditApis from '../../controllers/auditController';
import hookApis from '../../controllers/hookController';
import pluginApis from '../../controllers/pluginController';
import gridViewColumnApis from '../../controllers/gridViewColumnController';
import kanbanViewApis from '../../controllers/kanbanViewController';
import { userController } from '../../controllers/userController';
// import extractProjectIdAndAuthenticate from './helpers/extractProjectIdAndAuthenticate';
import utilApis from '../../controllers/utilController';
import projectUserApis from '../../controllers/projectUserController';
import sharedBaseApis from '../../controllers/sharedBaseController';
import { initStrategies } from '../../controllers/userController/initStrategies';
import modelVisibilityApis from '../../controllers/modelVisibilityController';
import metaDiffApis from '../../controllers/metaDiffController';
import cacheApis from '../../controllers/cacheController';
import apiTokenApis from '../../controllers/apiTokenController';
import hookFilterApis from '../../controllers/hookFilterController';
import testApis from '../../controllers/testController';
import {
  bulkDataAliasApis,
  dataAliasApis,
  dataAliasExportApis,
  dataAliasNestedApis,
  dataApis,
  oldDataApis,
} from '../../controllers/dataApis';
import {
  publicDataController,
  publicDataExportController,
  publicMetaController,
} from '../../controllers/publc';
import { Server, Socket } from 'socket.io';
import passport from 'passport';

import crypto from 'crypto';
import swaggerApis from '../../controllers/swaggerController';
import importApis from '../../controllers/syncController/importApis';
import syncSourceApis from '../../controllers/syncController';
import mapViewApis from '../../controllers/mapViewController';

const clients: { [id: string]: Socket } = {};
const jobs: { [id: string]: { last_message: any } } = {};

export default function (router: Router, server) {
  initStrategies(router);
  projectApis(router);
  baseApis(router);
  utilApis(router);

  if (process.env['PLAYWRIGHT_TEST'] === 'true') {
    router.use(testApis);
  }
  router.use(columnApis);
  router.use(exportApis);
  router.use(dataApis);
  router.use(bulkDataAliasApis);
  router.use(dataAliasApis);
  router.use(dataAliasNestedApis);
  router.use(dataAliasExportApis);
  router.use(oldDataApis);
  router.use(sortApis);
  router.use(filterApis);
  router.use(viewColumnApis);
  router.use(gridViewApis);
  router.use(formViewColumnApis);
  router.use(publicDataController);
  router.use(publicDataExportController);
  router.use(publicMetaController);
  router.use(gridViewColumnApis);
  router.use(tableApis);
  router.use(galleryViewApis);
  router.use(formViewApis);
  router.use(viewApis);
  router.use(attachmentApis);
  router.use(auditApis);
  router.use(hookApis);
  router.use(pluginApis);
  router.use(projectUserApis);
  router.use(orgUserApis);
  router.use(orgTokenApis);
  router.use(orgLicenseApis);
  router.use(sharedBaseApis);
  router.use(modelVisibilityApis);
  router.use(metaDiffApis);
  router.use(cacheApis);
  router.use(apiTokenApis);
  router.use(hookFilterApis);
  router.use(swaggerApis);
  router.use(syncSourceApis);
  router.use(kanbanViewApis);
  router.use(mapViewApis);

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

  importApis(router, io, jobs);
}

function getHash(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}
