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
): string | null {
  if (!model) return null;

  // stringify meta property
  try {
    return typeof model[propName] === 'string' || model[propName] === null
      ? model[propName]
      : JSON.stringify(model[propName]);
  } catch (e) {
    return '{}';
  }
}

export function prepareForDb(model: any, props: string | string[] = 'meta') {
  if (!model) return model;

  if (typeof props === 'string') {
    props = [props];
  }

  props.forEach((prop) => {
    if (prop in model) {
      model[prop] = stringifyMetaProp(model, prop);
    }
  });

  return model;
}

export function prepareForResponse(
  model: any,
  props: string | string[] = 'meta',
) {
  if (!model) return model;

  if (typeof props === 'string') {
    props = [props];
  }

  props.forEach((prop) => {
    if (prop in model) {
      model[prop] = parseMetaProp(model, prop);
    }
  });

  return model;
}
