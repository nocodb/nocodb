import {Injectable, Logger} from '@nestjs/common';
import type {TableReqType, UserType} from 'nocodb-sdk';
import {viewTypeAlias} from 'nocodb-sdk';
import type {User} from '~/models';
import {Model} from '~/models';
import type {NcContext, NcRequest} from '~/interface/config';
import {ColumnsService} from '~/services/columns.service';
import {MetaDiffsService} from '~/services/meta-diffs.service';
import {AppHooksService} from '~/services/app-hooks/app-hooks.service';
import {builderGenerator, columnBuilder, columnV3ToV2Builder} from '~/utils/api-v3-data-transformation.builder';
import {TablesService} from '~/services/tables.service';
import {NcApiVersion} from "nocodb-sdk";

@Injectable()
export class TablesV3Service {
  protected logger = new Logger(TablesV3Service.name);
  protected tableReadBuilder;
  protected viewBuilder;

  constructor(
    protected readonly metaDiffService: MetaDiffsService,
    protected readonly appHooksService: AppHooksService,
    protected readonly columnsService: ColumnsService,
    protected readonly tablesService: TablesService,
  ) {
    this.tableReadBuilder = builderGenerator({
      allowed: ['id', 'source_id', 'base_id', 'title', 'description'],
    });

    this.viewBuilder = builderGenerator({
      allowed: ['id', 'title', 'type'],
      transformFn: (view) => {
        return {
          ...view,
          view_type: viewTypeAlias[view.type],
          type: undefined,
        };
      },
    });
  }

  async tableUpdate(
    context: NcContext,
    param: {
      tableId: any;
      table: TableReqType & { base_id?: string };
      baseId?: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    return true;
  }

  reorderTable(context: NcContext, param: { tableId: string; order: any }) {
    return Model.updateOrder(context, param.tableId, param.order);
  }

  async tableDelete(
    context: NcContext,
    param: {
      tableId: string;
      user: User;
      forceDeleteRelations?: boolean;
      req?: any;
    },
  ) {
    const result = await this.tablesService.tableDelete(context, param);
    return result;
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
    const result = this.tableReadBuilder().build(table);

    const viewBuilder = this.viewBuilder();
    result.views = table.views.map((view) => {
      return viewBuilder.build(view);
    });

    result.fields = table.columns.map((column) => {
      return columnBuilder().build(column);
    });

    return result;
  }

  async getAccessibleTables(
    context: NcContext,
    param: {
      baseId: string;
      sourceId: string;
      includeM2M?: boolean;
      roles: Record<string, boolean>;
    },
  ) {
    const tables = await this.tablesService.getAccessibleTables(context, param);

    return this.tableReadBuilder().build(tables);
  }

  async tableCreate(
    context: NcContext,
    param: {
      baseId: string;
      table: TableReqType;
      user: User | UserType;
      req?: any;
      sourceId?: string;
    },
  ) {
    const tableCreateReq: any = param.table;

    // remap the columns if provided
    if (tableCreateReq.fields) {
      tableCreateReq.columns = columnV3ToV2Builder().build(
        tableCreateReq.fields,
      );
    } else {
      tableCreateReq.columns = [];
    }

    const tableCreateOutput = await this.tablesService.tableCreate(context, {
      baseId: param.baseId,
      table: tableCreateReq,
      user: param.user,
      req: param.req,
      apiVersion: NcApiVersion.V3,
      sourceId: param.sourceId,
    });

    const result = this.tableReadBuilder().build(tableCreateOutput);


    result.fields = tableCreateOutput.columns.map((column) => {
      return columnBuilder().build(column);
    });

    return result;
  }
}
