import { Injectable } from '@nestjs/common';
import DOMPurify from 'isomorphic-dompurify';
import { AppEvents } from 'nocodb-sdk';
import { Configuration, OpenAIApi } from 'openai';
import { TablesService as TableServiceCE } from 'src/services/tables.service';
import type { TableReqType, UserType } from 'nocodb-sdk';
import type { User } from '~/models';
import type { NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import getTableNameAlias from '~/helpers/getTableName';
import { Base, Model } from '~/models';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { MetaDiffsService } from '~/services/meta-diffs.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { ColumnsService } from '~/services/columns.service';
import getWorkspaceForBase from '~/utils/getWorkspaceForBase';
import { getLimit, PlanLimitTypes } from '~/plan-limits';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

@Injectable()
export class TablesService extends TableServiceCE {
  constructor(
    protected readonly metaDiffServiceEE: MetaDiffsService,
    protected readonly appHooksServiceEE: AppHooksService,
    protected readonly columnsServiceEE: ColumnsService,
  ) {
    super(metaDiffServiceEE, appHooksServiceEE, columnsServiceEE);
  }

  async tableCreate(param: {
    baseId: string;
    sourceId?: string;
    table: TableReqType;
    user: User | UserType;
    req?: NcRequest;
  }) {
    console.time('tableCreate-1');
    const base = await Base.getWithInfo(param.baseId);
    let source = base.sources[0];

    if (source.id !== param.sourceId) {
      source = base.sources.find((b) => b.id === param.sourceId);
    }

    if (source && source.isMeta()) {
      const workspaceId = await getWorkspaceForBase(base.id);

      const tablesInSource = await Noco.ncMeta.metaCount(
        null,
        null,
        MetaTable.MODELS,
        {
          condition: {
            source_id: source.id,
          },
        },
      );

      const tableLimitForWorkspace = await getLimit(
        PlanLimitTypes.TABLE_LIMIT,
        workspaceId,
      );

      if (tablesInSource >= tableLimitForWorkspace) {
        NcError.badRequest(
          `Only ${tableLimitForWorkspace} tables are allowed, for more please upgrade your plan`,
        );
      }
    }

    console.timeEnd('tableCreate-1');
    return super.tableCreate(param);
  }

  async tableCreateMagic(param: {
    baseId: string;
    sourceId: string;
    tableName: string;
    title: string;
    user?: UserType;
    req: NcRequest;
  }) {
    const tableCreateBody = {
      tableName: param.tableName,
      title: param.title,
    };

    const base = await Base.getWithInfo(param.baseId);
    let source = base.sources[0];

    if (param.sourceId) {
      source = base.sources.find((b) => b.id === param.sourceId);
    }

    if (
      !tableCreateBody.tableName ||
      (base.prefix && base.prefix === tableCreateBody.tableName)
    ) {
      NcError.badRequest(
        'Missing table name `table_name` property in request body',
      );
    }

    if (source.is_meta && base.prefix) {
      if (!tableCreateBody.tableName.startsWith(base.prefix)) {
        tableCreateBody.tableName = `${base.prefix}_${tableCreateBody.tableName}`;
      }
    }

    tableCreateBody.tableName = DOMPurify.sanitize(tableCreateBody.tableName);

    // validate table name
    if (/^\s+|\s+$/.test(tableCreateBody.tableName)) {
      NcError.badRequest(
        'Leading or trailing whitespace not allowed in table names',
      );
    }

    if (
      !(await Model.checkTitleAvailable({
        table_name: tableCreateBody.tableName,
        base_id: base.id,
        source_id: source.id,
      }))
    ) {
      NcError.badRequest('Duplicate table name');
    }

    if (!param.title) {
      tableCreateBody.title = getTableNameAlias(
        tableCreateBody.tableName,
        base.prefix,
        source,
      );
    }

    if (
      !(await Model.checkAliasAvailable({
        title: tableCreateBody.title,
        base_id: base.id,
        source_id: source.id,
      }))
    ) {
      NcError.badRequest('Duplicate table alias');
    }

    const sqlClient = await NcConnectionMgrv2.getSqlClient(source);

    let tableNameLengthLimit = 255;
    const sqlClientType = sqlClient.knex.clientType();
    if (sqlClientType === 'mysql2' || sqlClientType === 'mysql') {
      tableNameLengthLimit = 64;
    } else if (sqlClientType === 'pg') {
      tableNameLengthLimit = 63;
    } else if (sqlClientType === 'mssql') {
      tableNameLengthLimit = 128;
    }

    if (tableCreateBody.tableName.length > tableNameLengthLimit) {
      NcError.badRequest(
        `Table name exceeds ${tableNameLengthLimit} characters`,
      );
    }

    const response = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt: `create best schema for '${tableCreateBody.title}' table without foreign and not null constraints using SQL (${sqlClientType}) and name table as '${tableCreateBody.tableName}':`,
      temperature: 0.7,
      max_tokens: 2048,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    if (response.data.choices.length === 0) {
      NcError.badRequest('Failed to generate table schema');
    }

    const schema = response.data.choices[0].text;

    for (const sql of schema.split(';')) {
      if (sql.trim().length === 0) continue;
      await sqlClient.raw(sql);
    }

    await this.metaDiffServiceEE.baseMetaDiffSync({
      baseId: base.id,
      sourceId: source.id,
      req: param.req,
    });

    const table = await Model.getByIdOrName({
      base_id: base.id,
      source_id: source.id,
      table_name: param.tableName,
    });

    this.appHooksServiceEE.emit(AppEvents.TABLE_CREATE, {
      table,
      user: param.user,
      req: param.req,
    });

    return table;
  }

  async schemaMagic(param: {
    baseId: string;
    sourceId: string;
    schemaName: string;
    title: string;
    req: NcRequest;
  }) {
    const base = await Base.getWithInfo(param.baseId);
    let source = base.sources[0];
    let prefixPrompt = '';

    if (param.sourceId) {
      source = base.sources.find((b) => b.id === param.sourceId);
    }

    if (source.is_meta && base.prefix) {
      prefixPrompt = ` prefixing tables with '${base.prefix}_'`;
    }
    /* if (
      !param.schemaName ||
      (base.prefix && base.prefix === param.schemaName)
    ) {
      NcError.badRequest(
        'Missing table name `table_name` property in request body'
      );
    }
    if (base.is_meta && base.prefix) {
      if (!param.schemaName.startsWith(base.prefix)) {
        param.schemaName = `${base.prefix}_${param.schemaName}`;
      }
    }
    param.schemaName = DOMPurify.sanitize(param.schemaName);
    // validate table name
    if (/^\s+|\s+$/.test(param.schemaName)) {
      NcError.badRequest(
        'Leading or trailing whitespace not allowed in table names'
      );
    }
    if (
      !(await Model.checkTitleAvailable({
        table_name: param.schemaName,
        base_id: base.id,
        source_id: base.id,
      }))
    ) {
      NcError.badRequest('Duplicate table name');
    }
    if (!req.body.title) {
      req.body.title = getTableNameAlias(
        param.schemaName,
        base.prefix,
        base
      );
    }
    if (
      !(await Model.checkAliasAvailable({
        title: req.body.title,
        base_id: base.id,
        source_id: base.id,
      }))
    ) {
      NcError.badRequest('Duplicate table alias');
    } */

    const sqlClient = await NcConnectionMgrv2.getSqlClient(source);

    let tableNameLengthLimit = 255;
    const sqlClientType = sqlClient.knex.clientType();
    if (sqlClientType === 'mysql2' || sqlClientType === 'mysql') {
      tableNameLengthLimit = 64;
    } else if (sqlClientType === 'pg') {
      tableNameLengthLimit = 63;
    } else if (sqlClientType === 'mssql') {
      tableNameLengthLimit = 128;
    }

    if (param.schemaName.length > tableNameLengthLimit) {
      NcError.badRequest(
        `Schema name exceeds ${tableNameLengthLimit} characters`,
      );
    }

    const response = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt: `create best schema for '${param.title}' database with proper constraints using SQL (${sqlClientType})${prefixPrompt}:`,
      temperature: 0.7,
      max_tokens: 3000,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    if (response.data.choices.length === 0) {
      NcError.badRequest('Failed to generate schema');
    }

    const schema = response.data.choices[0].text.replace(/ NOT NULL/gi, ' ');

    try {
      for (const sql of schema.split(';')) {
        if (sql.trim().length === 0) continue;
        await sqlClient.raw(sql);
      }

      await this.metaDiffServiceEE.baseMetaDiffSync({
        baseId: base.id,
        sourceId: source.id,
        req: param.req,
      });

      return true;
    } catch (e) {
      console.log(e);
      return false;
    }
  }
}
