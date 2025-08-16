import jsep from 'jsep';

// opening and closing string code
const OCURLY_CODE = 123; // '{'
const CCURLY_CODE = 125; // '}'

export const jsepIndexHook = {
  name: 'indexing',
  init(jsep) {
    // Match identifier in following pattern: {abc-cde}
    jsep.hooks.add('after-expression', function escapedIdentifier(env) {
      if (!env.node) {
        return;
      }

      // search needle, either the callee name, identifier raw, etc
      const needle: string =
        env.node.name ?? env.node.raw ?? env.node.callee?.name;
      // current token index
      let lastIndex = this.index;
      if (env.node.arguments) {
        // because arguments are always at the right side, we start from earliest argument
        lastIndex = env.node.arguments
          .map((k) => k.indexStart)
          .filter((k) => k)
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

export const jsepCurlyHook = {
  name: 'curly',
  init(jsep) {
    // Match identifier in following pattern: {abc-cde}
    jsep.hooks.add('gobble-token', function escapedIdentifier(env) {
      // check if the current token is an opening curly bracket
      if (this.code === OCURLY_CODE) {
        const patternIndex = this.index;
        // move to the next character until we find a closing curly bracket
        while (this.index < this.expr.length) {
          ++this.index;
          if (this.code === CCURLY_CODE) {
            let identifier = this.expr.slice(patternIndex, ++this.index);

            // if starting with double curley brace then check for ending double curley brace
            // if found include with the identifier
            if (
              identifier.startsWith('{{') &&
              this.expr.slice(patternIndex, this.index + 1).endsWith('}')
            ) {
              identifier = this.expr.slice(patternIndex, ++this.index);
            }
            env.node = {
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

            // env.node = this.gobbleTokenProperty(env.node);
            return env.node;
          }
        }
        this.throwError('Unclosed }');
      }
    });
  },
} as jsep.IPlugin;
