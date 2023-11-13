import type { UserType } from 'nocodb-sdk';
import type { ReqId } from 'pino-http';
import type { Handler } from 'express';
import type * as e from 'express';
import type { Knex } from 'knex';
import type { User } from '~/models';

export interface Route {
  path: string;
  type: RouteType | string;
  handler: Array<Handler | string>;
  acl: {
    [key: string]: boolean;
  };
  disabled?: boolean;
  functions?: string[];
}

export enum RouteType {
  GET = 'get',
  POST = 'post',
  PUT = 'put',
  PATCH = 'patch',
  DELETE = 'delete',
  HEAD = 'head',
  OPTIONS = 'options',
}

type InflectionTypes =
  | 'pluralize'
  | 'singularize'
  | 'inflect'
  | 'camelize'
  | 'underscore'
  | 'humanize'
  | 'capitalize'
  | 'dasherize'
  | 'titleize'
  | 'demodulize'
  | 'tableize'
  | 'classify'
  | 'foreign_key'
  | 'ordinalize'
  | 'transform'
  | 'none';

export interface DbConfig extends Knex.Config {
  client: string;

  connection: Knex.StaticConnectionConfig | Knex.Config | any;

  meta: {
    dbAlias: string;

    metaTables?: 'db' | 'file';
    tn?: string;
    models?: {
      disabled: boolean;
    };

    routes?: {
      disabled: boolean;
    };

    hooks?: {
      disabled: boolean;
    };

    migrations?: {
      disabled: boolean;
      name: 'nc_evolutions';
    };

    api: {
      type: 'rest' | 'graphql' | 'grpc';
      prefix: string;
      swagger?: boolean;
      graphiql?: boolean;
      graphqlDepthLimit?: number;
    };

    allSchemas?: boolean;

    ignoreTables?: string[];
    readonly?: boolean;

    query?: {
      print?: boolean;
      explain?: boolean;
      measure?: boolean;
    };
    reset?: boolean;
    dbtype?: 'vitess' | string;
    pluralize?: boolean;
    inflection?: {
      tn?: InflectionTypes;
      cn?: InflectionTypes;
    };
  };
}

// Refer : https://www.npmjs.com/package/jsonwebtoken
interface JwtOptions {
  algorithm?: string;
  expiresIn?: string | number;
  notBefore?: string | number;
  audience?: string;
  issuer?: string;
  jwtid?: any;
  subject?: string;
  noTimestamp?: any;
  header?: any;
  keyid?: any;
}

export interface AuthConfig {
  jwt?: {
    secret: string;
    [key: string]: any;
    dbAlias?: string;
    options?: JwtOptions;
  };
  masterKey?: {
    secret: string;
  };
  middleware?: {
    url: string;
  };
  disabled?: boolean;
}

export interface MiddlewareConfig {
  handler?: (...args: any[]) => any;
}

export interface ACLConfig {
  roles?: string[];
  defaultRoles?: string[];
}

export interface MailerConfig {
  [key: string]: any;
}

export interface ServerlessConfig {
  aws?: {
    lambda: boolean;
  };
  gcp?: {
    cloudFunction: boolean;
  };
  azure?: {
    cloudFunctionApp: boolean;
  };
  zeit?: {
    now: boolean;
  };
  alibaba?: {
    functionCompute: boolean;
  };
  serverlessFramework?: {
    http: boolean;
  };
}

export interface NcGui {
  path?: string;
  disabled?: boolean;
  favicon?: string;
  logo?: string;
}

// @ts-ignore
export interface NcConfig {
  title?: string;
  version?: string;

  envs: {
    [key: string]: {
      db: DbConfig[];
      api?: any;
      publicUrl?: string;
    };
  };

  // dbs: DbConfig[];

  auth?: AuthConfig;
  middleware?: MiddlewareConfig[];
  acl?: ACLConfig;
  port?: number;
  host?: string;
  cluster?: number;

  mailer?: MailerConfig;
  make?: () => NcConfig;
  serverless?: ServerlessConfig;

  toolDir?: string;
  env?: 'production' | 'dev' | 'test' | string;
  workingEnv?: string;

  seedsFolder?: string | string[];
  queriesFolder?: string | string[];
  apisFolder?: string | string[];
  baseType?: 'rest' | 'graphql' | 'grpc';
  type?: 'mvc' | 'package' | 'docker';
  language?: 'ts' | 'js';
  meta?: {
    db?: any;
  };
  api?: any;
  gui?: NcGui;
  try?: boolean;

  dashboardPath?: string;

  prefix?: string;
  publicUrl?: string;
}

export interface Event {
  title: string;
  tn: string;
  url;
  headers;
  operation;
  event;
  retry;
  max;
  interval;
  timeout;
}

export interface Acl {
  [role: string]:
    | {
        create: boolean | ColumnAcl;
        [key: string]: boolean | ColumnAcl;
      }
    | boolean
    | any;
}

export interface ColumnAcl {
  columns: {
    [cn: string]: boolean;
  };
  assign?: {
    [cn: string]: any;
  };
}

export interface Acls {
  [tn: string]: Acl;
}

export enum ServerlessType {
  AWS_LAMBDA = 'AWS_LAMBDA',
  GCP_FUNCTION = 'GCP_FUNCTION',
  AZURE_FUNCTION_APP = 'AZURE_FUNCTION_APP',
  ALIYUN = 'ALIYUN',
  ZEIT = 'ZEIT',
  LYRID = 'LYRID',
  SERVERLESS = 'SERVERLESS',
}

export class Result {
  public code: any;
  public message: string;
  public data: any;

  constructor(code = 0, message = '', data = {}) {
    this.code = code;
    this.message = message;
    this.data = data;
  }
}

enum HTTPType {
  GET = 'get',
  POST = 'post',
  PUT = 'put',
  DELETE = 'delete',
  PATCH = 'patch',
  HEAD = 'head',
  OPTIONS = 'options',
}

export interface XcRoute {
  httpType: HTTPType;
  path: string;
  handler: e.Handler;
  dbAlias?: string;
  isCustom?: boolean;
}

export interface AppConfig {
  throttler: {
    data?: {
      ttl: number;
      max_apis: number;
    };
    meta?: {
      ttl: number;
      max_apis: number;
    };
    public?: {
      ttl: number;
      max_apis: number;
    };
    calc_execution_time: boolean;
  };
  basicAuth: {
    username: string;
    password: string;
  };
  auth: {
    emailPattern?: RegExp | null;
    disableEmailAuth: boolean;
  };
  mainSubDomain: string;
  dashboardPath: string;
}

export interface NcRequest {
  id?: ReqId;
  user?: UserType | User;
  ncWorkspaceId?: string;
  ncProjectId?: string;
  headers?: Record<string, string | undefined> | IncomingHttpHeaders;
  clientIp?: string;
}
