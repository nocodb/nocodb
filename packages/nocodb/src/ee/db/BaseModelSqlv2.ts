import {
  AppEvents,
  AuditV1OperationTypes,
  convertDurationToSeconds,
  CURRENT_USER_TOKEN,
  enumColors,
  isAIPromptCol,
  isArrayShapeLtar,
  isAttachment,
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isDeletedCol,
  isLinksOrLTAR,
  isMMOrMMLike,
  isOrderCol,
  isSelfLinkCol,
  isSupportedDisplayValueColumn,
  isSystemColumn,
  isVirtualCol,
  NcErrorType,
  ncIsUndefined,
  PermissionEntity,
  PermissionKey,
  PlanLimitTypes,
  RelationTypes,
  resolveCurrentUserToken,
  UITypes,
} from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import BigNumber from 'bignumber.js';
import { BaseModelSqlv2 as BaseModelSqlv2CE } from 'src/db/BaseModelSqlv2';
import dayjs from 'dayjs';
import conditionV2 from 'src/db/conditionV2';
import { customValidators } from 'src/db/util/customValidators';
import { v4 as uuidv4 } from 'uuid';
import { customAlphabet } from 'nanoid';
import { NcApiVersion } from 'nocodb-sdk';
import { AttachmentUrlUploadPreparator } from 'src/db/BaseModelSqlv2/attachment-url-upload-preparator';
import { ncIsStringHasValue } from 'src/db/field-handler/utils/handlerUtils';
import type { ExecAndParseOptions } from 'src/db/BaseModelSqlv2';
import type {
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
  UpdatePayload,
} from 'nocodb-sdk';
import type { Knex } from 'knex';
import type CustomKnex from '~/db/CustomKnex';
import type { DisplacedRecord, LinkChange } from '~/command-registry/types';
import type { LinkToAnotherRecordColumn, LookupColumn } from '~/models';
import type { NcContext } from '~/interface/config';
import type { XcFilter } from '~/db/sql-data-mapper/lib/BaseModel';
// import type { SelectOption } from '~/models';
import { PrincipalAssignment, Source, View } from '~/models';
import { BaseModelDelete } from '~/db/BaseModelSqlv2/delete';
import {
  mssqlBuildBulkInsertWithCapture,
  mssqlChunkSize,
  mssqlNeedsIdentityInsert,
} from '~/db/BaseModelSqlv2/mssql-insert-sql';
import {
  batchUpdate,
  extractColsMetaForAudit,
  extractExcludedColumnNames,
  generateAuditV1Payload,
  nocoExecute,
  populateUpdatePayloadDiff,
  processConcurrently,
  remapWithAlias,
} from '~/utils';
import { Audit, Column, Filter, Model, ModelStat, Permission } from '~/models';
import DateDependency from '~/models/DateDependency';
import {
  applyDateDependencyFieldSync,
  buildDateDependencyPropagationSQL,
} from '~/helpers/dateDependencyHelper';
import {
  getSingleQueryReadFn,
  singleQueryGroupedList,
  singleQueryList,
} from '~/services/data-opt/pg-helpers';
import BaseTrash from '~/models/BaseTrash';
import { buildRecordResourceId } from '~/services/base-trash/record-trash.helpers';
import {
  computeCleanupDueAt,
  resolveTrashRetentionDays,
} from '~/helpers/trashHelpers';
import { canUseOptimisedQuery, removeBlankPropsAndMask } from '~/utils';
import {
  UPDATE_WORKSPACE_COUNTER,
  UPDATE_WORKSPACE_STAT,
} from '~/services/update-stats.service';
import { isCloud } from '~/utils';
import Noco from '~/Noco';
import { NcError, OptionsNotExistsError } from '~/helpers/catchError';
import { sanitize } from '~/helpers/sqlSanitize';
import { runExternal, runExternalStream } from '~/helpers/muxHelpers';
import { extractCorrespondingLinkColumn } from '~/db/BaseModelSqlv2/add-remove-links';
import { checkLimit, getLimit } from '~/helpers/paymentHelpers';
import { extractMentions } from '~/utils/richTextHelper';
import { MetaTable, PrincipalType, ResourceType } from '~/utils/globals';
import {
  _wherePk,
  dataWrapper,
  deletedColValue,
  extractSortsObject,
  formatDataForAudit,
  getAs,
  getColumnName,
  getCompositePkValue,
  getListArgs,
  haveFormulaColumn,
  populatePk,
  shouldCascadeLinkCleanup,
  splitCompositePkString,
  validateFuncOnColumn,
} from '~/helpers/dbHelpers';
import { getProjectRole } from '~/utils/roleHelper';
import NocoSocket from '~/socket/NocoSocket';
import { chunkArray } from '~/utils/tsUtils';
import { singleQueryList as mysqlSingleQueryList } from '~/services/data-opt/mysql-helpers';
import { singleQueryList as mssqlSingleQueryList } from '~/services/data-opt/mssql-helpers';
import { Profiler } from '~/helpers/profiler';
import { handleUniqueConstraintError } from '~/helpers/uniqueConstraintErrorHandler';
import getAst from '~/helpers/getAst';
import {
  resolveRlsDynamicValues,
  resolveRlsPolicies,
} from '~/utils/rls-resolver';
import { getMemberUserIdsForTeamsAndDescendants } from '~/utils/team-subject-matcher';

const nanoidv2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);

const ORDER_STEP_INCREMENT = 1;
const MAX_RECURSION_DEPTH = 2;
const READ_CHUNK_SIZE = 100;
const WHERE_IN_CHUNK_SIZE = 5000;

import { replaceDynamicFieldWithValue } from '~/helpers/dynamicFieldHelper';
import {
  captureForTrace,
  isTraceActive,
} from '~/decorators/trace-command.decorator';
import { pickChangedFieldsForUpdatePrev } from '~/utils/dataUtils';
import { deepUnwrapLkv, flattenNestedLookup } from '~/db/mssql-lookup-flatten';
export { replaceDynamicFieldWithValue } from '~/helpers/dynamicFieldHelper';

/**
 * Base class for models
 *
 * @class
 * @classdesc Base class for models
 */
class BaseModelSqlv2 extends BaseModelSqlv2CE {
  public context: NcContext;

  constructor({
    dbDriver,
    model,
    viewId,
    schema,
    context,
    queryQueue,
  }: {
    [key: string]: any;
    model: Model;
    schema?: string;
  }) {
    super({ dbDriver, model, viewId, queryQueue });
    this.schema = schema;
    this.context = context;
  }

  // need to override for it to return ee version
  /**
   * Creates a new BaseModelSqlv2 instance that uses the base database driver
   * instead of any active transaction. This is useful for operations that need
   * to run outside of the current transaction context, such as broadcasting
   * link updates to avoid transaction conflicts.
   *
   * @returns A new BaseModelSqlv2 instance with non-transactional database access
   */
  public override getNonTransactionalClone() {
    return new BaseModelSqlv2({
      dbDriver: this._dbDriver,
      model: this.model,
      viewId: this.viewId,
      context: this.context,
      schema: this.schema,
      queryQueue: this._queryQueue,
    });
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
    }: {
      ignoreView?: boolean;
      getHiddenColumn?: boolean;
      throwErrorIfInvalidParams?: boolean;
      extractOnlyPrimaries?: boolean;
      apiVersion?: NcApiVersion;
      extractOrderColumn?: boolean;
      ignoreRls?: boolean;
      fk_display_value_column_id?: string | null;
    } = {},
    disableOptimization = false,
  ): Promise<any> {
    const source = await this.getSource();

    // Use optimized query for PostgreSQL/MySQL when available
    if (
      await canUseOptimisedQuery(this.context, {
        source,
        disableOptimization,
      })
    ) {
      const view =
        ignoreView || !this.viewId
          ? null
          : await View.get(this.context, this.viewId);

      const result = await getSingleQueryReadFn(source)(this.context, {
        model: this.model,
        id,
        view,
        params: query || {},
        source,
        getHiddenColumn,
        throwErrorIfInvalidParams,
        validateFormula,
        apiVersion: apiVersion ?? this.context.api_version,
        extractOnlyPrimaries,
        extractOrderColumn,
        ignoreRls,
        fk_display_value_column_id,
      });

      // Ensure we return null instead of undefined for consistency with CE version
      return result ?? null;
    }

    // Fallback to superclass implementation when optimization is not available
    return super.readByPk(id, validateFormula, query, {
      ignoreView,
      getHiddenColumn,
      throwErrorIfInvalidParams,
      extractOnlyPrimaries,
      apiVersion,
      extractOrderColumn,
      ignoreRls,
      fk_display_value_column_id,
    });
  }

  public getTnPath(tb: { table_name: string } | string, alias?: string) {
    const tn = typeof tb === 'string' ? tb : tb.table_name;
    if ((this.isPg || this.isMssql) && this.schema) {
      return `${this.schema}.${tn}${alias ? ` as ${alias}` : ``}`;
    } else if (this.isSnowflake) {
      return `${[
        this.dbDriver.extDb?.connection?.database ||
          this.dbDriver.client.config.connection.database,
        this.dbDriver.extDb?.connection?.schema ||
          this.dbDriver.client.config.connection.schema,
        tn,
      ].join('.')}${alias ? ` as ${alias}` : ``}`;
    } else {
      return `${tn}${alias ? ` as ${alias}` : ``}`;
    }
  }

  public async execAndParse(
    qb: Knex.QueryBuilder | string,
    dependencyColumns?: Column[],
    options?: ExecAndParseOptions & { first: true },
  ): Promise<Record<string, any>>;
  public async execAndParse(
    qb: Knex.QueryBuilder | string,
    dependencyColumns?: Column[],
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
      bulkAggregate: false,
      skipJsonConversion: false,
      raw: false,
      first: false,
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

    let data;
    if (this.dbDriver.isExternal) {
      data = await runExternal(this.sanitizeQuery(query), this.dbDriver.extDb);
    } else {
      data = await this.execAndGetRows(query);
    }

    if (!this.model?.columns) {
      await this.model.getColumns(this.context);
    }

    // MSSQL preprocessing — applied BEFORE every converter so the rest of the
    // pipeline sees the same shape pg produces. Skipped for raw / bulkAggregate
    // paths (those bypass the converter pipeline entirely).
    if (
      this.isMssql &&
      !options.raw &&
      !options.bulkAggregate &&
      Array.isArray(data) &&
      data.length
    ) {
      data = await this.preProcessMssqlRows(data, dependencyColumns);
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
    // Update button fields
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

    if (!options.skipSubstitutingColumnIds) {
      data = await this.substituteColumnIdsWithColumnTitles(
        data,
        dependencyColumns,
        aliasColumns,
      );
    }
    if (options.apiVersion === NcApiVersion.V3) {
      data = await this.convertMultiSelectTypes(data, dependencyColumns);
    }

    if (options.first) {
      return data?.[0];
    }

    return data;
  }

  /**
   * MSSQL-only: parse FOR JSON nvarchar payloads for relational columns into
   * JS objects/arrays. Mirrors what node-pg's json type does automatically.
   *
   * Column shapes the EE mssql client produces and we recover here:
   *   • LTAR / Links(as-LTAR)   → JSON object (BT/OO) or array of objects (HM/MM)
   *   • Lookup scalar           → JSON `{"_lkv": value}`     — unwrap to value
   *   • Lookup array (HM/MM)    → JSON `[{"_lkv": v}, …]`    — unwrap to `[v, …]`
   *   • Lookup of array-target  → nested `[{"_lkv":[…]}, …]` — flatten to pg's
   *                               single-level shape (`flattenNestedLookup`)
   *
   * The `{_lkv:…}` sentinel exists because T-SQL has no `json_agg(value)`. All
   * unwrapping is centralized in `deepUnwrapLkv` / `flattenNestedLookup`
   * (mssql-lookup-flatten.ts) rather than re-implemented per case. `deepUnwrapLkv`
   * additionally strips the sentinel from Lookups nested inside field-expanded
   * linked records (`nested[Link][fields]=…`), which the top-level passes —
   * the per-column switch and the defensive sweep below — never reach.
   *
   * Also normalizes `null` → `[]` for known array-shaped relational columns
   * (HM / MM / MM-like LTARs and HM / MM Lookups). MSSQL's FOR JSON subquery
   * returns SQL NULL for an empty result set, where pg's `json_agg` typically
   * returns `[]` via `COALESCE`. Normalizing here keeps downstream consumers
   * (frontend, scripts, hooks) from having to null-guard.
   */
  // Per-instance cache of the expensive Lookup-shape determination
  // (`array` vs `scalar`). Keyed by column id; values survive for the
  // lifetime of the BaseModel instance (typically one per request).
  private _mssqlLookupShape?: Map<string, 'array' | 'scalar' | 'nested'>;

  protected async preProcessMssqlRows(
    data: Record<string, any>[],
    dependencyColumns?: Column[],
  ): Promise<Record<string, any>[]> {
    if (!Array.isArray(data) || !data.length) return data;

    const cols = (this.model?.columns ?? []).concat(dependencyColumns ?? []);
    const shapeCache =
      this._mssqlLookupShape ?? (this._mssqlLookupShape = new Map());

    // ── Per-call classification ────────────────────────────────────────
    // Build a single `actions` array — `id -> kind` — so the per-row loop is
    // ONE iteration with a switch, instead of six independent loops. Each
    // entry stores the row key (col.id, since EE mssql extract aliases by
    // `getAs(column) = column.asId || column.id`) and the action to take.
    type Kind =
      | 'ltarArr'
      | 'ltarObj'
      | 'lkpArr'
      | 'lkpNested'
      | 'lkpScalar'
      | 'linksMaybe'
      | 'numeric'
      | 'time';
    const actions: Array<{ id: string; kind: Kind }> = [];
    let hasLookup = false;

    for (const col of cols) {
      const id = col.asId || col.id;
      switch (col.uidt) {
        case UITypes.LinkToAnotherRecord: {
          actions.push({
            id,
            kind: isArrayShapeLtar(col) ? 'ltarArr' : 'ltarObj',
          });
          break;
        }
        case UITypes.Links: {
          actions.push({ id, kind: 'linksMaybe' });
          break;
        }
        case UITypes.Number:
        case UITypes.Decimal:
        case UITypes.Currency:
        case UITypes.Duration: {
          // Skip when the underlying SQL type is one tedious already returns
          // as a JS number (int family, float, money). Only `bigint`,
          // `decimal`, `numeric` need coercion. Unset dt (e.g. for nullable
          // formula-derived columns) falls back to coercion.
          const dt = (col.dt ?? '').toLowerCase();
          if (
            dt !== 'int' &&
            dt !== 'smallint' &&
            dt !== 'tinyint' &&
            dt !== 'float' &&
            dt !== 'real' &&
            dt !== 'money' &&
            dt !== 'smallmoney'
          ) {
            actions.push({ id, kind: 'numeric' });
          }
          break;
        }
        case UITypes.Time: {
          // tedious returns the T-SQL `time` type as a JS Date anchored at
          // 1970-01-01. convertDateFormat (CE) skips UITypes.Time entirely, so
          // without this the API leaks a Date/ISO value for mssql while every
          // other dialect emits `YYYY-MM-DD HH:mm:ssZ`. Normalize here.
          actions.push({ id, kind: 'time' });
          break;
        }
        case UITypes.Lookup: {
          // Walk-through-to-relation is expensive; cache per column id.
          let shape = shapeCache.get(col.id);
          if (!shape) {
            try {
              const lkOpt = col.colOptions as LookupColumn;
              const rel = await lkOpt?.getRelationColumn?.(this.context);
              const relOpts = rel
                ? await rel.getColOptions<LinkToAnotherRecordColumn>(
                    this.context,
                  )
                : null;
              const isMMLike = rel ? isMMOrMMLike(rel) : false;
              const isArray =
                isMMLike ||
                relOpts?.type === RelationTypes.HAS_MANY ||
                (relOpts?.type === RelationTypes.ONE_TO_ONE && !rel?.meta?.bt);
              if (!isArray) {
                shape = 'scalar';
              } else {
                // When the looked-up column is itself array-shaped, the FOR
                // JSON extract produces an array-of-arrays. pg flattens this
                // (json_array_elements) iff BOTH the lookup AND its target are
                // array-shaped — mirror that decision so the post-parse shape
                // matches. A scalar/object/attachment target stays as-is.
                shape = (await this.isArrayShapedLookupTarget(lkOpt))
                  ? 'nested'
                  : 'array';
              }
            } catch {
              // Lookup resolution can fail on cross-base; treat as scalar so
              // the `_lkv` unwrap still runs.
              shape = 'scalar';
            }
            shapeCache.set(col.id, shape);
          }
          actions.push({
            id,
            kind:
              shape === 'nested'
                ? 'lkpNested'
                : shape === 'array'
                ? 'lkpArr'
                : 'lkpScalar',
          });
          hasLookup = true;
          break;
        }
      }
    }

    if (!actions.length) return data;

    const tryParse = (v: any) => {
      // Inline-fast: avoid trimStart when first char already matches; only
      // trim+retest on whitespace-leading payloads.
      if (typeof v !== 'string') return v;
      let c = v.charCodeAt(0);
      if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) {
        const t = v.trimStart();
        c = t.charCodeAt(0);
        if (c === 0x5b /* [ */ || c === 0x7b /* { */) {
          try {
            return JSON.parse(v);
          } catch {
            return v;
          }
        }
        return v;
      }
      if (c === 0x5b /* [ */ || c === 0x7b /* { */) {
        try {
          return JSON.parse(v);
        } catch {
          return v;
        }
      }
      return v;
    };

    // ── Per-row pass ──────────────────────────────────────────────────
    // Single tight loop, hoisted action list, hoisted length. The defensive
    // `_lkv` sweep is gated on `hasLookup` so the common case (no Lookup
    // columns) pays NO extra per-row cost beyond the action loop itself.
    const n = actions.length;
    for (let r = 0; r < data.length; r++) {
      const row = data[r];
      for (let i = 0; i < n; i++) {
        const a = actions[i];
        const id = a.id;
        if (!(id in row)) continue;
        const v = row[id];
        switch (a.kind) {
          case 'ltarArr':
            if (v == null) row[id] = [];
            // deepUnwrapLkv: strip `_lkv` from field-expanded child records.
            else row[id] = deepUnwrapLkv(tryParse(v));
            break;
          case 'ltarObj':
            if (v != null) row[id] = deepUnwrapLkv(tryParse(v));
            break;
          case 'lkpScalar': {
            // scalar lookup `{_lkv:x}` → x (no-op on an already-bare value).
            if (v == null) break;
            row[id] = deepUnwrapLkv(tryParse(v));
            break;
          }
          case 'lkpArr': {
            // array lookup `[{_lkv:v},…]` → `[v,…]`; deepUnwrapLkv unwraps each.
            if (v == null) {
              row[id] = [];
              break;
            }
            row[id] = deepUnwrapLkv(tryParse(v));
            break;
          }
          case 'lkpNested': {
            // Lookup whose target column is array-shaped: the extract nests an
            // array per multi-hop. Flatten to the single-level array pg emits.
            if (v == null) {
              row[id] = [];
              break;
            }
            const parsed = tryParse(v);
            row[id] = Array.isArray(parsed)
              ? flattenNestedLookup(parsed)
              : parsed;
            break;
          }
          case 'linksMaybe': {
            // Links column: count number, null, or JSON payload string.
            // `tryParse` already short-circuits on non-JSON-shaped strings —
            // call it directly without re-running the shape sniff here.
            // deepUnwrapLkv strips `_lkv` from any field-expanded child records.
            if (typeof v === 'string') row[id] = deepUnwrapLkv(tryParse(v));
            break;
          }
          case 'numeric': {
            if (typeof v !== 'string' || v === '') break;
            const num = Number(v);
            if (Number.isFinite(num)) row[id] = num;
            break;
          }
          case 'time': {
            // Date (tedious) or ISO string -> `YYYY-MM-DD HH:mm:ssZ`, matching
            // the shape pg/sqlite/mysql return so the API, frontend Time cell
            // and filter-value normalization stay dialect-consistent.
            if (v == null) break;
            // A plain number on a Time column is an aggregate scalar (count /
            // sum / percent over the column), not a time value — tedious always
            // returns the T-SQL `time` type as a JS Date. dayjs(<number>) would
            // wrongly coerce e.g. a count of 6 into "1970-01-01 00:00:00Z".
            if (typeof v === 'number') break;
            const t = dayjs(v).utc();
            if (t.isValid()) row[id] = t.format('YYYY-MM-DD HH:mm:ssZ');
            break;
          }
        }
      }

      // Defensive `_lkv` sweep — covers stragglers (cross-base lookups where
      // the column metadata didn't resolve into `cols`, asId/title-aliased
      // rows, etc.). Skipped entirely when no Lookup columns are present —
      // the dominant case for most tables — so unrelated workloads pay zero
      // cost here. `for…in` instead of `Object.keys` avoids an array
      // allocation per row. The array branch short-circuits on the first
      // element since the extract emits a uniform `[{_lkv:…},…]` shape.
      if (!hasLookup) continue;
      for (const key in row) {
        const v = row[key];
        if (v == null || typeof v !== 'object') continue;
        if (!Array.isArray(v)) {
          if ('_lkv' in v) {
            row[key] = (v as { _lkv: unknown })._lkv;
          }
          continue;
        }
        if (v.length === 0) continue;
        const first = v[0];
        if (
          !first ||
          typeof first !== 'object' ||
          !('_lkv' in (first as object))
        ) {
          continue;
        }
        for (let i = 0; i < v.length; i++) {
          const item = v[i];
          if (item && typeof item === 'object' && '_lkv' in item) {
            v[i] = (item as { _lkv: unknown })._lkv;
          }
        }
      }
    }

    return data;
  }

  /**
   * Whether a lookup's looked-up column is array-shaped — i.e. its `extractColumn`
   * would set `result.isArray`. Mirrors pg's flatten gate (pg.ts Lookup case):
   *   • LTAR / Links    → array iff isArrayShapeLtar (HM / MM / OO-forward)
   *   • nested Lookup   → array iff its own relation is array-shaped
   *   • anything else   → false (scalar, attachment, json, formula, rollup…)
   * Resolution is best-effort on cross-base; failures fall back to `false`
   * (no flatten — safe, preserves the pre-fix shape).
   */
  protected async isArrayShapedLookupTarget(
    lkOpt: LookupColumn,
  ): Promise<boolean> {
    try {
      const target = await lkOpt?.getLookupColumn?.(this.context);
      if (!target) return false;
      if (!target.colOptions) {
        await target.getColOptions(this.context).catch(() => undefined);
      }
      if (isLinksOrLTAR(target)) return isArrayShapeLtar(target);
      if (target.uidt === UITypes.Lookup) {
        const innerRel = await (
          target.colOptions as LookupColumn
        )?.getRelationColumn?.(this.context);
        return innerRel ? isArrayShapeLtar(innerRel) : false;
      }
      return false;
    } catch {
      return false;
    }
  }

  public async handleRichTextMentions(
    prevData,
    newData: Record<string, any> | Array<Record<string, any>>,
    req,
  ) {
    newData = Array.isArray(newData) ? newData : [newData];

    prevData = Array.isArray(prevData) ? prevData : prevData ? [prevData] : [];

    const columns = (await this.model.getColumns(this.context)).filter(
      (c) => c.uidt === UITypes.LongText && c.meta?.richMode,
    );

    newData.forEach((newRow, index) => {
      const prevRow = prevData[index];
      for (const column of columns) {
        const prevMentions = extractMentions(
          prevRow?.[column.column_name] ?? '',
        );
        const newMentions = extractMentions(newRow[column.column_name]);

        const uniqMentions = newMentions.filter(
          (m) => !prevMentions.includes(m),
        );

        if (uniqMentions.length > 0) {
          Noco.eventEmitter.emit(AppEvents.ROW_USER_MENTION, {
            mentions: uniqMentions,
            user: req?.user,
            column,
            rowId: this.extractPksValues(newRow, true),
            model: this.model,
            req,
          });
        }
      }
    });
  }

  async runOps(ops: Promise<string>[], trx = this.dbDriver) {
    const queries = (await Promise.all(ops)).filter((query) =>
      ncIsStringHasValue(query),
    );
    if (this.dbDriver.isExternal) {
      await runExternal(this.sanitizeQuery(queries), this.dbDriver.extDb);
    } else {
      for (const query of queries) {
        await trx.raw(this.sanitizeQuery(query));
      }
    }
  }

  async insert(data, trx?, cookie?, disableOptimization = false) {
    try {
      const columns = await this.model.getColumns(this.context);

      await populatePk(this.context, this.model, data);

      // todo: filter based on view
      const insertObj = await this.model.mapAliasToColumn(
        this.context,
        data,
        this.clientMeta,
        this.dbDriver,
        columns,
      );

      await this.validate(insertObj, columns);

      if ('beforeInsert' in this) {
        await this.beforeInsert(insertObj, cookie);
      }

      await this.prepareNocoData(insertObj, true, cookie);

      let response;
      // const driver = trx ? trx : this.dbDriver;

      const query = this.dbDriver(this.tnPath).insert(insertObj);
      if ((this.isPg || this.isMssql) && this.model.primaryKey) {
        query.returning(
          `${this.model.primaryKey.column_name} as ${this.model.primaryKey.id}`,
        );

        if (this.isMssql) {
          // MSSQL: ALWAYS route through `mssqlBuildBulkInsertWithCapture`.
          //
          // The OUTPUT-INTO-table-variable shape is required by triggers
          // (T-SQL error 334 on bare OUTPUT INSERTED) and by explicit
          // IDENTITY values (error 544). We used to keep a "fast" branch
          // for the no-triggers, no-explicit-identity case that called
          // `execAndParse(query, ...)` on the knex QueryBuilder directly,
          // but execAndParse renders that QB via `qb.toQuery()` and ships
          // the resulting string to `runExternal` (sql-executor). knex's
          // mssql `.toQuery()` inlines string bindings as bare varchar
          // literals (`'…'`) — those get implicit-converted to nvarchar
          // through the connection collation (default
          // SQL_Latin1_General_CP1_CI_AS = CP-1252) on the way to the
          // nvarchar(MAX) column, stripping anything outside Latin-1
          // (emoji, supplementary CJK, …) to `?`. `mssqlBuildBulkInsertWithCapture`
          // emits `CAST(N'…' AS NVARCHAR(MAX))` literals via
          // `tsqlNVarcharLiteral` (see mssql-insert-sql.ts) which
          // round-trip Unicode losslessly, so unifying the branches is
          // also the correctness fix.
          const aiColName =
            this.model.columns?.find((c) => c.ai)?.column_name ?? null;
          const explicitIdentity = mssqlNeedsIdentityInsert(
            [insertObj],
            aiColName,
          );
          const sql = mssqlBuildBulkInsertWithCapture({
            knex: this.dbDriver,
            tnPath: this.tnPath,
            rows: [insertObj],
            pkCols: this.model.primaryKeys ?? [],
            explicitIdentity,
            aliasField: 'id',
          });
          response = await this.execAndParse(sql, null, { raw: true });
        } else {
          response = await this.execAndParse(query, null, { raw: true });
        }
      }

      const ai = this.model.columns.find((c) => c.ai);

      let ag: Column;
      if (!ai) ag = this.model.columns.find((c) => c.meta?.ag);

      const source = await this.getSource();

      // handle if autogenerated primary key is used
      if (ag) {
        if (!response) await this.execAndParse(query);
        const rowId = this.extractCompositePK({
          rowId: insertObj[ag.column_name],
          insertObj,
          ag,
          ai,
        });

        response = await ((await canUseOptimisedQuery(this.context, {
          source,
          disableOptimization,
        }))
          ? getSingleQueryReadFn(source)(this.context, {
              model: this.model,
              id: rowId,
              params: {},
              view: null,
              source,
              getHiddenColumn: true,
              ignoreRls: true,
            })
          : this.readByPk(
              rowId,
              false,
              {},
              { ignoreView: true, getHiddenColumn: true, ignoreRls: true },
            ));
      } else if (
        !response ||
        (typeof response?.[0] !== 'object' && response?.[0] !== null)
      ) {
        let id;
        if (response?.length) {
          id = response[0];
        } else {
          const res = await this.execAndParse(query, null, {
            raw: true,
            first: true,
          });
          id = res?.id ?? res?.insertId ?? res;
        }

        if (ai) {
          if (this.isSqlite || this.isDatabricks) {
            // sqlite doesnt return id after insert
            id = (
              await this.execAndParse(
                this.dbDriver(this.tnPath)
                  .select(ai.column_name)
                  .max(ai.column_name, { as: 'id' }),
                null,
                { first: true },
              )
            ).id;
          } else if (this.isSnowflake) {
            id = (
              await this.execAndParse(
                this.dbDriver(this.tnPath).max(ai.column_name, {
                  as: 'id',
                }),
                null,
                { first: true },
              )
            ).id;
          }
          response = await this.readByPk(
            this.extractCompositePK({ rowId: id, insertObj, ai, ag }),
            false,
            {},
            { ignoreView: true, getHiddenColumn: true, ignoreRls: true },
          );
        } else {
          response = data;
        }
      } else if (ai) {
        const id = Array.isArray(response)
          ? response?.[0]?.[ai.id]
          : response?.[ai.id];

        const rowId = this.extractCompositePK({ rowId: id, insertObj, ai, ag });

        response = (await canUseOptimisedQuery(this.context, {
          source,
          disableOptimization,
        }))
          ? await getSingleQueryReadFn(source)(this.context, {
              model: this.model,
              id: rowId,
              view: null,
              params: {},
              source,
              getHiddenColumn: true,
              ignoreRls: true,
            })
          : await this.readByPk(
              rowId,
              false,
              {},
              { ignoreView: true, getHiddenColumn: true, ignoreRls: true },
            );
      }

      // Check if the inserted row is visible under the user's RLS policy
      const rlsConditions = await this.getRlsConditions();
      if (rlsConditions.length && response) {
        const row = Array.isArray(response) ? response[0] : response;
        if (row) {
          const isVisible = await this.exist(this.extractPksValues(row, true));
          if (!isVisible) row.__nc_rls_hidden = true;
        }
      }

      await this.afterInsert({
        data: response,
        req: cookie,
        insertData: data,
      });

      await this.statsUpdate({
        count: 1,
      });

      return Array.isArray(response) ? response[0] : response;
    } catch (e: any) {
      // Handle unique constraint violations (throws if it's a unique constraint error)
      await handleUniqueConstraintError({
        error: e,
        baseModel: this,
        insertData: data,
      });
      await this.errorInsert(e, data, cookie);
      throw e;
    }
  }

  public async readRecord(param: {
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
    return (await canUseOptimisedQuery(this.context, {
      source: param.source,
      disableOptimization: param.disableOptimization,
    }))
      ? await getSingleQueryReadFn(param.source)(this.context, {
          model: this.model,
          id:
            // todo: update read method to accept both string and object
            typeof param.idOrRecord === 'object'
              ? this.model.primaryKeys
                  .map((c) => {
                    const idVal =
                      param.idOrRecord?.[c.title] ??
                      param.idOrRecord?.[c.column_name];

                    if (this.model.primaryKeys.length > 1) {
                      return idVal?.toString?.().replaceAll('_', '\\_') ?? null;
                    }
                    return idVal;
                  })
                  .join('___')
              : param.idOrRecord,
          view: param.view,
          params: {},
          source: param.source,
          getHiddenColumn: true,
          ignoreRls: param.ignoreRls,
          skipPublicRedaction: param.skipPublicRedaction,
        })
      : super.readRecord(param);
  }

  async updateByPk(
    id,
    data,
    trx?,
    cookie?,
    disableOptimization = false,
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

      const source = await this.getSource();
      const prevData = (await canUseOptimisedQuery(this.context, {
        source,
        disableOptimization,
      }))
        ? await getSingleQueryReadFn(source)(this.context, {
            model: this.model,
            id,
            view: null,
            params: {},
            source,
            getHiddenColumn: true,
          })
        : await this.readByPk(
            id,
            false,
            {},
            { ignoreView: true, getHiddenColumn: true },
          );

      if (!prevData) {
        NcError.get(this.context).recordNotFound(id);
      }

      if (isTraceActive()) {
        captureForTrace('recordPrev', [
          pickChangedFieldsForUpdatePrev(
            prevData,
            data ?? {},
            columns,
            this.model.primaryKeys,
          ),
        ]);
        const fkDisplaced = await this.collectFkUpdateDisplacement(
          prevData,
          data ?? {},
        );
        if (fkDisplaced.length) {
          captureForTrace('displacedRecords', fkDisplaced);
        }
      }

      await this.prepareNocoData(updateObj, false, cookie, prevData);

      const wherePkClause = await this._wherePk(id, true);

      // mssql rejects UPDATEs that touch an IDENTITY column (error 8102:
      // "Cannot update identity column 'X'") even when the new value
      // equals the old.
      const updateObjForDriver = this.isMssql
        ? Object.fromEntries(
            Object.entries(updateObj).filter(([k]) => !(k in wherePkClause)),
          )
        : updateObj;

      const query = this.dbDriver(this.tnPath)
        .update(updateObjForDriver)
        .where(wherePkClause);

      const rlsConditions = await this.getRlsConditions();
      if (rlsConditions.length) {
        await conditionV2(
          this,
          [new Filter({ children: rlsConditions, is_group: true })],
          query,
          undefined,
          true,
        );
      }

      try {
        await this.execAndParse(query, null, { raw: true });
      } catch (e: any) {
        // Handle unique constraint violations (throws if it's a unique constraint error)
        await handleUniqueConstraintError({
          error: e,
          baseModel: this,
          insertData: updateObj,
        });
        // If not a unique constraint error, re-throw the original error
        throw e;
      }

      const newId = this.extractPksValues({ ...prevData, ...updateObj }, true);

      const newData = (await canUseOptimisedQuery(this.context, {
        source,
        disableOptimization,
      }))
        ? await getSingleQueryReadFn(source)(this.context, {
            model: this.model,
            id: newId,
            view: null,
            params: {},
            source,
            getHiddenColumn: true,
            ignoreRls: true,
          })
        : await this.readByPk(
            newId,
            false,
            {},
            { ignoreView: true, getHiddenColumn: true, ignoreRls: true },
          );

      // Check if the updated row is still visible under the user's RLS policy
      const rlsConditionsForVisibility = await this.getRlsConditions();
      if (rlsConditionsForVisibility.length && newData) {
        const isVisible = await this.exist(
          this.extractPksValues(newData, true),
        );
        if (!isVisible) newData.__nc_rls_hidden = true;
      }

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
    } catch (e: any) {
      // Handle unique constraint violations (throws if it's a unique constraint error)
      await handleUniqueConstraintError({
        error: e,
        baseModel: this,
        insertData: data,
      });
      await this.errorUpdate(e, data, cookie);
      throw e;
    }
  }

  public async getHighestOrderInTable(): Promise<BigNumber> {
    const orderColumn = this.model.columns.find(
      (c) => c.uidt === UITypes.Order,
    );

    if (!orderColumn) {
      return null;
    }

    const orderQuery = this.dbDriver(this.tnPath)
      .max(`${orderColumn.column_name} as max_order`)
      .first();

    let res;

    if (this.dbDriver.isExternal) {
      res = await runExternal(
        this.sanitizeQuery(orderQuery.toQuery()),
        this.dbDriver.extDb,
      );
    } else {
      res = await orderQuery;
    }

    const order = new BigNumber(res ? res['max_order'] || 0 : 0);

    return order.plus(ORDER_STEP_INCREMENT);
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
          return highestOrder?.plus(i + 1);
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

      let result;

      if (this.dbDriver.isExternal) {
        result = await runExternal(
          this.sanitizeQuery(resultQuery.toQuery()),
          this.dbDriver.extDb,
        );
      } else {
        result = await resultQuery;
      }

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
      mssql: `UPDATE t SET ?? = s.rn FROM ?? t INNER JOIN (SELECT ${this.model.primaryKeys
        .map((_pk) => `??`)
        .join(
          ', ',
        )}, ROW_NUMBER() OVER (ORDER BY ?? ASC) rn FROM ??) s ON ${this.model.primaryKeys
        .map((_pk) => `t.?? = s.??`)
        .join(' AND ')}`,
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
      mssql: [
        orderColumn.column_name, // SET ??
        this.tnPath, // FROM ?? t
        ...primaryKeys, // SELECT (?? per pk)
        orderColumn.column_name, // ORDER BY ?? (inside subquery)
        this.tnPath, // FROM ?? (inside subquery)
        ...primaryKeys.flatMap((pk) => [pk, pk]), // ON t.?? = s.?? per pk
      ],
    };

    const executeQuery = async (query, parameters = []) => {
      let response;
      const formattedQuery = this.dbDriver.raw(query, parameters).toQuery();

      if (this.dbDriver.isExternal) {
        response = await runExternal(
          this.sanitizeQuery(formattedQuery),
          this.dbDriver.extDb,
        );
      } else {
        response = await this.execAndGetRows(formattedQuery);
      }
      return response;
    };

    if (client === 'mysql2') {
      const version = await executeQuery('SELECT VERSION()');
      const isMySql8Plus = parseFloat(version[0]?.[0]?.['VERSION()']) >= 8.0;

      if (isMySql8Plus) {
        await executeQuery(sql[client].modern, params[client]);
      } else {
        await executeQuery(sql[client].legacy.init);
        await executeQuery(sql[client].legacy.update, params[client]);
      }
    } else {
      await executeQuery(sql[client], params[client]);
    }
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

    const query = this.dbDriver(this.tnPath)
      .update({
        [columns.find((c) => c.uidt === UITypes.Order).column_name]:
          newRecordOrder.toString(),
      })
      .where(await this._wherePk(rowId, true))
      .toQuery();

    let response;

    if (this.dbDriver.isExternal) {
      response = await runExternal(
        this.sanitizeQuery(query),
        this.dbDriver.extDb,
      );
    } else {
      response = await this.dbDriver.raw(query);
    }

    NocoSocket.broadcastDataEvent(
      this.context,
      {
        payload: {
          id: rowId,
          action: 'reorder',
          payload: row,
          before: beforeRowId,
        },
        tableId: this.model.id,
      },
      this.context.socket_id,
    );

    return response;
  }

  async prepareNocoData(
    data,
    isInsertData = false,
    cookie?: { user?: any; permissions?: Permission[] },
    oldData?,
    extra?: {
      ncOrder?: BigNumber;
      before?: string;
      undo?: boolean;
      raw?: boolean;
      allowSystemColumn?: boolean;
    },
  ) {
    for (const column of this.model.columns) {
      if (this.isDatabricks) {
        if (column.unique && data[column.column_name]) {
          const query = this.dbDriver(this.tnPath)
            .select(1)
            .where(column.column_name, data[column.column_name])
            .limit(1);
          const res = await this.execAndParse(query, null, { first: true });
          if (res) {
            NcError.get(this.context).badRequest(
              `Duplicate entry for '${
                data[column.column_name]
              }' in the field '${
                column.title
              }', violating the unique constraint.`,
            );
          }
        }
      }

      // Check if data value matches the resolved column default (including @me → current user)
      const isDefaultValue =
        isInsertData &&
        (column.cdf === data[column.column_name] ||
          (column.uidt === UITypes.User &&
            typeof column.cdf === 'string' &&
            column.cdf.includes(CURRENT_USER_TOKEN) &&
            cookie?.user?.id &&
            data[column.column_name] ===
              resolveCurrentUserToken(column.cdf, cookie.user.id)));

      if (
        data[column.column_name] !== undefined &&
        // if inserting data with column default value, skip permission check
        !isDefaultValue
      ) {
        await this.checkPermission({
          entity: PermissionEntity.FIELD,
          entityId: column.id,
          permission: PermissionKey.RECORD_FIELD_EDIT,
          user: cookie?.user,
          req: cookie,
        });
      }
    }

    await super.prepareNocoData(data, isInsertData, cookie, oldData, extra);

    // AI column isStale handling
    const aiColumns = this.model.columns.filter((c) => isAIPromptCol(c));

    for (const aiColumn of aiColumns) {
      if (
        !oldData ||
        !oldData[aiColumn.title] ||
        oldData[aiColumn.title]?.isStale === true
      ) {
        continue;
      }

      const oldAiData = data[aiColumn.column_name]
        ? JSON.parse(data[aiColumn.column_name])
        : oldData[aiColumn.title];

      const referencedColumnIds = aiColumn.colOptions.prompt
        ?.match(/{(.*?)}/g)
        ?.map((id) => id.replace(/{|}/g, ''));

      if (!referencedColumnIds) continue;

      const referencedColumns = referencedColumnIds.map(
        (id) => this.model.columnsById[id],
      );

      if (referencedColumns.some((c) => c.column_name in data)) {
        data[aiColumn.column_name] = JSON.stringify({
          ...oldAiData,
          isStale: true,
        });
      }
    }

    // Date dependency field sync
    await this.applyDateDependencySync(data, oldData);
  }

  protected async applyDateDependencySync(
    data: Record<string, any>,
    oldData: Record<string, any> | null,
  ): Promise<void> {
    // Many rules per table now — table-level default + per-Gantt-view rules.
    // Iterate all active rules and apply each one's field-sync. Rules that
    // touch disjoint field sets run independently; rules that overlap
    // converge to last-write-wins (predictable, no conflict resolution
    // needed at this layer).
    //
    // View-scoped rules (fk_gantt_view_id set) only apply when the
    // originating update came from THAT Gantt view — editing the same row
    // from a grid / form / other view doesn't carry that view's dep
    // configuration (e.g. its Duration↔Start↔End sync). Table-level rules
    // (fk_gantt_view_id IS NULL) remain the default and apply from any view.
    const rules = await DateDependency.listByModelId(
      this.context,
      this.model.id,
    );
    for (const rule of rules) {
      if (!rule?.is_active) continue;
      if (rule.fk_gantt_view_id && rule.fk_gantt_view_id !== this.viewId)
        continue;
      applyDateDependencyFieldSync(data, oldData, rule, this.model.columns);
    }
  }

  /**
   * Propagates date changes to successor rows using a recursive PostgreSQL CTE.
   * The CTE computes which rows need updating and their new dates (SELECT only).
   * Results are streamed in batches of 500 and bulk-updated so that updated_at,
   * updated_by, hooks, broadcasts, and audit all go through the standard path.
   *
   * Many rules per table: iterate all active rules (table-level default +
   * each Gantt-view-owned rule) and propagate each. The reentrancy guard is
   * set once at the outer level so a propagation triggered by rule A doesn't
   * re-enter via rule B's bulkUpdate.
   */
  protected async propagateDateDependency(
    changedRowIds: string[],
    req: NcRequest,
  ): Promise<void> {
    if (!changedRowIds?.length) return;

    // Guard against infinite recursion — bulkUpdate triggers afterBulkUpdate
    // which calls propagateDateDependency again. Uses context.additionalContext
    // instead of an instance property so the flag survives across BaseModelSqlv2
    // instances (bulkUpdate creates a new instance internally).
    if (this.context.additionalContext?.isDatePropagating) return;

    // Recursive CTE: PostgreSQL, MySQL 8+, and SQL Server (T-SQL 2008+) only.
    // sqlite + databricks have no support for the cycle-detection +
    // recursive-CTE shape `buildDateDependencyPropagationSQL` generates.
    if (!this.isPg && !this.isMySQL && !this.isMssql) return;

    const rules = await DateDependency.listByModelId(
      this.context,
      this.model.id,
    );
    const activeRules = rules.filter((r) => {
      if (!r?.is_active) return false;
      if (!r.fk_dependency_linkrow_field_id) return false;
      if (r.dependency_buffer_type === 'none') return false;
      // View-scoped rules (fk_gantt_view_id set) should only cascade when
      // the originating update came from THAT Gantt view. Editing the same
      // row from a grid / form / other Gantt view must NOT trigger this
      // rule — its dep config is per-view, so its cascade is per-view too.
      // Table-level rules (fk_gantt_view_id IS NULL) remain the default
      // and fire from any view.
      if (r.fk_gantt_view_id && r.fk_gantt_view_id !== this.viewId) {
        return false;
      }
      return true;
    });
    if (!activeRules.length) return;

    if (!this.model.columns?.length) {
      await this.model.getColumns(this.context);
    }

    // Set reentrancy flag ONCE around the whole batch so per-rule bulkUpdate
    // doesn't trigger re-entry via the next rule.
    this.context.additionalContext = {
      ...this.context.additionalContext,
      isDatePropagating: true,
    };
    try {
      for (const rule of activeRules) {
        await this.propagateOneDateDependencyRule(rule, changedRowIds, req);
      }
    } finally {
      this.context.additionalContext = {
        ...this.context.additionalContext,
        isDatePropagating: false,
      };
    }
  }

  /**
   * Per-rule propagation. The body that previously lived in
   * `propagateDateDependency` for the single-rule case — extracted so the
   * outer method can loop. Reentrancy guard is set by the caller.
   */
  private async propagateOneDateDependencyRule(
    rule: DateDependency,
    changedRowIds: string[],
    req: NcRequest,
  ): Promise<void> {
    const startCol = this.model.columns.find(
      (c) => c.id === rule.fk_start_date_field_id,
    );
    const endCol = this.model.columns.find(
      (c) => c.id === rule.fk_end_date_field_id,
    );
    if (!startCol || !endCol) return;

    const linkCol = this.model.columns.find(
      (c) => c.id === rule.fk_dependency_linkrow_field_id,
    );
    if (!linkCol) return;

    const colOptions = await linkCol.getColOptions<LinkToAnotherRecordColumn>(
      this.context,
    );
    if (!colOptions || !['hm', 'om', 'oo'].includes(colOptions.type)) return;

    const isV2 = colOptions.version === 2;

    // V1: direct FK in the main table (childCol=FK, parentCol=PK)
    // V2: junction table (mmChildCol→child PK, mmParentCol→parent PK)
    let pkColName: string;
    let fkColName: string;
    let junctionInfo:
      | { tn: string; parentColName: string; childColName: string }
      | undefined;

    if (isV2) {
      // V2 junction-based link
      const mmModel = await colOptions.getMMModel(this.context);
      const mmChildCol = await colOptions.getMMChildColumn(this.context);
      const mmParentCol = await colOptions.getMMParentColumn(this.context);
      if (!mmModel || !mmChildCol || !mmParentCol) return;

      // For V2 self-ref, the main table PK is used on both sides
      const parentCol = await colOptions.getParentColumn(this.context);
      if (!parentCol) return;
      pkColName = parentCol.column_name;
      fkColName = ''; // not used for V2 — junction replaces it
      // In the junction table for V2 self-ref OM links, the column naming is
      // inverted: mmParentCol stores the child/successor ID, mmChildCol stores
      // the parent/predecessor ID. Swap them so the CTE joins correctly.
      junctionInfo = {
        tn: this.getTnPath(mmModel),
        parentColName: mmChildCol.column_name,
        childColName: mmParentCol.column_name,
      };
    } else {
      // V1 direct FK link
      const childCol = await colOptions.getChildColumn(this.context);
      const parentCol = await colOptions.getParentColumn(this.context);
      if (!childCol || !parentCol) return;
      pkColName = parentCol.column_name;
      fkColName = childCol.column_name;
    }

    const primaryKeys = this.model.primaryKeys;
    if (!primaryKeys?.length) return;

    // For composite PKs, find the index of the parent (link) column within the PKs
    // and identify extra PK columns that need to be carried through the CTE
    const parentPkIndex = primaryKeys.findIndex(
      (pk) => pk.column_name === pkColName,
    );
    if (parentPkIndex === -1) return;

    const extraPkCols = primaryKeys.filter(
      (pk) => pk.column_name !== pkColName,
    );

    // Extract the parent column value from composite PK strings
    // Single PK: changedRowIds are the values directly
    // Composite PK: changedRowIds are "val1___val2" — extract the parentCol's value
    let seedIds: string[];
    if (primaryKeys.length === 1) {
      seedIds = changedRowIds;
    } else {
      seedIds = changedRowIds
        .map((compositeId) => {
          const parts = splitCompositePkString(compositeId);
          // Guard: if the composite ID has fewer parts than expected, skip it
          if (parentPkIndex >= parts.length) return undefined;
          return parts[parentPkIndex];
        })
        .filter((id): id is string => id !== undefined);
    }
    // After filtering, all invalid IDs are removed — if none remain, bail out
    if (!seedIds.length) return;

    const commonParams = {
      tn: this.getTnPath(this.model),
      pkColName,
      extraPkColNames: extraPkCols.map((c) => c.column_name),
      fkColName,
      startColName: startCol.column_name,
      endColName: endCol.column_name,
      connectionType:
        (rule.dependency_connection_type as
          | 'end-to-start'
          | 'end-to-end'
          | 'start-to-start'
          | 'start-to-end') ?? 'end-to-start',
      bufferType:
        (rule.dependency_buffer_type as 'flexible' | 'fixed') ?? 'flexible',
      bufferDays: rule.dependency_buffer_days ?? 0,
      seedIds,
      dialect: (this.isPg ? 'pg' : this.isMssql ? 'mssql' : 'mysql') as
        | 'pg'
        | 'mysql'
        | 'mssql',
      includeWeekends: rule.include_weekends ?? true,
      junction: junctionInfo,
    };

    // Build both backward (push predecessors earlier) and forward (push successors later) CTEs
    const backwardResult = buildDateDependencyPropagationSQL({
      ...commonParams,
      direction: 'backward',
    });
    const forwardResult = buildDateDependencyPropagationSQL({
      ...commonParams,
      direction: 'forward',
    });

    const BATCH_SIZE = 500;

    const toUpdateRow = (row: any) => {
      const updateObj: Record<string, any> = {
        [primaryKeys[parentPkIndex].title]: row.id,
        [startCol.title]: row.new_start,
        [endCol.title]: row.new_end,
      };
      // Map extra PK columns from CTE output (id_1, id_2, ...)
      extraPkCols.forEach((pk, i) => {
        updateObj[pk.title] = row[`id_${i + 1}`];
      });
      return updateObj;
    };

    // Clear socket_id so the sender also receives realtime updates
    // for cascaded rows (they didn't directly edit these rows).
    // Reentrancy flag is set by the outer caller (propagateDateDependency).
    const savedSocketId = this.context.socket_id;
    this.context.socket_id = undefined;

    try {
      const isExternal = this.dbDriver.isExternal;

      // Run backward propagation first (push predecessors earlier),
      // then forward propagation (push successors later)
      for (const { sql, bindings } of [backwardResult, forwardResult]) {
        if (isExternal) {
          // External sources: stream rows via NDJSON endpoint, batch updates
          const rawSql = this.dbDriver.raw(sql, bindings).toQuery();
          const rowStream = runExternalStream(
            this.sanitizeQuery(rawSql),
            this.dbDriver.extDb,
          );
          let batch: Record<string, any>[] = [];

          for await (const row of rowStream) {
            batch.push(toUpdateRow(row));

            if (batch.length >= BATCH_SIZE) {
              await this.bulkUpdate(batch, { cookie: req });
              batch = [];
            }
          }

          if (batch.length) {
            await this.bulkUpdate(batch, { cookie: req });
          }
        } else {
          // Internal sources: stream in batches to avoid loading all into memory
          const stream = this.dbDriver.raw(sql, bindings).stream();
          let batch: Record<string, any>[] = [];

          for await (const row of stream) {
            batch.push(toUpdateRow(row));

            if (batch.length >= BATCH_SIZE) {
              await this.bulkUpdate(batch, { cookie: req });
              batch = [];
            }
          }

          if (batch.length) {
            await this.bulkUpdate(batch, { cookie: req });
          }
        }
      }
    } catch (err: any) {
      this.logger.error('Date dependency propagation failed', err.stack);
    } finally {
      this.context.socket_id = savedSocketId;
    }
  }

  public async beforeInsert(
    data: Record<string, any>,
    req: NcRequest,
    params?: {
      allowSystemColumn?: boolean;
    },
  ): Promise<void> {
    const { allowSystemColumn = false } = params || {};

    if (isCloud) {
      const workspaceStats = await ModelStat.getWorkspaceSum(
        this.model.fk_workspace_id,
      );

      let workspaceRowCount = workspaceStats ? workspaceStats.row_count : null;

      // initial case
      if (workspaceRowCount === null) {
        Noco.eventEmitter.emit(UPDATE_WORKSPACE_STAT, {
          context: this.context,
          fk_workspace_id: this.model.fk_workspace_id,
          force: true,
        });

        workspaceRowCount = 0;
      }

      await checkLimit({
        workspaceId: this.model.fk_workspace_id,
        type: PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE,
        count: workspaceRowCount,
        message: ({ limit }) =>
          `Only ${limit} records are allowed in your workspace, for more please upgrade your plan`,
      });
    }

    if (!allowSystemColumn && this.model.synced) {
      NcError.get(this.context).prohibitedSyncTableOperation({
        modelName: this.model.title,
        operation: 'insert',
      });
    }

    await this.checkPermission({
      entity: PermissionEntity.TABLE,
      entityId: this.model.id,
      permission: PermissionKey.TABLE_RECORD_ADD,
      user: req?.user,
      req,
    });

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

    if (isCloud) {
      const workspaceStats = await ModelStat.getWorkspaceSum(
        this.model.fk_workspace_id,
      );

      let workspaceRowCount = workspaceStats ? workspaceStats.row_count : null;

      // initial case
      if (workspaceRowCount === null) {
        Noco.eventEmitter.emit(UPDATE_WORKSPACE_STAT, {
          context: this.context,
          fk_workspace_id: this.model.fk_workspace_id,
          force: true,
        });

        workspaceRowCount = 0;
      }

      await checkLimit({
        workspaceId: this.model.fk_workspace_id,
        type: PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE,
        count: workspaceRowCount,
        message: ({ limit }) =>
          `Only ${limit} records are allowed in your workspace, for more please upgrade your plan`,
      });
    }

    if (!allowSystemColumn && this.model.synced) {
      NcError.get(this.context).prohibitedSyncTableOperation({
        modelName: this.model.title,
        operation: 'insert',
      });
    }

    await this.checkPermission({
      entity: PermissionEntity.TABLE,
      entityId: this.model.id,
      permission: PermissionKey.TABLE_RECORD_ADD,
      user: req?.user,
      req,
    });

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

    // Strip __nc_rls_hidden from broadcast — other clients have different
    // RLS policies and the flag would be incorrect for them
    const { __nc_rls_hidden: _, ...broadcastPayload } = data || {};

    NocoSocket.broadcastDataEvent(
      this.context,
      {
        payload: {
          id,
          action: 'add',
          payload: broadcastPayload,
          before: req?.query?.before,
        },
        tableId: this.model.id,
      },
      this.context.socket_id,
    );

    const filteredAuditData = removeBlankPropsAndMask(insertData || data, [
      'CreatedAt',
      'UpdatedAt',
      // exclude virtual columns
      ...this.model.columns
        .filter((c) => isVirtualCol(c) || isSystemColumn(c))
        .map((c) => c.title),
    ]);
    if (await this.isDataAuditEnabled())
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

    await this.handleRichTextMentions(null, data, req);

    const insertedId = String(this.extractPksValues(data));
    await this.propagateDateDependency([insertedId], req);
  }

  public async afterBulkInsert(
    data: Record<string, any>[],
    req: NcRequest,
  ): Promise<void> {
    await this.handleHooks('after.bulkInsert', null, data, req);

    NocoSocket.broadcastBulkDataEvent(
      this.context,
      {
        tableId: this.model.id,
        rows: data.map((d) => {
          const { __nc_rls_hidden: _, ...payload } = d || {};
          return {
            id: this.extractPksValues(d, true),
            action: 'add' as const,
            payload,
          };
        }),
      },
      this.context.socket_id,
    );

    if (await this.isDataAuditEnabled()) {
      let parentAuditId;
      if (!req.ncParentAuditId) {
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

    // Propagate date changes to successors
    const insertedIds = data.map((d) => String(this.extractPksValues(d)));
    await this.propagateDateDependency(insertedIds, req);
  }

  public async afterDelete(
    data: Record<string, any>,
    req: NcRequest,
    eventType: AuditV1OperationTypes = AuditV1OperationTypes.DATA_DELETE,
  ): Promise<void> {
    const id = this.extractPksValues(data);

    NocoSocket.broadcastDataEvent(
      this.context,
      {
        payload: {
          id,
          action: 'delete',
          payload: null,
        },
        tableId: this.model.id,
      },
      this.context.socket_id,
    );

    if (await this.isDataAuditEnabled()) {
      await Audit.insert(
        await generateAuditV1Payload<DataDeletePayload>(eventType, {
          details: {
            data: formatDataForAudit(
              removeBlankPropsAndMask(data, ['CreatedAt', 'UpdatedAt']),
              this.model.columns,
            ),
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

    if (data?.length > 0) {
      NocoSocket.broadcastBulkDataEvent(
        this.context,
        {
          tableId: this.model.id,
          rows: data.map((d) => ({
            id: this.extractPksValues(d, true),
            action: 'delete' as const,
            payload: null,
          })),
        },
        this.context.socket_id,
      );
    }

    if (await this.isDataAuditEnabled()) {
      // bulkAll chunks rows into 100-row batches and calls afterBulkDelete
      // per chunk. The first chunk creates the parent audit; later chunks
      // reuse req.ncParentAuditId so the whole operation appears as one
      // event in the trash UI instead of N (one per 100-row chunk).
      const reuseParent = isBulkAllOperation && !!req.ncParentAuditId;
      const parentAuditId = reuseParent
        ? req.ncParentAuditId
        : await Noco.ncAudit.genNanoid(MetaTable.AUDIT);

      if (!reuseParent) {
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
    if (data?.length > 0) {
      const pks = data.map((d) => this.extractPksValues(d, true));
      const rows = await this.chunkList({ pks, extractOrderColumn: true });
      if (rows?.length) {
        NocoSocket.broadcastBulkDataEvent(
          this.context,
          {
            tableId: this.model.id,
            rows: rows.map((row) => ({
              id: this.extractPksValues(row, true),
              action: 'add' as const,
              payload: row,
            })),
          },
          this.context.socket_id,
        );
      }
    }

    await super.afterBulkRestore(data, req, isBulkAllOperation);
  }

  async delByPk(id, _trx?, cookie?) {
    const queries: string[] = [];
    try {
      // retrieve data for handling params in hook
      const data = await this.readByPk(
        id,
        false,
        {},
        { ignoreView: true, getHiddenColumn: true },
      );

      if (!data) {
        NcError.get(this.context).recordNotFound(id);
      }

      if (isTraceActive()) {
        captureForTrace('recordPrev', [data]);
      }

      await this.beforeDelete(id, cookie);

      // Detect soft-delete column for meta sources
      const deletedColumn = this.model.columns.find((c) => isDeletedCol(c));
      const source = await this.getSource();
      const isSoftDelete =
        !!deletedColumn &&
        source.isMeta() &&
        (await this.model.isTrashEnabledForWorkspace(this.context));

      if (isSoftDelete) {
        const operationNow = this.now();
        const where = await this._wherePk(id);
        const softDeletePayload: Record<string, any> = {
          [deletedColumn.column_name]: deletedColValue(this, true),
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

        const updateQb = this.dbDriver(this.tnPath)
          .update(softDeletePayload)
          .where(where);

        const rlsConditions = await this.getRlsConditions();
        if (rlsConditions.length) {
          await conditionV2(
            this,
            [new Filter({ children: rlsConditions, is_group: true })],
            updateQb,
          );
        }

        if ((this.dbDriver as any).isExternal) {
          await runExternal(
            this.sanitizeQuery(updateQb.toQuery()),
            (this.dbDriver as any).extDb,
          );
        } else {
          await this.execAndParse(updateQb, null, { raw: true });
        }

        if (isTraceActive()) {
          const softDisplaced = await this.collectLinkedRecordsSnapshot([id]);
          if (softDisplaced.length) {
            captureForTrace('displacedRecords', softDisplaced);
          }
        }

        await this.afterSoftDeleteCompleted({ cookie, operationNow });

        await this.afterDelete(
          data,
          cookie,
          AuditV1OperationTypes.DATA_SOFT_DELETE,
        );

        await this.softDeleteFileReferences({
          oldData: [data],
          columns: this.model.columns,
        });

        // Update LMT + broadcast on linked records
        await this.updateLinkedRecordsOnDelete([id], cookie);

        await this.statsUpdate({ count: -1 });

        return 1;
      }

      const execQueries: ((trx: CustomKnex) => Knex.QueryBuilder)[] = [];

      // Collect linked record IDs BEFORE the transaction nulls FKs / deletes junction rows
      const linkedRecordNotifications: {
        baseModel: any;
        model: any;
        ids: string[];
        colId: string;
      }[] = [];

      const displacedLinks: DisplacedRecord[] = [];

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
              const mmParentCol = await Column.get(mmContext, {
                colId: colOptions.fk_mm_parent_column_id,
              });
              const parentTable = await (
                await colOptions.getParentColumn(parentContext)
              ).getModel(parentContext);
              await parentTable.getColumns(parentContext);
              const parentBaseModel = await Model.getBaseModelSQL(
                parentContext,
                {
                  model: parentTable,
                  dbDriver: this.dbDriver,
                },
              );
              const inverseLinkCol = await extractCorrespondingLinkColumn(
                this.context,
                {
                  ltarColumn: column,
                  referencedTable: parentTable,
                  referencedTableColumns: parentTable.columns,
                },
              );

              // Collect linked parent IDs via junction BEFORE deletion
              const mmLinkedRows = await this.execAndParse(
                this.dbDriver(mmBaseModel.getTnPath(mmTable.table_name))
                  .select(mmParentCol.column_name, mmChildCol.column_name)
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

              for (const r of mmLinkedRows as Array<Record<string, any>>) {
                displacedLinks.push({
                  kind: 'junction',
                  mmModelId: mmTable.id,
                  baseId: mmTable.base_id,
                  colId: column.id,
                  parentMMCol: mmParentCol.column_name,
                  childMMCol: mmChildCol.column_name,
                  parentValue: r[mmParentCol.column_name],
                  childValue: r[mmChildCol.column_name],
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
              if (relatedTable.mm) break;

              const refBaseModel = await Model.getBaseModelSQL(refContext, {
                model: relatedTable,
                dbDriver: this.dbDriver,
                queryQueue: this._queryQueue,
              });
              const childColumn = await Column.get(refContext, {
                colId: colOptions.fk_child_column_id,
              });

              await relatedTable.getColumns(refContext);

              // Collect linked child IDs BEFORE FK nulling so we can broadcast
              // LMT updates and record displacement for undo. PG-imported
              // junction tables (and any other PK-less tables) can't be
              // addressed by row id, so we skip the broadcast/displacement
              // collection but still queue the FK-nulling exec query below.
              if (relatedTable.primaryKey) {
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

                for (const childPk of hmLinkedIds) {
                  displacedLinks.push({
                    kind: 'column',
                    modelId: relatedTable.id,
                    baseId: relatedTable.base_id,
                    pk: String(childPk),
                    column: childColumn.column_name,
                    prev: id,
                    forward: 'null',
                  });
                }
              }

              execQueries.push((trx) =>
                trx(refBaseModel.getTnPath(relatedTable.table_name))
                  .update({ [childColumn.column_name]: null })
                  .where(childColumn.column_name, id),
              );
            }
            break;
          case 'oo':
            {
              if (column.meta?.bt) {
                // BT-side: collect parent IDs from deleted record's FK
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
                  {
                    model: btParentTable,
                    dbDriver: this.dbDriver,
                  },
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
              // HM-side
              const ooRelatedTable = await colOptions.getRelatedTable(
                refContext,
              );
              if (ooRelatedTable.mm) break;

              const ooRefBaseModel = await Model.getBaseModelSQL(refContext, {
                model: ooRelatedTable,
                dbDriver: this.dbDriver,
                queryQueue: this._queryQueue,
              });
              const ooChildColumn = await Column.get(refContext, {
                colId: colOptions.fk_child_column_id,
              });

              await ooRelatedTable.getColumns(refContext);

              // Skip the broadcast / displacement collection when the related
              // table has no PK (PG-imported junction tables, etc.); the
              // FK-nulling exec query below still runs so the delete remains
              // correct.
              if (ooRelatedTable.primaryKey) {
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

                for (const childPk of ooLinkedIds) {
                  displacedLinks.push({
                    kind: 'column',
                    modelId: ooRelatedTable.id,
                    baseId: ooRelatedTable.base_id,
                    pk: String(childPk),
                    column: ooChildColumn.column_name,
                    prev: id,
                    forward: 'null',
                  });
                }
              }

              execQueries.push((trx) =>
                trx(ooRefBaseModel.getTnPath(ooRelatedTable.table_name))
                  .update({ [ooChildColumn.column_name]: null })
                  .where(ooChildColumn.column_name, id),
              );
            }
            break;
          case 'bt':
            {
              // Collect parent IDs from deleted record's FK
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
                {
                  model: btParentTable,
                  dbDriver: this.dbDriver,
                },
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
            }
            break;
        }
      }

      if (displacedLinks.length) {
        captureForTrace('displacedRecords', displacedLinks);
      }

      const where = await this._wherePk(id);

      for (const q of execQueries) {
        queries.push(q(this.dbDriver).toQuery());
      }

      const delQb = this.dbDriver(this.tnPath).del().where(where);

      const rlsConditions = await this.getRlsConditions();
      if (rlsConditions.length) {
        await conditionV2(
          this,
          [new Filter({ children: rlsConditions, is_group: true })],
          delQb,
          undefined,
          true,
        );
      }

      queries.push(delQb.toQuery());

      let responses;

      if (this.dbDriver.isExternal) {
        responses = await runExternal(
          this.sanitizeQuery(queries),
          this.dbDriver.extDb,
        );
        responses = Array.isArray(responses) ? responses : [responses];
      } else {
        const trx = await this.dbDriver.transaction();

        try {
          responses = [];
          for (const q of queries) {
            responses.push(await trx.raw(this.sanitizeQuery(q)));
          }
          await trx.commit();
        } catch (e) {
          await trx.rollback();
          throw e;
        }
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
          this.logger.error(e?.message, e?.stack);
        }
      }

      await this.afterDelete(data, cookie);

      await this.statsUpdate({
        count: -1,
      });

      return responses.pop()?.rowCount;
    } catch (e) {
      await this.errorDelete(e, id, cookie);
      throw e;
    }
  }

  async bulkInsert(
    datas: any[],
    {
      chunkSize: _chunkSize = 100,
      cookie,
      foreign_key_checks = true,
      skip_hooks = false,
      raw = false,
      insertOneByOneAsFallback = false,
      isSingleRecordInsertion = false,
      typecast = false,
      allowSystemColumn = false,
      undo = false,
      apiVersion = NcApiVersion.V2,
      onInsertedPks,
    }: {
      chunkSize?: number;
      cookie?: any;
      foreign_key_checks?: boolean;
      skip_hooks?: boolean;
      raw?: boolean;
      insertOneByOneAsFallback?: boolean;
      isSingleRecordInsertion?: boolean;
      typecast?: boolean;
      allowSystemColumn?: boolean;
      apiVersion?: NcApiVersion;
      undo?: boolean;
      /** See CE `BaseModelSqlv2/insert.ts` — inserted pks in insertion order. */
      onInsertedPks?: (pks: (string | number)[]) => void;
    } = {},
  ) {
    const capturePks = typeof onInsertedPks === 'function';
    const queries: string[] = [];
    const profiler = Profiler.start('base-model/bulkInsert');
    try {
      // TODO: ag column handling for raw bulk insert
      const insertDatas = raw ? datas : [];
      const postInsertOpsMap: Record<
        number,
        ((rowId: any, trx?: Knex | Knex.Transaction) => Promise<string>)[]
      > = {};
      let preInsertOps: ((trx?: Knex | Knex.Transaction) => Promise<string>)[] =
        [];
      let aiPkCol: Column;
      let agPkCol: Column;

      if (!raw) {
        const columns = await this.model.getColumns(this.context);
        const nestedCols = columns.filter((c) => isLinksOrLTAR(c));
        const attachmentCols = columns.filter((c) => isAttachment(c));

        await this.model.getColumns(this.context);

        const order = await this.getHighestOrderInTable();
        profiler.log('getHighestOrderInTable done');
        for (const [index, d] of datas.entries()) {
          const insertObj = {};

          // populate pk, map alias to column, validate data
          for (let i = 0; i < this.model.columns.length; ++i) {
            const col = this.model.columns[i];

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
                if (col.uidt === UITypes.Order && undo) {
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

              if (val !== undefined) {
                if (
                  col.uidt === UITypes.Attachment &&
                  typeof val !== 'string'
                ) {
                  val = JSON.stringify(val);
                }
                if (
                  this.context.api_version !== NcApiVersion.V3 &&
                  col.uidt === UITypes.DateTime &&
                  dayjs(val).isValid()
                ) {
                  const { isMySQL, isSqlite, isPg, isMssql } = this.clientMeta;
                  if (
                    val.indexOf('-') < 0 &&
                    val.indexOf('+') < 0 &&
                    val.slice(-1) !== 'Z'
                  ) {
                    // if no timezone is given,
                    // then append +00:00 to make it as UTC
                    val += '+00:00';
                  }
                  if (isMssql) {
                    // T-SQL `datetime` / `datetime2` types reject a
                    // `+00:00` offset suffix. NocoDB stores UTC wall-clock
                    // without TZ on mssql — strip the offset after
                    // computing the UTC instant (mirrors
                    // `DateTimeMssqlHandler.parseUserInput`).
                    val = dayjs(val).utc().format('YYYY-MM-DD HH:mm:ss');
                  } else if (isMySQL) {
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
                    val = this.dbDriver.raw(
                      `CONVERT_TZ(?, '+00:00', @@GLOBAL.time_zone)`,
                      [dayjs(val).utc().format('YYYY-MM-DD HH:mm:ss')],
                    );
                  } else if (isSqlite) {
                    // convert to UTC
                    // e.g. 2022-01-01T10:00:00.000Z -> 2022-01-01 04:30:00+00:00
                    val = dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ');
                  } else if (isPg) {
                    // convert to UTC
                    // e.g. 2023-01-01T12:00:00.000Z -> 2023-01-01 12:00:00+00:00
                    // then convert to db timezone
                    val = this.dbDriver.raw(
                      `? AT TIME ZONE CURRENT_SETTING('timezone')`,
                      [dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ')],
                    );
                  } else {
                    // e.g. 2023-01-01T12:00:00.000Z -> 2023-01-01 12:00:00+00:00
                    val = dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ');
                  }
                }
                if (
                  this.context.api_version !== NcApiVersion.V3 &&
                  this.isPg &&
                  col.uidt === UITypes.Checkbox
                ) {
                  val = val ? true : false;
                }

                if (
                  this.context.api_version !== NcApiVersion.V3 &&
                  col.uidt === UITypes.Duration
                ) {
                  if (col.meta?.duration !== undefined) {
                    const duration = convertDurationToSeconds(
                      val,
                      col.meta.duration,
                    );
                    if (duration._isValid) {
                      val = duration._sec;
                    }
                  }
                }
                insertObj[sanitize(col.column_name)] = val;
              }
            }
            try {
              await this.validateOptions(col, insertObj);
            } catch (ex) {
              if (ex instanceof OptionsNotExistsError && typecast) {
                await Column.update(this.context, col.id, {
                  ...col,
                  colOptions: {
                    options: [
                      ...col.colOptions.options,
                      ...ex.options.map((k, index) => ({
                        fk_column_id: col.id,
                        title: k,
                        color: enumColors.get(
                          'light',
                          (col.colOptions.options ?? []).length + index,
                        ),
                      })),
                    ],
                  },
                });
              } else {
                throw ex;
              }
            }

            // validate data
            if (col?.meta?.validate && col?.validate) {
              const validate = col.getValidators();
              const cn = col.column_name;
              const columnTitle = col.title;
              if (validate) {
                await validateFuncOnColumn({
                  value:
                    insertObj?.[cn] ??
                    insertObj?.[columnTitle] ??
                    insertObj?.[col.id],
                  column: col,
                  apiVersion: this.context.api_version,
                  customValidators: customValidators as any,
                });
              }
            }
          }

          await this.prepareNocoData(insertObj, true, cookie, null, {
            ncOrder: order?.plus(index),
            undo: undo,
          });

          // prepare nested link data for insert only if it is single record insertion
          if (isSingleRecordInsertion || apiVersion === NcApiVersion.V3) {
            const operations = await this.prepareNestedLinkQb({
              nestedCols,
              data: d,
              req: cookie,
              insertObj,
            });

            postInsertOpsMap[index] = operations.postInsertOps;
            preInsertOps = operations.preInsertOps;

            if (attachmentCols.length > 0) {
              const attachmentOperations =
                await new AttachmentUrlUploadPreparator().prepareAttachmentUrlUpload(
                  this,
                  {
                    attachmentCols,
                    data: insertObj,
                    req: cookie,
                  },
                );
              postInsertOpsMap[index] = [
                ...(postInsertOpsMap[index] ?? []),
                ...(attachmentOperations.postInsertOps ?? []),
              ];
              preInsertOps = [
                ...(preInsertOps ?? []),
                ...(attachmentOperations.preInsertOps ?? []),
              ];
            }
          }

          insertDatas.push(insertObj);
        }
        profiler.log('validate & prepare noco data done');

        // used for post insert operations
        aiPkCol = this.model.primaryKeys.find((pk) => pk.ai);
        agPkCol = this.model.primaryKeys.find((pk) => pk.meta?.ag);
      } else {
        await this.model.getColumns(this.context);

        const order = await this.getHighestOrderInTable();

        await Promise.all(
          insertDatas.map(
            async (d, i) =>
              await this.prepareNocoData(d, true, cookie, null, {
                raw,
                ncOrder: order?.plus(i),
                undo: undo,
              }),
          ),
        );
        profiler.log('prepare noco data done on raw');
      }

      if ('beforeBulkInsert' in this) {
        await this.beforeBulkInsert(insertDatas, cookie, {
          allowSystemColumn,
        });
      }
      profiler.log('beforeBulkInsert done');

      // Cap in-flight preInsertOps so many nested LTAR capture SELECTs
      // don't saturate the knex pool. Mutating closures here only build
      // .toQuery() strings (no connection use), so the cap mainly limits
      // the capture-SELECT side. Resolved strings flow through runOps
      // to preserve its sanitize + external-DB path.
      const preInsertResolved = await processConcurrently(
        preInsertOps,
        (f) => f(),
        5,
      );
      await this.runOps(preInsertResolved.map((s) => Promise.resolve(s)));
      profiler.log('preInsertOps done');

      // await this.beforeInsertb(insertDatas, null);

      // fallbacks to `10` if database client is sqlite
      // to avoid `too many SQL variables` error
      // refer : https://www.sqlite.org/limits.html
      const chunkSize = this.isSqlite ? 10 : _chunkSize;

      let trimLeading = 0;
      let trimTrailing = 0;

      if (!foreign_key_checks) {
        if (this.isPg) {
          queries.push(
            this.dbDriver
              .raw('set session_replication_role to replica;')
              .toQuery(),
          );
          trimLeading++;
        } else if (this.isMySQL) {
          queries.push(
            this.dbDriver.raw('SET foreign_key_checks = 0;').toQuery(),
          );
          trimLeading++;
        }
      }

      // insert one by one as fallback to get ids for sqlite and mysql.
      // also forced when the caller needs inserted pks (onInsertedPks).
      if (
        (insertOneByOneAsFallback || capturePks) &&
        (this.isSqlite || this.isMySQL)
      ) {
        // sqlite and mysql doesnt support returning, so insert one by one and return ids
        // response = [];

        // const aiPkCol = this.model.primaryKeys.find((pk) => pk.ai);

        for (const insertData of insertDatas) {
          queries.push(this.dbDriver(this.tnPath).insert(insertData).toQuery());
        }
      } else {
        // MSSQL: route through the OUTPUT-INTO-table-variable pattern in
        // mssql-insert-sql.ts when triggers or explicit IDENTITY values are
        // present (or pre-emptively, for chunk-cap safety). Standard
        // .returning() path stays for non-mssql.
        //
        const mssqlAiColName = this.isMssql
          ? this.model.columns?.find((c) => c.ai)?.column_name ?? null
          : null;
        const mssqlExplicitIdentity =
          this.isMssql && mssqlNeedsIdentityInsert(insertDatas, mssqlAiColName);
        // Per-dialect effective chunk size — mssql also enforces the
        // 2100-param cap.
        const effectiveChunkSize = this.isMssql
          ? mssqlChunkSize(insertDatas, chunkSize)
          : chunkSize;

        const batches: any[][] = [];
        for (let i = 0; i < insertDatas.length; i += effectiveChunkSize) {
          batches.push(insertDatas.slice(i, i + effectiveChunkSize));
        }

        // String-array form (`'col as alias'`), not a plain object: knex's
        // mssql dialect silently drops the plain-object form and emits a
        // bare `OUTPUT` (T-SQL syntax error). The string form compiles to
        // `RETURNING "col" AS "alias"` on pg and `OUTPUT inserted.[col] AS
        // [alias]` on mssql — same `[{ alias: value }, ...]` row shape.
        const returningSpec = this.model.primaryKeys.map(
          (col) => `${col.column_name} as ${col.title}`,
        );

        for (const batch of batches) {
          if (this.isMssql) {
            // ALWAYS go through `mssqlBuildBulkInsertWithCapture`. The
            // "fast" `.toQuery()` path inlines string values as bare
            // varchar literals (`'…'`); shipped to the SQL-executor as a
            // string and re-parsed by MSSQL, those literals get implicit-
            // converted to nvarchar through the connection's collation
            // (default SQL_Latin1_General_CP1_CI_AS = CP-1252) BEFORE
            // hitting the `nvarchar(MAX)` column, stripping anything
            // outside Latin-1 (emoji, supplementary CJK, …) to `?`. The
            // capture path emits `CAST(N'…' AS NVARCHAR(MAX))` literals
            // (see `tsqlNVarcharLiteral` in mssql-insert-sql.ts) which
            // round-trip Unicode losslessly. The trigger-/IDENTITY-aware
            // SQL shape is also a superset of the fast path, so collapsing
            // both branches changes correctness for everyone and gives up
            // a negligible amount of plan-cache reuse (each bulk INSERT
            // chunk has unique row tuples either way).
            queries.push(
              mssqlBuildBulkInsertWithCapture({
                knex: this.dbDriver,
                tnPath: this.tnPath,
                rows: batch,
                pkCols: this.model.primaryKeys ?? [],
                explicitIdentity: mssqlExplicitIdentity,
              }),
            );
          } else if (this.isPg) {
            queries.push(
              this.dbDriver(this.tnPath)
                .insert(batch)
                .returning(returningSpec.length ? returningSpec : '*')
                .toQuery(),
            );
          } else {
            queries.push(this.dbDriver(this.tnPath).insert(batch).toQuery());
          }
        }
      }

      if (!foreign_key_checks) {
        if (this.isPg) {
          queries.push(
            this.dbDriver
              .raw('set session_replication_role to origin;')
              .toQuery(),
          );
          trimTrailing++;
        } else if (this.isMySQL) {
          queries.push(
            this.dbDriver.raw('SET foreign_key_checks = 1;').toQuery(),
          );
          trimTrailing++;
        }
      }

      let responses;

      // the new local-trx insertOneByOneAsFallback path bypasses `queries`,
      // so the SET foreign_key_checks / session_replication_role statements
      // and their placeholder responses are never produced — FK toggling must
      // be applied directly on the trx, and trimLeading/trimTrailing must be
      // skipped for that path.
      const usingInsertOneByOneTrxPath =
        (insertOneByOneAsFallback || capturePks) &&
        (this.clientMeta.isSqlite || this.clientMeta.isMySQL) &&
        !this.dbDriver.isExternal;

      const postSingleRecordInsertionCbk = async (responses, trx?) => {
        // insert nested link data for single record insertion
        if (isSingleRecordInsertion || apiVersion === NcApiVersion.V3) {
          for (let i = 0; i < responses.length; i++) {
            const row = responses[i];
            let rowId;
            if (this.isSqlite || this.isMySQL) {
              if (insertOneByOneAsFallback && !this.dbDriver.isExternal) {
                // new path: row is {pk_col: id} from extractCompositePK
                rowId = row?.[this.model.primaryKey?.title];
              } else if (this.isMySQL) {
                // execAndGetRows returns { insertId: N } for MySQL INSERTs
                rowId = row?.insertId;
              }

              if (agPkCol) {
                rowId = insertDatas[i]?.[agPkCol.column_name];
              }
            } else {
              rowId = row[this.model.primaryKey?.title];
            }

            rowId = this.extractCompositePK({
              rowId,
              ai: aiPkCol,
              ag: agPkCol,
              insertObj: insertDatas[i],
            });

            await this.runOps(
              (postInsertOpsMap[i] ?? []).map((f) => f(rowId, trx)),
              trx,
            );
          }
        }
      };

      if (this.dbDriver.isExternal) {
        responses = await runExternal(
          this.sanitizeQuery(queries),
          this.dbDriver.extDb,
        );
        profiler.log('runExternal done');

        responses = Array.isArray(responses) ? responses : [responses];
        if (!raw) await postSingleRecordInsertionCbk(responses);
        profiler.log('postSingleRecordInsertionCbk done');
      } else {
        const trx = await this.dbDriver.transaction();
        try {
          responses = [];
          if (usingInsertOneByOneTrxPath) {
            // Apply FK toggle on the trx since we're not executing `queries`.
            // sqlite FK toggling is not handled (matches the existing
            // pg/mysql-only behavior upstream).
            if (!foreign_key_checks && this.isMySQL) {
              await trx.raw('SET foreign_key_checks = 0;');
            }

            for (const insertData of insertDatas) {
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

            if (!foreign_key_checks && this.isMySQL) {
              await trx.raw('SET foreign_key_checks = 1;');
            }
          } else {
            for (const q of queries) {
              const result = await this.execAndGetRows(q, trx);
              responses.push(...result);
            }
          }
          profiler.log('execAndGetRows done');

          if (!raw) await postSingleRecordInsertionCbk(responses, trx);
          profiler.log('postSingleRecordInsertionCbk done');

          await trx.commit();
        } catch (e) {
          await trx.rollback();
          throw e;
        }
      }

      // we have extra queries other than insert if foreign_key_checks is false to disable foreign key checks
      // we need to trim the leading and trailing extra queries
      // (skipped for the insertOneByOneAsFallback trx path — it issues the
      // FK toggle via trx.raw and responses contain only per-row results)
      if (trimLeading && !usingInsertOneByOneTrxPath) {
        responses = responses.slice(trimLeading);
      }
      if (trimTrailing && !usingInsertOneByOneTrxPath) {
        responses = responses.slice(0, -trimTrailing);
      }

      // External MySQL/SQLite INSERTs can't use `.returning()`, so runExternal
      // hands back raw auto-increment ids (MySQL: `{ insertId }`, SQLite: a bare
      // id) rather than pk-bearing rows. The `!raw && !skip_hooks` block below
      // would normalize these, but the import path — the only capturePks caller —
      // passes raw + skip_hooks and fires `onInsertedPks` here first. Without this
      // every captured pk resolves to `undefined` and links silently vanish, so
      // wrap them up front, mirroring the existing MySQL normalization.
      if (
        capturePks &&
        this.dbDriver.isExternal &&
        (this.isMySQL || this.isSqlite)
      ) {
        responses = responses.map((r, idx) => {
          const id = r?.insertId ?? r;
          const rowId = this.extractCompositePK({
            rowId: id,
            ai: aiPkCol,
            ag: agPkCol,
            insertObj: insertDatas[idx],
          });
          if (rowId && typeof rowId === 'object') return rowId;
          return { [this.model.primaryKey.column_name]: rowId ?? id };
        });
      }

      // Hand back inserted pks in insertion order. Internal PG uses
      // `.returning()`, the internal one-by-one path (forced above when
      // capturePks) wraps each row via extractCompositePK, and the external
      // MySQL/SQLite branch is normalized just above — so `responses` are
      // pk-bearing and ordered for every path. Mirrors CE `insert.ts`.
      if (capturePks) {
        onInsertedPks(responses.map((r) => this.extractPksValues(r, true)));
      }

      if (!raw && !skip_hooks) {
        // we will wrap returning primary key values with primary key column name
        // only needed when responses are raw auto-increment IDs (batchInsert path)
        // skip when usingInsertOneByOneTrxPath already wrapped them via extractCompositePK
        if (this.isMySQL && !usingInsertOneByOneTrxPath) {
          responses = responses.map((r, idx) => {
            const id = r?.insertId ?? r;
            const rowId = this.extractCompositePK({
              rowId: id,
              ai: aiPkCol,
              ag: agPkCol,
              insertObj: insertDatas[idx],
            });
            if (rowId && typeof rowId === 'object') return rowId;
            return { [this.model.primaryKey.column_name]: rowId ?? id };
          });
        }

        if (isSingleRecordInsertion) {
          const insertData = await this.readByPk(
            responses[0],
            false,
            {},
            { ignoreRls: true },
          );
          await this.afterInsert({
            data: insertData,
            req: cookie,
            insertData: datas?.[0],
          });
          profiler.log('single afterInsert done');
        } else {
          const insertResponses = await this.chunkList({
            pks: responses.map((d) => this.extractPksValues(d)),
            ignoreRls: true,
          });
          profiler.log('chunkList done');

          // Check which inserted rows are visible under the user's RLS policy
          const rlsConditionsForBulkInsert = await this.getRlsConditions();
          if (rlsConditionsForBulkInsert.length && insertResponses.length) {
            const insertPks = responses.map((d) => this.extractPksValues(d));
            const visibleInsertRecords = await this.chunkList({
              pks: insertPks,
            });
            const visibleInsertPks = new Set(
              visibleInsertRecords.map((r) =>
                this.extractPksValues(r, true)?.toString(),
              ),
            );
            for (const record of insertResponses) {
              const pk = this.extractPksValues(record, true)?.toString();
              if (!visibleInsertPks.has(pk)) {
                record.__nc_rls_hidden = true;
              }
            }
          }

          await this.afterBulkInsert(insertResponses, cookie);
          profiler.log('afterBulkInsert done');
        }
      }

      await this.statsUpdate({
        count: insertDatas.length,
      });
      profiler.log('statsUpdate done');
      profiler.end();

      return responses;
    } catch (e) {
      // Handle unique constraint violations - this will throw if it's a unique constraint error
      await handleUniqueConstraintError({
        error: e,
        baseModel: this,
        insertData: datas,
      });
      // await this.errorInsertb(e, data, null);
      throw e;
    }
  }

  async chunkList(args: {
    pks: string[];
    chunkSize?: number;
    apiVersion?: NcApiVersion;
    args?: Record<string, any>;
    ignoreRls?: boolean;
    extractOnlyPrimaries?: boolean;
    extractOrderColumn?: boolean;
    deletedOnly?: boolean;
    fk_display_value_column_id?: string | null;
  }) {
    const { pks, chunkSize = 1000 } = args;

    const data = [];

    const { ast } = await getAst(this.context, {
      model: this.model,
      query: args.args || {},
      extractOnlyPrimaries: args.extractOnlyPrimaries,
      extractOrderColumn: args.extractOrderColumn,
      fk_display_value_column_id: args.fk_display_value_column_id,
    });

    const chunkedPks = chunkArray(pks, chunkSize);

    const source = await this.getSource();

    for (const chunk of chunkedPks) {
      let chunkData;

      const ctx = {
        source,
        params: {
          pks: chunk.join(','),
          apiVersion: args.apiVersion,
          ...(args.args || {}),
        },
        limitOverride: chunk.length,
        ignoreViewFilterAndSort: true,
        ignoreRls: args.ignoreRls,
        getHiddenColumns: args.extractOrderColumn,
        deletedOnly: args.deletedOnly,
        extractOnlyPrimaries: args.extractOnlyPrimaries,
        fk_display_value_column_id: args.fk_display_value_column_id,
      };

      if (['mysql', 'mysql2'].includes(source.type)) {
        chunkData = await mysqlSingleQueryList(this.context, {
          ...ctx,
          skipPaginateWrapper: true,
          params: ctx.params,
          model: this.model,
          apiVersion: args.apiVersion,
        });
      } else if (['pg', 'postgres', 'postgresql'].includes(source.type)) {
        chunkData = await singleQueryList(this.context, {
          ...ctx,
          skipPaginateWrapper: true,
          params: ctx.params,
          model: this.model,
          apiVersion: args.apiVersion,
        });
      } else if (source.type === 'mssql') {
        chunkData = await mssqlSingleQueryList(this.context, {
          ...ctx,
          skipPaginateWrapper: true,
          params: ctx.params,
          model: this.model,
          apiVersion: args.apiVersion,
        });
      } else {
        // Fallback to regular list function
        chunkData = await this.list(
          {
            pks: chunk.join(','),
            apiVersion: args.apiVersion,
            ...(args.args || {}),
          },
          {
            limitOverride: chunk.length,
            ignoreViewFilterAndSort: true,
            ignoreRls: args.ignoreRls,
            deletedOnly: args.deletedOnly,
          },
        );
        chunkData = await nocoExecute(ast, chunkData, {}, args.args || {});
      }

      data.push(...chunkData);
    }

    return data;
  }

  public override async findByMergeFields(
    mergeColumns: Column[],
    mergeValuesPerRecord: any[][],
  ): Promise<Record<string, any>[]> {
    if (mergeValuesPerRecord.length === 0) return [];

    await this.model.getColumns(this.context);

    const mergeColNames = mergeColumns.map((col) => col.column_name);

    // Deduplicate merge value tuples
    const seen = new Set<string>();
    const uniqueTuples: any[][] = [];
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

    // Apply RLS conditions
    const rlsConditions = await this.getRlsConditions();
    if (rlsConditions.length) {
      await conditionV2(
        this,
        [new Filter({ children: rlsConditions, is_group: true })],
        qb,
      );
    }

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
      _chunkSize = 100,
      cookie,
      raw = false,
      foreign_key_checks = true,
      insertOneByOneAsFallback = false,
      undo = false,
      mergeColumns,
      throwOnDuplicate = false,
      typecast = false,
    }: {
      _chunkSize?: number;
      cookie?: any;
      raw?: boolean;
      foreign_key_checks?: boolean;
      insertOneByOneAsFallback?: boolean;
      undo?: boolean;
      mergeColumns?: Column[];
      throwOnDuplicate?: boolean;
      typecast?: boolean;
    } = {},
  ) {
    const insertQueries: string[] = [];
    const updateQueries: string[] = [];

    try {
      const columns = await this.model.getColumns(this.context);

      let order = await this.getHighestOrderInTable();

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
      const updatePkValues = [];

      let existingRecords: Record<string, any>[] = [];

      if (mergeColumns?.length) {
        // --- Merge-field-based matching ---
        const mergeColNames = mergeColumns.map((col) => col.column_name);

        const mergeValuesPerRecord = preparedDatas.map((data) =>
          mergeColNames.map((cn) => data[cn]),
        );

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
            for (const pk of this.model.primaryKeys) {
              data[pk.column_name] = existingRecord[pk.column_name];
            }
            await this.prepareNocoData(data, false, cookie);
            toUpdate.push(data);
            updatePkValues.push(
              getCompositePkValue(this.model.primaryKeys, {
                ...data,
              }),
            );
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
          existingRecords = await this.chunkList({ pks: updatePkValues });
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
            // const insertObj = this.handleValidateBulkInsert(data, columns);
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

            updatePkValues.push(
              getCompositePkValue(this.model.primaryKeys, {
                ...data,
              }),
            );
          } else if (trashedPkSet.has(pk)) {
            // PK belongs to a trashed record — strip the PK and insert as a new record
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

        // Set existingRecords for after-update hooks (pre-update snapshot)
        if (updatePkValues.length > 0) {
          existingRecords = dbRecords;
        }
      }

      const chunkSize = this.isSqlite ? 10 : 100;
      let trimLeading = 0;
      let trimTrailing = 0;
      if (toInsert.length > 0) {
        if (!foreign_key_checks) {
          if (this.isPg) {
            insertQueries.push(
              this.dbDriver
                .raw('set session_replication_role to replica;')
                .toQuery(),
            );
            trimLeading++;
          } else if (this.isMySQL) {
            insertQueries.push(
              this.dbDriver.raw('SET foreign_key_checks = 0;').toQuery(),
            );
            trimLeading++;
          }
        }

        if (insertOneByOneAsFallback && (this.isSqlite || this.isMySQL)) {
          for (const insertData of toInsert) {
            insertQueries.push(
              this.dbDriver(this.tnPath).insert(insertData).toQuery(),
            );
          }
        } else {
          // MSSQL: see EE bulkInsert path for the rationale. Same pattern —
          // OUTPUT-INTO-table-variable when triggers / explicit identity,
          // standard knex .returning() otherwise. 2100-param cap enforced
          // via mssqlChunkSize.
          const bulkUpsertAiColName = this.isMssql
            ? this.model.columns?.find((c) => c.ai)?.column_name ?? null
            : null;
          const mssqlExplicitIdentity =
            this.isMssql &&
            mssqlNeedsIdentityInsert(toInsert, bulkUpsertAiColName);
          const effectiveChunkSize = this.isMssql
            ? mssqlChunkSize(toInsert, chunkSize)
            : chunkSize;

          const batches: any[][] = [];
          for (let i = 0; i < toInsert.length; i += effectiveChunkSize) {
            batches.push(toInsert.slice(i, i + effectiveChunkSize));
          }

          // See the upper bulk path for why the string-array form
          // (`'col as alias'`) is required instead of a plain object
          // (knex mssql dialect drops the plain-object form).
          const returningSpec = this.model.primaryKeys.map(
            (col) => `${col.column_name} as ${col.title}`,
          );

          for (const batch of batches) {
            if (this.isMssql) {
              // Always go through `mssqlBuildBulkInsertWithCapture` — see
              // the matching comment in the bulkInsert path above. The
              // .toQuery() fast path inlines string values as bare varchar
              // literals which lose non-Latin1 chars (emoji, supplementary
              // CJK) via the connection's CP-1252 collation on the way to
              // the nvarchar(MAX) column.
              insertQueries.push(
                mssqlBuildBulkInsertWithCapture({
                  knex: this.dbDriver,
                  tnPath: this.tnPath,
                  rows: batch,
                  pkCols: this.model.primaryKeys ?? [],
                  explicitIdentity: mssqlExplicitIdentity,
                }),
              );
            } else if (this.isPg) {
              insertQueries.push(
                this.dbDriver(this.tnPath)
                  .insert(batch)
                  .returning(returningSpec.length ? returningSpec : '*')
                  .toQuery(),
              );
            } else {
              insertQueries.push(
                this.dbDriver(this.tnPath).insert(batch).toQuery(),
              );
            }
          }
        }

        if (!foreign_key_checks) {
          if (this.isPg) {
            insertQueries.push(
              this.dbDriver
                .raw('set session_replication_role to origin;')
                .toQuery(),
            );
            trimTrailing++;
          } else if (this.isMySQL) {
            insertQueries.push(
              this.dbDriver.raw('SET foreign_key_checks = 1;').toQuery(),
            );
            trimTrailing++;
          }
        }
      }

      if (toUpdate.length > 0) {
        const rlsConditions = await this.getRlsConditions();
        const rlsFilterGroup = rlsConditions.length
          ? [new Filter({ children: rlsConditions, is_group: true })]
          : [];
        const softDeleteFilterUpdate = await this.getSoftDeleteFilter();

        for (const d of toUpdate) {
          const pkValues = getCompositePkValue(
            this.model.primaryKeys,
            this.extractPksValues(d),
          );

          const wherePk = await this._wherePk(pkValues, true);

          // databricks and mssql can't update PK columns — mssql rejects
          // any UPDATE that touches an IDENTITY column (error 8102 "Cannot
          // update identity column 'X'") even when the new value equals
          // the old; databricks lacks IDENTITY UPDATE support too. Strip
          // PK keys from the SET clause for both.
          const dataToUpdate =
            this.isDatabricks || this.isMssql
              ? Object.fromEntries(
                  Object.entries(d).filter(([k]) => !(k in wherePk)),
                )
              : d;

          const qb = this.dbDriver(this.tnPath)
            .update(dataToUpdate)
            .where(wherePk);
          if (rlsFilterGroup.length) {
            await conditionV2(this, rlsFilterGroup, qb, undefined, true);
          }
          if (softDeleteFilterUpdate) qb.where(softDeleteFilterUpdate);
          updateQueries.push(qb.toQuery());
        }
      }

      let updateResponses = [];
      let insertResponses = [];

      if (this.dbDriver.isExternal) {
        const runExternalResponse = await runExternal(
          this.sanitizeQuery(insertQueries),
          this.dbDriver.extDb,
        );
        insertResponses = Array.isArray(runExternalResponse)
          ? runExternalResponse
          : [runExternalResponse];

        await runExternal(
          this.sanitizeQuery(updateQueries),
          this.dbDriver.extDb,
        );
      } else {
        const trx = await this.dbDriver.transaction();
        try {
          for (const q of insertQueries) {
            const result = await this.execAndGetRows(q, trx);
            insertResponses.push(...result);
          }
          for (const q of updateQueries) {
            await trx.raw(this.sanitizeQuery(q));
          }

          await trx.commit();
        } catch (e: any) {
          await trx.rollback();
          // Handle unique constraint violations (throws if it's a unique constraint error)
          await handleUniqueConstraintError({
            error: e,
            baseModel: this,
          });
          throw e;
        }
      }

      if (trimLeading) {
        insertResponses = insertResponses.slice(trimLeading);
      }
      if (trimTrailing) {
        insertResponses = insertResponses.slice(0, -trimTrailing);
      }

      if (!raw) {
        // Insertion
        if (this.isMySQL) {
          insertResponses = insertResponses.map((r) => ({
            [this.model.primaryKey.column_name]: r,
          }));
        }

        const insertPksForUpsert = insertResponses.map((d) =>
          this.extractPksValues(d),
        );

        insertResponses = await this.chunkList({
          pks: insertPksForUpsert,
          ignoreRls: true,
        });

        // Check which inserted rows are visible under the user's RLS policy
        const rlsConditionsForUpsertInsert = await this.getRlsConditions();
        if (rlsConditionsForUpsertInsert.length && insertResponses.length) {
          const visibleUpsertInserts = await this.chunkList({
            pks: insertPksForUpsert,
          });
          const visibleUpsertInsertPks = new Set(
            visibleUpsertInserts.map((r) =>
              this.extractPksValues(r, true)?.toString(),
            ),
          );
          for (const record of insertResponses) {
            const pk = this.extractPksValues(record, true)?.toString();
            if (!visibleUpsertInsertPks.has(pk)) {
              record.__nc_rls_hidden = true;
            }
          }
        }

        if (insertResponses.length === 1) {
          const insertData = await this.readByPk(
            insertResponses[0],
            false,
            {},
            { ignoreRls: true },
          );
          // Preserve RLS hidden flag from the chunk response
          if (insertResponses[0].__nc_rls_hidden) {
            insertData.__nc_rls_hidden = true;
          }
          await this.afterInsert({
            data: insertData,
            req: cookie,
            insertData: datas[0],
          });
        } else {
          await this.afterBulkInsert(insertResponses, cookie);
        }

        // Updated Records
        updateResponses = await this.chunkList({
          pks: updatePkValues,
          ignoreRls: true,
        });

        // Check which updated rows are still visible under the user's RLS policy
        const rlsConditionsForUpsertUpdate = await this.getRlsConditions();
        if (rlsConditionsForUpsertUpdate.length && updateResponses.length) {
          const visibleUpsertUpdates = await this.chunkList({
            pks: updatePkValues,
          });
          const visibleUpsertUpdatePks = new Set(
            visibleUpsertUpdates.map((r) =>
              this.extractPksValues(r, true)?.toString(),
            ),
          );
          for (const record of updateResponses) {
            const pk = this.extractPksValues(record, true)?.toString();
            if (!visibleUpsertUpdatePks.has(pk)) {
              record.__nc_rls_hidden = true;
            }
          }
        }

        if (!raw) {
          if (updateResponses.length === 1) {
            await this.afterUpdate(
              existingRecords[0],
              updateResponses[0],
              cookie,
              toUpdate[0],
            );
          } else {
            await this.afterBulkUpdate(toUpdate, updateResponses, cookie);
          }
        }
      }

      await this.statsUpdate({
        count: insertResponses.length,
      });

      if (
        isTraceActive() &&
        !mergeColumns?.length &&
        (toUpdate.length || insertResponses.length)
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

        for (const inserted of insertResponses) {
          upsertChanges.push({
            kind: 'insert',
            pk: this.extractPksValues(inserted, true),
          });
        }

        if (upsertChanges.length) {
          captureForTrace('upsertChanges', upsertChanges);
        }
      }

      return [...updateResponses, ...insertResponses];
    } catch (e: any) {
      // Handle unique constraint violations (throws if it's a unique constraint error)
      await handleUniqueConstraintError({
        error: e,
        baseModel: this,
      });
      throw e;
    }
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
      skip_hooks = false,
      apiVersion,
    }: {
      cookie?: any;
      raw?: boolean;
      throwExceptionIfNotExist?: boolean;
      isSingleRecordUpdation?: boolean;
      allowSystemColumn?: boolean;
      typecast?: boolean;
      skip_hooks?: boolean;
      apiVersion?: NcApiVersion;
    } = {},
  ) {
    const queries: string[] = [];
    const profiler = Profiler.start(`base-model/bulkUpdate`);

    try {
      const columns = await this.model.getColumns(this.context);

      if (!raw) {
        for (const d of datas) {
          await this.validate(d, columns, { allowSystemColumn, typecast });
        }
      }
      profiler.log('validate done');
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
      profiler.log('mapAliasToColumn done');

      const prevData = [];
      const newData = [];
      const updatePkValues = [];
      const toBeUpdated = [];
      const pkAndData: { pk: string; data: any }[] = [];

      const attachmentCols = columns.filter((col) => isAttachment(col));
      let postUpdateOps: (() => Promise<string>)[] = [];

      for (const d of updateDatas) {
        const pkValues = this.extractPksValues(d, true);

        if (pkValues === null || pkValues === undefined) {
          if (throwExceptionIfNotExist)
            NcError.get(this.context).recordNotFound(pkValues);
          continue;
        }

        pkAndData.push({ pk: pkValues, data: d });
      }

      const allPksToRead = pkAndData.map((v) => v.pk);

      profiler.log('this.chunkList start for old records');
      const oldRecords = await this.chunkList({
        pks: allPksToRead,
        chunkSize: READ_CHUNK_SIZE,
        apiVersion,
        args: { ignoreViewFilterAndSort: true },
      });
      profiler.log('this.chunkList done for old records');

      const oldRecordsMap = new Map<string, any>(
        oldRecords.map((r) => [this.extractPksValues(r, true), r]),
      );

      const captureUpdatePrev = isTraceActive();
      const capturedUpdatePrev: Record<string, any>[] = [];
      const capturedFkDisplaced: DisplacedRecord[] = [];

      for (let i = 0; i < pkAndData.length; i += READ_CHUNK_SIZE) {
        const chunk = pkAndData.slice(i, i + READ_CHUNK_SIZE);

        for (const { pk, data } of chunk) {
          const oldRecord = oldRecordsMap.get(pk);

          if (!oldRecord) {
            if (throwExceptionIfNotExist)
              NcError.get(this.context).recordNotFound(pk);
            continue;
          }

          if (captureUpdatePrev) {
            capturedUpdatePrev.push(
              pickChangedFieldsForUpdatePrev(
                oldRecord,
                data ?? {},
                columns,
                this.model.primaryKeys,
              ),
            );
            const fkDisplaced = await this.collectFkUpdateDisplacement(
              oldRecord,
              data ?? {},
            );
            if (fkDisplaced.length) capturedFkDisplaced.push(...fkDisplaced);
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

          // databricks and mssql both reject UPDATEs that touch the PK
          // column. T-SQL specifically: "Cannot update identity column 'X'"
          // (error 8102) — fires even when the new value equals the old.
          // NocoDB never legitimately changes a PK through the update flow,
          // so dropping the PK keys from the payload is safe on every
          // dialect; we only opt in for the ones that error to avoid
          // churning the cached SQL on pg/mysql/sqlite.
          const dataToUpdate =
            this.isDatabricks || this.isMssql
              ? Object.fromEntries(
                  Object.entries(data).filter(([k]) => !(k in wherePk)),
                )
              : data;

          toBeUpdated.push({ d: dataToUpdate, wherePk });

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
      profiler.log('prepareNocoData done');

      if (capturedUpdatePrev.length) {
        captureForTrace('recordPrev', capturedUpdatePrev);
      }
      if (capturedFkDisplaced.length) {
        captureForTrace('displacedRecords', capturedFkDisplaced);
      }

      const rlsConditions = await this.getRlsConditions();
      const rlsFilterGroup = rlsConditions.length
        ? [new Filter({ children: rlsConditions, is_group: true })]
        : [];
      const softDeleteFilterBU = await this.getSoftDeleteFilter();

      if (
        this.model.primaryKeys.length === 1 &&
        (this.isPg || this.isMySQL || this.isSqlite)
      ) {
        const batchQb = batchUpdate(
          this.dbDriver,
          this.tnPath,
          toBeUpdated.map((o) => o.d),
          this.model.primaryKey.column_name,
        );

        if (batchQb) {
          if (rlsFilterGroup.length) {
            await conditionV2(this, rlsFilterGroup, batchQb, undefined, true);
          }
          if (softDeleteFilterBU) batchQb.where(softDeleteFilterBU);
          queries.push(batchQb.toQuery());
        }
      } else {
        for (const o of toBeUpdated) {
          const qb = this.dbDriver(this.tnPath).update(o.d).where(o.wherePk);
          if (rlsFilterGroup.length) {
            await conditionV2(this, rlsFilterGroup, qb, undefined, true);
          }
          if (softDeleteFilterBU) qb.where(softDeleteFilterBU);
          queries.push(qb.toQuery());
        }
      }

      if (this.dbDriver.isExternal) {
        await runExternal(this.sanitizeQuery(queries), this.dbDriver.extDb);
      } else {
        const trx = await this.dbDriver.transaction();
        try {
          for (const q of queries) {
            await trx.raw(this.sanitizeQuery(q));
          }
          await trx.commit();
        } catch (e: any) {
          await trx.rollback();
          // Handle unique constraint violations (throws if it's a unique constraint error)
          await handleUniqueConstraintError({
            error: e,
            baseModel: this,
          });
          throw e;
        }
      }
      profiler.log('execute done');

      if (apiVersion === NcApiVersion.V3) {
        if (isTraceActive()) {
          const linkChanges = await this.collectV3LinkChanges(datas);
          if (linkChanges.length) {
            captureForTrace('linkChanges', linkChanges);
          }
        }

        profiler.log('updateLTARCols start');
        // remove LTAR/Links if part of the update request
        await this.updateLTARCols({
          datas,
          cookie,
        });
        profiler.log('postUpdateOps start');
        await Promise.all(postUpdateOps.map((ops) => ops()));
        profiler.log('postUpdateOps done');
      }

      if (!raw) {
        profiler.log('this.chunkList start');
        const updatedRecords = await this.chunkList({
          pks: updatePkValues,
          chunkSize: READ_CHUNK_SIZE,
          apiVersion,
          ignoreRls: true,
        });
        profiler.log('this.chunkList done');

        // Check which updated rows are still visible under the user's RLS policy
        const rlsConditionsForCheck = await this.getRlsConditions();
        let rlsHiddenPks: Set<string> | null = null;
        if (rlsConditionsForCheck.length && updatedRecords.length) {
          const visibleRecords = await this.chunkList({
            pks: updatePkValues,
            chunkSize: READ_CHUNK_SIZE,
            apiVersion,
          });
          const visiblePks = new Set(
            visibleRecords.map((r) =>
              this.extractPksValues(r, true)?.toString(),
            ),
          );
          rlsHiddenPks = new Set(
            updatePkValues.filter((pk) => !visiblePks.has(pk?.toString())),
          );
        }

        const updatedRecordsMap = new Map(
          updatedRecords.map((record) => {
            const compositePk = getCompositePkValue(
              this.model.primaryKeys,
              record,
            );
            const pkStr =
              typeof compositePk === 'string'
                ? compositePk
                : compositePk.toString();
            if (rlsHiddenPks?.has(pkStr)) {
              record.__nc_rls_hidden = true;
            }
            return [pkStr, record];
          }),
        );
        for (const pk of updatePkValues) {
          if (updatedRecordsMap.has(pk)) {
            newData.push(updatedRecordsMap.get(pk));
          }
        }
      }
      profiler.log('Chunking to newData done');

      if (!raw && !skip_hooks) {
        profiler.log('after update start');
        if (isSingleRecordUpdation) {
          await this.afterUpdate(prevData[0], newData[0], cookie, datas[0]);
        } else {
          await this.afterBulkUpdate(prevData, newData, cookie);
        }
      }
      profiler.end();
      return newData;
    } catch (e: any) {
      // Handle unique constraint violations (throws if it's a unique constraint error)
      await handleUniqueConstraintError({
        error: e,
        baseModel: this,
      });
      throw e;
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

  async bulkDelete(
    ids: any[],
    {
      cookie,
      throwExceptionIfNotExist = false,
      isSingleRecordDeletion = false,
      allowSystemColumn = false,
    }: {
      cookie?: any;
      throwExceptionIfNotExist?: boolean;
      isSingleRecordDeletion?: boolean;
      allowSystemColumn?: boolean;
    } = {},
  ) {
    const queries: string[] = [];
    try {
      const columns = await this.model.getColumns(this.context);

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

      for (const d of deleteIds) {
        const pkValues = this.extractPksValues(d, true);
        if (!pkValues) {
          // throw or skip if no pk provided
          if (throwExceptionIfNotExist) {
            NcError.get(this.context).recordNotFound(pkValues);
          }
          continue;
        }

        pkAndData.push({ pk: pkValues, data: d });
      }

      const allPksToRead = pkAndData.map((v) => v.pk);

      const oldRecords = await this.chunkList({
        pks: allPksToRead,
        chunkSize: READ_CHUNK_SIZE,
        args: { ignoreViewFilterAndSort: true },
      });

      const oldRecordsMap = new Map(
        oldRecords.map((r) => [this.extractPksValues(r, true), r]),
      );

      for (const { pk, data } of pkAndData) {
        const oldRecord = oldRecordsMap.get(pk);
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

      if (deleted.length && isTraceActive()) {
        captureForTrace('recordPrev', deleted);
      }

      await this.beforeBulkDelete(deleted, cookie, { allowSystemColumn });

      const base = await this.getSource();

      // Detect soft-delete column for meta sources
      const deletedColumn = columns.find((c) => isDeletedCol(c));
      const isSoftDelete =
        !!deletedColumn &&
        base.isMeta() &&
        (await this.model.isTrashEnabledForWorkspace(this.context));

      const rlsConditions = await this.getRlsConditions();
      const rlsFilterGroup = rlsConditions.length
        ? [new Filter({ children: rlsConditions, is_group: true })]
        : [];

      const idsVals = res.map((d) => d[this.model.primaryKey.column_name]);

      let collectedNotifications: {
        baseModel: any;
        model: any;
        ids: string[];
        colId: string;
      }[] = [];

      let bulkOperationNow: string | null = null;
      if (isSoftDelete) {
        // Soft-delete: flag records instead of removing them, skip link cleanup.
        // Mssql gets 1 (bit) not `true` — see #__nc_deleted note above.
        bulkOperationNow = this.now();
        const softDeletePayload: Record<string, any> = {
          [deletedColumn.column_name]: deletedColValue(this, true),
        };
        const lmtCol = this.model.columns.find(
          (c) => c.uidt === UITypes.LastModifiedTime && c.system,
        );
        const lmbCol = this.model.columns.find(
          (c) => c.uidt === UITypes.LastModifiedBy && c.system,
        );
        if (lmtCol) softDeletePayload[lmtCol.column_name] = bulkOperationNow;
        if (lmbCol) softDeletePayload[lmbCol.column_name] = cookie?.user?.id;

        for (const d of res) {
          const qb = this.dbDriver(this.tnPath)
            .update(softDeletePayload)
            .where(d);
          if (rlsFilterGroup.length) {
            await conditionV2(this, rlsFilterGroup, qb);
          }
          queries.push(qb.toQuery());
        }

        if (isTraceActive()) {
          const softDisplaced = await this.collectLinkedRecordsSnapshot(
            idsVals,
          );
          if (softDisplaced.length) {
            captureForTrace('displacedRecords', softDisplaced);
          }
        }
      } else {
        const execQueries: ((
          trx: CustomKnex,
          ids: any[],
        ) => Knex.QueryBuilder)[] = [];

        const source = await this.getSource();
        const displacedLinks: DisplacedRecord[] = [];
        const captureDisplacement = isTraceActive();

        for (const column of this.model.columns) {
          if (!isLinksOrLTAR(column)) continue;

          const colOptions =
            await column.getColOptions<LinkToAnotherRecordColumn>(this.context);

          const { childContext, refContext, mmContext } =
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
                // Variable names mirror delByPk: `mmChildCol` is the
                // junction-side column holding the deleted row's pk;
                // `mmParentCol` holds the linked-other-side pk.
                const mmChildCol = await Column.get(mmContext, {
                  colId: colOptions.fk_mm_child_column_id,
                });

                const mmParentCol = await Column.get(mmContext, {
                  colId: colOptions.fk_mm_parent_column_id,
                });

                const mmBaseModel = await Model.getBaseModelSQL(mmContext, {
                  model: mmTable,
                  dbDriver: this.dbDriver,
                });

                if (captureDisplacement) {
                  const mmRows = await this.execAndParse(
                    this.dbDriver(mmBaseModel.getTnPath(mmTable.table_name))
                      .select(mmChildCol.column_name, mmParentCol.column_name)
                      .whereIn(mmChildCol.column_name, idsVals),
                    null,
                    { raw: true },
                  );
                  for (const r of mmRows as Array<Record<string, any>>) {
                    displacedLinks.push({
                      kind: 'junction',
                      mmModelId: mmTable.id,
                      baseId: mmTable.base_id,
                      colId: column.id,
                      parentMMCol: mmParentCol.column_name,
                      childMMCol: mmChildCol.column_name,
                      parentValue: r[mmParentCol.column_name],
                      childValue: r[mmChildCol.column_name],
                    });
                  }
                }

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
                await relatedTable.getColumns(refContext);

                const childColumn = await Column.get(childContext, {
                  colId: colOptions.fk_child_column_id,
                });
                const refBaseModel = await Model.getBaseModelSQL(refContext, {
                  model: relatedTable,
                  dbDriver: this.dbDriver,
                });

                // Skip displacement capture when the related table has no PK
                // (PG-imported junction tables, etc.); the FK-nulling exec
                // query below still runs so the delete remains correct.
                if (captureDisplacement && relatedTable.primaryKey) {
                  const hmRows = await this.execAndParse(
                    this.dbDriver(
                      refBaseModel.getTnPath(relatedTable.table_name),
                    )
                      .select(
                        relatedTable.primaryKey.column_name,
                        childColumn.column_name,
                      )
                      .whereIn(childColumn.column_name, idsVals),
                    null,
                    { raw: true },
                  );
                  for (const r of hmRows as Array<Record<string, any>>) {
                    displacedLinks.push({
                      kind: 'column',
                      modelId: relatedTable.id,
                      baseId: relatedTable.base_id,
                      pk: String(r[relatedTable.primaryKey.column_name]),
                      column: childColumn.column_name,
                      // `prev` here is the FK value before nulling; it
                      // already pointed at one of the deleted parents.
                      prev: r[childColumn.column_name],
                      forward: 'null',
                    });
                  }
                }

                execQueries.push((trx, ids) =>
                  trx(refBaseModel.getTnPath(relatedTable.table_name))
                    .update({
                      [childColumn.column_name]: null,
                    })
                    .whereIn(childColumn.column_name, ids),
                );
              }
              break;
            case 'oo':
              {
                if (column.meta?.bt) {
                  break;
                }
                const ooRelatedTable = await colOptions.getRelatedTable(
                  refContext,
                );
                if (ooRelatedTable.mm) break;
                await ooRelatedTable.getColumns(refContext);

                const ooChildColumn = await Column.get(childContext, {
                  colId: colOptions.fk_child_column_id,
                });
                const ooRefBaseModel = await Model.getBaseModelSQL(refContext, {
                  model: ooRelatedTable,
                  dbDriver: this.dbDriver,
                });

                // Skip displacement capture when the related table has no PK
                // (PG-imported junction tables, etc.); the FK-nulling exec
                // query below still runs so the delete remains correct.
                if (captureDisplacement && ooRelatedTable.primaryKey) {
                  const ooRows = await this.execAndParse(
                    this.dbDriver(
                      ooRefBaseModel.getTnPath(ooRelatedTable.table_name),
                    )
                      .select(
                        ooRelatedTable.primaryKey.column_name,
                        ooChildColumn.column_name,
                      )
                      .whereIn(ooChildColumn.column_name, idsVals),
                    null,
                    { raw: true },
                  );
                  for (const r of ooRows as Array<Record<string, any>>) {
                    displacedLinks.push({
                      kind: 'column',
                      modelId: ooRelatedTable.id,
                      baseId: ooRelatedTable.base_id,
                      pk: String(r[ooRelatedTable.primaryKey.column_name]),
                      column: ooChildColumn.column_name,
                      prev: r[ooChildColumn.column_name],
                      forward: 'null',
                    });
                  }
                }

                execQueries.push((trx, ids) =>
                  trx(ooRefBaseModel.getTnPath(ooRelatedTable.table_name))
                    .update({ [ooChildColumn.column_name]: null })
                    .whereIn(ooChildColumn.column_name, ids),
                );
              }
              break;
            case 'bt':
              {
                // nothing to do
              }
              break;
          }
        }

        if (displacedLinks.length) {
          captureForTrace('displacedRecords', displacedLinks);
        }

        // Phase 1: Collect linked IDs BEFORE transaction (data still intact)
        collectedNotifications = await this.collectLinkedRecordNotifications(
          idsVals,
        );

        // execQueries are pre-filtered above: pushed only when NocoDB must
        // cascade itself (meta source, or external FK with dr === 'NO ACTION').
        if (execQueries.length > 0) {
          for (const execQuery of execQueries) {
            queries.push(execQuery(this.dbDriver, idsVals).toQuery());
          }
        }

        for (const d of res) {
          const qb = this.dbDriver(this.tnPath).del().where(d);
          if (rlsFilterGroup.length) {
            await conditionV2(this, rlsFilterGroup, qb);
          }
          queries.push(qb.toQuery());
        }
      }

      if (this.dbDriver.isExternal) {
        await runExternal(this.sanitizeQuery(queries), this.dbDriver.extDb);
      } else {
        const trx = await this.dbDriver.transaction();
        try {
          for (const q of queries) {
            await trx.raw(this.sanitizeQuery(q));
          }
          await trx.commit();
        } catch (e) {
          await trx.rollback();
          throw e;
        }
      }

      if (isSoftDelete) {
        await this.softDeleteFileReferences({
          oldData: deleted,
          columns,
        });

        // Soft-delete: data intact, notify linked records after
        await this.updateLinkedRecordsOnDelete(idsVals, cookie);
      } else {
        await this.clearFileReferences({
          oldData: deleted,
          columns,
        });

        // Phase 2: Notify linked records AFTER transaction — using IDs collected BEFORE
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
            this.logger.error(e?.message, e?.stack);
          }
        }
      }

      if (isSoftDelete) {
        await this.afterSoftDeleteCompleted({
          cookie,
          operationNow: bulkOperationNow!,
        });
      }

      if (isSingleRecordDeletion) {
        await this.afterDelete(deleted[0], cookie);
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

      await this.statsUpdate({
        count: -deleted.length,
      });

      return res;
    } catch (e) {
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

    // Strip __nc_rls_hidden from broadcast — other clients have different
    // RLS policies and the flag would be incorrect for them
    const { __nc_rls_hidden: _, ...broadcastPayload } = newData || {};

    NocoSocket.broadcastDataEvent(
      this.context,
      {
        payload: {
          id,
          action: 'update',
          payload: broadcastPayload,
        },
        tableId: this.model.id,
      },
      this.context.socket_id,
    );

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
                row_id: this.extractPksValues(id, true),
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

    // Propagate date changes to successors
    await this.propagateDateDependency(
      [String(this.extractPksValues(newData))],
      req,
    );
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
      // One batched `bulk` event carrying the updated rows so clients apply them incrementally.
      // Strip __nc_rls_hidden — other clients have different RLS policies.
      NocoSocket.broadcastBulkDataEvent(
        this.context,
        {
          tableId: this.model.id,
          rows: newData.map((d) => {
            const { __nc_rls_hidden: _, ...payload } = d || {};
            return {
              id: this.extractPksValues(d, true),
              action: 'update' as const,
              payload,
            };
          }),
        },
        this.context.socket_id,
      );
    }

    // disable external source audit in cloud
    if ((await this.isDataAuditEnabled()) && newData && newData.length > 0) {
      const parentAuditId = await Noco.ncAudit.genNanoid(MetaTable.AUDIT);

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
              const formattedOldData = prevData?.[i]
                ? formatDataForAudit(prevData?.[i], this.model.columns)
                : {};
              const formattedData = formatDataForAudit(d, this.model.columns);

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
                const isCascade =
                  this.context.additionalContext?.isDatePropagating;

                return await generateAuditV1Payload<DataUpdatePayload>(
                  isCascade
                    ? AuditV1OperationTypes.DATA_CASCADE_UPDATE
                    : AuditV1OperationTypes.DATA_UPDATE,
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
                      ...(isCascade ? { source: 'date_dependency' } : {}),
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

    await this.handleRichTextMentions(prevData, newData, req);

    // Propagate date changes to successors (skip bulk-all — no row data available)
    if (!isBulkAllOperation && newData?.length) {
      const rowIds = newData.map((d: any) => String(this.extractPksValues(d)));
      await this.propagateDateDependency(rowIds, req);
    }
  }

  public async beforeDelete(
    data: Record<string, any>,
    req: NcRequest,
    params?: {
      allowSystemColumn?: boolean;
    },
  ): Promise<void> {
    await this.checkPermission({
      entity: PermissionEntity.TABLE,
      entityId: this.model.id,
      permission: PermissionKey.TABLE_RECORD_DELETE,
      user: req?.user,
      req,
    });

    return super.beforeDelete(data, req, params);
  }

  public async beforeBulkDelete(
    _data: Record<string, any>[],
    req: NcRequest,
    params?: {
      allowSystemColumn?: boolean;
    },
  ): Promise<void> {
    await this.checkPermission({
      entity: PermissionEntity.TABLE,
      entityId: this.model.id,
      permission: PermissionKey.TABLE_RECORD_DELETE,
      user: req?.user,
      req,
    });

    return super.beforeBulkDelete(_data, req, params);
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
    if (!(await this.isDataAuditEnabled())) {
      return;
    }
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

  async getCustomConditionsAndApply({
    column,
    qb,
    view,
    filters,
    args,
    rowId,
    columns,
  }: {
    view?: View;
    column: Column<any>;
    qb?;
    filters?;
    args;
    rowId;
    columns?: Column[];
  }): Promise<any> {
    const listArgs: any = { ...args };

    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}

    const customConditions = column.meta?.enableConditions
      ? (await Filter.rootFilterListByLink(
          { ...this.context, base_id: column.base_id },
          {
            columnId: column.id,
          },
        )) || []
      : [];

    const row: any = null;
    const tableColumns =
      columns ||
      this.model.columns ||
      (await this.model.getColumns(this.context));

    const replaceWithValue = replaceDynamicFieldWithValue(
      row,
      rowId,
      tableColumns,
      this.readByPk,
      args,
    );

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
        new Filter({
          children: await replaceWithValue(customConditions),
          is_group: true,
          logical_op: 'and',
        }),
        new Filter({
          children: listArgs.filterArr || [],
          is_group: true,
          logical_op: 'and',
        }),
      ],
      qb,
      undefined,
    );
  }

  async statsUpdate(args: { count: number }) {
    if (!isCloud) return;

    const count = args.count || 1;

    const workspaceStats = await ModelStat.getWorkspaceSum(
      this.model.fk_workspace_id,
    );

    const workspaceRowCount = workspaceStats ? workspaceStats.row_count : 0;

    const { limit: workspaceRowLimit } = await getLimit(
      PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE,
      this.model.fk_workspace_id,
    );

    // force update workspace stat if already over limit
    if (workspaceRowCount >= workspaceRowLimit) {
      Noco.eventEmitter.emit(UPDATE_WORKSPACE_STAT, {
        context: this.context,
        fk_workspace_id: this.model.fk_workspace_id,
        force: true,
      });
    } else {
      Noco.eventEmitter.emit(UPDATE_WORKSPACE_COUNTER, {
        context: this.context,
        fk_workspace_id: this.model.fk_workspace_id,
        base_id: this.model.base_id,
        fk_model_id: this.model.id,
        count,
      });
    }
  }

  async checkPermission(params: {
    entity: PermissionEntity;
    entityId: string | string[];
    permission: PermissionKey;
    user: any;
    req: any;
  }) {
    const { entity, entityId, permission, user, req } = params;

    const permissionObj = req?.permissions?.find(
      (p) =>
        p.entity === entity &&
        (Array.isArray(entityId)
          ? entityId.includes(p.entity_id)
          : p.entity_id === entityId) &&
        p.permission === permission,
    );

    let errorMessage = 'You are not allowed for this action';

    switch (permission) {
      case PermissionKey.TABLE_VISIBILITY:
        errorMessage = 'You are not allowed to access this table';
        break;
      case PermissionKey.TABLE_RECORD_ADD:
        errorMessage = 'You are not allowed to insert into this table';
        break;
      case PermissionKey.TABLE_RECORD_DELETE:
        errorMessage = 'You are not allowed to delete records from this table';
        break;
      case PermissionKey.RECORD_FIELD_EDIT:
        errorMessage = `You are not allowed to edit field with ID: ${entityId}`;
        break;
      default:
        errorMessage = 'You are not allowed to access this table';
    }

    if (permissionObj) {
      if (!user) {
        NcError.get(this.context).forbidden(errorMessage);
      }

      const hasPermission = await Permission.isAllowed(
        this.context,
        permissionObj,
        {
          id: user.id,
          role: getProjectRole(user),
        },
      );

      if (!hasPermission) {
        NcError.get(this.context).forbidden(errorMessage);
      }
    }
  }

  /**
   * Optimized groupedList for PostgreSQL using singleQueryGroupedList
   * which handles nested columns/rollups in SQL without nocoExecute
   */
  public async groupedList(
    args: {
      groupColumnId: string;
      ignoreViewFilterAndSort?: boolean;
      includeRowColorColumns?: boolean;
      includeButtonFilterColumns?: boolean;
      options?: (string | number | null | boolean)[];
    } & Partial<XcFilter>,
  ): Promise<
    {
      key: string;
      value: Record<string, unknown>[];
    }[]
  > {
    // Use optimized version for PostgreSQL, fallback to base implementation for other databases
    if (!this.isPg) {
      return super.groupedList(args);
    }

    try {
      const source = await Source.get(this.context, this.model.source_id);

      // Use singleQueryGroupedList which handles nested columns/rollups in SQL
      // RLS conditions are resolved internally by singleQueryGroupedList
      return await singleQueryGroupedList(this.context, {
        model: this.model,
        view: this.viewId
          ? await View.get(this.context, this.viewId)
          : undefined,
        source,
        params: {
          ...args,
          options: args.options,
          filterArr: args.filterArr,
          sortArr: args.sortArr,
          sort: args.sort,
          where: args.where,
          limit: args.limit,
          offset: args.offset,
        },
        groupColumnId: args.groupColumnId,
        ignoreViewFilterAndSort: args.ignoreViewFilterAndSort,
        includeButtonFilterColumns: args.includeButtonFilterColumns,
        includeRowColourColumns: args.includeRowColorColumns,
        baseModel: this,
      });
    } catch (e) {
      throw e;
    }
  }

  /**
   * EE override: Returns RLS filter conditions for the current user.
   * Resolves applicable policies and returns filter conditions that
   * get AND'd with all other filters in the query.
   *
   * RLS is enforced for every role, including base owners — there is no
   * role-based exemption. This matches the realtime socket layer
   * (resolveRlsRoom), which also applies policies to all users.
   */
  public override async getRlsConditions(): Promise<Filter[]> {
    // Only apply RLS if user context is available
    if (!this.context?.user?.id) {
      return [];
    }

    const user = this.context.user;

    try {
      // Build user context for RLS resolution
      let baseRoles = '';
      if (user.base_roles) {
        const roles =
          typeof user.base_roles === 'string'
            ? JSON.parse(user.base_roles)
            : user.base_roles;
        baseRoles = Object.keys(roles)
          .filter((r) => roles[r])
          .join(',');
      }

      // Load user's team memberships for RLS
      // Use pre-loaded direct_teams from auth context when available (set by GlobalGuard)
      const teamIds: string[] = [];
      let teamResolutionFailed = false;

      try {
        const directTeams = user.direct_teams || [];

        if (directTeams.length > 0) {
          // Use pre-loaded team data from auth — no DB query needed
          for (const dt of directTeams) {
            teamIds.push(dt.team_id);
          }
        } else {
          // Fallback: query DB if direct_teams not available (e.g. socket/job contexts)
          const userTeamAssignments = await PrincipalAssignment.list(
            this.context,
            {
              principal_type: PrincipalType.USER,
              principal_ref_id: user.id,
              resource_type: ResourceType.TEAM,
            },
          );
          for (const assignment of userTeamAssignments) {
            teamIds.push(assignment.resource_id);
          }
        }
      } catch (_e) {
        // Teams may not be deployed — flag it so the resolver
        // can deny access if team-based policies exist (fail-closed)
        teamResolutionFailed = true;
      }

      // Resolve team hierarchy to member user IDs for {currentUser.teamWithDescendantMembers}
      let teamDescendantMemberUserIds: string[] = [];
      try {
        if (teamIds.length > 0) {
          teamDescendantMemberUserIds =
            await getMemberUserIdsForTeamsAndDescendants(this.context, teamIds);
        }
      } catch (_e) {
        // Same as above — fail-closed if team policies exist
        teamResolutionFailed = true;
      }

      const rlsUser = {
        id: user.id,
        email: user.email,
        roles: baseRoles,
        teams: teamIds,
        teamDescendantMemberUserIds,
      };

      const result = await resolveRlsPolicies(
        this.context,
        this.model.id,
        rlsUser,
        { teamResolutionFailed },
      );

      if (result.type === 'no_rls') {
        return [];
      }

      if (result.type === 'deny_all') {
        return this.getDenyAllFilter();
      }

      // Use the resolver's matched policy IDs directly
      const policyIdsToLoad = result.matchedPolicyIds;

      if (!policyIdsToLoad?.length) {
        return [];
      }

      // Load filter trees per policy: AND within each policy, OR between policies
      const policyFilterGroups: Filter[][] = [];
      for (const policyId of policyIdsToLoad) {
        const filters = await Filter.rootFilterListByRlsPolicy(this.context, {
          rlsPolicyId: policyId,
        });
        if (filters?.length) {
          const resolvedFilters = resolveRlsDynamicValues(filters, rlsUser);
          policyFilterGroups.push(resolvedFilters.map((f) => new Filter(f)));
        }
      }

      if (policyFilterGroups.length === 0) {
        return [];
      }

      // Single policy — return its filters directly (AND'd by default)
      if (policyFilterGroups.length === 1) {
        return policyFilterGroups[0];
      }

      // Multiple policies: wrap each policy's filters in an AND group,
      // then OR the groups together: (P1.F1 AND P1.F2) OR (P2.F1 AND P2.F2)
      const orChildren = policyFilterGroups.map((group, idx) => {
        const andGroup = new Filter({
          children: group,
          is_group: true,
          logical_op: 'and',
        });
        if (idx > 0) {
          andGroup.logical_op = 'or';
        }
        return andGroup;
      });

      return [
        new Filter({
          children: orChildren,
          is_group: true,
          logical_op: 'or',
        }),
      ];
    } catch (e) {
      // If RLS resolution fails, deny access (fail closed)
      new Logger('BaseModelSqlv2').error('RLS resolution error:', e.stack);
      return this.getDenyAllFilter();
    }
  }

  /**
   * Returns a filter that matches zero rows.
   * Uses (PK IS NULL AND PK IS NOT NULL) which is impossible regardless of data.
   * Used for deny_all default policy and fail-closed error handling.
   */
  private async getDenyAllFilter(): Promise<Filter[]> {
    await this.model.getColumns(this.context);
    const pkCol = this.model.primaryKey ?? this.model.columns?.[0];
    if (pkCol?.id) {
      // IS NULL AND IS NOT NULL — always false, column-value independent
      return [
        new Filter({
          children: [
            new Filter({
              comparison_op: 'null',
              fk_column_id: pkCol.id,
              is_group: false,
            }),
            new Filter({
              comparison_op: 'notnull',
              fk_column_id: pkCol.id,
              is_group: false,
              logical_op: 'and',
            }),
          ],
          is_group: true,
          logical_op: 'and',
        }),
      ];
    }
    return [];
  }

  /**
   * SELECT-only walk over LTAR columns to capture which children/junctions
   * reference the rows being deleted. Used by the soft-delete branches of
   * `delByPk` / `bulkDelete` so `meta.extra.displacedRecords` carries a
   * link snapshot even when no FK / junction actually changes — symmetric
   * with the hard-delete cascade and forward-compatible with future
   * undo paths that need to verify or repair link state on restore.
   *
   * Soft-delete entries omit `forward` (no actual displacement happened);
   * the redo trash path already skips entries without `forward`, so these
   * are inert there. They power audit, no-trash undo fallback, and any
   * future link-repair tooling.
   */
  private async collectLinkedRecordsSnapshot(
    idsVals: any[],
  ): Promise<DisplacedRecord[]> {
    const snapshot: DisplacedRecord[] = [];
    if (!idsVals.length) return snapshot;
    const idChunks = chunkArray(idsVals, WHERE_IN_CHUNK_SIZE);
    for (const column of this.model.columns) {
      if (!isLinksOrLTAR(column)) continue;
      const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>(
        this.context,
      );
      const { mmContext, refContext, childContext } =
        await colOptions.getParentChildContext(this.context);
      const relationType = isMMOrMMLike(column) ? 'mm' : colOptions.type;
      switch (relationType) {
        case 'mm': {
          const mmTable = await Model.get(mmContext, colOptions.fk_mm_model_id);
          if (!mmTable) break;
          const mmChildCol = await Column.get(mmContext, {
            colId: colOptions.fk_mm_child_column_id,
          });
          const mmParentCol = await Column.get(mmContext, {
            colId: colOptions.fk_mm_parent_column_id,
          });
          const mmBaseModel = await Model.getBaseModelSQL(mmContext, {
            model: mmTable,
            dbDriver: this.dbDriver,
          });
          for (const chunk of idChunks) {
            const rows = await this.execAndParse(
              this.dbDriver(mmBaseModel.getTnPath(mmTable.table_name))
                .select(mmParentCol.column_name, mmChildCol.column_name)
                .whereIn(mmChildCol.column_name, chunk),
              null,
              { raw: true },
            );
            for (const r of rows as Array<Record<string, any>>) {
              snapshot.push({
                kind: 'junction',
                mmModelId: mmTable.id,
                baseId: mmTable.base_id,
                colId: column.id,
                parentMMCol: mmParentCol.column_name,
                childMMCol: mmChildCol.column_name,
                parentValue: r[mmParentCol.column_name],
                childValue: r[mmChildCol.column_name],
              });
            }
          }
          break;
        }
        case 'hm': {
          const relatedTable = await colOptions.getRelatedTable(refContext);
          if (relatedTable.mm) break;
          await relatedTable.getColumns(refContext);
          const childColumn = await Column.get(childContext, {
            colId: colOptions.fk_child_column_id,
          });
          const refBaseModel = await Model.getBaseModelSQL(refContext, {
            model: relatedTable,
            dbDriver: this.dbDriver,
          });
          for (const chunk of idChunks) {
            const rows = await this.execAndParse(
              this.dbDriver(refBaseModel.getTnPath(relatedTable.table_name))
                .select(
                  ...relatedTable.primaryKeys.map((c) => c.column_name),
                  childColumn.column_name,
                )
                .whereIn(childColumn.column_name, chunk),
              null,
              { raw: true },
            );
            for (const r of rows as Array<Record<string, any>>) {
              snapshot.push({
                kind: 'column',
                modelId: relatedTable.id,
                baseId: relatedTable.base_id,
                pk: dataWrapper(r).extractPksValue(
                  relatedTable,
                  true,
                ) as string,
                column: childColumn.column_name,
                prev: r[childColumn.column_name],
              });
            }
          }
          break;
        }
        case 'oo': {
          // BT-side: deleted row holds FK; nothing on the other table to capture.
          if (column.meta?.bt) break;
          const ooRelatedTable = await colOptions.getRelatedTable(refContext);
          if (ooRelatedTable.mm) break;
          await ooRelatedTable.getColumns(refContext);
          const ooChildColumn = await Column.get(childContext, {
            colId: colOptions.fk_child_column_id,
          });
          const ooRefBaseModel = await Model.getBaseModelSQL(refContext, {
            model: ooRelatedTable,
            dbDriver: this.dbDriver,
          });
          for (const chunk of idChunks) {
            const rows = await this.execAndParse(
              this.dbDriver(ooRefBaseModel.getTnPath(ooRelatedTable.table_name))
                .select(
                  ...ooRelatedTable.primaryKeys.map((c) => c.column_name),
                  ooChildColumn.column_name,
                )
                .whereIn(ooChildColumn.column_name, chunk),
              null,
              { raw: true },
            );
            for (const r of rows as Array<Record<string, any>>) {
              snapshot.push({
                kind: 'column',
                modelId: ooRelatedTable.id,
                baseId: ooRelatedTable.base_id,
                pk: dataWrapper(r).extractPksValue(
                  ooRelatedTable,
                  true,
                ) as string,
                column: ooChildColumn.column_name,
                prev: r[ooChildColumn.column_name],
              });
            }
          }
          break;
        }
        case 'bt': {
          // V1 BT: deleted row holds the FK; the parent row stays untouched
          // (just loses a back-link in display). Nothing to snapshot.
          // (V2 BT-style routes to 'mm' via isMMOrMMLike.)
          break;
        }
      }
    }
    return snapshot;
  }

  /**
   * Snapshot OO sibling-row displacement caused by an update that
   * re-points a OO FK column at a parent already linked elsewhere.
   * Captured BEFORE the SQL UPDATE runs.
   *
   * Self-row FK restoration is handled by the `recordPrev` capture
   * (changed-fields snapshot keyed by title). Adding the same row's FK
   * here would cause undo to fire two writes against the same column
   * (one via `dataUpdate(prev)`, one via the displacedRecords loop).
   *
   * Entries omit `forward` — the current update path doesn't actually
   * null/reassign the sibling rows, so `recordUpdate` redo shouldn't
   * re-apply them. They are inert at redo time and only power audit +
   * future link-repair.
   */
  private async collectFkUpdateDisplacement(
    oldRecord: Record<string, any>,
    body: Record<string, any>,
  ): Promise<DisplacedRecord[]> {
    const displaced: DisplacedRecord[] = [];
    if (!oldRecord || !body) return displaced;
    const columns = this.model.columns;
    const currentPk = this.extractPksValues(oldRecord, true);
    if (currentPk == null || currentPk === 'N/A') return displaced;

    const byKey = new Map<string, Column>();
    for (const c of columns) {
      if (c.title) byKey.set(c.title, c);
      if (c.column_name) byKey.set(c.column_name, c);
      if (c.id) byKey.set(c.id, c);
    }

    for (const k of Object.keys(body)) {
      const col = byKey.get(k);
      if (!col || col.uidt !== UITypes.ForeignKey) continue;

      const newFk = body[k];
      // `oldRecord` is title-keyed (selectObject aliases column_name →
      // title). FK columns default to title === column_name at creation
      // but can diverge if the user renames the alias, so resolve via
      // dataWrapper which checks both.
      const oldFk = dataWrapper(oldRecord).getByColumnNameTitleOrId(col);
      if (newFk === oldFk) continue;

      const ltar = columns.find(
        (c) =>
          isLinksOrLTAR(c) &&
          (c.colOptions as LinkToAnotherRecordColumn | undefined)
            ?.fk_child_column_id === col.id,
      );
      if (!ltar) continue;
      const ltarOpts = await ltar.getColOptions<LinkToAnotherRecordColumn>(
        this.context,
      );
      const isOo = ltarOpts.type === RelationTypes.ONE_TO_ONE;
      // BT updates: self-row FK is covered by `recordPrev`; nothing to
      // displace beyond that.
      if (!isOo) continue;

      // OO: snapshot any sibling row already at `newFk` (potential
      // uniqueness conflict). Skip when newFk is null (clearing a link).
      if (newFk != null) {
        const conflicts = (await this.execAndParse(
          this.dbDriver(this.tnPath)
            .select(
              ...this.model.primaryKeys.map((c) => c.column_name),
              col.column_name,
            )
            .where(col.column_name, newFk),
          null,
          { raw: true },
        )) as Array<Record<string, any>>;
        for (const r of conflicts) {
          const conflictPk = dataWrapper(r).extractPksValue(this.model, true);
          if (conflictPk == null || conflictPk === 'N/A') continue;
          if (String(conflictPk) === String(currentPk)) continue;
          displaced.push({
            kind: 'column',
            modelId: this.model.id,
            baseId: this.model.base_id,
            pk: String(conflictPk),
            column: col.column_name,
            prev: r[col.column_name],
          });
        }
      }
    }
    return displaced;
  }

  /**
   * V3 update LTAR diff capture. Mirrors the diff `LTARColsUpdater` (CE
   * / Mux / EE) computes internally — run once here at the bulkUpdate
   * dispatch entry so the three downstream paths are covered uniformly.
   *
   * For each row in `datas` and each LTAR column whose key is present in
   * the body, reads the existing links via `mmList` / `hmList` / `btRead`
   * and diffs against the body's desired link set. Emits `add`/`remove`
   * `LinkChange` entries that the undo handler inverts.
   *
   * The duplicate read (this + `LTARColsUpdater`'s own list) is the cost
   * of supporting all three updater variants from one capture site
   * without per-variant intrusion. Gated behind `isTraceActive()` so it
   * only fires when an outer @TraceCommand will consume the captures.
   */
  private async collectV3LinkChanges(datas: any[]): Promise<LinkChange[]> {
    const out: LinkChange[] = [];
    if (!datas?.length) return out;

    for (const col of this.model.columns) {
      if (!isLinksOrLTAR(col)) continue;

      const touched: Array<{ rowId: string; body: any }> = [];
      for (const d of datas) {
        if (!(col.title in d)) continue;
        const rowId = this.extractPksValues(d, true);
        if (rowId == null || rowId === 'N/A') continue;
        touched.push({ rowId: String(rowId), body: d });
      }
      if (!touched.length) continue;

      const existingByRow = new Map<string, string[]>();

      if (isMMOrMMLike(col)) {
        const colOptions = await col.getColOptions<LinkToAnotherRecordColumn>(
          this.context,
        );
        const { mmContext } = await colOptions.getParentChildContext(
          this.context,
        );
        const mmTable = await Model.get(mmContext, colOptions.fk_mm_model_id);
        if (mmTable) {
          const mmChildCol = await Column.get(mmContext, {
            colId: colOptions.fk_mm_child_column_id,
          });
          const mmParentCol = await Column.get(mmContext, {
            colId: colOptions.fk_mm_parent_column_id,
          });
          const mmBaseModel = await Model.getBaseModelSQL(mmContext, {
            model: mmTable,
            dbDriver: this.dbDriver,
          });
          const rowIdList = touched.map((t) => t.rowId);
          for (const chunk of chunkArray(rowIdList, WHERE_IN_CHUNK_SIZE)) {
            const rows = await this.execAndParse(
              this.dbDriver(mmBaseModel.getTnPath(mmTable.table_name))
                .select(mmParentCol.column_name, mmChildCol.column_name)
                .whereIn(mmChildCol.column_name, chunk),
              null,
              { raw: true },
            );
            for (const r of rows as Array<Record<string, any>>) {
              const rowKey = String(r[mmChildCol.column_name]);
              const parentVal = r[mmParentCol.column_name];
              if (parentVal == null) continue;
              const bucket = existingByRow.get(rowKey);
              if (bucket) bucket.push(String(parentVal));
              else existingByRow.set(rowKey, [String(parentVal)]);
            }
          }
        }
      } else {
        // Legacy V1 LTAR (HM / BT / OO with direct FKs) — no junction to
        // batch against; keep per-row reads until hmList / btRead accept
        // an id list.
        const colType = (
          col.colOptions as LinkToAnotherRecordColumn | undefined
        )?.type;
        // OO has a column on each side. `meta.bt: true` marks the FK-holding
        // (child) side — that side reads via btRead like a true BT. The other
        // (parent) side doesn't hold the FK; its existing link lives on the
        // related row, so it must be read via hmList semantics.
        const isHmLike =
          colType === RelationTypes.HAS_MANY ||
          (colType === RelationTypes.ONE_TO_ONE && !col.meta?.bt);
        for (const { rowId } of touched) {
          let existingLinks: Record<string, any>[] | Record<string, any> = [];
          if (isHmLike) {
            existingLinks = await this.hmList({ colId: col.id, id: rowId });
          } else {
            existingLinks = await this.btRead({ colId: col.id, id: rowId });
          }
          existingLinks = existingLinks ?? [];
          if (!Array.isArray(existingLinks)) {
            existingLinks = existingLinks ? [existingLinks] : [];
          }
          const pks = (existingLinks as Record<string, any>[])
            .map((r) => this.extractPksValues(r, true))
            .filter((v) => v != null && v !== 'N/A')
            .map((v) => String(v));
          existingByRow.set(rowId, pks);
        }
      }

      for (const { rowId, body } of touched) {
        const existingPks = existingByRow.get(rowId) ?? [];
        const bodyVal = body[col.title];
        const desiredRecords = Array.isArray(bodyVal)
          ? bodyVal
          : bodyVal != null
          ? [bodyVal]
          : [];
        const desiredPks = desiredRecords
          .map((rec: any) => this.extractPksValues(rec, true))
          .filter((v: any) => v != null && v !== 'N/A')
          .map((v: any) => String(v));

        const existingSet = new Set(existingPks);
        const desiredSet = new Set(desiredPks);

        const toAdd = desiredPks.filter((p) => !existingSet.has(p));
        const toRemove = existingPks.filter((p) => !desiredSet.has(p));

        if (toRemove.length) {
          out.push({
            op: 'remove',
            colId: col.id,
            baseId: col.base_id,
            rowId,
            childIds: toRemove,
          });
        }
        if (toAdd.length) {
          out.push({
            op: 'add',
            colId: col.id,
            baseId: col.base_id,
            rowId,
            childIds: toAdd,
          });
        }
      }
    }
    return out;
  }

  /**
   * Insert the unified `nc_trash` row inline so the trash entry lands in the
   * same request as the soft-delete write — no fire-and-forget event listener
   * gap. Idempotent on (base_id, resource_type, resource_id): concurrent
   * deletes that map to the same (table, user, deletedAt) tuple collapse onto
   * the first row instead of erroring. Per-table `trash_retention_days` wins
   * over the workspace plan limit.
   */
  override async afterSoftDeleteCompleted(params: {
    cookie: NcRequest;
    operationNow: string;
  }): Promise<void> {
    const deletedAtIso = new Date(params.operationNow).toISOString();
    const fkUserId = params.cookie?.user?.id ?? null;
    const retentionDays = await resolveTrashRetentionDays(this.context, {
      source: 'record',
      model: this.model,
    });
    const cleanupDueAt = computeCleanupDueAt(deletedAtIso, retentionDays);
    const trashEntry = await BaseTrash.insert(this.context, {
      resource_type: 'record',
      resource_id: buildRecordResourceId(this.model.id, fkUserId, deletedAtIso),
      name: this.model.title,
      parent_type: 'table',
      parent_id: this.model.id,
      parent_name: this.model.title,
      deleted_by: fkUserId ?? undefined,
      deleted_at: deletedAtIso,
      cleanup_due_at: cleanupDueAt,
    });
    if (trashEntry?.id) {
      captureForTrace('softDeleteTrashId', trashEntry.id);
    }
  }

  // Given a source-side LTAR columnId, return the related table's column that
  // was set as the override display value (`fk_display_value_column_id`). Used
  // by audit paths to render linked-record display values consistently with
  // what the UI shows in LTAR dropdowns / chips.
  //
  // The override is set per-direction. If the caller passes the auto-paired
  // side (which has no override of its own) we fall back to the paired LTAR's
  // override so audits resolve correctly regardless of which side initiates.
  protected override async resolveLtarDisplayCol(
    columnId: string | undefined,
    refModel: Model,
  ): Promise<Column | undefined> {
    if (!columnId) return undefined;
    const col = await Column.get(this.context, { colId: columnId });
    if (!col) return undefined;
    if (!refModel.columns?.length) await refModel.getColumns(this.context);

    const ownColOpts = await col.getColOptions<LinkToAnotherRecordColumn>(
      this.context,
    );
    const ownDisplayColId = ownColOpts?.fk_display_value_column_id;
    if (ownDisplayColId) {
      const found = refModel.columns?.find((c) => c.id === ownDisplayColId);
      if (found) return found;
    }

    if (!ownColOpts) return undefined;

    // Fallback: paired LTAR direction may carry the override. The paired
    // column lives on the table this LTAR links to, which is `refModel` if
    // the caller passed it that way, or otherwise resolved via colOpts.
    const { refContext } = ownColOpts.getRelContext(this.context);
    const linkedModelId = ownColOpts.fk_related_model_id ?? refModel.id;

    let pairedColumns: Column[] | undefined;
    if (linkedModelId === refModel.id) {
      pairedColumns = refModel.columns;
    } else {
      const m = await Model.get(refContext, linkedModelId);
      if (m && !m.columns?.length) await m.getColumns(refContext);
      pairedColumns = m?.columns;
    }
    if (!pairedColumns?.length) return undefined;

    const pairedCol = await extractCorrespondingLinkColumn(refContext, {
      ltarColumn: col,
      referencedTableColumns: pairedColumns,
    });
    if (!pairedCol) return undefined;
    const pairedColOpts =
      await pairedCol.getColOptions<LinkToAnotherRecordColumn>(refContext);
    const pairedDisplayColId = pairedColOpts?.fk_display_value_column_id;
    if (!pairedDisplayColId) return undefined;
    return refModel.columns?.find((c) => c.id === pairedDisplayColId);
  }

  // Source-side override: resolves the paired (reverse) LTAR's
  // `fk_display_value_column_id` against `model`. The paired column lives on
  // `refModel` and points back to `model`; its override is what determines how
  // the source row renders in audits/UI viewed from refModel's perspective.
  // Falls back to undefined when no paired column or no override is set.
  protected override async resolveReverseLtarDisplayCol(
    columnId: string | undefined,
    model: Model,
    refModel: Model,
  ): Promise<Column | undefined> {
    if (!columnId) return undefined;
    const col = await Column.get(this.context, { colId: columnId });
    if (!col) return undefined;
    if (!refModel.columns?.length) await refModel.getColumns(this.context);
    const pairedCol = await extractCorrespondingLinkColumn(this.context, {
      ltarColumn: col,
      referencedTableColumns: refModel.columns,
    });
    if (!pairedCol) return undefined;
    return this.resolveLtarDisplayCol(pairedCol.id, model);
  }

  // Request-scoped cache for `getLtarDisplayColumnOverride`. Key is
  // `${ltarColumn.id}:${model.id}`, value is the resolved Column (or null
  // when no override applies — distinct from "not yet resolved", so we can
  // tell cache misses apart from "no override" hits).
  private _ltarDisplayColCache?: Map<string, Column | null>;

  // Resolves the LTAR's `fk_display_value_column_id` override (own or paired,
  // depending on which side `model` is) to a Column on `model`. The result
  // is cached per (ltarColumn.id, model.id) on this BaseModelSqlv2 instance,
  // so multiple RelationManagers in the same request share lookups instead
  // of each paying for `extractCorrespondingLinkColumn` + `getColOptions`
  // from cold.
  //
  // Returns undefined when no override applies → callers fall back to the
  // table's primary value.
  public override async getLtarDisplayColumnOverride(
    ltarColumn: Column,
    model: Model,
  ): Promise<Column | undefined> {
    if (!this._ltarDisplayColCache) {
      this._ltarDisplayColCache = new Map();
    }
    const key = `${ltarColumn.id}:${model.id}`;
    const cached = this._ltarDisplayColCache.get(key);
    if (cached !== undefined) return cached ?? undefined;

    const colCtx = { ...this.context, base_id: ltarColumn.base_id };
    const colOpts = await ltarColumn.getColOptions<LinkToAnotherRecordColumn>(
      colCtx,
    );

    let result: Column | undefined;

    if (model.id === colOpts?.fk_related_model_id) {
      // Forward direction: own LTAR's override targets `model`.
      const id = colOpts?.fk_display_value_column_id;
      if (id) {
        const cols = await model.getCachedColumns({
          ...this.context,
          base_id: model.base_id,
        });
        const found = cols.find((c) => c.id === id);
        if (found && isSupportedDisplayValueColumn(found)) result = found;
      }
    } else {
      // Reverse direction: paired LTAR's override targets `model`.
      const pairedCol = await extractCorrespondingLinkColumn(colCtx, {
        ltarColumn,
      });
      if (pairedCol) {
        const pairedOpts =
          await pairedCol.getColOptions<LinkToAnotherRecordColumn>({
            ...this.context,
            base_id: pairedCol.base_id,
          });
        const id = pairedOpts?.fk_display_value_column_id;
        if (id) {
          const cols = await model.getCachedColumns({
            ...this.context,
            base_id: model.base_id,
          });
          const found = cols.find((c) => c.id === id);
          if (found && isSupportedDisplayValueColumn(found)) result = found;
        }
      }
    }

    this._ltarDisplayColCache.set(key, result ?? null);
    return result;
  }

  // Batch resolver for LTAR display value overrides used by audit-write paths.
  // Per unique columnId, resolves the override Column for both the ref side
  // (renders refModel rows) and the source side (renders model rows). Handles
  // the auto-paired case (override lives on the user-configured side) without
  // doing redundant `Column.get`/`getColOptions` for the same columnId.
  //
  // `hasAny` is the fast-out gate: when false, callers should skip threading
  // `displayColumn` through `fetchDisplayValueMap`/`displayValueMapKey` — the
  // values resolve to the table's primary value (the pre-override behavior).
  // This keeps the no-override case (the >99% path) free of override plumbing.
  protected override async resolveLtarOverrideColsForBatch(
    auditObjs: Array<{
      columnId?: string;
      model: Model;
      refModel?: Model;
    }>,
  ): Promise<{
    refByColId: Map<string, Column | undefined>;
    sourceByColId: Map<string, Column | undefined>;
    hasAny: boolean;
  }> {
    const refByColId = new Map<string, Column | undefined>();
    const sourceByColId = new Map<string, Column | undefined>();
    let hasAny = false;

    const seen = new Set<string>();
    for (const obj of auditObjs) {
      if (!obj.columnId || !obj.refModel || seen.has(obj.columnId)) continue;
      seen.add(obj.columnId);

      const col = await Column.get(this.context, { colId: obj.columnId });
      if (!col) continue;
      const colOpts = await col.getColOptions<LinkToAnotherRecordColumn>(
        this.context,
      );
      const ownDisplayColId = colOpts?.fk_display_value_column_id;

      const refCols = await obj.refModel.getCachedColumns({
        ...this.context,
        base_id: obj.refModel.base_id,
      });
      const sourceCols = await obj.model.getCachedColumns({
        ...this.context,
        base_id: obj.model.base_id,
      });

      let refDisplayCol: Column | undefined;
      let sourceDisplayCol: Column | undefined;

      const pickSupported = (
        cols: Column[],
        id: string | undefined,
      ): Column | undefined => {
        if (!id) return undefined;
        const c = cols.find((x) => x.id === id);
        return c && isSupportedDisplayValueColumn(c) ? c : undefined;
      };

      if (ownDisplayColId) {
        // Own override targets either side: refModel for the user-configured
        // direction, or model for the auto-paired direction.
        refDisplayCol = pickSupported(refCols, ownDisplayColId);
        if (!refDisplayCol) {
          sourceDisplayCol = pickSupported(sourceCols, ownDisplayColId);
        }
      }

      // Walk paired LTAR only when at least one side is still unresolved.
      if (!refDisplayCol || !sourceDisplayCol) {
        const pairedCol = await extractCorrespondingLinkColumn(this.context, {
          ltarColumn: col,
          referencedTableColumns: refCols,
        });
        if (pairedCol) {
          const pairedOpts =
            await pairedCol.getColOptions<LinkToAnotherRecordColumn>(
              this.context,
            );
          const pairedDisplayColId = pairedOpts?.fk_display_value_column_id;
          if (pairedDisplayColId) {
            if (!refDisplayCol) {
              refDisplayCol = pickSupported(refCols, pairedDisplayColId);
            }
            if (!sourceDisplayCol) {
              sourceDisplayCol = pickSupported(sourceCols, pairedDisplayColId);
            }
          }
        }
      }

      if (refDisplayCol) {
        refByColId.set(obj.columnId, refDisplayCol);
        hasAny = true;
      }
      if (sourceDisplayCol) {
        sourceByColId.set(obj.columnId, sourceDisplayCol);
        hasAny = true;
      }
    }

    return { refByColId, sourceByColId, hasAny };
  }
}

export {
  BaseModelSqlv2,
  _wherePk,
  extractSortsObject,
  getListArgs,
  haveFormulaColumn,
  getColumnName,
  getAs,
};
