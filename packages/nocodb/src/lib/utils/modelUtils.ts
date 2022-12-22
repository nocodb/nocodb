export function parseMetaProp(
  modelOrModelList: { meta: any } | { meta: any }[]
) {
  if (!modelOrModelList) return;

  // parse meta property
  for (const model of Array.isArray(modelOrModelList)
    ? modelOrModelList
    : [modelOrModelList]) {
    try {
      model.meta =
        typeof model.meta === 'string' ? JSON.parse(model.meta) : model.meta;
    } catch {
      model.meta = {};
    }
  }
}

export function stringifyMetaProp(
  modelOrModelList: { meta?: any } | { meta?: any }[]
) {
  if (!modelOrModelList) return;

  // parse meta property
  for (const model of Array.isArray(modelOrModelList)
    ? modelOrModelList
    : [modelOrModelList]) {
    try {
      model.meta =
        typeof model.meta === 'string' ? model.meta : JSON.stringify(model.meta);
    } catch (e) {
      model.meta = '{}';
    }
  }
}
