import {builderGenerator} from "~/utils/data-transformation.builder";

export const viewColumnBuilder = builderGenerator<
  ViewColumn[],
  Partial<ViewColumn>[]
>({
  allowed: ['fk_column_id', 'width', 'show', 'formatting'],
  mappings: {
    fk_column_id: 'field_id',
  },
  excludeNullProps: true,
  booleanProps: ['show'],
});
