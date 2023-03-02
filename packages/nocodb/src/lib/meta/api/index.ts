import { Tele } from 'nc-help';
import tableController from '../../controllers/tableController'
import orgLicenseApis from '../../services/orgLicenseService';
import orgTokenApis from '../../services/orgTokenService';
import orgUserApis from '../../services/orgUserService';
import projectApis from './projectApis';
import baseApis from './baseApis';
// import tableApis from './tableApis';
import columnApis from './columnApis';
import { Router } from 'express';
import sortApis from './sortApis';
import filterApis from './filterApis';
import viewColumnApis from '../../services/viewColumnService';
import gridViewApis from './gridViewApis';
import viewApis from './viewApis';
import galleryViewApis from '../../services/galleryViewApis';
import formViewApis from './formViewApis';
import formViewColumnApis from './formViewColumnApis';
import attachmentApis from '../../services/attachmentService';
import exportApis from './exportApis';
import auditApis from '../../services/auditService';
import hookApis from './hookApis';
import pluginApis from './pluginApis';
import gridViewColumnApis from '../../services/gridViewColumnService';
import kanbanViewApis from '../../services/kanbanViewService';
import { userApis } from './userApi';
// import extractProjectIdAndAuthenticate from './helpers/extractProjectIdAndAuthenticate';
import utilApis from './utilApis';
import projectUserApis from '../../services/projectUserService';
import sharedBaseApis from '../../services/sharedBaseService';
import { initStrategies } from './userApi/initStrategies';
import modelVisibilityApis from '../../services/modelVisibilityService';
import metaDiffApis from '../../services/metaDiffService';
import cacheApis from '../../services/cacheService';
import apiTokenApis from './apiTokenApis';
import hookFilterApis from '../../services/hookFilterService';
import testApis from './testApis';
import {
  bulkDataAliasApis,
  dataAliasApis,
  dataAliasExportApis,
  dataAliasNestedApis,
  dataApis,
  oldDataApis,
} from './dataApis';
import {
  publicDataApis,
  publicDataExportApis,
  publicMetaApis,
} from './publicApis';
import { Server, Socket } from 'socket.io';
import passport from 'passport';

import crypto from 'crypto';
import swaggerApis from '../../controllers/swagger/swaggerApis';
import importApis from './sync/importApis';
import syncSourceApis from './sync/syncSourceApis';
import mapViewApis from '../../services/mapViewService';

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
  router.use(publicDataApis);
  router.use(publicDataExportApis);
  router.use(publicMetaApis);
  router.use(gridViewColumnApis);
  // router.use(tableApis);
  router.use(tableController);
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

  userApis(router);

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
