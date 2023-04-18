import type { Base } from '../models';

export async function generateBaseIdMap(
  base: Base,
  idMap: Map<string, string>,
) {
  idMap.set(base.project_id, base.project_id);
  idMap.set(base.id, `${base.project_id}::${base.id}`);
  const models = await base.getModels();

  for (const md of models) {
    idMap.set(md.id, `${base.project_id}::${base.id}::${md.id}`);
    await md.getColumns();
    for (const column of md.columns) {
      idMap.set(column.id, `${idMap.get(md.id)}::${column.id}`);
    }
  }

  return models;
}

export function clearPrefix(text: string, prefix?: string) {
  if (!prefix || prefix.length === 0) return text;
  return text.replace(new RegExp(`^${prefix}_?`), '');
}

export function withoutNull(obj: any) {
  const newObj = {};
  let found = false;
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null) {
      newObj[key] = value;
      found = true;
    }
  }
  if (!found) return null;
  return newObj;
}

export function reverseGet(map: Map<string, string>, vl: string) {
  for (const [key, value] of map.entries()) {
    if (vl === value) {
      return key;
    }
  }
  return undefined;
}

export function withoutId(obj: any) {
  const { id, ...rest } = obj;
  return rest;
}

export function getParentIdentifier(id: string) {
  const arr = id.split('::');
  arr.pop();
  return arr.join('::');
}

export function getEntityIdentifier(id: string) {
  const arr = id.split('::');
  return arr.pop();
}

export function findWithIdentifier(map: Map<string, any>, id: string) {
  for (const key of map.keys()) {
    if (getEntityIdentifier(key) === id) {
      return map.get(key);
    }
  }
  return undefined;
}
