import type { BaseType, BaseV3Type, SourceType } from 'nocodb-sdk';
import { builderGenerator } from '~/utils/api-v3-data-transformation.builder';

export const baseBuilder = builderGenerator<BaseType, BaseV3Type>({
  allowed: [
    'id',
    'title',
    'description',
    'created_at',
    'updated_at',
    'meta',
    'sources',
    'default_role',
    'fk_workspace_id',
  ],
  mappings: {
    name: 'title',
    isMeta: 'is_meta',
    source: 'sources',
    fk_workspace_id: 'workspace_id',
  },
  meta: {
    snakeCase: true,
    metaProps: ['meta'],
  },
  transformFn: (base: any) => {
    if (base.default_role === 'no-access') {
      base.type = 'private';
    }
    delete base.default_role;
    return base;
  },
});
export const sourceBuilder = builderGenerator<
  SourceType,
  BaseV3Type['sources']
>({
  allowed: [
    'id',
    'alias',
    'type',
    'is_schema_readonly',
    'is_data_readonly',
    'integration_id',
  ],
  mappings: {
    alias: 'title',
    isMeta: 'is_meta',
    source: 'sources',
  },
});
