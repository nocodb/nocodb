import { Tele } from 'nc-help';
import orgLicenseApis from './orgLicenseApis';
import orgTokenApis from './orgTokenApis';
import orgUserApis from './orgUserApis';
import projectApis from './projectApis';
import baseApis from './baseApis';
import tableApis from './tableApis';
import columnApis from './columnApis';
import { Router } from 'express';
import sortApis from './sortApis';
import filterApis from './filterApis';
import viewColumnApis from './viewColumnApis';
import gridViewApis from './gridViewApis';
import viewApis from './viewApis';
import galleryViewApis from './galleryViewApis';
import formViewApis from './formViewApis';
import formViewColumnApis from './formViewColumnApis';
import attachmentApis from './attachmentApis';
import exportApis from './exportApis';
import auditApis from './auditApis';
import hookApis from './hookApis';
import pluginApis from './pluginApis';
import gridViewColumnApis from './gridViewColumnApis';
import kanbanViewApis from './kanbanViewApis';
import { userApis } from './userApi';
// import extractProjectIdAndAuthenticate from './helpers/extractProjectIdAndAuthenticate';
import utilApis from './utilApis';
import projectUserApis from './projectUserApis';
import sharedBaseApis from './sharedBaseApis';
import { initStrategies } from './userApi/initStrategies';
import modelVisibilityApis from './modelVisibilityApis';
import metaDiffApis from './metaDiffApis';
import cacheApis from './cacheApis';
import apiTokenApis from './apiTokenApis';
import hookFilterApis from './hookFilterApis';
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
import swaggerApis from './swagger/swaggerApis';
import importApis from './sync/importApis';
import syncSourceApis from './sync/syncSourceApis';

const clients: { [id: string]: Socket } = {};
const jobs: { [id: string]: { last_message: any } } = {};

const middlewares = [];
const socketApis = [];

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
    socket.on('api', (data) => {
      const startAt = process.hrtime();

      const params = {};
      
      const hf = socketApis.find((hf) => {
        if (hf.method !== data.method) return false;
        const hfpath = hf.path.replace(/\/$/, '').split('/')
        const dtpath = data.url.replace(/\?.+/, '').replace(/\/$/, '').split('/')
        if (hfpath.length !== dtpath.length) return false;
        for (let i = 0; i < hfpath.length; i++) {
          if (/^:/.test(hfpath[i])) {
            if (!dtpath[i]) return false;
            params[hfpath[i].substr(1)] = dtpath[i];
          } else {
            if (hfpath[i] !== dtpath[i]) return false;
          }
        }
        return true;
      });
      if (hf) {
        const headers = Object.entries(data.headers)
          .reduce((obj, [key, val]) => {
            if (typeof val === 'string') {
              obj[key] = val;
            } else if (typeof val === 'object') {
              if (key === 'common' || key === data.method) {
                obj = { ...obj, ...val };
              }
            }
            return obj;
          }, { 'xc-socket': 'true'});
        
        data.path = hf.path;
        data.query = data.params || {};
        data.params = params;
        data.headers = headers;
        data.body = data.data;
        data.originalUrl = data.url;

        const req = createReq(data);

        const res = createRes((_cd, dt, _hd) => {
          const rt: any = { id: data.id, socket: true, data: dt }
          if (dt?.setCookie) {
            rt.setCookie = dt.setCookie;
            delete dt.setCookie;
          }

          const ms = process.hrtime(startAt)[0] * 1e3 + process.hrtime(startAt)[1] * 1e-6;

          // :method :url :status - :response-time ms
          process.stdout.write(`${req.method } ${req.url} ${res.statusCode} - ${ms.toFixed(3)} ms\n`)
          socket.emit('api', rt);
        })

        for (const middleware of middlewares) {
          middleware.handle(req, res, () => {});
        }
        
        hf.handle(req, res, () => {})
      }
    });
  });

  importApis(router, io, jobs);

  socketApis.push(...handleRouter(router));
}

function createReq(data: any) {
  const req: any = { ...data };

  req.header = req.get = (p) => req.headers[p];

  req.login =
  req.logIn = function(user, options, done) {
    if (typeof options == 'function') {
      done = options;
      options = {};
    }
    options = options || {};
    
    var property = 'user';
    if (this._passport && this._passport.instance) {
      property = this._passport.instance._userProperty || 'user';
    }
    var session = (options.session === undefined) ? true : options.session;
    
    this[property] = user;
    if (session) {
      if (!this._passport) { throw new Error('passport.initialize() middleware not in use'); }
      if (typeof done != 'function') { throw new Error('req#login requires a callback function'); }
      
      var self = this;
      this._passport.instance._sm.logIn(this, user, function(err) {
        if (err) { self[property] = null; return done(err); }
        done();
      });
    } else {
      done && done();
    }
  };

  req.logout =
  req.logOut = function() {
    var property = 'user';
    if (this._passport && this._passport.instance) {
      property = this._passport.instance._userProperty || 'user';
    }
    
    this[property] = null;
    if (this._passport) {
      this._passport.instance._sm.logOut(this);
    }
  };

  req.isAuthenticated = function() {
    var property = 'user';
    if (this._passport && this._passport.instance) {
      property = this._passport.instance._userProperty || 'user';
    }
    
    return (this[property]) ? true : false;
  };

  req.isUnauthenticated = function() {
    return !this.isAuthenticated();
  };

  return req;
}

function createRes(callback) {
  var res: any = {
    _removedHeader: {},
    headersSent: true,
    statusMessage: 'OK',
    statusCode: 200,
    locals: {},
  };

  var headers = {};
  res.set = res.header = (x, y) => {
    if (arguments.length === 2) {
      res.setHeader(x, y);
    } else {
      for (var key in x) {
        res.setHeader(key, x[key]);
      }
    }
    return res;
  }
  res.setHeader = (x, y) => {
    headers[x] = y;
    headers[x.toLowerCase()] = y;
    return res;
  };
  res.getHeader = (x) => headers[x];

  res.redirect = function(_code, url) {
    if (Number.isNaN(_code)) {
      res.statusCode = 301;
      url = _code;
    } else {
      res.statusCode = _code;
    }
    res.setHeader("Location", url);
    res.end();
  };
  res.status = res.sendStatus = function(number) {
    res.statusCode = number;
    return res;
  };

  res.cookie = function(name, value, options) {
    if (callback) callback(res.statusCode, { setCookie: [ { name, value, options} ] }, {})
  }

  res.end = res.send = res.write = res.json = function(data) {
    if (callback) callback(res.statusCode, data, headers);
  };

  return res;
}

function handleRouter(router: any) {
  if (!router.stack) return [];
  const tempRoutes = [];
  for (const layer of router.stack) {
    if (layer.name !== 'router' && layer.name !== 'logger' && layer.route === undefined && typeof layer.handle === 'function') {
      const rt = {
        method: 'MIDDLEWARE',
        handle: layer.handle,
      }
      middlewares.push(rt);
    }
    if (layer.name === 'bound dispatch' && typeof layer.route.path === 'string') {
      const rt = {
        method: Object.keys(layer.route.methods)[0],
        path: layer.route.path,
        stack: layer.route.stack,
        handle: layer.handle,
      }
      tempRoutes.push(rt);
    } else if (layer.name === 'router') {
      tempRoutes.push(...handleRouter(layer.handle));
    }
  }
  return tempRoutes;
}

function getHash(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}
