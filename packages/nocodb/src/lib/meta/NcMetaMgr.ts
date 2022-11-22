import CryptoJS from 'crypto-js';
import fs from 'fs';
import mkdirp from 'mkdirp';
import path from 'path';

import archiver from 'archiver';
import axios from 'axios';
import bodyParser from 'body-parser';
import express, { Handler, Router } from 'express';
import extract from 'extract-zip';
import isDocker from 'is-docker';
import multer from 'multer';
import { customAlphabet, nanoid } from 'nanoid';
import slash from 'slash';
import { v4 as uuidv4 } from 'uuid';
import { ncp } from 'ncp';

import IEmailAdapter from '../../interface/IEmailAdapter';
import IStorageAdapter from '../../interface/IStorageAdapter';
import { NcConfig, Result } from '../../interface/config';
import SqlClientFactory from '../db/sql-client/lib/SqlClientFactory';
import { NcConfigFactory } from '../index';
import ProjectMgr from '../db/sql-mgr/ProjectMgr';
import ExpressXcTsRoutes from '../db/sql-mgr/code/routes/xc-ts/ExpressXcTsRoutes';
import ExpressXcTsRoutesBt from '../db/sql-mgr/code/routes/xc-ts/ExpressXcTsRoutesBt';
import ExpressXcTsRoutesHm from '../db/sql-mgr/code/routes/xc-ts/ExpressXcTsRoutesHm';
import NcHelp from '../utils/NcHelp';
import mimetypes, { mimeIcons } from '../utils/mimeTypes';
import { packageVersion } from '../utils/packageVersion';
import projectAcl from '../utils/projectAcl';
import Noco from '../Noco';
import { GqlApiBuilder } from '../v1-legacy/gql/GqlApiBuilder';
import NcPluginMgr from '../v1-legacy/plugins/NcPluginMgr';
import XcCache from '../v1-legacy/plugins/adapters/cache/XcCache';
import { RestApiBuilder } from '../v1-legacy/rest/RestApiBuilder';
import RestAuthCtrl from '../v1-legacy/rest/RestAuthCtrlEE';
import NcMetaIO, { META_TABLES } from './NcMetaIO';
import { promisify } from 'util';
import NcTemplateParser from '../v1-legacy/templates/NcTemplateParser';
import { defaultConnectionConfig } from '../utils/NcConfigFactory';
import xcMetaDiff from './handlers/xcMetaDiff';
import { UITypes } from 'nocodb-sdk';
import { Tele } from 'nc-help';
const randomID = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz_', 10);
const XC_PLUGIN_DET = 'XC_PLUGIN_DET';

const NOCO_RELEASE = 'NOCO_RELEASE';

export default class NcMetaMgr {
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
    await this.initCache();
    this.eeVerify();

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

    // todo: acl
    router.get(/^\/dl\/([^/]+)\/([^/]+)\/(.+)$/, async (req, res) => {
      try {
        // const type = mimetypes[path.extname(req.params.fileName).slice(1)] || 'text/plain';
        const type =
          mimetypes[path.extname(req.params[2]).split('/').pop().slice(1)] ||
          'text/plain';
        // const img = await this.storageAdapter.fileRead(slash(path.join('nc', req.params.projectId, req.params.dbAlias, 'uploads', req.params.fileName)));
        const img = await this.storageAdapter.fileRead(
          slash(
            path.join(
              'nc',
              req.params[0],
              req.params[1],
              'uploads',
              ...req.params[2].split('/')
            )
          )
        );
        res.writeHead(200, { 'Content-Type': type });
        res.end(img, 'binary');
      } catch (e) {
        res.status(404).send('Not found');
      }
    });

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

    router.post(this.config.dashboardPath, (req, res, next) =>
      this.handlePublicRequest(req, res, next)
    );

    // @ts-ignore
    router.post(this.config.dashboardPath, async (req: any, res, next) => {
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
      next();
    });
    router.post(
      this.config.dashboardPath,
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
          await this.handleRequestWithFile(req, res, next);
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
      `${this.config.dashboardPath}/auth/type`,
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
                ncMin: !!process.env.NC_MIN,
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

  public async handleRequestWithFile(req, res, next) {
    const [operation, args, file] = [req.body.api, req.body, req.files?.[0]];
    let result;
    try {
      switch (operation) {
        case 'xcMetaTablesImportZipToLocalFsAndDb':
          result = await this.xcMetaTablesImportZipToLocalFsAndDb(
            args,
            file,
            req
          );
          break;

        case 'xcAttachmentUpload':
          result = await this.xcAttachmentUpload(req, args, file);
          break;

        default:
          return next();
          break;
      }
    } catch (e) {
      return res.status(400).json({ msg: e.message });
    }

    if (this.listener) {
      await this.listener({
        req: req.body,
        res: result,
        user: req.user,
        ctx: {
          req,
          res,
        },
      });
    }

    return res.json(result);
  }

  // NOTE: updated
  public async xcMetaTablesReset(args) {
    if (!('dbAlias' in args)) {
      if (this.projectConfigs?.[args?.project_id]?.envs?.[args?.env]?.db) {
        for (const {
          meta: { dbAlias },
        } of this.projectConfigs[args.project_id].envs[args.env].db) {
          await this.xcMetaTablesReset({ ...args, dbAlias });
        }
      }
      return;
    }

    const dbAlias = this.getDbAlias(args);
    for (const tn of META_TABLES[this.config.projectType.toLowerCase()]) {
      // await knexRef(tn).truncate();
      await this.xcMeta.metaDelete(args.project_id, dbAlias, tn, {});
    }
  }

  // NOTE: updated
  public async xcMetaTablesImportLocalFsToDb(args, req) {
    if (!('dbAlias' in args)) {
      for (const {
        meta: { dbAlias },
      } of this.projectConfigs[args.project_id].envs[args.env].db) {
        await this.xcMetaTablesImportLocalFsToDb({ ...args, dbAlias }, req);
      }
      return;
    }

    try {
      const metaFolder = path.join(
        this.config.toolDir,
        'nc',
        args.project_id,
        args.dbAlias,
        'meta'
      );
      const dbAlias = this.getDbAlias(args);
      const projectId = this.getProjectId(args);
      await this.xcMeta.startTransaction();

      await this.xcMetaTablesReset(args);

      for (const tn of META_TABLES[this.config.projectType.toLowerCase()]) {
        if (fs.existsSync(path.join(metaFolder, `${tn}.json`))) {
          const data = JSON.parse(
            fs.readFileSync(path.join(metaFolder, `${tn}.json`), 'utf8')
          );
          for (const row of data) {
            delete row.id;

            row.created_at = row.created_at ? new Date(row.created_at) : null;
            row.updated_at = row.updated_at ? new Date(row.updated_at) : null;

            await this.xcMeta.metaInsert(projectId, dbAlias, tn, {
              ...row,
              db_alias: dbAlias,
              project_id: projectId,
            });
          }
        }
      }
      await this.xcMeta.commit();

      this.xcMeta.audit(projectId, dbAlias, 'nc_audit', {
        // created_at: (Knex as any).fn.now(),
        op_type: 'META',
        op_sub_type: 'IMPORT_FROM_FS',
        user: req.user.email,
        description: `imported ${projectId}(${dbAlias}) from local filesystem`,
        ip: req.clientIp,
      });
    } catch (e) {
      console.log(e);
      await this.xcMeta.rollback(e);
    }
  }

  // NOTE: xc-meta
  // Extract and import metadata and config from zip file
  public async xcMetaTablesImportZipToLocalFsAndDb(args, file, req) {
    try {
      await this.xcMetaTablesReset(args);
      let projectConfigPath;
      // let storeFilePath;
      await extract(file.path, {
        dir: path.join(this.config.toolDir, 'uploads'),
        onEntry(entry, _zipfile) {
          // extract xc_project.json file path
          if (entry.fileName?.endsWith('nc_project.json')) {
            projectConfigPath = entry.fileName;
          }
        },
      });
      // delete temporary upload file
      fs.unlinkSync(file.path);

      let projectId = this.getProjectId(args);
      if (!projectConfigPath) {
        throw new Error('Missing project config file');
      }

      const projectDetailsJSON: any = fs.readFileSync(
        path.join(this.config.toolDir, 'uploads', projectConfigPath),
        'utf8'
      );
      const projectDetails =
        projectDetailsJSON && JSON.parse(projectDetailsJSON);

      if (args.args.importsToCurrentProject) {
        await promisify(ncp)(
          path.join(this.config.toolDir, 'uploads', 'nc', projectDetails.id),
          path.join(this.config.toolDir, 'nc', projectId),
          { clobber: true }
        );
      } else {
        // decrypt with old key and encrypt again with latest key
        const projectConfig = JSON.parse(
          CryptoJS.AES.decrypt(
            projectDetails.config,
            projectDetails.key
          ).toString(CryptoJS.enc.Utf8)
        );

        if (projectConfig?.prefix) {
          const metaProjConfig =
            NcConfigFactory.makeProjectConfigFromConnection(
              this.config?.meta?.db,
              args.args.projectType
            );
          projectConfig.envs._noco = metaProjConfig.envs._noco;
        }

        // delete projectDetails.key;
        projectDetails.config = projectConfig;

        // create new project and import
        const project = await this.xcMeta.projectCreate(
          projectDetails.title,
          projectConfig,
          projectDetails.description
        );
        projectId = project.id;

        // move files to newly created project meta folder
        await promisify(ncp)(
          path.join(this.config.toolDir, 'uploads', 'nc', projectDetails.id),
          path.join(this.config.toolDir, 'nc', projectId)
        );

        await this.xcMeta.projectAddUser(
          projectId,
          req?.session?.passport?.user?.id,
          'owner'
        );
        await this.projectMgr
          .getSqlMgr({
            ...projectConfig,
            metaDb: this.xcMeta?.knex,
          })
          .projectOpenByWeb(projectConfig);
        this.projectConfigs[projectId] = projectConfig;
        args.freshImport = true;
      }

      //   const importProjectId = projectConfig?.id;
      //
      //   // check project already exist
      //   if (await this.xcMeta.projectGetById(importProjectId)) {
      //     // todo:
      //     throw new Error(`Project with id '${importProjectId}' already exist, it's not allowed at the moment`)
      //   } else {
      //     // create the project if not found
      //     await this.xcMeta.knex('nc_projects').insert(projectConfig);
      //     projectConfig = JSON.parse((await this.xcMeta.projectGetById(importProjectId))?.config);
      //
      //     // duplicated code from project create - see projectCreateByWeb
      //     await this.xcMeta.projectAddUser(importProjectId, req?.session?.passport?.user?.id, 'owner,creator');
      //     await this.projectMgr.getSqlMgr({
      //       ...projectConfig,
      //       metaDb: this.xcMeta?.knex
      //     }).projectOpenByWeb(projectConfig);
      //     this.projectConfigs[importProjectId] = projectConfig;
      //
      //     args.freshImport = true;
      //   }
      //   args.project_id = importProjectId;
      // }

      args.project_id = projectId;

      await this.xcMetaTablesImportLocalFsToDb(args, req);
      this.xcMeta.audit(projectId, null, 'nc_audit', {
        op_type: 'META',
        op_sub_type: 'IMPORT_FROM_ZIP',
        user: req.user.email,
        description: `imported ${projectId} from zip file uploaded `,
        ip: req.clientIp,
      });
    } catch (e) {
      throw e;
    }
  }

  // NOTE: xc-meta
  // Extract and import metadata and config from zip file
  public async xcMetaTablesImportZipToLocalFsAndDbV1(args, file, req) {
    try {
      await this.xcMetaTablesReset(args);
      let projectConfigPath;
      // let storeFilePath;
      await extract(file.path, {
        dir: this.config.toolDir,
        onEntry(entry, _zipfile) {
          // extract xc_project.json file path
          if (entry.fileName?.endsWith('nc_project.json')) {
            projectConfigPath = entry.fileName;
          }
        },
      });
      // delete temporary upload file
      fs.unlinkSync(file.path);

      if (projectConfigPath) {
        // read project config and extract project id
        let projectConfig: any = fs.readFileSync(
          path.join(this.config?.toolDir, projectConfigPath),
          'utf8'
        );
        projectConfig = projectConfig && JSON.parse(projectConfig);

        // decrypt with old key and encrypt again with latest key
        const config = CryptoJS.AES.decrypt(
          projectConfig.config,
          projectConfig.key
        ).toString(CryptoJS.enc.Utf8);
        delete projectConfig.key;
        projectConfig.config = CryptoJS.AES.encrypt(
          config,
          this.config?.auth?.jwt?.secret
        ).toString();

        const importProjectId = projectConfig?.id;

        // check project already exist
        if (await this.xcMeta.projectGetById(importProjectId)) {
          // todo:
          throw new Error(
            `Project with id '${importProjectId}' already exist, it's not allowed at the moment`
          );
        } else {
          // create the project if not found
          await this.xcMeta.knex('nc_projects').insert(projectConfig);
          projectConfig = JSON.parse(
            (await this.xcMeta.projectGetById(importProjectId))?.config
          );

          // duplicated code from project create - see projectCreateByWeb
          await this.xcMeta.projectAddUser(
            importProjectId,
            req?.session?.passport?.user?.id,
            'owner'
          );
          await this.projectMgr
            .getSqlMgr({
              ...projectConfig,
              metaDb: this.xcMeta?.knex,
            })
            .projectOpenByWeb(projectConfig);
          this.projectConfigs[importProjectId] = projectConfig;

          args.freshImport = true;
        }
        args.project_id = importProjectId;
      }

      await this.xcMetaTablesImportLocalFsToDb(args, req);
      const projectId = this.getProjectId(args);
      this.xcMeta.audit(projectId, null, 'nc_audit', {
        op_type: 'META',
        op_sub_type: 'IMPORT_FROM_ZIP',
        user: req.user.email,
        description: `imported ${projectId} from zip file uploaded `,
        ip: req.clientIp,
      });
    } catch (e) {
      throw e;
    }
  }

  // NOTE: updated
  public async xcMetaTablesExportDbToLocalFs(args, req) {
    if (!('dbAlias' in args)) {
      for (const {
        meta: { dbAlias },
      } of this.projectConfigs[args.project_id].envs[args.env].db) {
        await this.xcMetaTablesExportDbToLocalFs({ ...args, dbAlias }, req);
      }
    } else {
      try {
        const projectId = this.getProjectId(args);
        const metaFolder = path.join(
          this.config.toolDir,
          'nc',
          args.project_id,
          args.dbAlias,
          'meta'
        );

        mkdirp.sync(metaFolder);

        // const client = await this.projectGetSqlClient(args);
        const dbAlias = this.getDbAlias(args);
        for (const tn of META_TABLES[this.config.projectType.toLowerCase()]) {
          // const metaData = await client.knex(tn).select();
          const metaData = await this.xcMeta.metaList(projectId, dbAlias, tn);
          fs.writeFileSync(
            path.join(metaFolder, `${tn}.json`),
            JSON.stringify(metaData, null, 2)
          );
        }

        const projectMetaData = await this.xcMeta.projectGetById(
          projectId,
          true
        );
        projectMetaData.key = this.config?.auth?.jwt?.secret;
        fs.writeFileSync(
          path.join(metaFolder, `nc_project.json`),
          JSON.stringify(projectMetaData, null, 2)
        );

        this.xcMeta.audit(projectId, dbAlias, 'nc_audit', {
          op_type: 'META',
          op_sub_type: 'EXPORT_TO_FS',
          user: req.user.email,
          description: `exported ${projectId}(${dbAlias}) to local filesystem `,
          ip: req.clientIp,
        });
      } catch (e) {
        console.log(e);
        throw e;
      }
    }
  }

  // NOTE: updated
  public async xcMetaTablesExportDbToZip(args, req) {
    await this.xcMetaTablesExportDbToLocalFs(args, req);

    try {
      const filePath = path.join(this.config.toolDir, 'meta.zip');

      await new Promise((resolve, reject) => {
        const output = fs.createWriteStream(filePath);
        const archive = archiver('zip');

        output.on('close', () => {
          resolve(null);
          // console.log(archive.pointer() + ' total bytes');
          // console.log('archiver has been finalized and the output file descriptor has closed.');
        });

        archive.on('error', (err) => {
          reject(err);
        });

        archive.pipe(output);
        archive.directory(
          path.join(this.config.toolDir, 'nc', args.project_id),
          `nc/${args.project_id}`
        );
        // archive.file(path.join(this.config.toolDir, 'config.xc.json'), {name: 'config.xc.json'});
        archive.finalize();
      });

      this.xcMeta.audit(this.getProjectId(args), null, 'nc_audit', {
        op_type: 'META',
        op_sub_type: 'EXPORT_TO_ZIP',
        user: req.user.email,
        description: `exported ${this.getProjectId(args)} to zip file `,
        ip: req.clientIp,
      });

      return { download: true, filePath };
    } catch (e) {
      throw e;
    }
  }

  // NOTE: updated
  public async xcRoutesPolicyGet(args) {
    const result = new Result();
    result.data.list = [];
    try {
      const dbAlias = await this.getDbAlias(args);
      result.data.list = (
        await this.xcMeta.metaList(args.project_id, dbAlias, 'nc_routes', {
          condition: {
            tn: args.args.tn,
          },
        })
      ).map((row) => ({
        ...row,
        handler: JSON.parse(row.handler),
        acl: JSON.parse(row.acl),
      }));
    } catch (e) {
      console.log(e);
    }
    return result;
  }

  // NOTE: xc-meta
  public async xcRoutesPolicyAllGet(args) {
    const result = new Result();
    result.data.list = [];
    try {
      const client = await this.projectGetSqlClient(args);
      result.data.list = (await client.knex('nc_routes').select()).map(
        (row) => ({
          ...row,
          handler: JSON.parse(row.handler),
          acl: JSON.parse(row.acl),
        })
      );
    } catch (e) {
      console.log(e);
    }
    return result;
  }

  // NOTE: xc-meta
  public async xcResolverPolicyGetAll(args) {
    const result = new Result();
    result.data.list = [];
    try {
      const client = await this.projectGetSqlClient(args);
      result.data.list = (await client.knex('nc_resolvers')).map((row) => ({
        ...row,
        acl: JSON.parse(row.acl),
      }));
    } catch (e) {
      console.log(e);
    }
    return result;
  }

  // NOTE: xc-meta
  public async xcRpcPolicyGetAll(args) {
    const result = new Result();
    result.data.list = [];
    try {
      const client = await this.projectGetSqlClient(args);
      result.data.list = (await client.knex('nc_rpc')).map((row) => ({
        ...row,
        acl: JSON.parse(row.acl),
      }));
    } catch (e) {
      console.log(e);
    }
    return result;
  }

  // NOTE: xc-meta
  public async xcRoutesPolicyUpdate(args) {
    const client = await this.projectGetSqlClient(args);
    const trx = await client.knex.transaction();

    try {
      for (const row of args.data) {
        await trx('nc_routes')
          .update({
            acl: JSON.stringify(row.acl),
          })
          .where({
            id: row.id,
          });
      }
      await trx.commit();
    } catch (e) {
      await trx.rollback();
      throw e;
    }
  }

  // NOTE: xc-meta
  public async xcResolverPolicyUpdate(args) {
    const client = await this.projectGetSqlClient(args);
    const trx = await client.knex.transaction();

    try {
      for (const row of args.data) {
        await trx('nc_resolvers')
          .update({
            acl: JSON.stringify(row.acl),
          })
          .where({
            id: row.id,
          });
      }
      trx.commit();
    } catch (e) {
      trx.rollback();
      throw e;
    }
  }

  // NOTE: xc-meta
  public async xcRpcPolicyUpdate(args) {
    const client = await this.projectGetSqlClient(args);
    const trx = await client.knex.transaction();

    try {
      for (const row of args.data) {
        await trx('nc_rpc')
          .update({
            acl: JSON.stringify(row.acl),
          })
          .where({
            id: row.id,
          });
      }
      trx.commit();
    } catch (e) {
      trx.rollback();
      throw e;
    }
  }

  // NOTE: updated
  public async tableXcHooksDelete(args, req) {
    try {
      // args.args.data.url = args.args.data.url.trim();

      const dbAlias = await this.getDbAlias(args);
      const projectId = await this.getProjectId(args);

      if (args.args.id !== null && args.args.id !== undefined) {
        await this.xcMeta.metaDelete(
          projectId,
          dbAlias,
          'nc_hooks',
          args.args.id
        );
      }

      this.xcMeta.audit(projectId, dbAlias, 'nc_audit', {
        op_type: 'WEBHOOKS',
        op_sub_type: 'DELETED',
        user: req.user.email,
        description: `deleted webhook ${
          args.args.title || args.args.id
        } of table ${args.args.tn} `,
        ip: req.clientIp,
      });

      Tele.emit('evt', { evt_type: 'webhooks:deleted' });
    } catch (e) {
      throw e;
    }
  }

  // NOTE: updated
  public async tableXcHooksSet(args, req) {
    const projectId = this.getProjectId(args);
    try {
      // args.args.data.url = args.args.data.url.trim();

      const dbAlias = await this.getDbAlias(args);

      if (args.args.data.id !== null && args.args.data.id !== undefined) {
        await this.xcMeta.metaUpdate(
          projectId,
          dbAlias,
          'nc_hooks',
          {
            ...args.args.data,
            active: true,
            notification: JSON.stringify(args.args.data.notification),
            condition: JSON.stringify(args.args.data.condition),
          },
          args.args.data.id
        );
        this.xcMeta.audit(projectId, dbAlias, 'nc_audit', {
          op_type: 'WEBHOOKS',
          op_sub_type: 'UPDATED',
          user: req.user.email,
          description: `updated webhook ${args.args.data.title} - ${args.args.data.event} ${args.args.data.operation} - ${args.args.data.notification?.type} - of table ${args.args.tn} `,
          ip: req.clientIp,
        });

        Tele.emit('evt', { evt_type: 'webhooks:updated' });
      } else {
        const res = await this.xcMeta.metaInsert(
          projectId,
          dbAlias,
          'nc_hooks',
          {
            ...args.args.data,
            active: true,
            tn: args.args.tn,
            notification: JSON.stringify(args.args.data.notification),
            condition: JSON.stringify(args.args.data.condition),
          }
        );
        this.xcMeta.audit(projectId, dbAlias, 'nc_audit', {
          op_type: 'WEBHOOKS',
          op_sub_type: 'INSERTED',
          user: req.user.email,
          description: `created webhook ${args.args.data.title} - ${args.args.data.event} ${args.args.data.operation} - ${args.args.data.notification?.type} - of table ${args.args.tn} `,
          ip: req.clientIp,
        });
        Tele.emit('evt', { evt_type: 'webhooks:created' });
        return res;
      }

      /*      if (await this.xcMeta.metaGet(args.project_id, dbAlias, 'nc_hooks', {
              tn: args.args.tn,
              operation: args.args.data.operation,
              event: args.args.data.event
            })) {
              await this.xcMeta.metaUpdate(args.project_id, dbAlias, 'nc_hooks', {
                ...args.args.data,
                active: true
              }, {
                tn: args.args.tn,
                operation: args.args.data.operation,
                event: args.args.data.event
              })
            } else {
              await this.xcMeta.metaInsert(args.project_id, dbAlias, 'nc_hooks', {
                ...args.args.data,
                active: true,
                tn: args.args.tn
              })
            }*/
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  // NOTE: xc-meta
  public async xcRoutesHandlerUpdate(args) {
    // const client = await this.projectGetSqlClient(args);
    const dbAlias = await this.getDbAlias(args);

    try {
      // await client.knex('nc_routes').update({
      //   functions: JSON.stringify(args.args.functions)
      // }).where({
      //   tn: args.args.tn,
      //   path: args.args.path,
      //   type: args.args.type
      // })
      await this.xcMeta.metaUpdate(
        args.project_id,
        dbAlias,
        'nc_routes',
        {
          functions: JSON.stringify(args.args.functions),
        },
        {
          tn: args.args.tn,
          path: args.args.path,
          type: args.args.type,
        }
      );
    } catch (e) {
      throw e;
    }
  }

  // NOTE: xc-meta
  public async xcRoutesMiddlewareUpdate(args) {
    const client = await this.projectGetSqlClient(args);

    try {
      await client
        .knex('nc_routes')
        .update({
          functions: JSON.stringify(args.args.functions),
        })
        .where({
          tn: args.args.tn,
          title: args.args.title,
          handler_type: 2,
        });
    } catch (e) {
      throw e;
    }
  }

  // NOTE: updated
  public async xcRpcHandlerUpdate(args) {
    try {
      const dbAlias = this.getDbAlias(args);
      await this.xcMeta.metaUpdate(
        args.project_id,
        dbAlias,
        'nc_rpc',
        {
          functions: JSON.stringify(args.args.functions),
        },
        {
          tn: args.args.tn,
          service: args.args.service,
        }
      );
    } catch (e) {
      throw e;
    }
  }

  // NOTE: xc-meta
  public async rolesGet(args) {
    const client = await this.projectGetSqlClient(args);

    try {
      return await client.knex('nc_roles').select();
    } catch (e) {
      throw e;
    }
  }

  // NOTE: xc-meta
  public async rolesSaveOrUpdate(args) {
    let aclTable;

    if (this.isProjectGraphql()) {
      aclTable = 'nc_resolvers';
    } else if (this.isProjectRest()) {
      aclTable = 'nc_routes';
    } else if (this.isProjectGrpc()) {
      aclTable = 'nc_rpc';
    }

    // todo: update within all

    const client = await this.projectGetSqlClient(args);
    let trx;
    try {
      // todo: optimize transaction
      trx = await client.knex.transaction();

      for (const role of args.args) {
        if (role.id) {
          const oldRole = await trx('nc_roles')
            .where({
              id: role.id,
            })
            .first();
          if (this.isProjectGraphql()) {
            const aclRows = await trx(aclTable).select();
            for (const aclRow of aclRows) {
              try {
                if (aclRow.acl) {
                  const acl = JSON.parse(aclRow.acl);
                  acl[role.title] = acl[oldRole.title];
                  delete acl[oldRole.title];
                  await trx(aclTable)
                    .update({
                      acl: JSON.stringify(acl),
                    })
                    .where({
                      id: aclRow.id,
                    });
                }
              } catch (e) {
                console.log(e);
              }
            }
          }
          if (
            oldRole.title !== role.title ||
            oldRole.description !== role.description
          ) {
            await trx('nc_roles')
              .update({
                ...role,
              })
              .where({
                id: role.id,
              });
          }
        } else {
          if ((await trx('nc_roles').where({ title: role.title })).length) {
            throw new Error(`Role name '${role.title}' already exist`);
          }

          await trx('nc_roles').insert(role);
          const aclRows = await trx(aclTable).select();
          for (const aclRow of aclRows) {
            try {
              if (aclRow.acl) {
                const acl = JSON.parse(aclRow.acl);
                acl[role.title] = true;
                await trx(aclTable)
                  .update({
                    acl: JSON.stringify(acl),
                  })
                  .where({
                    id: aclRow.id,
                  });
              }
            } catch (e) {
              // throw e;
              console.log(e);
            }
          }
        }
      }
      await trx.commit();
    } catch (e) {
      if (trx) {
        trx.rollback(e);
      }
      throw e;
    }
  }

  public setListener(listener: (data) => Promise<any>) {
    this.listener = listener;
  }

  public async xcAttachmentUploadPrivate(req, args, file) {
    try {
      const fileName = `${nanoid(6)}${path.extname(file.originalname)}`;
      const destPath = path.join(
        'nc',
        this.getProjectId(args),
        this.getDbAlias(args),
        'uploads'
      );

      await this.storageAdapter.fileCreate(
        slash(path.join(destPath, fileName)),
        file
      );

      return {
        url: `${req.ncSiteUrl}/dl/${this.getProjectId(args)}/${this.getDbAlias(
          args
        )}/${fileName}`,
        title: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        icon: mimeIcons[path.extname(file.originalname).slice(1)] || undefined,
      };
    } catch (e) {
      throw e;
    }
  }

  public async xcAttachmentUpload(req, args, file) {
    try {
      const appendPath = args.args.appendPath || [];
      const prependName = args.args.prependName?.length
        ? args.args.prependName.join('_') + '_'
        : '';
      return await this._uploadFile({
        prependName,
        file,
        storeInPublicFolder: args?.args?.public,
        appendPath,
        req,
        dbAlias: this.getDbAlias(args),
        projectId: this.getProjectId(args),
      });
    } catch (e) {
      throw e;
    } finally {
      Tele.emit('evt', { evt_type: 'image:uploaded' });
    }
  }

  private async _uploadFile({
    prependName = '',
    file,
    storeInPublicFolder = false,
    appendPath = [],
    req,
    projectId,
    dbAlias,
  }: {
    prependName?: string;
    file: any;
    storeInPublicFolder: boolean;
    appendPath?: string[];
    req: express.Request & any;
    projectId?: string;
    dbAlias?: string;
  }) {
    const fileName = `${prependName}${nanoid(6)}_${file.originalname}`;
    let destPath;
    if (storeInPublicFolder) {
      destPath = path.join('nc', 'public', 'files', 'uploads', ...appendPath);
    } else {
      destPath = path.join('nc', projectId, dbAlias, 'uploads', ...appendPath);
    }
    let url = await this.storageAdapter.fileCreate(
      slash(path.join(destPath, fileName)),
      file
    );
    if (!url) {
      if (storeInPublicFolder) {
        url = `${req.ncSiteUrl}/dl/public/files/${
          appendPath?.length ? appendPath.join('/') + '/' : ''
        }${fileName}`;
      } else {
        url = `${req.ncSiteUrl}/dl/${projectId}/${dbAlias}/${
          appendPath?.length ? appendPath.join('/') + '/' : ''
        }${fileName}`;
      }
    }
    return {
      url,
      title: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      icon: mimeIcons[path.extname(file.originalname).slice(1)] || undefined,
    };
  }

  // protected async initTwilio(overwrite = false): Promise<void> {
  //   // const activeStorage = await this.xcMeta.metaGet(null, null, 'nc_plugins', {
  //   //   active: true,
  //   //   category: 'Twilio'
  //   // });
  //   //
  //   // this.twilioInstance = Twilio.create(activeStorage, overwrite);
  //   // await this.twilioInstance?.init();
  // }

  protected async initCache(overwrite = false): Promise<void> {
    const activeCache = await this.xcMeta.metaGet(null, null, 'nc_plugins', {
      active: true,
      category: 'Cache',
    });

    XcCache.init(activeCache, overwrite);
  }

  protected async handlePublicRequest(req, res, next) {
    let args = req.body;

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

    res.json(result);
  }

  protected async handleRequest(req, res, next) {
    try {
      const args = req.body;
      let result, postListenerCb;

      switch (args.api) {
        case 'xcPluginDemoDefaults':
          result = await this.xcPluginDemoDefaults(args);
          break;
        case 'xcApiTokenList':
          result = await this.xcApiTokenList(args);
          break;
        case 'xcAuditList':
          result = await this.xcAuditList(args);
          break;
        case 'xcModelRowAuditAndCommentList':
          result = await this.xcModelRowAuditAndCommentList(args);
          break;
        case 'xcAuditCommentInsert':
          result = await this.xcAuditCommentInsert(args, req);
          break;
        case 'xcAuditCreate':
          result = await this.xcAuditCreate(args, req);
          break;
        case 'xcAuditModelCommentsCount':
          result = await this.xcAuditModelCommentsCount(args);
          break;
        case 'xcApiTokenCreate':
          result = await this.xcApiTokenCreate(args);
          break;
        case 'xcApiTokenUpdate':
          result = await this.xcApiTokenUpdate(args);
          break;
        case 'xcApiTokenDelete':
          result = await this.xcApiTokenDelete(args);
          break;

        case 'xcVirtualTableCreate':
          result = await this.xcVirtualTableCreate(args, req);
          break;
        case 'xcVirtualTableRename':
          result = await this.xcVirtualTableRename(args, req);
          break;
        case 'xcVirtualTableUpdate':
          result = await this.xcVirtualTableUpdate(args);
          break;
        case 'ncProjectInfo':
          result = await this.ncProjectInfo(args);
          break;
        case 'xcVirtualTableDelete':
          result = await this.xcVirtualTableDelete(args, req);
          break;
        case 'xcMetaDiff':
          result = await this.xcMetaDiff(args, req);
          break;
        case 'xcVirtualTableList':
          result = await this.xcVirtualTableList(args, req);
          break;

        case 'xcVersionLetters':
          result = this.xcVersionLetters(args);
          break;

        case 'xcPluginList':
          result = await this.xcPluginList(args);
          break;
        case 'xcPluginRead':
          result = await this.xcPluginRead(args);
          break;
        case 'xcPluginTest':
          result = await this.xcPluginTest(req, args);
          break;
        case 'xcPluginCreate':
          result = await this.xcPluginCreate(args);
          break;
        case 'xcPluginDelete':
          result = await this.xcPluginDelete(args);
          break;
        case 'xcPluginSet':
          result = await this.xcPluginSet(args);
          break;

        case 'xcVisibilityMetaGet':
          result = await this.xcVisibilityMetaGet(args);
          break;
        case 'xcExportAsCsv':
          result = await this.xcExportAsCsv(args, req, res);
          break;

        case 'xcModelsCreateFromTemplate':
          result = await this.xcModelsCreateFromTemplate(args, req);
          break;

        case 'xcVisibilityMetaSet':
          result = await this.xcVisibilityMetaSet(args);
          break;

        case 'xcVisibilityMetaSetAll':
          result = await this.xcVisibilityMetaSetAll(args);
          break;

        case 'xcTableAndViewList':
          result = await this.xcTableAndViewList(req, args);
          break;

        case 'tableList':
          result = await this.xcTableList(req, args);
          break;

        case 'columnList':
          result = await this.xcColumnList(args);
          break;

        case 'viewList':
          result = await this.xcViewList(req, args);
          break;

        case 'functionList':
          result = await this.xcFunctionList(req, args);
          break;

        case 'procedureList':
          result = await this.xcProcedureList(req, args);
          break;

        case 'xcAuthHookGet':
          result = await this.xcAuthHookGet(args);
          break;

        case 'xcAuthHookSet':
          result = await this.xcAuthHookSet(args);
          break;

        case 'createSharedViewLink':
          result = await this.createSharedViewLink(req, args);
          break;
        case 'createSharedBaseLink':
          result = await this.createSharedBaseLink(req, args);
          break;
        case 'disableSharedBaseLink':
          result = await this.disableSharedBaseLink(req, args);
          break;
        case 'getSharedBaseLink':
          result = await this.getSharedBaseLink(req, args);
          break;

        case 'updateSharedViewLinkPassword':
          result = await this.updateSharedViewLinkPassword(args);
          break;
        case 'deleteSharedViewLink':
          result = await this.deleteSharedViewLink(args);
          break;
        case 'listSharedViewLinks':
          result = await this.listSharedViewLinks(args);
          break;

        case 'testConnection':
          result = await SqlClientFactory.create(args.args).testConnection();
          break;
        case 'xcProjectGetConfig':
          result = await this.xcMeta.projectGetById(this.getProjectId(args));
          break;

        case 'projectCreateByWeb':
          if (process.env.NC_CONNECT_TO_EXTERNAL_DB_DISABLED) {
            throw new Error(
              'Creating new project with external Database not allowed'
            );
          }
          await this.checkIsUserAllowedToCreateProject(req);
          result = await this.xcMeta.projectCreate(
            args.args.project.title,
            args.args.projectJson
          );
          await this.xcMeta.projectAddUser(
            result.id,
            req?.session?.passport?.user?.id,
            'owner'
          );
          await this.projectMgr
            .getSqlMgr({
              ...result,
              config: args.args.projectJson,
              metaDb: this.xcMeta?.knex,
            })
            .projectOpenByWeb(args.args.projectJson);
          this.projectConfigs[result.id] = args.args.projectJson;

          this.xcMeta.audit(result.id, null, 'nc_audit', {
            op_type: 'PROJECT',
            op_sub_type: 'CREATED',
            user: req.user.email,
            description: `created project ${args.args.projectJson.title}(${result.id}) `,
            ip: req.clientIp,
          });

          Tele.emit('evt', { evt_type: 'project:created' });
          break;

        case 'projectUpdateByWeb':
          await this.xcMeta.projectUpdate(
            this.getProjectId(args),
            args.args.projectJson
          );
          Tele.emit('evt', { evt_type: 'project:updated' });
          break;
        case 'projectCreateByOneClick':
          {
            const config = NcConfigFactory.makeProjectConfigFromUrl(
              process.env.NC_DB,
              args.args.projectType
            );
            config.title = args.args.title;
            config.projectType = args.args.projectType;
            result = await this.xcMeta.projectCreate(config.title, config);
            await this.xcMeta.projectAddUser(
              result.id,
              req?.session?.passport?.user?.id,
              'owner'
            );
            await this.projectMgr
              .getSqlMgr({
                ...result,
                config,
                metaDb: this.xcMeta?.knex,
              })
              .projectOpenByWeb(config);
            this.projectConfigs[result.id] = config;

            this.xcMeta.audit(result.id, null, 'nc_audit', {
              op_type: 'PROJECT',
              op_sub_type: 'CREATED',
              user: req.user.email,
              description: `created project ${config.title}(${result.id}) `,
              ip: req.clientIp,
            });
            Tele.emit('evt', { evt_type: 'project:created', oneClick: true });
          }
          break;
        case 'projectCreateByWebWithXCDB': {
          await this.checkIsUserAllowedToCreateProject(req);
          const config = NcConfigFactory.makeProjectConfigFromConnection(
            this.config?.meta?.db,
            args.args.projectType
          );
          config.title = args.args.title;
          config.projectType = args.args.projectType;

          // const metaProjectsCount = await this.xcMeta.metaGet(null, null, 'nc_store', {
          //   key: 'NC_PROJECT_COUNT'
          // });
          // // todo: populate unique prefix dynamically
          // config.prefix = `xb${Object.keys(this.projectConfigs).length}__`;
          // if (metaProjectsCount) {
          //   // todo: populate unique prefix dynamically
          //   config.prefix = `xa${(+metaProjectsCount.value || 0) + 1}__`;
          // }

          result = await this.xcMeta.projectCreate(
            config.title,
            config,
            null,
            true
          );
          await this.xcMeta.projectAddUser(
            result.id,
            req?.session?.passport?.user?.id,
            'owner'
          );
          await this.projectMgr
            .getSqlMgr({
              ...result,
              config,
              metaDb: this.xcMeta?.knex,
            })
            .projectOpenByWeb(config);

          this.projectConfigs[result.id] = config;
          // this.xcMeta.metaUpdate(null, null, 'nc_store', {
          //   value: ((metaProjectsCount && +metaProjectsCount.value) || 0) + 1
          // }, {key: 'NC_PROJECT_COUNT'})

          this.xcMeta.audit(result?.id, null, 'nc_audit', {
            op_type: 'PROJECT',
            op_sub_type: 'CREATED',
            user: req.user.email,
            description: `created project ${config.title}(${result.id}) within xcdb `,
            ip: req.clientIp,
          });

          Tele.emit('evt', { evt_type: 'project:created', xcdb: true });
          postListenerCb = async () => {
            if (args?.args?.template) {
              Tele.emit('evt', {
                evt_type: args.args?.quickImport
                  ? 'project:created:fromExcel'
                  : 'project:created:fromTemplate',
                xcdb: true,
              });
              await this.xcModelsCreateFromTemplate(
                {
                  dbAlias: 'db', // this.nodes.dbAlias,
                  env: '_noco',
                  project_id: result?.id,
                  args: {
                    template: args?.args?.template,
                  },
                },
                req
              );
            }
          };

          break;
        }
        case 'projectList':
          result = await this.xcMeta.userProjectList(
            req?.session?.passport?.user?.id
          );
          result.forEach((p) => {
            const config = JSON.parse(p.config);
            p.projectType = config?.projectType;
            p.prefix = config?.prefix;
            delete p.config;
          });
          break;

        case 'projectStop':
        case 'projectDelete':
        case 'projectRestart':
        case 'projectStart':
          Tele.emit('evt', { evt_type: 'project:' + args.api });
          result = null;
          break;

        case 'tableXcHooksGet':
          result = await this.tableXcHooksGet(args);
          break;
        case 'tableXcHooksList':
          result = await this.tableXcHooksList(args);
          break;

        case 'tableXcHooksSet':
          result = await this.tableXcHooksSet(args, req);
          break;

        case 'tableXcHooksDelete':
          result = await this.tableXcHooksDelete(args, req);
          break;

        case 'defaultRestHandlerCodeGet':
          result = await this.defaultRestHandlerCodeGet(args);
          break;

        case 'xcMetaTablesExportDbToLocalFs':
          result = await this.xcMetaTablesExportDbToLocalFs(args, req);
          break;

        case 'xcMetaTablesImportLocalFsToDb':
          result = await this.xcMetaTablesImportLocalFsToDb(args, req);
          break;

        case 'xcMetaTablesExportDbToZip':
          result = await this.xcMetaTablesExportDbToZip(args, req);
          break;

        case 'xcMetaTablesReset':
          result = await this.xcMetaTablesReset(args);
          break;

        case 'xcRoutesHandlerUpdate':
          result = await this.xcRoutesHandlerUpdate(args);
          break;

        case 'xcRoutesMiddlewareUpdate':
          result = await this.xcRoutesMiddlewareUpdate(args);
          break;

        case 'xcResolverHandlerUpdate':
          result = await this.xcResolverHandlerUpdate(args);
          break;

        case 'xcResolverMiddlewareUpdate':
          result = await this.xcResolverMiddlewareUpdate(args);
          break;

        case 'xcRpcHandlerUpdate':
          result = await this.xcRpcHandlerUpdate(args);
          break;

        case 'xcRpcPolicyGet':
          result = await this.xcRpcPolicyGet(args);
          break;

        case 'xcRoutesPolicyGet':
          result = await this.xcRoutesPolicyGet(args);
          break;

        case 'rolesGet':
          result = await this.rolesGet(args);
          break;

        case 'xcResolverPolicyGet':
          result = await this.xcResolverPolicyGet(args);
          break;

        case 'rolesSaveOrUpdate':
          result = await this.rolesSaveOrUpdate(args);
          break;

        case 'rolesDelete':
          result = await this.rolesDelete(args);
          break;

        case 'tableXcModelGet':
          result = await this.tableXcModelGet(req, args);
          break;

        case 'xcModelSet':
          result = await this.xcModelSet(args);
          break;

        case 'xcModelOrderSet':
          result = await this.xcModelOrderSet(args);
          break;

        case 'xcModelViewOrderSet':
          result = await this.xcModelViewOrderSet(args);
          break;

        case 'xcUpdateVirtualKeyAlias':
          result = await this.xcUpdateVirtualKeyAlias(args);
          break;

        case 'xcRelationsGet':
          result = await this.xcRelationsGet(args);
          break;

        case 'xcRelationsSet':
          result = await this.xcRelationsSet(args);
          break;

        case 'xcModelSchemaSet':
          result = await this.xcModelSchemaSet(args);
          break;

        case 'xcModelMessagesAndServicesSet':
          result = await this.xcModelMessagesAndServicesSet(args);
          break;

        case 'xcModelSwaggerDocSet':
          result = await this.xcModelSwaggerDocSet(args);
          break;

        case 'xcModelsEnable':
          result = await this.xcModelsEnable(args);
          break;

        case 'xcViewModelsEnable':
          result = await this.xcViewModelsEnable(args);
          break;

        case 'xcTableModelsEnable':
          result = await this.xcTableModelsEnable(args);
          break;

        case 'xcFunctionModelsEnable':
          result = await this.xcFunctionModelsEnable(args);
          break;

        case 'xcProcedureModelsEnable':
          result = await this.xcProcedureModelsEnable(args);
          break;

        case 'xcModelsList':
          result = await this.xcModelsList(args);
          break;

        case 'xcViewModelsList':
          result = await this.xcViewModelsList(args);
          break;

        case 'xcProcedureModelsList':
          result = await this.xcProcedureModelsList(args);
          break;

        case 'xcFunctionModelsList':
          result = await this.xcFunctionModelsList(args);
          break;

        case 'xcTableModelsList':
          result = await this.xcTableModelsList(args);
          break;

        case 'xcCronList':
          result = await this.xcCronList(args);
          break;

        case 'xcCronSave':
          result = await this.xcCronSave(args);
          break;

        case 'cronDelete':
          result = await this.cronDelete(args);
          break;

        case 'xcAclGet':
          result = await this.xcAclGet(args);
          break;

        case 'xcAclSave':
          result = await this.xcAclSave(args, req);
          break;

        case 'xcAclAggregatedGet':
          result = await this.xcAclAggregatedGet(args);
          break;

        case 'xcAclAggregatedSave':
          result = await this.xcAclAggregatedSave(args);
          break;

        case 'xcDebugGet':
          result = await this.xcDebugGet(args);
          break;

        case 'xcDebugSet':
          result = await this.xcDebugSet(args);
          break;

        case 'xcVirtualRelationCreate':
          result = await this.xcVirtualRelationCreate(args, req);
          break;
        case 'ncTableAliasRename':
          break;

        case 'xcM2MRelationCreate':
          result = await this.xcM2MRelationCreate(args, req);
          break;

        case 'xcRelationColumnDelete':
          result = await this.xcRelationColumnDelete(args, req);
          break;

        case 'xcVirtualRelationDelete':
          result = await this.xcVirtualRelationDelete(args, req);
          break;

        case 'xcRelationList':
          result = await this.xcRelationList(args);
          break;

        case 'tableMetaCreate':
        case 'tableMetaDelete':
        case 'tableMetaRecreate':
        case 'viewMetaCreate':
        case 'viewMetaDelete':
        case 'viewMetaRecreate':
        case 'procedureMetaCreate':
        case 'procedureMetaDelete':
        case 'procedureMetaRecreate':
        case 'functionMetaCreate':
        case 'functionMetaDelete':
        case 'functionMetaRecreate':
        case 'xcMetaDiffSync':
          result = { msg: 'success' };
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

  protected async xcDebugSet(args) {
    NcHelp.enableOrDisableDebugLog(args.args);

    return this.xcMeta.metaUpdate(
      args.project_id,
      '',
      'nc_store',
      {
        value: JSON.stringify(args.args),
      },
      {
        key: 'NC_DEBUG',
      }
    );
  }

  protected async xcDebugGet(_args) {
    return this.xcMeta.metaGet('', '', 'nc_store', {
      key: 'NC_DEBUG',
    });
  }

  // NOTE: updated
  protected async xcAclGet(args): Promise<any> {
    try {
      // const client = await this.projectGetSqlClient(args);
      // return await client.knex('nc_acl').where({
      //   tn: args.args.tn || args.args.name
      // }).first();
      const dbAlias = await this.getDbAlias(args);
      return await this.xcMeta.metaGet(args.project_id, dbAlias, 'nc_acl', {
        tn: args.args.tn || args.args.name,
      });
    } catch (e) {
      throw e;
    }
  }

  // NOTE: updated
  protected async xcAclAggregatedGet(args): Promise<any> {
    const ops = ['create', 'read', 'update', 'delete'];
    const res = {};
    try {
      const roles = await this.xcMeta.metaList('', '', 'nc_roles');

      for (const { title } of roles) {
        res[title] = {};
        ops.forEach((op) => (res[title][op] = false));
      }

      for (const dbAlias of this.getDbAliasList(args.project_id)) {
        const aclRows = await this.xcMeta.metaList(
          args.project_id,
          dbAlias,
          'nc_acl'
        );

        for (const aclRow of aclRows) {
          const acl = JSON.parse(aclRow.acl);
          for (const role of Object.keys(acl)) {
            res[role] = res[role] || {};
            if (typeof acl[role] === 'object') {
              for (const op of ops) {
                if (!res[role][op]) {
                  if (
                    acl[role][op] &&
                    typeof acl[role][op] === 'object' &&
                    acl[role][op].columns
                  ) {
                    res[role][op] = Object.values(acl[role][op].columns).some(
                      (v) => v
                    );
                  } else {
                    res[role][op] = acl[role][op];
                  }
                }
              }
            } else {
              for (const op of ops) {
                res[role][op] = res[role][op] || acl[role];
              }
            }
          }
        }
      }
    } catch (e) {
      throw e;
    }
    return res;
  }

  // NOTE: updated
  protected async xcAclSave(args, req): Promise<any> {
    // if (!this.isEe) {
    for (const acl of Object.values(args.args.acl)) {
      for (const colLevelAcl of Object.values(acl)) {
        if (typeof colLevelAcl === 'boolean') {
          continue;
        }
        const allowed = Object.values(colLevelAcl.columns);
        if (!allowed.every((v) => v === allowed[0])) {
          throw new XCEeError('Please upgrade');
        }
      }
    }
    // }

    try {
      const dbAlias = await this.getDbAlias(args);
      const projectId = await this.getProjectId(args);
      const res = await this.xcMeta.metaUpdate(
        projectId,
        dbAlias,
        'nc_acl',
        {
          acl: JSON.stringify(args.args.acl),
        },
        {
          tn: args.args.tn || args.args.name,
        }
      );

      this.app.ncMeta.audit(projectId, dbAlias, 'nc_audit', {
        op_type: 'TABLE_ACL',
        op_sub_type: 'UPDATED',
        user: req.user.email,
        description: `updated table ${args.args.tn || args.args.name} acl `,
        ip: req.clientIp,
      });

      Tele.emit('evt', { evt_type: 'acl:updated' });

      return res;
    } catch (e) {
      throw e;
    }
  }

  // NOTE: updated
  protected async xcAclAggregatedSave(args): Promise<any> {
    try {
      for (const dbAlias of this.getDbAliasList(args.project_id)) {
        await this.xcMeta.metaUpdate(
          args.project_id,
          dbAlias,
          'nc_acl',
          { acl: JSON.stringify(args.args) },
          {}
        );
      }
    } catch (e) {
      console.log(e);
    }
  }

  // NOTE: updated
  protected async xcResolverPolicyGet(args): Promise<any> {
    const result = new Result();
    result.data.list = [];
    try {
      const dbAlias = await this.getDbAlias(args);
      result.data.list = (
        await this.xcMeta.metaList(args.project_id, dbAlias, 'nc_resolvers', {
          condition: {
            title: args.args.tn,
          },
        })
      ).map((row) => ({
        ...row,
        acl: JSON.parse(row.acl),
      }));
    } catch (e) {
      console.log(e);
    }
    return result;
  }

  // NOTE: updated
  // @ts-ignore
  protected async xcRpcPolicyGet(args): Promise<any> {
    const result = new Result();
    result.data.list = [];
    try {
      const dbAlias = await this.getDbAlias(args);
      result.data.list = (
        await this.xcMeta.metaList(args.project_id, dbAlias, 'nc_rpc', {
          condition: {
            tn: args.args.tn,
          },
        })
      ).map((row) => ({
        ...row,
        acl: JSON.parse(row.acl),
      }));
    } catch (e) {
      console.log(e);
    }
    return result;
  }

  // NOTE: updated
  protected async tableXcHooksGet(args): Promise<any> {
    const result = new Result();
    result.data.list = [];
    try {
      const dbAlias = await this.getDbAlias(args);
      result.data.list = await this.xcMeta.metaList(
        args.project_id,
        dbAlias,
        'nc_hooks',
        {
          condition: {
            tn: args.args.tn,
            operation: args.args.data.operation,
            event: args.args.data.event,
          },
        }
      );
    } catch (e) {
      console.log(e);
    }
    return result;
  }

  // NOTE: updated
  protected async tableXcHooksList(args): Promise<any> {
    const result = new Result();
    result.data.list = [];
    try {
      const dbAlias = await this.getDbAlias(args);
      result.data.list = await this.xcMeta.metaList(
        args.project_id,
        dbAlias,
        'nc_hooks',
        {
          condition: {
            tn: args.args.tn,
          },
        }
      );
    } catch (e) {
      console.log(e);
    }
    return result;
  }

  // NOTE: updated
  protected async tableXcModelGet(req, args): Promise<any> {
    const roles = req.session?.passport?.user?.roles;
    const dbAlias = await this.getDbAlias(args);

    let meta = this.cacheModelGet(
      args.project_id,
      dbAlias,
      'table',
      args.args.tn
    );

    if (!meta) {
      meta = await this.xcMeta.metaGet(
        args.project_id,
        dbAlias,
        'nc_models',
        {
          title: args.args.tn,
          // type: 'table'
        },
        ['alias', 'meta', 'parent_model_title', 'title', 'query_params', 'id']
      );
      this.cacheModelSet(args.project_id, dbAlias, 'table', args.args.tn, meta);
    }

    if (req?.session?.passport?.user?.roles?.creator) {
      return meta;
    }

    const disabledData = await this.xcMeta.metaList(
      this.getProjectId(args),
      this.getDbAlias(args),
      'nc_disabled_models_for_role',
      {
        xcCondition: {
          _or: [
            {
              relation_type: {
                eq: 'hm',
              },
              rtn: {
                eq: args.args.tn,
              },
            },
            {
              relation_type: {
                eq: 'bt',
              },
              tn: {
                eq: args.args.tn,
              },
            },
          ],
        },
      }
    );

    const groupedDisabledData = disabledData.reduce((o, d) => {
      const key = [d.tn, d.relation_type, d.rtn, d.cn, d.rcn, d.role].join(
        '||'
      );

      o[key] = d.disabled;

      return o;
    }, {});

    const parsedTableMeta = JSON.parse(meta.meta);

    if (parsedTableMeta?.belongsTo) {
      parsedTableMeta.belongsTo = parsedTableMeta.belongsTo.filter((bt) => {
        const key = [bt.tn, 'bt', bt.rtn, bt.cn, bt.rcn].join('||');
        return Object.keys(roles).some(
          (role) => roles[role] && !groupedDisabledData[`${key}||${role}`]
        );
      });
    }
    if (parsedTableMeta?.hasMany) {
      parsedTableMeta.hasMany = parsedTableMeta.hasMany.filter((hm) => {
        const key = [hm.tn, 'hm', hm.rtn, hm.cn, hm.rcn].join('||');
        return Object.keys(roles).some(
          (role) => roles[role] && !groupedDisabledData[`${key}||${role}`]
        );
      });
    }

    meta.meta = JSON.stringify(parsedTableMeta);

    return meta;
  }

  // NOTE: updated
  protected async xcModelSet(args): Promise<any> {
    const dbAlias = this.getDbAlias(args);
    this.cacheModelDel(this.getProjectId(args), dbAlias, 'table', args.args.tn);
    return this.xcMeta.metaUpdate(
      args.project_id,
      dbAlias,
      'nc_models',
      {
        meta: JSON.stringify(args.args.meta),
      },
      {
        title: args.args.tn,
      }
    );
  }

  // NOTE: updated
  protected async xcModelOrderSet(args): Promise<any> {
    const dbAlias = this.getDbAlias(args);
    return this.xcMeta.metaUpdate(
      this.getProjectId(args),
      dbAlias,
      'nc_models',
      {
        order: args.args.order,
      },
      {
        title: args.args.tn,
      }
    );
  }

  // NOTE: updated
  protected async xcModelViewOrderSet(args): Promise<any> {
    const dbAlias = this.getDbAlias(args);
    return this.xcMeta.metaUpdate(
      this.getProjectId(args),
      dbAlias,
      'nc_models',
      {
        view_order: args.args.view_order,
      },
      args.args.id
    );
  }

  protected async xcUpdateVirtualKeyAlias(args): Promise<any> {
    const dbAlias = await this.getDbAlias(args);
    const model = await this.xcMeta.metaGet(
      args.project_id,
      dbAlias,
      'nc_models',
      {
        title: args.args.tn,
      }
    );
    const meta = JSON.parse(model.meta);
    const vColumn = meta.v.find((v) => v._cn === args.args.oldAlias);
    if (!vColumn) {
      return;
    }
    vColumn._cn = args.args.newAlias;

    const queryParams = JSON.parse(model.query_params);
    if (
      queryParams?.showFields &&
      args.args.oldAlias in queryParams.showFields
    ) {
      queryParams.showFields[args.args.newAlias] =
        queryParams.showFields[args.args.oldAlias];
    }
    if (
      queryParams?.columnsWidth &&
      args.args.oldAlias in queryParams.columnsWidth
    ) {
      queryParams.columnsWidth[args.args.newAlias] =
        queryParams.columnsWidth[args.args.oldAlias];
    }

    if (queryParams?.fieldsOrder) {
      queryParams.fieldsOrder.map((v) =>
        v === args.args.oldAlias ? args.args.newAlias : v
      );
    }

    await this.xcMeta.metaUpdate(
      args.project_id,
      dbAlias,
      'nc_models',
      {
        meta: JSON.stringify(meta),
        query_params: JSON.stringify(queryParams),
      },
      {
        title: args.args.tn,
      }
    );

    this.cacheModelDel(args.project_id, dbAlias, 'table', args.args.tn);
  }

  // NOTE: updated
  protected async xcRelationsGet(args): Promise<any> {
    const dbAlias = await this.getDbAlias(args);
    const metas = await this.xcMeta.metaList(
      args.project_id,
      dbAlias,
      'nc_models',
      {
        condition: {
          type: 'table',
        },
      }
    );
    const list = [];
    for (const meta of metas) {
      const metaObj = JSON.parse(meta.meta);
      list.push(
        ...metaObj.hasMany.map((rel) => {
          rel.relationType = 'hm';
          rel.edited = false;
          return rel;
        })
      );
      list.push(
        ...metaObj.belongsTo.map((rel) => {
          rel.relationType = 'bt';
          rel.edited = false;
          return rel;
        })
      );
    }
    return list;
  }

  // NOTE: updated
  protected async xcRelationsSet(_args): Promise<any> {
    XCEeError.throw();
  }

  // NOTE: xc-meta
  protected async xcModelsEnable(args): Promise<any> {
    const dbAlias = await this.getDbAlias(args);
    await this.xcMeta.metaUpdate(
      args.project_id,
      dbAlias,
      'nc_models',
      {
        enabled: true,
      },
      null,
      { title: { in: args.args } }
    );

    await this.xcMeta.metaUpdate(
      args.project_id,
      dbAlias,
      'nc_models',
      {
        enabled: false,
      },
      null,
      { title: { nin: args.args } }
    );
  }

  // NOTE: updated
  protected async xcViewModelsEnable(args): Promise<any> {
    const dbAlias = await this.getDbAlias(args);
    await this.xcMeta.metaUpdate(
      args.project_id,
      dbAlias,
      'nc_models',
      {
        enabled: true,
      },
      null,
      {
        title: {
          in: args.args,
        },
        type: {
          eq: 'view',
        },
      }
    );

    await this.xcMeta.metaUpdate(
      args.project_id,
      dbAlias,
      'nc_models',
      {
        enabled: false,
      },
      null,
      {
        title: {
          nin: args.args,
        },
        type: {
          eq: 'view',
        },
      }
    );
  }

  // NOTE: updated
  protected async xcTableModelsEnable(_args): Promise<any> {
    XCEeError.throw();
  }

  // NOTE: xc-meta
  protected async xcProcedureModelsEnable(args): Promise<any> {
    const dbAlias = await this.getDbAlias(args);

    await this.xcMeta.metaUpdate(
      args.project_id,
      dbAlias,
      'nc_models',
      {
        enabled: true,
      },
      null,
      {
        title: { in: args.args },
        type: { eq: 'procedure' },
      }
    );
    await this.xcMeta.metaUpdate(
      args.project_id,
      dbAlias,
      'nc_models',
      {
        enabled: false,
      },
      null,
      {
        title: { nin: args.args },
        type: { eq: 'procedure' },
      }
    );
  }

  // NOTE: updated
  protected async xcFunctionModelsEnable(args): Promise<any> {
    const dbAlias = await this.getDbAlias(args);
    await this.xcMeta.metaUpdate(
      args.project_id,
      dbAlias,
      'nc_models',
      {
        enabled: true,
      },
      null,
      {
        title: { in: args.args },
        type: { eq: 'function' },
      }
    );

    await this.xcMeta.metaUpdate(
      args.project_id,
      dbAlias,
      'nc_models',
      {
        enabled: false,
      },
      null,
      {
        title: { nin: args.args },
        type: { eq: 'function' },
      }
    );
  }

  // NOTE: xc-meta
  protected async xcModelsList(args): Promise<any> {
    const dbAlias = await this.getDbAlias(args);
    return this.xcMeta.metaList(args.project_id, dbAlias, 'nc_models', {
      condition: {
        title: 'enabled',
      },
    });
  }

  // NOTE: updated
  protected async xcTableModelsList(args): Promise<any> {
    const dbAlias = this.getDbAlias(args);
    return this.xcMeta.metaList(args.project_id, dbAlias, 'nc_models', {
      condition: {
        type: 'table',
      },
    });
  }

  // NOTE: updated
  protected async xcViewModelsList(args): Promise<any> {
    const dbAlias = this.getDbAlias(args);
    return this.xcMeta.metaList(args.project_id, dbAlias, 'nc_models', {
      condition: {
        type: 'view',
      },
    });
  }

  // NOTE: updated
  protected async xcProcedureModelsList(args): Promise<any> {
    const dbAlias = await this.getDbAlias(args);
    return this.xcMeta.metaList(args.project_id, dbAlias, 'nc_models', {
      condition: { type: 'procedure' },
    });
  }

  // NOTE: updated
  protected async xcFunctionModelsList(args): Promise<any> {
    const dbAlias = await this.getDbAlias(args);
    return this.xcMeta.metaList(args.project_id, dbAlias, 'nc_models', {
      condition: { type: 'function' },
    });
  }

  // NOTE: updated
  protected async xcCronList(args): Promise<any> {
    // const client = await this.projectGetSqlClient(args);
    // return client.knex('nc_cron').select();
    const dbAlias = await this.getDbAlias(args);
    return this.xcMeta.metaList(args.project_id, dbAlias, 'nc_cron');
  }

  // NOTE: updated
  protected async xcCronSave(args): Promise<any> {
    const { id, ...rest } = args.args;
    const dbAlias = await this.getDbAlias(args);
    if (id) {
      return this.xcMeta.metaUpdate(args.project_id, dbAlias, 'nc_cron', rest, {
        id,
      });
    } else {
      return this.xcMeta.metaInsert(args.project_id, dbAlias, 'nc_cron', rest);
    }
  }

  // NOTE: updated
  protected async cronDelete(args): Promise<any> {
    const dbAlias = await this.getDbAlias(args);
    return this.xcMeta.metaDelete(
      args.project_id,
      dbAlias,
      'nc_cron',
      args.args.id
    );
  }

  // NOTE: updated
  protected async xcModelSchemaSet(args): Promise<any> {
    const dbAlias = await this.getDbAlias(args);
    return this.xcMeta.metaUpdate(
      args.project_id,
      dbAlias,
      'nc_models',
      {
        schema: args.args.schema,
      },
      {
        title: args.args.tn,
      }
    );
  }

  protected async xcModelMessagesAndServicesSet(args): Promise<any> {
    const dbAlias = await this.getDbAlias(args);
    return this.xcMeta.metaUpdate(
      args.project_id,
      dbAlias,
      'nc_models',
      {
        messages: args.args.messages,
        services: args.args.services,
      },
      {
        title: args.args.tn,
      }
    );
  }

  protected async xcModelSwaggerDocSet(args): Promise<any> {
    const dbAlias = await this.getDbAlias(args);
    return this.xcMeta.metaUpdate(
      args.project_id,
      dbAlias,
      'nc_models',
      {
        schema: JSON.stringify(args.args.swaggerDoc),
      },
      {
        title: args.args.tn,
      }
    );
  }

  // NOTE: xc-meta
  protected async rolesDelete(args): Promise<any> {
    const client = await this.projectGetSqlClient(args);

    let aclTable;

    if (this.isProjectGraphql()) {
      aclTable = 'nc_resolvers';
    } else if (this.isProjectRest()) {
      aclTable = 'nc_routes';
    } else if (this.isProjectGrpc()) {
      aclTable = 'nc_rpc';
    }

    let trx;
    try {
      trx = await client.knex.transaction();
      const role = await trx('nc_roles').where({ id: args.args.id }).first();
      if (!role) {
        throw new Error(`Role with id '${args.args.id}' not found`);
      }
      const deleteRoleName = role.title;

      const aclRows = await trx(aclTable).select();
      for (const aclRow of aclRows) {
        try {
          if (aclRow.acl) {
            const acl = JSON.parse(aclRow.acl);
            delete acl[deleteRoleName];
            await trx(aclTable)
              .update({
                acl: JSON.stringify(acl),
              })
              .where({
                id: aclRow.id,
              });
          }
        } catch (e) {
          console.log(e);
        }
      }

      await trx('nc_roles').where({ id: args.args.id }).del();

      await trx.commit();
    } catch (e) {
      if (trx) {
        trx.rollback(e);
      }
      throw e;
    }
  }

  // NOTE: update
  protected async xcResolverHandlerUpdate(args): Promise<any> {
    // const client = await this.projectGetSqlClient(args);
    const dbAlias = this.getDbAlias(args);

    try {
      await this.xcMeta.metaUpdate(
        args.project_id,
        dbAlias,
        'nc_resolvers',
        {
          functions: JSON.stringify(args.args.functions),
        },
        {
          title: args.args.tn,
          resolver: args.args.resolver,
        }
      );
    } catch (e) {
      throw e;
    }
  }

  // NOTE: xc-meta
  protected async xcResolverMiddlewareUpdate(args): Promise<any> {
    const client = await this.projectGetSqlClient(args);

    try {
      await client
        .knex('nc_resolvers')
        .update({
          functions: JSON.stringify(args.args.functions),
        })
        .where({
          title: args.args.tn,
          handler_type: 2,
        });
    } catch (e) {
      throw e;
    }
  }

  // NOTE: updated
  protected async defaultRestHandlerCodeGet(args): Promise<any> {
    const dbAlias = await this.getDbAlias(args);
    const modelMeta = await this.xcMeta.metaGet(
      args.project_id,
      dbAlias,
      'nc_models',
      { title: args.args.tn }
    );

    const meta = JSON.parse(modelMeta.meta);
    const ctx = {
      routeVersionLetter: this.getRouteVersionLetter(args),
      tn: args.args.tn,
      _tn: meta && meta._tn,
      type: meta.type,
    };

    let routes;

    // todo: pass table name alias
    if (args.args.relation_type === 'hasMany') {
      const modelMeta = await this.xcMeta.metaGet(
        args.project_id,
        dbAlias,
        'nc_models',
        { title: args.args.tnc }
      );
      const meta = JSON.parse(modelMeta.meta);
      Object.assign(ctx, {
        tnc: args.args.tnc,
        _ctn: meta && meta._tn,
      });
      routes = new ExpressXcTsRoutesHm({ ctx }).getObject();
    } else if (args.args.relation_type === 'belongsTo') {
      // const modelMeta = await client.knex('xc_models').where('title', args.args.tnp).first();
      const modelMeta = await this.xcMeta.metaGet(
        args.project_id,
        dbAlias,
        'nc_models',
        { title: args.args.tnp }
      );
      const meta = JSON.parse(modelMeta.meta);
      Object.assign(ctx, {
        rtn: args.args.tnp,
        _rtn: meta && meta._tn,
      });
      routes = new ExpressXcTsRoutesBt({ ctx }).getObject();
    } else {
      routes = new ExpressXcTsRoutes({ ctx }).getObject();
    }

    const route = routes.find(
      (route) => route.path === args.args.path && route.type === args.args.type
    );
    if (route) {
      return route.functions;
    }
  }

  protected projectGetSqlClient(args) {
    const builder = this.getBuilder(args);
    return builder?.getSqlClient();
  }

  protected getBuilder(args): RestApiBuilder | GqlApiBuilder {
    return this.app.projectBuilders
      .find((pb) => pb.id === args.project_id)
      ?.apiBuilders?.find((builder) => {
        return (args?.dbAlias || args?.args?.dbAlias) === builder.getDbAlias();
      });
  }

  protected getDbAlias(args): string {
    return (
      args?.dbAlias ||
      args?.args?.dbAlias ||
      args?.base_id ||
      args?.args?.base_id
    );
  }

  protected isProjectRest() {
    return this.config.projectType.toLowerCase() === 'rest';
  }

  protected isProjectGrpc() {
    return this.config.projectType.toLowerCase() === 'grpc';
  }

  protected isProjectGraphql() {
    return this.config.projectType.toLowerCase() === 'graphql';
  }

  protected getRouteVersionLetter(args): string | void {
    const dbs = this.config.envs[args.env][this.getDbAlias(args)];
    for (let index = 0; index < dbs.length; index++) {
      const db = dbs[index];
      if (db.meta.dbAlias === args.dbAlias) {
        if (db.meta && db.meta.api && db.meta.api.prefix) {
          return db.meta.api.prefix;
        }
        return this.genVer(index);
      }
    }
  }

  protected genVer(i): string {
    const l = 'vwxyzabcdefghijklmnopqrstu';
    return (
      i
        .toString(26)
        .split('')
        .map((v) => l[parseInt(v, 26)])
        .join('') + '1'
    );
  }

  protected async xcVirtualRelationCreate(args: any, req): Promise<any> {
    const dbAlias = this.getDbAlias(args);
    const projectId = this.getProjectId(args);

    const res = await this.xcMeta.metaInsert(
      projectId,
      dbAlias,
      'nc_relations',
      {
        tn: args.args.childTable,
        cn: args.args.childColumn,
        rtn: args.args.parentTable,
        rcn: args.args.parentColumn,
        type: 'virtual',
        db_type: this.getDbClientType(args.project_id, dbAlias),
        dr: '',
        ur: '',
      }
    );

    this.app.ncMeta.audit(projectId, dbAlias, 'nc_audit', {
      op_type: 'VIRTUAL_RELATION',
      op_sub_type: 'CREATED',
      user: req.user.email,
      description: `created virtual relation between tables ${args.args.childTable} and ${args.args.parentTable} `,
      ip: req.clientIp,
    });

    return res;
  }

  // todo: transaction
  protected async xcM2MRelationCreate(args: any, req): Promise<any> {
    const dbAlias = this.getDbAlias(args);
    const projectId = this.getProjectId(args);

    try {
      const parent = await this.xcMeta.metaGet(
        projectId,
        dbAlias,
        'nc_models',
        {
          title: args.args.parentTable,
        }
      );
      const child = await this.xcMeta.metaGet(projectId, dbAlias, 'nc_models', {
        title: args.args.childTable,
      });
      const parentMeta = JSON.parse(parent.meta);
      const childMeta = JSON.parse(child.meta);

      const parentPK = parentMeta.columns.find((c) => c.pk);
      const childPK = childMeta.columns.find((c) => c.pk);

      const associateTableCols = [];

      const parentCn = 'table1_id';
      const childCn = 'table2_id';

      associateTableCols.push(
        {
          cn: childCn,
          _cn: childCn,
          rqd: true,
          pk: true,
          ai: false,
          cdf: null,
          dt: childPK.dt,
          dtxp: childPK.dtxp,
          dtxs: childPK.dtxs,
          un: childPK.un,
          altered: 1,
        },
        {
          cn: parentCn,
          _cn: parentCn,
          rqd: true,
          pk: true,
          ai: false,
          cdf: null,
          dt: parentPK.dt,
          dtxp: parentPK.dtxp,
          dtxs: parentPK.dtxs,
          un: parentPK.un,
          altered: 1,
        }
      );

      // todo: associative table naming
      const aTn = `${
        this.projectConfigs[projectId]?.prefix ?? ''
      }_nc_m2m_${randomID()}`;
      const aTnAlias = `m2m${parentMeta._tn}_${childMeta._tn}`;

      const out = await this.projectMgr
        .getSqlMgr({ id: projectId })
        .handleRequest('tableCreate', {
          ...args,
          args: {
            tn: aTn,
            _tn: aTnAlias,
            columns: associateTableCols,
          },
        });

      if (this.listener) {
        await this.listener({
          req: {
            ...args,
            args: {
              tn: aTn,
              _tn: aTnAlias,
              columns: associateTableCols,
            },
            api: 'tableCreate',
          },
          res: out,
          user: req.user,
          ctx: {
            req,
          },
        });
      }

      const rel1Args = {
        ...args.args,
        childTable: aTn,
        childColumn: parentCn,
        parentTable: parentMeta.tn,
        parentColumn: parentPK.cn,
        type: 'real',
      };
      const rel2Args = {
        ...args.args,
        childTable: aTn,
        childColumn: childCn,
        parentTable: childMeta.tn,
        parentColumn: childPK.cn,
        type: 'real',
      };
      if (args.args.type === 'real') {
        const outrel = await this.projectMgr
          .getSqlMgr({ id: projectId })
          .handleRequest('relationCreate', {
            ...args,
            args: rel1Args,
          });
        if (this.listener) {
          await this.listener({
            req: {
              ...args,
              args: rel1Args,
              api: 'relationCreate',
            },
            res: outrel,
            user: req.user,
            ctx: {
              req,
            },
          });
        }
        const outrel1 = await this.projectMgr
          .getSqlMgr({ id: projectId })
          .handleRequest('relationCreate', {
            ...args,
            args: rel2Args,
          });
        if (this.listener) {
          await this.listener({
            req: {
              ...args,
              args: rel2Args,
              api: 'relationCreate',
            },
            res: outrel1,
            user: req.user,
            ctx: {
              req,
            },
          });
        }
      } else {
        const outrel = await this.xcVirtualRelationCreate(
          { ...args, args: rel1Args },
          req
        );
        if (this.listener) {
          await this.listener({
            req: {
              ...args,
              args: rel1Args,
              api: 'xcVirtualRelationCreate',
            },
            res: outrel,
            user: req.user,
            ctx: {
              req,
            },
          });
        }
        const outrel1 = await this.xcVirtualRelationCreate(
          { ...args, args: rel2Args },
          req
        );
        await this.listener({
          req: {
            ...args,
            args: rel2Args,
            api: 'xcVirtualRelationCreate',
          },
          res: outrel1,
          user: req.user,
          ctx: {
            req,
          },
        });
      }
    } catch (e) {
      console.log(e.message);
    }
  }

  // todo : transaction in sql client
  protected async xcRelationColumnDelete(
    args: any,
    req,
    deleteColumn = true
  ): Promise<any> {
    // this.xcMeta.startTransaction();
    // try {
    const dbAlias = this.getDbAlias(args);
    const projectId = this.getProjectId(args);

    // const parent = await this.xcMeta.metaGet(projectId, dbAlias, 'nc_models', {
    //   title: args.args.parentTable
    // });
    // // @ts-ignore
    // const parentMeta = JSON.parse(parent.meta);
    // @ts-ignore
    // todo: compare column
    switch (args.args.type) {
      case 'bt':
      case 'hm':
        {
          const child = await this.xcMeta.metaGet(
            projectId,
            dbAlias,
            'nc_models',
            {
              title: args.args.childTable,
            }
          );
          const childMeta = JSON.parse(child.meta);
          const relation = childMeta.belongsTo.find(
            (bt) => bt.rtn === args.args.parentTable
          );
          // todo: virtual relation delete
          if (relation) {
            const opArgs = {
              ...args,
              args: {
                childColumn: relation.cn,
                childTable: relation.tn,
                parentTable: relation.rtn,
                parentColumn: relation.rcn,
                foreignKeyName: relation.fkn,
              },
              api: 'relationDelete',
              sqlOpPlus: true,
            };
            let out;
            if (relation?.type === 'virtual') {
              opArgs.api = 'xcVirtualRelationDelete';
              out = await this.xcVirtualRelationDelete(opArgs, req);
            } else {
              out = await this.projectMgr
                .getSqlMgr({ id: projectId })
                .handleRequest('relationDelete', opArgs);
            }
            if (this.listener) {
              await this.listener({
                req: opArgs,
                res: out,
                user: req.user,
                ctx: { req },
              });
            }
          }
          if (deleteColumn) {
            const originalColumns = childMeta.columns;
            const columns = childMeta.columns.map((c) => ({
              ...c,
              ...(relation.cn === c.cn
                ? {
                    altered: 4,
                    cno: c.cn,
                  }
                : { cno: c.cn }),
            }));
            const opArgs = {
              ...args,
              args: {
                columns,
                originalColumns,
                tn: childMeta.tn,
              },
              sqlOpPlus: true,
              api: 'tableUpdate',
            };
            const out = await this.projectMgr
              .getSqlMgr({ id: projectId })
              .handleRequest('tableUpdate', opArgs);

            if (this.listener) {
              await this.listener({
                req: opArgs,
                res: out,
                user: req.user,
                ctx: { req },
              });
            }
          }
        }
        break;
      case 'mm':
        {
          const assoc = await this.xcMeta.metaGet(
            projectId,
            dbAlias,
            'nc_models',
            {
              title: args.args.assocTable,
            }
          );
          const assocMeta = JSON.parse(assoc.meta);
          const rel1 = assocMeta.belongsTo.find(
            (bt) => bt.rtn === args.args.parentTable
          );
          const rel2 = assocMeta.belongsTo.find(
            (bt) => bt.rtn === args.args.childTable
          );
          if (rel1) {
            await this.xcRelationColumnDelete(
              {
                ...args,
                args: {
                  parentTable: rel1.rtn,
                  parentColumn: rel1.rcn,
                  childTable: rel1.tn,
                  childColumn: rel1.cn,
                  foreignKeyName: rel1.fkn,
                  type: 'bt',
                },
              },
              req,
              false
            );
          }
          if (rel2) {
            await this.xcRelationColumnDelete(
              {
                ...args,
                args: {
                  parentTable: rel2.rtn,
                  parentColumn: rel2.rcn,
                  childTable: rel2.tn,
                  childColumn: rel2.cn,
                  foreignKeyName: rel2.fkn,
                  type: 'bt',
                },
              },
              req,
              false
            );
          }

          // ignore deleting table if it have more than 2 columns
          if (assocMeta.columns.length === 2) {
            const opArgs = {
              ...args,
              args: assocMeta,
              api: 'tableDelete',
              sqlOpPlus: true,
            };

            const out = await this.projectMgr
              .getSqlMgr({ id: projectId })
              .handleRequest('tableDelete', opArgs);

            if (this.listener) {
              await this.listener({
                req: opArgs,
                res: out,
                user: req.user,
                ctx: { req },
              });
            }
          }
        }
        break;
    }
    //   this.xcMeta.commit()
    // } catch (e) {
    //   this.xcMeta.rollback(e)
    //   throw e;
    // }
  }

  protected async xcVirtualRelationDelete(args: any, req): Promise<any> {
    const dbAlias = this.getDbAlias(args);
    const projectId = this.getProjectId(args);

    const res = await this.xcMeta.metaDelete(
      projectId,
      dbAlias,
      'nc_relations',
      {
        tn: args.args.childTable,
        cn: args.args.childColumn,
        rtn: args.args.parentTable,
        rcn: args.args.parentColumn,
        type: 'virtual',
      }
    );

    this.app.ncMeta.audit(projectId, dbAlias, 'nc_audit', {
      op_type: 'VIRTUAL_RELATION',
      op_sub_type: 'DELETED',
      user: req.user.email,
      description: `deleted virtual relation between tables ${args.args.childTable} and ${args.args.parentTable} `,
      ip: req.clientIp,
    });

    return res;
  }

  protected async xcRelationList(args: any): Promise<any> {
    const dbAlias = this.getDbAlias(args);
    // const sqlClient = this.getSqlClient(args.project_id, dbAlias);
    // console.time('relationList')
    // const relations = (await sqlClient.relationList(args.args))?.data?.list;
    // console.timeEnd('relationList')
    // console.time('virtualRelationList')
    const virtualRelation = await this.xcMeta.metaList(
      args.project_id,
      dbAlias,
      'nc_relations',
      {
        condition: {
          // type: 'virtual',
          tn: args.args.tn,
        },
      }
    );
    return virtualRelation;
    // console.timeEnd('virtualRelationList')

    // const mergedRelation = [...relations, ...virtualRelation];
    //
    // return mergedRelation;
  }

  protected getDbClientType(project_id: string, dbAlias: string) {
    const config = this.app?.projectBuilders?.find(
      (pb) => pb?.id === project_id
    )?.config;
    return config?.envs?.[this.config?.workingEnv || '_noco']?.db?.find(
      (db) => db?.meta?.dbAlias === dbAlias
    )?.client;
  }

  protected getDbAliasList(project_id: string): string[] {
    return this.projectConfigs?.[project_id]?.envs?.[
      this.config?.workingEnv || '_noco'
    ]?.db?.map((db) => db?.meta?.dbAlias);
  }

  // @ts-ignore
  protected getSqlClient(project_id: string, dbAlias: string) {
    return this.app?.projectBuilders
      ?.find((pb) => pb?.id === project_id)
      ?.apiBuilders?.find((builder) => builder.dbAlias === dbAlias)
      ?.getSqlClient();
  }

  protected async createSharedViewLink(req, args: any): Promise<any> {
    try {
      // if (args.args.query_params?.fields) {
      //   const fields = args.args.query_params?.fields.split(',');
      //   args.args.meta.columns = args.args.meta.columns.filter(c =>
      //     fields.includes(c._cn)
      //   );
      // }

      const insertData = {
        project_id: args.project_id,
        db_alias: this.getDbAlias(args),
        model_name: args.args.model_name,
        // meta: JSON.stringify(args.args.meta),
        query_params: JSON.stringify(args.args.query_params),
        view_id: uuidv4(),
        // password: args.args.password
      };

      await this.xcMeta.metaInsert(
        args.project_id,
        this.getDbAlias(args),
        'nc_shared_views',
        insertData
      );
      const res = await this.xcMeta.metaGet(
        this.getProjectId(args),
        this.getDbAlias(args),
        'nc_shared_views',
        insertData,
        ['id', 'view_id', 'view_type']
      );
      res.url = `${req.ncSiteUrl}${this.config.dashboardPath}#/nc/view/${res.view_id}`;
      Tele.emit('evt', { evt_type: 'sharedView:generated-link' });
      return res;
    } catch (e) {
      console.log(e);
    }
  }

  protected async createSharedBaseLink(req, args: any): Promise<any> {
    try {
      let sharedBase = await this.xcMeta.metaGet(
        this.getProjectId(args),
        this.getDbAlias(args),
        'nc_shared_bases',
        {
          project_id: this.getProjectId(args),
        }
      );

      let roles = args?.args?.roles;
      if (!roles || (roles !== 'editor' && roles !== 'viewer')) {
        roles = 'viewer';
      }

      if (!sharedBase) {
        const insertData = {
          project_id: args.project_id,
          db_alias: this.getDbAlias(args),
          shared_base_id: uuidv4(),
          password: args?.args?.password,
          roles,
        };

        await this.xcMeta.metaInsert(
          args.project_id,
          this.getDbAlias(args),
          'nc_shared_bases',
          insertData
        );
        sharedBase = await this.xcMeta.metaGet(
          this.getProjectId(args),
          this.getDbAlias(args),
          'nc_shared_bases',
          {},
          ['id', 'shared_base_id', 'enabled', 'roles']
        );
      } else {
        const cacheKey = `nc_shared_bases||${sharedBase.shared_base_id}`;

        XcCache.del(cacheKey);

        await this.xcMeta.metaUpdate(
          this.getProjectId(args),
          this.getDbAlias(args),
          'nc_shared_bases',
          { roles },
          {
            project_id: this.getProjectId(args),
          }
        );
        sharedBase.roles = roles;
      }

      sharedBase.url = `${req.ncSiteUrl}${this.config.dashboardPath}#/nc/base/${sharedBase.shared_base_id}`;

      Tele.emit('evt', { evt_type: 'sharedBase:generated-link' });
      return sharedBase;
    } catch (e) {
      console.log(e);
    }
  }

  protected async disableSharedBaseLink(_req, args: any): Promise<any> {
    try {
      const sharedBase = await this.xcMeta.metaGet(
        this.getProjectId(args),
        this.getDbAlias(args),
        'nc_shared_bases',
        {
          project_id: this.getProjectId(args),
        }
      );
      if (!sharedBase) return;
      XcCache.del(`nc_shared_bases||${sharedBase.shared_base_id}`);
      await this.xcMeta.metaDelete(
        this.getProjectId(args),
        this.getDbAlias(args),
        'nc_shared_bases',
        {
          project_id: this.getProjectId(args),
        }
      );
    } catch (e) {
      console.log(e);
    }
  }

  protected async getSharedBaseLink(req, args: any): Promise<any> {
    try {
      const sharedBase = await this.xcMeta.metaGet(
        this.getProjectId(args),
        this.getDbAlias(args),
        'nc_shared_bases',
        {
          project_id: this.getProjectId(args),
        }
      );
      if (sharedBase)
        sharedBase.url = `${req.ncSiteUrl}${this.config.dashboardPath}#/nc/base/${sharedBase.shared_base_id}`;

      return sharedBase;
    } catch (e) {
      console.log(e);
    }
  }

  protected async updateSharedViewLinkPassword(_args: any): Promise<any> {
    // try {
    //
    //   await this.xcMeta.metaUpdate(this.getProjectId(args), this.getDbAlias(args), 'nc_shared_views', {
    //     password: args.args?.password
    //   }, args.args.id);
    //   Tele.emit('evt', {evt_type: 'sharedView:password-updated'})
    //   return {msg: 'Success'};
    // } catch (e) {
    //   console.log(e)
    // }

    throw new XCEeError('Upgrade to Enterprise Edition');
  }

  protected async deleteSharedViewLink(args: any): Promise<any> {
    try {
      await this.xcMeta.metaDelete(
        this.getProjectId(args),
        this.getDbAlias(args),
        'nc_shared_views',
        args.args.id
      );
      Tele.emit('evt', { evt_type: 'sharedView:deleted' });
      return { msg: 'Success' };
    } catch (e) {
      console.log(e);
    }
  }

  protected async displaySharedViewLink(args: any): Promise<any> {
    return this.xcMeta.metaGet(
      args.project_id,
      this.getDbAlias(args),
      'nc_shared_views',
      {
        view_id: {
          _eq: args.args.view_id,
        },
      }
    );
  }

  protected async listSharedViewLinks(args: any): Promise<any> {
    return this.xcMeta.metaList(
      args.project_id,
      this.getDbAlias(args),
      'nc_shared_views',
      {
        condition: {
          model_name: args.args.model_name,
        },
        fields: [
          'id',
          'view_id',
          'password',
          'model_name',
          'view_type',
          'view_name',
        ],
      }
    );
  }

  protected async getSharedViewData(req, args: any): Promise<any> {
    try {
      const sharedViewMeta = await this.xcMeta
        .knex('nc_shared_views')
        .where({
          view_id: args.args.view_id,
        })
        .first();

      if (!sharedViewMeta) {
        throw new Error('Meta not found');
      }

      const viewMeta = await this.xcMeta.metaGet(
        sharedViewMeta.project_id,
        sharedViewMeta.base_id,
        'nc_models',
        {
          title: sharedViewMeta.view_name,
        }
      );

      // if (viewMeta && viewMeta.password && viewMeta.password !== args.args.password) {
      //   throw new Error('Invalid password')
      // }

      if (
        sharedViewMeta &&
        sharedViewMeta.password &&
        sharedViewMeta.password !== args.args.password
      ) {
        throw new Error(this.INVALID_PASSWORD_ERROR);
      }

      const apiBuilder = this.app?.projectBuilders
        ?.find((pb) => pb.id === sharedViewMeta.project_id)
        ?.apiBuilders?.find((ab) => ab.dbAlias === sharedViewMeta.base_id);
      const model = apiBuilder?.xcModels?.[sharedViewMeta.model_name];

      if (model) {
        const queryParams = JSON.parse(viewMeta.query_params);
        let where = '';

        if (req.query.where) {
          where += req.query.where;
        }

        if (queryParams.where) {
          where += where ? `~and(${queryParams.where})` : queryParams.where;
        }

        const fields = queryParams?.fields || '*';

        return {
          model_name: sharedViewMeta.model_name,
          meta: apiBuilder?.getMeta(sharedViewMeta.model_name), //JSON.parse(viewMeta.meta),
          data: await model.list({
            ...req.query,
            where,
            fields,
          }),
          ...(await model.countByPk({
            ...req.query,
            where,
            fields,
          })),
          client: apiBuilder?.client,
        };
      }
    } catch (e) {
      throw e;
    }
  }

  protected async sharedViewNestedDataGet(_req, args: any): Promise<any> {
    try {
      const sharedViewMeta = await this.xcMeta
        .knex('nc_shared_views')
        .where({
          view_id: args.args.view_id,
        })
        .first();

      if (!sharedViewMeta) {
        throw new Error('Meta not found');
      }

      const viewMeta = await this.xcMeta.metaGet(
        sharedViewMeta.project_id,
        sharedViewMeta.base_id,
        'nc_models',
        {
          title: sharedViewMeta.view_name,
        }
      );

      if (!viewMeta) {
        throw new Error('Not found');
      }

      if (
        sharedViewMeta &&
        sharedViewMeta.password &&
        sharedViewMeta.password !== args.args.password
      ) {
        throw new Error(this.INVALID_PASSWORD_ERROR);
      }

      const tn = args.args?.tn;

      // @ts-ignore
      // const queryParams = JSON.parse(viewMeta.query_params);

      const apiBuilder = this.app?.projectBuilders
        ?.find((pb) => pb.id === sharedViewMeta.project_id)
        ?.apiBuilders?.find((ab) => ab.dbAlias === sharedViewMeta.base_id);

      // todo: only allow related table
      // if(tn &&){
      //
      // }

      const model = apiBuilder.xcModels?.[tn];

      const primaryCol = apiBuilder
        ?.getMeta(tn)
        ?.columns?.find((c) => c.pv)?.cn;

      const commonParams =
        primaryCol && args.args.query
          ? {
              condition: {
                [primaryCol]: {
                  like: `%${args.args.query}%`,
                },
              },
            }
          : {};

      return {
        list: await model?.list({
          fields: model.getTablePKandPVFields(),
          limit: args.args.limit,
          offset: args.args.offset,
          ...commonParams,
        }),
        count: (await model?.countByPk(commonParams as any))?.count,
      };
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  protected async sharedViewNestedChildDataGet(_req, args: any): Promise<any> {
    try {
      // todo: replace with join query

      const sharedViewMeta = await this.xcMeta
        .knex('nc_shared_views')
        .where({
          view_id: args.args.view_id,
        })
        .first();

      if (!sharedViewMeta) {
        throw new Error('Meta not found');
      }

      const viewMeta = await this.xcMeta.metaGet(
        sharedViewMeta.project_id,
        sharedViewMeta.base_id,
        'nc_models',
        {
          title: sharedViewMeta.view_name,
        }
      );

      if (!viewMeta) {
        throw new Error('Not found');
      }

      if (
        sharedViewMeta &&
        sharedViewMeta.password &&
        sharedViewMeta.password !== args.args.password
      ) {
        throw new Error(this.INVALID_PASSWORD_ERROR);
      }

      const tn = args.args?.ctn;
      const ptn = args.args?.ptn;

      if (!tn || !ptn) {
        throw new Error('Parent/Child not found');
      }

      // @ts-ignore
      // const queryParams = JSON.parse(viewMeta.query_params);

      const apiBuilder = this.app?.projectBuilders
        ?.find((pb) => pb.id === sharedViewMeta.project_id)
        ?.apiBuilders?.find((ab) => ab.dbAlias === sharedViewMeta.base_id);

      const model = apiBuilder.xcModels?.[tn];
      const parentMeta = apiBuilder.getMeta(ptn);
      // const meta = apiBuilder.getMeta(tn);

      const primaryCol = apiBuilder
        ?.getMeta(tn)
        ?.columns?.find((c) => c.pv)?.cn;

      const commonParams: any =
        primaryCol && args.args.query
          ? {
              condition: {
                [primaryCol]: {
                  like: `%${args.args.query}%`,
                },
              },
            }
          : {};

      switch (args.args?.type) {
        case 'mm':
          {
            const mm = parentMeta.v.find(
              (v) => v.mm && v._cn === args.args._cn
            )?.mm;
            const assocMeta = apiBuilder.getMeta(mm.vtn);

            commonParams.conditionGraph = {
              condition: {
                [assocMeta.tn]: {
                  relationType: 'hm',
                  [assocMeta.columns.find((c) => c.cn === mm.vcn).cn]: {
                    eq: args.args.row_id,
                  },
                },
              },
              models: apiBuilder?.xcModels,
            };
          }
          break;
        case 'hm':
          {
            const hm = parentMeta.v.find(
              (v) => v.hm && v._cn === args.args._cn
            )?.hm;
            // const childMeta = apiBuilder.getMeta(hm.rtn);
            commonParams.condition = {
              [hm.rcn]: {
                eq: args.args.row_id,
              },
            };
          }
          break;
      }

      return {
        list: await model?.list({
          fields: model.getTablePKandPVFields(),
          limit: args.args.limit,
          offset: args.args.offset,
          ...commonParams,
        }),
        count: (await model?.countByPk(commonParams as any))?.count,
      };
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  protected async sharedViewInsert(req, args: any): Promise<any> {
    const sharedViewMeta = await this.xcMeta
      .knex('nc_shared_views')
      .where({
        view_id: args.args.view_id,
      })
      .first();

    if (!sharedViewMeta) {
      throw new Error('Meta not found');
    }

    const viewMeta = await this.xcMeta.metaGet(
      sharedViewMeta.project_id,
      sharedViewMeta.base_id,
      'nc_models',
      {
        title: sharedViewMeta.view_name,
      }
    );
    if (!viewMeta) {
      throw new Error('Not found');
    }

    if (
      sharedViewMeta &&
      sharedViewMeta.password &&
      sharedViewMeta.password !== args.args.password
    ) {
      throw new Error(this.INVALID_PASSWORD_ERROR);
    }

    const queryParams = JSON.parse(viewMeta.query_params);
    // const meta = JSON.parse(viewMeta.meta);

    const fields: string[] = Object.keys(queryParams.showFields).filter(
      (k) => queryParams.showFields[k]
    );

    const apiBuilder = this.app?.projectBuilders
      ?.find((pb) => pb.id === sharedViewMeta.project_id)
      ?.apiBuilders?.find((ab) => ab.dbAlias === sharedViewMeta.base_id);

    const tableMeta = (viewMeta.meta = apiBuilder?.getMeta(
      sharedViewMeta.model_name
    ));

    const insertObject = Object.entries(args.args.data).reduce(
      (obj, [key, val]) => {
        if (fields.includes(key)) {
          obj[key] = val;
        }
        return obj;
      },
      {}
    );

    for (const [key, obj] of Object.entries(args.args.nested)) {
      if (fields.includes(key)) {
        insertObject[key] = obj;
      }
    }

    const attachments = {};
    for (const file of req.files || []) {
      if (
        fields.includes(file?.fieldname) &&
        tableMeta.columns.find(
          (c) => c._cn === file?.fieldname && c.uidt === UITypes.Attachment
        )
      ) {
        attachments[file.fieldname] = attachments[file.fieldname] || [];
        attachments[file.fieldname].push(
          await this._uploadFile({
            file,
            storeInPublicFolder: true,
            req,
          })
        );
      }
    }

    for (const [column, data] of Object.entries(attachments)) {
      insertObject[column] = JSON.stringify(data);
    }

    const model = apiBuilder?.xcModels?.[sharedViewMeta.model_name];

    if (model) {
      req.query.form = viewMeta.view_name;
      await model.nestedInsert(insertObject, null, req);
    }
  }

  protected async sharedViewGet(_req, args: any): Promise<any> {
    const sharedViewMeta = await this.xcMeta
      .knex('nc_shared_views')
      .where({
        view_id: args.args.view_id,
      })
      .first();

    if (!sharedViewMeta) {
      throw new Error('Meta not found');
    }

    const viewMeta = await this.xcMeta.metaGet(
      sharedViewMeta.project_id,
      sharedViewMeta.base_id,
      'nc_models',
      {
        title: sharedViewMeta.view_name,
      }
    );

    if (!viewMeta) {
      throw new Error('Not found');
    }

    if (
      sharedViewMeta &&
      sharedViewMeta.password &&
      sharedViewMeta.password !== args.args.password
    ) {
      throw new Error(this.INVALID_PASSWORD_ERROR);
    }

    // todo : filter out columns of related table
    try {
      const apiBuilder = this.app?.projectBuilders
        ?.find((pb) => pb.id === sharedViewMeta.project_id)
        ?.apiBuilders?.find((ab) => ab.dbAlias === sharedViewMeta.base_id);

      const tableMeta = (viewMeta.meta = apiBuilder?.getMeta(
        sharedViewMeta.model_name
      ));

      const relatedTableMetas = {};

      for (const v of tableMeta.v) {
        let tn;
        if (v.bt) {
          tn = v.bt.rtn;
        } else if (v.hm) {
          tn = v.hm.tn;
        } else if (v.mm) {
          tn = v.mm.rtn;
          relatedTableMetas[v.mm.vtn] = apiBuilder?.getMeta(v.mm.vtn);
        } else if (v.lk) {
          tn = v.lk.ltn;
          if (v.lk.vtn)
            relatedTableMetas[v.lk.vtn] = apiBuilder?.getMeta(v.lk.vtn);
        }
        relatedTableMetas[tn] = apiBuilder?.getMeta(tn);
      }

      viewMeta.client = apiBuilder?.client;

      viewMeta.relatedTableMetas = relatedTableMetas;
    } catch (e) {
      console.log(e);
    }
    viewMeta.query_params = JSON.parse(viewMeta.query_params) || {};

    viewMeta.meta = {
      ...viewMeta.meta,
      columns: viewMeta.meta.columns.filter(
        (c) =>
          !viewMeta.query_params?.showFields ||
          viewMeta.query_params?.showFields?.[c._cn] ||
          c.pk ||
          viewMeta.meta.v?.some((v) => v.bt?.cn === c.cn)
      ),

      v: viewMeta.meta.v?.filter(
        (c) => viewMeta.query_params?.showFields?.[c._cn]
      ),
    };

    return { ...sharedViewMeta, ...viewMeta };
  }

  protected async sharedBaseGet(_req, args: any): Promise<any> {
    const sharedBaseMeta = await this.xcMeta
      .knex('nc_shared_bases')
      .select('project_id')
      .where({
        shared_base_id: args.args.shared_base_id,
        enabled: true,
      })
      .first();

    if (!sharedBaseMeta) {
      throw new Error('Meta not found');
    }

    return sharedBaseMeta;
  }

  protected async sharedViewExportAsCsv(_req, args: any, res): Promise<any> {
    const sharedViewMeta = await this.xcMeta
      .knex('nc_shared_views')
      .where({
        view_id: args.args.view_id,
      })
      .first();

    if (!sharedViewMeta) {
      throw new Error('Meta not found');
    }

    const viewMeta = await this.xcMeta.metaGet(
      sharedViewMeta.project_id,
      sharedViewMeta.base_id,
      'nc_models',
      {
        title: sharedViewMeta.view_name,
      }
    );

    if (!viewMeta) {
      throw new Error('Not found');
    }

    if (
      sharedViewMeta &&
      sharedViewMeta.password &&
      sharedViewMeta.password !== args.args.password
    ) {
      throw new Error(this.INVALID_PASSWORD_ERROR);
    }

    return this.xcExportAsCsv(
      {
        shared: true,
        ...sharedViewMeta,
        args: { ...args.args, ...sharedViewMeta },
      },
      _req,
      res
    );
  }

  protected async xcAuthHookGet(args: any): Promise<any> {
    try {
      return await this.xcMeta.metaGet(args.project_id, 'db', 'nc_hooks', {
        type: 'AUTH_MIDDLEWARE',
      });
    } catch (e) {
      console.log(e);
    }
  }

  protected async xcAuthHookSet(args: any): Promise<any> {
    // todo: add all params
    if (
      await this.xcMeta.metaGet(args.project_id, 'db', 'nc_hooks', {
        type: 'AUTH_MIDDLEWARE',
      })
    ) {
      return this.xcMeta.metaUpdate(
        args.project_id,
        'db',
        'nc_hooks',
        {
          url: args.args.url,
        },
        {
          type: 'AUTH_MIDDLEWARE',
        }
      );
    }

    return this.xcMeta.metaInsert(args.project_id, 'db', 'nc_hooks', {
      url: args.args.url,
      type: 'AUTH_MIDDLEWARE',
    });
  }

  protected async xcTableList(_req, args): Promise<any> {
    // const roles = req.session?.passport?.user?.roles;

    const tables = await this.xcVisibilityMetaGet({
      ...args,
      args: { type: 'table', ...args.args },
    });
    // if (this.isEe) {
    //   tables = tables.filter((table: any) => {
    //     return Object.keys(roles).some(role => roles[role] && !table.disabled[role])
    //   });
    // }

    return { data: { list: tables } };
  }

  protected async xcColumnList(args): Promise<any> {
    try {
      const modelMeta = await this.xcMeta.metaGet(
        this.getProjectId(args),
        this.getDbAlias(args),
        'nc_models',
        {
          title: args.args.tn,
          type: 'table',
        }
      );

      if (modelMeta) {
        const columns = JSON.parse(modelMeta.meta).columns;
        for (const column of columns) {
          // todo:
          column.tn = args.args.tn;
          column.cno = column.cn;
        }
        return { data: { list: columns } };
      }

      return this.projectGetSqlClient(args).columnList(args.args);
    } catch (e) {
      throw e;
    }
  }

  protected async xcFunctionList(req, args): Promise<any> {
    const roles = req.session?.passport?.user?.roles;

    const functions = (
      await this.xcVisibilityMetaGet({ ...args, args: { type: 'function' } })
    ).filter((functionObj: any) => {
      return Object.keys(roles).some(
        (role) => roles[role] && !functionObj.disabled[role]
      );
    });

    return { data: { list: functions } };
  }

  protected async xcViewList(req, args): Promise<any> {
    const roles = req.session?.passport?.user?.roles;

    const views = (
      await this.xcVisibilityMetaGet({
        ...args,
        args: { type: 'view', ...args.args },
      })
    ).filter((view: any) => {
      return Object.keys(roles).some(
        (role) => roles[role] && !view.disabled[role]
      );
    });

    return { data: { list: views } };
  }

  protected async xcProcedureList(req, args): Promise<any> {
    const roles = req.session?.passport?.user?.roles;

    const procedures = (
      await this.xcVisibilityMetaGet({ ...args, args: { type: 'procedure' } })
    ).filter((procedure: any) => {
      return Object.keys(roles).some(
        (role) => roles[role] && !procedure.disabled[role]
      );
    });

    return { data: { list: procedures } };
  }

  // todo: transaction
  protected async xcModelsCreateFromTemplate(args, req) {
    const template = args.args.template;

    const projectId = this.getProjectId(args);
    const dbAlias = this.getDbAlias(args);

    const projectConfig = this.projectConfigs[projectId];
    const connectionConfig = projectConfig.envs?.['_noco']?.db?.find(
      (d) => d?.meta?.dbAlias === dbAlias
    );

    const result = { tables: [], relations: [] };

    const apiBuilder = this.app?.projectBuilders
      ?.find((pb) => pb.id === projectId)
      ?.apiBuilders?.find((ab) => ab.dbAlias === dbAlias);

    const parser = new NcTemplateParser({
      client: connectionConfig?.client,
      template,
      prefix: projectConfig?.prefix,
    });
    parser.parse();

    const existingTables = parser.tables.filter((t) =>
      apiBuilder.getMeta(t.tn)
    );

    if (existingTables?.length) {
      throw new Error(
        `Import unsuccessful : following tables '${existingTables
          .map((t) => t._tn)
          .join(', ')}' already exists`
      );
    }

    for (const table of parser.tables) {
      console.log(table);
      // create table and trigger listener
      const out = await this.projectMgr
        .getSqlMgr({ id: projectId })
        .handleRequest('tableCreate', {
          ...args,
          args: table,
        });

      if (this.listener) {
        await this.listener({
          req: {
            ...args,
            args: table,
            api: 'tableCreate',
          },
          res: out,
          user: req.user,
          ctx: {
            req,
          },
        });
      }

      result.tables.push({ tn: table.tn, _tn: table._tn });
    }

    // create relations

    for (const relation of parser.relations) {
      if (relation.type === 'real') {
        const outrel = await this.projectMgr
          .getSqlMgr({ id: projectId })
          .handleRequest('relationCreate', {
            ...args,
            args: relation,
          });
        if (this.listener) {
          await this.listener({
            req: {
              ...args,
              args: relation,
              api: 'relationCreate',
            },
            res: outrel,
            user: req.user,
            ctx: {
              req,
            },
          });
        }
      } else {
        const outrel = await this.xcVirtualRelationCreate(
          { ...args, args: relation },
          req
        );
        if (this.listener) {
          await this.listener({
            req: {
              ...args,
              args: relation,
              api: 'xcVirtualRelationCreate',
            },
            res: outrel,
            user: req.user,
            ctx: {
              req,
            },
          });
        }
      }
      result.relations.push({});
    }

    //create m2m relations

    for (const m2mRelation of parser.m2mRelations) {
      // if (args.args.type === 'real') {
      const outrel = await this.xcM2MRelationCreate(
        {
          ...args,
          args: m2mRelation,
        },
        req
      );
      if (this.listener) {
        await this.listener({
          req: {
            ...args,
            args: m2mRelation,
            api: 'xcM2MRelationCreate',
          },
          res: outrel,
          user: req.user,
          ctx: {
            req,
          },
        });
      }

      result.relations.push({ mm: true });
    }

    // add virtual columns
    for (const [tn, vColumns] of Object.entries(parser.virtualColumns)) {
      const meta = apiBuilder.getMeta(tn);
      meta.v = meta.v || [];
      meta.v.push(...vColumns);

      const res = await this.xcModelSet({
        ...args,
        args: {
          meta,
          tn,
        },
      });
      await this.listener({
        req: {
          ...args,
          args: {
            meta,
            tn,
          },
          api: 'tableXcModelGet',
        },
        res,
        user: req.user,
        ctx: {
          req,
        },
      });
    }

    Tele.emit('evt', { evt_type: 'template:imported' });

    return result;
  }

  protected async xcExportAsCsv(args, _req, res: express.Response) {
    const projectId = this.getProjectId(args);
    const dbAlias = this.getDbAlias(args);
    const apiBuilder = this.app?.projectBuilders
      ?.find((pb) => pb.id === projectId)
      ?.apiBuilders?.find((ab) => ab.dbAlias === dbAlias);

    const model = apiBuilder?.xcModels?.[args.args.model_name];

    const meta = apiBuilder?.getMeta(args.args.model_name);

    const selectedView = await this.xcMeta.metaGet(
      projectId,
      dbAlias,
      'nc_models',
      {
        title: args.args.view_name,
      }
    );

    const localQuery = args.args.localQuery;

    let queryParams: any = {};
    try {
      queryParams = JSON.parse(selectedView.query_params);
    } catch {}

    if (!args.shared) {
      queryParams = { ...queryParams, ...localQuery };
    }

    let sort = this.serializeSortParam(queryParams);

    let where = '';
    if (localQuery.sort) {
      sort = localQuery.sort;
    }

    if (localQuery.where) {
      where += localQuery.where;
    }

    const privateViewFilter = this.serializeToXwhere(queryParams?.filters);

    if (privateViewFilter) {
      where += where ? `~and(${privateViewFilter})` : privateViewFilter;
    }

    const csvData = await model.extractCsvData(
      {
        ...(args.args.query || {}),
        fields: meta.columns
          .filter(
            (c) => !queryParams?.showFields && queryParams?.showFields?.[c._cn]
          )
          .map((c) => c._cn)
          .join(','),
        sort,
        where,
        ...this.serializeNestedParams(meta, queryParams),
      },
      // filter only visible columns
      localQuery?.showFields || queryParams?.showFields
        ? Object.entries(
            localQuery?.showFields || queryParams?.showFields || {}
          )
            .filter((v) => v[1])
            .map((v) => v[0])
            .sort(
              (a, b) =>
                (queryParams?.fieldsOrder?.indexOf(a) + 1 || Infinity) -
                (queryParams?.fieldsOrder?.indexOf(b) + 1 || Infinity)
            )
        : undefined
    );

    return {
      cb: async () => {
        res.set({
          'Access-Control-Expose-Headers': 'nc-export-offset',
          'nc-export-offset': csvData.offset,
          'nc-export-elapsed-time': csvData.elapsed,
          'Content-Disposition': `attachment; filename="${encodeURI(
            args.args.model_name
          )}-export.csv"`,
        });
        res.send(csvData.data);
      },
    };
  }

  private serializeSortParam(queryParams: any, returnArray = false) {
    const sort = [];
    if (queryParams?.sortList) {
      sort.push(
        ...(queryParams.sortList
          ?.map((sort) => {
            return sort.field ? `${sort.order}${sort.field}` : '';
          })
          .filter(Boolean) || [])
      );
    }
    if (returnArray) return sort;
    return sort.join(',');
  }

  // @ts-ignore
  protected async xcVisibilityMetaGet(args) {
    try {
      const roles = (await this.xcMeta.metaList('', '', 'nc_roles'))
        .map((r) => r.title)
        .filter((role) => !['owner', 'guest', 'creator'].includes(role));

      const defaultDisabled = roles.reduce(
        (o, r) => ({ ...o, [r]: false }),
        {}
      );

      const sqlClient = this.projectGetSqlClient(args);

      switch (args.args.type) {
        case 'table':
          {
            let tables = await this.xcMeta.metaList(
              this.getProjectId(args),
              this.getDbAlias(args),
              'nc_models',
              {
                condition: {
                  type: 'table',
                  ...(args?.args?.includeM2M ? {} : { mm: null }),
                },
              }
            );

            if (args.args.force) {
              tables = (await sqlClient.tableList())?.data?.list?.map(
                (table) => {
                  return (
                    tables.find((mod) => mod.title === table.tn) ?? {
                      title: table.tn,
                      alias: table.tn,
                    }
                  );
                }
              );
              const config = this.projectConfigs[this.getProjectId(args)];
              tables = config?.prefix
                ? tables.filter((t) => {
                    t.alias = t.title.replace(config?.prefix, '');
                    return t.title.startsWith(config?.prefix);
                  })
                : tables;
            }

            const result = tables.reduce((obj, table) => {
              obj[table.title] = {
                tn: table.title,
                _tn: table.alias,
                order: table.order,
                disabled: { ...defaultDisabled },
              };
              return obj;
            }, {});

            const disabledList = await this.xcMeta.metaList(
              args.project_id,
              this.getDbAlias(args),
              'nc_disabled_models_for_role',
              {
                condition: {
                  type: 'table',
                },
              }
            );

            for (const d of disabledList) {
              result[d.title].disabled[d.role] = !!d.disabled;
            }

            return Object.values(result)?.sort(
              (a: any, b: any) =>
                (a.order || 0) - (b.order || 0) ||
                (a?._tn || a?.tn)?.localeCompare(b?._tn || b?.tn)
            );
          }
          break;
        case 'view':
          {
            // const views = (await sqlClient.viewList())?.data?.list;

            let views = await this.xcMeta.metaList(
              this.getProjectId(args),
              this.getDbAlias(args),
              'nc_models',
              {
                condition: {
                  type: 'view',
                },
              }
            );

            if (args.args.force) {
              views = (await sqlClient.viewList())?.data?.list?.map((view) => {
                return (
                  views.find((mod) => mod.title === view.view_name) ?? {
                    title: view.view_name,
                    alias: view.view_name,
                  }
                );
              });
              const config = this.projectConfigs[this.getProjectId(args)];
              views = config?.prefix
                ? views.filter((t) => {
                    t.alias = t.title.replace(config?.prefix, '');
                    return t.title.startsWith(config?.prefix);
                  })
                : views;
            }

            const result = views.reduce((obj, view) => {
              obj[view.view_name || view.title] = {
                view_name: view.title,
                _tn: view.alias,
                disabled: { ...defaultDisabled },
              };
              return obj;
            }, {});

            const disabledList = await this.xcMeta.metaList(
              args.project_id,
              this.getDbAlias(args),
              'nc_disabled_models_for_role',
              {
                condition: {
                  type: 'view',
                },
              }
            );

            for (const d of disabledList) {
              result[d.title].disabled[d.role] = d.disabled;
            }

            return Object.values(result);
          }

          break;
        case 'function':
          {
            const views = (await sqlClient.functionList())?.data?.list;

            const result = views.reduce((obj, view) => {
              obj[view.function_name] = {
                function_name: view.function_name,
                disabled: { ...defaultDisabled },
              };
              return obj;
            }, {});

            const disabledList = await this.xcMeta.metaList(
              args.project_id,
              this.getDbAlias(args),
              'nc_disabled_models_for_role',
              {
                condition: {
                  type: 'function',
                },
              }
            );

            for (const d of disabledList) {
              result[d.title].disabled[d.role] = d.disabled;
            }

            return Object.values(result);
          }

          break;
        case 'procedure':
          {
            const procedures = (await sqlClient.procedureList())?.data?.list;

            const result = procedures.reduce((obj, view) => {
              obj[view.procedure_name] = {
                procedure_name: view.procedure_name,
                disabled: { ...defaultDisabled },
              };
              return obj;
            }, {});

            const disabledList = await this.xcMeta.metaList(
              args.project_id,
              this.getDbAlias(args),
              'nc_disabled_models_for_role',
              {
                condition: {
                  type: 'procedure',
                },
              }
            );

            for (const d of disabledList) {
              result[d.title].disabled[d.role] = d.disabled;
            }

            return Object.values(result);
          }
          break;
        case 'relation':
          {
            const relations = await this.xcRelationsGet(args);

            const result = relations.reduce((obj, relation) => {
              obj[
                [
                  relation.tn,
                  relation.relationType,
                  relation.rtn,
                  relation.cn,
                  relation.rcn,
                ].join('||')
              ] = {
                ...relation,
                disabled: { ...defaultDisabled },
              };
              return obj;
            }, {});

            const disabledList = await this.xcMeta.metaList(
              args.project_id,
              this.getDbAlias(args),
              'nc_disabled_models_for_role',
              {
                condition: {
                  type: 'relation',
                },
              }
            );

            for (const d of disabledList) {
              const key = [d.tn, d.relation_type, d.rtn, d.cn, d.rcn].join(
                '||'
              );
              if (key in result) {
                result[key].disabled[d.role] = d.disabled;
              }
            }
            return Object.values(result);
          }
          break;

        case 'all':
          {
            const models = await this.xcMeta.metaList(
              this.getProjectId(args),
              this.getDbAlias(args),
              'nc_models',
              {
                condition: {
                  ...(args?.args?.includeM2M ? {} : { mm: null }),
                },
                xcCondition: {
                  _or: [
                    {
                      type: { eq: 'table' },
                    },
                    {
                      type: { eq: 'view' },
                    },
                    {
                      type: { eq: 'vtable' },
                    },
                  ],
                },
              }
            );

            const result = models.reduce((obj, table) => {
              obj[table.title] = {
                tn: table.title,
                _tn: table.alias || table.title,
                order: table.order,
                disabled: { ...defaultDisabled },
                type: table.type,
                show_as: table.show_as,
                ptn: table.parent_model_title,
              };
              return obj;
            }, {});

            const disabledList = await this.xcMeta.metaList(
              args.project_id,
              this.getDbAlias(args),
              'nc_disabled_models_for_role',
              {
                xcCondition: {
                  _or: [
                    {
                      type: { eq: 'table' },
                    },
                    {
                      type: { eq: 'view' },
                    },
                    {
                      type: { eq: 'vtable' },
                    },
                  ],
                },
              }
            );

            for (const d of disabledList) {
              if (
                !result[d.title].ptn ||
                result[d.title].ptn === d.parent_model_title
              )
                result[d.title].disabled[d.role] = !!d.disabled;
            }

            return Object.values(result)?.sort((a: any, b: any) =>
              (a?.parent_model_title || a?.tn)?.localeCompare(
                b?.parent_model_title || b?.tn
              )
            );
          }
          break;
        case 'table_view':
          {
            const models = await this.xcMeta.metaList(
              this.getProjectId(args),
              this.getDbAlias(args),
              'nc_models',
              {
                condition: {
                  ...(args?.args?.includeM2M ? {} : { mm: null }),
                },
                xcCondition: {
                  _or: [
                    {
                      type: { eq: 'table' },
                    },
                    {
                      type: { eq: 'view' },
                    },
                    {
                      type: { eq: 'vtable' },
                    },
                  ],
                },
                orderBy: {
                  order: 'asc',
                },
              }
            );

            const result = models.reduce((obj, table) => {
              if (table.type !== 'vtable')
                obj[table.title] = {
                  tn: table.title,
                  _tn: table.alias || table.title,
                  order: table.order,
                  disabled: { ...defaultDisabled },
                  type: table.type,
                  show_as: table.show_as,
                  ptn: table.parent_model_title,
                };
              return obj;
            }, {});

            // @ts-ignore
            const viewsObj = models.reduce((obj, tableView) => {
              obj[tableView.parent_model_title || tableView.title] =
                obj[tableView.parent_model_title || tableView.title] || {};
              obj[tableView.parent_model_title || tableView.title][
                tableView.title
              ] = { ...defaultDisabled };
              return obj;
            }, {});

            // @ts-ignore
            const disabledList = await this.xcMeta.metaList(
              args.project_id,
              this.getDbAlias(args),
              'nc_disabled_models_for_role',
              {
                xcCondition: {
                  _or: [
                    {
                      type: { eq: 'table' },
                    },
                    {
                      type: { eq: 'view' },
                    },
                    {
                      type: { eq: 'vtable' },
                    },
                  ],
                },
              }
            );

            for (const d of disabledList) {
              if (d.type === 'vtable') {
                if (viewsObj?.[d.parent_model_title]?.[d.title])
                  viewsObj[d.parent_model_title][d.title][d.role] = d.disabled;
              } else {
                if (viewsObj?.[d.title]?.[d.title])
                  viewsObj[d.title][d.title][d.role] = d.disabled;
              }
            }

            for (const [title, aclObj] of Object.entries(viewsObj)) {
              for (const role in result[title]?.disabled || []) {
                result[title].disabled[role] = Object.values(aclObj).every(
                  (v) => v[role]
                );
              }
            }

            // result[d.title].disabled[d.role] = !!d.disabled;

            return Object.values(result);
          }
          break;
      }
    } catch (e) {
      throw e;
    }
  }

  // @ts-ignore
  protected async xcVisibilityMetaSetAll(args) {
    throw new XCEeError('Please upgrade');
  }

  // @ts-ignore
  protected async xcVisibilityMetaSet(args) {
    throw new XCEeError('Please upgrade');
  }

  protected async xcPluginList(_args): Promise<any> {
    return this.xcMeta.metaList(null, null, 'nc_plugins');
  }

  protected async xcPluginRead(args): Promise<any> {
    return this.xcMeta.metaGet(null, null, 'nc_plugins', {
      title: args.args.title,
    });
  }

  protected async xcPluginTest(_req, args): Promise<any> {
    return this.pluginMgr.test(args.args);
  }

  protected async xcPluginCreate(_args): Promise<any> {}

  protected async xcPluginDelete(_args): Promise<any> {}

  protected async xcPluginSet(args): Promise<any> {
    try {
      if (args.args.title === 'Branding' && !this.isEe) {
        throw new XCEeError('Upgrade to Enterprise Edition');
      }

      await this.xcMeta.metaUpdate(
        null,
        null,
        'nc_plugins',
        {
          input: args.args.input ? JSON.stringify(args.args.input) : null,
          status: args.args.uninstall ? '' : 'installed',
          active: !args.args.uninstall,
        },
        { title: args.args.title, id: args.args.id }
      );

      // await this.initStorage(true)
      // await this.initEmail(true)
      // await this.initTwilio(true)
      this.pluginMgr?.reInit();
      await this.initCache(true);
      this.eeVerify();
      try {
        RestAuthCtrl.instance.initStrategies();
      } catch (e) {}
    } catch (e) {
      throw e;
    } finally {
      Tele.emit('evt', {
        evt_type: 'plugin:installed',
        title: args.args.title,
      });
    }
  }

  protected getProjectId(args): string {
    return args.project_id;
  }

  // @ts-ignore
  protected xcVersionLetters(args) {
    // const _vesions ={db:'v1-legacy'};
    // for(const  {meta: {_dbAlias}} of this.projectConfigs[args.project_id].envs[args.env].db) {
    //
    // }
  }

  protected async xcVirtualTableCreate(args, req): Promise<any> {
    const parentModel = await this.xcMeta.metaGet(
      this.getProjectId(args),
      this.getDbAlias(args),
      'nc_models',
      {
        title: args.args.parent_model_title,
      },
      null,
      {
        type: {
          in: ['table', 'view'],
        },
      }
    );

    const view_order =
      ((
        await this.xcMeta
          .knex('nc_models')
          .where({
            project_id: this.getProjectId(args),
            db_alias: this.getDbAlias(args),
          })
          .andWhere((qb) => {
            qb.where({ title: args.args.parent_model_title });
            qb.orWhere({ parent_model_title: args.args.parent_model_title });
          })
          .max('view_order as max')
          .first()
      )?.max || 0) + 1;

    if (!parentModel) {
      return;
    }

    const data: any = {
      title: args.args.title,
      type: 'vtable',
      // meta: parentModel.meta,
      query_params: JSON.stringify(args.args.query_params),
      parent_model_title: args.args.parent_model_title,
      show_as: args.args.show_as,
      view_order,
    };
    const projectId = this.getProjectId(args);
    const dbAlias = this.getDbAlias(args);
    const id = await this.xcMeta.metaInsert(
      projectId,
      dbAlias,
      'nc_models',
      data
    );
    data.id = id?.[0] || id;

    this.xcMeta.audit(projectId, dbAlias, 'nc_audit', {
      op_type: 'TABLE_VIEW',
      op_sub_type: 'CREATED',
      user: req.user.email,
      description: `created view(${args.args.title}) for table(${args.args.parent_model_title}) `,
      ip: req.clientIp,
    });

    Tele.emit('evt', {
      evt_type: 'vtable:created',
      show_as: args.args.show_as,
    });
    return data;
  }

  protected async xcApiTokenList(_args): Promise<any> {
    return this.xcMeta.metaList(null, null, 'nc_api_tokens');
  }

  protected async xcPluginDemoDefaults(_args): Promise<any> {
    if (!process.env.NC_DEMO) {
      return {};
    }
    let pluginDet = XcCache.get(XC_PLUGIN_DET);
    if (pluginDet) {
      return pluginDet;
    }
    pluginDet = (
      await axios.post('https://nocodb.com/api/v1/pluginDemoDefaults', {
        key: process.env.NC_DEMO,
      })
    )?.data;

    XcCache.set(XC_PLUGIN_DET, pluginDet);
    return pluginDet;
  }

  protected async xcAuditList(_args): Promise<any> {
    throw new XCEeError('Upgrade to Enterprise Edition');
  }

  protected async xcModelRowAuditAndCommentList(args): Promise<any> {
    const audits = await this.xcMeta.metaPaginatedList(
      this.getProjectId(args),
      this.getDbAlias(args),
      'nc_audit',
      {
        limit: args.args.limit,
        offset: args.args.offset,
        sort: {
          field: 'created_at',
          desc: false,
        },
        condition: {
          model_id: args.args.model_id,
          model_name: args.args.model_name,
          ...(args.args.comments ? { op_type: 'COMMENT' } : {}),
        },
      }
    );

    return audits;
  }

  protected async xcAuditCommentInsert(args, req): Promise<any> {
    return this.xcMeta.audit(
      this.getProjectId(args),
      this.getDbAlias(args),
      'nc_audit',
      {
        description: args.args.description,
        model_id: args.args.model_id,
        model_name: args.args.model_name,
        op_type: 'COMMENT',
        op_sub_type: 'INSERT',
        user: req.user?.email,
        ip: req.clientIp,
      }
    );
  }

  protected async xcAuditCreate(args, req): Promise<any> {
    return this.xcMeta.audit(
      this.getProjectId(args),
      this.getDbAlias(args),
      'nc_audit',
      {
        model_name: args.args.tn,
        model_id: args.args.pk,
        op_type: 'DATA',
        op_sub_type: 'UPDATE',
        description: `Table ${args.args.tn} : field ${args.args.cn} got changed from  ${args.args.prevValue} to ${args.args.value}`,
        details: `<span class="">${args.args.cn}</span>
  : <span class="text-decoration-line-through red px-2 lighten-4 black--text">${args.args.prevValue}</span>
  <span class="black--text green lighten-4 px-2">${args.args.value}</span>`,
        ip: req.clientIp,
        user: req.user?.email,
      }
    );
  }

  protected async xcAuditModelCommentsCount(args): Promise<any> {
    return this.xcMeta
      .knex('nc_audit')
      .select('model_id')
      .count('model_id', { as: 'count' })
      .where({
        project_id: this.getProjectId(args),
        db_alias: this.getDbAlias(args),
        model_name: args.args.model_name,
        op_type: 'COMMENT',
        // op_sub_type: 'COMMENT',
      })
      .whereIn('model_id', args.args.ids)
      .groupBy('model_id');
  }

  protected async xcApiTokenCreate(args): Promise<any> {
    const token = nanoid(40);
    await this.xcMeta.metaInsert(null, null, 'nc_api_tokens', {
      description: args.args.description,
      token,
    });
    await RestAuthCtrl.instance.loadLatestApiTokens();

    Tele.emit('evt', { evt_type: 'apiToken:created' });
    return {
      description: args.args.description,
      token,
    };
  }

  protected async xcApiTokenUpdate(_args): Promise<any> {
    return null;
  }

  protected async xcApiTokenDelete(args): Promise<any> {
    Tele.emit('evt', { evt_type: 'apiToken:deleted' });
    const res = await this.xcMeta.metaDelete(
      null,
      null,
      'nc_api_tokens',
      args.args.id
    );
    await RestAuthCtrl.instance.loadLatestApiTokens();
    return res;
  }

  protected async xcVirtualTableRename(args, req): Promise<any> {
    const projectId = this.getProjectId(args);
    const dbAlias = this.getDbAlias(args);
    const result = await this.xcMeta.metaUpdate(
      projectId,
      dbAlias,
      'nc_models',
      {
        title: args.args.title,
      },
      args.args.id
    );

    await this.xcMeta.metaUpdate(
      projectId,
      dbAlias,
      'nc_shared_views',
      {
        view_name: args.args.title,
      },
      {
        view_name: args.args.old_title,
        model_name: args.args.parent_model_title,
      }
    );

    this.xcMeta.audit(projectId, dbAlias, 'nc_audit', {
      op_type: 'TABLE_VIEW',
      op_sub_type: 'RENAMED',
      user: req.user.email,
      description: `renamed view(${args.args.title}, ${args.args.id}) for table(${args.args.parent_model_title}) `,
      ip: req.clientIp,
    });

    Tele.emit('evt', {
      evt_type: 'vtable:renamed',
      show_as: args.args.show_as,
    });
    return result;
  }

  protected async xcVirtualTableUpdate(args): Promise<any> {
    // Tele.emit('evt', {evt_type: 'vtable:updated',show_as: args.args.show_as})
    return this.xcMeta.metaUpdate(
      this.getProjectId(args),
      this.getDbAlias(args),
      'nc_models',
      {
        query_params: JSON.stringify(args.args.query_params),
      },
      args.args.id
    );
  }

  protected async ncProjectInfo(args) {
    const config = this.projectConfigs[this.getProjectId(args)];
    return {
      Node: process.version,
      Arch: process.arch,
      Platform: process.platform,
      Docker: isDocker(),
      Database: config.envs?.[process.env.NODE_ENV || '_noco']?.db?.[0]?.client,
      ProjectOnRootDB: !!config?.prefix,
      RootDB: this.config?.meta?.db?.client,
      PackageVersion: packageVersion,
    };
  }

  protected async xcTableAndViewList(req, args): Promise<any> {
    const roles = req.session?.passport?.user?.roles;
    let tables = await this.xcVisibilityMetaGet({
      ...args,
      args: { type: 'table_view', ...args.args },
    });

    tables = tables.filter((table: any) => {
      return Object.keys(roles).some(
        (role) => roles[role] && !table.disabled[role]
      );
    });

    return { data: { list: tables } };
  }

  protected async xcVirtualTableList(args, req): Promise<any> {
    const roles = (await this.xcMeta.metaList('', '', 'nc_roles'))
      .map((r) => r.title)
      .filter((role) => !['owner', 'guest', 'creator'].includes(role));

    const defaultDisabled = roles.reduce((o, r) => ({ ...o, [r]: false }), {});
    const list = await this.xcMeta.metaList(
      this.getProjectId(args),
      this.getDbAlias(args),
      'nc_models',
      {
        xcCondition: {
          _or: [
            {
              parent_model_title: {
                eq: args.args.tn,
              },
            },
            {
              title: {
                eq: args.args.tn,
              },
            },
          ],
        },
        fields: [
          'id',
          'alias',
          'meta',
          'parent_model_title',
          'query_params',
          'show_as',
          'title',
          'type',
          'view_order',
        ],
        orderBy: {
          view_order: 'asc',
        },
        // todo: handle sort
      }
    );

    const result = list.reduce((obj, table) => {
      obj[table.title] = {
        ...table,
        disabled: { ...defaultDisabled },
      };
      return obj;
    }, {});

    const disabledList = await this.xcMeta.metaList(
      args.project_id,
      this.getDbAlias(args),
      'nc_disabled_models_for_role',
      {
        xcCondition: {
          _or: [
            {
              type: 'table',
            },
            {
              type: 'vtable',
            },
          ],
        },
      }
    );

    for (const d of disabledList) {
      if (result?.[d.title]?.disabled)
        result[d.title].disabled[d.role] = !!d.disabled;
    }

    const models = Object.values(result).filter((table: any) => {
      return Object.keys(req.session?.passport?.user?.roles).some(
        (role) =>
          req.session?.passport?.user?.roles[role] && !table.disabled[role]
      );
    });
    return models;
  }

  protected async xcVirtualTableDelete(args, req): Promise<any> {
    const projectId = this.getProjectId(args);
    const dbAlias = this.getDbAlias(args);
    const res = await this.xcMeta.metaDelete(projectId, dbAlias, 'nc_models', {
      type: 'vtable',
      parent_model_title: args.args.parent_model_title,
      id: args.args.id,
    });

    await this.xcMeta.metaDelete(projectId, dbAlias, 'nc_shared_views', {
      model_name: args.args.parent_model_title,
      view_name: args.args.view_name,
    });

    this.xcMeta.audit(projectId, dbAlias, 'nc_audit', {
      op_type: 'TABLE_VIEW',
      op_sub_type: 'DELETED',
      user: req.user.email,
      description: `deleted view(${args.args.title}, ${args.args.id}) of parent table(${args.args.parent_model_title}) `,
      ip: req.clientIp,
    });

    Tele.emit('evt', { evt_type: 'vtable:deleted' });
    return res;
  }

  protected async xcMetaDiff(args, req): Promise<any> {
    return xcMetaDiff.call(this, { args, req });
  }

  // @ts-ignore
  protected async eeVerify() {
    try {
      const eeDetails = await this.xcMeta.metaGet(null, null, 'nc_plugins', {
        category: 'Enterprise',
      });

      if (eeDetails?.input) {
        // @ts-ignore
        const eeConfig = JSON.parse(eeDetails?.input);
        this.isEe = false;

        await axios.post(
          'http://localhost:3000/api/v1/subscription/e62a4252-748a-4474-861e-ca291359130e',
          {
            key: eeConfig.key,
          }
        );

        // todo: verify client id and secret
        // this.isEe = true;
      }
    } catch (e) {
      console.log(e);
    }
  }

  protected cacheModelSet(
    project_id: string,
    db_alias: string,
    type: string,
    model_name: string,
    model: any
  ): boolean {
    return XcCache.set(
      [project_id, db_alias, type, model_name].join('::'),
      model
    );
  }

  protected cacheModelGet(
    project_id: string,
    db_alias: string,
    type: string,
    model_name: string
  ): any {
    return XcCache.get([project_id, db_alias, type, model_name].join('::'));
  }

  protected cacheModelDel(
    project_id: string,
    db_alias: string,
    type: string,
    model_name
  ): void {
    XcCache.del([project_id, db_alias, type, model_name].join('::'));
  }

  protected get storageAdapter(): IStorageAdapter {
    return this.pluginMgr?.storageAdapter;
  }

  public get emailAdapter(): IEmailAdapter {
    return this.pluginMgr?.emailAdapter;
  }

  public get webhookNotificationAdapters() {
    return this.pluginMgr?.webhookNotificationAdapters;
  }

  private async xcRelease() {
    const cachedResult = XcCache.get(NOCO_RELEASE);
    if (cachedResult) {
      return cachedResult;
    }

    const result: any = {
      current: packageVersion,
      isDocker: isDocker(),
    };
    try {
      const dockerTags = (
        await axios({
          url: 'https://registry.hub.docker.com/v1/repositories/nocodb/nocodb/tags',
        })
      ).data;
      const verPattern = /^(\d+)\.(\d+)\.(\d+)$/;
      result.docker = dockerTags.sort((a, b): any => {
        const m1: any = a.name.match(verPattern);
        const m2: any = b.name.match(verPattern);
        if (m1 && m2) {
          return m2[1] - m1[1] || m2[2] - m1[2] || m2[3] - m1[3];
        } else if (m1) {
          return -Infinity;
        } else if (m2) {
          return Infinity;
        }
        return 0;
      })?.[0];

      if (result.docker && result.docker.name !== packageVersion) {
        result.docker.upgrade = true;
      }

      XcCache.set(NOCO_RELEASE, result, 60 * 60 * 1000);
    } catch (e) {
      console.log(e);
    }

    return result;
  }

  protected serializeToXwhere(filters) {
    // todo: move  this logic to a common library
    // todo: replace with condition prop
    const privateViewWhere = filters?.reduce?.((condition, filt, i) => {
      if (!i && !filt.logicOp) {
        return condition;
      }
      if (!(filt.field && filt.op)) {
        return condition;
      }

      condition += i ? `~${filt.logicOp}` : '';
      switch (filt.op) {
        case 'is equal':
          return condition + `(${filt.field},eq,${filt.value})`;
        case 'is not equal':
          return condition + `~not(${filt.field},eq,${filt.value})`;
        case 'is like':
          return condition + `(${filt.field},like,%${filt.value}%)`;
        case 'is not like':
          return condition + `~not(${filt.field},like,%${filt.value}%)`;
        case 'is empty':
          return condition + `(${filt.field},in,)`;
        case 'is not empty':
          return condition + `~not(${filt.field},in,)`;
        case 'is null':
          return condition + `(${filt.field},is,null)`;
        case 'is not null':
          return condition + `~not(${filt.field},is,null)`;
        case '<':
          return condition + `(${filt.field},lt,${filt.value})`;
        case '<=':
          return condition + `(${filt.field},le,${filt.value})`;
        case '>':
          return condition + `(${filt.field},gt,${filt.value})`;
        case '>=':
          return condition + `(${filt.field},ge,${filt.value})`;
      }
      return condition;
    }, '');
    return privateViewWhere;
  }

  protected serializeNestedParams(meta, queryParams) {
    const nestedParams: any = {
      hm: [],
      mm: [],
      bt: [],
    };

    for (const v of meta.v) {
      if (queryParams?.showFields && !queryParams.showFields[v._cn]) continue;
      if (v.bt || v.lk?.type === 'bt') {
        const tn = v.bt?.rtn || v.lk?.rtn;
        if (!nestedParams.bt.includes(tn)) nestedParams.bt.push(tn);
        if (v.lk) {
          const key = `bf${nestedParams.bt.indexOf(tn)}`;
          nestedParams[key] =
            (nestedParams[key] ? `${nestedParams[key]},` : '') + tn;
        }
      } else if (v.hm || v.lk?.type === 'hm') {
        const tn = v.hm?.tn || v.lk?.tn;
        if (!nestedParams.hm.includes(tn)) nestedParams.hm.push(tn);
        if (v.lk) {
          const key = `hf${nestedParams.hm.indexOf(tn)}`;
          nestedParams[key] =
            (nestedParams[key] ? `${nestedParams[key]},` : '') + tn;
        }
      } else if (v.mm || v.lk?.type === 'mm') {
        const tn = v.mm?.rtn || v.lk?.rtn;
        if (!nestedParams.mm.includes(tn)) nestedParams.mm.push(tn);
        if (v.lk) {
          const key = `mf${nestedParams.mm.indexOf(tn)}`;
          nestedParams[key] =
            (nestedParams[key] ? `${nestedParams[key]},` : '') + tn;
        }
      }
    }

    nestedParams.mm = nestedParams.mm.join(',');
    nestedParams.hm = nestedParams.hm.join(',');
    nestedParams.bt = nestedParams.bt.join(',');

    return nestedParams;
  }

  private async checkIsUserAllowedToCreateProject(req: any): Promise<void> {
    const user = req.user;
    const roles = await this.xcMeta.metaList(null, null, 'nc_projects_users', {
      condition: { user_id: user?.id },
      xcCondition: {
        _or: [{ roles: { like: '%creator%' } }, { roles: { like: '%owner%' } }],
      },
      fields: ['roles'],
    });

    if (
      !roles.some((r) => /\b(?:owner|creator)\b/.test(r?.roles)) &&
      (await this.xcMeta.metaList(null, null, 'nc_projects'))?.length
    ) {
      throw new Error("You don't have permission to create project");
    }
  }
}

export class XCEeError extends Error {
  public static throw() {
    throw new XCEeError('Upgrade to Enterprise Edition');
  }
}
