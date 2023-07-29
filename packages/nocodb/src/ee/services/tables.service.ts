import { Injectable } from '@nestjs/common';
import DOMPurify from 'isomorphic-dompurify';
import { AppEvents } from 'nocodb-sdk';
import { Configuration, OpenAIApi } from 'openai';
import { TablesService as TableServiceCE } from 'src/services/tables.service';
import type { UserType } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import getTableNameAlias from '~/helpers/getTableName';
import { Model, Project } from '~/models';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { MetaDiffsService } from '~/services/meta-diffs.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { ColumnsService } from '~/services/columns.service';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

@Injectable()
export class TablesService extends TableServiceCE {
  constructor(
    private metaDiffServiceEE: MetaDiffsService,
    private appHooksServiceEE: AppHooksService,
    private readonly columnsServiceEE: ColumnsService,
  ) {
    super(metaDiffServiceEE, appHooksServiceEE, columnsServiceEE);
  }

  async tableCreateMagic(param: {
    projectId: string;
    baseId: string;
    tableName: string;
    title: string;
    user?: UserType;
  }) {
    const tableCreateBody = {
      tableName: param.tableName,
      title: param.title,
    };

    const project = await Project.getWithInfo(param.projectId);
    let base = project.bases[0];

    if (param.baseId) {
      base = project.bases.find((b) => b.id === param.baseId);
    }

    if (
      !tableCreateBody.tableName ||
      (project.prefix && project.prefix === tableCreateBody.tableName)
    ) {
      NcError.badRequest(
        'Missing table name `table_name` property in request body',
      );
    }

    if (base.is_meta && project.prefix) {
      if (!tableCreateBody.tableName.startsWith(project.prefix)) {
        tableCreateBody.tableName = `${project.prefix}_${tableCreateBody.tableName}`;
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
        project_id: project.id,
        base_id: base.id,
      }))
    ) {
      NcError.badRequest('Duplicate table name');
    }

    if (!param.title) {
      tableCreateBody.title = getTableNameAlias(
        tableCreateBody.tableName,
        project.prefix,
        base,
      );
    }

    if (
      !(await Model.checkAliasAvailable({
        title: tableCreateBody.title,
        project_id: project.id,
        base_id: base.id,
      }))
    ) {
      NcError.badRequest('Duplicate table alias');
    }

    const sqlClient = await NcConnectionMgrv2.getSqlClient(base);

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
      projectId: project.id,
      baseId: base.id,
    });

    const table = await Model.getByIdOrName({
      project_id: project.id,
      base_id: base.id,
      table_name: param.tableName,
    });

    this.appHooksServiceEE.emit(AppEvents.TABLE_CREATE, {
      table,
      user: param.user,
    });

    return table;
  }

  async schemaMagic(param: {
    projectId: string;
    baseId: string;
    schemaName: string;
    title: string;
  }) {
    const project = await Project.getWithInfo(param.projectId);
    let base = project.bases[0];
    let prefixPrompt = '';

    if (param.baseId) {
      base = project.bases.find((b) => b.id === param.baseId);
    }

    if (base.is_meta && project.prefix) {
      prefixPrompt = ` prefixing tables with '${project.prefix}_'`;
    }
    /* if (
      !param.schemaName ||
      (project.prefix && project.prefix === param.schemaName)
    ) {
      NcError.badRequest(
        'Missing table name `table_name` property in request body'
      );
    }
    if (base.is_meta && project.prefix) {
      if (!param.schemaName.startsWith(project.prefix)) {
        param.schemaName = `${project.prefix}_${param.schemaName}`;
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
        project_id: project.id,
        base_id: base.id,
      }))
    ) {
      NcError.badRequest('Duplicate table name');
    }
    if (!req.body.title) {
      req.body.title = getTableNameAlias(
        param.schemaName,
        project.prefix,
        base
      );
    }
    if (
      !(await Model.checkAliasAvailable({
        title: req.body.title,
        project_id: project.id,
        base_id: base.id,
      }))
    ) {
      NcError.badRequest('Duplicate table alias');
    } */

    const sqlClient = await NcConnectionMgrv2.getSqlClient(base);

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
        projectId: project.id,
        baseId: base.id,
      });

      return true;
    } catch (e) {
      console.log(e);
      return false;
    }
  }
}
