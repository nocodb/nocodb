import { RelationTypes, UITypes } from 'nocodb-sdk';
import type { NcUpgraderCtx } from '~/version-upgrader/NcUpgrader';
import type { MetaService } from '~/meta/meta.service';
import { MetaTable } from '~/utils/globals';
import { Column } from '~/models';

/**
 * This upgrader look for any broken link and try to recover it
 * using the existing data
 */

const logger = {
  log: (message: string) => {
    console.log(`[0227002_ncBrokenLinkRecovery ${Date.now()}] ` + message);
  },
  error: (message: string) => {
    console.error(`[0227002_ncBrokenLinkRecovery ${Date.now()}] ` + message);
  },
};

export default async function ({ ncMeta }: NcUpgraderCtx) {
  // Get all broken link columns which doesn't have colOptions
  const columns = await ncMeta
    .knex(MetaTable.COLUMNS)
    .select(`${MetaTable.COLUMNS}.*`)
    .leftJoin(
      MetaTable.COL_RELATIONS,
      `${MetaTable.COLUMNS}.id`,
      `${MetaTable.COL_RELATIONS}.fk_column_id`,
    )
    .where(`${MetaTable.COLUMNS}.uidt`, UITypes.LinkToAnotherRecord)
    .whereNull(`${MetaTable.COL_RELATIONS}.id`);

  // Recover broken link
  for (const column of columns) {
    logger.log(`Recovering column '${column.name}' with id '${column.id}'`);

    const currentTableId = column.fk_model_id;
    let relatedTableId;

    // check any lookup or rollup column is using this column
    const lookupColumns = await ncMeta
      .knex(MetaTable.COL_LOOKUP)
      .select(`${MetaTable.COL_LOOKUP}.*`)
      .where(`${MetaTable.COL_LOOKUP}.fk_relation_column_id`, column.id);

    for (const lookupColumn of lookupColumns) {
      const lookupCol = await ncMeta
        .knex(MetaTable.COLUMNS)
        .select(`${MetaTable.COLUMNS}.fk_model_id`)
        .where(`${MetaTable.COLUMNS}.id`, lookupColumn.fk_lookup_column_id)
        .first();
      if (lookupCol) {
        relatedTableId = lookupCol.fk_model_id;
        break;
      }
    }

    if (!relatedTableId) {
      const rollupColumns = await ncMeta
        .knex(MetaTable.COL_ROLLUP)
        .select(`${MetaTable.COL_ROLLUP}.*`)
        .where(`${MetaTable.COL_ROLLUP}.fk_relation_column_id`, column.id);

      for (const rollupColumn of rollupColumns) {
        const rollupCol = await ncMeta
          .knex(MetaTable.COLUMNS)
          .select(`${MetaTable.COLUMNS}.fk_model_id`)
          .where(`${MetaTable.COLUMNS}.id`, rollupColumn.fk_rollup_column_id)
          .first();
        if (rollupCol) {
          relatedTableId = rollupCol.fk_model_id;
          break;
        }
      }
    }

    // if related table is not found then iterate over all links which is related to current table
    const linksQb = ncMeta
      .knex(MetaTable.COL_RELATIONS)
      .select(`${MetaTable.COL_RELATIONS}.*`)
      .where(
        `${MetaTable.COL_RELATIONS}.fk_related_model_id`,
        column.fk_model_id,
      );
    if (relatedTableId) {
      linksQb
        .join(
          MetaTable.COLUMNS,
          `${MetaTable.COL_RELATIONS}.fk_column_id`,
          `${MetaTable.COLUMNS}.id`,
        )
        .where(`${MetaTable.COLUMNS}.fk_model_id`, relatedTableId);
    }

    const links = await linksQb;

    // iterate over all links which is related to current table and if found relation which doesn't have link in the related table then use it to populate colOptions
    for (const link of links) {
      let columnInCurrTable = null;
      if (link.type === RelationTypes.HAS_MANY) {
        // check for bt column in current table
        columnInCurrTable = await ncMeta
          .knex(MetaTable.COL_RELATIONS)
          .join(
            MetaTable.COLUMNS,
            `${MetaTable.COL_RELATIONS}.fk_column_id`,
            `${MetaTable.COLUMNS}.id`,
          )
          .where(`${MetaTable.COL_RELATIONS}.fk_model_id`, currentTableId)
          .where(
            `${MetaTable.COL_RELATIONS}.fk_related_model_id`,
            relatedTableId,
          )
          .where(`${MetaTable.COL_RELATIONS}.type`, RelationTypes.BELONGS_TO)
          .where(
            `${MetaTable.COL_RELATIONS}.fk_child_column_id`,
            link.fk_child_column_id,
          )
          .where(
            `${MetaTable.COL_RELATIONS}.fk_parent_column_id`,
            link.fk_parent_column_id,
          );
      } else if (link.type === RelationTypes.ONE_TO_ONE) {
        // check for one to one column in current table and confirm type in meta
        columnInCurrTable = await ncMeta
          .knex(MetaTable.COL_RELATIONS)
          .join(
            MetaTable.COLUMNS,
            `${MetaTable.COL_RELATIONS}.fk_column_id`,
            `${MetaTable.COLUMNS}.id`,
          )
          .where(`${MetaTable.COL_RELATIONS}.fk_model_id`, currentTableId)
          .where(
            `${MetaTable.COL_RELATIONS}.fk_related_model_id`,
            relatedTableId,
          )
          .where(`${MetaTable.COL_RELATIONS}.type`, RelationTypes.ONE_TO_ONE)
          .where(
            `${MetaTable.COL_RELATIONS}.fk_child_column_id`,
            link.fk_child_column_id,
          )
          .where(
            `${MetaTable.COL_RELATIONS}.fk_parent_column_id`,
            link.fk_parent_column_id,
          );
      } else if (link.type === RelationTypes.BELONGS_TO) {
        // check for hm column in current table
        columnInCurrTable = await ncMeta
          .knex(MetaTable.COL_RELATIONS)
          .join(
            MetaTable.COLUMNS,
            `${MetaTable.COL_RELATIONS}.fk_column_id`,
            `${MetaTable.COLUMNS}.id`,
          )
          .where(`${MetaTable.COL_RELATIONS}.fk_model_id`, currentTableId)
          .where(
            `${MetaTable.COL_RELATIONS}.fk_related_model_id`,
            relatedTableId,
          )
          .where(`${MetaTable.COL_RELATIONS}.type`, RelationTypes.HAS_MANY)
          .where(
            `${MetaTable.COL_RELATIONS}.fk_child_column_id`,
            link.fk_child_column_id,
          )
          .where(
            `${MetaTable.COL_RELATIONS}.fk_parent_column_id`,
            link.fk_parent_column_id,
          );
      } else if (link.type === RelationTypes.MANY_TO_MANY) {
        // check for mtm column in current table
        columnInCurrTable = await ncMeta
          .knex(MetaTable.COL_RELATIONS)
          .join(
            MetaTable.COLUMNS,
            `${MetaTable.COL_RELATIONS}.fk_column_id`,
            `${MetaTable.COLUMNS}.id`,
          )
          .where(`${MetaTable.COL_RELATIONS}.fk_model_id`, currentTableId)
          .where(
            `${MetaTable.COL_RELATIONS}.fk_related_model_id`,
            relatedTableId,
          )
          .where(`${MetaTable.COL_RELATIONS}.type`, RelationTypes.BELONGS_TO)
          .where(
            `${MetaTable.COL_RELATIONS}.fk_child_column_id`,
            link.fk_parent_column_id,
          )
          .where(
            `${MetaTable.COL_RELATIONS}.fk_parent_column_id`,
            link.fk_parent_column_id,
          )
          .where(
            `${MetaTable.COL_RELATIONS}.fk_mm_model_id`,
            link.fk_mm_model_id,
          )
          .where(
            `${MetaTable.COL_RELATIONS}.fk_mm_child_column_id`,
            link.fk_mm_parent_column_id,
          )
          .where(
            `${MetaTable.COL_RELATIONS}.fk_mm_parent_column_id`,
            link.fk_mm_child_column_id,
          );
      }

      if (!columnInCurrTable) {
        // generate meta and insert into colOptions

        const commonProps = {
          id: (ncMeta as MetaService).genNanoid(MetaTable.COL_RELATIONS),
          fk_column_id: column.id,
          fk_related_model_id: relatedTableId,
          created_at: link.created_at,
          updated_at: link.updated_at,
          virtual: link.virtual,
        };

        // based on type insert data into colOptions
        switch (link.type) {
          case RelationTypes.HAS_MANY:
            // insert data into colOptions
            ncMeta.knex(MetaTable.COL_RELATIONS).insert({
              ...commonProps,
              type: RelationTypes.BELONGS_TO,
              fk_child_column_id: link.fk_child_column_id,
              fk_parent_column_id: link.fk_parent_column_id,
            });
            break;
          case RelationTypes.ONE_TO_ONE:
            // todo:
            const meta = {
              bt: false,
            };
            // insert data into colOptions
            ncMeta.knex(MetaTable.COL_RELATIONS).insert({
              ...commonProps,
              type: RelationTypes.ONE_TO_ONE,
              fk_child_column_id: link.fk_child_column_id,
              fk_parent_column_id: link.fk_parent_column_id,
              meta,
            });
            break;
          case RelationTypes.BELONGS_TO:
            // insert data into colOptions

            ncMeta.knex(MetaTable.COL_RELATIONS).insert({
              ...commonProps,
              type: RelationTypes.HAS_MANY,
              fk_child_column_id: link.fk_child_column_id,
              fk_parent_column_id: link.fk_parent_column_id,
            });
            break;
          case RelationTypes.MANY_TO_MANY:
            // insert data into colOptions

            ncMeta.knex(MetaTable.COL_RELATIONS).insert({
              ...commonProps,
              type: RelationTypes.ONE_TO_ONE,
              fk_child_column_id: link.fk_parent_column_id,
              fk_parent_column_id: link.fk_child_column_id,

              fk_mm_model_id: link.fk_mm_model_id,
              fk_mm_child_column_id: link.fk_mm_parent_column_id,
              fk_mm_parent_column_id: link.fk_mm_child_column_id,
            });
            break;
        }

        break;
      } else {
        logger.error(
          `Couldn't find any column in current table which is related to the link '${link.id}'.`,
        );

        // delete the link column since it's not useful anymore and not recoverable
        await Column.delete(
          {
            workspace_id: column.workspace_id,
            base_id: column.base_id,
          },
          column.id,
          ncMeta,
        );
      }
    }
  }
}
