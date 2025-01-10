import type {
  CalendarViewColumn,
  FormViewColumn,
  GalleryViewColumn,
  GridViewColumn,
  KanbanViewColumn,
} from '~/models';
import { builderGenerator } from '~/utils/data-transformation.builder';

// todo: move to a better place
type ViewColumn =
  | GridViewColumn
  | GalleryViewColumn
  | KanbanViewColumn
  | FormViewColumn
  | CalendarViewColumn;

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
