export function parseMetaProp(model: any, propName = 'meta'): any {
  if (!model) return;

  // parse meta property
  try {
    return typeof model[propName] === 'string'
      ? JSON.parse(model[propName])
      : model[propName];
  } catch {
    return {};
  }
}

export function stringifyMetaProp(
  model: any,
  propName = 'meta',
): string | void {
  if (!model) return;

  // stringify meta property
  try {
    return typeof model[propName] === 'string'
      ? model[propName]
      : JSON.stringify(model[propName]);
  } catch (e) {
    return '{}';
  }
}
