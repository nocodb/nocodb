import {
  escapeRegexString,
  getRowColPositionFromIndex,
} from '~/lib/stringHelpers';
import { FormulaError } from './error';
import { FormulaErrorType } from './enums';
const REGEX_ERROR_AT_CHARACTER = /\sat character (\d+)/;

export function handleFormulaError({
  formula,
  error,
}: {
  formula: string;
  error;
}) {
  let position: number;
  let identifierLength: number;
  if (error.extra?.position) {
    position = error.extra.position.index;
    identifierLength = error.extra.position.length;
  } else if (error.extra?.columnName ?? error.extra?.calleeName) {
    const needle = error.extra?.columnName ?? error.extra?.calleeName;

    const identifierMatch = formula.match(
      new RegExp(`\\b${escapeRegexString(needle)}\\b`)
    );
    if (typeof identifierMatch?.index === 'number') {
      position = identifierMatch.index;
      identifierLength = needle.length;
    }
  } else {
    const message: string = error.message;

    // check for error character at
    const errorAtRegex = message.match(REGEX_ERROR_AT_CHARACTER);
    if (errorAtRegex?.[0]) {
      position = Number(errorAtRegex[1]);
      identifierLength = 1;
    }
  }
  if (typeof position === 'number') {
    const colRowPosition = getRowColPositionFromIndex({
      stack: formula,
      position,
    });

    throw new FormulaError(
      error.type ?? FormulaErrorType.INVALID_SYNTAX,
      {
        ...(error.extra ?? {}),
        position: { ...colRowPosition, length: identifierLength },
      },
      error.message
    );
  } else {
    throw error;
  }
}
