// eslint-disable-file no-fallthrough
import { Logger } from '@nestjs/common';
import { ClientType } from 'nocodb-sdk';
import type { NcApiVersion } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { PagedResponseImpl } from '~/helpers/PagedResponse';
import type { NcContext } from '~/interface/config';
import type { Filter, Model, View } from '~/models';
import { DBQueryClient } from '~/dbQueryClient';
import { Source } from '~/models';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

const logger = new Logger('mysql-helpers');

export async function singleQueryRead(
  context: NcContext,
  ctx: {
    model: Model;
    view: View;
    source: Source;
    params;
    id: string | Record<string, any>;
    getHiddenColumn?: boolean;
    throwErrorIfInvalidParams?: boolean;
    validateFormula?: boolean;
    apiVersion?: NcApiVersion;
    extractOnlyPrimaries?: boolean;
    extractOrderColumn?: boolean;
    customConditions?: Filter[];
    ignoreRls?: boolean;
    deletedOnly?: boolean;
  },
): Promise<PagedResponseImpl<Record<string, any>>> {
  const dbQuery = DBQueryClient.get(ClientType.MYSQL);
  return dbQuery.singleQueryRead(context, ctx);
}

export async function singleQueryList(
  context: NcContext,
  ctx: {
    model: Model;
    view?: View;
    source: Source;
    params;
    throwErrorIfInvalidParams?: boolean;
    validateFormula?: boolean;
    ignorePagination?: boolean;
    limitOverride?: number;
    baseModel?: IBaseModelSqlV2;
    customConditions?: Filter[];
    getHiddenColumns?: boolean;
    apiVersion?: NcApiVersion;
    includeSortAndFilterColumns?: boolean;
    skipPaginateWrapper?: boolean;
    skipSortBasedOnOrderCol?: boolean;
    ignoreViewFilterAndSort?: boolean;
    ignoreRls?: boolean;
    deletedOnly?: boolean;
  },
): Promise<
  PagedResponseImpl<Record<string, any>> | Array<Record<string, any>>
> {
  const dbQuery = DBQueryClient.get(ClientType.MYSQL);
  return dbQuery.singleQueryList(context, ctx);
}

// allow if MySQL version is >= 8.0.0 and not MariaDB
// const version = await base.getDbVersion();
export async function isMysqlVersionSupported(
  context: NcContext,
  source: Source,
) {
  // if version is not present in meta then get it from db
  // and store it in base meta for later use
  let meta;
  if (!source.meta || !('dbVersion' in source.meta)) {
    try {
      const sqlClient = await NcConnectionMgrv2.getSqlClient(source);
      meta = source.meta || {};
      meta.dbVersion = await sqlClient
        .raw('select version() as version')
        .then((res) => res[0][0].version);

      Source.update(context, source.id, {
        meta,
      })
        .then(() => {
          // do nothing, it's just to update the base meta and not wait for it
        })
        .catch((err) => {
          logger.error(err);
        });
    } catch {
      // disable if the version extraction fails
      return false;
    }
  } else {
    meta = source.meta;
  }

  if (!meta || !meta.dbVersion || /Maria/i.test(meta.dbVersion)) {
    return false;
  }

  // check if version is >= 8.0.0
  return +meta.dbVersion.split('.')[0] >= 8;
}
