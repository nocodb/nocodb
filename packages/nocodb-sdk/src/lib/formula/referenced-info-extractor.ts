import { arrUniq } from '../arrayHelpers';
import UITypes from '../UITypes';
import { FormulaDataTypes } from './enums';
import {
  BinaryExpressionNode,
  CallExpressionNode,
  ParsedFormulaNode,
} from './operators';
import { ReferencedInfo } from './types';
import { arrFlatMap } from '../arrayHelpers';

const IMPURE_OPR_UIDT_MAP = new Map<UITypes, UITypes>([
  [UITypes.SingleSelect, UITypes.SingleLineText],
  [UITypes.MultiSelect, UITypes.SingleLineText],
  [UITypes.Attachment, UITypes.SingleLineText],
  [UITypes.User, UITypes.SingleLineText],
  [UITypes.Email, UITypes.SingleLineText],
  [UITypes.URL, UITypes.SingleLineText],
  [UITypes.Number, UITypes.Decimal],
  [UITypes.Rating, UITypes.Decimal],
  [UITypes.Year, UITypes.Number],
  [UITypes.Year, UITypes.Number],
]);

/**
 * Filters and refines referenced column information based on allowed UI data types (UIDTs).
 * This function ensures that the data types associated with referenced columns and their candidates
 * are valid and consistent with a set of allowed UIDTs for a specific operation or formula.
 *
 * @param {object} params - The parameters for filtering.
 * @param {ReferencedInfo} params.referencedInfo - An object containing details about a referenced column,
 *   including the `referencedColumn` itself (with its ID and UIDT) and a list of `uidtCandidates` (potential UIDTs).
 * @param {UITypes[]} params.allowedUidts - An array of `UITypes` that are considered valid for the current context.
 * @param {UITypes} params.defaultUidt - A fallback `UIType` to use if no valid `uidtCandidates` are found after filtering.
 * @param {boolean} [params.isPureOperation=false] - A flag indicating if the operation is "pure."
 *   A pure operation (e.g., TRIM, ARRAYUNIQUE) doesn't fundamentally change the display value's
 *   underlying type, even if it modifies the value itself. Impure operations might map certain
 *   UI types (like SingleSelect) to a more generic type (like SingleLineText).
 * @returns {ReferencedInfo} A new `ReferencedInfo` object with the updated `referencedColumn`,
 *   `uidtCandidates`, and `invalidForReferenceColumn` status, ensuring consistency with formula requirements.
 */
const filterReferencedInfoByUidt = ({
  referencedInfo,
  allowedUidts,
  defaultUidt,
  isPureOperation = false,
}: {
  referencedInfo: ReferencedInfo;
  allowedUidts: UITypes[];
  defaultUidt: UITypes;
  isPureOperation?: boolean;
}): ReferencedInfo => {
  const referencedColumn =
    referencedInfo.referencedColumn &&
    allowedUidts.includes(referencedInfo.referencedColumn.uidt as UITypes) &&
    (isPureOperation ||
      !IMPURE_OPR_UIDT_MAP.has(referencedInfo.referencedColumn.uidt as UITypes))
      ? referencedInfo.referencedColumn
      : undefined;
  let uidtCandidates =
    referencedInfo.uidtCandidates?.filter((uidt) =>
      allowedUidts.includes(uidt)
    ) ?? [];
  if (!isPureOperation) {
    uidtCandidates = uidtCandidates.map((c) =>
      IMPURE_OPR_UIDT_MAP.get(c as UITypes) ?? c
    ).filter(k => k);
  }
  return {
    ...referencedInfo,
    referencedColumn,
    uidtCandidates:
      uidtCandidates.length > 0 ? arrUniq(uidtCandidates) : [defaultUidt],
    // Determine if the referenced column is invalid. This can happen if it was already marked as invalid,
    // or if the `referencedColumn` was present in the original `referencedInfo` but got filtered out
    // during the current processing (i.e., `referencedColumn` is now undefined while `referencedInfo.referencedColumn` was not).
    invalidForReferenceColumn:
      referencedInfo.invalidForReferenceColumn ||
      !!referencedColumn !== !!referencedInfo.referencedColumn,
  };
};

/**
 * Extracts and refines information about referenced columns from an array of parsed formula nodes.
 * This function is crucial for ensuring type compatibility and validity of referenced columns
 * within formula arguments based on the expected data type of the formula's output.
 *
 * @param {ParsedFormulaNode[]} nodes - An array of parsed formula nodes, representing the arguments
 *   of a formula. Each node may contain information about referenced columns and their potential
 *   UI data types (UIDTs).
 * @param {FormulaDataTypes} dataType - The expected output data type of the formula. This is used
 *   to filter and validate the UIDTs of the referenced columns.
 * @param {{ isPureOperation?: boolean }} [option] - An optional object containing additional
 *   configuration.
 * @param {boolean} [option.isPureOperation=false] - A flag indicating if the operation is "pure."
 *   A pure operation (e.g., TRIM, ARRAYUNIQUE) does not fundamentally change the display value's
 *   underlying type, even if it modifies the value itself. Impure operations might map certain
 *   UI types (like SingleSelect) to a more generic type (like SingleLineText).
 * @returns {ReferencedInfo} A `ReferencedInfo` object containing the aggregated and filtered
 *   information about referenced columns, their UIDT candidates, and a flag indicating if the
 *   reference is invalid.
 */
export const getReferencedInfoFromArgs = (
  nodes: ParsedFormulaNode[],
  dataType: FormulaDataTypes,
  option: {
    isPureOperation?: boolean;
  } = { isPureOperation: false }
): ReferencedInfo => {
  let referencedColumn: { id: string; uidt: string };
  let invalidForReferenceColumn = nodes
    .some(c => c.invalidForReferenceColumn);
  const referencedColumns = invalidForReferenceColumn
    ? []
    : nodes.map((k) => k.referencedColumn).filter((k) => k);
  const uniqueLength = arrUniq(referencedColumns.map((k) => k.id)).length;
  if (uniqueLength === 1) {
    referencedColumn = referencedColumns[0];
  } else if (uniqueLength > 1) {
    invalidForReferenceColumn = true;
  }
  const uidtCandidates = arrFlatMap(nodes
    .map((k) => k.uidtCandidates));
  const referencedInfo = {
    referencedColumn,
    uidtCandidates,
    invalidForReferenceColumn,
  };

  switch (dataType) {
    case FormulaDataTypes.BOOLEAN: {
      return filterReferencedInfoByUidt({
        referencedInfo,
        allowedUidts: [UITypes.Checkbox],
        defaultUidt: UITypes.Checkbox,
        ...option,
      });
    }
    case FormulaDataTypes.COND_EXP: {
      return filterReferencedInfoByUidt({
        referencedInfo,
        allowedUidts: [UITypes.Checkbox],
        defaultUidt: UITypes.Checkbox,
        ...option,
      });
    }
    case FormulaDataTypes.STRING: {
      return filterReferencedInfoByUidt({
        referencedInfo,
        allowedUidts: [
          UITypes.SingleLineText,
          UITypes.LongText,
          UITypes.Email,
          UITypes.URL,
        ],
        defaultUidt: UITypes.SingleLineText,
        ...option,
      });
    }
    case FormulaDataTypes.NUMERIC: {
      return filterReferencedInfoByUidt({
        referencedInfo,
        allowedUidts: [
          UITypes.Number,
          UITypes.Decimal,
          UITypes.Currency,
          UITypes.Percent,
          UITypes.Rating,
        ],
        defaultUidt: UITypes.Decimal,
        ...option,
      });
    }
    case FormulaDataTypes.DATE: {
      return filterReferencedInfoByUidt({
        referencedInfo,
        allowedUidts: [UITypes.Date, UITypes.DateTime],
        defaultUidt: UITypes.DateTime,
        ...option,
      });
    }
    case FormulaDataTypes.INTERVAL: {
      return filterReferencedInfoByUidt({
        referencedInfo,
        allowedUidts: [UITypes.Time, UITypes.Duration],
        defaultUidt: UITypes.Time,
        ...option,
      });
    }
    case FormulaDataTypes.ARRAY: {
      return filterReferencedInfoByUidt({
        referencedInfo,
        allowedUidts: [UITypes.LinkToAnotherRecord, UITypes.Lookup],
        defaultUidt: UITypes.SingleLineText,
        ...option,
      });
    }
    default: {
      return {
        uidtCandidates: [UITypes.SingleLineText],
        invalidForReferenceColumn,
      } as ReferencedInfo;
    }
  }
};

/**
 * get referenced column info for call expression
 */
export const extractBinaryExpReferencedInfo = ({
  parsedTree,
  left,
  right,
}: {
  parsedTree: BinaryExpressionNode;
  left: ParsedFormulaNode;
  right: ParsedFormulaNode;
}) => {
  return getReferencedInfoFromArgs([left, right], parsedTree.dataType, {
    isPureOperation: false,
  });
};

/**
 * get referenced column info for call expression
 */
export const extractCallExpressionReferencedInfo = ({
  parsedTree,
}: {
  parsedTree: CallExpressionNode;
}) => {
  let nodeArgs = parsedTree.arguments ?? [];
  let isPureOperation = false;
  switch (parsedTree.callee.name) {
    case 'TRIM':
    case 'MAX':
    case 'MIN':
      isPureOperation = true;
      break;

    case 'DATEADD':
    case 'ROUND':
    case 'MOD':
    case 'POWER':
    case 'REPEAT':
    case 'REPLACE':
    case 'REGEX_EXTRACT':
    case 'REGEX_REPLACE':
    case 'MID':
    case 'LEFT':
    case 'RIGHT':
    case 'ROUNDDOWN':
    case 'ROUNDUP':
    case 'JSON_EXTRACT':
    case 'SUBSTR': {
      nodeArgs = nodeArgs.slice(0, 1);
      break;
    }

    case 'LOG': {
      nodeArgs = nodeArgs.slice(1, 2);
      break;
    }

    // URL won't need the referenced column info
    case 'URL':
    case 'REGEX_MATCH':
    case 'ISBLANK':
    case 'ISNOTBLANK':
    case 'DAY':
    case 'MONTH':
    case 'YEAR':
    case 'HOUR':
    case 'WEEKDAY':
    case 'LEN':
    case 'DATESTR':
    case 'AND':
    case 'OR':
    case 'XOR':
    case 'COUNTA':
    case 'COUNT':
    case 'COUNTALL':
    case 'SEARCH': {
      nodeArgs = [];
      break;
    }

    case 'ARRAYUNIQUE':
    case 'ARRAYSORT':
    case 'ARRAYCOMPACT':
    case 'ARRAYSLICE': {
      nodeArgs = nodeArgs.slice(0, 1);
      isPureOperation = true;
      break;
    }

    case 'IF': {
      nodeArgs = nodeArgs.slice(1);
      // is pure operation if the 2nd and 3rd arguments only has data type NULL or single referenced column
      const uniqueReferencedColumnIds = arrUniq(
        nodeArgs.map((n) => n.referencedColumn?.id).filter((k) => k)
      );
      const notNullDataTypes = nodeArgs
        .filter(
          (n) => !n.referencedColumn && n.dataType !== FormulaDataTypes.NULL
        )
        .map((n) => n.dataType);

      isPureOperation =
        notNullDataTypes.length === 0 && uniqueReferencedColumnIds.length <= 1;
      break;
    }

    case 'SWITCH': {
      nodeArgs = nodeArgs.slice(1).filter((_val, index) => index % 2 === 1);
      // is pure operation if resulting arguments only has data type NULL or single referenced column

      // is pure operation if the 2nd and 3rd arguments only has data type NULL or single referenced column
      const uniqueReferencedColumnIds = arrUniq(
        nodeArgs.map((n) => n.referencedColumn?.id).filter((k) => k)
      );
      const notNullDataTypes = nodeArgs
        .filter(
          (n) => !n.referencedColumn && n.dataType !== FormulaDataTypes.NULL
        )
        .map((n) => n.dataType);

      isPureOperation =
        notNullDataTypes.length === 0 && uniqueReferencedColumnIds.length <= 1;

      break;
    }
  }
  return getReferencedInfoFromArgs(nodeArgs, parsedTree.dataType, {
    isPureOperation,
  });
};
