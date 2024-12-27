import { Injectable } from '@nestjs/common';
import {
  isCreatedOrLastModifiedByCol,
  isLinksOrLTAR,
  ncIsObject,
  RelationTypes,
  UITypes,
  ViewTypes,
} from 'nocodb-sdk';
import type {
  CalendarView,
  LinkToAnotherRecordColumn,
  LookupColumn,
} from '~/models';
import type { NcContext } from '~/interface/config';
import {
  Base,
  BaseUser,
  Column,
  GridViewColumn,
  Model,
  PresignedUrl,
  Source,
  View,
} from '~/models';
import { NcError } from '~/helpers/catchError';
import { extractProps } from '~/helpers/extractProps';

@Injectable()
export class PublicMetasService {
  async viewMetaGet(
    context: NcContext,
    param: { sharedViewUuid: string; password: string },
  ) {
    const view: View & {
      relatedMetas?: { [ket: string]: Model };
      users?: { id: string; display_name: string; email: string }[];
      client?: string;
    } = await View.getByUUID(context, param.sharedViewUuid);

    if (!view) NcError.viewNotFound(param.sharedViewUuid);

    if (view.password && view.password !== param.password) {
      NcError.invalidSharedViewPassword();
    }

    await view.getFilters(context);
    await view.getSorts(context);

    await view.getViewWithInfo(context);
    await view.getColumns(context);
    await view.getModelWithInfo(context);
    await view.model.getColumns(context);

    const source = await Source.get(context, view.model.source_id);
    view.client = source.type;

    // todo: return only required props
    view.password = undefined;

    // Required for Calendar Views
    const rangeColumns = [];

    if (view.type === ViewTypes.CALENDAR) {
      for (const c of (view.view as CalendarView).calendar_range) {
        if (c.fk_from_column_id) {
          rangeColumns.push(c.fk_from_column_id);
        } else if ((c as any).fk_to_column_id) {
          rangeColumns.push((c as any).fk_to_column_id);
        }
      }
    }

    view.model.columns = view.columns
      .filter((c) => {
        const column = view.model.columnsById[c.fk_column_id];

        if (rangeColumns.includes(c.fk_column_id)) {
          return true;
        }
        // Check if column exists to prevent processing non-existent columns
        if (!column) return false;

        return (
          (c instanceof GridViewColumn && c.group_by) ||
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
      await this.extractRelatedMetas(context, { col, relatedMetas });
    }

    view.relatedMetas = relatedMetas;

    if (
      view.model.columns.some(
        (c) => c.uidt === UITypes.User || isCreatedOrLastModifiedByCol(c),
      )
    ) {
      const baseUsers = await BaseUser.getUsersList(context, {
        base_id: view.model.base_id,
      });

      await PresignedUrl.signMetaIconImage(baseUsers);

      view.users = baseUsers.map((u) => ({
        id: u.id,
        display_name: u.display_name,
        email: u.email,
        meta: ncIsObject(u.meta)
          ? extractProps(u.meta, ['icon', 'iconType'])
          : null,
      }));
    }

    return view;
  }

  private async extractRelatedMetas(
    context: NcContext,
    {
      col,
      relatedMetas = {},
    }: {
      col: Column<any>;
      relatedMetas: Record<string, Model>;
    },
  ) {
    if (isLinksOrLTAR(col.uidt)) {
      await this.extractLTARRelatedMetas(context, {
        ltarColOption: await col.getColOptions<LinkToAnotherRecordColumn>(
          context,
        ),
        relatedMetas,
      });
    } else if (UITypes.Lookup === col.uidt) {
      await this.extractLookupRelatedMetas(context, {
        lookupColOption: await col.getColOptions<LookupColumn>(context),
        relatedMetas,
      });
    }
  }

  private async extractLTARRelatedMetas(
    context: NcContext,
    {
      ltarColOption,
      relatedMetas = {},
    }: {
      ltarColOption: LinkToAnotherRecordColumn;
      relatedMetas: { [key: string]: Model };
    },
  ) {
    relatedMetas[ltarColOption.fk_related_model_id] = await Model.getWithInfo(
      context,
      {
        id: ltarColOption.fk_related_model_id,
      },
    );
    if (ltarColOption.type === 'mm') {
      relatedMetas[ltarColOption.fk_mm_model_id] = await Model.getWithInfo(
        context,
        {
          id: ltarColOption.fk_mm_model_id,
        },
      );
    }
  }

  private async extractLookupRelatedMetas(
    context: NcContext,
    {
      lookupColOption,
      relatedMetas = {},
    }: {
      lookupColOption: LookupColumn;
      relatedMetas: { [key: string]: Model };
    },
  ) {
    const relationCol = await Column.get(context, {
      colId: lookupColOption.fk_relation_column_id,
    });
    const lookedUpCol = await Column.get(context, {
      colId: lookupColOption.fk_lookup_column_id,
    });

    // extract meta for table which belongs the relation column
    // if not already extracted
    if (!relatedMetas[relationCol.fk_model_id]) {
      relatedMetas[relationCol.fk_model_id] = await Model.getWithInfo(context, {
        id: relationCol.fk_model_id,
      });
    }

    // extract meta for table in which looked up column belongs
    // if not already extracted
    if (!relatedMetas[lookedUpCol.fk_model_id]) {
      relatedMetas[lookedUpCol.fk_model_id] = await Model.getWithInfo(context, {
        id: lookedUpCol.fk_model_id,
      });
    }

    // extract metas related to the looked up column
    await this.extractRelatedMetas(context, {
      col: lookedUpCol,
      relatedMetas,
    });
  }

  async publicSharedBaseGet(
    context: NcContext,
    param: { sharedBaseUuid: string },
  ): Promise<any> {
    const base = await Base.getByUuid(context, param.sharedBaseUuid);

    if (!base) {
      NcError.baseNotFound(param.sharedBaseUuid);
    }

    return { base_id: base.id };
  }
}
