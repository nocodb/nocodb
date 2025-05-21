import { jsepTreeToFormula } from 'nocodb-sdk';

export default function (args: {
  virtualColumns;
  oldColumnName: string;
  newColumnName: string;
}): void | boolean {
  let modified = false;

  const fn = (pt) => {
    if (pt.type === 'CallExpression') {
      pt.arguments.map((arg) => fn(arg));
    } else if (pt.type === 'Literal') {
    } else if (pt.type === 'Identifier') {
      if (pt.name === args.oldColumnName) {
        pt.name = args.newColumnName;
        modified = true;
      }
    } else if (pt.type === 'BinaryExpression') {
      fn(pt.left);
      fn(pt.right);
    }
  };

  if (!args.virtualColumns) {
    return;
  }
  for (const v of args.virtualColumns) {
    if (!v.formula?.tree) {
      continue;
    }
    fn(v.formula.tree);
    v.formula.value = jsepTreeToFormula(v.formula.tree);
  }
  return modified;
}
