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
import type { LinkToAnotherRecordColumn } from '~/models';
import type { NcContext } from '~/interface/config';
import type { DependantFields } from '~/helpers/getAst';
import { DBQueryClient } from '~/dbQueryClient';
import { nocoExecute } from '~/utils';
import { Base, Column, FormView, Model, Source, View } from '~/models';
import { NcError } from '~/helpers/catchError';
import getAst from '~/helpers/getAst';
import { sanitizePublicQuery } from '~/helpers/publicQuerySanitizer';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { getColumnByIdOrName } from '~/helpers/dataHelpers';
import { restrictNestedLinkQueryForColumn } from '~/helpers/nestedLinkQueryHelpers';
import { parseFilterArrJson } from '~/helpers/filterArrJsonHelper';
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

// Response-shape keys that must never be controllable by public/shared-view
// callers. `getHiddenColumn` bypasses the getAst `allowedCols` gate and would
// emit every non-system column's VALUES; `nested` drives caller-controlled
// nested-LTAR expansion. Stripping these keeps hidden columns out of the
// default response payload — see the DESIGN NOTE below, boundary (1).
// Re-exported from a dependency-light helper so calendar/other public services
// can strip the same keys without importing this heavy service graph, and so
// the logic stays unit-testable in isolation.
export {
  PUBLIC_QUERY_BLOCKED_KEYS,
  sanitizePublicQuery,
} from '~/helpers/publicQuerySanitizer';

/**
 * DESIGN NOTE — view-hidden columns are intentionally queryable.
 *
 * A column being hidden in a view (its view-column `show = false`) is a
 * display/layout preference, NOT a column-level access-control boundary.
 * Column-level access is governed separately by FIELD VISIBILITY — that is
 * the real ACL. So the public/shared-view and nested-link data endpoints
 * DELIBERATELY do not strip or reject caller-supplied
 * `where` / `sort` / `filter` / `groupBy` / `fields` / `aggregation`
 * references just because they point at a column that is hidden in the view.
 *
 * Do NOT re-introduce "hidden-in-view query sanitization" — the gate keyed on
 * view-column `show` (previously tracked as CVE-2026-47378 / CVE-2026-47279 /
 * GHSA-qqxm-7cj9-5fr2). It was removed on purpose: the team's position is that
 * "hidden in view" does not mean "confidential". A view-hidden column turning
 * up as filterable/sortable is expected behaviour, not a CWE-200 oracle.
 * Enforce confidentiality with field visibility, not view `show`.
 *
 * TWO separate boundaries this reversal does NOT touch — keep them enforced:
 *
 *  1. Response-shape gate. The caller-supplied `getHiddenColumn` / `nested`
 *     keys are still stripped from public/shared-view queries before they
 *     reach getAst (`sanitizePublicQuery`). `getHiddenColumn` bypasses the
 *     getAst `allowedCols` gate and would emit every non-system column's
 *     VALUES to an anonymous caller — that is payload exfiltration, not
 *     "queryable". Hidden columns remain omitted from the default response
 *     payload; they are simply queryable via where/sort/filter/groupBy.
 *
 *  2. Cross-base / no-visibility-access related tables. Nested-link where/sort
 *     is still restricted to the link's exposed (pk/pv/display) columns via
 *     `restrictNestedLinkQuery*` when the related table lives in another base
 *     or the caller has no visibility access to it at all. That is a genuine
 *     access boundary (cross-base isolation + table-visibility ACL), distinct
 *     from "hidden in this view", so it stays enforced across
 *     datas.service / data-alias-nested / data-table / the public nested-link
 *     endpoints.
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

    // ACK (public group-by surface, intentional): `groupColumnId` is no longer
    // validated against the view's visible columns — grouping by a view-hidden
    // column is allowed, consistent with the DESIGN NOTE (view `show` is a
    // display preference, not a column ACL). Confidentiality is enforced by
    // field visibility; hidden column VALUES are still never emitted because
    // `getHiddenColumn`/`nested` are stripped before the AST is built (below).
    const source = await Source.get(context, param.model.source_id);

    const base = await Base.get(context, view.base_id);

    this.publicMetasService.checkViewBaseType(view, base);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // Strip getHiddenColumn/nested before building the AST — this is the
    // response-shape boundary (see DESIGN NOTE #1). `getHiddenColumn=true`
    // would otherwise bypass the `allowedCols` gate and emit every non-system
    // column's VALUES to an anonymous caller on this grouped endpoint. The
    // where/sort/filter relaxation for view-hidden columns is unaffected.
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

  async getDataGroupByCount(
    context: NcContext,
    param: { model: Model; view: View; query?: any },
  ) {
    const { model, view, query = {} } = param;

    // ACK (public group-by surface, intentional): the group-by `column_name` is
    // no longer validated against the view's visible columns — grouping by a
    // view-hidden column is allowed, consistent with the DESIGN NOTE (view
    // `show` is not a column ACL). Field visibility remains the confidentiality
    // boundary.
    const base = await Base.get(context, view.base_id);

    this.publicMetasService.checkViewBaseType(view, base);

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

      // ACK (public group-by surface, intentional): the group-by `column_name`
      // is no longer validated against the view's visible columns — grouping by
      // a view-hidden column is allowed, consistent with the DESIGN NOTE (view
      // `show` is not a column ACL). Field visibility remains the
      // confidentiality boundary.
      const base = await Base.get(context, view.base_id);

      this.publicMetasService.checkViewBaseType(view, base);

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

    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>(
      context,
    );

    if (!colOptions)
      NcError.get(context).badRequest('Relation column metadata is missing');

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

    // `extractOnlyPrimaries` already restricts this AST to pk/pv/display, but
    // strip getHiddenColumn/nested too so the response-shape boundary (DESIGN
    // NOTE #1) holds uniformly across every public getAst call site.
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
      param.query.fields.forEach(listArgs.fieldsSet.add, listArgs.fieldsSet);

      param.query.fields.forEach((f) => {
        // fields can be column IDs or titles, but AST uses titles as keys
        // (getAst with extractOnlyPrimaries returns early with title-keyed AST).
        // Resolve to title so nocoExecute can match against data objects.
        const col = model.columns.find((c) => c.id === f || c.title === f);
        const key = col?.title ?? f;
        if (ast[key] === undefined) {
          ast[key] = 1;
        }
      });
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

    const listArgs: any = { ...param.query };

    let bulkFilterList = param.body;

    try {
      bulkFilterList = JSON.parse(bulkFilterList);
    } catch (e) {}

    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}

    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}

    if (!bulkFilterList?.length) {
      NcError.badRequest('Invalid bulkFilterList');
    }

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

    // each caller-supplied filter object is a query — sanitize per element too
    if (Array.isArray(bulkFilterList)) {
      bulkFilterList = bulkFilterList.map((dF: any) => sanitizePublicQuery(dF));
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
