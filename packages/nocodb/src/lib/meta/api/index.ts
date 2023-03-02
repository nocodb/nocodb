import { Tele } from 'nc-help';
import orgLicenseApis from '../../controllers/orgLicenseApis';
import orgTokenApis from '../../controllers/orgTokenApis';
import orgUserApis from '../../controllers/orgUserApis';
import projectApis from '../../controllers/projectApis';
import baseApis from '../../controllers/baseApis';
import tableApis from '../../controllers/tableApis';
import columnApis from '../../controllers/columnApis';
import { Router } from 'express';
import sortApis from '../../controllers/sortApis';
import filterApis from '../../controllers/filterApis';
import viewColumnApis from '../../controllers/viewColumnApis';
import gridViewApis from '../../controllers/gridViewApis';
import viewApis from '../../controllers/viewApis';
import galleryViewApis from '../../controllers/galleryViewApis';
import formViewApis from '../../controllers/formViewApis';
import formViewColumnApis from '../../controllers/formViewColumnApis';
import attachmentApis from '../../controllers/attachmentApis';
import exportApis from '../../controllers/exportApis';
import auditApis from '../../controllers/auditApis';
import hookApis from '../../controllers/hookApis';
import pluginApis from '../../controllers/pluginApis';
import gridViewColumnApis from '../../controllers/gridViewColumnApis';
import kanbanViewApis from '../../controllers/kanbanViewApis';
import { userApis } from '../../controllers/userApi';
// import extractProjectIdAndAuthenticate from './helpers/extractProjectIdAndAuthenticate';
import utilApis from '../../controllers/utilApis';
import projectUserApis from '../../controllers/projectUserApis';
import sharedBaseApis from '../../controllers/sharedBaseApis';
import { initStrategies } from '../../controllers/userApi/initStrategies';
import modelVisibilityApis from '../../controllers/modelVisibilityApis';
import metaDiffApis from '../../controllers/metaDiffApis';
import cacheApis from '../../controllers/cacheApis';
import apiTokenApis from '../../controllers/apiTokenApis';
import hookFilterApis from '../../controllers/hookFilterApis';
import testApis from '../../controllers/testApis';
import {
  bulkDataAliasApis,
  dataAliasApis,
  dataAliasExportApis,
  dataAliasNestedApis,
  dataApis,
  oldDataApis,
} from '../../controllers/dataApis';
import {
  publicDataApis,
  publicDataExportApis,
  publicMetaApis,
} from '../../controllers/publicApis';
import { Server, Socket } from 'socket.io';
import passport from 'passport';

import crypto from 'crypto';
import swaggerApis from '../../controllers/swagger/swaggerApis';
import importApis from '../../controllers/sync/importApis';
import syncSourceApis from '../../controllers/sync/syncSourceApis';
import mapViewApis from '../../controllers/mapViewApis';

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
