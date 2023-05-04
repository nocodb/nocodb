export function parseMetaProp(model: { meta?: any }): any {
  if (!model) return;

  // parse meta property
  try {
    return (
      (typeof model.meta === 'string' ? JSON.parse(model.meta) : model.meta) ??
      {}
    );
  } catch {
    return {};
  }
}

export function stringifyMetaProp(model: { meta?: any }): string | void {
  if (!model) return;

  // stringify meta property
  try {
    return typeof model.meta === 'string'
      ? model.meta
      : JSON.stringify(model.meta);
  } catch (e) {
    return '{}';
  }
}
