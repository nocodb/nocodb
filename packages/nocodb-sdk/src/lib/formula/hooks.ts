import jsep from 'nc-jsep';

// opening and closing string code
const OCURLY_CODE = 123; // '{'
const CCURLY_CODE = 125; // '}'
const PERIOD_CODE = 46; // '.'

export const jsepIndexHook = {
  name: 'indexing',
  init(jsep) {
    // Match identifier in following pattern: {abc-cde}
    jsep.hooks.add('after-expression', function escapedIdentifier(env) {
      if (!env.node) {
        return;
      }

      // search needle, either the callee name, identifier raw, etc
      // a {Field} identifier starts at its brace, so match its raw text
      const needle: string =
        (env.node.type === jsep.IDENTIFIER && env.node.raw) ||
        (env.node.name ??
          env.node.raw ??
          env.node.callee?.name ??
          env.node.property?.raw);
      // current token index
      let lastIndex = this.index;
      if (env.node.arguments) {
        // because arguments are always at the right side, we start from earliest argument
        lastIndex = env.node.arguments
          .map((k) => k.indexStart)
          .filter((k) => k >= 0)
          .reduce((acc, cur) => (acc < cur ? acc : cur), lastIndex);
      }
      // get the last index of needle
      const startIndex = (env.context.expr as string).lastIndexOf(
        needle,
        lastIndex
      );
      env.node.indexStart = startIndex;
      env.node.nodeLength = lastIndex - startIndex;
      env.node.indexEnd = this.index;
      return env.node;
    });
  },
} as jsep.IPlugin;

// Reads a `{abc-cde}` (or legacy `{{abc}}`) reference at the current index
function gobbleCurlyIdentifier(ctx, jsep): jsep.Expression {
  const patternIndex = ctx.index;
  // move to the next character until we find a closing curly bracket
  while (ctx.index < ctx.expr.length) {
    ++ctx.index;
    if (ctx.code === CCURLY_CODE) {
      let identifier = ctx.expr.slice(patternIndex, ++ctx.index);

      // if starting with double curley brace then check for ending double curley brace
      // if found include with the identifier
      if (
        identifier.startsWith('{{') &&
        ctx.expr.slice(patternIndex, ctx.index + 1).endsWith('}')
      ) {
        identifier = ctx.expr.slice(patternIndex, ++ctx.index);
      }
      return {
        type: jsep.IDENTIFIER,
        name: /^{{.*}}$/.test(identifier)
          ? // start would be the position of the first curly bracket
            // add 2 to point to the first character for expressions like {{col1}}
            identifier.slice(2, -2)
          : // start would be the position of the first curly bracket
            // add 1 to point to the first character for expressions like {col1}
            identifier.slice(1, -1),
        raw: identifier,
      };
    }
  }
  return ctx.throwError('Unclosed }');
}

// Consumes a `.` only when a `{field}` follows it, e.g. in `{A}.{B}`
function gobbleFieldAccessDot(ctx): boolean {
  const start = ctx.index;
  ctx.gobbleSpaces();
  if (ctx.code === PERIOD_CODE) {
    ctx.index++;
    ctx.gobbleSpaces();
    if (ctx.code === OCURLY_CODE) return true;
  }
  ctx.index = start;
  return false;
}

export const isCurlyIdentifier = (node: any) =>
  node?.type === 'Identifier' &&
  typeof node.raw === 'string' &&
  node.raw.startsWith('{');

// `x.FN(a, b)` → `FN(x, a, b)`, flagged so it can be printed back as a chain
export function desugarChainedCalls(node: any) {
  if (!node || typeof node !== 'object') return node;
  if (
    node.type === 'CallExpression' &&
    node.callee?.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.property?.type === 'Identifier' &&
    !isCurlyIdentifier(node.callee.property)
  ) {
    return {
      type: 'CallExpression',
      callee: { type: 'Identifier', name: node.callee.property.name },
      arguments: [desugarChainedCalls(node.callee.object), ...node.arguments],
      chained: true,
    };
  }
  if (node.type === 'MemberExpression') {
    return { ...node, object: desugarChainedCalls(node.object) };
  }
  return node;
}

export const jsepCurlyHook = {
  name: 'curly',
  init(jsep) {
    // Match identifier in following pattern: {abc-cde}
    jsep.hooks.add('gobble-token', function escapedIdentifier(env) {
      // check if the current token is an opening curly bracket
      if (this.code !== OCURLY_CODE) return;

      let node: jsep.Expression = gobbleCurlyIdentifier(this, jsep);

      // `{Link}.{Field}` walks into the linked record
      while (gobbleFieldAccessDot(this)) {
        node = {
          type: jsep.MEMBER_EXP,
          computed: false,
          object: node,
          property: gobbleCurlyIdentifier(this, jsep),
        };
      }

      // method calls, e.g. `{Tasks}.{Hours}.SUM()`
      env.node = this.gobbleTokenProperty(node);
    });

    jsep.hooks.add('after-token', function chainedCalls(env) {
      if (env.node) env.node = desugarChainedCalls(env.node);
    });
  },
} as jsep.IPlugin;

const normalizeEquals = (node) => {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach(normalizeEquals);
    return;
  }
  if (node.type === 'BinaryExpression' && node.operator === '=') {
    node.operator = '==';
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') normalizeEquals(value);
  }
};

// Airtable-style `=` comparison, parsed as `==`
export const jsepEqualsHook = {
  name: 'equals',
  init(jsep) {
    jsep.addBinaryOp('=', jsep.binary_ops['==']);
    jsep.hooks.add('after-all', (env) => normalizeEquals(env.node));
  },
} as jsep.IPlugin;
