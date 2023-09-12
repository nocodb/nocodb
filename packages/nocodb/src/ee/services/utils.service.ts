import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { Configuration, OpenAIApi } from 'openai';
import JSON5 from 'json5';
import { identify } from 'sql-query-identifier';
import { ConfigService } from '@nestjs/config';
import { UtilsService as UtilsServiceCE } from 'src/services/utils.service';
import type { AppConfig } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { Base } from '~/models';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

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

export interface AllMeta {
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
export class UtilsService extends UtilsServiceCE {
  constructor(protected readonly configService: ConfigService<AppConfig>) {
    super(configService);
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

  extractResultOrNull = (results: PromiseSettledResult<any>[]) => {
    return results.map((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      console.log(result.reason);
      return null;
    });
  };
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

  async appInfo(param: { req: { ncSiteUrl: string } }) {
    const result = await super.appInfo(param);

    // in cloud decide telemetry enabled or not based on PostHog API key presence
    result.teleEnabled = !!process.env.NC_CLOUD_POSTHOG_API_KEY;

    return result;
  }
}
