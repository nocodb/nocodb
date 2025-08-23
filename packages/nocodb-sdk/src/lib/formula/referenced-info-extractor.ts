import { uniq } from '../arrayHelpers';
import UITypes from '../UITypes';
import { FormulaDataTypes } from './enums';
import {
  BinaryExpressionNode,
  CallExpressionNode,
  ParsedFormulaNode,
} from './operators';
import { ReferencedInfo } from './types';

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

const filterReferencedInfoByUidt = ({
  referencedInfo,
  allowedUidts,
  defaultUidt,
  // isPureOperation = operation that don't modify the value
  // meaningful enough to change it's display value, like TRIM, ARRAYUNIQUE
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
  if (isPureOperation) {
    uidtCandidates = uidtCandidates.map((c) =>
      IMPURE_OPR_UIDT_MAP.get(c as UITypes)
    );
  }
  return {
    ...referencedInfo,
    referencedColumn,
    uidtCandidates:
      uidtCandidates.length > 0 ? uniq(uidtCandidates) : [defaultUidt],
    invalidForReferenceColumn:
      referencedInfo.invalidForReferenceColumn ||
      // if the referencedColumn is somehow filtered out, make it invalidForReferenceColumn
      !!referencedColumn !== !!referencedInfo.referencedColumn,
  };
};

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
  const uniqueLength = uniq(referencedColumns.map((k) => k.id)).length;
  if (uniqueLength === 1) {
    referencedColumn = referencedColumns[0];
  } else if (uniqueLength > 1) {
    invalidForReferenceColumn = true;
  }
  const uidtCandidates = nodes
    .map((k) => k.uidtCandidates).flatMap(k => k);
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
      const uniqueReferencedColumnIds = uniq(
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
      const uniqueReferencedColumnIds = uniq(
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
