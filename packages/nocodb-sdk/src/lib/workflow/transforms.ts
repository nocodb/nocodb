import { VariableType } from './interface';

/**
 * Transforms a user can stack on a workflow variable without writing an expression.
 * Each one writes plain engine syntax (a whitelisted method or a `$` built-in), so a
 * transformed chip is still an ordinary `{{ }}` expression to the executor.
 */

export type WorkflowTransformCategory =
  | 'text'
  | 'number'
  | 'list'
  | 'date'
  | 'any';

export type WorkflowTransformArgType = 'string' | 'number' | 'select';

export interface WorkflowTransformArg {
  key: string;
  type: WorkflowTransformArgType;
  default: string | number;
  options?: string[];
}

export interface WorkflowTransformStep {
  id: string;
  args?: Record<string, string | number>;
}

/** What a value is, as far as transforms and autocomplete care. `any` is unknown. */
export type WorkflowValueKind =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'list'
  | 'object'
  | 'any';

export interface WorkflowExpressionTransform {
  id: string;
  category: WorkflowTransformCategory;
  /** Kinds it works on; `any` takes every kind. */
  accepts: WorkflowValueKind[];
  /** Kind it produces; `input` keeps the kind it was given. */
  returns: WorkflowValueKind | 'input';
  args?: WorkflowTransformArg[];
  /** Wraps `inner` in this transform. */
  apply: (inner: string, args: Record<string, string | number>) => string;
  /** Peels this transform off the outside of `expression`, or null when it is not the outermost one. */
  peel: (
    expression: string
  ) => { inner: string; args: Record<string, string | number> } | null;
}

export const WORKFLOW_DATE_ADD_UNITS = [
  'minutes',
  'hours',
  'days',
  'weeks',
  'months',
  'years',
];

// `{{ }}` tokens are matched with `[^{}]`, so a brace in an argument would end the token early.
const quote = (value: string | number) =>
  JSON.stringify(String(value).replace(/[{}]/g, ''));

const STRING_LITERAL = `"(?:[^"\\\\]|\\\\.)*"`;

/** True when parentheses, brackets and quotes in `text` all close, so it is one complete operand. */
function isBalanced(text: string) {
  let depth = 0;
  let quoteChar: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoteChar) {
      if (char === '\\') i++;
      else if (char === quoteChar) quoteChar = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') quoteChar = char;
    else if (char === '(' || char === '[') depth++;
    else if (char === ')' || char === ']') {
      depth--;
      if (depth < 0) return false;
    }
  }
  return depth === 0 && !quoteChar;
}

/** True when `text` is one operand with nothing at its top level that binds looser than a method call. */
function isSingleOperand(text: string) {
  if (!isBalanced(text)) return false;
  let depth = 0;
  let quoteChar: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoteChar) {
      if (char === '\\') i++;
      else if (char === quoteChar) quoteChar = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') quoteChar = char;
    else if (char === '(' || char === '[') depth++;
    else if (char === ')' || char === ']') depth--;
    else if (depth === 0 && /[\s+\-*/%<>=&|!?:,]/.test(char)) return false;
  }
  return true;
}

type TransformKinds = Pick<WorkflowExpressionTransform, 'accepts' | 'returns'>;

function methodTransform(
  id: string,
  category: WorkflowTransformCategory,
  method: string,
  kinds: TransformKinds
): WorkflowExpressionTransform {
  const pattern = new RegExp(`^([\\s\\S]+)\\.${method}\\(\\)$`);
  return {
    id,
    category,
    ...kinds,
    apply: (inner) => `${inner}.${method}()`,
    peel: (expression) => {
      const match = pattern.exec(expression);
      return match && isSingleOperand(match[1])
        ? { inner: match[1], args: {} }
        : null;
    },
  };
}

function builtinTransform(
  id: string,
  category: WorkflowTransformCategory,
  builtin: string,
  kinds: TransformKinds
): WorkflowExpressionTransform {
  const pattern = new RegExp(`^\\$${builtin}\\(([\\s\\S]+)\\)$`);
  return {
    id,
    category,
    ...kinds,
    apply: (inner) => `$${builtin}(${inner})`,
    peel: (expression) => {
      const match = pattern.exec(expression);
      return match && isBalanced(match[1])
        ? { inner: match[1], args: {} }
        : null;
    },
  };
}

const ifEmptyPattern = new RegExp(
  `^\\$ifEmpty\\(([\\s\\S]+),\\s*(${STRING_LITERAL})\\)$`
);

const joinPattern = new RegExp(`^([\\s\\S]+)\\.join\\((${STRING_LITERAL})\\)$`);

const dateAddPattern = new RegExp(
  `^\\$dateAdd\\(([\\s\\S]+),\\s*(-?\\d+(?:\\.\\d+)?),\\s*"(\\w+)"\\)$`
);

const TEXT_TO_TEXT: TransformKinds = { accepts: ['text'], returns: 'text' };

const NUMBER_TO_NUMBER: TransformKinds = {
  accepts: ['number'],
  returns: 'number',
};

export const WORKFLOW_EXPRESSION_TRANSFORMS: WorkflowExpressionTransform[] = [
  methodTransform('uppercase', 'text', 'toUpperCase', TEXT_TO_TEXT),
  methodTransform('lowercase', 'text', 'toLowerCase', TEXT_TO_TEXT),
  methodTransform('trim', 'text', 'trim', TEXT_TO_TEXT),
  builtinTransform('toText', 'any', 'string', {
    accepts: ['any'],
    returns: 'text',
  }),
  {
    id: 'defaultIfEmpty',
    category: 'any',
    accepts: ['any'],
    returns: 'input',
    args: [{ key: 'value', type: 'string', default: '' }],
    apply: (inner, args) => `$ifEmpty(${inner}, ${quote(args.value ?? '')})`,
    peel: (expression) => {
      const match = ifEmptyPattern.exec(expression);
      return match && isBalanced(match[1])
        ? { inner: match[1], args: { value: JSON.parse(match[2]) } }
        : null;
    },
  },
  builtinTransform('toNumber', 'number', 'number', {
    accepts: ['text', 'number', 'boolean'],
    returns: 'number',
  }),
  builtinTransform('round', 'number', 'round', NUMBER_TO_NUMBER),
  builtinTransform('roundDown', 'number', 'floor', NUMBER_TO_NUMBER),
  builtinTransform('roundUp', 'number', 'ceil', NUMBER_TO_NUMBER),
  builtinTransform('absolute', 'number', 'abs', NUMBER_TO_NUMBER),
  builtinTransform('count', 'list', 'length', {
    accepts: ['list', 'text'],
    returns: 'number',
  }),
  // An item of a list could be anything.
  builtinTransform('first', 'list', 'first', {
    accepts: ['list'],
    returns: 'any',
  }),
  builtinTransform('last', 'list', 'last', {
    accepts: ['list'],
    returns: 'any',
  }),
  {
    id: 'join',
    category: 'list',
    accepts: ['list'],
    returns: 'text',
    args: [{ key: 'separator', type: 'string', default: ', ' }],
    apply: (inner, args) => `${inner}.join(${quote(args.separator ?? ', ')})`,
    peel: (expression) => {
      const match = joinPattern.exec(expression);
      return match && isSingleOperand(match[1])
        ? { inner: match[1], args: { separator: JSON.parse(match[2]) } }
        : null;
    },
  },
  {
    id: 'addTime',
    category: 'date',
    // Dates arrive from records and triggers as ISO text.
    accepts: ['date', 'text'],
    returns: 'date',
    args: [
      { key: 'amount', type: 'number', default: 1 },
      {
        key: 'unit',
        type: 'select',
        default: 'days',
        options: WORKFLOW_DATE_ADD_UNITS,
      },
    ],
    apply: (inner, args) =>
      `$dateAdd(${inner}, ${Number(args.amount) || 0}, ${quote(
        WORKFLOW_DATE_ADD_UNITS.includes(String(args.unit)) ? args.unit : 'days'
      )})`,
    peel: (expression) => {
      const match = dateAddPattern.exec(expression);
      return match && isBalanced(match[1])
        ? {
            inner: match[1],
            args: { amount: Number(match[2]), unit: match[3] },
          }
        : null;
    },
  },
];

const transformById = new Map(
  WORKFLOW_EXPRESSION_TRANSFORMS.map((transform) => [transform.id, transform])
);

export function getWorkflowExpressionTransform(id: string) {
  return transformById.get(id);
}

/** Applies `steps` to `base` in order (first step innermost). Unknown ids are skipped. */
export function applyWorkflowExpressionTransforms(
  base: string,
  steps: WorkflowTransformStep[]
): string {
  return steps.reduce((expression, step) => {
    const transform = transformById.get(step.id);
    if (!transform) return expression;
    const args = Object.fromEntries(
      (transform.args ?? []).map((arg) => [
        arg.key,
        step.args?.[arg.key] ?? arg.default,
      ])
    );
    return transform.apply(expression, args);
  }, base);
}

/**
 * Splits an expression into the value it starts from and the transforms stacked on it,
 * first step innermost. An expression with no known transform comes back with no steps.
 */
export function parseWorkflowExpressionTransforms(expression: string): {
  base: string;
  steps: WorkflowTransformStep[];
} {
  let current = expression.trim();
  const steps: WorkflowTransformStep[] = [];

  for (;;) {
    let peeled: {
      id: string;
      inner: string;
      args: Record<string, string | number>;
    } | null = null;
    for (const transform of WORKFLOW_EXPRESSION_TRANSFORMS) {
      const result = transform.peel(current);
      if (result) {
        peeled = { id: transform.id, ...result };
        break;
      }
    }
    if (!peeled) break;
    steps.unshift(
      Object.keys(peeled.args).length
        ? { id: peeled.id, args: peeled.args }
        : { id: peeled.id }
    );
    current = peeled.inner.trim();
  }

  return { base: current, steps };
}

const ISO_DATE =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** Kind of an actual value, e.g. a step's test output. */
export function getWorkflowValueKind(value: unknown): WorkflowValueKind {
  if (value === null || value === undefined) return 'any';
  if (Array.isArray(value)) return 'list';
  if (value instanceof Date) return 'date';
  if (typeof value === 'string') return ISO_DATE.test(value) ? 'date' : 'text';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'object') return 'object';
  return 'any';
}

/** Kind a variable is declared as. */
export function getWorkflowVariableKind(
  type: VariableType | undefined,
  isArray?: boolean
): WorkflowValueKind {
  if (isArray) return 'list';
  switch (type) {
    case VariableType.String:
      return 'text';
    case VariableType.Number:
    case VariableType.Integer:
      return 'number';
    case VariableType.Boolean:
      return 'boolean';
    case VariableType.Date:
    case VariableType.DateTime:
      return 'date';
    case VariableType.Array:
      return 'list';
    case VariableType.Object:
      return 'object';
    default:
      return 'any';
  }
}

/** Transforms that can take a value of `kind`; an unknown kind gets them all. */
export function getWorkflowTransformsFor(
  kind: WorkflowValueKind
): WorkflowExpressionTransform[] {
  if (kind === 'any') return WORKFLOW_EXPRESSION_TRANSFORMS;
  return WORKFLOW_EXPRESSION_TRANSFORMS.filter(
    (transform) =>
      transform.accepts.includes('any') || transform.accepts.includes(kind)
  );
}

/** Kind of the value after `steps` run on a value of `kind`. */
export function getWorkflowKindAfter(
  kind: WorkflowValueKind,
  steps: WorkflowTransformStep[]
): WorkflowValueKind {
  return steps.reduce<WorkflowValueKind>((current, step) => {
    const returns = transformById.get(step.id)?.returns;
    if (!returns) return 'any';
    return returns === 'input' ? current : returns;
  }, kind);
}
