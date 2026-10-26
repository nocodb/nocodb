import { Logger } from '@nestjs/common';
import { isLinksOrLTAR } from 'nocodb-sdk';
import type { FilterType } from 'nocodb-sdk';
import type { Column, LinkToAnotherRecordColumn } from '~/models';
import type { NcContext, NcRequest } from '~/interface/config';
import { Filter } from '~/models';
import { isEE } from '~/utils';
import { hasTableVisibilityAccess } from '~/helpers/tableHelpers';
import { filterBuilder } from '~/utils/api-v3-data-transformation.builder';
import { addDummyRootAndNest } from '~/services/v3/filters-v3.helper';

const logger = new Logger('linkRecordSelectionFilter');

type FilterNode = {
  value?: unknown;
  value_field_id?: string;
  dynamic?: boolean;
  filters?: FilterNode[];
};

export type LinkRecordSelectionFilter =
  | {
      available: true;
      group_operator: 'AND' | 'OR' | null;
      filters: FilterNode[];
    }
  | { available: false; reason: string };

const unavailable = (reason: string): LinkRecordSelectionFilter => ({
  available: false,
  reason,
});

// A condition with `value_field_id` compares against that field of the
// current record, so it has no fixed value.
function markDynamic(nodes: FilterNode[]) {
  for (const node of nodes) {
    if (node.filters) markDynamic(node.filters);
    else if (node.value_field_id) {
      node.dynamic = true;
      delete node.value;
    }
  }
}

/**
 * The record-selection filter of a link field, as the GUI picker reads it
 * (`linkFilterList` roots plus their nested groups), in the v3 filter shape.
 */
export async function getLinkRecordSelectionFilter(
  context: NcContext,
  column: Column,
  user: NcRequest['user'],
  opts: { viaApiToken?: boolean } = {},
): Promise<LinkRecordSelectionFilter | undefined> {
  if (!isLinksOrLTAR(column)) return undefined;
  if (!isEE) {
    return unavailable(
      'Link record-selection filters are not available in this edition.',
    );
  }
  if (opts.viaApiToken) {
    return unavailable(
      'Link record-selection filters are not readable with an API token.',
    );
  }

  try {
    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>();
    const { refContext } = colOptions.getRelContext();
    // The GUI hides the conditions when the linked table is private.
    if (
      !(await hasTableVisibilityAccess(
        refContext,
        colOptions.fk_related_model_id,
        user,
      ))
    ) {
      return unavailable(
        'The linked table is not visible to you, so its record-selection filter is hidden.',
      );
    }

    const rows: Filter[] = [];
    const collect = async (filters: Filter[]) => {
      for (const filter of filters ?? []) {
        rows.push(filter);
        if (filter.is_group) {
          await collect(
            await Filter.parentFilterList(context, { parentId: filter.id }),
          );
        }
      }
    };
    await collect(
      await Filter.rootFilterListByLink(context, { columnId: column.id }),
    );

    const tree = addDummyRootAndNest(
      filterBuilder().build(rows) as FilterType[],
    );
    const filters: FilterNode[] = tree?.filters ?? [];
    markDynamic(filters);
    return {
      available: true,
      group_operator: tree?.group_operator ?? null,
      filters,
    };
  } catch (e) {
    logger.warn(
      `Could not read the record-selection filter of ${column.id}: ${e?.message}`,
    );
    return unavailable(
      'The record-selection filter of this field could not be read.',
    );
  }
}
