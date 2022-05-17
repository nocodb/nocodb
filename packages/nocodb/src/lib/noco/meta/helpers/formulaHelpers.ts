import jsep from 'jsep';
import jsepTreeToFormula from '../../common/helpers/jsepTreeToFormula';
import Column from '../../../noco-models/Column';

export async function substituteColumnAliasWithIdInFormula(
  formula,
  columns: Column[]
) {
  const substituteId = async (pt: any) => {
    if (pt.type === 'CallExpression') {
      for (const arg of pt.arguments || []) {
        await substituteId(arg);
      }
    } else if (pt.type === 'Literal') {
      return;
    } else if (pt.type === 'Identifier') {
      const colNameOrId = pt.name;
      const column = columns.find(
        c =>
          c.id === colNameOrId ||
          c.column_name === colNameOrId ||
          c.title === colNameOrId
      );
      pt.name = '{' + column.id + '}';
    } else if (pt.type === 'BinaryExpression') {
      await substituteId(pt.left);
      await substituteId(pt.right);
    }
  };
  // register curly hook
  jsep.plugins.register({
    name: 'curly',
    init(jsep) {
      jsep.hooks.add('gobble-token', function gobbleCurlyLiteral(env) {
        const OCURLY_CODE = 123; // {
        const CCURLY_CODE = 125; // }
        const { context } = env;
        if (
          !jsep.isIdentifierStart(context.code) &&
          context.code === OCURLY_CODE
        ) {
          context.index += 1;
          const nodes = context.gobbleExpressions(CCURLY_CODE);
          if (context.code === CCURLY_CODE) {
            context.index += 1;
            if (nodes.length > 0) {
              env.node = nodes[0];
            }
            return env.node;
          } else {
            context.throwError('Unclosed }');
          }
        }
      });
    }
  } as jsep.IPlugin);
  const parsedFormula = jsep(formula);
  await substituteId(parsedFormula);
  return jsepTreeToFormula(parsedFormula);
}
