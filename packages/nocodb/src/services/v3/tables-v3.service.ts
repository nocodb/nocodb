import { Injectable, Logger } from '@nestjs/common';
import { isVirtualCol, NcApiVersion, UITypes } from 'nocodb-sdk';
import type {
  ColumnReqType,
  ColumnType,
  FieldV3Type,
  TableCreateV3Type,
  TableReqType,
  TableUpdateV3Type,
  TableV3Type,
  UserType,
} from 'nocodb-sdk';
import type { Model, User } from '~/models';
import type { NcRequest } from '~/interface/config';
import { NcContext } from '~/interface/config';
import { Base, Column } from '~/models';
import { NcError } from '~/helpers/ncError';
import { ColumnsService } from '~/services/columns.service';
import { MetaDiffsService } from '~/services/meta-diffs.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import {
  columnBuilder,
  columnV3ToV2Builder,
} from '~/utils/api-v3-data-transformation.builder';
import { TablesService } from '~/services/tables.service';
import { tableReadBuilder, tableViewBuilder } from '~/utils/builders/table';
import { validatePayload } from '~/helpers';
import { ColumnsV3Service } from '~/services/v3/columns-v3.service';
import {
  captureForTrace,
  TraceCommand,
} from '~/decorators/trace-command.decorator';
import { OperationName } from '~/command-registry/op-names';

@Injectable()
export class TablesV3Service {
  protected logger = new Logger(TablesV3Service.name);

  constructor(
    protected readonly metaDiffService: MetaDiffsService,
    protected readonly appHooksService: AppHooksService,
    protected readonly columnsService: ColumnsService,
    protected readonly tablesService: TablesService,
    protected readonly columnsV3Service: ColumnsV3Service,
  ) {}

  async tableUpdate(
    context: NcContext,
    param: {
      tableId: any;
      table: TableUpdateV3Type;
      baseId?: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger-v3.json#/components/schemas/TableUpdate',
      param.table,
      true,
    );

    // `display_field_id` is applied via the column "set as primary" path, not
    // the generic table update (which only handles title/description/meta).
    // Split it out so the remaining payload can flow to the underlying service.
    const { display_field_id, ...table } = param.table;

    const tableUpdateReq: Partial<TableReqType> = { ...table };

    // if title includes then add table_name as well
    if (tableUpdateReq.title) {
      tableUpdateReq.table_name = tableUpdateReq.title;
    }

    // Only call the underlying table update when there is a non-display-field
    // change — on a display-field-only request the underlying service would
    // reject the payload for a missing table name.
    if (Object.keys(tableUpdateReq).length) {
      await this.tablesService.tableUpdate(context, {
        tableId: param.tableId,
        table: tableUpdateReq,
        baseId: param.baseId,
        user: param.user,
        req: param.req,
      });
    }

    if (display_field_id) {
      await this.setDisplayField(context, {
        tableId: param.tableId,
        columnId: display_field_id,
        req: param.req,
      });
    }

    return await this.getTableWithAccessibleViews(context, {
      tableId: param.tableId,
      user: param.user,
    });
  }

  // Apply `display_field_id` by marking the target column as the table's primary
  // value. The column is verified to belong to the table before delegating to
  // columnSetAsPrimary (which owns type validation, e.g. rejecting Long Text):
  // the route ACL only guards `tableId`, so this ownership check prevents
  // setting the display field on a table reached via a foreign column id.
  protected async setDisplayField(
    context: NcContext,
    param: { tableId: string; columnId: string; req: NcRequest },
  ) {
    const column = await Column.get(context, { colId: param.columnId });

    if (!column || column.fk_model_id !== param.tableId) {
      NcError.get(context).fieldNotFound(param.columnId);
    }

    // already the display field — nothing to do
    if (column.pv) return;

    await this.columnsService.columnSetAsPrimary(context, {
      columnId: param.columnId,
      req: param.req,
    });
  }

  async tableDelete(
    context: NcContext,
    param: {
      tableId: string;
      forceDeleteRelations?: boolean;
      req: NcRequest;
    },
  ) {
    await this.tablesService.tableDelete(context, param);
    return {};
  }

  async getTableWithAccessibleViews(
    context: NcContext,
    param: {
      tableId: string;
      user: User | UserType;
    },
  ) {
    const table = await this.tablesService.getTableWithAccessibleViews(
      context,
      param,
    );
    const result = tableReadBuilder().build(table);

    const viewBuilder = tableViewBuilder();
    result.views = table.views.map((view) => {
      return viewBuilder.build(view);
    });

    result.display_field_id = table.columns.find((column) => column.pv)?.id;

    result.fields = table.columns
      .filter((c) => !c.system || c.uidt === UITypes.ID)
      .map((column) => {
        return columnBuilder().build(column);
      });

    return result;
  }

  async getAccessibleTables(
    context: NcContext,
    param: {
      baseId: string;
      sourceId?: string;
      includeM2M?: boolean;
      roles: Record<string, boolean>;
      allSources?: boolean;
      user: (User | UserType) & {
        base_roles?: Record<string, boolean>;
        workspace_roles?: Record<string, boolean>;
      };
      isPublicBase?: boolean;
    },
  ) {
    const tables = await this.tablesService.getAccessibleTables(context, param);

    const metaSourceId = (
      await Base.get(context, param.baseId).then((base) => base?.getSources())
    )?.find((source) => source.isMeta)?.id;

    return tableReadBuilder().build(
      tables.map((table) => {
        // exclude source_id for tables from meta source
        if (metaSourceId && table.source_id === metaSourceId) {
          table.source_id = undefined;
        }
        return table;
      }),
    ) as unknown as TableV3Type[];
  }

  // Build the `dtxp` enum/set value list for a select column from its
  // colOptions.options titles, mirroring the per-field columnsService.columnAdd
  // logic. Without this the bulk table-create path emits a value-less enum.
  protected setSelectColumnDtxp(context: NcContext, column: ColumnReqType) {
    const col = column as ColumnReqType & {
      colOptions?: { options?: { title?: string }[] };
      dtxp?: string;
    };

    if (
      ![UITypes.SingleSelect, UITypes.MultiSelect].includes(col.uidt as UITypes)
    ) {
      return;
    }

    const options = col.colOptions?.options;

    // No choices at all → emit a single empty-string member so MySQL produces a
    // valid `enum('')`/`set('')` rather than a value-less `enum` (ER_PARSE_ERROR).
    // Harmless on Postgres/SQLite where select maps to text. Mirrors the
    // per-field columnsService.columnAdd MySQL fallback.
    if (!options?.length) {
      col.dtxp = "''";
      return;
    }

    col.dtxp = options
      .map((opt) => {
        const title = opt.title ?? '';
        // Reject empty option values, mirroring the per-field path.
        if (title === '') {
          NcError.get(context).invalidRequestBody(
            'Empty options are not allowed!',
          );
        }
        if (col.uidt === UITypes.MultiSelect && title.includes(',')) {
          NcError.get(context).invalidRequestBody(
            "Illegal char(',') for MultiSelect",
          );
        }
        return `'${title.replace(/'/gi, "''")}'`;
      })
      .join(',');
  }

  @TraceCommand(OperationName.tableV3Create)
  async tableCreate(
    context: NcContext,
    param: {
      baseId: string;
      table: TableCreateV3Type;
      user: User | UserType;
      req?: any;
      sourceId?: string;
    },
  ) {
    let tableCreateOutput: Model | undefined;
    try {
      validatePayload(
        'swagger-v3.json#/components/schemas/TableCreate',
        param.table,
        true,
        context,
      );

      const columns = [];
      const virtualColumns = [];

      for (const field of param.table.fields ?? []) {
        validatePayload(
          `swagger-v3.json#/components/schemas/FieldOptions/${field.type}`,
          field,
          true,
          context,
        );

        if (isVirtualCol(field.type as ColumnType)) {
          virtualColumns.push(field);
        } else {
          columns.push(field);
        }
      }

      const builtColumns = (
        columns?.length ? columnV3ToV2Builder().build(columns) : []
      ) as ColumnReqType[];

      // The V3 builder expands select `choices` into `colOptions.options` but
      // does not populate `dtxp` (the enum/set value list). The bulk
      // table-create path goes straight to tablesService.tableCreate and the
      // raw SQL builder, which — unlike the per-field columnsService.columnAdd
      // path — never derives `dtxp` from colOptions. Without it,
      // SingleSelect/MultiSelect columns emit a value-less `enum`/`set` on
      // MySQL (ER_PARSE_ERROR; harmless on Postgres/SQLite where select maps
      // to text). Derive it here so MySQL gets `enum('up','down')`, matching
      // the per-field endpoint.
      for (const col of builtColumns) {
        this.setSelectColumnDtxp(context, col);
      }

      const tableCreateReq = {
        ...param.table,
        columns: builtColumns,
      } as TableReqType;

      tableCreateOutput = await this.tablesService.tableCreate(context, {
        baseId: param.baseId,
        table: tableCreateReq,
        user: param.user,
        req: param.req,
        apiVersion: NcApiVersion.V3,
        sourceId: param.sourceId,
      });

      // create virtual columns after table creation
      for (const vCol of virtualColumns) {
        await this.columnsV3Service.columnAdd(context, {
          tableId: tableCreateOutput.id,
          column: vCol as FieldV3Type,
          req: param.req as NcRequest,
          user: param.user! as UserType,
        });
      }

      const finalModel = await this.tablesService.getTableWithAccessibleViews(
        context,
        { tableId: tableCreateOutput.id, user: param.user },
      );
      captureForTrace(
        'sandboxColumns',
        finalModel.columns.map((c) => ({
          id: c.id,
          title: c.title ?? c.column_name,
          cn: c.column_name,
        })),
      );
      const defaultViewId = finalModel.views?.[0]?.id;
      if (defaultViewId) captureForTrace('sandboxDefaultViewId', defaultViewId);

      return this.getTableWithAccessibleViews(context, {
        tableId: tableCreateOutput.id,
        user: param.user,
      });
    } catch (e) {
      // if table already created, delete it to avoid orphaned tables
      // this is to handle virtual column creation failures
      if (tableCreateOutput?.id) {
        this.tablesService
          .tableDelete(context, {
            tableId: tableCreateOutput.id,
            forceDeleteRelations: true,
            req: param.req,
          })
          .catch((deleteError) => {
            this.logger.error(
              `Failed to cleanup table with id ${tableCreateOutput?.id} after failed creation`,
              deleteError,
            );
          });
      }

      throw e;
    }
  }
}
