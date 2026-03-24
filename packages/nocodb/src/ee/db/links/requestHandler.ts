import {
  arrFlatMap,
  AuditV1OperationTypes,
  EventType,
  LinksVersion,
  type NcContext,
  parseProp,
  RelationTypes,
  UITypes,
} from 'nocodb-sdk';
import { LinksRequestHandler as LinksRequestHandlerCE } from 'src/db/links/requestHandler';
import { Logger } from '@nestjs/common';
import type { ClientType } from 'nocodb-sdk';
import type CustomKnex from '~/db/CustomKnex';
import type {
  LinkRow,
  LinkUnlinkProcessRequest,
  LinkUnlinkRequest,
} from '~/db/links/types';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import { DBQueryClient } from '~/dbQueryClient';
import {
  getBaseModelSqlFromModelId,
  getOppositeRelationType,
} from '~/helpers/dbHelpers';
import { Column, Model } from '~/models';
import { batchUpdate } from '~/utils';
import { NcError } from '~/helpers/ncError';
import NocoSocket from '~/socket/NocoSocket';
import { Profiler } from '~/helpers/profiler';

/**
 * Only works with single primary key table
 * for ext db, we'll fallback to singular process
 */
export class LinksRequestHandler extends LinksRequestHandlerCE {
  profiler: Profiler;
  logger: Logger = new Logger(LinksRequestHandler.name);

  // validate link & unlink request
  // link ids should exists in record
  // duplicated link ids should exists in links / unlinks
  // same combination (row id & link ids) should not exists between links / unlinks
  async validateLinkRequest(
    context: NcContext,
    payload: LinkUnlinkRequest,
    knex: CustomKnex,
  ) {
    this.profiler = Profiler.start('LinksRequestHandler.validateLinkRequest');

    const { links, unlinks } = payload;
    if (!links?.length && !unlinks?.length) {
      return payload;
    }

    // duplicated link ids should exists in each links / unlinks
    const keyValLinks = arrFlatMap(
      links?.map((link) =>
        [...link.linkIds].map((linkId) => {
          return {
            rowId: link.rowId,
            linkId,
          };
        }),
      ) ?? [],
    ) as {
      rowId: string;
      linkId: string;
    }[];
    if (
      keyValLinks.length &&
      new Set(keyValLinks.map((kl) => kl.linkId)).size < keyValLinks.length
    ) {
      NcError.get(context).invalidRequestBody(
        `Cannot link to same id on same request`,
      );
    }
    const keyValUnlinks = arrFlatMap(
      unlinks?.map((link) =>
        [...link.linkIds].map((linkId) => {
          return {
            rowId: link.rowId,
            linkId,
          };
        }),
      ) ?? [],
    ) as {
      rowId: string;
      linkId: string;
    }[];

    if (links?.length && unlinks?.length) {
      const linksKeyValHash = new Set(
        keyValLinks.map((k) => `${k.rowId}__${k.linkId}`),
      );
      const unlinksKeyValHash = new Set(
        keyValUnlinks.map((k) => `${k.rowId}__${k.linkId}`),
      );
      const intersect = linksKeyValHash.intersection(unlinksKeyValHash);
      if (intersect.size) {
        NcError.get(context).invalidRequestBody(
          `Cannot link and unlink same record at once`,
        );
      }
    }
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
        options: { transaction: knex },
      }));
    knex = knex ?? baseModel.dbDriver;
    const relatedLinkIds = new Set([
      ...keyValLinks.map((k) => k.linkId),
      ...keyValUnlinks.map((k) => k.linkId),
    ]);

    const relatedContext = colOptions.getRelContext(context).refContext;
    const relatedBaseModel = await getBaseModelSqlFromModelId({
      modelId: colOptions.fk_related_model_id,
      context: relatedContext,
      options: { transaction: knex },
    });
    const relatedModel = relatedBaseModel.model;
    await relatedModel.getColumns(relatedContext);
    const notExistsQb = DBQueryClient.get(
      baseModel.dbDriver.clientType() as ClientType,
    )
      .temporaryTable({
        knex,
        data: [...relatedLinkIds].map((link) => {
          return {
            _id: link,
          };
        }),
        fields: ['_id'],
        alias: '_tbl',
      })
      .whereNotExists(function () {
        this.from(
          relatedBaseModel.getTnPath(relatedModel) as '_rel_tbl',
        ).whereRaw(
          knex.raw(`??::text = ??::text`, [
            relatedModel.primaryKey.column_name,
            '_tbl._id',
          ]),
        );
      });
    const notExistsId = await notExistsQb;
    if (notExistsId.length) {
      NcError.get(context).invalidRequestBody(
        `Link id ${notExistsId
          .map((k) => `'${k._id}'`)
          .join(', ')} not found in related table`,
      );
    }
    this.profiler.end();
    return {
      ...payload,
      column,
      model,
      baseModel,
      colOptions,
    } as LinkUnlinkProcessRequest;
  }

  async generateLinkRequest(
    context: NcContext,
    payload: Omit<LinkUnlinkRequest, 'unlinks'> & { replaceMode?: boolean },
    knex?: CustomKnex,
  ) {
    this.profiler = Profiler.start('LinksRequestHandler.generateLinkRequest');

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
        options: { transaction: knex },
      }));
    knex = knex ?? baseModel.dbDriver;
    const result: LinkUnlinkProcessRequest = {
      ...payload,
      colOptions,
      baseModel,
      column,
      model,
    };

    // V2 relations use junction tables (like MM) — route them through the MM path
    const isV2JunctionBased = colOptions.version === LinksVersion.V2;

    // MM or any V2 junction-based relation (OM, MO, OO with LTAR)
    if (colOptions.type === RelationTypes.MANY_TO_MANY || isV2JunctionBased) {
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
      const currentlyLinkedWithChild = await this.getMmLinkedWithChild(
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
      // we unify both first
      const unionLinked: LinkRow[] = [];
      for (const each of [
        ...currentlyLinkedWithParent,
        ...currentlyLinkedWithChild,
      ]) {
        const existingUnionLinked = unionLinked.find(
          (link) => each.rowId === link.rowId,
        );
        if (!existingUnionLinked) {
          unionLinked.push(each);
        } else {
          existingUnionLinked.linkIds = new Set([
            ...existingUnionLinked.linkIds,
            ...each.linkIds,
          ]);
        }
      }
      for (const link of unionLinked) {
        const linkRequest = result.links.find((l) => l.rowId === link.rowId);
        let differenceOnLink = new Set<string>();
        if (linkRequest) {
          differenceOnLink = link.linkIds.difference(linkRequest.linkIds);
          linkRequest.linkIds = linkRequest.linkIds.difference(link.linkIds);
        } else {
          differenceOnLink = link.linkIds;
        }

        if (payload.replaceMode) {
          link.linkIds = differenceOnLink;
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
        } else {
          differenceOnLink = link.linkIds;
        }

        // if replace mode, the rest of existing links are removed
        if (payload.replaceMode) {
          link.linkIds = differenceOnLink;
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
        } else {
          differenceOnLink = link.linkIds;
        }

        // if replace mode, the rest of existing links are removed
        if (payload.replaceMode) {
          link.linkIds = differenceOnLink;
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
    result.unlinks = result.unlinks?.filter((l) => l.linkIds.size) ?? [];
    this.profiler.end();

    return result;
  }

  // #region get related records
  protected async getMmLinkedWithParent(
    context: NcContext,
    { colOptions, links }: Omit<LinkUnlinkProcessRequest, 'unlinks'>,
    knex: CustomKnex,
  ) {
    const { fk_mm_model_id, fk_mm_child_column_id, fk_mm_parent_column_id } =
      colOptions;

    const mmContext = colOptions.getRelContext(context).mmContext;
    const mmBaseModel = await getBaseModelSqlFromModelId({
      modelId: fk_mm_model_id,
      context: mmContext,
      options: { transaction: knex },
    });
    const mmModel = mmBaseModel.model;
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
    const existingLinks = await knex(mmBaseModel.getTnPath(mmModel))
      .select({
        id: childColumn.column_name,
        fk_id: parentColumn.column_name,
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
  protected async getMmLinkedWithChild(
    context: NcContext,
    { colOptions, links }: Omit<LinkUnlinkProcessRequest, 'unlinks'>,
    knex: CustomKnex,
  ) {
    const { fk_mm_model_id, fk_mm_child_column_id, fk_mm_parent_column_id } =
      colOptions;

    const mmContext = colOptions.getRelContext(context).mmContext;
    const mmBaseModel = await getBaseModelSqlFromModelId({
      modelId: fk_mm_model_id,
      context: mmContext,
      options: { transaction: knex },
    });
    const mmModel = mmBaseModel.model;
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
    const existingLinks = await knex(mmBaseModel.getTnPath(mmModel))
      .select({
        id: childColumn.column_name,
        fk_id: parentColumn.column_name,
      })
      .whereIn(
        childColumn.column_name,
        arrFlatMap(links.map((link) => [...link.linkIds])),
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
    { colOptions, links }: Omit<LinkUnlinkProcessRequest, 'unlinks'>,
    knex: CustomKnex,
  ) {
    const { fk_related_model_id: child_model_id, fk_child_column_id } =
      colOptions;

    const childContext = (await colOptions.getParentChildContext(context))
      .childContext;
    const childBaseModel = await getBaseModelSqlFromModelId({
      modelId: child_model_id,
      context: childContext,
      options: { transaction: knex },
    });
    const childModel = childBaseModel.model;
    await childModel.getColumns(childContext);
    const childColumn = childModel.columns.find(
      (col) => col.id === fk_child_column_id,
    );

    const response = new Map<string, string[]>();
    const query = knex(childBaseModel.getTnPath(childModel, '_tbl'))
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
      if (!each.id || !each.fk_id) {
        continue;
      }
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
    { colOptions, links }: Omit<LinkUnlinkProcessRequest, 'unlinks'>,
    knex: CustomKnex,
  ) {
    const { fk_related_model_id: child_model_id, fk_child_column_id } =
      colOptions;

    const childContext = (await colOptions.getParentChildContext(context))
      .childContext;
    const childBaseModel = await getBaseModelSqlFromModelId({
      modelId: child_model_id,
      context: childContext,
      options: { transaction: knex },
    });
    const childModel = childBaseModel.model;
    await childModel.getColumns(childContext);
    const childColumn = childModel.columns.find(
      (col) => col.id === fk_child_column_id,
    );

    const response = new Map<string, string[]>();
    // get id of child table by querying with foreign key column
    const childLinks = await knex(childBaseModel.getTnPath(childModel, '_tbl'))
      .select({
        id: childModel.primaryKey.column_name,
        fk_id: childColumn.column_name,
      })
      .whereIn(
        childModel.primaryKey.column_name,
        arrFlatMap(links.map((link) => [...link.linkIds])),
      );
    for (const each of childLinks) {
      if (!each.id || !each.fk_id) {
        continue;
      }
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
      if (!each.id || !each.fk_id) {
        continue;
      }
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

    const existingLinksQb = knex(baseModel.getTnPath(model, '_tbl'))
      .select({
        id: model.primaryKey.column_name,
        fk_id: childColumn.column_name,
      })
      .whereIn(
        childColumn.column_name,
        arrFlatMap(links.map((link) => [...link.linkIds])),
      );
    // get id of child table by querying with foreign key column
    const existingLinks = await existingLinksQb;
    for (const each of existingLinks) {
      if (!each.id || !each.fk_id) {
        continue;
      }
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
    this.profiler = Profiler.start('LinksRequestHandler.handle');
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
        options: { transaction: knex },
      }));
    knex = knex ?? baseModel.dbDriver;

    const response = await this.innerHandle(
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
    this.profiler.end();
    return response;
  }

  protected async innerHandle(
    context: NcContext,
    payload: LinkUnlinkProcessRequest,
    knex: CustomKnex,
  ) {
    const { baseModel, model, colOptions, column } = payload;

    if (colOptions.type === RelationTypes.MANY_TO_MANY) {
      const { mmContext, refContext } = colOptions.getRelContext(context);
      const mmBaseModel = await getBaseModelSqlFromModelId({
        modelId: colOptions.fk_mm_model_id,
        context: mmContext,
        options: { transaction: knex },
      });
      const parentBaseModel = await getBaseModelSqlFromModelId({
        modelId: colOptions.fk_related_model_id,
        context: refContext,
        options: { transaction: knex },
      });
      const mmModel = mmBaseModel.model;
      await mmModel.getColumns(mmContext);
      const parentColumn = mmModel.columns.find(
        (col) => col.id === colOptions.fk_mm_parent_column_id,
      );
      const childColumn = mmModel.columns.find(
        (col) => col.id === colOptions.fk_mm_child_column_id,
      );
      const toDelete = arrFlatMap(
        payload.unlinks?.map((linkObj) => {
          return Array.from(linkObj.linkIds, (v) => v).map((linkId) => {
            return {
              [childColumn.column_name]: linkObj.rowId,
              [parentColumn.column_name]: linkId,
            };
          });
        }) ?? [],
      );
      const toInsert = arrFlatMap(
        payload.links?.map((linkObj) => {
          return Array.from(linkObj.linkIds, (v) => v).map((linkId) => {
            return {
              [childColumn.column_name]: linkObj.rowId,
              [parentColumn.column_name]: linkId,
            };
          });
        }) ?? [],
      );
      if (toDelete.length) {
        const toDeleteUnionTableWithAlias = DBQueryClient.get(
          baseModel.dbDriver.clientType() as ClientType,
        ).temporaryTable({
          knex,
          data: [...toDelete].map((row) => {
            return {
              child_id: row[childColumn.column_name],
              parent_id: row[parentColumn.column_name],
            };
          }),
          fields: ['child_id', 'parent_id'],
          alias: '_rel_tbl',
        });

        const qb = knex(mmBaseModel.getTnPath(mmModel, '_tbl'))
          .whereExists(
            toDeleteUnionTableWithAlias
              .select(knex.raw('1'))
              .where(
                knex.raw(`??::text = ??::text AND ??::text = ??::text`, [
                  `_tbl.${parentColumn.column_name}`,
                  `_rel_tbl.parent_id`,
                  `_tbl.${childColumn.column_name}`,
                  `_rel_tbl.child_id`,
                ]),
              ),
          )
          .delete();
        await qb;
      }
      if (toInsert.length) {
        await knex(mmBaseModel.getTnPath(mmModel)).insert(toInsert);
      }

      await this.updateRelatedLastModified(
        context,
        {
          modelId: model.id,
          model,
          ids: new Set([
            ...toInsert.map((row) => row[childColumn.column_name]),
            ...toDelete.map((row) => row[childColumn.column_name]),
          ]),
          baseModel,
        },
        knex,
      );
      await this.updateRelatedLastModified(
        refContext,
        {
          modelId: colOptions.fk_related_model_id,
          ids: new Set([
            ...toInsert.map((row) => row[parentColumn.column_name]),
            ...toDelete.map((row) => row[parentColumn.column_name]),
          ]),
          baseModel: parentBaseModel,
        },
        knex,
      );
    } else if (
      (colOptions.type === RelationTypes.ONE_TO_ONE ||
        colOptions.type === RelationTypes.HAS_MANY) &&
      !parseProp(column.meta).bt
    ) {
      const relatedContext = colOptions.getRelContext(context).refContext;
      const relatedBaseModel = await getBaseModelSqlFromModelId({
        modelId: colOptions.fk_related_model_id,
        context: relatedContext,
        options: { transaction: knex },
      });
      const relatedModel = relatedBaseModel.model;
      await relatedModel.getColumns(relatedContext);
      const childColumn = relatedModel.columns.find(
        (col) => col.id === colOptions.fk_child_column_id,
      );

      const lastModifiedTimeColumn = relatedModel.columns.find(
        (c) => c.uidt === UITypes.LastModifiedTime && c.system,
      );

      const lastModifiedByColumn = relatedModel.columns.find(
        (c) => c.uidt === UITypes.LastModifiedBy && c.system,
      );

      const relatedModelModifiedIds = new Set<string>();
      const registerLinkToUpdateObj = (
        linkObj: LinkRow,
        mode: 'link' | 'unlink',
        toUpdateMap: Map<string, any>,
      ) => {
        for (const linkId of linkObj.linkIds) {
          if (!toUpdateMap.has(linkId)) {
            toUpdateMap.set(linkId, {
              [relatedModel.primaryKey.column_name]: linkId,
            });
          }
          const toUpdateObj = toUpdateMap.get(linkId);
          toUpdateObj[childColumn.column_name] =
            mode === 'unlink' ? null : linkObj.rowId ?? null;
          if (lastModifiedTimeColumn) {
            toUpdateObj[lastModifiedTimeColumn.column_name] = baseModel.now();
          }
          if (lastModifiedByColumn) {
            toUpdateObj[lastModifiedByColumn.column_name] = context.user.id;
          }
        }
      };

      const toUnlinkMap = new Map<string, any>();
      const toLinkMap = new Map<string, any>();
      for (const link of payload.unlinks ?? []) {
        relatedModelModifiedIds.add(link.rowId);
        registerLinkToUpdateObj(link, 'unlink', toUnlinkMap);
      }
      for (const link of payload.links ?? []) {
        relatedModelModifiedIds.add(link.rowId);
        registerLinkToUpdateObj(link, 'link', toLinkMap);
      }

      if (toUnlinkMap.size) {
        await batchUpdate(
          knex,
          relatedBaseModel.getTnPath(relatedModel),
          Array.from(toUnlinkMap, ([_key, value]) => value),
          relatedModel.primaryKey.column_name,
        );
      }
      if (toLinkMap.size) {
        await batchUpdate(
          knex,
          relatedBaseModel.getTnPath(relatedModel),
          Array.from(toLinkMap, ([_key, value]) => value),
          relatedModel.primaryKey.column_name,
        );
      }

      await this.updateRelatedLastModified(
        relatedContext,
        {
          modelId: relatedModel.id,
          model: relatedModel,
          ids: relatedModelModifiedIds,
          baseModel: relatedBaseModel,
        },
        knex,
      );
    }
    // belongs to
    else {
      const { refContext: relatedContext } = colOptions.getRelContext(context);
      const relatedBaseModel = await getBaseModelSqlFromModelId({
        modelId: colOptions.fk_related_model_id,
        context: relatedContext,
        options: { transaction: knex },
      });
      const lastModifiedTimeColumn = model.columns.find(
        (c) => c.uidt === UITypes.LastModifiedTime && c.system,
      );

      const lastModifiedByColumn = model.columns.find(
        (c) => c.uidt === UITypes.LastModifiedBy && c.system,
      );

      const childColumn = model.columns.find(
        (col) => col.id === colOptions.fk_child_column_id,
      );

      const relatedModelModifiedIds = new Set<string>();
      const registerLinkToUpdateObj = (
        linkObj: LinkRow,
        mode: 'link' | 'unlink',
        toUpdateMap: Map<string, any>,
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

      const toUnlinkMap = new Map<string, any>();
      const toLinkMap = new Map<string, any>();
      for (const link of payload.unlinks ?? []) {
        link.linkIds.forEach(
          relatedModelModifiedIds.add,
          relatedModelModifiedIds,
        );
        registerLinkToUpdateObj(link, 'unlink', toUnlinkMap);
      }
      for (const link of payload.links ?? []) {
        link.linkIds.forEach(
          relatedModelModifiedIds.add,
          relatedModelModifiedIds,
        );
        registerLinkToUpdateObj(link, 'link', toLinkMap);
      }

      if (toUnlinkMap.size) {
        await batchUpdate(
          knex,
          baseModel.getTnPath(model),
          Array.from(toUnlinkMap, ([_key, value]) => value),
          model.primaryKey.column_name,
        );
      }
      if (toLinkMap.size) {
        await batchUpdate(
          knex,
          baseModel.getTnPath(model),
          Array.from(toLinkMap, ([_key, value]) => value),
          model.primaryKey.column_name,
        );
      }

      await this.updateRelatedLastModified(
        relatedContext,
        {
          modelId: colOptions.fk_related_model_id,
          ids: relatedModelModifiedIds,
          baseModel: relatedBaseModel,
        },
        knex,
      );
    }
    this.profiler.log('link/unlink done');
    this.auditLogAndBroadcast(context, payload, knex).catch((err) => {
      this.logger.error(
        `Error when broadcast & audit: [${err.constructor?.name}] ${err.message}`,
      );
    });
    this.profiler.log('auditLogAndBroadcast done');
  }

  protected async updateRelatedLastModified(
    context: NcContext,
    payload: {
      ids: Set<string>;
      modelId: string;
      model?: Model;
      baseModel: IBaseModelSqlV2;
    },
    knex: CustomKnex,
  ) {
    const { ids, modelId, baseModel } = payload;
    let { model } = payload;

    if (!model) {
      model = await Model.get(context, modelId);
    }
    const columns = await model.getColumns(context);

    const lastModifiedTimeColumn = columns.find(
      (c) => c.uidt === UITypes.LastModifiedTime && c.system,
    );

    const lastModifiedByColumn = columns.find(
      (c) => c.uidt === UITypes.LastModifiedBy && c.system,
    );

    const dataToUpdate = [...ids].map((id) => ({
      [model.primaryKey.column_name]: id,
      ...(lastModifiedTimeColumn
        ? { [lastModifiedTimeColumn.column_name]: baseModel.now() }
        : {}),
      ...(lastModifiedByColumn
        ? { [lastModifiedByColumn.column_name]: context.user.id }
        : {}),
    }));
    await batchUpdate(
      knex,
      baseModel.getTnPath(model),
      dataToUpdate,
      model.primaryKey.column_name,
    );
  }

  protected async auditLogAndBroadcast(
    context: NcContext,
    payload: LinkUnlinkProcessRequest,
    knex: CustomKnex,
  ) {
    const { baseModel, column, colOptions, cookie, logger } = payload;
    const sourceRowIds = new Set(
      [...payload.links, ...payload.unlinks].map((link) => link.rowId),
    );
    const relatedRowIds = new Set(
      arrFlatMap(
        [...payload.links, ...payload.unlinks].map((link) => [...link.linkIds]),
      ) as string[],
    );

    const relatedContext = colOptions.getRelContext(context).refContext;

    const relatedBaseModel = await getBaseModelSqlFromModelId({
      modelId: colOptions.fk_related_model_id,
      context: relatedContext,
      options: { transaction: knex },
    });

    const baseModelPvCol =
      baseModel.model.columns.find((col) => col.pv) ??
      baseModel.model.primaryKey;

    const relatedModelPvCol =
      (await relatedBaseModel.model.getColumns(relatedContext)).find(
        (col) => col.pv,
      ) ?? relatedBaseModel.model.primaryKey;

    const linkInArray = arrFlatMap(
      payload.links.map((l) =>
        [...l.linkIds].map((linkId) => ({
          rowId: l.rowId,
          linkId,
        })),
      ),
    ) as {
      rowId: string;
      linkId: string;
    }[];
    const unlinkInArray = arrFlatMap(
      payload.unlinks.map((l) =>
        [...l.linkIds].map((linkId) => ({
          rowId: l.rowId,
          linkId,
          opType: AuditV1OperationTypes.DATA_UNLINK,
        })),
      ),
    ) as {
      rowId: string;
      linkId: string;
    }[];

    let relatedColumn: Column;
    if (colOptions.type === RelationTypes.MANY_TO_MANY) {
      relatedColumn = relatedBaseModel.model.columns.find(
        (col) => col.id === colOptions.fk_parent_column_id,
      );
    } else if (
      [RelationTypes.HAS_MANY, RelationTypes.ONE_TO_ONE].includes(
        colOptions.type as RelationTypes,
      ) &&
      !parseProp(column.meta).bt
    ) {
      relatedColumn = relatedBaseModel.model.columns.find(
        (col) => col.id === colOptions.fk_child_column_id,
      );
    } else {
      relatedColumn = relatedBaseModel.model.columns.find(
        (col) => col.id === colOptions.fk_parent_column_id,
      );
    }

    this.profiler.log('attachToTransaction broadcast+audit');

    // Single post-commit callback: fetch once, broadcast, then audit — all sequential
    // to avoid concurrent pool connections from parallel fire-and-forget ops
    knex.attachToTransaction(() => {
      const process = async () => {
        const sourceBaseModel = baseModel.getNonTransactionalClone();
        const relatedBaseModelClone =
          relatedBaseModel.getNonTransactionalClone();

        // 1. Fetch + broadcast source rows (realtime priority)
        const sourceRows = await sourceBaseModel.chunkList({
          pks: [...sourceRowIds],
          chunkSize: 100,
        });

        for (const item of sourceRows) {
          NocoSocket.broadcastEvent(context, {
            event: EventType.DATA_EVENT,
            payload: {
              action: 'update',
              payload: item,
              id: sourceBaseModel.extractPksValues(item),
            },
            scopes: [baseModel.model.id],
          });
        }

        // 2. Fetch + broadcast related rows
        const relatedRows = await relatedBaseModelClone.chunkList({
          pks: [...relatedRowIds],
          chunkSize: 100,
        });

        for (const item of relatedRows) {
          NocoSocket.broadcastEvent(relatedContext, {
            event: EventType.DATA_EVENT,
            payload: {
              action: 'update',
              payload: item,
              id: relatedBaseModelClone.extractPksValues(item),
            },
            scopes: [relatedBaseModel.model.id],
          });
        }

        // 3. Build display value maps from fetched data
        const sourceRowResultMap = new Map(
          sourceRows.map((row) => [
            sourceBaseModel.extractPksValues(row, true),
            row[baseModelPvCol.title],
          ]),
        );
        const relatedRowResultMap = new Map(
          relatedRows.map((row) => [
            relatedBaseModelClone.extractPksValues(row, true),
            row[relatedModelPvCol.title],
          ]),
        );

        // 4. Audit — sequential, lower priority
        // Calls on baseModel: displayValue from sourceRowResultMap, refDisplayValue from relatedRowResultMap
        // Calls on relatedBaseModel: displayValue from relatedRowResultMap, refDisplayValue from sourceRowResultMap

        // UNLINK for source table
        await baseModel.afterAddOrRemoveChild(
          {
            opType: AuditV1OperationTypes.DATA_UNLINK,
            model: baseModel.model,
            refModel: relatedBaseModel.model,
            columnTitle: column.title,
            columnId: column.id,
            refColumnTitle: relatedColumn.title,
            refColumnId: relatedColumn.id,
            req: cookie,
          },
          unlinkInArray.map((link) => ({
            rowId: link.rowId,
            refRowId: link.linkId,
            displayValue: sourceRowResultMap.get(link.rowId),
            refDisplayValue: relatedRowResultMap.get(link.linkId),
            type: colOptions.type as RelationTypes,
          })),
        );

        // UNLINK for related table
        await relatedBaseModel.afterAddOrRemoveChild(
          {
            opType: AuditV1OperationTypes.DATA_UNLINK,
            model: relatedBaseModel.model,
            refModel: baseModel.model,
            columnTitle: relatedColumn.title,
            columnId: relatedColumn.id,
            refColumnTitle: column.title,
            refColumnId: column.id,
            req: cookie,
          },
          unlinkInArray.map((link) => ({
            rowId: link.linkId,
            refRowId: link.rowId,
            displayValue: relatedRowResultMap.get(link.linkId),
            refDisplayValue: sourceRowResultMap.get(link.rowId),
            type: getOppositeRelationType(colOptions.type as RelationTypes),
          })),
        );

        // LINK for source table
        await baseModel.afterAddOrRemoveChild(
          {
            opType: AuditV1OperationTypes.DATA_LINK,
            model: baseModel.model,
            refModel: relatedBaseModel.model,
            columnTitle: column.title,
            columnId: column.id,
            refColumnTitle: relatedColumn.title,
            refColumnId: relatedColumn.id,
            req: cookie,
          },
          linkInArray.map((link) => ({
            rowId: link.rowId,
            refRowId: link.linkId,
            displayValue: sourceRowResultMap.get(link.rowId),
            refDisplayValue: relatedRowResultMap.get(link.linkId),
            type: colOptions.type as RelationTypes,
          })),
        );

        // LINK for related table
        await relatedBaseModel.afterAddOrRemoveChild(
          {
            opType: AuditV1OperationTypes.DATA_LINK,
            model: relatedBaseModel.model,
            refModel: baseModel.model,
            columnTitle: relatedColumn.title,
            columnId: relatedColumn.id,
            refColumnTitle: column.title,
            refColumnId: column.id,
            req: cookie,
          },
          linkInArray.map((link) => ({
            rowId: link.linkId,
            refRowId: link.rowId,
            displayValue: relatedRowResultMap.get(link.linkId),
            refDisplayValue: sourceRowResultMap.get(link.rowId),
            type: getOppositeRelationType(colOptions.type as RelationTypes),
          })),
        );
      };

      process().catch(logger.error);
    });
  }
}
