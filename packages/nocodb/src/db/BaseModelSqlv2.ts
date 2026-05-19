import { Logger } from '@nestjs/common';
import autoBind from 'auto-bind';
import BigNumber from 'bignumber.js';
import DataLoader from 'dataloader';
import PQueue from 'p-queue';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc.js';
import equal from 'fast-deep-equal';
import groupBy from 'lodash/groupBy';
import {
  AuditOperationSubTypes,
  AuditV1OperationTypes,
  ClientType,
  convertDurationToSeconds,
  CURRENT_USER_TOKEN,
  enumColors,
  EventType,
  extractFilterFromXwhere,
  isAIPromptCol,
  isAttachment,
  isBtLikeV2Junction,
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isDeletedCol,
  isLinksOrLTAR,
  isMMOrMMLike,
  isOrderCol,
  isSelfLinkCol,
  isSystemColumn,
  isVirtualCol,
  LongTextAiMetaProp,
  NcApiVersion,
  NcErrorType,
  ncIsNull,
  ncIsNullOrUndefined,
  ncIsObject,
  ncIsUndefined,
  parseHelper,
  PermissionEntity,
  PermissionKey,
  RelationTypes,
  resolveCurrentUserToken,
  UITypes,
} from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import debug from 'debug';
import type {
  BulkAuditV1OperationTypes,
  DataBulkDeletePayload,
  DataBulkUpdateAllPayload,
  DataBulkUpdatePayload,
  DataDeletePayload,
  DataInsertPayload,
  DataLinkPayload,
  DataUnlinkPayload,
  DataUpdatePayload,
  FilterType,
  NcRequest,
  ParsedFormulaNode,
  UpdatePayload,
} from 'nocodb-sdk';
import type { Knex } from 'knex';
import type CustomKnex from '~/db/CustomKnex';
import type { XKnex } from '~/db/CustomKnex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type {
  XcFilter,
  XcFilterWithAlias,
} from '~/db/sql-data-mapper/lib/BaseModel';
import type { NcContext } from '~/interface/config';
import type LookupColumn from '~/models/LookupColumn';
import type { ResolverObj } from '~/utils';
import type {
  FormulaColumn,
  LinkToAnotherRecordColumn,
  SelectOption,
  User,
} from '~/models';
import { LTARColsUpdater } from '~/db/BaseModelSqlv2/ltar-cols-updater';
import { BaseModelDelete } from '~/db/BaseModelSqlv2/delete';
import { ncIsStringHasValue } from '~/db/field-handler/utils/handlerUtils';
import { AttachmentUrlUploadPreparator } from '~/db/BaseModelSqlv2/attachment-url-upload-preparator';
import { FieldHandler } from '~/db/field-handler';
import { selectObject } from '~/db/BaseModelSqlv2/select-object';
import { relationDataFetcher } from '~/db/BaseModelSqlv2/relation-data-fetcher';
import { NestedLinkPreparator } from '~/db/BaseModelSqlv2/nested-link-preparator';
import { baseModelInsert } from '~/db/BaseModelSqlv2/insert';
import {
  addOrRemoveLinks,
  extractCorrespondingLinkColumn,
} from '~/db/BaseModelSqlv2/add-remove-links';
import applyAggregation from '~/db/aggregation';
import { groupBy as baseModelGroupBy } from '~/db/BaseModelSqlv2/group-by';
import conditionV2 from '~/db/conditionV2';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';
import { RelationManager } from '~/db/relation-manager';
import sortV2 from '~/db/sortV2';
import { customValidators } from '~/db/util/customValidators';
import { NcError, OptionsNotExistsError } from '~/helpers/catchError';
import {
  _wherePk,
  applyPaginate,
  dataWrapper,
  extractSortsObject,
  formatDataForAudit,
  getBaseModelSqlFromModelId,
  getCompositePkValue,
  getListArgs,
  haveFormulaColumn,
  isDataAuditEnabled as isDataAuditEnabledFn,
  isPrimitiveType,
  nanoidv2,
  populatePk,
  shouldCascadeLinkCleanup,
  transformObjectKeys,
  validateFuncOnColumn,
} from '~/helpers/dbHelpers';
import { defaultLimitConfig } from '~/helpers/extractLimitAndOffset';
import { extractProps } from '~/helpers/extractProps';
import { extractDisplayNameFromEmail } from '~/utils/emailUtils';
import getAst from '~/helpers/getAst';
import { sanitize, unsanitize } from '~/helpers/sqlSanitize';
import {
  Audit,
  BaseUser,
  Column,
  FileReference,
  Filter,
  GridViewColumn,
  Model,
  PresignedUrl,
  Sort,
  Source,
  View,
} from '~/models';
import Noco from '~/Noco';
import { HANDLE_WEBHOOK } from '~/services/hook-handler.service';
import {
  batchUpdate,
  extractColsMetaForAudit,
  extractExcludedColumnNames,
  generateAuditV1Payload,
  nocoExecute,
  populateUpdatePayloadDiff,
  processConcurrently,
  remapWithAlias,
  removeBlankPropsAndMask,
} from '~/utils';
import { MetaTable } from '~/utils/globals';
import { chunkArray } from '~/utils/tsUtils';
import {
  QUERY_STRING_FIELD_ID_ON_RESULT,
  QUERY_STRING_LINKS_AS_LTAR,
} from '~/constants';
import NocoSocket from '~/socket/NocoSocket';
import { prepareMetaUpdateQuery } from '~/helpers/metaColumnHelpers';
import { supportsThumbnails } from '~/utils/attachmentUtils';
import { Profiler } from '~/helpers/profiler';
import { isTransientError } from '~/helpers/db-error/utils';
import {
  captureForTrace,
  isTraceActive,
} from '~/decorators/trace-command.decorator';
import { isReplay } from '~/helpers/replayScope';

const debugCount = debug('nc:db:query:basemodel:count');

dayjs.extend(utc);

dayjs.extend(timezone);

const logger = new Logger('BaseModelSqlv2');

const JSON_COLUMN_TYPES = [UITypes.Button];

const ORDER_STEP_INCREMENT = 1;

const MAX_RECURSION_DEPTH = 2;

const SELECT_REGEX = /^(\(|)select/i;
const INSERT_REGEX = /^(\(|)insert/i;

export interface ExecAndParseOptions {
  skipDateConversion?: boolean;
  skipAttachmentConversion?: boolean;
  skipSubstitutingColumnIds?: boolean;
  skipUserConversion?: boolean;
  skipJsonConversion?: boolean;
  raw?: boolean;
  first?: boolean;
  bulkAggregate?: boolean;
  apiVersion?: NcApiVersion;
  // Bypass the public-viewer email redaction in convertUserFormat. Used by
  // write paths that need full emails to flow into webhook hooks; they apply
  // the redaction themselves on the response copy after firing hooks.
  skipPublicRedaction?: boolean;
}

/** Args stashed on DataLoader instances for relation queries (hm/mm/bt/oo). */
interface RelationLoaderArgs {
  limit?: number;
  offset?: number;
  fieldsSet?: Set<string>;
  fieldSet?: Set<string>;
}

/** DataLoader with a typed side-channel for query args. */
class DataLoaderWithArgs<K, V> extends DataLoader<K, V> {
  args?: RelationLoaderArgs;
}

// Stable key for `fetchDisplayValueMap`. Two LTAR columns can resolve to the
// same (model, row) but pull different display columns (each LTAR can override
// `fk_display_value_column_id`); without the column id in the key the second
// `set()` would silently overwrite the first.
export const displayValueMapKey = (props: {
  model: Model;
  id: any;
  displayColumn?: Column;
}): string => `${props.model.id}:${props.id}:${props.displayColumn?.id ?? ''}`;

/**
 * Base class for models
 *
 * @class
 * @classdesc Base class for models
 */
class BaseModelSqlv2 implements IBaseModelSqlV2 {
  /** The base database driver (always non-transactional) */
  protected _dbDriver: XKnex;
  /** Optional transaction instance - when set, operations use this instead of _dbDriver */
  protected _activeTransaction?: XKnex;
  protected _viewId: string;
  public get viewId() {
    return this._viewId;
  }
  protected _proto: any;
  /**
   * Serial query queue shared across the entire resolution tree.
   * All DataLoader batch callbacks are wrapped with queue.add() so that
   * actual DB queries execute one at a time, preventing connection pool
   * exhaustion while nocoExecute fires all .load() calls in parallel.
   * Propagated to child BaseModel instances via Model.getBaseModelSQL({ queryQueue }).
   */
  protected _queryQueue: PQueue;
  protected _columns = {};
  protected _softDeleteFilter: Promise<Knex.QueryCallback | null> | undefined;
  protected source: Source;
  public model: Model;
  public context: NcContext;
  public schema?: string;
  public formulaDryRunFailed?: boolean;
  protected logger = new Logger('BaseModelSqlv2');

  public static config: any = defaultLimitConfig;

  /**
   * Returns the active database driver for operations.
   * If a transaction is active, returns the transaction; otherwise returns the base driver.
   * This ensures all operations within a transaction use the same transaction context.
   */
  public get dbDriver() {
    return this._activeTransaction || this._dbDriver;
  }

  /**
   * Creates a new BaseModelSqlv2 instance that uses the base database driver
   * instead of any active transaction. This is useful for operations that need
   * to run outside of the current transaction context, such as broadcasting
   * link updates to avoid transaction conflicts.
   *
   * @returns A new BaseModelSqlv2 instance with non-transactional database access
   */
  public getNonTransactionalClone() {
    return new BaseModelSqlv2({
      dbDriver: this._dbDriver,
      model: this.model,
      viewId: this.viewId,
      context: this.context,
      schema: this.schema,
      queryQueue: this._queryQueue,
    });
  }

  /**
   * Returns the base (non-transactional) database driver.
   * This is always the original database connection, regardless of transaction state.
   */
  public get knex() {
    return this._dbDriver;
  }

  constructor({
    dbDriver,
    model,
    viewId,
    context,
    schema,
    transaction,
    queryQueue,
  }: {
    [key: string]: any;
    model: Model;
    schema?: string;
  }) {
    this._dbDriver = dbDriver;
    this._activeTransaction = transaction;
    this.model = model;
    this._viewId = viewId;
    this.context = context;
    this.schema = schema;
    // Reuse parent's queue if provided (nested resolution), otherwise create
    // a new one. Concurrency defaults to 1 (serial) to prevent pool exhaustion.
    this._queryQueue =
      queryQueue ??
      new PQueue({
        concurrency: +(process.env.NC_DB_QUERY_QUEUE_CONCURRENCY || 1),
      });
    autoBind(this);
  }

  public async readByPk(
    id?: any,
    validateFormula = false,
    query: any = {},
    {
      ignoreView = false,
      getHiddenColumn = false,
      throwErrorIfInvalidParams = false,
      extractOnlyPrimaries = false,
      apiVersion,
      extractOrderColumn = false,
      ignoreRls = false,
      fk_display_value_column_id,
      skipPublicRedaction = false,
    }: {
      ignoreView?: boolean;
      getHiddenColumn?: boolean;
      throwErrorIfInvalidParams?: boolean;
      extractOnlyPrimaries?: boolean;
      apiVersion?: NcApiVersion;
      extractOrderColumn?: boolean;
      ignoreRls?: boolean;
      fk_display_value_column_id?: string | null;
      skipPublicRedaction?: boolean;
    } = {},
  ): Promise<any> {
    const qb = this.dbDriver(this.tnPath);
    const { ast, dependencyFields, parsedQuery } = await getAst(this.context, {
      query,
      model: this.model,
      view: ignoreView
        ? null
        : this.viewId && (await View.get(this.context, this.viewId)),
      getHiddenColumn,
      throwErrorIfInvalidParams,
      extractOnlyPrimaries,
      extractOrderColumn,
      apiVersion,
      fk_display_value_column_id,
      skipSubstitutingColumnIds:
        this.context.api_version === NcApiVersion.V3 &&
        query?.[QUERY_STRING_FIELD_ID_ON_RESULT] === 'true',
    });

    const linksAsLtar =
      apiVersion === NcApiVersion.V3 &&
      query?.[QUERY_STRING_LINKS_AS_LTAR] === 'true';

    await this.selectObject({
      ...(dependencyFields ?? {}),
      qb,
      validateFormula,
      linksAsLtar,
    });

    qb.where(_wherePk(this.model.primaryKeys, id));

    // Apply RLS conditions to readByPk
    const rlsConditionsReadByPk = ignoreRls
      ? []
      : await this.getRlsConditions();
    if (rlsConditionsReadByPk.length) {
      await conditionV2(
        this,
        [new Filter({ children: rlsConditionsReadByPk, is_group: true })],
        qb,
      );
    }

    // Exclude soft-deleted records
    const softDeleteFilterReadByPk = await this.getSoftDeleteFilter();
    if (softDeleteFilterReadByPk) {
      qb.where(softDeleteFilterReadByPk);
    }

    let data;

    try {
      data = await this.execAndParse(qb, null, {
        first: true,
        apiVersion,
        skipSubstitutingColumnIds:
          this.context.api_version === NcApiVersion.V3 &&
          query?.[QUERY_STRING_FIELD_ID_ON_RESULT] === 'true',
        skipPublicRedaction,
      });
    } catch (e) {
      const isTransient = isTransientError(e);

      if (
        isTransient ||
        validateFormula ||
        !haveFormulaColumn(await this.model.getColumns(this.context))
      )
        throw e;
      logger.log(e);
      return this.readByPk(id, true, query, {
        apiVersion,
        skipPublicRedaction,
      });
    }

    if (data) {
      const proto = await this.getProto({ linksAsLtar });
      data.__proto__ = proto;
    }

    return data
      ? await nocoExecute(ast, data as ResolverObj, {}, parsedQuery)
      : null;
  }

  public async readByPkFromModel(
    model = this.model,
    viewId?: string,
    extractDisplayValueData?: boolean,
    ...rest: Parameters<BaseModelSqlv2['readByPk']>
  ): Promise<any> {
    let context = this.context;
    let data;
    if (this.model.id === model.id) {
      data = await this.readByPk(...rest);
    } else {
      context = { ...this.context, base_id: model.base_id };
      const baseModel = await Model.getBaseModelSQL(context, {
        model,
        viewId: viewId,
        dbDriver: this.dbDriver,
        queryQueue: this._queryQueue,
      });

      data = await baseModel.readByPk(...rest);
    }

    // load columns if not loaded already
    await model.getCachedColumns(context);

    if (extractDisplayValueData) {
      return data ? data[model.displayValue.title] ?? null : '';
    }

    return data;
  }

  public async readOnlyPrimariesByPkFromModel(
    props: {
      model: Model;
      id: any;
      extractDisplayValueData?: boolean;
      // When set, the returned display value is taken from this column
      // (the LTAR's custom display value override) and this column is
      // requested in the underlying getAst so it's present in the record.
      displayColumn?: Column;
    }[],
  ): Promise<any[]> {
    if (!props.length) return [];

    // Small inputs (1-2 items): direct readByPk is cheaper than chunkList setup
    if (props.length <= 2) {
      const results: any[] = [];
      for (const {
        model,
        id,
        extractDisplayValueData = true,
        displayColumn,
      } of props) {
        const data = await this.readByPkFromModel(
          model,
          undefined,
          false, // don't let readByPkFromModel extract PV — we pick the field ourselves below
          id,
          false,
          {},
          {
            ignoreView: true,
            getHiddenColumn: true,
            extractOnlyPrimaries: true,
            fk_display_value_column_id: displayColumn?.id,
          },
        );
        if (extractDisplayValueData) {
          const titleKey = displayColumn?.title ?? model.displayValue?.title;
          results.push(data ? data[titleKey] ?? null : '');
        } else {
          results.push(data);
        }
      }
      return results;
    }

    // Bulk: group by model and batch-fetch via chunkList (1 SQL query per chunk).
    // Group key is model.id + displayColumn.id so each group has a single AST.
    const modelGroups = new Map<
      string,
      { model: Model; pks: Set<string>; displayColumn?: Column }
    >();

    for (const { model, id, displayColumn } of props) {
      const key = `${model.id}::${displayColumn?.id ?? ''}`;
      let group = modelGroups.get(key);
      if (!group) {
        group = { model, pks: new Set(), displayColumn };
        modelGroups.set(key, group);
      }
      group.pks.add(String(id));
    }

    // Fetch all records per (model, displayColumn) using chunkList
    const recordsByKey = new Map<string, Map<string, any>>();

    for (const [key, { model, pks, displayColumn }] of modelGroups) {
      const context = { ...this.context, base_id: model.base_id };
      const baseModel =
        this.model.id === model.id
          ? this
          : await Model.getBaseModelSQL(context, {
              model,
              dbDriver: this.dbDriver,
              queryQueue: this._queryQueue,
            });

      const records = await baseModel.chunkList({
        pks: [...pks],
        extractOnlyPrimaries: true,
        fk_display_value_column_id: displayColumn?.id,
      });

      await model.getCachedColumns(context);

      const pkMap = new Map<string, any>();
      for (const record of records) {
        const pk = baseModel.extractPksValues(record, true);
        pkMap.set(String(pk), record);
      }
      recordsByKey.set(key, pkMap);
    }

    // Reassemble results in original order
    return props.map(
      ({ model, id, extractDisplayValueData = true, displayColumn }) => {
        const key = `${model.id}::${displayColumn?.id ?? ''}`;
        const record = recordsByKey.get(key)?.get(String(id));
        if (extractDisplayValueData) {
          const titleKey = displayColumn?.title ?? model.displayValue?.title;
          return record ? record[titleKey] ?? null : '';
        }
        return record ?? null;
      },
    );
  }

  public async fetchDisplayValueMap(
    props: { model: Model; id: any; displayColumn?: Column }[],
  ): Promise<Map<string, any>> {
    const dvMap = new Map<string, any>();
    if (!props.length) return dvMap;
    const values = await this.readOnlyPrimariesByPkFromModel(props);
    for (let i = 0; i < props.length; i++) {
      dvMap.set(displayValueMapKey(props[i]), values[i]);
    }
    return dvMap;
  }

  // Hook for resolving a per-LTAR display value override Column for the ref
  // side. No override is applied here; subclasses may override.
  protected async resolveLtarDisplayCol(
    _columnId: string | undefined,
    _refModel: Model,
  ): Promise<Column | undefined> {
    return undefined;
  }

  // Hook for resolving the paired (reverse) LTAR's display value override
  // Column against the source `model`. No override is applied here.
  protected async resolveReverseLtarDisplayCol(
    _columnId: string | undefined,
    _model: Model,
    _refModel: Model,
  ): Promise<Column | undefined> {
    return undefined;
  }

  // Hook for resolving the LTAR's display value override Column against
  // `model` (own direction or paired). No override is applied here.
  public async getLtarDisplayColumnOverride(
    _ltarColumn: Column,
    _model: Model,
  ): Promise<Column | undefined> {
    return undefined;
  }

  // Batch hook for resolving LTAR display value overrides per unique columnId.
  // `hasAny: false` is the fast-out gate that lets callers skip threading
  // `displayColumn` through `fetchDisplayValueMap`/`displayValueMapKey`.
  protected async resolveLtarOverrideColsForBatch(
    _auditObjs: Array<{
      columnId?: string;
      model: Model;
      refModel?: Model;
    }>,
  ): Promise<{
    refByColId: Map<string, Column | undefined>;
    sourceByColId: Map<string, Column | undefined>;
    hasAny: boolean;
  }> {
    return {
      refByColId: new Map(),
      sourceByColId: new Map(),
      hasAny: false,
    };
  }

  public async exist(id?: any): Promise<any> {
    const qb = this.dbDriver(this.tnPath);
    await this.model.getColumns(this.context);
    const pks = this.model.primaryKeys;

    if (!pks.length) return false;

    qb.select(pks[0].column_name);

    if ((id + '').split('___').length != pks?.length) {
      return false;
    }
    qb.where(_wherePk(pks, id)).first();

    // Apply RLS conditions to exist check
    const rlsConditionsExist = await this.getRlsConditions();
    if (rlsConditionsExist.length) {
      await conditionV2(
        this,
        [new Filter({ children: rlsConditionsExist, is_group: true })],
        qb,
      );
    }

    // Exclude soft-deleted records
    const softDeleteFilterExist = await this.getSoftDeleteFilter();
    if (softDeleteFilterExist) {
      qb.where(softDeleteFilterExist);
    }

    return !!(await this.execAndParse(qb, null, { raw: true, first: true }));
  }

  // todo: add support for sortArrJson
  public async findOne(
    args: {
      where?: string;
      filterArr?: Filter[];
      sort?: string | string[];
    } = {},
    validateFormula = false,
  ): Promise<any> {
    const columns = await this.model.getColumns(this.context);
    const { where, ...rest } = this._getListArgs(args);
    const qb = this.dbDriver(this.tnPath);
    await this.selectObject({ ...args, qb, validateFormula, columns });

    const aliasColObjMap = await this.model.getAliasColObjMap(
      this.context,
      columns,
    );
    const sorts = extractSortsObject(this.context, rest?.sort, aliasColObjMap);
    const { filters: filterObj } = extractFilterFromXwhere(
      this.context,
      where,
      aliasColObjMap,
    );

    // Resolve RLS conditions for findOne
    const rlsConditionsFindOne = await this.getRlsConditions();
    const rlsFilterGroupFindOne = rlsConditionsFindOne.length
      ? [new Filter({ children: rlsConditionsFindOne, is_group: true })]
      : [];

    await conditionV2(
      this,
      [
        ...rlsFilterGroupFindOne,
        new Filter({
          children: args.filterArr || [],
          is_group: true,
          logical_op: 'and',
        }),
        new Filter({
          children: filterObj,
          is_group: true,
          logical_op: 'and',
        }),
      ],
      qb,
    );

    // Exclude soft-deleted records
    const softDeleteFilterFindOne = await this.getSoftDeleteFilter();
    if (softDeleteFilterFindOne) {
      qb.where(softDeleteFilterFindOne);
    }

    const orderColumn = columns.find((c) => isOrderCol(c));

    if (Array.isArray(sorts) && sorts?.length) {
      await sortV2(this, sorts, qb);
    } else if (orderColumn) {
      qb.orderBy(orderColumn.column_name);
    } else if (this.model.primaryKey) {
      // sort by primary key if not autogenerated string
      // if autogenerated string sort by created_at column if present
      qb.orderBy(this.model.primaryKey.column_name);
    }

    let data;

    try {
      data = await this.execAndParse(qb, null, { first: true });
    } catch (e) {
      const isTransient = isTransientError(e);

      if (isTransient || validateFormula || !haveFormulaColumn(columns))
        throw e;
      logger.log(e);
      return this.findOne(args, true);
    }

    if (data) {
      data.__proto__ = await this.getProto();
    }
    return data;
  }

  public async list(
    args: {
      where?: string;
      limit?;
      offset?;
      filterArr?: Filter[];
      sortArr?: Sort[];
      sort?: string | string[];
      fieldsSet?: Set<string>;
      limitOverride?: number;
      pks?: string;
      customConditions?: Filter[];
      apiVersion?: NcApiVersion;
      linksAsLtar?: boolean | string;
    } = {},
    options: {
      ignoreViewFilterAndSort?: boolean;
      ignorePagination?: boolean;
      validateFormula?: boolean;
      throwErrorIfInvalidParams?: boolean;
      limitOverride?: number;
      skipSubstitutingColumnIds?: boolean;
      skipSortBasedOnOrderCol?: boolean;
      ignoreRls?: boolean;
      deletedOnly?: boolean;
    } = {},
  ): Promise<any> {
    const {
      ignoreViewFilterAndSort = false,
      ignorePagination = false,
      validateFormula = false,
      throwErrorIfInvalidParams = false,
      limitOverride,
      skipSortBasedOnOrderCol = false,
      ignoreRls: ignoreRlsOpt = false,
      deletedOnly = false,
    } = options;

    const columns = await this.model.getColumns(this.context);

    const { where, fields, ...rest } = this._getListArgs(args);

    const qb = this.dbDriver(this.tnPath);

    const linksAsLtar =
      args.linksAsLtar === true || args.linksAsLtar === 'true';

    await this.selectObject({
      qb,
      fieldsSet: args.fieldsSet,
      viewId: this.viewId,
      validateFormula,
      columns,
      linksAsLtar,
    });
    if (+rest?.shuffle) {
      await this.shuffle({ qb });
    }

    const aliasColObjMap = await this.model.getAliasColObjMap(
      this.context,
      columns,
    );
    let sorts = extractSortsObject(
      this.context,
      rest?.sort,
      aliasColObjMap,
      throwErrorIfInvalidParams,
      args?.apiVersion,
    );
    const { filters: filterObj } = extractFilterFromXwhere(
      this.context,
      where,
      aliasColObjMap,
      throwErrorIfInvalidParams,
    );
    // Resolve RLS (Row-Level Security) conditions
    const rlsConditions = ignoreRlsOpt ? [] : await this.getRlsConditions();
    const rlsFilterGroup = rlsConditions.length
      ? [new Filter({ children: rlsConditions, is_group: true })]
      : [];

    // Soft-delete filter: exclude deleted records normally, or select ONLY deleted for trash listing
    if (deletedOnly) {
      const deletedCol = this.model.columns.find((c) => isDeletedCol(c));
      if (deletedCol) {
        qb.where(deletedCol.column_name, true);
      } else {
        // No soft-delete column — no trashed records can exist, return nothing
        qb.whereRaw('1 = 0');
      }
    } else {
      const softDeleteFilterList = await this.getSoftDeleteFilter();
      if (softDeleteFilterList) {
        qb.where(softDeleteFilterList);
      }
    }

    // todo: replace with view id
    if (!ignoreViewFilterAndSort && this.viewId) {
      await conditionV2(
        this,
        [
          // RLS filters — always first, always applied
          ...rlsFilterGroup,
          ...(args.customConditions
            ? [
                new Filter({
                  children: args.customConditions,
                  is_group: true,
                }),
              ]
            : []),
          new Filter({
            children:
              (await Filter.rootFilterList(this.context, {
                viewId: this.viewId,
              })) || [],
            is_group: true,
          }),
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and',
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
        ],
        qb,
        undefined,
        throwErrorIfInvalidParams,
      );

      if (!sorts)
        sorts = args.sortArr?.length
          ? args.sortArr
          : await Sort.list(this.context, { viewId: this.viewId });

      await sortV2(this, sorts, qb, undefined, throwErrorIfInvalidParams);
    } else {
      await conditionV2(
        this,
        [
          // RLS filters — always first, always applied
          ...rlsFilterGroup,
          ...(args.customConditions
            ? [
                new Filter({
                  children: args.customConditions,
                  is_group: true,
                }),
              ]
            : []),
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and',
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
        ],
        qb,
        undefined,
        throwErrorIfInvalidParams,
      );

      if (!sorts) sorts = args.sortArr;

      await sortV2(this, sorts, qb, undefined, throwErrorIfInvalidParams);
    }

    // skip sorting based on order column if specified in options
    if (!skipSortBasedOnOrderCol) {
      const orderColumn = columns.find((c) => isOrderCol(c));

      // sort by order column if present
      if (orderColumn) {
        qb.orderBy(orderColumn.column_name);
      }
    }

    // Ensure stable ordering:
    // - Use auto-increment PK if available
    // - Otherwise, fallback to system CreatedTime
    // This avoids issues when order column has duplicates
    if (this.model.primaryKey && this.model.primaryKey.ai) {
      qb.orderBy(this.model.primaryKey.column_name);
    } else {
      const createdCol = this.model.columns.find(
        (c) => c.uidt === UITypes.CreatedTime && c.system,
      );
      if (createdCol) qb.orderBy(createdCol.column_name);
    }

    if (rest.pks) {
      const pks = rest.pks.split(',');
      qb.where((innerQb) => {
        pks.forEach((pk) => {
          innerQb.orWhere(_wherePk(this.model.primaryKeys, pk));
        });
        return innerQb;
      });
    }

    // if limitOverride is provided, use it as limit for the query (for internal usage eg. calendar, export)
    if (!ignorePagination) {
      if (!limitOverride) {
        applyPaginate(qb, rest);
      } else {
        applyPaginate(qb, { ...rest, limit: limitOverride });
      }
    }
    const proto = await this.getProto({ linksAsLtar });

    let data;
    try {
      data = await this.execAndParse(qb, undefined, {
        apiVersion: args.apiVersion ?? this.context.api_version,
        skipSubstitutingColumnIds: options.skipSubstitutingColumnIds,
      });
    } catch (e) {
      // Check if this is a transient error (connection/timeout issue)
      const isTransient = isTransientError(e);

      if (isTransient || validateFormula || !haveFormulaColumn(columns))
        throw e;
      logger.log(e);
      return this.list(args, {
        ignoreViewFilterAndSort,
        ignorePagination,
        validateFormula: true,
      });
    }

    return data?.map((d) => {
      d.__proto__ = proto;
      return d;
    });
  }

  public async count(
    args: {
      where?: string;
      limit?;
      filterArr?: Filter[];
      customConditions?: Filter[];
    } = {},
    ignoreViewFilterAndSort = false,
    throwErrorIfInvalidParams = false,
  ): Promise<any> {
    const columns = await this.model.getColumns(this.context);
    const { where } = this._getListArgs(args);

    const qb = this.dbDriver(this.tnPath);

    // qb.xwhere(where, await this.model.getAliasColMapping());
    const aliasColObjMap = await this.model.getAliasColObjMap(
      this.context,
      columns,
    );
    const { filters: filterObj } = extractFilterFromXwhere(
      this.context,
      where,
      aliasColObjMap,
      throwErrorIfInvalidParams,
    );

    // Resolve RLS conditions for count
    const rlsConditionsCount = await this.getRlsConditions();
    const rlsFilterGroupCount = rlsConditionsCount.length
      ? [new Filter({ children: rlsConditionsCount, is_group: true })]
      : [];

    // Exclude soft-deleted records
    const softDeleteFilterCount = await this.getSoftDeleteFilter();
    if (softDeleteFilterCount) {
      qb.where(softDeleteFilterCount);
    }

    if (!ignoreViewFilterAndSort && this.viewId) {
      await conditionV2(
        this,
        [
          ...rlsFilterGroupCount,
          ...(args.customConditions
            ? [
                new Filter({
                  children: args.customConditions,
                  is_group: true,
                }),
              ]
            : []),
          new Filter({
            children:
              (await Filter.rootFilterList(this.context, {
                viewId: this.viewId,
              })) || [],
            is_group: true,
          }),
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and',
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
          ...(args.filterArr || []),
        ],
        qb,
        undefined,
        throwErrorIfInvalidParams,
      );
    } else {
      await conditionV2(
        this,
        [
          ...rlsFilterGroupCount,
          ...(args.customConditions
            ? [
                new Filter({
                  children: args.customConditions,
                  is_group: true,
                }),
              ]
            : []),
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and',
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
          ...(args.filterArr || []),
        ],
        qb,
        undefined,
        throwErrorIfInvalidParams,
      );
    }

    qb.count(sanitize(this.model.primaryKey?.column_name) || '*', {
      as: 'count',
    }).first();
    debugCount(qb.toQuery());
    return (await this.execAndParse(qb, null, { raw: true, first: true }))
      ?.count;
  }

  async groupByAndAggregate(
    aggregateColumnName: string,
    aggregateFn: string,
    args: {
      where?: string;
      limit?;
      offset?;
      sortBy?: {
        column_name: string;
        direction: 'asc' | 'desc';
      };
      groupByColumnName?: string;
    },
  ) {
    const columns = await this.model.getColumns(this.context);

    const { where, ...rest } = this._getListArgs(args);

    const qb = this.dbDriver(this.tnPath);
    const aggregateStatement = `${aggregateColumnName} as ${aggregateFn}__${aggregateColumnName}`;

    if (typeof qb[aggregateFn] === 'function') {
      qb[aggregateFn](aggregateStatement);
    } else {
      throw new Error(`Unsupported aggregate function: ${aggregateFn}`);
    }

    qb.select(args.groupByColumnName);

    if (+rest?.shuffle) {
      await this.shuffle({ qb });
    }

    const aliasColObjMap = await this.model.getAliasColObjMap(
      this.context,
      columns,
    );

    const { filters: filterObj } = extractFilterFromXwhere(
      this.context,
      where,
      aliasColObjMap,
    );
    // Resolve RLS conditions for groupByAndAggregate
    const rlsConditionsGBA = await this.getRlsConditions();
    const rlsFilterGroupGBA = rlsConditionsGBA.length
      ? [new Filter({ children: rlsConditionsGBA, is_group: true })]
      : [];

    await conditionV2(
      this,
      [
        ...rlsFilterGroupGBA,
        new Filter({
          children: filterObj,
          is_group: true,
          logical_op: 'and',
        }),
      ],
      qb,
    );

    // Exclude soft-deleted records
    const softDeleteFilterGBA = await this.getSoftDeleteFilter();
    if (softDeleteFilterGBA) {
      qb.where(softDeleteFilterGBA);
    }

    if (args?.groupByColumnName) {
      qb.groupBy(args?.groupByColumnName);
    }
    if (args?.sortBy?.column_name) {
      qb.orderBy(args.sortBy.column_name, args.sortBy.direction);
    }
    applyPaginate(qb, rest);
    return await this.execAndParse(qb);
  }

  async bulkGroupByCount(
    args: {
      filterArr?: Filter[];
    },
    bulkFilterList: {
      alias: string;
      where?: string;
      sort: string;
      column_name: string;
      filterArr?: Filter[];
    }[],
    _view: View,
  ) {
    // Prepend RLS conditions to filterArr for bulkGroupByCount
    const rlsConditionsBGBC = await this.getRlsConditions();
    if (rlsConditionsBGBC.length) {
      args = {
        ...args,
        filterArr: [
          new Filter({ children: rlsConditionsBGBC, is_group: true }),
          ...(args.filterArr || []),
        ],
      };
    }
    return await baseModelGroupBy(this, logger).bulkCount(
      args,
      bulkFilterList,
      _view,
    );
  }

  async bulkGroupBy(
    args: {
      filterArr?: Filter[];
    },
    bulkFilterList: {
      alias: string;
      where?: string;
      column_name: string;
      limit?;
      offset?;
      sort?: string;
      filterArr?: Filter[];
      sortArr?: Sort[];
    }[],
    _view: View,
  ) {
    // Prepend RLS conditions to filterArr for bulkGroupBy
    const rlsConditionsBGB = await this.getRlsConditions();
    if (rlsConditionsBGB.length) {
      args = {
        ...args,
        filterArr: [
          new Filter({ children: rlsConditionsBGB, is_group: true }),
          ...(args.filterArr || []),
        ],
      };
    }
    return await baseModelGroupBy(this, logger).bulkList(
      args,
      bulkFilterList,
      _view,
    );
  }

  async bulkAggregate(
    args: {
      filterArr?: Filter[];
    },
    bulkFilterList: Array<{
      alias: string;
      where?: string;
      filterArrJson?: string | Filter[];
    }>,
    view?: View,
  ) {
    try {
      if (!bulkFilterList?.length) {
        return {};
      }

      const { where, aggregation } = this._getListArgs(args);

      const columns = await this.model.getColumns(this.context);

      let viewColumns: any[];
      if (this.viewId) {
        viewColumns = (
          await GridViewColumn.list(this.context, this.viewId)
        ).filter((c) => {
          const col = this.model.columnsById[c.fk_column_id];
          return c.show && (view?.show_system_fields || !isSystemColumn(col));
        });

        // By default, the aggregation is done based on the columns configured in the view
        // If the aggregation parameter is provided, only the columns mentioned in the aggregation parameter are considered
        // Also the aggregation type from the parameter is given preference over the aggregation type configured in the view
        if (aggregation?.length) {
          viewColumns = viewColumns
            .map((c) => {
              const agg = aggregation.find((a) => a.field === c.fk_column_id);
              return new GridViewColumn({
                ...c,
                show: !!agg,
                aggregation: agg ? agg.type : c.aggregation,
              });
            })
            .filter((c) => c.show);
        }
      } else {
        // If no viewId, use all model columns or those specified in aggregation
        if (aggregation?.length) {
          viewColumns = aggregation
            .map((agg) => {
              const col = this.model.columnsById[agg.field];
              if (!col) return null;
              return {
                fk_column_id: col.id,
                aggregation: agg.type,
                show: true,
              };
            })
            .filter(Boolean);
        } else {
          viewColumns = [];
        }
      }

      const aliasColObjMap = await this.model.getAliasColObjMap(
        this.context,
        columns,
      );

      const qb = this.dbDriver(this.tnPath);

      const aggregateExpressions = {};

      // Construct aggregate expressions for each view column
      for (const viewColumn of viewColumns) {
        const col = this.model.columnsById[viewColumn.fk_column_id];
        if (
          !col ||
          !viewColumn.aggregation ||
          (isLinksOrLTAR(col) && col.system)
        )
          continue;

        const aliasFieldName = col.id;
        const aggSql = await applyAggregation({
          baseModelSqlv2: this,
          aggregation: viewColumn.aggregation,
          column: col,
        });

        if (aggSql) {
          aggregateExpressions[aliasFieldName] = aggSql;
        }
      }

      if (!Object.keys(aggregateExpressions).length) {
        return {};
      }

      let viewFilterList = [];
      if (this.viewId) {
        viewFilterList = await Filter.rootFilterList(this.context, {
          viewId: this.viewId,
        });
      }

      // Resolve RLS conditions for bulkAggregate
      const rlsConditionsBulkAgg = await this.getRlsConditions();
      const rlsFilterGroupBulkAgg = rlsConditionsBulkAgg.length
        ? [new Filter({ children: rlsConditionsBulkAgg, is_group: true })]
        : [];

      const selectors = [] as Array<Knex.Raw>;
      // Generate a knex raw query for each filter in the bulkFilterList
      for (const f of bulkFilterList) {
        const tQb = this.dbDriver(this.tnPath);
        const { filters: aggFilter } = extractFilterFromXwhere(
          this.context,
          f.where,
          aliasColObjMap,
        );
        let aggFilterJson = f.filterArrJson;
        try {
          aggFilterJson = JSON.parse(aggFilterJson as any);
        } catch (_e) {}

        await conditionV2(
          this,
          [
            ...rlsFilterGroupBulkAgg,
            ...(this.viewId
              ? [
                  new Filter({
                    children: viewFilterList || [],
                    is_group: true,
                  }),
                ]
              : []),
            new Filter({
              children: args.filterArr || [],
              is_group: true,
              logical_op: 'and',
            }),
            new Filter({
              children: extractFilterFromXwhere(
                this.context,
                where,
                aliasColObjMap,
              ).filters,
              is_group: true,
              logical_op: 'and',
            }),
            new Filter({
              children: aggFilter,
              is_group: true,
              logical_op: 'and',
            }),
            ...(aggFilterJson
              ? [
                  new Filter({
                    children: aggFilterJson as Filter[],
                    is_group: true,
                  }),
                ]
              : []),
          ],
          tQb,
        );

        // Exclude soft-deleted records
        const softDeleteFilterBulkAgg = await this.getSoftDeleteFilter();
        if (softDeleteFilterBulkAgg) {
          tQb.where(softDeleteFilterBulkAgg);
        }

        let jsonBuildObject;

        switch (this.dbDriver.client.config.client) {
          case 'pg': {
            jsonBuildObject = this.dbDriver.raw(
              `JSON_BUILD_OBJECT(${Object.keys(aggregateExpressions)
                .map((key) => {
                  return `'${key}', ${aggregateExpressions[key]}`;
                })
                .join(', ')})`,
            );

            break;
          }
          case 'mysql2': {
            jsonBuildObject = this.dbDriver.raw(`JSON_OBJECT(
              ${Object.keys(aggregateExpressions)
                .map((key) => `'${key}', ${aggregateExpressions[key]}`)
                .join(', ')})`);
            break;
          }

          case 'sqlite3': {
            jsonBuildObject = this.dbDriver.raw(`json_object(
                ${Object.keys(aggregateExpressions)
                  .map((key) => `'${key}', ${aggregateExpressions[key]}`)
                  .join(', ')})`);
            break;
          }
          default:
            NcError.get(this.context).notImplemented(
              'This database is not supported for bulk aggregation',
            );
        }

        tQb.select(jsonBuildObject);

        if (this.dbDriver.client.config.client === 'mysql2') {
          selectors.push(
            this.dbDriver.raw('JSON_UNQUOTE(??) as ??', [
              jsonBuildObject,
              `${f.alias}`,
            ]),
          );
        } else {
          selectors.push(this.dbDriver.raw('(??) as ??', [tQb, `${f.alias}`]));
        }
      }

      qb.select(...selectors);

      qb.limit(1);

      return await this.execAndParse(qb, null, {
        first: true,
        bulkAggregate: true,
      });
    } catch (err) {
      logger.log(err);
      return [];
    }
  }

  async aggregate(args: { filterArr?: Filter[]; where?: string }, view?: View) {
    try {
      const { where, aggregation } = this._getListArgs(args);

      const columns = await this.model.getColumns(this.context);

      let viewColumns: any[];
      if (this.viewId) {
        viewColumns = (
          await GridViewColumn.list(this.context, this.viewId)
        ).filter((c) => {
          const col = this.model.columnsById[c.fk_column_id];
          return c.show && (view?.show_system_fields || !isSystemColumn(col));
        });

        if (aggregation?.length) {
          viewColumns = viewColumns
            .map((c) => {
              const agg = aggregation.find((a) => a.field === c.fk_column_id);
              return new GridViewColumn({
                ...c,
                show: !!agg,
                aggregation: agg ? agg.type : c.aggregation,
              });
            })
            .filter((c) => c.show);
        }
      } else {
        if (aggregation?.length) {
          viewColumns = aggregation
            .map((agg) => {
              const col = this.model.columnsById[agg.field];
              if (!col) return null;
              return {
                fk_column_id: col.id,
                aggregation: agg.type,
                show: true,
              };
            })
            .filter(Boolean);
        } else {
          viewColumns = [];
        }
      }

      const aliasColObjMap = await this.model.getAliasColObjMap(
        this.context,
        columns,
      );

      const qb = this.dbDriver(this.tnPath);

      // Apply filers from view configuration, filterArr and where parameter
      const { filters: filterObj } = extractFilterFromXwhere(
        this.context,
        where,
        aliasColObjMap,
      );
      // Resolve RLS conditions for aggregate
      const rlsConditionsAgg = await this.getRlsConditions();
      const rlsFilterGroupAgg = rlsConditionsAgg.length
        ? [new Filter({ children: rlsConditionsAgg, is_group: true })]
        : [];

      await conditionV2(
        this,
        [
          ...rlsFilterGroupAgg,
          ...(this.viewId
            ? [
                new Filter({
                  children:
                    (await Filter.rootFilterList(this.context, {
                      viewId: this.viewId,
                    })) || [],
                  is_group: true,
                }),
              ]
            : []),
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and',
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
        ],
        qb,
      );

      // Exclude soft-deleted records
      const softDeleteFilterAgg = await this.getSoftDeleteFilter();
      if (softDeleteFilterAgg) {
        qb.where(softDeleteFilterAgg);
      }

      const selectors: Array<Knex.Raw> = [];

      // Generating a knex raw aggregation query for each column in the view
      await Promise.all(
        viewColumns.map(async (viewColumn) => {
          const col = columns.find((c) => c.id === viewColumn.fk_column_id);
          if (!col) return null;

          if (!viewColumn.aggregation) return;

          // Skip system LTAR columns
          if (isLinksOrLTAR(col) && col.system) return;

          const aggSql = await applyAggregation({
            baseModelSqlv2: this,
            aggregation: viewColumn.aggregation,
            column: col,
            alias: col.id,
          });

          if (aggSql) selectors.push(this.dbDriver.raw(aggSql));
        }),
      );

      // If no queries are generated, return empty object
      if (!selectors.length) {
        return {};
      }

      qb.select(...selectors);

      // Some aggregation on Date, DateTime related columns may generate result other than Date, DateTime
      // So skip the date conversion
      const data = await this.execAndParse(qb, null, {
        first: true,
        skipDateConversion: true,
        skipAttachmentConversion: true,
        skipUserConversion: true,
      });

      return data;
    } catch (e) {
      logger.log(e);
      return {};
    }
  }

  async groupBy(args: {
    where?: string;
    column_name: string;
    subGroupColumnName?: string;
    limit?;
    offset?;
    sort?: string | string[];
    filterArr?: Filter[];
    sortArr?: Sort[];
    minCount?: number; // Minimum count for groups (e.g., 2 to get only duplicates)
  }) {
    // Prepend RLS conditions to filterArr for groupBy
    const rlsConditionsGB = await this.getRlsConditions();
    if (rlsConditionsGB.length) {
      args = {
        ...args,
        filterArr: [
          new Filter({ children: rlsConditionsGB, is_group: true }),
          ...(args.filterArr || []),
        ],
      };
    }
    return await baseModelGroupBy(this, logger).list(args);
  }

  async groupByCount(args: {
    where?: string;
    column_name: string;
    limit?;
    offset?;
    filterArr?: Filter[];
    minCount?: number; // Minimum count for groups (e.g., 2 to get only duplicates)
  }) {
    // Prepend RLS conditions to filterArr for groupByCount
    const rlsConditionsGBC = await this.getRlsConditions();
    if (rlsConditionsGBC.length) {
      args = {
        ...args,
        filterArr: [
          new Filter({ children: rlsConditionsGBC, is_group: true }),
          ...(args.filterArr || []),
        ],
      };
    }
    return await baseModelGroupBy(this, logger).count(args);
  }

  // #region relation list count part 1
  async multipleHmList(
    param: {
      colId: string;
      ids: any[];
      apiVersion?: NcApiVersion;
      nested?: boolean;
      linksAsLtar?: boolean;
    },
    args: { limit?; offset?; fieldsSet?: Set<string> } = {},
  ) {
    return relationDataFetcher({ baseModel: this, logger }).multipleHmList(
      param,
      args,
    );
  }

  public async mmList(
    param: {
      colId: string;
      parentId: any;
      apiVersion?: NcApiVersion;
      nested?: boolean;
      linksAsLtar?: boolean;
    },
    args: { limit?; offset?; fieldsSet?: Set<string> } = {},
    selectAllRecords = false,
  ) {
    return relationDataFetcher({ baseModel: this, logger }).mmList(
      param,
      args,
      selectAllRecords,
    );
  }

  public async mmRead(
    param: {
      colId: string;
      parentId: any;
    },
    args: { fieldsSet?: Set<string> } = {},
  ) {
    return relationDataFetcher({ baseModel: this, logger }).mmRead(param, args);
  }

  async multipleHmListCount({ colId, ids }) {
    return relationDataFetcher({
      baseModel: this,
      logger,
    }).multipleHmListCount({
      colId,
      ids,
    });
  }

  async hmList(
    param: {
      colId: string;
      id: any;
      apiVersion?: NcApiVersion;
      nested?: boolean;
      linksAsLtar?: boolean;
    },
    args: { limit?; offset?; fieldSet?: Set<string> } = {},
  ) {
    return relationDataFetcher({ baseModel: this, logger }).hmList(param, args);
  }

  async hmListCount({ colId, id }, args) {
    return relationDataFetcher({ baseModel: this, logger }).hmListCount(
      { colId, id },
      args,
    );
  }

  public async multipleMmList(
    param: {
      colId: string;
      parentIds: any[];
      apiVersion?: NcApiVersion;
      nested?: boolean;
      linksAsLtar?: boolean;
    },
    args: { limit?; offset?; fieldsSet?: Set<string> } = {},
  ) {
    return relationDataFetcher({ baseModel: this, logger }).multipleMmList(
      param,
      args,
    );
  }

  public async multipleMmListCount({ colId, parentIds }) {
    return relationDataFetcher({
      baseModel: this,
      logger,
    }).multipleMmListCount({
      colId,
      parentIds,
    });
  }

  public async mmListCount({ colId, parentId }, args) {
    return relationDataFetcher({ baseModel: this, logger }).mmListCount(
      { colId, parentId },
      args,
    );
  }

  // #endregion relation list count part 1

  // #region relation list count part 2
  // todo: naming & optimizing
  public async getMmChildrenExcludedListCount(
    { colId, pid = null },
    args,
  ): Promise<any> {
    return relationDataFetcher({
      baseModel: this,
      logger,
    }).getMmChildrenExcludedListCount({ colId, pid }, args);
  }

  // todo: naming & optimizing
  public async getMmChildrenExcludedList(
    { colId, pid = null },
    args,
  ): Promise<any> {
    return relationDataFetcher({
      baseModel: this,
      logger,
    }).getMmChildrenExcludedList({ colId, pid }, args);
  }

  // todo: naming & optimizing
  public async getHmChildrenExcludedList(
    { colId, pid = null },
    args,
  ): Promise<any> {
    return relationDataFetcher({
      baseModel: this,
      logger,
    }).getHmChildrenExcludedList({ colId, pid }, args);
  }

  // todo: naming & optimizing
  public async getHmChildrenExcludedListCount(
    { colId, pid = null },
    args,
  ): Promise<any> {
    return relationDataFetcher({
      baseModel: this,
      logger,
    }).getHmChildrenExcludedListCount({ colId, pid }, args);
  }

  // todo: naming & optimizing
  public async getExcludedOneToOneChildrenList(
    { colId, cid = null },
    args,
  ): Promise<any> {
    return relationDataFetcher({
      baseModel: this,
      logger,
    }).getExcludedOneToOneChildrenList({ colId, cid }, args);
  }

  // todo: naming & optimizing
  public async getBtChildrenExcludedListCount(
    { colId, cid = null },
    args,
  ): Promise<any> {
    return relationDataFetcher({
      baseModel: this,
      logger,
    }).getBtChildrenExcludedListCount({ colId, cid }, args);
  }

  // todo: naming & optimizing
  public async countExcludedOneToOneChildren(
    { colId, cid = null },
    args,
  ): Promise<any> {
    return relationDataFetcher({
      baseModel: this,
      logger,
    }).countExcludedOneToOneChildren({ colId, cid }, args);
  }

  // todo: naming & optimizing
  public async getBtChildrenExcludedList(
    { colId, cid = null },
    args,
  ): Promise<any> {
    return relationDataFetcher({
      baseModel: this,
      logger,
    }).getBtChildrenExcludedList({ colId, cid }, args);
  }

  // #endregion relation list count part 2

  async applySortAndFilter({
    table,
    view,
    where,
    qb,
    sort,
    filters,
    onlySort = false,
    skipViewFilter = false,
    skipSort = false,
    prioritizePvSort = false,
  }: {
    table: Model;
    view?: View;
    where: string;
    filters?: Filter[];
    qb;
    sort?: string | string[];
    onlySort?: boolean;
    skipViewFilter?: boolean;
    skipSort?: boolean;
    prioritizePvSort?: boolean;
  }) {
    const childAliasColMap = await table.getAliasColObjMap(this.context);

    if (!onlySort) {
      const { filters: filter } = extractFilterFromXwhere(
        this.context,
        where,
        childAliasColMap,
      );
      await conditionV2(
        this,
        [
          ...(view && !skipViewFilter
            ? [
                new Filter({
                  children:
                    (await Filter.rootFilterList(this.context, {
                      viewId: view.id,
                    })) || [],
                  is_group: true,
                }),
              ]
            : []),
          ...(filter || []),
          ...(filters || []),
        ],
        qb,
      );
    }

    // Highest priority: when searching in LTAR dropdowns, sort PV (display value) matches first
    if (where && !skipSort && prioritizePvSort) {
      if (!table.columns?.length) {
        await table.getColumns(this.context);
      }
      const pvColumn = table.columns?.find((col) => col.pv);
      // TODO: support virtual PV columns (Formula, Lookup, Rollup) by building
      // the formula/rollup SQL via formulaQueryBuilderv2 and using it in the CASE WHEN
      if (pvColumn?.column_name && !isVirtualCol(pvColumn)) {
        // Use the structured filter array from extractFilterFromXwhere
        // instead of re-parsing the raw where string
        const { filters: parsedFilters } = extractFilterFromXwhere(
          this.context,
          where,
          childAliasColMap,
        );

        // Find the PV column's filter — may be a top-level filter or inside an OR group
        const pvFilter = (parsedFilters || [])
          .flatMap((f) => (f.is_group ? f.children || [] : [f]))
          .find((f) => f.fk_column_id === pvColumn.id);

        if (pvFilter?.value != null) {
          const op = pvFilter.comparison_op;
          // Currently handles 'like' (text PV) and 'eq' (numeric/date PV)
          // — the only operators the LTAR dropdown search sends
          if (op === 'like') {
            qb.orderByRaw(
              this.dbDriver.raw(
                `CASE WHEN LOWER(??) LIKE ? THEN 0 ELSE 1 END`,
                [pvColumn.column_name, String(pvFilter.value).toLowerCase()],
              ),
            );
          } else if (op === 'eq') {
            qb.orderByRaw(
              this.dbDriver.raw(`CASE WHEN ?? = ? THEN 0 ELSE 1 END`, [
                pvColumn.column_name,
                pvFilter.value,
              ]),
            );
          }
        }
      }
    }

    // First priority on v3 api is sort object if exists
    if (this.context.api_version === NcApiVersion.V3 && sort) {
      const sortObj = extractSortsObject(
        this.context,
        sort,
        childAliasColMap,
        undefined,
        this.context.api_version,
      );
      if (sortObj) await sortV2(this, sortObj, qb);
    }
    // First priority View Sort
    if (view && !skipSort) {
      const sortObj = await view.getSorts(this.context);
      await sortV2(this, sortObj, qb);
    }

    if (!skipSort) {
      let orderColumnBy = '';
      await table.getColumns(this.context);
      const orderCol = table.columns?.find((col) => col.uidt === UITypes.Order);
      const childTn = await this.getTnPath(table);
      if (orderCol) {
        orderColumnBy = `${childTn}.${orderCol.column_name}`;
      }
      // Second priority Order column sort
      if (orderColumnBy) {
        qb.orderBy(orderColumnBy);
      }

      // backward compatibility: if not v3, apply sort on this priority
      if (this.context.api_version !== NcApiVersion.V3) {
        // Third priority query string sort
        if (!sort) return;
        const sortObj = extractSortsObject(
          this.context,
          sort,
          childAliasColMap,
          undefined,
          this.context.api_version,
        );
        if (sortObj) await sortV2(this, sortObj, qb);
      }
    }
  }

  async getSelectQueryBuilderForFormula(
    column: Column<any>,
    tableAlias?: string,
    validateFormula = false,
    aliasToColumnBuilder = {},
  ) {
    const formula = await column.getColOptions<FormulaColumn>(this.context);
    if (formula.error) NcError.get(this.context).formulaError(formula.error);

    const qb = await formulaQueryBuilderv2({
      baseModel: this,
      tree: formula.formula,
      model: this.model,
      column,
      aliasToColumn: aliasToColumnBuilder,
      tableAlias,
      validateFormula,
    });
    return qb;
  }

  async getProto({
    apiVersion = NcApiVersion.V2,
    linksAsLtar = false,
  }: {
    apiVersion?: NcApiVersion;
    linksAsLtar?: boolean;
  } = {}) {
    if (this._proto) {
      return this._proto as ResolverObj;
    }

    const proto: ResolverObj = {
      __columnAliases: {},
    };
    const columns = await this.model.getColumns(this.context);
    await Promise.all(
      columns.map(async (column) => {
        switch (column.uidt) {
          case UITypes.Lookup:
            {
              // @ts-ignore
              const colOptions: LookupColumn = await column.getColOptions(
                this.context,
              );
              // Skip registering lookup alias if column has an error — sentinel value
              // is already selected in selectObject
              if (colOptions?.error) break;
              const relCol = await Column.get(this.context, {
                colId: colOptions.fk_relation_column_id,
              });
              const relColTitle =
                relCol.uidt === UITypes.Links && !linksAsLtar
                  ? `_nc_lk_${relCol.title}`
                  : relCol.title;
              const { refContext: lookupRefContext } = (
                await relCol.getColOptions<LinkToAnotherRecordColumn>(
                  this.context,
                )
              ).getRelContext(this.context);
              proto.__columnAliases[column.title] = {
                path: [
                  relColTitle,
                  (
                    await Column.get(lookupRefContext, {
                      colId: colOptions.fk_lookup_column_id,
                    })
                  )?.title,
                ],
              };
            }
            break;
          case UITypes.Links:
          case UITypes.LinkToAnotherRecord:
            {
              const isMMLike = isMMOrMMLike(column);
              this._columns[column.title] = column;
              const colOptions = (await column.getColOptions(
                this.context,
              )) as LinkToAnotherRecordColumn;

              const { refContext } = colOptions.getRelContext(this.context);

              if (colOptions?.type === 'hm' && !isMMLike) {
                // DataLoader collects all .load(id) calls from the same microtick
                // into a single batch. The batch callback is wrapped in _queryQueue.add()
                // to serialize actual DB execution across all relation types.
                const listLoader = new DataLoaderWithArgs(
                  (ids: readonly string[]) =>
                    this._queryQueue.add(async () => {
                      if (ids.length > 1) {
                        const data = await this.multipleHmList(
                          {
                            colId: column.id,
                            ids: ids as string[],
                            apiVersion,
                            linksAsLtar,
                          },
                          listLoader.args,
                        );
                        return ids.map((id: string) =>
                          data[id] ? data[id] : [],
                        );
                      } else {
                        return [
                          await this.hmList(
                            {
                              colId: column.id,
                              id: ids[0],
                              apiVersion,
                              nested: true,
                              linksAsLtar,
                            },
                            listLoader.args,
                          ),
                        ];
                      }
                    }),
                  {
                    cache: false,
                  },
                );
                const self: BaseModelSqlv2 = this;

                proto[
                  column.uidt === UITypes.Links && !linksAsLtar
                    ? `_nc_lk_${column.title}`
                    : column.title
                ] = async function (args?: RelationLoaderArgs): Promise<any> {
                  listLoader.args = args;
                  return listLoader.load(
                    getCompositePkValue(self.model.primaryKeys, this),
                  );
                };
              } else if (isBtLikeV2Junction(column)) {
                // V2 MO/OO: single-record — return object (like BT)
                // Use multipleMmList for batching, take first record per parent
                const readLoader = new DataLoaderWithArgs(
                  (ids: readonly string[]) =>
                    this._queryQueue.add(async () => {
                      if (ids?.length > 1) {
                        const lists = await this.multipleMmList(
                          {
                            parentIds: ids as string[],
                            colId: column.id,
                          },
                          readLoader.args,
                        );
                        return lists.map((list) => list?.[0] ?? null);
                      } else {
                        return [
                          await this.mmRead(
                            { parentId: ids[0], colId: column.id },
                            readLoader.args,
                          ),
                        ];
                      }
                    }),
                  {
                    cache: false,
                  },
                );

                const self: BaseModelSqlv2 = this;
                proto[column.title] = async function (
                  args?: RelationLoaderArgs,
                ) {
                  readLoader.args = args;
                  return await readLoader.load(
                    getCompositePkValue(self.model.primaryKeys, this),
                  );
                };
              } else if (colOptions.type === 'mm' || isMMLike) {
                const listLoader = new DataLoaderWithArgs(
                  (ids: readonly string[]) =>
                    this._queryQueue.add(async () => {
                      if (ids?.length > 1) {
                        const data = await this.multipleMmList(
                          {
                            parentIds: ids as string[],
                            colId: column.id,
                            apiVersion,
                            nested: true,
                            linksAsLtar,
                          },
                          listLoader.args,
                        );

                        return data;
                      } else {
                        return [
                          await this.mmList(
                            {
                              parentId: ids[0],
                              colId: column.id,
                              apiVersion,
                              nested: true,
                              linksAsLtar,
                            },
                            listLoader.args,
                          ),
                        ];
                      }
                    }),
                  {
                    cache: false,
                  },
                );

                const self: BaseModelSqlv2 = this;
                proto[
                  column.uidt === UITypes.Links && !linksAsLtar
                    ? `_nc_lk_${column.title}`
                    : column.title
                ] = async function (args?: RelationLoaderArgs): Promise<any> {
                  listLoader.args = args;
                  return await listLoader.load(
                    getCompositePkValue(self.model.primaryKeys, this),
                  );
                };
              } else if (colOptions.type === 'bt' && !isMMLike) {
                // @ts-ignore
                const colOptions = (await column.getColOptions(
                  this.context,
                )) as LinkToAnotherRecordColumn;

                const pCol = await Column.get(refContext, {
                  colId: colOptions.fk_parent_column_id,
                });
                const cCol = await Column.get(this.context, {
                  colId: colOptions.fk_child_column_id,
                });

                // use dataloader to get batches of parent data together rather than getting them individually
                // it takes individual keys and callback is invoked with an array of values and we can get the
                // result for all those together and return the value in the same order as in the array
                // this way all parents data extracted together
                const readLoader = new DataLoaderWithArgs(
                  (_ids: readonly string[]) =>
                    this._queryQueue.add(async () => {
                      // handle binary(16) foreign keys
                      const ids = _ids.map((id) => {
                        if (pCol.ct !== 'binary(16)') return id;

                        // Cast the id to string.
                        const idAsString = id + '';
                        // Check if the id is a UUID and the column is binary(16)
                        const isUUIDBinary16 =
                          idAsString.length === 36 || idAsString.length === 32;
                        // If the id is a UUID and the column is binary(16), convert the id to a Buffer. Otherwise, return null to indicate that the id is not a UUID.
                        const idAsUUID = isUUIDBinary16
                          ? idAsString.length === 32
                            ? idAsString.replace(
                                /(.{8})(.{4})(.{4})(.{4})(.{12})/,
                                '$1-$2-$3-$4-$5',
                              )
                            : idAsString
                          : null;

                        return idAsUUID
                          ? Buffer.from(idAsUUID.replace(/-/g, ''), 'hex')
                          : id;
                      });

                      const data = await (
                        await Model.getBaseModelSQL(refContext, {
                          id: pCol.fk_model_id,
                          dbDriver: this.dbDriver,
                          queryQueue: this._queryQueue,
                        })
                      ).list(
                        {
                          fieldsSet: readLoader.args?.fieldsSet,
                          filterArr: [
                            new Filter({
                              id: null,
                              fk_column_id: pCol.id,
                              fk_model_id: pCol.fk_model_id,
                              value: ids as any[],
                              comparison_op: 'in',
                            }),
                          ],
                        },
                        {
                          ignoreViewFilterAndSort: true,
                          ignorePagination: true,
                        },
                      );

                      const groupedList = groupBy(data, pCol.title);
                      return _ids.map(
                        async (id: string) => groupedList?.[id]?.[0],
                      );
                    }),
                  {
                    cache: false,
                  },
                );

                // defining BelongsTo read resolver method
                proto[column.title] = async function (
                  args?: RelationLoaderArgs,
                ) {
                  if (
                    this?.[cCol?.title] === null ||
                    this?.[cCol?.title] === undefined
                  )
                    return null;

                  readLoader.args = args;

                  return await readLoader.load(this?.[cCol?.title]);
                };
              } else if (colOptions.type === 'oo' && !isMMLike) {
                const isBt = column.meta?.bt;

                if (isBt) {
                  // @ts-ignore
                  const colOptions = (await column.getColOptions(
                    this.context,
                  )) as LinkToAnotherRecordColumn;
                  const pCol = await Column.get(refContext, {
                    colId: colOptions.fk_parent_column_id,
                  });
                  const cCol = await Column.get(this.context, {
                    colId: colOptions.fk_child_column_id,
                  });

                  // use dataloader to get batches of parent data together rather than getting them individually
                  // it takes individual keys and callback is invoked with an array of values and we can get the
                  // result for all those together and return the value in the same order as in the array
                  // this way all parents data extracted together
                  const readLoader = new DataLoaderWithArgs(
                    (_ids: readonly string[]) =>
                      this._queryQueue.add(async () => {
                        // handle binary(16) foreign keys
                        const ids = _ids.map((id) => {
                          if (pCol.ct !== 'binary(16)') return id;

                          // Cast the id to string.
                          const idAsString = id + '';
                          // Check if the id is a UUID and the column is binary(16)
                          const isUUIDBinary16 =
                            idAsString.length === 36 ||
                            idAsString.length === 32;
                          // If the id is a UUID and the column is binary(16), convert the id to a Buffer. Otherwise, return null to indicate that the id is not a UUID.
                          const idAsUUID = isUUIDBinary16
                            ? idAsString.length === 32
                              ? idAsString.replace(
                                  /(.{8})(.{4})(.{4})(.{4})(.{12})/,
                                  '$1-$2-$3-$4-$5',
                                )
                              : idAsString
                            : null;

                          return idAsUUID
                            ? Buffer.from(idAsUUID.replace(/-/g, ''), 'hex')
                            : id;
                        });

                        const data = await (
                          await Model.getBaseModelSQL(refContext, {
                            id: pCol.fk_model_id,
                            dbDriver: this.dbDriver,
                            queryQueue: this._queryQueue,
                          })
                        ).list(
                          {
                            fieldsSet: readLoader.args?.fieldsSet,
                            filterArr: [
                              new Filter({
                                id: null,
                                fk_column_id: pCol.id,
                                fk_model_id: pCol.fk_model_id,
                                value: ids as any[],
                                comparison_op: 'in',
                              }),
                            ],
                          },
                          {
                            ignoreViewFilterAndSort: true,
                            ignorePagination: true,
                          },
                        );

                        const groupedList = groupBy(data, pCol.title);
                        return _ids.map(
                          async (id: string) => groupedList?.[id]?.[0],
                        );
                      }),
                    {
                      cache: false,
                    },
                  );

                  // defining BelongsTo read resolver method
                  proto[column.title] = async function (
                    args?: RelationLoaderArgs,
                  ) {
                    if (
                      this?.[cCol?.title] === null ||
                      this?.[cCol?.title] === undefined
                    )
                      return null;

                    readLoader.args = args;

                    return await readLoader.load(this?.[cCol?.title]);
                  };
                } else {
                  const listLoader = new DataLoaderWithArgs(
                    (ids: readonly string[]) =>
                      this._queryQueue.add(async () => {
                        if (ids.length > 1) {
                          const data = await this.multipleHmList(
                            {
                              colId: column.id,
                              ids: ids as string[],
                            },
                            listLoader.args,
                          );
                          return ids.map((id: string) =>
                            data[id] ? data[id]?.[0] : null,
                          );
                        } else {
                          return [
                            (
                              await this.hmList(
                                {
                                  colId: column.id,
                                  id: ids[0],
                                },
                                listLoader.args,
                              )
                            )?.[0] ?? null,
                          ];
                        }
                      }),
                    {
                      cache: false,
                    },
                  );
                  const self: BaseModelSqlv2 = this;

                  proto[
                    column.uidt === UITypes.Links && !linksAsLtar
                      ? `_nc_lk_${column.title}`
                      : column.title
                  ] = async function (args?: RelationLoaderArgs): Promise<any> {
                    listLoader.args = args;
                    return listLoader.load(
                      getCompositePkValue(self.model.primaryKeys, this),
                    );
                  };
                }
              }
            }
            break;
        }
      }),
    );
    this._proto = proto;
    return proto;
  }

  _getListArgs(
    args: XcFilterWithAlias,
    {
      apiVersion = NcApiVersion.V2,
      nested = false,
    }: {
      apiVersion?: NcApiVersion;
      nested?: boolean;
    } = {},
  ): XcFilter {
    return getListArgs(args, this.model, {
      ignoreAssigningWildcardSelect: true,
      apiVersion,
      nested,
    });
  }

  public async shuffle({ qb }: { qb: Knex.QueryBuilder }): Promise<void> {
    if (this.isMySQL) {
      qb.orderByRaw('RAND()');
    } else if (this.isPg || this.isSqlite) {
      qb.orderByRaw('RANDOM()');
    }
  }

  public async selectObject(params: {
    fieldsSet?: Set<string>;
    qb: Knex.QueryBuilder & Knex.QueryInterface;
    columns?: Column[];
    fields?: string[] | string;
    extractPkAndPv?: boolean;
    viewId?: string;
    alias?: string;
    validateFormula?: boolean;
    pkAndPvOnly?: boolean;
    linksAsLtar?: boolean;
    fk_display_value_column_id?: string | null;
  }): Promise<void> {
    return await selectObject(this, logger)(params);
  }
  public async afterSoftDeleteCompleted(_params: {
    cookie: NcRequest;
    operationNow: string;
  }): Promise<void> {
    // No-op — overridden in EE.
  }

  async insert(data, request: NcRequest, trx?, _disableOptimization = false) {
    return await baseModelInsert(this).single(
      data,
      request,
      trx,
      _disableOptimization,
    );
  }

  async delByPk(id, _trx?, cookie?) {
    let trx: Knex.Transaction | null = _trx;
    try {
      const source = await this.getSource();
      // retrieve data for handling params in hook
      const data = await this.readRecord({
        idOrRecord: id,
        validateFormula: false,
        ignoreView: true,
        getHiddenColumn: true,
        source,
      });
      await this.beforeDelete(id, cookie);

      // Detect soft-delete column for meta sources
      const deletedColumn = this.model.columns.find((c) => isDeletedCol(c));
      const isSoftDelete =
        !!deletedColumn && source.isMeta() && this.model.isTrashEnabled;

      if (isSoftDelete) {
        // Soft-delete: flag the record instead of removing it
        const where = await this._wherePk(id);
        const operationNow = this.now();
        const softDeletePayload: Record<string, any> = {
          [deletedColumn.column_name]: true,
        };
        // Stamp deleted-at / deleted-by so the trash UI can display them
        const lmtCol = this.model.columns.find(
          (c) => c.uidt === UITypes.LastModifiedTime && c.system,
        );
        const lmbCol = this.model.columns.find(
          (c) => c.uidt === UITypes.LastModifiedBy && c.system,
        );
        if (lmtCol) softDeletePayload[lmtCol.column_name] = operationNow;
        if (lmbCol) softDeletePayload[lmbCol.column_name] = cookie?.user?.id;

        // Use the caller's transaction or run without one (single UPDATE, no link cleanup)
        const response = _trx
          ? await _trx(this.tnPath).update(softDeletePayload).where(where)
          : await this.dbDriver(this.tnPath)
              .update(softDeletePayload)
              .where(where);

        await this.softDeleteFileReferences({
          oldData: [data],
          columns: this.model.columns,
        });

        // Update LMT + broadcast on linked records
        await this.updateLinkedRecordsOnDelete([id], cookie);

        await this.afterDelete(
          data,
          cookie,
          AuditV1OperationTypes.DATA_SOFT_DELETE,
        );
        await this.statsUpdate({ count: -1 });

        return response;
      }

      const execQueries: ((trx: Knex.Transaction) => Promise<any>)[] = [];

      // Collect linked record IDs BEFORE the transaction nulls FKs / deletes junction rows
      const linkedRecordNotifications: {
        baseModel: BaseModelSqlv2;
        model: Model;
        ids: string[];
        colId: string;
      }[] = [];

      for (const column of this.model.columns) {
        if (!isLinksOrLTAR(column)) continue;

        const colOptions =
          await column.getColOptions<LinkToAnotherRecordColumn>(this.context);

        const { mmContext, refContext, parentContext, childContext } =
          await colOptions.getParentChildContext(this.context);

        const relationType = isMMOrMMLike(column) ? 'mm' : colOptions.type;

        const shouldCascadeHere = await shouldCascadeLinkCleanup(this.context, {
          isMeta: !!source.isMeta(),
          relationType,
          colOptions,
          mmContext,
        });

        switch (relationType) {
          case 'mm':
            {
              if (!shouldCascadeHere) break;

              const mmTable = await Model.get(
                mmContext,
                colOptions.fk_mm_model_id,
              );

              const mmBaseModel = await Model.getBaseModelSQL(mmContext, {
                model: mmTable,
                dbDriver: this.dbDriver,
                queryQueue: this._queryQueue,
              });

              const mmChildCol = await Column.get(mmContext, {
                colId: colOptions.fk_mm_child_column_id,
              });

              // Collect linked parent IDs via junction BEFORE deletion
              const mmParentCol = await Column.get(mmContext, {
                colId: colOptions.fk_mm_parent_column_id,
              });
              const parentTable = await (
                await colOptions.getParentColumn(parentContext)
              ).getModel(parentContext);
              await parentTable.getColumns(parentContext);
              const parentBaseModel = await Model.getBaseModelSQL(
                parentContext,
                { model: parentTable, dbDriver: this.dbDriver },
              );
              const inverseLinkCol = await extractCorrespondingLinkColumn(
                this.context,
                {
                  ltarColumn: column,
                  referencedTable: parentTable,
                  referencedTableColumns: parentTable.columns,
                },
              );

              const mmLinkedRows = await this.execAndParse(
                this.dbDriver(mmBaseModel.getTnPath(mmTable.table_name))
                  .select(mmParentCol.column_name)
                  .where(mmChildCol.column_name, id),
                null,
                { raw: true },
              );
              const mmLinkedIds = mmLinkedRows.map(
                (r) => r[mmParentCol.column_name],
              );
              if (mmLinkedIds.length) {
                linkedRecordNotifications.push({
                  baseModel: parentBaseModel,
                  model: parentTable,
                  ids: mmLinkedIds,
                  colId: inverseLinkCol?.id,
                });
              }

              execQueries.push((trx) =>
                trx(mmBaseModel.getTnPath(mmTable.table_name))
                  .del()
                  .where(mmChildCol.column_name, id),
              );
            }
            break;
          case 'hm':
            {
              if (!shouldCascadeHere) break;

              // skip if it's an mm table column
              const relatedTable = await colOptions.getRelatedTable(refContext);

              if (relatedTable.mm) {
                break;
              }

              const refBaseModel = await Model.getBaseModelSQL(refContext, {
                model: relatedTable,
                dbDriver: this.dbDriver,
                queryQueue: this._queryQueue,
              });

              const childColumn = await Column.get(refContext, {
                colId: colOptions.fk_child_column_id,
              });

              // Collect linked child IDs BEFORE FK nulling
              await relatedTable.getColumns(refContext);
              const inverseLinkCol = await extractCorrespondingLinkColumn(
                this.context,
                {
                  ltarColumn: column,
                  referencedTable: relatedTable,
                  referencedTableColumns: relatedTable.columns,
                },
              );
              const hmLinkedRows = await this.execAndParse(
                this.dbDriver(refBaseModel.getTnPath(relatedTable.table_name))
                  .select(relatedTable.primaryKey.column_name)
                  .where(childColumn.column_name, id),
                null,
                { raw: true },
              );
              const hmLinkedIds = hmLinkedRows.map(
                (r) => r[relatedTable.primaryKey.column_name],
              );
              if (hmLinkedIds.length) {
                linkedRecordNotifications.push({
                  baseModel: refBaseModel,
                  model: relatedTable,
                  ids: hmLinkedIds,
                  colId: inverseLinkCol?.id,
                });
              }

              execQueries.push((trx) =>
                trx(refBaseModel.getTnPath(relatedTable.table_name))
                  .update({
                    [childColumn.column_name]: null,
                  })
                  .where(childColumn.column_name, id),
              );
            }
            break;
          case 'oo':
            {
              if (column.meta?.bt) {
                // BT-side: FK is on the deleted record — no cleanup needed
                // Collect parent IDs for LMT from deleted record's FK
                const btChildColumn = await colOptions.getChildColumn(
                  childContext,
                );
                const btParentColumn = await colOptions.getParentColumn(
                  parentContext,
                );
                const btParentTable = await btParentColumn.getModel(
                  parentContext,
                );
                await btParentTable.getColumns(parentContext);
                const btParentBaseModel = await Model.getBaseModelSQL(
                  parentContext,
                  { model: btParentTable, dbDriver: this.dbDriver },
                );
                const btInverseLinkCol = await extractCorrespondingLinkColumn(
                  this.context,
                  {
                    ltarColumn: column,
                    referencedTable: btParentTable,
                    referencedTableColumns: btParentTable.columns,
                  },
                );

                const fkRow = await this.execAndParse(
                  this.dbDriver(this.tnPath)
                    .select(btChildColumn.column_name)
                    .where(await this._wherePk(id))
                    .whereNotNull(btChildColumn.column_name),
                  null,
                  { raw: true, first: true },
                );
                if (fkRow?.[btChildColumn.column_name]) {
                  linkedRecordNotifications.push({
                    baseModel: btParentBaseModel,
                    model: btParentTable,
                    ids: [fkRow[btChildColumn.column_name]],
                    colId: btInverseLinkCol?.id,
                  });
                }
                break;
              }
              // HM-side: FK on child table needs nulling (same as HM)
              const ooRelatedTable = await colOptions.getRelatedTable(
                refContext,
              );

              if (ooRelatedTable.mm) {
                break;
              }

              const ooRefBaseModel = await Model.getBaseModelSQL(refContext, {
                model: ooRelatedTable,
                dbDriver: this.dbDriver,
                queryQueue: this._queryQueue,
              });

              const ooChildColumn = await Column.get(refContext, {
                colId: colOptions.fk_child_column_id,
              });

              // Collect linked child ID BEFORE FK nulling
              await ooRelatedTable.getColumns(refContext);
              const ooInverseLinkCol = await extractCorrespondingLinkColumn(
                this.context,
                {
                  ltarColumn: column,
                  referencedTable: ooRelatedTable,
                  referencedTableColumns: ooRelatedTable.columns,
                },
              );
              const ooLinkedRows = await this.execAndParse(
                this.dbDriver(
                  ooRefBaseModel.getTnPath(ooRelatedTable.table_name),
                )
                  .select(ooRelatedTable.primaryKey.column_name)
                  .where(ooChildColumn.column_name, id),
                null,
                { raw: true },
              );
              const ooLinkedIds = ooLinkedRows.map(
                (r) => r[ooRelatedTable.primaryKey.column_name],
              );
              if (ooLinkedIds.length) {
                linkedRecordNotifications.push({
                  baseModel: ooRefBaseModel,
                  model: ooRelatedTable,
                  ids: ooLinkedIds,
                  colId: ooInverseLinkCol?.id,
                });
              }

              execQueries.push((trx) =>
                trx(ooRefBaseModel.getTnPath(ooRelatedTable.table_name))
                  .update({
                    [ooChildColumn.column_name]: null,
                  })
                  .where(ooChildColumn.column_name, id),
              );
            }
            break;
          case 'bt':
            {
              // Collect parent IDs for LMT from deleted record's FK
              const btChildColumn = await colOptions.getChildColumn(
                childContext,
              );
              const btParentColumn = await colOptions.getParentColumn(
                parentContext,
              );
              const btParentTable = await btParentColumn.getModel(
                parentContext,
              );
              await btParentTable.getColumns(parentContext);
              const btParentBaseModel = await Model.getBaseModelSQL(
                parentContext,
                { model: btParentTable, dbDriver: this.dbDriver },
              );
              const btInverseLinkCol = await extractCorrespondingLinkColumn(
                this.context,
                {
                  ltarColumn: column,
                  referencedTable: btParentTable,
                  referencedTableColumns: btParentTable.columns,
                },
              );

              const fkRow = await this.execAndParse(
                this.dbDriver(this.tnPath)
                  .select(btChildColumn.column_name)
                  .where(await this._wherePk(id))
                  .whereNotNull(btChildColumn.column_name),
                null,
                { raw: true, first: true },
              );
              if (fkRow?.[btChildColumn.column_name]) {
                linkedRecordNotifications.push({
                  baseModel: btParentBaseModel,
                  model: btParentTable,
                  ids: [fkRow[btChildColumn.column_name]],
                  colId: btInverseLinkCol?.id,
                });
              }
              // No FK cleanup — FK is on the deleted record itself
            }
            break;
        }
      }
      const where = await this._wherePk(id);
      if (!trx) {
        trx = await this.dbDriver.transaction();
      }

      await Promise.all(execQueries.map((q) => q(trx)));

      const response = await trx(this.tnPath).del().where(where);

      if (!_trx) {
        await trx.commit();
        // Transaction is finalized; clear the reference so a post-commit
        // failure below can't trigger rollback() on an already-closed trx
        // (which throws "Transaction is already complete" and masks the
        // original error in the catch block).
        trx = null;
      }

      await this.clearFileReferences({
        oldData: [data],
        columns: this.model.columns,
      });

      // Notify linked records AFTER transaction — using IDs collected BEFORE
      for (const entry of linkedRecordNotifications) {
        try {
          await entry.baseModel.updateLastModified({
            model: entry.model,
            rowIds: entry.ids,
            cookie,
            updatedColIds: [entry.colId].filter(Boolean),
          });
          await entry.baseModel.broadcastLinkUpdates(entry.ids);
        } catch (e) {
          logger.error(e?.message, e?.stack);
        }
      }

      await this.afterDelete(data, cookie);
      return response;
    } catch (e) {
      if (!_trx) await trx?.rollback();
      await this.errorDelete(e, id, cookie);
      throw e;
    }
  }

  async hasLTARData(rowId, model: Model): Promise<any> {
    const res = [];
    const LTARColumns = (await model.getColumns(this.context)).filter(
      (c) => c.uidt === UITypes.LinkToAnotherRecord,
    );
    let i = 0;
    for (const column of LTARColumns) {
      const colOptions = (await column.getColOptions(
        this.context,
      )) as LinkToAnotherRecordColumn;

      const { childContext, parentContext, mmContext } =
        await colOptions.getParentChildContext(this.context);

      const childColumn = await colOptions.getChildColumn(childContext);
      const parentColumn = await colOptions.getParentColumn(parentContext);
      const childModel = await childColumn.getModel(childContext);
      await childModel.getColumns(childContext);
      const parentModel = await parentColumn.getModel(parentContext);
      await parentModel.getColumns(parentContext);
      let cnt = 0;
      if (colOptions.type === RelationTypes.HAS_MANY) {
        const childBaseModel = await Model.getBaseModelSQL(childContext, {
          model: childModel,
          dbDriver: this.dbDriver,
        });
        cnt = +(
          await this.execAndParse(
            this.dbDriver(childBaseModel.getTnPath(childModel.table_name))
              .count(childColumn.column_name, { as: 'cnt' })
              .where(childColumn.column_name, rowId),
            null,
            { raw: true, first: true },
          )
        ).cnt;
      } else if (colOptions.type === RelationTypes.MANY_TO_MANY) {
        const mmModel = await colOptions.getMMModel(mmContext);
        const mmChildColumn = await colOptions.getMMChildColumn(mmContext);
        const mmBaseModel = await Model.getBaseModelSQL(mmContext, {
          model: mmModel,
          dbDriver: this.dbDriver,
        });
        const mmTn = mmBaseModel.getTnPath(mmModel.table_name);
        cnt = +(
          await this.execAndParse(
            this.dbDriver(mmTn)
              .where(`${mmTn}.${mmChildColumn.column_name}`, rowId)
              .count(mmChildColumn.column_name, { as: 'cnt' }),
            null,
            { first: true },
          )
        ).cnt;
      }
      if (cnt) {
        res.push(
          `${i++ + 1}. ${model.title}.${
            column.title
          } is a LinkToAnotherRecord of ${childModel.title}`,
        );
      }
    }
    return res;
  }

  async moveRecord({
    rowId,
    beforeRowId,
  }: {
    rowId: string;
    beforeRowId: string;
    cookie?: { user?: any };
  }) {
    const columns = await this.model.getColumns(this.context);

    const row = await this.readByPk(
      rowId,
      false,
      {},
      { ignoreView: true, getHiddenColumn: true },
    );

    if (!row) {
      NcError.get(this.context).recordNotFound(rowId);
    }

    const orderCol = columns.find((c) => c.uidt === UITypes.Order);

    if (isTraceActive() && orderCol && this.model.primaryKeys?.length) {
      const currentOrder = (row as any)?.[orderCol.title];
      if (currentOrder != null) {
        const nextQuery = this.dbDriver(this.tnPath)
          .select(...this.model.primaryKeys.map((c) => c.column_name))
          .where(orderCol.column_name, '>', currentOrder)
          .orderBy(orderCol.column_name, 'asc')
          .limit(1)
          .toQuery();
        const next = (await this.execAndParse(nextQuery, null, {
          raw: true,
          first: true,
        })) as Record<string, any> | undefined;
        captureForTrace('movePrev', {
          pk: rowId,
          beforeRowId: next
            ? (this.extractPksValues(next, true) as string)
            : null,
        });
      }
    }

    const newRecordOrder = (
      await this.getUniqueOrdersBeforeItem(beforeRowId, 1)
    )[0];

    return this.dbDriver(this.tnPath)
      .update({
        [columns.find((c) => c.uidt === UITypes.Order).column_name]:
          newRecordOrder.toString(),
      })
      .where(await this._wherePk(rowId));
  }

  async updateByPk(
    id,
    data,
    trx?,
    cookie?,
    _disableOptimization = false,
    { typecast = false }: { typecast?: boolean } = {},
  ) {
    try {
      const columns = await this.model.getColumns(this.context);

      const updateObj = await this.model.mapAliasToColumn(
        this.context,
        data,
        this.clientMeta,
        this.dbDriver,
        columns,
      );

      await this.validate(data, columns, { typecast });

      await this.beforeUpdate(data, cookie);

      const btForeignKeyColumn = columns.find(
        (c) =>
          c.uidt === UITypes.ForeignKey && data[c.column_name] !== undefined,
      );

      const btColumn = btForeignKeyColumn
        ? columns.find(
            (c) =>
              c.uidt === UITypes.LinkToAnotherRecord &&
              c.colOptions?.fk_child_column_id === btForeignKeyColumn.id,
          )
        : null;

      const prevData = await this.readByPk(
        id,
        false,
        {},
        { ignoreView: true, getHiddenColumn: true },
      );

      if (!prevData) {
        NcError.get(this.context).recordNotFound(id);
      }

      await this.prepareNocoData(updateObj, false, cookie, prevData);

      // Reject empty payloads explicitly — knex would otherwise throw
      // "Empty .update() call detected" with no usable context for the user.
      if (!updateObj || Object.keys(updateObj).length === 0) {
        NcError.get(this.context).invalidRequestBody(
          'No valid fields provided in update payload',
        );
      }

      const query = this.dbDriver(this.tnPath)
        .update(updateObj)
        .where(await this._wherePk(id, true));

      await this.execAndParse(query, null, { raw: true });

      const newId = this.extractPksValues(
        {
          ...prevData,
          ...updateObj,
        },
        true,
      );

      const newData = await this.readByPk(
        newId,
        false,
        {},
        { ignoreView: true, getHiddenColumn: true },
      );

      if (btColumn && Object.keys(data || {}).length === 1) {
        await this.addChild({
          colId: btColumn.id,
          rowId: newId,
          childId: updateObj[btForeignKeyColumn.title],
          cookie,
          onlyUpdateAuditLogs: true,
          prevData,
        });
      } else {
        await this.afterUpdate(prevData, newData, cookie, updateObj);
      }
      return newData;
    } catch (e) {
      await this.errorUpdate(e, data, cookie);
      throw e;
    }
  }

  async _wherePk(id, skipGetColumns = false, skipPkValidation = false) {
    if (!skipGetColumns) await this.model.getColumns(this.context);
    return _wherePk(this.model.primaryKeys, id, skipPkValidation);
  }

  comparePks(pk1, pk2) {
    // If either pk1 or pk2 is a string or number, convert both to strings and compare
    if (isPrimitiveType(pk1) || isPrimitiveType(pk2)) {
      return `${pk1}` === `${pk2}`;
    }

    // If both are objects (composite keys), compare them using deep equality check
    return equal(pk1, pk2);
  }

  public getTnPath(tb: { table_name: string } | string, alias?: string) {
    const tn = typeof tb === 'string' ? tb : tb.table_name;
    if (this.isPg && this.schema) {
      return `${this.schema}.${tn}${alias ? ` as ${alias}` : ``}`;
    } else if (this.isSnowflake) {
      return `${[
        this.dbDriver.client.config.connection.database,
        this.dbDriver.client.config.connection.schema,
        tn,
      ].join('.')}${alias ? ` as ${alias}` : ``}`;
    } else {
      return `${tn}${alias ? ` as ${alias}` : ``}`;
    }
  }

  public get tnPath() {
    return this.getTnPath(this.model);
  }

  public get clientMeta() {
    return {
      isSqlite: this.isSqlite,
      isPg: this.isPg,
      isMySQL: this.isMySQL,
      // isSnowflake: this.isSnowflake,
    };
  }

  get isSqlite() {
    return this.clientType === 'sqlite3';
  }

  get isPg() {
    return this.clientType === 'pg';
  }

  get isMySQL() {
    return this.clientType === 'mysql2' || this.clientType === 'mysql';
  }

  get isSnowflake() {
    return this.clientType === 'snowflake';
  }

  get isDatabricks() {
    return this.clientType === 'databricks';
  }

  get clientType() {
    return this.dbDriver.clientType();
  }

  public async readRecord(params: {
    idOrRecord: string | Record<string, any>;
    fieldsSet?: Set<string>;
    ignoreView?: boolean;
    getHiddenColumn?: boolean;
    validateFormula?: boolean;
    source: Source;
    disableOptimization?: boolean;
    view?: View;
    ignoreRls?: boolean;
    skipPublicRedaction?: boolean;
  }): Promise<any> {
    return this.readByPk(
      params.idOrRecord,
      false,
      {},
      {
        ignoreView: params.ignoreView,
        getHiddenColumn: params.getHiddenColumn,
        ignoreRls: params.ignoreRls,
        skipPublicRedaction: params.skipPublicRedaction,
      },
    );
  }

  async nestedInsert(data, request: NcRequest, _trx = null, param?) {
    // const driver = trx ? trx : await this.dbDriver.transaction();
    try {
      const source = await this.getSource();
      await populatePk(this.context, this.model, data);

      const columns = await this.model.getColumns(this.context);

      const insertObj = await this.model.mapAliasToColumn(
        this.context,
        data,
        this.clientMeta,
        this.dbDriver,
        columns,
      );
      let rowId = null;

      const nestedCols = columns.filter((c) => isLinksOrLTAR(c));
      let {
        postInsertOps,
        preInsertOps,
        // eslint-disable-next-line prefer-const
        postInsertAuditEntries,
        // eslint-disable-next-line prefer-const
        postInsertLastModifiedEntries,
        // eslint-disable-next-line prefer-const
        displacedRecords,
      } = await this.prepareNestedLinkQb({
        nestedCols,
        data,
        insertObj,
        req: request,
      });
      const attachmentOperations =
        await new AttachmentUrlUploadPreparator().prepareAttachmentUrlUpload(
          this,
          {
            attachmentCols: columns.filter((c) => isAttachment(c)),
            data: insertObj,
            req: request,
          },
        );
      postInsertOps = [
        ...(postInsertOps ?? []),
        ...(attachmentOperations.postInsertOps ?? []),
      ];
      preInsertOps = [
        ...(preInsertOps ?? []),
        ...(attachmentOperations.preInsertOps ?? []),
      ];

      await this.validate(insertObj, columns);

      await this.beforeInsert(insertObj, request);

      await this.prepareNocoData(insertObj, true, request, null, {
        ncOrder: null,
        before: param?.before,
        undo: param?.undo,
      });

      // Cap in-flight preInsertOps so many nested LTAR capture SELECTs
      // don't saturate the knex pool. Mutating closures only build
      // .toQuery() strings (no connection), so the cap mainly limits
      // the capture-SELECT side. Resolved strings are handed back to
      // runOps to keep its serial UPDATE/DELETE walk.
      const preInsertResolved = await processConcurrently(
        preInsertOps,
        (f) => f(),
        5,
      );
      await this.runOps(preInsertResolved.map((s) => Promise.resolve(s)));

      // Deposit displacement capture for the trace decorator.
      // `displacedRecords` was populated by capture-ops in
      // preInsertOps (SELECTs ran under the concurrency cap above,
      // before runOps walked the resulting UPDATE/DELETE strings serially).
      // Skipped under replay — replay reads from meta.extra, doesn't
      // re-capture.
      if (displacedRecords.length > 0 && !isReplay()) {
        captureForTrace('displacedRecords', displacedRecords);
      }

      let response;
      const query = this.dbDriver(this.tnPath).insert(insertObj);

      if (this.isPg && this.model.primaryKey) {
        query.returning(
          `${this.model.primaryKey.column_name} as ${this.model.primaryKey.id}`,
        );
        response = await this.execAndParse(query, null, { raw: true });
      }

      const ai = this.model.columns.find((c) => c.ai);

      let ag: Column;
      if (!ai) ag = this.model.columns.find((c) => c.meta?.ag);

      // handle if autogenerated primary key is used
      if (ag) {
        rowId = insertObj[ag.column_name];
        if (!response) await this.execAndParse(query);
        response = await this.readRecord({
          idOrRecord: insertObj[ag.column_name],
          ignoreView: true,
          getHiddenColumn: true,
          validateFormula: false,
          source,
          ignoreRls: true,
        });
      } else if (
        !response ||
        (typeof response?.[0] !== 'object' && response?.[0] !== null)
      ) {
        if (response?.length) {
          rowId = response[0];
        } else {
          rowId = await this.execAndParse(query, null, {
            raw: true,
          });
          rowId = rowId.id ?? rowId[0]?.insertId ?? rowId;
        }

        if (ai) {
          if (this.isSqlite) {
            // sqlite doesnt return id after insert
            rowId = (
              await this.execAndParse(
                this.dbDriver(this.tnPath)
                  .select(ai.column_name)
                  .max(ai.column_name, { as: '__nc_ai_id' }),
                null,
                {
                  raw: true,
                  first: true,
                },
              )
            )?.__nc_ai_id;
          } else if (this.isSnowflake || this.isDatabricks) {
            rowId = (
              await this.execAndParse(
                this.dbDriver(this.tnPath).max(ai.column_name, {
                  as: '__nc_ai_id',
                }),
                null,
                { raw: true, first: true },
              )
            )?.__nc_ai_id;
          }
          // response = await this.readByPk(
          //   id,
          //   false,
          //   {},
          //   { ignoreView: true, getHiddenColumn: true },
          // );
        } else {
          response = data;
        }
      } else if (ai) {
        rowId = Array.isArray(response)
          ? response?.[0]?.[ai.id]
          : response?.[ai.id];
      }
      rowId = this.extractCompositePK({ ai, ag, rowId, insertObj });
      // when auto generated (with default) pk columns
      if (!rowId && response.length === 1) {
        if (this.model.primaryKeys.length === 1) {
          rowId = response[0][this.model.primaryKeys[0].id];
        } else {
          const responseWithColumnTitle = Object.keys(response[0]).reduce(
            (res, colId) => {
              const col = this.model.columns.find((c) => c.id === colId);
              res[col.title] = response[0][colId];
              return res;
            },
            {},
          );
          rowId = this.extractPksValues(responseWithColumnTitle, true);
        }
      }

      await this.runOps(postInsertOps.map((f) => f(rowId)));

      // batch-fetch display values and write link audits
      try {
        if (
          postInsertAuditEntries.length &&
          (await this.isDataAuditEnabled())
        ) {
          // Resolve rowId for entries that reference the inserted row
          const resolvedEntries = postInsertAuditEntries.map((entry) => ({
            ...entry,
            rowId: entry.rowIdIsInsertedRow ? rowId : entry.rowId,
            refRowId: entry.refRowIdIsInsertedRow ? rowId : entry.refRowId,
          }));

          // Pre-resolve LTAR display value overrides per unique columnId.
          // When no LTAR in the batch carries `fk_display_value_column_id`
          // we skip threading `displayColumn` entirely — values fall back to
          // the table's primary value (pre-override behavior).
          const { refByColId, hasAny } =
            await this.resolveLtarOverrideColsForBatch(resolvedEntries);

          const refDisplayColFor = (entry: (typeof resolvedEntries)[number]) =>
            hasAny && entry.columnId
              ? refByColId.get(entry.columnId)
              : undefined;

          const dvProps: {
            model: Model;
            id: any;
            displayColumn?: Column;
          }[] = [];
          for (const entry of resolvedEntries) {
            dvProps.push({ model: entry.model, id: entry.rowId });
            dvProps.push({
              model: entry.refModel,
              id: entry.refRowId,
              displayColumn: refDisplayColFor(entry),
            });
          }
          const dvMap = await this.fetchDisplayValueMap(dvProps);

          // Write audits with per-entry isolation
          for (const entry of resolvedEntries) {
            const displayValue = dvMap.get(
              displayValueMapKey({ model: entry.model, id: entry.rowId }),
            );
            const refDisplayValue = dvMap.get(
              displayValueMapKey({
                model: entry.refModel,
                id: entry.refRowId,
                displayColumn: refDisplayColFor(entry),
              }),
            );

            try {
              await Audit.insert(
                await generateAuditV1Payload<DataLinkPayload>(
                  AuditV1OperationTypes.DATA_LINK,
                  {
                    context: {
                      ...this.context,
                      source_id: entry.model.source_id,
                      fk_model_id: entry.model.id,
                      row_id: this.extractPksValues(
                        entry.rowId,
                        true,
                      ) as string,
                    },
                    details: {
                      table_title: entry.model.title,
                      ref_table_title: entry.refModel.title,
                      link_field_title: entry.columnTitle,
                      link_field_id: entry.columnId,
                      row_id: entry.rowId,
                      ref_row_id: entry.refRowId,
                      display_value: displayValue,
                      ref_display_value: refDisplayValue,
                      type: entry.type,
                    },
                    req: entry.req,
                  },
                ),
              );
            } catch (e) {
              logger.error(
                `[nestedInsert] audit write failed: ${e.message}`,
                e.stack,
              );
            }
          }
        }
      } catch (e) {
        logger.error(
          `[nestedInsert] audit batch failed: ${e.message}`,
          e.stack,
        );
      }

      // update lastModified for linked tables (independent of audit success)
      try {
        for (const entry of postInsertLastModifiedEntries) {
          await this.updateLastModified({
            model: entry.model,
            rowIds: [rowId],
            cookie: entry.req,
            updatedColIds: [entry.col.id],
          });

          const refTableLinkColumnId = (
            await extractCorrespondingLinkColumn(this.context, {
              ltarColumn: entry.col,
              referencedTable: entry.refBaseModel.model,
            })
          )?.id;

          await entry.refBaseModel.updateLastModified({
            model: entry.refModel,
            rowIds: entry.nestedData,
            cookie: entry.req,
            updatedColIds: [refTableLinkColumnId],
          });
        }
      } catch (e) {
        logger.error(
          `[nestedInsert] lastModified failed: ${e.message}`,
          e.stack,
        );
      }

      if (this.model.primaryKey && rowId !== null && rowId !== undefined) {
        response = await this.readRecord({
          idOrRecord: rowId,
          validateFormula: false,
          ignoreView: true,
          getHiddenColumn: true,
          source,
          ignoreRls: true,
          // Skip public-viewer email redaction during this read — afterInsert
          // fires the webhook with full emails, then we redact `response` in
          // place below before returning to the API caller.
          skipPublicRedaction: true,
        });
      }

      // Check if the inserted row is visible under the user's RLS policy
      const rlsConditions = await this.getRlsConditions();
      if (rlsConditions.length && response) {
        const isVisible = await this.exist(
          this.extractPksValues(response, true),
        );
        if (!isVisible) response.__nc_rls_hidden = true;
      }

      await this.afterInsert({
        data: response,
        req: request,
        insertData: data,
      });

      // Counterpart to `skipPublicRedaction: true` above — restore the
      // public-viewer redaction on the response after the webhook has fired.
      await this.redactPublicForResponse(response);

      await this.statsUpdate({
        count: 1,
      });

      return response;
    } catch (e) {
      throw e;
    }
  }

  extractCompositePK({
    ai,
    ag,
    rowId,
    insertObj,
    force = false,
  }: {
    ai: Column<any>;
    ag: Column<any>;
    rowId;
    insertObj: Record<string, any>;
    force?: boolean;
  }) {
    // handle if composite primary key is used along with ai or ag
    if (ag) {
      return insertObj[ag.column_name] ?? rowId;
    } else if (ai && (force || this.model.primaryKeys?.length > 1)) {
      // generate object with ai column and rest of the primary keys
      const pkObj = {};
      for (const pk of this.model.primaryKeys) {
        const key = pk.title;
        if (ai && pk.id === ai.id && !(rowId === null || rowId === undefined)) {
          pkObj[key] = rowId;
        } else {
          pkObj[key] = insertObj[pk.column_name] ?? null;
        }
      }
      rowId = pkObj;
    } else if (!ai && !ag && insertObj) {
      // handle if primary key is not ai or ag
      if (this.model.primaryKeys.length === 1) {
        return insertObj[this.model.primaryKey.column_name] ?? null;
      } else {
        return this.model.primaryKeys.reduce((acc, pk) => {
          acc[pk.title] = insertObj[pk.column_name] ?? null;
          return acc;
        }, {});
      }
    }

    return rowId;
  }

  async prepareNestedLinkQb(param: {
    nestedCols: Column[];
    data: Record<string, any>;
    insertObj: Record<string, any>;
    req: NcRequest;
  }) {
    return new NestedLinkPreparator().prepareNestedLinkQb(this, param);
  }

  /**
   * Batch-find existing records by merge field values.
   * Returns raw DB rows with column_name keys.
   */
  public async findByMergeFields(
    mergeColumns: Column[],
    mergeValuesPerRecord: unknown[][],
  ): Promise<Record<string, any>[]> {
    if (mergeValuesPerRecord.length === 0) return [];

    await this.model.getColumns(this.context);

    const mergeColNames = mergeColumns.map((col) => col.column_name);

    // Deduplicate merge value tuples
    const seen = new Set<string>();
    const uniqueTuples: unknown[][] = [];
    for (const tuple of mergeValuesPerRecord) {
      const key = tuple
        .map((v) => (v === null ? '\0NULL\0' : String(v)))
        .join('\0SEP\0');
      if (!seen.has(key)) {
        seen.add(key);
        uniqueTuples.push(tuple);
      }
    }

    // Build query: WHERE (col1 = ? AND col2 = ?) OR (col1 = ? AND col2 = ?) ...
    const qb = this.dbDriver(this.tnPath);

    qb.where((builder) => {
      for (const tuple of uniqueTuples) {
        builder.orWhere((inner) => {
          for (let i = 0; i < mergeColNames.length; i++) {
            if (tuple[i] === null || tuple[i] === undefined) {
              inner.whereNull(mergeColNames[i]);
            } else {
              inner.where(mergeColNames[i], tuple[i]);
            }
          }
        });
      }
    });

    // Only select PKs + merge columns (minimal data needed)
    const selectCols = [
      ...this.model.primaryKeys.map((pk) => pk.column_name),
      ...mergeColNames,
    ];
    qb.select(selectCols);

    return await qb;
  }

  async bulkUpsert(
    datas: any[],
    {
      chunkSize = 100,
      cookie,
      raw = false,
      foreign_key_checks = true,
      undo = false,
      mergeColumns,
      throwOnDuplicate = false,
      typecast = false,
    }: {
      chunkSize?: number;
      cookie?: any;
      raw?: boolean;
      foreign_key_checks?: boolean;
      undo?: boolean;
      mergeColumns?: Column[];
      throwOnDuplicate?: boolean;
      typecast?: boolean;
    } = {},
  ) {
    let trx;
    try {
      const columns = await this.model.getColumns(this.context);

      let order = await this.getHighestOrderInTable();

      const insertedDatas = [];
      const updatedDatas = [];

      const aiPkCol = this.model.primaryKeys.find((pk) => pk.ai);
      const agPkCol = this.model.primaryKeys.find((pk) => pk.meta?.ag);

      // When `typecast` is true, validate sequentially — missing select
      // options are added inline via `Column.update`, and concurrent
      // validates would race on the option-title unique constraint.
      // Without typecast there's no Column.update, so concurrent is safe.
      if (!raw && typecast) {
        for (const d of datas) {
          await this.validate(d, columns, { typecast });
        }
      }

      const preparedDatas = raw
        ? datas
        : await Promise.all(
            datas.map(async (d) => {
              if (!typecast) await this.validate(d, columns);
              return this.model.mapAliasToColumn(
                this.context,
                d,
                this.clientMeta,
                this.dbDriver,
                columns,
              );
            }),
          );

      const toInsert = [];
      const toUpdate = [];

      let existingRecords: Record<string, any>[] = [];

      if (mergeColumns?.length) {
        // --- Merge-field-based matching ---
        const mergeColNames = mergeColumns.map((col) => col.column_name);

        // Extract merge values from each prepared record
        const mergeValuesPerRecord = preparedDatas.map((data) =>
          mergeColNames.map((cn) => data[cn]),
        );

        // Batch lookup: find all existing records matching any merge-value tuple
        const mergeMatchedRecords = await this.findByMergeFields(
          mergeColumns,
          mergeValuesPerRecord,
        );

        // Build a lookup map: stringified merge values → matched records
        const existingMap = new Map<string, Record<string, any>[]>();
        for (const record of mergeMatchedRecords) {
          const key = mergeColNames
            .map((cn) => {
              const v = record[cn];
              return v === null || v === undefined ? '\0NULL\0' : String(v);
            })
            .join('\0SEP\0');
          if (!existingMap.has(key)) {
            existingMap.set(key, [record]);
          } else {
            existingMap.get(key).push(record);
          }
        }

        for (let i = 0; i < preparedDatas.length; i++) {
          const data = preparedDatas[i];
          const key = mergeColNames
            .map((cn) => {
              const v = data[cn];
              return v === null || v === undefined ? '\0NULL\0' : String(v);
            })
            .join('\0SEP\0');
          const matchedRecords = existingMap.get(key);

          if (matchedRecords?.length > 1 && throwOnDuplicate) {
            NcError.get(this.context).invalidRequestBody(
              `Multiple records match fieldsToMergeOn [${mergeColNames.join(
                ', ',
              )}] — the combination must uniquely identify at most one record`,
            );
          }

          const existingRecord = matchedRecords?.[0];

          if (existingRecord) {
            // Inject the PK from the existing record so the update WHERE clause works
            for (const pk of this.model.primaryKeys) {
              data[pk.column_name] = existingRecord[pk.column_name];
            }
            await this.prepareNocoData(data, false, cookie);
            toUpdate.push(data);
          } else {
            await this.prepareNocoData(data, true, cookie, null, {
              ncOrder: order,
              undo,
            });
            order = order?.plus(1);
            toInsert.push(data);
          }
        }

        // Re-fetch full records for audit/webhook callbacks (merge lookup only returns PK + merge cols)
        if (toUpdate.length > 0) {
          const updatePks = toUpdate.map((d) => this.extractPksValues(d, true));
          existingRecords = await this.chunkList({ pks: updatePks });
        }
      } else {
        // --- Original PK-based matching ---
        const dataWithPks = [];
        const dataWithoutPks = [];

        for (const data of preparedDatas) {
          const pkValues = this.extractPksValues(data, true);
          if (pkValues !== 'N/A' && pkValues !== undefined) {
            dataWithPks.push({ pk: pkValues, data });
          } else {
            await this.prepareNocoData(data, true, cookie, null, {
              ncOrder: order,
              undo,
            });
            order = order?.plus(1);
            dataWithoutPks.push(data);
          }
        }

        // Check which records with PKs exist in the database (active records)
        const dbRecords = await this.chunkList({
          pks: dataWithPks.map((v) => v.pk),
        });

        const existingPkSet = new Set(
          dbRecords.map((r) => this.extractPksValues(r, true)),
        );

        // Also check for trashed records — their PKs still physically exist
        // so an INSERT with the same PK would fail with a duplicate key error.
        // When a PK matches a trashed record, strip the PK and insert as a new record.
        const trashedRecords = await this.chunkList({
          pks: dataWithPks.map((v) => v.pk),
          deletedOnly: true,
        });

        const trashedPkSet = new Set(
          trashedRecords.map((r) => this.extractPksValues(r, true)),
        );

        toInsert.push(...dataWithoutPks);

        for (const { pk, data } of dataWithPks) {
          if (existingPkSet.has(pk)) {
            await this.prepareNocoData(data, false, cookie);
            toUpdate.push(data);
          } else if (trashedPkSet.has(pk)) {
            // PK belongs to a trashed record — strip the PK and insert as a new record.
            // The old PK is still physically occupied; a fresh auto-generated PK avoids conflicts.
            for (const pkCol of this.model.primaryKeys) {
              delete data[pkCol.column_name];
              delete data[pkCol.title];
            }
            await this.prepareNocoData(data, true, cookie, null, {
              ncOrder: order,
              undo,
            });
            order = order?.plus(1);
            toInsert.push(data);
          } else {
            await this.prepareNocoData(data, true, cookie, null, {
              ncOrder: order,
              undo,
            });
            order = order?.plus(1);
            // const insertObj = this.handleValidateBulkInsert(data, columns);
            toInsert.push(data);
          }
        }
      }

      trx = await this.dbDriver.transaction();

      const updatedPks = [];

      if (toUpdate.length > 0) {
        for (const data of toUpdate) {
          if (!raw) await this.validate(data, columns);
          const pkValues = this.extractPksValues(data);
          updatedPks.push(pkValues);
          const wherePk = await this._wherePk(pkValues, true);
          await trx(this.tnPath).update(data).where(wherePk);
        }
      }

      if (toInsert.length > 0) {
        if (!foreign_key_checks) {
          if (this.isPg) {
            await trx.raw('set session_replication_role to replica;');
          } else if (this.isMySQL) {
            await trx.raw('SET foreign_key_checks = 0;');
          }
        }
        let responses;

        if (this.isSqlite || this.isMySQL) {
          responses = [];

          for (const insertData of toInsert) {
            const query = trx(this.tnPath).insert(insertData);
            let id = (await query)[0];

            if (agPkCol) {
              id = insertData[agPkCol.column_name];
            }

            responses.push(
              this.extractCompositePK({
                rowId: id,
                ai: aiPkCol,
                ag: agPkCol,
                insertObj: insertData,
                force: true,
              }) || insertData,
            );
          }
        } else {
          const returningObj: Record<string, string> = {};

          for (const col of this.model.primaryKeys) {
            returningObj[col.title] = col.column_name;
          }

          responses =
            !raw && this.isPg
              ? await trx
                  .batchInsert(this.tnPath, toInsert, chunkSize)
                  .returning(
                    this.model.primaryKeys?.length ? returningObj : '*',
                  )
              : await trx.batchInsert(this.tnPath, toInsert, chunkSize);
        }

        if (!foreign_key_checks) {
          if (this.isPg) {
            await trx.raw('set session_replication_role to origin;');
          } else if (this.isMySQL) {
            await trx.raw('SET foreign_key_checks = 1;');
          }
        }
        insertedDatas.push(...responses);
      }

      await trx.commit();
      // Transaction is finalized; clear the reference so a post-commit
      // failure below can't trigger rollback() on an already-closed trx.
      trx = null;

      const updatedRecords = await this.chunkList({
        pks: updatedPks,
      });
      updatedDatas.push(...updatedRecords);

      const insertedDataList =
        insertedDatas.length > 0
          ? await this.chunkList({
              pks: insertedDatas.map((d) => this.extractPksValues(d)),
            })
          : [];

      const updatedDataList =
        updatedDatas.length > 0
          ? await this.chunkList({
              pks: updatedDatas.map((d) => this.extractPksValues(d)),
            })
          : [];

      // Per-row outcomes for `recordBulkUpsert` undo. mergeColumns
      // mode is V3-only and not user-undoable. NOT gated on isReplay
      // — redo's `runInChildTraceScope` relies on this firing inside
      // the replay scope to rotate fresh `meta.extra.upsertChanges`.
      if (
        isTraceActive() &&
        !mergeColumns?.length &&
        (toUpdate.length || insertedDataList.length)
      ) {
        const upsertChanges: Array<
          | {
              kind: 'update';
              pk: string | number;
              prev: Record<string, unknown>;
            }
          | { kind: 'insert'; pk: string | number }
        > = [];

        if (toUpdate.length && existingRecords.length) {
          const prevByPk = new Map<string, Record<string, unknown>>();
          for (const r of existingRecords) {
            prevByPk.set(String(this.extractPksValues(r, true)), r);
          }
          for (const u of toUpdate) {
            const pk = this.extractPksValues(u, true);
            const prev = prevByPk.get(String(pk));
            if (prev) upsertChanges.push({ kind: 'update', pk, prev });
          }
        }

        for (const inserted of insertedDataList) {
          upsertChanges.push({
            kind: 'insert',
            pk: this.extractPksValues(inserted, true),
          });
        }

        if (upsertChanges.length) {
          captureForTrace('upsertChanges', upsertChanges);
        }
      }

      if (insertedDatas.length === 1) {
        await this.afterInsert({
          data: insertedDataList[0],
          req: cookie,
          insertData: datas[0],
        });

        await this.statsUpdate({
          count: insertedDataList.length,
        });
      } else if (insertedDatas.length > 1) {
        await this.afterBulkInsert(insertedDataList, cookie);

        await this.statsUpdate({
          count: insertedDataList.length,
        });
      }

      if (updatedDataList.length === 1) {
        await this.afterUpdate(
          existingRecords[0],
          updatedDataList[0],
          cookie,
          datas[0],
        );
      } else {
        await this.afterBulkUpdate(existingRecords, updatedDataList, cookie);
      }

      return [...updatedDataList, ...insertedDataList];
    } catch (e) {
      await trx?.rollback();
      throw e;
    }
  }

  async chunkList(args: {
    pks: string[];
    chunkSize?: number;
    apiVersion?: NcApiVersion;
    args?: Record<string, any>;
    extractOnlyPrimaries?: boolean;
    deletedOnly?: boolean;
    fk_display_value_column_id?: string | null;
  }) {
    const { pks, chunkSize = 1000 } = args;

    const data = [];

    const chunkedPks = chunkArray(pks, chunkSize);

    const { ast } = await getAst(this.context, {
      model: this.model,
      query: args.args || {},
      extractOnlyPrimaries: args.extractOnlyPrimaries,
      fk_display_value_column_id: args.fk_display_value_column_id,
    });

    for (const chunk of chunkedPks) {
      let chunkData = await this.list(
        {
          pks: chunk.join(','),
          apiVersion: args.apiVersion,
          ...(args.args || {}),
        },
        {
          limitOverride: chunk.length,
          ignoreViewFilterAndSort: true,
          deletedOnly: args.deletedOnly,
        },
      );
      chunkData = await nocoExecute(ast, chunkData, {}, args.args || {});
      data.push(...chunkData);
    }

    return data;
  }

  async handleValidateBulkInsert(
    d: Record<string, any>,
    columns?: Column[],
    params: {
      allowSystemColumn: boolean;
      undo: boolean;
      typecast: boolean;
    } = {
      allowSystemColumn: false,
      undo: false,
      typecast: false,
    },
  ) {
    const { allowSystemColumn } = params;
    const cols = columns || (await this.model.getColumns(this.context));
    const insertObj = {};

    for (let i = 0; i < cols.length; ++i) {
      const col = cols[i];

      if (col.title in d || col.id in d) {
        if (
          isCreatedOrLastModifiedTimeCol(col) ||
          isCreatedOrLastModifiedByCol(col)
        ) {
          NcError.get(this.context).badRequest(
            `Column "${col.title}" is auto generated and cannot be updated`,
          );
        }

        if (isVirtualCol(col) && !isLinksOrLTAR(col)) {
          NcError.get(this.context).badRequest(
            `Column "${col.title}" is virtual and cannot be updated`,
          );
        }

        if (col.system && !allowSystemColumn) {
          let shouldThrow = true;

          // allow updating order column during undo operation
          if (col.uidt === UITypes.Order && params.undo) {
            shouldThrow = false;
          }
          // allow updating self link column (system counter part)
          else if (isSelfLinkCol(col)) {
            shouldThrow = false;
          }

          if (shouldThrow) {
            NcError.get(this.context).badRequest(
              `Column "${col.title}" is system column and cannot be updated`,
            );
          }
        }

        if (!allowSystemColumn && col.readonly) {
          NcError.get(this.context).badRequest(
            `Column "${col.title}" is readonly column and cannot be updated`,
          );
        }
      }

      // populate pk columns
      if (col.pk) {
        if (col.meta?.ag && !(d[col.title] ?? d[col.id])) {
          if (d[col.id]) {
            d[col.title] = d[col.id];
          } else {
            d[col.title] =
              col.meta?.ag === 'nc' ? `rc_${nanoidv2()}` : uuidv4();
          }
        }
      }

      // map alias to column
      if (!isVirtualCol(col)) {
        let val = !ncIsUndefined(d?.[col.column_name])
          ? d?.[col.column_name]
          : !ncIsUndefined(d?.[col.title])
          ? d?.[col.title]
          : d?.[col.id];
        if (val !== undefined && this.context.api_version !== NcApiVersion.V3) {
          if (col.uidt === UITypes.Attachment && typeof val !== 'string') {
            val = JSON.stringify(val);
          }
          if (col.uidt === UITypes.DateTime && dayjs(val).isValid()) {
            val = this.formatDate(val);
          }
          if (col.uidt === UITypes.Duration) {
            if (col.meta?.duration !== undefined) {
              const duration = convertDurationToSeconds(val, col.meta.duration);
              if (duration._isValid) {
                val = duration._sec;
              }
            }
          }
          insertObj[sanitize(col.column_name)] = val;
        } else if (val !== undefined) {
          insertObj[sanitize(col.column_name)] = val;
        }
      }

      await this.validateOptions(col, insertObj);

      // validate data
      if (col?.meta?.validate && col?.validate) {
        const validate = col.getValidators();
        const cn = col.column_name;
        const columnTitle = col.title;
        if (validate) {
          await validateFuncOnColumn({
            column: col,
            value:
              insertObj?.[cn] ??
              insertObj?.[columnTitle] ??
              insertObj?.[col.id],
            apiVersion: this.context.api_version,
            customValidators: customValidators as any,
          });
        }
      }
    }
    return insertObj;
  }

  // Helper method to format date
  private formatDate(val: string): Knex.Raw | string {
    const { isMySQL, isSqlite, isPg } = this.clientMeta;
    if (val.indexOf('-') < 0 && val.indexOf('+') < 0 && val.slice(-1) !== 'Z') {
      // if no timezone is given,
      // then append +00:00 to make it as UTC
      val += '+00:00';
    }
    if (isMySQL) {
      // first convert the value to utc
      // from UI
      // e.g. 2022-01-01 20:00:00Z -> 2022-01-01 20:00:00
      // from API
      // e.g. 2022-01-01 20:00:00+08:00 -> 2022-01-01 12:00:00
      // if timezone info is not found - considered as utc
      // e.g. 2022-01-01 20:00:00 -> 2022-01-01 20:00:00
      // if timezone info is found
      // e.g. 2022-01-01 20:00:00Z -> 2022-01-01 20:00:00
      // e.g. 2022-01-01 20:00:00+00:00 -> 2022-01-01 20:00:00
      // e.g. 2022-01-01 20:00:00+08:00 -> 2022-01-01 12:00:00
      // then we use CONVERT_TZ to convert that in the db timezone
      return this.dbDriver.raw(`CONVERT_TZ(?, '+00:00', @@GLOBAL.time_zone)`, [
        dayjs(val).utc().format('YYYY-MM-DD HH:mm:ss'),
      ]);
    } else if (isSqlite) {
      // convert to UTC
      // e.g. 2022-01-01T10:00:00.000Z -> 2022-01-01 04:30:00+00:00
      return dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ');
    } else if (isPg) {
      // convert to UTC
      // e.g. 2023-01-01T12:00:00.000Z -> 2023-01-01 12:00:00+00:00
      // then convert to db timezone
      return this.dbDriver.raw(`? AT TIME ZONE CURRENT_SETTING('timezone')`, [
        dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ'),
      ]);
    } else {
      // e.g. 2023-01-01T12:00:00.000Z -> 2023-01-01 12:00:00+00:00
      return dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ');
    }
  }

  async bulkInsert(
    datas: any[],
    params?: {
      chunkSize?: number;
      cookie?: NcRequest;
      foreign_key_checks?: boolean;
      skip_hooks?: boolean;
      raw?: boolean;
      insertOneByOneAsFallback?: boolean;
      isSingleRecordInsertion?: boolean;
      allowSystemColumn?: boolean;
      typecast?: boolean;
      undo?: boolean;
      apiVersion?: NcApiVersion;
    },
  ) {
    return await baseModelInsert(this).bulk(datas, params);
  }

  async bulkUpdate(
    datas: any[],
    {
      cookie,
      raw = false,
      throwExceptionIfNotExist = false,
      isSingleRecordUpdation = false,
      allowSystemColumn = false,
      typecast = false,
      apiVersion,
      skip_hooks = false,
    }: {
      cookie?: any;
      raw?: boolean;
      throwExceptionIfNotExist?: boolean;
      isSingleRecordUpdation?: boolean;
      allowSystemColumn?: boolean;
      typecast?: boolean;
      apiVersion?: NcApiVersion;
      skip_hooks?: boolean;
    } = {},
  ) {
    let transaction;
    const readChunkSize = 100;
    const profiler = Profiler.start(`base-model/bulkUpdate`);

    try {
      const columns = await this.model.getColumns(this.context);

      // validate update data
      if (!raw) {
        for (const d of datas) {
          await this.validate(d, columns, { allowSystemColumn, typecast });
        }
      }

      const updateDatas = raw
        ? datas
        : await Promise.all(
            datas.map((d) =>
              this.model.mapAliasToColumn(
                this.context,
                d,
                this.clientMeta,
                this.dbDriver,
                columns,
              ),
            ),
          );

      const prevData = [];
      const newData = [];
      const updatePkValues = [];
      const toBeUpdated = [];
      const pkAndData: { pk: string; data: any }[] = [];

      for (const d of updateDatas) {
        const pkValues = this.extractPksValues(d, true);

        if (!pkValues) {
          if (throwExceptionIfNotExist)
            NcError.get(this.context).recordNotFound(pkValues);
          continue;
        }

        pkAndData.push({ pk: pkValues, data: d });
      }

      const attachmentCols = columns.filter((col) => isAttachment(col));
      let postUpdateOps: (() => Promise<string>)[] = [];

      for (let i = 0; i < pkAndData.length; i += readChunkSize) {
        const chunk = pkAndData.slice(i, i + readChunkSize);
        const pksToRead = chunk.map((v) => v.pk);

        const oldRecordChunkList = await this.chunkList({ pks: pksToRead });

        // get ast
        const { ast, parsedQuery } = await getAst(this.context, {
          model: this.model,
          query: {},
          extractOnlyPrimaries: false,
        });
        // nocoexecute
        const oldRecords = await nocoExecute(
          ast,
          oldRecordChunkList,
          {},
          parsedQuery,
        );
        const oldRecordsMap = new Map<string, any>(
          oldRecords.map((r) => [this.extractPksValues(r, true), r]),
        );

        for (const { pk, data } of chunk) {
          const oldRecord = oldRecordsMap.get(pk);

          if (!oldRecord) {
            // removed data from error param, record not found message do not use data
            if (throwExceptionIfNotExist)
              NcError.get(this.context).recordNotFound(pk);
            continue;
          }
          await this.prepareNocoData(data, false, cookie, oldRecord);
          prevData.push(oldRecord);
          if (attachmentCols.length > 0) {
            const attachmentOperation =
              await new AttachmentUrlUploadPreparator().prepareAttachmentUrlUpload(
                this,
                {
                  attachmentCols,
                  data,
                  req: cookie,
                },
              );
            postUpdateOps = postUpdateOps.concat(
              attachmentOperation.postInsertOps.map((ops) => {
                return () => ops(pk);
              }),
            );
          }

          const wherePk = await this._wherePk(pk, true);
          toBeUpdated.push({ d: data, wherePk });

          updatePkValues.push(
            this.extractPksValues(
              {
                ...oldRecord,
                ...data,
              },
              true,
            ),
          );
        }
      }

      transaction = await this.dbDriver.transaction();
      try {
        if (
          this.model.primaryKeys.length === 1 &&
          (this.isPg || this.isMySQL || this.isSqlite)
        ) {
          await batchUpdate(
            transaction,
            this.tnPath,
            toBeUpdated.map((o) => o.d),
            this.model.primaryKey.column_name,
          );
        } else {
          for (const o of toBeUpdated) {
            await transaction(this.tnPath).update(o.d).where(o.wherePk);
          }
        }

        await transaction.commit();
        transaction = null;
      } catch (ex) {
        // Roll back and propagate — silently swallowing here would let the
        // post-update hooks (afterBulkUpdate, etc.) report success on data
        // that was never written.
        await transaction.rollback();
        // Mark finalized so the outer catch can't try to roll back the
        // already-closed trx if a post-commit op throws.
        transaction = null;
        throw ex;
      }

      if (apiVersion === NcApiVersion.V3) {
        profiler.log('updateLTARCols start');
        // remove LTAR/Links if part of the update request
        await this.updateLTARCols({
          datas,
          cookie,
        });
        profiler.log('postUpdateOps start');
        await Promise.all(postUpdateOps.map((ops) => ops()));
        profiler.log('postUpdateOps end');
      }

      if (!raw) {
        for (let i = 0; i < updatePkValues.length; i += readChunkSize) {
          const pksChunk = updatePkValues.slice(i, i + readChunkSize);

          const updatedRecordList = await this.list(
            { pks: pksChunk.join(',') },
            { limitOverride: pksChunk.length },
          );

          // get ast
          const { ast, parsedQuery } = await getAst(this.context, {
            model: this.model,
            query: {},
            extractOnlyPrimaries: false,
          });
          // nocoexecute
          const updatedRecords = await nocoExecute(
            ast,
            updatedRecordList,
            {},
            parsedQuery,
          );
          const updatedRecordsMap = new Map(
            updatedRecords.map((record) => [
              this.extractPksValues(record, true),
              record,
            ]),
          );

          for (const pk of pksChunk) {
            if (updatedRecordsMap.has(pk)) {
              newData.push(updatedRecordsMap.get(pk));
            }
          }
        }
      }

      if (!raw && !skip_hooks) {
        if (isSingleRecordUpdation) {
          await this.afterUpdate(prevData[0], newData[0], cookie, datas[0]);
        } else {
          await this.afterBulkUpdate(prevData, newData, cookie);
        }
      }
      profiler.end();
      return newData;
    } catch (e) {
      if (transaction) await transaction.rollback();
      throw e;
    }
  }

  async updateLTARCols({ datas, cookie }: { datas: any[]; cookie: NcRequest }) {
    return LTARColsUpdater({ baseModel: this, logger }).updateLTARCols({
      datas,
      cookie,
    });
  }

  async bulkUpdateAll(
    args: {
      where?: string;
      filterArr?: Filter[];
      viewId?: string;
      skipValidationAndHooks?: boolean;
      /**
       * When true, soft-deleted (trash) rows are included in the update.
       * Used by column-level rewrites (e.g. select option rename/delete)
       * that must keep trash rows in sync so restore lands on valid values.
       */
      includeSoftDeleted?: boolean;
    } = {},
    data,
    { cookie, skip_hooks = false }: { cookie: NcRequest; skip_hooks?: boolean },
  ) {
    try {
      let count = 0;

      const columns = await this.model.getColumns(this.context);

      const updateData = await this.model.mapAliasToColumn(
        this.context,
        data,
        this.clientMeta,
        this.dbDriver,
        columns,
      );
      if (!args.skipValidationAndHooks)
        await this.validate(updateData, columns);

      // if attachment provided error out
      for (const col of columns) {
        if (col.uidt === UITypes.Attachment && updateData[col.column_name]) {
          NcError.get(this.context).notImplemented(
            `Attachment bulk update all`,
          );
        }
      }

      await this.prepareNocoData(updateData, false, cookie);

      const pkValues = this.extractPksValues(updateData);
      if (pkValues !== null && pkValues !== undefined) {
        // pk is specified - by pass
      } else {
        const { where } = this._getListArgs(args);
        const qb = this.dbDriver(this.tnPath);
        const aliasColObjMap = await this.model.getAliasColObjMap(
          this.context,
          columns,
        );
        const { filters: filterObj } = extractFilterFromXwhere(
          this.context,
          where,
          aliasColObjMap,
          true,
        );

        // Resolve RLS conditions for bulkUpdateAll
        const rlsConditionsBUA = await this.getRlsConditions();
        const rlsFilterGroupBUA = rlsConditionsBUA.length
          ? [new Filter({ children: rlsConditionsBUA, is_group: true })]
          : [];

        const conditionObj = [
          ...rlsFilterGroupBUA,
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and',
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
        ];

        if (args.viewId) {
          conditionObj.push(
            new Filter({
              children:
                (await Filter.rootFilterList(this.context, {
                  viewId: args.viewId,
                })) || [],
              is_group: true,
            }),
          );
        }

        await conditionV2(this, conditionObj, qb, undefined, true);

        // Exclude soft-deleted records from bulk update unless caller opts in
        if (!args.includeSoftDeleted) {
          const softDeleteFilterBUA = await this.getSoftDeleteFilter();
          if (softDeleteFilterBUA) {
            qb.where(softDeleteFilterBUA);
          }
        }

        count = (
          await this.execAndParse(
            qb.clone().count('*', { as: 'count' }),
            null,
            {
              raw: true,
              first: true,
            },
          )
        )?.count;

        // insert records updating record details to audit table
        await this.bulkAudit({
          qb: qb.clone(),
          data,
          conditions: conditionObj,
          req: cookie,
          event: AuditV1OperationTypes.DATA_BULK_UPDATE,
        });

        qb.update(updateData);

        await this.execAndParse(qb, null, { raw: true });
      }

      if (!args.skipValidationAndHooks && !skip_hooks)
        await this.afterBulkUpdate(null, count, cookie, true);

      return count;
    } catch (e) {
      throw e;
    }
  }

  async bulkDelete(
    ids: any[],
    {
      cookie,
      throwExceptionIfNotExist = false,
      isSingleRecordDeletion = false,
    }: {
      cookie?: any;
      throwExceptionIfNotExist?: boolean;
      isSingleRecordDeletion?: boolean;
    } = {},
  ) {
    const columns = await this.model.getColumns(this.context);

    let transaction;
    try {
      const deleteIds = await Promise.all(
        ids.map((d) =>
          this.model.mapAliasToColumn(
            this.context,
            d,
            this.clientMeta,
            this.dbDriver,
            columns,
          ),
        ),
      );

      const deleted = [];
      const res = [];
      const pkAndData: { pk: any; data: any }[] = [];
      const readChunkSize = 100;
      for (const [i, d] of deleteIds.entries()) {
        const pkValues = getCompositePkValue(
          this.model.primaryKeys,
          this.extractPksValues(d),
        );
        if (!pkValues) {
          // throw or skip if no pk provided
          if (throwExceptionIfNotExist) {
            NcError.get(this.context).recordNotFound(pkValues);
          }
          continue;
        }

        pkAndData.push({ pk: pkValues, data: d });

        if (pkAndData.length >= readChunkSize || i === deleteIds.length - 1) {
          const tempToRead = pkAndData.splice(0, pkAndData.length);
          const oldRecords = await this.list(
            {
              pks: tempToRead.map((v) => v.pk).join(','),
            },
            {
              limitOverride: tempToRead.length,
              ignoreViewFilterAndSort: true,
            },
          );

          if (oldRecords.length === tempToRead.length) {
            deleted.push(...oldRecords);
            res.push(...tempToRead.map((v) => v.data));
          } else {
            for (const { pk, data } of tempToRead) {
              const oldRecord = oldRecords.find((r) =>
                this.comparePks(this.extractPksValues(r), pk),
              );

              if (!oldRecord) {
                // throw or skip if no record found
                if (throwExceptionIfNotExist) {
                  NcError.get(this.context).recordNotFound(pk);
                }
                continue;
              }

              deleted.push(oldRecord);
              res.push(data);
            }
          }
        }
      }

      await this.beforeBulkDelete(deleted, cookie);

      const source = await this.getSource();

      // Detect soft-delete column for meta sources
      const deletedColumn = columns.find((c) => isDeletedCol(c));
      const isSoftDelete =
        !!deletedColumn && source.isMeta() && this.model.isTrashEnabled;

      const collectedNotifications: {
        baseModel: any;
        model: any;
        ids: string[];
        colId: string;
      }[] = [];

      if (isSoftDelete) {
        transaction = await this.dbDriver.transaction();
        // Soft-delete: flag records instead of removing them, skip link cleanup
        const operationNow = this.now();
        const softDeletePayload: Record<string, any> = {
          [deletedColumn.column_name]: true,
        };
        // Stamp deleted-at / deleted-by so the trash UI can display them
        const lmtCol = this.model.columns.find(
          (c) => c.uidt === UITypes.LastModifiedTime && c.system,
        );
        const lmbCol = this.model.columns.find(
          (c) => c.uidt === UITypes.LastModifiedBy && c.system,
        );
        if (lmtCol) softDeletePayload[lmtCol.column_name] = operationNow;
        if (lmbCol) softDeletePayload[lmbCol.column_name] = cookie?.user?.id;

        if (this.model.primaryKeys.length === 1) {
          // Single PK — batch update with whereIn
          const idsVals = res.map((d) => d[this.model.primaryKey.column_name]);
          await transaction(this.tnPath)
            .update(softDeletePayload)
            .whereIn(this.model.primaryKey.column_name, idsVals);
        } else {
          // Composite PK — per-row update
          for (const d of res) {
            await transaction(this.tnPath).update(softDeletePayload).where(d);
          }
        }
      } else {
        const execQueries: ((
          trx: Knex.Transaction,
          ids: any[],
        ) => Promise<any>)[] = [];

        // Phase 1: Collect linked record IDs BEFORE the transaction nulls FKs / deletes junction rows
        // Phase 2: Notify (LMT + broadcast) AFTER transaction commits
        const bulkLinkedCollectors: ((ids: any[]) => Promise<{
          baseModel: any;
          model: any;
          ids: string[];
          colId: string;
        } | null>)[] = [];

        for (const column of this.model.columns) {
          if (!isLinksOrLTAR(column)) continue;

          const colOptions =
            await column.getColOptions<LinkToAnotherRecordColumn>(this.context);
          const { mmContext, refContext, childContext, parentContext } =
            await colOptions.getParentChildContext(this.context);

          const relationType = isMMOrMMLike(column) ? 'mm' : colOptions.type;
          const shouldCascadeHere = await shouldCascadeLinkCleanup(
            this.context,
            {
              isMeta: !!source.isMeta(),
              relationType,
              colOptions,
              mmContext,
            },
          );
          switch (relationType) {
            case 'mm':
              {
                if (!shouldCascadeHere) break;
                const mmTable = await Model.get(
                  mmContext,
                  colOptions.fk_mm_model_id,
                );
                const mmChildCol = await Column.get(mmContext, {
                  colId: colOptions.fk_mm_child_column_id,
                });
                const mmParentCol = await Column.get(mmContext, {
                  colId: colOptions.fk_mm_parent_column_id,
                });
                const parentTable = await (
                  await colOptions.getParentColumn(parentContext)
                ).getModel(parentContext);
                await parentTable.getColumns(parentContext);
                const mmBaseModel = await Model.getBaseModelSQL(mmContext, {
                  model: mmTable,
                  dbDriver: this.dbDriver,
                });
                const parentBaseModel = await Model.getBaseModelSQL(
                  parentContext,
                  { model: parentTable, dbDriver: this.dbDriver },
                );
                const inverseLinkCol = await extractCorrespondingLinkColumn(
                  this.context,
                  {
                    ltarColumn: column,
                    referencedTable: parentTable,
                    referencedTableColumns: parentTable.columns,
                  },
                );

                // Collect linked parent IDs before junction deletion
                bulkLinkedCollectors.push(async (ids) => {
                  const rows = await this.execAndParse(
                    this.dbDriver(mmBaseModel.getTnPath(mmTable.table_name))
                      .select(mmParentCol.column_name)
                      .whereIn(mmChildCol.column_name, ids),
                    null,
                    { raw: true },
                  );
                  const linkedIds = rows.map((r) => r[mmParentCol.column_name]);
                  return linkedIds.length
                    ? {
                        baseModel: parentBaseModel,
                        model: parentTable,
                        ids: linkedIds,
                        colId: inverseLinkCol?.id,
                      }
                    : null;
                });

                execQueries.push((trx, ids) =>
                  trx(mmBaseModel.getTnPath(mmTable.table_name))
                    .del()
                    .whereIn(mmChildCol.column_name, ids),
                );
              }
              break;
            case 'hm':
              {
                if (!shouldCascadeHere) break;
                // skip if it's an mm table column
                const relatedTable = await colOptions.getRelatedTable(
                  refContext,
                );
                if (relatedTable.mm) {
                  break;
                }

                const childColumn = await Column.get(childContext, {
                  colId: colOptions.fk_child_column_id,
                });

                await relatedTable.getColumns(refContext);
                const refBaseModel = await Model.getBaseModelSQL(refContext, {
                  model: relatedTable,
                  dbDriver: this.dbDriver,
                });
                const inverseLinkCol = await extractCorrespondingLinkColumn(
                  this.context,
                  {
                    ltarColumn: column,
                    referencedTable: relatedTable,
                    referencedTableColumns: relatedTable.columns,
                  },
                );

                // Collect child IDs before FK nulling
                bulkLinkedCollectors.push(async (ids) => {
                  const rows = await this.execAndParse(
                    this.dbDriver(
                      refBaseModel.getTnPath(relatedTable.table_name),
                    )
                      .select(relatedTable.primaryKey.column_name)
                      .whereIn(childColumn.column_name, ids),
                    null,
                    { raw: true },
                  );
                  const linkedIds = rows.map(
                    (r) => r[relatedTable.primaryKey.column_name],
                  );
                  return linkedIds.length
                    ? {
                        baseModel: refBaseModel,
                        model: relatedTable,
                        ids: linkedIds,
                        colId: inverseLinkCol?.id,
                      }
                    : null;
                });

                execQueries.push((trx, ids) =>
                  trx(refBaseModel.getTnPath(relatedTable.table_name))
                    .update({ [childColumn.column_name]: null })
                    .whereIn(childColumn.column_name, ids),
                );
              }
              break;
            case 'oo':
              {
                if (column.meta?.bt) {
                  // BT-side: collect parent IDs from deleted records' FKs
                  const btChildColumn = await colOptions.getChildColumn(
                    childContext,
                  );
                  const btParentColumn = await colOptions.getParentColumn(
                    parentContext,
                  );
                  const btParentTable = await btParentColumn.getModel(
                    parentContext,
                  );
                  await btParentTable.getColumns(parentContext);
                  const btParentBaseModel = await Model.getBaseModelSQL(
                    parentContext,
                    { model: btParentTable, dbDriver: this.dbDriver },
                  );
                  const btInverseLinkCol = await extractCorrespondingLinkColumn(
                    this.context,
                    {
                      ltarColumn: column,
                      referencedTable: btParentTable,
                      referencedTableColumns: btParentTable.columns,
                    },
                  );

                  bulkLinkedCollectors.push(async (_ids) => {
                    const rows = await this.execAndParse(
                      this.dbDriver(this.tnPath)
                        .select(btChildColumn.column_name)
                        .whereIn(this.model.primaryKey.column_name, _ids)
                        .whereNotNull(btChildColumn.column_name),
                      null,
                      { raw: true },
                    );
                    const parentIds = [
                      ...new Set(rows.map((r) => r[btChildColumn.column_name])),
                    ];
                    return parentIds.length
                      ? {
                          baseModel: btParentBaseModel,
                          model: btParentTable,
                          ids: parentIds as string[],
                          colId: btInverseLinkCol?.id,
                        }
                      : null;
                  });
                  break;
                }
                // HM-side: same as HM
                const ooRelatedTable = await colOptions.getRelatedTable(
                  refContext,
                );
                if (ooRelatedTable.mm) break;

                const ooChildColumn = await Column.get(childContext, {
                  colId: colOptions.fk_child_column_id,
                });

                await ooRelatedTable.getColumns(refContext);
                const ooRefBaseModel = await Model.getBaseModelSQL(refContext, {
                  model: ooRelatedTable,
                  dbDriver: this.dbDriver,
                });
                const ooInverseLinkCol = await extractCorrespondingLinkColumn(
                  this.context,
                  {
                    ltarColumn: column,
                    referencedTable: ooRelatedTable,
                    referencedTableColumns: ooRelatedTable.columns,
                  },
                );

                bulkLinkedCollectors.push(async (ids) => {
                  const rows = await this.execAndParse(
                    this.dbDriver(
                      ooRefBaseModel.getTnPath(ooRelatedTable.table_name),
                    )
                      .select(ooRelatedTable.primaryKey.column_name)
                      .whereIn(ooChildColumn.column_name, ids),
                    null,
                    { raw: true },
                  );
                  const linkedIds = rows.map(
                    (r) => r[ooRelatedTable.primaryKey.column_name],
                  );
                  return linkedIds.length
                    ? {
                        baseModel: ooRefBaseModel,
                        model: ooRelatedTable,
                        ids: linkedIds,
                        colId: ooInverseLinkCol?.id,
                      }
                    : null;
                });

                execQueries.push((trx, ids) =>
                  trx(ooRefBaseModel.getTnPath(ooRelatedTable.table_name))
                    .update({ [ooChildColumn.column_name]: null })
                    .whereIn(ooChildColumn.column_name, ids),
                );
              }
              break;
            case 'bt':
              {
                // Collect parent IDs from deleted records' FKs
                const btChildColumn = await colOptions.getChildColumn(
                  childContext,
                );
                const btParentColumn = await colOptions.getParentColumn(
                  parentContext,
                );
                const btParentTable = await btParentColumn.getModel(
                  parentContext,
                );
                await btParentTable.getColumns(parentContext);
                const btParentBaseModel = await Model.getBaseModelSQL(
                  parentContext,
                  { model: btParentTable, dbDriver: this.dbDriver },
                );
                const btInverseLinkCol = await extractCorrespondingLinkColumn(
                  this.context,
                  {
                    ltarColumn: column,
                    referencedTable: btParentTable,
                    referencedTableColumns: btParentTable.columns,
                  },
                );

                bulkLinkedCollectors.push(async (_ids) => {
                  const rows = await this.execAndParse(
                    this.dbDriver(this.tnPath)
                      .select(btChildColumn.column_name)
                      .whereIn(this.model.primaryKey.column_name, _ids)
                      .whereNotNull(btChildColumn.column_name),
                    null,
                    { raw: true },
                  );
                  const parentIds = [
                    ...new Set(rows.map((r) => r[btChildColumn.column_name])),
                  ];
                  return parentIds.length
                    ? {
                        baseModel: btParentBaseModel,
                        model: btParentTable,
                        ids: parentIds as string[],
                        colId: btInverseLinkCol?.id,
                      }
                    : null;
                });
                // No FK cleanup — FK is on the deleted record itself
              }
              break;
          }
        }

        // Phase 1: Collect linked IDs BEFORE transaction (data still intact).
        const idsVals = res.map((d) => d[this.model.primaryKey.column_name]);

        for (const collector of bulkLinkedCollectors) {
          try {
            const result = await collector(idsVals);
            if (result) collectedNotifications.push(result);
          } catch (e) {
            logger.error(e?.message, e?.stack);
          }
        }

        transaction = await this.dbDriver.transaction();

        // execQueries are pre-filtered above: pushed only when NocoDB must
        // cascade itself (meta source, or external FK with dr === 'NO ACTION').
        if (execQueries.length > 0) {
          for (const execQuery of execQueries) {
            await execQuery(transaction, idsVals);
          }
        }

        for (const d of res) {
          await transaction(this.tnPath).del().where(d);
        }
      }

      await transaction.commit();
      // Transaction is finalized; clear the reference so a post-commit
      // failure below can't trigger rollback() on an already-closed trx.
      transaction = null;

      const deletedIds = res.map((d) =>
        this.model.primaryKeys.length === 1
          ? d[this.model.primaryKey.column_name]
          : this.extractPksValues(d, true),
      );
      if (isSoftDelete) {
        // Mark file references as soft-deleted (excluded from storage count,
        // but physical files preserved for restore)
        await this.softDeleteFileReferences({
          oldData: deleted,
          columns: columns,
        });
        // Soft-delete: data still intact, updateLinkedRecordsOnDelete queries live data
        await this.updateLinkedRecordsOnDelete(deletedIds, cookie);
      } else {
        // Hard-delete: mark deleted — physical files cleaned up by file cleanup job
        await this.clearFileReferences({
          oldData: deleted,
          columns: columns,
        });

        // Phase 2: Notify linked records AFTER transaction commit — using IDs collected BEFORE
        for (const entry of collectedNotifications) {
          try {
            await entry.baseModel.updateLastModified({
              model: entry.model,
              rowIds: entry.ids,
              cookie,
              updatedColIds: [entry.colId].filter(Boolean),
            });
            await entry.baseModel.broadcastLinkUpdates(entry.ids);
          } catch (e) {
            logger.error(e?.message, e?.stack);
          }
        }
      }

      if (isSingleRecordDeletion) {
        await this.afterDelete(
          deleted[0],
          cookie,
          isSoftDelete
            ? AuditV1OperationTypes.DATA_SOFT_DELETE
            : AuditV1OperationTypes.DATA_DELETE,
        );
      } else {
        await this.afterBulkDelete(
          deleted,
          cookie,
          false,
          isSoftDelete
            ? AuditV1OperationTypes.DATA_BULK_SOFT_DELETE
            : AuditV1OperationTypes.DATA_BULK_DELETE,
          isSoftDelete
            ? AuditV1OperationTypes.DATA_SOFT_DELETE
            : AuditV1OperationTypes.DATA_DELETE,
        );
      }

      if (isSoftDelete) {
        await this.statsUpdate({ count: -deleted.length });
      }

      return res;
    } catch (e) {
      if (transaction) await transaction.rollback();
      throw e;
    }
  }

  async bulkDeleteAll(
    args: {
      where?: string;
      filterArr?: Filter[];
      viewId?: string;
      skipPks?: string;
      permanentDelete?: boolean;
    } = {},
    { cookie, skip_hooks = false }: { cookie: NcRequest; skip_hooks?: boolean },
  ) {
    return await new BaseModelDelete(this).bulkAll({
      args,
      cookie,
      skip_hooks,
    });
  }

  async permanentDeleteByIds(
    rowIds: string[],
    cookie: NcRequest,
    isBulkAllOperation = false,
  ) {
    return await new BaseModelDelete(this).permanentDeleteByIds(
      rowIds,
      cookie,
      isBulkAllOperation,
    );
  }

  /**
   *  Hooks
   * */

  public async handleRichTextMentions(
    _prevData: Record<string, any> | Record<string, any>[] | null,
    _newData: Record<string, any> | Record<string, any>[],
    _req: NcRequest,
  ) {
    return;
  }

  public async beforeInsert(
    data: Record<string, any>,
    req: NcRequest,
    params?: {
      allowSystemColumn?: boolean;
    },
  ): Promise<void> {
    const { allowSystemColumn = false } = params || {};

    if (!allowSystemColumn && this.model.synced) {
      NcError.get(this.context).prohibitedSyncTableOperation({
        modelName: this.model.title,
        operation: 'insert',
      });
    }

    await this.handleHooks('before.insert', null, data, req);
  }

  public async beforeBulkInsert(
    data: Record<string, any>[],
    req: NcRequest,
    params?: {
      allowSystemColumn?: boolean;
    },
  ): Promise<void> {
    const { allowSystemColumn = false } = params || {};

    if (!allowSystemColumn && this.model.synced) {
      NcError.get(this.context).prohibitedSyncTableOperation({
        modelName: this.model.title,
        operation: 'insert',
      });
    }

    await this.handleHooks('before.bulkInsert', null, data, req);
  }

  public async afterInsert({
    data,
    insertData,
    req,
  }: {
    data: Record<string, any>;
    insertData: Record<string, any>;
    req: NcRequest;
  }): Promise<void> {
    await this.handleHooks('after.insert', null, data, req);
    const id = this.extractPksValues(data);
    const filteredAuditData = removeBlankPropsAndMask(insertData || data, [
      'CreatedAt',
      'UpdatedAt',
      // exclude virtual columns
      ...this.model.columns
        .filter((c) => isVirtualCol(c) || isSystemColumn(c))
        .map((c) => c.title),
    ]);

    // disable external source audit in cloud
    if (await this.isDataAuditEnabled()) {
      await Audit.insert(
        await generateAuditV1Payload<DataInsertPayload>(
          AuditV1OperationTypes.DATA_INSERT,
          {
            context: {
              ...this.context,
              source_id: this.model.source_id,
              fk_model_id: this.model.id,
              row_id: this.extractPksValues(id, true),
            },
            details: {
              data: formatDataForAudit(filteredAuditData, this.model.columns),
              column_meta: extractColsMetaForAudit(
                this.model.columns,
                filteredAuditData,
              ),
            },
            req,
          },
        ),
      );
    }
    await this.handleRichTextMentions(null, data, req);
  }

  public async afterBulkInsert(
    data: Record<string, any>[],
    req: NcRequest,
  ): Promise<void> {
    await this.handleHooks('after.bulkInsert', null, data, req);
    let parentAuditId;

    // disable external source audit in cloud
    if (!req.ncParentAuditId && (await this.isDataAuditEnabled())) {
      parentAuditId = await Noco.ncAudit.genNanoid(MetaTable.AUDIT);

      await Audit.insert(
        await generateAuditV1Payload<DataBulkDeletePayload>(
          AuditV1OperationTypes.DATA_BULK_INSERT,
          {
            details: {},
            context: {
              ...this.context,
              source_id: this.model.source_id,
              fk_model_id: this.model.id,
            },
            req,
            id: parentAuditId,
          },
        ),
      );

      req.ncParentAuditId = parentAuditId;
    }

    // disable external source audit in cloud
    if (await this.isDataAuditEnabled()) {
      // data here is not mapped to column alias
      await Audit.insert(
        await Promise.all(
          data.map((d) => {
            const data = remapWithAlias({
              data: d,
              columns: this.model.columns,
            });

            return generateAuditV1Payload<DataInsertPayload>(
              AuditV1OperationTypes.DATA_INSERT,
              {
                context: {
                  ...this.context,
                  source_id: this.model.source_id,
                  fk_model_id: this.model.id,
                  row_id: this.extractPksValues(data, true),
                },
                details: {
                  data: formatDataForAudit(
                    removeBlankPropsAndMask(data, [
                      'created_at',
                      'updated_at',
                      'created_by',
                      'updated_by',
                    ]),
                    this.model.columns,
                  ),
                  column_meta: extractColsMetaForAudit(
                    this.model.columns,
                    data,
                  ),
                },
                req,
              },
            );
          }),
        ),
      );
    }

    await this.handleRichTextMentions(null, data, req);
  }

  public async afterDelete(
    data: Record<string, any>,
    req: NcRequest,
    eventType: AuditV1OperationTypes = AuditV1OperationTypes.DATA_DELETE,
  ): Promise<void> {
    const id = this.extractPksValues(data);

    // disable external source audit in cloud
    if (await this.isDataAuditEnabled()) {
      await Audit.insert(
        await generateAuditV1Payload<DataDeletePayload>(eventType, {
          details: {
            data: removeBlankPropsAndMask(data, ['CreatedAt', 'UpdatedAt']),
            column_meta: extractColsMetaForAudit(this.model.columns, data),
          },
          context: {
            ...this.context,
            source_id: this.model.source_id,
            fk_model_id: this.model.id,
            row_id: this.extractPksValues(id, true),
          },
          req,
        }),
      );
    }

    await this.handleHooks('after.delete', null, data, req);
  }

  public async afterBulkDelete(
    data: Record<string, any>[],
    req: NcRequest,
    isBulkAllOperation = false,
    bulkEventType: AuditV1OperationTypes = AuditV1OperationTypes.DATA_BULK_DELETE,
    rowEventType: AuditV1OperationTypes = AuditV1OperationTypes.DATA_DELETE,
  ): Promise<void> {
    await this.handleHooks('after.bulkDelete', null, data, req);

    // bulkAll chunks rows into 100-row batches and calls afterBulkDelete per
    // chunk. The first chunk creates the parent audit; later chunks reuse
    // req.ncParentAuditId so the whole operation appears as one event in
    // the trash UI instead of N (one per 100-row chunk).
    const reuseParent = isBulkAllOperation && !!req.ncParentAuditId;
    const parentAuditId = reuseParent
      ? req.ncParentAuditId
      : await Noco.ncAudit.genNanoid(MetaTable.AUDIT);

    // disable external source audit in cloud
    if (!reuseParent && (await this.isDataAuditEnabled())) {
      await Audit.insert(
        await generateAuditV1Payload<DataBulkDeletePayload>(bulkEventType, {
          details: {},
          context: {
            ...this.context,
            source_id: this.model.source_id,
            fk_model_id: this.model.id,
          },
          req,
          id: parentAuditId,
        }),
      );
    }
    req.ncParentAuditId = parentAuditId;

    const column_meta = extractColsMetaForAudit(this.model.columns);

    // disable external source audit in cloud
    if (await this.isDataAuditEnabled()) {
      await Audit.insert(
        await Promise.all(
          data?.map?.((d) =>
            generateAuditV1Payload<DataDeletePayload>(rowEventType, {
              details: {
                data: d
                  ? formatDataForAudit(
                      removeBlankPropsAndMask(d, ['CreatedAt', 'UpdatedAt']),
                      this.model.columns,
                    )
                  : null,
                column_meta,
              },
              context: {
                ...this.context,
                source_id: this.model.source_id,
                fk_model_id: this.model.id,
                row_id: this.extractPksValues(d, true),
              },
              req,
            }),
          ),
        ),
      );
    }
  }

  public async afterBulkRestore(
    data: any,
    req,
    isBulkAllOperation = false,
  ): Promise<void> {
    const isBulk = data?.length > 1;
    // Streamed restore calls afterBulkRestore per chunk. First chunk creates
    // the parent audit; later chunks reuse req.ncParentAuditId so the whole
    // operation appears as one event instead of N.
    const reuseParent = isBulkAllOperation && !!req.ncParentAuditId;
    const parentAuditId = reuseParent
      ? req.ncParentAuditId
      : isBulk || isBulkAllOperation
      ? await Noco.ncAudit.genNanoid(MetaTable.AUDIT)
      : undefined;

    if (
      !reuseParent &&
      (isBulk || isBulkAllOperation) &&
      (await this.isDataAuditEnabled())
    ) {
      await Audit.insert(
        await generateAuditV1Payload<DataBulkDeletePayload>(
          AuditV1OperationTypes.DATA_BULK_RESTORE,
          {
            details: {},
            context: {
              ...this.context,
              source_id: this.model.source_id,
              fk_model_id: this.model.id,
            },
            req,
            id: parentAuditId,
          },
        ),
      );
    }
    if (parentAuditId) req.ncParentAuditId = parentAuditId;

    const column_meta = extractColsMetaForAudit(this.model.columns);

    if (await this.isDataAuditEnabled()) {
      await Audit.insert(
        await Promise.all(
          data?.map?.((d) =>
            generateAuditV1Payload<DataDeletePayload>(
              AuditV1OperationTypes.DATA_RESTORE,
              {
                details: {
                  data: d
                    ? formatDataForAudit(
                        removeBlankPropsAndMask(d, ['CreatedAt', 'UpdatedAt']),
                        this.model.columns,
                      )
                    : null,
                  column_meta,
                },
                context: {
                  ...this.context,
                  source_id: this.model.source_id,
                  fk_model_id: this.model.id,
                  row_id: this.extractPksValues(d, true),
                },
                req,
              },
            ),
          ),
        ),
      );
    }

    // Re-add the restored records to the active row count
    await this.statsUpdate({ count: data?.length ?? 0 });
  }

  public async afterBulkUpdate(
    prevData: Record<string, any>[] | null,
    newData: Record<string, any>[] | number,
    req: NcRequest,
    isBulkAllOperation = false,
  ): Promise<void> {
    if (!isBulkAllOperation && Array.isArray(newData)) {
      await this.handleHooks('after.bulkUpdate', prevData, newData, req);
    }

    if (!Array.isArray(newData)) return;

    if (newData.length > 0) {
      const parentAuditId = await Noco.ncAudit.genNanoid(MetaTable.AUDIT);

      // disable external source audit in cloud
      if (await this.isDataAuditEnabled()) {
        await Audit.insert(
          await generateAuditV1Payload<DataBulkUpdatePayload>(
            AuditV1OperationTypes.DATA_BULK_UPDATE,
            {
              details: {},
              context: {
                ...this.context,
                source_id: this.model.source_id,
                fk_model_id: this.model.id,
              },
              req,
              id: parentAuditId,
            },
          ),
        );

        req.ncParentAuditId = parentAuditId;

        await Audit.insert(
          (
            await Promise.all(
              newData.map(async (d, i) => {
                const formattedOldData = formatDataForAudit(
                  prevData?.[i]
                    ? formatDataForAudit(
                        removeBlankPropsAndMask(
                          prevData?.[i],
                          ['CreatedAt', 'UpdatedAt'],
                          true,
                        ),
                        this.model.columns,
                      )
                    : null,
                  this.model.columns,
                );
                const formattedData = formatDataForAudit(
                  d
                    ? formatDataForAudit(
                        removeBlankPropsAndMask(
                          d,
                          ['CreatedAt', 'UpdatedAt'],
                          true,
                        ),
                        this.model.columns,
                      )
                    : null,
                  this.model.columns,
                );

                const updateDiff = populateUpdatePayloadDiff({
                  keepUnderModified: true,
                  prev: formattedOldData,
                  next: formattedData,
                  exclude: extractExcludedColumnNames(this.model.columns),
                  excludeNull: false,
                  excludeBlanks: false,
                  keepNested: true,
                }) as UpdatePayload;

                if (updateDiff) {
                  return await generateAuditV1Payload<DataUpdatePayload>(
                    AuditV1OperationTypes.DATA_UPDATE,
                    {
                      context: {
                        ...this.context,
                        source_id: this.model.source_id,
                        fk_model_id: this.model.id,
                        row_id: this.extractPksValues(d, true),
                      },
                      details: {
                        old_data: updateDiff.previous_state,
                        data: updateDiff.modifications,
                        column_meta: extractColsMetaForAudit(
                          this.model.columns.filter(
                            (c) => c.title in updateDiff.modifications,
                          ),
                          d,
                          prevData?.[i],
                        ),
                      },
                      req,
                    },
                  );
                } else {
                  return [];
                }
              }),
            )
          ).flat(),
        );
      }
    }

    await this.handleRichTextMentions(prevData, newData, req);
  }

  public async beforeUpdate(
    data: Record<string, any>,
    req: NcRequest,
  ): Promise<void> {
    const ignoreWebhook = req.query?.ignoreWebhook;
    if (ignoreWebhook) {
      if (ignoreWebhook != 'true' && ignoreWebhook != 'false') {
        NcError.get(this.context).badRequest(
          'ignoreWebhook value can be either true or false',
        );
      }
    }
    if (ignoreWebhook === undefined || ignoreWebhook === 'false') {
      await this.handleHooks('before.update', null, data, req);
    }
  }

  public async afterUpdate(
    prevData: Record<string, any>,
    newData: Record<string, any>,
    req: NcRequest,
    updateObj?: Record<string, any>,
  ): Promise<void> {
    // TODO this is a temporary fix for the audit log / DOMPurify causes issue for long text
    const id = this.extractPksValues(newData);

    const oldData: { [key: string]: any } = {};
    const data: { [key: string]: any } = {};

    if (updateObj) {
      updateObj = await this.model.mapColumnToAlias(this.context, updateObj);

      for (const k of Object.keys(updateObj)) {
        oldData[k] = prevData[k];
        data[k] = newData[k];
      }
    } else {
      Object.assign(oldData, prevData);
      Object.assign(data, newData);
    }

    // disable external source audit in cloud
    if (await this.isDataAuditEnabled()) {
      const formattedOldData = formatDataForAudit(oldData, this.model.columns);
      const formattedData = formatDataForAudit(data, this.model.columns);

      const updateDiff = populateUpdatePayloadDiff({
        keepUnderModified: true,
        prev: formattedOldData,
        next: formattedData,
        exclude: extractExcludedColumnNames(this.model.columns),
        excludeNull: false,
        excludeBlanks: false,
        keepNested: true,
      }) as UpdatePayload;

      if (updateDiff) {
        await Audit.insert(
          await generateAuditV1Payload<DataUpdatePayload>(
            AuditV1OperationTypes.DATA_UPDATE,
            {
              context: {
                ...this.context,
                source_id: this.model.source_id,
                fk_model_id: this.model.id,
                row_id: id,
              },
              details: {
                old_data: updateDiff.previous_state,
                data: updateDiff.modifications,
                column_meta: extractColsMetaForAudit(
                  this.model.columns.filter(
                    (c) => c.title in updateDiff.modifications,
                  ),
                  data,
                  oldData,
                ),
              },
              req,
            },
          ),
        );
      }
    }

    const ignoreWebhook = req.query?.ignoreWebhook;
    if (ignoreWebhook) {
      if (ignoreWebhook != 'true' && ignoreWebhook != 'false') {
        NcError.get(this.context).badRequest(
          'ignoreWebhook value can be either true or false',
        );
      }
    }
    if (ignoreWebhook === undefined || ignoreWebhook === 'false') {
      await this.handleHooks('after.update', prevData, newData, req);
    }
    await this.handleRichTextMentions(prevData, newData, req);
  }

  public async beforeDelete(
    data: Record<string, any>,
    req: NcRequest,
  ): Promise<void> {
    if (this.model.synced) {
      NcError.get(this.context).prohibitedSyncTableOperation({
        modelName: this.model.title,
        operation: 'delete',
      });
    }

    await this.handleHooks('before.delete', null, data, req);
  }

  public async beforeBulkDelete(
    _data: Record<string, any>[],
    _req: NcRequest,
  ): Promise<void> {
    if (this.model.synced) {
      NcError.get(this.context).prohibitedSyncTableOperation({
        modelName: this.model.title,
        operation: 'delete',
      });
    }
  }

  protected async handleHooks(
    hookName: string,
    prevData: Record<string, any> | Record<string, any>[] | null,
    newData: Record<string, any> | Record<string, any>[] | null,
    req: NcRequest,
  ): Promise<void> {
    // Webhook destinations are server-side and configured by the workspace
    // owner — they receive whatever the caller passes here. Public-viewer
    // email redaction is applied at the API response boundary (in afterX
    // methods, after this hook fires), not in the data layer, so write paths
    // that opt in via `skipPublicRedaction` on their read deliver full emails
    // to webhooks while the API response remains redacted.
    Noco.eventEmitter.emit(HANDLE_WEBHOOK, {
      context: { ...this.context, cache: false, cacheMap: undefined },
      hookName,
      prevData,
      newData,
      user: req?.user,
      viewId: this.viewId,
      modelId: this.model.id,
      tnPath: this.tnPath,
    });
  }

  // Apply public-viewer email redaction to data destined for the API response,
  // after webhook hooks have fired with full emails. Idempotent — redacting
  // already-redacted data is a no-op. Variadic so callers can pass multiple
  // payloads in one call (e.g. prevData + newData on updates).
  protected async redactPublicForResponse(
    ...payloads: any[]
  ): Promise<void> {
    if (!this.context?.is_public) return;
    const userColumns = await this._getUserBearingColumns();
    if (!userColumns.length) return;
    for (const p of payloads) {
      if (p == null) continue;
      await this._applyPublicEmailRedaction(p, userColumns);
    }
  }

  public async errorInsert(
    _e: Error,
    _data: Record<string, any>,
    _cookie: NcRequest,
  ) {}

  public async errorUpdate(
    _e: Error,
    _data: Record<string, any>,
    _cookie: NcRequest,
  ) {}

  // todo: handle composite primary key
  public extractPksValues(data: Record<string, any>, asString = false) {
    return dataWrapper(data).extractPksValue(this.model, asString);
  }

  protected async errorDelete(
    _e: Error,
    _id: Record<string, any>,
    _cookie: NcRequest,
  ) {}

  async validate(
    data: Record<string, any>,
    columns?: Column[],
    {
      typecast,
      allowSystemColumn,
    }: { typecast?: boolean; allowSystemColumn?: boolean } = {
      typecast: false,
      allowSystemColumn: false,
    },
  ): Promise<boolean> {
    const cols = columns || (await this.model.getColumns(this.context));
    // let cols = Object.keys(this.columns);
    for (let i = 0; i < cols.length; ++i) {
      const column = this.model.columns[i];

      if (column.title in data) {
        if (
          isCreatedOrLastModifiedTimeCol(column) ||
          isCreatedOrLastModifiedByCol(column)
        ) {
          NcError.get(this.context).badRequest(
            `Column "${column.title}" is auto generated and cannot be updated`,
          );
        }

        if (column.system && !allowSystemColumn) {
          let shouldThrow = true;

          // allow updating order column (required for undo/redo operations)
          // TODO: add undo flag here
          if (column.uidt === UITypes.Order) {
            shouldThrow = false;
          }

          // allow updating ForeignKey since we are using it for belongs to
          if (column.uidt === UITypes.ForeignKey) {
            shouldThrow = false;
          }

          // allow updating self link column (system counter part)
          else if (isSelfLinkCol(column)) {
            shouldThrow = false;
          }

          if (shouldThrow) {
            NcError.get(this.context).badRequest(
              `Column "${column.title}" is system column and cannot be updated`,
            );
          }
        }

        if (!allowSystemColumn && column.readonly) {
          NcError.get(this.context).badRequest(
            `Column "${column.title}" is readonly column and cannot be updated`,
          );
        }
      }
      try {
        await this.validateOptions(column, data);
      } catch (ex) {
        if (ex instanceof OptionsNotExistsError && typecast) {
          const UpdatedColumn = await Column.update(this.context, column.id, {
            ...column,
            colOptions: {
              options: [
                ...column.colOptions.options,
                ...ex.options.map((k, index) => ({
                  fk_column_id: column.id,
                  title: k,
                  color: enumColors.get(
                    'light',
                    (column.colOptions.options ?? []).length + index,
                  ),
                })),
              ],
            },
          });

          const table = await Model.getWithInfo(this.context, {
            id: column.fk_model_id,
          });

          NocoSocket.broadcastEvent(this.context, {
            event: EventType.META_EVENT,
            payload: {
              action: 'column_update',
              payload: {
                table,
                column: UpdatedColumn,
              },
            },
          });
        } else {
          throw ex;
        }
      }

      // Validates the constraints on the data based on the column definitions
      this.validateConstraints(column, data);

      // skip validation if `validate` is undefined or false
      if (!column?.meta?.validate || !column?.validate) continue;

      const validate = column.getValidators();
      const cn = column.column_name;
      const columnTitle = column.title;
      if (!validate) continue;

      await validateFuncOnColumn({
        value: data?.[cn] ?? data?.[columnTitle] ?? data?.[column.id],
        column,
        apiVersion: this.context.api_version,
        customValidators: customValidators as any,
      });
    }
    return true;
  }

  /*
   *  Utility method to validate database constraints
   */
  protected validateConstraints(
    column: Column<any>,
    data: Record<string, any>,
  ) {
    if (
      // skip dtxp length check for date/time columns where dtxp represents precision, not max length
      ![UITypes.Date, UITypes.DateTime, UITypes.Time].includes(column.uidt) &&
      typeof data[column.title] === 'string' &&
      typeof column.dtxp === 'number' &&
      column.dtxp < data[column.title]?.length
    ) {
      NcError.get(this.context).badRequest(
        `Column "${column.title}" value exceeds the maximum length of ${column.dtxp}`,
      );
    }
  }

  public async getHighestOrderInTable(): Promise<BigNumber> {
    const orderColumn = this.model.columns.find(
      (c) => c.uidt === UITypes.Order,
    );

    if (!orderColumn) {
      return null;
    }

    const qb = this.dbDriver(this.tnPath)
      .max(`${orderColumn.column_name} as max_order`)
      .first();

    const softDeleteFilter = await this.getSoftDeleteFilter();
    if (softDeleteFilter) {
      qb.where(softDeleteFilter);
    }

    const orderQuery = await qb;

    const order = new BigNumber(orderQuery ? orderQuery['max_order'] || 0 : 0);

    return order.plus(ORDER_STEP_INCREMENT);
  }

  // method for validating otpions if column is single/multi select
  protected async validateOptions(
    column: Column<any>,
    insertOrUpdateObject: Record<string, any>,
  ) {
    // if SingleSelect or MultiSelect, then validate the options
    if (
      !(
        column.uidt === UITypes.SingleSelect ||
        column.uidt === UITypes.MultiSelect
      )
    ) {
      return;
    }

    const columnTitle = column.title;
    const columnName = column.column_name;
    const columnValue =
      insertOrUpdateObject?.[columnTitle] ?? insertOrUpdateObject?.[columnName];
    if (!columnValue) {
      return;
    }

    const options = await column
      .getColOptions<{ options: SelectOption[] }>(this.context)
      .then(
        (selectOptionsMeta) =>
          selectOptionsMeta?.options?.map((opt) => opt.title) || [],
      );

    let columnValueArr: any[];

    // if multi select, then split the values if it is not an array
    if (column.uidt === UITypes.MultiSelect) {
      if (Array.isArray(columnValue)) {
        columnValueArr = columnValue;
      } else {
        columnValueArr = `${columnValue}`.split(',').map((val) => {
          // If options has any extra space option then return as it is
          if (options.includes(val)) return val;

          // If options does not have the option then return the trimmed value
          return val.trim();
        });
      }
    } else {
      columnValueArr = [columnValue];
    }

    const notExistedOptions: any[] = [];
    for (let j = 0; j < columnValueArr.length; ++j) {
      const val = columnValueArr[j];
      if (!options.includes(val) && !options.includes(`'${val}'`)) {
        notExistedOptions.push(val);
      }
    }
    if (notExistedOptions.length > 0) {
      NcError.get(this.context).optionsNotExists({
        columnTitle,
        validOptions: options,
        options: notExistedOptions,
      });
    }
  }

  async addChild({
    colId,
    rowId,
    childId,
    cookie,
    onlyUpdateAuditLogs,
    prevData,
  }: {
    colId: string;
    rowId: string;
    childId: string;
    cookie?: any;
    onlyUpdateAuditLogs?: boolean;
    prevData?: Record<string, any>;
  }) {
    await this.checkPermission({
      entity: PermissionEntity.FIELD,
      entityId: colId,
      permission: PermissionKey.RECORD_FIELD_EDIT,
      user: cookie?.user,
      req: cookie,
    });

    await this.model.getColumns(this.context);
    const column = this.model.columnsById[colId];

    if (
      !column ||
      ![UITypes.LinkToAnotherRecord, UITypes.Links].includes(column.uidt)
    )
      NcError.get(this.context).fieldNotFound(colId);

    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>(
      this.context,
    );

    // return if onlyUpdateAuditLogs is true and is not bt column
    if (onlyUpdateAuditLogs && colOptions.type !== RelationTypes.BELONGS_TO) {
      return;
    }

    const relationManager = await RelationManager.getRelationManager(
      this,
      colId,
      { rowId, childId },
    );
    await relationManager.addChild({
      onlyUpdateAuditLogs,
      prevData,
      req: cookie,
    });

    await this.writeLinkAudits(
      await relationManager.getAuditUpdateObj(cookie),
      'addChild',
    );
  }

  private async writeLinkAudits(
    auditObjs: Awaited<ReturnType<RelationManager['getAuditUpdateObj']>>,
    callerTag: string,
  ) {
    try {
      if (!auditObjs.length || !(await this.isDataAuditEnabled())) return;

      // Pre-resolve LTAR display value overrides per unique columnId. When
      // no LTAR in the batch carries `fk_display_value_column_id` (the >99%
      // case), `hasAny` is false and we skip threading `displayColumn`
      // through `fetchDisplayValueMap`/`displayValueMapKey` entirely — the
      // values fall back to the table's primary value (pre-override behavior).
      const { refByColId, sourceByColId, hasAny } =
        await this.resolveLtarOverrideColsForBatch(auditObjs);

      const refDisplayColFor = (obj: (typeof auditObjs)[number]) =>
        hasAny && obj.columnId ? refByColId.get(obj.columnId) : undefined;
      const sourceDisplayColFor = (obj: (typeof auditObjs)[number]) =>
        hasAny && obj.columnId ? sourceByColId.get(obj.columnId) : undefined;

      const missingDvProps: {
        model: Model;
        id: any;
        displayColumn?: Column;
      }[] = [];
      for (const obj of auditObjs) {
        if (obj.displayValue === undefined)
          missingDvProps.push({
            model: obj.model,
            id: obj.rowId,
            displayColumn: sourceDisplayColFor(obj),
          });
        if (obj.refDisplayValue === undefined && obj.refModel) {
          missingDvProps.push({
            model: obj.refModel,
            id: obj.refRowId,
            displayColumn: refDisplayColFor(obj),
          });
        }
      }
      const dvMap = await this.fetchDisplayValueMap(missingDvProps);

      for (const obj of auditObjs) {
        const displayValue =
          obj.displayValue ??
          dvMap.get(
            displayValueMapKey({
              model: obj.model,
              id: obj.rowId,
              displayColumn: sourceDisplayColFor(obj),
            }),
          );
        const refDisplayValue =
          obj.refDisplayValue ??
          dvMap.get(
            displayValueMapKey({
              model: obj.refModel,
              id: obj.refRowId,
              displayColumn: refDisplayColFor(obj),
            }),
          );

        const opType =
          obj.opSubType === AuditOperationSubTypes.LINK_RECORD
            ? AuditV1OperationTypes.DATA_LINK
            : AuditV1OperationTypes.DATA_UNLINK;

        try {
          await Audit.insert(
            await generateAuditV1Payload<DataLinkPayload | DataUnlinkPayload>(
              opType,
              {
                context: {
                  ...this.context,
                  source_id: obj.model.source_id,
                  fk_model_id: obj.model.id,
                  row_id: this.extractPksValues(obj.rowId, true) as string,
                },
                details: {
                  table_title: obj.model.title,
                  ref_table_title: obj.refModel.title,
                  link_field_title: obj.columnTitle,
                  link_field_id: obj.columnId,
                  row_id: obj.rowId,
                  ref_row_id: obj.refRowId,
                  display_value: displayValue,
                  ref_display_value: refDisplayValue,
                  type: obj.type,
                },
                req: obj.req,
              },
            ),
          );
        } catch (e) {
          logger.error(
            `[${callerTag}] audit write failed: ${e.message}`,
            e.stack,
          );
        }
      }
    } catch (e) {
      logger.error(`[${callerTag}] audit batch failed: ${e.message}`, e.stack);
    }
  }

  public async afterAddChild({
    columnTitle,
    columnId,
    rowId,
    refRowId,
    req,
    model = this.model,
    refModel = this.model,
    displayValue,
    refDisplayValue,
    type,
  }: {
    columnTitle: string;
    columnId: string;
    refColumnTitle: string;
    rowId: unknown;
    refRowId: unknown;
    req: NcRequest;
    model: Model;
    refModel: Model;
    displayValue: unknown;
    refDisplayValue: unknown;
    type: RelationTypes;
  }): Promise<void> {
    // disable external source audit in cloud
    if (!(await this.isDataAuditEnabled())) {
      return;
    }

    if (!refDisplayValue) {
      refDisplayValue = await this.readByPkFromModel(
        refModel,
        undefined,
        true,
        refRowId,
        false,
        {},
        { ignoreView: true, getHiddenColumn: true, extractOnlyPrimaries: true },
      );
    }

    if (!displayValue) {
      displayValue = await this.readByPkFromModel(
        model,
        undefined,
        true,
        rowId,
        false,
        {},
        { ignoreView: true, getHiddenColumn: true, extractOnlyPrimaries: true },
      );
    }

    await Audit.insert(
      await generateAuditV1Payload<DataLinkPayload>(
        AuditV1OperationTypes.DATA_LINK,
        {
          context: {
            ...this.context,
            source_id: model.source_id,
            fk_model_id: model.id,
            row_id: this.extractPksValues(rowId, true) as string,
          },
          details: {
            table_title: model.title,
            ref_table_title: refModel.title,
            link_field_title: columnTitle,
            link_field_id: columnId,
            row_id: rowId,
            ref_row_id: refRowId,
            display_value: displayValue,
            ref_display_value: refDisplayValue,
            type,
          },
          req,
        },
      ),
    );
  }

  async afterAddOrRemoveChild(
    commonAuditObj: {
      opType: AuditV1OperationTypes;
      model: Model;
      refModel: Model;
      columnTitle: string;
      columnId: string;
      refColumnTitle: string;
      refColumnId: string;
      req: NcRequest;
    },
    auditObjs: Array<{
      rowId: unknown;
      refRowId: unknown;
      displayValue?: unknown;
      refDisplayValue?: unknown;
      type: RelationTypes;
    }>,
  ): Promise<void> {
    if (!(await this.isDataAuditEnabled())) {
      return;
    }

    const { opType, model, refModel, columnTitle, columnId, req } =
      commonAuditObj;

    const context = {
      ...this.context,
      base_id: model.base_id,
    };

    const refContext = {
      ...this.context,
      base_id: refModel.base_id,
    };

    // populate missing display values
    const refBaseModel = await Model.getBaseModelSQL(refContext, {
      model: refModel,
      dbDriver: this.dbDriver,
      queryQueue: this._queryQueue,
    });

    await model.getColumns(context);
    await refModel.getColumns(refContext);

    const missingDisplayValues = auditObjs.filter(
      (auditObj) => !auditObj.displayValue,
    );

    const missingRefDisplayValues = auditObjs.filter(
      (auditObj) => !auditObj.refDisplayValue,
    );

    // Per-LTAR display value override: ref-side reads this LTAR's
    // fk_display_value_column_id; source-side reads the paired (reverse) LTAR's
    // override. Both fall back to the table PV when no override is configured.
    const sourceDisplayCol = await this.resolveReverseLtarDisplayCol(
      columnId,
      model,
      refModel,
    );
    const refDisplayCol = await this.resolveLtarDisplayCol(columnId, refModel);

    const displayValueColumn = sourceDisplayCol ?? model.displayValue;
    const refDisplayValueColumn = refDisplayCol ?? refModel.displayValue;

    const displayValueMap = new Map<string, string>();
    const refDisplayValueMap = new Map<string, string>();

    if (missingDisplayValues.length > 0) {
      for (let i = 0; i < missingDisplayValues.length; i += 100) {
        const chunk = missingDisplayValues.slice(i, i + 100);

        const displayValues = await this.list(
          {
            pks: chunk.map((auditObj) => auditObj.rowId).join(','),
            fieldsSet: new Set(
              [model.primaryKey?.title, displayValueColumn?.title].filter(
                Boolean,
              ),
            ),
          },
          {
            limitOverride: chunk.length,
            ignoreViewFilterAndSort: true,
          },
        );

        for (const displayValue of displayValues) {
          const pk = this.extractPksValues(displayValue, true);

          displayValueMap.set(pk, displayValue[displayValueColumn.title]);
        }
      }
    }

    if (missingRefDisplayValues.length > 0) {
      for (let i = 0; i < missingRefDisplayValues.length; i += 100) {
        const chunk = missingRefDisplayValues.slice(i, i + 100);

        const refDisplayValues = await refBaseModel.list(
          {
            pks: chunk.map((auditObj) => auditObj.refRowId).join(','),
            fieldsSet: new Set(
              [refModel.primaryKey?.title, refDisplayValueColumn?.title].filter(
                Boolean,
              ),
            ),
          },
          {
            limitOverride: chunk.length,
            ignoreViewFilterAndSort: true,
          },
        );

        for (const refDisplayValue of refDisplayValues) {
          const pk = refBaseModel.extractPksValues(refDisplayValue, true);

          refDisplayValueMap.set(
            pk,
            refDisplayValue[refDisplayValueColumn.title],
          );
        }
      }
    }

    const auditPayloads = await Promise.all(
      auditObjs.map(async (auditObj) => {
        if (!auditObj.refDisplayValue) {
          auditObj.refDisplayValue = refDisplayValueMap.get(
            `${auditObj.refRowId}`,
          );
        }
        if (!auditObj.displayValue) {
          auditObj.displayValue = displayValueMap.get(`${auditObj.rowId}`);
        }
        // Build and return the audit payload.
        return generateAuditV1Payload<DataLinkPayload>(opType, {
          context: {
            ...context,
            source_id: model.source_id,
            fk_model_id: model.id,
            row_id: this.extractPksValues(auditObj.rowId, true) as string,
          },
          details: {
            table_title: model.title,
            ref_table_title: refModel.title,
            link_field_title: columnTitle,
            link_field_id: columnId,
            row_id: auditObj.rowId,
            ref_row_id: auditObj.refRowId,
            display_value: auditObj.displayValue,
            ref_display_value: auditObj.refDisplayValue,
            type: auditObj.type,
          },
          req,
        });
      }),
    );

    await Audit.insert(auditPayloads);
  }

  async removeChild({
    colId,
    rowId,
    childId,
    cookie,
  }: {
    colId: string;
    rowId: string;
    childId: string;
    cookie?: any;
  }) {
    await this.checkPermission({
      entity: PermissionEntity.FIELD,
      entityId: colId,
      permission: PermissionKey.RECORD_FIELD_EDIT,
      user: cookie?.user,
      req: cookie,
    });

    await this.model.getColumns(this.context);
    const column = this.model.columnsById[colId];
    if (
      !column ||
      ![UITypes.LinkToAnotherRecord, UITypes.Links].includes(column.uidt)
    )
      NcError.get(this.context).fieldNotFound(colId);

    const relationManager = await RelationManager.getRelationManager(
      this,
      colId,
      { rowId, childId },
    );
    await relationManager.removeChild({
      req: cookie,
    });

    await this.writeLinkAudits(
      await relationManager.getAuditUpdateObj(cookie),
      'removeChild',
    );
  }

  public async afterRemoveChild({
    columnTitle,
    columnId,
    rowId,
    refRowId,
    req,
    model = this.model,
    refModel = this.model,
    displayValue,
    refDisplayValue,
    type,
  }: {
    columnTitle: string;
    columnId: string;
    refColumnTitle: string;
    rowId: unknown;
    refRowId: unknown;
    req: NcRequest;
    model: Model;
    refModel: Model;
    displayValue: unknown;
    refDisplayValue: unknown;
    type: RelationTypes;
  }): Promise<void> {
    // disable external source audit in cloud
    if (!(await this.isDataAuditEnabled())) {
      return;
    }
    if (!refDisplayValue) {
      refDisplayValue = await this.readByPkFromModel(
        refModel,
        undefined,
        true,
        refRowId,
        false,
        {},
        { ignoreView: true, getHiddenColumn: true, extractOnlyPrimaries: true },
      );
    }

    if (!displayValue) {
      displayValue = await this.readByPkFromModel(
        model,
        undefined,
        true,
        rowId,
        false,
        {},
        { ignoreView: true, getHiddenColumn: true, extractOnlyPrimaries: true },
      );
    }

    await Audit.insert(
      await generateAuditV1Payload<DataUnlinkPayload>(
        AuditV1OperationTypes.DATA_UNLINK,
        {
          context: {
            ...this.context,
            source_id: model.source_id,
            fk_model_id: model.id,
            row_id: this.extractPksValues(rowId, true) as string,
          },
          details: {
            table_title: model.title,
            ref_table_title: refModel.title,
            link_field_title: columnTitle,
            link_field_id: columnId,
            row_id: rowId,
            ref_row_id: refRowId,
            display_value: displayValue,
            ref_display_value: refDisplayValue,
            type,
          },
          req,
        },
      ),
    );
  }

  /**
   * Extract distinct group column values for grouping operations
   * Handles options parameter, SingleSelect columns, and other column types
   */
  public async extractGroupingValues(
    column: Column,
    options?: (string | number | null | boolean)[],
  ): Promise<Set<any>> {
    // TODO: Add virtual column support
    if (isVirtualCol(column)) {
      NcError.get(this.context).notImplemented('Grouping for virtual columns');
    }

    let groupingValues: Set<any>;

    if (options?.length) {
      groupingValues = new Set(options);
    } else if (column.uidt === UITypes.SingleSelect) {
      const colOptions = await column.getColOptions<{
        options: SelectOption[];
      }>(this.context);
      groupingValues = new Set(
        (colOptions?.options ?? []).map((opt) => opt.title),
      );
      groupingValues.add(null);
    } else {
      const qb = this.dbDriver(this.tnPath)
        .select(column.column_name)
        .distinct();

      const softDeleteFilter = await this.getSoftDeleteFilter();
      if (softDeleteFilter) {
        qb.where(softDeleteFilter);
      }

      groupingValues = new Set(
        (await this.execAndParse(qb, null, { raw: true })).map(
          (row) => row[column.column_name],
        ),
      );
      groupingValues.add(null);
    }

    return groupingValues;
  }

  public async groupedList(
    args: {
      groupColumnId: string;
      ignoreViewFilterAndSort?: boolean;
      options?: (string | number | null | boolean)[];
    } & Partial<XcFilter>,
  ): Promise<
    {
      key: string;
      value: Record<string, unknown>[];
    }[]
  > {
    try {
      const { where, ...rest } = this._getListArgs(args);
      const columns = await this.model.getColumns(this.context);
      const column = columns?.find((col) => col.id === args.groupColumnId);

      if (!column) NcError.get(this.context).fieldNotFound(args.groupColumnId);
      if (isVirtualCol(column))
        NcError.get(this.context).notImplemented(
          'Grouping for virtual columns',
        );

      // extract distinct group column values
      const groupingValues = await this.extractGroupingValues(
        column,
        args.options,
      );

      const qb = this.dbDriver(this.tnPath);
      qb.limit(+rest?.limit || 25);
      qb.offset(+rest?.offset || 0);

      await this.selectObject({ qb, extractPkAndPv: true });

      // todo: refactor and move to a method (applyFilterAndSort)
      const aliasColObjMap = await this.model.getAliasColObjMap(
        this.context,
        columns,
      );
      let sorts = extractSortsObject(this.context, args?.sort, aliasColObjMap);
      const { filters: filterObj } = extractFilterFromXwhere(
        this.context,
        where,
        aliasColObjMap,
      );
      // Resolve RLS conditions for groupedList
      const rlsConditionsGL = await this.getRlsConditions();
      const rlsFilterGroupGL = rlsConditionsGL.length
        ? [new Filter({ children: rlsConditionsGL, is_group: true })]
        : [];

      // todo: replace with view id
      if (!args.ignoreViewFilterAndSort && this.viewId) {
        await conditionV2(
          this,
          [
            ...rlsFilterGroupGL,
            new Filter({
              children:
                (await Filter.rootFilterList(this.context, {
                  viewId: this.viewId,
                })) || [],
              is_group: true,
            }),
            new Filter({
              children: args.filterArr || [],
              is_group: true,
              logical_op: 'and',
            }),
            new Filter({
              children: filterObj,
              is_group: true,
              logical_op: 'and',
            }),
          ],
          qb,
        );

        if (!sorts)
          sorts = args.sortArr?.length
            ? args.sortArr
            : await Sort.list(this.context, { viewId: this.viewId });

        if (sorts?.['length']) await sortV2(this, sorts, qb);
      } else {
        await conditionV2(
          this,
          [
            ...rlsFilterGroupGL,
            new Filter({
              children: args.filterArr || [],
              is_group: true,
              logical_op: 'and',
            }),
            new Filter({
              children: filterObj,
              is_group: true,
              logical_op: 'and',
            }),
          ],
          qb,
        );

        if (!sorts) sorts = args.sortArr;

        if (sorts?.['length']) await sortV2(this, sorts, qb);
      }

      // Exclude soft-deleted records
      const softDeleteFilterGL = await this.getSoftDeleteFilter();
      if (softDeleteFilterGL) {
        qb.where(softDeleteFilterGL);
      }

      // sort by primary key if not autogenerated string
      // if autogenerated string sort by created_at column if present
      const orderColumn = columns.find((c) => isOrderCol(c));

      if (orderColumn) {
        qb.orderBy(orderColumn.column_name);
      } else if (this.model.primaryKey && this.model.primaryKey.ai) {
        qb.orderBy(this.model.primaryKey.column_name);
      } else if (
        this.model.columns.find((c) => c.column_name === 'created_at')
      ) {
        qb.orderBy('created_at');
      }

      const groupedQb = this.dbDriver.from(
        this.dbDriver
          .unionAll(
            [...groupingValues].map((r) => {
              const query = qb.clone();
              if (r === null) {
                query.where((qb) => {
                  qb.whereNull(column.column_name);
                  // Native PG enum columns can't be compared to ''
                  // (PG raises "invalid input value for enum"), and there's
                  // no way for an enum-typed cell to hold an empty string
                  // anyway. Only apply the '' fallback for text-backed
                  // SingleSelect columns.
                  if (
                    column.uidt === UITypes.SingleSelect &&
                    !column.internal_meta?.pg_enum_type_name
                  ) {
                    qb.orWhere(column.column_name, '=', '');
                  }
                });
              } else {
                query.where(column.column_name, r);
              }

              return this.isSqlite ? this.dbDriver.select().from(query) : query;
            }),
            !this.isSqlite,
          )
          .as('__nc_grouped_list'),
      );

      const proto = await this.getProto();

      const data: any[] = await this.execAndParse(groupedQb);
      const result = data?.map((d) => {
        d.__proto__ = proto;
        return d;
      });

      const groupedResult = result.reduce<Map<string | number | null, any[]>>(
        (aggObj, row) => {
          const rawVal = row[column.title];
          // Treat empty strings as null
          const val =
            typeof rawVal === 'string' && rawVal === '' ? null : rawVal;

          if (!aggObj.has(val)) {
            aggObj.set(val, []);
          }

          aggObj.get(val).push(row);

          return aggObj;
        },
        new Map(),
      );

      return [...groupingValues].map((key) => ({
        key,
        value: groupedResult.get(key) ?? [],
      }));
    } catch (e) {
      throw e;
    }
  }

  public async groupedListCount(
    args: {
      groupColumnId: string;
      ignoreViewFilterAndSort?: boolean;
    } & XcFilter,
  ) {
    const columns = await this.model.getColumns(this.context);
    const column = columns?.find((col) => col.id === args.groupColumnId);

    if (!column) NcError.get(this.context).fieldNotFound(args.groupColumnId);
    if (isVirtualCol(column))
      NcError.get(this.context).notImplemented('Grouping for virtual columns');

    const qb = this.dbDriver(this.tnPath).count('*', { as: 'count' });

    if (
      column.uidt === UITypes.SingleSelect &&
      !column.internal_meta?.pg_enum_type_name
    ) {
      // NULLIF(col, '') casts '' to col's type; native PG enums reject ''
      // with "invalid input value for enum". Native enum cells can't hold
      // '' anyway, so skip the normalization for them.
      qb.groupBy(
        this.dbDriver.raw(`COALESCE(NULLIF(??, ''), NULL)`, [
          column.column_name,
        ]),
      );
    } else {
      qb.groupBy(column.column_name);
    }

    // todo: refactor and move to a common method (applyFilterAndSort)
    const aliasColObjMap = await this.model.getAliasColObjMap(
      this.context,
      columns,
    );
    const { filters: filterObj } = extractFilterFromXwhere(
      this.context,
      args.where,
      aliasColObjMap,
    );
    // Resolve RLS conditions for groupedListCount
    const rlsConditionsGLC = await this.getRlsConditions();
    const rlsFilterGroupGLC = rlsConditionsGLC.length
      ? [new Filter({ children: rlsConditionsGLC, is_group: true })]
      : [];

    // todo: replace with view id

    if (!args.ignoreViewFilterAndSort && this.viewId) {
      await conditionV2(
        this,
        [
          ...rlsFilterGroupGLC,
          new Filter({
            children:
              (await Filter.rootFilterList(this.context, {
                viewId: this.viewId,
              })) || [],
            is_group: true,
          }),
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and',
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
        ],
        qb,
      );
    } else {
      await conditionV2(
        this,
        [
          ...rlsFilterGroupGLC,
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and',
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
        ],
        qb,
      );
    }

    // Exclude soft-deleted records
    const softDeleteFilterGLC = await this.getSoftDeleteFilter();
    if (softDeleteFilterGLC) {
      qb.where(softDeleteFilterGLC);
    }

    await this.selectObject({
      qb,
      columns: [
        new Column({
          ...column,
          title: 'key',
          id: 'key',
        }),
      ],
    });

    return await this.execAndParse(qb);
  }

  public async execAndGetRows(
    query: string,
    trx?: Knex | CustomKnex,
  ): Promise<Record<string, any>[]> {
    trx = trx || this.dbDriver;

    query = this.sanitizeQuery(query);

    if (this.isPg || this.isSnowflake) {
      return (await trx.raw(query))?.rows;
    } else if (SELECT_REGEX.test(query)) {
      return await trx.from(trx.raw(query).wrap('(', ') __nc_alias'));
    } else if (this.isMySQL && INSERT_REGEX.test(query)) {
      const res = await trx.raw(query);
      if (res?.[0] && res[0].insertId !== undefined) {
        return [{ insertId: res[0].insertId }];
      }
      return res;
    } else {
      return await trx.raw(query);
    }
  }

  public async execAndParse(
    qb: Knex.QueryBuilder | string,
    dependencyColumns: Column[] | undefined | null,
    options: ExecAndParseOptions & { first: true },
  ): Promise<Record<string, any>>;
  public async execAndParse(
    qb: Knex.QueryBuilder | string,
    dependencyColumns?: Column[] | null,
    options?: ExecAndParseOptions,
  ): Promise<Record<string, any>[]>;
  public async execAndParse(
    qb: Knex.QueryBuilder | string,
    dependencyColumns?: Column[],
    options: ExecAndParseOptions = {
      skipDateConversion: false,
      skipAttachmentConversion: false,
      skipSubstitutingColumnIds: false,
      skipUserConversion: false,
      skipJsonConversion: false,
      raw: false,
      first: false,
      bulkAggregate: false,
      apiVersion: NcApiVersion.V2,
    },
  ) {
    if (options.raw || options.bulkAggregate) {
      options.skipDateConversion = true;
      options.skipAttachmentConversion = true;
      options.skipSubstitutingColumnIds = true;
      options.skipUserConversion = true;
      options.skipJsonConversion = true;
    }

    if (typeof qb !== 'string') {
      this.knex.applyCte(qb);
    }

    if (options.first && typeof qb !== 'string') {
      qb = qb.limit(1);
    }

    const query = typeof qb === 'string' ? qb : qb.toQuery();

    let data = await this.execAndGetRows(query);

    if (!this.model?.columns) {
      await this.model.getColumns(this.context);
    }

    // we need to post process lookup fields based on the looked up column instead of the lookup column
    const aliasColumns = {};

    if (!dependencyColumns) {
      const nestedColumns = this.model?.columns.filter(
        (col) => col.uidt === UITypes.Lookup,
      );

      for (const col of nestedColumns) {
        const nestedColumn = await this.getNestedColumn(col);
        if (
          nestedColumn &&
          [RelationTypes.BELONGS_TO, RelationTypes.ONE_TO_ONE].includes(
            nestedColumn.colOptions?.type,
          )
        ) {
          aliasColumns[col.id] = nestedColumn;
        }
      }
    }

    // update attachment fields
    if (!options.skipAttachmentConversion) {
      data = await this.convertAttachmentType(data, dependencyColumns);
    }

    // update date time fields
    if (!options.skipDateConversion) {
      data = this.convertDateFormat(data, dependencyColumns);
    }

    // update user fields
    if (!options.skipUserConversion) {
      data = await this.convertUserFormat(
        data,
        dependencyColumns,
        options?.apiVersion,
        { skipPublicRedaction: options?.skipPublicRedaction },
      );
    }

    if (!options.skipJsonConversion) {
      data = await this.convertJsonTypes(data, dependencyColumns);
    }

    if (options.bulkAggregate) {
      data = data.map(async (d) => {
        for (const key in d) {
          let data = d[key];

          if (typeof data === 'string' && data.startsWith('{')) {
            try {
              data = JSON.parse(data);
            } catch (e) {
              // do nothing
            }
          }

          d[key] =
            (
              await this.substituteColumnIdsWithColumnTitles(
                [data],
                dependencyColumns,
                aliasColumns,
              )
            )[0] ?? {};
        }
        return d;
      });
    }

    if (options.apiVersion === NcApiVersion.V3) {
      data = await this.convertMultiSelectTypes(data, dependencyColumns);
      await FieldHandler.fromBaseModel(this).parseDataDbValue({
        data,
        options: {
          additionalColumns: dependencyColumns,
        },
      });
    }

    if (!options.skipSubstitutingColumnIds) {
      data = await this.substituteColumnIdsWithColumnTitles(
        data,
        dependencyColumns,
        aliasColumns,
      );
    }

    if (options.first) {
      return data?.[0];
    }

    return data;
  }

  sanitizeQuery(query: string): string;
  sanitizeQuery(query: string[]): string[];
  sanitizeQuery(query: string | string[]): string | string[];
  sanitizeQuery(query: string | string[]): string | string[] {
    const fn = (q: string) => {
      if (!this.isPg && !this.isSnowflake) {
        return unsanitize(q);
      } else {
        return sanitize(q);
      }
    };
    return Array.isArray(query) ? query.map(fn) : fn(query);
  }

  async runOps(ops: Promise<string>[], trx = this.dbDriver) {
    const queries = (await Promise.all(ops)).filter((query) =>
      ncIsStringHasValue(query),
    );
    for (const query of queries) {
      await trx.raw(query);
    }
  }

  protected async substituteColumnIdsWithColumnTitles(
    data: Record<string, any>[],
    dependencyColumns?: Column[],
    aliasColumns?: Record<string, Column>,
  ) {
    const modelColumns = this.model?.columns.concat(dependencyColumns ?? []);

    if (!modelColumns || !data.length) {
      return data;
    }

    const idToAliasMap: Record<string, string> = {};
    const ltarMap: Record<string, boolean> = {};
    const missingColumnIds = new Set<string>();

    // Build initial maps and collect missing column IDs
    for (const col of modelColumns) {
      if (aliasColumns && col.id in aliasColumns) {
        aliasColumns[col.id] = col;
      }

      idToAliasMap[col.id] = col.title;

      // For Links columns, only treat as LTAR when linksAsLtar produced
      // nested object data (not a count number). Check the actual data to decide.
      let isLinksAsLtar = false;
      if (col.uidt === UITypes.Links) {
        const sampleRow = data.find((d) => d[col.id] != null);
        const sampleVal = sampleRow?.[col.id];
        isLinksAsLtar =
          Array.isArray(sampleVal) ||
          (sampleVal && typeof sampleVal === 'object');
      }

      const isLtarColumn =
        [UITypes.LinkToAnotherRecord, UITypes.Lookup].includes(col.uidt) ||
        isLinksAsLtar;
      if (isLtarColumn) {
        if (col.uidt === UITypes.Lookup) {
          const nestedCol = await this.getNestedColumn(col);
          if (nestedCol?.uidt !== UITypes.LinkToAnotherRecord) {
            ltarMap[col.id] = false;
            continue;
          }
        } else if (
          (col.colOptions as LinkToAnotherRecordColumn)?.fk_related_base_id !==
          this.model.base_id
        ) {
          const { refContext } = (
            col.colOptions as LinkToAnotherRecordColumn
          ).getRelContext(this.context);
          const columns = await Column.list(refContext, {
            fk_model_id: (col.colOptions as LinkToAnotherRecordColumn)
              .fk_related_model_id,
          });
          for (const col of columns) idToAliasMap[col.id] = col.title;
        }

        ltarMap[col.id] = true;

        // Find any data that contains this column and collect missing column IDs
        const linkData = data.find(
          (d) =>
            d[col.id] &&
            ((!Array.isArray(d[col.id]) && Object.keys(d[col.id]).length > 0) ||
              (Array.isArray(d[col.id]) && d[col.id].length > 0)),
        );

        if (linkData && typeof linkData[col.id] === 'object') {
          const sampleData = Array.isArray(linkData[col.id])
            ? linkData[col.id][0] || {}
            : linkData[col.id];

          Object.keys(sampleData).forEach((k) => {
            if (!idToAliasMap[k]) {
              missingColumnIds.add(k);
            }
          });
        }
      } else {
        ltarMap[col.id] = false;
      }
    }

    // Fetch all missing column aliases concurrently
    if (missingColumnIds.size > 0) {
      const columnPromises = Array.from(missingColumnIds).map(async (k) => {
        try {
          const col = await Column.get(this.context, { colId: k });
          return { id: k, title: col?.title };
        } catch (e) {
          // ignore error to avoid breaking the entire response
          return {};
        }
      });

      const columnResults = await Promise.all(columnPromises);

      // Update the alias map with fetched columns
      columnResults.forEach(({ id, title }) => {
        if (title) {
          idToAliasMap[id] = title;
        }
      });
    }

    // Transform data in a single pass
    return data.map((item) => {
      const transformedItem = {};

      Object.entries(item).forEach(([key, value]) => {
        const alias = idToAliasMap[key];
        const targetKey = alias || key;

        if (alias && ltarMap[key]) {
          // Handle LTAR/Lookup columns
          if (
            Array.isArray(value) &&
            value.length > 0 &&
            value[0] &&
            typeof value[0] === 'object' &&
            !Array.isArray(value[0])
          ) {
            // Transform array of objects
            transformedItem[targetKey] = value.map((arrVal) => {
              if (!arrVal || typeof arrVal !== 'object') return arrVal;
              return transformObjectKeys(arrVal, idToAliasMap);
            });
          } else if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value)
          ) {
            // Transform non-array objects
            transformedItem[targetKey] = transformObjectKeys(
              value,
              idToAliasMap,
            );
          } else {
            // Directly assign arrays of primitives or primitive values
            transformedItem[targetKey] = value;
          }
        } else {
          // Non-LTAR/Lookup columns or unmapped columns: direct assignment
          transformedItem[targetKey] = value;
        }
      });

      return transformedItem;
    });
  }

  protected async convertUserFormat(
    data: Record<string, any>[],
    dependencyColumns?: Column[],
    apiVersion?: NcApiVersion,
    options?: { skipPublicRedaction?: boolean },
  ): Promise<Record<string, any>[]>;
  protected async convertUserFormat(
    data: Record<string, any>,
    dependencyColumns?: Column[],
    apiVersion?: NcApiVersion,
    options?: { skipPublicRedaction?: boolean },
  ): Promise<Record<string, any>>;
  protected async convertUserFormat(
    data: Record<string, any>,
    dependencyColumns?: Column[],
    apiVersion?: NcApiVersion,
    options?: { skipPublicRedaction?: boolean },
  ) {
    // user is stored as id within the database
    // convertUserFormat is used to convert the response in id to user object in API response
    if (!data) {
      return data;
    }

    const columns = this.model?.columns.concat(dependencyColumns ?? []);

    // Separate columns by type for more efficient processing
    const directUserColumns = [];
    const lookupColumns = [];

    for (const col of columns) {
      if (col.uidt === UITypes.Lookup) {
        lookupColumns.push(col);
      } else if (
        [UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(
          col.uidt,
        )
      ) {
        directUserColumns.push(col);
      }
    }

    // Process lookup columns in parallel to find user columns
    const lookupUserColumns =
      lookupColumns.length > 0
        ? await Promise.all(
            lookupColumns.map(async (col) => {
              try {
                const nestedCol = await this.getNestedColumn(col);
                return [
                  UITypes.User,
                  UITypes.CreatedBy,
                  UITypes.LastModifiedBy,
                ].includes(nestedCol?.uidt as UITypes)
                  ? col
                  : null;
              } catch {
                return null;
              }
            }),
          ).then((results) => results.filter(Boolean))
        : [];

    const allUserColumns = [...directUserColumns, ...lookupUserColumns];

    if (!allUserColumns.length) {
      return data;
    }

    // Fetch users and sign meta icons in parallel
    const baseUsers = await BaseUser.getUsersList(this.context, {
      base_id: this.model.base_id,
      include_internal_user: true,
    });

    await PresignedUrl.signMetaIconImage(baseUsers);

    let converted: Record<string, any> | Record<string, any>[];
    if (Array.isArray(data)) {
      const userMap = new Map(baseUsers.map((user) => [user.id, user]));
      converted = await Promise.all(
        data.map((d) =>
          this._convertUserFormat(
            allUserColumns,
            baseUsers,
            d,
            apiVersion,
            userMap,
          ),
        ),
      );
    } else {
      converted = this._convertUserFormat(
        allUserColumns,
        baseUsers,
        data,
        apiVersion,
      );
    }

    // Apply public-viewer redaction at the conversion boundary unless the
    // caller opted out (e.g. the read feeds a webhook hook that needs full
    // emails — the caller will redact again after firing the hook).
    if (!options?.skipPublicRedaction) {
      await this._applyPublicEmailRedaction(converted, allUserColumns);
    }

    return converted;
  }

  protected _convertUserFormat(
    userColumns: Column[],
    baseUsers: Partial<User>[],
    d: Record<string, any>,
    apiVersion?: NcApiVersion,
    userMapInit?: Map<string, Partial<User> & BaseUser>,
  ) {
    try {
      if (d && baseUsers.length) {
        const userMap =
          userMapInit || new Map(baseUsers.map((user) => [user.id, user]));

        const availableUserColumns = userColumns.filter(
          (col) => d[col.id] && d[col.id].length,
        );

        for (const col of availableUserColumns) {
          // Handle JSON array strings from lookup aggregation (json_agg)
          // e.g. '["userId1", "userId2"]' from HM/MM lookup on User fields
          let userIds: string[];
          if (typeof d[col.id] === 'string' && d[col.id].startsWith('[')) {
            try {
              const parsed = JSON.parse(d[col.id]);
              userIds = Array.isArray(parsed)
                ? parsed.map((v) => (typeof v === 'string' ? v : String(v)))
                : d[col.id].split(',');
            } catch {
              userIds = d[col.id].split(',');
            }
          } else {
            userIds = d[col.id].split(',');
          }
          d[col.id] = userIds;

          d[col.id] = d[col.id].map((fid) => {
            const user = userMap.get(fid);
            if (!user) {
              return { id: fid, email: null, display_name: null, meta: null };
            }

            const { id, email, display_name, meta } = user;

            let metaObj: any;
            if (apiVersion !== NcApiVersion.V3) {
              metaObj = ncIsObject(meta)
                ? extractProps(meta, ['icon', 'iconType'])
                : null;
            }

            return {
              id,
              email,
              display_name: display_name?.length ? display_name : null,
              meta: metaObj,
            };
          });

          // CreatedBy and LastModifiedBy are always singular
          if ([UITypes.CreatedBy, UITypes.LastModifiedBy].includes(col.uidt)) {
            d[col.id] = d[col.id][0];
          }
        }
      }
    } catch {}
    return d;
  }

  // Public viewers must not see real emails on User / CreatedBy / LastModifiedBy
  // / Lookup-of-User values. We redact at the API response boundary instead of
  // inside `_convertUserFormat` so write hooks (webhooks, audit) see full data —
  // those destinations are server-side and configured by the workspace owner.
  // Mutates `data` in-place. Walks by column metadata (no shape heuristics) and
  // accepts data keyed by `col.id` (mid-pipeline) or `col.title` (post-alias).
  protected async _applyPublicEmailRedaction<T>(
    data: T,
    userColumns: Column[],
  ): Promise<T> {
    if (!this.context?.is_public || !data || !userColumns?.length) return data;

    const redactUser = (u: any) => {
      if (!u || typeof u !== 'object' || Array.isArray(u)) return;
      if (u.email) {
        u.display_name = extractDisplayNameFromEmail(u.email, u.display_name);
      }
      u.email = '';
    };

    const redactColumnValue = (value: any) => {
      if (value == null) return;
      if (Array.isArray(value)) {
        for (const item of value) {
          if (Array.isArray(item)) {
            for (const inner of item) redactUser(inner);
          } else {
            redactUser(item);
          }
        }
        return;
      }
      redactUser(value);
    };

    const redactRow = (row: any) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return;
      for (const col of userColumns) {
        if (col.id && row[col.id] !== undefined) {
          redactColumnValue(row[col.id]);
        } else if (col.title && row[col.title] !== undefined) {
          redactColumnValue(row[col.title]);
        }
      }
    };

    if (Array.isArray(data)) {
      for (const row of data) redactRow(row);
    } else {
      redactRow(data);
    }

    return data;
  }

  // Resolve the User / CreatedBy / LastModifiedBy / Lookup-of-User columns
  // we care about for `_applyPublicEmailRedaction`. Exposed as a helper so
  // afterInsert/afterUpdate can resolve once and reuse.
  protected async _getUserBearingColumns(): Promise<Column[]> {
    const columns = await this.model.getColumns(this.context);
    const directUserColumns: Column[] = [];
    const lookupColumns: Column[] = [];

    for (const col of columns) {
      if (col.uidt === UITypes.Lookup) {
        lookupColumns.push(col);
      } else if (
        [UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(
          col.uidt,
        )
      ) {
        directUserColumns.push(col);
      }
    }

    const lookupUserColumns = lookupColumns.length
      ? (
          await Promise.all(
            lookupColumns.map(async (col) => {
              try {
                const nestedCol = await this.getNestedColumn(col);
                return [
                  UITypes.User,
                  UITypes.CreatedBy,
                  UITypes.LastModifiedBy,
                ].includes(nestedCol?.uidt as UITypes)
                  ? col
                  : null;
              } catch {
                return null;
              }
            }),
          )
        ).filter(Boolean)
      : [];

    return [...directUserColumns, ...lookupUserColumns];
  }

  protected async _convertAttachmentType(
    attachmentColumns: Record<string, any>[],
    d: Record<string, any>,
  ) {
    try {
      if (!d || !attachmentColumns.length) {
        return d;
      }

      const allAttachments = [];
      const allThumbnails = [];

      // First pass: parse JSON and collect all attachment instances (no deduplication)
      for (const col of attachmentColumns) {
        if (!d[col.id]) continue;

        // Parse JSON if needed
        if (typeof d[col.id] === 'string') {
          try {
            d[col.id] = JSON.parse(d[col.id]);
          } catch {
            continue;
          }
        }

        if (!Array.isArray(d[col.id]) || !d[col.id].length) continue;

        // Process each attachment instance individually
        for (let i = 0; i < d[col.id].length; i++) {
          const item = d[col.id][i];

          if (typeof item === 'string') {
            try {
              d[col.id][i] = JSON.parse(item);
            } catch {
              continue;
            }
          }

          const attachment = d[col.id][i];

          // Handle array of arrays (lookup case)
          for (const lookedUpAttachment of Array.isArray(attachment)
            ? attachment
            : [attachment]) {
            const thumbnails =
              this.prepareAttachmentForSigning(lookedUpAttachment);
            if (
              lookedUpAttachment &&
              (lookedUpAttachment.path || lookedUpAttachment.url)
            ) {
              allAttachments.push(lookedUpAttachment);
              allThumbnails.push(...thumbnails);
            }
          }
        }
      }

      await processConcurrently(
        allAttachments,
        async (item) => {
          try {
            await PresignedUrl.signAttachment({
              attachment: item,
              filename: item.title,
            });
          } catch (e) {}
        },
        15,
      );

      await processConcurrently(
        allThumbnails,
        async ({ attachment, thumbnailKey, thumbnailPath }) => {
          try {
            await PresignedUrl.signAttachment({
              attachment: {
                ...attachment,
                ...(attachment.path
                  ? { path: thumbnailPath }
                  : { url: thumbnailPath }),
              },
              filename: attachment.title,
              mimetype: 'image/jpeg',
              nestedKeys: ['thumbnails', thumbnailKey],
            });
          } catch (e) {}
        },
        15,
      );
    } catch (error) {
      // Log error but don't throw to avoid breaking the entire response
      console.warn('Error in _convertAttachmentType:', error.message);
    }

    return d;
  }

  private prepareAttachmentForSigning(attachment: any) {
    const thumbnails = [];

    if (!attachment || (!attachment.path && !attachment.url)) {
      return thumbnails;
    }

    // Skip data URLs
    if (attachment.url?.startsWith('data:')) {
      return thumbnails;
    }

    if ('status' in attachment && attachment.status === 'uploading') {
      return thumbnails;
    }

    // Process thumbnails for images
    if (supportsThumbnails(attachment)) {
      attachment.thumbnails = {
        tiny: {},
        small: {},
        card_cover: {},
      };

      const thumbnailKeys = Object.keys(attachment.thumbnails);

      for (const key of thumbnailKeys) {
        let thumbnailPath: string;

        if (attachment.path) {
          const cleanPath = attachment.path.replace(/^download[/\\]/i, '');
          thumbnailPath = `thumbnails/${cleanPath}/${key}.jpg`;
        } else if (attachment.url) {
          const thumbnailUrl = attachment.url.replace(
            'nc/uploads',
            'nc/thumbnails',
          );
          thumbnailPath = `${thumbnailUrl}/${key}.jpg`;
        }

        if (thumbnailPath) {
          thumbnails.push({
            attachment,
            thumbnailKey: key,
            thumbnailPath,
          });
        }
      }
    }

    return thumbnails;
  }

  protected async _convertJsonType(
    jsonColumns: Record<string, any>[],
    d: Record<string, any>,
  ) {
    if (d) {
      for (const col of jsonColumns) {
        if (d[col.id] && typeof d[col.id] === 'string') {
          try {
            d[col.id] = JSON.parse(d[col.id]);
          } catch {}
        }

        if (d[col.id]?.length) {
          for (let i = 0; i < d[col.id].length; i++) {
            if (typeof d[col.id][i] === 'string') {
              try {
                d[col.id][i] = JSON.parse(d[col.id][i]);
              } catch {}
            }
          }
        }
      }
    }
    return d;
  }

  // this function is used to convert the response in string to array in API response
  protected async _convertMultiSelectType(
    multiSelectColumns: Record<string, any>[],
    d: Record<string, any>,
  ) {
    try {
      if (d) {
        for (const col of multiSelectColumns) {
          if (d[col.id] && typeof d[col.id] === 'string') {
            d[col.id] = d[col.id].split(',');
          } else if (d[col.title] && typeof d[col.title] === 'string') {
            d[col.title] = d[col.title].split(',');
          }
        }
      }
    } catch {
      // ignore
    }
    return d;
  }

  public async getNestedColumn(column: Column, context = this.context) {
    if (!column)
      return {
        uidt: UITypes.SingleLineText,
      };

    if (column.uidt !== UITypes.Lookup) {
      return column;
    }
    const colOptions = await column.getColOptions<LookupColumn>(context);
    if (colOptions?.error) return { uidt: UITypes.SingleLineText };
    const relationCol = await colOptions.getRelationColumn(context);
    if (!relationCol) return { uidt: UITypes.SingleLineText };
    const relationColOpt = await (relationCol.colOptions ??
      relationCol.getColOptions<LinkToAnotherRecordColumn>(context));
    if (!relationColOpt) return { uidt: UITypes.SingleLineText };

    const { refContext } = relationColOpt.getRelContext(context);
    return this.getNestedColumn(
      await colOptions?.getLookupColumn(refContext),
      refContext,
    );
  }

  public async convertJsonTypes(
    data: Record<string, any>[],
    dependencyColumns?: Column[],
  ): Promise<Record<string, any>[]>;
  public async convertJsonTypes(
    data: Record<string, any>,
    dependencyColumns?: Column[],
  ): Promise<Record<string, any>>;
  public async convertJsonTypes(
    data: Record<string, any>,
    dependencyColumns?: Column[],
  ) {
    // buttons & AI result are stringified json in Sqlite and need to be parsed
    // converJsonTypes is used to convert the response in string to object in API response
    if (!data) {
      return data;
    }

    const columns = this.model?.columns.concat(dependencyColumns ?? []);

    // Separate JSON and lookup columns for efficient processing
    const directJsonColumns = [];
    const lookupColumns = [];

    for (const col of columns) {
      if (JSON_COLUMN_TYPES.includes(col.uidt) || isAIPromptCol(col)) {
        directJsonColumns.push(col);
      } else if (col.uidt === UITypes.Lookup) {
        lookupColumns.push(col);
      }
    }

    // Process lookup columns in parallel to find JSON columns
    const lookupJsonColumns =
      lookupColumns.length > 0
        ? await Promise.all(
            lookupColumns.map(async (col) => {
              try {
                const lookupNestedCol = await this.getNestedColumn(col);
                return JSON_COLUMN_TYPES.includes(lookupNestedCol.uidt) ||
                  isAIPromptCol(lookupNestedCol)
                  ? col
                  : null;
              } catch (error) {
                // Log error but continue processing
                console.warn(
                  `Error processing lookup column ${col.id}:`,
                  error,
                );
                return null;
              }
            }),
          ).then((results) => results.filter(Boolean))
        : [];

    const allJsonColumns = [...directJsonColumns, ...lookupJsonColumns];

    if (!allJsonColumns.length) {
      return data;
    }

    if (Array.isArray(data)) {
      return Promise.all(
        data.map((d) => this._convertJsonType(allJsonColumns, d)),
      );
    } else {
      return this._convertJsonType(allJsonColumns, data);
    }
  }

  public async convertMultiSelectTypes(
    data: Record<string, any>[],
    dependencyColumns?: Column[],
  ): Promise<Record<string, any>[]>;
  public async convertMultiSelectTypes(
    data: Record<string, any>,
    dependencyColumns?: Column[],
  ): Promise<Record<string, any>>;
  public async convertMultiSelectTypes(
    data: Record<string, any>,
    dependencyColumns?: Column[],
  ) {
    if (!data) {
      return data;
    }

    const columns = this.model?.columns.concat(dependencyColumns ?? []);
    const multiSelectColumns = columns.filter(
      (col) => col.uidt === UITypes.MultiSelect,
    );

    if (!multiSelectColumns.length) {
      return data;
    }

    if (Array.isArray(data)) {
      return Promise.all(
        data.map((d) => this._convertMultiSelectType(multiSelectColumns, d)),
      );
    } else {
      return this._convertMultiSelectType(multiSelectColumns, data);
    }
  }

  public async convertAttachmentType(
    data: Record<string, any>[],
    dependencyColumns?: Column[],
  ): Promise<Record<string, any>[]>;
  public async convertAttachmentType(
    data: Record<string, any>,
    dependencyColumns?: Column[],
  ): Promise<Record<string, any>>;
  public async convertAttachmentType(
    data: Record<string, any>,
    dependencyColumns?: Column[],
  ) {
    // attachment is stored in text and parse in UI
    // convertAttachmentType is used to convert the response in string to array of object in API response
    if (!data) {
      return data;
    }

    const columns = this.model?.columns.concat(dependencyColumns ?? []);

    // Separate attachment and lookup columns for efficient processing
    const directAttachmentColumns = [];
    const lookupColumns = [];
    const formulaColumns = [];

    for (const col of columns) {
      if (col.uidt === UITypes.Attachment) {
        directAttachmentColumns.push(col);
      } else if (col.uidt === UITypes.Lookup) {
        lookupColumns.push(col);
      } else if (
        // focus on PG first
        this.clientType === ClientType.PG &&
        col.uidt === UITypes.Formula
      ) {
        const colOptions = await col.getColOptions<FormulaColumn>(this.context);
        const parsedTree: ParsedFormulaNode = colOptions.getParsedTree();
        if (parsedTree?.referencedColumn?.uidt === UITypes.Attachment) {
          formulaColumns.push(col);
        }
      }
    }

    // Process lookup columns in parallel to find attachment columns
    const lookupAttachmentColumns =
      lookupColumns.length > 0
        ? await Promise.all(
            lookupColumns.map(async (col) => {
              try {
                const nestedCol = await this.getNestedColumn(col);
                return nestedCol?.uidt === UITypes.Attachment ? col : null;
              } catch (error) {
                // Log error but continue processing
                console.warn(
                  `Error processing lookup column ${col.id}:`,
                  error,
                );
                return null;
              }
            }),
          ).then((results) => results.filter(Boolean))
        : [];

    const allAttachmentColumns = [
      ...directAttachmentColumns,
      ...lookupAttachmentColumns,
      ...formulaColumns,
    ];

    if (!allAttachmentColumns.length) {
      return data;
    }

    if (Array.isArray(data)) {
      return Promise.all(
        data.map((d) => this._convertAttachmentType(allAttachmentColumns, d)),
      );
    } else {
      return this._convertAttachmentType(allAttachmentColumns, data);
    }
  }

  // TODO(timezone): retrieve the format from the corresponding column meta
  protected _convertDateFormat(
    dateTimeColumns: Record<string, any>[],
    d: Record<string, any>,
  ) {
    if (!d) return d;

    // Cache timezone and regex patterns at the method level for better performance
    const cachedTimeZone = this.isSqlite
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : null;

    // Pre-compile regex patterns to avoid repeated compilation
    // the pre-compiled patterns have mutable `lastIndex` property that we use below, so it cannot be made global to avoid race condition
    const isoRegex = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g;
    const datetimeRegex =
      /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2})?/g;
    const noTimezoneRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

    for (const col of dateTimeColumns) {
      if (!d[col.id]) continue;
      if (col.uidt === UITypes.Formula) {
        if (!d[col.id] || typeof d[col.id] !== 'string') {
          continue;
        }

        // remove milliseconds
        if (this.isMySQL) {
          d[col.id] = d[col.id].replace(/\.000000/g, '');
        }

        // Reset regex lastIndex for reuse
        isoRegex.lastIndex = 0;
        if (isoRegex.test(d[col.id])) {
          // convert ISO string (e.g. in MSSQL) to YYYY-MM-DD hh:mm:ssZ
          // e.g. 2023-05-18T05:30:00.000Z -> 2023-05-18 11:00:00+05:30
          isoRegex.lastIndex = 0; // Reset for replace
          d[col.id] = d[col.id].replace(isoRegex, (dateStr: string) => {
            if (!dayjs(dateStr).isValid()) return dateStr;
            if (this.isSqlite) {
              // e.g. DATEADD formula
              return dayjs(dateStr).utc().format('YYYY-MM-DD HH:mm:ssZ');
            }
            return dayjs(dateStr).utc(true).format('YYYY-MM-DD HH:mm:ssZ');
          });
          continue;
        }

        // convert all date time values to utc
        // the datetime is either YYYY-MM-DD hh:mm:ss (xcdb)
        // or YYYY-MM-DD hh:mm:ss+/-xx:yy (ext)
        datetimeRegex.lastIndex = 0; // Reset for replace
        d[col.id] = d[col.id].replace(datetimeRegex, (dateStr: string) => {
          if (!dayjs(dateStr).isValid()) {
            return dateStr;
          }

          if (this.isSqlite) {
            // if there is no timezone info,
            // we assume the input is on NocoDB server timezone
            // then we convert to UTC from server timezone
            // example: datetime without timezone
            // we need to display 2023-04-27 10:00:00 (in HKT)
            // we convert d (e.g. 2023-04-27 18:00:00) to utc, i.e. 2023-04-27 02:00:00+00:00
            // if there is timezone info,
            // we simply convert it to UTC
            // example: datetime with timezone
            // e.g. 2023-04-27 10:00:00+05:30  -> 2023-04-27 04:30:00+00:00
            return dayjs(dateStr)
              .tz(cachedTimeZone)
              .utc()
              .format('YYYY-MM-DD HH:mm:ssZ');
          }

          // set keepLocalTime to true if timezone info is not found
          const keepLocalTime = noTimezoneRegex.test(dateStr);

          return dayjs(dateStr)
            .utc(keepLocalTime)
            .format('YYYY-MM-DD HH:mm:ssZ');
        });
        continue;
      }

      if (col.uidt === UITypes.Date) {
        d[col.id] = dayjs(d[col.id]).format('YYYY-MM-DD');
        continue;
      }

      let keepLocalTime = true;

      if (this.isSqlite) {
        if (!col.cdf) {
          if (
            d[col.id].indexOf('-') === -1 &&
            d[col.id].indexOf('+') === -1 &&
            d[col.id].slice(-1) !== 'Z'
          ) {
            // if there is no timezone info,
            // we assume the input is on NocoDB server timezone
            // then we convert to UTC from server timezone
            // e.g. 2023-04-27 10:00:00 (IST) -> 2023-04-27 04:30:00+00:00
            d[col.id] = dayjs(d[col.id])
              .tz(Intl.DateTimeFormat().resolvedOptions().timeZone)
              .utc()
              .format('YYYY-MM-DD HH:mm:ssZ');
            continue;
          } else {
            // otherwise, we convert from the given timezone to UTC
            keepLocalTime = false;
          }
        }
      }

      if (this.isPg) {
        // postgres - timezone already attached to input
        // e.g. 2023-05-11 16:16:51+08:00
        keepLocalTime = false;
      }

      if (d[col.id] instanceof Date) {
        // e.g. MSSQL
        // Wed May 10 2023 17:47:46 GMT+0800 (Hong Kong Standard Time)
        keepLocalTime = false;
      }
      // e.g. 01.01.2022 10:00:00+05:30 -> 2022-01-01 04:30:00+00:00
      // e.g. 2023-05-09 11:41:49 -> 2023-05-09 11:41:49+00:00
      d[col.id] = dayjs(d[col.id])
        // keep the local time
        .utc(keepLocalTime)
        // show the timezone even for Mysql
        .format('YYYY-MM-DD HH:mm:ssZ');
    }
    return d;
  }

  public convertDateFormat(
    data: Record<string, any>[],
    dependencyColumns?: Column[],
  ): Record<string, any>[];
  public convertDateFormat(
    data: Record<string, any>,
    dependencyColumns?: Column[],
  ): Record<string, any>;
  public convertDateFormat(
    data: Record<string, any>,
    dependencyColumns?: Column[],
  ) {
    // Show the date time in UTC format in API response
    // e.g. 2022-01-01 04:30:00+00:00
    if (data) {
      const columns = this.model?.columns.concat(dependencyColumns ?? []);
      const dateTimeColumns = columns.filter(
        (c) =>
          c.uidt === UITypes.DateTime ||
          c.uidt === UITypes.Date ||
          isCreatedOrLastModifiedTimeCol(c) ||
          c.uidt === UITypes.Formula,
      );
      if (dateTimeColumns.length) {
        if (Array.isArray(data)) {
          data = data.map((d) => this._convertDateFormat(dateTimeColumns, d));
        } else {
          data = this._convertDateFormat(dateTimeColumns, data);
        }
      }
    }
    return data;
  }

  async addLinks(params: {
    cookie: any;
    childIds: (string | number)[];
    colId: string;
    rowId: string;
  }) {
    await this.checkPermission({
      entity: PermissionEntity.FIELD,
      entityId: params.colId,
      permission: PermissionKey.RECORD_FIELD_EDIT,
      user: params.cookie?.user,
      req: params.cookie,
    });

    return addOrRemoveLinks(this).addLinks(params);
  }

  async removeLinks(params: {
    cookie: any;
    childIds: (string | number)[];
    colId: string;
    rowId: string;
  }) {
    await this.checkPermission({
      entity: PermissionEntity.FIELD,
      entityId: params.colId,
      permission: PermissionKey.RECORD_FIELD_EDIT,
      user: params.cookie?.user,
      req: params.cookie,
    });

    return addOrRemoveLinks(this).removeLinks(params);
  }

  async ooRead(
    { colId, id }: { colId; id; apiVersion?: NcApiVersion },
    _args: { limit?; offset?; fieldSet?: Set<string> } = {},
  ) {
    try {
      await this.model.getColumns(this.context);

      const relColumn = this.model.columnsById[colId];
      if (!relColumn) {
        NcError.get(this.context).fieldNotFound(colId);
      }
      const relColOptions = (await relColumn.getColOptions(
        this.context,
      )) as LinkToAnotherRecordColumn;
      const relatedContext = await relColOptions.getRelContext(this.context);
      const relatedBaseModel = await getBaseModelSqlFromModelId({
        modelId: relColOptions.fk_related_model_id,
        context: relatedContext.refContext,
      });
      const joinIds = [
        relColOptions.fk_child_column_id,
        relColOptions.fk_parent_column_id,
      ];
      const relatedColumn = (
        await relatedBaseModel.model.getColumns(relatedBaseModel.context)
      ).find((col) => joinIds.includes(col.id));

      const ooQb = relatedBaseModel
        .dbDriver(relatedBaseModel.getTnPath(relatedBaseModel.model.table_name))
        .where(relatedColumn.column_name, '=', id);

      // Exclude soft-deleted related records
      const ooSoftDeleteFilter = await relatedBaseModel.getSoftDeleteFilter();
      if (ooSoftDeleteFilter) {
        ooQb.where(ooSoftDeleteFilter);
      }

      const row = await relatedBaseModel.execAndParse(ooQb, null, {
        raw: true,
        first: true,
      });

      // validate rowId
      if (!row) {
        return {};
      }

      return relatedBaseModel.readByPk(
        relatedBaseModel.extractPksValues(row, true),
        row.id,
      );
    } catch (e) {
      throw e;
    }
  }

  async btRead(
    { colId, id }: { colId; id; apiVersion?: NcApiVersion },
    args: { limit?; offset?; fieldSet?: Set<string> } = {},
  ) {
    try {
      await this.model.getColumns(this.context);

      const { where, sort } = this._getListArgs(args);
      // todo: get only required fields

      const relColumn = this.model.columnsById[colId];

      const childQb = this.dbDriver(this.tnPath).where(await this._wherePk(id));

      const childSoftDeleteFilter = await this.getSoftDeleteFilter();
      if (childSoftDeleteFilter) {
        childQb.where(childSoftDeleteFilter);
      }

      const row = await this.execAndParse(childQb, null, {
        raw: true,
        first: true,
      });

      // validate rowId
      if (!row) {
        NcError.get(this.context).recordNotFound(id);
      }

      const colOptions = (await relColumn.getColOptions(
        this.context,
      )) as LinkToAnotherRecordColumn;

      const { childContext, parentContext } =
        await colOptions.getParentChildContext(this.context);

      const parentCol = await colOptions.getParentColumn(parentContext);
      const parentTable = await parentCol.getModel(parentContext);
      const chilCol = await colOptions.getChildColumn(childContext);
      const childTable = await chilCol.getModel(childContext);

      const parentModel = await Model.getBaseModelSQL(parentContext, {
        model: parentTable,
        dbDriver: this.dbDriver,
        queryQueue: this._queryQueue,
      });
      const childBaseModel = await Model.getBaseModelSQL(childContext, {
        model: childTable,
        dbDriver: this.dbDriver,
      });
      await childTable.getColumns(childContext);

      const childTn = childBaseModel.getTnPath(childTable);
      const parentTn = parentModel.getTnPath(parentTable);

      const qb = this.dbDriver(parentTn);
      await this.applySortAndFilter({ table: parentTable, where, qb, sort });

      qb.where(
        parentCol.column_name,
        this.dbDriver(childTn)
          .select(chilCol.column_name)
          .where(_wherePk(childTable.primaryKeys, id)),
      );

      // Exclude soft-deleted parent records
      const parentSoftDeleteFilter = await parentModel.getSoftDeleteFilter();
      if (parentSoftDeleteFilter) {
        qb.where(parentSoftDeleteFilter);
      }

      await parentModel.selectObject({ qb, fieldsSet: args.fieldSet });

      const parent = await this.execAndParse(
        qb,
        await parentTable.getColumns(parentContext),
        {
          first: true,
        },
      );

      const proto = await parentModel.getProto();

      if (parent) {
        parent.__proto__ = proto;
      }
      return parent;
    } catch (e) {
      throw e;
    }
  }

  async updateLastModified({
    rowIds,
    cookie,
    model = this.model,
    knex = this.dbDriver,
    baseModel = this,
    updatedColIds,
    timestamp,
  }: {
    rowIds: any | any[];
    cookie?: { user?: any };
    model?: Model;
    knex?: XKnex;
    baseModel?: BaseModelSqlv2;
    updatedColIds: string[];
    // Optional shared timestamp — callers that invoke this once per chunk of
    // a larger operation (e.g. bulkAll) pass in a single value so every
    // affected linked record gets the same LastModifiedTime.
    timestamp?: string;
  }) {
    const columns = await model.getColumns(this.context);

    const updateObject = {};

    const lastModifiedTimeColumn = columns.find(
      (c) => c.uidt === UITypes.LastModifiedTime && c.system,
    );

    const lastModifiedByColumn = columns.find(
      (c) => c.uidt === UITypes.LastModifiedBy && c.system,
    );

    const metaColumn = columns.find((c) => c.uidt === UITypes.Meta);

    const now = timestamp ?? this.now();

    if (lastModifiedTimeColumn) {
      updateObject[lastModifiedTimeColumn.column_name] = now;
    }

    if (lastModifiedByColumn) {
      updateObject[lastModifiedByColumn.column_name] = cookie?.user?.id;
    }

    if (metaColumn && updatedColIds.length > 0) {
      updateObject[metaColumn.column_name] = prepareMetaUpdateQuery({
        knex: this.dbDriver,
        colIds: updatedColIds,
        props: {
          modifiedBy: cookie?.user?.id,
          modifiedTime: now,
        },
        metaColumn,
      });
    }

    if (Object.keys(updateObject).length === 0) return;

    const qb = knex(baseModel.getTnPath(model.table_name)).update(updateObject);

    for (const rowId of Array.isArray(rowIds) ? rowIds : [rowIds]) {
      qb.orWhere(_wherePk(model.primaryKeys, rowId));
    }

    await this.execAndParse(qb, null, { raw: true });
  }

  findIntermediateOrder(before: BigNumber, after: BigNumber): BigNumber {
    if (after.lte(before)) {
      NcError.get(this.context).cannotCalculateIntermediateOrderError();
    }
    return before.plus(after.minus(before).div(2));
  }

  async getUniqueOrdersBeforeItem(before: unknown, amount = 1, depth = 0) {
    try {
      if (depth > MAX_RECURSION_DEPTH) {
        NcError.get(this.context).reorderFailed();
      }

      const orderColumn = this.model.columns.find((c) => isOrderCol(c));
      if (!orderColumn) {
        return;
      }

      if (!before) {
        const highestOrder = await this.getHighestOrderInTable();

        return Array.from({ length: amount }).map((_, i) => {
          return highestOrder.plus(i + 1);
        });
      }

      const row = await this.readByPk(
        before,
        false,
        {},
        { extractOrderColumn: true },
      );

      if (!row) {
        return await this.getUniqueOrdersBeforeItem(null, amount, depth);
      }

      const currentRowOrder = new BigNumber(row[orderColumn.title] ?? 0);

      const resultQuery = this.dbDriver(this.tnPath)
        .where(orderColumn.column_name, '<', currentRowOrder.toString())
        .max(orderColumn.column_name + ' as maxOrder')
        .first();

      const softDeleteFilter = await this.getSoftDeleteFilter();
      if (softDeleteFilter) {
        resultQuery.where(softDeleteFilter);
      }

      const result = await resultQuery;

      const adjacentOrder = new BigNumber(result.maxOrder || 0);

      const orders = [];

      for (let i = 0; i < amount; i++) {
        const intermediateOrder = this.findIntermediateOrder(
          adjacentOrder.plus(i),
          currentRowOrder,
        );

        if (
          intermediateOrder.eq(adjacentOrder) ||
          intermediateOrder.eq(currentRowOrder)
        ) {
          NcError.get(this.context).cannotCalculateIntermediateOrderError();
        }

        orders.push(intermediateOrder);
      }

      return orders;
    } catch (error) {
      if (error.error === NcErrorType.ERR_CANNOT_CALCULATE_INTERMEDIATE_ORDER) {
        console.error('Error in getUniqueOrdersBeforeItem:', error);
        await this.recalculateFullOrder();
        return await this.getUniqueOrdersBeforeItem(before, amount, depth + 1);
      }
      throw error;
    }
  }

  async recalculateFullOrder() {
    const primaryKeys = this.model.primaryKeys.map((pk) => pk.column_name);

    const sql = {
      mysql2: {
        modern: `UPDATE ?? SET ?? = ROW_NUMBER() OVER (ORDER BY ?? ASC)`, // 8.0+
        legacy: {
          // 5.x and below
          init: 'SET @row_number = 0;',
          update:
            'UPDATE ?? SET ?? = (@row_number:=@row_number+1) ORDER BY ?? ASC',
        },
      },
      pg: `UPDATE ?? t SET ?? = s.rn FROM (SELECT ??, ${primaryKeys
        .map((_pk) => `??`)
        .join(
          ', ',
        )}, ROW_NUMBER() OVER (ORDER BY ?? ASC) rn FROM ??) s WHERE ${this.model.primaryKeys
        .map((_pk) => `t.?? = s.??`)
        .join(' AND ')}`,
      sqlite3: `WITH rn AS (SELECT ${this.model.primaryKeys
        .map((_pk) => `??`)
        .join(
          ', ',
        )}, ROW_NUMBER() OVER (ORDER BY ?? ASC) rn FROM ??) UPDATE ?? SET ?? = (SELECT rn FROM rn WHERE ${this.model.primaryKeys
        .map((_pk) => `rn.?? = ??.??`)
        .join(' AND ')})`,
    };

    const orderColumn = this.model.columns.find((c) => isOrderCol(c));
    if (!orderColumn) {
      NcError.get(this.context).badRequest(
        'Order column not found to recalculateOrder',
      );
    }

    const client = this.dbDriver.client.config.client;
    if (!sql[client]) {
      NcError.get(this.context).notImplemented(
        'Recalculate order not implemented for this database',
      );
    }

    const params = {
      mysql2: [this.tnPath, orderColumn.column_name, orderColumn.column_name],
      pg: [
        this.tnPath,
        orderColumn.column_name,
        orderColumn.column_name,
        ...primaryKeys,
        orderColumn.column_name,
        this.tnPath,
        ...primaryKeys.flatMap((pk) => [pk, pk]), // Flatten pk array for binding
      ],
      sqlite3: [
        ...primaryKeys,
        orderColumn.column_name,
        this.tnPath,
        this.tnPath,
        orderColumn.column_name,
        ...primaryKeys.flatMap((pk) => [pk, this.tnPath, pk]), // Flatten pk array for binding
      ],
    };

    // For MySQL, check version and use appropriate query
    if (client === 'mysql2') {
      const version = await this.execAndGetRows('SELECT VERSION()');
      const isMySql8Plus = parseFloat(version[0]?.[0]?.['VERSION()']) >= 8.0;

      if (isMySql8Plus) {
        await this.execAndGetRows(
          this.dbDriver.raw(sql[client].modern, params[client]).toQuery(),
        );
      } else {
        await this.execAndGetRows(sql[client].legacy.init);
        await this.execAndGetRows(
          this.dbDriver
            .raw(sql[client].legacy.update, params[client])
            .toQuery(),
        );
      }
    } else {
      const query = this.dbDriver.raw(sql[client], params[client]).toQuery();
      await this.execAndGetRows(query);
    }
  }

  async prepareNocoData(
    data,
    isInsertData = false,
    cookie?: { user?: any; system?: boolean },
    // oldData uses title as key whereas data uses column_name as key
    oldData?,
    extra?: {
      raw?: boolean;
      ncOrder?: BigNumber;
      before?: string;
      undo?: boolean;
    },
  ): Promise<void> {
    const runAfterForLoop = [];
    const updatedColIds = [];

    // Handle autoincrement primary key columns for insert operations
    if (isInsertData && !extra?.undo) {
      // Handle primary key
      for (const pkColumn of this.model.primaryKeys) {
        if (pkColumn.ai) {
          const keyName =
            data?.[pkColumn.column_name] !== undefined
              ? pkColumn.column_name
              : pkColumn.title;

          if (data[keyName]) {
            delete data[keyName];
          }
        }
      }
    }

    for (const column of this.model.columns) {
      if (column.uidt === UITypes.Meta && this.isPg) {
        if (!isInsertData)
          runAfterForLoop.push(() => {
            if (!updatedColIds.length) return;

            data[column.column_name] = prepareMetaUpdateQuery({
              knex: this.dbDriver,
              colIds: updatedColIds,
              props: {
                modifiedBy: cookie?.user?.id,
                modifiedTime: this.now(),
              },
              metaColumn: column,
            });
          });

        continue;
      }

      if (!ncIsUndefined(data[column.column_name]) && !isInsertData) {
        updatedColIds.push(column.id);
      }

      if (
        !ncIsUndefined(data[column.column_name]) &&
        !ncIsNull(data[column.column_name]) &&
        (this.context.api_version === NcApiVersion.V3 ||
          // partially open the parseUserInput to several UITypes
          [
            UITypes.LongText,
            UITypes.SingleLineText,
            UITypes.PhoneNumber,
            UITypes.Email,
            UITypes.JSON,
            UITypes.Currency,
          ].includes(column.uidt as UITypes))
      ) {
        data[column.column_name] = (
          await FieldHandler.fromBaseModel(this).parseUserInput({
            value: data[column.column_name],
            column,
            oldData,
            row: data,
            options: {
              context: this.context,
              logger: logger,
            },
          })
        ).value;
      }
      if (
        ![
          UITypes.Attachment,
          UITypes.JSON,
          UITypes.User,
          UITypes.CreatedTime,
          UITypes.LastModifiedTime,
          UITypes.CreatedBy,
          UITypes.LastModifiedBy,
          UITypes.LongText,
          UITypes.MultiSelect,
          UITypes.Order,
        ].includes(column.uidt) ||
        (column.uidt === UITypes.LongText &&
          column.meta?.[LongTextAiMetaProp] !== true)
      )
        continue;

      if (column.system) {
        if (isInsertData) {
          if (column.uidt === UITypes.CreatedTime) {
            data[column.column_name] = this.now();
          } else if (column.uidt === UITypes.CreatedBy) {
            data[column.column_name] = cookie?.user?.id;
          } else if (column.uidt === UITypes.Order && !extra?.undo) {
            if (extra?.before) {
              data[column.column_name] = (
                await this.getUniqueOrdersBeforeItem(extra?.before, 1)
              )[0].toString();
            } else {
              data[column.column_name] = (
                extra?.ncOrder ?? (await this.getHighestOrderInTable())
              ).toString();
            }
          }
        }
        if (column.uidt === UITypes.LastModifiedTime) {
          data[column.column_name] = isInsertData ? null : this.now();
        } else if (column.uidt === UITypes.LastModifiedBy) {
          data[column.column_name] = isInsertData ? null : cookie?.user?.id;
        }
      }
      if (
        column.uidt === UITypes.Attachment &&
        this.context.api_version === NcApiVersion.V3
      ) {
        if (column.column_name in data) {
          if (
            data &&
            data[column.column_name] &&
            typeof data[column.column_name] === 'object'
          ) {
            data[column.column_name] = JSON.stringify(data[column.column_name]);
          }
        }
      } else if (
        column.uidt === UITypes.Attachment &&
        this.context.api_version !== NcApiVersion.V3
      ) {
        if (column.column_name in data) {
          if (data && data[column.column_name]) {
            try {
              if (typeof data[column.column_name] === 'string') {
                data[column.column_name] = JSON.parse(data[column.column_name]);
              }

              if (
                data[column.column_name] &&
                !Array.isArray(data[column.column_name])
              ) {
                NcError.get(this.context).invalidAttachmentJson(
                  data[column.column_name],
                );
              }
            } catch (e) {
              NcError.get(this.context).invalidAttachmentJson(
                data[column.column_name],
              );
            }

            // Confirm that all urls are valid urls
            for (const attachment of data[column.column_name] || []) {
              if (!('url' in attachment) && !('path' in attachment)) {
                NcError.get(this.context).unprocessableEntity(
                  'Attachment object must contain either url or path',
                );
              }

              if (attachment.url) {
                if (attachment.url.startsWith('data:')) {
                  NcError.get(this.context).unprocessableEntity(
                    `Attachment urls do not support data urls`,
                  );
                }

                if (attachment.url.length > 8 * 1024) {
                  NcError.get(this.context).unprocessableEntity(
                    `Attachment url '${attachment.url}' is too long`,
                  );
                }
              }
            }
          }

          if (oldData && oldData[column.title]) {
            try {
              if (typeof oldData[column.title] === 'string') {
                oldData[column.title] = JSON.parse(oldData[column.title]);
              }
            } catch (e) {}
          }

          const regenerateIds = [];

          if (!isInsertData) {
            const oldAttachmentMap = new Map<
              string,
              { url?: string; path?: string }
            >(
              oldData &&
              oldData[column.title] &&
              Array.isArray(oldData[column.title])
                ? oldData[column.title]
                    .filter((att) => att.id)
                    .map((att) => [att.id, att])
                : [],
            );

            const newAttachmentMap = new Map<
              string,
              { url?: string; path?: string }
            >(
              data[column.column_name] &&
              Array.isArray(data[column.column_name])
                ? data[column.column_name]
                    .filter((att) => att.id)
                    .map((att) => [att.id, att])
                : [],
            );

            const deleteIds = [];

            for (const [oldId, oldAttachment] of oldAttachmentMap) {
              if (!newAttachmentMap.has(oldId)) {
                deleteIds.push(oldId);
              } else if (
                (oldAttachment.url &&
                  oldAttachment.url !== newAttachmentMap.get(oldId).url) ||
                (oldAttachment.path &&
                  oldAttachment.path !== newAttachmentMap.get(oldId).path)
              ) {
                deleteIds.push(oldId);
                regenerateIds.push(oldId);
              }
            }

            if (deleteIds.length) {
              await FileReference.delete(this.context, deleteIds);
            }

            for (const [newId, newAttachment] of newAttachmentMap) {
              if (!oldAttachmentMap.has(newId)) {
                regenerateIds.push(newId);
              } else if (
                (newAttachment.url &&
                  newAttachment.url !== oldAttachmentMap.get(newId).url) ||
                (newAttachment.path &&
                  newAttachment.path !== oldAttachmentMap.get(newId).path)
              ) {
                regenerateIds.push(newId);
              }
            }
          }

          const sanitizedAttachments = [];
          if (Array.isArray(data[column.column_name])) {
            for (const attachment of data[column.column_name]) {
              if (!('url' in attachment) && !('path' in attachment)) {
                NcError.get(this.context).unprocessableEntity(
                  'Attachment object must contain either url or path',
                );
              }
              const sanitizedAttachment = extractProps(attachment, [
                'id',
                'url',
                'path',
                'title',
                'mimetype',
                'size',
                'icon',
                'width',
                'height',
              ]);

              if (
                isInsertData ||
                !sanitizedAttachment.id ||
                regenerateIds.includes(sanitizedAttachment.id)
              ) {
                const source = await this.getSource();
                sanitizedAttachment.id = await FileReference.insert(
                  this.context,
                  {
                    file_url:
                      sanitizedAttachment.url ?? sanitizedAttachment.path,
                    file_size: sanitizedAttachment.size,
                    fk_user_id: cookie?.user?.id ?? 'anonymous',
                    source_id: source.id,
                    fk_model_id: this.model.id,
                    fk_column_id: column.id,
                    is_external: !source.isMeta(),
                  },
                );
              }

              sanitizedAttachments.push(sanitizedAttachment);
            }
          }

          data[column.column_name] = sanitizedAttachments.length
            ? JSON.stringify(sanitizedAttachments)
            : null;
        }
      } else if (
        [UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(
          column.uidt,
        )
      ) {
        // Resolve @me token in default value for User columns during insert
        if (
          isInsertData &&
          column.uidt === UITypes.User &&
          ncIsNullOrUndefined(data[column.column_name]) &&
          column.cdf &&
          typeof column.cdf === 'string' &&
          column.cdf.includes(CURRENT_USER_TOKEN) &&
          cookie?.user?.id
        ) {
          data[column.column_name] = resolveCurrentUserToken(
            column.cdf,
            cookie.user.id,
          );
        }

        if (!ncIsNullOrUndefined(data[column.column_name])) {
          const userIds = [];

          if (
            typeof data[column.column_name] === 'string' &&
            /^\s*[{[]/.test(data[column.column_name])
          ) {
            try {
              data[column.column_name] = JSON.parse(data[column.column_name]);
            } catch (e) {}
          }

          const baseUsers = await BaseUser.getUsersList(this.context, {
            base_id: this.model.base_id,
            // deleted user may still exists on some fields
            // it's still valid as a historical record
            include_ws_deleted: true,
            include_internal_user: true,
            include_team_users: true,
          });

          if (typeof data[column.column_name] === 'object') {
            const users: { id?: string; email?: string }[] = Array.isArray(
              data[column.column_name],
            )
              ? data[column.column_name]
              : [data[column.column_name]];
            for (const userObj of users) {
              const user = extractProps(userObj, ['id', 'email']);
              try {
                if ('id' in user) {
                  const u = baseUsers.find((u) => u.id === user.id);
                  if (!u) {
                    NcError.get(this.context).unprocessableEntity(
                      `User with id '${user.id}' is not part of this workspace`,
                    );
                  }
                  userIds.push(u.id);
                } else if ('email' in user) {
                  // skip null input
                  if (!user.email) continue;
                  // trim extra spaces
                  user.email = user.email.trim();
                  // skip empty input
                  if (user.email.length === 0) continue;
                  const u = baseUsers.find((u) => u.email === user.email);
                  if (!u) {
                    NcError.get(this.context).unprocessableEntity(
                      `User with email '${user.email}' is not part of this workspace`,
                    );
                  }
                  userIds.push(u.id);
                } else {
                  NcError.get(this.context).unprocessableEntity(
                    'Invalid user object',
                  );
                }
              } catch (e) {
                NcError.get(this.context).unprocessableEntity(e.message);
              }
            }
          } else if (typeof data[column.column_name] === 'string') {
            const users = data[column.column_name]
              .split(',')
              .map((u) => u.trim());
            for (const user of users) {
              try {
                if (user.length === 0) continue;
                if (user.includes('@')) {
                  const u = baseUsers.find((u) => u.email === user);
                  if (!u) {
                    NcError.get(this.context).unprocessableEntity(
                      `User with email '${user}' is not part of this workspace`,
                    );
                  }
                  userIds.push(u.id);
                } else {
                  const u = baseUsers.find((u) => u.id === user);
                  if (!u) {
                    NcError.get(this.context).unprocessableEntity(
                      `User with id '${user}' is not part of this workspace`,
                    );
                  }
                  userIds.push(u.id);
                }
              } catch (e) {
                NcError.get(this.context).unprocessableEntity(e.message);
              }
            }
          } else {
            logger.error(
              `${data[column.column_name]} is not a valid user input`,
            );
            NcError.get(this.context).unprocessableEntity(
              'Invalid user object',
            );
          }

          if (userIds.length === 0) {
            data[column.column_name] = null;
          } else {
            const userSet = new Set(userIds);

            if (userSet.size !== userIds.length) {
              NcError.get(this.context).unprocessableEntity(
                'Duplicate users not allowed for user field',
              );
            }

            if (column.meta?.is_multi) {
              data[column.column_name] = userIds.join(',');
            } else {
              if (userIds.length > 1) {
                NcError.get(this.context).unprocessableEntity(
                  `Multiple users not allowed for '${column.title}'`,
                );
              } else {
                data[column.column_name] = userIds[0];
              }
            }
          }
        }
      } else if (UITypes.JSON === column.uidt) {
        if (
          data[column.column_name] &&
          typeof data[column.column_name] !== 'string'
        ) {
          data[column.column_name] = JSON.stringify(data[column.column_name]);
        }
      } else if (UITypes.MultiSelect === column.uidt) {
        if (
          data[column.column_name] &&
          Array.isArray(data[column.column_name])
        ) {
          data[column.column_name] = data[column.column_name].join(',');
        }
      } else if (isAIPromptCol(column) && !extra?.raw) {
        if (data[column.column_name]) {
          // value can be stringified object or string
          let value = parseHelper(data[column.column_name]);

          /**
           * IsAiEdited is used to fix edited by ai issue in expanded form as cookie?.system will be undefined in that case
           */
          let isAiEdited = false;

          if (typeof value === 'object') {
            isAiEdited = value.isAiEdited;
            delete value.isAiEdited;

            value = value.value?.toString() ?? '';
          } else {
            value = value?.toString() ?? '';
          }

          const obj: {
            value?: string;
            lastModifiedBy?: string;
            lastModifiedTime?: string;
            isStale?: string;
          } = {};

          if (cookie?.system === true || isAiEdited) {
            Object.assign(obj, {
              value,
              lastModifiedBy: null,
              lastModifiedTime: null,
              isStale: false,
            });
          } else {
            const oldObj = oldData?.[column.title];
            const isStale = oldObj ? oldObj.isStale : false;

            const isModified = oldObj?.value !== value;

            Object.assign(obj, {
              value,
              lastModifiedBy: isModified
                ? cookie?.user?.id
                : oldObj?.lastModifiedBy,
              lastModifiedTime: isModified
                ? this.now()
                : oldObj?.lastModifiedTime,
              isStale: isModified ? false : isStale,
            });
          }

          data[column.column_name] = JSON.stringify(obj);
        }
      }
    }

    if (runAfterForLoop.length) {
      for (const fn of runAfterForLoop) {
        await fn();
      }
    }
  }

  public now() {
    return dayjs()
      .utc()
      .format(this.isMySQL ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ');
  }

  async getCustomConditionsAndApply(params: {
    view?: View;
    column: Column<any>;
    qb?;
    filters?;
    args;
    rowId;
    columns?: Column[];
  }): Promise<any> {
    const { filters, qb, view } = params;
    await conditionV2(
      this,
      [
        ...(view
          ? [
              new Filter({
                children:
                  (await Filter.rootFilterList(this.context, {
                    viewId: view.id,
                  })) || [],
                is_group: true,
              }),
            ]
          : []),
        new Filter({
          children: filters,
          is_group: true,
          logical_op: 'and',
        }),
      ],
      qb,
    );
  }

  async getSource() {
    // return this.source if defined or fetch and return
    return (
      this.source ||
      (this.source = await Source.get(this.context, this.model.source_id))
    );
  }

  protected async clearFileReferences(args: {
    oldData?: Record<string, any>[] | Record<string, any>;
    columns?: Column[];
  }) {
    const { oldData: _oldData, columns } = args;
    const oldData = Array.isArray(_oldData) ? _oldData : [_oldData];

    const modelColumns = columns || (await this.model.getColumns(this.context));

    const attachmentColumns = modelColumns.filter(
      (c) => c.uidt === UITypes.Attachment,
    );

    if (attachmentColumns.length === 0) return;

    for (const column of attachmentColumns) {
      const oldAttachments = [];

      if (oldData) {
        for (const row of oldData) {
          let attachmentRecord = row[column.title];
          if (attachmentRecord) {
            try {
              if (typeof attachmentRecord === 'string') {
                attachmentRecord = JSON.parse(row[column.title]);
              }
              for (const attachment of attachmentRecord) {
                oldAttachments.push(attachment);
              }
            } catch (e) {
              logger.error(e);
            }
          }
        }
      }

      if (oldAttachments.length === 0) continue;

      await FileReference.delete(
        this.context,
        oldAttachments.filter((at) => at.id).map((at) => at.id),
      );
    }
  }

  protected async softDeleteFileReferences(args: {
    oldData?: Record<string, any>[] | Record<string, any>;
    columns?: Column[];
  }) {
    const { oldData: _oldData, columns } = args;
    const oldData = Array.isArray(_oldData) ? _oldData : [_oldData];

    const modelColumns = columns || (await this.model.getColumns(this.context));

    const attachmentColumns = modelColumns.filter(
      (c) => c.uidt === UITypes.Attachment,
    );

    if (attachmentColumns.length === 0) return;

    for (const column of attachmentColumns) {
      const oldAttachments = [];

      if (oldData) {
        for (const row of oldData) {
          let attachmentRecord = row[column.title];
          if (attachmentRecord) {
            try {
              if (typeof attachmentRecord === 'string') {
                attachmentRecord = JSON.parse(row[column.title]);
              }
              for (const attachment of attachmentRecord) {
                oldAttachments.push(attachment);
              }
            } catch (e) {
              logger.error(e);
            }
          }
        }
      }

      if (oldAttachments.length === 0) continue;

      await FileReference.softDelete(
        this.context,
        oldAttachments.filter((at) => at.id).map((at) => at.id),
      );
    }
  }

  private async broadcastLinkUpdateAwaited(ids: Array<string>) {
    const ast = await getAst(this.context, {
      model: this.model,
    });

    const list = await this.chunkList({
      pks: ids,
      chunkSize: 100,
      args: ast.dependencyFields,
    });

    for (const item of list) {
      const extractedId = this.extractPksValues(item);
      // Route through broadcastDataEvent so this matches the regular update
      // path: RLS-aware fan-out to access groups, plus emit to the standard
      // room. broadcastEvent() only hits the standard room — RLS-subscribed
      // sockets wouldn't see link updates and would render stale link cells
      // until refresh.
      NocoSocket.broadcastDataEvent(this.context, {
        payload: {
          action: 'update',
          payload: item,
          id: extractedId,
        },
        tableId: this.model.id,
      });
    }
  }

  public async broadcastLinkUpdates(ids: Array<string>) {
    this.broadcastLinkUpdateAwaited(ids).catch((e) => {
      logger.error(e);
    });
  }

  /**
   * After soft-deleting or hard-deleting records, update LMT and broadcast
   * for linked records (HM children, MM targets) so their UI reflects the
   * change in visible links.
   */
  /**
   * After deleting (soft or hard) or restoring records, update LMT and
   * broadcast on linked records so their UI reflects the link change.
   *
   * Relation type routing:
   *   'bt'  → V1 BT only. Deleted record is child → update parent.
   *   'oo'  → V1 OO only. Two sub-cases based on column.meta.bt:
   *           - meta.bt=true  (BT-side): deleted record is child → update parent
   *           - meta.bt=false (HM-side): deleted record is parent → update child
   *   'hm'  → V1 HM only. Deleted record is parent → update children.
   *   'mm'  → V1 MM + ALL V2 (mm/om/mo/oo/bt). Junction-based → update linked via junction.
   */
  /**
   * Collect linked record IDs without writing anything.
   * Used by hard-delete paths to gather IDs BEFORE the transaction,
   * then notify AFTER transaction commits.
   */
  protected async collectLinkedRecordNotifications(
    deletedIds: any[],
  ): Promise<{ baseModel: any; model: any; ids: string[]; colId: string }[]> {
    const result: {
      baseModel: any;
      model: any;
      ids: string[];
      colId: string;
    }[] = [];
    if (!deletedIds.length) return result;

    const columns = await this.model.getColumns(this.context);

    for (const column of columns) {
      if (!isLinksOrLTAR(column)) continue;

      const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>(
        this.context,
      );

      try {
        const { mmContext, parentContext, childContext } =
          await colOptions.getParentChildContext(this.context);

        const relationType = isMMOrMMLike(column) ? 'mm' : colOptions.type;

        if (
          relationType === 'bt' ||
          (relationType === 'oo' && column.meta?.bt)
        ) {
          const childColumn = await colOptions.getChildColumn(childContext);
          const parentColumn = await colOptions.getParentColumn(parentContext);
          const parentTable = await parentColumn.getModel(parentContext);
          await parentTable.getColumns(parentContext);
          const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
            model: parentTable,
            dbDriver: this.dbDriver,
          });
          const inverseLinkCol = await extractCorrespondingLinkColumn(
            this.context,
            {
              ltarColumn: column,
              referencedTable: parentTable,
              referencedTableColumns: parentTable.columns,
            },
          );

          const fkRows = await this.execAndParse(
            this.dbDriver(this.tnPath)
              .select(childColumn.column_name)
              .whereIn(this.model.primaryKey.column_name, deletedIds)
              .whereNotNull(childColumn.column_name),
            null,
            { raw: true },
          );
          const parentIds = [
            ...new Set(fkRows.map((r) => r[childColumn.column_name])),
          ] as string[];
          if (parentIds.length) {
            result.push({
              baseModel: parentBaseModel,
              model: parentTable,
              ids: parentIds as string[],
              colId: inverseLinkCol?.id,
            });
          }
        } else if (
          relationType === 'hm' ||
          (relationType === 'oo' && !column.meta?.bt)
        ) {
          const childColumn = await colOptions.getChildColumn(childContext);
          const childTable = await childColumn.getModel(childContext);

          // Skip junction tables (system HM columns from MM point here)
          if (childTable.mm) continue;

          await childTable.getColumns(childContext);
          const childBaseModel = await Model.getBaseModelSQL(childContext, {
            model: childTable,
            dbDriver: this.dbDriver,
          });
          const inverseLinkCol = await extractCorrespondingLinkColumn(
            this.context,
            {
              ltarColumn: column,
              referencedTable: childTable,
              referencedTableColumns: childTable.columns,
            },
          );

          const linkedRows = await this.execAndParse(
            this.dbDriver(childBaseModel.getTnPath(childTable))
              .select(childTable.primaryKey.column_name)
              .whereIn(childColumn.column_name, deletedIds),
            null,
            { raw: true },
          );
          const linkedIds = linkedRows.map(
            (r) => r[childTable.primaryKey.column_name],
          );
          if (linkedIds.length) {
            result.push({
              baseModel: childBaseModel,
              model: childTable,
              ids: linkedIds,
              colId: inverseLinkCol?.id,
            });
          }
        } else if (relationType === 'mm') {
          const vChildCol = await colOptions.getMMChildColumn(mmContext);
          const vParentCol = await colOptions.getMMParentColumn(mmContext);
          const vTable = await colOptions.getMMModel(mmContext);
          const parentTable = await (
            await colOptions.getParentColumn(parentContext)
          ).getModel(parentContext);
          await parentTable.getColumns(parentContext);
          const assocBaseModel = await Model.getBaseModelSQL(mmContext, {
            model: vTable,
            dbDriver: this.dbDriver,
          });
          const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
            model: parentTable,
            dbDriver: this.dbDriver,
          });
          const inverseLinkCol = await extractCorrespondingLinkColumn(
            this.context,
            {
              ltarColumn: column,
              referencedTable: parentTable,
              referencedTableColumns: parentTable.columns,
            },
          );

          const linkedRows = await this.execAndParse(
            this.dbDriver(assocBaseModel.getTnPath(vTable))
              .select(vParentCol.column_name)
              .whereIn(vChildCol.column_name, deletedIds),
            null,
            { raw: true },
          );
          const linkedIds = linkedRows.map((r) => r[vParentCol.column_name]);
          if (linkedIds.length) {
            result.push({
              baseModel: parentBaseModel,
              model: parentTable,
              ids: linkedIds,
              colId: inverseLinkCol?.id,
            });
          }
        }
      } catch (e) {
        logger.error(e?.message, e?.stack);
      }
    }

    return result;
  }

  public async updateLinkedRecordsOnDelete(deletedIds: any[], cookie?: any) {
    if (!deletedIds.length) return;

    const columns = await this.model.getColumns(this.context);
    const deletedSet = new Set(deletedIds.map((id) => String(id)));
    const filterSelfOverlap = <T>(ids: T[], otherModelId: string): T[] =>
      otherModelId === this.model.id
        ? ids.filter((id) => !deletedSet.has(String(id)))
        : ids;

    for (const column of columns) {
      if (!isLinksOrLTAR(column)) continue;

      const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>(
        this.context,
      );

      try {
        const { mmContext, parentContext, childContext } =
          await colOptions.getParentChildContext(this.context);

        const relationType = isMMOrMMLike(column) ? 'mm' : colOptions.type;

        // ── V1 BT / V1 OO BT-side ─────────────────────────────────────────
        // Deleted record is the child (holds FK). Parent loses a visible link.
        // Read FK values from deleted records → find affected parent IDs.
        if (
          relationType === 'bt' ||
          (relationType === 'oo' && column.meta?.bt)
        ) {
          const childColumn = await colOptions.getChildColumn(childContext);
          const parentColumn = await colOptions.getParentColumn(parentContext);
          const parentTable = await parentColumn.getModel(parentContext);
          await parentTable.getColumns(parentContext);

          const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
            model: parentTable,
            dbDriver: this.dbDriver,
          });

          // Find the inverse link column on the parent table
          const inverseLinkCol = await extractCorrespondingLinkColumn(
            this.context,
            {
              ltarColumn: column,
              referencedTable: parentTable,
              referencedTableColumns: parentTable.columns,
            },
          );

          // Read FK values from deleted records to find which parents are affected
          const fkRows = await this.execAndParse(
            this.dbDriver(this.tnPath)
              .select(childColumn.column_name)
              .whereIn(this.model.primaryKey.column_name, deletedIds)
              .whereNotNull(childColumn.column_name),
            null,
            { raw: true },
          );
          const parentIds = filterSelfOverlap(
            Array.from(
              new Set(fkRows.map((r) => r[childColumn.column_name])),
            ) as string[],
            parentTable.id,
          );

          if (parentIds.length) {
            await parentBaseModel.updateLastModified({
              model: parentTable,
              rowIds: parentIds,
              cookie,
              updatedColIds: [inverseLinkCol?.id].filter(Boolean),
            });
            await parentBaseModel.broadcastLinkUpdates(parentIds as string[]);
          }
        }

        // ── V1 HM / V1 OO HM-side ─────────────────────────────────────────
        // Deleted record is the parent. Children hold FK → they lose their parent.
        // Query child table for rows whose FK matches deleted IDs.
        else if (
          relationType === 'hm' ||
          (relationType === 'oo' && !column.meta?.bt)
        ) {
          const childColumn = await colOptions.getChildColumn(childContext);
          const childTable = await childColumn.getModel(childContext);

          // Skip junction tables — they are internal MM tables, not user-facing.
          // System HM columns from V1 MM point to the junction table as child;
          // broadcasting / LMT updates on them fails (composite PK) and is meaningless.
          if (childTable.mm) continue;

          await childTable.getColumns(childContext);

          const childBaseModel = await Model.getBaseModelSQL(childContext, {
            model: childTable,
            dbDriver: this.dbDriver,
          });

          const inverseLinkCol = await extractCorrespondingLinkColumn(
            this.context,
            {
              ltarColumn: column,
              referencedTable: childTable,
              referencedTableColumns: childTable.columns,
            },
          );

          const linkedRows = await this.execAndParse(
            this.dbDriver(childBaseModel.getTnPath(childTable))
              .select(childTable.primaryKey.column_name)
              .whereIn(childColumn.column_name, deletedIds),
            null,
            { raw: true },
          );
          const linkedIds = filterSelfOverlap(
            linkedRows.map((r) => r[childTable.primaryKey.column_name]),
            childTable.id,
          );

          if (linkedIds.length) {
            await childBaseModel.updateLastModified({
              model: childTable,
              rowIds: linkedIds,
              cookie,
              updatedColIds: [inverseLinkCol?.id].filter(Boolean),
            });
            await childBaseModel.broadcastLinkUpdates(linkedIds);
          }
        }

        // ── V1 MM + ALL V2 (mm/om/mo/oo/bt) ───────────────────────────────
        // Junction-table-based. Query junction for linked record IDs.
        else if (relationType === 'mm') {
          const vChildCol = await colOptions.getMMChildColumn(mmContext);
          const vParentCol = await colOptions.getMMParentColumn(mmContext);
          const vTable = await colOptions.getMMModel(mmContext);
          const parentTable = await (
            await colOptions.getParentColumn(parentContext)
          ).getModel(parentContext);
          await parentTable.getColumns(parentContext);

          const assocBaseModel = await Model.getBaseModelSQL(mmContext, {
            model: vTable,
            dbDriver: this.dbDriver,
          });
          const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
            model: parentTable,
            dbDriver: this.dbDriver,
          });

          const inverseLinkCol = await extractCorrespondingLinkColumn(
            this.context,
            {
              ltarColumn: column,
              referencedTable: parentTable,
              referencedTableColumns: parentTable.columns,
            },
          );

          const linkedRows = await this.execAndParse(
            this.dbDriver(assocBaseModel.getTnPath(vTable))
              .select(vParentCol.column_name)
              .whereIn(vChildCol.column_name, deletedIds),
            null,
            { raw: true },
          );
          const linkedIds = filterSelfOverlap(
            linkedRows.map((r) => r[vParentCol.column_name]),
            parentTable.id,
          );

          if (linkedIds.length) {
            await parentBaseModel.updateLastModified({
              model: parentTable,
              rowIds: linkedIds,
              cookie,
              updatedColIds: [inverseLinkCol?.id].filter(Boolean),
            });
            await parentBaseModel.broadcastLinkUpdates(linkedIds);
          }
        }
      } catch (e) {
        // Don't fail the delete if linked record updates fail
        logger.error(e?.message, e?.stack);
      }
    }
  }

  async bulkAudit({
    qb,
    data,
    conditions,
    req,
    event,
  }: {
    qb: any;
    data?: Record<string, any>;
    conditions: FilterType[];
    req: NcRequest;
    event: BulkAuditV1OperationTypes;
  }) {
    try {
      let batchStart = 0;
      const batchSize = 1000;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const pkQb = qb
          .clone()
          .clear('select')
          .select(
            this.dbDriver.raw('?? as ??', [
              this.model.primaryKey.column_name,
              this.model.primaryKey.title,
            ]),
          )
          .limit(batchSize)
          .offset(batchStart)
          .orderBy(this.model.primaryKey.column_name);

        // if bulk update include old data as well
        if (event === AuditV1OperationTypes.DATA_BULK_UPDATE) {
          await this.selectObject({
            qb: pkQb,
            fields: Object.keys(data),
          });
        }

        const ids = await this.execAndParse(pkQb);

        if (!ids?.length) break;

        if (event === AuditV1OperationTypes.DATA_BULK_UPDATE) {
          await this.bulkUpdateAudit({
            rowIds: ids,
            req,
            conditions,
            data,
          });
        } else if (
          event === AuditV1OperationTypes.DATA_BULK_DELETE ||
          event === AuditV1OperationTypes.DATA_BULK_SOFT_DELETE ||
          event === AuditV1OperationTypes.DATA_BULK_PERMANENT_DELETE
        ) {
          await this.bulkDeleteAudit({
            rowIds: ids,
            req,
            conditions,
          });
        }
        batchStart += batchSize;
      }
    } catch (e) {
      logger.error(e.message, e.stack);
    }
  }

  public async bulkUpdateAudit({
    rowIds,
    req,
    conditions,
    data,
  }: {
    rowIds: any[];
    conditions: FilterType[];
    data?: Record<string, any>;
    req: NcRequest;
  }) {
    // disable external source audit in cloud
    if (!(await this.isDataAuditEnabled())) return;

    const auditUpdateObj = [];
    for (const rowId of rowIds) {
      const prevData = typeof rowId === 'object' ? rowId : {};
      const updateDiff = populateUpdatePayloadDiff({
        keepUnderModified: true,
        prev: prevData,
        next: data,
        exclude: extractExcludedColumnNames(this.model.columns),
        excludeNull: false,
        excludeBlanks: false,
        keepNested: true,
      }) as UpdatePayload;

      auditUpdateObj.push(
        await generateAuditV1Payload<DataBulkUpdateAllPayload>(
          AuditV1OperationTypes.DATA_BULK_ALL_UPDATE,
          {
            context: {
              ...this.context,
              source_id: this.model.source_id,
              fk_model_id: this.model.id,
              row_id: this.extractPksValues(rowId, true),
            },
            details: {
              old_data: updateDiff.previous_state,
              data: updateDiff.modifications,
              conditions: conditions,
              column_meta: extractColsMetaForAudit(
                this.model.columns,
                data,
                prevData,
              ),
            },
            req,
          },
        ),
      );
    }
    await Audit.insert(auditUpdateObj);
  }

  protected async bulkDeleteAudit(_: {
    rowIds: any[];
    conditions: FilterType[];
    req: NcRequest;
  }) {
    // placeholder
  }

  async isDataAuditEnabled() {
    return isDataAuditEnabledFn() as boolean;
  }

  getViewId() {
    return this.viewId;
  }

  async statsUpdate(_args: { count: number }) {}

  async checkPermission(_params: {
    entity: PermissionEntity;
    entityId: string | string[];
    permission: PermissionKey;
    user: any;
    req: any;
  }) {}

  /**
   * Returns RLS (Row-Level Security) filter conditions for the current user.
   * CE version: no-op, returns empty array (no RLS).
   * EE version: resolves applicable policies and returns filter conditions.
   */
  public async getRlsConditions(): Promise<Filter[]> {
    return [];
  }

  /**
   * Returns a knex where-clause callback that excludes soft-deleted records,
   * or null if the table has no __nc_deleted column or is not a meta (NocoDB-managed) source.
   */
  public async getSoftDeleteFilter(): Promise<Knex.QueryCallback | null> {
    if (this._softDeleteFilter !== undefined) return this._softDeleteFilter;

    this._softDeleteFilter = (async () => {
      const columns = await this.model.getColumns(this.context);
      const deletedColumn = columns.find((c) => isDeletedCol(c));
      if (!deletedColumn) return null;

      const source = await this.getSource();
      if (!source.isMeta() || !this.model.isTrashEnabled) return null;
      const columnName = deletedColumn.column_name;
      return function () {
        this.whereNull(columnName).orWhere(columnName, false);
      };
    })();

    return this._softDeleteFilter;
  }
}

export { BaseModelSqlv2 };
