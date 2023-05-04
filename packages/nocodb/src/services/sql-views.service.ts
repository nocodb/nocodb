import { Injectable } from '@nestjs/common';
import {
  AuditOperationSubTypes,
  AuditOperationTypes,
  ModelTypes,
} from 'nocodb-sdk';
import DOMPurify from 'isomorphic-dompurify';
import { Audit, Column, Model, Project } from '../models';
import { NcError } from '../helpers/catchError';
import getTableNameAlias, { getColumnNameAlias } from '../helpers/getTableName';
import ProjectMgrv2 from '../db/sql-mgr/v2/ProjectMgrv2';
import NcConnectionMgrv2 from '../utils/common/NcConnectionMgrv2';
import mapDefaultDisplayValue from '../helpers/mapDefaultDisplayValue';
import getColumnUiType from '../helpers/getColumnUiType';
import type { UserType } from 'nocodb-sdk';

@Injectable()
export class SqlViewsService {
  async sqlViewCreate(param: {
    clientIp: string;
    projectId: string;
    baseId: string;
    body: {
      view_name: string;
      title: string;
      view_definition?: string;
    };
    user: UserType;
  }) {
    const body = { ...param.body };

    const project = await Project.getWithInfo(param.projectId);
    let base = project.bases[0];

    if (param.baseId) {
      base = project.bases.find((b) => b.id === param.baseId);
    }

    if (
      !body.view_name ||
      (project.prefix && project.prefix === body.view_name)
    ) {
      NcError.badRequest(
        'Missing table name `view_name` property in request body',
      );
    }

    if (base.is_meta && project.prefix) {
      if (!body.view_name.startsWith(project.prefix)) {
        body.view_name = `${project.prefix}_${body.view_name}`;
      }
    }

    body.view_name = DOMPurify.sanitize(body.view_name);

    // validate table name
    if (/^\s+|\s+$/.test(body.view_name)) {
      NcError.badRequest(
        'Leading or trailing whitespace not allowed in table names',
      );
    }

    if (
      !(await Model.checkTitleAvailable({
        table_name: body.view_name,
        project_id: project.id,
        base_id: base.id,
      }))
    ) {
      NcError.badRequest('Duplicate table name');
    }

    if (!body.title) {
      body.title = getTableNameAlias(body.view_name, project.prefix, base);
    }

    if (
      !(await Model.checkAliasAvailable({
        title: body.title,
        project_id: project.id,
        base_id: base.id,
      }))
    ) {
      NcError.badRequest('Duplicate table alias');
    }

    const sqlMgr = await ProjectMgrv2.getSqlMgr(project);

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

    if (body.view_name.length > tableNameLengthLimit) {
      NcError.badRequest(
        `Table name exceeds ${tableNameLengthLimit} characters`,
      );
    }

    await sqlMgr.sqlOpPlus(base, 'viewCreate', {
      view_name: body.view_name,
      view_definition: body.view_definition,
    });

    const columns: Array<
      Omit<Column, 'column_name' | 'title'> & {
        cn: string;
        system?: boolean;
      }
    > = (await sqlClient.columnList({ tn: body.view_name }))?.data?.list;

    const tables = await Model.list({
      project_id: project.id,
      base_id: base.id,
    });

    await Audit.insert({
      project_id: project.id,
      base_id: base.id,
      op_type: AuditOperationTypes.TABLE,
      op_sub_type: AuditOperationSubTypes.CREATE,
      user: param?.user?.email,
      description: `created view ${body.view_name} with alias ${body.title}  `,
      ip: param.clientIp,
    }).then(() => {});

    mapDefaultDisplayValue(columns);

    const model = await Model.insert(project.id, base.id, {
      table_name: body.view_name,
      title: getTableNameAlias(body.view_name, project.prefix, base),
      type: ModelTypes.VIEW,
      order: +(tables?.pop()?.order ?? 0) + 1,
    });

    let colOrder = 1;

    for (const column of columns) {
      await Column.insert({
        fk_model_id: model.id,
        ...column,
        title: getColumnNameAlias(column.cn, base),
        order: colOrder++,
        uidt: getColumnUiType(base, column),
      });
    }

    return await Model.get(model.id);
  }
}
