import {
  ColumnType,
  FormulaType,
  LinkToAnotherRecordType,
  LookupType,
} from '~/lib/Api';
import UITypes, { isSupportedDisplayValueColumn } from '~/lib/UITypes';
import {
  FormulaDataTypes,
  FormulaErrorType,
  JSEPNode,
} from '~/lib/formula/enums';
import { FormulaError } from '~/lib/formula/error';
import {
  BaseFormulaNode,
  BinaryExpressionNode,
  CallExpressionNode,
  IdentifierNode,
  ParsedFormulaNode,
} from '~/lib/formula/types';
import { handleFormulaError } from '~/lib/formula/handle-formula-error';
import { formulas } from '~/lib/formula/formulas';
import { formulaJsep, formulaJsepWithIndex } from '~/lib/formula/jsepInstances';
import { ClientTypeOrSqlUI } from '~/lib/formula/types';
import { SqlUiFactory } from '~/lib/sqlUi';
import {
  extractBinaryExpReferencedInfo,
  extractCallExpressionReferencedInfo,
} from '~/lib/formula/referenced-info-extractor';
import { UnifiedMetaType } from '~/lib/types';
import { unifiedMeta } from '~/lib/unifiedMeta';
import { getColOptions } from '~/lib/unifiedMeta/getColOptions';
import { isBtLikeV2Junction, isMMOrMMLike } from '~/lib/UITypes';
import {
  extractRollupAggregates,
  getRollupAggregate,
  getRollupModifier,
  hasFreeRollupValues,
  isRollupFormula,
  MAX_ROLLUP_AGGREGATES,
  ROLLUP_VALUES_KEYWORD,
  RollupAggregate,
  RollupModifier,
  rollupFormulaResultUidt,
} from '~/lib/formula/rollupFormula';

// Where a node sits in a rollup formula: outside aggregates, as the value set
// an aggregate consumes, or inside a per-value expression.
type RollupScope = 'outer' | 'set' | 'row';

const rollupCall = (name: string, args: ParsedFormulaNode[]) =>
  ({
    type: JSEPNode.CALL_EXP,
    callee: { type: JSEPNode.IDENTIFIER, name },
    arguments: args,
  } as CallExpressionNode);

// a value list used as text: CONCATENATE(values), no separator
const concatenateValues = (node: ParsedFormulaNode) =>
  rollupCall(RollupAggregate.CONCATENATE, [node]);

/**
 * Rewrite a variadic aggregate into the aggregate of the value set combined
 * with the other arguments: SUM(values, 10) → ADD(SUM(values), 10),
 * COUNTA(values, x) → ADD(COUNTA(values), COUNTA(x)),
 * CONCATENATE("#", values) → CONCAT("#", CONCATENATE(values)).
 */
function splitVariadicAggregate(
  node: CallExpressionNode,
  aggregate: RollupAggregate,
  position?: { index: number; length: number }
): ParsedFormulaNode {
  const args = node.arguments ?? [];
  const setIndexes = args
    .map((arg, i) => (hasFreeRollupValues(arg) ? i : -1))
    .filter((i) => i >= 0);
  if (setIndexes.length !== 1 || aggregate === RollupAggregate.AVERAGE) {
    throw new FormulaError(
      FormulaErrorType.INVALID_ARG,
      { position },
      aggregate === RollupAggregate.AVERAGE
        ? 'AVERAGE takes only the values in a rollup, e.g. AVERAGE(values)'
        : `${node.callee.name} can aggregate values only once`
    );
  }
  const [setIndex] = setIndexes;
  const aggregated = { ...node, arguments: [args[setIndex]] };
  const others = args.filter((_, i) => i !== setIndex);

  switch (aggregate) {
    case RollupAggregate.COUNT:
    case RollupAggregate.COUNTA:
    case RollupAggregate.COUNTALL: {
      // the extra items are literals, so they are counted here
      if (others.some((arg) => arg.type !== JSEPNode.LITERAL)) {
        throw new FormulaError(
          FormulaErrorType.INVALID_ARG,
          { position },
          `${node.callee.name} takes values plus literal items, e.g. COUNTA(values, "x")`
        );
      }
      const counted = others.filter((arg) => {
        const value = (arg as { value?: unknown }).value;
        if (aggregate === RollupAggregate.COUNT)
          return typeof value === 'number';
        if (aggregate === RollupAggregate.COUNTA)
          return value !== null && value !== '';
        return true;
      }).length;
      return rollupCall('ADD', [
        aggregated,
        {
          type: JSEPNode.LITERAL,
          value: counted,
          raw: String(counted),
        } as ParsedFormulaNode,
      ]);
    }
    case RollupAggregate.SUM:
      return rollupCall('ADD', [aggregated, ...others]);
    default: {
      // MIN, MAX, AND, OR, XOR, CONCATENATE keep the argument positions
      const positional = [...args];
      positional[setIndex] = aggregated;
      return rollupCall(
        aggregate === RollupAggregate.CONCATENATE ? 'CONCAT' : aggregate,
        positional
      );
    }
  }
}

/** The formula type a field is read as (a rollup formula re-checks its `values` with it) */
export async function extractColumnIdentifierType({
  col,
  columns,
  getMeta,
  clientOrSqlUi,
}: {
  col: UnifiedMetaType.IColumn;
  columns: UnifiedMetaType.IColumn[];
  getMeta: UnifiedMetaType.IGetModel;
  clientOrSqlUi: ClientTypeOrSqlUI;
}) {
  const res: Omit<BaseFormulaNode, 'type'> & {
    [p: string]: any;
  } = {};
  const sqlUI =
    typeof clientOrSqlUi === 'string'
      ? SqlUiFactory.create({ client: clientOrSqlUi })
      : clientOrSqlUi;

  switch (col?.uidt) {
    // string
    case UITypes.SingleLineText:
    case UITypes.LongText:
    case UITypes.MultiSelect:
    case UITypes.SingleSelect:
    case UITypes.PhoneNumber:
    case UITypes.Email:
    case UITypes.URL:
    case UITypes.User:
    case UITypes.CreatedBy:
    case UITypes.LastModifiedBy:
      res.dataType = FormulaDataTypes.STRING;
      break;
    // numeric
    case UITypes.Year:
    case UITypes.Number:
    case UITypes.Decimal:
    case UITypes.Rating:
    case UITypes.Count:
    case UITypes.AutoNumber:
      res.dataType = FormulaDataTypes.NUMERIC;
      break;
    // date
    case UITypes.Date:
    case UITypes.DateTime:
    case UITypes.CreatedTime:
    case UITypes.LastModifiedTime:
      res.dataType = FormulaDataTypes.DATE;
      break;

    case UITypes.Currency:
    case UITypes.Percent:
    case UITypes.Duration:
    case UITypes.Links:
      res.dataType = FormulaDataTypes.NUMERIC;
      break;

    case UITypes.Rollup:
      {
        const rollupOptions =
          await unifiedMeta.getColOptions<UnifiedMetaType.IRollupColumn>(
            unifiedMeta.getContextFromObject(col),
            {
              column: col,
            }
          );
        const rollupFunction = rollupOptions.rollup_function;
        if (isRollupFormula(rollupOptions)) {
          res.dataType =
            rollupOptions.parsed_tree?.dataType ?? FormulaDataTypes.UNKNOWN;
          // a date-only result stays date-only for MIN/MAX one level up
          if (
            rollupFormulaResultUidt(rollupOptions.parsed_tree) === UITypes.Date
          ) {
            res.referencedColumn = { id: col.id, uidt: UITypes.Date };
          }
        } else if (
          [
            'count',
            'countAll',
            'avg',
            'sum',
            'countDistinct',
            'sumDistinct',
            'avgDistinct',
          ].includes(rollupFunction)
        ) {
          // these functions produce a numeric value, which can be used in numeric functions
          res.dataType = FormulaDataTypes.NUMERIC;
        } else {
          const rollupColOptions =
            await getColOptions<UnifiedMetaType.IRollupColumn>(
              unifiedMeta.getContextFromObject(col),
              { column: col }
            );
          const relationColumn = columns.find(
            (column) => column.id === rollupColOptions.fk_relation_column_id
          );

          const relationColumnOpt =
            await getColOptions<UnifiedMetaType.ILinkToAnotherRecordColumn>(
              unifiedMeta.getContextFromObject(col),
              { column: relationColumn }
            );

          // the value is based on the foreign rollup column type
          const refTableMeta = await getMeta(
            unifiedMeta.getContextFromObject({
              ...col,
              base_id: relationColumnOpt.fk_related_base_id ?? col.base_id,
            }),
            {
              id: relationColumnOpt.fk_related_model_id,
            }
          );

          const refTableColumns = refTableMeta.columns;

          const childFieldColumn = refTableColumns.find(
            (col) => col.id === rollupColOptions.fk_rollup_column_id
          );

          // extract type and add to res
          Object.assign(
            res,
            await extractColumnIdentifierType({
              col: childFieldColumn,
              columns: refTableColumns,
              getMeta,
              clientOrSqlUi,
            })
          );
        }
      }
      break;

    case UITypes.Attachment:
      res.dataType = FormulaDataTypes.STRING;
      break;
    case UITypes.Checkbox:
      if (col.dt === 'boolean' || col.dt === 'bool') {
        res.dataType = FormulaDataTypes.BOOLEAN;
      } else {
        res.dataType = FormulaDataTypes.NUMERIC;
      }
      break;
    case UITypes.Time:
      res.dataType = FormulaDataTypes.INTERVAL;
      break;
    case UITypes.ID:
    case UITypes.ForeignKey:
    case UITypes.SpecificDBType:
      {
        if (sqlUI) {
          const abstractType = sqlUI.getAbstractType(col);
          if (['integer', 'float', 'decimal'].includes(abstractType)) {
            res.dataType = FormulaDataTypes.NUMERIC;
          } else if (['boolean'].includes(abstractType)) {
            res.dataType = FormulaDataTypes.BOOLEAN;
          } else if (
            ['date', 'datetime', 'time', 'year'].includes(abstractType)
          ) {
            res.dataType = FormulaDataTypes.DATE;
          } else {
            res.dataType = FormulaDataTypes.STRING;
          }
        } else {
          res.dataType = FormulaDataTypes.UNKNOWN;
        }
      }
      break;
    // not supported
    case UITypes.Lookup: {
      const colContext = unifiedMeta.getContextFromObject(col);

      const lookupColOption =
        await unifiedMeta.getColOptions<UnifiedMetaType.ILookupColumn>(
          colContext,
          {
            column: col,
          }
        );

      const lookupInfo = await unifiedMeta.getLookupRelatedInfo(colContext, {
        colOptions: lookupColOption,
        columns,
        getMeta,
      });

      const relationColumn = lookupInfo.relationColumn;
      const lookupColumn = lookupInfo.lookupColumn;

      const lookupColumnIdentifierType = await extractColumnIdentifierType({
        col: lookupColumn,
        clientOrSqlUi,
        columns: await unifiedMeta.getColumns(
          unifiedMeta.getContextFromObject(lookupInfo.relatedTable),
          { model: lookupInfo.relatedTable }
        ),
        getMeta,
      });
      res.dataType = lookupColumnIdentifierType.dataType;
      res.isDataArray = lookupColumnIdentifierType.isDataArray;
      if (!res.isDataArray) {
        const relationColOptions =
          await unifiedMeta.getColOptions<UnifiedMetaType.ILinkToAnotherRecordColumn>(
            colContext,
            {
              column: relationColumn,
            }
          );
        const relationColWithOptions = {
          ...relationColumn,
          colOptions: relationColOptions,
        };
        // V2 MO/OO use junction tables (isMMOrMMLike=true) but return single records
        const relationType = isBtLikeV2Junction(relationColWithOptions)
          ? relationColOptions.type
          : isMMOrMMLike(relationColWithOptions)
          ? 'mm'
          : relationColOptions.type;
        res.isDataArray = ['hm', 'mm', 'om'].includes(relationType);
      }
      res.referencedColumn = {
        id: lookupColumnIdentifierType?.referencedColumn?.id,
        // if array, we present it as lookup column
        uidt: lookupColumnIdentifierType?.referencedColumn?.uidt,
        intermediaryUidt: UITypes.Lookup,
        intermediaryId: col.id,
      };

      break;
    }
    case UITypes.LinkToAnotherRecord: {
      const colOptions =
        await unifiedMeta.getColOptions<UnifiedMetaType.ILinkToAnotherRecordColumn>(
          unifiedMeta.getContextFromObject(col),
          {
            column: col,
          }
        );
      const relatedTable = await unifiedMeta.getLTARRelatedTable(
        unifiedMeta.getContextFromObject(col),
        {
          colOptions,
          getMeta,
        }
      );
      const relatedTableColumns = await unifiedMeta.getColumns(
        unifiedMeta.getContextFromObject(relatedTable),
        {
          model: relatedTable,
        }
      );
      // Honor the per-LTAR custom display value override — the generated SQL
      // resolves that column, so the derived formula type must match it.
      // Defensive PV fallback when the override is stale/unsupported.
      const displayOverrideCol = colOptions.fk_display_value_column_id
        ? relatedTableColumns.find(
            (col) =>
              col.id === colOptions.fk_display_value_column_id &&
              isSupportedDisplayValueColumn(col)
          )
        : undefined;
      const relatedTableDisplayColumn =
        displayOverrideCol ?? relatedTableColumns.find((col) => col.pv);
      const relatedColumnIdentifierType = await extractColumnIdentifierType({
        col: relatedTableDisplayColumn,
        clientOrSqlUi,
        columns: relatedTableColumns,
        getMeta,
      });
      res.dataType = relatedColumnIdentifierType.dataType;
      const colWithOptions = { ...col, colOptions };
      // V2 MO/OO use junction tables (isMMOrMMLike=true) but return single records
      const relationType = isBtLikeV2Junction(colWithOptions)
        ? colOptions.type
        : isMMOrMMLike(colWithOptions)
        ? 'mm'
        : colOptions.type;
      res.isDataArray =
        relatedColumnIdentifierType.isDataArray ||
        ['hm', 'mm', 'om'].includes(relationType);
      res.referencedColumn = {
        id: relatedColumnIdentifierType?.referencedColumn?.id,
        uidt: relatedColumnIdentifierType?.referencedColumn?.uidt,
        intermediaryUidt: UITypes.LinkToAnotherRecord,
        intermediaryId: col.id,
      };
      break;
    }
    case UITypes.Formula: {
      const colOptions =
        await unifiedMeta.getColOptions<UnifiedMetaType.IFormulaColumn>(
          unifiedMeta.getContextFromObject(col),
          {
            column: col,
          }
        );
      const parsedTree = await unifiedMeta.getParsedTree(
        unifiedMeta.getContextFromObject(col),
        { colOptions, getMeta }
      );

      if (parsedTree) {
        res.dataType = parsedTree.dataType || FormulaDataTypes.UNKNOWN;
        res.isDataArray = parsedTree.isDataArray;
        res.referencedColumn = parsedTree.referencedColumn;
      } else {
        res.dataType = FormulaDataTypes.UNKNOWN;
      }
      break;
    }
    case UITypes.Barcode:
    case UITypes.Button:
    case UITypes.Collaborator:
    case UITypes.QrCode:
    default:
      res.dataType = FormulaDataTypes.UNKNOWN;
      break;
  }
  res.referencedColumn = {
    id: col.id,
    uidt: col.uidt,
    ...(res.referencedColumn ?? {}),
  };

  return res;
}

function handleBinaryExpressionForDateAndTime(params: {
  sourceBinaryNode: BinaryExpressionNode;
}): BinaryExpressionNode | CallExpressionNode | undefined {
  const { sourceBinaryNode } = params;
  let res: BinaryExpressionNode | CallExpressionNode;

  if (
    [FormulaDataTypes.DATE, FormulaDataTypes.INTERVAL].includes(
      sourceBinaryNode.left.dataType
    ) &&
    [FormulaDataTypes.DATE, FormulaDataTypes.INTERVAL].includes(
      sourceBinaryNode.right.dataType
    ) &&
    sourceBinaryNode.operator === '-'
  ) {
    // when it's interval and interval, we return diff in minute (numeric)
    if (
      [FormulaDataTypes.INTERVAL].includes(sourceBinaryNode.left.dataType) &&
      [FormulaDataTypes.INTERVAL].includes(sourceBinaryNode.right.dataType)
    ) {
      res = {
        type: JSEPNode.CALL_EXP,
        arguments: [
          sourceBinaryNode.left,
          sourceBinaryNode.right,
          {
            type: 'Literal',
            value: 'minutes',
            raw: '"minutes"',
            dataType: 'string',
          },
        ],
        callee: {
          type: 'Identifier',
          name: 'DATETIME_DIFF',
        },
        dataType: FormulaDataTypes.NUMERIC,
      } as CallExpressionNode;
    }
    // when it's date - date, show the difference in minute
    else if (
      [FormulaDataTypes.DATE].includes(sourceBinaryNode.left.dataType) &&
      [FormulaDataTypes.DATE].includes(sourceBinaryNode.right.dataType)
    ) {
      res = {
        type: JSEPNode.CALL_EXP,
        arguments: [
          sourceBinaryNode.left,
          sourceBinaryNode.right,
          {
            type: 'Literal',
            value: 'minutes',
            raw: '"minutes"',
            dataType: 'string',
          },
        ],
        callee: {
          type: 'Identifier',
          name: 'DATETIME_DIFF',
        },
        dataType: FormulaDataTypes.NUMERIC,
      } as CallExpressionNode;
    }
    // else interval and date can be addedd seamlessly A - B
    // with result as DATE
    // may be changed if we find other db use case
    else if (
      [FormulaDataTypes.INTERVAL, FormulaDataTypes.DATE].includes(
        sourceBinaryNode.left.dataType
      ) &&
      [FormulaDataTypes.INTERVAL, FormulaDataTypes.DATE].includes(
        sourceBinaryNode.right.dataType
      ) &&
      sourceBinaryNode.left.dataType != sourceBinaryNode.right.dataType
    ) {
      res = {
        type: JSEPNode.BINARY_EXP,
        left: sourceBinaryNode.left,
        right: sourceBinaryNode.right,
        operator: '-',
        dataType: FormulaDataTypes.DATE,
      } as BinaryExpressionNode;
    }
  } else if (
    [FormulaDataTypes.DATE, FormulaDataTypes.INTERVAL].includes(
      sourceBinaryNode.left.dataType
    ) &&
    [FormulaDataTypes.DATE, FormulaDataTypes.INTERVAL].includes(
      sourceBinaryNode.right.dataType
    ) &&
    sourceBinaryNode.operator === '+'
  ) {
    // when it's interval and interval, we return addition in minute (numeric)
    if (
      [FormulaDataTypes.INTERVAL].includes(sourceBinaryNode.left.dataType) &&
      [FormulaDataTypes.INTERVAL].includes(sourceBinaryNode.right.dataType)
    ) {
      const left = {
        type: JSEPNode.CALL_EXP,
        arguments: [
          sourceBinaryNode.left,
          {
            type: 'Literal',
            value: '00:00:00',
            raw: '"00:00:00"',
            dataType: FormulaDataTypes.INTERVAL,
          },
          {
            type: 'Literal',
            value: 'minutes',
            raw: '"minutes"',
            dataType: 'string',
          },
        ],
        callee: {
          type: 'Identifier',
          name: 'DATETIME_DIFF',
        },
        dataType: FormulaDataTypes.NUMERIC,
      } as CallExpressionNode;
      const right = {
        type: JSEPNode.CALL_EXP,
        arguments: [
          sourceBinaryNode.right,
          {
            type: 'Literal',
            value: '00:00:00',
            raw: '"00:00:00"',
            dataType: FormulaDataTypes.INTERVAL,
          },
          {
            type: 'Literal',
            value: 'minutes',
            raw: '"minutes"',
            dataType: 'string',
          },
        ],
        callee: {
          type: 'Identifier',
          name: 'DATETIME_DIFF',
        },
        dataType: FormulaDataTypes.NUMERIC,
      } as CallExpressionNode;
      return {
        type: JSEPNode.BINARY_EXP,
        left,
        right,
        operator: '+',
        dataType: FormulaDataTypes.NUMERIC,
      } as BinaryExpressionNode;
    }
    // else interval and date can be addedd seamlessly A + B
    // with result as DATE
    // may be changed if we find other db use case
    else if (
      [FormulaDataTypes.INTERVAL, FormulaDataTypes.DATE].includes(
        sourceBinaryNode.left.dataType
      ) &&
      [FormulaDataTypes.INTERVAL, FormulaDataTypes.DATE].includes(
        sourceBinaryNode.right.dataType
      ) &&
      sourceBinaryNode.left.dataType != sourceBinaryNode.right.dataType
    ) {
      res = {
        type: JSEPNode.BINARY_EXP,
        left: sourceBinaryNode.left,
        right: sourceBinaryNode.right,
        operator: '+',
        dataType: FormulaDataTypes.DATE,
      } as BinaryExpressionNode;
    }
  }
  return res;
}
async function checkForCircularFormulaRef(
  formulaCol: UnifiedMetaType.IColumn,
  parsedTree: ParsedFormulaNode,
  columns: UnifiedMetaType.IColumn[],
  getMeta: UnifiedMetaType.IGetModel
) {
  // Extract formula references
  const formulaPaths = await columns.reduce(async (promiseRes, c) => {
    const res = await promiseRes;
    if (c.id !== formulaCol.id && c.uidt === UITypes.Formula) {
      const neighbours = [
        ...new Set(
          (
            (c.colOptions as FormulaType).formula.match(/cl?_?\w{14,15}/g) || []
          ).filter((colId) =>
            columns.some(
              (col) => col.id === colId && col.uidt === UITypes.Formula
            )
          )
        ),
      ];
      if (neighbours.length) res.push({ [c.id]: neighbours });
    } else if (
      c.uidt === UITypes.Lookup ||
      c.uidt === UITypes.LinkToAnotherRecord
    ) {
      const neighbours = await processLookupOrLTARColumn(c);
      if (neighbours?.length) res.push({ [c.id]: neighbours });
    }
    return res;
  }, Promise.resolve([]));

  async function processLookupFormula(
    col: UnifiedMetaType.IColumn,
    columns: UnifiedMetaType.IColumn[]
  ) {
    const neighbours = [];

    if (formulaCol.fk_model_id === col.fk_model_id) {
      return [col.id];
    }

    // Extract columns used in the formula and check for cycles
    const referencedColumns =
      (col.colOptions as FormulaType).formula.match(/cl?_?\w{14,15}/g) || [];

    for (const refColId of referencedColumns) {
      const refCol = columns.find((c) => c.id === refColId);
      // if refColId is not valid column, maybe just a concidence value of CONCAT
      // we ignore
      if (refCol) {
        if (refCol.uidt === UITypes.Formula) {
          neighbours.push(...(await processLookupFormula(refCol, columns)));
        } else if (
          refCol.uidt === UITypes.Lookup ||
          refCol.uidt === UITypes.LinkToAnotherRecord
        ) {
          neighbours.push(...(await processLookupOrLTARColumn(refCol)));
        }
      }
    }
    return neighbours;
  }

  // Function to process lookup columns recursively
  async function processLookupOrLTARColumn(
    lookupOrLTARCol: UnifiedMetaType.IColumn & {
      colOptions?: LookupType | LinkToAnotherRecordType;
    }
  ) {
    const neighbours = [];

    let ltarColumn: UnifiedMetaType.IColumn;
    let lookupFilterFn: (column: ColumnType) => boolean;

    if (lookupOrLTARCol.uidt === UITypes.Lookup) {
      const relationColId = (lookupOrLTARCol.colOptions as LookupType)
        .fk_relation_column_id;
      const lookupColId = (lookupOrLTARCol.colOptions as LookupType)
        .fk_lookup_column_id;
      ltarColumn = columns.find((c) => c.id === relationColId);
      lookupFilterFn = (column: ColumnType) => column.id === lookupColId;
    } else if (lookupOrLTARCol.uidt === UITypes.LinkToAnotherRecord) {
      ltarColumn = lookupOrLTARCol;
      lookupFilterFn = (column: ColumnType) => !!column.pv;
    }

    if (ltarColumn) {
      const ltarColumnContext = unifiedMeta.getContextFromObject({
        ...ltarColumn,
        base_id: ltarColumn.base_id,
      });
      const ltarColOptions =
        await unifiedMeta.getColOptions<UnifiedMetaType.ILinkToAnotherRecordColumn>(
          ltarColumnContext,
          { column: ltarColumn }
        );
      const relatedColumnContext = unifiedMeta.getContextFromObject({
        ...ltarColumn,
        base_id:
          (ltarColumn.colOptions as LinkToAnotherRecordType)
            .fk_related_base_id ?? ltarColumn.base_id,
      });
      const relatedTableMeta = await unifiedMeta.getLTARRelatedTable(
        relatedColumnContext,
        {
          colOptions: ltarColOptions,
          getMeta,
        }
      );
      const relatedTableColumns = await unifiedMeta.getColumns(
        unifiedMeta.getContextFromObject(relatedTableMeta),
        {
          model: relatedTableMeta,
        }
      );
      // A direct LTAR reference resolves the related table's display value —
      // honor the per-LTAR override (with PV fallback when stale/unsupported)
      // so cycle detection walks the column the SQL actually reads.
      const displayOverrideCol =
        lookupOrLTARCol.uidt === UITypes.LinkToAnotherRecord &&
        ltarColOptions.fk_display_value_column_id
          ? relatedTableColumns.find(
              (c) =>
                c.id === ltarColOptions.fk_display_value_column_id &&
                isSupportedDisplayValueColumn(c)
            )
          : undefined;
      const lookupTarget =
        displayOverrideCol ?? relatedTableColumns.find(lookupFilterFn);

      if (lookupTarget) {
        if (lookupTarget.uidt === UITypes.Formula) {
          neighbours.push(
            ...(await processLookupFormula(
              lookupTarget,
              relatedTableMeta.columns
            ))
          );
        } else if (
          lookupTarget.uidt === UITypes.Lookup ||
          lookupTarget.uidt === UITypes.LinkToAnotherRecord
        ) {
          neighbours.push(...(await processLookupOrLTARColumn(lookupTarget)));
        }
      }
    }
    return [...new Set(neighbours)];
  }

  // include target formula column (i.e. the one to be saved if applicable)
  const targetFormulaCol = columns.find(
    (c: ColumnType) =>
      c.title === (parsedTree as IdentifierNode).name &&
      [UITypes.Formula, UITypes.LinkToAnotherRecord, UITypes.Lookup].includes(
        c.uidt as UITypes
      )
  );

  if (targetFormulaCol && formulaCol?.id) {
    formulaPaths.push({
      [formulaCol?.id as string]: [targetFormulaCol.id],
    });
  }
  const vertices = formulaPaths.length;
  if (vertices > 0) {
    // perform kahn's algo for cycle detection
    const adj = new Map();
    const inDegrees = new Map();
    // init adjacency list & indegree

    for (const [_, v] of Object.entries(formulaPaths)) {
      const src = Object.keys(v)[0];
      const neighbours = v[src];
      inDegrees.set(src, inDegrees.get(src) || 0);
      for (const neighbour of neighbours) {
        adj.set(src, (adj.get(src) || new Set()).add(neighbour));
        inDegrees.set(neighbour, (inDegrees.get(neighbour) || 0) + 1);
      }
    }
    const queue: string[] = [];
    // put all vertices with in-degree = 0 (i.e. no incoming edges) to queue
    inDegrees.forEach((inDegree, col) => {
      if (inDegree === 0) {
        // in-degree = 0 means we start traversing from this node
        queue.push(col);
      }
    });
    // init count of visited vertices
    let visited = 0;
    // BFS
    while (queue.length !== 0) {
      // remove a vertex from the queue
      const src = queue.shift();
      // if this node has neighbours, increase visited by 1
      const neighbours = adj.get(src) || new Set();
      if (neighbours.size > 0) {
        visited += 1;
      }
      // iterate each neighbouring nodes
      neighbours.forEach((neighbour: string) => {
        // decrease in-degree of its neighbours by 1
        inDegrees.set(neighbour, inDegrees.get(neighbour) - 1);
        // if in-degree becomes 0
        if (inDegrees.get(neighbour) === 0) {
          // then put the neighboring node to the queue
          queue.push(neighbour);
        }
      });
    }
    // vertices not same as visited = cycle found
    if (vertices !== visited) {
      throw new FormulaError(
        FormulaErrorType.CIRCULAR_REFERENCE,
        {
          key: 'msg.formula.cantSaveCircularReference',
        },
        'Circular reference detected'
      );
    }
  }
}

export async function validateFormulaAndExtractTreeWithType({
  formula,
  column,
  columns,
  clientOrSqlUi,
  getMeta,
  trackPosition,
  rollup,
}: {
  formula: string;
  columns: UnifiedMetaType.IColumn[];
  clientOrSqlUi: ClientTypeOrSqlUI;
  column?: UnifiedMetaType.IColumn;
  getMeta: UnifiedMetaType.IGetModel;
  trackPosition?: boolean;
  // rollup formula mode: `values` is the rolled-up field of the linked table
  rollup?: {
    valuesColumn: UnifiedMetaType.IColumn;
    valuesColumns: UnifiedMetaType.IColumn[];
  };
}): Promise<ParsedFormulaNode> {
  // extract column list from meta since columns array might not have all columns(system columns)
  const meta = await getMeta(
    unifiedMeta.getContextFromObject(
      (column?.base_id && column) ??
        columns?.[0] ??
        rollup?.valuesColumn ??
        ({} as any)
    ),
    {
      id:
        column?.fk_model_id ||
        columns?.[0]?.fk_model_id ||
        rollup?.valuesColumn?.fk_model_id ||
        '',
    }
  );
  const allColumns = meta?.columns || columns;
  const sqlUI =
    typeof clientOrSqlUi === 'string'
      ? SqlUiFactory.create({ client: clientOrSqlUi })
      : clientOrSqlUi;

  const colAliasToColMap: Record<string, UnifiedMetaType.IColumn> = {};
  const colIdToColMap: Record<string, UnifiedMetaType.IColumn> = {};

  for (const col of columns) {
    colAliasToColMap[col.title] = col;
    colIdToColMap[col.id] = col;
  }

  const nodePosition = (node: ParsedFormulaNode) =>
    (node as any).indexStart >= 0
      ? { index: (node as any).indexStart, length: (node as any).nodeLength }
      : undefined;

  const isNumericLiteral = (node: ParsedFormulaNode) =>
    (node.type === JSEPNode.LITERAL && typeof node.value === 'number') ||
    (node.type === JSEPNode.UNARY_EXP &&
      node.operator === '-' &&
      node.argument.type === JSEPNode.LITERAL &&
      typeof node.argument.value === 'number');

  // An aggregate over `values` (SUM(values)) or a modifier of the value set
  // (ARRAYUNIQUE(values)) in a rollup formula.
  const validateRollupCall = async (
    parsedTree: CallExpressionNode,
    res: CallExpressionNode,
    scope: RollupScope,
    aggregate?: RollupAggregate,
    modifier?: RollupModifier
  ): Promise<ParsedFormulaNode> => {
    const calleeName = parsedTree.callee.name.toUpperCase();
    const position = nodePosition(parsedTree);

    if (aggregate && scope !== 'outer') {
      throw new FormulaError(
        FormulaErrorType.NOT_SUPPORTED,
        { position },
        `${calleeName}(values) cannot be used inside another aggregate`
      );
    }
    if (modifier && scope === 'outer') {
      // as in Airtable, a value list used as text joins with no separator
      return validateAndExtract(concatenateValues(parsedTree), 'outer');
    }
    if (modifier && scope !== 'set') {
      throw new FormulaError(
        FormulaErrorType.NOT_SUPPORTED,
        { position },
        `${calleeName} must be the first argument of an aggregate, e.g. ARRAYJOIN(${calleeName}(values))`
      );
    }

    // Airtable aggregates are variadic: MAX(values, 0) → MAX(MAX(values), 0)
    if (
      aggregate &&
      aggregate !== RollupAggregate.ARRAYJOIN &&
      (parsedTree.arguments?.length ?? 0) > 1
    ) {
      return validateAndExtract(
        splitVariadicAggregate(parsedTree, aggregate, position),
        scope
      );
    }

    const [minArgs, maxArgs] =
      aggregate === RollupAggregate.ARRAYJOIN
        ? [1, 2]
        : modifier === RollupModifier.ARRAYSLICE
        ? [2, 3]
        : [1, 1];
    const args = parsedTree.arguments ?? [];
    if (args.length < minArgs || args.length > maxArgs) {
      throw new FormulaError(
        FormulaErrorType.INVALID_ARG,
        { position },
        minArgs === maxArgs
          ? `${calleeName} takes exactly ${minArgs} argument when aggregating values`
          : `${calleeName} takes ${minArgs} to ${maxArgs} arguments`
      );
    }

    const valuesArg = await validateAndExtract(args[0], 'set');
    const restArgs: ParsedFormulaNode[] = [];
    for (const arg of args.slice(1)) {
      if (
        aggregate === RollupAggregate.ARRAYJOIN &&
        !(arg.type === JSEPNode.LITERAL && typeof arg.value === 'string')
      ) {
        throw new FormulaError(
          FormulaErrorType.INVALID_ARG,
          { position },
          'ARRAYJOIN separator must be a text literal, e.g. ", "'
        );
      }
      if (modifier === RollupModifier.ARRAYSLICE && !isNumericLiteral(arg)) {
        throw new FormulaError(
          FormulaErrorType.INVALID_ARG,
          { position },
          'ARRAYSLICE start and end must be whole numbers'
        );
      }
      restArgs.push(await validateAndExtract(arg, 'outer'));
    }
    res.arguments = [valuesArg, ...restArgs];

    if (modifier) {
      res.rollupModifier = modifier;
      res.dataType = valuesArg.dataType;
      res.referencedColumn = valuesArg.referencedColumn;
      return res;
    }

    res.rollupAggregate = aggregate;
    const valueType = valuesArg.dataType;
    switch (aggregate) {
      case RollupAggregate.SUM:
      case RollupAggregate.AVERAGE:
        if (
          ![
            FormulaDataTypes.NUMERIC,
            FormulaDataTypes.BOOLEAN,
            FormulaDataTypes.COND_EXP,
            FormulaDataTypes.NULL,
            FormulaDataTypes.UNKNOWN,
          ].includes(valueType)
        ) {
          throw new FormulaError(
            FormulaErrorType.INVALID_ARG,
            { position },
            `${calleeName} requires numeric values but found ${valueType}`
          );
        }
        res.dataType = FormulaDataTypes.NUMERIC;
        res.referencedColumn = valuesArg.referencedColumn;
        break;
      case RollupAggregate.MIN:
      case RollupAggregate.MAX:
        // Airtable: numbers only — over text the result is 0
        if (valueType === FormulaDataTypes.STRING) {
          res.dataType = FormulaDataTypes.NUMERIC;
          break;
        }
        res.dataType = [
          FormulaDataTypes.BOOLEAN,
          FormulaDataTypes.COND_EXP,
        ].includes(valueType)
          ? FormulaDataTypes.NUMERIC
          : valueType;
        res.referencedColumn = valuesArg.referencedColumn;
        break;
      case RollupAggregate.COUNT:
      case RollupAggregate.COUNTA:
      case RollupAggregate.COUNTALL:
        res.dataType = FormulaDataTypes.NUMERIC;
        break;
      case RollupAggregate.AND:
      case RollupAggregate.OR:
      case RollupAggregate.XOR:
        res.dataType = FormulaDataTypes.BOOLEAN;
        break;
      case RollupAggregate.CONCATENATE:
      case RollupAggregate.ARRAYJOIN:
        res.dataType = FormulaDataTypes.STRING;
        break;
    }
    return res;
  };

  const validateAndExtract = async (
    parsedTree: ParsedFormulaNode,
    scope: RollupScope = 'outer'
  ): Promise<ParsedFormulaNode> => {
    const res: ParsedFormulaNode = { ...parsedTree };
    // children of a per-value expression stay per-value
    const childScope: RollupScope = scope === 'outer' ? 'outer' : 'row';

    if (parsedTree.type === JSEPNode.CALL_EXP) {
      const calleeName = (
        parsedTree.callee as IdentifierNode
      ).name.toUpperCase();

      if (rollup) {
        const aggregate = getRollupAggregate(calleeName);
        const modifier = getRollupModifier(calleeName);
        if (
          (aggregate || modifier) &&
          parsedTree.arguments?.some(hasFreeRollupValues)
        ) {
          return validateRollupCall(
            parsedTree,
            res as CallExpressionNode,
            scope,
            aggregate,
            modifier
          );
        }
      }
      // validate function name
      if (!formulas[calleeName]) {
        throw new FormulaError(
          FormulaErrorType.INVALID_FUNCTION_NAME,
          {
            calleeName,
            position:
              (parsedTree as any).indexStart >= 0
                ? {
                    index: (parsedTree as any).indexStart,
                    length: (parsedTree as any).nodeLength,
                  }
                : undefined,
          },
          `Function ${calleeName} is not available`
        );
      } else if (sqlUI?.getUnsupportedFnList().includes(calleeName)) {
        throw new FormulaError(
          FormulaErrorType.INVALID_FUNCTION_NAME,
          {
            calleeName,
            position:
              (parsedTree as any).indexStart >= 0
                ? {
                    index: (parsedTree as any).indexStart,
                    length: (parsedTree as any).nodeLength,
                  }
                : undefined,
          },
          `Function ${calleeName} is unavailable for your database`
        );
      }

      // validate arguments
      const validation =
        formulas[calleeName] && formulas[calleeName].validation;
      if (validation && validation.args) {
        if (
          validation.args.rqd !== undefined &&
          validation.args.rqd !== parsedTree.arguments.length
        ) {
          throw new FormulaError(
            FormulaErrorType.INVALID_ARG,
            {
              key: 'msg.formula.requiredArgumentsFormula',
              requiredArguments: validation.args.rqd,
              calleeName,
              position:
                (parsedTree as any).indexStart >= 0
                  ? {
                      index: (parsedTree as any).indexStart,
                      length: (parsedTree as any).nodeLength,
                    }
                  : undefined,
            },
            'Required arguments missing'
          );
        } else if (
          validation.args.min !== undefined &&
          validation.args.min > parsedTree.arguments.length
        ) {
          throw new FormulaError(
            FormulaErrorType.MIN_ARG,
            {
              key: 'msg.formula.minRequiredArgumentsFormula',
              minRequiredArguments: validation.args.min,
              calleeName,
              position:
                (parsedTree as any).indexStart >= 0
                  ? {
                      index: (parsedTree as any).indexStart,
                      length: (parsedTree as any).nodeLength,
                    }
                  : undefined,
            },
            'Minimum arguments required'
          );
        } else if (
          validation.args.max !== undefined &&
          validation.args.max < parsedTree.arguments.length
        ) {
          throw new FormulaError(
            FormulaErrorType.INVALID_ARG,
            {
              key: 'msg.formula.maxRequiredArgumentsFormula',
              maxRequiredArguments: validation.args.max,
              calleeName,
              position:
                (parsedTree as any).indexStart >= 0
                  ? {
                      index: (parsedTree as any).indexStart,
                      length: (parsedTree as any).nodeLength,
                    }
                  : undefined,
            },
            'Maximum arguments missing'
          );
        }
      }
      // get args type and validate
      const validateResult = ((res as CallExpressionNode).arguments =
        await Promise.all(
          parsedTree.arguments.map((arg) => {
            return validateAndExtract(arg, childScope);
          })
        ));
      const argTypes = validateResult.map((v: any) => v.dataType);

      // if validation function is present, call it
      if (formulas[calleeName].validation?.custom) {
        formulas[calleeName].validation?.custom(
          argTypes,
          // need to use res rather than parsedTree
          // because post-processing like referencedColumn is needed
          <CallExpressionNode>res,
          allColumns
        );
      }
      // validate against expected arg types if present
      else if (formulas[calleeName].validation?.args?.type) {
        for (let i = 0; i < validateResult.length; i++) {
          const argPt = validateResult[i];

          // if type
          const expectedArgType = Array.isArray(
            formulas[calleeName].validation.args.type
          )
            ? formulas[calleeName].validation.args.type[i]
            : formulas[calleeName].validation.args.type;

          if (
            argPt.dataType !== expectedArgType &&
            argPt.dataType !== FormulaDataTypes.NULL &&
            argPt.dataType !== FormulaDataTypes.UNKNOWN &&
            expectedArgType !== FormulaDataTypes.STRING
          ) {
            if (argPt.type === JSEPNode.IDENTIFIER) {
              const name =
                columns?.find(
                  (c) => c.id === argPt.name || c.title === argPt.name
                )?.title || argPt.name;

              throw new FormulaError(
                FormulaErrorType.INVALID_ARG,
                {
                  key: 'msg.formula.columnWithTypeFoundButExpected',
                  columnName: name,
                  columnType: argPt.dataType,
                  expectedType: expectedArgType,
                },
                `Field ${name} with ${argPt.dataType} type is found but ${expectedArgType} type is expected`
              );
            } else {
              let key = '';
              const position = i + 1;
              let type = '';

              if (expectedArgType === FormulaDataTypes.NUMERIC) {
                key = 'msg.formula.typeIsExpected';
                type = 'numeric';
              } else if (expectedArgType === FormulaDataTypes.BOOLEAN) {
                key = 'msg.formula.typeIsExpected';
                type = 'boolean';
              } else if (expectedArgType === FormulaDataTypes.DATE) {
                key = 'msg.formula.typeIsExpected';
                type = 'date';
              }

              throw new FormulaError(
                FormulaErrorType.INVALID_ARG,
                {
                  type,
                  key,
                  position,
                  calleeName,
                },
                `${calleeName?.toUpperCase()} requires a ${
                  type || expectedArgType
                } at position ${position}`
              );
            }
          }

          // if expected type is string and arg type is not string, then cast it to string
          if (
            expectedArgType === FormulaDataTypes.STRING &&
            expectedArgType !== argPt.dataType
          ) {
            argPt.cast = FormulaDataTypes.STRING;
          }
        }
      }

      if (typeof formulas[calleeName].returnType === 'function') {
        res.dataType = (formulas[calleeName].returnType as any)?.(
          argTypes
        ) as FormulaDataTypes;
      } else if (formulas[calleeName].returnType) {
        res.dataType = formulas[calleeName].returnType as FormulaDataTypes;
      }

      if (calleeName.toUpperCase().startsWith('ARRAY')) {
        res.inArrayFormat = true;
      }

      Object.assign(
        res,
        extractCallExpressionReferencedInfo({
          parsedTree: res as CallExpressionNode,
        })
      );
    } else if (
      rollup &&
      parsedTree.type === JSEPNode.IDENTIFIER &&
      parsedTree.name === ROLLUP_VALUES_KEYWORD
    ) {
      if (scope === 'outer') {
        // as in Airtable, the value list used as text joins with no separator
        return validateAndExtract(concatenateValues(parsedTree), 'outer');
      }
      Object.assign(
        res,
        await extractColumnIdentifierType({
          col: rollup.valuesColumn,
          columns: rollup.valuesColumns,
          getMeta,
          clientOrSqlUi,
        })
      );
    } else if (rollup && parsedTree.type === JSEPNode.IDENTIFIER) {
      // as in Airtable, `values` is the only field a rollup formula reads
      throw new FormulaError(
        FormulaErrorType.INVALID_COLUMN,
        { position: nodePosition(parsedTree) },
        `A rollup formula can only reference \`values\`, not ${JSON.stringify(
          (parsedTree as IdentifierNode).name
        )}`
      );
    } else if (parsedTree.type === JSEPNode.IDENTIFIER) {
      const identifierName = (parsedTree as IdentifierNode).name;
      const col = (colIdToColMap[identifierName] ||
        colAliasToColMap[identifierName]) as UnifiedMetaType.IColumn;

      if (!col) {
        if (formulas[identifierName]) {
          throw new FormulaError(
            FormulaErrorType.INVALID_SYNTAX,
            {
              key: 'msg.formula.formulaMissingParentheses',
              calleeName: identifierName,
              position:
                (parsedTree as any).indexStart >= 0
                  ? {
                      index: (parsedTree as any).indexEnd,
                      length: 1,
                    }
                  : undefined,
            },
            `Missing parentheses after function name "${JSON.stringify(
              identifierName
            )}"`
          );
        }
        throw new FormulaError(
          FormulaErrorType.INVALID_COLUMN,
          {
            key: 'msg.formula.columnNotAvailable',
            columnName: identifierName,
            position:
              (parsedTree as any).indexStart >= 0
                ? {
                    index: (parsedTree as any).indexStart,
                    length: (parsedTree as any).nodeLength,
                  }
                : undefined,
          },
          `Invalid column name/id ${JSON.stringify(identifierName)} in formula`
        );
      }

      (res as IdentifierNode).name = col.id;

      if (col?.uidt === UITypes.Formula) {
        if (column) {
          // check for circular reference when column is present(only available when calling root formula)
          await checkForCircularFormulaRef(
            column,
            parsedTree,
            columns,
            getMeta
          );
        }
        const formulaRes =
          (<UnifiedMetaType.IFormulaColumn>col.colOptions).parsed_tree ||
          (await validateFormulaAndExtractTreeWithType(
            // formula may include double curly brackets in previous version
            // convert to single curly bracket here for compatibility
            {
              formula: (<UnifiedMetaType.IFormulaColumn>col.colOptions).formula
                .replaceAll('{{', '{')
                .replaceAll('}}', '}'),
              columns,
              clientOrSqlUi,
              getMeta,
            }
          ));

        res.dataType = (formulaRes as ParsedFormulaNode)?.dataType;
        res.inArrayFormat = formulaRes.inArrayFormat;
      } else {
        if (
          col?.uidt === UITypes.Lookup ||
          col?.uidt === UITypes.LinkToAnotherRecord
        ) {
          // check for circular reference when column is present(only available when calling root formula)
          if (column) {
            await checkForCircularFormulaRef(
              column,
              parsedTree,
              columns,
              getMeta
            );
          }
        }
      }
      // extract type and add to res
      Object.assign(
        res,
        await extractColumnIdentifierType({
          col,
          columns,
          getMeta,
          clientOrSqlUi,
        })
      );
    } else if (parsedTree.type === JSEPNode.LITERAL) {
      if (typeof parsedTree.value === 'number') {
        res.dataType = FormulaDataTypes.NUMERIC;
      } else if (typeof parsedTree.value === 'string') {
        res.dataType = FormulaDataTypes.STRING;
      } else if (typeof parsedTree.value === 'boolean') {
        res.dataType = FormulaDataTypes.BOOLEAN;
      } else {
        res.dataType = FormulaDataTypes.STRING;
      }
    } else if (parsedTree.type === JSEPNode.UNARY_EXP) {
      if (
        parsedTree.operator === '-' &&
        parsedTree.argument.type === JSEPNode.LITERAL &&
        typeof parsedTree.argument.value === 'number'
      ) {
        res.dataType = FormulaDataTypes.NUMERIC;
      } else if (parsedTree.operator === '-') {
        // `-x` is validated and built as `0 - x`, sharing the binary path
        const { argument, ...unaryFields } = parsedTree;
        return validateAndExtract({
          ...unaryFields,
          type: JSEPNode.BINARY_EXP,
          operator: '-',
          left: { type: JSEPNode.LITERAL, value: 0, raw: '0' },
          right: argument,
        });
      } else {
        throw new FormulaError(
          FormulaErrorType.NOT_SUPPORTED,
          {},
          `Unary expression '${parsedTree.operator}' is not supported`
        );
      }
    } else if (parsedTree.type === JSEPNode.BINARY_EXP) {
      const argsLeft = await validateAndExtract(parsedTree.left, childScope);
      const argsRight = await validateAndExtract(parsedTree.right, childScope);
      (res as BinaryExpressionNode).left = argsLeft;
      (res as BinaryExpressionNode).right = argsRight;

      const dateAndTimeParsedNode = handleBinaryExpressionForDateAndTime({
        sourceBinaryNode: res as any,
      });
      if (dateAndTimeParsedNode) {
        Object.assign(
          res,
          handleBinaryExpressionForDateAndTime({ sourceBinaryNode: res as any })
        );
        if (res.type !== JSEPNode.BINARY_EXP) {
          (res as any).left = undefined;
          (res as any).right = undefined;
          (res as any).operator = undefined;
        }
      } else if (
        ['==', '<', '>', '<=', '>=', '!='].includes(parsedTree.operator)
      ) {
        res.dataType = FormulaDataTypes.COND_EXP;
      } else if (parsedTree.operator === '+') {
        res.dataType = FormulaDataTypes.NUMERIC;
        // if any side is string/date/other type, then the result will be concatenated string
        // e.g. 1 + '2' = '12'
        if (
          [
            (res as BinaryExpressionNode).left,
            (res as BinaryExpressionNode).right,
          ].some(
            (r) =>
              ![
                FormulaDataTypes.NUMERIC,
                FormulaDataTypes.BOOLEAN,
                FormulaDataTypes.NULL,
                FormulaDataTypes.UNKNOWN,
              ].includes(r.dataType)
          )
        ) {
          res.dataType = FormulaDataTypes.STRING;
        }
      } else if (['&'].includes(parsedTree.operator)) {
        res.dataType = FormulaDataTypes.STRING;
      } else {
        res.dataType = FormulaDataTypes.NUMERIC;
      }

      Object.assign(
        res,
        extractBinaryExpReferencedInfo({
          parsedTree: res as BinaryExpressionNode,
          left: argsLeft,
          right: argsRight,
        })
      );
    } else if (parsedTree.type === JSEPNode.MEMBER_EXP) {
      throw new FormulaError(
        FormulaErrorType.NOT_SUPPORTED,
        {},
        'Bracket notation is not supported'
      );
    } else if (parsedTree.type === JSEPNode.ARRAY_EXP) {
      throw new FormulaError(
        FormulaErrorType.NOT_SUPPORTED,
        {},
        'Array is not supported'
      );
    } else if (parsedTree.type === JSEPNode.COMPOUND) {
      throw new FormulaError(
        FormulaErrorType.NOT_SUPPORTED,
        {},
        'Compound statement is not supported'
      );
    }
    return res;
  };

  try {
    const jsepInstance = trackPosition ? formulaJsepWithIndex : formulaJsep;
    let parsedFormula = jsepInstance(formula) as unknown as ParsedFormulaNode;
    // a bare value set (`values`, `ARRAYUNIQUE(values)`) shows as a joined list
    if (
      rollup &&
      ((parsedFormula.type === JSEPNode.IDENTIFIER &&
        parsedFormula.name === ROLLUP_VALUES_KEYWORD) ||
        (parsedFormula.type === JSEPNode.CALL_EXP &&
          getRollupModifier(parsedFormula.callee.name) &&
          hasFreeRollupValues(parsedFormula)))
    ) {
      parsedFormula = {
        type: JSEPNode.CALL_EXP,
        callee: { type: JSEPNode.IDENTIFIER, name: RollupAggregate.ARRAYJOIN },
        arguments: [parsedFormula],
      } as CallExpressionNode;
    }
    // TODO: better jsep expression handling
    const result = await validateAndExtract(parsedFormula);
    if (rollup) {
      const aggregateCount = extractRollupAggregates(result).length;
      if (!aggregateCount) {
        throw new FormulaError(
          FormulaErrorType.INVALID_ARG,
          {},
          'A rollup formula must aggregate `values`, e.g. SUM(values)'
        );
      }
      // each aggregate is a subquery run for every row read
      if (aggregateCount > MAX_ROLLUP_AGGREGATES) {
        throw new FormulaError(
          FormulaErrorType.INVALID_ARG,
          {},
          `A rollup formula can use at most ${MAX_ROLLUP_AGGREGATES} aggregates, found ${aggregateCount}`
        );
      }
    }
    return result;
  } catch (ex) {
    if (ex instanceof RangeError) {
      ex = new FormulaError(
        FormulaErrorType.INVALID_SYNTAX,
        {},
        'The formula is too long or too deeply nested'
      );
    }
    if (trackPosition) {
      handleFormulaError({ formula, error: ex });
    }
    throw ex;
  }
}
