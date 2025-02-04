import type { FilterType } from 'nocodb-sdk';
import { builderGenerator } from '~/utils/data-transformation.builder';

export const filterBuilder = builderGenerator<
  FilterType[],
  Partial<FilterType>[]
>({
  allowed: [
    'id',
    'fk_column_id',
    'direction',
    'logical_op',
    'fk_parent_id',
    'fk_hook_id',
    'fk_view_id',
    'comparison_op',
    'comparison_sub_op',
    'value',
    'is_group',
    'fk_link_col_id',
    'fk_value_col_id',
  ],
  mappings: {
    fk_column_id: 'field_id',
    fk_parent_id: 'parent_id',
    fk_hook_id: 'hook_id',
    fk_link_col_id: 'link_field_id',
    fk_value_col_id: 'value_field_id',
    comparison_op: 'comparison_operation',
    comparison_sub_op: 'comparison_sub_operation',
    fk_view_id: 'view_id',
  },
  excludeNullProps: true,
  booleanProps: ['is_group'],
  transformFn(data) {
    if (
      'value' in data &&
      data.value !== undefined &&
      data.value !== null &&
      typeof data.value !== 'string'
    ) {
      data.value = data.value?.toString?.();
    }
  },
});

export const filterRevBuilder = builderGenerator<
  FilterType[] | FilterType,
  Partial<FilterType>[] | Partial<FilterType>
>({
  allowed: [
    'id',
    'field_id',
    'parent_id',
    'direction',
    'logical_op',
    'comparison_operation',
    'comparison_sub_operation',
    'value',
    'is_group',
  ],
  mappings: {
    field_id: 'fk_column_id',
    parent_id: 'fk_parent_id',
    comparison_operation: 'comparison_op',
    comparison_sub_operation: 'comparison_sub_op',
  },
});
