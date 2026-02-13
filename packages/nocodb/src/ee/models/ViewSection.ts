import ViewSectionCE from 'src/models/ViewSection';
import { Logger } from '@nestjs/common';
import type { ViewSectionType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';

const logger = new Logger('ViewSection');

export default class ViewSection
  extends ViewSectionCE
  implements ViewSectionType
{
  id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  source_id?: string;
  fk_model_id: string;
  title: string;
  order?: number;
  meta?: any;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;

  constructor(data: ViewSection) {
    super(data);
    Object.assign(this, data);
  }

  public static async get(
    context: NcContext,
    sectionId: string,
    ncMeta = Noco.ncMeta,
  ) {
    if (!sectionId) {
      return null;
    }

    let section =
      sectionId &&
      (await NocoCache.get(
        context,
        `${CacheScope.VIEW_SECTION}:${sectionId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!section) {
      section = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.VIEW_SECTIONS,
        {
          id: sectionId,
        },
      );
      if (section) {
        section = prepareForResponse(section, ['meta']);
        await NocoCache.set(
          context,
          `${CacheScope.VIEW_SECTION}:${section.id}`,
          section,
        );
      }
    }

    return section && new ViewSection(section);
  }

  public static async list(
    context: NcContext,
    modelId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(
      context,
      CacheScope.VIEW_SECTION,
      [modelId],
    );
    let { list: sectionsList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !sectionsList.length) {
      sectionsList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.VIEW_SECTIONS,
        {
          condition: {
            fk_model_id: modelId,
          },
        },
      );
      for (let section of sectionsList) {
        section = prepareForResponse(section, ['meta']);
      }
      await NocoCache.setList(
        context,
        CacheScope.VIEW_SECTION,
        [modelId],
        sectionsList,
      );
    }
    sectionsList.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );
    return sectionsList?.map((s) => new ViewSection(s));
  }

  public static async findByTitle(
    context: NcContext,
    modelId: string,
    title: string,
    excludeId?: string,
    ncMeta = Noco.ncMeta,
  ) {
    const condition: Record<string, any> = {
      fk_model_id: modelId,
      title,
    };

    const section = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.VIEW_SECTIONS,
      condition,
    );

    if (section && excludeId && section.id === excludeId) {
      return null;
    }

    return section ? new ViewSection(section) : null;
  }

  static async insert(
    context: NcContext,
    section: Partial<ViewSection>,
    ncMeta = Noco.ncMeta,
  ) {
    let insertObj = extractProps(section, [
      'id',
      'fk_model_id',
      'title',
      'meta',
      'created_by',
      'updated_by',
      'source_id',
    ]);

    // get order value
    insertObj.order = await ncMeta.metaGetNextOrder(
      MetaTable.VIEW_SECTIONS,
      {
        fk_model_id: section.fk_model_id,
      },
    );

    if (!insertObj.meta) {
      insertObj.meta = {};
    }

    insertObj = prepareForDb(insertObj, ['meta']);

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.VIEW_SECTIONS,
      insertObj,
    );

    return ViewSection.get(context, id, ncMeta).then(async (viewSection) => {
      await NocoCache.appendToList(
        context,
        CacheScope.VIEW_SECTION,
        [section.fk_model_id],
        `${CacheScope.VIEW_SECTION}:${id}`,
      );
      return viewSection;
    });
  }

  static async update(
    context: NcContext,
    sectionId: string,
    section: Partial<ViewSection>,
    ncMeta = Noco.ncMeta,
  ) {
    let updateObj = extractProps(section, ['title', 'order', 'meta', 'updated_by']);

    updateObj = prepareForDb(updateObj, ['meta']);

    // update meta
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.VIEW_SECTIONS,
      updateObj,
      {
        id: sectionId,
      },
    );

    await NocoCache.update(
      context,
      `${CacheScope.VIEW_SECTION}:${sectionId}`,
      prepareForResponse(updateObj),
    );

    return this.get(context, sectionId, ncMeta);
  }

  static async delete(
    context: NcContext,
    sectionId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // Set fk_view_section_id = null for all views in this section
    const viewsInSection = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.VIEWS,
      {
        condition: {
          fk_view_section_id: sectionId,
        },
      },
    );

    if (viewsInSection.length) {
      // Bulk update all views in a single query instead of N+1
      const viewIds = viewsInSection.map((v) => v.id);
      await ncMeta.bulkMetaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.VIEWS,
        { fk_view_section_id: null },
        viewIds,
      );

      // Invalidate cache for each view
      for (const view of viewsInSection) {
        await NocoCache.update(
          context,
          `${CacheScope.VIEW}:${view.id}`,
          { fk_view_section_id: null },
        );
      }
    }

    // Delete the section
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.VIEW_SECTIONS,
      {
        id: sectionId,
      },
    );

    await NocoCache.deepDel(
      context,
      `${CacheScope.VIEW_SECTION}:${sectionId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
  }

  static async deleteByModelId(
    context: NcContext,
    modelId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const sections = await this.list(context, modelId, ncMeta);

    for (const section of sections) {
      await this.delete(context, section.id, ncMeta);
    }

    return true;
  }
}
