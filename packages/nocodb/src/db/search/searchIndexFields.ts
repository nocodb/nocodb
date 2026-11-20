import { createHash } from 'crypto';
import {
  ButtonActionsType,
  COMPARISON_SUB_OPS,
  CURRENT_USER_TOKEN,
  formulaJsep,
  getMemberPath,
  isAIPromptCol,
  isMMOrMMLike,
  isNumericSearchDt,
  isSystemColumn,
  isVirtualCol,
  RelationTypes,
  searchMatchKind,
  UITypes,
} from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { NcContext } from '~/interface/config';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type {
  ButtonColumn,
  FormulaColumn,
  LinkToAnotherRecordColumn,
  LookupColumn,
  RollupColumn,
} from '~/models';
import { Column, Filter, Model } from '~/models';
import generateLookupSelectQuery, {
  getDisplayValueOfRefTable,
} from '~/db/generateLookupSelectQuery';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';
import genRollupSelectv2 from '~/db/genRollupSelectv2';
import { loadLookupSortAndLimit } from '~/db/lookupSortLimit';
import { rawFromBuilder } from '~/helpers/sqlSanitize';
import { CTEGenerator } from '~/db/cte-generator';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

/** Text fields indexed from their own column. */
export const STORED_TYPES = new Set<string>([
  UITypes.SingleLineText,
  UITypes.LongText,
  UITypes.Email,
  UITypes.URL,
  UITypes.PhoneNumber,
  UITypes.SingleSelect,
  UITypes.MultiSelect,
]);

/** How a field's value is held in the index: one cell row per field and record. */
export type CellKind = 'txt' | 'num' | 'day' | 'ts' | 'user';

// Indexed as text though the grid's live match doesn't read them.
const EXTRA_TEXT_TYPES = new Set<string>([
  UITypes.JSON,
  UITypes.UUID,
  UITypes.Attachment,
]);

const USER_TYPES = new Set<string>([
  UITypes.User,
  UITypes.CreatedBy,
  UITypes.LastModifiedBy,
]);

// A field of these types reads the table's system column of the same type.
const SYSTEM_BACKED_TYPES = new Set<string>([
  UITypes.CreatedTime,
  UITypes.LastModifiedTime,
  UITypes.CreatedBy,
  UITypes.LastModifiedBy,
]);

/** Fields indexed from their linked records' values. */
const COMPUTED_TYPES = new Set<string>([
  UITypes.LinkToAnotherRecord,
  UITypes.Links,
  UITypes.Lookup,
]);

/** Fields indexed from an expression the read path computes per row. */
const DERIVED_TYPES = new Set<string>([
  UITypes.Formula,
  UITypes.Rollup,
  UITypes.Button,
]);

// Formula functions whose value moves with the clock: never indexed.
const VOLATILE_FUNCTIONS = new Set(['NOW', 'TODAY']);

// Nested formulas, lookups and rollups followed when resolving dependencies.
const MAX_DEPENDENCY_DEPTH = 6;

// A Links field shows its linked record's title only on the "one" side.
const SINGLE_LINK_TYPES = new Set<string>(['bt', 'mo', 'oo']);

// Types a link or lookup may end at: their values are indexed as text, one
// per line.
const LEAF_TYPES = new Set<string>([
  ...STORED_TYPES,
  UITypes.Number,
  UITypes.AutoNumber,
  UITypes.Year,
  UITypes.ID,
  UITypes.Decimal,
  UITypes.Currency,
  UITypes.Percent,
  UITypes.Rating,
  UITypes.Date,
  UITypes.DateTime,
  UITypes.CreatedTime,
  UITypes.LastModifiedTime,
]);

const MAX_LOOKUP_DEPTH = 3;

// Text a cell contributes to its row's document; a longer cell marks the row partial.
export const MAX_CELL_CHARS = 250_000;
/** The values of a many-valued lookup's JSON list: strings and numbers. */
const JSON_VALUES_PATH =
  'strict $.** ? (@.type() == "string" || @.type() == "number")';

/**
 * How a field's cells become document text. A new version re-indexes the
 * tables with fields of that kind.
 */
const EXPRESSION_VERSIONS = {
  text: 2,
  computed: 1,
  derived: 1,
  number: 1,
  date: 1,
  datetime: 1,
  user: 1,
} as const;
type ExpressionKind = keyof typeof EXPRESSION_VERSIONS;

// Reverse-walking more rows than this rebuilds the dependent table instead.
const FANOUT_CAP = 50_000;
const WALK_CHUNK = 5_000;

/** Link column ids from the indexed table outward; `end` is the table reached. */
export interface DependencyPath {
  links: string[];
  end: string;
}

export interface IndexField {
  column: Column;
  /** Empty for a stored field. */
  paths: DependencyPath[];
  /** Digest of the linked columns read through `paths`; unset for a stored field. */
  linkedDigest?: string;
  /** Its value is built from a User field: the cell holds emails. */
  readsUser?: boolean;
}

const readsUserField = (reads: unknown[]) =>
  reads.some(
    (r) =>
      Array.isArray(r) &&
      Array.isArray(r[1]) &&
      typeof r[1][0] === 'string' &&
      USER_TYPES.has(r[1][0]),
  );

function parseJson(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) ?? {};
    } catch {
      return {};
    }
  }
  return value as Record<string, unknown>;
}

/** The kind a field with its own value is indexed as, from its type alone. */
function storedKindOf(column: Column): CellKind | undefined {
  if (USER_TYPES.has(column.uidt)) return 'user';
  if (EXTRA_TEXT_TYPES.has(column.uidt)) return 'txt';
  switch (
    searchMatchKind({ uidt: column.uidt, dt: column.dt, meta: column.meta })
  ) {
    case 'text':
      return 'txt';
    case 'number':
      return 'num';
    case 'date':
      return column.uidt === UITypes.Date ? 'day' : 'ts';
    default:
      return undefined;
  }
}

/** The physical column a field's value is read from. */
function backingColumn(column: Column, columns: Column[]) {
  if (SYSTEM_BACKED_TYPES.has(column.uidt)) {
    if (column.system && column.column_name) return column;
    return columns.find(
      (c) => c.system && c.uidt === column.uidt && c.column_name,
    );
  }
  if (isVirtualCol(column) || !column.column_name) return undefined;
  return column;
}

/** A day or an instant is read only from a column Postgres stores as one. */
function fitsStorage(kind: CellKind, source: Column) {
  const dt = `${source.dt ?? ''}`;
  if (kind === 'day') return /^date$/i.test(dt);
  if (kind === 'ts') return /timestamp/i.test(dt);
  return true;
}

/**
 * Formulas and rollups by their result: text, number, or a day (a date
 * result matches its whole day, as the live match does). URL buttons as
 * text.
 */
function derivedKindOf(column: Column): CellKind | undefined {
  switch (column.uidt) {
    case UITypes.Button: {
      const options = column.colOptions as ButtonColumn;
      return options?.type === ButtonActionsType.Url &&
        options.formula &&
        !options.error
        ? 'txt'
        : undefined;
    }
    case UITypes.Formula:
    case UITypes.Rollup: {
      const options = column.colOptions as FormulaColumn | RollupColumn;
      if (!options || options.error) return undefined;
      switch (
        searchMatchKind({
          uidt: column.uidt,
          dt: column.dt,
          meta: column.meta,
          colOptions: options,
        })
      ) {
        case 'text':
          return 'txt';
        case 'number':
          return 'num';
        case 'date':
          return 'day';
        default:
          return undefined;
      }
    }
  }
  return undefined;
}

/**
 * How `column` is indexed; undefined when it isn't. System fields only as
 * the display value.
 */
export function cellKindOf(
  column: Column,
  columns: Column[],
): CellKind | undefined {
  if (isSystemColumn(column) && !column.pv) return undefined;
  if (COMPUTED_TYPES.has(column.uidt)) return 'txt';
  if (DERIVED_TYPES.has(column.uidt)) return derivedKindOf(column);
  const kind = storedKindOf(column);
  if (!kind) return undefined;
  const source = backingColumn(column, columns);
  return source && fitsStorage(kind, source) ? kind : undefined;
}

/**
 * A link, lookup, formula or rollup: whether the index holds it is known
 * only once its dependencies are resolved.
 */
export function isComputedField(column: Column) {
  return COMPUTED_TYPES.has(column.uidt) || DERIVED_TYPES.has(column.uidt);
}

const KIND_EXPRESSIONS: Record<CellKind, ExpressionKind> = {
  txt: 'text',
  num: 'number',
  day: 'date',
  ts: 'datetime',
  user: 'user',
};

function expressionKind(column: Column): ExpressionKind {
  if (COMPUTED_TYPES.has(column.uidt)) return 'computed';
  if (DERIVED_TYPES.has(column.uidt)) return 'derived';
  const kind = storedKindOf(column);
  return kind ? KIND_EXPRESSIONS[kind] : 'text';
}

/**
 * What a field's cells are derived from; a title, description or database
 * column name isn't (cells are keyed by column id, and reads use the current name).
 */
function cellInputs(column: Column): unknown[] {
  const inputs: unknown[] = [column.uidt, column.dt];
  switch (column.uidt) {
    case UITypes.LongText:
      if (isAIPromptCol(column)) inputs.push('ai');
      break;
    case UITypes.SingleSelect:
    case UITypes.MultiSelect: {
      const options = (column.colOptions as { options?: { title: string }[] })
        ?.options;
      inputs.push((options ?? []).map((o) => o.title).sort());
      break;
    }
    case UITypes.Lookup: {
      const options = column.colOptions as LookupColumn;
      inputs.push(options?.fk_relation_column_id, options?.fk_lookup_column_id);
      break;
    }
    case UITypes.LinkToAnotherRecord:
    case UITypes.Links: {
      const options = column.colOptions as LinkToAnotherRecordColumn;
      inputs.push(options?.fk_related_model_id, options?.type);
      break;
    }
    case UITypes.Formula: {
      inputs.push((column.colOptions as FormulaColumn)?.formula);
      break;
    }
    case UITypes.Button: {
      const options = column.colOptions as ButtonColumn;
      inputs.push(options?.type, options?.formula);
      break;
    }
    case UITypes.Rollup: {
      const options = column.colOptions as RollupColumn;
      inputs.push(
        options?.fk_relation_column_id,
        options?.fk_rollup_column_id,
        options?.rollup_function,
        options?.rollup_formula,
      );
      break;
    }
  }
  return inputs;
}

/**
 * Version stamp of how a field's cells are written: the expression version
 * and a digest of the column settings that feed them.
 */
const shortDigest = (value: unknown) =>
  createHash('sha1')
    .update(JSON.stringify(value))
    .digest('base64url')
    .slice(0, 12);

export function fieldExpressionVersion(column: Column) {
  const kind = expressionKind(column);
  return `${kind}:${EXPRESSION_VERSIONS[kind]}:${shortDigest(
    cellInputs(column),
  )}`;
}

/** SQL inlined into a raw: a bare `?` (in a name or a value) would read as a binding. */
const inlineSql = (raw: Knex.Raw) => raw.toQuery().replace(/\?/g, '\\?');

/**
 * `sql` with the CTEs it names (a formula's base-user list) inlined: the
 * statements a cell value goes into have no WITH for them.
 */
async function withNamedCtes(baseModel: IBaseModelSqlV2, sql: string) {
  const knex = baseModel.dbDriver;
  const blocks = [...(knex._cteGenerator?.blocks.values() ?? [])].filter(
    (block) => sql.includes(block.alias),
  );
  // A formula built from a cached plan registers no block of its own.
  const baseUsers = `nc_base_user_${baseModel.context.base_id}`;
  if (sql.includes(baseUsers) && !blocks.some((b) => b.alias === baseUsers)) {
    blocks.push(
      await new CTEGenerator({ context: baseModel.context, knex }).baseUser({
        context: baseModel.context,
      }),
    );
  }
  if (!blocks.length) return sql;
  const qb = knex.queryBuilder().select(knex.raw(sql));
  for (const block of blocks) {
    block.applyCte(qb, { context: baseModel.context, knex });
  }
  return `(${qb.toQuery().replace(/\?/g, '\\?')})`;
}

/** The strings and numbers of a jsonb document, one per line. */
const jsonValuesText = (jsonbSql: string) => `(
  SELECT string_agg(v #>> '{}', E'\\n')
  FROM jsonb_path_query(${jsonbSql},
    '${JSON_VALUES_PATH.replace(/\?/g, '\\?')}') AS v
)`;

/** Same base and source, so one statement on one connection can read it. */
function isLocalLink(
  context: NcContext,
  model: Model,
  options: LinkToAnotherRecordColumn,
  related: Model | undefined,
) {
  if (!related || related.source_id !== model.source_id) return false;
  if (
    options.fk_related_base_id &&
    options.fk_related_base_id !== context.base_id
  )
    return false;
  if (options.fk_mm_base_id && options.fk_mm_base_id !== context.base_id)
    return false;
  return (
    !options.fk_mm_source_id || options.fk_mm_source_id === model.source_id
  );
}

// Sub-ops whose date moves with the clock; `exactDate` doesn't.
const RELATIVE_SUB_OPS = new Set<string>(
  COMPARISON_SUB_OPS.filter((op) => op !== 'exactDate'),
);

/** `enabled` explicitly off, as a boolean or a 0/1 int. */
const isOff = (enabled: unknown) => enabled === false || enabled === 0;

/** A condition tree's inputs; undefined when it depends on the clock or the viewer. */
async function conditionInputs(
  filters: Filter[] | null | undefined,
): Promise<unknown[] | undefined> {
  const out: unknown[] = [];
  for (const f of filters ?? []) {
    const value = typeof f.value === 'string' ? f.value : `${f.value ?? ''}`;
    if (
      f.comparison_op === 'isWithin' ||
      (f.comparison_sub_op && RELATIVE_SUB_OPS.has(f.comparison_sub_op)) ||
      value.includes(CURRENT_USER_TOKEN) ||
      value.includes('{currentUser')
    ) {
      return undefined;
    }
    const children = f.is_group
      ? await conditionInputs(await f.getChildren?.())
      : [];
    if (!children) return undefined;
    out.push([
      f.logical_op,
      f.fk_column_id,
      f.comparison_op,
      f.comparison_sub_op,
      value,
      f.fk_value_col_id,
      isOff(f.enabled),
      children,
    ]);
  }
  return out;
}

/**
 * The limit, sorts and conditions a lookup's cell is built with, as in effect
 * now (a plan without the feature drops sort and limit); undefined when its
 * conditions can't be indexed.
 */
async function lookupSettings(
  context: NcContext,
  column: Column,
): Promise<unknown[] | undefined> {
  const { sorts, limitVal, takeLast } = await loadLookupSortAndLimit(
    context,
    column,
  );
  let conditions: unknown[] = [];
  let toggle = false;
  if (parseJson(column.meta).enableConditions) {
    toggle = await Filter.supportToggle(context);
    conditions = await conditionInputs(
      await Filter.rootFilterListByLink(
        { ...context, base_id: column.base_id ?? context.base_id },
        { columnId: column.id },
      ),
    );
    if (!conditions) return undefined;
  }
  return [
    limitVal,
    takeLast,
    sorts.map((s) => [s.fk_column_id, s.direction, isOff(s.enabled)]),
    conditions,
    toggle,
  ];
}

async function linkTarget(context: NcContext, model: Model, link: Column) {
  if (
    link.uidt !== UITypes.LinkToAnotherRecord &&
    link.uidt !== UITypes.Links
  ) {
    return undefined;
  }
  const options = await link.getColOptions<LinkToAnotherRecordColumn>();
  const related = await options?.getRelatedTable();
  if (!options || !isLocalLink(context, model, options, related)) {
    return undefined;
  }
  await related.getColumns();
  return related;
}

/**
 * The link paths a computed field reads through; undefined when the field
 * can't be indexed (cross-base, too deep, or a non-text value).
 */
async function computedPaths(
  context: NcContext,
  model: Model,
  column: Column,
  reads: unknown[],
  depth = 0,
): Promise<DependencyPath[] | undefined> {
  if (depth >= MAX_LOOKUP_DEPTH) return undefined;

  let link: Column;
  let leaf: Column;
  let related: Model;
  if (
    column.uidt === UITypes.LinkToAnotherRecord ||
    column.uidt === UITypes.Links
  ) {
    link = column;
    if (column.uidt === UITypes.Links) {
      const options = await link.getColOptions<LinkToAnotherRecordColumn>();
      // Many-side Links fields display a count, not text.
      if (!SINGLE_LINK_TYPES.has(options?.type)) return undefined;
    }
    related = await linkTarget(context, model, link);
    if (!related) return undefined;
    leaf = await getDisplayValueOfRefTable(context, link);
  } else if (column.uidt === UITypes.Lookup) {
    const options = await column.getColOptions<LookupColumn>();
    if (!options || options.error) return undefined;
    const settings = await lookupSettings(context, column);
    if (!settings) return undefined;
    reads.push([column.id, settings]);
    link =
      model.columns?.find((c) => c.id === options.fk_relation_column_id) ??
      (await Column.get(context, { colId: options.fk_relation_column_id }));
    if (!link) return undefined;
    related = await linkTarget(context, model, link);
    if (!related) return undefined;
    leaf = related.columns.find((c) => c.id === options.fk_lookup_column_id);
  } else {
    return undefined;
  }
  // Matched live by its unwrapped value; the lookup query reads the raw JSON.
  if (!leaf || isAIPromptCol(leaf)) return undefined;

  reads.push([link.id, cellInputs(link)], [leaf.id, cellInputs(leaf)]);
  const own: DependencyPath = { links: [link.id], end: related.id };
  if (COMPUTED_TYPES.has(leaf.uidt)) {
    const nested = await computedPaths(
      context,
      related,
      leaf,
      reads,
      depth + 1,
    );
    if (!nested) return undefined;
    return [
      own,
      ...nested.map((p) => ({ links: [link.id, ...p.links], end: p.end })),
    ];
  }
  if (isVirtualCol(leaf) || !LEAF_TYPES.has(leaf.uidt)) return undefined;
  return [own];
}

/**
 * Each field reference of a formula, as its hops: `{Link}.{Field}` is
 * `[link, field]`. Undefined when it calls a clock function or won't parse.
 */
function formulaRefPaths(formula: string): string[][] | undefined {
  let tree: unknown;
  try {
    tree = formulaJsep(formula);
  } catch {
    return undefined;
  }
  const paths: string[][] = [];
  let volatile = false;
  // jsep nodes are untyped.
  const walk = (node: any) => {
    if (!node || typeof node !== 'object' || volatile) return;
    if (Array.isArray(node)) return node.forEach(walk);
    switch (node.type) {
      case 'Identifier':
        paths.push([node.name]);
        return;
      case 'MemberExpression': {
        const path = getMemberPath(node);
        if (path) {
          paths.push(path.map((n) => n.name));
          return;
        }
        // A method call on a path, e.g. `{Tasks}.{Hours}.SUM()`.
        walk(node.object);
        if (node.computed) walk(node.property);
        return;
      }
      case 'CallExpression':
        if (node.callee?.type === 'Identifier') {
          volatile ||= VOLATILE_FUNCTIONS.has(
            `${node.callee.name}`.toUpperCase(),
          );
        } else {
          walk(node.callee);
        }
        walk(node.arguments);
        return;
      default:
        Object.keys(node).forEach((key) => walk(node[key]));
    }
  };
  walk(tree);
  return volatile ? undefined : paths;
}

const prefixPaths = (linkId: string, paths: DependencyPath[]) =>
  paths.map((p) => ({ links: [linkId, ...p.links], end: p.end }));

function uniquePaths(paths: DependencyPath[]) {
  const seen = new Map<string, DependencyPath>();
  for (const p of paths) seen.set(`${p.end}:${p.links.join()}`, p);
  return [...seen.values()];
}

/** The dependencies of one formula reference, followed hop by hop. */
async function refPathDeps(
  context: NcContext,
  model: Model,
  hops: string[],
  reads: unknown[],
  depth: number,
): Promise<DependencyPath[] | undefined> {
  const columns = model.columns ?? (await model.getColumns());
  const column = columns.find((c) => c.id === hops[0]);
  // Not a field: nothing to depend on.
  if (!column) return [];
  if (hops.length === 1) {
    return valueDeps(context, model, column, reads, depth + 1);
  }
  const related = await linkTarget(context, model, column);
  if (!related) return undefined;
  reads.push([column.id, cellInputs(column)]);
  const nested = await refPathDeps(
    context,
    related,
    hops.slice(1),
    reads,
    depth + 1,
  );
  if (!nested) return undefined;
  return [
    { links: [column.id], end: related.id },
    ...prefixPaths(column.id, nested),
  ];
}

async function formulaDeps(
  context: NcContext,
  model: Model,
  formula: string,
  reads: unknown[],
  depth: number,
): Promise<DependencyPath[] | undefined> {
  const refs = formulaRefPaths(formula);
  if (!refs) return undefined;
  const out: DependencyPath[] = [];
  for (const hops of refs) {
    const paths = await refPathDeps(context, model, hops, reads, depth);
    if (!paths) return undefined;
    out.push(...paths);
  }
  return out;
}

/**
 * The link paths a field's displayed value reads through, from `model`;
 * empty when it reads only its own row. Undefined when it can't be indexed:
 * a clock function, an error, a cross-base link, or too deep. `reads`
 * collects the settings the value is built from.
 */
async function valueDeps(
  context: NcContext,
  model: Model,
  column: Column,
  reads: unknown[],
  depth: number,
): Promise<DependencyPath[] | undefined> {
  if (depth > MAX_DEPENDENCY_DEPTH) return undefined;
  const columns = model.columns ?? (await model.getColumns());
  reads.push([column.id, cellInputs(column)]);

  switch (column.uidt) {
    case UITypes.Formula: {
      const options = column.colOptions as FormulaColumn;
      if (!options?.formula || options.error) return undefined;
      return formulaDeps(context, model, options.formula, reads, depth);
    }
    case UITypes.Button: {
      const options = column.colOptions as ButtonColumn;
      if (
        options?.type !== ButtonActionsType.Url ||
        !options.formula ||
        options.error
      ) {
        return undefined;
      }
      return formulaDeps(context, model, options.formula, reads, depth);
    }
    case UITypes.Rollup: {
      const options = column.colOptions as RollupColumn;
      if (!options || (options.error && !options.data_error)) return undefined;
      const link = columns.find((c) => c.id === options.fk_relation_column_id);
      const related = link && (await linkTarget(context, model, link));
      if (!related) return undefined;
      let nested: DependencyPath[] | undefined = [];
      if (options.rollup_formula) {
        nested = await formulaDeps(
          context,
          related,
          options.rollup_formula,
          reads,
          depth + 1,
        );
      } else {
        const rolled = related.columns.find(
          (c) => c.id === options.fk_rollup_column_id,
        );
        nested = rolled
          ? await valueDeps(context, related, rolled, reads, depth + 1)
          : undefined;
      }
      if (!nested) return undefined;
      return [
        { links: [link.id], end: related.id },
        ...prefixPaths(link.id, nested),
      ];
    }
    case UITypes.Lookup:
    case UITypes.LinkToAnotherRecord:
    case UITypes.Links: {
      let link = column;
      if (column.uidt === UITypes.Lookup) {
        const options = column.colOptions as LookupColumn;
        if (!options || options.error) return undefined;
        const settings = await lookupSettings(context, column);
        if (!settings) return undefined;
        reads.push([column.id, settings]);
        link =
          columns.find((c) => c.id === options.fk_relation_column_id) ??
          (await Column.get(context, { colId: options.fk_relation_column_id }));
        if (!link) return undefined;
      }
      const related = await linkTarget(context, model, link);
      if (!related) return undefined;
      const own: DependencyPath = { links: [link.id], end: related.id };
      if (column.uidt === UITypes.Links) {
        const options = column.colOptions as LinkToAnotherRecordColumn;
        // A many-side Links field is a count: only which records are linked.
        if (!SINGLE_LINK_TYPES.has(options?.type)) return [own];
      }
      const leaf =
        column.uidt === UITypes.Lookup
          ? related.columns.find(
              (c) =>
                c.id ===
                (column.colOptions as LookupColumn).fk_lookup_column_id,
            )
          : await getDisplayValueOfRefTable(context, link);
      if (!leaf) return undefined;
      const nested = await valueDeps(context, related, leaf, reads, depth + 1);
      if (!nested) return undefined;
      return [own, ...prefixPaths(link.id, nested)];
    }
    default:
      // A value of the row itself.
      return isVirtualCol(column) && !SYSTEM_BACKED_TYPES.has(column.uidt)
        ? undefined
        : [];
  }
}

/**
 * The table's fields the index can hold, with what each depends on; with
 * `only`, just those among the given field ids.
 */
export async function resolveIndexFields(
  context: NcContext,
  model: Model,
  only?: ReadonlySet<string>,
): Promise<IndexField[]> {
  const columns = await model.getColumns();
  const fields: IndexField[] = [];
  for (const column of columns) {
    if (only && !only.has(column.id)) continue;
    if (!cellKindOf(column, columns)) continue;
    const reads: unknown[] = [];
    if (DERIVED_TYPES.has(column.uidt)) {
      const paths = await valueDeps(context, model, column, reads, 0);
      if (paths) {
        fields.push({
          column,
          paths: uniquePaths(paths),
          linkedDigest: shortDigest(reads),
          readsUser: readsUserField(reads),
        });
      }
      continue;
    }
    if (!COMPUTED_TYPES.has(column.uidt)) {
      fields.push({ column, paths: [] });
      continue;
    }
    const paths = await computedPaths(context, model, column, reads);
    if (paths) {
      fields.push({
        column,
        paths,
        linkedDigest: shortDigest(reads),
        readsUser: readsUserField(reads),
      });
    }
  }
  return fields;
}

/** A field's cell values in the row aliased `t`; each slot NULL when unset. */
export interface CellValueSql {
  kind: CellKind;
  txt?: Knex.Raw;
  num?: Knex.Raw;
  day?: Knex.Raw;
  ts?: Knex.Raw;
  /** User ids as text, comma-separated: mapped to names through the users list. */
  userIds?: Knex.Raw;
}

// A plain decimal or exponent number, as text; `\\?` keeps `?` out of bindings.
const NUMBER_TEXT =
  '^[-+]\\?([0-9]+[.]\\?[0-9]*|[.][0-9]+)([eE][-+]\\?[0-9]+)\\?$';

/**
 * A formula, URL button or rollup value in the row aliased `t`, as the read
 * path builds it, cast to the field's kind without a cast error.
 */
async function derivedValueSql(
  baseModel: IBaseModelSqlV2,
  column: Column,
  kind: CellKind,
): Promise<CellValueSql | undefined> {
  const knex = baseModel.dbDriver;
  const columns = baseModel.model.columns ?? [];
  let value: string;
  if (column.uidt === UITypes.Rollup) {
    const { builder, isError } = await genRollupSelectv2({
      baseModelSqlv2: baseModel,
      knex,
      columnOptions: column.colOptions as RollupColumn,
      alias: 't',
    });
    if (isError) return undefined;
    value = await withNamedCtes(
      baseModel,
      `(${inlineSql(rawFromBuilder(knex, builder))})`,
    );
  } else {
    const formula =
      column.uidt === UITypes.Button
        ? (column.colOptions as ButtonColumn).formula
        : (column.colOptions as FormulaColumn).formula;
    const { builder } = await formulaQueryBuilderv2({
      baseModel,
      tree: formula,
      model: baseModel.model,
      column,
      tableAlias: 't',
      columns,
    });
    value = await withNamedCtes(
      baseModel,
      typeof builder === 'object' && 'toQuery' in builder
        ? `(${builder.toQuery().replace(/\?/g, '\\?')})`
        : inlineSql(knex.raw('??', [builder])),
    );
  }

  // Read once per row, then parsed: an ERR text or a bad date stays NULL.
  const asText = (expr: string) =>
    `(SELECT ${expr} FROM (SELECT ${value}::text AS v) AS nc_v)`;
  switch (kind) {
    case 'num':
      return {
        kind,
        num: knex.raw(
          asText(
            `CASE WHEN btrim(v) ~ '${NUMBER_TEXT}' THEN btrim(v)::numeric END`,
          ),
        ),
      };
    case 'day':
      return {
        kind,
        day: knex.raw(
          asText(
            `CASE WHEN v ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substr(v, 1, 10)::date END`,
          ),
        ),
      };
    default:
      return { kind, txt: knex.raw(`${value}::text`) };
  }
}

/**
 * A field's value in the row aliased `t`. Links and lookups read the same
 * correlated subquery list sorting uses; formulas and rollups the read
 * path's own builders. Undefined when it can't be built.
 */
export async function fieldValueSql(
  baseModel: IBaseModelSqlV2,
  column: Column,
): Promise<CellValueSql | undefined> {
  // Wrapped: a Knex.Raw is thenable, so returning one from an async function
  // would run it.
  const knex = baseModel.dbDriver;
  const columns = baseModel.model.columns ?? [];
  const kind = cellKindOf(column, columns);
  if (!kind) return undefined;

  if (DERIVED_TYPES.has(column.uidt)) {
    return derivedValueSql(baseModel, column, kind);
  }

  if (COMPUTED_TYPES.has(column.uidt)) {
    const query = await generateLookupSelectQuery({
      column,
      baseModelSqlv2: baseModel,
      alias: 't',
      model: baseModel.model,
    });
    if (!query || typeof query.builder === 'string') return undefined;
    const value = await withNamedCtes(
      baseModel,
      inlineSql(rawFromBuilder(knex, query.builder)),
    );
    // A many-valued list is JSON array text: each linked value is its own line.
    return {
      kind,
      txt: knex.raw(
        query.aggregated
          ? jsonValuesText(`(${value})::jsonb`)
          : `(${value})::text`,
      ),
    };
  }

  const source = backingColumn(column, columns);
  if (!source) return undefined;
  const col = inlineSql(knex.raw('t.??', [source.column_name]));

  switch (kind) {
    case 'txt':
      // As the live handler reads it; text that isn't an object stays as is.
      if (isAIPromptCol(column)) {
        return {
          kind,
          txt: knex.raw(
            `CASE WHEN ltrim(${col}::text) LIKE '{%'
               THEN TRIM('"' FROM (${col}::jsonb->>'value'))
               ELSE ${col}::text END`,
          ),
        };
      }
      if (column.uidt === UITypes.Attachment) {
        // File names, one per line.
        return {
          kind,
          txt: knex.raw(
            `CASE WHEN ${col}::text ~ '^\\s*\\[' THEN (
               SELECT string_agg(COALESCE(a->>'title', a->>'fileName'), E'\\n')
               FROM jsonb_array_elements(${col}::text::jsonb) AS a
               WHERE jsonb_typeof(a) = 'object'
             ) END`,
          ),
        };
      }
      return { kind, txt: knex.raw(`${col}::text`) };
    case 'num':
      // A number field over a text column holds text a cast could refuse.
      return {
        kind,
        num: knex.raw(
          isNumericSearchDt(source.dt)
            ? `${col}::numeric`
            : `CASE WHEN btrim(${col}::text) ~ '${NUMBER_TEXT}'
                 THEN btrim(${col}::text)::numeric END`,
        ),
      };
    case 'day':
      return { kind, day: knex.raw(`${col}::date`) };
    case 'ts':
      // Without a zone, a value is the session's wall clock, as reads take it.
      return {
        kind,
        ts: knex.raw(
          /with time zone|timestamptz/i.test(`${source.dt ?? ''}`)
            ? `${col}::timestamptz`
            : `(${col} AT TIME ZONE current_setting('timezone'))`,
        ),
      };
    case 'user':
      return { kind, userIds: knex.raw(`${col}::text`) };
  }
}

async function selectDistinct(
  knex: Knex,
  table: string | Knex.Raw,
  select: string,
  where: string,
  ids: Array<string | number>,
): Promise<Array<string | number> | null> {
  const out = new Set<string | number>();
  for (let i = 0; i < ids.length; i += WALK_CHUNK) {
    const rows: Record<string, string | number>[] = await knex
      .from(table)
      .distinct(select)
      .whereIn(where, ids.slice(i, i + WALK_CHUNK))
      .whereNotNull(select)
      .limit(FANOUT_CAP + 1);
    for (const row of rows) out.add(row[select]);
    if (out.size > FANOUT_CAP) return null;
  }
  return [...out];
}

type WalkIds = Array<string | number> | null;

/**
 * A link keys on `column` of `model`, which a custom link sets to a non-pk
 * field (sync tables key on RemoteId). Converts pks to its values, or back.
 */
function keyConverter(
  baseModel: IBaseModelSqlV2,
  model: Model,
  column: Column,
) {
  const pk = model.primaryKey;
  const isPk = !pk || column.id === pk.id;
  const tn = baseModel.getTnPath(model);
  return {
    fromPks: (pks: Array<string | number>): Promise<WalkIds> =>
      isPk
        ? Promise.resolve(pks)
        : selectDistinct(
            baseModel.dbDriver,
            tn,
            column.column_name,
            pk.column_name,
            pks,
          ),
    toPks: (keys: Array<string | number>): Promise<WalkIds> =>
      isPk
        ? Promise.resolve(keys)
        : selectDistinct(
            baseModel.dbDriver,
            tn,
            pk.column_name,
            column.column_name,
            keys,
          ),
  };
}

/** Rows of the link's own table linked to `relatedIds`; null past the cap. */
async function rowsLinkedTo(
  baseModel: IBaseModelSqlV2,
  link: Column,
  relatedIds: Array<string | number>,
): Promise<WalkIds> {
  const context = baseModel.context;
  const knex = baseModel.dbDriver;
  const options = await link.getColOptions<LinkToAnotherRecordColumn>();
  if (!options) return [];

  const [own, related, child, parent] = await Promise.all([
    Model.get(context, link.fk_model_id),
    options.getRelatedTable(),
    options.getChildColumn(),
    options.getParentColumn(),
  ]);
  if (!own || !related || !child || !parent) return [];
  await Promise.all([own.getColumns(), related.getColumns()]);

  if (isMMOrMMLike({ uidt: link.uidt, colOptions: options })) {
    const [mm, mmChild, mmParent] = await Promise.all([
      options.getMMModel(),
      options.getMMChildColumn(),
      options.getMMParentColumn(),
    ]);
    if (!mm || !mmChild || !mmParent) return [];
    // The junction holds the child (own) and parent (related) key values.
    const relatedKeys = await keyConverter(baseModel, related, parent).fromPks(
      relatedIds,
    );
    if (!relatedKeys?.length) return relatedKeys;
    const ownKeys = await selectDistinct(
      knex,
      baseModel.getTnPath(mm),
      mmChild.column_name,
      mmParent.column_name,
      relatedKeys,
    );
    if (!ownKeys?.length) return ownKeys;
    return keyConverter(baseModel, own, child).toPks(ownKeys);
  }

  const isBelongsTo =
    options.type === RelationTypes.BELONGS_TO ||
    (options.type === RelationTypes.ONE_TO_ONE && !!parseJson(link.meta).bt);

  if (isBelongsTo) {
    // The link's table holds the foreign key, pointing at the parent column.
    const relatedKeys = await keyConverter(baseModel, related, parent).fromPks(
      relatedIds,
    );
    if (!relatedKeys?.length) return relatedKeys;
    return selectDistinct(
      knex,
      baseModel.getTnPath(own),
      own.primaryKey.column_name,
      child.column_name,
      relatedKeys,
    );
  }

  // has-many: the related table's foreign key holds the own parent column.
  const ownKeys = await selectDistinct(
    knex,
    baseModel.getTnPath(related),
    child.column_name,
    related.primaryKey.column_name,
    relatedIds,
  );
  if (!ownKeys?.length) return ownKeys;
  return keyConverter(baseModel, own, parent).toPks(ownKeys);
}

/**
 * The rows a write to a junction table links or unlinks, per table whose
 * link field reads that junction and that `include` keeps. `rows` are
 * junction records, or their pks (read back); null when unknown, which
 * gives each table null ids, as do pks no longer there. Ids are null past
 * the fan-out cap.
 */
export async function junctionLinkedRows(
  junction: IBaseModelSqlV2,
  rows: Array<Record<string, unknown> | string | number> | null,
  include: (model: Model) => boolean,
): Promise<Array<{ model: Model; ids: WalkIds }>> {
  const context = junction.context;
  const relations: Array<{
    fk_column_id: string;
    fk_child_column_id: string;
    fk_mm_child_column_id: string;
  }> = await Noco.ncMeta.metaList2(
    context.workspace_id,
    context.base_id,
    MetaTable.COL_RELATIONS,
    { condition: { fk_mm_model_id: junction.model.id } },
  );
  const sides: Array<{
    model: Model;
    child: Column;
    mmChild: Column;
  }> = [];
  const columns = await junction.model.getColumns();
  for (const relation of relations) {
    const link = await Column.get(context, { colId: relation.fk_column_id });
    const model = link && (await Model.get(context, link.fk_model_id));
    if (!model || model.source_id !== junction.model.source_id) continue;
    if (!include(model)) continue;
    await model.getColumns();
    const child = model.columns.find(
      (c) => c.id === relation.fk_child_column_id,
    );
    const mmChild = columns.find(
      (c) => c.id === relation.fk_mm_child_column_id,
    );
    if (child && mmChild) sides.push({ model, child, mmChild });
  }
  if (!sides.length || !rows) {
    return sides.map(({ model }) => ({ model, ids: null }));
  }

  // Junction values each side needs, from the records or read back by pk.
  // Default junctions key on both link columns: their ids are `a___b`.
  const pks = junction.model.primaryKeys ?? [];
  const values = new Map<string, Set<string | number>>(
    sides.map((s) => [s.mmChild.id, new Set()]),
  );
  const add = (row: Record<string, unknown>) =>
    sides.forEach((s) => {
      const v = row[s.mmChild.column_name] ?? row[s.mmChild.title];
      if (v != null) values.get(s.mmChild.id).add(v as string | number);
    });
  const readBack: Array<Array<string | number>> = [];
  for (const entry of rows) {
    if (entry == null) continue;
    let row: Record<string, unknown>;
    if (typeof entry === 'object') {
      row = entry;
    } else {
      const parts = pks.length > 1 ? `${entry}`.split('___') : [entry];
      if (!pks.length || parts.length !== pks.length) {
        return sides.map(({ model }) => ({ model, ids: null }));
      }
      row = Object.fromEntries(pks.map((c, i) => [c.column_name, parts[i]]));
    }
    const complete = sides.every(
      (s) =>
        row[s.mmChild.column_name] !== undefined ||
        row[s.mmChild.title] !== undefined,
    );
    if (complete) {
      add(row);
      continue;
    }
    const key = pks.map((c) => row[c.column_name] ?? row[c.title]);
    if (!pks.length || key.some((v) => v == null)) {
      return sides.map(({ model }) => ({ model, ids: null }));
    }
    readBack.push(key as Array<string | number>);
  }
  for (let i = 0; i < readBack.length; i += WALK_CHUNK) {
    const chunk = readBack.slice(i, i + WALK_CHUNK);
    const qb = junction.dbDriver
      .from(junction.getTnPath(junction.model))
      .select([...new Set(sides.map((s) => s.mmChild.column_name))]);
    const found: Record<string, string | number>[] =
      pks.length === 1
        ? await qb.whereIn(
            pks[0].column_name,
            chunk.map((k) => k[0]),
          )
        : await qb.whereIn(
            pks.map((c) => c.column_name),
            chunk,
          );
    // Already deleted: what they linked is unknown.
    if (found.length < new Set(chunk.map((k) => k.join('___'))).size) {
      return sides.map(({ model }) => ({ model, ids: null }));
    }
    for (const row of found) add(row);
  }

  const out: Array<{ model: Model; ids: WalkIds }> = [];
  for (const { model, child, mmChild } of sides) {
    const keys = [...values.get(mmChild.id)];
    if (keys.length > FANOUT_CAP) {
      out.push({ model, ids: null });
      continue;
    }
    const ids = keys.length
      ? await keyConverter(junction, model, child).toPks(keys)
      : [];
    if (ids === null || ids.length) out.push({ model, ids });
  }
  return out;
}

/**
 * Walk a dependency path backwards: rows changed in its end table → rows of
 * the indexed table that show them. Null when the fan-out passes the cap.
 */
export async function walkDependencyPath(
  baseModel: IBaseModelSqlV2,
  links: string[],
  changedIds: Array<string | number>,
): Promise<Array<string | number> | null> {
  let ids: Array<string | number> | null = changedIds;
  for (let i = links.length - 1; i >= 0 && ids?.length; i--) {
    const link = await Column.get(baseModel.context, { colId: links[i] });
    if (!link) return [];
    ids = await rowsLinkedTo(baseModel, link, ids);
  }
  return ids;
}
