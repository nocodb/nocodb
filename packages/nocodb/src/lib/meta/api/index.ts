import {createHash} from 'crypto'
import { Router } from 'express'
import { Tele } from 'nc-help';
import { Server, Socket } from 'socket.io'
import passport from 'passport'
import apiTokenController from '../../controllers/apiTokenController'
import attachmentController from '../../controllers/attachmentController'
import auditController from '../../controllers/auditController'
import cacheController from '../../controllers/cacheController'
import columnController from '../../controllers/columnController'
import filterController from '../../controllers/filterController'
import formViewColumnController from '../../controllers/formViewColumnController'
import formViewController from '../../controllers/formViewController'
import galleryViewController from '../../controllers/galleryViewController'
import gridViewColumnController from '../../controllers/gridViewColumnController'
import gridViewController from '../../controllers/gridViewController'
import hookController from '../../controllers/hookController'
import hookFilterController from '../../controllers/hookFilterController'
import mapViewController from '../../controllers/mapViewController'
import metaDiffController from '../../controllers/metaDiffController'
import modelVisibilityController from '../../controllers/modelVisibilityController'
import orgLicenseController from '../../controllers/orgLicenseController'
import orgTokenController from '../../controllers/orgTokenController'
import orgUserController from '../../controllers/orgUserController'
import pluginController from '../../controllers/pluginController'
import projectUserController from '../../controllers/projectUserController'
import { publicDataController, publicDataExportController, publicMetaController } from '../../controllers/public'
import sharedBaseController from '../../controllers/sharedBaseController'
import sortController from '../../controllers/sortController'
import importApis from '../../controllers/syncController/importApis'
import tableController from '../../controllers/tableController'
import { initStrategies } from '../../controllers/userController/initStrategies'
import projectController from '../../controllers/projectController'
import baseController from '../../controllers/baseController'
import utilController from '../../controllers/utilController'
import dataController from '../../controllers/dataController'
import bulkDataController from '../../controllers/dataController/bulkData'
import dataExportController from '../../controllers/dataController/export'
import viewColumnController from '../../controllers/viewColumnController'
import viewController from '../../controllers/viewController'
import swaggerController from '../../controllers/swaggerController'
import syncController from '../../controllers/syncController'
import kanbanViewController from '../../controllers/kanbanViewController'
import { userController } from '../../controllers/userController'
import { oldDataApis } from './dataApis'
import exportApis from './exportApis'
import testApis from './testApis'


const clients: { [id: string]: Socket } = {};
const jobs: { [id: string]: { last_message: any } } = {};

export default function (router: Router, server) {
  initStrategies(router);
  projectController(router);
  baseController(router);
  utilController(router);

  if (process.env['PLAYWRIGHT_TEST'] === 'true') {
    router.use(testApis);
  }
  router.use(columnController);
  router.use(exportApis);
  router.use(dataController);
  router.use(bulkDataController);
  // router.use(dataAliasApis);
  // router.use(dataAliasNestedApis);
  router.use(dataExportController);
  router.use(oldDataApis);
  router.use(sortController);
  router.use(filterController);
  router.use(viewColumnController);
  router.use(gridViewController);
  router.use(formViewColumnController);
  router.use(publicDataController);
  router.use(publicDataExportController);
  router.use(publicMetaController);
  router.use(gridViewColumnController);
  // router.use(tableApis);
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
  router.use(syncController);
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

  importApis(router, io, jobs);
}

function getHash(str) {
  return createHash('md5').update(str).digest('hex');
}
