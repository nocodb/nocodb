import { viewTypeAlias } from 'nocodb-sdk';
import type { TableType, TableV3Type, ViewType } from 'nocodb-sdk';
import { builderGenerator } from '~/utils/api-v3-data-transformation.builder';

export const tableReadBuilder = builderGenerator<TableType, TableV3Type>({
  allowed: [
    'id',
    'title',
    'meta',
    'description',
    'source_id',
    'base_id',
    'fk_workspace_id',
  ],
  orderProps: [
    'id',
    'title',
    'meta',
    'description',
    'source_id',
    'base_id',
    'workspace_id',
  ],
  mappings: {
    fk_workspace_id: 'workspace_id',
  },
  transformFn: (table) => {
    // if description is empty, set it to undefined
    if (table.description === '') {
      table.description = undefined;
    }
    return table;
  },
  meta: {
    snakeCase: true,
    metaProps: ['meta'],
    allowed: ['icon_color', 'icon'],
  },
});

export const tableViewBuilder = builderGenerator<
  ViewType,
  TableV3Type['views'][number]
>({
  allowed: ['id', 'title', 'type'],
  transformFn: (view) => {
    return {
      ...view,
      view_type: viewTypeAlias[view.type],
      type: undefined,
    };
  },
});
