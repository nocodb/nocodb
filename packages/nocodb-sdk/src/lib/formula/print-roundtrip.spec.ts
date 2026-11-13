import { formulaJsep } from './jsepInstances';
import { jsepTreeToFormula } from '../formulaHelpers';

const roundTrip = (formula: string) => jsepTreeToFormula(formulaJsep(formula));

describe('jsepTreeToFormula parentheses', () => {
  it.each([
    ['{A} * {B} / 100', '{A} * {B} / 100'],
    ['({A} * {B}) / 100', '{A} * {B} / 100'],
    ['{A} * ({B} + 1)', '{A} * ({B} + 1)'],
    ['{A} - ({B} - {C})', '{A} - ({B} - {C})'],
    ['({A} - {B}) - {C}', '{A} - {B} - {C}'],
    ['{A} / ({B} * {C})', '{A} / ({B} * {C})'],
    ['IF({A} > 2 && {B} < 3, 1, 0)', 'IF({A} > 2 && {B} < 3, 1, 0)'],
    ['({A} || {B}) && {C}', '({A} || {B}) && {C}'],
    ['-({A} + {B})', '-({A} + {B})'],
    ['({A} + {B}).ROUND()', '({A} + {B}).ROUND()'],
    ['{Qty} * 2', '{Qty} * 2'],
  ])('%s → %s', (input, expected) => {
    expect(roundTrip(input)).toBe(expected);
  });

  it('keeps the meaning of every case', () => {
    for (const f of [
      '{A} - ({B} - {C})',
      '{A} / ({B} * {C})',
      '({A} || {B}) && {C}',
      '-({A} + {B})',
    ]) {
      expect(formulaJsep(roundTrip(f))).toEqual(formulaJsep(f));
    }
  });
});

describe('jsepTreeToFormula string literals', () => {
  const lastArgValue = (formula: string) =>
    (formulaJsep(formula) as { arguments: { value: unknown }[] }).arguments.at(
      -1
    )?.value;

  it.each([
    [String.raw`CONCAT({A}, "line 1\nline 2")`, 'line 1\nline 2'],
    [String.raw`CONCAT("say \"hi\"")`, 'say "hi"'],
    [String.raw`CONCAT('say "hi"')`, 'say "hi"'],
    [String.raw`CONCAT('it\'s')`, "it's"],
    [String.raw`CONCAT("it\\'s")`, String.raw`it\'s`],
    [String.raw`REGEX_MATCH({A}, "\d+")`, String.raw`\d+`],
    [String.raw`CONCAT("a\\b")`, String.raw`a\b`],
  ])('%s keeps its value after a save', (formula, expected) => {
    expect(lastArgValue(roundTrip(formula))).toBe(expected);
  });
});
