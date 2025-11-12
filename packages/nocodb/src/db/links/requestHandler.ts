import { getBaseModelSqlFromModelId } from 'src/helpers/dbHelpers';
import {
  arrFlatMap,
  type NcContext,
  parseProp,
  RelationTypes,
  UITypes,
} from 'nocodb-sdk';
import type CustomKnex from '../CustomKnex';
import type {
  LinkRow,
  LinkUnlinkProcessRequest,
  LinkUnlinkRequest,
} from '~/db/links/types';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import { Column, Model } from '~/models';
import { batchUpdate } from '~/utils';

/**
 * Only works with single primary key table
 * for ext db, we'll fallback to singular process
 */
export class LinksRequestHandler {
  constructor() {}

  async generateLinkRequest(
    context: NcContext,
    payload: Omit<LinkUnlinkRequest, 'unlinks'> & { replaceMode?: boolean },
    knex?: CustomKnex,
  ) {
    const column =
      payload.column ??
      (await Column.get(context, { colId: payload.columnId }));
    const model = payload.model ?? (await Model.get(context, payload.modelId));
    const colOptions =
      payload.colOptions ?? (await column.getColOptions(context));

    const baseModel =
      payload.baseModel ??
      (await getBaseModelSqlFromModelId({
        modelId: payload.modelId,
        context,
      }));
    knex = knex ?? baseModel.dbDriver;
    const result: LinkUnlinkProcessRequest = {
      ...payload,
      colOptions,
      baseModel,
      column,
      model,
    };

    // MM
    if (colOptions.type === RelationTypes.MANY_TO_MANY) {
      // skip existing links from being added
      const currentlyLinkedWithParent = await this.getMmLinkedWithParent(
        context,
        {
          ...payload,
          model,
          colOptions,
          column,
          baseModel,
        },
        knex,
      );
      for (const link of currentlyLinkedWithParent) {
        const linkRequest = result.links.find((l) => l.rowId === link.rowId);
        if (linkRequest) {
          linkRequest.linkIds = linkRequest.linkIds.difference(link.linkIds);
        }
      }
    }
    // HM not BT
    else if (
      colOptions.type === RelationTypes.HAS_MANY &&
      !parseProp(column.meta).bt
    ) {
      const currentlyLinkedWithParent =
        await this.getHmOrOoChildLinkedWithParent(
          context,
          {
            ...payload,
            model,
            colOptions,
            column,
            baseModel,
          },
          knex,
        );
      const currentlyLinkedWithChild =
        await this.getHmOrOoParentLinkedWithChild(
          context,
          {
            ...payload,
            model,
            colOptions,
            column,
            baseModel,
          },
          knex,
        );

      // skip existing links from being deleted when exists in request
      for (const link of currentlyLinkedWithChild) {
        const linkRequest = result.links.find((l) => l.rowId === link.rowId);
        if (linkRequest) {
          link.linkIds = link.linkIds.difference(linkRequest.linkIds);
        }
      }
      result.unlinks = currentlyLinkedWithChild;

      // skip existing links from being added
      for (const link of currentlyLinkedWithParent) {
        const linkRequest = result.links.find((l) => l.rowId === link.rowId);
        let differenceOnLink: Set<string> = new Set();
        if (linkRequest) {
          differenceOnLink = link.linkIds.difference(linkRequest.linkIds);
          linkRequest.linkIds = linkRequest.linkIds.difference(link.linkIds);
        }

        // if replace mode, the rest of existing links are removed
        if (payload.replaceMode) {
          link.linkIds = link.linkIds.difference(differenceOnLink);
          if (link.linkIds.size) {
            if (!result.unlinks) {
              result.unlinks = [];
            }
            const existingUnlink = result.unlinks.find(
              (l) => l.rowId === link.rowId,
            );
            if (!existingUnlink) {
              result.unlinks.push(link);
            } else {
              existingUnlink.linkIds = new Set([
                ...existingUnlink.linkIds,
                ...link.linkIds,
              ]);
            }
          }
        }
      }
    } else if (
      colOptions.type === RelationTypes.ONE_TO_ONE &&
      !parseProp(column.meta).bt
    ) {
      const currentlyLinkedWithParent =
        await this.getHmOrOoChildLinkedWithParent(
          context,
          {
            ...payload,
            model,
            colOptions,
            column,
            baseModel,
          },
          knex,
        );
      const currentlyLinkedWithChild =
        await this.getHmOrOoParentLinkedWithChild(
          context,
          {
            ...payload,
            model,
            colOptions,
            column,
            baseModel,
          },
          knex,
        );
      // delete existing links when different
      for (const link of currentlyLinkedWithChild) {
        const linkRequest = result.links.find((l) => l.rowId === link.rowId);
        if (
          linkRequest &&
          link.linkIds.values().next().value &&
          link.linkIds.values().next().value !==
            linkRequest.linkIds.values().next().value
        ) {
          if (!result.unlinks) {
            result.unlinks = [];
          }
          if (!result.unlinks.find((l) => l.rowId === link.rowId)) {
            result.unlinks.push(link);
          }
        }
      }
      // skip existing links from being added
      for (const link of currentlyLinkedWithParent) {
        const linkRequest = result.links.find((l) => l.rowId === link.rowId);
        // because one on one they will only have 1 linkIds
        // if it's same in request, do nothing
        if (
          linkRequest &&
          link.linkIds.values().next().value ===
            linkRequest.linkIds.values().next().value
        ) {
          linkRequest.linkIds.delete(link.linkIds.values().next().value);
        }
        // else we put it as to be unlinked if link exists
        else if (link.linkIds.values().next().value) {
          if (!result.unlinks) {
            result.unlinks = [];
          }
          result.unlinks.push(link);
        }
      }
    }
    // BT
    else {
      const currentlyLinkedWithChild = await this.getBtChildLinkedWithParent(
        context,
        {
          ...payload,
          model,
          colOptions,
          column,
          baseModel,
        },
        knex,
      );
      const currentlyLinkedWithParent = await this.getBtParentLinkedWithChild(
        context,
        {
          ...payload,
          model,
          colOptions,
          column,
          baseModel,
        },
        knex,
      );
      // skip existing links from being deleted when exists in request
      for (const link of currentlyLinkedWithChild) {
        const linkRequest = result.links.find((l) => l.rowId === link.rowId);
        if (linkRequest) {
          link.linkIds = link.linkIds.difference(linkRequest.linkIds);
        }
      }

      // skip existing links from being added
      for (const link of currentlyLinkedWithParent) {
        const linkRequest = result.links.find((l) => l.rowId === link.rowId);
        let differenceOnLink: Set<string> = new Set();
        if (linkRequest) {
          differenceOnLink = link.linkIds.difference(linkRequest.linkIds);
          linkRequest.linkIds = linkRequest.linkIds.difference(link.linkIds);
        }

        // if replace mode, the rest of existing links are removed
        if (payload.replaceMode) {
          link.linkIds = link.linkIds.difference(differenceOnLink);
          if (link.linkIds.size) {
            if (!result.unlinks) {
              result.unlinks = [];
            }
            const existingUnlink = result.unlinks.find(
              (l) => l.rowId === link.rowId,
            );
            if (!existingUnlink) {
              result.unlinks.push(link);
            } else {
              existingUnlink.linkIds = new Set([
                ...existingUnlink.linkIds,
                ...link.linkIds,
              ]);
            }
          }
        }
      }

      result.unlinks = currentlyLinkedWithChild;
    }

    result.links = result.links.filter((l) => l.linkIds.size);
    result.unlinks = result.unlinks?.filter((l) => l.linkIds.size);

    return result;
  }

  // #region get related records
  protected async getMmLinkedWithParent(
    context: NcContext,
    { baseModel, colOptions, links }: Omit<LinkUnlinkProcessRequest, 'unlinks'>,
    knex: CustomKnex,
  ) {
    const {
      fk_mm_base_id,
      fk_mm_model_id,
      fk_mm_child_column_id,
      fk_mm_parent_column_id,
    } = colOptions;

    const mmContext = {
      ...context,
      base_id: fk_mm_base_id ?? context.base_id,
    };
    const mmModel = await Model.get(mmContext, fk_mm_model_id);
    await mmModel.getColumns(mmContext);

    // for M2M and Belongs to relation, the relation stored in column option is reversed
    // parent become child, child become parent from the viewpoint of col options
    const parentColumn = mmModel.columns.find(
      (col) => col.id === fk_mm_child_column_id,
    );
    const childColumn = mmModel.columns.find(
      (col) => col.id === fk_mm_parent_column_id,
    );
    const response = new Map<string, string[]>();
    const existingLinks = await knex(baseModel.getTnPath(mmModel))
      .select({
        id: parentColumn.column_name,
        fk_id: childColumn.column_name,
      })
      .whereIn(
        parentColumn.column_name,
        links.map((l) => l.rowId),
      );

    for (const each of existingLinks) {
      if (!response.has(`${each.fk_id}`)) {
        response.set(`${each.fk_id}`, []);
      }
      response.get(`${each.fk_id}`).push(`${each.id}`);
    }
    return Array.from(response, ([key, value]) => {
      return {
        rowId: key,
        linkIds: new Set<string>(value),
      };
    });
  }

  protected async getHmOrOoChildLinkedWithParent(
    context: NcContext,
    { baseModel, colOptions, links }: Omit<LinkUnlinkProcessRequest, 'unlinks'>,
    knex: CustomKnex,
  ) {
    const {
      fk_related_model_id: child_model_id,
      fk_child_column_id,
      fk_related_base_id,
    } = colOptions;

    const childContext = {
      ...context,
      base_id: fk_related_base_id ?? context.base_id,
    };
    const childModel = await Model.get(childContext, child_model_id);
    await childModel.getColumns(childContext);
    const childColumn = childModel.columns.find(
      (col) => col.id === fk_child_column_id,
    );

    const response = new Map<string, string[]>();
    const query = knex(baseModel.getTnPath(childModel, '_tbl'))
      .select({
        id: childModel.primaryKey.column_name,
        fk_id: childColumn.column_name,
      })
      .whereIn(
        childColumn.column_name,
        links.map((link) => link.rowId),
      );
    // get id of child table by querying with foreign key column
    const childLinks = await query;
    for (const each of childLinks) {
      if (!response.has(`${each.fk_id}`)) {
        response.set(`${each.fk_id}`, []);
      }
      response.get(`${each.fk_id}`).push(`${each.id}`);
    }
    return Array.from(response, ([key, value]) => {
      return {
        rowId: key,
        linkIds: new Set<string>(value),
      };
    });
  }

  protected async getHmOrOoParentLinkedWithChild(
    context: NcContext,
    { baseModel, colOptions, links }: Omit<LinkUnlinkProcessRequest, 'unlinks'>,
    knex: CustomKnex,
  ) {
    const {
      fk_related_model_id: child_model_id,
      fk_child_column_id,
      fk_related_base_id,
    } = colOptions;

    const childContext = {
      ...context,
      base_id: fk_related_base_id ?? context.base_id,
    };
    const childModel = await Model.get(childContext, child_model_id);
    await childModel.getColumns(childContext);
    const childColumn = childModel.columns.find(
      (col) => col.id === fk_child_column_id,
    );

    const response = new Map<string, string[]>();
    // get id of child table by querying with foreign key column
    const childLinks = await knex(baseModel.getTnPath(childModel, '_tbl'))
      .select({
        id: childModel.primaryKey.column_name,
        fk_id: childColumn.column_name,
      })
      .whereIn(
        childModel.primaryKey.column_name,
        arrFlatMap(links.map((link) => [...link.linkIds])),
      );
    for (const each of childLinks) {
      if (each.fk_id) {
        if (!response.has(`${each.fk_id}`)) {
          response.set(`${each.fk_id}`, []);
        }
        response.get(`${each.fk_id}`).push(`${each.id}`);
      }
    }
    return Array.from(response, ([key, value]) => {
      return {
        rowId: key,
        linkIds: new Set<string>(value),
      };
    });
  }

  protected async getBtChildLinkedWithParent(
    context: NcContext,
    {
      baseModel,
      colOptions,
      model,
      links,
    }: Omit<LinkUnlinkProcessRequest, 'unlinks'>,
    knex: CustomKnex,
  ) {
    const { fk_child_column_id } = colOptions;

    await model.getColumns(context);
    const childColumn = model.columns.find(
      (col) => col.id === fk_child_column_id,
    );

    const response = new Map<string, string[]>();
    // get id of child table by querying with foreign key column
    const existingLinks = await knex(baseModel.getTnPath(model, '_tbl'))
      .select({
        id: model.primaryKey.column_name,
        fk_id: childColumn.column_name,
      })
      .whereIn(
        model.primaryKey.column_name,
        links.map((link) => link.rowId),
      );
    for (const each of existingLinks) {
      if (!response.has(`${each.id}`)) {
        response.set(`${each.id}`, []);
      }
      response.get(`${each.id}`).push(`${each.fk_id}`);
    }
    return Array.from(response, ([key, value]) => {
      return {
        rowId: key,
        linkIds: new Set<string>(value),
      };
    });
  }

  protected async getBtParentLinkedWithChild(
    context: NcContext,
    {
      baseModel,
      colOptions,
      model,
      links,
    }: Omit<LinkUnlinkProcessRequest, 'unlinks'>,
    knex: CustomKnex,
  ) {
    const { fk_child_column_id } = colOptions;

    const childColumn = (await model.getColumns(context)).find(
      (col) => col.id === fk_child_column_id,
    );

    const response = new Map<string, string[]>();
    // get id of child table by querying with foreign key column
    const existingLinks = await knex(baseModel.getTnPath(model, '_tbl'))
      .select({
        id: model.primaryKey.column_name,
        fk_id: childColumn.column_name,
      })
      .whereIn(
        childColumn.column_name,
        arrFlatMap(links.map((link) => [...link.linkIds])),
      );
    for (const each of existingLinks) {
      if (!response.has(`${each.id}`)) {
        response.set(`${each.id}`, []);
      }
      response.get(`${each.id}`).push(`${each.fk_id}`);
    }
    return Array.from(response, ([key, value]) => {
      return {
        rowId: key,
        linkIds: new Set<string>(value),
      };
    });
  }
  // #endregion get related records

  async handle(
    context: NcContext,
    payload: LinkUnlinkRequest,
    knex?: CustomKnex,
  ) {
    const column =
      payload.column ??
      (await Column.get(context, { colId: payload.columnId }));
    const model = payload.model ?? (await Model.get(context, payload.modelId));
    const colOptions =
      payload.colOptions ?? (await column.getColOptions(context));

    const baseModel =
      payload.baseModel ??
      (await getBaseModelSqlFromModelId({
        modelId: payload.modelId,
        context,
      }));
    knex = knex ?? baseModel.dbDriver;

    return this.innerHandle(
      context,
      {
        ...payload,
        model,
        colOptions,
        column,
        baseModel,
      },
      knex,
    );
  }

  protected async innerHandle(
    context: NcContext,
    payload: LinkUnlinkProcessRequest,
    knex: CustomKnex,
  ) {
    const { baseModel, model, colOptions, column } = payload;

    const lastModifiedTimeColumn = model.columns.find(
      (c) => c.uidt === UITypes.LastModifiedTime && c.system,
    );

    const lastModifiedByColumn = model.columns.find(
      (c) => c.uidt === UITypes.LastModifiedBy && c.system,
    );

    if (colOptions.type === RelationTypes.MANY_TO_MANY) {
      // TODO: perform update for MM
    } else if (
      (colOptions.type === RelationTypes.ONE_TO_ONE ||
        colOptions.type === RelationTypes.HAS_MANY) &&
      !parseProp(column.meta).bt
    ) {
      // TODO: perform update for OO and HM
    }
    // belongs to
    else {
      const childColumn = model.columns.find(
        (col) => col.id === colOptions.fk_child_column_id,
      );

      const toUpdateMap = new Map<string, any>();
      const relatedModelModifiedIds = new Set<string>();
      const registerLinkToUpdateObj = (
        linkObj: LinkRow,
        mode: 'link' | 'unlink',
      ) => {
        if (!toUpdateMap.has(linkObj.rowId)) {
          toUpdateMap.set(linkObj.rowId, {
            [model.primaryKey.column_name]: linkObj.rowId,
          });
        }
        const toUpdateObj = toUpdateMap.get(linkObj.rowId);
        toUpdateObj[childColumn.column_name] =
          mode === 'unlink'
            ? null
            : linkObj.linkIds.values().next().value ?? null;
        if (lastModifiedTimeColumn) {
          toUpdateObj[lastModifiedTimeColumn.column_name] = baseModel.now();
        }
        if (lastModifiedByColumn) {
          toUpdateObj[lastModifiedByColumn.column_name] = context.user.id;
        }
      };
      for (const link of payload.unlinks ?? []) {
        link.linkIds.forEach(
          relatedModelModifiedIds.add,
          relatedModelModifiedIds,
        );
        registerLinkToUpdateObj(link, 'unlink');
      }
      for (const link of payload.links ?? []) {
        link.linkIds.forEach(
          relatedModelModifiedIds.add,
          relatedModelModifiedIds,
        );
        registerLinkToUpdateObj(link, 'link');
      }

      const batchUpdateData = Array.from(toUpdateMap, ([_key, value]) => value);
      await batchUpdate(
        knex,
        baseModel.getTnPath(model),
        batchUpdateData,
        model.primaryKey.column_name,
      );

      await this.updateRelatedLastModified(
        {
          ...context,
          base_id: colOptions.fk_related_base_id ?? context.base_id,
        },
        {
          modelId: colOptions.fk_related_model_id,
          ids: relatedModelModifiedIds,
          baseModel,
        },
        knex,
      );
    }
  }

  protected async updateRelatedLastModified(
    context: NcContext,
    payload: {
      ids: Set<string>;
      modelId: string;
      baseModel: IBaseModelSqlV2;
    },
    knex: CustomKnex,
  ) {
    const { ids, modelId, baseModel } = payload;

    const relatedModel = await Model.get(context, modelId);
    const columns = await relatedModel.getColumns(context);

    const lastModifiedTimeColumn = columns.find(
      (c) => c.uidt === UITypes.LastModifiedTime && c.system,
    );

    const lastModifiedByColumn = columns.find(
      (c) => c.uidt === UITypes.LastModifiedBy && c.system,
    );

    const dataToUpdate = [...ids].map((id) => ({
      [relatedModel.primaryKey.column_name]: id,
      ...(lastModifiedTimeColumn
        ? { [lastModifiedTimeColumn.column_name]: baseModel.now() }
        : {}),
      ...(lastModifiedByColumn
        ? { [lastModifiedByColumn.column_name]: context.user.id }
        : {}),
    }));
    await batchUpdate(
      knex,
      baseModel.getTnPath(relatedModel),
      dataToUpdate,
      relatedModel.primaryKey.column_name,
    );
  }
}
