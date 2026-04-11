import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  extractFilterFromXwhere,
  NcBaseError,
  ncIsArray,
  UITypes,
  ViewTypes,
} from 'nocodb-sdk';
import type { NcRequest } from 'nocodb-sdk';
import type { GridViewColumn, LinkToAnotherRecordColumn } from '~/models';
import type { NcContext } from '~/interface/config';
import type { DependantFields } from '~/helpers/getAst';
import { nocoExecute } from '~/utils';
import { Base, Column, FormView, Model, Source, View } from '~/models';
import { NcError } from '~/helpers/catchError';
import getAst from '~/helpers/getAst';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { getColumnByIdOrName } from '~/helpers/dataHelpers';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { replaceDynamicFieldWithValue } from '~/helpers/dbHelpers';
import { Filter } from '~/models';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { DatasService } from '~/services/datas.service';
import { AttachmentsService } from '~/services/attachments.service';
import { PublicMetasService } from '~/services/public-metas.service';

interface VisibleColumnInfo {
  /** Set of Column.id values that are visible in the view */
  visibleColumnIds: Set<string>;
  /** Set of Column.title values that are visible */
  visibleColumnTitles: Set<string>;
  /** Set of Column.column_name values that are visible */
  visibleColumnNames: Set<string>;
  /** The actual Column objects for visible columns */
  visibleColumns: Column[];
  /** Set of Column.id values used in group-by (grid views only) */
  groupByColumnIds: Set<string>;
  /** Set of Column.title values used in group-by (grid views only) */
  groupByColumnTitles: Set<string>;
  /** Set of Column.column_name values used in group-by (grid views only) */
  groupByColumnNames: Set<string>;
  /** The actual Column objects for group-by columns (grid views only) */
  groupByColumns: Column[];
}

// todo: move to utils
export function sanitizeUrlPath(paths) {
  return paths.map((url) => url.replace(/[/.?#]+/g, '_'));
}

// Keys that must never be controllable by public/shared-view callers
const PUBLIC_QUERY_BLOCKED_KEYS = ['getHiddenColumn', 'nested'];

function sanitizePublicQuery<T extends Record<string, any>>(query: T): T {
  if (!query) return query;
  const sanitized = { ...query };
  for (const key of PUBLIC_QUERY_BLOCKED_KEYS) {
    delete sanitized[key];
  }
  return sanitized;
}

@Injectable()
export class PublicDatasService {
  constructor(
    protected datasService: DatasService,
    @Inject(forwardRef(() => 'JobsService'))
    protected readonly jobsService: IJobsService,
    protected readonly attachmentsService: AttachmentsService,
    protected readonly publicMetasService: PublicMetasService,
  ) {}

  /**
   * Returns the set of visible column IDs, titles, and column_names for a
   * shared view.  Used to enforce column-level access control on all public
   * endpoints so that hidden columns cannot be leaked via groupBy, filters,
   * sorts, aggregations, or WHERE clauses.
   */
  protected async getVisibleColumnInfo(
    context: NcContext,
    view: View,
    model: Model,
  ): Promise<VisibleColumnInfo> {
    const viewColumns = await View.getColumns(context, view.id);
    const visibleColumnIds = new Set<string>();
    const groupByColumnIds = new Set<string>();

    for (const vc of viewColumns) {
      if (vc.show) {
        visibleColumnIds.add(vc.fk_column_id);
      }

      if (view.type === ViewTypes.GRID && (vc as GridViewColumn).group_by) {
        groupByColumnIds.add(vc.fk_column_id);
      }
    }

    await model.getColumns(context);

    const visibleColumnTitles = new Set<string>();
    const visibleColumnNames = new Set<string>();
    const visibleColumns: Column[] = [];
    const groupByColumnTitles = new Set<string>();
    const groupByColumnNames = new Set<string>();
    const groupByColumns: Column[] = [];

    for (const col of model.columns) {
      if (visibleColumnIds.has(col.id)) {
        if (col.title) visibleColumnTitles.add(col.title);
        if (col.column_name) visibleColumnNames.add(col.column_name);
        visibleColumns.push(col);
      }

      if (groupByColumnIds.has(col.id)) {
        if (col.title) groupByColumnTitles.add(col.title);
        if (col.column_name) groupByColumnNames.add(col.column_name);
        groupByColumns.push(col);
      }
    }

    return {
      visibleColumnIds,
      visibleColumnTitles,
      visibleColumnNames,
      visibleColumns,
      groupByColumnIds,
      groupByColumnTitles,
      groupByColumnNames,
      groupByColumns,
    };
  }

  /**
   * Recursively removes filter entries that reference hidden columns.
   */
  protected stripHiddenColumnsFromFilters(
    filters: any[],
    visibleColumnIds: Set<string>,
  ): any[] {
    if (!ncIsArray(filters) || !filters.length) return filters;

    return filters
      .map((f) => {
        if (f.is_group && ncIsArray(f.children)) {
          return {
            ...f,
            children: this.stripHiddenColumnsFromFilters(
              f.children,
              visibleColumnIds,
            ),
          };
        }
        return f;
      })
      .filter((f) => {
        if (f.is_group && ncIsArray(f.children)) {
          return f.children.length > 0;
        }
        return !f.fk_column_id || visibleColumnIds.has(f.fk_column_id);
      });
  }

  /**
   * Removes sort entries that reference hidden columns.
   */
  protected stripHiddenColumnsFromSorts(
    sorts: any[],
    visibleColumnIds: Set<string>,
  ): any[] {
    if (!ncIsArray(sorts) || !sorts.length) return sorts;
    return sorts.filter(
      (s) => !s.fk_column_id || visibleColumnIds.has(s.fk_column_id),
    );
  }

  /**
   * Removes aggregation entries that reference hidden columns.
   */
  protected stripHiddenColumnsFromAggregation(
    aggregation: any[],
    visibleColumnIds: Set<string>,
  ): any[] {
    if (!ncIsArray(aggregation) || !aggregation.length) return aggregation;
    return aggregation.filter((a) => !a.field || visibleColumnIds.has(a.field));
  }

  /**
   * Validates that every column name in a comma-separated `column_name`
   * string is visible or used in group-by in the shared view.
   * Throws badRequest if any name references a hidden column.
   */
  protected validateGroupByColumnNames(
    context: NcContext,
    columnNameCsv: string,
    visibleInfo: VisibleColumnInfo,
  ): void {
    if (!columnNameCsv) return;
    const names = columnNameCsv.split(',').map((n) => n.trim());
    for (const name of names) {
      if (
        !visibleInfo.visibleColumnTitles.has(name) &&
        !visibleInfo.visibleColumnNames.has(name) &&
        !visibleInfo.groupByColumnTitles.has(name) &&
        !visibleInfo.groupByColumnNames.has(name)
      ) {
        NcError.get(context).badRequest(
          'Column not accessible in this shared view',
        );
      }
    }
  }

  /**
   * Validates that a groupColumnId is visible or used in group-by
   * in the shared view.
   */
  protected validateGroupColumnId(
    context: NcContext,
    groupColumnId: string,
    visibleColumnIds: Set<string>,
    groupByColumnIds: Set<string>,
  ): void {
    if (!groupColumnId) return;
    if (
      !visibleColumnIds.has(groupColumnId) &&
      !groupByColumnIds.has(groupColumnId)
    ) {
      NcError.get(context).badRequest(
        'Column not accessible in this shared view',
      );
    }
  }

  /**
   * Builds an alias-to-column map containing visible and group-by columns.
   * Same logic as Model.getAliasColObjMap but restricted to the given sets.
   */
  protected buildRestrictedAliasColObjMap(
    visibleInfo: VisibleColumnInfo,
  ): Record<string, Column> {
    const columns = [
      ...visibleInfo.visibleColumns,
      ...visibleInfo.groupByColumns,
    ];

    const idReduce = columns.reduce(
      (agg, c) => ({ ...agg, [c.id]: c }),
      {} as Record<string, Column>,
    );
    const colNameReduce = columns.reduce(
      (agg, c) => ({ ...agg, [c.column_name]: c }),
      idReduce,
    );
    return columns.reduce(
      (agg, c) => ({ ...agg, [c.title]: c }),
      colNameReduce,
    );
  }

  /**
   * Sanitizes all user-controlled query parameters for a public/shared-view
   * request, stripping references to hidden columns.
   *
   * - `where` is parsed with a restricted column map (visible only), merged
   *   into `filterArr`, then removed so BaseModel doesn't re-parse it
   * - `filterArr` entries referencing hidden columns are stripped
   * - `sortArr` entries referencing hidden columns are stripped
   */
  protected sanitizeListArgsForPublicView(
    context: NcContext,
    listArgs: any,
    visibleInfo: VisibleColumnInfo,
  ): void {
    // Strip keys that must never be controlled by public/shared-view callers
    // (e.g. getHiddenColumn, nested) — applies to both top-level listArgs and
    // inner bulkFilterList entries so the full attack surface is covered.
    for (const key of PUBLIC_QUERY_BLOCKED_KEYS) {
      delete listArgs[key];
    }

    // Parse `where` with a restricted alias map so only visible columns are
    // accepted.  The parsed filters are merged into filterArr and the raw
    // `where` string is deleted so BaseModel won't re-parse it with the
    // full (unrestricted) column set.
    if (listArgs.where) {
      const restrictedMap = this.buildRestrictedAliasColObjMap(visibleInfo);
      const { filters: parsedWhereFilters } = extractFilterFromXwhere(
        context,
        listArgs.where,
        restrictedMap,
        true,
      );
      if (parsedWhereFilters?.length) {
        listArgs.filterArr = [
          ...(listArgs.filterArr || []),
          ...parsedWhereFilters,
        ];
      }
      delete listArgs.where;
    }

    if (ncIsArray(listArgs.filterArr)) {
      listArgs.filterArr = this.stripHiddenColumnsFromFilters(
        listArgs.filterArr,
        visibleInfo.visibleColumnIds,
      );
    }

    if (ncIsArray(listArgs.sortArr)) {
      listArgs.sortArr = this.stripHiddenColumnsFromSorts(
        listArgs.sortArr,
        visibleInfo.visibleColumnIds,
      );
    }

    // Strip hidden columns from `fields` / `f` (comma-separated string or array)
    for (const key of ['fields', 'f']) {
      if (listArgs[key]) {
        const fieldsArr: string[] = Array.isArray(listArgs[key])
          ? listArgs[key]
          : listArgs[key].split(',');
        const sanitized = fieldsArr.filter(
          (f) =>
            visibleInfo.visibleColumnIds.has(f) ||
            visibleInfo.visibleColumnTitles.has(f) ||
            visibleInfo.visibleColumnNames.has(f),
        );
        listArgs[key] = Array.isArray(listArgs[key])
          ? sanitized
          : sanitized.join(',') || undefined;
      }
    }
  }

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
      view.type !== ViewTypes.TIMELINE
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

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const { ast, dependencyFields } = await getAst(context, {
      model,
      query: {},
      view,
      includeRowColorColumns: query.include_row_color === 'true',
    });

    const visibleInfo = await this.getVisibleColumnInfo(context, view, model);

    const listArgs: any = { ...query, ...dependencyFields };
    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}
    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}

    this.sanitizeListArgsForPublicView(context, listArgs, visibleInfo);

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
      view.type !== ViewTypes.TIMELINE
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

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const visibleInfo = await this.getVisibleColumnInfo(context, view, model);

    const countArgs: any = { ...param.query, throwErrorIfInvalidParams: true };
    try {
      countArgs.filterArr = JSON.parse(countArgs.filterArrJson);
    } catch (e) {}

    this.sanitizeListArgsForPublicView(context, countArgs, visibleInfo);

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

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const visibleInfo = await this.getVisibleColumnInfo(context, view, model);

    const listArgs: any = { ...param.query };

    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}

    try {
      listArgs.aggregation = JSON.parse(listArgs.aggregation);
    } catch (e) {}

    this.sanitizeListArgsForPublicView(context, listArgs, visibleInfo);

    if (ncIsArray(listArgs.aggregation)) {
      listArgs.aggregation = this.stripHiddenColumnsFromAggregation(
        listArgs.aggregation,
        visibleInfo.visibleColumnIds,
      );
    }

    return await baseModel.aggregate(listArgs, view);
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
    const source = await Source.get(context, param.model.source_id);

    const base = await Base.get(context, view.base_id);

    this.publicMetasService.checkViewBaseType(view, base);

    const visibleInfo = await this.getVisibleColumnInfo(context, view, model);

    this.validateGroupColumnId(
      context,
      groupColumnId,
      visibleInfo.visibleColumnIds,
      visibleInfo.groupByColumnIds,
    );

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

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

    this.sanitizeListArgsForPublicView(context, listArgs, visibleInfo);

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

    if (view.type !== ViewTypes.GRID) {
      NcError.notFound('Not found');
    }

    if (!(await View.verifyPassword(view, param.password))) {
      return NcError.invalidSharedViewPassword();
    }

    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id,
    });

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

    const base = await Base.get(context, view.base_id);

    this.publicMetasService.checkViewBaseType(view, base);

    const visibleInfo = await this.getVisibleColumnInfo(context, view, model);

    if (query.column_name) {
      this.validateGroupByColumnNames(context, query.column_name, visibleInfo);
    }

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

    this.sanitizeListArgsForPublicView(context, listArgs, visibleInfo);

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

      const visibleInfo = await this.getVisibleColumnInfo(context, view, model);

      if (query.column_name) {
        this.validateGroupByColumnNames(
          context,
          query.column_name,
          visibleInfo,
        );
      }

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

      this.sanitizeListArgsForPublicView(context, listArgs, visibleInfo);

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

    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id,
    });

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
    const currentModel = await view.getModel(context);

    if (column.fk_model_id !== currentModel.id)
      NcError.badRequest("Column doesn't belongs to the model");

    await currentModel.getColumns(context);
    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>(
      context,
    );

    const model = await colOptions.getRelatedTable(context);

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

    const { ast, dependencyFields } = await getAst(refContext, {
      query: sanitizePublicQuery(param.query),
      model,
      extractOnlyPrimaries: true,
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

    const column = await getColumnByIdOrName(
      context,
      param.columnId,
      await view.getModel(context),
    );

    if (column.fk_model_id !== view.fk_model_id)
      NcError.badRequest("Column doesn't belongs to the model");

    const source = await Source.get(context, view.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: view.fk_model_id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // Verify parent row is visible in the shared view before fetching relations
    const parentRow = await baseModel.readByPk(param.rowId);
    if (!parentRow) {
      NcError.recordNotFound(param.rowId);
    }

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

    const column = await getColumnByIdOrName(
      context,
      param.columnId,
      await view.getModel(context),
    );

    if (column.fk_model_id !== view.fk_model_id)
      NcError.badRequest("Column doesn't belongs to the model");

    const source = await Source.get(context, view.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: view.fk_model_id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // Verify parent row is visible in the shared view before fetching relations
    const parentRow = await baseModel.readByPk(param.rowId);
    if (!parentRow) {
      NcError.recordNotFound(param.rowId);
    }

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
    const { sharedViewUuid, rowId, password, query = {} } = param;
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

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const row = await baseModel.readByPk(rowId, false, query);

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

    const visibleInfo = await this.getVisibleColumnInfo(context, view, model);

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

    this.sanitizeListArgsForPublicView(context, listArgs, visibleInfo);

    if (!bulkFilterList?.length) {
      NcError.badRequest('Invalid bulkFilterList');
    }

    const dataListResults = await bulkFilterList.reduce(
      async (accPromise, dF: any) => {
        const acc = await accPromise;

        const sanitizedDf = { ...sanitizePublicQuery(dF) };
        this.sanitizeListArgsForPublicView(context, sanitizedDf, visibleInfo);

        const result = await this.datasService.dataList(context, {
          query: sanitizedDf,
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

  async bulkGroupBy(
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

    const base = await Base.get(context, view.base_id);

    this.publicMetasService.checkViewBaseType(view, base);
    if (!(await View.verifyPassword(view, param.password))) {
      return NcError.invalidSharedViewPassword();
    }

    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id,
    });

    const visibleInfo = await this.getVisibleColumnInfo(context, view, model);

    // Validate column_name in query-level args
    if (param.query?.column_name) {
      this.validateGroupByColumnNames(
        context,
        param.query.column_name,
        visibleInfo,
      );
    }

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const listArgs: any = { ...param.query };

    let bulkFilterList = param.body;

    try {
      bulkFilterList = JSON.parse(bulkFilterList);
    } catch (e) {}

    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}

    this.sanitizeListArgsForPublicView(context, listArgs, visibleInfo);

    // Validate column_name in each bulk filter entry
    if (ncIsArray(bulkFilterList)) {
      for (const entry of bulkFilterList) {
        if (entry?.column_name) {
          this.validateGroupByColumnNames(
            context,
            entry.column_name,
            visibleInfo,
          );
        }
        this.sanitizeListArgsForPublicView(context, entry, visibleInfo);
      }
    }

    if (!bulkFilterList?.length) {
      NcError.badRequest('Invalid bulkFilterList');
    }

    const [data, count] = await Promise.all([
      baseModel.bulkGroupBy(listArgs, bulkFilterList, view),
      baseModel.bulkGroupByCount(listArgs, bulkFilterList, view),
    ]);

    bulkFilterList.forEach((dF: any) => {
      // sqlite3 returns data as string. Hence needs to be converted to json object
      let parsedData = data[dF.alias];

      if (typeof parsedData === 'string') {
        parsedData = JSON.parse(parsedData);
      }

      let parsedCount = count[dF.alias];

      if (typeof parsedCount === 'string') {
        parsedCount = JSON.parse(parsedCount);
      }

      data[dF.alias] = new PagedResponseImpl(parsedData, {
        ...dF,
        count: parsedCount?.count,
      });
    });

    return data;
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

    const visibleInfo = await this.getVisibleColumnInfo(context, view, model);

    let bulkFilterList = param.body;

    const listArgs: any = { ...param.query };

    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}

    try {
      listArgs.aggregation = JSON.parse(listArgs.aggregation);
    } catch (e) {}

    try {
      bulkFilterList = JSON.parse(bulkFilterList);
    } catch (e) {}

    this.sanitizeListArgsForPublicView(context, listArgs, visibleInfo);

    if (ncIsArray(listArgs.aggregation)) {
      listArgs.aggregation = this.stripHiddenColumnsFromAggregation(
        listArgs.aggregation,
        visibleInfo.visibleColumnIds,
      );
    }

    // Sanitize where from each bulk filter entry
    if (ncIsArray(bulkFilterList)) {
      for (const entry of bulkFilterList) {
        this.sanitizeListArgsForPublicView(context, entry, visibleInfo);
      }
    }

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const data = await baseModel.bulkAggregate(listArgs, bulkFilterList, view);

    return data;
  }
}
