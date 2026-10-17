import rfdc from 'rfdc';
import {
  extractColumnIdentifierType,
  extractRollupAggregates,
  FormulaDataTypes,
  getRollupAggregate,
  getRollupModifier,
  isMMOrMMLike,
  JSEPNode,
  RelationTypes,
  ROLLUP_ARRAYJOIN_DEFAULT_SEPARATOR,
  ROLLUP_VALUES_KEYWORD,
  RollupAggregate,
  RollupModifier,
  UITypes,
  validateFormulaAndExtractTreeWithType,
} from 'nocodb-sdk';
import type {
  CallExpressionNode,
  CircularRefContext,
  ClientType,
  ClientTypeOrSqlUI,
  ParsedFormulaNode,
} from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { XKnex } from '~/db/CustomKnex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { TAliasToColumn } from '~/db/formulav2/formula-query-builder.types';
import type {
  Column,
  LinkToAnotherRecordColumn,
  LookupColumn,
  RollupColumn,
} from '~/models';
import { BaseUser, Model, RollupColumn as RollupColumnModel } from '~/models';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';
import { excludeNonFiniteSql, isPgIeeeEnabled } from '~/db/formulav2/pg-ieee';
import { extractLinkRelFiltersAndApply } from '~/db/conditionV2';
import { getAliasedSoftDeleteFilter } from '~/helpers/dbHelpers';
import { NcError } from '~/helpers/catchError';
import { DBQueryClient } from '~/dbQueryClient';

const clone = rfdc();

// lookup-of-lookup chains deeper than this are almost certainly a mistake
const MAX_LOOKUP_HOPS = 8;

// SQL text spliced into another knex query: a bare `?` would bind
const escapeBindings = (sql: string) => sql.replaceAll('?', '\\?');

// the type the stored tree gave `values`
function storedValuesType(node: ParsedFormulaNode): FormulaDataTypes {
  if (!node) return undefined;
  if (node.type === JSEPNode.IDENTIFIER && node.name === ROLLUP_VALUES_KEYWORD)
    return node.dataType;
  const children =
    node.type === JSEPNode.CALL_EXP
      ? node.arguments
      : node.type === JSEPNode.BINARY_EXP
      ? [node.left, node.right]
      : node.type === JSEPNode.UNARY_EXP
      ? [node.argument]
      : [];
  for (const child of children ?? []) {
    const type = storedValuesType(child);
    if (type) return type;
  }
  return undefined;
}

// an attachment cell as `title (url), …`; local files carry a path, not a url
function attachmentTextSql(knex: XKnex, col: string): string | null {
  switch (knex.clientType()) {
    case 'pg':
      return `(SELECT STRING_AGG(COALESCE(e->>'title', '') || COALESCE(' (' || COALESCE(e->>'url', e->>'path') || ')', ''), ', ' ORDER BY i) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NULLIF(${col}::text, '')::jsonb) = 'array' THEN ${col}::jsonb ELSE '[]'::jsonb END) WITH ORDINALITY AS a(e, i))`;
    case 'mysql':
    case 'mysql2':
      return `(SELECT GROUP_CONCAT(CONCAT(COALESCE(j.title, ''), COALESCE(CONCAT(' (', COALESCE(j.url, j.path), ')'), '')) ORDER BY j.i SEPARATOR ', ') FROM JSON_TABLE(IF(JSON_VALID(${col}), ${col}, '[]'), '$[*]' COLUMNS (i FOR ORDINALITY, title TEXT PATH '$.title', url TEXT PATH '$.url', path TEXT PATH '$.path')) j)`;
    case 'sqlite3':
      return `(SELECT GROUP_CONCAT(COALESCE(json_extract(e.value, '$.title'), '') || COALESCE(' (' || COALESCE(json_extract(e.value, '$.url'), json_extract(e.value, '$.path')) || ')', ''), ', ') FROM json_each(CASE WHEN json_valid(${col}) THEN ${col} ELSE '[]' END) e)`;
    case 'mssql':
      return `(SELECT STRING_AGG(CONCAT(COALESCE(JSON_VALUE(e.value, '$.title'), ''), ' (' + COALESCE(JSON_VALUE(e.value, '$.url'), JSON_VALUE(e.value, '$.path')) + ')'), ', ') WITHIN GROUP (ORDER BY CAST(e.[key] AS INT)) FROM OPENJSON(CASE WHEN ISJSON(${col}) = 1 THEN ${col} ELSE '[]' END) e)`;
    case 'oracledb':
      return `(SELECT LISTAGG(j.title || CASE WHEN NVL(j.url, j.path) IS NOT NULL THEN ' (' || NVL(j.url, j.path) || ')' END, ', ') WITHIN GROUP (ORDER BY j.i) FROM JSON_TABLE(${col}, '$[*]' COLUMNS (i FOR ORDINALITY, title VARCHAR2(4000) PATH '$.title', url VARCHAR2(4000) PATH '$.url', path VARCHAR2(4000) PATH '$.path')) j)`;
    default:
      return null;
  }
}

const VALUE_ALIAS = '__nc_v';
const ORDER_ALIAS = '__nc_o';
const ROW_NUMBER_ALIAS = '__nc_rn';
const ROW_COUNT_ALIAS = '__nc_cnt';

// aggregates that take DISTINCT directly; the others dedupe in a derived table
const DISTINCT_CAPABLE = [
  RollupAggregate.SUM,
  RollupAggregate.AVERAGE,
  RollupAggregate.COUNT,
  RollupAggregate.COUNTA,
  RollupAggregate.MIN,
  RollupAggregate.MAX,
];

const BOOLEANISH = [FormulaDataTypes.BOOLEAN, FormulaDataTypes.COND_EXP];

/**
 * SQL for a rollup whose aggregation is a formula over `values`.
 *
 * Each aggregate (`SUM(values)`, `ARRAYJOIN(ARRAYUNIQUE(values))` …) becomes a
 * correlated subquery over the linked records from `buildScope`, its argument
 * compiled per linked record by the formula builder with `values` read as the
 * rolled-up field. The expression around the aggregates is compiled by the
 * formula builder on the current table, the aggregates standing in as fields.
 */
export default async function genRollupFormulaSelect(params: {
  baseModelSqlv2: IBaseModelSqlV2;
  knex: XKnex;
  columnOptions: RollupColumn;
  refBaseModel: IBaseModelSqlV2;
  refModel: Model;
  rollupColumn: Column;
  refTableAlias: string;
  parentColumns: CircularRefContext;
  buildScope: () => Promise<{ qb: Knex.QueryBuilder } | null>;
  // order of the links in the cell (many-to-many junction), ahead of the pk
  linkOrderRef?: string;
}): Promise<{ builder: Knex.QueryBuilder } | null> {
  const {
    baseModelSqlv2,
    knex,
    columnOptions,
    refBaseModel,
    refModel,
    rollupColumn,
    refTableAlias,
    parentColumns,
    buildScope,
    linkOrderRef,
  } = params;
  const context = baseModelSqlv2.context;

  // The stored tree types `values` as the target was at save time. When the
  // target has since changed type (a formula edited, a display value moved) the
  // compiled SQL would no longer fit it, so re-derive the tree first.
  await refModel.getColumns();
  const getMeta = async (metaContext, { id }) => {
    const model = await Model.get(metaContext, id);
    await model?.getColumns();
    return model;
  };
  const currentValuesType = (
    await extractColumnIdentifierType({
      col: rollupColumn,
      columns: refModel.columns,
      getMeta,
      clientOrSqlUi: refBaseModel.clientType as ClientTypeOrSqlUI,
    })
  ).dataType;
  let parsedTree = columnOptions.parsed_tree;
  if (!parsedTree || storedValuesType(parsedTree) !== currentValuesType) {
    parsedTree = await validateFormulaAndExtractTreeWithType({
      formula: columnOptions.rollup_formula,
      columns: [],
      clientOrSqlUi: refBaseModel.clientType as ClientTypeOrSqlUI,
      getMeta,
      rollup: { valuesColumn: rollupColumn, valuesColumns: refModel.columns },
    }).catch((e) =>
      NcError.get(context).formulaError(
        `Rollup formula no longer fits its field: ${e.message}`,
      ),
    );
    if (columnOptions.fk_column_id) {
      await RollupColumnModel.update(context, columnOptions.fk_column_id, {
        parsed_tree: parsedTree,
      }).catch(() => {
        // best effort: the next read re-derives again
      });
    }
  }

  // the formula builder rewrites trees in place
  const tree: ParsedFormulaNode = clone(parsedTree);
  const aggregates = extractRollupAggregates(tree);
  if (!aggregates.length) {
    NcError.get(context).formulaError(
      'A rollup formula must aggregate `values`, e.g. SUM(values)',
    );
  }

  const quote = (identifier: string) => knex.raw('??', [identifier]).toQuery();

  // A Lookup / LinkToAnotherRecord target reads the records one link further
  // (links of links): each hop joins the next table, so `values` is every value
  // at the end of the chain, duplicates included.
  const hops: {
    relationColumn: Column;
    relation: LinkToAnotherRecordColumn;
    lookupColumn?: Column;
    junctionOrderCol?: string;
    model: Model;
    baseModel: IBaseModelSqlV2;
    alias: string;
  }[] = [];
  let leafColumn = rollupColumn;
  let leafModel = refModel;
  let leafBaseModel = refBaseModel;
  while (
    [UITypes.Lookup, UITypes.LinkToAnotherRecord].includes(leafColumn.uidt)
  ) {
    if (hops.length >= MAX_LOOKUP_HOPS) {
      NcError.get(context).formulaError(
        'Rollup formula looks up through too many links',
      );
    }
    const lookup =
      leafColumn.uidt === UITypes.Lookup
        ? await leafColumn.getColOptions<LookupColumn>()
        : null;
    const relationColumn = lookup
      ? await lookup.getRelationColumn()
      : leafColumn;
    const relation =
      await relationColumn?.getColOptions<LinkToAnotherRecordColumn>();
    if (!relation) return null;
    const { refContext } = relation.getRelContext();
    const model = await Model.get(refContext, relation.fk_related_model_id);
    if (!model) return null;
    await model.getColumns();
    const next = lookup
      ? await lookup.getLookupColumn()
      : (relation.fk_display_value_column_id &&
          model.columns.find(
            (c) => c.id === relation.fk_display_value_column_id,
          )) ||
        model.columns.find((c) => c.pv);
    if (!next) return null;

    const baseModel = await Model.getBaseModelSQL(refContext, {
      model,
      dbDriver: knex,
    });
    const junctionOrderCol = isMMOrMMLike(relationColumn)
      ? (await (await relation.getMMModel())?.getColumns())?.find(
          (c) => c.uidt === UITypes.Order,
        )?.column_name
      : undefined;
    hops.push({
      relationColumn,
      relation,
      lookupColumn: lookup ? leafColumn : undefined,
      model,
      baseModel,
      alias: `${refTableAlias}_l${hops.length + 1}`,
      junctionOrderCol,
    });
    leafColumn = next;
    leafModel = model;
    leafBaseModel = baseModel;
  }
  const leafAlias = hops.length ? hops[hops.length - 1].alias : refTableAlias;

  const dbQueryClient = DBQueryClient.get(knex.clientType() as ClientType);
  const joinHops = async (qb: Knex.QueryBuilder) => {
    let fromAlias = refTableAlias;
    for (const hop of hops) {
      const { relation, relationColumn, alias } = hop;
      const childCol = await relation.getChildColumn();
      const parentCol = await relation.getParentColumn();
      const target = dbQueryClient.tableAlias(
        knex,
        hop.baseModel.getTnPath(hop.model),
        alias,
      );
      if (isMMOrMMLike(relationColumn)) {
        const mmModel = await relation.getMMModel();
        const mmChildCol = await relation.getMMChildColumn();
        const mmParentCol = await relation.getMMParentColumn();
        const assocBaseModel = await Model.getBaseModelSQL(
          relation.getRelContext().mmContext,
          { model: mmModel, dbDriver: knex },
        );
        const junctionAlias = `${alias}_j`;
        qb.innerJoin(
          dbQueryClient.tableAlias(
            knex,
            assocBaseModel.getTnPath(mmModel),
            junctionAlias,
          ),
          `${junctionAlias}.${mmChildCol.column_name}`,
          `${fromAlias}.${childCol.column_name}`,
        ).innerJoin(
          target,
          `${alias}.${parentCol.column_name}`,
          `${junctionAlias}.${mmParentCol.column_name}`,
        );
      } else if (
        relation.type === RelationTypes.BELONGS_TO ||
        relationColumn.meta?.bt
      ) {
        qb.innerJoin(
          target,
          `${alias}.${parentCol.column_name}`,
          `${fromAlias}.${childCol.column_name}`,
        );
      } else {
        qb.innerJoin(
          target,
          `${alias}.${childCol.column_name}`,
          `${fromAlias}.${parentCol.column_name}`,
        );
      }

      const softDeleteFilter = await getAliasedSoftDeleteFilter(
        hop.baseModel,
        alias,
      );
      if (softDeleteFilter) qb.where(softDeleteFilter);
      if (hop.lookupColumn) {
        await extractLinkRelFiltersAndApply({
          qb,
          column: hop.lookupColumn,
          alias,
          table: hop.model,
          baseModel: hop.baseModel,
          context: hop.baseModel.context,
        });
      }
      fromAlias = alias;
    }
  };

  // link order: joined text and ARRAYSLICE follow the order of the links in
  // the cell (junction order for many-to-many), then the pks, hop by hop
  await refModel.getColumns();
  const pkRef = (alias: string, model: Model) =>
    model.primaryKey
      ? [knex.raw('??.??', [alias, model.primaryKey.column_name]).toQuery()]
      : [];
  // links without a stored order go last on every database
  const linkOrder = (ref: string) => [
    `(CASE WHEN ${ref} IS NULL THEN 1 ELSE 0 END)`,
    ref,
  ];
  const orderRefs = [
    ...(linkOrderRef ? linkOrder(linkOrderRef) : []),
    ...pkRef(refTableAlias, refModel),
    ...hops.flatMap((hop) => [
      ...(hop.junctionOrderCol
        ? linkOrder(
            knex
              .raw('??.??', [`${hop.alias}_j`, hop.junctionOrderCol])
              .toQuery(),
          )
        : []),
      ...pkRef(hop.alias, hop.model),
    ]),
  ];
  const orderRef = orderRefs.length ? orderRefs.join(', ') : null;
  // one column to carry the order through derived tables
  const orderValue =
    orderRefs.length > 1
      ? `ROW_NUMBER() OVER (ORDER BY ${orderRef})`
      : orderRef;

  const compileRowValue = async (node: ParsedFormulaNode) => {
    const rowTree = clone(node);
    const replaceValues = (n: ParsedFormulaNode) => {
      if (!n) return;
      if (n.type === JSEPNode.IDENTIFIER && n.name === ROLLUP_VALUES_KEYWORD) {
        n.name = leafColumn.id;
        n.raw = `{${leafColumn.id}}`;
      } else if (n.type === JSEPNode.CALL_EXP) {
        n.arguments?.forEach(replaceValues);
      } else if (n.type === JSEPNode.BINARY_EXP) {
        replaceValues(n.left);
        replaceValues(n.right);
      } else if (n.type === JSEPNode.UNARY_EXP) {
        replaceValues(n.argument);
      }
    };
    replaceValues(rowTree);

    // as in Airtable: users roll up as names, attachments as `title (url)`
    const isUserLeaf = [
      UITypes.User,
      UITypes.CreatedBy,
      UITypes.LastModifiedBy,
    ].includes(leafColumn.uidt);
    const attachmentSql =
      leafColumn.uidt === UITypes.Attachment
        ? attachmentTextSql(
            knex,
            knex
              .raw('??', [`${leafAlias}.${leafColumn.column_name}`])
              .toQuery(),
          )
        : null;

    const { builder } = await formulaQueryBuilderv2({
      baseModel: leafBaseModel,
      tree: '',
      model: leafModel,
      parsedTree: rowTree,
      tableAlias: leafAlias,
      parentColumns,
      ...(isUserLeaf && {
        baseUsers: (
          await BaseUser.getUsersList(leafBaseModel.context, {
            base_id: leafModel.base_id,
            include_internal_user: true,
          })
        ).map((user) => ({
          ...user,
          email: user.display_name || user.email,
        })),
      }),
      ...(attachmentSql && {
        aliasToColumn: {
          [leafColumn.id]: async () => ({ builder: knex.raw(attachmentSql) }),
        },
      }),
    });
    return `(${builder.toQuery()})`;
  };

  // compared as text, so `<> ''` holds whatever the column really stores
  const asText = (v: string) => {
    if (baseModelSqlv2.isPg) return `CAST(${v} AS TEXT)`;
    if (baseModelSqlv2.isMySQL) return `CAST(${v} AS CHAR)`;
    if (baseModelSqlv2.isMssql) return `CAST(${v} AS NVARCHAR(MAX))`;
    return v;
  };

  // 1 when a value counts as truthy, else 0
  const truthySql = (v: string, type: FormulaDataTypes) => {
    if (BOOLEANISH.includes(type)) {
      return baseModelSqlv2.isPg
        ? `CASE WHEN (${v})::boolean THEN 1 ELSE 0 END`
        : `CASE WHEN ${v} IS NOT NULL AND ${v} <> 0 THEN 1 ELSE 0 END`;
    }
    if (type === FormulaDataTypes.NUMERIC) {
      return `CASE WHEN ${v} IS NOT NULL AND ${v} <> 0 THEN 1 ELSE 0 END`;
    }
    if (type === FormulaDataTypes.STRING && !baseModelSqlv2.isOracle) {
      return `CASE WHEN ${v} IS NOT NULL AND ${asText(
        v,
      )} <> '' THEN 1 ELSE 0 END`;
    }
    return `CASE WHEN ${v} IS NOT NULL THEN 1 ELSE 0 END`;
  };

  // drops blank values (Oracle stores '' as NULL)
  const compactSql = (v: string, type: FormulaDataTypes) =>
    type === FormulaDataTypes.STRING && !baseModelSqlv2.isOracle
      ? `${v} IS NOT NULL AND ${asText(v)} <> ''`
      : `${v} IS NOT NULL`;

  // a condition as each dialect stores a checkbox
  const booleanSql = (condition: string) => {
    if (baseModelSqlv2.isPg) return `(${condition})`;
    if (baseModelSqlv2.isMssql)
      return `CAST(CASE WHEN ${condition} THEN 1 ELSE 0 END AS BIT)`;
    return `(CASE WHEN ${condition} THEN 1 ELSE 0 END)`;
  };

  const modTwoSql = (v: string) =>
    baseModelSqlv2.isMssql || baseModelSqlv2.isSqlite
      ? `(${v} % 2)`
      : `MOD(${v}, 2)`;

  const stringAggSql = (v: string, separator: string, orderBy?: string) => {
    const sep = knex.raw('?', [separator]).toQuery();
    if (baseModelSqlv2.isPg) {
      return `STRING_AGG(CAST(${v} AS TEXT), ${sep}${
        orderBy ? ` ORDER BY ${orderBy}` : ''
      })`;
    }
    if (baseModelSqlv2.isMySQL) {
      return `GROUP_CONCAT(${v}${
        orderBy ? ` ORDER BY ${orderBy}` : ''
      } SEPARATOR ${sep})`;
    }
    if (baseModelSqlv2.isSqlite) {
      return `GROUP_CONCAT(${v}, ${sep}${
        orderBy ? ` ORDER BY ${orderBy}` : ''
      })`;
    }
    if (baseModelSqlv2.isMssql) {
      return `STRING_AGG(CAST(${v} AS NVARCHAR(MAX)), ${sep})${
        orderBy ? ` WITHIN GROUP (ORDER BY ${orderBy})` : ''
      }`;
    }
    if (baseModelSqlv2.isOracle) {
      return `LISTAGG(${v}, ${sep} ON OVERFLOW TRUNCATE) WITHIN GROUP (ORDER BY ${
        orderBy ?? 'NULL'
      })`;
    }
    if (baseModelSqlv2.isSnowflake) {
      return `LISTAGG(${v}, ${sep}) WITHIN GROUP (ORDER BY ${
        orderBy ?? 'NULL'
      })`;
    }
    if (baseModelSqlv2.isDatabricks) {
      return `CONCAT_WS(${sep}, COLLECT_LIST(CAST(${v} AS STRING)))`;
    }
    NcError.get(context).formulaError(
      'Joining rollup values is not supported for this database',
    );
  };

  const aggregateSql = (
    aggregate: RollupAggregate,
    v: string,
    valueType: FormulaDataTypes,
    opts: { distinct: boolean; orderBy?: string; separator?: string },
  ) => {
    const d = opts.distinct ? 'DISTINCT ' : '';
    const numeric = BOOLEANISH.includes(valueType)
      ? `(${truthySql(v, valueType)})`
      : v;
    switch (aggregate) {
      case RollupAggregate.SUM:
        return `COALESCE(SUM(${d}${numeric}), 0)`;
      case RollupAggregate.AVERAGE:
        // MSSQL averages integers to an integer
        return baseModelSqlv2.isMssql
          ? `AVG(${d}CAST(${numeric} AS FLOAT))`
          : `AVG(${d}${numeric})`;
      case RollupAggregate.MIN:
      case RollupAggregate.MAX:
        // Airtable: numbers only — over text the result is 0
        if (valueType === FormulaDataTypes.STRING) {
          return `CASE WHEN COUNT(*) > 0 THEN 0 END`;
        }
        return `${
          aggregate === RollupAggregate.MIN ? 'MIN' : 'MAX'
        }(${numeric})`;
      case RollupAggregate.COUNT:
        // Airtable: numeric items only — text and dates count 0, checkboxes count when ticked
        if (BOOLEANISH.includes(valueType)) {
          return `COUNT(${d}CASE WHEN (${truthySql(
            v,
            valueType,
          )}) = 1 THEN 1 END)`;
        }
        // still an aggregate, so the subquery stays one row
        return [FormulaDataTypes.NUMERIC, FormulaDataTypes.UNKNOWN].includes(
          valueType,
        )
          ? `COUNT(${d}${v})`
          : `COUNT(CASE WHEN 1 = 0 THEN 1 END)`;
      case RollupAggregate.COUNTA:
        return valueType === FormulaDataTypes.STRING && !baseModelSqlv2.isOracle
          ? `COUNT(${d}CASE WHEN ${asText(v)} <> '' THEN ${v} END)`
          : `COUNT(${d}${v})`;
      case RollupAggregate.COUNTALL:
        return `COUNT(*)`;
      case RollupAggregate.AND:
        return booleanSql(`COALESCE(MIN(${truthySql(v, valueType)}), 1) = 1`);
      case RollupAggregate.OR:
        return booleanSql(`COALESCE(MAX(${truthySql(v, valueType)}), 0) = 1`);
      case RollupAggregate.XOR:
        return booleanSql(
          `${modTwoSql(`COALESCE(SUM(${truthySql(v, valueType)}), 0)`)} = 1`,
        );
      case RollupAggregate.CONCATENATE:
        return stringAggSql(v, '', opts.orderBy);
      case RollupAggregate.ARRAYJOIN:
        return stringAggSql(
          v,
          opts.separator ?? ROLLUP_ARRAYJOIN_DEFAULT_SEPARATOR,
          opts.orderBy,
        );
    }
  };

  const literalInteger = (node: ParsedFormulaNode) => {
    const value =
      node?.type === JSEPNode.UNARY_EXP && node.operator === '-'
        ? -Number((node.argument as { value?: unknown })?.value)
        : Number((node as { value?: unknown })?.value);
    if (!Number.isInteger(value)) {
      NcError.get(context).formulaError(
        'ARRAYSLICE start and end must be whole numbers',
      );
    }
    return value;
  };

  // `start`/`end` are 1-based and inclusive; negatives count from the end
  const slicePosition = (position: number) =>
    position >= 0
      ? `${position}`
      : `(${quote(ROW_COUNT_ALIAS)} + ${position + 1})`;

  // the query is wrapped: an awaited query builder is a thenable and would execute
  const buildAggregate = async (
    node: CallExpressionNode,
    index: number,
  ): Promise<{ qb: Knex.QueryBuilder } | null> => {
    const aggregate = getRollupAggregate(node.rollupAggregate);
    if (!aggregate) {
      NcError.get(context).formulaError(
        `Unknown rollup aggregate ${node.rollupAggregate}`,
      );
    }

    // modifiers innermost first, e.g. ARRAYSLICE(ARRAYUNIQUE(values)) → [UNIQUE, SLICE]
    const modifiers: { modifier: RollupModifier; node: CallExpressionNode }[] =
      [];
    let valueNode = node.arguments[0];
    while (
      valueNode?.type === JSEPNode.CALL_EXP &&
      (valueNode as CallExpressionNode).rollupModifier
    ) {
      const modifierNode = valueNode as CallExpressionNode;
      const modifier = getRollupModifier(modifierNode.rollupModifier);
      if (!modifier) {
        NcError.get(context).formulaError(
          `Unknown rollup modifier ${modifierNode.rollupModifier}`,
        );
      }
      modifiers.unshift({ modifier, node: modifierNode });
      valueNode = modifierNode.arguments[0];
    }

    // a checkbox stored as bit / tinyint is typed numeric; it still counts as ticked or not
    const isCheckboxValue =
      valueNode.type === JSEPNode.IDENTIFIER &&
      valueNode.name === ROLLUP_VALUES_KEYWORD &&
      leafColumn.uidt === UITypes.Checkbox;
    const valueType = isCheckboxValue
      ? FormulaDataTypes.BOOLEAN
      : valueNode.dataType ?? FormulaDataTypes.UNKNOWN;
    let v = await compileRowValue(valueNode);
    // Oracle: long text, JSON and string formulas are CLOBs, which aggregates
    // and comparisons reject
    if (
      baseModelSqlv2.isOracle &&
      [FormulaDataTypes.STRING, FormulaDataTypes.UNKNOWN].includes(valueType)
    ) {
      v = `DBMS_LOB.SUBSTR(TO_CLOB(${v}), 4000, 1)`;
    }
    // a single NaN/±Infinity would take the whole aggregate
    if (
      isPgIeeeEnabled(knex) &&
      valueType === FormulaDataTypes.NUMERIC &&
      [
        RollupAggregate.SUM,
        RollupAggregate.AVERAGE,
        RollupAggregate.MIN,
        RollupAggregate.MAX,
      ].includes(aggregate)
    ) {
      v = excludeNonFiniteSql(v);
    }

    const separatorNode = node.arguments[1];
    const separator =
      aggregate === RollupAggregate.ARRAYJOIN && separatorNode
        ? String((separatorNode as { value?: unknown }).value ?? '')
        : undefined;

    const scoped = await buildScope();
    if (!scoped) return null;
    const scope = scoped.qb;
    await joinHops(scope);

    const unique = modifiers.some(
      (m) => m.modifier === RollupModifier.ARRAYUNIQUE,
    );
    const needsDerivedTable =
      modifiers.some((m) => m.modifier === RollupModifier.ARRAYSLICE) ||
      (unique && !DISTINCT_CAPABLE.includes(aggregate)) ||
      // MSSQL rejects an aggregate over a subquery
      (baseModelSqlv2.isMssql && /\bselect\b/i.test(v));

    if (!needsDerivedTable) {
      if (modifiers.some((m) => m.modifier === RollupModifier.ARRAYCOMPACT)) {
        scope.whereRaw(escapeBindings(compactSql(v, valueType)));
      }
      return {
        qb: scope.select(
          knex.raw(
            escapeBindings(
              aggregateSql(aggregate, v, valueType, {
                distinct: unique,
                orderBy: orderRef,
                separator,
              }),
            ),
          ),
        ),
      };
    }

    // value (and link order) per linked record, then one derived table per modifier
    scope.select(knex.raw(escapeBindings(`${v} AS ${quote(VALUE_ALIAS)}`)));
    if (orderRef) {
      scope.select(knex.raw(`${orderValue} AS ${quote(ORDER_ALIAS)}`));
    }
    const columns = orderRef ? [VALUE_ALIAS, ORDER_ALIAS] : [VALUE_ALIAS];
    const valueRef = quote(VALUE_ALIAS);
    let stage: Knex.QueryBuilder = scope;
    let stageCount = 0;
    const stageAlias = () => `${refTableAlias}_${index}_${stageCount++}`;

    for (const { modifier, node: modifierNode } of modifiers) {
      if (modifier === RollupModifier.ARRAYCOMPACT) {
        if (stage === scope) {
          scope.whereRaw(escapeBindings(compactSql(v, valueType)));
        } else {
          stage = knex
            .from(stage.as(stageAlias()))
            .select(columns)
            .whereRaw(compactSql(valueRef, valueType));
        }
      } else if (modifier === RollupModifier.ARRAYUNIQUE) {
        // each value once, at the position of its first link
        stage = orderRef
          ? knex
              .from(stage.as(stageAlias()))
              .select(VALUE_ALIAS)
              .min({ [ORDER_ALIAS]: ORDER_ALIAS })
              .groupBy(VALUE_ALIAS)
          : knex.from(stage.as(stageAlias())).distinct(VALUE_ALIAS);
      } else if (modifier === RollupModifier.ARRAYSLICE) {
        const [start, end] = modifierNode.arguments
          .slice(1)
          .map(literalInteger);
        const numbered = knex
          .from(stage.as(stageAlias()))
          .select(columns)
          .select(
            knex.raw(
              `ROW_NUMBER() OVER (ORDER BY ${quote(
                orderRef ? ORDER_ALIAS : VALUE_ALIAS,
              )}) AS ${quote(ROW_NUMBER_ALIAS)}`,
            ),
            knex.raw(`COUNT(*) OVER () AS ${quote(ROW_COUNT_ALIAS)}`),
          );
        stage = knex
          .from(numbered.as(stageAlias()))
          .select(columns)
          .whereRaw(
            `${quote(ROW_NUMBER_ALIAS)} >= ${slicePosition(start || 1)}` +
              (end === undefined
                ? ''
                : ` AND ${quote(ROW_NUMBER_ALIAS)} <= ${slicePosition(end)}`),
          );
      }
      // ARRAYFLATTEN: linked values are already flat
    }

    return {
      qb: knex.from(stage.as(stageAlias())).select(
        knex.raw(
          escapeBindings(
            aggregateSql(aggregate, valueRef, valueType, {
              distinct: false,
              orderBy: orderRef ? quote(ORDER_ALIAS) : undefined,
              separator,
            }),
          ),
        ),
      ),
    };
  };

  const aggregateQbs: Knex.QueryBuilder[] = [];
  for (let i = 0; i < aggregates.length; i++) {
    const built = await buildAggregate(aggregates[i], i);
    if (!built) return null;
    aggregateQbs.push(built.qb);
  }

  // a bare aggregate needs no outer expression
  if (aggregates.length === 1 && aggregates[0] === tree) {
    return { builder: aggregateQbs[0] };
  }

  const aliasToColumn: TAliasToColumn = {};
  aggregates.forEach((node, i) => {
    const name = `__nc_rollup_agg_${i}`;
    const { dataType } = node;
    for (const key of Object.keys(node)) delete node[key];
    Object.assign(node, {
      type: JSEPNode.IDENTIFIER,
      name,
      raw: name,
      dataType,
    });
    const sql = escapeBindings(aggregateQbs[i].toQuery());
    aliasToColumn[name] = async () => ({ builder: knex.raw(`(${sql})`) });
  });

  const { builder } = await formulaQueryBuilderv2({
    baseModel: baseModelSqlv2,
    tree: '',
    model: baseModelSqlv2.model,
    parsedTree: tree,
    aliasToColumn,
    columns: [],
    parentColumns,
  });

  let sql = escapeBindings(builder.toQuery());
  // Oracle string formulas can yield a CLOB, which can't be sorted or grouped
  if (baseModelSqlv2.isOracle && tree.dataType === FormulaDataTypes.STRING) {
    sql = `DBMS_LOB.SUBSTR(TO_CLOB(${sql}), 4000, 1)`;
  }
  const qb = knex.select(knex.raw(sql));
  return {
    builder: baseModelSqlv2.isOracle ? qb.from(knex.raw('dual')) : qb,
  };
}
