import {
  escapeRegexString,
  getRowColPositionFromIndex,
} from '~/lib/stringHelpers';
import { FormulaError } from './error';
import { FormulaErrorType } from './enums';
const REGEX_ERROR_AT_CHARACTER = /\sat character (\d+)/;

const EQUALS_HINT =
  ' Use == for equality; a single = is not a comparison operator in formulas.';

// A bare `=` outside string literals (not part of ==, !=, <=, >=).
const hasBareEquals = (formula: string) =>
  /(?<![=!<>])=(?!=)/.test(
    formula.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '')
  );

const equalsHint = (formula: string, message: string) =>
  /Expected/.test(message) &&
  !message.endsWith(EQUALS_HINT) &&
  hasBareEquals(formula)
    ? EQUALS_HINT
    : '';

// For callers that don't track positions (the API), so they get the hint too.
export function appendEqualsHint(formula: string, error) {
  if (typeof error?.message === 'string') {
    error.message += equalsHint(formula, error.message);
  }
  return error;
}

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

    const hint = equalsHint(formula, error.message);

    throw new FormulaError(
      error.type ?? FormulaErrorType.INVALID_SYNTAX,
      {
        ...(error.extra ?? {}),
        position: { ...colRowPosition, length: identifierLength },
      },
      `${error.message}${hint}`
    );
  } else {
    throw error;
  }
}
