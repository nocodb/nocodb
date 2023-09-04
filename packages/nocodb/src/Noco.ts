import path from 'path';
import Sentry, { Handlers } from '@sentry/node';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import clear from 'clear';
import * as express from 'express';
import NcToolGui from 'nc-lib-gui';
import { T } from 'nc-help';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { IoAdapter } from '@nestjs/platform-socket.io';
import requestIp from 'request-ip';
import cookieParser from 'cookie-parser';
import type { MetaService } from '~/meta/meta.service';
import type { IEventEmitter } from '~/modules/event-emitter/event-emitter.interface';
import type { Express } from 'express';
// import type * as http from 'http';

import type http from 'http';
import { MetaTable } from '~/utils/globals';
import Store from '~/models/Store';
import { NC_LICENSE_KEY } from '~/constants';
import { AppModule } from '~/app.module';
import { isEE } from '~/utils';

dotenv.config();

export default class Noco {
  private static _this: Noco;
  private static ee: boolean;
  public static readonly env: string = '_noco';
  private static _httpServer: http.Server;
  private static _server: Express;
  private static logger = new Logger(Noco.name);

  public static get dashboardUrl(): string {
    const siteUrl = `http://localhost:${process.env.PORT || 8080}`;

    return `${siteUrl}${Noco._this?.config?.dashboardPath}`;
  }

  public static config: any;
  public static eventEmitter: IEventEmitter;
  public readonly router: express.Router;
  public readonly projectRouter: express.Router;
  public static _ncMeta: any;
  public readonly metaMgr: any;
  public readonly metaMgrv2: any;
  public env: string;

  private config: any;
  private requestContext: any;

  constructor() {
    process.env.PORT = process.env.PORT || '8080';
    // todo: move
    // if env variable NC_MINIMAL_DBS is set, then disable project creation with external sources
    if (process.env.NC_MINIMAL_DBS === 'true') {
      process.env.NC_CONNECT_TO_EXTERNAL_DB_DISABLED = 'true';
    }

    this.router = express.Router();
    this.projectRouter = express.Router();

    clear();
    /******************* prints : end *******************/
  }

  public getConfig(): any {
    return this.config;
  }

  public getToolDir(): string {
    return this.getConfig()?.toolDir;
  }

  public addToContext(context: any) {
    this.requestContext = context;
  }

  public static get ncMeta(): MetaService {
    return this._ncMeta;
  }

  public get ncMeta(): any {
    return Noco._ncMeta;
  }

  public static getConfig(): any {
    return Noco.config;
  }

  public static isEE(): boolean {
    return Noco.ee || process.env.NC_CLOUD === 'true';
  }

  public static async loadEEState(): Promise<boolean> {
    try {
      return (Noco.ee = isEE);
    } catch {}
    return (Noco.ee = false);
  }

  static async init(param: any, httpServer: http.Server, server: Express) {
    const nestApp = await NestFactory.create(
      AppModule,
      // new ExpressAdapter(server),
    );

    nestApp.useWebSocketAdapter(new IoAdapter(httpServer));

    this._httpServer = nestApp.getHttpAdapter().getInstance();
    this._server = server;

    nestApp.use(requestIp.mw());
    nestApp.use(cookieParser());

    this.initSentry(nestApp);

    nestApp.useWebSocketAdapter(new IoAdapter(httpServer));

    nestApp.use(
      express.json({ limit: process.env.NC_REQUEST_BODY_SIZE || '50mb' }),
    );

    await nestApp.init();

    const dashboardPath = process.env.NC_DASHBOARD_URL ?? '/dashboard';
    server.use(NcToolGui.expressMiddleware(dashboardPath));
    server.use(express.static(path.join(__dirname, 'public')));

    if (dashboardPath !== '/' && dashboardPath !== '') {
      server.get('/', (_req, res) => res.redirect(dashboardPath));
    }

    this.initSentryErrorHandler(server);

    return nestApp.getHttpAdapter().getInstance();
  }

  public static get httpServer(): http.Server {
    return Noco._httpServer;
  }

  public static get server(): Express {
    return Noco._server;
  }

  public static async initJwt(): Promise<any> {
    if (this.config?.auth?.jwt) {
      if (!this.config.auth.jwt.secret) {
        let secret = (
          await Noco._ncMeta.metaGet('', '', MetaTable.STORE, {
            key: 'nc_auth_jwt_secret',
          })
        )?.value;
        if (!secret) {
          await Noco._ncMeta.metaInsert('', '', MetaTable.STORE, {
            key: 'nc_auth_jwt_secret',
            value: (secret = uuidv4()),
          });
        }
        this.config.auth.jwt.secret = secret;
      }

      this.config.auth.jwt.options = this.config.auth.jwt.options || {};
      if (!this.config.auth.jwt.options?.expiresIn) {
        this.config.auth.jwt.options.expiresIn =
          process.env.NC_JWT_EXPIRES_IN ?? '10h';
      }
    }
    let serverId = (
      await Noco._ncMeta.metaGet('', '', MetaTable.STORE, {
        key: 'nc_server_id',
      })
    )?.value;
    if (!serverId) {
      await Noco._ncMeta.metaInsert('', '', MetaTable.STORE, {
        key: 'nc_server_id',
        value: (serverId = T.id),
      });
    }
    process.env.NC_SERVER_UUID = serverId;
  }

  private static initSentryErrorHandler(router) {
    if (process.env.NC_SENTRY_DSN) {
      router.use(Handlers.errorHandler());
    }
  }

  private static initSentry(router) {
    if (process.env.NC_SENTRY_DSN) {
      Sentry.init({ dsn: process.env.NC_SENTRY_DSN });

      // The request handler must be the first middleware on the app
      router.use(Handlers.requestHandler());
    }
  }
}
