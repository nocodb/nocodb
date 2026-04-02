import '~/instrument';
import path from 'path';
import { NestFactory } from '@nestjs/core';
import clear from 'clear';
import * as express from 'express';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import requestIp from 'request-ip';
import cookieParser from 'cookie-parser';
import { NcDebug } from 'nc-gui/utils/debug';
import type { INestApplication } from '@nestjs/common';
import type { MetaService } from '~/meta/meta.service';
import type { IEventEmitter } from '~/modules/event-emitter/event-emitter.interface';
import type { Express } from 'express';
import type http from 'http';
import type Sharp from 'sharp';
import type { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import type { AuditService } from '~/meta/audit.service';
import type { ChatMessagesService } from '~/meta/chat-messages.service';
import type { DocsContentService } from '~/meta/docs-content.service';
import type { AppSettings } from '~/interface/AppSettings';
import { MetaTable, RootScopes } from '~/utils/globals';
import { AppModule } from '~/app.module';
import { isEE, T } from '~/utils';
import { getAppUrl } from '~/utils/appUrl';
import { DataReflection, Integration, Store } from '~/models';
import { getRedisURL } from '~/helpers/redisHelpers';
import { RedisIoAdapter } from '~/gateways/RedisIoAdapter';
import { DEFAULT_APP_SETTINGS } from '~/interface/AppSettings';
import { NC_APP_SETTINGS } from '~/constants';

dotenv.config();
declare const module: any;

// Only install in development — in test/CI the rspack bundle has no source
// maps and source-map-support crashes reading the 60 MB+ bundle file.
if (process.env.NODE_ENV === 'development') {
  require('source-map-support').install();
}

export default class Noco {
  protected static _this: Noco;
  protected static ee: boolean;
  public static readonly env: string = '_noco';
  protected static _httpServer: http.Server;
  protected static _server: Express;

  public static get dashboardUrl(): string {
    return getAppUrl();
  }

  public static config: any;
  public static eventEmitter: IEventEmitter;
  public readonly router: express.Router;
  public readonly baseRouter: express.Router;
  public static _ncMeta: any;
  public static _ncAudit: any;
  public static _ncChatMessages: any;
  public static _ncDocsContent: any;
  public static appHooksService: AppHooksService;
  public readonly metaMgr: any;
  public readonly metaMgrv2: any;
  public env: string;
  protected static _nestApp: INestApplication;

  protected config: any;
  protected requestContext: any;

  public static ncDefaultWorkspaceId: string;
  public static ncDefaultOrgId: string;

  public static sharp: typeof Sharp;

  public static firstEeLoad: boolean;

  private static _appSettings: AppSettings | null = null;

  constructor() {
    process.env.PORT = process.env.PORT || '8080';
    // todo: move
    // if env variable NC_MINIMAL_DBS is set, then disable base creation with external sources
    if (process.env.NC_MINIMAL_DBS === 'true') {
      process.env.NC_CONNECT_TO_EXTERNAL_DB_DISABLED = 'true';
    }

    this.router = express.Router();
    this.baseRouter = express.Router();

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

  public static get nestApp() {
    return this._nestApp;
  }

  public static get ncAudit(): AuditService {
    return this._ncAudit ?? this._ncMeta;
  }

  public static get ncChatMessages(): ChatMessagesService {
    return this._ncChatMessages ?? this._ncMeta;
  }

  public static get ncDocsContent(): DocsContentService {
    return this._ncDocsContent ?? this._ncMeta;
  }

  public get ncMeta(): any {
    return Noco._ncMeta;
  }

  public get ncAudit(): AuditService {
    return Noco._ncAudit;
  }

  public get ncChatMessages(): ChatMessagesService {
    return Noco._ncChatMessages;
  }

  public static getConfig(): any {
    return this.config;
  }

  public static isEE(): boolean {
    return this.ee || process.env.NC_CLOUD === 'true';
  }

  public static async loadEEState(): Promise<boolean> {
    try {
      return (this.ee = isEE);
    } catch {}
    return (this.ee = false);
  }

  static async init(param: any, httpServer: http.Server, server: Express) {
    const nestApp = await NestFactory.create(AppModule, {
      bufferLogs: true,
      bodyParser: false,
    });

    Noco._nestApp = nestApp;

    this.initCustomLogger(nestApp);
    NcDebug.log('Custom logger initialized');
    nestApp.flushLogs();

    if ((module as any)?.hot) {
      (module as any).hot?.accept?.();
      (module as any).hot?.dispose?.(() => nestApp.close());
    }

    try {
      this.sharp = (await import('sharp')).default;

      this.sharp.concurrency(1);
      this.sharp.cache(false);
    } catch {
      console.error(
        'Sharp is not available for your platform, thumbnail generation will be skipped',
      );
    }

    if (process.env.NC_WORKER_CONTAINER === 'true') {
      if (!getRedisURL()) {
        throw new Error('NC_REDIS_URL is required');
      }
      process.env.NC_DISABLE_TELE = 'true';
    }

    this._httpServer = nestApp.getHttpAdapter().getInstance();
    this._server = server;

    nestApp.use(requestIp.mw());
    nestApp.use(cookieParser());

    const redisIoAdapter = new RedisIoAdapter(httpServer);
    await redisIoAdapter.connectToRedis();
    nestApp.useWebSocketAdapter(redisIoAdapter);
    NcDebug.log('Websocket adapter initialized');

    await nestApp.init();
    NcDebug.log('Nest app initialized');

    await nestApp.enableShutdownHooks();
    NcDebug.log('Shutdown hooks enabled');

    const dashboardPath = process.env.NC_DASHBOARD_URL ?? '/';
    server.use(express.static(path.join(__dirname, 'public')));

    if (dashboardPath.startsWith('http')) {
      // Test/split mode: frontend runs separately, redirect browser to it.
      // Non-browser requests (health checks, curl) get 200 instead of redirect.
      server.get('/', (req, res) => {
        if (req.headers.accept?.includes('text/html')) {
          return res.redirect(dashboardPath);
        }
        res.sendStatus(200);
      });
    } else if (dashboardPath !== '/' && dashboardPath !== '') {
      // Non-root dashboard path: redirect old path to root
      const normalizedPath = dashboardPath.replace(/\/+$/, '');
      server.get(`${normalizedPath}*`, (req, res) => {
        const remaining = req.path.slice(normalizedPath.length) || '/';
        res.redirect(remaining);
      });
    } else {
      // Default root deployment: respond 200 for health checks (HEAD/non-browser GET).
      // Browser requests pass through to GuiMiddleware for SPA fallback.
      server.get('/', (req, res, next) => {
        if (req.headers.accept?.includes('text/html')) {
          return next();
        }
        res.sendStatus(200);
      });
    }

    await Integration.init();
    NcDebug.log('Integration initialized');

    if (process.env.NC_WORKER_CONTAINER !== 'true') {
      await DataReflection.init();
    }

    return nestApp.getHttpAdapter().getInstance();
  }

  public static get httpServer(): http.Server {
    return this._httpServer;
  }

  public static get server(): Express {
    return this._server;
  }

  public static async initJwt(): Promise<any> {
    if (this.config?.auth?.jwt) {
      if (!this.config.auth.jwt.secret) {
        let secret = (
          await this._ncMeta.metaGet(
            RootScopes.ROOT,
            RootScopes.ROOT,
            MetaTable.STORE,
            {
              key: 'nc_auth_jwt_secret',
            },
          )
        )?.value;
        if (!secret) {
          await this._ncMeta.metaInsert2(
            RootScopes.ROOT,
            RootScopes.ROOT,
            MetaTable.STORE,
            {
              key: 'nc_auth_jwt_secret',
              value: (secret = uuidv4()),
            },
            true,
          );
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
      await this._ncMeta.metaGet(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.STORE,
        {
          key: 'nc_server_id',
        },
      )
    )?.value;
    if (!serverId) {
      await this._ncMeta.metaInsert2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.STORE,
        {
          key: 'nc_server_id',
          value: (serverId = T.id),
        },
        true,
      );
    }
    process.env.NC_SERVER_UUID = serverId;
  }

  protected static initCustomLogger(_nestApp: INestApplication<any>) {
    // setup custom logger for nestjs if needed
  }

  public static async prepareAuditService() {}

  public static async prepareChatMessagesService() {}

  public static async prepareDocsContentService() {}

  public static async getAppSettings(refresh = false): Promise<AppSettings> {
    // Force refresh or first load
    if (refresh || !this._appSettings) {
      await this.loadAppSettings();
    }

    return { ...this._appSettings };
  }

  private static async loadAppSettings(): Promise<void> {
    try {
      const storeData = await Store.get(NC_APP_SETTINGS, false, this._ncMeta);

      if (storeData?.value) {
        this._appSettings = {
          ...DEFAULT_APP_SETTINGS,
          ...JSON.parse(storeData.value),
        };
      } else {
        this._appSettings = { ...DEFAULT_APP_SETTINGS };
      }
    } catch (error) {
      // Log error but don't fail - use defaults
      console.error('Failed to load app settings, using defaults:', error);
      this._appSettings = { ...DEFAULT_APP_SETTINGS };
    }
  }

  public static async updateAppSettings(
    settings: Partial<AppSettings>,
  ): Promise<AppSettings> {
    const currentSettings = await this.getAppSettings();
    const newSettings = {
      ...currentSettings,
      ...settings,
    };

    await Store.saveOrUpdate(
      {
        key: NC_APP_SETTINGS,
        value: JSON.stringify(newSettings),
      },
      this._ncMeta,
    );

    // Update cache
    this._appSettings = newSettings;

    return { ...newSettings };
  }

  public static resetAppSettingsCache(): void {
    this._appSettings = null;
  }
}
