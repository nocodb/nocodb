import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { compareVersions, validate } from 'compare-versions';
import { ViewTypes } from 'nocodb-sdk';
import { Configuration, OpenAIApi } from 'openai';
import JSON5 from 'json5';
import { identify } from 'sql-query-identifier';
import { NC_ATTACHMENT_FIELD_SIZE } from '../constants';
import SqlMgrv2 from '../db/sql-mgr/v2/SqlMgrv2';
import { NcError } from '../helpers/catchError';
import { Base, Project, User } from '../models';
import Noco from '../Noco';
import NcConnectionMgrv2 from '../utils/common/NcConnectionMgrv2';
import { MetaTable } from '../utils/globals';
import NcConfigFactory from '../utils/NcConfigFactory';
import { packageVersion } from '../utils/packageVersion';

const versionCache = {
  releaseVersion: null,
  lastFetched: null,
};

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

const defaultConnectionConfig: any = {
  // https://github.com/knex/knex/issues/97
  // timezone: process.env.NC_TIMEZONE || 'UTC',
  dateStrings: true,
};

interface ViewCount {
  formCount: number | null;
  gridCount: number | null;
  galleryCount: number | null;
  kanbanCount: number | null;
  total: number | null;
  sharedFormCount: number | null;
  sharedGridCount: number | null;
  sharedGalleryCount: number | null;
  sharedKanbanCount: number | null;
  sharedTotal: number | null;
  sharedLockedCount: number | null;
}

interface AllMeta {
  projectCount: number;
  projects: (
    | {
        external?: boolean | null;
        tableCount: {
          table: number;
          view: number;
        } | null;
        viewCount: ViewCount;
        webhookCount: number | null;
        filterCount: number | null;
        sortCount: number | null;
        rowCount: ({ totalRecords: number } | null)[] | null;
        userCount: number | null;
      }
    | { error: string }
  )[];
  userCount: number;
  sharedBaseCount: number;
}

@Injectable()
export class UtilsService {
  async versionInfo() {
    if (
      !versionCache.lastFetched ||
      (versionCache.lastFetched &&
        versionCache.lastFetched < Date.now() - 1000 * 60 * 60)
    ) {
      const nonBetaTags = await axios
        .get('https://api.github.com/repos/nocodb/nocodb/tags', {
          timeout: 5000,
        })
        .then((response) => {
          return response.data
            .map((x) => x.name)
            .filter(
              (v) => validate(v) && !v.includes('finn') && !v.includes('beta'),
            )
            .sort((x, y) => compareVersions(y, x));
        })
        .catch(() => null);
      if (nonBetaTags && nonBetaTags.length > 0) {
        versionCache.releaseVersion = nonBetaTags[0];
      }
      versionCache.lastFetched = Date.now();
    }

    const response = {
      currentVersion: packageVersion,
      releaseVersion: versionCache.releaseVersion,
    };

    return response;
  }

  async appHealth() {
    return {
      message: 'OK',
      timestamp: Date.now(),
      uptime: process.uptime(),
    };
  }

  async _axiosRequestMake(param: {
    body: {
      apiMeta: any;
    };
  }) {
    const { apiMeta } = param.body;

    if (apiMeta?.body) {
      try {
        apiMeta.body = JSON.parse(apiMeta.body);
      } catch (e) {
        console.log(e);
      }
    }

    if (apiMeta?.auth) {
      try {
        apiMeta.auth = JSON.parse(apiMeta.auth);
      } catch (e) {
        console.log(e);
      }
    }

    apiMeta.response = {};
    const _req = {
      params: apiMeta.parameters
        ? apiMeta.parameters.reduce((paramsObj, param) => {
            if (param.name && param.enabled) {
              paramsObj[param.name] = param.value;
            }
            return paramsObj;
          }, {})
        : {},
      url: apiMeta.url,
      method: apiMeta.method || 'GET',
      data: apiMeta.body || {},
      headers: apiMeta.headers
        ? apiMeta.headers.reduce((headersObj, header) => {
            if (header.name && header.enabled) {
              headersObj[header.name] = header.value;
            }
            return headersObj;
          }, {})
        : {},
      responseType: apiMeta.responseType || 'json',
      withCredentials: true,
    };
    const data = await axios(_req);
    return data?.data;
  }

  async axiosRequestMake(param: {
    body: {
      apiMeta: any;
    };
  }) {
    const {
      apiMeta: { url },
    } = param.body;
    const isExcelImport = /.*\.(xls|xlsx|xlsm|ods|ots)/;
    const isCSVImport = /.*\.(csv)/;
    const ipBlockList =
      /(10)(\.([2]([0-5][0-5]|[01234][6-9])|[1][0-9][0-9]|[1-9][0-9]|[0-9])){3}|(172)\.(1[6-9]|2[0-9]|3[0-1])(\.(2[0-4][0-9]|25[0-5]|[1][0-9][0-9]|[1-9][0-9]|[0-9])){2}|(192)\.(168)(\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])){2}|(0.0.0.0)|localhost?/g;
    if (
      ipBlockList.test(url) ||
      (!isCSVImport.test(url) && !isExcelImport.test(url))
    ) {
      return {};
    }
    if (isCSVImport || isExcelImport) {
      param.body.apiMeta.responseType = 'arraybuffer';
    }
    return await this._axiosRequestMake({
      body: param.body,
    });
  }

  async urlToDbConfig(param: {
    body: {
      url: string;
    };
  }) {
    const { url } = param.body;
    try {
      const connectionConfig = NcConfigFactory.extractXcUrlFromJdbc(url, true);
      return connectionConfig;
    } catch (error) {
      return NcError.internalServerError(
        'Please check server log for more details',
      );
    }
  }

  async aggregatedMetaInfo() {
    const [projects, userCount] = await Promise.all([
      Project.list({}),
      Noco.ncMeta.metaCount(null, null, MetaTable.USERS),
    ]);

    const result: AllMeta = {
      projectCount: projects.length,
      projects: [],
      userCount,
      sharedBaseCount: 0,
    };

    result.projects.push(
      ...this.extractResultOrNull(
        await Promise.allSettled(
          projects.map(async (project) => {
            if (project.uuid) result.sharedBaseCount++;
            const [
              tableCount,
              dbViewCount,
              viewCount,
              webhookCount,
              filterCount,
              sortCount,
              rowCount,
              userCount,
            ] = this.extractResultOrNull(
              await Promise.allSettled([
                // db tables  count
                Noco.ncMeta.metaCount(project.id, null, MetaTable.MODELS, {
                  condition: {
                    type: 'table',
                  },
                }),
                // db views count
                Noco.ncMeta.metaCount(project.id, null, MetaTable.MODELS, {
                  condition: {
                    type: 'view',
                  },
                }),
                // views count
                (async () => {
                  const views = await Noco.ncMeta.metaList2(
                    project.id,
                    null,
                    MetaTable.VIEWS,
                  );
                  // grid, form, gallery, kanban and shared count
                  return (views as any[]).reduce<ViewCount>(
                    (out, view) => {
                      out.total++;

                      switch (view.type) {
                        case ViewTypes.GRID:
                          out.gridCount++;
                          if (view.uuid) out.sharedGridCount++;
                          break;
                        case ViewTypes.FORM:
                          out.formCount++;
                          if (view.uuid) out.sharedFormCount++;
                          break;
                        case ViewTypes.GALLERY:
                          out.galleryCount++;
                          if (view.uuid) out.sharedGalleryCount++;
                          break;
                        case ViewTypes.KANBAN:
                          out.kanbanCount++;
                          if (view.uuid) out.sharedKanbanCount++;
                      }

                      if (view.uuid) {
                        if (view.password) out.sharedLockedCount++;
                        out.sharedTotal++;
                      }

                      return out;
                    },
                    {
                      formCount: 0,
                      gridCount: 0,
                      galleryCount: 0,
                      kanbanCount: 0,
                      total: 0,
                      sharedFormCount: 0,
                      sharedGridCount: 0,
                      sharedGalleryCount: 0,
                      sharedKanbanCount: 0,
                      sharedTotal: 0,
                      sharedLockedCount: 0,
                    },
                  );
                })(),
                // webhooks count
                Noco.ncMeta.metaCount(project.id, null, MetaTable.HOOKS),
                // filters count
                Noco.ncMeta.metaCount(project.id, null, MetaTable.FILTER_EXP),
                // sorts count
                Noco.ncMeta.metaCount(project.id, null, MetaTable.SORT),
                // row count per base
                project.getBases().then(async (bases) => {
                  return this.extractResultOrNull(
                    await Promise.allSettled(
                      bases.map(async (base) =>
                        (await NcConnectionMgrv2.getSqlClient(base))
                          .totalRecords?.()
                          ?.then((result) => result?.data),
                      ),
                    ),
                  );
                }),
                // project users count
                Noco.ncMeta.metaCount(null, null, MetaTable.PROJECT_USERS, {
                  condition: {
                    project_id: project.id,
                  },
                  aggField: '*',
                }),
              ]),
            );

            return {
              tableCount: { table: tableCount, view: dbViewCount },
              external: !project.is_meta,
              viewCount,
              webhookCount,
              filterCount,
              sortCount,
              rowCount,
              userCount,
            };
          }),
        ),
      ),
    );

    return result;
  }

  extractResultOrNull = (results: PromiseSettledResult<any>[]) => {
    return results.map((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      console.log(result.reason);
      return null;
    });
  };

  async testConnection(param: { body: any }) {
    return await SqlMgrv2.testConnection(param.body);
  }

  async appInfo(param: { req: { ncSiteUrl: string } }) {
    const projectHasAdmin = !(await User.isFirst());
    const oidcAuthEnabled = !!(
      process.env.NC_OIDC_ISSUER &&
      process.env.NC_OIDC_AUTHORIZATION_URL &&
      process.env.NC_OIDC_TOKEN_URL &&
      process.env.NC_OIDC_USERINFO_URL &&
      process.env.NC_OIDC_CLIENT_ID &&
      process.env.NC_OIDC_CLIENT_SECRET
    );
    const oidcProviderName = oidcAuthEnabled
      ? process.env.NC_OIDC_PROVIDER_NAME ?? 'OpenID Connect'
      : null;

    const result = {
      authType: 'jwt',
      projectHasAdmin,
      firstUser: !projectHasAdmin,
      type: 'rest',
      env: process.env.NODE_ENV,
      googleAuthEnabled: !!(
        process.env.NC_GOOGLE_CLIENT_ID && process.env.NC_GOOGLE_CLIENT_SECRET
      ),
      githubAuthEnabled: !!(
        process.env.NC_GITHUB_CLIENT_ID && process.env.NC_GITHUB_CLIENT_SECRET
      ),
      oidcAuthEnabled,
      oidcProviderName,
      oneClick: !!process.env.NC_ONE_CLICK,
      connectToExternalDB: !process.env.NC_CONNECT_TO_EXTERNAL_DB_DISABLED,
      version: packageVersion,
      defaultLimit: Math.max(
        Math.min(
          +process.env.DB_QUERY_LIMIT_DEFAULT || 25,
          +process.env.DB_QUERY_LIMIT_MAX || 100,
        ),
        +process.env.DB_QUERY_LIMIT_MIN || 1,
      ),
      timezone: defaultConnectionConfig.timezone,
      ncMin: !!process.env.NC_MIN,
      teleEnabled: process.env.NC_DISABLE_TELE !== 'true',
      auditEnabled: process.env.NC_DISABLE_AUDIT !== 'true',
      ncSiteUrl: (param.req as any).ncSiteUrl,
      ee: Noco.isEE(),
      ncAttachmentFieldSize: NC_ATTACHMENT_FIELD_SIZE,
      ncMaxAttachmentsAllowed: +(process.env.NC_MAX_ATTACHMENTS_ALLOWED || 10),
      isCloud: process.env.NC_CLOUD === 'true',
      automationLogLevel: process.env.NC_AUTOMATION_LOG_LEVEL || 'OFF',
    };

    return result;
  }

  async selectOptionsMagic(param: {
    table: string;
    schema: string;
    title: string;
  }) {
    const response = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt: `return select options for '${param.title}' column for '${param.table}' table in '${param.schema}' schema as Array<string> in json`,
      temperature: 0.7,
      max_tokens: 500,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    if (response.data.choices.length === 0) {
      NcError.internalServerError(
        'Unable to process request, please try again!',
      );
    }

    return JSON5.parse(response.data.choices[0].text);
  }

  async predictColumnType(param: { title: any }) {
    const response = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt: `Within types: ID,LinkToAnotherRecord,ForeignKey,SingleLineText,LongText,Attachment,Checkbox,MultiSelect,SingleSelect,Date,Year,Time,PhoneNumber,Email,URL,Number,Decimal,Currency,Percent,Duration,Rating,Formula,QR,Barcode,Count,DateTime,CreateTime,AutoNumber,Geometry select most appropiate type for '${param.title}' column:`,
      temperature: 0.7,
      max_tokens: 200,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    if (response.data.choices.length === 0) {
      NcError.internalServerError(
        'Unable to process request, please try again!',
      );
    }

    return {
      data: response.data.choices[0].text.replace(/\r?\n|\r/g, '').trim(),
    };
  }

  async predictFormula(param: {
    table: string;
    data: {
      columns: string[];
      title: string;
    };
  }) {
    const colPrompt = param.data.columns.map((col) => `'${col}'`).join(', ');
    const response = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt: `'${param.table}' table has ${colPrompt} columns
    write formula for '${param.data.title}' using basic arithmetics and wrapping each column name with {}`,
      temperature: 0.7,
      max_tokens: 1000,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    if (response.data.choices.length === 0) {
      NcError.internalServerError(
        'Unable to process request, please try again!',
      );
    }

    return {
      data: response.data.choices[0].text.replace(/\r?\n|\r/g, '').trim(),
    };
  }

  async predictNextColumn(param: { columns: any; table: any }) {
    const colPrompt = param.columns.length
      ? param.columns.map((col) => `'${col}'`).join(', ')
      : 'no';
    const response = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt: `Using types: SingleLineText,LongText,Attachment,Checkbox,MultiSelect,SingleSelect,Date,Year,Time,PhoneNumber,Email,URL,Number,Decimal,Currency,Percent,Duration,Rating,Formula,QR,Barcode,Count,DateTime,CreateTime,AutoNumber,Geometry
    Predict next 5 column for '${param.table}' table which have ${colPrompt} columns and return as json { title: string; type: string }[]`,
      temperature: 0.7,
      max_tokens: 200,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    if (response.data.choices.length === 0) {
      NcError.internalServerError(
        'Unable to process request, please try again!',
      );
    }

    return {
      data: JSON5.parse(
        response.data.choices[0].text.replace(/\r?\n|\r/g, '').trim(),
      ),
    };
  }

  async predictNextFormulas(param: { columns: any; table: any }) {
    const colPrompt = param.columns.length
      ? param.columns.map((col) => `'${col}'`).join(', ')
      : 'no';
    const response = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt: `${param.table} table has ${colPrompt} columns
    write possible formulas using basic arithmetic operators and wrapping each column name with {} and return as json { title: string, formula: string }[]
    `,
      temperature: 0.7,
      max_tokens: 200,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    if (response.data.choices.length === 0) {
      NcError.internalServerError(
        'Unable to process request, please try again!',
      );
    }

    return {
      data: JSON5.parse(
        response.data.choices[0].text.replace(/\r?\n|\r/g, '').trim(),
      ),
    };
  }

  async generateSinglePrompt(param: { prompt: string }) {
    const response = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt: `${param.prompt}`,
      temperature: 0.7,
      max_tokens: 1000,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    if (response.data.choices.length === 0) {
      NcError.internalServerError(
        'Unable to process request, please try again!',
      );
    }

    return { data: response.data.choices[0].text };
  }

  async generateSQL(param: { prompt: string; base: any }) {
    let schemaPrompt = '';
    for (const table of param.base.tables) {
      const colPrompt = table.columns.map((col) => `'${col.title}'`).join(', ');
      schemaPrompt += `Table '${table.title}', columns = [${colPrompt}]\n`;
    }

    const response = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt: `${schemaPrompt}\n\nGenerate SQL (${param.base.type}) SELECT query for '${param.prompt}' return in form of Object<{ data: Array<{ description: string; query: string }> }> with escaped new lines as parsable JSON:`,
      temperature: 0.7,
      max_tokens: 1500,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    if (response.data.choices.length === 0) {
      NcError.internalServerError(
        'Unable to process request, please try again!',
      );
    }

    return {
      data: JSON5.parse(response.data.choices[0].text)?.data || [],
    };
  }

  async repairSQL(param: { sql: string; base: any }) {
    let schemaPrompt = '';
    for (const table of param.base.tables) {
      const colPrompt = table.columns.map((col) => `'${col.title}'`).join(', ');
      schemaPrompt += `Table '${table.title}', columns = [${colPrompt}]\n`;
    }

    const response = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt: `${schemaPrompt}\n\nFix following query using SQL (${param.base.type})\n\`${param.sql}\`\nreturn fixed query in form of Object<{ data: { query: string } }> with escaped new lines as parsable JSON:\n`,
      temperature: 0.7,
      max_tokens: 1500,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    if (response.data.choices.length === 0) {
      NcError.internalServerError(
        'Unable to process request, please try again!',
      );
    }

    return {
      data: JSON5.parse(response.data.choices[0].text)?.data || [],
    };
  }

  async generateQueryPrompt(param: { prompt: string; max: number; base: any }) {
    let schemaPrompt = '';
    for (const table of param.base.tables) {
      const colPrompt = table.columns.map((col) => `'${col.title}'`).join(', ');
      schemaPrompt += `Table '${table.title}', columns = [${colPrompt}]\n`;
    }

    const response = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt: `${schemaPrompt}\n\nPossible ${
        param.prompt
      } queries using JOIN, GROUP BY and HAVING using SQL (${
        param.base.type
      }) (maximum ${
        param.max || 5
      }) in form of Object<{ data: Array<{ description: string; query: string }> }> with escaped new lines as parsable JSON:\n`,
      temperature: 0.7,
      max_tokens: 1500,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    if (response.data.choices.length === 0) {
      NcError.internalServerError(
        'Unable to process request, please try again!',
      );
    }

    return {
      data: JSON5.parse(response.data.choices[0].text)?.data || [],
    };
  }

  async genericGPT(param: { body: any }) {
    // req.body.operation
    // req.body.data

    try {
      switch (param.body.operation) {
        case 'selectOptions':
          // req.body.data.table, req.body.data.schema, req.body.data.title
          return await this.selectOptionsMagic(param.body.data);
        case 'predictColumnType':
          // req.body.data.title
          return await this.predictColumnType(param.body.data);
        case 'predictFormula':
          // req.body.data.columns, req.body.table, req.body.data.title
          return await this.predictFormula(param.body);
        case 'predictNextColumn':
          // req.body.data.columns, req.body.data.table
          return await this.predictNextColumn(param.body.data);
        case 'predictNextFormulas':
          // req.body.data.columns, req.body.data.table
          return await this.predictNextFormulas(param.body.data);
        case 'generateSinglePrompt':
          // req.body.data.prompt
          return await this.generateSinglePrompt(param.body.data);
        case 'generateSQL':
          // req.body.data.prompt req.body.data.base (type, tables (title, columns))
          return await this.generateSQL(param.body.data);
        case 'repairSQL':
          // req.body.data.sql req.body.data.base (type, tables (title, columns))
          return await this.repairSQL(param.body.data);
        case 'generateQueryPrompt':
          // req.body.data.prompt req.body.data.max req.body.data.base (type, tables (title, columns))
          return await this.generateQueryPrompt(param.body.data);
        default:
          return NcError.internalServerError('Unknown operation');
      }
    } catch (e) {
      console.log(e);
      return NcError.internalServerError(
        'Unable to process request, please try again!',
      );
    }
  }

  async runSelectQuery(param: { baseId: string; query: string }) {
    // req.body.baseId
    // req.body.query

    const base = await Base.get(param.baseId);
    if (!base) return NcError.internalServerError('Base not found');

    try {
      const statements = identify(param.query);
      if (statements.length === 0)
        return NcError.internalServerError('Please provide a query');
      if (statements.length > 1)
        return NcError.internalServerError('Only single query is supported');
      if (statements[0].type !== 'SELECT')
        return NcError.internalServerError('Only SELECT queries are supported');
    } catch (e) {
      return NcError.internalServerError(e);
    }

    const baseDriver = (await NcConnectionMgrv2.getSqlClient(base))?.knex;

    if (!baseDriver)
      return NcError.internalServerError('Unable to connect to base');

    try {
      const sqlClientType = baseDriver.clientType();

      const result = await baseDriver.raw(param.query);

      if (sqlClientType === 'mysql' || sqlClientType === 'mysql2') {
        return { data: result[0] };
      } else if (sqlClientType === 'pg') {
        return { data: result.rows };
      } else if (sqlClientType === 'snowflake') {
        return { data: result.rows };
      } else {
        return { data: result };
      }
    } catch (e) {
      return NcError.internalServerError(e.message);
    }
  }
}
