import { Injectable } from '@nestjs/common';
import { ErrorMessages, RelationTypes, UITypes } from 'nocodb-sdk';
import { isLinksOrLTAR } from 'nocodb-sdk';
import type { LinkToAnotherRecordColumn, LookupColumn } from '~/models';
import { NcError } from '~/helpers/catchError';
import { Base, Column, Model, Source, View } from '~/models';

@Injectable()
export class PublicMetasService {
  async viewMetaGet(param: { sharedViewUuid: string; password: string }) {
    const view: View & {
      relatedMetas?: { [ket: string]: Model };
      client?: string;
    } = await View.getByUUID(param.sharedViewUuid);

    if (!view) NcError.notFound('Not found');

    if (view.password && view.password !== param.password) {
      NcError.forbidden(ErrorMessages.INVALID_SHARED_VIEW_PASSWORD);
    }

    await view.getFilters();
    await view.getSorts();

    await view.getViewWithInfo();
    await view.getColumns();
    await view.getModelWithInfo();
    await view.model.getColumns();

    const source = await Source.get(view.model.source_id);
    view.client = source.type;

    // todo: return only required props
    delete view['password'];

    view.model.columns = view.columns
      .filter((c) => {
        const column = view.model.columnsById[c.fk_column_id];
        return (
          c.show ||
          (column.rqd && !column.cdf && !column.ai) ||
          column.pk ||
          view.model.columns.some(
            (c1) =>
              isLinksOrLTAR(c1.uidt) &&
              (<LinkToAnotherRecordColumn>c1.colOptions).type ===
                RelationTypes.BELONGS_TO &&
              view.columns.some((vc) => vc.fk_column_id === c1.id && vc.show) &&
              (<LinkToAnotherRecordColumn>c1.colOptions).fk_child_column_id ===
                c.fk_column_id,
          )
        );
      })
      .map(
        (c) =>
          new Column({
            ...c,
            ...view.model.columnsById[c.fk_column_id],
          } as any),
      ) as any;

    const relatedMetas = {};

    // load related table metas
    for (const col of view.model.columns) {
      await this.extractRelatedMetas({ col, relatedMetas });
    }

    view.relatedMetas = relatedMetas;

    return view;
  }

  private async extractRelatedMetas({
    col,
    relatedMetas = {},
  }: {
    col: Column<any>;
    relatedMetas: Record<string, Model>;
  }) {
    if (isLinksOrLTAR(col.uidt)) {
      await this.extractLTARRelatedMetas({
        ltarColOption: await col.getColOptions<LinkToAnotherRecordColumn>(),
        relatedMetas,
      });
    } else if (UITypes.Lookup === col.uidt) {
      await this.extractLookupRelatedMetas({
        lookupColOption: await col.getColOptions<LookupColumn>(),
        relatedMetas,
      });
    }
  }

  private async extractLTARRelatedMetas({
    ltarColOption,
    relatedMetas = {},
  }: {
    ltarColOption: LinkToAnotherRecordColumn;
    relatedMetas: { [key: string]: Model };
  }) {
    relatedMetas[ltarColOption.fk_related_model_id] = await Model.getWithInfo({
      id: ltarColOption.fk_related_model_id,
    });
    if (ltarColOption.type === 'mm') {
      relatedMetas[ltarColOption.fk_mm_model_id] = await Model.getWithInfo({
        id: ltarColOption.fk_mm_model_id,
      });
    }
  }

  private async extractLookupRelatedMetas({
    lookupColOption,
    relatedMetas = {},
  }: {
    lookupColOption: LookupColumn;
    relatedMetas: { [key: string]: Model };
  }) {
    const relationCol = await Column.get({
      colId: lookupColOption.fk_relation_column_id,
    });
    const lookedUpCol = await Column.get({
      colId: lookupColOption.fk_lookup_column_id,
    });

    // extract meta for table which belongs the relation column
    // if not already extracted
    if (!relatedMetas[relationCol.fk_model_id]) {
      relatedMetas[relationCol.fk_model_id] = await Model.getWithInfo({
        id: relationCol.fk_model_id,
      });
    }

    // extract meta for table in which looked up column belongs
    // if not already extracted
    if (!relatedMetas[lookedUpCol.fk_model_id]) {
      relatedMetas[lookedUpCol.fk_model_id] = await Model.getWithInfo({
        id: lookedUpCol.fk_model_id,
      });
    }

    // extract metas related to the looked up column
    await this.extractRelatedMetas({
      col: lookedUpCol,
      relatedMetas,
    });
  }

  async publicSharedBaseGet(param: { sharedBaseUuid: string }): Promise<any> {
    const base = await Base.getByUuid(param.sharedBaseUuid);

    if (!base) {
      NcError.notFound();
    }

    return { base_id: base.id };
  }
}
