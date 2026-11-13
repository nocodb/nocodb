import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Column, LinkToAnotherRecordColumn } from '~/models';
import { NcError } from '~/helpers/catchError';
import { COMPOUND_SELECT_CHUNK_SIZE } from '~/constants';
import { chunkArray } from '~/utils/tsUtils';
import { Model } from '~/models';

const MAX_MISSING_LINK_IDS = 20;

// Unlinks run before links, and on some sources outside the transaction, so a
// missing id failing inside addLinks would still drop the existing links.
export const assertLinkIdsExist = async (
  baseModel: IBaseModelSqlV2,
  linkPlans: { col: Column; idsToLink: any[] }[],
) => {
  const idsByCol = new Map<string, { col: Column; ids: Set<any> }>();
  for (const { col, idsToLink } of linkPlans) {
    if (!idsToLink.length) continue;
    if (idsToLink.some((id) => id === undefined || id === null)) {
      NcError.get(baseModel.context).unprocessableEntity(
        `Link field '${col.title}': each linked record must carry its id`,
      );
    }
    const entry = idsByCol.get(col.id) ?? { col, ids: new Set() };
    idsToLink.forEach((id) => entry.ids.add(id));
    idsByCol.set(col.id, entry);
  }

  for (const { col, ids } of idsByCol.values()) {
    const colOptions = await col.getColOptions<LinkToAnotherRecordColumn>();
    const { refContext } = colOptions.getRelContext();
    const relatedTable = await Model.get(
      refContext,
      colOptions.fk_related_model_id,
    );
    await relatedTable.getColumns();
    // composite PKs are validated by addLinks itself
    if (relatedTable.primaryKeys.length !== 1) continue;

    const relatedBaseModel = await Model.getBaseModelSQL(refContext, {
      model: relatedTable,
      dbDriver: baseModel.dbDriver,
    });
    const pkName = relatedTable.primaryKey.column_name;
    const softDeleteFilter = await relatedBaseModel.getSoftDeleteFilter();

    const liveRows = () => {
      const qb = relatedBaseModel.dbDriver(
        relatedBaseModel.getTnPath(relatedTable),
      );
      if (softDeleteFilter) qb.where(softDeleteFilter);
      return qb;
    };

    // The DB decides what matches. Its reply can differ from the id sent
    // (`'01'` vs 1, bigints past 2^53), so an id not in the reply is asked
    // about on its own; lower-casing first keeps uuids off that path.
    const missing: any[] = [];
    for (const chunk of chunkArray([...ids], COMPOUND_SELECT_CHUNK_SIZE)) {
      const rows = await relatedBaseModel.execAndParse(
        liveRows().select(pkName).whereIn(pkName, chunk),
        null,
        { raw: true },
      );
      if (rows.length === chunk.length) continue;

      const seen = new Set(rows.map((r) => String(r[pkName]).toLowerCase()));
      for (const id of chunk) {
        if (seen.has(String(id).toLowerCase())) continue;
        const [row] = await relatedBaseModel.execAndParse(
          liveRows().select(pkName).where(pkName, id).limit(1),
          null,
          { raw: true },
        );
        if (!row) missing.push(id);
        // The message only needs a few, and each lookup is a round trip
        if (missing.length >= MAX_MISSING_LINK_IDS) break;
      }
      if (missing.length >= MAX_MISSING_LINK_IDS) break;
    }

    if (missing.length) {
      NcError.get(baseModel.context).invalidRequestBody(
        `Link id ${missing
          .map((id) => `'${id}'`)
          .join(', ')} not found in related table`,
      );
    }
  }
};
