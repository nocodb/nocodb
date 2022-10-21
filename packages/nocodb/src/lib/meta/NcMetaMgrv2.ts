import bodyParser from 'body-parser';
import { Handler, Router } from 'express';
import multer from 'multer';

import { NcConfig } from '../../interface/config';
import ProjectMgr from '../db/sql-mgr/ProjectMgr';
import { packageVersion } from '../utils/packageVersion';
import projectAcl from '../utils/projectAcl';
import Noco from '../Noco';
import NcPluginMgr from '../v1-legacy/plugins/NcPluginMgr';
import NcMetaIO from './NcMetaIO';
import { defaultConnectionConfig } from '../utils/NcConfigFactory';
import ncCreateLookup from './handlersv2/ncCreateLookup';
// import ncGetMeta from './handlersv2/ncGetMeta';

export default class NcMetaMgrv2 {
  public projectConfigs = {};
  public readonly pluginMgr: NcPluginMgr;

  // public twilioInstance: Twilio;

  protected app: Noco;

  protected config: NcConfig;
  protected listener: (data) => Promise<any>;
  protected xcMeta: NcMetaIO;
  protected projectMgr: any;
  // @ts-ignore
  protected isEe = false;
  protected readonly INVALID_PASSWORD_ERROR = 'Invalid password';

  constructor(app: Noco, config: NcConfig, xcMeta: NcMetaIO) {
    this.app = app;
    this.config = config;
    this.xcMeta = xcMeta;
    this.projectMgr = ProjectMgr.make();
    this.pluginMgr = new NcPluginMgr(app, xcMeta);
  }

  public setConfig(config: NcConfig) {
    this.config = config;
  }

  public async initHandler(rootRouter: Router) {
    await this.pluginMgr?.init();

    // await this.initTwilio();

    const router = Router();
    for (const project of await this.xcMeta.projectList()) {
      const config = JSON.parse(project.config);
      this.projectConfigs[project.id] = config;
      // const knexRefs = (this.app?.projectBuilders?.find(p => p.id === project.id)?.apiBuilders || []).reduce((ref, ab) => ({
      //   ...ref,
      //   [ab.dbAlias]: ab.getDbDriver()
      // }), {})
      this.projectMgr
        .getSqlMgr({ ...project, config, metaDb: this.xcMeta?.knex })
        .projectOpenByWeb(config);
    }

    router.use(
      bodyParser.json({
        limit: process.env.NC_REQUEST_BODY_SIZE || 1024 * 1024,
      })
    );

    // todo: add multer middleware only for certain api calls
    if (!process.env.NC_SERVERLESS_TYPE && !this.config.try) {
      const upload = multer({
        storage: multer.diskStorage({
          // dest: path.join(this.config.toolDir, 'uploads')
        }),
      });
      // router.post(this.config.dashboardPath, upload.single('file'));
      router.post(this.config.dashboardPath, upload.any());
    }

    /*
    router.post(this.config.dashboardPath, (req, res, next) =>
      // this.handlePublicRequest(req, res, next)
    );
    */

    // @ts-ignore
    router.post(
      this.config.dashboardPath + '/v2',
      async (req: any, res, next) => {
        if (req.files && req.body.json) {
          req.body = JSON.parse(req.body.json);
        }
        if (req?.session?.passport?.user?.isAuthorized) {
          if (
            req?.body?.project_id &&
            !req.session?.passport?.user?.isPublicBase &&
            !(await this.xcMeta.isUserHaveAccessToProject(
              req?.body?.project_id,
              req?.session?.passport?.user?.id
            ))
          ) {
            return res
              .status(403)
              .json({ msg: "User doesn't have project access" });
          }

          if (req?.body?.api) {
            const roles = req?.session?.passport?.user?.roles;
            const isAllowed =
              roles &&
              Object.entries(roles).some(([name, hasRole]) => {
                return (
                  hasRole &&
                  projectAcl[name] &&
                  (projectAcl[name] === '*' || projectAcl[name][req.body.api])
                );
              });
            if (!isAllowed) {
              return res.status(403).json({ msg: 'Not allowed' });
            }
          }
        }
        return next();
      }
    );
    router.post(
      this.config.dashboardPath + '/v2',
      // handle request if it;s related to meta db
      (async (req: any, res, next): Promise<any> => {
        // auth to admin
        if (this.config.auth) {
          if (this.config.auth.jwt) {
            const roles = req?.session?.passport?.user?.roles;
            if (
              !(
                roles?.creator ||
                roles?.owner ||
                roles?.editor ||
                roles?.viewer ||
                roles?.commenter ||
                roles?.user ||
                roles?.user_new
              )
            ) {
              return res.status(401).json({
                msg: 'Unauthorized access : xc-auth does not have admin permission',
              });
            }
          } else if (this.config?.auth?.masterKey) {
            if (
              req.headers['xc-master-key'] !== this.config.auth.masterKey.secret
            ) {
              return res.status(401).json({
                msg: 'Unauthorized access : xc-admin header missing or not matching',
              });
            }
          }
        }

        if (req.files) {
          // await this.handleRequestWithFile(req, res, next);
        } else {
          await this.handleRequest(req, res, next);
        }
      }) as Handler,
      // pass request to SqlMgr
      async (req: any, res) => {
        try {
          let output;
          if (req.files && req.body.json) {
            req.body = JSON.parse(req.body.json);
            output = await this.projectMgr
              .getSqlMgr({ id: req.body.project_id })
              .handleRequestWithFile(req.body.api, req.body, req.files);
          } else {
            output = await this.projectMgr
              .getSqlMgr({ id: req.body.project_id })
              .handleRequest(req.body.api, req.body);
          }

          if (this.listener) {
            await this.listener({
              req: req.body,
              res: output,
              user: req.user,
              ctx: {
                req,
                res,
              },
            });
          }

          if (
            typeof output === 'object' &&
            'download' in output &&
            'filePath' in output &&
            output.download === true
          ) {
            return res.download(output.filePath);
          }
          res.json(output);
        } catch (e) {
          console.log(e);
          res.status(500).json({ msg: e.message });
        }
      }
    );

    router.get(
      `${this.config.dashboardPath + '/v2'}/auth/type`,
      async (_req, res): Promise<any> => {
        try {
          const projectHasDb = true; // this.toolMgr.projectHasDb();
          if (this.config.auth) {
            if (this.config.auth.jwt) {
              const knex = this.xcMeta.knex;

              let projectHasAdmin = false;
              projectHasAdmin = !!(await knex('xc_users').first());
              const result = {
                authType: 'jwt',
                projectHasAdmin,
                firstUser: !projectHasAdmin,
                projectHasDb,
                type: this.config.type,
                env: this.config.workingEnv,
                googleAuthEnabled: !!(
                  process.env.NC_GOOGLE_CLIENT_ID &&
                  process.env.NC_GOOGLE_CLIENT_SECRET
                ),
                githubAuthEnabled: !!(
                  process.env.NC_GITHUB_CLIENT_ID &&
                  process.env.NC_GITHUB_CLIENT_SECRET
                ),
                oneClick: !!process.env.NC_ONE_CLICK,
                connectToExternalDB:
                  !process.env.NC_CONNECT_TO_EXTERNAL_DB_DISABLED,
                version: packageVersion,
                defaultLimit: Math.max(
                  Math.min(
                    +process.env.DB_QUERY_LIMIT_DEFAULT || 25,
                    +process.env.DB_QUERY_LIMIT_MAX || 100
                  ),
                  +process.env.DB_QUERY_LIMIT_MIN || 1
                ),
                timezone: defaultConnectionConfig.timezone,
              };
              return res.json(result);
            }
            if (this.config.auth.masterKey) {
              return res.json({
                authType: 'masterKey',
                // projectHasDb: this.toolMgr.projectHasDb(),
                type: this.config.type,
                env: this.config.workingEnv,
                oneClick: !!process.env.NC_ONE_CLICK,
              });
            }
          }
          res.json({
            authType: 'none',
            projectHasDb,
            type: this.config.type,
            env: this.config.workingEnv,
            oneClick: !!process.env.NC_ONE_CLICK,
          });
        } catch (e) {
          console.log(e);
          throw e;
        }
      }
    );

    router.post('/auth/admin/verify', (req, res): any => {
      if (this.config.auth) {
        if (
          this.config.auth.masterKey &&
          this.config.auth.masterKey.secret === req.body.secret
        ) {
          return res.json(true);
        }
      }
      res.json(false);
    });

    router.post('/auth/xc-verify', (_req, res) => {
      this.isEe = true;
      res.json({ msg: 'success' });
    });

    rootRouter.use(router);
  }

  public setListener(listener: (data) => Promise<any>) {
    this.listener = listener;
  }
  /*
  protected async handlePublicRequest(req, res, next) {
   /!* let args = req.body;

    try {
      if (req.body.json) args = JSON.parse(req.body.json);
    } catch {}
    let result;
    try {
      switch (args.api) {
        case 'displaySharedViewLink':
          result = await this.displaySharedViewLink(args);
          break;
        case 'getSharedViewData':
          result = await this.getSharedViewData(req, args);
          break;
        case 'sharedViewGet':
          result = await this.sharedViewGet(req, args);
          break;
        case 'sharedBaseGet':
          result = await this.sharedBaseGet(req, args);
          break;
        case 'sharedViewExportAsCsv':
          result = await this.sharedViewExportAsCsv(req, args, res);
          break;

        case 'sharedViewInsert':
          result = await this.sharedViewInsert(req, args);
          break;
        case 'sharedViewNestedDataGet':
          result = await this.sharedViewNestedDataGet(req, args);
          break;
        case 'sharedViewNestedChildDataGet':
          result = await this.sharedViewNestedChildDataGet(req, args);
          break;

        // case 'submitSharedViewFormData':
        //   result = await this.submitSharedViewFormData(req, args);
        //   break;

        case 'xcRelease':
          result = await this.xcRelease();
          break;

        default:
          return next();
      }
    } catch (e) {
      return next(e);
    }

    if (typeof result?.cb === 'function') {
      return await result.cb();
    }

    res.json(result);*!/
  }*/

  protected async handleRequest(req, res, next) {
    try {
      const args = req.body;
      let result, postListenerCb;

      switch (args.api) {
        case 'ncCreateLookup':
          result = await ncCreateLookup.call(this.getContext(args), args);
          break;
        case 'ncGetMeta':
          // result = await ncGetMeta.call(this.getContext(args), args);
          break;

        default:
          return next();
      }
      if (this.listener) {
        await this.listener({
          user: req.user,
          req: req.body,
          res: result,
          ctx: {
            req,
            res,
          },
        });
      }

      if (postListenerCb) {
        await postListenerCb();
      }

      if (
        result &&
        typeof result === 'object' &&
        'download' in result &&
        'filePath' in result &&
        result.download === true
      ) {
        return res.download(result.filePath);
      }

      if (typeof result?.cb === 'function') {
        return await result.cb();
      }

      res.json(result);
    } catch (e) {
      console.log(e);
      if (e instanceof XCEeError) {
        res.status(402).json({
          msg: e.message,
        });
      } else {
        res.status(400).json({
          msg: e.message,
        });
      }
    }
  }
  protected getDbAlias(args): string {
    return (
      args?.dbAlias ||
      args?.args?.dbAlias ||
      args?.base_id ||
      args?.args?.base_id
    );
  }
  protected getProjectId(args): string {
    return args.project_id;
  }

  private getContext(args): NcContextV2 {
    return {
      projectId: this.getProjectId(args),
      dbAlias: this.getDbAlias(args),
      xcMeta: this.xcMeta,
    };
  }
}

export interface NcContextV2 {
  projectId: string;
  dbAlias: string;
  xcMeta: NcMetaIO;
}

export class XCEeError extends Error {
  public static throw() {
    throw new XCEeError('Upgrade to Enterprise Edition');
  }
}
