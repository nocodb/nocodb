// import * as Sentry from '@sentry/node';
import { NestFactory } from '@nestjs/core';
import clear from 'clear';
import * as express from 'express';
import NcToolGui from 'nc-lib-gui';
import { ExpressAdapter } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';

import { NC_LICENSE_KEY } from './constants';
import Store from './models/Store';
import type { Express } from 'express';
// import type * as http from 'http';

import type http from 'http';

export default class Noco {
  private static _this: Noco;
  private static ee: boolean;
  public static readonly env: string = '_noco';
  private static _httpServer: http.Server;
  private static _server: Express;

  public static get dashboardUrl(): string {
    let siteUrl = `http://localhost:${process.env.PORT || 8080}`;
    // if (Noco._this?.config?.envs?.[Noco._this?.env]?.publicUrl) {
    //   siteUrl = Noco._this?.config?.envs?.[Noco._this?.env]?.publicUrl;
    // }
    if (Noco._this?.config?.envs?.['_noco']?.publicUrl) {
      siteUrl = Noco._this?.config?.envs?.['_noco']?.publicUrl;
    }

    return `${siteUrl}${Noco._this?.config?.dashboardPath}`;
  }

  public static config: any;
  public readonly router: express.Router;
  public readonly projectRouter: express.Router;
  public static _ncMeta: any;
  public readonly metaMgr: any;
  public readonly metaMgrv2: any;
  public env: string;

  private ncToolApi;
  private config: any;
  private requestContext: any;

  constructor() {
    process.env.PORT = process.env.PORT || '8080';
    // todo: move
    // if env variable NC_MINIMAL_DBS is set, then disable project creation with external sources
    if (process.env.NC_MINIMAL_DBS) {
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

  public static get ncMeta(): any {
    return this._ncMeta;
  }

  public get ncMeta(): any {
    return Noco._ncMeta;
  }

  public static getConfig(): any {
    return Noco.config;
  }

  public static isEE(): boolean {
    return Noco.ee;
  }

  public static async loadEEState(): Promise<boolean> {
    try {
      return (Noco.ee = !!(await Store.get(NC_LICENSE_KEY))?.value);
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

    nestApp.use(
      express.json({ limit: process.env.NC_REQUEST_BODY_SIZE || '50mb' }),
    );

    await nestApp.init();

    const dashboardPath = process.env.NC_DASHBOARD_URL || '/dashboard';
    server.use(NcToolGui.expressMiddleware(dashboardPath));
    server.get('/', (_req, res) => res.redirect(dashboardPath));
    return nestApp.getHttpAdapter().getInstance();
  }

  public static get httpServer(): http.Server {
    return Noco._httpServer;
  }

  public static get server(): Express {
    return Noco._server;
  }
}
