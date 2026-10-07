import type { WorkflowValueKind } from './transforms';

/**
 * What the workflow expression engine lets you call, for editor autocomplete.
 * Kept in step with the engine's allowlists by `expressionCatalog.test.ts`.
 */
export interface WorkflowExpressionMember {
  name: string;
  /** Shown in the completion list, e.g. `slice(start, end)`. */
  signature: string;
  /** Inserted text; `${…}` marks a placeholder to tab through. */
  snippet: string;
  returns: WorkflowValueKind;
  description: string;
}

const method = (
  name: string,
  params: string[],
  returns: WorkflowValueKind,
  description: string
): WorkflowExpressionMember => ({
  name,
  signature: `${name}(${params.join(', ')})`,
  snippet: `${name}(${params.map((param) => `\${${param}}`).join(', ')})`,
  returns,
  description,
});

export const WORKFLOW_EXPRESSION_METHODS: Partial<
  Record<WorkflowValueKind, WorkflowExpressionMember[]>
> = {
  text: [
    method('toUpperCase', [], 'text', 'Text in capital letters'),
    method('toLowerCase', [], 'text', 'Text in small letters'),
    method('trim', [], 'text', 'Text without spaces at either end'),
    method(
      'slice',
      ['start', 'end'],
      'text',
      'Part of the text between two positions'
    ),
    method(
      'substring',
      ['start', 'end'],
      'text',
      'Part of the text between two positions'
    ),
    method(
      'split',
      ['separator'],
      'list',
      'List of the pieces between each separator'
    ),
    method(
      'replace',
      ['find', 'with'],
      'text',
      'Text with the first match replaced'
    ),
    method('includes', ['text'], 'boolean', 'Whether the text contains this'),
    method(
      'startsWith',
      ['text'],
      'boolean',
      'Whether the text starts with this'
    ),
    method('endsWith', ['text'], 'boolean', 'Whether the text ends with this'),
    method('indexOf', ['text'], 'number', 'Position of the first match, or -1'),
    method(
      'lastIndexOf',
      ['text'],
      'number',
      'Position of the last match, or -1'
    ),
    method('charAt', ['index'], 'text', 'The character at a position'),
    method(
      'padStart',
      ['length', 'fill'],
      'text',
      'Text padded at the start to a length'
    ),
    method(
      'padEnd',
      ['length', 'fill'],
      'text',
      'Text padded at the end to a length'
    ),
    method('repeat', ['count'], 'text', 'Text repeated a number of times'),
    method('concat', ['text'], 'text', 'Text with more text added to the end'),
  ],
  list: [
    method('join', ['separator'], 'text', 'Items joined into one text'),
    method('slice', ['start', 'end'], 'list', 'Items between two positions'),
    method(
      'includes',
      ['value'],
      'boolean',
      'Whether the list contains this value'
    ),
    method('indexOf', ['value'], 'number', 'Position of the value, or -1'),
    method(
      'lastIndexOf',
      ['value'],
      'number',
      'Last position of the value, or -1'
    ),
    method('concat', ['list'], 'list', 'This list followed by another'),
    method(
      'filter',
      ['item => condition'],
      'list',
      'Items the condition is true for'
    ),
    method(
      'map',
      ['item => value'],
      'list',
      'A value worked out from each item'
    ),
    method(
      'find',
      ['item => condition'],
      'any',
      'First item the condition is true for'
    ),
    method(
      'findIndex',
      ['item => condition'],
      'number',
      'Position of the first match, or -1'
    ),
    method(
      'some',
      ['item => condition'],
      'boolean',
      'Whether any item matches'
    ),
    method(
      'every',
      ['item => condition'],
      'boolean',
      'Whether every item matches'
    ),
    method(
      'reduce',
      ['(total, item) => total', 'start'],
      'any',
      'Items combined into one value'
    ),
  ],
  number: [
    method('toFixed', ['digits'], 'text', 'Number as text with fixed decimals'),
    method(
      'toPrecision',
      ['digits'],
      'text',
      'Number as text with this many digits'
    ),
    method('toString', [], 'text', 'Number as text'),
  ],
};

const builtin = (
  name: string,
  params: string[],
  returns: WorkflowValueKind,
  description: string
): WorkflowExpressionMember => method(`$${name}`, params, returns, description);

export const WORKFLOW_EXPRESSION_BUILTINS: WorkflowExpressionMember[] = [
  builtin(
    'ifEmpty',
    ['value', 'fallback'],
    'any',
    'The value, or the fallback when it is empty'
  ),
  builtin('isEmpty', ['value'], 'boolean', 'Whether the value is empty'),
  builtin('isNull', ['value'], 'boolean', 'Whether the value is null'),
  builtin('isUndefined', ['value'], 'boolean', 'Whether the value is missing'),
  builtin('string', ['value'], 'text', 'The value as text'),
  builtin('number', ['value'], 'number', 'The value as a number'),
  builtin('boolean', ['value'], 'boolean', 'The value as true or false'),
  builtin(
    'length',
    ['value'],
    'number',
    'Number of items, or characters in text'
  ),
  builtin('first', ['list'], 'any', 'First item of a list'),
  builtin('last', ['list'], 'any', 'Last item of a list'),
  builtin('round', ['number'], 'number', 'Rounded to the nearest whole number'),
  builtin('floor', ['number'], 'number', 'Rounded down'),
  builtin('ceil', ['number'], 'number', 'Rounded up'),
  builtin('abs', ['number'], 'number', 'Without its sign'),
  builtin('min', ['a', 'b'], 'number', 'The smallest of the numbers'),
  builtin('max', ['a', 'b'], 'number', 'The largest of the numbers'),
  builtin('now', [], 'date', 'The current date and time'),
  builtin(
    'dateAdd',
    ['date', 'amount', 'unit'],
    'date',
    'A date moved by an amount of minutes, hours, days, weeks, months or years'
  ),
];

/** Methods callable on a value of `kind`; unknown kinds get every method once. */
export function getWorkflowExpressionMethods(
  kind: WorkflowValueKind
): WorkflowExpressionMember[] {
  if (kind !== 'any') return WORKFLOW_EXPRESSION_METHODS[kind] ?? [];
  const seen = new Set<string>();
  return Object.values(WORKFLOW_EXPRESSION_METHODS)
    .flat()
    .filter((member) => !seen.has(member.name) && !!seen.add(member.name));
}
