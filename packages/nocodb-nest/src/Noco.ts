// import * as Sentry from '@sentry/node';
import clear from 'clear';
import * as express from 'express';

import { NC_LICENSE_KEY } from './constants';
import Store from './models/Store';

export default class Noco {
  private static _this: Noco;
  private static ee: boolean;

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
  /*
  public static async init(
    args?: {
      progressCallback?: Function;
      registerRoutes?: Function;
      registerGql?: Function;
      registerContext?: Function;
      afterMetaMigrationInit?: Function;
    },
    server?: http.Server,
    app?: express.Express
  ): Promise<Router> {
    if (Noco._this) {
      return Noco._this.router;
    }
    Noco._this = new Noco();
    return Noco._this.init(args, server, app);
  }*/

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
    process.env.NC_VERSION = '0105004';

    // if env variable NC_MINIMAL_DBS is set, then disable project creation with external sources
    if (process.env.NC_MINIMAL_DBS) {
      process.env.NC_CONNECT_TO_EXTERNAL_DB_DISABLED = 'true';
    }

    this.router = express.Router();
    this.projectRouter = express.Router();

    /******************* prints : start *******************/
    // this.sumTable = new Table({
    //   head: ['#DBs', '#Tables',
    //     '#GQL\nServers', '#REST\nServers',
    //     '#APIs',
    //     'Time\ntaken',
    //     // 'If avg manual effort\nper api = 15 minutes\nand\nAPI developer salary = $76k'
    //   ].map(v => colors.green(v))
    //   , colWidths: [10, 12, 9, 9, 12, 12]
    // });
    // this.table = new Table({
    //   colWidths: [4, 8, 8, 20, 9, 7, 35, 9],
    //   head: ['#', 'DB\nType', 'API\nType', 'Database', '#Tables', '#APIs', 'APIs URL', 'Time\ntaken'].map(v => colors.green(v))
    // });
    clear();
    /******************* prints : end *******************/
  }

  /*  public async init(
    args?: {
      progressCallback?: Function;
      registerRoutes?: Function;
      registerGql?: Function;
      registerContext?: Function;
      afterMetaMigrationInit?: Function;
    },
    server?: http.Server,
    _app?: express.Express,
  ) {
    /!* prepare config *!/
    Noco.config = this.config = await NcConfigFactory.make();

    /!******************* setup : start *******************!/
    this.env = '_noco'; //process.env['NODE_ENV'] || this.config.workingEnv || 'dev';
    this.config.workingEnv = this.env;

    this.config.type = 'docker';
    if (!this.config.toolDir) {
      this.config.toolDir = process.cwd();
    }

    // this.ncToolApi = new NcToolGui(this.config);
    // if (server) {
    //   server.set('view engine', 'ejs');
    // }

    const NcMetaImpl = process.env.EE ? NcMetaImplEE : NcMetaImplCE;
    // const NcMetaMgr = process.env.EE ? NcMetaMgrEE : NcMetaMgrCE;

    Noco._ncMeta = new NcMetaImpl(this, this.config);
    // this.metaMgr = new NcMetaMgr(this, this.config, Noco._ncMeta);
    // this.metaMgrv2 = new NcMetaMgrv2(this, this.config, Noco._ncMeta);

    /!******************* setup : end *******************!/

    // @ts-ignore
    const {
      progressCallback,
      // registerRoutes,
      // registerContext,
      // registerGql
    } = args || {};

    log('Initializing app');

    // create tool directory if missing
    await mkdirp(this.config.toolDir);

    this.initSentry();
    NocoCache.init();

    // this.apiInfInfoList = [];
    //
    // this.startTime = Date.now();

    if (!this.config.try) {
      await NcConfigFactory.metaDbCreateIfNotExist(this.config);
      await this.syncMigration();
    }

    await Noco._ncMeta.metaInit();
    await Noco.loadEEState();
    await this.initJwt();

    if (args?.afterMetaMigrationInit) {
      await args.afterMetaMigrationInit();
    }

    /!******************* Middlewares : start *******************!/
    this.router.use((req: any, _res, next) => {
      req.nc = this.requestContext;
      req.ncSiteUrl =
        this.config?.envs?.[this.env]?.publicUrl ||
        this.config?.publicUrl ||
        req.protocol + '://' + req.get('host');
      req.ncFullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
      next();
    });

    // to get ip addresses
    this.router.use(requestIp.mw());
    this.router.use(cookieParser());
    this.router.use(
      bodyParser.json({
        limit: process.env.NC_REQUEST_BODY_SIZE || '50mb',
      }),
    );
    this.router.use(morgan('tiny'));
    this.router.use(express.static(path.join(__dirname, './public')));

    this.router.use((req: any, _res, next) => {
      req.ncProjectId = req?.query?.project_id || req?.body?.project_id;
      next();
    });
    /!*    this.router.use(this.config.dashboardPath, (req: any, _res, next) => {
          req.ncProjectId = req?.body?.project_id;
          next();
        })*!/
    this.router.use(`/nc/:project_id/!*`, (req: any, _res, next) => {
      req.ncProjectId = req.ncProjectId || req.params.project_id;
      next();
    });
    this.router.use(MetaAPILogger.mw);

    /!******************* Middlewares : end *******************!/

    // await this.initProjectBuilders();

    // const runTimeHandler = this.handleRuntimeChanges(progressCallback);

    // this.ncToolApi.addListener(runTimeHandler);
    // this.metaMgr.setListener(runTimeHandler);
    // this.metaMgrv2.setListener(runTimeHandler);
    // await this.metaMgr.initHandler(this.router);
    // await this.metaMgrv2.initHandler(this.router);

    await NcPluginMgrv2.init(Noco.ncMeta);
    registerMetaApis(this.router, server);

    // this.router.use(
    //   this.config.dashboardPath,
    //   await this.ncToolApi.expressMiddleware()
    // );
    this.router.use(NcToolGui.expressMiddleware(this.config.dashboardPath));
    this.router.get('/', (_req, res) =>
      res.redirect(this.config.dashboardPath),
    );

    this.initSentryErrorHandler();

    /!* catch error *!/
    this.router.use((err, _req, res, next) => {
      if (err) {
        return res.status(400).json({ msg: err.message });
      }
      next();
    });
    T.init({
      instance: getInstance,
    });
    T.emit('evt_app_started', await User.count());
    console.log(`App started successfully.\nVisit -> ${Noco.dashboardUrl}`);
    weAreHiring();
    return this.router;
  }*/

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
}
