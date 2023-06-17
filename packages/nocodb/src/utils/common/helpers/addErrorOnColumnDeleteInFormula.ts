export default function (args: {
  virtualColumns;
  columnName: string;
}): void | boolean {
  let modified = false;

  const fn = (pt, virtualColumn) => {
    if (pt.type === 'CallExpression') {
      pt.arguments.map((arg) => fn(arg, virtualColumn));
    } else if (pt.type === 'Literal') {
    } else if (pt.type === 'Identifier') {
      if (pt.name === args.columnName) {
        virtualColumn.formula.error = virtualColumn.formula.error || [];
        virtualColumn.formula.error.push(
          `Column '${args.columnName}' was deleted`,
        );
        modified = true;
      }
    } else if (pt.type === 'BinaryExpression') {
      fn(pt.left, virtualColumn);
      fn(pt.right, virtualColumn);
    }
  };

  if (!args.virtualColumns) {
    return;
  }
  for (const v of args.virtualColumns) {
    if (!v.formula?.tree) {
      continue;
    }
    fn(v.formula.tree, v);
  }
  return modified;
}
