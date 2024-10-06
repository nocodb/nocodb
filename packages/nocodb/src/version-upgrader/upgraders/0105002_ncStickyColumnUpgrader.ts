import type { NcUpgraderCtx } from '~/version-upgrader/NcUpgrader';
import { MetaTable } from '~/utils/globals';

// before 0.104.3, display value column can be in any position in table
// with this upgrade we introduced sticky primary column feature
// this upgrader will make display value column first column in grid views

export default async function ({ ncMeta }: NcUpgraderCtx) {
  const grid_columns = await ncMeta.knexConnection(MetaTable.GRID_VIEW_COLUMNS);

  const grid_views = [...new Set(grid_columns.map((col) => col.fk_view_id))];

  const view_meta = grid_views.reduce((acc, view_id) => {
    const sampleColumn = grid_columns.find((col) => col.fk_view_id === view_id);
    return {
      ...acc,
      [view_id]: {
        base_id: sampleColumn.base_id,
        workspace_id: sampleColumn.fk_workspace_id,
      },
    };
  }, {});

  for (const view_id of grid_views) {
    const base_id = view_meta[view_id].base_id;
    const workspace_id = view_meta[view_id].workspace_id;

    // get a list of view columns sorted by order
    const view_columns = await ncMeta.metaList2(
      workspace_id,
      base_id,
      MetaTable.GRID_VIEW_COLUMNS,
      {
        condition: {
          fk_view_id: view_id,
        },
        orderBy: {
          order: 'asc',
        },
      },
    );
    const view_columns_meta = [];

    // get column meta for each view column
    for (const col of view_columns) {
      const col_meta = await ncMeta.metaGet(
        workspace_id,
        base_id,
        MetaTable.COLUMNS,
        {
          id: col.fk_column_id,
        },
      );
      view_columns_meta.push(col_meta);
    }

    // if no display value column is set
    if (!view_columns_meta.some((column) => column.pv)) {
      const pkIndex = view_columns_meta.findIndex((column) => column.pk);

      // if PK is at the end of table
      if (pkIndex === view_columns_meta.length - 1) {
        if (pkIndex > 0) {
          await ncMeta.metaUpdate(
            workspace_id,
            base_id,
            MetaTable.COLUMNS,
            { pv: true },
            view_columns_meta[pkIndex - 1].id,
          );
        } else if (view_columns_meta.length > 0) {
          await ncMeta.metaUpdate(
            workspace_id,
            base_id,
            MetaTable.COLUMNS,
            { pv: true },
            view_columns_meta[0].id,
          );
        }
        // pk is not at the end of table
      } else if (pkIndex > -1) {
        await ncMeta.metaUpdate(
          workspace_id,
          base_id,
          MetaTable.COLUMNS,
          { pv: true },
          view_columns_meta[pkIndex + 1].id,
        );
        //  no pk at all
      } else if (view_columns_meta.length > 0) {
        await ncMeta.metaUpdate(
          workspace_id,
          base_id,
          MetaTable.COLUMNS,
          { pv: true },
          view_columns_meta[0].id,
        );
      }
    }

    const primary_value_column_meta = view_columns_meta.find((col) => col.pv);

    if (primary_value_column_meta) {
      const primary_value_column = view_columns.find(
        (col) => col.fk_column_id === primary_value_column_meta.id,
      );
      const primary_value_column_index = view_columns.findIndex(
        (col) => col.fk_column_id === primary_value_column_meta.id,
      );
      const view_orders = view_columns.map((col) => col.order);
      const view_min_order = Math.min(...view_orders);

      // if primary_value_column is not visible, make it visible
      if (!primary_value_column.show) {
        await ncMeta.metaUpdate(
          workspace_id,
          base_id,
          MetaTable.GRID_VIEW_COLUMNS,
          { show: true },
          primary_value_column.id,
        );
      }

      if (
        primary_value_column.order === view_min_order &&
        view_orders.filter((o) => o === view_min_order).length === 1
      ) {
        // if primary_value_column is in first order do nothing
        continue;
      } else {
        // if primary_value_column not in first order, move it to the start of array
        if (primary_value_column_index !== 0) {
          const temp_pv = view_columns.splice(primary_value_column_index, 1);
          view_columns.unshift(...temp_pv);
        }

        // update order of all columns in view to match the order in array
        for (let i = 0; i < view_columns.length; i++) {
          await ncMeta.metaUpdate(
            workspace_id,
            base_id,
            MetaTable.GRID_VIEW_COLUMNS,
            { order: i + 1 },
            view_columns[i].id,
          );
        }
      }
    }
  }
}
