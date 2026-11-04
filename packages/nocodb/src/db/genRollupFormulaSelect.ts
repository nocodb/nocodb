import rfdc from 'rfdc';
import {
  extractColumnIdentifierType,
  extractRollupAggregates,
  FormulaDataTypes,
  FormulaError,
  getRollupAggregate,
  getRollupModifier,
  isFieldTrackingLmtCol,
  isMMOrMMLike,
  isSupportedDisplayValueColumn,
  isVirtualCol,
  JSEPNode,
  RelationTypes,
  ROLLUP_ARRAYJOIN_DEFAULT_SEPARATOR,
  ROLLUP_VALUES_KEYWORD,
  RollupAggregate,
  RollupModifier,
  SqlUiFactory,
  UITypes,
  validateFormulaAndExtractTreeWithType,
} from 'nocodb-sdk';
import type {
  CallExpressionNode,
  CircularRefContext,
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
import { BaseUser, Model } from '~/models';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';
import { excludeNonFiniteSql, isPgIeeeEnabled } from '~/db/formulav2/pg-ieee';
import { formulaOutputsRawJson } from '~/db/formulav2/formula-query-builder.helpers';
import { extractLinkRelFiltersAndApply } from '~/db/conditionV2';
import { getAliasedSoftDeleteFilter } from '~/helpers/dbHelpers';
import { NcError } from '~/helpers/catchError';
import { questionFreeLiteral } from '~/helpers/sqlSanitize';
import { getRefColumnIfAlias } from '~/helpers';
import { DBQueryClient } from '~/dbQueryClient';
import { getDbMajor } from '~/db/util/dbVersion';

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
      return `(SELECT STRING_AGG(COALESCE(e->>'title', '') || COALESCE(' (' || COALESCE(e->>'url', e->>'path') || ')', ''), ', ' ORDER BY i) FROM jsonb_array_elements(CASE WHEN ${col}::text ~ '^\\s*\\[' THEN ${col}::jsonb ELSE '[]'::jsonb END) WITH ORDINALITY AS a(e, i))`;
    case 'mysql':
    case 'mysql2': {
      // not JSON_TABLE: over an outer column, nested in the rollup's
      // subqueries, it reads as empty (mysql 8.0); a recursive index works
      const arr = `IF(JSON_TYPE(IF(JSON_VALID(${col}), ${col}, '[]')) = 'ARRAY', ${col}, '[]')`;
      const item = (key: string) =>
        `JSON_UNQUOTE(JSON_EXTRACT(${arr}, CONCAT('$[', n.i, '].${key}')))`;
      return `(WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i + 1 < JSON_LENGTH(${arr})) SELECT GROUP_CONCAT(CONCAT(COALESCE(${item(
        'title',
      )}, ''), COALESCE(CONCAT(' (', COALESCE(${item('url')}, ${item(
        'path',
      )}), ')'), '')) ORDER BY n.i SEPARATOR ', ') FROM n WHERE n.i < JSON_LENGTH(${arr}))`;
    }
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

// Oracle text as VARCHAR2. DBMS_LOB.SUBSTR counts characters, so a CLOB is cut
// at 1000: 4000 bytes at up to 4 bytes per character (else ORA-06502)
export const oracleVarcharSql = (sql: string, fitsVarchar: boolean) =>
  `DBMS_LOB.SUBSTR(TO_CLOB(${sql}), ${fitsVarchar ? 4000 : 1000}, 1)`;

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
  const sqlUi = SqlUiFactory.create({ client: refBaseModel.clientType });
  const currentValuesType = (
    await extractColumnIdentifierType({
      col: rollupColumn,
      columns: refModel.columns,
      getMeta,
      clientOrSqlUi: sqlUi,
    })
  ).dataType;
  let parsedTree = columnOptions.parsed_tree;
  if (!parsedTree || storedValuesType(parsedTree) !== currentValuesType) {
    try {
      parsedTree = await validateFormulaAndExtractTreeWithType({
        formula: columnOptions.rollup_formula,
        columns: [],
        clientOrSqlUi: sqlUi,
        getMeta,
        rollup: {
          valuesColumn: rollupColumn,
          valuesColumns: refModel.columns,
        },
      });
    } catch (e) {
      // only a formula that no longer fits is a cell error; meta / infra
      // failures surface
      if (!(e instanceof FormulaError)) throw e;
      NcError.get(context).formulaError(
        `Rollup formula no longer fits its field: ${e.message}`,
      );
    }
    // in memory only: saves re-type the stored tree (meta-dependency handler)
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
    // a stale override (since retyped) falls back to the primary field, as the SDK typing does
    const next = lookup
      ? await lookup.getLookupColumn()
      : (relation.fk_display_value_column_id &&
          model.columns.find(
            (c) =>
              c.id === relation.fk_display_value_column_id &&
              isSupportedDisplayValueColumn(c),
          )) ||
        model.columns.find((c) => c.pv);
    if (!next) return null;

    const baseModel = await Model.getBaseModelSQL(refContext, {
      model,
      dbDriver: knex,
    });
    // the junction has an order column per side; this one orders each record's links
    const junctionOrderCol = isMMOrMMLike(relationColumn)
      ? (await relation.getMMChildOrderColumn())?.column_name
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
  // the stored type of a date-time leaf (created / modified time read their system column)
  const leafDateTimeDt =
    [UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime].includes(
      leafColumn.uidt,
    ) && !isFieldTrackingLmtCol(leafColumn)
      ? (
          await getRefColumnIfAlias(
            leafBaseModel.context,
            leafColumn,
            leafModel.columns,
          )
        ).dt ?? ''
      : undefined;

  const joinHops = async (qb: Knex.QueryBuilder) => {
    // fromKnex throws on dialects without a query client; only hops need one
    if (!hops.length) return;
    const dbQueryClient = DBQueryClient.fromKnex(knex);
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
    const leafRef = knex
      .raw('??', [`${leafAlias}.${leafColumn.column_name}`])
      .toQuery();
    // values over JSON are typed text, so text functions need the pg json cast
    const leafSql =
      leafColumn.uidt === UITypes.Attachment
        ? attachmentTextSql(knex, leafRef)
        : knex.clientType() === 'pg' &&
          [UITypes.JSON, UITypes.GeoData, UITypes.Geometry].includes(
            leafColumn.uidt,
          )
        ? `(${leafRef})::text`
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
      ...(leafSql && {
        aliasToColumn: {
          [leafColumn.id]: async () => ({ builder: knex.raw(leafSql) }),
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

  // text is non-blank, as pg sees it: MySQL / MSSQL `= ''` ignore trailing spaces
  const nonBlankSql = (v: string) => {
    if (baseModelSqlv2.isMySQL) return `LENGTH(${asText(v)}) > 0`;
    if (baseModelSqlv2.isMssql) return `DATALENGTH(${asText(v)}) > 0`;
    return `${asText(v)} <> ''`;
  };

  // text deduped byte for byte, as pg does; MySQL / MSSQL collations fold case,
  // accents and trailing spaces. Only a key: the value itself stays text.
  const exactKeySql = (v: string, type: FormulaDataTypes) => {
    if (type !== FormulaDataTypes.STRING) return v;
    if (baseModelSqlv2.isMySQL) return `CAST(${v} AS BINARY)`;
    if (baseModelSqlv2.isMssql) return `CAST(${asText(v)} AS VARBINARY(MAX))`;
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
      return `CASE WHEN ${v} IS NOT NULL AND ${nonBlankSql(
        v,
      )} THEN 1 ELSE 0 END`;
    }
    return `CASE WHEN ${v} IS NOT NULL THEN 1 ELSE 0 END`;
  };

  // drops blank values (Oracle stores '' as NULL)
  const compactSql = (v: string, type: FormulaDataTypes) =>
    type === FormulaDataTypes.STRING && !baseModelSqlv2.isOracle
      ? `${v} IS NOT NULL AND ${nonBlankSql(v)}`
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
    // MySQL's SEPARATOR takes a literal only: a `?` goes as plain hex
    const sep =
      baseModelSqlv2.isMySQL && separator.includes('?')
        ? `X'${Buffer.from(separator, 'utf8').toString('hex')}'`
        : questionFreeLiteral(knex, separator);
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
          ? `COUNT(${d}CASE WHEN ${nonBlankSql(v)} THEN ${
              opts.distinct ? exactKeySql(v, valueType) : v
            } END)`
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
        ? -Number(
            node.argument?.type === JSEPNode.LITERAL
              ? node.argument.value
              : undefined,
          )
        : Number(node?.type === JSEPNode.LITERAL ? node.value : undefined);
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
    while (valueNode?.type === JSEPNode.CALL_EXP && valueNode.rollupModifier) {
      const modifierNode = valueNode;
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
    // joined as text, a date-time reads as a text formula shows it: UTC + offset
    if (
      [RollupAggregate.ARRAYJOIN, RollupAggregate.CONCATENATE].includes(
        aggregate,
      ) &&
      valueNode.type === JSEPNode.IDENTIFIER &&
      valueNode.name === ROLLUP_VALUES_KEYWORD &&
      leafDateTimeDt !== undefined
    ) {
      if (baseModelSqlv2.isPg) {
        // the formula builder already converts every other dt to UTC
        const utc = ['timestamp with time zone', 'timestamptz'].includes(
          leafDateTimeDt,
        )
          ? `(${v}) AT TIME ZONE 'UTC'`
          : v;
        v = `(TO_CHAR(${utc}, 'YYYY-MM-DD HH24:MI:SS') || '+00:00')`;
      } else if (baseModelSqlv2.isMySQL) {
        v = `CONCAT(DATE_FORMAT(${v}, '%Y-%m-%d %H:%i:%s'), '+00:00')`;
      } else if (baseModelSqlv2.isSqlite) {
        // strftime applies a stored offset and drops milliseconds
        v = `(strftime('%Y-%m-%d %H:%M:%S', ${v}) || '+00:00')`;
      }
    }
    // pg / mysql JSON_EXTRACT yields JSON; as text a string reads unquoted, as
    // the driver gives it to a formula field
    if (baseModelSqlv2.isPg && formulaOutputsRawJson(valueNode)) {
      v = `((${v})::jsonb #>> '{}')`;
    } else if (baseModelSqlv2.isMySQL && formulaOutputsRawJson(valueNode)) {
      // a JSON null reads as NULL, as pg's #>> gives it
      v = `(CASE WHEN JSON_TYPE(${v}) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(${v}) END)`;
    }
    // Oracle: long text, JSON and string formulas are CLOBs, which aggregates
    // and comparisons reject
    if (
      baseModelSqlv2.isOracle &&
      [FormulaDataTypes.STRING, FormulaDataTypes.UNKNOWN].includes(valueType)
    ) {
      // a physical VARCHAR2 field already fits 4000 bytes (NVARCHAR2 may not,
      // once in the database charset)
      const fitsVarchar =
        valueNode.type === JSEPNode.IDENTIFIER &&
        valueNode.name === ROLLUP_VALUES_KEYWORD &&
        (leafColumn.uidt === UITypes.Attachment ||
          (!isVirtualCol(leafColumn) &&
            /^(var)?char/i.test(leafColumn.dt ?? '')));
      v = oracleVarcharSql(v, fitsVarchar);
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
        ? separatorNode.type === JSEPNode.LITERAL
          ? String(separatorNode.value ?? '')
          : ''
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

    // window functions and JSON_TABLE; 0 = version unknown, assume a modern server
    const mysqlMajor = baseModelSqlv2.isMySQL ? getDbMajor(knex) : 0;
    if (mysqlMajor > 0 && mysqlMajor < 8) {
      const needsMysql8 = modifiers.some(
        (m) => m.modifier === RollupModifier.ARRAYSLICE,
      )
        ? 'ARRAYSLICE'
        : /\bJSON_TABLE\(/.test(v) &&
          (aggregate !== RollupAggregate.COUNTALL ||
            needsDerivedTable ||
            modifiers.length > 0)
        ? 'Rolling up attachments'
        : needsDerivedTable && orderRefs.length > 1
        ? 'ARRAYUNIQUE'
        : null;
      if (needsMysql8) {
        NcError.get(context).formulaError(
          `${needsMysql8} needs MySQL 8.0 or later`,
        );
      }
    }

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
      scope.select(
        knex.raw(escapeBindings(`${orderValue} AS ${quote(ORDER_ALIAS)}`)),
      );
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
        const key = exactKeySql(valueRef, valueType);
        if (key !== valueRef) {
          // grouped by the exact key; the group's values are all the same text
          stage = knex
            .from(stage.as(stageAlias()))
            .select(knex.raw('MIN(??) AS ??', [VALUE_ALIAS, VALUE_ALIAS]))
            .groupByRaw(key);
          if (orderRef) stage.min({ [ORDER_ALIAS]: ORDER_ALIAS });
        } else {
          stage = orderRef
            ? knex
                .from(stage.as(stageAlias()))
                .select(VALUE_ALIAS)
                .min({ [ORDER_ALIAS]: ORDER_ALIAS })
                .groupBy(VALUE_ALIAS)
            : knex.from(stage.as(stageAlias())).distinct(VALUE_ALIAS);
        }
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

  // a bare aggregate needs no outer expression; text still takes the formula
  // builder's output-length cap below
  const isBareAggregate = aggregates.length === 1 && aggregates[0] === tree;
  if (isBareAggregate && tree.dataType !== FormulaDataTypes.STRING) {
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
  // (a bare string aggregate is a LISTAGG, already VARCHAR2)
  if (baseModelSqlv2.isOracle && tree.dataType === FormulaDataTypes.STRING) {
    sql = oracleVarcharSql(sql, isBareAggregate);
  }
  const qb = knex.select(knex.raw(sql));
  return {
    builder: baseModelSqlv2.isOracle ? qb.from(knex.raw('dual')) : qb,
  };
}
