import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  isLinksOrLTAR,
  NcBaseError,
  ncIsArray,
  NOCO_SERVICE_USERS,
  ServiceUserType,
  UITypes,
  ViewTypes,
} from 'nocodb-sdk';
import type { ClientType, NcRequest } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { DependantFields } from '~/helpers/getAst';
import { DBQueryClient } from '~/dbQueryClient';
import { nocoExecute } from '~/utils';
import { Base, Column, FormView, Model, Source, View } from '~/models';
import { NcError } from '~/helpers/catchError';
import getAst from '~/helpers/getAst';
import { sanitizePublicQuery } from '~/helpers/publicQuerySanitizer';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import {
  assertLinkColOptions,
  getColumnByIdOrName,
} from '~/helpers/dataHelpers';
import { restrictNestedLinkQueryForColumn } from '~/helpers/nestedLinkQueryHelpers';
import { collectRelatedNeededColumnIds } from '~/helpers/relatedMetaProjection';
import {
  resolveSharedViewQueryScope,
  restrictSharedViewColumnReferences,
  restrictSharedViewQuery,
} from '~/helpers/sharedViewQueryHelpers';
import { getViewExposedColumnIds } from '~/helpers/viewVisibleColumns';
import { isSharedViewAccess } from '~/helpers/accessSource';
import { parseFilterArrJson } from '~/helpers/filterArrJsonHelper';
import { defaultGroupByLimitConfig } from '~/helpers/extractLimitAndOffset';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { replaceDynamicFieldWithValue } from '~/helpers/dbHelpers';
import { Filter } from '~/models';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { DatasService } from '~/services/datas.service';
import { AttachmentsService } from '~/services/attachments.service';
import { PublicMetasService } from '~/services/public-metas.service';

// todo: move to utils
export function sanitizeUrlPath(paths) {
  return paths.map((url) => url.replace(/[/.?#]+/g, '_'));
}

// Each bulk entry costs a full query, and these routes are anonymous — without a
// cap one 50MB body (the json-body middleware limit) buys tens of thousands of
// them. 200 leaves 2x headroom over the largest batch the UI sends
// (GROUP_CHUNK_SIZE = 100 in useInfiniteGroups).
//
// useViewGroupBy sizes its batch by `limitGroup` instead, which has a lower clamp
// only — so raising NC_DB_QUERY_LIMIT_GROUP_BY_GROUP past the cap would 400 every
// shared-view request and blame this file. Track it rather than couple to it.
const MAX_PUBLIC_BULK_ENTRIES = Math.max(
  200,
  defaultGroupByLimitConfig.limitGroup,
);

function assertBulkFilterListWithinLimit(bulkFilterList: unknown): void {
  if (!Array.isArray(bulkFilterList) || !bulkFilterList.length) {
    NcError.badRequest('Invalid bulkFilterList');
  }

  if ((bulkFilterList as unknown[]).length > MAX_PUBLIC_BULK_ENTRIES) {
    NcError.badRequest(
      `bulkFilterList exceeds the maximum of ${MAX_PUBLIC_BULK_ENTRIES} entries`,
    );
  }
}

// Response-shape keys a public/shared-view caller must not control:
// `getHiddenColumn` bypasses getAst's `allowedCols` and would emit every
// non-system column's VALUES; `nested` drives caller-controlled LTAR expansion.
// Re-exported from a dependency-light helper so other public services can strip
// the same keys without importing this service graph.
export {
  PUBLIC_QUERY_BLOCKED_KEYS,
  sanitizePublicQuery,
} from '~/helpers/publicQuerySanitizer';

/**
 * DESIGN NOTE — on a shared view the view's visible column set is a real
 * boundary, in the payload AND the query: a hidden field was never published,
 * so an anonymous caller may not read it by any route. It gates:
 *
 *  - the response payload — `getAst`'s `allowedCols`;
 *  - `where` / `sort` / `filterArrJson` / `sortArrJson` — stripped per
 *    leaf/term by `restrictSharedViewQuery`, so multi-field search still
 *    works;
 *  - group-by `column_name` and `aggregation` targets — via
 *    `restrictSharedViewColumnReferences`; the sharpest of the set, since
 *    both return raw values rather than a one-bit oracle;
 *  - `getHiddenColumn` / `nested` — `sanitizePublicQuery`, above;
 *  - an LTAR related table — pk + primary value + the link's custom display
 *    column only, via `hasLimitedRelatedTableAccess`.
 *
 * Keyed on ACCESS SOURCE (`SHARED_VIEW` / `SHARED_FORM`), NOT on
 * `context.is_public`: a shared BASE sets `is_public` too but is an
 * authenticated pseudo-user carrying the share's roles, so its QUERY surface
 * stays unrestricted — as does a logged-in viewer's. Field visibility remains a
 * separate ACL.
 *
 * Scope note: this changes the QUERY surface on a shared view only. The response
 * PAYLOAD gate (`getAst`'s `allowedCols`) is untouched and still omits
 * view-hidden columns for every caller, `?fields=` included. Letting an
 * authenticated caller pull a view-hidden column via `?fields=` would be a
 * public-API widening and is deliberately NOT part of this change.
 *
 * This reverses the pre-2026-07 position that view-`show` is purely cosmetic,
 * under which this gate was removed on purpose (CVE-2026-47378 /
 * CVE-2026-47279 / GHSA-qqxm-7cj9-5fr2). Run `tests/unit/hiddenFieldMatrix/`
 * before relaxing anything here — its row-2 guards pin the unrestricted cases.
 */
@Injectable()
export class PublicDatasService {
  constructor(
    protected datasService: DatasService,
    @Inject(forwardRef(() => 'JobsService'))
    protected readonly jobsService: IJobsService,
    protected readonly attachmentsService: AttachmentsService,
    protected readonly publicMetasService: PublicMetasService,
  ) {}

  async dataList(
    context: NcContext,
    param: {
      sharedViewUuid: string;
      password?: string;
      query: any;
    },
  ) {
    const { sharedViewUuid, password, query = {} } = param;
    const view = await View.getByUUID(context, sharedViewUuid);

    if (!view) NcError.get(context).viewNotFound(sharedViewUuid);

    if (
      view.type !== ViewTypes.GRID &&
      view.type !== ViewTypes.KANBAN &&
      view.type !== ViewTypes.GALLERY &&
      view.type !== ViewTypes.MAP &&
      view.type !== ViewTypes.CALENDAR &&
      view.type !== ViewTypes.TIMELINE &&
      view.type !== ViewTypes.GANTT
    ) {
      NcError.get(context).notFound('Not found');
    }

    const base = await Base.get(context, view.base_id);

    this.publicMetasService.checkViewBaseType(view, base);

    if (!(await View.verifyPassword(view, password))) {
      return NcError.get(context).invalidSharedViewPassword();
    }

    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id,
    });

    if (!model) NcError.get(context).tableNotFound(view.fk_model_id);

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // No-op off the shared-view access source — see the DESIGN NOTE.
    await restrictSharedViewQuery(context, { model, view, query });

    // For Gantt shared views the dep-link Links column must expand into
    // nested LTAR rows in BOTH the AST (which drives nocoExecute's
    // response shape) and listArgs (which drives baseModel.list's SQL).
    // Setting it on listArgs alone fetches the nested data but then
    // nocoExecute strips it because the AST still says
    // `Predecessor: 1` (count form).
    const isGanttShared = view.type === ViewTypes.GANTT;

    const { ast, dependencyFields } = await getAst(context, {
      model,
      query: isGanttShared ? { linksAsLtar: 'true' } : {},
      view,
      includeRowColorColumns: query.include_row_color === 'true',
    });

    const listArgs: any = { ...query, ...dependencyFields };
    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}
    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}

    // baseModel.list also reads linksAsLtar — see getAst note above.
    if (isGanttShared) {
      listArgs.linksAsLtar = 'true';
    }

    let data = [];
    let count = 0;

    try {
      data = await nocoExecute(
        ast,
        await baseModel.list(listArgs),
        {},
        listArgs,
      );
      count = await baseModel.count(listArgs);
    } catch (e) {
      if (e instanceof NcError || e instanceof NcBaseError) throw e;
      console.log(e);
      NcError.get(context).internalServerError(
        'Please check server log for more details',
      );
    }

    return new PagedResponseImpl(data, { ...param.query, count });
  }

  async dataCount(
    context: NcContext,
    param: {
      sharedViewUuid: string;
      password?: string;
      query: any;
    },
  ) {
    const { sharedViewUuid, password } = param;
    const view = await View.getByUUID(context, sharedViewUuid);

    if (!view) NcError.get(context).viewNotFound(sharedViewUuid);

    if (
      view.type !== ViewTypes.GRID &&
      view.type !== ViewTypes.KANBAN &&
      view.type !== ViewTypes.GALLERY &&
      view.type !== ViewTypes.MAP &&
      view.type !== ViewTypes.CALENDAR &&
      view.type !== ViewTypes.TIMELINE &&
      view.type !== ViewTypes.GANTT
    ) {
      NcError.notFound('Not found');
    }

    const base = await Base.get(context, view.base_id);

    this.publicMetasService.checkViewBaseType(view, base);

    if (!(await View.verifyPassword(view, password))) {
      return NcError.invalidSharedViewPassword();
    }

    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id,
    });

    if (!model) NcError.get(context).tableNotFound(view.fk_model_id);

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // No-op off the shared-view access source — see the DESIGN NOTE.
    await restrictSharedViewQuery(context, { model, view, query: param.query });

    const countArgs: any = { ...param.query, throwErrorIfInvalidParams: true };
    countArgs.filterArr = parseFilterArrJson(context, countArgs.filterArrJson);

    const count: number = await baseModel.count(countArgs);

    return { count };
  }

  async dataAggregate(
    context: NcContext,
    param: {
      sharedViewUuid: string;
      password?: string;
      query: any;
    },
  ) {
    const view = await View.getByUUID(context, param.sharedViewUuid);

    if (!view) NcError.viewNotFound(param.sharedViewUuid);

    if (view.type !== ViewTypes.GRID) {
      NcError.notFound('Not found');
    }

    const base = await Base.get(context, view.base_id);

    this.publicMetasService.checkViewBaseType(view, base);

    if (!(await View.verifyPassword(view, param.password))) {
      return NcError.invalidSharedViewPassword();
    }

    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id,
    });

    if (!model) NcError.get(context).tableNotFound(view.fk_model_id);

    const source = await Source.get(context, model.source_id);

    // No-op off the shared-view access source — see the DESIGN NOTE.
    await restrictSharedViewQuery(context, { model, view, query: param.query });
    await restrictSharedViewColumnReferences(context, {
      model,
      view,
      query: param.query,
    });

    const listArgs: any = { ...param.query };

    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}

    try {
      listArgs.aggregation = JSON.parse(listArgs.aggregation);
    } catch (e) {}

    return await DBQueryClient.get(
      source.type as unknown as ClientType,
    ).aggregate(context, { model, view, source, args: listArgs });
  }

  // todo: Handle the error case where view doesnt belong to model
  async groupedDataList(
    context: NcContext,
    param: {
      sharedViewUuid: string;
      password?: string;
      query: any;
      groupColumnId: string;
    },
  ) {
    const view = await View.getByUUID(context, param.sharedViewUuid);

    if (!view) NcError.viewNotFound(param.sharedViewUuid);

    if (
      view.type !== ViewTypes.GRID &&
      view.type !== ViewTypes.KANBAN &&
      view.type !== ViewTypes.GALLERY
    ) {
      NcError.notFound('Not found');
    }

    const base = await Base.get(context, view.base_id);

    this.publicMetasService.checkViewBaseType(view, base);

    if (!(await View.verifyPassword(view, param.password))) {
      return NcError.invalidSharedViewPassword();
    }

    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id,
    });

    if (!model) NcError.get(context).tableNotFound(view.fk_model_id);

    return await this.getGroupedDataList(context, {
      model,
      view,
      query: param.query,
      groupColumnId: param.groupColumnId,
    });
  }

  async getGroupedDataList(
    context: NcContext,
    param: {
      model: Model;
      view: View;
      query: any;
      groupColumnId: string;
    },
  ) {
    const { model, view, query = {}, groupColumnId } = param;

    // Group keys ARE the column's distinct values — reject rather than strip
    // (see `assertSharedViewGroupByColumn`).
    if (isSharedViewAccess(context)) {
      const exposedColumnIds = await getViewExposedColumnIds(context, {
        model,
        view,
      });
      if (groupColumnId && !exposedColumnIds.has(groupColumnId)) {
        NcError.get(context).badRequest(
          'Column not accessible in this shared view',
        );
      }
    }

    // No-op off the shared-view access source — see the DESIGN NOTE.
    await restrictSharedViewQuery(context, { model, view, query });

    const source = await Source.get(context, param.model.source_id);

    const base = await Base.get(context, view.base_id);

    this.publicMetasService.checkViewBaseType(view, base);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // `getHiddenColumn=true` would otherwise bypass `allowedCols` and emit every
    // non-system column's VALUES on this grouped endpoint.
    const { ast } = await getAst(context, {
      model,
      query: sanitizePublicQuery(param.query),
      view,
      includeRowColorColumns: query.include_row_color === 'true',
    });

    const listArgs: any = { ...query };
    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}
    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}
    try {
      listArgs.options = JSON.parse(listArgs.optionsArrJson);
    } catch (e) {}

    let data = [];

    try {
      const groupedData = await baseModel.groupedList({
        ...listArgs,
        groupColumnId,
      });
      data = await nocoExecute(
        { key: 1, value: ast },
        groupedData,
        {},
        listArgs,
      );
      const countArr = await baseModel.groupedListCount({
        ...listArgs,
        groupColumnId,
      });
      data = data.map((item) => {
        // todo: use map to avoid loop
        const count =
          countArr.find((countItem: any) => countItem.key === item.key)
            ?.count ?? 0;

        item.value = new PagedResponseImpl(item.value, {
          ...query,
          count: count,
        });
        return item;
      });
    } catch (e) {
      console.log(e);
      NcError.internalServerError('Please check server log for more details');
    }
    return data;
  }

  async dataGroupByCount(
    context: NcContext,
    param: {
      sharedViewUuid: string;
      password?: string;
      query: any;
    },
  ) {
    const view = await View.getByUUID(context, param.sharedViewUuid);

    if (!view) NcError.viewNotFound(param.sharedViewUuid);

    if (
      view.type !== ViewTypes.GRID &&
      view.type !== ViewTypes.TIMELINE &&
      view.type !== ViewTypes.GANTT
    ) {
      NcError.notFound('Not found');
    }

    if (!(await View.verifyPassword(view, param.password))) {
      return NcError.invalidSharedViewPassword();
    }

    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id,
    });

    if (!model) NcError.get(context).tableNotFound(view.fk_model_id);

    return await this.getDataGroupByCount(context, {
      model,
      view,
      query: param.query,
    });
  }

  async dataGroupBy(
    context: NcContext,
    param: {
      sharedViewUuid: string;
      password?: string;
      query: any;
    },
  ) {
    const view = await View.getByUUID(context, param.sharedViewUuid);

    if (!view) NcError.viewNotFound(param.sharedViewUuid);

    if (
      view.type !== ViewTypes.GRID &&
      view.type !== ViewTypes.TIMELINE &&
      view.type !== ViewTypes.GANTT
    ) {
      NcError.notFound('Not found');
    }

    const base = await Base.get(context, view.base_id);

    this.publicMetasService.checkViewBaseType(view, base);

    if (!(await View.verifyPassword(view, param.password))) {
      return NcError.invalidSharedViewPassword();
    }

    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id,
    });

    if (!model) NcError.get(context).tableNotFound(view.fk_model_id);

    return await this.getDataGroupBy(context, {
      model,
      view,
      query: param.query,
    });
  }

  /**
   * The `/groupby` routes name their target as a `column_name` in the query, and
   * group keys ARE that column's distinct values — direct value disclosure. A
   * group-by with its column removed has no meaningful degraded form, so this one
   * is rejected with a reason rather than stripped.
   */
  protected async assertSharedViewGroupByColumn(
    context: NcContext,
    param: { model: Model; view: View; query?: any },
  ) {
    if (!isSharedViewAccess(context)) return;

    const { rejected } = await restrictSharedViewColumnReferences(context, {
      model: param.model,
      view: param.view,
      query: param.query ?? {},
    });

    if (rejected.length) {
      NcError.get(context).badRequest(
        'Column not accessible in this shared view',
      );
    }
  }

  async getDataGroupByCount(
    context: NcContext,
    param: { model: Model; view: View; query?: any },
  ) {
    const { model, view, query = {} } = param;

    const base = await Base.get(context, view.base_id);

    this.publicMetasService.checkViewBaseType(view, base);

    // No-op off the shared-view access source — see the DESIGN NOTE.
    await restrictSharedViewQuery(context, { model, view, query });
    await this.assertSharedViewGroupByColumn(context, { model, view, query });

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const listArgs: any = { ...query };

    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {
      listArgs.filterArr = ncIsArray(listArgs?.filterArrJson)
        ? listArgs?.filterArrJson
        : null;
    }

    return await baseModel.groupByCount(listArgs);
  }

  async getDataGroupBy(
    context: NcContext,
    param: { model: Model; view: View; query?: any },
  ) {
    try {
      const { model, view, query = {} } = param;

      const base = await Base.get(context, view.base_id);

      this.publicMetasService.checkViewBaseType(view, base);

      // No-op off the shared-view access source — see the DESIGN NOTE.
      await restrictSharedViewQuery(context, { model, view, query });
      await this.assertSharedViewGroupByColumn(context, { model, view, query });

      const source = await Source.get(context, model.source_id);

      const baseModel = await Model.getBaseModelSQL(context, {
        id: model.id,
        viewId: view?.id,
        dbDriver: await NcConnectionMgrv2.get(source),
        source,
      });

      const listArgs: any = { ...query };

      try {
        listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
      } catch (e) {
        listArgs.filterArr = ncIsArray(listArgs?.filterArrJson)
          ? listArgs?.filterArrJson
          : null;
      }
      try {
        listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
      } catch (e) {
        listArgs.sortArr = ncIsArray(listArgs?.sortArrJson)
          ? listArgs?.sortArrJson
          : null;
      }

      const data = await baseModel.groupBy(listArgs);
      const count = await baseModel.groupByCount(listArgs);

      return new PagedResponseImpl(data, {
        ...query,
        count,
      });
    } catch (e) {
      // The shared-view column guard below throws a deliberate 4xx; the
      // catch-all would otherwise report it as a server error.
      if (e instanceof NcError || e instanceof NcBaseError) throw e;
      console.log(e);
      NcError.internalServerError('Please check server log for more details');
    }
  }

  async dataInsert(
    context: NcContext,
    param: {
      sharedViewUuid: string;
      password?: string;
      body: any;
      files: any[];
      siteUrl: string;
      req: NcRequest;
    },
  ) {
    const view = await View.getByUUID(context, param.sharedViewUuid);

    if (!view) NcError.viewNotFound(param.sharedViewUuid);
    if (view.type !== ViewTypes.FORM) NcError.notFound();

    const base = await Base.get(context, view.base_id);

    this.publicMetasService.checkViewBaseType(view, base);

    if (!(await View.verifyPassword(view, param.password))) {
      return NcError.invalidSharedViewPassword();
    }

    // Check if form has started / expired
    await FormView.validateFormScheduling(context, view.id);

    // Public form submissions are unauthenticated by design (the public
    // controller runs no GlobalGuard), so req.user is empty and the resulting
    // DATA_INSERT / nested DATA_LINK audits would have a NULL actor. Attribute
    // them to the anonymous service user and stamp the shared view/form id so
    // the submission stays traceable.
    if (!param.req.user?.id) {
      param.req.user = {
        ...NOCO_SERVICE_USERS[ServiceUserType.ANONYMOUS_USER],
      } as NcRequest['user'];
    }
    param.req.ncSharedViewId = view.id;

    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id,
    });

    if (!model) NcError.get(context).tableNotFound(view.fk_model_id);

    const source = await Source.get(context, model.source_id);

    if (source?.is_data_readonly) {
      NcError.sourceDataReadOnly(source.alias);
    }

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    await view.getViewWithInfo(context);
    await view.getColumns(context);
    await view.getModelWithInfo(context);
    await view.model.getColumns(context);

    const fields = (view.model.columns = view.columns
      .filter((c) => c.show && view.model.columnsById[c.fk_column_id])
      .reduce((o, c) => {
        o[view.model.columnsById[c.fk_column_id].title] = new Column({
          ...c,
          ...view.model.columnsById[c.fk_column_id],
        } as any);
        return o;
      }, {}) as any);

    let body = param?.body;

    if (typeof body === 'string') body = JSON.parse(body);

    // A public form submission may arrive without a `data` field (e.g. an
    // attachment-only submission where the fields are sent as files, or an
    // empty body). In that case `body` is null/undefined and Object.entries
    // would throw "Cannot convert undefined or null to object". Default to an
    // empty object so the submission still proceeds via the attachment/nested
    // link handling below.
    if (!body || typeof body !== 'object') body = {};

    const insertObject = Object.entries(body).reduce((obj, [key, val]) => {
      if (key in fields) {
        obj[key] = val;
      }
      return obj;
    }, {});

    const attachments = {};

    for (const file of param.files || []) {
      // remove `_` prefix and `[]` suffix
      const fieldName = Buffer.from(file?.fieldname || '', 'binary')
        .toString('utf-8')
        .replace(/^_|\[\d*]$/g, '');

      if (
        fieldName in fields &&
        fields[fieldName].uidt === UITypes.Attachment
      ) {
        attachments[fieldName] = attachments[fieldName] || [];

        attachments[fieldName].push(
          ...(await this.attachmentsService.upload({
            files: [file],
            req: param.req,
          })),
        );
      }
    }

    // filter the uploadByUrl attachments
    const uploadByUrlAttachments = [];
    for (const [column, data] of Object.entries(insertObject)) {
      if (fields[column].uidt === UITypes.Attachment && Array.isArray(data)) {
        data.forEach((file, uploadIndex) => {
          if (file?.url && !file?.file) {
            uploadByUrlAttachments.push({
              ...file,
              fieldName: column,
              uploadIndex,
            });
          }
        });
      }
    }

    for (const file of uploadByUrlAttachments) {
      attachments[file.fieldName] = attachments[file.fieldName] || [];

      attachments[file.fieldName].unshift(
        ...(await this.attachmentsService.uploadViaURL({
          urls: [file.url],
          req: param.req,
        })),
      );
    }

    for (const [column, data] of Object.entries(attachments)) {
      insertObject[column] = JSON.stringify(data);
    }

    return await baseModel.nestedInsert(insertObject, param.req, null);
  }

  async relDataList(
    context: NcContext,
    param: {
      query: any;
      sharedViewUuid: string;
      password?: string;
      columnId: string;
      rowData: Record<string, any>;
    },
  ) {
    const view = await View.getByUUID(context, param.sharedViewUuid);

    if (!view) NcError.viewNotFound(param.sharedViewUuid);

    if (view.type !== ViewTypes.FORM && view.type !== ViewTypes.GALLERY) {
      NcError.notFound('Not found');
    }

    const base = await Base.get(context, view.base_id);

    this.publicMetasService.checkViewBaseType(view, base);
    if (!(await View.verifyPassword(view, param.password))) {
      NcError.invalidSharedViewPassword();
    }

    const column = await Column.get(context, { colId: param.columnId });

    if (!column) NcError.get(context).fieldNotFound(param.columnId);

    const currentModel = await view.getModel(context);

    // A shared view can outlive its table: trashing a table soft-deletes only
    // the model row (Model.softDelete), leaving the view + its share UUID intact.
    // View.getByUUID still resolves, but view.getModel returns null for the
    // soft-deleted model — guard before dereferencing.
    if (!currentModel) NcError.get(context).tableNotFound(view.fk_model_id);

    if (column.fk_model_id !== currentModel.id)
      NcError.badRequest("Column doesn't belongs to the model");

    // Block access to relation columns hidden from the shared view so the
    // /nested/ endpoint can't be used to read links the view owner stripped.
    const viewColumns = await View.getColumns(context, view.id);
    const isVisible = viewColumns.some(
      (vc) => vc.fk_column_id === column.id && vc.show,
    );
    if (!isVisible) {
      NcError.badRequest('Column not accessible in this shared view');
    }

    await currentModel.getColumns(context);

    if (!isLinksOrLTAR(column))
      NcError.get(context).badRequest('Column is not a relation column');

    const colOptions = await assertLinkColOptions(context, column);

    const model = await colOptions.getRelatedTable(context);

    // Related table may have been trashed (soft-deleted) while the link column
    // still references it — fail cleanly instead of dereferencing null below.
    if (!model)
      NcError.get(context).tableNotFound(colOptions.fk_related_model_id);

    // Use refContext for cross-base links — the related table may belong
    // to a different base, so Source.get scoped to the original context
    // would return undefined.
    const { refContext } = colOptions.getRelContext(context);

    const source = await Source.get(refContext, model.source_id);

    const baseModel = await Model.getBaseModelSQL(refContext, {
      id: model.id,
      viewId: colOptions.fk_target_view_id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // `extractOnlyPrimaries` below limits the SELECT to pk/pv/display, but the
    // predicate is still compiled against the related table's FULL column set —
    // a one-bit oracle per non-exposed column, plus `sort` as a reordering
    // channel. `/mm/` and `/hm/` already strip; this picker route didn't.
    await restrictNestedLinkQueryForColumn(context, column, param.query);

    // `extractOnlyPrimaries` already restricts this AST to pk/pv/display, but
    // strip getHiddenColumn/nested here too — every public getAst call site does.
    const { ast, dependencyFields } = await getAst(refContext, {
      query: sanitizePublicQuery(param.query),
      model,
      extractOnlyPrimaries: true,
      fk_display_value_column_id: (colOptions as any)
        .fk_display_value_column_id,
    });

    const listArgs: DependantFields & {
      filterArr?: Filter[];
      filterArrJson?: string;
    } = dependencyFields;

    try {
      if (listArgs.filterArrJson)
        listArgs.filterArr = JSON.parse(listArgs.filterArrJson) as Filter[];
    } catch (e) {}

    if (view.type === ViewTypes.FORM && ncIsArray(param.query?.fields)) {
      // A shared form's picker legitimately asks for extra related-table fields
      // (dropdown labels, lookup targets behind "show on conditions"), so honour
      // only what the share exposes: pk, pv, the link's custom display column,
      // and the far-side targets of lookups/rollups VISIBLE on this form.
      // Anything wider makes `?fields=` an arbitrary read of the unpublished
      // related table, defeating `extractOnlyPrimaries` on the same response.
      const exposedRelatedColumnIds = new Set<string>(
        model.columns.filter((c) => c.pk || c.pv).map((c) => c.id),
      );
      if (colOptions.fk_display_value_column_id) {
        exposedRelatedColumnIds.add(colOptions.fk_display_value_column_id);
      }
      for (const id of collectRelatedNeededColumnIds(
        currentModel.columns.filter((c) =>
          viewColumns.some((vc) => vc.fk_column_id === c.id && vc.show),
        ),
      )) {
        exposedRelatedColumnIds.add(id);
      }

      for (const f of param.query.fields) {
        // fields can be column IDs or titles, but AST uses titles as keys
        // (getAst with extractOnlyPrimaries returns early with title-keyed AST).
        // Resolve to title so nocoExecute can match against data objects.
        const col = model.columns.find((c) => c.id === f || c.title === f);
        if (!col || !exposedRelatedColumnIds.has(col.id)) continue;

        listArgs.fieldsSet.add(f);
        if (ast[col.title] === undefined) {
          ast[col.title] = 1;
        }
      }
    }

    let data = [];

    let count = 0;

    try {
      const customConditions = await replaceDynamicFieldWithValue(
        param.rowData || {},
        null,
        currentModel.columns,
        baseModel.readByPk,
      )(
        (column.meta?.enableConditions
          ? await Filter.rootFilterListByLink(context, {
              columnId: param.columnId,
            })
          : []) || [],
      );

      data = data = await nocoExecute(
        ast,
        await baseModel.list({
          ...listArgs,
          customConditions,
        }),
        {},
        listArgs,
      );
      count = await baseModel.count({
        ...listArgs,
        customConditions,
      } as any);
    } catch (e) {
      console.log(e);
      NcError.internalServerError('Please check server log for more details');
    }

    return new PagedResponseImpl(data, { ...param.query, count });
  }

  async publicMmList(
    context: NcContext,
    param: {
      query: any;
      sharedViewUuid: string;
      password?: string;
      columnId: string;
      rowId: string;
    },
  ) {
    const view = await View.getByUUID(context, param.sharedViewUuid);

    if (!view) NcError.viewNotFound(param.sharedViewUuid);

    if (view.type === ViewTypes.FORM) NcError.notFound('Not found');

    const base = await Base.get(context, view.base_id);

    this.publicMetasService.checkViewBaseType(view, base);
    if (!(await View.verifyPassword(view, param.password))) {
      NcError.invalidSharedViewPassword();
    }

    const currentModel = await view.getModel(context);

    // Shared view can outlive its table (see relDataList) — a trashed table
    // soft-deletes only the model row, so getModel returns null here.
    if (!currentModel) NcError.get(context).tableNotFound(view.fk_model_id);

    const column = await getColumnByIdOrName(
      context,
      param.columnId,
      currentModel,
    );

    if (column.fk_model_id !== view.fk_model_id)
      NcError.badRequest("Column doesn't belongs to the model");

    // Block access to relation columns hidden from the shared view so the
    // /mm/ endpoint can't be used to read links the view owner stripped.
    const viewColumns = await View.getColumns(context, view.id);
    const isVisible = viewColumns.some(
      (vc) => vc.fk_column_id === column.id && vc.show,
    );
    if (!isVisible) {
      NcError.badRequest('Column not accessible in this shared view');
    }

    const source = await Source.get(context, view.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: view.fk_model_id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // Verify parent row is visible in the shared view before fetching relations
    // — a filtered-out row must not be visible for its relations either.
    const parentRow = await baseModel.readByPk(
      param.rowId,
      false,
      {},
      {
        applyViewFilters: true,
      },
    );
    if (!parentRow) {
      NcError.recordNotFound(param.rowId);
    }

    // Strip caller-supplied where/sort references to columns the link doesn't
    // expose (cross-base / visibility-limited related tables — NOT the view-`show`
    // dimension, which stays queryable). The shared-view /mm/ fetch is
    // `pkAndPvOnly`-restricted, so an unsanitized predicate on a non-exposed
    // related column is the same one-bit oracle the authenticated paths close.
    // Mutates `param.query`, which both the data fetch and the count read from.
    await restrictNestedLinkQueryForColumn(context, column, param.query);

    const key = `List`;
    const requestObj: any = {
      [key]: 1,
    };

    const data = (
      await nocoExecute(
        requestObj,
        {
          [key]: async (args) => {
            return await baseModel.mmList(
              {
                colId: param.columnId,
                parentId: param.rowId,
              },
              args,
            );
          },
        },
        {},

        { nested: { [key]: param.query } },
      )
    )?.[key];

    const count: any = await baseModel.mmListCount(
      {
        colId: param.columnId,
        parentId: param.rowId,
      },
      param.query,
    );

    return new PagedResponseImpl(data, { ...param.query, count });
  }

  async publicHmList(
    context: NcContext,
    param: {
      query: any;
      rowId: string;
      sharedViewUuid: string;
      password?: string;
      columnId: string;
    },
  ) {
    const view = await View.getByUUID(context, param.sharedViewUuid);

    if (!view) NcError.viewNotFound(param.sharedViewUuid);

    if (view.type === ViewTypes.FORM) NcError.notFound('Not found');

    const base = await Base.get(context, view.base_id);

    this.publicMetasService.checkViewBaseType(view, base);
    if (!(await View.verifyPassword(view, param.password))) {
      NcError.invalidSharedViewPassword();
    }

    const currentModel = await view.getModel(context);

    // Shared view can outlive its table (see relDataList) — a trashed table
    // soft-deletes only the model row, so getModel returns null here.
    if (!currentModel) NcError.get(context).tableNotFound(view.fk_model_id);

    const column = await getColumnByIdOrName(
      context,
      param.columnId,
      currentModel,
    );

    if (column.fk_model_id !== view.fk_model_id)
      NcError.badRequest("Column doesn't belongs to the model");

    // Block access to relation columns hidden from the shared view so the
    // /hm/ endpoint can't be used to read links the view owner stripped.
    const viewColumns = await View.getColumns(context, view.id);
    const isVisible = viewColumns.some(
      (vc) => vc.fk_column_id === column.id && vc.show,
    );
    if (!isVisible) {
      NcError.badRequest('Column not accessible in this shared view');
    }

    const source = await Source.get(context, view.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: view.fk_model_id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // Verify parent row is visible in the shared view before fetching relations
    // — a filtered-out row must not be visible for its relations either.
    const parentRow = await baseModel.readByPk(
      param.rowId,
      false,
      {},
      {
        applyViewFilters: true,
      },
    );
    if (!parentRow) {
      NcError.recordNotFound(param.rowId);
    }

    // Strip caller-supplied where/sort references to columns the link doesn't
    // expose (cross-base / visibility-limited related tables — NOT the view-`show`
    // dimension, which stays queryable). The shared-view /hm/ fetch is
    // `pkAndPvOnly`-restricted, so an unsanitized predicate on a non-exposed
    // related column is the same one-bit oracle the authenticated paths close.
    // Mutates `param.query`, which both the data fetch and the count read from.
    await restrictNestedLinkQueryForColumn(context, column, param.query);

    const key = `List`;
    const requestObj: any = {
      [key]: 1,
    };

    const data = (
      await nocoExecute(
        requestObj,
        {
          [key]: async (args) => {
            return await baseModel.hmList(
              {
                colId: param.columnId,
                id: param.rowId,
              },
              args,
            );
          },
        },
        {},
        { nested: { [key]: param.query } },
      )
    )?.[key];

    const count = await baseModel.hmListCount(
      {
        colId: param.columnId,
        id: param.rowId,
      },
      param.query,
    );

    return new PagedResponseImpl(data, { ...param.query, count });
  }

  async dataRead(
    context: NcContext,
    param: {
      sharedViewUuid: string;
      rowId: string;
      password?: string;
      query: any;
    },
  ) {
    const { sharedViewUuid, rowId, password } = param;
    // Strip response-shape keys so an anonymous caller cannot force hidden
    // values into the single-record payload.
    const query = sanitizePublicQuery(param.query ?? {});
    const view = await View.getByUUID(context, sharedViewUuid);

    if (!view) NcError.viewNotFound(sharedViewUuid);

    if (view.type === ViewTypes.FORM) NcError.notFound('Not found');

    const base = await Base.get(context, view.base_id);

    this.publicMetasService.checkViewBaseType(view, base);
    if (!(await View.verifyPassword(view, password))) {
      return NcError.invalidSharedViewPassword();
    }

    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id,
    });

    if (!model) NcError.get(context).tableNotFound(view.fk_model_id);

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // Powers both the public single-record read and the public
    // attachment-download route, which use this as their visibility check.
    const row = await baseModel.readByPk(rowId, false, query, {
      applyViewFilters: true,
    });

    if (!row) {
      NcError.recordNotFound(param.rowId);
    }

    return row;
  }

  async bulkDataList(
    context: NcContext,
    param: {
      sharedViewUuid: string;
      password?: string;
      query: any;
      body?: any;
    },
  ) {
    const view = await View.getByUUID(context, param.sharedViewUuid);

    if (!view) NcError.viewNotFound(param.sharedViewUuid);

    if (view.type !== ViewTypes.GRID) {
      NcError.notFound('Not found');
    }

    const base = await Base.get(context, view.base_id);

    this.publicMetasService.checkViewBaseType(view, base);
    if (!(await View.verifyPassword(view, param.password))) {
      return NcError.invalidSharedViewPassword();
    }

    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id,
    });

    if (!model) NcError.get(context).tableNotFound(view.fk_model_id);

    // One view, N query objects — resolve the exposed-column set once.
    const scope = isSharedViewAccess(context)
      ? await resolveSharedViewQueryScope(context, { model, view })
      : undefined;

    // No-op off the shared-view access source — see the DESIGN NOTE.
    await restrictSharedViewQuery(context, {
      model,
      view,
      query: param.query,
      scope,
    });

    const listArgs: any = { ...param.query };

    let bulkFilterList = param.body;

    try {
      bulkFilterList = JSON.parse(bulkFilterList);
    } catch (e) {}

    // Before the per-entry loop below — that loop is itself per-entry work.
    assertBulkFilterListWithinLimit(bulkFilterList);

    // Each bulk entry is its own query object against the same model, so each
    // needs the same confinement as a single `dataList` call.
    for (const entry of ncIsArray(bulkFilterList) ? bulkFilterList : []) {
      await restrictSharedViewQuery(context, {
        model,
        view,
        query: entry,
        scope,
      });
    }

    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}

    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}

    const dataListResults = await bulkFilterList.reduce(
      async (accPromise, dF: any) => {
        const acc = await accPromise;

        const result = await this.datasService.dataList(context, {
          // each caller-supplied filter object is a query — sanitize per element
          query: sanitizePublicQuery(dF),
          model,
          view,
        });
        acc[dF.alias] = result;
        return acc;
      },
      Promise.resolve({}),
    );

    return dataListResults;
  }

  async bulkAggregate(
    context: NcContext,
    param: {
      sharedViewUuid: string;
      password?: string;
      query: any;
      body: any;
    },
  ) {
    const view = await View.getByUUID(context, param.sharedViewUuid);

    if (!view) NcError.viewNotFound(param.sharedViewUuid);

    if (view.type !== ViewTypes.GRID) {
      NcError.notFound('Not found');
    }

    const base = await Base.get(context, view.base_id);

    this.publicMetasService.checkViewBaseType(view, base);

    if (!(await View.verifyPassword(view, param.password))) {
      return NcError.invalidSharedViewPassword();
    }

    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id,
    });

    if (!model) NcError.get(context).tableNotFound(view.fk_model_id);

    let bulkFilterList = param.body;

    // One view, N query objects — resolve the exposed-column set once.
    const scope = isSharedViewAccess(context)
      ? await resolveSharedViewQueryScope(context, { model, view })
      : undefined;

    // No-op off the shared-view access source — see the DESIGN NOTE.
    await restrictSharedViewQuery(context, {
      model,
      view,
      query: param.query,
      scope,
    });
    await restrictSharedViewColumnReferences(context, {
      model,
      view,
      query: param.query,
      scope,
    });

    // Strip response-shape keys from the public query.
    const listArgs: any = sanitizePublicQuery({ ...param.query });

    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}

    try {
      listArgs.aggregation = JSON.parse(listArgs.aggregation);
    } catch (e) {}

    try {
      bulkFilterList = JSON.parse(bulkFilterList);
    } catch (e) {}

    // Before the per-entry work below (sanitize + confinement + one aggregate each).
    assertBulkFilterListWithinLimit(bulkFilterList);

    // each caller-supplied filter object is a query — sanitize per element too.
    // Must run before the confinement below: sanitizing replaces each entry with
    // a copy, and `restrictSharedView*` mutates the object it is handed.
    if (Array.isArray(bulkFilterList)) {
      bulkFilterList = bulkFilterList.map((dF: any) => sanitizePublicQuery(dF));
    }

    // Every bulk entry is its own query object compiled against the same model,
    // so each needs the same confinement as a single `dataAggregate` call.
    for (const entry of ncIsArray(bulkFilterList) ? bulkFilterList : []) {
      await restrictSharedViewQuery(context, {
        model,
        view,
        query: entry,
        scope,
      });
      await restrictSharedViewColumnReferences(context, {
        model,
        view,
        query: entry,
        scope,
      });
    }

    const source = await Source.get(context, model.source_id);

    return await DBQueryClient.get(
      source.type as unknown as ClientType,
    ).bulkAggregate(context, {
      model,
      view,
      source,
      args: listArgs,
      bulkFilterList,
    });
  }
}
