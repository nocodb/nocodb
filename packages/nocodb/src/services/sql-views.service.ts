import { Injectable } from '@nestjs/common';
import {
  AuditOperationSubTypes,
  AuditOperationTypes,
  ModelTypes,
} from 'nocodb-sdk';
import DOMPurify from 'isomorphic-dompurify';
import type { UserType } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import getTableNameAlias, { getColumnNameAlias } from '~/helpers/getTableName';
import ProjectMgrv2 from '~/db/sql-mgr/v2/ProjectMgrv2';
import mapDefaultDisplayValue from '~/helpers/mapDefaultDisplayValue';
import getColumnUiType from '~/helpers/getColumnUiType';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { Audit, Base, Column, Model } from '~/models';

@Injectable()
export class SqlViewsService {
  async sqlViewCreate(param: {
    clientIp: string;
    baseId: string;
    sourceId: string;
    body: {
      view_name: string;
      title: string;
      view_definition?: string;
    };
    user: UserType;
  }) {
    NcError.notImplemented();
    return;
    const body = { ...param.body };

    const base = await Base.getWithInfo(param.baseId);
    let source = base.sources[0];

    if (param.sourceId) {
      source = base.sources.find((b) => b.id === param.sourceId);
    }

    if (!body.view_name || (base.prefix && base.prefix === body.view_name)) {
      NcError.badRequest(
        'Missing table name `view_name` property in request body',
      );
    }

    if (source.is_meta && base.prefix) {
      if (!body.view_name.startsWith(base.prefix)) {
        body.view_name = `${base.prefix}_${body.view_name}`;
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
        base_id: base.id,
        source_id: source.id,
      }))
    ) {
      NcError.badRequest('Duplicate table name');
    }

    if (!body.title) {
      body.title = getTableNameAlias(body.view_name, base.prefix, source);
    }

    if (
      !(await Model.checkAliasAvailable({
        title: body.title,
        base_id: base.id,
        source_id: source.id,
      }))
    ) {
      NcError.badRequest('Duplicate table alias');
    }

    const sqlMgr = await ProjectMgrv2.getSqlMgr(base);

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

    if (body.view_name.length > tableNameLengthLimit) {
      NcError.badRequest(
        `Table name exceeds ${tableNameLengthLimit} characters`,
      );
    }

    // TODO - reimplement this
    await sqlMgr.sqlOpPlus(source, 'viewCreate', {
      view_name: body.view_name,
      view_definition: body.view_definition,
    });

    const columns: Array<
      Omit<Column, 'column_name' | 'title'> & {
        cn: string;
        system?: boolean;
      }
    > = (
      await sqlClient.columnList({
        tn: body.view_name,
        schema: source.getConfig()?.schema,
      })
    )?.data?.list;

    const tables = await Model.list({
      base_id: base.id,
      source_id: source.id,
    });

    await Audit.insert({
      base_id: base.id,
      source_id: source.id,
      op_type: AuditOperationTypes.TABLE,
      op_sub_type: AuditOperationSubTypes.CREATE,
      user: param?.user?.email,
      description: `created view ${body.view_name} with alias ${body.title}  `,
      ip: param.clientIp,
    }).then(() => {});

    mapDefaultDisplayValue(columns);

    const model = await Model.insert(base.id, source.id, {
      table_name: body.view_name,
      title: getTableNameAlias(body.view_name, base.prefix, source),
      type: ModelTypes.VIEW,
      order: +(tables?.pop()?.order ?? 0) + 1,
    });

    let colOrder = 1;

    for (const column of columns) {
      await Column.insert({
        fk_model_id: model.id,
        ...column,
        title: getColumnNameAlias(column.cn, source),
        order: colOrder++,
        uidt: getColumnUiType(source, column),
      });
    }

    return await Model.get(model.id);
  }
}
