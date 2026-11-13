import UITypes, { isBtLikeV2Junction } from '~/lib/UITypes';
import { parseProp } from '~/lib/helperFunctions';
import { isFkBelongsToLink } from '~/lib/timelineUtilization';
import { RelationTypes } from '~/lib/globals';
import type { ColumnType, LinkToAnotherRecordType } from '~/lib/Api';

/** How a kanban view groups its records into stacks. */
export enum KanbanStackType {
  SingleSelect = 'single_select',
  User = 'user',
  Link = 'link',
}

type KanbanStackColumn = Pick<ColumnType, 'uidt' | 'colOptions' | 'meta'>;

export interface KanbanStackTypeOptions {
  /** Count V2 junction links as stackable: true only on a Postgres source. */
  junctionLinks?: boolean;
}

/**
 * Stack kind for a column, or null when a kanban can't be stacked by it:
 * a single select, a single-user field, or a link naming one record: through
 * a foreign key on this table (V1 belongs-to / one-to-one child side) or,
 * with `junctionLinks`, a junction table (V2 many-to-one).
 */
export function getKanbanStackType(
  col?: KanbanStackColumn | null,
  { junctionLinks = false }: KanbanStackTypeOptions = {}
): KanbanStackType | null {
  if (!col) return null;

  if (col.uidt === UITypes.SingleSelect) return KanbanStackType.SingleSelect;

  if (col.uidt === UITypes.User) {
    return parseProp(col.meta)?.is_multi ? null : KanbanStackType.User;
  }

  if (isFkBelongsToLink(col) || (junctionLinks && isKanbanJunctionLink(col)))
    return KanbanStackType.Link;

  return null;
}

/** A V2 single-record link kept in a junction table, other than one-to-one (a stack per card). */
export function isKanbanJunctionLink(col?: KanbanStackColumn | null): boolean {
  return (
    !!col &&
    isBtLikeV2Junction(col) &&
    (col.colOptions as LinkToAnotherRecordType | undefined)?.type !==
      RelationTypes.ONE_TO_ONE
  );
}

export function isKanbanStackableColumn(
  col?: KanbanStackColumn | null,
  options?: KanbanStackTypeOptions
): boolean {
  return getKanbanStackType(col, options) !== null;
}
