import {
  parseSearchDate,
  parseSearchNumber,
  searchDayTimezone,
} from 'nocodb-sdk';
import type { SearchState } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { LinkToAnotherRecordColumn } from '~/models';
import type {
  SearchMatch,
  SearchProvider,
  SearchRequest,
} from '~/db/search/types';
import type { ScanSearchProvider } from '~/db/search/scanSearchProvider';
import type { FilterRawClause } from '~/models/Filter';
import type { CellMatch } from '~/db/search/searchIndexStore';
import type { CellKind, DependencyPath } from '~/db/search/searchIndexFields';
import type { NcContext } from '~/interface/config';
import type { SearchIndexMeta } from '~/db/search/searchIndexMeta';
import {
  getSearchIndexMeta,
  isColumnServedByIndex,
  likePattern,
  toSearchPattern,
} from '~/db/search/searchIndex';
import { getSearchStaleSince } from '~/db/search/searchIndexMeta';
import {
  cellKindOf,
  isComputedField,
  resolveIndexFields,
} from '~/db/search/searchIndexFields';
import {
  behindLiveCells,
  behindLiveMatchClause,
  cellSearchClauses,
  liveCellMatchClause,
  markedRowIds,
  partialRowIds,
  probeGridSearch,
  searchLiveTarget,
} from '~/db/search/searchIndexStore';
import { getQueryGuard } from '~/db/queryGuard';
import { liveSearchable } from '~/db/search/searchLive';
import { BaseUser, Column, Filter, Model, Source } from '~/models';
import { FILTER_RAW_CLAUSE } from '~/models/Filter';
import {
  canHideLinkTargets,
  isLinkTargetHidden,
  relatedBaseContext,
} from '~/helpers/tableHelpers';
import { isSharedViewAccess } from '~/helpers/accessSource';
import { extractDisplayNameFromEmail } from '~/utils/emailUtils';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

/** A leaf filter that compiles to `clause`. */
export function rawFilter(
  baseModel: IBaseModelSqlV2,
  clause: FilterRawClause,
  logicalOp: 'and' | 'or',
) {
  // Any field id: the clause decides; a leaf without one is skipped.
  const filter = new Filter({
    fk_column_id:
      baseModel.model.primaryKey?.id ?? baseModel.model.columns?.[0]?.id,
    comparison_op: 'in',
    value: '',
    logical_op: logicalOp,
  });
  filter[FILTER_RAW_CLAUSE] = clause;
  return filter;
}

/** Matches no row. */
export function noRows(baseModel: IBaseModelSqlV2): {
  kind: 'condition';
  filters: Filter[];
} {
  return {
    kind: 'condition',
    filters: [rawFilter(baseModel, (qb) => qb.whereRaw('1 = 0'), 'and')],
  };
}

/** Report why the search may be missing rows; the first reason set wins. */
export function reportSearchState(state: SearchState) {
  const guard = getQueryGuard();
  if (guard && !guard.searchState) guard.searchState = state;
}

/** A zone Postgres accepts, else UTC. */
function validTimezone(timezone: string | undefined) {
  if (!timezone) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return timezone;
  } catch {
    return 'UTC';
  }
}

/**
 * What `term` can match: a text pattern, a number, a day; none = too short.
 * `scan` keeps a pattern the index can't narrow, for a table read directly.
 */
export async function classifySearchTerm(
  baseModel: IBaseModelSqlV2,
  term: string,
  scan = false,
) {
  return {
    pattern: scan
      ? likePattern(term)
      : await toSearchPattern(baseModel.dbDriver, term),
    num: parseSearchNumber(term),
    day: parseSearchDate(term),
  };
}

type IndexedField = { column: Column; kind: CellKind };

/**
 * A public request's user cells match by the users whose shown name holds
 * `term`: their text also names each user's email, which public responses
 * never show. Undefined for a member's request.
 */
async function publicUserIds(
  baseModel: IBaseModelSqlV2,
  fields: IndexedField[],
  term: string,
): Promise<string[] | undefined> {
  const context = baseModel.context;
  if (!context.is_public && !isSharedViewAccess(context)) return undefined;
  if (!fields.some((f) => f.kind === 'user')) return [];
  const users = await BaseUser.getUsersList(context, {
    base_id: baseModel.model.base_id,
    include_internal_user: true,
  });
  const needle = term.toLowerCase();
  return (users ?? [])
    .filter((u) =>
      extractDisplayNameFromEmail(u.email ?? '', u.display_name)
        .toLowerCase()
        .includes(needle),
    )
    .map((u) => `${u.id}`);
}

/** {@link behindLiveMatchClause}, once per request for each table and term. */
function behindLiveMatches(
  baseModel: IBaseModelSqlV2,
  rowIdType: SearchIndexMeta['row_id_type'],
  ids: string[],
  { key, live }: { key: string; live: FilterRawClause },
): Promise<FilterRawClause> {
  const guard = getQueryGuard();
  const cached = guard?.searchBehindLive?.get(key);
  if (cached) return cached;
  const run = behindLiveMatchClause(baseModel, rowIdType, ids, live);
  if (guard) {
    guard.searchBehindLive ??= new Map();
    guard.searchBehindLive.set(key, run);
    run.catch(() => guard.searchBehindLive?.delete(key));
  }
  return run;
}

/** What `term` matches in the cells of `fields`. */
function cellMatchFor(
  fields: IndexedField[],
  term: Awaited<ReturnType<typeof classifySearchTerm>>,
  timezone: string | undefined,
  publicUsers?: string[],
): CellMatch {
  const match: CellMatch = {
    pattern: term.pattern,
    textCols: [],
    num: term.num,
    numCols: [],
    day: term.day,
    dayCols: [],
    tsGroups: [],
    userIds: publicUsers,
    userCols: [],
  };
  const tsByZone = new Map<string, string[]>();
  for (const { column, kind } of fields) {
    switch (kind) {
      case 'user':
        if (publicUsers) match.userCols.push(column.id);
        else match.textCols.push(column.id);
        break;
      case 'txt':
        match.textCols.push(column.id);
        break;
      case 'num':
        match.numCols.push(column.id);
        break;
      case 'day':
        match.dayCols.push(column.id);
        break;
      case 'ts': {
        const zone = validTimezone(
          searchDayTimezone(
            { uidt: column.uidt, dt: column.dt, meta: column.meta },
            timezone,
          ),
        );
        tsByZone.set(zone, [...(tsByZone.get(zone) ?? []), column.id]);
        break;
      }
    }
  }
  match.tsGroups = [...tsByZone].map(([zone, cols]) => ({
    cols,
    timezone: zone,
  }));
  return match;
}

// Per request context: ids of the fields whose value is built from a User field.
const userDerivedVerdicts = new WeakMap<
  object,
  Map<string, Promise<Set<string>>>
>();

/** On a public or shared request, the computed fields built from a User field. */
function userDerivedFieldIds(
  baseModel: IBaseModelSqlV2,
  columns: Column[],
): Promise<Set<string>> {
  const { context } = baseModel;
  if (!context.is_public && !isSharedViewAccess(context)) {
    return Promise.resolve(new Set());
  }
  const computed = columns.filter(isComputedField);
  if (!computed.length) return Promise.resolve(new Set());
  let verdicts = userDerivedVerdicts.get(context);
  if (!verdicts) userDerivedVerdicts.set(context, (verdicts = new Map()));
  const key = baseModel.model.id;
  let verdict = verdicts.get(key);
  if (!verdict) {
    verdict = resolveIndexFields(
      context,
      baseModel.model,
      new Set(computed.map((c) => c.id)),
    ).then(
      (fields) =>
        new Set(fields.filter((f) => f.readsUser).map((f) => f.column.id)),
    );
    verdicts.set(key, verdict);
  }
  return verdict;
}

// Per request context: link column id -> whether RLS on its related table applies.
const rlsLinkVerdicts = new WeakMap<object, Map<string, Promise<boolean>>>();

async function relatedRlsApplies(
  context: NcContext,
  modelId: string,
): Promise<boolean> {
  const model = await Model.get(context, modelId);
  if (!model) return false;
  const source = await Source.get(context, model.source_id);
  const baseModel = await Model.getBaseModelSQL(context, {
    model,
    dbDriver: await NcConnectionMgrv2.get(source),
    source,
  });
  return (await baseModel.getRlsConditions()).length > 0;
}

/**
 * Whether row-level security on the link's related table applies to the
 * requester. The grid reads lookups through that RLS; index cells are not
 * built for the requester, so they can hold rows it hides.
 */
function isLinkTargetRlsRestricted(
  context: NcContext,
  link: LinkToAnotherRecordColumn,
): Promise<boolean> {
  if (!context.user?.id) return Promise.resolve(false);
  const key = link.fk_column_id;
  let verdicts = rlsLinkVerdicts.get(context);
  if (!verdicts) rlsLinkVerdicts.set(context, (verdicts = new Map()));
  let verdict = key ? verdicts.get(key) : undefined;
  if (!verdict) {
    verdict = relatedRlsApplies(
      relatedBaseContext(context, link),
      link.fk_related_model_id,
    );
    if (key) verdicts.set(key, verdict);
  }
  return verdict;
}

// Per request context: field id -> whether it reads through a restricted link.
const restrictedFieldVerdicts = new WeakMap<
  object,
  Map<string, Promise<boolean>>
>();

async function readsRestrictedLink(
  context: NcContext,
  paths: DependencyPath[],
): Promise<boolean> {
  for (const linkId of new Set(paths.flatMap((p) => p.links))) {
    const link = await Column.get(context, { colId: linkId });
    const options = await link?.getColOptions<LinkToAnotherRecordColumn>();
    if (!options) continue;
    if (
      (await isLinkTargetHidden(context, options)) ||
      (await isLinkTargetRlsRestricted(context, options))
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Tier 1: matches come from the table's cells. Rows whose cells may be
 * behind (written but not re-indexed yet, or a cut-off text cell) are matched
 * by the same cells derived live. A field the index doesn't hold isn't
 * searched.
 */
export class IndexSearchProvider implements SearchProvider {
  readonly tier = 1;

  constructor(private readonly scan: ScanSearchProvider) {}

  /**
   * The view's searchable fields, less those reading through a link to a
   * table hidden from the requester or filtered by its RLS: their cells hold
   * that table's values.
   */
  private async searchableColumns(baseModel: IBaseModelSqlV2) {
    const columns = await this.scan.searchableColumns(baseModel);
    const { context } = baseModel;
    if (!canHideLinkTargets(context) && !context.user?.id) return columns;
    const computed = columns.filter(isComputedField);
    if (!computed.length) return columns;
    const verdicts =
      restrictedFieldVerdicts.get(context) ??
      new Map<string, Promise<boolean>>();
    restrictedFieldVerdicts.set(context, verdicts);
    const pending = new Set(
      computed.filter((c) => !verdicts.has(c.id)).map((c) => c.id),
    );
    if (pending.size) {
      const resolved = resolveIndexFields(context, baseModel.model, pending);
      for (const id of pending) {
        verdicts.set(
          id,
          resolved.then((fields) => {
            const field = fields.find((f) => f.column.id === id);
            return !!field && readsRestrictedLink(context, field.paths);
          }),
        );
      }
    }
    const flags = await Promise.all(computed.map((c) => verdicts.get(c.id)));
    const hidden = new Set(
      computed.filter((_, i) => flags[i]).map((c) => c.id),
    );
    return hidden.size ? columns.filter((c) => !hidden.has(c.id)) : columns;
  }

  /**
   * The searchable fields the index can hold, and those it serves now. On a
   * public or shared request, fields built from a User field are matched
   * live (`liveOnly`): their cells hold emails, the request sees names. On
   * a table too large to read live they aren't searched.
   */
  private async indexedFields(baseModel: IBaseModelSqlV2) {
    const model = baseModel.model;
    const meta = getSearchIndexMeta(model);
    const columns = await this.searchableColumns(baseModel);
    const all = model.columns ?? [];
    // A link or lookup counts once the index tracks it: one it can't hold
    // (cross-base, many-side) never will be.
    const indexable = columns
      .map((column) => ({ column, kind: cellKindOf(column, all) }))
      .filter(
        (c): c is IndexedField =>
          !!c.kind &&
          (!isComputedField(c.column) || !!meta?.fields?.[c.column.id]),
      );
    const userDerived = await userDerivedFieldIds(
      baseModel,
      indexable.map((c) => c.column),
    );
    // Matched row by row, so only on a table small enough to read live; a
    // larger one leaves them out of the search.
    const liveOnly =
      userDerived.size && (await liveSearchable(baseModel))
        ? indexable.filter((c) => userDerived.has(c.column.id))
        : [];
    const indexed = userDerived.size
      ? indexable.filter((c) => !userDerived.has(c.column.id))
      : indexable;
    const served = indexed.filter((c) => isColumnServedByIndex(c.column, meta));
    return { indexable: indexed, served, liveOnly };
  }

  /**
   * Rows whose served fields match `request`, derived live: the index's own
   * predicate, so it agrees with the index on which rows match. Undefined
   * when no field is served.
   */
  async liveMatch(
    baseModel: IBaseModelSqlV2,
    request: SearchRequest,
  ): Promise<FilterRawClause | undefined> {
    const indexed = await this.indexedFields(baseModel);
    const served = [...indexed.served, ...indexed.liveOnly];
    if (!served.length) return undefined;
    const term = await classifySearchTerm(
      baseModel,
      request.term,
      request.scan,
    );
    return liveCellMatchClause(
      baseModel,
      served.map((f) => f.column),
      cellMatchFor(
        served,
        term,
        request.timezone,
        await publicUserIds(baseModel, served, request.term),
      ),
    );
  }

  async match(
    baseModel: IBaseModelSqlV2,
    request: SearchRequest,
  ): Promise<SearchMatch> {
    const model = baseModel.model;
    const meta = getSearchIndexMeta(model);
    const term = await classifySearchTerm(baseModel, request.term);

    const { indexable, served, liveOnly } = await this.indexedFields(baseModel);
    if (getSearchStaleSince(model) || served.length < indexable.length) {
      reportSearchState('catching_up');
    }
    const liveOnlyFilter = liveOnly.length
      ? rawFilter(
          baseModel,
          await liveCellMatchClause(
            baseModel,
            liveOnly.map((f) => f.column),
            cellMatchFor(liveOnly, term, request.timezone),
          ),
          'or',
        )
      : undefined;
    if (!served.length && liveOnlyFilter) {
      return { kind: 'condition', filters: [liveOnlyFilter] };
    }

    const match = cellMatchFor(
      served,
      term,
      request.timezone,
      await publicUserIds(baseModel, served, request.term),
    );

    const path = searchLiveTarget(model).path;
    const liveCells = behindLiveCells();
    const fieldCount = Math.max(1, served.length);
    const probe = await probeGridSearch(
      baseModel.dbDriver,
      path,
      model.id,
      match,
      {
        rows: meta.last_build?.rows,
        behindCap: Math.floor(liveCells / fieldCount) + 1,
      },
    );
    const liveClause = () =>
      liveCellMatchClause(
        baseModel,
        served.map((f) => f.column),
        match,
      );
    // Rows the cells may not reflect yet are derived live. After a large
    // write they are matched by their cells as they stand until the flush
    // catches up, and the results say so; cut-off text is still derived live.
    // A list too long to derive on its own (undefined) is checked in the query.
    let behindIds = probe.behind;
    let marksByCells = false;
    const overBudget = (ids?: string[]) =>
      ids === undefined || ids.length * fieldCount > liveCells;
    if (overBudget(behindIds)) {
      // Cut-off rows never clear: only marks count against the budget.
      const marked = await markedRowIds(
        baseModel.dbDriver,
        path,
        model.id,
        Math.floor(liveCells / fieldCount) + 1,
      );
      if (overBudget(marked)) {
        marksByCells = true;
        behindIds = await partialRowIds(
          baseModel.dbDriver,
          path,
          model.id,
          match.pattern ? match.textCols : [],
        );
        reportSearchState('catching_up');
      } else {
        behindIds = undefined;
      }
    }
    const { candidates, settled } = cellSearchClauses(
      baseModel,
      meta.row_id_type,
      path,
      match,
      { ...probe, behind: behindIds, marksByCells },
    );
    const live = rawFilter(
      baseModel,
      behindIds === undefined
        ? await liveClause()
        : behindIds.length
        ? await behindLiveMatches(baseModel, meta.row_id_type, behindIds, {
            key: JSON.stringify([model.id, match, behindIds.length]),
            live: await liveClause(),
          })
        : (qb) => qb.whereRaw('false'),
      'or',
    );

    const indexMatch = new Filter({
      is_group: true,
      logical_op: liveOnlyFilter ? 'or' : 'and',
      children: [
        rawFilter(baseModel, candidates, 'and'),
        new Filter({
          is_group: true,
          logical_op: 'and',
          children: [rawFilter(baseModel, settled, 'and'), live],
        }),
      ],
    });
    return {
      kind: 'condition',
      filters: liveOnlyFilter
        ? [
            new Filter({
              is_group: true,
              logical_op: 'and',
              children: [indexMatch, liveOnlyFilter],
            }),
          ]
        : [indexMatch],
    };
  }

  /**
   * No index to read yet (first build, or a failed one): every field a build
   * would index, matched by the cells it would write, derived live.
   */
  async matchUnindexed(
    baseModel: IBaseModelSqlV2,
    request: SearchRequest,
  ): Promise<{ kind: 'condition'; filters: Filter[] }> {
    const model = baseModel.model;
    const term = await classifySearchTerm(
      baseModel,
      request.term,
      request.scan,
    );
    const searchable = await this.searchableColumns(baseModel);
    const indexable = new Set(
      (
        await resolveIndexFields(
          baseModel.context,
          model,
          new Set(searchable.map((c) => c.id)),
        )
      ).map((f) => f.column.id),
    );
    const all = model.columns ?? [];
    const fields = searchable
      .filter((column) => indexable.has(column.id))
      .map((column) => ({ column, kind: cellKindOf(column, all) }))
      .filter((f): f is IndexedField => !!f.kind);
    const match = cellMatchFor(
      fields,
      term,
      request.timezone,
      await publicUserIds(baseModel, fields, request.term),
    );
    return {
      kind: 'condition',
      filters: [
        rawFilter(
          baseModel,
          await liveCellMatchClause(
            baseModel,
            fields.map((f) => f.column),
            match,
          ),
          'and',
        ),
      ],
    };
  }
}
