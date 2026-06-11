import { arrGetDuplicate, type NcContext } from 'nocodb-sdk';
import { NcError } from '~/helpers/ncError';

export function parseMetaProp(
  model: any,
  propName = 'meta',
  fallbackValue: any = {},
): any {
  if (!model) return;

  // parse meta property
  try {
    return typeof model[propName] === 'string'
      ? JSON.parse(model[propName])
      : model[propName];
  } catch {
    return fallbackValue;
  }
}

export function stringifyMetaProp(
  model: any,
  propName = 'meta',
  fallbackValue = '{}',
): string | null {
  if (!model) return null;

  // stringify meta property
  try {
    return typeof model[propName] === 'string' || model[propName] === null
      ? model[propName]
      : JSON.stringify(model[propName]);
  } catch (e) {
    return fallbackValue;
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

export async function validateImportSchema(
  context: NcContext,
  data: {
    model: any;
    views: any[];
    hooks?: any[];
    comments?: any[];
    permissions?: any[];
    rowColorConditions?: {
      filters?: any[];
      rowColorConditions?: any[];
    };
  }[],
) {
  // validate table names
  if (data.some((each) => !each.model.title && !each.model.table_name)) {
    NcError.get(context).invalidRequestBody(
      'Missing table `title` property in request body',
    );
  }
  const modelNamedData = data.map((each) => {
    return {
      ...each,
      model: {
        ...each.model,
        title: each.model.title ?? each.model.table_name,
        table_name: each.model.table_name ?? each.model.title,
      },
    };
  });
  const aliasDuplicate = arrGetDuplicate(
    modelNamedData.map((each) => each.model.title),
  );
  if (aliasDuplicate) {
    NcError.get(context).duplicateAlias({
      alias: aliasDuplicate as string,
      base: context.base_id,
      type: 'table',
    });
  }
  const tableNameDuplicate = arrGetDuplicate(
    modelNamedData.map((each) => each.model.table_name),
  );
  if (tableNameDuplicate) {
    NcError.get(context).duplicateAlias({
      alias: tableNameDuplicate as string,
      base: context.base_id,
      type: 'table',
      label: 'name',
    });
  }
  return modelNamedData;
}
